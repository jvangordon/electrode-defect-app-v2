def test_bake_anomalies(client):
    resp = client.get("/api/anomalies/bake")
    assert resp.status_code == 200
    data = resp.json()
    assert "anomalies" in data
    assert "population_stats" in data
    assert "spc_data" in data

    # Check population stats keys
    stats = data["population_stats"]
    for key in ("mean_deck", "std_deck", "mean_duration", "std_duration", "mean_kwh"):
        assert key in stats

    # Anomalies have expected structure
    if data["anomalies"]:
        a = data["anomalies"][0]
        assert "run_number" in a
        assert "deviations" in a
        assert "severity" in a
        assert "is_anomaly" in a


def test_bake_anomalies_with_limit(client):
    resp = client.get("/api/anomalies/bake?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["anomalies"]) <= 10


def test_graphite_risk(client):
    resp = client.get("/api/anomalies/graphite")
    assert resp.status_code == 200
    data = resp.json()
    assert "assessments" in data
    assert "quintiles" in data
    assert len(data["quintiles"]) == 5

    if data["assessments"]:
        a = data["assessments"][0]
        assert "run_number" in a
        assert "composition" in a
        comp = a["composition"]
        assert "electrodes" in comp
        assert "high_risk_lot_count" in comp
        assert "edge_position_count" in comp
        assert "total_electrodes" in comp


def test_graphite_risk_with_limit(client):
    resp = client.get("/api/anomalies/graphite?limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["assessments"]) <= 5


def test_graphite_run_detail(client):
    # Get a valid graphite run number
    resp = client.get("/api/runs?department=graphite&limit=1")
    runs = resp.json()["runs"]
    assert len(runs) > 0
    run_number = runs[0]["run_number"]

    resp = client.get(f"/api/anomalies/graphite/{run_number}")
    assert resp.status_code == 200
    data = resp.json()
    assert "run" in data
    assert "electrodes" in data
    assert "risk_factors" in data
    assert "compounding_rates" in data


def test_graphite_run_detail_not_found(client):
    resp = client.get("/api/anomalies/graphite/NONEXISTENT-RUN")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("error") == "Run not found"
