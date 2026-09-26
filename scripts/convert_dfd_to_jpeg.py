import json
import os
import re
import subprocess
import shutil
from PIL import Image

WORKSPACE_DIR = r"c:\CAPSTONE 1 - CODE"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

TEMP_DIR = os.path.join(WORKSPACE_DIR, "scratch", "dfd_render_tmp")
os.makedirs(TEMP_DIR, exist_ok=True)

html_path = os.path.join(WORKSPACE_DIR, "dfd-level-2.html")
temp_portrait_png = os.path.join(TEMP_DIR, "anti_collision_portrait.png")

print("Rendering Anti-Collision 1-Frame Portrait DFD Level 2...")

cmd = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--force-device-scale-factor=1.5",
    "--window-size=2140,2650",
    f"--screenshot={temp_portrait_png}",
    f"file:///{html_path.replace(os.sep, '/')}"
]

res = subprocess.run(cmd, capture_output=True, text=True)
if not os.path.exists(temp_portrait_png):
    raise Exception(f"Failed to capture anti-collision DFD: {res.stderr}")

im = Image.open(temp_portrait_png)
# Convert through grayscale ('L') to eliminate subpixel LCD color fringing, ensuring 100% pure B&W
rgb_im = im.convert('L').convert('RGB')

target_root = os.path.join(WORKSPACE_DIR, "dfd-level-2.jpg")
target_public = os.path.join(WORKSPACE_DIR, "public", "dfd-level-2.jpg")

rgb_im.save(target_root, "JPEG", quality=95, optimize=True)
rgb_im.save(target_public, "JPEG", quality=95, optimize=True)

print(f"Generated Anti-Collision dfd-level-2.jpg ({rgb_im.size[0]}x{rgb_im.size[1]} px, {os.path.getsize(target_root)/1024:.1f} KB)")

# Cleanup scratch
try:
    shutil.rmtree(TEMP_DIR)
except Exception:
    pass

print("Anti-Collision DFD JPEG generated successfully!")
