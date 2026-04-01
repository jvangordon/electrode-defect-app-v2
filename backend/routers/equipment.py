from fastapi import APIRouter, Query
from typing import Optional
from backend.db import get_cursor

router = APIRouter(tags=["equipment"])


@router.get("/equipment")
def list_equipment(department: Optional[str] = None):
    """List all equipment with current status and trend indicators."""
    with get_cursor() as cur:
        conditions = []
        params = []
        if department:
            conditions.append("department = %s")
            params.append(department)

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        cur.execute(f"""
            WITH latest AS (
                SELECT DISTINCT ON (furnace)
                    furnace, department, defect_rate, avg_kwh, avg_run_time,
                    avg_downtime, avg_car_deck, run_count, month,
                    trend_slope, trend_pvalue
                FROM equipment_monthly
                {where}
                ORDER BY furnace, month DESC
            )
            SELECT *,
                CASE
                    WHEN trend_slope > 0.002 AND trend_pvalue < 0.05 THEN 'degrading'
                    WHEN trend_slope < -0.002 AND trend_pvalue < 0.05 THEN 'improving'
                    ELSE 'stable'
                END as trend_direction
            FROM latest
            ORDER BY defect_rate DESC
        """, params)
        equipment = [dict(r) for r in cur.fetchall()]

    return {"equipment": equipment}


@router.get("/equipment/{furnace}/trends")
def equipment_trends(furnace: str):
    """Monthly trend data for a specific piece of equipment."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT month, department, defect_rate, avg_kwh, avg_run_time,
                   avg_downtime, avg_car_deck, run_count, trend_slope, trend_pvalue
            FROM equipment_monthly
            WHERE furnace = %s
            ORDER BY month
        """, (furnace,))
        monthly = [dict(r) for r in cur.fetchall()]

        if not monthly:
            return {"error": "Equipment not found"}

        # Compute regression line
        department = monthly[0]["department"]
        defect_rates = [m["defect_rate"] for m in monthly]
        n = len(defect_rates)
        if n >= 3:
            import numpy as np
            x = np.arange(n, dtype=float)
            y = np.array(defect_rates)
            coeffs = np.polyfit(x, y, 1)
            slope = float(coeffs[0])
            intercept = float(coeffs[1])
            trend_line = [{"month": m["month"], "value": round(intercept + slope * i, 4)}
                          for i, m in enumerate(monthly)]

            # Correlation / significance
            corr = float(np.corrcoef(x, y)[0, 1]) if np.std(y) > 0 else 0
            r_squared = corr ** 2
        else:
            slope = 0
            trend_line = []
            r_squared = 0

        # Recent runs for this furnace
        cur.execute("""
            SELECT run_number, defect_rate, defect_count, total_pieces,
                   start_time, duration_hours, actual_kwh, total_downtime,
                   car_deck, profile, risk_score
            FROM runs
            WHERE furnace = %s
            ORDER BY start_time DESC
            LIMIT 20
        """, (furnace,))
        recent_runs = [dict(r) for r in cur.fetchall()]

    return {
        "furnace": furnace,
        "department": department,
        "monthly": monthly,
        "trend_line": trend_line,
        "slope": round(slope, 6),
        "r_squared": round(r_squared, 4),
        "recent_runs": recent_runs,
    }


@router.get("/equipment/comparison")
def equipment_comparison(department: Optional[str] = None):
    """Cross-equipment comparison — all furnaces on one chart."""
    with get_cursor() as cur:
        conditions = []
        params = []
        if department:
            conditions.append("department = %s")
            params.append(department)

        where = "WHERE " + " AND ".join(conditions) if conditions else ""

        # Current defect rate per furnace (latest month)
        cur.execute(f"""
            SELECT DISTINCT ON (furnace)
                furnace, department, defect_rate, avg_kwh, avg_run_time,
                avg_downtime, run_count, trend_slope, trend_pvalue
            FROM equipment_monthly
            {where}
            ORDER BY furnace, month DESC
        """, params)
        current = [dict(r) for r in cur.fetchall()]

        # Monthly data for overlay chart
        cur.execute(f"""
            SELECT furnace, month, defect_rate
            FROM equipment_monthly
            {where}
            ORDER BY furnace, month
        """, params)
        all_monthly = [dict(r) for r in cur.fetchall()]

    return {
        "current": sorted(current, key=lambda x: x["defect_rate"], reverse=True),
        "monthly": all_monthly,
    }
