def test_dashboard_overview(client):
    resp = client.get("/api/dashboard/overview")
    assert resp.status_code == 200
    data = resp.json()
    for key in ("recent_stats", "monthly_trend", "furnace_status", "investigation_counts",
                "recent_anomalies", "attention_equipment", "overdue_actions"):
        assert key in data, f"Missing key: {key}"

    stats = data["recent_stats"]
    assert "total_runs" in stats
    assert "avg_defect_rate" in stats
    assert "total_defects" in stats
    assert "total_pieces" in stats
    assert stats["total_runs"] > 0

    assert isinstance(data["monthly_trend"], list)
    assert isinstance(data["furnace_status"], list)
    assert isinstance(data["investigation_counts"], dict)
    assert isinstance(data["recent_anomalies"], list)
    assert isinstance(data["attention_equipment"], list)
    assert isinstance(data["overdue_actions"], list)
