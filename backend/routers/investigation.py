from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from backend.db import get_cursor

router = APIRouter(tags=["investigation"])


class InvestigationCreate(BaseModel):
    gpn: str
    run_number: Optional[str] = None
    defect_code: Optional[str] = None
    defect_site: Optional[str] = None
    root_cause_category: Optional[str] = None
    root_cause_detail: Optional[str] = None
    corrective_action: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    created_by: Optional[str] = None


class InvestigationUpdate(BaseModel):
    status: Optional[str] = None
    root_cause_category: Optional[str] = None
    root_cause_detail: Optional[str] = None
    corrective_action: Optional[str] = None
    assigned_to: Optional[str] = None
    due_date: Optional[date] = None
    effectiveness_notes: Optional[str] = None


class NoteCreate(BaseModel):
    author: str
    note_text: str


class ActionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    action_type: Optional[str] = "corrective"
    assigned_to: Optional[str] = None
    priority: Optional[str] = "medium"
    due_date: Optional[date] = None
    expected_savings: Optional[float] = None


class ActionUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    actual_savings: Optional[float] = None
    verification_notes: Optional[str] = None


@router.get("/investigations")
def list_investigations(
    status: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    with get_cursor() as cur:
        conditions = []
        params = []
        if status:
            conditions.append("i.status = %s")
            params.append(status)

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        cur.execute(f"""
            SELECT i.*,
                   (SELECT COUNT(*) FROM investigation_notes n WHERE n.investigation_id = i.investigation_id) as note_count,
                   (SELECT COUNT(*) FROM corrective_actions a WHERE a.investigation_id = i.investigation_id) as action_count,
                   (SELECT COUNT(*) FROM corrective_actions a
                    WHERE a.investigation_id = i.investigation_id
                      AND a.status IN ('open', 'in_progress')
                      AND a.due_date < CURRENT_DATE) as overdue_actions
            FROM investigations i
            {where}
            ORDER BY i.created_at DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        investigations = [dict(r) for r in cur.fetchall()]

        cur.execute(f"SELECT COUNT(*) as total FROM investigations i {where}", params)
        total = cur.fetchone()["total"]

    return {"investigations": investigations, "total": total}


@router.get("/investigations/{investigation_id}")
def get_investigation(investigation_id: int):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM investigations WHERE investigation_id = %s", (investigation_id,))
        inv = cur.fetchone()
        if not inv:
            return {"error": "Investigation not found"}

        cur.execute("""
            SELECT * FROM investigation_notes
            WHERE investigation_id = %s ORDER BY created_at DESC
        """, (investigation_id,))
        notes = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT * FROM corrective_actions
            WHERE investigation_id = %s ORDER BY priority DESC, due_date ASC
        """, (investigation_id,))
        actions = [dict(r) for r in cur.fetchall()]

    return {"investigation": dict(inv), "notes": notes, "actions": actions}


@router.post("/investigations")
def create_investigation(body: InvestigationCreate):
    with get_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO investigations (gpn, run_number, defect_code, defect_site,
                root_cause_category, root_cause_detail, corrective_action,
                assigned_to, due_date, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING investigation_id
        """, (
            body.gpn, body.run_number, body.defect_code, body.defect_site,
            body.root_cause_category, body.root_cause_detail, body.corrective_action,
            body.assigned_to, body.due_date, body.created_by,
        ))
        inv_id = cur.fetchone()["investigation_id"]
    return {"investigation_id": inv_id}


@router.patch("/investigations/{investigation_id}")
def update_investigation(investigation_id: int, body: InvestigationUpdate):
    updates = []
    params = []
    for field, value in body.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = %s")
        params.append(value)

    if not updates:
        return {"error": "No fields to update"}

    # Auto-set closed_at when status changes to closed/verified
    if body.status in ("closed", "verified"):
        updates.append("closed_at = NOW()")

    params.append(investigation_id)
    with get_cursor(commit=True) as cur:
        cur.execute(
            f"UPDATE investigations SET {', '.join(updates)} WHERE investigation_id = %s",
            params,
        )
    return {"ok": True}


@router.post("/investigations/{investigation_id}/notes")
def add_note(investigation_id: int, body: NoteCreate):
    with get_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO investigation_notes (investigation_id, author, note_text)
            VALUES (%s, %s, %s) RETURNING note_id
        """, (investigation_id, body.author, body.note_text))
        note_id = cur.fetchone()["note_id"]
    return {"note_id": note_id}


@router.post("/investigations/{investigation_id}/actions")
def add_action(investigation_id: int, body: ActionCreate):
    with get_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO corrective_actions (investigation_id, title, description,
                action_type, assigned_to, priority, due_date, expected_savings)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING action_id
        """, (
            investigation_id, body.title, body.description,
            body.action_type, body.assigned_to, body.priority,
            body.due_date, body.expected_savings,
        ))
        action_id = cur.fetchone()["action_id"]
    return {"action_id": action_id}


@router.patch("/actions/{action_id}")
def update_action(action_id: int, body: ActionUpdate):
    updates = []
    params = []
    for field, value in body.model_dump(exclude_unset=True).items():
        updates.append(f"{field} = %s")
        params.append(value)

    if body.status == "completed":
        updates.append("completed_at = NOW()")
    if body.status == "verified":
        updates.append("verified_at = NOW()")

    if not updates:
        return {"error": "No fields to update"}

    params.append(action_id)
    with get_cursor(commit=True) as cur:
        cur.execute(
            f"UPDATE corrective_actions SET {', '.join(updates)} WHERE action_id = %s",
            params,
        )
    return {"ok": True}


@router.get("/electrodes/search")
def search_electrodes(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, le=100),
):
    """Search electrodes by GPN, lot, or run number."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT e.gpn, e.lot, e.diameter, e.weight_kg,
                   e.run_number_ob, e.run_number_og, e.furnace_og, e.position_og,
                   e.defect_code_ob, e.defect_code_og, e.defect_code_of,
                   l.risk_tier
            FROM electrodes e
            LEFT JOIN lots l ON e.lot = l.lot_id
            WHERE e.gpn ILIKE %s
               OR e.lot ILIKE %s
               OR e.run_number_ob ILIKE %s
               OR e.run_number_og ILIKE %s
            LIMIT %s
        """, (f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%", limit))
        results = [dict(r) for r in cur.fetchall()]
    return {"results": results}


@router.get("/electrodes/{gpn}")
def get_electrode_detail(gpn: str):
    """Full electrode lifecycle for investigation view."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT e.*, l.lot_defect_rate, l.risk_tier
            FROM electrodes e
            LEFT JOIN lots l ON e.lot = l.lot_id
            WHERE e.gpn = %s
        """, (gpn,))
        electrode = cur.fetchone()
        if not electrode:
            return {"error": "Electrode not found"}
        electrode = dict(electrode)

        # Get bake run details
        bake_run = None
        if electrode.get("run_number_ob"):
            cur.execute("SELECT * FROM runs WHERE run_number = %s", (electrode["run_number_ob"],))
            row = cur.fetchone()
            if row:
                bake_run = dict(row)

        # Get graphite run details
        graphite_run = None
        if electrode.get("run_number_og"):
            cur.execute("SELECT * FROM runs WHERE run_number = %s", (electrode["run_number_og"],))
            row = cur.fetchone()
            if row:
                graphite_run = dict(row)

        # Sibling electrodes (same graphite run)
        siblings = []
        if electrode.get("run_number_og"):
            cur.execute("""
                SELECT gpn, lot, position_og, diameter, defect_code_og, defect_code_of,
                       weight_kg, er, ad
                FROM electrodes
                WHERE run_number_og = %s AND gpn != %s
                ORDER BY position_og
            """, (electrode["run_number_og"], gpn))
            siblings = [dict(r) for r in cur.fetchall()]

        # Risk factors for this electrode
        cur.execute("SELECT * FROM risk_factors ORDER BY factor_name, risk_group")
        all_risk_factors = [dict(r) for r in cur.fetchall()]

        # Build lifecycle steps
        lifecycle = _build_lifecycle(electrode, bake_run, graphite_run)

        # Any existing investigations for this GPN
        cur.execute("""
            SELECT * FROM investigations WHERE gpn = %s ORDER BY created_at DESC
        """, (gpn,))
        investigations = [dict(r) for r in cur.fetchall()]

    return {
        "electrode": electrode,
        "bake_run": bake_run,
        "graphite_run": graphite_run,
        "siblings": siblings,
        "risk_factors": all_risk_factors,
        "lifecycle": lifecycle,
        "investigations": investigations,
    }


def _build_lifecycle(electrode, bake_run, graphite_run):
    """Build 10-step lifecycle for an electrode."""
    steps = []
    has_bake_defect = electrode.get("defect_code_ob") is not None
    has_graphite_defect = electrode.get("defect_code_og") is not None
    has_finishing_defect = electrode.get("defect_code_of") is not None

    step_defs = [
        ("Plant A Extrusion", None, None, "clean"),
        ("Plant A Bake", bake_run, electrode.get("defect_code_ob"), None),
        ("Plant A PI", None, None, "clean"),
        ("Plant A Rebake", None, None, "no_data"),
        ("Plant B Bake", bake_run, electrode.get("defect_code_ob"), None),
        ("Plant B PI", None, None, "clean"),
        ("Plant B Rebake", None, None, "no_data"),
        ("Plant B Graphite", graphite_run, electrode.get("defect_code_og"), None),
        ("Plant B Finishing", None, electrode.get("defect_code_of"), None),
        ("Plant B Assembly", None, None, "no_data"),
    ]

    for name, run, defect_code, override_status in step_defs:
        if override_status:
            status = override_status
        elif defect_code:
            status = "defect"
        elif run:
            status = "clean"
        else:
            status = "no_data"

        step = {
            "step_name": name,
            "status": status,
            "defect_code": defect_code,
            "run_number": run["run_number"] if run else None,
            "furnace": run["furnace"] if run else None,
            "parameters": {},
        }
        if run:
            step["parameters"] = {
                "kwh": run.get("actual_kwh"),
                "duration": run.get("duration_hours"),
                "furnace": run.get("furnace"),
            }
        steps.append(step)

    return steps
