export async function startSentinelMap(options, onReady, onUnavailable) {
  let map;
  let timer;
  let failed = false;
  function fallback() {
    if (failed) return;
    failed = true;
    clearTimeout(timer);
    onUnavailable();
    map?.remove();
  }

  try {
    const [{ default: maplibre }] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css')
    ]);
    map = new maplibre.Map(options());
    map.addControl(new maplibre.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibre.ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.getCanvas().addEventListener('webglcontextlost', fallback, { once: true });
    timer = setTimeout(fallback, 15_000);
    map.once('load', () => {
      if (failed) return;
      clearTimeout(timer);
      try {
        onReady(map, maplibre);
      } catch (error) {
        console.error('Lapisan peta tidak tersedia:', error);
        fallback();
      }
    });
  } catch (error) {
    console.warn('Peta tidak tersedia:', error);
    fallback();
  }
}
