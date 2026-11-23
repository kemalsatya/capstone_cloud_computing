import os
import shutil
import subprocess
import tempfile
from PIL import Image

for script_path in [
    "capstone_cloud_computing/automation/scripts/generators/generate_business_archimate.py",
    "capstone_cloud_computing/automation/scripts/generators/generate_archimate.py",
    "capstone_cloud_computing/automation/scripts/generators/generate_adr_diagram.py",
]:
    with open(script_path, "r", encoding="utf-8") as f:
        code = f.read()
    code = code.replace("&rarr;", "\u2192")
    code = code.replace("&bull;", "\u2022")
    code = code.replace("<b>", '<tspan font-weight="bold">')
    code = code.replace("</b>", "</tspan>")
    with open(script_path, "w", encoding="utf-8") as f:
        f.write(code)

subprocess.run(["python", "capstone_cloud_computing/automation/scripts/generators/generate_business_archimate.py"], check=True)
subprocess.run(["python", "capstone_cloud_computing/automation/scripts/generators/generate_archimate.py"], check=True)
subprocess.run(["python", "capstone_cloud_computing/automation/scripts/generators/generate_adr_diagram.py"], check=True)

edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
jobs = [
    (
        "capstone_cloud_computing/evidence/business/business-archimate.svg",
        1640,
        1260,
        [
            "capstone_cloud_computing/evidence/business/01_evidence.jpg",
            "cloud-capstone-team-7/01-business/01_evidence.jpg",
        ],
    ),
    (
        "capstone_cloud_computing/architecture/archimate-diagram.svg",
        1640,
        1420,
        [
            "capstone_cloud_computing/evidence/architecture/02_evidence.jpg",
            "cloud-capstone-team-7/02-architecture/02_evidence.jpg",
        ],
    ),
    (
        "capstone_cloud_computing/decisions/adr-matrix-diagram.svg",
        1620,
        1160,
        [
            "capstone_cloud_computing/decisions/10_evidence.jpg",
            "cloud-capstone-team-7/10-decisions-adr/10_evidence.jpg",
        ],
    ),
]

for svg_rel, w, h, outs in jobs:
    tmp_dir = tempfile.mkdtemp(prefix="edge_cap_")
    png_path = os.path.join(tmp_dir, "out.png")
    svg_abs = os.path.abspath(svg_rel).replace("\\", "/")
    subprocess.run(
        [
            edge,
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            f"--user-data-dir={tmp_dir}",
            f"--window-size={w},{h}",
            f"--screenshot={png_path}",
            f"file:///{svg_abs}",
        ],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if os.path.exists(png_path):
        im = Image.open(png_path).convert("RGB")
        for out in outs:
            os.makedirs(os.path.dirname(out), exist_ok=True)
            im.save(out, "JPEG", quality=95)
            print("Re-rendered:", out, im.size)
    shutil.rmtree(tmp_dir, ignore_errors=True)
