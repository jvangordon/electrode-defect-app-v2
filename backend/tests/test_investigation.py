import pytest


def test_list_investigations(client):
    resp = client.get("/api/investigations")
    assert resp.status_code == 200
    data = resp.json()
    assert "investigations" in data
    assert "total" in data
    assert data["total"] > 0

    inv = data["investigations"][0]
    assert "investigation_id" in inv
    assert "gpn" in inv
    assert "status" in inv
    assert "note_count" in inv
    assert "action_count" in inv


def test_list_investigations_filter_status(client):
    resp = client.get("/api/investigations?status=open")
    assert resp.status_code == 200
    data = resp.json()
    for inv in data["investigations"]:
        assert inv["status"] == "open"


def test_get_investigation(client):
    # Get a valid ID first
    list_resp = client.get("/api/investigations?limit=1")
    inv_id = list_resp.json()["investigations"][0]["investigation_id"]

    resp = client.get(f"/api/investigations/{inv_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert "investigation" in data
    assert "notes" in data
    assert "actions" in data
    assert data["investigation"]["investigation_id"] == inv_id


def test_get_investigation_not_found(client):
    resp = client.get("/api/investigations/99999")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("error") == "Investigation not found"


def test_create_investigation(client):
    # Get a valid GPN from electrodes
    search = client.get("/api/electrodes/search?q=GPN&limit=1")
    results = search.json().get("results", [])
    assert len(results) > 0
    gpn = results[0]["gpn"]

    resp = client.post("/api/investigations", json={
        "gpn": gpn,
        "defect_code": "TEST-1",
        "defect_site": "bake",
        "assigned_to": "Test User",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "investigation_id" in data
    new_id = data["investigation_id"]

    # Verify it was created
    detail = client.get(f"/api/investigations/{new_id}")
    assert detail.json()["investigation"]["gpn"] == gpn


def test_update_investigation(client):
    # Create then update
    search = client.get("/api/electrodes/search?q=GPN&limit=1")
    gpn = search.json()["results"][0]["gpn"]

    create_resp = client.post("/api/investigations", json={"gpn": gpn, "defect_code": "UPD-1"})
    inv_id = create_resp.json()["investigation_id"]

    resp = client.patch(f"/api/investigations/{inv_id}", json={"status": "in_progress"})
    assert resp.status_code == 200
    assert resp.json().get("ok") is True

    # Verify updated
    detail = client.get(f"/api/investigations/{inv_id}")
    assert detail.json()["investigation"]["status"] == "in_progress"


def test_update_investigation_no_fields(client):
    list_resp = client.get("/api/investigations?limit=1")
    inv_id = list_resp.json()["investigations"][0]["investigation_id"]

    resp = client.patch(f"/api/investigations/{inv_id}", json={})
    assert resp.status_code == 200
    assert resp.json().get("error") == "No fields to update"


def test_add_note(client):
    list_resp = client.get("/api/investigations?limit=1")
    inv_id = list_resp.json()["investigations"][0]["investigation_id"]

    resp = client.post(f"/api/investigations/{inv_id}/notes", json={
        "author": "Test Bot",
        "note_text": "Automated test note",
    })
    assert resp.status_code == 200
    assert "note_id" in resp.json()


def test_add_action(client):
    list_resp = client.get("/api/investigations?limit=1")
    inv_id = list_resp.json()["investigations"][0]["investigation_id"]

    resp = client.post(f"/api/investigations/{inv_id}/actions", json={
        "title": "Test Action",
        "description": "Created by test",
        "priority": "low",
    })
    assert resp.status_code == 200
    assert "action_id" in resp.json()


def test_update_action(client):
    list_resp = client.get("/api/investigations?limit=1")
    inv_id = list_resp.json()["investigations"][0]["investigation_id"]

    # Create an action
    action_resp = client.post(f"/api/investigations/{inv_id}/actions", json={
        "title": "Action for Update Test",
    })
    action_id = action_resp.json()["action_id"]

    resp = client.patch(f"/api/actions/{action_id}", json={"status": "in_progress"})
    assert resp.status_code == 200
    assert resp.json().get("ok") is True


def test_search_electrodes(client):
    resp = client.get("/api/electrodes/search?q=GPN")
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert len(data["results"]) > 0

    e = data["results"][0]
    assert "gpn" in e
    assert "lot" in e


def test_search_electrodes_short_query(client):
    resp = client.get("/api/electrodes/search?q=X")
    assert resp.status_code == 422  # min_length=2 validation


def test_electrode_detail(client):
    # Get a valid GPN
    search = client.get("/api/electrodes/search?q=GPN&limit=1")
    gpn = search.json()["results"][0]["gpn"]

    resp = client.get(f"/api/electrodes/{gpn}")
    assert resp.status_code == 200
    data = resp.json()
    assert "electrode" in data
    assert "lifecycle" in data
    assert "siblings" in data
    assert "risk_factors" in data
    assert "investigations" in data
    assert data["electrode"]["gpn"] == gpn
    assert len(data["lifecycle"]) == 10


def test_electrode_detail_not_found(client):
    resp = client.get("/api/electrodes/FAKE-GPN-999999")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("error") == "Electrode not found"


def test_ai_analysis(client):
    list_resp = client.get("/api/investigations?limit=1")
    inv_id = list_resp.json()["investigations"][0]["investigation_id"]

    resp = client.get(f"/api/investigations/{inv_id}/ai-analysis")
    assert resp.status_code == 200
    data = resp.json()
    assert "analysis" in data
    assert "confidence" in data
    assert "factors" in data
    assert "recommendation" in data
    assert isinstance(data["confidence"], (int, float))
    assert isinstance(data["factors"], list)


def test_ai_analysis_not_found(client):
    resp = client.get("/api/investigations/99999/ai-analysis")
    assert resp.status_code == 200
    assert resp.json().get("error") == "Investigation not found"


def test_similar_investigations(client):
    list_resp = client.get("/api/investigations?limit=1")
    inv_id = list_resp.json()["investigations"][0]["investigation_id"]

    resp = client.get(f"/api/investigations/{inv_id}/similar")
    assert resp.status_code == 200
    data = resp.json()
    assert "similar_cases" in data
    assert isinstance(data["similar_cases"], list)

    if data["similar_cases"]:
        case = data["similar_cases"][0]
        assert "investigation" in case
        assert "match_score" in case
        assert "match_explanation" in case
        assert case["match_score"] >= 2


def test_similar_investigations_not_found(client):
    resp = client.get("/api/investigations/99999/similar")
    assert resp.status_code == 200
    assert resp.json().get("error") == "Investigation not found"
