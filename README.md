# Honk Map

Every 311 "Car/Truck Horn" complaint in New York City since January 2024. Tap any spot to count the complaints within 100 meters and see how it ranks citywide. Opens on 11th Avenue and West 42nd Street.

Live: https://judy-huynh.github.io/honk-map/
Story: [12 Noise Cameras, 25 Promised, 1 Very Loud Corner](https://judyhuynh.ca/honking-11th-ave-42nd-st-nyc-noise-cameras/)

## Data

- Complaints: NYC Open Data, [311 Service Requests](https://data.cityofnewyork.us/Social-Services/311-Service-Requests-from-2010-to-Present/erm2-nwe9), descriptor "Car/Truck Horn", grouped by location.
- Cameras: DEP, [2025 Annual Report for Noise Camera Enforcement Program](https://www.nyc.gov/assets/dep/downloads/pdf/air/noise/2025-annual-report-noise-camera-enforcement-program.pdf), geocoded with NYC Planning Labs GeoSearch.
- Ranking: complaints within 100 m of every location, overlapping circles merged into one hotspot (keeping the busiest). A tapped spot's rank is how many hotspots have more complaints, plus one. Circles instead of a fixed grid, so a grid line can't split one cluster in two.

Refresh: `python3 scripts/build_data.py` rewrites `data/honks.json`.

311 counts measure who calls, not how loud a street is.
