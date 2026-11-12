import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from glass import certificate, pipeline
from glass.actuarial import claim
from glass.params import ASSET_TYPES, PolicyParams, ScenarioParams, zone_of
from glass.sdsi import sdsi

client = TestClient(app)


def test_weights_sum_to_one():
    for meta in ASSET_TYPES.values():
        assert math.isclose(sum(meta["weights"]), 1.0)


def test_sdsi_example_sd_negeri():
    # contoh di dokumen: radar 0,60 ; foto 0,67 ; air 0,30 -> 0,56 zona oranye
    r = sdsi("sekolah", 0.60, 0.67, 0.30)
    assert r["sdsi"] == pytest.approx(0.5565, abs=1e-4)
    assert r["zone"] == "oranye"


@pytest.mark.parametrize("score,zone", [(0, "hijau"), (0.25, "hijau"), (0.26, "kuning"), (0.5, "kuning"),
                                        (0.51, "oranye"), (0.75, "oranye"), (0.76, "merah"), (1, "merah")])
def test_zone_bounds(score, zone):
    assert zone_of(score) == zone


def test_claim_example():
    assert claim(4e9, 0.56, 0.01) == pytest.approx(2.2e9)
    assert claim(4e9, 0.0, 0.01) == 0.0


def test_scenario_is_deterministic_and_consistent():
    p, pol = ScenarioParams(seed=7), PolicyParams()
    a, b = pipeline.run(p, pol), pipeline.run(p, pol)
    assert [x["sdsi"] for x in a["assets"]] == [x["sdsi"] for x in b["assets"]]
    s = a["summary"]
    assert s["n_observed"] + s["n_hidden"] == s["n_assets"] == 320
    assert s["total_reserves"] == pytest.approx(s["case_reserves"] + s["ibnr"])
    hidden = [x for x in a["assets"] if not x["observed"]]
    assert all(len(x["neighbors"]) == 5 for x in hidden)
    assert abs(s["n_hidden"] / s["n_assets"] - p.cloud_cover) < 0.08
    for x in a["assets"]:
        assert x["advance"] + x["topup"] >= x["claim"] - 1      # total bayar tidak kurang dari klaim


def test_trigger_changes_advance_only():
    p = ScenarioParams(seed=11)
    low, high = pipeline.run(p, PolicyParams(mmi_trigger=7.0)), pipeline.run(p, PolicyParams(mmi_trigger=9.0))
    assert low["summary"]["n_advance"] > high["summary"]["n_advance"]
    assert low["summary"]["total_reserves"] == pytest.approx(high["summary"]["total_reserves"])


def test_certificate_detects_tampering():
    r = pipeline.run(ScenarioParams(), PolicyParams())
    cert = certificate.issue(r["assets"][0])
    assert certificate.verify(cert)["valid"]
    cert["estimated_claim_idr"] += 1
    assert not certificate.verify(cert)["valid"]


def test_api_endpoints():
    assert client.get("/api/health").json()["status"] == "ok"
    meta = client.get("/api/meta").json()
    assert meta["data_mode"] == "contoh" and len(meta["geo"]["fault"]) > 2
    sc = client.post("/api/scenario", json={"seed": 2018, "policy": {"mmi_trigger": 8.0}}).json()
    assert len(sc["assets"]) == 320 and sc["shake_line"]
    calc = client.post("/api/sdsi", json={"asset_type": "sekolah", "d_vol": 0.6, "d_surf": 0.67, "d_water": 0.3,
                                          "sum_insured": 4e9, "mmi": 8.2}).json()
    assert calc["zone"] == "oranye" and calc["advance"] == 400_000_000
    cert = client.post("/api/certificates", json=sc["assets"][3]).json()
    assert client.post("/api/certificates/verify", json=cert).json()["valid"]
    cert["zone"] = "merah" if cert["zone"] != "merah" else "hijau"
    assert not client.post("/api/certificates/verify", json=cert).json()["valid"]
    assert client.post("/api/scenario", json={"cloud_cover": 0.9}).status_code == 422
