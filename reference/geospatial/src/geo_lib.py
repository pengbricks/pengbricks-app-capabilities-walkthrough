"""Helpers for the geospatial guide: a small synthetic water network, answer keys, and inspection-report PDFs.

Everything is generated from fixed formulas, so every run produces the same network. The network is
fictional. It is laid out in a local metric grid (UTM zone 10N, EPSG:32610) and converted to longitude
and latitude, so the files look like the WGS 84 data a GIS team exports.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

# --- coordinates --------------------------------------------------------------------------------
UTM_SRID = 32610  # metric CRS for the network area (UTM zone 10N)
WGS84 = 4326
ORIGIN = (600000.0, 4250000.0)  # south-west corner of the fictional service area, in UTM 10N meters
EXTENT = 4000.0  # the area is 4 km by 4 km
CENTRAL_MERIDIAN = -123.0
H3_RES = 9  # cell edge about 200 m: roughly one city block
H3_HEAT_RES = 8  # cell edge about 530 m: neighborhood level, for heat maps

_A = 6378137.0
_F = 1 / 298.257223563
_K0 = 0.9996


def utm_to_lonlat(x: float, y: float) -> tuple[float, float]:
    """UTM zone 10N meters to (longitude, latitude) on WGS 84, by the Kruger series (sub-millimeter)."""
    n = _F / (2 - _F)
    big_a = _A / (1 + n) * (1 + n**2 / 4 + n**4 / 64)
    beta = (n / 2 - 2 * n**2 / 3 + 37 * n**3 / 96, n**2 / 48 + n**3 / 15, 17 * n**3 / 480)
    delta = (2 * n - 2 * n**2 / 3 - 2 * n**3, 7 * n**2 / 3 - 8 * n**3 / 5, 56 * n**3 / 15)
    xi = y / (_K0 * big_a)
    eta = (x - 500000.0) / (_K0 * big_a)
    xi_p = xi - sum(b * math.sin(2 * j * xi) * math.cosh(2 * j * eta) for j, b in enumerate(beta, 1))
    eta_p = eta - sum(b * math.cos(2 * j * xi) * math.sinh(2 * j * eta) for j, b in enumerate(beta, 1))
    chi = math.asin(math.sin(xi_p) / math.cosh(eta_p))
    lat = chi + sum(d * math.sin(2 * j * chi) for j, d in enumerate(delta, 1))
    lon = math.radians(CENTRAL_MERIDIAN) + math.atan2(math.sinh(eta_p), math.cos(xi_p))
    return round(math.degrees(lon), 8), round(math.degrees(lat), 8)


def _ll(dx: float, dy: float) -> tuple[float, float]:
    return utm_to_lonlat(ORIGIN[0] + dx, ORIGIN[1] + dy)


# --- the network --------------------------------------------------------------------------------
ZONES = [  # id, name, district, target pressure in psi, (x0, y0, x1, y1) in meters from the origin
    ("PZ-1", "Hillside", "north", 72, (0, 2000, 2000, 4000)),
    ("PZ-2", "Riverside", "north", 58, (2000, 2000, 4000, 4000)),
    ("PZ-3", "Old Town", "south", 64, (0, 0, 2000, 2000)),
    ("PZ-4", "Harbor", "south", 55, (2000, 0, 4000, 2000)),
]
NODES = [0, 300, 800, 1300, 1800, 2300, 2800, 3300, 3800, 4000]  # pipe breakpoints along each main
MAIN_LINES = [400, 1100, 1700, 2300, 2900, 3600]  # x or y of each main
MATERIALS = ["cast iron", "ductile iron", "PVC", "steel"]
CLASSES = ["residential", "residential", "residential", "commercial", "industrial"]
BREAKS = [  # id, (x, y) from the origin, time
    ("EV-B1", (1100, 1000), "2026-03-04 06:40:00"),
    ("EV-B2", (2300, 3300), "2026-06-17 14:05:00"),
    ("EV-B3", (3600, 600), "2026-09-02 02:30:00"),
]
IMPACT_RADIUS_M = 260.0
HOTSPOTS = [(1100, 1000, 60), (2300, 3300, 45), (3500, 700, 30)]  # complaint clusters: x, y, count
SENSORS = 12
READINGS_PER_SENSOR = 4


def zone_of(x: float, y: float) -> str | None:
    for zone_id, _, _, _, (x0, y0, x1, y1) in ZONES:
        if x0 <= x < x1 and y0 <= y < y1:
            return zone_id
    return None


def zone_polygon_wkt(box: tuple[float, float, float, float], step: float = 100.0) -> str:
    """A zone boundary with a vertex every 100 m, so the longitude/latitude ring follows the metric edge."""
    x0, y0, x1, y1 = box
    ring: list[tuple[float, float]] = []
    for xs in _frange(x0, x1, step):
        ring.append((xs, y0))
    for ys in _frange(y0, y1, step):
        ring.append((x1, ys))
    for xs in _frange(x1, x0, -step):
        ring.append((xs, y1))
    for ys in _frange(y1, y0, -step):
        ring.append((x0, ys))
    ring.append(ring[0])
    return "POLYGON((" + ", ".join("%.8f %.8f" % _ll(*p) for p in ring) + "))"


def _frange(start: float, stop: float, step: float) -> list[float]:
    count = int(round(abs(stop - start) / abs(step)))
    return [start + i * step for i in range(count)]


def build_network() -> dict[str, list[dict[str, Any]]]:
    """Zones, pipes, meters, events, sensors, and readings, each with its local x/y answer key."""
    zones = [
        {"zone_id": z, "zone_name": name, "district": district, "target_psi": psi, "wkt": zone_polygon_wkt(box)}
        for z, name, district, psi, box in ZONES
    ]

    pipes: list[dict[str, Any]] = []
    number = 0
    for axis in ("h", "v"):
        for line in MAIN_LINES:
            for a, b in zip(NODES, NODES[1:]):
                number += 1
                p0, p1 = ((a, line), (b, line)) if axis == "h" else ((line, a), (line, b))
                mid = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
                pipes.append(
                    {
                        "pipe_id": f"P-{number:04d}",
                        "material": MATERIALS[number % len(MATERIALS)],
                        "diameter_mm": (150, 200, 300)[number % 3],
                        "install_year": 1948 + (number * 7) % 70,
                        "wkt": "LINESTRING(" + ", ".join("%.8f %.8f" % _ll(*p) for p in (p0, p1)) + ")",
                        "xy": (p0, p1),
                        "mid": mid,
                    }
                )

    meters: list[dict[str, Any]] = []
    for i in range(22):
        for j in range(22):
            n = i * 22 + j + 1
            x = -100 + i * 195 + 40 * math.sin(n * 1.7) + 47
            y = -100 + j * 195 + 40 * math.cos(n * 2.3) + 47
            lon, lat = _ll(x, y)
            meters.append(
                {
                    "meter_id": f"M-{n:05d}",
                    "customer_class": CLASSES[n % len(CLASSES)],
                    "install_year": 2001 + n % 24,
                    "lon": lon,
                    "lat": lat,
                    "x": x,
                    "y": y,
                    "expected_zone": zone_of(x, y),
                }
            )

    events: list[dict[str, Any]] = []
    for event_id, (x, y), when in BREAKS:
        lon, lat = _ll(x, y)
        events.append({"event_id": event_id, "event_type": "main_break", "event_time": when, "lon": lon, "lat": lat, "x": x, "y": y})
    k = 0
    for cx, cy, count in HOTSPOTS:
        for i in range(count):
            k += 1
            angle = i * 2.399963  # golden angle: an even spread around the center
            radius = 330 * math.sqrt((i + 0.5) / count)
            x, y = cx + radius * math.cos(angle), cy + radius * math.sin(angle)
            lon, lat = _ll(x, y)
            events.append({"event_id": f"EV-C{k:03d}", "event_type": "low_pressure_complaint", "event_time": f"2026-0{1 + k % 9}-{1 + k % 27:02d} 09:00:00", "lon": lon, "lat": lat, "x": x, "y": y})
    for i in range(30):  # scattered background complaints
        k += 1
        x, y = 200 + (i * 613) % 3600, 200 + (i * 997) % 3600
        lon, lat = _ll(x, y)
        events.append({"event_id": f"EV-C{k:03d}", "event_type": "low_pressure_complaint", "event_time": f"2026-0{1 + k % 9}-{1 + k % 27:02d} 09:00:00", "lon": lon, "lat": lat, "x": x, "y": y})

    sensors: list[dict[str, Any]] = []
    readings: list[dict[str, Any]] = []
    for s in range(SENSORS):
        pipe = pipes[(s * 7 + 3) % len(pipes)]
        (x0, y0), (x1, y1) = pipe["xy"]
        t = 0.3 + 0.4 * ((s * 5) % 7) / 7
        x, y = x0 + t * (x1 - x0), y0 + t * (y1 - y0)
        offset = 8 + 2 * s  # meters off the main, to the north or east
        if y0 == y1:
            y += offset
        else:
            x += offset
        lon, lat = _ll(x, y)
        sensor_id = f"S-{s + 1:03d}"
        sensors.append({"sensor_id": sensor_id, "lon": lon, "lat": lat, "x": x, "y": y, "expected_pipe": pipe["pipe_id"]})
        for r in range(READINGS_PER_SENSOR):
            readings.append({"sensor_id": sensor_id, "reading_time": f"2026-09-0{r + 1} 12:00:00", "pressure_psi": round(52 + (s * 3) % 17 + r * 0.8, 1)})

    return {"zones": zones, "pipes": pipes, "meters": meters, "events": events, "sensors": sensors, "readings": readings}


def distance_to_segment(px: float, py: float, p0: tuple[float, float], p1: tuple[float, float]) -> float:
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    t = max(0.0, min(1.0, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (x0 + t * dx), py - (y0 + t * dy))


def expected_impact(network: dict[str, list[dict[str, Any]]], radius: float = IMPACT_RADIUS_M) -> dict[str, dict[str, set[str]]]:
    """Answer key: meters and pipes within `radius` meters of each main break (planar distance in UTM)."""
    out: dict[str, dict[str, set[str]]] = {}
    for event in (e for e in network["events"] if e["event_type"] == "main_break"):
        out[event["event_id"]] = {
            "meters": {m["meter_id"] for m in network["meters"] if math.hypot(m["x"] - event["x"], m["y"] - event["y"]) <= radius},
            "pipes": {p["pipe_id"] for p in network["pipes"] if distance_to_segment(event["x"], event["y"], *p["xy"]) <= radius},
        }
    return out


def expected_nearest_pipe(network: dict[str, list[dict[str, Any]]]) -> dict[str, str]:
    out = {}
    for s in network["sensors"]:
        out[s["sensor_id"]] = min(network["pipes"], key=lambda p: distance_to_segment(s["x"], s["y"], *p["xy"]))["pipe_id"]
    return out


# --- inspection reports -------------------------------------------------------------------------
REPORTS = [  # file, asset, condition, date, finding
    ("inspection_p0012.pdf", "P-0012", "Poor", "2026-09-11", "Heavy tuberculation and two weeping joints along the span."),
    ("inspection_p0047.pdf", "P-0047", "Fair", "2026-09-14", "Light external corrosion at the coating; no leaks found."),
    ("inspection_p0071.pdf", "P-0071", "Good", "2026-09-18", "No defects. Pipe wall and joints are sound."),
]
CONDITIONS = ["Good", "Fair", "Poor", "Critical"]
EXTRACT_SCHEMA = {
    "asset_id": {"type": "string", "description": "The pipe segment ID, like P-0012"},
    "condition": {"type": "string", "description": "Overall condition grade: Good, Fair, Poor, or Critical"},
    "inspection_date": {"type": "string", "description": "ISO date, YYYY-MM-DD"},
}


def render_report_pdf(report: tuple[str, str, str, str, str], path: str | Path) -> None:
    from fpdf import FPDF

    _, asset, condition, date, finding = report
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Water Main Field Inspection Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.ln(2)
    for label, value in (
        ("Utility", "Example Water District (synthetic)"),
        ("Asset ID", asset),
        ("Inspection date", date),
        ("Inspector", "Crew 4"),
        ("Overall condition", condition),
    ):
        pdf.cell(45, 8, label + ":", border=0)
        pdf.cell(0, 8, value, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 8, "Findings", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 7, finding)
    pdf.output(str(path))


# --- small helpers ------------------------------------------------------------------------------
_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def fq(catalog: str, schema: str, name: str) -> str:
    for part in (catalog, schema, name):
        if not re.match(r"^[A-Za-z0-9_-]+$", part):
            raise ValueError(f"Not a valid name: {part}")
    return f"`{catalog}`.`{schema}`.`{name}`"


def sql_string(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def feature_collection(zones: list[dict[str, Any]], wkt_to_coords) -> str:
    """Zones as a GeoJSON FeatureCollection, the way a GIS export delivers them."""
    features = [
        {
            "type": "Feature",
            "properties": {k: z[k] for k in ("zone_id", "zone_name", "district", "target_psi")},
            "geometry": {"type": "Polygon", "coordinates": [wkt_to_coords(z["wkt"])]},
        }
        for z in zones
    ]
    return json.dumps({"type": "FeatureCollection", "features": features})


def polygon_ring(wkt: str) -> list[list[float]]:
    inner = wkt[wkt.index("((") + 2 : wkt.rindex("))")]
    return [[float(v) for v in pair.split()] for pair in inner.split(",")]


RESULTS_DDL = "step string, metric string, value double, detail string, run_id string, recorded_at timestamp"


def write_results(spark, table: str, step: str, rows: list[tuple[str, float, str]], run_id: str) -> None:
    """Replace this step's rows in the results table, so a rerun does not add a second set."""
    from pyspark.sql import functions as F

    spark.sql(f"CREATE TABLE IF NOT EXISTS {table} ({RESULTS_DDL})")
    spark.sql(f"DELETE FROM {table} WHERE step = {sql_string(step)}")
    frame = spark.createDataFrame(
        [(step, metric, float(value), detail, run_id) for metric, value, detail in rows],
        "step string, metric string, value double, detail string, run_id string",
    ).withColumn("recorded_at", F.current_timestamp())
    frame.write.mode("append").saveAsTable(table)
    for metric, value, detail in rows:
        print(f"{step} {metric}: {value:g} {detail}".rstrip())
