import math
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import geo_lib as g  # noqa: E402


@pytest.fixture(scope="module")
def network():
    return g.build_network()


def test_utm_conversion_matches_a_known_point():
    # The warehouse's own ST_Transform of POINT(-122.3 37.8) from 4326 to 32610.
    lon, lat = g.utm_to_lonlat(561625.0490309233, 4183855.715339759)
    assert lon == pytest.approx(-122.3, abs=1e-6)
    assert lat == pytest.approx(37.8, abs=1e-6)


def test_network_is_deterministic(network):
    assert g.build_network()["meters"][5] == network["meters"][5]


def test_counts(network):
    assert len(network["zones"]) == 4
    assert len(network["pipes"]) == 2 * len(g.MAIN_LINES) * (len(g.NODES) - 1)
    assert len(network["meters"]) == 484
    assert sum(1 for e in network["events"] if e["event_type"] == "main_break") == 3


def test_some_meters_fall_outside_every_zone(network):
    assert any(m["expected_zone"] is None for m in network["meters"])
    assert {m["expected_zone"] for m in network["meters"]} - {None} == {z[0] for z in g.ZONES}


def test_no_meter_sits_on_a_zone_edge_or_the_impact_radius(network):
    breaks = [e for e in network["events"] if e["event_type"] == "main_break"]
    for m in network["meters"]:
        assert min(abs(m["x"] - 2000), abs(m["y"] - 2000), abs(m["x"]), abs(m["y"]), abs(m["x"] - 4000), abs(m["y"] - 4000)) > 2.0
        for e in breaks:
            assert abs(math.hypot(m["x"] - e["x"], m["y"] - e["y"]) - g.IMPACT_RADIUS_M) > 1.0


def test_every_break_has_impacted_assets(network):
    impact = g.expected_impact(network)
    assert set(impact) == {"EV-B1", "EV-B2", "EV-B3"}
    assert all(v["meters"] and v["pipes"] for v in impact.values())


def test_sensor_nearest_pipe_is_close(network):
    nearest = g.expected_nearest_pipe(network)
    for s in network["sensors"]:
        pipe = next(p for p in network["pipes"] if p["pipe_id"] == nearest[s["sensor_id"]])
        assert g.distance_to_segment(s["x"], s["y"], *pipe["xy"]) < 40


def test_sensor_nearest_pipe_has_no_near_tie(network):
    for s in network["sensors"]:
        d = sorted(g.distance_to_segment(s["x"], s["y"], *p["xy"]) for p in network["pipes"])
        assert d[1] - d[0] > 1.0


def test_zone_polygons_are_closed_rings(network):
    for z in network["zones"]:
        ring = g.polygon_ring(z["wkt"])
        assert ring[0] == ring[-1] and len(ring) == 81


def test_report_pdf_renders(tmp_path):
    pytest.importorskip("fpdf")
    out = tmp_path / "r.pdf"
    g.render_report_pdf(g.REPORTS[0], out)
    assert out.read_bytes().startswith(b"%PDF")


def test_reports_name_real_pipes(network):
    ids = {p["pipe_id"] for p in network["pipes"]}
    assert all(r[1] in ids for r in g.REPORTS)


def test_fq_rejects_injection():
    with pytest.raises(ValueError):
        g.fq("a", "b;drop", "c")
