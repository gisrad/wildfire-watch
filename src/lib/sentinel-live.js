const TIMEOUT_MS = 12_000;

export function createLiveFeed({ endpoint, recordsKey, onView }) {
  const snapshots = new Map();
  let pending;

  function cancel() {
    const old = pending;
    pending = undefined;
    old?.abort();
  }

  async function load(hours, { background = false } = {}) {
    if (background && pending) return;
    cancel();
    const controller = new AbortController();
    pending = controller;
    const previous = snapshots.get(hours);
    const isCurrent = () => pending === controller;
    if (!background || !previous) onView({ phase: 'loading', hours, data: previous });
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let view;
    try {
      // Read the Worker snapshot, not a legacy or stale browser-cached API body.
      const res = await fetch(`${endpoint}?hours=${hours}`, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.hours !== hours || !Array.isArray(data[recordsKey]) ||
          !['ready', 'partial', 'stale', 'unavailable'].includes(data.health?.state)) {
        throw new Error('Invalid snapshot');
      }
      if (!isCurrent()) return;
      if (data.health.state === 'unavailable') {
        view = { phase: 'unavailable', hours, data: previous, health: data.health };
      } else {
        // An empty stale response cannot overwrite a non-empty snapshot for the same range.
        const keepPrevious = data.health.state === 'stale' && previous &&
          Number(previous.health.last_good_at) >= Number(data.health.last_good_at);
        if (!keepPrevious) snapshots.set(hours, data);
        view = { phase: data.health.state, hours, data: keepPrevious ? previous : data, health: data.health };
        if (view.phase === 'ready' && data[recordsKey].length === 0) view.phase = 'empty';
      }
    } catch {
      if (isCurrent()) view = { phase: 'unavailable', hours, data: previous };
    } finally {
      clearTimeout(timeout);
      if (isCurrent()) pending = undefined;
    }
    if (view) onView(view);
  }

  return { load, cancel };
}

export function describeLive({ phase, hours, data, health }, formatTime, observation) {
  const range = hours >= 72 && hours % 24 === 0 ? `${hours / 24} hari` : `${hours} jam`;
  const stamp = health?.checked_at ? ` · Pemeriksaan ${formatTime(health.checked_at)}` : '';
  const missing = Object.entries(health?.sources || {})
    .filter(([, status]) => status === 'unavailable')
    .map(([source]) => source.startsWith('BMKG_') ? 'feed BMKG' : source.replace(/^VIIRS_(NOAA)(\d+)_NRT$/, '$1-$2'));
  const degraded = missing.length ? ` · ${[...new Set(missing)].join(', ')} tidak tersedia` : '';
  const info = observation ? ` · ${observation}` : '';
  const snapshot = data?.health?.last_good_at ? ` · Salinan ${formatTime(data.health.last_good_at)}` : '';
  if (phase === 'loading') return `Memuat data ${range}…${snapshot}`;
  if (phase === 'unavailable') return data
    ? `Gagal memperbarui ${range}${snapshot}${info}`
    : `Data ${range} belum tersedia${stamp}. Coba lagi atau lihat sumber resmi.`;
  if (phase === 'stale') return `Data ${range} ${health?.last_check_failed ? 'gagal diperbarui' : 'tertinggal'}${snapshot}${stamp}${info}`;
  if (phase === 'partial') return `Data ${range} parsial${degraded}${stamp}${info}`;
  if (phase === 'empty') return `Tidak ada catatan pada data ${range} yang tersedia${stamp}`;
  return `Data ${range}${stamp}${info}`;
}

export function showSentinelDetail(content) {
  const dialog = document.getElementById('event-detail');
  dialog.querySelector('[data-detail]').replaceChildren(content);
  if (!dialog.open) dialog.showModal();
}
