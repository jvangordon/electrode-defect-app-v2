from datetime import datetime, timedelta

from fastapi import APIRouter, Query

from db import get_cursor

router = APIRouter(tags=["live"])


@router.get("/runs/active")
def get_active_run():
    with get_cursor() as cur:
        cur.execute(
            """SELECT run_number, furnace, total_pieces, profile, car_deck,
                      duration_hours, defect_cost, risk_score, start_time
               FROM runs
               WHERE is_live_demo = true
               LIMIT 1"""
        )
        row = cur.fetchone()

    if not row:
        return {"active": False}

    # Look up risk quintile from composition_risk via risk_score
    risk_quintile = row["risk_score"] or "Q3"

    simulated_start = datetime.now() - timedelta(minutes=30)

    return {
        "run_number": row["run_number"],
        "furnace": row["furnace"],
        "total_pieces": row["total_pieces"],
        "profile": row["profile"],
        "car_deck": row["car_deck"],
        "duration_hours": row["duration_hours"],
        "defect_cost": row["defect_cost"],
        "simulated_start": simulated_start.isoformat(),
        "risk_score": row["risk_score"],
        "risk_quintile": risk_quintile,
        "status": "monitoring",
    }


@router.get("/runs/{run_number}/live")
def get_live_data(run_number: str, elapsed_minutes: float = Query(default=0)):
    with get_cursor() as cur:
        # Get the run's original start_time and end_time
        cur.execute(
            "SELECT start_time, end_time, duration_hours, furnace FROM runs WHERE run_number = %s",
            (run_number,),
        )
        run = cur.fetchone()

    if not run:
        return {"error": "Run not found"}

    original_start = run["start_time"]
    original_end = run["end_time"]
    furnace = run["furnace"]
    total_duration_minutes = (run["duration_hours"] or 0) * 60

    # Map elapsed_minutes to original timestamp
    original_timestamp = original_start + timedelta(minutes=elapsed_minutes)
    is_complete = elapsed_minutes >= total_duration_minutes

    # If past the end, clamp to end
    if original_timestamp > original_end:
        original_timestamp = original_end
        is_complete = True

    with get_cursor() as cur:
        # Get sensor readings up to the elapsed point
        cur.execute(
            """SELECT tag_name, timestamp, value
               FROM sensor_readings
               WHERE run_number = %s AND timestamp <= %s
               ORDER BY timestamp, tag_name""",
            (run_number, original_timestamp),
        )
        raw_readings = cur.fetchall()

        # Compute thresholds: mean and stddev per tag across ALL runs on the same furnace
        cur.execute(
            """SELECT sr.tag_name,
                      AVG(sr.value) AS mean_val,
                      COALESCE(STDDEV(sr.value), 0) AS std_val
               FROM sensor_readings sr
               JOIN runs r ON sr.run_number = r.run_number
               WHERE r.furnace = %s
               GROUP BY sr.tag_name""",
            (furnace,),
        )
        threshold_rows = cur.fetchall()

    thresholds = {}
    for t in threshold_rows:
        mean_val = float(t["mean_val"]) if t["mean_val"] is not None else 0
        std_val = float(t["std_val"]) if t["std_val"] is not None else 0
        thresholds[t["tag_name"]] = {
            "mean": round(mean_val, 3),
            "upper": round(mean_val + 2 * std_val, 3),
            "lower": round(mean_val - 2 * std_val, 3),
        }

    readings = []
    alerts = []
    for r in raw_readings:
        minutes_from_start = (r["timestamp"] - original_start).total_seconds() / 60
        reading = {
            "tag_name": r["tag_name"],
            "timestamp": r["timestamp"].isoformat(),
            "value": round(float(r["value"]), 3),
            "minutes_from_start": round(minutes_from_start, 1),
        }
        readings.append(reading)

        # Check for threshold breach
        tag_thresh = thresholds.get(r["tag_name"])
        if tag_thresh:
            val = float(r["value"])
            if val > tag_thresh["upper"]:
                alerts.append({
                    "tag_name": r["tag_name"],
                    "value": round(val, 3),
                    "threshold": tag_thresh["upper"],
                    "direction": "above",
                    "minutes_from_start": round(minutes_from_start, 1),
                    "timestamp": r["timestamp"].isoformat(),
                })
            elif val < tag_thresh["lower"]:
                alerts.append({
                    "tag_name": r["tag_name"],
                    "value": round(val, 3),
                    "threshold": tag_thresh["lower"],
                    "direction": "below",
                    "minutes_from_start": round(minutes_from_start, 1),
                    "timestamp": r["timestamp"].isoformat(),
                })

    return {
        "run_number": run_number,
        "elapsed_minutes": elapsed_minutes,
        "total_duration_minutes": round(total_duration_minutes, 1),
        "is_complete": is_complete,
        "readings": readings,
        "thresholds": thresholds,
        "alerts": alerts,
    }
