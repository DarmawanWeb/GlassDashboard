/* Teks antarmuka bahasa Indonesia. Kunci yang sama wajib ada di en.tsx (dicek oleh TypeScript). */

export const id = {
  meta: {
    title: "GLASS: menilai kerusakan bencana dari satelit dan drone",
  },

  app: {
    tagline: "Menilai kerusakan bencana dari satelit dan drone",
    stepsNav: "Langkah GLASS",
    steps: { lihat: "Lihat", pindai: "Pindai", nilai: "Nilai", hitung: "Hitung", bayar: "Bayar" },
    newScenario: "Skenario baru",
    newScenarioHint: "Acak ulang lokasi aset dan kerusakan (S)",
    about: "Tentang data dan sumber",
    fullscreen: "Layar penuh (F)",
    language: "Bahasa (L)",
    toLight: "Ganti ke tema terang (T)",
    toDark: "Ganti ke tema gelap (T)",
    loadingMap: "Memuat peta…",
    connecting: "Menghubungkan ke mesin GLASS…",
    engineDown: "Mesin GLASS belum bisa dihubungi.",
    reload: "Muat ulang",
    calcFailed: (e: string) => `Perhitungan gagal: ${e}`,
    computing: "Menghitung skenario…",
    sampleNote: "Data contoh untuk demonstrasi.",
    seeSources: "Lihat sumber data",
    mapRegion: "Peta",
    panelRegion: "Penjelasan langkah",
  },

  zone: {
    hijau: { label: "Hijau", meaning: "Rusak ringan" },
    kuning: { label: "Kuning", meaning: "Rusak sedang" },
    oranye: { label: "Oranye", meaning: "Rusak berat" },
    merah: { label: "Merah", meaning: "Rusak total" },
  },
  /** "zona oranye" */
  zoneName: (label: string) => `zona ${label.toLowerCase()}`,

  type: { sekolah: "Sekolah", puskesmas: "Puskesmas", kantor: "Kantor pemerintah", jembatan: "Jembatan" },
  typeShort: { sekolah: "Sekolah", puskesmas: "Puskesmas", kantor: "Kantor", jembatan: "Jembatan" },

  sensor: {
    d_surf: { label: "Foto", long: "Foto satelit", note: "Melihat atap runtuh, puing, dan bangunan yang hilang." },
    d_vol: { label: "Radar", long: "Radar Sentinel-1", note: "Melihat perubahan bentuk dan runtuhan. Radar menembus awan." },
    d_water: { label: "Air", long: "Peta banjir & suhu", note: "Melihat genangan dan lumpur, terutama di sepanjang pantai." },
  },
  /** Nama komponen SDSI menurut sumber datanya. */
  term: {
    satelit: { d_vol: "Radar", d_surf: "Foto", d_water: "Air" },
    drone: { d_vol: "LiDAR", d_surf: "Kamera", d_water: "Termal" },
    video: { d_vol: "Radar", d_surf: "Video", d_water: "Air" },
  },
  damage: ["Tidak rusak", "Rusak ringan", "Rusak berat", "Hancur"],
  damageShort: ["Tidak rusak", "Ringan", "Berat", "Hancur"],
  source: { satelit: "Satelit", drone: "Drone", video: "Video drone" },
  droneSensor: {
    rgb: { label: "Kamera RGB", spec: "< 2 cm/piksel", reads: "kerusakan atap & puing" },
    lidar: { label: "LiDAR", spec: "> 100 titik/m²", reads: "runtuhan & perubahan bentuk" },
    thermal: { label: "Termal LWIR", spec: "< 50 mK", reads: "genangan & dinding basah" },
  },
  method: { cv: "visi komputer", "vlm+cv": "VLM + visi komputer" } as Record<string, string>,
  of: (a: string | number, b: string | number) => `${a} dari ${b}`,

  lihat: {
    title: "Satelit memotret Palu",
    lead: "Tiga sensor membaca tanda kerusakan di setiap bangunan, tanpa petugas harus datang satu per satu.",
    sensorGroup: "Sensor",
    monitored: "Aset negara yang dipantau",
    monitoredNote: "sekolah, puskesmas, kantor, jembatan",
    clear: "Foto terlihat jelas",
    hidden: "Foto tertutup awan",
    hiddenNote: "nilai foto akan ditebak dari tetangga",
    cloud: "Tutupan awan",
    cloudHint: "Geser untuk melihat apa yang terjadi kalau langit lebih berawan.",
    toPindai: <>Aset yang fotonya tertutup awan akan diperiksa drone di langkah berikutnya, <b>Pindai</b>.</>,
    sources:
      "Sumber data asli yang bisa dipakai: foto satelit Maxar dan dataset xBD, radar Sentinel-1, peta banjir GFM, dan data guncangan USGS. Peta dasar: mosaik Sentinel-2 tahun 2018.",
  },

  pindai: {
    title: "Drone memeriksa dari dekat",
    lead: "Satelit cepat tapi bisa terhalang awan. Drone terbang di bawah awan, memotret tiap bangunan dengan tiga sensor, lalu AI menghitung persentase kerusakannya.",
    plan: "Rencana misi",
    planning: "Menyusun rute…",
    targets: "Aset yang diperiksa",
    targetsNote: (cloud: number, severe: number) => `${cloud} fotonya tertutup awan, ${severe} rusak berat menurut satelit`,
    distance: "Jarak terbang",
    distanceNote: "rute disusun otomatis dari posko",
    flightTime: "Waktu terbang (perkiraan)",
    flightNote: (speed: number, hover: number) => `${speed} m/s, ${hover} detik per aset`,
    batteries: "Baterai",
    batteriesNote: (min: number) => `±${min} menit per baterai`,
    maxTargets: "Jumlah aset target",
    nAssets: (n: number) => `${n} aset`,
    maxTargetsHintFlying: "Hentikan misi dulu untuk mengubah target.",
    maxTargetsHint: "Aset tertutup awan selalu didahulukan.",
    launch: "Terbangkan drone",
    pause: "Jeda",
    resume: "Lanjutkan",
    speed: "Kecepatan",
    skip: "Lewati ke hasil",
    restart: "Ulangi misi",
    progressLabel: "Kemajuan misi",
    processing: "Memproses semua aset",
    finished: "Misi selesai",
    inspected: "Aset diperiksa",
    changed: "Yang berubah setelah drone terbang",
    hiddenRow: "Foto tertutup awan",
    hiddenRowNote: "aset yang nilainya masih tebakan",
    ibnrRow: "IBNR (klaim tebakan)",
    caseRow: "Cadangan klaim (terukur)",
    totalRow: "Total dana disisihkan",
    useDrone: "Pakai hasil drone di langkah Nilai, Hitung, dan Bayar",
    results: "Hasil AI per aset",
    accuracy: (acc: string, n: number, mae: string) => (
      <>
        Ketepatan kelas dibanding kondisi sebenarnya di simulasi: <b>{acc}</b> dari {n} aset; selisih rata-rata persentase
        atap {mae} poin. Angka ini dari dunia simulasi; untuk foto asli ketepatannya harus diuji ulang dengan data lapangan.
      </>
    ),
    wasHidden: ", tadinya tertutup awan",
    footnote:
      "Citra drone di langkah ini dibuat oleh simulator dari data contoh (bukan foto asli). Karena dunianya buatan, kondisi sebenarnya diketahui dan ketepatan AI bisa diukur. Di lapangan, drone dengan kamera RGB, LiDAR, dan termal mengambil data yang sama.",
  },

  nilai: {
    title: "Setiap bangunan dapat skor SDSI",
    lead: "Tiga nilai digabung dengan bobot, seperti nilai rapor. Hasilnya 0 sampai 1, lalu dikelompokkan ke empat zona warna.",
    with: "dengan",
    formulaNote: (
      <>
        D<sub>vol</sub>: radar satelit atau LiDAR drone. D<sub>surf</sub>: foto satelit atau kamera drone. D<sub>water</sub>:
        peta banjir atau kamera termal.
      </>
    ),
    resultFor: (n: string) => `Hasil untuk ${n} aset`,
  },

  hitung: {
    title: "Skor diubah menjadi rupiah",
    lead: "Estimasi klaim = nilai aset × SDSI − potongan. Untuk aset yang fotonya tertutup awan, klaimnya diperkirakan dan dicatat sebagai IBNR.",
    totalValue: "Total nilai aset",
    sampleAssets: (n: string) => `${n} aset contoh`,
    caseRes: "Cadangan klaim",
    caseResNote: (n: string, drone: string | null) => `${n} aset terukur${drone ? `, ${drone} di antaranya dari drone` : ""}`,
    ibnr: "IBNR",
    ibnrNote: (n: string | null) => (n ? `${n} aset tertutup awan, ditebak dari 5 tetangga` : "tidak ada lagi aset yang nilainya ditebak"),
    totalRes: "Total dana yang disisihkan",
    lossRatio: "Rasio kerugian",
    lossRatioNote: "total dana ÷ total nilai aset",
    byZone: "Estimasi klaim per zona",
    pmlTitle: "Bersiap untuk tahun terburuk (PML)",
    pmlLead: (years: string) =>
      `Komputer mensimulasikan ${years} tahun. Garis biru: kerugian tahunan yang hanya terlampaui sekali dalam periode tertentu.`,
    pml100: "PML sekali dalam 100 tahun",
    pml250: "PML sekali dalam 250 tahun",
    aal: "Rata-rata kerugian per tahun (AAL)",
    aalNote: "dasar menghitung premi",
    assumptions: (rate: string, median: string, rp: string) =>
      `Asumsi simulasi: rata-rata ${rate} kejadian merusak per tahun, rasio kerugian median ${median} per kejadian. Skenario ini terjadi ${rp}.`,
  },

  bayar: {
    title: "Uang muka cepat, sisanya setelah skor keluar",
    lead: "Uang muka cair otomatis begitu data guncangan menunjukkan lokasi aset terguncang kuat. Sisanya dibayar setelah skor SDSI dihitung, jadi totalnya tetap adil.",
    timelineLabel: "Urutan pembayaran",
    timeline: [
      ["Gempa", "hari 0"],
      ["Data guncangan", "jam-an"],
      ["Uang muka", "hitungan hari"],
      ["Satelit & drone", "pasca-bencana"],
      ["Sisa bayar", "sesuai SDSI"],
    ],
    trigger: "Ambang guncangan untuk uang muka",
    triggerHint: "Garis putus-putus biru di peta menunjukkan batas ambang ini.",
    triggerTicks: ["VII", "VII,5", "VIII", "VIII,5", "IX"],
    advanceSize: "Besar uang muka",
    advanceDisplay: (p: string) => `${p} nilai aset`,
    advance: "Uang muka parametrik",
    advanceNote: (n: string) => `${n} aset di zona guncangan kuat`,
    topup: "Sisa setelah SDSI",
    totalPaid: "Total dibayar",
    basisTitle: "Basis risk: saat uang muka meleset",
    over: "Uang muka melebihi kerugian",
    overNote: (n: string) => `${n} aset rusaknya lebih ringan dari uang mukanya`,
    missed: "Rusak berat tanpa uang muka",
    missedNote: (n: string) => `${n} aset di bawah ambang, menunggu SDSI`,
    basisHint: "Geser ambang dan besar uang muka untuk mencari selisih yang paling kecil.",
    byType: "Pembayaran per jenis aset",
    certTitle: "Sertifikat kerugian digital",
  },

  asset: {
    region: (id: string) => `Detail aset ${id}`,
    source: (s: string) => `Sumber: ${s}`,
    close: "Tutup detail aset",
    droneAlt: (id: string) => `Hasil AI drone untuk ${id}`,
    droneNote: (roof: string, vol: string, wet: string, wasHidden: boolean) => (
      <>
        Diperiksa drone: atap rusak <b>{roof}</b>, volume hilang <b>{vol}</b>, area basah <b>{wet}</b>.
        {wasHidden ? " Foto satelitnya tadi tertutup awan." : ""}
      </>
    ),
    videoNote: (d: string, method: string) => `Dari video drone yang diunggah: ${d} rusak (${method}).`,
    satPhoto: (cls: string) => `Foto satelit: ${cls}.`,
    hiddenNote: (n: number, ids: string) =>
      `Foto aset ini tertutup awan. Nilai foto ditebak dari rata-rata ${n} tetangga terdekat (${ids}). Radar dan sensor air tetap terbaca karena radar menembus awan.`,
    sumInsured: "Nilai pertanggungan",
    claim: "Estimasi klaim",
    claimNoteObs: "nilai aset × SDSI − potongan",
    claimNoteEst: "diperkirakan, dicatat sebagai IBNR",
    shaking: "Guncangan di lokasi",
    advance: "Uang muka parametrik",
    topup: "Sisa setelah SDSI",
  },

  calc: {
    region: "Kalkulator SDSI",
    title: "Coba hitung sendiri",
    useData: (id: string) => `Pakai data ${id}`,
    type: "Jenis aset",
    weights: (type: string, w1: string, w2: string, w3: string) =>
      `Bobot ${type.toLowerCase()}: radar ${w1}, foto ${w2}, air ${w3}. Jumlahnya selalu 1.`,
    radar: "Radar (perubahan bentuk)",
    photo: "Foto (kelas kerusakan)",
    photoGroup: "Kelas kerusakan dari foto",
    water: "Air (genangan)",
    value: "Nilai aset",
    claimLine: (si: string, sdsi: string, ded: string) => `Estimasi klaim (${si} × ${sdsi} − potongan ${ded})`,
    failed: (e: string) => `Kalkulator gagal: ${e}`,
  },

  cert: {
    pick: "Klik satu aset di peta untuk menerbitkan sertifikat kerugiannya.",
    pickLargest: "Pilih aset dengan klaim terbesar",
    selected: (id: string, claim: string) => (
      <>
        Aset terpilih: <b style={{ color: "var(--ink)" }}>{id}</b>, estimasi klaim {claim}.
      </>
    ),
    issue: (id: string) => `Terbitkan sertifikat ${id}`,
    title: "Sertifikat Kerugian Digital",
    asset: "Aset",
    event: "Kejadian",
    score: "Skor SDSI",
    sumInsured: "Nilai pertanggungan",
    claim: "Estimasi klaim",
    advance: "Uang muka",
    topup: "Sisa pembayaran",
    sources: "Sumber data",
    issued: "Terbit",
    fingerprint: "Sidik jari SHA-256",
    verifyTitle: "Uji keaslian",
    verifyLead: "Ubah angka klaim, lalu cek. Satu digit saja berbeda, sidik jarinya berubah total.",
    inputLabel: "Estimasi klaim di sertifikat (rupiah)",
    check: "Cek sidik jari",
    restore: "Kembalikan angka asli",
    valid: <><b>Asli.</b> Isi sertifikat cocok dengan sidik jarinya.</>,
    invalid: <><b>Tidak cocok.</b> Isi sertifikat sudah diubah, jadi sidik jarinya berbeda.</>,
    recorded: "Sidik jari tercatat",
    current: "Sidik jari dari isi sekarang (karakter berbeda ditandai)",
  },

  feed: {
    region: "Kamera drone",
    title: "Kamera drone",
    tabs: { rgb: "Sesudah", swipe: "Bandingkan", lidar: "LiDAR", thermal: "Termal", ai: "Mata AI" },
    sensorName: {
      rgb: "Kamera RGB", pre: "Digital twin sebelum bencana", swipe: "Sebelum | sesudah",
      lidar: "LiDAR, tinggi permukaan", thermal: "Kamera termal LWIR", ai: "Hasil analisis AI",
    },
    follow: "Ikuti drone",
    shrink: "Perkecil kamera",
    enlarge: "Perbesar kamera",
    tablist: "Sensor",
    beforeAlt: (id: string) => `Citra sebelum bencana di sekitar ${id}`,
    viewAlt: (s: string, id: string) => `${s} di sekitar ${id}`,
    before: "Sebelum",
    after: "Sesudah",
    emptyFlying: "Drone sedang menuju target pertama…",
    emptyIdle: "Tekan Terbangkan drone di panel kanan.",
    heading: (id: string, km: string, cloud: boolean) => `Menuju ${id}, ${km} km${cloud ? ", foto satelitnya tertutup awan" : ""}`,
    capturing: "Mengambil foto, LiDAR, dan termal…",
    waiting: "Menunggu hasil analisis…",
    altitude: (m: number) => `Tinggi ${m} m`,
    hovering: "melayang",
    battery: (no: number, n: number, p: number) => `Baterai ${no}/${n}, ${p}%`,
    swipe: "Geser pembanding sebelum dan sesudah",
    analyzing: "AI menganalisis kamera, LiDAR, dan termal…",
    roof: "atap rusak",
    vol: "volume hilang",
    wet: "area basah",
    satellite: (s: string, guess: boolean) => `satelit ${s}${guess ? " (tebakan)" : ""}`,
    truth: (label: string, roof: string) => (
      <>
        Kondisi sebenarnya di simulasi: <b>{label}</b> ({roof} atap).
      </>
    ),
    hit: " Tebakan AI tepat.",
    miss: " Tebakan AI meleset dari kelas sebenarnya.",
    ask: "Tanya AI (VLM)",
    asking: "Bertanya…",
    noSummary: "(tanpa ringkasan)",
    vlmEstimate: (cls: string, p: number, s: string) => `Perkiraan VLM: ${cls}, ${p}% rusak, ${s} detik.`,
  },

  upload: {
    title: "Coba dengan video drone sendiri",
    lead: "Unggah video atau foto udara. AI memeriksa ±1 gambar per detik, menandai puing (merah) dan genangan (biru), lalu hasilnya bisa dipakai untuk satu aset.",
    sample: "Unduh contoh video simulasi",
    forAsset: "Untuk aset",
    noAsset: "Tanpa aset (hanya analisis)",
    file: "File",
    vlmAsk: "Minta VLM menjelaskan gambarnya",
    vlmOff: "(belum aktif di server)",
    vlmTitleOff: "Aktifkan GLASS_VLM_PROVIDER di server",
    vlmModel: (m: string) => `Model: ${m}`,
    analyze: "Analisis video",
    uploading: "Mengunggah…",
    analyzing: "Menganalisis…",
    uploadingPct: (p: string) => `Mengunggah ${p}`,
    analyzingN: (n: number) => `Menganalisis ${n} gambar`,
    done: "Selesai",
    tooBig: (mb: number) => `File lebih besar dari ${mb} MB.`,
    damaged: (p: string) => `${p} rusak`,
    methodLine: (method: string, n: number, cv: string | null) => `${method}, ${n} gambar${cv ? `, visi komputer ${cv}` : ""}`,
    vlmDisabled: "VLM belum diaktifkan di server, jadi hanya analisis visi komputer yang dipakai.",
    frameAlt: (i: number) => `Gambar ke-${i} dari video`,
    frameCaption: (t: string, d: string, w: string) => `Detik ${t}: ${d} rusak, genangan ${w}`,
    showRaw: "Lihat foto asli",
    showAi: "Lihat mata AI",
    strip: "Gambar dari video",
    applied: (id: string) => `Sudah dipakai untuk ${id}. Lihat perubahannya di langkah Nilai dan Hitung.`,
    apply: (id: string) => `Pakai hasil ini untuk ${id}`,
    usesVideo: (id: string) => `${id} memakai hasil video`,
    undo: "batalkan",
    errors: {
      unreadable_video: "Video tidak bisa dibuka. Coba format MP4 (H.264).",
      unreadable_image: "Foto tidak bisa dibaca.",
      no_frames: "Tidak ada gambar yang bisa dibaca dari file ini.",
      failed: "Analisis gagal.",
    } as Record<string, string>,
    network: "Unggahan gagal. Cek koneksi.",
  },

  map: {
    region: "Peta Kota Palu dengan aset negara",
    fault: "Sesar Palu-Koro (perkiraan)",
    liq: (name: string) => `Likuefaksi ${name}`,
    sweep: "Memindai citra satelit",
    epicenter: "Episentrum M7,5, ±70 km ke utara",
    basemapGroup: "Peta dasar",
    basemap: { s2: "Sentinel-2 2018", esri: "Resolusi tinggi", carto: "Peta jalan", offline: "Offline" },
    offline: "Citra satelit tidak termuat (cek internet). Peta beralih ke mode offline.",
    retry: "Coba lagi",
    place: "Kota Palu, Sulawesi Tengah",
    event: "Gempa M7,5 dan tsunami, 28 September 2018",
    stamp: "Data contoh",
    stampNote: "lokasi & kerusakan aset disimulasikan",
    base: "Posko drone (contoh)",
    tip: {
      photo: (cls: string) => `Foto: ${cls}`,
      photoHidden: "Foto tertutup awan",
      drone: (cls: string) => `Drone: ${cls}`,
      roof: (p: string) => `Atap rusak ${p}`,
      satHidden: "Foto satelit tertutup awan",
      notScanned: "Belum diperiksa drone",
      sdsi: (s: string, zone: string) => `SDSI ${s}, ${zone}`,
      fromDrone: "Nilai dari drone",
      estimated: "Nilai foto diperkirakan",
      claim: (c: string) => `Estimasi klaim ${c}`,
      caseRes: "Cadangan klaim",
      ibnr: "IBNR (diperkirakan)",
      shaking: (m: string) => `Guncangan ${m}`,
      advance: (r: string) => `Uang muka ${r}`,
      below: (m: string) => `Di bawah ambang ${m}`,
    },
  },

  legend: {
    region: "Legenda peta",
    lihat: (long: string) => `${long}: tanda kerusakan`,
    few: "sedikit",
    many: "banyak",
    hiddenPhoto: "Foto tertutup awan",
    fault: "Sesar Palu-Koro (perkiraan)",
    liq: "Likuefaksi 2018 (perkiraan)",
    mission: "Misi drone",
    route: "Rute terbang",
    flown: "Sudah diterbangi",
    pending: "Target belum diperiksa",
    ai: "Hasil AI drone",
    zones: "Zona skor SDSI",
    faded: "Titik pudar: foto tertutup awan, skornya diperkirakan",
    fromDrone: "Nilai dari drone",
    dotSize: "Besar titik: nilai aset",
    claimSize: "Besar lingkaran = estimasi klaim",
    neighbors: "Garis ke 5 tetangga terdekat",
    neighborsNote: "Dipakai menebak nilai foto aset yang tertutup awan (IBNR)",
    advance: "Uang muka parametrik",
    gets: "Dapat uang muka",
    waits: "Menunggu skor SDSI",
    shaking: "Kekuatan guncangan",
    threshold: (m: string) => `Garis ambang ${m}`,
  },

  charts: {
    composition: "Komposisi aset per zona",
    nAssets: (n: string) => `${n} aset`,
    visible: "Foto terlihat (cadangan klaim)",
    hidden: "Tertutup awan (IBNR)",
    claims: "Estimasi klaim per zona",
    seenIbnr: (a: string, b: string) => `Terlihat ${a}, IBNR ${b}`,
    advance: "Uang muka (cepat)",
    topup: "Sisa setelah SDSI",
    payout: "Pembayaran per jenis aset",
    advTop: (a: string, b: string) => `Uang muka ${a}, sisa ${b}`,
    pml: "Kurva PML: kerugian tahunan menurut periode ulang",
    rpAxis: "Periode ulang (tahun, skala log)",
    unit: "miliar",
    thisScenario: (r: string) => `Skenario Palu ini: ${r}`,
    onceIn: (n: string) => `Sekali dalam ${n} tahun`,
    lossAtLeast: "kerugian ≥",
    pmlNote: (rp: string) => `Menurut asumsi model, kerugian sebesar skenario ini terjadi ${rp}.`,
    sdsiScale: (v: string) => `Skor SDSI ${v} pada skala zona`,
  },


  errors: {
    404: "Data tidak ditemukan.",
    413: "File terlalu besar.",
    422: "Masukan tidak valid.",
    502: "AI pembaca gambar tidak menjawab.",
    503: "VLM belum aktif di server.",
    network: "Server tidak bisa dihubungi.",
  } as Record<string, string>,

  about: {
    title: "Tentang dasbor ini",
    close: "Tutup",
    team: <>Tim GLASS<br />SMA Negeri Bali Mandara</>,
    schoolAlt: "Dewan Riset Sekolah SMA Negeri Bali Mandara",
    intro: (
      <>
        <b>GLASS</b> (Geo-Actuarial Autonomous Loss Assessment System) menilai kerusakan aset negara setelah bencana dari
        satelit dan drone, lalu mengubahnya otomatis menjadi angka klaim asuransi: <b>Lihat, Pindai, Nilai, Hitung, Bayar</b>.
      </>
    ),
    fileMode: <>Dasbor sedang memakai <b>data aset dari file</b> (GLASS_ASSETS_FILE).</>,
    sampleMode: (
      <>
        <b>Data contoh.</b> Lokasi aset, nilai pertanggungan, dan tingkat kerusakan disimulasikan agar mirip pola Palu 2018
        (tsunami di pesisir, sesar, likuefaksi Balaroa dan Petobo). Garis pantai dan citra satelit asli. Angka di dasbor ini
        bukan data kerugian Palu yang sebenarnya.
      </>
    ),
    realTitle: "Yang asli dan yang disimulasikan",
    real: [
      "Asli: garis pantai Teluk Palu, citra Sentinel-2 2018, lokasi episentrum gempa M7,5.",
      "Perkiraan: jejak sesar Palu-Koro dan pusat area likuefaksi (hanya untuk membentuk pola kerusakan contoh).",
      "Simulasi: aset, kerusakan, awan, guncangan per aset, dan asumsi frekuensi bencana untuk PML.",
      "Simulasi: citra drone (kamera RGB, LiDAR, termal) dibuat program di sekitar tiap aset. AI menilai citra itu seperti menilai foto asli, lalu hasilnya dibandingkan dengan kondisi sebenarnya di simulasi.",
    ],
    vlmTitle: "AI pembaca gambar (VLM)",
    vlmOn: (model: string) => (
      <>
        Aktif dengan model <b>{model}</b>. Tombol &ldquo;Tanya AI&rdquo; di kamera drone dan opsi VLM saat unggah video bisa
        dipakai.
      </>
    ),
    vlmOff: (
      <>
        Belum aktif. Isi <code>GLASS_VLM_PROVIDER</code> di file <code>.env</code> server (misalnya Ollama dengan qwen3-vl:2b)
        untuk menyalakannya.
      </>
    ),
    sourcesTitle: "Sumber data yang bisa dipakai untuk versi asli",
    sources: [
      ["Sentinel-2 cloudless 2018 (EOX), peta dasar", "https://s2maps.eu"],
      ["Dataset kerusakan bangunan xBD / xView2", "https://xview2.org"],
      ["RescueNet: foto drone pascabencana berlabel", "https://doi.org/10.1038/s41597-023-02799-4"],
      ["FloodNet: foto udara pascabanjir berlabel", "https://doi.org/10.1109/ACCESS.2021.3090981"],
      ["Copernicus EMS EMSR317, peta kerusakan Palu", "https://mapping.emergency.copernicus.eu/activations/EMSR317"],
      ["USGS ShakeMap gempa Palu 2018", "https://earthquake.usgs.gov/earthquakes/eventpage/us1000h3p4/shakemap"],
      ["Radar Sentinel-1, Copernicus Data Space", "https://dataspace.copernicus.eu"],
      ["Global Flood Monitoring (peta banjir)", "https://portal.gfm.eodc.eu"],
      ["Batas wilayah & garis pantai: geoBoundaries (CC BY 4.0)", "https://www.geoboundaries.org"],
      ["InaRISK BNPB", "https://inarisk.bnpb.go.id"],
    ],
    shortcutsTitle: "Pintasan papan ketik untuk presentasi",
    shortcuts: {
      steps: "pindah langkah",
      space: "di langkah Pindai: terbangkan, jeda, atau lanjutkan drone",
      spaceKey: "Spasi",
      s: "skenario baru (sapuan satelit diulang)",
      f: "layar penuh",
      l: "ganti bahasa Indonesia / Inggris",
      t: "ganti tema terang / gelap",
      esc: "tutup detail aset atau kamera besar",
      or: "atau",
    },
    api: (
      <>
        Mesin perhitungan (Python) bisa dicoba langsung di{" "}
        <a href="/api/docs" target="_blank" rel="noopener">/api/docs</a>.
      </>
    ),
  },
};

export type Dict = typeof id;
