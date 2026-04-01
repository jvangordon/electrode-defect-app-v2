def test_list_equipment(client):
    resp = client.get("/api/equipment")
    assert resp.status_code == 200
    data = resp.json()
    assert "equipment" in data
    assert len(data["equipment"]) > 0

    item = data["equipment"][0]
    assert "furnace" in item
    assert "department" in item
    assert "defect_rate" in item
    assert "trend_direction" in item
    assert item["trend_direction"] in ("degrading", "improving", "stable")


def test_list_equipment_filter_department(client):
    resp = client.get("/api/equipment?department=bake")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["equipment"]:
        assert item["department"] == "bake"


def test_equipment_trends(client):
    # Get a valid furnace name
    resp = client.get("/api/equipment")
    furnace = resp.json()["equipment"][0]["furnace"]

    resp = client.get(f"/api/equipment/{furnace}/trends")
    assert resp.status_code == 200
    data = resp.json()
    assert data["furnace"] == furnace
    assert "department" in data
    assert "monthly" in data
    assert "trend_line" in data
    assert "slope" in data
    assert "r_squared" in data
    assert len(data["monthly"]) > 0


def test_equipment_trends_not_found(client):
    resp = client.get("/api/equipment/FAKE-FURNACE-999/trends")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("error") == "Equipment not found"


def test_equipment_comparison(client):
    resp = client.get("/api/equipment/comparison")
    assert resp.status_code == 200
    data = resp.json()
    assert "current" in data
    assert "monthly" in data
    assert len(data["current"]) > 0

    item = data["current"][0]
    assert "furnace" in item
    assert "defect_rate" in item


def test_equipment_comparison_filter(client):
    resp = client.get("/api/equipment/comparison?department=graphite")
    assert resp.status_code == 200
    data = resp.json()
    for item in data["current"]:
        assert item["department"] == "graphite"
