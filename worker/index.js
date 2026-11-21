// Worker publik fire.transbulent.id: aset statis, API hotspot (dengan edge cache & agregasi persistensi), dan ingest FIRMS terjadwal ke D1.
// MAP_KEY FIRMS hanya ada di secret FIRMS_MAP_KEY dan tidak pernah dikirim ke browser.

const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';
// Batas timur 141,02° = garis batas RI–PNG; lebih dari itu memasukkan titik PNG.
const INDONESIA_BBOX = '94,-11.5,141.02,6.5';
const SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT'];
// Rentang 1 hari FIRMS sering belum memuat lintasan terbaru; ambil 2 hari lalu buang duplikat lewat PRIMARY KEY.
const INGEST_DAYS = 2;
const RETAIN_SECONDS = 7 * 24 * 3600;
const STALE_SECONDS = 45 * 60;
const LOCK_SECONDS = 90;
const RETRY_COOLDOWN_SECONDS = 5 * 60;
const VALID_HOURS = [24, 48, 72, 168];
const PERSIST_CELL = 0.02;
const CACHE_VER = 2;
const ROWS_PER_INSERT = 12; // 8 kolom x 12 baris = 96 parameter, di bawah batas D1 (100)

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://s3.amazonaws.com https://server.arcgisonline.com",
  "connect-src 'self' https://tiles.openfreemap.org https://s3.amazonaws.com https://server.arcgisonline.com",
  "font-src 'self' https://tiles.openfreemap.org",
  "worker-src 'self' blob:",
  "child-src blob:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

function isForeignTerritory(lat, lon) {
  if (lon >= 98.2 && lon <= 104.7 && lat >= 1.22) {
    const malaccaLimitLon = 98.0 + ((5.8 - Math.min(lat, 5.8)) / 4.55) * 5.5;
    if (lon > malaccaLimitLon || (lat >= 1.22 && lon >= 103.5)) return true;
  }
  if (lat > 4.35 && lon >= 114.5 && lon <= 119.5) return true;
  if (lat >= 4.0 && lat <= 5.1 && lon >= 114.0 && lon <= 115.4) return true;
  if (lat > 1.25 && lon >= 109.5 && lon < 114.5) {
    const sarawakMinLat = 0.92 + (lon - 109.5) * 0.65;
    if (lat > sarawakMinLat) return true;
  }
  if (lat <= -8.18 && lat >= -9.55 && lon >= 125.05 && lon <= 127.38) {
    if (!(lat > -8.26 && lon > 125.72)) return true;
  }
  if (lat >= -9.50 && lat <= -9.15 && lon >= 124.10 && lon <= 124.50) return true;
  return false;
}

function securityHeaders(headers) {
  headers.set('Content-Security-Policy', CSP);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000');
  return headers;
}

function json(body, status = 200, cacheSeconds = 0) {
  const headers = securityHeaders(new Headers({ 'content-type': 'application/json; charset=utf-8' }));
  headers.set('Cache-Control', cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(JSON.stringify(body), { status, headers });
}

function snapHours(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 48;
  for (const bucket of VALID_HOURS) {
    if (n <= bucket) return bucket;
  }
  return VALID_HOURS[VALID_HOURS.length - 1];
}

function hotspotCacheRequest(hours) {
  return new Request(`https://cache.wildfire-watch.internal/api/hotspots?v=${CACHE_VER}&hours=${hours}`, { method: 'GET' });
}

// acq_date "YYYY-MM-DD" + acq_time "HHMM" (UTC, kadang tanpa nol depan) -> detik Unix
function acqTimestamp(date, time) {
  const t = String(time).padStart(4, '0');
  const ms = Date.parse(`${date}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function parseFirmsCsv(text, source) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const col = (name) => header.indexOf(name);
  const iLat = col('latitude'), iLon = col('longitude'), iFrp = col('frp'), iConf = col('confidence');
  const iDate = col('acq_date'), iTime = col('acq_time'), iSat = col('satellite'), iDn = col('daynight');
  if (iLat < 0 || iLon < 0 || iDate < 0 || iTime < 0) {
    throw new Error(`FIRMS ${source}: respons bukan CSV hotspot: ${lines[0].slice(0, 120)}`);
  }
  const rows = [];
  for (let n = 1; n < lines.length; n++) {
    const f = lines[n].split(',');
    const lat = Number(f[iLat]), lon = Number(f[iLon]);
    const ts = acqTimestamp(f[iDate], f[iTime]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || ts === null) continue;
    if (isForeignTerritory(lat, lon)) continue;
    const sat = (iSat >= 0 && f[iSat]) || source;
    rows.push({
      id: `${sat}|${ts}|${lat.toFixed(5)}|${lon.toFixed(5)}`,
      lat, lon,
      frp: Number(f[iFrp]) || 0,
      conf: iConf >= 0 ? f[iConf] : null,
      sat,
      daynight: iDn >= 0 ? f[iDn] : null,
      acq_ts: ts
    });
  }
  return rows;
}

async function readMetaJson(env, key) {
  const row = await env.DB.prepare('SELECT value FROM meta WHERE key=?').bind(key).first();
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

async function purgeHotspotCache() {
  const cache = caches.default;
  await Promise.allSettled(VALID_HOURS.map((h) => cache.delete(hotspotCacheRequest(h))));
}

async function ingest(env) {
  if (!env.FIRMS_MAP_KEY) throw new Error('Secret FIRMS_MAP_KEY belum diatur');
  const db = env.DB;
  const results = {};
  let total = 0;
  let okSources = 0;

  try {
    for (const source of SOURCES) {
      const url = `${FIRMS_BASE}/${env.FIRMS_MAP_KEY}/${source}/${INDONESIA_BBOX}/${INGEST_DAYS}`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = parseFirmsCsv(await res.text(), source);
        const stmts = [];
        for (let i = 0; i < rows.length; i += ROWS_PER_INSERT) {
          const chunk = rows.slice(i, i + ROWS_PER_INSERT);
          const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?)').join(',');
          const params = chunk.flatMap((r) => [r.id, r.lat, r.lon, r.frp, r.conf, r.sat, r.daynight, r.acq_ts]);
          stmts.push(
            db
              .prepare(`INSERT OR IGNORE INTO detections (id,lat,lon,frp,conf,sat,daynight,acq_ts) VALUES ${placeholders}`)
              .bind(...params)
          );
        }
        if (stmts.length) await db.batch(stmts);
        results[source] = rows.length;
        total += rows.length;
        okSources += 1;
      } catch (err) {
        results[source] = `gagal: ${err.message}`;
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const attemptPayload = { at: now, ok: okSources > 0, ok_sources: okSources, total, sources: results };
    const metaOps = [
      db
        .prepare("INSERT INTO meta (key,value) VALUES ('last_attempt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
        .bind(JSON.stringify(attemptPayload))
    ];

    if (okSources > 0) {
      metaOps.push(
        db.prepare('DELETE FROM detections WHERE acq_ts < ?').bind(now - RETAIN_SECONDS),
        db
          .prepare("INSERT INTO meta (key,value) VALUES ('last_ingest',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
          .bind(JSON.stringify({ at: now, total, ok_sources: okSources, sources: results }))
      );
    }

    await db.batch(metaOps);
    if (okSources > 0) await purgeHotspotCache();
    return attemptPayload;
  } finally {
    await db.prepare("DELETE FROM meta WHERE key='ingest_lock'").run().catch(() => {});
  }
}

async function maybeRefresh(env, ctx) {
  const [last, attempt] = await Promise.all([readMetaJson(env, 'last_ingest'), readMetaJson(env, 'last_attempt')]);
  const now = Math.floor(Date.now() / 1000);
  if (last && now - last.at < STALE_SECONDS) return { last, attempt };
  if (attempt && !attempt.ok && now - attempt.at < RETRY_COOLDOWN_SECONDS) return { last, attempt };

  const claim = await env.DB.prepare(
    "INSERT INTO meta (key,value) VALUES ('ingest_lock',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(meta.value AS INTEGER) < ?"
  )
    .bind(String(now), now - LOCK_SECONDS)
    .run();
  if (claim.meta.changes > 0) {
    ctx.waitUntil(ingest(env).catch((e) => console.error('ingest', e)));
  }
  return { last, attempt };
}

async function queryPersistentCells(env) {
  const res = await env.DB.prepare(
    `SELECT
       CAST(ROUND(lon / ?) AS INTEGER) AS cx,
       CAST(ROUND(lat / ?) AS INTEGER) AS cy,
       COUNT(*) AS n,
       COUNT(DISTINCT CAST(acq_ts / 86400 AS INTEGER)) AS days,
       COUNT(DISTINCT CAST(acq_ts / 1800 AS INTEGER)) AS passes,
       SUM(CASE WHEN daynight = 'N' THEN 1 ELSE 0 END) AS night_n,
       MAX(lat) - MIN(lat) AS dlat,
       MAX(lon) - MIN(lon) AS dlon
     FROM detections
     GROUP BY cx, cy
     HAVING days >= 2 AND passes >= 4`
  )
    .bind(PERSIST_CELL, PERSIST_CELL)
    .all();

  const out = [];
  for (const r of res.results || []) {
    const spanKm = Math.hypot(r.dlat || 0, r.dlon || 0) * 111.0;
    const nightPct = r.n > 0 ? Math.round((100 * (r.night_n || 0)) / r.n) : 0;
    if (spanKm <= 2.0 && nightPct >= 55) {
      out.push([r.cx, r.cy, r.days, r.passes, nightPct, Number(spanKm.toFixed(2))]);
    }
  }
  return out;
}

async function hotspots(url, env, ctx) {
  const hours = snapHours(url.searchParams.get('hours'));
  const cache = caches.default;
  const cacheKey = hotspotCacheRequest(hours);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  const [{ last, attempt }, detRes, persistentCells] = await Promise.all([
    maybeRefresh(env, ctx),
    env.DB.prepare(
      'SELECT lat,lon,frp,conf,sat,daynight,acq_ts FROM detections WHERE acq_ts >= ? ORDER BY acq_ts'
    )
      .bind(since)
      .all(),
    queryPersistentCells(env).catch(() => [])
  ]);

  const points = [];
  for (const r of detRes.results || []) {
    if (isForeignTerritory(r.lat, r.lon)) continue;
    points.push([r.lon, r.lat, r.frp, r.acq_ts, r.sat, r.conf, r.daynight]);
  }

  const resp = json(
    {
      generated_at: Math.floor(Date.now() / 1000),
      last_ingest: last,
      last_attempt: attempt,
      hours,
      persistent_cells: persistentCells,
      // [lon, lat, frp, acq_ts, sat, conf, daynight]
      points
    },
    200,
    300
  );
  ctx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.protocol === 'http:') {
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    try {
      if (url.pathname === '/api/hotspots') return await hotspots(url, env, ctx);
      if (url.pathname === '/api/status') {
        const [count, last, attempt] = await Promise.all([
          env.DB.prepare('SELECT COUNT(*) AS n FROM detections').first(),
          readMetaJson(env, 'last_ingest'),
          readMetaJson(env, 'last_attempt')
        ]);
        return json({ last_ingest: last, last_attempt: attempt, stored: count.n }, 200, 60);
      }
      if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: 'server error' }, 500);
    }
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    securityHeaders(out.headers);
    return out;
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(ingest(env));
  }
};
