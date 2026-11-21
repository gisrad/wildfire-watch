// Katalog fasilitas termal tetap Indonesia (PLTU, smelter, migas, semen/pulp, tambang, gunung api)
// serta saringan wilayah batas negara tetangga agar angka Indonesia bersih.

export const PERSIST_CELL = 0.02; // ~2,2 km (harus identik dengan agregasi D1 di Worker)

// Saring titik di luar wilayah Indonesia yang masuk dalam kotak persegi bounding box (Malaysia, Singapura, Brunei, Timor-Leste).
export function isForeignTerritory(lat, lon) {
  // Semenanjung Malaysia & Singapura (garis batas Selat Malaka dari Aceh/Medan hingga Johor/Singapura; tetap menjaga Batam & Bintan <= 1.21°N)
  if (lon >= 98.2 && lon <= 104.7 && lat >= 1.22) {
    const malaccaLimitLon = 98.0 + ((5.8 - Math.min(lat, 5.8)) / 4.55) * 5.5;
    if (lon > malaccaLimitLon || (lat >= 1.22 && lon >= 103.5)) return true;
  }
  // Sabah & Labuan (batas utara Kalimantan Indonesia <= 4.28°N; tetap menjaga Sebatik/Nunukan & Miangas)
  if (lat > 4.35 && lon >= 114.5 && lon <= 119.5) return true;
  // Brunei Darussalam
  if (lat >= 4.0 && lat <= 5.1 && lon >= 114.0 && lon <= 115.4) return true;
  // Sarawak bagian barat–utara (tetap menjaga Sambas, Natuna, & Kapuas Hulu)
  if (lat > 1.25 && lon >= 109.5 && lon < 114.5) {
    const sarawakMinLat = 0.92 + (lon - 109.5) * 0.65;
    if (lat > sarawakMinLat) return true;
  }
  // Timor-Leste (daratan utama & Atauro; tetap menjaga Pulau Wetar & Kisar >= 125.75°E di utara -8.25°S)
  if (lat <= -8.18 && lat >= -9.55 && lon >= 125.05 && lon <= 127.38) {
    if (!(lat > -8.26 && lon > 125.72)) return true;
  }
  // Eksklave Oecusse (Timor-Leste)
  if (lat >= -9.50 && lat <= -9.15 && lon >= 124.10 && lon <= 124.50) return true;
  return false;
}

// [id, namaFasilitas, subTipe, kategori ('industri'|'vulkanik'), lat, lon, radiusKm]
const RAW_SITES = [
  // Smelter & Kawasan Industri Logam + PLTU Captive
  ['pt-vale-sorowako', 'Smelter PT Vale Sorowako', 'Smelter · PLTU', 'industri', -2.576, 121.382, 4.0],
  ['iwip-weda-bay', 'Kawasan Industri IWIP Weda Bay', 'Smelter · PLTU', 'industri', 0.485, 127.990, 4.5],
  ['imip-morowali', 'Kawasan Industri IMIP Morowali', 'Smelter · PLTU', 'industri', -2.838, 122.155, 5.5],
  ['vdni-oss-morosi', 'Smelter VDNI & OSS Morosi', 'Smelter · PLTU', 'industri', -3.882, 122.410, 4.2],
  ['harita-obi', 'Smelter Harita Nickel (Pulau Obi)', 'Smelter · PLTU', 'industri', -1.457, 127.436, 4.0],
  ['gni-morowali-utara', 'Smelter PT GNI Morowali Utara', 'Smelter · PLTU', 'industri', -2.015, 121.485, 4.0],
  ['pomalaa-antam', 'Smelter Feronikel Pomalaa', 'Smelter · PLTU', 'industri', -4.170, 121.615, 3.8],
  ['bantaeng-huadi', 'Kawasan Smelter Bantaeng', 'Smelter · PLTU', 'industri', -5.545, 120.045, 3.5],
  ['whw-ketapang', 'Smelter Alumina WHW Ketapang', 'Smelter · PLTU', 'industri', -2.355, 110.175, 3.5],
  ['bai-bintan', 'Smelter Alumina BAI Galang Batang', 'Smelter · PLTU', 'industri', 1.015, 104.620, 3.5],
  ['inalum-kuala-tanjung', 'Smelter Aluminium Inalum', 'Smelter · PLTU', 'industri', 3.358, 99.458, 3.5],
  ['freeport-gresik', 'Smelter Manyar & Petrokimia Gresik', 'Smelter · Kimia', 'industri', -7.125, 112.630, 4.8],
  ['amman-ntb', 'Smelter Batu Hijau (Sumbawa Barat)', 'Smelter · PLTU', 'industri', -8.985, 116.775, 3.5],
  ['krakatau-cilegon', 'Kawasan Baja Krakatau & Cilegon', 'Smelter · PLTU', 'industri', -5.975, 106.005, 5.0],

  // PLTU Batubara / Gas Utama
  ['pltu-suralaya-merak', 'PLTU Suralaya & Industri Merak', 'PLTU', 'industri', -5.890, 106.030, 3.5],
  ['pltu-banten-labuan', 'PLTU Banten 2 Labuan', 'PLTU', 'industri', -6.345, 105.825, 3.0],
  ['pltu-lontar', 'PLTU Lontar Tangerang', 'PLTU', 'industri', -6.048, 106.452, 3.0],
  ['pltu-pelabuhan-ratu', 'PLTU Pelabuhan Ratu', 'PLTU', 'industri', -7.022, 106.544, 3.0],
  ['pltu-indramayu', 'PLTU Indramayu Sumuradem', 'PLTU', 'industri', -6.275, 107.972, 3.2],
  ['pltu-cirebon', 'PLTU Cirebon Kanci', 'PLTU', 'industri', -6.772, 108.610, 3.2],
  ['pltu-batang', 'PLTU Batang (Bhimasena)', 'PLTU', 'industri', -6.912, 109.825, 3.5],
  ['pltu-tanjung-jati', 'PLTU Tanjung Jati B Jepara', 'PLTU', 'industri', -6.445, 110.745, 3.5],
  ['pltu-rembang', 'PLTU Rembang Sluke', 'PLTU', 'industri', -6.642, 111.468, 3.0],
  ['pltu-paiton', 'Kompleks PLTU Paiton', 'PLTU', 'industri', -7.716, 113.583, 4.0],
  ['pltu-pacitan', 'PLTU Pacitan Sudimoro', 'PLTU', 'industri', -8.258, 111.375, 3.0],
  ['pltu-cilacap', 'PLTU Adipala & Kilang Cilacap', 'PLTU · Kilang', 'industri', -7.690, 109.045, 7.5],
  ['pltu-pangkalan-susu', 'PLTU Pangkalan Susu', 'PLTU', 'industri', 4.115, 98.248, 3.0],
  ['pltu-nagan-raya', 'PLTU Nagan Raya', 'PLTU', 'industri', 4.088, 96.245, 3.0],
  ['pltu-tarahan', 'PLTU Tarahan Lampung', 'PLTU', 'industri', -5.535, 105.335, 3.2],
  ['pltu-tanjung-enim', 'PLTU Sumsel-8 & Tambang Bukit Asam', 'PLTU · Tambang', 'industri', -3.727, 103.717, 4.8],
  ['pltu-bengkulu', 'PLTU Bengkulu Teluk Sepang', 'PLTU', 'industri', -3.918, 102.312, 3.0],
  ['pltu-asam-asam', 'PLTU Asam-Asam', 'PLTU', 'industri', -3.890, 115.095, 3.5],
  ['pltu-pulang-pisau', 'PLTU Pulang Pisau', 'PLTU', 'industri', -2.860, 114.230, 3.0],
  ['pltu-kaltim-teluk', 'PLTU Kaltim Teluk (Balikpapan)', 'PLTU', 'industri', -1.195, 116.775, 3.0],
  ['pltu-punagaya', 'PLTU Punagaya & Takalar', 'PLTU', 'industri', -5.630, 119.535, 3.5],
  ['pltu-barru', 'PLTU Barru', 'PLTU', 'industri', -4.298, 119.622, 3.0],
  ['pltu-kendari-nii', 'PLTU Nii Tanasa Kendari', 'PLTU', 'industri', -3.902, 122.635, 3.0],
  ['pltu-celukan-bawang', 'PLTU Celukan Bawang Bali', 'PLTU', 'industri', -8.192, 114.838, 3.0],
  ['pltu-bolok-kupang', 'PLTU Bolok Kupang', 'PLTU', 'industri', -10.215, 123.515, 3.0],

  // Migas, Kilang, LNG, Suar (Flare), & Tambang Batubara Termal
  ['cepu-banyu-urip', 'Suar Migas Banyu Urip (Blok Cepu)', 'Migas · Suar', 'industri', -7.240, 111.733, 4.0],
  ['donggi-senoro-lng', 'Kilang LNG Donggi-Senoro', 'Migas · LNG', 'industri', -1.383, 122.481, 3.5],
  ['kilang-balikpapan', 'Kilang Minyak RU V Balikpapan', 'Migas · Kilang', 'industri', -1.242, 116.822, 4.0],
  ['bontang-lng-pkt', 'Badak LNG & Pupuk Kaltim Bontang', 'Migas · Kimia', 'industri', 0.132, 117.475, 4.8],
  ['sanga-sanga-migas', 'Lapangan Migas Sanga-Sanga', 'Migas · Suar', 'industri', -0.734, 117.039, 4.2],
  ['muara-badak-migas', 'Terminal Migas Muara Badak', 'Migas · Suar', 'industri', -0.241, 117.329, 3.5],
  ['tangguh-lng', 'Kilang LNG Tangguh (Teluk Bintuni)', 'Migas · LNG', 'industri', -2.448, 133.142, 4.0],
  ['kilang-dumai', 'Kilang Minyak RU II Dumai', 'Migas · Kilang', 'industri', 1.675, 101.472, 3.8],
  ['duri-minas-migas', 'Lapangan Minyak Duri & Minas', 'Migas · Suar', 'industri', 1.252, 101.215, 4.5],
  ['kilang-plaju', 'Kilang RU III Plaju & Sungai Gerong', 'Migas · Kilang', 'industri', -2.990, 104.825, 3.8],
  ['kilang-balongan', 'Kilang Minyak RU VI Balongan', 'Migas · Kilang', 'industri', -6.342, 108.390, 3.5],
  ['kilang-tuban-tppi', 'Kilang TPPI Tuban', 'Migas · Kilang', 'industri', -6.775, 111.905, 3.5],
  ['arun-lhokseumawe', 'Kawasan Energi Arun / PIM', 'Migas · Kimia', 'industri', 5.218, 97.072, 3.5],
  ['grissik-muba', 'Stasiun Gas Grissik (Muba)', 'Migas · Suar', 'industri', -2.415, 103.855, 3.5],
  ['kpc-sangatta', 'Tambang & PLTU KPC Sangatta', 'Tambang · PLTU', 'industri', 0.680, 117.555, 5.2],
  ['tambang-kubar', 'Area Tambang Melak (Kutai Barat)', 'Tambang · Termal', 'industri', -0.155, 116.110, 4.2],
  ['adaro-tanjung', 'Tambang & PLTU Tanjung Tabalong', 'Tambang · PLTU', 'industri', -2.200, 115.535, 5.5],
  ['berau-coal', 'Area Tambang Lati (Berau)', 'Tambang · PLTU', 'industri', 2.240, 117.480, 4.5],

  // Semen, Pulp/Kertas, & Kawasan Industri Berat
  ['semen-conch-tabalong', 'Pabrik Semen Conch & PLTU Tabalong', 'Semen · PLTU', 'industri', -1.915, 115.860, 4.8],
  ['semen-tuban', 'Pabrik Semen Indonesia Tuban', 'Semen · Kiln', 'industri', -6.762, 111.961, 4.0],
  ['semen-rembang', 'Pabrik Semen Rembang', 'Semen · Kiln', 'industri', -6.860, 111.495, 3.2],
  ['indocement-citeureup', 'Kompleks Semen Citeureup', 'Semen · Kiln', 'industri', -6.475, 106.885, 3.5],
  ['semen-palimanan', 'Pabrik Semen Palimanan Cirebon', 'Semen · Kiln', 'industri', -6.712, 108.402, 3.0],
  ['semen-baturaja', 'Pabrik Semen Baturaja', 'Semen · Kiln', 'industri', -4.115, 104.190, 3.0],
  ['semen-padang', 'Pabrik Semen Padang Indarung', 'Semen · Kiln', 'industri', -0.953, 100.470, 3.0],
  ['semen-tonasa', 'Pabrik Semen Tonasa Pangkep', 'Semen · Kiln', 'industri', -4.782, 119.615, 3.5],
  ['semen-bosowa', 'Pabrik Semen Bosowa Maros', 'Semen · Kiln', 'industri', -4.962, 119.638, 3.0],
  ['rapp-kerinci', 'Pulp & Kertas RAPP Pangkalan Kerinci', 'Pulp · PLTU', 'industri', 0.442, 101.893, 3.5],
  ['ikpp-perawang', 'Pulp & Kertas Indah Kiat Perawang', 'Pulp · PLTU', 'industri', 0.675, 101.605, 3.8],
  ['oki-pulp-baung', 'Pulp & Kertas OKI Sungai Baung', 'Pulp · PLTU', 'industri', -3.542, 104.321, 4.0],
  ['lontar-papyrus-jambi', 'Pulp Lontar Papyrus Tebing Tinggi', 'Pulp · PLTU', 'industri', -1.032, 103.005, 3.5],
  ['tel-tanjung-enim', 'Pulp PT TeL Tanjung Enim', 'Pulp · PLTU', 'industri', -3.562, 103.938, 3.5],
  ['kik-kendal', 'Kawasan Industri Kendal (KIK)', 'Kawasan Industri', 'industri', -6.879, 110.095, 3.8],
  ['kitb-batang', 'Kawasan Industri Terpadu Batang', 'Kawasan Industri', 'industri', -6.968, 109.968, 3.5],
  ['kiic-karawang', 'Kawasan Industri Karawang–Bekasi', 'Kawasan Industri', 'industri', -6.375, 107.285, 5.5],

  // Gunung Api Aktif PVMBG (anomali termal kawah / kubah lava)
  ['v-krakatau', 'Gunung Anak Krakatau', 'Gunung Api', 'vulkanik', -6.102, 105.423, 3.5],
  ['v-merapi', 'Gunung Merapi', 'Gunung Api', 'vulkanik', -7.541, 110.446, 3.0],
  ['v-semeru', 'Gunung Semeru', 'Gunung Api', 'vulkanik', -8.108, 112.922, 3.5],
  ['v-bromo', 'Gunung Bromo', 'Gunung Api', 'vulkanik', -7.942, 112.953, 2.5],
  ['v-raung', 'Gunung Raung', 'Gunung Api', 'vulkanik', -8.125, 114.042, 3.0],
  ['v-ijen', 'Kawah Gunung Ijen', 'Gunung Api', 'vulkanik', -8.058, 114.242, 2.5],
  ['v-agung', 'Gunung Agung', 'Gunung Api', 'vulkanik', -8.343, 115.508, 2.5],
  ['v-rinjani', 'Gunung Rinjani', 'Gunung Api', 'vulkanik', -8.411, 116.457, 3.0],
  ['v-tambora', 'Gunung Tambora', 'Gunung Api', 'vulkanik', -8.248, 117.991, 3.0],
  ['v-sangeang', 'Gunung Sangeang Api', 'Gunung Api', 'vulkanik', -8.197, 119.069, 3.0],
  ['v-ebulobo', 'Gunung Ebulobo Flores', 'Gunung Api', 'vulkanik', -8.808, 121.180, 2.5],
  ['v-lewotobi', 'Gunung Lewotobi Laki-Laki', 'Gunung Api', 'vulkanik', -8.542, 122.775, 3.5],
  ['v-ile-lewotolok', 'Gunung Ile Lewotolok', 'Gunung Api', 'vulkanik', -8.272, 123.505, 3.5],
  ['v-sirung', 'Gunung Sirung Pantar', 'Gunung Api', 'vulkanik', -8.508, 124.132, 2.5],
  ['v-awu', 'Gunung Awu Sangihe', 'Gunung Api', 'vulkanik', 3.682, 125.448, 2.5],
  ['v-karangetang', 'Gunung Karangetang Siau', 'Gunung Api', 'vulkanik', 2.781, 125.407, 3.0],
  ['v-ruang', 'Gunung Ruang Tagulandang', 'Gunung Api', 'vulkanik', 2.303, 125.370, 3.0],
  ['v-soputan', 'Gunung Soputan Minahasa', 'Gunung Api', 'vulkanik', 1.108, 124.737, 2.5],
  ['v-lokon', 'Gunung Lokon Tomohon', 'Gunung Api', 'vulkanik', 1.358, 124.792, 2.5],
  ['v-ibu', 'Gunung Ibu Halmahera', 'Gunung Api', 'vulkanik', 1.488, 127.630, 3.0],
  ['v-dukono', 'Gunung Dukono Halmahera', 'Gunung Api', 'vulkanik', 1.693, 127.894, 3.0],
  ['v-gamalama', 'Gunung Gamalama Ternate', 'Gunung Api', 'vulkanik', 0.808, 127.333, 2.5],
  ['v-sinabung', 'Gunung Sinabung', 'Gunung Api', 'vulkanik', 3.170, 98.392, 3.0],
  ['v-marapi', 'Gunung Marapi Sumbar', 'Gunung Api', 'vulkanik', -0.381, 100.473, 3.0],
  ['v-kerinci', 'Gunung Kerinci', 'Gunung Api', 'vulkanik', -1.697, 101.264, 3.0],
  ['v-dempo', 'Gunung Dempo', 'Gunung Api', 'vulkanik', -4.030, 103.130, 2.5]
];

export const THERMAL_SITES = RAW_SITES.map(([id, name, subType, kind, lat, lon, radiusKm]) => ({
  id,
  name,
  subType,
  kind,
  lat,
  lon,
  radiusKm
}));

export function buildPersistMap(cells) {
  const m = new Map();
  if (!Array.isArray(cells)) return m;
  for (const row of cells) {
    const [cx, cy, days, passes, nightPct, spanKm] = row;
    m.set(`${cx},${cy}`, { cx, cy, days, passes, nightPct, spanKm });
  }
  return m;
}

function approxDistKm(lat1, lon1, lat2, lon2) {
  const dy = (lat1 - lat2) * 111.0;
  const dx = (lon1 - lon2) * 111.0 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

export function classifyThermalPoint(lat, lon, persistMap, isPeat = false) {
  // Lapis 1: Katalog fasilitas industri / PLTU / migas / gunung api terverifikasi
  let best = null;
  let bestDist = Infinity;
  for (const site of THERMAL_SITES) {
    if (Math.abs(lat - site.lat) > 0.08 || Math.abs(lon - site.lon) > 0.08) continue;
    const d = approxDistKm(lat, lon, site.lat, site.lon);
    if (d <= site.radiusKm && d < bestDist) {
      bestDist = d;
      best = site;
    }
  }
  if (best) {
    return {
      kind: best.kind,
      subType: best.subType,
      siteId: best.id,
      siteName: best.name,
      basis: 'katalog'
    };
  }

  // Lapis 2: Sumber termal stasioner persisten (multi-hari, >=4 lintasan, dominan malam, kompak <=1,8 km)
  if (!isPeat && persistMap && persistMap.size > 0) {
    const cx = Math.round(lon / PERSIST_CELL);
    const cy = Math.round(lat / PERSIST_CELL);
    const p = persistMap.get(`${cx},${cy}`);
    if (p && p.days >= 2 && p.passes >= 4 && p.nightPct >= 60 && p.spanKm <= 1.8) {
      return {
        kind: 'industri',
        subType: 'Termal Tetap',
        siteId: `persist:${cx},${cy}`,
        siteName: `Sumber Termal Stasioner (${p.passes} lintasan / ${p.days} hari)`,
        basis: 'persistensi'
      };
    }
  }

  return {
    kind: 'karhutla',
    subType: isPeat ? 'Lahan Gambut' : 'Lahan / Hutan',
    siteId: null,
    siteName: null,
    basis: 'default'
  };
}
