/* English interface text. Must mirror the keys in id.tsx (checked by TypeScript). */
import type { Dict } from "./id";

export const en: Dict = {
  meta: {
    title: "GLASS: disaster damage assessment from satellite and drone",
  },

  app: {
    tagline: "Disaster damage assessment from satellite and drone",
    stepsNav: "GLASS steps",
    steps: { lihat: "See", pindai: "Scan", nilai: "Score", hitung: "Calculate", bayar: "Pay" },
    newScenario: "New scenario",
    newScenarioHint: "Reshuffle asset locations and damage (S)",
    about: "About the data and sources",
    fullscreen: "Full screen (F)",
    language: "Language (L)",
    toLight: "Switch to light theme (T)",
    toDark: "Switch to dark theme (T)",
    loadingMap: "Loading map…",
    connecting: "Connecting to the GLASS engine…",
    engineDown: "Can't reach the GLASS engine.",
    reload: "Reload",
    calcFailed: (e: string) => `Calculation failed: ${e}`,
    computing: "Computing the scenario…",
    sampleNote: "Sample data for demonstration.",
    seeSources: "See data sources",
    mapRegion: "Map",
    panelRegion: "Step explanation",
  },

  zone: {
    hijau: { label: "Green", meaning: "Light damage" },
    kuning: { label: "Yellow", meaning: "Moderate damage" },
    oranye: { label: "Orange", meaning: "Heavy damage" },
    merah: { label: "Red", meaning: "Total loss" },
  },
  zoneName: (label: string) => `${label.toLowerCase()} zone`,

  type: { sekolah: "School", puskesmas: "Health center", kantor: "Government office", jembatan: "Bridge" },
  typeShort: { sekolah: "School", puskesmas: "Health center", kantor: "Office", jembatan: "Bridge" },

  sensor: {
    d_surf: { label: "Photo", long: "Satellite photo", note: "Sees collapsed roofs, debris, and missing buildings." },
    d_vol: { label: "Radar", long: "Sentinel-1 radar", note: "Sees deformation and collapse. Radar sees through clouds." },
    d_water: { label: "Water", long: "Flood & temperature map", note: "Sees standing water and mud, especially along the coast." },
  },
  term: {
    satelit: { d_vol: "Radar", d_surf: "Photo", d_water: "Water" },
    drone: { d_vol: "LiDAR", d_surf: "Camera", d_water: "Thermal" },
    video: { d_vol: "Radar", d_surf: "Video", d_water: "Water" },
  },
  damage: ["No damage", "Minor damage", "Major damage", "Destroyed"],
  damageShort: ["None", "Minor", "Major", "Destroyed"],
  source: { satelit: "Satellite", drone: "Drone", video: "Drone video" },
  droneSensor: {
    rgb: { label: "RGB camera", spec: "< 2 cm/pixel", reads: "roof damage & debris" },
    lidar: { label: "LiDAR", spec: "> 100 points/m²", reads: "collapse & deformation" },
    thermal: { label: "LWIR thermal", spec: "< 50 mK", reads: "standing water & wet walls" },
  },
  method: { cv: "computer vision", "vlm+cv": "VLM + computer vision" },
  of: (a: string | number, b: string | number) => `${a} of ${b}`,

  lihat: {
    title: "Satellites image Palu",
    lead: "Three sensors read signs of damage on every building, without sending surveyors to each one.",
    sensorGroup: "Sensor",
    monitored: "Public assets monitored",
    monitoredNote: "schools, health centers, offices, bridges",
    clear: "Clear photos",
    hidden: "Photos under cloud",
    hiddenNote: "photo value will be estimated from neighbors",
    cloud: "Cloud cover",
    cloudHint: "Slide to see what happens when the sky is cloudier.",
    toPindai: <>Assets whose photos are under cloud get inspected by drone in the next step, <b>Scan</b>.</>,
    sources:
      "Real data sources that can be plugged in: Maxar imagery and the xBD dataset, Sentinel-1 radar, GFM flood maps, and USGS shaking data. Base map: 2018 Sentinel-2 mosaic.",
  },

  pindai: {
    title: "Drones take a closer look",
    lead: "Satellites are fast, but clouds get in the way. Drones fly below the clouds, capture every building with three sensors, and AI computes how much of it is damaged.",
    plan: "Mission plan",
    planning: "Planning the route…",
    targets: "Assets to inspect",
    targetsNote: (cloud: number, severe: number) => `${cloud} hidden by cloud, ${severe} heavily damaged per satellite`,
    distance: "Flight distance",
    distanceNote: "route planned automatically from the base",
    flightTime: "Flight time (estimate)",
    flightNote: (speed: number, hover: number) => `${speed} m/s, ${hover} s per asset`,
    batteries: "Batteries",
    batteriesNote: (min: number) => `about ${min} min per battery`,
    maxTargets: "Number of target assets",
    nAssets: (n: number) => `${n} assets`,
    maxTargetsHintFlying: "Stop the mission to change the targets.",
    maxTargetsHint: "Cloud-covered assets always go first.",
    launch: "Launch drone",
    pause: "Pause",
    resume: "Resume",
    speed: "Speed",
    skip: "Skip to results",
    restart: "Restart mission",
    progressLabel: "Mission progress",
    processing: "Processing all assets",
    finished: "Mission complete",
    inspected: "Assets inspected",
    changed: "What changed after the flight",
    hiddenRow: "Photos under cloud",
    hiddenRowNote: "assets whose value is still estimated",
    ibnrRow: "IBNR (estimated claims)",
    caseRow: "Case reserves (measured)",
    totalRow: "Total reserves set aside",
    useDrone: "Use drone results in the Score, Calculate, and Pay steps",
    results: "AI results per asset",
    accuracy: (acc: string, n: number, mae: string) => (
      <>
        Class accuracy against the simulated ground truth: <b>{acc}</b> of {n} assets; mean roof-damage error {mae} points.
        These numbers come from the simulated world; on real photos, accuracy must be re-tested against field data.
      </>
    ),
    wasHidden: ", was under cloud",
    footnote:
      "Drone imagery in this step is generated by a simulator from sample data (not real photos). Because the world is synthetic, the ground truth is known and AI accuracy can be measured. In the field, a drone with RGB, LiDAR, and thermal sensors collects the same data.",
  },

  nilai: {
    title: "Every building gets an SDSI score",
    lead: "Three values are combined with weights, like a report card. The result runs from 0 to 1 and falls into one of four color zones.",
    with: "with",
    formulaNote: (
      <>
        D<sub>vol</sub>: satellite radar or drone LiDAR. D<sub>surf</sub>: satellite photo or drone camera. D<sub>water</sub>:
        flood map or thermal camera.
      </>
    ),
    resultFor: (n: string) => `Results for ${n} assets`,
  },

  hitung: {
    title: "Scores become rupiah",
    lead: "Estimated claim = asset value × SDSI − deductible. For assets whose photos are under cloud, the claim is estimated and booked as IBNR.",
    totalValue: "Total asset value",
    sampleAssets: (n: string) => `${n} sample assets`,
    caseRes: "Case reserves",
    caseResNote: (n: string, drone: string | null) => `${n} measured assets${drone ? `, ${drone} of them by drone` : ""}`,
    ibnr: "IBNR",
    ibnrNote: (n: string | null) => (n ? `${n} cloud-covered assets, estimated from 5 neighbors` : "no assets left to estimate"),
    totalRes: "Total reserves set aside",
    lossRatio: "Loss ratio",
    lossRatioNote: "total reserves ÷ total asset value",
    byZone: "Estimated claims by zone",
    pmlTitle: "Preparing for the worst year (PML)",
    pmlLead: (years: string) =>
      `The computer simulates ${years} years. Blue line: the annual loss that is exceeded only once in a given period.`,
    pml100: "PML, once in 100 years",
    pml250: "PML, once in 250 years",
    aal: "Average annual loss (AAL)",
    aalNote: "the basis for pricing premiums",
    assumptions: (rate: string, median: string, rp: string) =>
      `Simulation assumptions: on average ${rate} damaging events per year, median loss ratio ${median} per event. This scenario happens ${rp}.`,
  },

  bayar: {
    title: "A fast advance, the rest once scores are in",
    lead: "An advance pays out automatically as soon as shaking data shows that an asset was strongly shaken. The rest is paid once the SDSI score is computed, so the total stays fair.",
    timelineLabel: "Payment sequence",
    timeline: [
      ["Earthquake", "day 0"],
      ["Shaking data", "within hours"],
      ["Advance", "within days"],
      ["Satellite & drone", "after the event"],
      ["Top-up", "per SDSI"],
    ],
    trigger: "Shaking threshold for the advance",
    triggerHint: "The dashed blue line on the map marks this threshold.",
    triggerTicks: ["VII", "VII.5", "VIII", "VIII.5", "IX"],
    advanceSize: "Advance size",
    advanceDisplay: (p: string) => `${p} of asset value`,
    advance: "Parametric advance",
    advanceNote: (n: string) => `${n} assets in the strong-shaking zone`,
    topup: "Top-up after SDSI",
    totalPaid: "Total paid",
    basisTitle: "Basis risk: when the advance misses",
    over: "Advance above the loss",
    overNote: (n: string) => `${n} assets damaged less than their advance`,
    missed: "Heavy damage without an advance",
    missedNote: (n: string) => `${n} assets below the threshold, waiting for SDSI`,
    basisHint: "Move the threshold and the advance size to find the smallest mismatch.",
    byType: "Payments by asset type",
    certTitle: "Digital loss certificate",
  },

  asset: {
    region: (id: string) => `Asset ${id} details`,
    source: (s: string) => `Source: ${s}`,
    close: "Close asset details",
    droneAlt: (id: string) => `Drone AI result for ${id}`,
    droneNote: (roof: string, vol: string, wet: string, wasHidden: boolean) => (
      <>
        Inspected by drone: roof damaged <b>{roof}</b>, volume lost <b>{vol}</b>, wet area <b>{wet}</b>.
        {wasHidden ? " Its satellite photo was under cloud." : ""}
      </>
    ),
    videoNote: (d: string, method: string) => `From the uploaded drone video: ${d} damaged (${method}).`,
    satPhoto: (cls: string) => `Satellite photo: ${cls}.`,
    hiddenNote: (n: number, ids: string) =>
      `This asset's photo is under cloud. Its photo value is the average of its ${n} nearest neighbors (${ids}). Radar and water readings still work because radar sees through clouds.`,
    sumInsured: "Sum insured",
    claim: "Estimated claim",
    claimNoteObs: "asset value × SDSI − deductible",
    claimNoteEst: "estimated, booked as IBNR",
    shaking: "Shaking at the site",
    advance: "Parametric advance",
    topup: "Top-up after SDSI",
  },

  calc: {
    region: "SDSI calculator",
    title: "Try it yourself",
    useData: (id: string) => `Use ${id} data`,
    type: "Asset type",
    weights: (type: string, w1: string, w2: string, w3: string) =>
      `Weights for ${type.toLowerCase()}: radar ${w1}, photo ${w2}, water ${w3}. They always add up to 1.`,
    radar: "Radar (deformation)",
    photo: "Photo (damage class)",
    photoGroup: "Damage class from the photo",
    water: "Water (flooding)",
    value: "Asset value",
    claimLine: (si: string, sdsi: string, ded: string) => `Estimated claim (${si} × ${sdsi} − deductible ${ded})`,
    failed: (e: string) => `Calculator failed: ${e}`,
  },

  cert: {
    pick: "Click an asset on the map to issue its loss certificate.",
    pickLargest: "Pick the asset with the largest claim",
    selected: (id: string, claim: string) => (
      <>
        Selected asset: <b style={{ color: "var(--ink)" }}>{id}</b>, estimated claim {claim}.
      </>
    ),
    issue: (id: string) => `Issue certificate for ${id}`,
    title: "Digital Loss Certificate",
    asset: "Asset",
    event: "Event",
    score: "SDSI score",
    sumInsured: "Sum insured",
    claim: "Estimated claim",
    advance: "Advance",
    topup: "Top-up",
    sources: "Data sources",
    issued: "Issued",
    fingerprint: "SHA-256 fingerprint",
    verifyTitle: "Authenticity check",
    verifyLead: "Change the claim amount, then check. Change a single digit and the fingerprint changes completely.",
    inputLabel: "Estimated claim on the certificate (rupiah)",
    check: "Check fingerprint",
    restore: "Restore the original amount",
    valid: <><b>Authentic.</b> The certificate content matches its fingerprint.</>,
    invalid: <><b>No match.</b> The certificate content was changed, so its fingerprint differs.</>,
    recorded: "Recorded fingerprint",
    current: "Fingerprint of the current content (differing characters highlighted)",
  },

  feed: {
    region: "Drone camera",
    title: "Drone camera",
    tabs: { rgb: "After", swipe: "Compare", lidar: "LiDAR", thermal: "Thermal", ai: "AI view" },
    sensorName: {
      rgb: "RGB camera", pre: "Pre-disaster digital twin", swipe: "Before | after",
      lidar: "LiDAR, surface height", thermal: "LWIR thermal camera", ai: "AI analysis",
    },
    follow: "Follow drone",
    shrink: "Shrink camera",
    enlarge: "Enlarge camera",
    tablist: "Sensor",
    beforeAlt: (id: string) => `Pre-disaster image around ${id}`,
    viewAlt: (s: string, id: string) => `${s} around ${id}`,
    before: "Before",
    after: "After",
    emptyFlying: "The drone is heading to its first target…",
    emptyIdle: "Press Launch drone in the right panel.",
    heading: (id: string, km: string, cloud: boolean) => `Heading to ${id}, ${km} km${cloud ? ", its satellite photo is under cloud" : ""}`,
    capturing: "Capturing photo, LiDAR, and thermal…",
    waiting: "Waiting for the analysis…",
    altitude: (m: number) => `Altitude ${m} m`,
    hovering: "hovering",
    battery: (no: number, n: number, p: number) => `Battery ${no}/${n}, ${p}%`,
    swipe: "Drag to compare before and after",
    analyzing: "AI is analyzing camera, LiDAR, and thermal…",
    roof: "roof damaged",
    vol: "volume lost",
    wet: "wet area",
    satellite: (s: string, guess: boolean) => `satellite ${s}${guess ? " (estimated)" : ""}`,
    truth: (label: string, roof: string) => (
      <>
        Simulated ground truth: <b>{label}</b> ({roof} roof).
      </>
    ),
    hit: " The AI got it right.",
    miss: " The AI missed the true class.",
    ask: "Ask AI (VLM)",
    asking: "Asking…",
    noSummary: "(no summary)",
    vlmEstimate: (cls: string, p: number, s: string) => `VLM estimate: ${cls}, ${p}% damaged, ${s} s.`,
  },

  upload: {
    title: "Try your own drone video",
    lead: "Upload a video or an aerial photo. The AI checks about one frame per second, marks debris (red) and standing water (blue), and the result can be applied to one asset.",
    sample: "Download a simulated sample video",
    forAsset: "For asset",
    noAsset: "No asset (analysis only)",
    file: "File",
    vlmAsk: "Ask the VLM to describe the frames",
    vlmOff: "(not enabled on the server)",
    vlmTitleOff: "Set GLASS_VLM_PROVIDER on the server",
    vlmModel: (m: string) => `Model: ${m}`,
    analyze: "Analyze video",
    uploading: "Uploading…",
    analyzing: "Analyzing…",
    uploadingPct: (p: string) => `Uploading ${p}`,
    analyzingN: (n: number) => `Analyzing ${n} frames`,
    done: "Done",
    tooBig: (mb: number) => `The file is larger than ${mb} MB.`,
    damaged: (p: string) => `${p} damaged`,
    methodLine: (method: string, n: number, cv: string | null) => `${method}, ${n} frames${cv ? `, computer vision ${cv}` : ""}`,
    vlmDisabled: "The VLM is not enabled on the server, so only computer vision was used.",
    frameAlt: (i: number) => `Frame ${i} of the video`,
    frameCaption: (t: string, d: string, w: string) => `Second ${t}: ${d} damaged, water ${w}`,
    showRaw: "Show the original",
    showAi: "Show the AI view",
    strip: "Frames from the video",
    applied: (id: string) => `Applied to ${id}. See the changes in the Score and Calculate steps.`,
    apply: (id: string) => `Use this result for ${id}`,
    usesVideo: (id: string) => `${id} uses the video result`,
    undo: "undo",
    errors: {
      unreadable_video: "The video can't be opened. Try MP4 (H.264).",
      unreadable_image: "The photo can't be read.",
      no_frames: "No frames could be read from this file.",
      failed: "The analysis failed.",
    },
    network: "Upload failed. Check the connection.",
  },

  map: {
    region: "Map of Palu with public assets",
    fault: "Palu-Koro fault (approximate)",
    liq: (name: string) => `${name} liquefaction`,
    sweep: "Scanning satellite imagery",
    epicenter: "M7.5 epicenter, about 70 km north",
    basemapGroup: "Base map",
    basemap: { s2: "Sentinel-2 2018", esri: "High resolution", carto: "Street map", offline: "Offline" },
    offline: "Satellite imagery didn't load (check the internet). The map switched to offline mode.",
    retry: "Try again",
    place: "Palu City, Central Sulawesi",
    event: "M7.5 earthquake and tsunami, 28 September 2018",
    stamp: "Sample data",
    stampNote: "asset locations & damage are simulated",
    base: "Drone base (sample)",
    tip: {
      photo: (cls: string) => `Photo: ${cls}`,
      photoHidden: "Photo under cloud",
      drone: (cls: string) => `Drone: ${cls}`,
      roof: (p: string) => `Roof damaged ${p}`,
      satHidden: "Satellite photo under cloud",
      notScanned: "Not yet inspected by drone",
      sdsi: (s: string, zone: string) => `SDSI ${s}, ${zone}`,
      fromDrone: "Value from drone",
      estimated: "Photo value estimated",
      claim: (c: string) => `Estimated claim ${c}`,
      caseRes: "Case reserves",
      ibnr: "IBNR (estimated)",
      shaking: (m: string) => `Shaking ${m}`,
      advance: (r: string) => `Advance ${r}`,
      below: (m: string) => `Below threshold ${m}`,
    },
  },

  legend: {
    region: "Map legend",
    lihat: (long: string) => `${long}: signs of damage`,
    few: "few",
    many: "many",
    hiddenPhoto: "Photo under cloud",
    fault: "Palu-Koro fault (approximate)",
    liq: "2018 liquefaction (approximate)",
    mission: "Drone mission",
    route: "Flight route",
    flown: "Flown",
    pending: "Targets not yet inspected",
    ai: "Drone AI results",
    zones: "SDSI score zones",
    faded: "Faded dots: photo under cloud, score estimated",
    fromDrone: "Value from drone",
    dotSize: "Dot size: asset value",
    claimSize: "Circle size = estimated claim",
    neighbors: "Lines to the 5 nearest neighbors",
    neighborsNote: "Used to estimate photo values for cloud-covered assets (IBNR)",
    advance: "Parametric advance",
    gets: "Gets an advance",
    waits: "Waiting for the SDSI score",
    shaking: "Shaking intensity",
    threshold: (m: string) => `Threshold line ${m}`,
  },

  charts: {
    composition: "Assets by zone",
    nAssets: (n: string) => `${n} assets`,
    visible: "Photo visible (case reserves)",
    hidden: "Under cloud (IBNR)",
    claims: "Estimated claims by zone",
    seenIbnr: (a: string, b: string) => `Visible ${a}, IBNR ${b}`,
    advance: "Advance (fast)",
    topup: "Top-up after SDSI",
    payout: "Payments by asset type",
    advTop: (a: string, b: string) => `Advance ${a}, top-up ${b}`,
    pml: "PML curve: annual loss by return period",
    rpAxis: "Return period (years, log scale)",
    unit: "billion",
    thisScenario: (r: string) => `This Palu scenario: ${r}`,
    onceIn: (n: string) => `Once in ${n} years`,
    lossAtLeast: "loss ≥",
    pmlNote: (rp: string) => `Under the model's assumptions, a loss as large as this scenario happens ${rp}.`,
    sdsiScale: (v: string) => `SDSI score ${v} on the zone scale`,
  },


  errors: {
    404: "Not found.",
    413: "The file is too large.",
    422: "Invalid input.",
    502: "The vision model didn't respond.",
    503: "The VLM isn't enabled on the server.",
    network: "Can't reach the server.",
  },

  about: {
    title: "About this dashboard",
    close: "Close",
    team: <>GLASS team<br />SMA Negeri Bali Mandara</>,
    schoolAlt: "Dewan Riset Sekolah, SMA Negeri Bali Mandara",
    intro: (
      <>
        <b>GLASS</b> (Geo-Actuarial Autonomous Loss Assessment System) assesses damage to public assets after a disaster from
        satellite and drone data, then turns it into insurance claim amounts automatically: <b>See, Scan, Score, Calculate, Pay</b>.
      </>
    ),
    fileMode: <>The dashboard is using <b>asset data from a file</b> (GLASS_ASSETS_FILE).</>,
    sampleMode: (
      <>
        <b>Sample data.</b> Asset locations, sums insured, and damage levels are simulated to resemble the 2018 Palu pattern
        (coastal tsunami, the fault, Balaroa and Petobo liquefaction). The coastline and satellite imagery are real. The numbers
        on this dashboard are not the actual Palu losses.
      </>
    ),
    realTitle: "What is real and what is simulated",
    real: [
      "Real: the Palu Bay coastline, 2018 Sentinel-2 imagery, the location of the M7.5 epicenter.",
      "Approximate: the Palu-Koro fault trace and the centers of the liquefaction areas (only used to shape the sample damage pattern).",
      "Simulated: assets, damage, clouds, shaking per asset, and the disaster frequency assumptions behind the PML.",
      "Simulated: drone imagery (RGB camera, LiDAR, thermal) is generated around each asset. The AI assesses it the same way it would assess real photos, and the result is compared with the simulated ground truth.",
    ],
    vlmTitle: "Image-reading AI (VLM)",
    vlmOn: (model: string) => (
      <>
        Enabled with the <b>{model}</b> model. The &ldquo;Ask AI&rdquo; button on the drone camera and the VLM option for video
        uploads are available.
      </>
    ),
    vlmOff: (
      <>
        Not enabled. Set <code>GLASS_VLM_PROVIDER</code> in the server&rsquo;s <code>.env</code> file (for example Ollama with
        qwen3-vl:2b) to turn it on.
      </>
    ),
    sourcesTitle: "Data sources for a real deployment",
    sources: [
      ["Sentinel-2 cloudless 2018 (EOX), base map", "https://s2maps.eu"],
      ["xBD / xView2 building damage dataset", "https://xview2.org"],
      ["RescueNet: labeled post-disaster drone imagery", "https://doi.org/10.1038/s41597-023-02799-4"],
      ["FloodNet: labeled post-flood aerial imagery", "https://doi.org/10.1109/ACCESS.2021.3090981"],
      ["Copernicus EMS EMSR317, Palu damage maps", "https://mapping.emergency.copernicus.eu/activations/EMSR317"],
      ["USGS ShakeMap for the 2018 Palu earthquake", "https://earthquake.usgs.gov/earthquakes/eventpage/us1000h3p4/shakemap"],
      ["Sentinel-1 radar, Copernicus Data Space", "https://dataspace.copernicus.eu"],
      ["Global Flood Monitoring (flood maps)", "https://portal.gfm.eodc.eu"],
      ["Boundaries & coastline: geoBoundaries (CC BY 4.0)", "https://www.geoboundaries.org"],
      ["InaRISK (BNPB)", "https://inarisk.bnpb.go.id"],
    ],
    shortcutsTitle: "Keyboard shortcuts for presenting",
    shortcuts: {
      steps: "change step",
      space: "in the Scan step: launch, pause, or resume the drone",
      spaceKey: "Space",
      s: "new scenario (replays the satellite sweep)",
      f: "full screen",
      l: "switch between Indonesian and English",
      t: "switch between light and dark theme",
      esc: "close asset details or the large camera",
      or: "or",
    },
    api: (
      <>
        The calculation engine (Python) can be tried directly at{" "}
        <a href="/api/docs" target="_blank" rel="noopener">/api/docs</a>.
      </>
    ),
  },
};
