import { createLiveFeed, describeLive, showSentinelDetail } from '../lib/sentinel-live.js';
import { startSentinelMap } from '../lib/sentinel-map.js';
import {
  REGIONS,
  MOBILE_INITIAL_BOUNDS,
  INDONESIA_MAX_BOUNDS,
  locateIndonesia,
  isPeatCorridor,
  formatZoneTime
} from './indonesia.js';
import {
  isForeignTerritory,
  buildPersistMap,
  classifyThermalPoint
} from './thermal-sites.js';

const STYLE = 'https://tiles.openfreemap.org/styles/dark';
const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const IMAGERY = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const REPLAY_URL = '/data/replay-kalteng-2019.json';
const INCIDENT_CELL = 0.015; // derajat (~1,6 km) untuk pengelompokan klaster karhutla
const REPLAY_WINDOW_MIN = 48 * 60;
const REPLAY_INITIAL_MIN = 720;
const HOUR = 3600;

const $ = (id) => document.getElementById(id);
const fmtNum = new Intl.NumberFormat('id-ID');
const fmtWib = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
});
const wib = (ts) => `${fmtWib.format(new Date(ts * 1000))} WIB`;
const SAT = { N: 'Suomi NPP', N20: 'NOAA-20', N21: 'NOAA-21', 1: 'NOAA-20' };

const isMobile = () => window.matchMedia('(max-width: 640px)').matches;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const panelEl = $('panel');
const toggleBtn = $('panel-toggle');
const reopenBtn = $('panel-reopen');

function syncPanelChrome() {
  const open = panelEl.dataset.open === 'true';
  toggleBtn.setAttribute('aria-expanded', String(open));
  const foldSpan = toggleBtn.querySelector('.ico-fold');
  if (foldSpan) foldSpan.textContent = open ? '−' : '+';
  reopenBtn.hidden = isMobile() || open;
}

if (isMobile()) {
  panelEl.dataset.open = 'false';
}
syncPanelChrome();

function getMapPadding() {
  const open = panelEl.dataset.open === 'true';
  if (isMobile()) {
    const h = panelEl.offsetHeight || (open ? 360 : 108);
    const bottomInset = open ? Math.min(h + 12, window.innerHeight * 0.56) : h + 14;
    return { top: 56, right: 12, bottom: bottomInset, left: 12 };
  }
  const leftInset = open ? (panelEl.offsetWidth || 350) + 28 : 28;
  return { top: 60, right: 28, bottom: 28, left: leftInset };
}

let map;
let maplibregl;

const state = {
  mode: 'live',
  hours: 48,
  minConfNominal: true,
  speed: 1,
  live: null,
  replay: null,
  t: REPLAY_INITIAL_MIN,
  playing: false,
  timer: null,
  lastListRender: 0,
  replayToken: 0,
  activeRegion: 'nusantara',
  activeListTab: 'karhutla',
  showSources: { karhutla: true, industri: true, vulkanik: true }
};

const liveFeed = createLiveFeed({
  endpoint: '/api/hotspots',
  recordsKey: 'points',
  onView(view) {
    const changed = state.live !== view.data || state.livePhase !== view.phase;
    state.live = view.data;
    const latest = view.data?.points.at(-1)?.[3];
    const note = $('live-note');
    note.classList.toggle('warn', ['partial', 'stale', 'unavailable'].includes(view.phase));
    note.textContent = describeLive(view, wib, latest ? `Pengamatan terakhir ${wib(latest)}` : '');
    state.livePhase = view.phase;
    $('retry-live').hidden = view.phase !== 'unavailable';
    if (changed) render(true);
  }
});

// ---------- data -> GeoJSON ----------
function fc(features) {
  return { type: 'FeatureCollection', features };
}

function lowerBoundMinute(points, targetMin) {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid][3] < targetMin) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function livePoints() {
  const now = Date.now() / 1000;
  const pts = state.live.points || [];
  const persistMap = buildPersistMap(state.live.persistent_cells);
  const out = [];
  let hiddenLow = 0;
  let totalDomestic = 0;
  for (const pt of pts) {
    const [lon, lat, frp, ts, sat, conf, dn] = pt;
    if (isForeignTerritory(lat, lon)) continue;
    totalDomestic += 1;
    if (state.minConfNominal && conf === 'l') {
      hiddenLow += 1;
      continue;
    }
    const peat = isPeatCorridor(lat, lon);
    const cls = classifyThermalPoint(lat, lon, persistMap, peat);
    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        frp,
        ts,
        sat,
        conf,
        dn: dn || null,
        age: Math.max(0, (now - ts) / HOUR),
        kind: cls.kind,
        subType: cls.subType,
        siteId: cls.siteId,
        siteName: cls.siteName,
        basis: cls.basis,
        peat: cls.kind === 'karhutla' && peat
      }
    });
  }
  return { features: out, hiddenLow, totalRaw: totalDomestic };
}

function replayPoints() {
  const r = state.replay;
  const tNow = state.t;
  const startMin = Math.max(0, tNow - REPLAY_WINDOW_MIN);
  const i0 = lowerBoundMinute(r.points, startMin);
  const i1 = lowerBoundMinute(r.points, tNow + 1);
  const out = [];
  for (let i = i0; i < i1; i++) {
    const [lon, lat, frp, min, sat] = r.points[i];
    out.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        frp,
        ts: r.t0 + min * 60,
        sat,
        age: Math.max(0, (tNow - min) / 60),
        kind: 'karhutla',
        subType: 'Lahan Gambut',
        siteId: null,
        siteName: null,
        basis: 'replay',
        peat: true
      }
    });
  }
  return { features: out, hiddenLow: 0, totalRaw: out.length };
}

function summarizeGroup(fs, forcedSite = null) {
  let sx = 0, sy = 0, frpMax = 0, first = Infinity, last = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let peatAny = false;
  for (const f of fs) {
    const [x, y] = f.geometry.coordinates;
    sx += x;
    sy += y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    frpMax = Math.max(frpMax, f.properties.frp);
    first = Math.min(first, f.properties.ts);
    last = Math.max(last, f.properties.ts);
    if (f.properties.peat) peatAny = true;
  }
  const lon = sx / fs.length;
  const lat = sy / fs.length;
  const loc = locateIndonesia(lat, lon);
  const sample = fs[0].properties;
  return {
    n: fs.length,
    lon,
    lat,
    frpMax,
    first,
    last,
    bbox: [minX, minY, maxX, maxY],
    loc,
    kind: forcedSite ? sample.kind : 'karhutla',
    subType: sample.subType,
    basis: sample.basis,
    siteName: forcedSite ? sample.siteName : null,
    peat: !forcedSite && (peatAny || isPeatCorridor(lat, lon))
  };
}

// Pisahkan pengelompokan klaster: karhutla dikelompokkan per sel grid ±1,6 km; industri/vulkanik digabung utuh per siteId.
function groupIncidents(features) {
  const karhutlaFeatures = [];
  const siteGroups = new Map();

  for (const f of features) {
    const p = f.properties;
    if (p.kind === 'karhutla') {
      karhutlaFeatures.push(f);
    } else {
      const gid = p.siteId || `grid:${Math.round(f.geometry.coordinates[0] / 0.02)},${Math.round(f.geometry.coordinates[1] / 0.02)}`;
      if (!siteGroups.has(gid)) siteGroups.set(gid, []);
      siteGroups.get(gid).push(f);
    }
  }

  // Union-find klaster karhutla murni
  const parent = new Map();
  const find = (k) => {
    while (parent.get(k) !== k) {
      parent.set(k, parent.get(parent.get(k)));
      k = parent.get(k);
    }
    return k;
  };
  const cells = new Map();
  for (const f of karhutlaFeatures) {
    const [lon, lat] = f.geometry.coordinates;
    const key = `${Math.floor(lon / INCIDENT_CELL)},${Math.floor(lat / INCIDENT_CELL)}`;
    if (!cells.has(key)) {
      cells.set(key, []);
      parent.set(key, key);
    }
    cells.get(key).push(f);
  }
  for (const key of cells.keys()) {
    const [cx, cy] = key.split(',').map(Number);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nk = `${cx + dx},${cy + dy}`;
        if (nk !== key && cells.has(nk)) parent.set(find(nk), find(key));
      }
    }
  }
  const karhutlaClusters = new Map();
  for (const [key, fs] of cells) {
    const root = find(key);
    if (!karhutlaClusters.has(root)) karhutlaClusters.set(root, []);
    karhutlaClusters.get(root).push(...fs);
  }

  const karhutla = [...karhutlaClusters.values()]
    .map((fs) => summarizeGroup(fs, false))
    .sort((a, b) => b.n - a.n || b.last - a.last);

  const nonKarhutla = [...siteGroups.values()]
    .map((fs) => summarizeGroup(fs, true))
    .sort((a, b) => b.n - a.n || b.last - a.last);

  return { karhutla, nonKarhutla, karhutlaPoints: karhutlaFeatures };
}

// ---------- ringkasan & render ----------
function updateSummary(karhutlaInc, nonKarhutlaCount, hiddenLow, totalRaw) {
  const el = $('situation-summary');
  if (totalRaw === 0) {
    el.textContent = state.mode === 'live' && state.livePhase !== 'empty'
      ? 'Belum ada deteksi pada data yang tersedia; cakupan bisa tidak lengkap.'
      : 'Tidak ada deteksi dalam rentang ini. Ini bukan bukti tidak ada kebakaran.';
    return;
  }
  const parts = [`${fmtNum.format(karhutlaInc.length)} klaster deteksi lahan`];
  if (nonKarhutlaCount > 0) parts.push(`${fmtNum.format(nonKarhutlaCount)} deteksi dekat fasilitas, kawah, atau sumber panas tetap`);
  if (hiddenLow > 0) parts.push(`${fmtNum.format(hiddenLow)} deteksi berkeyakinan rendah disembunyikan`);
  el.textContent = `${parts.join(' · ')}.`;
}

function render(forceList = true) {
  const available = state.mode === 'live' ? state.live : state.replay;
  const src = map?.getSource('hotspots');
  let pack = { features: [], hiddenLow: 0, totalRaw: 0 };
  if (state.mode === 'live' && state.live) pack = livePoints();
  if (state.mode === 'replay' && state.replay) pack = replayPoints();

  const { features, hiddenLow, totalRaw } = pack;
  if (src) src.setData(fc(features));

  const { karhutla, nonKarhutla, karhutlaPoints } = groupIncidents(features);
  const nonKarhutlaCount = features.length - karhutlaPoints.length;

  const known = available && (totalRaw > 0 || state.mode === 'replay' || state.livePhase === 'empty');
  $('stat-points').textContent = known ? fmtNum.format(features.length) : '–';
  $('stat-industrial').textContent = known ? fmtNum.format(nonKarhutlaCount) : '–';
  $('stat-clusters').textContent = known ? fmtNum.format(karhutla.length) : '–';
  $('tab-karhutla').textContent = known ? `Klaster lahan (${fmtNum.format(karhutla.length)})` : 'Klaster lahan';
  $('tab-non-karhutla').textContent = known ? `Dugaan sumber tetap (${fmtNum.format(nonKarhutla.length)})` : 'Dugaan sumber tetap';

  if (available) updateSummary(karhutla, nonKarhutlaCount, hiddenLow, totalRaw);
  else $('situation-summary').textContent = state.mode === 'live' && state.livePhase === 'unavailable'
    ? 'Data titik panas belum tersedia.'
    : '';

  const nowMs = performance.now();
  if (forceList || !state.playing || nowMs - state.lastListRender >= 600) {
    state.lastListRender = nowMs;
    const activeItems = state.activeListTab === 'non-karhutla' ? nonKarhutla : karhutla;
    renderList(activeItems, state.activeListTab === 'non-karhutla');
    if (!known) $('incident-empty').hidden = true;
  }
}

function renderList(items, isNonWildfire) {
  const list = $('incident-list');
  list.replaceChildren();
  for (const i of items.slice(0, 45)) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';

    const head = document.createElement('span');
    head.className = 'inc-head';
    const top = document.createElement('span');
    top.className = 'inc-top';
    top.textContent = isNonWildfire ? i.siteName || i.loc.province : i.loc.province;
    head.append(top);

    if (isNonWildfire) {
      const badge = document.createElement('span');
      badge.className = `kind-badge ${i.kind === 'vulkanik' ? 'volc' : 'ind'}`;
      badge.textContent = i.basis === 'katalog' ? 'Dekat fasilitas/kawah' : 'Dugaan sumber tetap';
      head.append(badge);
    } else if (i.peat) {
      const badge = document.createElement('span');
      badge.className = 'kind-badge peat';
      badge.textContent = 'Zona gambut';
      head.append(badge);
    }

    const meta = document.createElement('span');
    meta.className = 'inc-meta';
    const placePart = isNonWildfire ? `${i.loc.province} · ` : '';
    meta.textContent = `${placePart}${fmtNum.format(i.n)} deteksi · maks ${i.frpMax.toFixed(0)} MW · ${formatZoneTime(i.last, i.loc.tz)} · ${i.lat.toFixed(2)}, ${i.lon.toFixed(2)}`;

    const bar = document.createElement('span');
    bar.className = `inc-bar${isNonWildfire ? (i.kind === 'vulkanik' ? ' volc' : ' ind') : ''}`;
    bar.style.setProperty('--w', `${Math.min(100, Math.max(6, Math.sqrt(i.n) * 10))}%`);

    b.append(head, meta, bar);
    b.addEventListener('click', () => {
      if (!map) {
        showSentinelDetail(detailList([
          ['Wilayah perkiraan', i.loc.province],
          ['Deteksi', fmtNum.format(i.n)],
          ['Pengamatan terakhir', formatZoneTime(i.last, i.loc.tz)],
          ['FRP maksimum per deteksi', `${i.frpMax.toFixed(1)} MW`],
          ['Koordinat klaster', `${i.lat.toFixed(4)}, ${i.lon.toFixed(4)}`],
          ...(isNonWildfire ? [['Dugaan sumber', i.siteName || i.subType]] : [])
        ]));
        return;
      }
      const [a, c, d, e] = i.bbox;
      map.fitBounds(
        [[a - 0.04, c - 0.04], [d + 0.04, e + 0.04]],
        { padding: getMapPadding(), maxZoom: 12.8, duration: reducedMotion() ? 0 : 950 }
      );
    });
    li.append(b);
    list.append(li);
  }
  $('incident-empty').hidden = items.length > 0;
}

// ---------- live ----------
function detailList(rows) {
  const el = document.createElement('dl');
  el.className = 'pop';
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    el.append(dt, dd);
  }
  return el;
}

setInterval(() => {
  if (state.mode === 'live' && !document.hidden) liveFeed.load(state.hours, { background: true });
}, 5 * 60_000);

// ---------- replay ----------
function drawReplaySparkline(r) {
  const svg = $('replay-spark');
  if (!svg || !r?.points?.length) return;
  const BINS = 80;
  const maxMin = r.days * 24 * 60;
  const bins = new Float64Array(BINS);
  for (const p of r.points) {
    const idx = Math.min(BINS - 1, Math.max(0, Math.floor((p[3] / maxMin) * BINS)));
    bins[idx] += p[2];
  }
  const peak = Math.max(1, ...bins);
  const ns = 'http://www.w3.org/2000/svg';
  svg.replaceChildren();
  const bw = 300 / BINS;
  for (let i = 0; i < BINS; i++) {
    const h = Math.max(1, (bins[i] / peak) * 28);
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', (i * bw).toFixed(2));
    rect.setAttribute('y', (31 - h).toFixed(2));
    rect.setAttribute('width', Math.max(1, bw - 0.6).toFixed(2));
    rect.setAttribute('height', h.toFixed(2));
    rect.setAttribute('fill', '#ff6d1f');
    rect.setAttribute('opacity', '0.55');
    svg.append(rect);
  }
  const cursor = document.createElementNS(ns, 'line');
  cursor.setAttribute('id', 'spark-cursor');
  cursor.setAttribute('y1', '0');
  cursor.setAttribute('y2', '32');
  cursor.setAttribute('stroke', '#ffb000');
  cursor.setAttribute('stroke-width', '2');
  svg.append(cursor);
}

async function loadReplay() {
  const token = ++state.replayToken;
  if (!state.replay) {
    $('replay-label').textContent = 'Memuat arsip…';
    try {
      const res = await fetch(REPLAY_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (state.mode !== 'replay' || token !== state.replayToken) return;
      state.replay = data;
      const slider = $('replay-slider');
      slider.max = String(data.days * 24 * 60);
      state.t = Math.min(REPLAY_INITIAL_MIN, Number(slider.max));
      drawReplaySparkline(data);
    } catch (err) {
      if (state.mode !== 'replay' || token !== state.replayToken) return;
      $('replay-label').textContent = `Gagal memuat arsip (${err.message})`;
      return;
    }
  }
  if (state.mode !== 'replay' || token !== state.replayToken) return;
  updateReplay(true);
  const [a, b, c, d] = state.replay.bbox;
  map?.fitBounds([[a, b], [c, d]], {
    padding: getMapPadding(),
    duration: reducedMotion() ? 0 : 950
  });
}

function updateReplay(forceList = true) {
  const r = state.replay;
  if (!r) return;
  const max = Number($('replay-slider').max) || 28800;
  $('replay-slider').value = String(state.t);
  $('replay-label').textContent = wib(r.t0 + state.t * 60);
  const cursor = $('spark-cursor');
  if (cursor) {
    const x = ((state.t / max) * 300).toFixed(2);
    cursor.setAttribute('x1', x);
    cursor.setAttribute('x2', x);
  }
  render(forceList);
}

function togglePlay(force) {
  if (!state.replay && force !== false) return;
  state.playing = force ?? !state.playing;
  $('replay-play').textContent = state.playing ? 'Jeda' : 'Putar';
  clearInterval(state.timer);
  if (!state.playing) {
    if (state.mode === 'replay' && state.replay) render(true);
    return;
  }
  state.timer = setInterval(() => {
    const max = Number($('replay-slider').max);
    state.t = Math.min(max, state.t + 60 * state.speed);
    const done = state.t >= max;
    updateReplay(done);
    if (done) togglePlay(false);
  }, 120);
}

// ---------- wilayah, sumber, tab, & kontrol ----------
function setListTab(tab) {
  state.activeListTab = tab;
  for (const b of document.querySelectorAll('[data-list-tab]')) {
    b.setAttribute('aria-pressed', String(b.dataset.listTab === tab));
  }
  render(true);
}

function syncSourceVisibility() {
  if (!map) return;
  const groups = {
    karhutla: ['hotspots-heat', 'hotspots-glow', 'hotspots'],
    industri: ['hotspots-ind-glow', 'hotspots-ind'],
    vulkanik: ['hotspots-volc']
  };
  for (const [kind, layerIds] of Object.entries(groups)) {
    const vis = state.showSources[kind] ? 'visible' : 'none';
    for (const id of layerIds) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }
}

function setRegionPressed(regionId) {
  state.activeRegion = regionId;
  for (const btn of document.querySelectorAll('[data-region]')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.region === regionId));
  }
}

function focusRegion(regionId, animate = true) {
  const region = REGIONS.find((r) => r.id === regionId) || REGIONS[0];
  setRegionPressed(region.id);
  const targetBounds = region.id === 'nusantara' && isMobile() ? MOBILE_INITIAL_BOUNDS : region.bounds;
  map?.fitBounds(targetBounds, {
    padding: getMapPadding(),
    duration: animate && !reducedMotion() ? 850 : 0,
    maxZoom: 8.5
  });
}

function setMode(mode, shouldRefocus = true) {
  state.mode = mode;
  togglePlay(false);
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  }
  $('live-controls').hidden = mode !== 'live';
  $('replay-controls').hidden = mode !== 'replay';
  $('filter-conf').disabled = mode === 'replay';
  if (mode === 'replay') setListTab('karhutla');
  if (mode === 'live') {
    state.livePhase = undefined;
    if (shouldRefocus) focusRegion(state.activeRegion, true);
    liveFeed.load(state.hours);
  } else {
    liveFeed.cancel();
    $('retry-live').hidden = true;
    $('live-note').classList.remove('warn');
    $('live-note').textContent = 'Arsip · Kalimantan Tengah, September 2019';
    render(true);
    loadReplay();
  }
}

$('retry-live').addEventListener('click', () => liveFeed.load(state.hours));
for (const b of document.querySelectorAll('[data-mode]')) {
  b.addEventListener('click', () => setMode(b.dataset.mode, true));
}
for (const b of document.querySelectorAll('[data-hours]')) {
  b.addEventListener('click', () => {
    state.hours = Number(b.dataset.hours);
    for (const x of document.querySelectorAll('[data-hours]')) x.setAttribute('aria-pressed', String(x === b));
    liveFeed.load(state.hours);
  });
}
for (const b of document.querySelectorAll('[data-region]')) {
  b.addEventListener('click', () => focusRegion(b.dataset.region, true));
}
for (const b of document.querySelectorAll('[data-list-tab]')) {
  b.addEventListener('click', () => setListTab(b.dataset.listTab));
}
for (const b of document.querySelectorAll('[data-source]')) {
  b.addEventListener('click', () => {
    const k = b.dataset.source;
    state.showSources[k] = !state.showSources[k];
    b.setAttribute('aria-pressed', String(state.showSources[k]));
    syncSourceVisibility();
  });
}

$('filter-conf').addEventListener('change', (e) => {
  state.minConfNominal = e.target.checked;
  render(true);
});

$('replay-slider').addEventListener('input', (e) => {
  togglePlay(false);
  state.t = Number(e.target.value);
  updateReplay(true);
});
$('replay-play').addEventListener('click', () => {
  if (state.t >= Number($('replay-slider').max)) state.t = REPLAY_INITIAL_MIN;
  togglePlay();
});
$('replay-speed').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 3 : 1;
  $('replay-speed').textContent = `${state.speed}×`;
});

$('toggle-3d').addEventListener('change', (e) => {
  if (!map) return;
  const dur = reducedMotion() ? 0 : 900;
  if (e.target.checked) {
    map.setTerrain({ source: 'dem', exaggeration: 1.5 });
    map.setLayoutProperty('hillshade', 'visibility', 'visible');
    map.easeTo({ pitch: 62, duration: dur });
  } else {
    map.setTerrain(null);
    map.setLayoutProperty('hillshade', 'visibility', 'none');
    map.easeTo({ pitch: 0, duration: dur });
  }
});
$('toggle-imagery').addEventListener('change', (e) => {
  map?.setLayoutProperty('imagery', 'visibility', e.target.checked ? 'visible' : 'none');
});

function setPanelOpen(open) {
  panelEl.dataset.open = String(open);
  syncPanelChrome();
}
toggleBtn.addEventListener('click', () => setPanelOpen(panelEl.dataset.open !== 'true'));
reopenBtn.addEventListener('click', () => setPanelOpen(true));

// ---------- layer peta ----------
function addMapLayers() {
  if (typeof map.setSky === 'function') {
    map.setSky({
      'sky-color': '#0e0f0c',
      'horizon-color': '#2c1c13',
      'fog-color': '#171612',
      'sky-horizon-blend': 0.35,
      'horizon-fog-blend': 0.5,
      'fog-ground-blend': 0.65
    });
  }

  const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addSource('imagery', {
    type: 'raster',
    tiles: [IMAGERY],
    tileSize: 256,
    maxzoom: 19,
    attribution: 'Citra: Esri, Maxar, Earthstar Geographics'
  });
  map.addLayer({ id: 'imagery', type: 'raster', source: 'imagery', layout: { visibility: 'none' } }, firstSymbol);

  map.addSource('dem', { type: 'raster-dem', tiles: [TERRARIUM], encoding: 'terrarium', tileSize: 256, maxzoom: 15 });
  map.addLayer(
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem',
      layout: { visibility: 'none' },
      paint: { 'hillshade-shadow-color': '#000', 'hillshade-highlight-color': '#5a5a48', 'hillshade-exaggeration': 0.4 }
    },
    firstSymbol
  );

  map.addSource('hotspots', { type: 'geojson', data: fc([]) });

  // 1. Lapis Karhutla / Lahan (hanya kategori ini yang membentuk heatmap api)
  map.addLayer({
    id: 'hotspots-heat',
    type: 'heatmap',
    source: 'hotspots',
    filter: ['==', ['get', 'kind'], 'karhutla'],
    maxzoom: 8.5,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'frp'], 0, 0.25, 40, 0.7, 150, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3.5, 0.85, 8, 1.4],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3.5, 14, 7.5, 22],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0, 'rgba(18, 19, 14, 0)',
        0.2, 'rgba(140, 43, 43, 0.45)',
        0.45, 'rgba(217, 43, 43, 0.72)',
        0.7, 'rgba(255, 109, 31, 0.88)',
        0.9, 'rgba(255, 176, 0, 0.95)',
        1, 'rgba(255, 243, 176, 1)'
      ],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 5.5, 0.78, 8.5, 0]
    }
  });

  const radius = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4, ['interpolate', ['linear'], ['get', 'frp'], 0, 1.8, 100, 4.8],
    10, ['interpolate', ['linear'], ['get', 'frp'], 0, 4.5, 100, 13]
  ];
  const glowRadius = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4, ['interpolate', ['linear'], ['get', 'frp'], 0, 4.5, 100, 12],
    10, ['interpolate', ['linear'], ['get', 'frp'], 0, 11.2, 100, 32.5]
  ];
  const color = [
    'interpolate',
    ['linear'],
    ['get', 'age'],
    0, '#fff3b0',
    3, '#ffb000',
    12, '#ff5a1f',
    24, '#d92b2b',
    72, '#8c3b3b'
  ];

  map.addLayer({
    id: 'hotspots-glow',
    type: 'circle',
    source: 'hotspots',
    filter: ['==', ['get', 'kind'], 'karhutla'],
    paint: {
      'circle-radius': glowRadius,
      'circle-color': color,
      'circle-blur': 1,
      'circle-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.6, 24, 0.16, 72, 0.04]
    }
  });

  map.addLayer({
    id: 'hotspots',
    type: 'circle',
    source: 'hotspots',
    filter: ['==', ['get', 'kind'], 'karhutla'],
    paint: {
      'circle-radius': radius,
      'circle-color': color,
      'circle-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 1, 72, 0.65],
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 7, 0, 10, 0.8],
      'circle-stroke-color': 'rgba(20, 21, 16, 0.85)'
    }
  });

  // 2. Lapis Industri / PLTU / Smelter / Migas (cincin sian baja agar langsung kontras dengan bara api)
  const indRadius = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4, ['interpolate', ['linear'], ['get', 'frp'], 0, 2.2, 100, 4.5],
    10, ['interpolate', ['linear'], ['get', 'frp'], 0, 5.0, 100, 10.5]
  ];
  const indGlowRadius = [
    'interpolate',
    ['linear'],
    ['zoom'],
    4, ['interpolate', ['linear'], ['get', 'frp'], 0, 4.5, 100, 9.5],
    10, ['interpolate', ['linear'], ['get', 'frp'], 0, 10.0, 100, 20.0]
  ];
  map.addLayer({
    id: 'hotspots-ind-glow',
    type: 'circle',
    source: 'hotspots',
    filter: ['==', ['get', 'kind'], 'industri'],
    paint: {
      'circle-radius': indGlowRadius,
      'circle-color': '#38bdf8',
      'circle-blur': 1,
      'circle-opacity': 0.24
    }
  });
  map.addLayer({
    id: 'hotspots-ind',
    type: 'circle',
    source: 'hotspots',
    filter: ['==', ['get', 'kind'], 'industri'],
    paint: {
      'circle-radius': indRadius,
      'circle-color': 'rgba(12, 34, 48, 0.9)',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 1.4, 10, 2.2],
      'circle-stroke-color': '#38bdf8'
    }
  });

  // 3. Lapis Gunung Api / Vulkanik (cincin magenta)
  map.addLayer({
    id: 'hotspots-volc',
    type: 'circle',
    source: 'hotspots',
    filter: ['==', ['get', 'kind'], 'vulkanik'],
    paint: {
      'circle-radius': indRadius,
      'circle-color': 'rgba(46, 16, 60, 0.9)',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 10, 2.4],
      'circle-stroke-color': '#e879f9'
    }
  });

  const interactiveLayers = ['hotspots', 'hotspots-ind', 'hotspots-volc'];
  for (const lid of interactiveLayers) {
    map.on('mouseenter', lid, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', lid, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  map.on('click', interactiveLayers, (e) => {
    const f = e.features[0];
    if (!f) return;
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const loc = locateIndonesia(lat, lon);

    const catLabel =
      p.kind === 'industri'
        ? `Dugaan sumber tetap · ${p.subType || 'termal'}`
        : p.kind === 'vulkanik'
          ? 'Dekat kawah gunung api'
          : p.peat
            ? 'Titik panas · zona gambut perkiraan'
            : 'Titik panas · sumber belum terverifikasi';

    const rows = [['Kategori', catLabel]];
    if (p.siteName) rows.push(['Katalog atau persistensi', p.siteName]);
    rows.push(
      ['Provinsi', loc.province],
      ['Waktu', formatZoneTime(p.ts, loc.tz)],
      ['Satelit', SAT[p.sat] || p.sat],
      ['FRP', `${Number(p.frp).toFixed(1)} MW`]
    );
    if (p.conf) rows.push(['Keyakinan', { l: 'rendah', n: 'nominal', h: 'tinggi' }[p.conf] || p.conf]);
    if (p.dn) rows.push(['Lintasan', p.dn === 'N' ? 'Malam' : 'Siang']);
    rows.push(['Koordinat', `${lat.toFixed(4)}, ${lon.toFixed(4)}`]);

    const el = detailList(rows);
    new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
      .setLngLat(f.geometry.coordinates)
      .setDOMContent(el)
      .addTo(map);
  });

  syncSourceVisibility();
}

setMode('live', false);
startSentinelMap(() => ({
  container: 'map',
  style: STYLE,
  bounds: isMobile() ? MOBILE_INITIAL_BOUNDS : REGIONS[0].bounds,
  fitBoundsOptions: { padding: getMapPadding(), maxZoom: 6 },
  maxBounds: INDONESIA_MAX_BOUNDS,
  maxPitch: 80,
  attributionControl: { compact: true, customAttribution: 'Hotspot: NASA FIRMS · DEM: AWS Terrain Tiles' }
}), (readyMap, library) => {
  map = readyMap;
  maplibregl = library;
  addMapLayers();
  for (const control of document.querySelectorAll('[data-map-control]')) control.disabled = false;
  if (state.mode === 'replay' && state.replay) {
    const [a, b, c, d] = state.replay.bbox;
    map.fitBounds([[a, b], [c, d]], { padding: getMapPadding(), duration: 0 });
  }
  render(true);
}, () => {
  map = undefined;
  $('map-note').hidden = false;
  for (const control of document.querySelectorAll('[data-map-control]')) control.disabled = true;
  setPanelOpen(true);
});
