// Honk Map: 311 car horn complaints, counted within 100 m of any point you tap.
mapboxgl.accessToken = "pk.eyJ1IjoiajAwYnkiLCJhIjoiY2x1bHUzbXZnMGhuczJxcG83YXY4czJ3ayJ9.S5PZpU9VDwLMjoX_0x5FDQ";

const C = { paper: "#F5F2E8", paper2: "#E9E5D8", ink: "#201E1A", soft: "#6B665C", pink: "#FF3E96", blue: "#2B5FC9", street: "#d6d1c2" };
const HOME = { lng: -73.998313, lat: 40.76083, name: "11th Ave and W 42nd St" };
const R = 100; // meters
const $ = id => document.getElementById(id);
const EMBED = new URLSearchParams(location.search).has("embed"); // compact version for the blog post
document.body.classList.toggle("embed", EMBED);

// Start where the hash says, else 11th and 42nd
const fromHash = () => {
  const m = location.hash.match(/^#(-?\d+\.\d+),(-?\d+\.\d+)$/);
  return m ? { lat: +m[1], lng: +m[2], name: null } : null;
};
const start = fromHash() || HOME;

const map = new mapboxgl.Map({
  container: "map", style: "mapbox://styles/mapbox/light-v11",
  center: [start.lng, start.lat], zoom: EMBED ? 15.7 : 16, bearing: 29, // avenues run up the page
  minZoom: 9.5, maxBounds: [[-74.6, 40.35], [-73.4, 41.1]], attributionControl: true,
  cooperativeGestures: EMBED, // two fingers to pan, so the page still scrolls
});
map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");

// Keep the selected spot clear of the panel (left on desktop, bottom on phones)
function pad() {
  const r = document.querySelector(".panel").getBoundingClientRect();
  map.setPadding(innerWidth <= 640 || EMBED ? { top: 0, right: 0, left: 0, bottom: r.height } : { top: 0, right: 0, bottom: 0, left: r.right });
}
// In the blog embed, sit the corner up and to the right so the Lincoln Tunnel ramps show below it
function homeView() {
  const box = map.getContainer().getBoundingClientRect(), p = map.getPadding();
  const W = box.width - p.left - p.right, H = box.height - p.top - p.bottom;
  return { center: [HOME.lng, HOME.lat], zoom: EMBED ? 15.7 : 16, bearing: 29, offset: EMBED ? [0.14 * W, -0.24 * H] : [0, 0] };
}
pad(); map.jumpTo(start === HOME ? homeView() : { center: [start.lng, start.lat] });
addEventListener("resize", pad);

// Repaint the light basemap in the site palette
function brand() {
  for (const l of map.getStyle().layers) {
    const id = l.id;
    try {
      if (l.type === "background") map.setPaintProperty(id, "background-color", C.paper);
      else if (id.startsWith("water") && l.type === "fill") map.setPaintProperty(id, "fill-color", "#DCE2EC");
      else if (/^(landuse|national-park|land-structure|landcover)/.test(id) && l.type === "fill") map.setPaintProperty(id, "fill-color", C.paper2);
      else if (id.startsWith("building") && l.type === "fill") { map.setPaintProperty(id, "fill-color", C.paper2); map.setPaintProperty(id, "fill-outline-color", C.street); }
      else if (/^(road|bridge|tunnel)/.test(id) && l.type === "line" && !/case/.test(id)) map.setPaintProperty(id, "line-color", /motorway|trunk|primary|secondary/.test(id) ? C.street : "#E3DECF");
      else if (/^(road|bridge|tunnel)/.test(id) && l.type === "line") map.setPaintProperty(id, "line-color", C.paper2);
      else if (l.type === "symbol" && l.layout && l.layout["text-field"]) {
        map.setPaintProperty(id, "text-color", C.soft);
        map.setPaintProperty(id, "text-halo-color", C.paper);
      }
    } catch (e) { /* layer without that paint property */ }
  }
}

// 100 m circle as a polygon
function ring(lng, lat, r = R, n = 72) {
  const dy = r / 111320, dx = r / (111320 * Math.cos(lat * Math.PI / 180));
  const c = [];
  for (let i = 0; i <= n; i++) { const a = 2 * Math.PI * i / n; c.push([lng + dx * Math.cos(a), lat + dy * Math.sin(a)]); }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [c] } };
}

const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
const fmt = n => n.toLocaleString("en-US");

let D;
function count(lng, lat) {
  const ky = 111320, kx = 111320 * Math.cos(40.7 * Math.PI / 180);
  const yrs = D.years.map(() => 0); let n = 0;
  for (const p of D.pts) {
    const dy = (p[1] - lat) * ky, dx = (p[0] - lng) * kx;
    if (dx * dx + dy * dy <= R * R) p.slice(3).forEach((v, i) => { yrs[i] += v; n += v; });
  }
  return { n, yrs };
}

function select(lng, lat, name) {
  map.getSource("ring").setData(ring(lng, lat));
  const { n, yrs } = count(lng, lat);
  $("place").textContent = name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  $("count").textContent = fmt(n);
  if (n) {
    const rank = D.hot.filter(h => h > n).length + 1;
    $("rank").textContent = `Ranks ${ord(rank)} of ${fmt(D.hot.length)} spots in NYC`;
    $("years").textContent = D.years.map((y, i) => `${y}: ${fmt(yrs[i])}`).join(" · ");
  } else {
    $("rank").textContent = "No horn complaints here since 2024.";
    $("years").textContent = "";
  }
  const h = `#${lat.toFixed(5)},${lng.toFixed(5)}`;
  $("full").href = "./" + (name === HOME.name ? "" : h);
  if (name === HOME.name) history.replaceState(null, "", location.pathname);
  else if (location.hash !== h) history.replaceState(null, "", h);
}

// Tooltip
const tip = $("tip");
function showTip(e, html) {
  tip.innerHTML = html; tip.hidden = false;
  const x = e.originalEvent.clientX, y = e.originalEvent.clientY;
  tip.style.left = Math.min(x + 14, innerWidth - tip.offsetWidth - 8) + "px";
  tip.style.top = Math.max(8, y - tip.offsetHeight - 12) + "px";
}
const hideTip = () => { tip.hidden = true; };

// Camera marker: square, paper fill, ink border
function camIcon() {
  const s = 22, cv = document.createElement("canvas"); cv.width = cv.height = s * 2;
  const g = cv.getContext("2d"); g.scale(2, 2);
  g.fillStyle = C.ink; g.fillRect(0, 0, s, s); g.fillStyle = C.paper; g.fillRect(4, 4, s - 8, s - 8);
  return { width: s * 2, height: s * 2, data: g.getImageData(0, 0, s * 2, s * 2).data };
}

const dataP = fetch("data/honks.json").then(r => r.json());
const tunnelsP = fetch("data/tunnels.geojson").then(r => r.json());

map.on("style.load", async () => {
  brand();
  D = await dataP;
  $("asof").textContent = new Date(D.asof + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  map.addSource("honks", { type: "geojson", data: { type: "FeatureCollection", features: D.pts.map(p => ({
    type: "Feature", geometry: { type: "Point", coordinates: [p[0], p[1]] },
    properties: { a: p[2], n: p.slice(3).reduce((s, v) => s + v, 0), y: p.slice(3).join(",") } })) } });
  map.addSource("ring", { type: "geojson", data: ring(start.lng, start.lat) });
  map.addSource("cams", { type: "geojson", data: { type: "FeatureCollection", features: D.cams.map(c => ({
    type: "Feature", geometry: { type: "Point", coordinates: [c[4], c[5]] },
    properties: { a: c[0], b: c[1], ev: c[2], sm: c[3] } })) } });
  map.addImage("cam", camIcon(), { pixelRatio: 2 });

  // Blue is reserved for tunnels and the ramps that feed them
  map.addSource("tunnels", { type: "geojson", data: await tunnelsP });
  const tw = ["interpolate", ["linear"], ["zoom"], 11, 1.5, 16, 4];
  map.addLayer({ id: "tunnel-bores", type: "line", source: "tunnels", filter: ["==", ["get", "k"], "bore"],
    paint: { "line-color": C.blue, "line-opacity": 0.55, "line-width": tw, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "tunnel-ramps", type: "line", source: "tunnels", filter: ["==", ["get", "k"], "ramp"],
    layout: { "line-cap": "round" }, paint: { "line-color": C.blue, "line-opacity": 0.55, "line-width": tw } });
  map.addLayer({ id: "ring-fill", type: "fill", source: "ring", paint: { "fill-color": C.pink, "fill-opacity": 0.06 } });
  map.addLayer({ id: "honks", type: "circle", source: "honks", paint: {
    "circle-color": C.pink, "circle-opacity": 0.8,
    "circle-radius": ["interpolate", ["linear"], ["zoom"],
      10, ["max", 1.3, ["*", 0.45, ["sqrt", ["get", "n"]]]],
      16, ["max", 4.5, ["*", 2.4, ["sqrt", ["get", "n"]]]]],
    "circle-stroke-color": C.paper, "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 12, 0, 15, 1.5] } });
  map.addLayer({ id: "ring-line", type: "line", source: "ring", paint: { "line-color": C.ink, "line-width": 1.5, "line-dasharray": [2, 2] } });
  map.addLayer({ id: "cams", type: "symbol", source: "cams", layout: { "icon-image": "cam", "icon-allow-overlap": true } });

  select(start.lng, start.lat, start.name);

  map.on("mousemove", "honks", e => {
    const p = e.features[0].properties, y = p.y.split(",");
    showTip(e, `<b>${p.a || "No address"}</b><br>${fmt(p.n)} complaint${p.n > 1 ? "s" : ""}<br>${D.years.map((yr, i) => `${yr}: ${y[i]}`).join(" · ")}`);
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mousemove", "cams", e => {
    const p = e.features[0].properties;
    showTip(e, `<b>DEP noise camera</b><br>${p.a}, ${p.b}<br>${fmt(p.ev)} loud vehicles logged in 2025`);
  });
  for (const l of ["tunnel-bores", "tunnel-ramps"]) map.on("mousemove", l, e => showTip(e, `<b>${e.features[0].properties.n}</b>`));
  for (const l of ["honks", "cams", "tunnel-bores", "tunnel-ramps"]) map.on("mouseleave", l, () => { hideTip(); map.getCanvas().style.cursor = ""; });
  map.on("click", e => { hideTip(); select(e.lngLat.lng, e.lngLat.lat); });
});

$("home").addEventListener("click", e => {
  e.preventDefault();
  map.flyTo(homeView());
  select(HOME.lng, HOME.lat, HOME.name);
});

// Address search: NYC Planning Labs GeoSearch
const q = $("q"), list = $("results");
let timer, hits = [], active = -1;
function render() {
  list.innerHTML = hits.map((f, i) => `<li role="option" data-i="${i}" aria-selected="${i === active}">${f.properties.label.replace(/, New York, NY, USA$/, "")}</li>`).join("");
  list.hidden = !hits.length;
}
function pick(f) {
  const [lng, lat] = f.geometry.coordinates, name = f.properties.label.replace(/, (New York|NY).*$/, "").replace(/, (Manhattan|Brooklyn|Queens|Bronx|Staten Island)$/i, "");
  hits = []; render(); q.value = ""; q.blur();
  map.flyTo({ center: [lng, lat], zoom: 16.5, bearing: 29 });
  select(lng, lat, name);
}
q.addEventListener("input", () => {
  clearTimeout(timer);
  const t = q.value.trim();
  if (t.length < 3) { hits = []; render(); return; }
  timer = setTimeout(async () => {
    try {
      const r = await fetch(`https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(t)}`);
      hits = (await r.json()).features.slice(0, 6); active = -1; render();
    } catch (e) { hits = []; render(); }
  }, 200);
});
q.addEventListener("keydown", e => {
  if (!hits.length) return;
  if (e.key === "ArrowDown") { active = (active + 1) % hits.length; render(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { active = (active - 1 + hits.length) % hits.length; render(); e.preventDefault(); }
  else if (e.key === "Enter") { pick(hits[Math.max(0, active)]); e.preventDefault(); }
  else if (e.key === "Escape") { hits = []; render(); }
});
list.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li) pick(hits[+li.dataset.i]); });
