"""Fetch the CC0 Poly Haven assets used by the Harbor Point scene into apps/web/public/assets.
Usage: python3 scripts/fetch-assets.py [--dry-run]
All assets are CC0 (https://polyhaven.com/license). Re-running skips existing files.
"""
import json, pathlib, sys, urllib.request

root = pathlib.Path(__file__).resolve().parents[1] / "apps" / "web" / "public" / "assets"
MODELS = {  # id: resolution — low-poly props only; trees and people are procedural
    "plastic_crate_02": "1k", "medical_box": "1k", "Barrel_01": "1k",
    "concrete_road_barrier_02": "1k", "street_lamp_02": "1k", "painted_wooden_bench": "1k",
    "shrub_03": "1k", "shrub_sorrel_01": "1k",
}
TEXTURES = {  # id: maps — keep ground surfaces fully PBR, facades lighter
    "leafy_grass": ("diff", "nor", "arm"), "asphalt_02": ("diff", "nor", "arm"),
    "brushed_concrete": ("diff", "nor"), "damp_beach_sand": ("diff", "nor"),
    "painted_plaster_wall": ("diff", "nor"), "brick_wall_001": ("diff", "nor"),
    "grey_roof_tiles": ("diff", "nor"), "corrugated_iron": ("diff", "nor"),
    "weathered_planks": ("diff", "nor"),
}
HDRIS = {"kloofendal_overcast_puresky": "1k"}
MAP_KEYS = {"diff": "Diffuse", "nor": "nor_gl", "arm": "arm"}

def get(url):
    request = urllib.request.Request(url, headers={"User-Agent": "CrisisCraft-asset-fetch/1.0"})
    with urllib.request.urlopen(request) as r:
        return r.read()

def save(url, path, dry):
    if path.exists() or dry:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(get(url))

dry = "--dry-run" in sys.argv
total = 0
for asset, res in MODELS.items():
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))["gltf"][res]["gltf"]
    size = files["size"] + sum(f["size"] for f in files["include"].values())
    total += size
    print(f"model   {asset:28} {size/1e6:5.2f} MB")
    base = root / "models" / asset
    save(files["url"], base / f"{asset}.gltf", dry)
    for rel, f in files["include"].items():
        save(f["url"], base / rel, dry)
for asset, maps in TEXTURES.items():
    files = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))
    size = 0
    for short in maps:
        f = files[MAP_KEYS[short]]["1k"]["jpg"]
        size += f["size"]
        save(f["url"], root / "textures" / asset / f"{short}.jpg", dry)
    total += size
    print(f"texture {asset:28} {size/1e6:5.2f} MB")
for asset, res in HDRIS.items():
    f = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))["hdri"][res]["hdr"]
    total += f["size"]
    print(f"hdri    {asset:28} {f['size']/1e6:5.2f} MB")
    save(f["url"], root / "hdri" / f"{asset}.hdr", dry)
print(f"{'would fetch' if dry else 'fetched'} ≈ {total/1e6:.1f} MB")
