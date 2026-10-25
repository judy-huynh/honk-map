"""Build data/honks.json: 311 Car/Truck Horn complaints since 2024, grouped by location, plus hotspot scores and DEP cameras."""
import json, math, collections, urllib.request, urllib.parse, datetime, os

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "honks.json")
API = "https://data.cityofnewyork.us/resource/erm2-nwe9.json"
START = "2024-01-01T00:00:00"

# DEP 2025 annual report, noise camera locations and loud vehicles logged
CAMS = [["210 E 36th St", "Manhattan", 3329, 701], ["510 W 41st St", "Manhattan", 3074, 211],
        ["150 W 65th St", "Manhattan", 1781, 126], ["110 Tillary St", "Brooklyn", 1673, 17],
        ["1469 St Nicholas Ave", "Manhattan", 1569, 208], ["1209 Viele Ave", "Bronx", 1552, 67],
        ["25-45 Borden Ave", "Queens", 1299, 210], ["2698 Bailey Ave", "Bronx", 1195, 77],
        ["2601 Ocean Pkwy", "Brooklyn", 409, 30], ["98-05 63rd Dr", "Queens", 48, 4],
        ["6700 3rd Ave", "Brooklyn", 32, 32], ["99-18 64th Ave", "Queens", 21, 1],
        ["36-11 20th Ave", "Queens", 12, 7]]

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "honk-map"})
    return json.load(urllib.request.urlopen(req, timeout=120))

def fetch():
    rows, off = [], 0
    while True:
        q = urllib.parse.urlencode({"$select": "latitude,longitude,incident_address,created_date",
            "$where": f"descriptor='Car/Truck Horn' AND created_date>='{START}' AND latitude IS NOT NULL",
            "$order": "created_date", "$limit": 50000, "$offset": off})
        page = get(f"{API}?{q}"); rows += page; off += len(page)
        if len(page) < 50000: return rows

def geocode(addr, boro):
    q = urllib.parse.urlencode({"text": f"{addr}, {boro}", "size": 1})
    c = get(f"https://geosearch.planninglabs.nyc/v2/search?{q}")["features"][0]["geometry"]["coordinates"]
    return [round(c[0], 6), round(c[1], 6)]

rows = fetch()
asof = max(r["created_date"] for r in rows)[:10]
years = sorted({r["created_date"][:4] for r in rows})
pts = collections.OrderedDict(); days = collections.defaultdict(set)
for r in rows:
    k = (round(float(r["longitude"]), 5), round(float(r["latitude"]), 5))
    p = pts.setdefault(k, {"a": (r.get("incident_address") or "").title(), "y": collections.Counter()})
    p["y"][r["created_date"][:4]] += 1

# Hotspots: complaints within 100 m of each location, overlapping circles merged (keep the busiest)
mlat = 111320; mlon = mlat * math.cos(math.radians(40.7))
xy = {k: (k[1] * mlat, k[0] * mlon) for k in pts}
n = {k: sum(pts[k]["y"].values()) for k in pts}
grid = collections.defaultdict(list)
for k, (y, x) in xy.items(): grid[(int(y // 100), int(x // 100))].append(k)
def within(y, x, R):
    for i in range(-(R // 100) - 1, R // 100 + 2):
        for j in range(-(R // 100) - 1, R // 100 + 2):
            for q in grid[(int(y // 100) + i, int(x // 100) + j)]:
                qy, qx = xy[q]
                if (qy - y) ** 2 + (qx - x) ** 2 <= R * R: yield q
score = {k: sum(n[q] for q in within(*xy[k], 100)) for k in pts}
taken = collections.defaultdict(list); hot = []
for k in sorted(score, key=lambda k: -score[k]):
    y, x = xy[k]; cell = (int(y // 200), int(x // 200))
    if any((ty - y) ** 2 + (tx - x) ** 2 <= 200 ** 2 for i in (-1, 0, 1) for j in (-1, 0, 1) for ty, tx in taken[(cell[0] + i, cell[1] + j)]):
        continue
    taken[cell].append((y, x)); hot.append(score[k])

out = {"asof": asof, "years": years, "count": len(rows),
       "pts": [[k[0], k[1], p["a"]] + [p["y"][y] for y in years] for k, p in pts.items()],
       "hot": hot,
       "cams": [[a, b, ev, sm] + geocode(a, b) for a, b, ev, sm in CAMS]}
json.dump(out, open(OUT, "w"), separators=(",", ":"))
print(f"{len(rows)} complaints, {len(pts)} locations, {len(hot)} hotspots, as of {asof}")
