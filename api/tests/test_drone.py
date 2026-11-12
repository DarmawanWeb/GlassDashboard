import time

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from glass import pipeline
from glass.drone import align, mission, vlm
from glass.drone.render import render_scene
from glass.drone.vision import analyze_frame, analyze_pair, analyze_scene
from glass.params import ScenarioParams

client = TestClient(app)
P = ScenarioParams()
REF = {"seed": P.seed, "n_assets": P.n_assets, "cloud_cover": P.cloud_cover}


@pytest.fixture(autouse=True)
def _tmp_dirs(tmp_path, monkeypatch):
    monkeypatch.setenv("GLASS_CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setenv("GLASS_JOBS_DIR", str(tmp_path / "jobs"))
    monkeypatch.delenv("GLASS_VLM_PROVIDER", raising=False)


def test_mission_targets_cloud_covered_first():
    m = client.post("/api/drone/mission", json={**REF, "max_targets": 46}).json()
    s = m["stats"]
    assets = pipeline.observed_assets(P)
    hidden = {a["id"] for a in assets.values() if not a["observed"]}
    assert s["n_cloud"] == len(hidden) and s["n_targets"] == len(m["targets"]) <= 46
    assert {t["id"] for t in m["targets"] if t["reason"] == "awan"} == hidden
    assert m["route"][0] == m["route"][-1]                         # kembali ke posko
    assert s["batteries"] >= 1 and s["distance_km"] > 0


def test_render_is_deterministic():
    a = pipeline.observed_assets(P)["SKL-018"]
    s1, s2 = render_scene(a, P.seed), render_scene(a, P.seed)
    assert np.array_equal(s1.rgb_post, s2.rgb_post)
    assert s1.truth == s2.truth


def test_ai_estimate_close_to_simulated_truth():
    assets = list(pipeline.observed_assets(P).values())[::23][:12]
    res = [analyze_scene(render_scene(a, P.seed)) | {"truth": render_scene(a, P.seed).truth} for a in assets]
    acc = np.mean([r["estimate"]["cls"] == r["truth"]["cls"] for r in res])
    mae = np.mean([abs(r["estimate"]["roof"] - r["truth"]["roof"]) for r in res])
    assert acc >= 0.75 and mae < 0.12


def test_scan_view_and_scenario_apply():
    ids = [t["id"] for t in client.post("/api/drone/mission", json={**REF, "max_targets": 3}).json()["targets"]]
    for aid in ids:
        r = client.post("/api/drone/scan", json={**REF, "asset_id": aid})
        assert r.status_code == 200
        j = r.json()
        assert 0 <= j["estimate"]["d_surf"] <= 1 and j["detections"][0]["target"]
    key = mission.scenario_key(P)
    img = client.get(f"/api/drone/view/{key}/{ids[0]}/thermal.jpg")
    assert img.status_code == 200 and img.content[:2] == b"\xff\xd8"
    before = client.post("/api/scenario", json=REF).json()["summary"]
    after = client.post("/api/scenario", json={**REF, "drone_ids": ids}).json()
    s = after["summary"]
    assert s["n_drone"] == 3 and s["n_hidden"] == before["n_hidden"] - s["n_cloud_cleared"]
    a = next(x for x in after["assets"] if x["id"] == ids[0])
    assert a["source"] == "drone" and [t["label"] for t in a["terms"]] == ["LiDAR", "Kamera", "Termal"]


def test_bad_ids_rejected():
    assert client.get(f"/api/drone/view/{mission.scenario_key(P)}/..%2Fetc/rgb.jpg").status_code in (404, 422)
    assert client.post("/api/drone/scan", json={**REF, "asset_id": "TIDAK-ADA"}).status_code == 404
    assert client.get("/api/drone/view/bukan-kunci/SKL-001/rgb.jpg").status_code == 422


def test_ask_needs_vlm():
    assert client.post("/api/drone/ask", json={**REF, "asset_id": "SKL-018"}).status_code == 503


def test_vlm_parse_is_robust():
    r = vlm.parse('Berikut hasilnya: {"kelas": "Berat", "persen_kerusakan": "64", "genangan_persen": 140, '
                  '"objek": "puing", "ringkasan": "Atap runtuh."} selesai')
    assert r["cls"] == 2 and r["damage_pct"] == 64 and r["water_pct"] == 100 and r["objects"] == ["puing"]
    assert vlm.parse('{"persen_kerusakan": 90}')["cls"] == 3
    with pytest.raises(vlm.VlmError):
        vlm.parse("tidak ada json")


def test_upload_video_flow(tmp_path):
    a = pipeline.observed_assets(P)["SKL-018"]
    frame = cv2.cvtColor(render_scene(a, P.seed).rgb_post, cv2.COLOR_RGB2BGR)
    path = tmp_path / "uji.avi"
    vw = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 5, (frame.shape[1], frame.shape[0]))
    for _ in range(15):
        vw.write(frame)
    vw.release()
    with open(path, "rb") as f:
        r = client.post("/api/drone/uploads", files={"file": ("uji.avi", f, "video/x-msvideo")},
                        data={"asset_id": "SKL-018"})
    assert r.status_code == 200
    jid = r.json()["id"]
    for _ in range(200):
        s = client.get(f"/api/drone/uploads/{jid}").json()
        if s["status"] in ("done", "error"):
            break
        time.sleep(0.05)
    assert s["status"] == "done", s["error"]
    assert s["result"]["damage"] > 0.2 and len(s["frames"]) >= 1
    assert s["result"]["method"] == "cv" and s["result"]["vlm_status"] == "off"
    assert client.get(f"/api/drone/uploads/{jid}/frames/0.jpg?kind=raw").status_code == 200
    sc = client.post("/api/scenario", json={**REF, "video": [{"id": "SKL-018", "job_id": jid}]}).json()
    assert next(x for x in sc["assets"] if x["id"] == "SKL-018")["source"] == "video"


def test_single_frame_analyzer_sees_more_damage_in_destroyed_scene():
    assets = pipeline.observed_assets(P)
    bad = analyze_frame(render_scene(assets["KTR-005"], P.seed).rgb_post)["damage"]
    ok = analyze_frame(render_scene(assets["SKL-079"], P.seed).rgb_post)["damage"]
    assert bad > ok + 0.2


def test_certificate_lists_drone_sources():
    r = pipeline.run(P, pipeline.PolicyParams(), drone_ids=("SKL-018",))
    a = next(x for x in r["assets"] if x["id"] == "SKL-018")
    cert = client.post("/api/certificates", json=a).json()
    assert cert["data_sources"][0].startswith("Drone")


def test_upload_bad_file_reports_code():
    r = client.post("/api/drone/uploads", files={"file": ("rusak.mp4", b"bukan video", "video/mp4")})
    jid = r.json()["id"]
    for _ in range(100):
        s = client.get(f"/api/drone/uploads/{jid}").json()
        if s["status"] in ("done", "error"):
            break
        time.sleep(0.05)
    assert s["status"] == "error" and s["error_code"] in ("unreadable_video", "no_frames")


def test_certificate_in_english():
    r = pipeline.run(P, pipeline.PolicyParams(), drone_ids=("SKL-018",))
    a = next(x for x in r["assets"] if x["id"] == "SKL-018")
    cert = client.post("/api/certificates?lang=en", json=a).json()
    assert cert["asset_type"] == "School" and cert["data_sources"][0] == "Drone: RGB camera"
    assert cert["event"].startswith("Palu M7.5")
    assert client.post("/api/certificates/verify", json=cert).json()["valid"]


def test_vlm_prompt_follows_language():
    assert "in English" in vlm.prompt("en") and "in Indonesian" in vlm.prompt("id")
    assert '"ringkasan"' in vlm.prompt("en")       # kunci JSON tetap sama di semua bahasa


def _shift(img, angle=6.0, zoom=1.06, dx=30, dy=-18):
    m = cv2.getRotationMatrix2D((img.shape[1] / 2, img.shape[0] / 2), angle, zoom)
    m[0, 2] += dx
    m[1, 2] += dy
    return cv2.warpAffine(img, m, (img.shape[1], img.shape[0]), borderMode=cv2.BORDER_REFLECT), m


def test_alignment_recovers_camera_shift():
    sc = render_scene(pipeline.observed_assets(P)["SKL-073"], P.seed)
    post, m = _shift(sc.rgb_post)
    got = align.best_match([align.features(sc.rgb_pre)], align.features(post))
    assert got is not None and got.index == 0
    pts = np.float32([[100, 100], [860, 100], [480, 270], [100, 440]])
    ones = np.ones((4, 1))
    assert np.abs(np.hstack([pts, ones]) @ got.hm[:2].T - np.hstack([pts, ones]) @ m.T).max() < 3
    before, valid = align.warp(sc.rgb_pre, got.hm, post.shape)
    r = analyze_pair(before, valid, post)
    assert r is not None and 0.2 < r["damage"] < 0.8 and r["buildings"] >= 5


def test_alignment_rejects_unrelated_images():
    a = pipeline.observed_assets(P)
    one = render_scene(a["SKL-079"], P.seed).rgb_pre
    other = render_scene(a["PKM-006"], P.seed).rgb_pre
    assert align.best_match([align.features(one)], align.features(other)) is None


def _video(path, frames):
    vw = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 5, (frames[0].shape[1], frames[0].shape[0]))
    for f in frames:
        vw.write(cv2.cvtColor(f, cv2.COLOR_RGB2BGR))
    vw.release()


def test_upload_with_before_video_uses_change_detection(tmp_path):
    sc = render_scene(pipeline.observed_assets(P)["KTR-018"], P.seed)
    _video(tmp_path / "sebelum.avi", [sc.rgb_pre] * 10)
    _video(tmp_path / "sesudah.avi", [_shift(sc.rgb_post, angle=a)[0] for a in (2, 4, 6, 8, 10)] * 2)
    with open(tmp_path / "sesudah.avi", "rb") as f, open(tmp_path / "sebelum.avi", "rb") as g:
        r = client.post("/api/drone/uploads", files={"file": ("sesudah.avi", f, "video/x-msvideo"),
                                                     "pre_file": ("sebelum.avi", g, "video/x-msvideo")})
    jid = r.json()["id"]
    for _ in range(300):
        s = client.get(f"/api/drone/uploads/{jid}").json()
        if s["status"] in ("done", "error"):
            break
        time.sleep(0.05)
    assert s["status"] == "done", s["error"]
    res = s["result"]
    assert res["method"] == "change" and res["aligned_frames"] >= 1 and res["pre_frames"] >= 1
    k = next(f["i"] for f in s["frames"] if f["aligned"])
    assert client.get(f"/api/drone/uploads/{jid}/frames/{k}.jpg?kind=pre").status_code == 200
    assert res["damage"] > 0.4
