import json
import os
import re
import html
import subprocess
import shutil
import xml.etree.ElementTree as ET
from PIL import Image

WORKSPACE_DIR = r"c:\CAPSTONE 1 - CODE"
PUBLIC_DIR = os.path.join(WORKSPACE_DIR, "public")
os.makedirs(PUBLIC_DIR, exist_ok=True)

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

TEMP_DIR = os.path.join(WORKSPACE_DIR, "scratch", "dfd_sep_tmp")
os.makedirs(TEMP_DIR, exist_ok=True)

# Read DATA from dfd-level-2.html
with open(os.path.join(WORKSPACE_DIR, "dfd-level-2.html"), "r", encoding="utf-8") as f:
    content = f.read()

m = re.search(r'const DATA\s*=\s*(\[[\s\S]*?\]);\s*const COL_W', content)
if not m:
    m = re.search(r'const DATA\s*=\s*(\[[\s\S]*?\]);\s*const CX', content)
if not m:
    raise Exception("Could not find DATA in dfd-level-2.html")

DATA = json.loads(m.group(1))

# File name slugs for each process
PROCESS_SLUGS = [
    "process-1-authenticate-users",
    "process-2-process-ojt-applications",
    "process-3-record-ojt-attendance",
    "process-4-manage-ojt-activities",
    "process-5-control-hte-access",
    "process-6-monitor-and-evaluate-ojt"
]

# Draw.io Styles
STYLE_PROCESS = (
    "rounded=1;arcSize=25;whiteSpace=wrap;html=1;fillColor=#ffffff;"
    "strokeColor=#000000;strokeWidth=2;fontColor=#000000;fontFamily=Helvetica;"
    "align=center;verticalAlign=middle;"
)
STYLE_ENTITY = (
    "rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;"
    "strokeColor=#000000;strokeWidth=2;fontColor=#000000;fontStyle=1;"
    "fontFamily=Helvetica;align=center;verticalAlign=middle;"
)
STYLE_STORE = (
    "shape=partialRectangle;whiteSpace=wrap;html=1;left=1;top=1;bottom=1;right=0;"
    "fillColor=#ffffff;strokeColor=#000000;strokeWidth=2;fontColor=#000000;"
    "fontFamily=Helvetica;align=center;verticalAlign=middle;"
)
STYLE_EDGE_BASE = (
    "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
    "strokeColor=#000000;strokeWidth=1.5;fontColor=#000000;fontSize=10;fontFamily=Helvetica;"
    "endArrow=block;endFill=1;labelBackgroundColor=#ffffff;labelBorderColor=#000000;"
)

def populate_single_process_drawio(root, di, cx_L=180, cx_C=600, cx_R=1020, y_start=90, RG=135):
    d = DATA[di]
    N = {}
    for n in d["nodes"]:
        N[n["id"]] = n

    p_nodes = [n for n in d["nodes"] if n["t"] == "p"]
    for i, n in enumerate(p_nodes):
        n["cx"] = cx_C
        n["cy"] = y_start + i * RG
        n["w"] = 180
        n["h"] = 65

    for t in ["e", "s"]:
        s_nodes = [n for n in d["nodes"] if n["t"] == t]
        for n in s_nodes:
            n["w"] = 160 if t == "e" else 215
            n["h"] = 56 if t == "e" else 52
            n["cx"] = cx_L if t == "e" else cx_R
            ys = [N[e[1]]["cy"] for e in d["edges"] if e[0] == n["id"] and e[1] in N and N[e[1]]["t"] == "p"] + \
                 [N[e[0]]["cy"] for e in d["edges"] if e[1] == n["id"] and e[0] in N and N[e[0]]["t"] == "p"]
            n["cy"] = sum(ys) / len(ys) if ys else y_start
        s_nodes.sort(key=lambda x: x["cy"])
        for i in range(1, len(s_nodes)):
            s_nodes[i]["cy"] = max(s_nodes[i]["cy"], s_nodes[i-1]["cy"] + 75)

    # 1. Nodes
    for n in d["nodes"]:
        node_cell_id = f"node_{n['id']}"
        if n["t"] == "p":
            val = f"<b>{n['n']}</b><br/>{html.escape(n['name'])}"
            style = STYLE_PROCESS
        elif n["t"] == "e":
            val = f"<b>{html.escape(n['name'])}</b>"
            style = STYLE_ENTITY
        else: # store
            val = f"<b>{n['n']}</b> | {html.escape(n['name'])}"
            style = STYLE_STORE

        node_cell = ET.SubElement(root, "mxCell", {
            "id": node_cell_id,
            "value": val,
            "style": style,
            "vertex": "1",
            "parent": "1"
        })
        ET.SubElement(node_cell, "mxGeometry", {
            "x": str(int(n["cx"] - n["w"]/2)),
            "y": str(int(n["cy"] - n["h"]/2)),
            "width": str(n["w"]),
            "height": str(n["h"]),
            "as": "geometry"
        })

    # 2. Edges with Anti-Collision Ports
    out_edges = {}
    in_edges = {}
    for ei, edge in enumerate(d["edges"]):
        out_edges.setdefault(edge[0], []).append(ei)
        in_edges.setdefault(edge[1], []).append(ei)

    for ei, edge in enumerate(d["edges"]):
        src = N[edge[0]]
        tgt = N[edge[1]]
        src_id = f"node_{src['id']}"
        tgt_id = f"node_{tgt['id']}"
        flow_label = edge[2]

        if src["t"] == "p" and tgt["t"] == "p":
            exit_side = "bottom" if src["cy"] < tgt["cy"] else "top"
            entry_side = "top" if src["cy"] < tgt["cy"] else "bottom"
        elif src["t"] == "p":
            exit_side = "left" if tgt["cx"] < src["cx"] else "right"
            entry_side = "right" if tgt["cx"] < src["cx"] else "left"
        else:
            exit_side = "right" if src["cx"] < tgt["cx"] else "left"
            entry_side = "left" if src["cx"] < tgt["cx"] else "right"

        out_list = out_edges[src["id"]]
        out_idx = out_list.index(ei)
        exit_frac = (out_idx + 1) / (len(out_list) + 1)

        in_list = in_edges[tgt["id"]]
        in_idx = in_list.index(ei)
        entry_frac = (in_idx + 1) / (len(in_list) + 1)

        if exit_side == "bottom":
            exit_x, exit_y = exit_frac, 1.0
        elif exit_side == "top":
            exit_x, exit_y = exit_frac, 0.0
        elif exit_side == "left":
            exit_x, exit_y = 0.0, exit_frac
        else:
            exit_x, exit_y = 1.0, exit_frac

        if entry_side == "bottom":
            entry_x, entry_y = entry_frac, 1.0
        elif entry_side == "top":
            entry_x, entry_y = entry_frac, 0.0
        elif entry_side == "left":
            entry_x, entry_y = 0.0, entry_frac
        else:
            entry_x, entry_y = 1.0, entry_frac

        edge_style = (
            f"{STYLE_EDGE_BASE}"
            f"exitX={exit_x:.2f};exitY={exit_y:.2f};exitDx=0;exitDy=0;"
            f"entryX={entry_x:.2f};entryY={entry_y:.2f};entryDx=0;entryDy=0;"
        )

        label_x_offset = -0.2 if (ei % 2 == 0) else 0.2

        edge_cell_id = f"edge_{ei}"
        edge_cell = ET.SubElement(root, "mxCell", {
            "id": edge_cell_id,
            "value": html.escape(flow_label),
            "style": edge_style,
            "edge": "1",
            "parent": "1",
            "source": src_id,
            "target": tgt_id
        })
        ET.SubElement(edge_cell, "mxGeometry", {
            "x": f"{label_x_offset:.2f}",
            "relative": "1",
            "as": "geometry"
        })

# 1. GENERATE SEPARATE DRAW.IO FILES
print("Generating separate Draw.io files for each process...")
for di, d in enumerate(DATA):
    slug = PROCESS_SLUGS[di]
    p_count = len([n for n in d["nodes"] if n["t"] == "p"])
    page_h = max(p_count * 145 + 240, 900)
    page_w = 1250

    mxfile = ET.Element("mxfile", {
        "host": "app.diagrams.net",
        "modified": "2026-09-25T03:20:00.000Z",
        "agent": "Antigravity IDE",
        "version": "24.7.17",
        "type": "device"
    })
    diag = ET.SubElement(mxfile, "diagram", {"id": f"diag_{slug}", "name": d["title"]})
    model = ET.SubElement(diag, "mxGraphModel", {
        "dx": "1200", "dy": "800", "grid": "1", "gridSize": "10",
        "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1",
        "fold": "1", "page": "1", "pageScale": "1",
        "pageWidth": str(page_w), "pageHeight": str(page_h),
        "background": "#ffffff", "math": "0", "shadow": "0"
    })
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    populate_single_process_drawio(root, di, cx_L=180, cx_C=620, cx_R=1040, y_start=100, RG=140)

    xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(mxfile, encoding="utf-8").decode("utf-8")
    
    out_name = f"dfd-{slug}.drawio"
    with open(os.path.join(WORKSPACE_DIR, out_name), "w", encoding="utf-8") as f:
        f.write(xml_str)
    with open(os.path.join(PUBLIC_DIR, out_name), "w", encoding="utf-8") as f:
        f.write(xml_str)
    print(f"Generated {out_name}")

# 2. GENERATE SEPARATE HIGH-RES JPEGS (PURE WHITE MONOCHROME)
def create_single_render_html(di, filename):
    d = DATA[di]
    p_count = len([n for n in d["nodes"] if n["t"] == "p"])
    svg_h = max(p_count * 145 + 240, 950)
    svg_w = 1250

    json_d = json.dumps([d])
    page_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
  background: #ffffff;
  color: #000000;
  font: 14px system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  padding: 30px 40px;
  width: {svg_w + 80}px;
  margin: 0 auto;
}}
header {{
  margin-bottom: 16px;
  border-bottom: 2px solid #000000;
  padding-bottom: 10px;
}}
h1 {{
  font-size: 24px;
  font-weight: 700;
  color: #000000;
  margin-bottom: 4px;
}}
p {{
  font-size: 13px;
  color: #333333;
}}
.legend {{
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 18px;
  font-size: 13px;
  color: #000000;
  font-weight: 600;
}}
.legend-item {{
  display: flex;
  align-items: center;
  gap: 7px;
}}
.legend-item i {{
  display: inline-block;
  width: 14px;
  height: 14px;
  background: #ffffff;
  border: 1.8px solid #000000;
}}
.legend-item .i-proc {{ border-radius: 4px; }}
.legend-item .i-store {{ border-right: none; }}
svg {{
  width: {svg_w}px;
  height: {svg_h}px;
  display: block;
  background: #ffffff;
}}
.arrow {{ fill: #000000; }}
.el {{ fill: none; stroke: #000000; stroke-width: 1.6; }}
.lb-box {{ fill: #ffffff; stroke: #000000; stroke-width: 0.8; rx: 3; ry: 3; }}
.lb {{ font-size: 11px; fill: #000000; font-weight: 600; text-anchor: middle; }}
.nt {{ font-size: 12px; fill: #000000; text-anchor: middle; }}
</style>
</head>
<body>
<header>
  <h1>Process {d['title']}</h1>
  <p>On-the-Job Training (OJT) Management System — Level 2 Data Flow Diagram</p>
</header>
<div class="legend">
  <span class="legend-item"><i class="i-proc"></i> Process</span>
  <span class="legend-item"><i></i> External Entity</span>
  <span class="legend-item"><i class="i-store"></i> Data Store</span>
</div>
<svg id="svg" viewBox="0 0 {svg_w} {svg_h}"></svg>
<script>
const DATA = {json_d};
const svg = document.getElementById('svg');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function wrap(s, max) {{
  const w = s.split(' '), L = [];
  let c = '';
  for (const x of w) {{
    if ((c + ' ' + x).trim().length > max && c) {{
      L.push(c);
      c = x;
    }} else {{
      c = (c + ' ' + x).trim();
    }}
  }}
  if (c) L.push(c);
  return L;
}}

const d = DATA[0];
const N = {{}};
d.nodes.forEach(n => N[n.id] = n);

const cx_L = 180, cx_C = 620, cx_R = 1040, y0 = 90, RG = 140;

d.nodes.filter(n => n.t == 'p').forEach((n, i) => {{
  n.cx = cx_C;
  n.cy = y0 + i * RG;
  n.w = 180;
  n.h = 65;
}});

for (const t of ['e', 's']) {{
  const S = d.nodes.filter(n => n.t == t);
  S.forEach(n => {{
    n.w = t == 'e' ? 160 : 215;
    n.h = t == 'e' ? 56 : 52;
    n.cx = t == 'e' ? cx_L : cx_R;
    const ys = d.edges.flatMap(e => e[0] == n.id ? [N[e[1]]] : e[1] == n.id ? [N[e[0]]] : []).filter(x => x && x.t == 'p').map(x => x.cy);
    n.cy = ys.length ? (ys.reduce((a, b) => a + b, 0) / ys.length) : y0;
  }});
  S.sort((a, b) => a.cy - b.cy);
  for (let i = 1; i < S.length; i++) S[i].cy = Math.max(S[i].cy, S[i - 1].cy + 75);
}}

function pt(n, s, f) {{
  const x = n.cx - n.w / 2, y = n.cy - n.h / 2;
  return s == 't' ? [x + n.w * f, y] :
         s == 'b' ? [x + n.w * f, y + n.h] :
         s == 'l' ? [x, y + n.h * f] : [x + n.w, y + n.h * f];
}}

function sides(a, b) {{
  if (a.t == 'p' && b.t == 'p') return a.cy < b.cy ? ['b', 't'] : ['t', 'b'];
  if (a.t == 'p') {{
    const l = b.cx < cx_C;
    return [l ? 'l' : 'r', l ? 'r' : 'l'];
  }}
  const l = a.cx < cx_C;
  return [l ? 'r' : 'l', l ? 'l' : 'r'];
}}

function route(p0, sa, p1, sb, j) {{
  const H = s => s == 'l' || s == 'r';
  if (H(sa) && H(sb)) {{
    if (sa == sb) {{
      const x = sa == 'l' ? Math.min(p0[0], p1[0]) - 40 : Math.max(p0[0], p1[0]) + 40;
      return [p0, [x, p0[1]], [x, p1[1]], p1];
    }}
    const m = (p0[0] + p1[0]) / 2 + (Math.abs(p0[1] - p1[1]) < 2 ? 0 : j);
    return [p0, [m, p0[1]], [m, p1[1]], p1];
  }}
  const m = (p0[1] + p1[1]) / 2;
  return [p0, [p0[0], m], [p1[0], m], p1];
}}

let s = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path class="arrow" d="M0 0L10 5L0 10z"/></marker></defs>';
const S = d.edges.map(e => sides(N[e[0]], N[e[1]])), g = {{}};
d.edges.forEach((e, i) => {{
  [[e[0], S[i][0], e[1]], [e[1], S[i][1], e[0]]].forEach(([nd, sd, o]) => {{
    (g[nd + sd] = g[nd + sd] || []).push([i, o, nd, sd]);
  }});
}});
const fr = {{}};
for (const k in g) {{
  const L = g[k], v = L[0][3] == 't' || L[0][3] == 'b';
  L.sort((a, b) => (v ? N[a[1]].cx - N[b[1]].cx : N[a[1]].cy - N[b[1]].cy) || a[0] - b[0]);
  L.forEach((x, j) => fr[x[0] + x[2] + x[3]] = (j + 1) / (L.length + 1));
}}

const labels = [];
d.edges.forEach(([a, b, l], i) => {{
  const [sa, sb] = S[i];
  const channelOffset = ((i * 7) % 5 - 2) * 18;
  const P = route(pt(N[a], sa, fr[i + a + sa]), sa, pt(N[b], sb, fr[i + b + sb]), sb, channelOffset);
  s += `<path class="el" marker-end="url(#ar)" d="${{P.map(p => p.join(',')).join('L')}}"/>`;

  let bs = 0, bl = -1;
  for (let j = 0; j < P.length - 1; j++) {{
    const L = Math.hypot(P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1]);
    if (L > bl) {{
      bl = L;
      bs = j;
    }}
  }}

  let mx = (P[bs][0] + P[bs + 1][0]) / 2;
  let my = (P[bs][1] + P[bs + 1][1]) / 2;

  if (Math.abs(P[bs][0] - P[bs+1][0]) < 2) {{
    const frac = 0.35 + ((i * 3) % 4) * 0.12;
    my = P[bs][1] + (P[bs+1][1] - P[bs][1]) * frac;
  }}

  const ls = wrap(l, 18);
  const maxLen = Math.max(...ls.map(t => t.length));
  const lw = maxLen * 7.0 + 16;
  const lh = ls.length * 13 + 6;
  labels.push({{ x: mx, y: my, w: lw, h: lh, lines: ls }});
}});

for (let pass = 0; pass < 25; pass++) {{
  for (let i = 0; i < labels.length; i++) {{
    for (let j = i + 1; j < labels.length; j++) {{
      const la = labels[i], lb = labels[j];
      const dx = Math.abs(la.x - lb.x);
      const dy = Math.abs(la.y - lb.y);
      const minX = (la.w + lb.w) / 2 + 8;
      const minY = (la.h + lb.h) / 2 + 6;

      if (dx < minX && dy < minY) {{
        const overlapX = minX - dx;
        const overlapY = minY - dy;
        if (overlapY <= overlapX) {{
          const shiftY = overlapY / 2 + 2;
          if (la.y <= lb.y) {{ la.y -= shiftY; lb.y += shiftY; }}
          else {{ la.y += shiftY; lb.y -= shiftY; }}
        }} else {{
          const shiftX = overlapX / 2 + 2;
          if (la.x <= lb.x) {{ la.x -= shiftX; lb.x += shiftX; }}
          else {{ la.x += shiftX; lb.x -= shiftX; }}
        }}
      }}
    }}
  }}
}}

d.nodes.forEach(n => {{
  const x = n.cx - n.w / 2, y = n.cy - n.h / 2;
  const sh = n.t == 'p' ? `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" rx="10" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>` :
             n.t == 'e' ? `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>` :
             `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" fill="#ffffff"/><path d="M${{x + n.w}},${{y}}H${{x}}V${{y + n.h}}H${{x + n.w}}" fill="none" stroke="#000000" stroke-width="1.8"/>`;
  const ls = n.t == 's' ? wrap(n.n + ' | ' + n.name, Math.floor(n.w / 7.2)) : [...(n.t == 'p' ? [n.n] : []), ...wrap(n.name, Math.floor(n.w / 7.2))], y0 = n.cy - (ls.length - 1) * 8 + 4;
  s += `<g class="node">${{sh}}<text class="nt" ${{n.t == 'e' ? 'font-weight="700"' : ''}}>${{ls.map((t, k) => `<tspan x="${{n.cx}}" y="${{y0 + k * 16}}" ${{n.t == 'p' && k == 0 ? 'font-weight="700"' : ''}}>${{esc(t)}}</tspan>`).join('')}}</text></g>`;
}});

let lab = '';
labels.forEach(l => {{
  lab += `<g>` +
         `<rect class="lb-box" x="${{l.x - l.w/2}}" y="${{l.y - l.h/2}}" width="${{l.w}}" height="${{l.h}}"/>` +
         `<text class="lb" x="${{l.x}}" y="${{l.y - (l.lines.length - 1) * 6.5 + 4}}">${{l.lines.map((t, k) => `<tspan x="${{l.x}}" dy="${{k ? 13 : 0}}">${{esc(t)}}</tspan>`).join('')}}</text>` +
         `</g>`;
}});

svg.innerHTML = s + lab;
</script>
</body>
</html>
"""
    file_path = os.path.join(TEMP_DIR, filename)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(page_html)
    return file_path, svg_w + 80, svg_h + 120

print("Rendering separate pure white monochrome JPEGs for each process...")
for di, d in enumerate(DATA):
    slug = PROCESS_SLUGS[di]
    html_name = f"render_{slug}.html"
    html_path, render_w, render_h = create_single_render_html(di, html_name)
    temp_png = os.path.join(TEMP_DIR, f"{slug}.png")

    cmd = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--force-device-scale-factor=1.5",
        f"--window-size={render_w},{render_h}",
        f"--screenshot={temp_png}",
        f"file:///{html_path.replace(os.sep, '/')}"
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(temp_png):
        print(f"Error capturing {slug}: {res.stderr}")
        continue

    im = Image.open(temp_png)
    rgb_im = im.convert('L').convert('RGB')

    target_name = f"dfd-{slug}.jpg"
    target_root = os.path.join(WORKSPACE_DIR, target_name)
    target_public = os.path.join(PUBLIC_DIR, target_name)

    rgb_im.save(target_root, "JPEG", quality=95, optimize=True)
    rgb_im.save(target_public, "JPEG", quality=95, optimize=True)

    print(f"Generated {target_name} ({rgb_im.size[0]}x{rgb_im.size[1]} px, {os.path.getsize(target_root)/1024:.1f} KB)")

# Cleanup scratch
try:
    shutil.rmtree(TEMP_DIR)
except Exception:
    pass

print("All individual processes successfully separated into Draw.io and JPEG files!")
