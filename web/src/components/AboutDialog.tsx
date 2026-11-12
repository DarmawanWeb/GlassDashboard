"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./ui/controls";

const SOURCES: [string, string][] = [
  ["Sentinel-2 cloudless 2018 (EOX), peta dasar", "https://s2maps.eu"],
  ["Dataset kerusakan xBD / xView2", "https://xview2.org"],
  ["Copernicus EMS EMSR317, peta kerusakan Palu", "https://mapping.emergency.copernicus.eu/activations/EMSR317"],
  ["USGS ShakeMap gempa Palu 2018", "https://earthquake.usgs.gov/earthquakes/eventpage/us1000h3p4/shakemap"],
  ["Radar Sentinel-1, Copernicus Data Space", "https://dataspace.copernicus.eu"],
  ["Global Flood Monitoring (peta banjir)", "https://portal.gfm.eodc.eu"],
  ["Batas wilayah & garis pantai: geoBoundaries (CC BY 4.0)", "https://www.geoboundaries.org"],
  ["InaRISK BNPB", "https://inarisk.bnpb.go.id"],
];

export default function AboutDialog({ open, onClose, dataMode }: { open: boolean; onClose: () => void; dataMode: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div className="dialog-inner">
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2>Tentang dasbor ini</h2>
          <button type="button" className="btn btn-ghost btn-icon" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Tutup"><Icon name="close" /></button>
        </div>
        <p>
          <b>GLASS</b> (Geo-Actuarial Autonomous Loss Assessment System) menilai kerusakan aset negara setelah bencana dari data
          satelit, lalu mengubahnya otomatis menjadi angka klaim asuransi: <b>Lihat, Nilai, Hitung, Bayar</b>.
        </p>
        {dataMode === "file" ? (
          <p className="note note-good">Dasbor sedang memakai <b>data aset dari file</b> (GLASS_ASSETS_FILE).</p>
        ) : (
          <p className="note note-warn">
            <b>Data contoh.</b> Lokasi aset, nilai pertanggungan, dan tingkat kerusakan disimulasikan agar mirip pola Palu 2018
            (tsunami di pesisir, sesar, likuefaksi Balaroa dan Petobo). Garis pantai dan citra satelit asli. Angka di dasbor ini
            bukan data kerugian Palu yang sebenarnya.
          </p>
        )}
        <h3>Yang asli dan yang disimulasikan</h3>
        <ul>
          <li>Asli: garis pantai Teluk Palu, citra Sentinel-2 2018, lokasi episentrum gempa M7,5.</li>
          <li>Perkiraan: jejak sesar Palu-Koro dan pusat area likuefaksi (hanya untuk membentuk pola kerusakan contoh).</li>
          <li>Simulasi: aset, kerusakan, awan, guncangan per aset, dan asumsi frekuensi bencana untuk PML.</li>
        </ul>
        <h3>Sumber data yang bisa dipakai untuk versi asli</h3>
        <ul>
          {SOURCES.map(([t, u]) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{t}</a></li>)}
        </ul>
        <h3>Pintasan papan ketik untuk presentasi</h3>
        <ul>
          <li><span className="kbd">1</span>–<span className="kbd">4</span> atau <span className="kbd">←</span> <span className="kbd">→</span>: pindah langkah</li>
          <li><span className="kbd">S</span>: skenario baru (sapuan satelit diulang)</li>
          <li><span className="kbd">F</span>: layar penuh</li>
          <li><span className="kbd">Esc</span>: tutup detail aset</li>
        </ul>
        <p className="tiny">Mesin perhitungan (Python) bisa dicoba langsung di <a href="/api/docs" target="_blank" rel="noopener">/api/docs</a>.</p>
      </div>
    </dialog>
  );
}
