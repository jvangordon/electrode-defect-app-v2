from fastapi import APIRouter, Query
from typing import Optional
from backend.db import get_cursor

router = APIRouter(tags=["anomaly"])


@router.get("/anomalies/bake")
def bake_anomalies(limit: int = Query(50, le=200)):
    """SPC-style anomaly detection for bake runs.
    Flags runs where car_deck or duration deviates significantly from population mean.
    """
    with get_cursor() as cur:
        # Compute population stats for bake
        cur.execute("""
            SELECT
                AVG(car_deck) as mean_deck, STDDEV(car_deck) as std_deck,
                AVG(duration_hours) as mean_duration, STDDEV(duration_hours) as std_duration,
                AVG(actual_kwh) as mean_kwh, STDDEV(actual_kwh) as std_kwh,
                AVG(total_downtime) as mean_downtime, STDDEV(total_downtime) as std_downtime,
                AVG(defect_rate) as mean_defect_rate
            FROM runs WHERE department = 'bake'
        """)
        stats = dict(cur.fetchone())

        # Fetch recent bake runs with anomaly scoring
        cur.execute("""
            SELECT run_number, furnace, car_deck, profile,
                   total_pieces, total_weight, duration_hours,
                   actual_kwh, total_downtime,
                   defect_count, defect_rate, start_time
            FROM runs
            WHERE department = 'bake'
            ORDER BY start_time DESC
            LIMIT %s
        """, (limit,))
        runs = [dict(r) for r in cur.fetchall()]

        # Score each run
        anomalies = []
        for run in runs:
            deviations = []
            # Car deck z-score
            if stats["std_deck"] and stats["std_deck"] > 0:
                z_deck = (run["car_deck"] - stats["mean_deck"]) / stats["std_deck"]
                if abs(z_deck) > 1.5:
                    deviations.append({
                        "parameter": "car_deck",
                        "value": run["car_deck"],
                        "mean": round(stats["mean_deck"], 2),
                        "z_score": round(z_deck, 2),
                        "direction": "high" if z_deck > 0 else "low",
                    })

            # Duration z-score
            if stats["std_duration"] and stats["std_duration"] > 0:
                z_dur = (run["duration_hours"] - stats["mean_duration"]) / stats["std_duration"]
                if abs(z_dur) > 1.5:
                    deviations.append({
                        "parameter": "duration_hours",
                        "value": round(run["duration_hours"], 1),
                        "mean": round(stats["mean_duration"], 1),
                        "z_score": round(z_dur, 2),
                        "direction": "high" if z_dur > 0 else "low",
                    })

            # kWh z-score
            if stats["std_kwh"] and stats["std_kwh"] > 0:
                z_kwh = (run["actual_kwh"] - stats["mean_kwh"]) / stats["std_kwh"]
                if abs(z_kwh) > 1.5:
                    deviations.append({
                        "parameter": "actual_kwh",
                        "value": round(run["actual_kwh"], 0),
                        "mean": round(stats["mean_kwh"], 0),
                        "z_score": round(z_kwh, 2),
                        "direction": "high" if z_kwh > 0 else "low",
                    })

            # Downtime z-score
            if stats["std_downtime"] and stats["std_downtime"] > 0:
                z_dt = (run["total_downtime"] - stats["mean_downtime"]) / stats["std_downtime"]
                if abs(z_dt) > 1.5:
                    deviations.append({
                        "parameter": "total_downtime",
                        "value": round(run["total_downtime"], 1),
                        "mean": round(stats["mean_downtime"], 1),
                        "z_score": round(z_dt, 2),
                        "direction": "high" if z_dt > 0 else "low",
                    })

            # Severity based on number of deviations and defect rate
            max_z = max([abs(d["z_score"]) for d in deviations], default=0)
            if max_z > 3 or (len(deviations) >= 2 and run["defect_rate"] > 0.08):
                severity = "critical"
            elif max_z > 2.5 or run["defect_rate"] > 0.1:
                severity = "high"
            elif max_z > 2 or run["defect_rate"] > 0.06:
                severity = "medium"
            elif deviations:
                severity = "low"
            else:
                severity = None

            anomalies.append({
                **run,
                "deviations": deviations,
                "severity": severity,
                "is_anomaly": len(deviations) > 0,
            })

        # SPC chart data (car_deck and defect_rate over time)
        cur.execute("""
            SELECT run_number, furnace, car_deck, defect_rate, start_time
            FROM runs
            WHERE department = 'bake'
            ORDER BY start_time
        """)
        spc_data = [dict(r) for r in cur.fetchall()]

    return {
        "anomalies": anomalies,
        "population_stats": {
            "mean_deck": round(stats["mean_deck"], 2) if stats["mean_deck"] else None,
            "std_deck": round(stats["std_deck"], 2) if stats["std_deck"] else None,
            "mean_duration": round(stats["mean_duration"], 1) if stats["mean_duration"] else None,
            "std_duration": round(stats["std_duration"], 1) if stats["std_duration"] else None,
            "mean_kwh": round(stats["mean_kwh"], 0) if stats["mean_kwh"] else None,
            "mean_downtime": round(stats["mean_downtime"], 1) if stats["mean_downtime"] else None,
            "mean_defect_rate": round(stats["mean_defect_rate"], 4) if stats["mean_defect_rate"] else None,
        },
        "spc_data": spc_data,
    }


@router.get("/anomalies/graphite")
def graphite_risk_assessments(limit: int = Query(50, le=200)):
    """Composition-based risk assessment for graphite runs."""
    with get_cursor() as cur:
        # Fetch recent graphite runs with risk scores
        cur.execute("""
            SELECT run_number, furnace, profile, load_config,
                   total_pieces, total_weight, duration_hours,
                   actual_kwh, total_downtime,
                   defect_count, defect_rate, risk_score, start_time
            FROM runs
            WHERE department = 'graphite'
            ORDER BY start_time DESC
            LIMIT %s
        """, (limit,))
        runs = [dict(r) for r in cur.fetchall()]

        # For each run, get composition details
        for run in runs:
            cur.execute("""
                SELECT e.gpn, e.lot, e.position_og, e.diameter, e.coke_blend,
                       e.defect_code_og, e.defect_code_of,
                       l.lot_defect_rate, l.risk_tier
                FROM electrodes e
                LEFT JOIN lots l ON e.lot = l.lot_id
                WHERE e.run_number_og = %s
                ORDER BY e.position_og
            """, (run["run_number"],))
            electrodes = [dict(e) for e in cur.fetchall()]

            high_risk_lots = sum(1 for e in electrodes if e.get("risk_tier") == "high")
            edge_positions = sum(1 for e in electrodes if e.get("position_og") in (1, 2, 13, 14))
            avg_lot_risk = sum(e.get("lot_defect_rate", 0) or 0 for e in electrodes) / max(len(electrodes), 1)

            run["composition"] = {
                "electrodes": electrodes,
                "high_risk_lot_count": high_risk_lots,
                "edge_position_count": edge_positions,
                "avg_lot_defect_rate": round(avg_lot_risk, 4),
                "total_electrodes": len(electrodes),
            }

        # Risk quintile reference
        cur.execute("SELECT * FROM composition_risk ORDER BY quintile")
        quintiles = [dict(r) for r in cur.fetchall()]

    return {
        "assessments": runs,
        "quintiles": quintiles,
    }


@router.get("/anomalies/graphite/{run_number}")
def graphite_run_risk_detail(run_number: str):
    """Detailed composition breakdown for a single graphite run."""
    with get_cursor() as cur:
        cur.execute("SELECT * FROM runs WHERE run_number = %s", (run_number,))
        run = cur.fetchone()
        if not run:
            return {"error": "Run not found"}

        cur.execute("""
            SELECT e.*, l.lot_defect_rate, l.risk_tier
            FROM electrodes e
            LEFT JOIN lots l ON e.lot = l.lot_id
            WHERE e.run_number_og = %s
            ORDER BY e.position_og
        """, (run_number,))
        electrodes = [dict(e) for e in cur.fetchall()]

        # Risk factor breakdown for this run's electrodes
        cur.execute("SELECT * FROM risk_factors ORDER BY factor_name, risk_group")
        risk_factors = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT * FROM compounding_rates ORDER BY n_factors")
        compounding = [dict(r) for r in cur.fetchall()]

    return {
        "run": dict(run),
        "electrodes": electrodes,
        "risk_factors": risk_factors,
        "compounding_rates": compounding,
    }
