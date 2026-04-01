from fastapi import APIRouter, Query
from typing import Optional
from backend.db import get_cursor

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/overview")
def dashboard_overview(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    with get_cursor() as cur:
        # Build date filter for runs table
        date_filter = ""
        date_params: list = []
        if start_date and end_date:
            date_filter = "AND start_time >= %s AND start_time < %s"
            date_params = [start_date, end_date]
        elif start_date:
            date_filter = "AND start_time >= %s"
            date_params = [start_date]
        elif end_date:
            date_filter = "AND start_time < %s"
            date_params = [end_date]

        # Overall KPIs
        cur.execute(f"""
            SELECT
                COUNT(*) as total_runs,
                AVG(defect_rate) as avg_defect_rate,
                SUM(defect_count) as total_defects,
                SUM(total_pieces) as total_pieces,
                SUM(total_weight) as total_weight
            FROM runs
            WHERE start_time > NOW() - INTERVAL '90 days'
            {date_filter}
        """, date_params)
        recent_stats = dict(cur.fetchone())

        # Defect rate by month (last 6 months)
        cur.execute(f"""
            SELECT
                DATE_TRUNC('month', start_time)::date as month,
                AVG(defect_rate) as defect_rate,
                COUNT(*) as run_count,
                SUM(defect_count) as defect_count
            FROM runs
            WHERE start_time > NOW() - INTERVAL '6 months'
            {date_filter}
            GROUP BY DATE_TRUNC('month', start_time)
            ORDER BY month
        """, date_params)
        monthly_trend = [dict(r) for r in cur.fetchall()]

        # Furnace status grid
        cur.execute(f"""
            WITH recent AS (
                SELECT furnace, department, defect_rate, defect_count, total_pieces,
                       ROW_NUMBER() OVER (PARTITION BY furnace ORDER BY start_time DESC) as rn
                FROM runs
                WHERE start_time > NOW() - INTERVAL '60 days'
                {date_filter}
            ),
            furnace_stats AS (
                SELECT furnace, department,
                       AVG(defect_rate) as avg_defect_rate,
                       SUM(defect_count) as recent_defects,
                       SUM(total_pieces) as recent_pieces,
                       COUNT(*) as recent_runs
                FROM recent WHERE rn <= 5
                GROUP BY furnace, department
            )
            SELECT fs.*,
                   em.trend_slope, em.trend_pvalue
            FROM furnace_stats fs
            LEFT JOIN LATERAL (
                SELECT trend_slope, trend_pvalue
                FROM equipment_monthly em
                WHERE em.furnace = fs.furnace
                ORDER BY em.month DESC LIMIT 1
            ) em ON true
            ORDER BY department, furnace
        """, date_params)
        furnace_status = [dict(r) for r in cur.fetchall()]

        # Open investigations count
        cur.execute("""
            SELECT status, COUNT(*) as count
            FROM investigations
            GROUP BY status
        """)
        investigation_counts = {r["status"]: r["count"] for r in cur.fetchall()}

        # Recent anomalies (high-defect runs)
        cur.execute(f"""
            SELECT run_number, department, furnace, defect_rate, defect_count,
                   total_pieces, start_time, risk_score
            FROM runs
            WHERE defect_rate > 0.08
            {date_filter}
            ORDER BY start_time DESC
            LIMIT 10
        """, date_params)
        recent_anomalies = [dict(r) for r in cur.fetchall()]

        # Equipment needing attention (degrading trend)
        cur.execute("""
            SELECT DISTINCT ON (furnace)
                furnace, department, defect_rate, trend_slope, trend_pvalue, month
            FROM equipment_monthly
            WHERE trend_slope > 0.001 AND trend_pvalue < 0.1
            ORDER BY furnace, month DESC
        """)
        attention_equipment = [dict(r) for r in cur.fetchall()]

        # Overdue corrective actions
        cur.execute("""
            SELECT ca.action_id, ca.title, ca.assigned_to, ca.due_date, ca.priority,
                   ca.status, i.investigation_id, i.defect_code, i.defect_site
            FROM corrective_actions ca
            JOIN investigations i ON ca.investigation_id = i.investigation_id
            WHERE ca.status IN ('open', 'in_progress')
              AND ca.due_date < CURRENT_DATE
            ORDER BY ca.due_date ASC
            LIMIT 10
        """)
        overdue_actions = [dict(r) for r in cur.fetchall()]

    return {
        "recent_stats": recent_stats,
        "monthly_trend": monthly_trend,
        "furnace_status": furnace_status,
        "investigation_counts": investigation_counts,
        "recent_anomalies": recent_anomalies,
        "attention_equipment": attention_equipment,
        "overdue_actions": overdue_actions,
    }
