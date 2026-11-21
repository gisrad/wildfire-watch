# Wildfire Watch · Sentinel Api

**Real-time Indonesia wildfire & peatland hotspot monitor powered by NASA FIRMS VIIRS 375 m — automatically separating vegetation and peatland fires (*karhutla*) from coal power plants (PLTU), nickel smelters, oil & gas flares, kilns, and active volcanoes.**

[![Live Demo](https://img.shields.io/badge/Live_Map-fire.transbulent.id-ffb000?style=flat-square&logo=cloudflare&logoColor=12130e)](https://fire.transbulent.id/)
[![NASA FIRMS](https://img.shields.io/badge/Data-NASA_FIRMS_VIIRS_375m-ff5a1f?style=flat-square)](https://firms.modaps.eosdis.nasa.gov/)
[![Stack](https://img.shields.io/badge/Stack-Astro_5_+_MapLibre_GL_v5-1e293b?style=flat-square)](https://maplibre.org/)
[![Edge](https://img.shields.io/badge/Edge-Cloudflare_Workers_+_D1-f38020?style=flat-square&logo=cloudflareworkers&logoColor=white)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)

![Sentinel Api desktop view focused across the Indonesian archipelago with panel-aware framing and live thermal source separation](docs/preview-desktop.png)

---

## Why This Exists

Raw satellite thermal anomaly feeds over Indonesia routinely conflate **active vegetation and peatland fires (*kebakaran hutan dan lahan / karhutla*)** with **stationary industrial heat sources** (captive coal-fired power plants / PLTU, nickel & alumina smelters in Morowali, Weda Bay, Konawe, and Obi, upstream oil & gas flare stacks, cement kilns, pulp mills) as well as **active volcanic craters**.

On humid or non-peak fire days, stationary industrial infrastructure and degassing lava domes dominate raw VIIRS hotspot counts and distort Fire Radiative Power (`FRP`, MW) totals—obscuring genuine early-stage peatland ignitions. **Wildfire Watch (`Sentinel Api`)** cleans the signal before rendering metrics, fire perimeters, or alert lists.

<details>
<summary>Mobile responsive preview (390×844 viewport with collapsible control sheet)</summary>

<p align="center">
  <img src="docs/preview-mobile.png" alt="Sentinel Api mobile layout over Indonesia" width="340" />
</p>

</details>

---

## Key Capabilities

- **Multi-Satellite VIIRS 375 m Live Ingestion**: Pulls NRT thermal detections from `Suomi NPP`, `NOAA-20`, and `NOAA-21` over Indonesia (`94.0°E–141.02°E`, `11.5°S–6.5°N`) every 30 minutes into Cloudflare D1 with `caches.default` edge caching (300 s TTL) and stale-while-revalidate lock protection.
- **2-Tier Stationary Source Separation**: Separates **Land / Peat Wildfires** (`karhutla`) from **Industrial Heat** (`#38bdf8` cyan rings — PLTU, smelters, gas flares, cement/pulp kilns) and **Active Volcanoes** (`#e879f9` violet rings), with independent KPI cards, category toggles, and sortable ranked lists.
- **Cross-Border Territory Exclusion**: Edge- and client-side geometric border filtering (`isForeignTerritory`) excludes adjacent Malaysian, Singaporean, Bruneian, Timor-Leste, and Papua New Guinean detections inside the rectangular bounding box.
- **Hydrological Peatland Awareness (`GAMBUT`)**: Cross-references detections against major Sumatran, Kalimantan, and South Papuan peatland corridors (`PEAT_CORRIDORS`) and exempts peatland zones from stationary industrial suppression so multi-day subterranean peat smoldering is never muted.
- **Archipelagic Framing & Time Zones**: Panel-aware initial framing across the full archipelago, 6 island camera presets (*Nusantara*, *Sumatera*, *Kalimantan*, *Jawa · Nusa*, *Sulawesi*, *Maluku · Papua*), fast 38-province spatial lookup, and automatic `WIB` / `WITA` / `WIT` local timestamp formatting.
- **Historical Peat Megafire Replay (`Kalteng 2019`)**: Includes **`43,786`** archival VIIRS 375 m detections across Pulang Pisau – Palangka Raya (`1–20 September 2019`), interactive `O(log N)` 48-hour sliding window scrubber, and SVG FRP sparkline—running 100% locally with zero API keys needed.
- **3D Terrain & Satellite Overlay**: Toggleable MapLibre GL v5 3D terrain relief (AWS Terrarium RGB DEM with procedural atmospheric sky fog) and Esri World Imagery reference layer.

---

## Scientific Methodology & Limitations

### 1. Two-Tier Thermal Source Classification (`src/scripts/thermal-sites.js`)

| Tier | Mechanism | Scope & Criteria | Output Category |
|---|---|---|---|
| **Tier 1** | Verified coordinate catalog (`THERMAL_SITES`) | **74** industrial/energy sites (metallurgical smelters, PLTU coal stations, oil & gas flares, coal mines, cement kilns, pulp mills) and **26** PVMBG active volcanoes with site-specific buffer radii (`2.5–7.5 km`). | `industri` or `vulkanik` |
| **Tier 2** | 7-day SQLite spatiotemporal persistence (`queryPersistentCells` + `classifyThermalPoint`) | Uncatalogued `0.02°` (~2.2 km) grid cells exhibiting **`≥ 2` distinct days**, **`≥ 4` distinct orbital passes**, **`≥ 60%` nighttime detections**, and compact spatial spread **`≤ 1.8 km`** (prefiltered at `≥ 55%` night / `≤ 2.0 km` in D1 SQL). **Explicitly disabled inside `PEAT_CORRIDORS`** so slow, stationary peat fires remain flagged as wildfire (`GAMBUT`). | `industri` (`Termal Tetap`) |
| **Default** | Remaining Indonesian detections | Vegetation, agricultural burning, forest/plantation fire, and peatland corridors. | `karhutla` (`Lahan / Hutan` or `Lahan Gambut`) |

### 2. Known Scientific & Operational Limitations

1. **Pixel Footprint Mixing (375 m I-Band)**: Individual VIIRS I-band pixels cover ~375 m at nadir and expand toward swath edges; vegetation fires occurring within an industrial complex radius may be tagged as industrial context.
2. **Cloud & Dense Haze Attenuation**: Optical/infrared VIIRS retrievals cannot penetrate thick cumulonimbus clouds or optically opaque smoke plumes; low FRP counts during cloudy conditions do not imply fire extinguishment.
3. **Indicative Peatland Boundaries**: `PEAT_CORRIDORS` represents 7 macro hydrological basins (`Coastal Riau`, `Jambi`, `South Sumatra`, `West Kalimantan`, `Central Kalimantan`, `South Kalimantan`, `South Papua`) for rapid edge/client classification and does not replace official polygon delineations from KLHK / BRGM.
4. **Tier 2 Uncatalogued Biomass Kilns**: Stationary charcoal/agricultural dryers outside Tier 1 that operate continuously for multiple nights may be classified as `Termal Tetap` unless situated within a peatland corridor.
5. **Subterranean Smoldering Underestimation**: Low-temperature deep peat smoldering beneath intact canopy can fall below satellite NRT detection thresholds (`nominal` confidence or omitted entirely).

---

## Edge & Frontend Architecture

```mermaid
flowchart LR
    FIRMS["NASA FIRMS EOSDIS API (VIIRS N20 / N21 / SNPP)"] -->|"30m Cron & SWR Lock"| Worker["Cloudflare Worker (worker/index.js)"]
    Worker -->|"Parameterized Batch & Border Filter"| D1[("Cloudflare D1 SQLite (7-Day Window)")]
    D1 -->|"Hotspots + 0.02° Persistence Cells"| Worker
    Worker -->|"300s Edge Cache & CSP"| Browser["Astro 5 + MapLibre GL v5 (WebGL2 3D)"]
    Static["Bundled Replay JSON (43,786 Kalteng 2019 Pts)"] --> Browser
```

**Security Highlights** (see [SECURITY.md](SECURITY.md)):
- `FIRMS_MAP_KEY` lives exclusively as a Cloudflare Worker Secret (`env.FIRMS_MAP_KEY`), never in browser bundles or public configs.
- `X-Robots-Tag: noindex` prevents raw `/api/*` JSON responses from entering search indexes while allowing Googlebot Web Rendering Service to render live map summaries.
- All D1 queries use strict parameterized `.bind(...)` statements; static assets enforce strict CSP, HSTS, and `frame-ancestors 'none'`.

---

## Ringkasan Bahasa Indonesia

**Wildfire Watch (`Sentinel Api`)** adalah aplikasi pemantau titik panas (*hotspot*) kebakaran hutan dan lahan (*karhutla*) Indonesia berbasis satelit **NASA FIRMS VIIRS 375 m** secara *real-time* yang dapat diakses langsung di **[fire.transbulent.id](https://fire.transbulent.id/)**.

Fitur utama untuk analis, peneliti gambut, jurnalis data, dan pemantau kebencanaan:
- **Pemisahan Sumber Termal Non-Karhutla**: Memisahkan deteksi panas dari **74 kawasan industri** (PLTU batubara, smelter nikel/bauksit/tembaga, suar migas, pabrik semen/pulp) dan **26 gunung api aktif PVMBG**, plus deteksi sel stasioner multi-hari di Cloudflare D1, sehingga metrik titik api lahan dan total daya radiasi (*FRP*) lebih akurat.
- **Lencana Hidrologis `GAMBUT`**: Menandai klaster kebakaran pada 7 koridor gambut utama Sumatera, Kalimantan, dan Papua Selatan serta memastikan sel berulang di lahan gambut tidak dianggap sumber industri.
- **Fokus Kepulauan & Zona Waktu Lokal**: Navigasi cepat 6 koridor wilayah, identifikasi 38 provinsi, konversi waktu otomatis (`WIB`/`WITA`/`WIT`), serta mode **Replay Karhutla Kalteng 2019** (43.786 deteksi di Pulang Pisau – Palangka Raya) yang berjalan lokal tanpa memerlukan kunci API.

---

## Quickstart

### 1. Local Frontend + Offline Replay (Zero API Keys Required)

```bash
git clone https://github.com/gisrad/wildfire-watch.git
cd wildfire-watch
npm install
npm run dev
```

Open `http://127.0.0.1:4324/` and switch to **Replay · Kalteng 2019** to explore the full `43,786`-point Central Kalimantan dataset locally. (In plain `astro dev` without Wrangler, `/api/hotspots` is served by the Worker when deployed or via `wrangler dev`.)

### 2. Production Deployment on Cloudflare Workers + D1

1. Copy the sanitized Wrangler template:
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```
   *(Notice `wrangler.toml` is gitignored so your personal `account_id` and `database_id` stay local.)*
2. Provision D1 and apply the SQL schema (`worker/schema.sql`):
   ```bash
   npx wrangler d1 create wildfire-watch
   # Paste the returned database_id into wrangler.toml
   npx wrangler d1 execute wildfire-watch --remote --file=worker/schema.sql
   ```
3. Configure your free NASA FIRMS MAP Key ([request a FIRMS key](https://firms.modaps.eosdis.nasa.gov/api/map_key/)):
   ```bash
   npx wrangler secret put FIRMS_MAP_KEY
   ```
4. Verify security hygiene, build static Astro assets, and deploy:
   ```bash
   npm run check:security
   npm run build
   npx wrangler deploy
   ```

### 3. Rebuilding Historical Replay Data (Optional)

```bash
FIRMS_MAP_KEY=your_key_here npm run bake:replay
```

---

## Repository Structure

```text
wildfire-watch/
├── astro.config.mjs            # Astro 5 static build config
├── wrangler.toml.example       # Sanitized Cloudflare Worker + D1 template
├── worker/
│   ├── index.js                # Edge router, FIRMS NRT cron, D1 queries & cache
│   └── schema.sql              # D1 detections + meta schema
├── src/
│   ├── pages/
│   │   ├── index.astro         # UI shell, JSON-LD SEO, & responsive layout
│   │   └── 404.astro           # Minimal dark-theme 404 page
│   └── scripts/
│       ├── fire.js             # MapLibre GL v5 controller, layers & replay engine
│       ├── indonesia.js        # Archipelago camera presets, 38 provinces, TZ & peat corridors
│       └── thermal-sites.js    # Border filter & 2-tier industrial/volcano classifier
├── scripts/
│   ├── bake-replay.mjs         # Archival FIRMS SP dataset builder
│   └── security-check.mjs      # Automated pre-push secret/ID/email scanner
├── public/
│   ├── data/replay-kalteng-2019.json
│   ├── fonts/                  # Self-hosted Schibsted Grotesk WOFF2 + OFL-1.1 license
│   ├── og-fire.png             # OpenGraph / Twitter social card (1200×630)
│   ├── robots.txt & sitemap.xml
├── CITATION.cff                # Machine-readable software citation metadata
├── SECURITY.md                 # Threat boundaries & vulnerability disclosure
└── LICENSE                     # MIT License + third-party data notices
```

---

## Citation & Data Attribution

If you reference this tool or its two-tier stationary industrial filter in academic work, please use GitHub's **"Cite this repository"** sidebar widget ([CITATION.cff](CITATION.cff)):

- **Satellite Active Fire Data**: NASA FIRMS EOSDIS — VIIRS 375 m Active Fire Product ([Schroeder et al., 2014, *Remote Sensing of Environment* 143:85–96](https://doi.org/10.1016/j.rse.2013.12.008)). *Disclaimer: NASA promotes the full and open sharing of all data with research and applications communities; VIIRS 375 m NRT detections carry ±375 m spatial resolution and are subject to cloud cover and thermal saturation limits.*
- **Basemaps, DEM & Fonts**: Vector tiles by [OpenFreeMap](https://openfreemap.org/) / © OpenStreetMap contributors · Elevation RGB terrain by AWS Terrain Tiles (Mapzen/Tilezen) · Reference satellite imagery by Esri World Imagery · Typography using [Schibsted Grotesk](public/fonts/OFL.txt) (SIL OFL 1.1).

## License

Code in this repository is released under the [MIT License](LICENSE).
