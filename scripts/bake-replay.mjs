// Membuat data Replay statis dari arsip FIRMS (standard processing, SP).
// Jalankan sekali: FIRMS_MAP_KEY=... npm run bake:replay
// Kunci dibaca dari environment, tidak ditulis ke file mana pun.
import { writeFile, mkdir } from 'node:fs/promises';

const KEY = process.env.FIRMS_MAP_KEY;
if (!KEY) throw new Error('Set FIRMS_MAP_KEY di environment');

const REPLAY = {
  id: 'kalteng-2019',
  title: 'Kalimantan Tengah 2019',
  place: 'Pulang Pisau – Palangka Raya',
  bbox: [113.6, -3.4, 114.8, -2.2],
  start: '2019-09-01',
  days: 20,
  sources: ['VIIRS_SNPP_SP', 'VIIRS_NOAA20_SP']
};
const CHUNK_DAYS = 5; // batas API area FIRMS

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const t0 = Date.parse(`${REPLAY.start}T00:00:00Z`) / 1000;
const seen = new Set();
const points = [];
for (const source of REPLAY.sources) {
  for (let off = 0; off < REPLAY.days; off += CHUNK_DAYS) {
    const date = addDays(REPLAY.start, off);
    const n = Math.min(CHUNK_DAYS, REPLAY.days - off);
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${source}/${REPLAY.bbox.join(',')}/${n}/${date}`;
    const text = await (await fetch(url)).text();
    const lines = text.trim().split('\n');
    const h = lines[0].split(',');
    const ix = (c) => h.indexOf(c);
    if (ix('latitude') < 0) throw new Error(`${source} ${date}: ${lines[0].slice(0, 120)}`);
    for (const line of lines.slice(1)) {
      const f = line.split(',');
      const t = f[ix('acq_time')].padStart(4, '0');
      const ts = Date.parse(`${f[ix('acq_date')]}T${t.slice(0, 2)}:${t.slice(2)}:00Z`) / 1000;
      const lon = +(+f[ix('longitude')]).toFixed(4);
      const lat = +(+f[ix('latitude')]).toFixed(4);
      const key = `${f[ix('satellite')]}|${ts}|${lat}|${lon}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // [lon, lat, frp, menit sejak start, satelit]
      points.push([lon, lat, +(+f[ix('frp')]).toFixed(1), Math.round((ts - t0) / 60), f[ix('satellite')]]);
    }
    console.log(source, date, lines.length - 1);
  }
}
points.sort((a, b) => a[3] - b[3]);
await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
await writeFile(
  new URL(`../public/data/replay-${REPLAY.id}.json`, import.meta.url),
  JSON.stringify({ ...REPLAY, t0, source: 'NASA FIRMS VIIRS 375 m (SP archive)', points })
);
console.log('total', points.length);
