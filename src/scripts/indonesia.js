// Modul geospasial ringan Indonesia: preset kamera kepulauan, 38 provinsi, zona waktu, & koridor gambut.

export const REGIONS = [
  { id: 'nusantara', label: 'Nusantara', bounds: [[94.8, -11.2], [141.1, 6.2]] },
  { id: 'sumatera', label: 'Sumatera', bounds: [[95.0, -6.2], [106.8, 5.9]] },
  { id: 'kalimantan', label: 'Kalimantan', bounds: [[108.5, -4.4], [119.2, 4.5]] },
  { id: 'jawa_nusa', label: 'Jawa · Nusa', bounds: [[105.0, -11.0], [125.3, -5.5]] },
  { id: 'sulawesi', label: 'Sulawesi', bounds: [[118.4, -6.0], [125.6, 2.0]] },
  { id: 'maluku_papua', label: 'Maluku · Papua', bounds: [[125.5, -9.2], [141.1, 2.8]] }
];

// Ponsel portrait: fokus rapat koridor utama agar pulau Indonesia tampak besar di atas panel bawah.
export const MOBILE_INITIAL_BOUNDS = [[95.0, -9.0], [126.0, 5.8]];
export const INDONESIA_MAX_BOUNDS = [[60.0, -48.0], [165.0, 42.0]];

// [minLon, minLat, maxLon, maxLat, centerLon, centerLat, name, island, tz]
const PROVINCES = [
  [94.9, 1.9, 98.3, 6.1, 96.7, 4.4, 'Aceh', 'Sumatera', 'WIB'],
  [97.0, 0.4, 100.5, 4.3, 99.0, 2.2, 'Sumatera Utara', 'Sumatera', 'WIB'],
  [98.5, -3.5, 101.9, 0.9, 100.4, -0.9, 'Sumatera Barat', 'Sumatera', 'WIB'],
  [100.0, -1.1, 103.8, 2.6, 101.8, 0.6, 'Riau', 'Sumatera', 'WIB'],
  [103.2, -0.9, 109.2, 4.9, 104.5, 1.0, 'Kepulauan Riau', 'Sumatera', 'WIB'],
  [101.1, -2.8, 104.5, -0.7, 102.8, -1.6, 'Jambi', 'Sumatera', 'WIB'],
  [101.0, -5.6, 103.8, -2.3, 102.3, -3.7, 'Bengkulu', 'Sumatera', 'WIB'],
  [102.0, -4.9, 106.2, -1.6, 104.2, -3.2, 'Sumatera Selatan', 'Sumatera', 'WIB'],
  [105.0, -3.4, 108.9, -1.5, 106.8, -2.5, 'Kep. Bangka Belitung', 'Sumatera', 'WIB'],
  [103.5, -6.2, 105.9, -3.7, 105.0, -4.9, 'Lampung', 'Sumatera', 'WIB'],

  [105.0, -7.1, 106.5, -5.8, 106.1, -6.4, 'Banten', 'Jawa', 'WIB'],
  [106.6, -6.4, 107.0, -5.2, 106.8, -6.2, 'DKI Jakarta', 'Jawa', 'WIB'],
  [106.3, -7.8, 108.9, -5.9, 107.6, -6.9, 'Jawa Barat', 'Jawa', 'WIB'],
  [108.5, -8.2, 111.7, -5.7, 110.2, -7.2, 'Jawa Tengah', 'Jawa', 'WIB'],
  [110.0, -8.2, 110.9, -7.5, 110.4, -7.9, 'DI Yogyakarta', 'Jawa', 'WIB'],
  [110.9, -8.8, 116.3, -5.0, 112.7, -7.6, 'Jawa Timur', 'Jawa', 'WIB'],

  [108.6, -3.1, 114.2, 2.1, 111.1, -0.2, 'Kalimantan Barat', 'Kalimantan', 'WIB'],
  [110.7, -3.6, 115.9, 0.8, 113.4, -1.7, 'Kalimantan Tengah', 'Kalimantan', 'WIB'],
  [114.3, -4.2, 116.6, -1.3, 115.4, -3.0, 'Kalimantan Selatan', 'Kalimantan', 'WITA'],
  [113.8, -2.5, 119.0, 2.6, 116.5, 0.5, 'Kalimantan Timur', 'Kalimantan', 'WITA'],
  [114.6, 1.1, 118.0, 4.4, 116.6, 3.0, 'Kalimantan Utara', 'Kalimantan', 'WITA'],

  [114.4, -8.9, 115.8, -8.0, 115.1, -8.4, 'Bali', 'Bali · Nusa', 'WITA'],
  [115.8, -9.1, 119.3, -8.1, 117.4, -8.6, 'Nusa Tenggara Barat', 'Bali · Nusa', 'WITA'],
  [118.9, -11.1, 125.2, -8.0, 121.8, -9.5, 'Nusa Tenggara Timur', 'Bali · Nusa', 'WITA'],

  [118.7, -3.6, 119.9, -0.8, 119.2, -2.4, 'Sulawesi Barat', 'Sulawesi', 'WITA'],
  [118.7, -7.5, 121.9, -1.9, 119.9, -4.2, 'Sulawesi Selatan', 'Sulawesi', 'WITA'],
  [120.8, -6.2, 124.7, -2.8, 122.2, -4.3, 'Sulawesi Tenggara', 'Sulawesi', 'WITA'],
  [119.4, -3.6, 124.2, 1.4, 121.4, -1.1, 'Sulawesi Tengah', 'Sulawesi', 'WITA'],
  [121.1, 0.3, 123.5, 1.1, 122.5, 0.7, 'Gorontalo', 'Sulawesi', 'WITA'],
  [123.1, 0.3, 127.2, 5.6, 124.8, 1.3, 'Sulawesi Utara', 'Sulawesi', 'WITA'],

  [125.7, -8.4, 135.0, -2.7, 129.5, -3.6, 'Maluku', 'Maluku · Papua', 'WIT'],
  [124.3, -2.5, 129.8, 2.7, 127.7, 0.8, 'Maluku Utara', 'Maluku · Papua', 'WIT'],
  [129.3, -2.3, 133.2, 0.2, 131.6, -1.0, 'Papua Barat Daya', 'Maluku · Papua', 'WIT'],
  [132.0, -4.3, 134.9, -0.7, 133.5, -2.3, 'Papua Barat', 'Maluku · Papua', 'WIT'],
  [134.6, -5.0, 138.0, -2.5, 136.3, -3.8, 'Papua Tengah', 'Maluku · Papua', 'WIT'],
  [135.5, -3.6, 141.02, -1.0, 139.2, -2.5, 'Papua', 'Maluku · Papua', 'WIT'],
  [137.4, -5.3, 141.02, -3.0, 139.3, -4.1, 'Papua Pegunungan', 'Maluku · Papua', 'WIT'],
  [137.5, -9.2, 141.02, -5.0, 139.7, -7.2, 'Papua Selatan', 'Maluku · Papua', 'WIT']
];

// Koridor hidrologis gambut utama Indonesia (indikatif berbasis batas KHG mayor; perlu verifikasi poligon KLHK/BRGM di fase lanjut).
const PEAT_CORRIDORS = [
  [100.3, -0.5, 103.7, 2.3],   // Pesisir Riau (Siak, Kampar, Bengkalis, Inhil)
  [103.1, -1.8, 104.5, -0.8],  // Jambi (Tanjabbar, Tanjabtim, Muaro Jambi)
  [104.0, -3.9, 106.0, -1.9],  // Sumsel (OKI, Banyuasin, Muba)
  [108.9, -2.9, 111.5, 1.5],   // Kalbar (Kubu Raya, Ketapang, Sambas, Kayong)
  [111.3, -3.5, 114.9, -1.5],  // Kalteng (Kotim, Katingan, Pulang Pisau, Kapuas)
  [114.5, -3.5, 115.4, -2.1],  // Kalsel (Gambut / Hulu Sungai)
  [137.6, -8.7, 140.4, -5.3]   // Papua Selatan (Mappi, Asmat, Merauke utara)
];

const TZ_FMT = {
  WIB: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }),
  WITA: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  }),
  WIT: new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jayapura', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
};

export function locateIndonesia(lat, lon) {
  let best = null;
  let bestDist = Infinity;
  for (const p of PROVINCES) {
    if (lon >= p[0] && lon <= p[2] && lat >= p[1] && lat <= p[3]) {
      const d = (lon - p[4]) ** 2 + (lat - p[5]) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
  }
  if (!best) {
    for (const p of PROVINCES) {
      const d = (lon - p[4]) ** 2 + (lat - p[5]) ** 2;
      if (d < bestDist && d <= 6.25) {
        bestDist = d;
        best = p;
      }
    }
  }
  if (!best) return { province: 'Perairan / Sekitar Indonesia', island: 'Indonesia', tz: 'WIB' };
  return { province: best[6], island: best[7], tz: best[8] };
}

export function isPeatCorridor(lat, lon) {
  for (const b of PEAT_CORRIDORS) {
    if (lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]) return true;
  }
  return false;
}

export function formatZoneTime(unixSec, tz = 'WIB') {
  const fmt = TZ_FMT[tz] || TZ_FMT.WIB;
  return `${fmt.format(new Date(unixSec * 1000))} ${tz}`;
}
