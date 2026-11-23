// Longer than the Workers Cron wall-time limit. A concurrent runner can only own a new lease after expiry.
const LEASE_SECONDS = 20 * 60;
const LEASE_KEY = 'scheduled_ingest_lease';

export async function withIngestLease(db, task) {
  const now = Math.floor(Date.now() / 1000);
  const lease = `${now + LEASE_SECONDS}:${crypto.randomUUID()}`;
  const claim = await db.prepare(
    'INSERT INTO meta (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value WHERE CAST(meta.value AS INTEGER) <= ?'
  ).bind(LEASE_KEY, lease, now).run();
  if (!claim.meta.changes) return;

  try {
    await task();
  } finally {
    await db.prepare('DELETE FROM meta WHERE key=? AND value=?').bind(LEASE_KEY, lease).run();
  }
}

export const sourceFailure = (error) => error?.name === 'TimeoutError' ? 'timeout' : 'upstream_error';

export async function recordIngestFailure(db, code) {
  const attempt = { at: Math.floor(Date.now() / 1000), ok: false, code, ok_sources: 0, sources: {} };
  await db.prepare("INSERT INTO meta (key,value) VALUES ('last_attempt',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(JSON.stringify(attempt)).run();
}

export function describeIngest(last, attempt, feeds, staleSeconds, now) {
  const sourceStates = {};
  const check = attempt && (!last || attempt.at >= last.at) ? attempt : last;
  for (const source of feeds) {
    const n = check?.sources?.[source];
    sourceStates[source] = Number.isFinite(n) ? (n > 0 ? 'ok' : 'empty') : 'unavailable';
  }
  let state = 'ready';
  if (!last) state = 'unavailable';
  else if (now - last.at >= staleSeconds || check?.ok === false) state = 'stale';
  else if (Object.values(sourceStates).includes('unavailable')) state = 'partial';
  return { state, checked_at: check?.at ?? null, last_good_at: last?.at ?? null,
    last_check_failed: check?.ok === false, sources: sourceStates };
}

// Old D1 metadata may contain raw upstream error responses. Publish only known fields/codes.
export function publicRun(run, feeds) {
  if (!run) return null;
  const { at, ok, total, written, deleted, code } = run;
  const sources = {};
  let ok_sources = 0;
  for (const feed of feeds) {
    const value = run.sources?.[feed];
    if (Number.isFinite(value)) {
      sources[feed] = value;
      ok_sources += 1;
    } else if (value !== undefined) sources[feed] = value === 'timeout' ? value : 'upstream_error';
  }
  return { at, ok, ok_sources, total, written, deleted,
    code: code === 'config_missing' || code === 'ingest_error' ? code : undefined, sources };
}
