from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
import logging
import psycopg2
from backend.db import get_cursor

logger = logging.getLogger("edrs")

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
            raise HTTPException(status_code=404, detail="Investigation not found")

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


INVESTIGATION_UPDATE_FIELDS = {"status", "root_cause_category", "root_cause_detail", "corrective_action", "assigned_to", "due_date", "effectiveness_notes"}


@router.patch("/investigations/{investigation_id}")
def update_investigation(investigation_id: int, body: InvestigationUpdate):
    updates = []
    params = []
    for field, value in body.model_dump(exclude_unset=True).items():
        if field not in INVESTIGATION_UPDATE_FIELDS:
            continue
        updates.append(f'"{field}" = %s')
        params.append(value)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

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


ACTION_UPDATE_FIELDS = {"status", "assigned_to", "priority", "actual_savings", "verification_notes"}


@router.patch("/actions/{action_id}")
def update_action(action_id: int, body: ActionUpdate):
    updates = []
    params = []
    for field, value in body.model_dump(exclude_unset=True).items():
        if field not in ACTION_UPDATE_FIELDS:
            continue
        updates.append(f'"{field}" = %s')
        params.append(value)

    if body.status == "completed":
        updates.append("completed_at = NOW()")
    if body.status == "verified":
        updates.append("verified_at = NOW()")

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

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
            raise HTTPException(status_code=404, detail="Electrode not found")
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


@router.get("/knowledge/search")
def knowledge_search(q: str = Query(..., min_length=1), limit: int = Query(20, le=100)):
    """Full-text search across investigations, notes, and corrective actions."""
    try:
        with get_cursor() as cur:
            # Search investigations using plainto_tsquery for safe handling of arbitrary user input
            cur.execute("""
                SELECT i.investigation_id, i.gpn, i.defect_code, i.defect_site,
                       i.root_cause_category, i.root_cause_detail, i.status,
                       ts_headline('english', coalesce(i.root_cause_detail,'') || ' ' || coalesce(i.corrective_action,'') || ' ' || coalesce(i.effectiveness_notes,''),
                         plainto_tsquery('english', %s),
                         'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') as snippet,
                       ts_rank(i.search_vector, plainto_tsquery('english', %s)) as rank,
                       'investigation' as source
                FROM investigations i
                WHERE i.search_vector @@ plainto_tsquery('english', %s)
                ORDER BY rank DESC
                LIMIT %s
            """, (q, q, q, limit))
            inv_results = [dict(r) for r in cur.fetchall()]

            # Search notes
            cur.execute("""
                SELECT n.note_id, n.investigation_id, n.author, n.note_text,
                       ts_headline('english', n.note_text, plainto_tsquery('english', %s),
                         'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') as snippet,
                       ts_rank(n.search_vector, plainto_tsquery('english', %s)) as rank,
                       'note' as source
                FROM investigation_notes n
                WHERE n.search_vector @@ plainto_tsquery('english', %s)
                ORDER BY rank DESC
                LIMIT %s
            """, (q, q, q, limit))
            note_results = [dict(r) for r in cur.fetchall()]

            # Search corrective actions
            cur.execute("""
                SELECT a.action_id, a.investigation_id, a.title, a.description,
                       a.action_type, a.status, a.verified_at,
                       ts_headline('english', coalesce(a.title,'') || ' ' || coalesce(a.description,'') || ' ' || coalesce(a.verification_notes,''),
                         plainto_tsquery('english', %s),
                         'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') as snippet,
                       ts_rank(a.search_vector, plainto_tsquery('english', %s)) as rank,
                       'action' as source
                FROM corrective_actions a
                WHERE a.search_vector @@ plainto_tsquery('english', %s)
                ORDER BY rank DESC
                LIMIT %s
            """, (q, q, q, limit))
            action_results = [dict(r) for r in cur.fetchall()]

        return {
            "query": q,
            "total_results": len(inv_results) + len(note_results) + len(action_results),
            "investigations": inv_results,
            "notes": note_results,
            "actions": action_results,
        }
    except psycopg2.Error as e:
        logger.warning("Full-text search failed, falling back to ILIKE: %s", e)
        search_term = f"%{q}%"
        with get_cursor() as cur:
            cur.execute("""
                SELECT investigation_id, gpn, defect_code, defect_site,
                       root_cause_category, root_cause_detail, status,
                       root_cause_detail as snippet, 0.0 as rank, 'investigation' as source
                FROM investigations
                WHERE root_cause_detail ILIKE %s OR corrective_action ILIKE %s OR effectiveness_notes ILIKE %s
                LIMIT %s
            """, (search_term, search_term, search_term, limit))
            inv_results = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT note_id, investigation_id, author, note_text,
                       note_text as snippet, 0.0 as rank, 'note' as source
                FROM investigation_notes
                WHERE note_text ILIKE %s
                LIMIT %s
            """, (search_term, limit))
            note_results = [dict(r) for r in cur.fetchall()]

            cur.execute("""
                SELECT action_id, investigation_id, title, description,
                       action_type, status, verified_at,
                       title as snippet, 0.0 as rank, 'action' as source
                FROM corrective_actions
                WHERE title ILIKE %s OR description ILIKE %s OR verification_notes ILIKE %s
                LIMIT %s
            """, (search_term, search_term, search_term, limit))
            action_results = [dict(r) for r in cur.fetchall()]

        return {
            "query": q,
            "total_results": len(inv_results) + len(note_results) + len(action_results),
            "investigations": inv_results,
            "notes": note_results,
            "actions": action_results,
        }


@router.get("/investigations/{investigation_id}/ai-analysis")
def ai_root_cause_analysis(investigation_id: int):
    """Mock GenAI root-cause analysis grounded in real electrode data."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM investigations WHERE investigation_id = %s", (investigation_id,))
        inv = cur.fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")
        inv = dict(inv)

        # Fetch the electrode and its lifecycle data
        cur.execute("""
            SELECT e.*, l.lot_defect_rate, l.risk_tier
            FROM electrodes e
            LEFT JOIN lots l ON e.lot = l.lot_id
            WHERE e.gpn = %s
        """, (inv["gpn"],))
        electrode = cur.fetchone()
        if not electrode:
            raise HTTPException(status_code=404, detail="Electrode not found")
        electrode = dict(electrode)

        # Get run details
        bake_run = None
        if electrode.get("run_number_ob"):
            cur.execute("SELECT * FROM runs WHERE run_number = %s", (electrode["run_number_ob"],))
            row = cur.fetchone()
            if row:
                bake_run = dict(row)

        graphite_run = None
        if electrode.get("run_number_og"):
            cur.execute("SELECT * FROM runs WHERE run_number = %s", (electrode["run_number_og"],))
            row = cur.fetchone()
            if row:
                graphite_run = dict(row)

        # Sibling defect rate
        sibling_defect_count = 0
        sibling_total = 0
        if electrode.get("run_number_og"):
            cur.execute("""
                SELECT COUNT(*) as total,
                       SUM(CASE WHEN defect_code_og IS NOT NULL OR defect_code_of IS NOT NULL THEN 1 ELSE 0 END) as defects
                FROM electrodes WHERE run_number_og = %s AND gpn != %s
            """, (electrode["run_number_og"], inv["gpn"]))
            sib = cur.fetchone()
            if sib:
                sibling_total = sib["total"] or 0
                sibling_defect_count = sib["defects"] or 0

    # Build analysis paragraphs grounded in actual data
    factors = []
    paragraphs = []

    # Paragraph 1: Electrode journey
    defect_locations = []
    if electrode.get("defect_code_ob"):
        defect_locations.append(f"bake ({electrode['defect_code_ob']})")
    if electrode.get("defect_code_og"):
        defect_locations.append(f"graphite ({electrode['defect_code_og']})")
    if electrode.get("defect_code_of"):
        defect_locations.append(f"finishing ({electrode['defect_code_of']})")

    journey = f"Electrode {inv['gpn']} (lot {electrode['lot']}, {electrode['diameter']}mm diameter, {electrode['coke_blend']} blend) "
    if bake_run:
        journey += f"was processed in bake run {bake_run['run_number']} on {bake_run['furnace']}"
        if graphite_run:
            journey += f", then graphitized in run {graphite_run['run_number']} on {graphite_run['furnace']}"
    elif graphite_run:
        journey += f"was graphitized in run {graphite_run['run_number']} on {graphite_run['furnace']}"
    journey += ". "

    if defect_locations:
        journey += f"Defect was detected at: {', '.join(defect_locations)}. "
    if sibling_total > 0:
        sibling_rate = sibling_defect_count / sibling_total * 100
        journey += f"Among {sibling_total} siblings in the same graphite run, {sibling_defect_count} ({sibling_rate:.0f}%) also exhibited defects"
        if sibling_rate > 30:
            journey += " — suggesting a systemic process issue rather than an isolated material flaw."
        else:
            journey += "."
    paragraphs.append(journey)

    # Paragraph 2: Risk factors
    risk_text_parts = []

    if electrode.get("car_deck_ob") and electrode["car_deck_ob"] >= 7:
        factors.append({
            "name": "High Car Deck Position",
            "impact": "high",
            "detail": f"Deck {electrode['car_deck_ob']} places this electrode in a zone with reduced thermal uniformity. Historical data shows decks 7-9 produce ~40-70% more downstream defects.",
        })
        risk_text_parts.append(f"high car deck position (deck {electrode['car_deck_ob']}), which is associated with reduced thermal uniformity")

    if electrode.get("position_og") and electrode["position_og"] in (1, 2, 13, 14):
        factors.append({
            "name": "Edge Position",
            "impact": "high",
            "detail": f"Position {electrode['position_og']} is an edge slot in the graphite furnace, subject to uneven heat distribution and higher thermal gradients.",
        })
        risk_text_parts.append(f"edge position ({electrode['position_og']}) in the graphite furnace, exposed to thermal gradients")

    if electrode.get("risk_tier") == "high":
        lot_rate = (electrode.get("lot_defect_rate") or 0) * 100
        factors.append({
            "name": "High-Risk Lot",
            "impact": "high",
            "detail": f"Lot {electrode['lot']} has a historical defect rate of {lot_rate:.1f}%, classifying it as high-risk. Material variability in this lot likely contributes to defect susceptibility.",
        })
        risk_text_parts.append(f"membership in high-risk lot {electrode['lot']} (historical defect rate: {lot_rate:.1f}%)")
    elif electrode.get("lot_defect_rate") and electrode["lot_defect_rate"] > 0.05:
        lot_rate = electrode["lot_defect_rate"] * 100
        factors.append({
            "name": "Elevated Lot Risk",
            "impact": "medium",
            "detail": f"Lot {electrode['lot']} has a defect rate of {lot_rate:.1f}%, above the 5% threshold for concern.",
        })
        risk_text_parts.append(f"elevated lot defect rate ({lot_rate:.1f}%)")

    if bake_run and bake_run.get("actual_kwh") and bake_run["actual_kwh"] > 50000:
        factors.append({
            "name": "High Energy Consumption",
            "impact": "medium",
            "detail": f"Bake run consumed {bake_run['actual_kwh']:,.0f} kWh, which may indicate furnace inefficiency or extended cycle time.",
        })
        risk_text_parts.append(f"elevated bake energy consumption ({bake_run['actual_kwh']:,.0f} kWh)")

    if bake_run and bake_run.get("total_downtime") and bake_run["total_downtime"] > 2:
        factors.append({
            "name": "Excessive Downtime",
            "impact": "medium",
            "detail": f"Bake run experienced {bake_run['total_downtime']:.1f} hours of downtime, which can cause thermal cycling stress.",
        })
        risk_text_parts.append(f"excessive downtime ({bake_run['total_downtime']:.1f} hrs) causing potential thermal cycling")

    if not factors:
        factors.append({
            "name": "No Elevated Risk Factors",
            "impact": "low",
            "detail": "No individual risk factors were flagged above threshold. The defect may be due to compounding minor effects or stochastic variation.",
        })

    if risk_text_parts:
        risk_para = f"Contributing risk factors include: {'; '.join(risk_text_parts)}. "
        if len(factors) >= 2:
            risk_para += "The combination of multiple risk factors increases the probability of defect through compounding effects."
        paragraphs.append(risk_para)
    else:
        paragraphs.append("No individual risk factors exceeded alert thresholds. The defect may stem from compounding minor variations or stochastic material behavior.")

    # Paragraph 3: Recommendation
    if inv.get("root_cause_category"):
        rec = f"Given the identified root cause category ({inv['root_cause_category']}), "
    else:
        rec = "Based on the available data, "

    recommendations = []
    if any(f["name"] == "High Car Deck Position" for f in factors):
        recommendations.append("review car deck loading procedures to avoid placing susceptible electrodes in high-deck positions")
    if any(f["name"] == "Edge Position" for f in factors):
        recommendations.append("consider position rotation or adding thermal baffles for edge slots")
    if any(f["name"] in ("High-Risk Lot", "Elevated Lot Risk") for f in factors):
        recommendations.append(f"flag lot {electrode['lot']} for enhanced incoming inspection and consider segregating remaining inventory")
    if any(f["name"] == "Excessive Downtime" for f in factors):
        recommendations.append("investigate root cause of furnace downtime to prevent thermal cycling damage")
    if not recommendations:
        recommendations.append("continue monitoring this electrode family and conduct destructive testing on representative samples")

    rec += "we recommend: " + "; ".join(recommendations) + "."
    paragraphs.append(rec)

    analysis_text = "\n\n".join(paragraphs)
    confidence = min(0.92, 0.65 + 0.07 * len(factors))
    recommendation = recommendations[0].capitalize() + "." if recommendations else "Monitor for recurrence."

    return {
        "analysis": analysis_text,
        "confidence": round(confidence, 2),
        "factors": factors,
        "recommendation": recommendation,
    }


@router.get("/investigations/{investigation_id}/similar")
def similar_investigations(investigation_id: int):
    """Find similar past investigations based on matching attributes."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM investigations WHERE investigation_id = %s", (investigation_id,))
        inv = cur.fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Investigation not found")
        inv = dict(inv)

        defect_code = inv.get("defect_code")
        defect_site = inv.get("defect_site")
        root_cause_category = inv.get("root_cause_category")

        # Find investigations that match on 2+ attributes
        cur.execute("""
            SELECT i.*,
                   (CASE WHEN i.defect_code = %s THEN 1 ELSE 0 END +
                    CASE WHEN i.defect_site = %s THEN 1 ELSE 0 END +
                    CASE WHEN i.root_cause_category = %s THEN 1 ELSE 0 END) as match_score
            FROM investigations i
            WHERE i.investigation_id != %s
              AND (CASE WHEN i.defect_code = %s THEN 1 ELSE 0 END +
                   CASE WHEN i.defect_site = %s THEN 1 ELSE 0 END +
                   CASE WHEN i.root_cause_category = %s THEN 1 ELSE 0 END) >= 2
            ORDER BY (CASE WHEN i.defect_code = %s THEN 1 ELSE 0 END +
                      CASE WHEN i.defect_site = %s THEN 1 ELSE 0 END +
                      CASE WHEN i.root_cause_category = %s THEN 1 ELSE 0 END) DESC,
                     i.created_at DESC
            LIMIT 5
        """, (
            defect_code, defect_site, root_cause_category,
            investigation_id,
            defect_code, defect_site, root_cause_category,
            defect_code, defect_site, root_cause_category,
        ))
        matches = [dict(r) for r in cur.fetchall()]

        # For each match, get corrective actions and build explanation
        similar_cases = []
        for m in matches:
            match_score = m.pop("match_score", 0)
            # Build match explanation
            matched_on = []
            if m.get("defect_code") == defect_code and defect_code:
                matched_on.append(f"same defect code ({defect_code})")
            if m.get("defect_site") == defect_site and defect_site:
                matched_on.append(f"same defect site ({defect_site})")
            if m.get("root_cause_category") == root_cause_category and root_cause_category:
                matched_on.append(f"similar root cause ({root_cause_category})")

            explanation = "Matched on: " + ", ".join(matched_on) if matched_on else "Matched on multiple attributes"

            # Check for effective corrective action
            cur.execute("""
                SELECT title, description, status, verification_notes
                FROM corrective_actions
                WHERE investigation_id = %s AND status = 'verified'
                ORDER BY verified_at DESC LIMIT 1
            """, (m["investigation_id"],))
            verified_action = cur.fetchone()
            effective_action = None
            if verified_action:
                va = dict(verified_action)
                effective_action = va["title"]
                if va.get("verification_notes"):
                    effective_action += f" — {va['verification_notes']}"

            similar_cases.append({
                "investigation": m,
                "match_score": match_score,
                "match_explanation": explanation,
                "effective_action": effective_action,
            })

        # Build recommendations from corrective actions of similar cases
        similar_inv_ids = [sc["investigation"]["investigation_id"] for sc in similar_cases]
        recommendations = []
        if similar_inv_ids:
            cur.execute("""
                SELECT a.action_type, a.title, a.status, a.verified_at,
                       a.defect_rate_before, a.defect_rate_after
                FROM corrective_actions a
                WHERE a.investigation_id IN %s
            """, (tuple(similar_inv_ids),))
            all_actions = [dict(r) for r in cur.fetchall()]

            action_groups: dict = {}
            for action in all_actions:
                key = action["action_type"] or "other"
                if key not in action_groups:
                    action_groups[key] = {
                        "action_type": key,
                        "total_count": 0,
                        "verified_effective": 0,
                        "verified_ineffective": 0,
                        "avg_rate_before": [],
                        "avg_rate_after": [],
                        "example_titles": [],
                    }
                group = action_groups[key]
                group["total_count"] += 1
                if action["title"] and action["title"] not in group["example_titles"]:
                    group["example_titles"].append(action["title"])

                if action["verified_at"]:
                    if action["defect_rate_after"] is not None and action["defect_rate_before"] is not None:
                        if action["defect_rate_after"] < action["defect_rate_before"]:
                            group["verified_effective"] += 1
                        else:
                            group["verified_ineffective"] += 1
                        group["avg_rate_before"].append(action["defect_rate_before"])
                        group["avg_rate_after"].append(action["defect_rate_after"])

            for key, group in action_groups.items():
                success_rate = group["verified_effective"] / max(group["total_count"], 1)
                avg_improvement = None
                if group["avg_rate_before"] and group["avg_rate_after"]:
                    avg_before = sum(group["avg_rate_before"]) / len(group["avg_rate_before"])
                    avg_after = sum(group["avg_rate_after"]) / len(group["avg_rate_after"])
                    avg_improvement = round((1 - avg_after / avg_before) * 100, 1) if avg_before > 0 else None

                recommendations.append({
                    "action_type": key,
                    "total_count": group["total_count"],
                    "verified_effective": group["verified_effective"],
                    "verified_ineffective": group["verified_ineffective"],
                    "success_rate": round(success_rate, 2),
                    "avg_improvement_pct": avg_improvement,
                    "example_titles": group["example_titles"][:3],
                    "is_recommended": success_rate >= 0.6 and group["verified_effective"] >= 2,
                    "is_ineffective": group["verified_ineffective"] > group["verified_effective"],
                })

            recommendations.sort(key=lambda r: (-r["is_recommended"], -r["success_rate"]))

    return {"similar_cases": similar_cases, "recommendations": recommendations}
