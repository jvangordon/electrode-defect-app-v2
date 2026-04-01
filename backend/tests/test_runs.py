def test_list_runs(client):
    resp = client.get("/api/runs")
    assert resp.status_code == 200
    data = resp.json()
    assert "runs" in data
    assert "total" in data
    assert data["total"] > 0
    assert len(data["runs"]) > 0

    run = data["runs"][0]
    assert "run_number" in run
    assert "department" in run
    assert "furnace" in run
    assert "defect_rate" in run


def test_list_runs_filter_department(client):
    resp = client.get("/api/runs?department=bake")
    assert resp.status_code == 200
    data = resp.json()
    for run in data["runs"]:
        assert run["department"] == "bake"


def test_list_runs_filter_graphite(client):
    resp = client.get("/api/runs?department=graphite")
    assert resp.status_code == 200
    data = resp.json()
    for run in data["runs"]:
        assert run["department"] == "graphite"


def test_run_detail(client):
    # Get a valid run number first
    runs_resp = client.get("/api/runs?limit=1")
    run_number = runs_resp.json()["runs"][0]["run_number"]

    resp = client.get(f"/api/runs/{run_number}")
    assert resp.status_code == 200
    data = resp.json()
    assert "run" in data
    assert data["run"]["run_number"] == run_number
    assert "electrodes" in data
    assert "sensors" in data


def test_run_detail_not_found(client):
    resp = client.get("/api/runs/NONEXISTENT-RUN-999")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("error") == "Run not found"


def test_compare_runs(client):
    runs_resp = client.get("/api/runs?limit=2")
    runs = runs_resp.json()["runs"]
    assert len(runs) >= 2

    run_a = runs[0]["run_number"]
    run_b = runs[1]["run_number"]

    resp = client.get(f"/api/runs/compare?run_a={run_a}&run_b={run_b}")
    assert resp.status_code == 200
    data = resp.json()
    assert "run_a" in data
    assert "run_b" in data
    assert "electrodes_a" in data
    assert "electrodes_b" in data
    assert "param_diff" in data
    assert "sensors_a" in data
    assert "sensors_b" in data
    assert data["run_a"]["run_number"] == run_a
    assert data["run_b"]["run_number"] == run_b


def test_compare_runs_not_found(client):
    resp = client.get("/api/runs/compare?run_a=FAKE-A&run_b=FAKE-B")
    assert resp.status_code == 200
    data = resp.json()
    assert "error" in data


def test_compare_runs_missing_params(client):
    resp = client.get("/api/runs/compare")
    assert resp.status_code == 422  # FastAPI validation error
