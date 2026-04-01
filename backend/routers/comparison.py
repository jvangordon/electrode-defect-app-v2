from fastapi import APIRouter, Query
from typing import Optional
from backend.db import get_cursor

router = APIRouter(tags=["comparison"])


@router.get("/runs")
def list_runs(
    department: Optional[str] = None,
    furnace: Optional[str] = None,
    limit: int = Query(100, le=500),
    offset: int = 0,
):
    with get_cursor() as cur:
        conditions = []
        params = []
        if department:
            conditions.append("department = %s")
            params.append(department)
        if furnace:
            conditions.append("furnace = %s")
            params.append(furnace)

        where = "WHERE " + " AND ".join(conditions) if conditions else ""
        cur.execute(
            f"""SELECT run_number, department, furnace, profile, load_config,
                       car_deck, total_pieces, total_weight,
                       start_time, end_time, cooling_end_time, duration_hours,
                       actual_kwh, total_downtime, defect_count, defect_rate, risk_score
                FROM runs {where}
                ORDER BY start_time DESC
                LIMIT %s OFFSET %s""",
            params + [limit, offset],
        )
        runs = [dict(r) for r in cur.fetchall()]

        cur.execute(f"SELECT COUNT(*) as total FROM runs {where}", params)
        total = cur.fetchone()["total"]

    return {"runs": runs, "total": total}


@router.get("/runs/compare")
def compare_runs(run_a: str, run_b: str):
    with get_cursor() as cur:
        # Fetch both runs
        cur.execute(
            """SELECT * FROM runs WHERE run_number IN (%s, %s)""",
            (run_a, run_b),
        )
        runs_data = {r["run_number"]: dict(r) for r in cur.fetchall()}

        if run_a not in runs_data or run_b not in runs_data:
            return {"error": "One or both runs not found"}

        # Fetch electrodes for both runs
        cur.execute(
            """SELECT e.*, l.lot_defect_rate, l.risk_tier
               FROM electrodes e
               LEFT JOIN lots l ON e.lot = l.lot_id
               WHERE e.run_number_ob = %s OR e.run_number_ob = %s
                  OR e.run_number_og = %s OR e.run_number_og = %s""",
            (run_a, run_b, run_a, run_b),
        )
        all_electrodes = [dict(r) for r in cur.fetchall()]

        electrodes_a = []
        electrodes_b = []
        for e in all_electrodes:
            if e.get("run_number_ob") == run_a or e.get("run_number_og") == run_a:
                electrodes_a.append(e)
            if e.get("run_number_ob") == run_b or e.get("run_number_og") == run_b:
                electrodes_b.append(e)

        # Parameter diff
        ra = runs_data[run_a]
        rb = runs_data[run_b]
        param_keys = [
            "furnace", "profile", "load_config", "car_deck",
            "total_pieces", "total_weight", "duration_hours",
            "actual_kwh", "total_downtime", "defect_count", "defect_rate",
        ]
        param_diff = []
        for key in param_keys:
            va = ra.get(key)
            vb = rb.get(key)
            deviation = None
            if isinstance(va, (int, float)) and isinstance(vb, (int, float)) and va:
                deviation = round(abs(vb - va) / max(abs(va), 0.001) * 100, 1)
            param_diff.append({
                "parameter": key,
                "run_a": va,
                "run_b": vb,
                "deviation_pct": deviation,
                "significant": deviation is not None and deviation > 20,
            })

        # Sensor data
        cur.execute(
            """SELECT run_number, tag_name, timestamp, value
               FROM sensor_readings
               WHERE run_number IN (%s, %s)
               ORDER BY tag_name, timestamp""",
            (run_a, run_b),
        )
        sensor_rows = [dict(r) for r in cur.fetchall()]

        # Normalize sensor timestamps to minutes from start
        sensors_a = []
        sensors_b = []
        for s in sensor_rows:
            run_num = s["run_number"]
            run_data = runs_data[run_num]
            start = run_data["start_time"]
            if start:
                s["minutes_from_start"] = (s["timestamp"] - start).total_seconds() / 60
            if run_num == run_a:
                sensors_a.append(s)
            else:
                sensors_b.append(s)

    return {
        "run_a": runs_data[run_a],
        "run_b": runs_data[run_b],
        "electrodes_a": electrodes_a,
        "electrodes_b": electrodes_b,
        "param_diff": param_diff,
        "sensors_a": sensors_a,
        "sensors_b": sensors_b,
    }


@router.get("/runs/{run_number}")
def get_run_detail(run_number: str):
    with get_cursor() as cur:
        cur.execute("SELECT * FROM runs WHERE run_number = %s", (run_number,))
        run = cur.fetchone()
        if not run:
            return {"error": "Run not found"}

        cur.execute(
            """SELECT e.*, l.lot_defect_rate, l.risk_tier
               FROM electrodes e
               LEFT JOIN lots l ON e.lot = l.lot_id
               WHERE e.run_number_ob = %s OR e.run_number_og = %s""",
            (run_number, run_number),
        )
        electrodes = [dict(r) for r in cur.fetchall()]

        cur.execute(
            """SELECT tag_name, timestamp, value
               FROM sensor_readings
               WHERE run_number = %s
               ORDER BY tag_name, timestamp""",
            (run_number,),
        )
        sensors = [dict(r) for r in cur.fetchall()]

    return {"run": dict(run), "electrodes": electrodes, "sensors": sensors}
