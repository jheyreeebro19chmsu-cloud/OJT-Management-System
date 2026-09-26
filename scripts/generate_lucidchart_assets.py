import os
import json
import re
import csv
import subprocess
import shutil
import xml.etree.ElementTree as ET

WORKSPACE_DIR = r"c:\CAPSTONE 1 - CODE"
PUBLIC_DIR = os.path.join(WORKSPACE_DIR, "public")
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(CHROME_PATH):
    CHROME_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

TEMP_DIR = os.path.join(WORKSPACE_DIR, "scratch", "lucid_tmp")
os.makedirs(TEMP_DIR, exist_ok=True)

# 1. READ DATA FROM dfd-level-2.html
with open(os.path.join(WORKSPACE_DIR, "dfd-level-2.html"), "r", encoding="utf-8") as f:
    content = f.read()

m = re.search(r'const DATA\s*=\s*(\[[\s\S]*?\]);\s*(?:let activeTab|const COL_W|const CX)', content)
if not m:
    raise Exception("Could not find DATA in dfd-level-2.html")
DATA = json.loads(m.group(1))

PROCESS_SLUGS = [
    "process-1-authenticate-users",
    "process-2-process-ojt-applications",
    "process-3-record-ojt-attendance",
    "process-4-manage-ojt-activities",
    "process-5-control-hte-access",
    "process-6-monitor-and-evaluate-ojt"
]

# 2. GENERATE .xml EXTENSION COPIES FOR DRAW.IO / LUCIDCHART
print("1. Creating .xml copies for Lucidchart import...")
for slug in PROCESS_SLUGS:
    drawio_name = f"dfd-{slug}.drawio"
    xml_name = f"dfd-{slug}.xml"
    src = os.path.join(WORKSPACE_DIR, drawio_name)
    if os.path.exists(src):
        shutil.copy2(src, os.path.join(WORKSPACE_DIR, xml_name))
        shutil.copy2(src, os.path.join(PUBLIC_DIR, xml_name))
        print(f"  Created {xml_name}")

# Also ensure dfd-level-2.xml is in public
if os.path.exists(os.path.join(WORKSPACE_DIR, "dfd-level-2.xml")):
    shutil.copy2(os.path.join(WORKSPACE_DIR, "dfd-level-2.xml"), os.path.join(PUBLIC_DIR, "dfd-level-2.xml"))

# 3. GENERATE LUCIDCHART PROCESS DIAGRAM CSVs
# Lucidchart format: ID, Name, Shape Library, Page ID, Contained By, Text Area 1, Line Source, Line Destination
print("2. Generating Lucidchart Process Diagram CSV files...")
for di, d in enumerate(DATA):
    slug = PROCESS_SLUGS[di]
    csv_name = f"dfd-{slug}-lucidchart.csv"
    csv_path_root = os.path.join(WORKSPACE_DIR, csv_name)
    csv_path_pub = os.path.join(PUBLIC_DIR, csv_name)
    
    rows = []
    # Add page row
    rows.append({
        "ID": "1",
        "Name": "Page",
        "Shape Library": "",
        "Page ID": "1",
        "Contained By": "",
        "Text Area 1": d["title"],
        "Line Source": "",
        "Line Destination": ""
    })
    
    id_map = {}
    row_id = 2
    
    # Add shapes
    for n in d["nodes"]:
        node_id_str = str(row_id)
        id_map[n["id"]] = node_id_str
        row_id += 1
        
        shape_type = "Process"
        if n["t"] == "e":
            shape_type = "External Entity" # or "Terminator"
            display_text = n["name"]
        elif n["t"] == "s":
            shape_type = "Data Store"
            display_text = f"{n['n']}: {n['name']}"
        else:
            shape_type = "Process"
            display_text = f"{n['n']} {n['name']}"
            
        rows.append({
            "ID": node_id_str,
            "Name": "Process" if n["t"] == "p" else ("Terminator" if n["t"] == "e" else "Data Store"),
            "Shape Library": "Flowchart Shapes",
            "Page ID": "1",
            "Contained By": "",
            "Text Area 1": display_text,
            "Line Source": "",
            "Line Destination": ""
        })
        
    # Add lines
    for edge in d["edges"]:
        u, v, label = edge[0], edge[1], edge[2]
        src_id = id_map.get(u, "")
        dst_id = id_map.get(v, "")
        
        line_id_str = str(row_id)
        row_id += 1
        
        rows.append({
            "ID": line_id_str,
            "Name": "Line",
            "Shape Library": "",
            "Page ID": "1",
            "Contained By": "",
            "Text Area 1": label,
            "Line Source": src_id,
            "Line Destination": dst_id
        })
        
    fields = ["ID", "Name", "Shape Library", "Page ID", "Contained By", "Text Area 1", "Line Source", "Line Destination"]
    for path in [csv_path_root, csv_path_pub]:
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
            
    print(f"  Created {csv_name} ({len(rows)} elements)")

# 4. GENERATE STANDALONE PURE SVG VECTOR FILES
print("3. Generating standalone vector SVG files for each process...")

def make_svg_html(di):
    d = DATA[di]
    p_count = len([n for n in d["nodes"] if n["t"] == "p"])
    svg_h = max(p_count * 145 + 240, 950)
    svg_w = 1250

    json_d = json.dumps([d])
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div id="container"></div>
<script>
const DATA = {json_d};
const CX = {{ L: 180, C: 620, R: 1040 }};
const W = {svg_w}, H = {svg_h};
const d = DATA[0];

function wrap(str, lim) {{
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(w => {{
    if ((cur + ' ' + w).trim().length <= lim) {{
      cur = (cur + ' ' + w).trim();
    }} else {{
      if (cur) lines.push(cur);
      cur = w;
    }}
  }});
  if (cur) lines.push(cur);
  return lines;
}}

function esc(s) {{
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}}

const procs = d.nodes.filter(n => n.t === 'p');
const ents = d.nodes.filter(n => n.t === 'e');
const stores = d.nodes.filter(n => n.t === 's');

const y_start = 100;
const RG = 140;

procs.forEach((p, idx) => {{
  p.cx = CX.C;
  p.cy = y_start + idx * RG;
  p.w = 180;
  p.h = 65;
}});

const leftItems = [...ents];
if (leftItems.length > 0) {{
  const lSpan = Math.max((procs.length - 1) * RG, 300);
  const lStep = leftItems.length > 1 ? lSpan / (leftItems.length - 1) : 0;
  leftItems.forEach((e, idx) => {{
    e.cx = CX.L;
    e.cy = leftItems.length === 1 ? y_start + (procs.length - 1) * RG / 2 : y_start + idx * lStep;
    e.w = 160;
    e.h = 56;
  }});
}}

stores.forEach((s, idx) => {{
  s.cx = CX.R;
  s.cy = y_start + idx * 160 + (procs.length > 3 ? 120 : 60);
  s.w = 215;
  s.h = 52;
}});

const nm = {{}};
d.nodes.forEach(n => nm[n.id] = n);

const outMap = {{}};
const inMap = {{}};
d.edges.forEach((edge, eidx) => {{
  const u = edge[0], v = edge[1];
  if (!outMap[u]) outMap[u] = [];
  outMap[u].push({{ eidx, v }});
  if (!inMap[v]) inMap[v] = [];
  inMap[v].push({{ eidx, u }});
}});

let svgContent = `<svg id="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${{W}} ${{H}}" width="${{W}}" height="${{H}}" style="background:#ffffff;font-family:Helvetica,Arial,sans-serif;">` +
  `<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
  `<path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#000000"/></marker></defs>` +
  `<rect width="${{W}}" height="${{H}}" fill="#ffffff"/>` +
  `<text x="40" y="45" font-size="20" font-weight="700" fill="#000000">${{esc(d.title)}}</text>` +
  `<text x="40" y="68" font-size="12" fill="#444444">Level 2 Data Flow Diagram – Pure White Monochrome (Lucidchart / Visio / Draw.io Compatible)</text>`;

let edgesSvg = '';
const labels = [];

d.edges.forEach((edge, eidx) => {{
  const u = nm[edge[0]], v = nm[edge[1]], txt = edge[2];
  if (!u || !v) return;

  const outs = outMap[u.id] || [];
  const ins = inMap[v.id] || [];
  const outOrder = outs.findIndex(o => o.eidx === eidx);
  const inOrder = ins.findIndex(i => i.eidx === eidx);

  const fracOut = outs.length > 1 ? (outOrder + 1) / (outs.length + 1) : 0.5;
  const fracIn = ins.length > 1 ? (inOrder + 1) / (ins.length + 1) : 0.5;

  let x1, y1, x2, y2, dPath;
  let mx, my;

  if (u.cx === v.cx) {{
    const sign = v.cy > u.cy ? 1 : -1;
    x1 = u.cx - u.w * 0.2 + fracOut * (u.w * 0.4);
    y1 = sign > 0 ? u.cy + u.h / 2 : u.cy - u.h / 2;
    x2 = v.cx - v.w * 0.2 + fracIn * (v.w * 0.4);
    y2 = sign > 0 ? v.cy - v.h / 2 : v.cy + v.h / 2;
    dPath = `M ${{x1}} ${{y1}} L ${{x2}} ${{y2}}`;
    mx = (x1 + x2) / 2 + 35;
    my = (y1 + y2) / 2;
  }} else if (u.cx < v.cx) {{
    x1 = u.cx + u.w / 2;
    y1 = u.cy - u.h * 0.35 + fracOut * (u.h * 0.7);
    x2 = v.cx - v.w / 2;
    y2 = v.cy - v.h * 0.35 + fracIn * (v.h * 0.7);

    const midX = (x1 + x2) / 2 + (outOrder - (outs.length-1)/2) * 16;
    dPath = `M ${{x1}} ${{y1}} L ${{midX}} ${{y1}} L ${{midX}} ${{y2}} L ${{x2}} ${{y2}}`;
    mx = midX;
    my = (y1 + y2) / 2;
  }} else {{
    x1 = u.cx - u.w / 2;
    y1 = u.cy - u.h * 0.35 + fracOut * (u.h * 0.7);
    x2 = v.cx + v.w / 2;
    y2 = v.cy - v.h * 0.35 + fracIn * (v.h * 0.7);

    const midX = (x1 + x2) / 2 + (outOrder - (outs.length-1)/2) * 16;
    dPath = `M ${{x1}} ${{y1}} L ${{midX}} ${{y1}} L ${{midX}} ${{y2}} L ${{x2}} ${{y2}}`;
    mx = midX;
    my = (y1 + y2) / 2;
  }}

  edgesSvg += `<path d="${{dPath}}" fill="none" stroke="#000000" stroke-width="1.5" marker-end="url(#arr)"/>`;

  const lines = wrap(txt, 22);
  const maxLen = Math.max(...lines.map(l => l.length));
  labels.push({{
    x: mx,
    y: my,
    w: Math.max(maxLen * 6.5 + 16, 75),
    h: lines.length * 13 + 10,
    lines: lines
  }});
}});

for (let iter = 0; iter < 12; iter++) {{
  for (let i = 0; i < labels.length; i++) {{
    for (let j = i + 1; j < labels.length; j++) {{
      const la = labels[i], lb = labels[j];
      const dx = Math.abs(la.x - lb.x);
      const dy = Math.abs(la.y - lb.y);
      const reqX = (la.w + lb.w) / 2 + 8;
      const reqY = (la.h + lb.h) / 2 + 6;

      if (dx < reqX && dy < reqY) {{
        const overlapX = reqX - dx;
        const overlapY = reqY - dy;
        if (overlapY < overlapX) {{
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

let nodesSvg = '';
d.nodes.forEach(n => {{
  const x = n.cx - n.w / 2, y = n.cy - n.h / 2;
  const sh = n.t == 'p' ? `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" rx="10" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>` :
             n.t == 'e' ? `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>` :
             `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" fill="#ffffff"/><path d="M${{x + n.w}},${{y}}H${{x}}V${{y + n.h}}H${{x + n.w}}" fill="none" stroke="#000000" stroke-width="1.8"/>`;
  const ls = n.t == 's' ? wrap(n.n + ' | ' + n.name, Math.floor(n.w / 7.2)) : [...(n.t == 'p' ? [n.n] : []), ...wrap(n.name, Math.floor(n.w / 7.2))], y0 = n.cy - (ls.length - 1) * 8 + 4;
  nodesSvg += `<g>${{sh}}<text text-anchor="middle" font-size="12" fill="#000000" ${{n.t == 'e' ? 'font-weight="700"' : ''}}>${{ls.map((t, k) => `<tspan x="${{n.cx}}" y="${{y0 + k * 16}}" ${{n.t == 'p' && k == 0 ? 'font-weight="700"' : ''}}>${{esc(t)}}</tspan>`).join('')}}</text></g>`;
}});

let labelsSvg = '';
labels.forEach(l => {{
  labelsSvg += `<g>` +
         `<rect x="${{l.x - l.w/2}}" y="${{l.y - l.h/2}}" width="${{l.w}}" height="${{l.h}}" rx="3" ry="3" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>` +
         `<text text-anchor="middle" font-size="11" font-weight="600" fill="#000000" x="${{l.x}}" y="${{l.y - (l.lines.length - 1) * 6.5 + 4}}">${{l.lines.map((t, k) => `<tspan x="${{l.x}}" dy="${{k ? 13 : 0}}">${{esc(t)}}</tspan>`).join('')}}</text>` +
         `</g>`;
}});

document.getElementById('container').innerHTML = svgContent + edgesSvg + nodesSvg + labelsSvg + '</svg>';
</script>
</body>
</html>
"""

for di, slug in enumerate(PROCESS_SLUGS):
    html_str = make_svg_html(di)
    tmp_html = os.path.join(TEMP_DIR, f"temp_{slug}.html")
    with open(tmp_html, "w", encoding="utf-8") as f:
        f.write(html_str)
        
    cmd = [CHROME_PATH, "--headless=new", "--disable-gpu", "--dump-dom", f"file:///{tmp_html.replace(os.sep, '/')}"]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    
    m_svg = re.search(r'(<svg[\s\S]*?</svg>)', res.stdout)
    if m_svg:
        svg_code = '<?xml version="1.0" encoding="UTF-8"?>\n' + m_svg.group(1)
        svg_root = os.path.join(WORKSPACE_DIR, f"dfd-{slug}.svg")
        svg_pub = os.path.join(PUBLIC_DIR, f"dfd-{slug}.svg")
        with open(svg_root, "w", encoding="utf-8") as f:
            f.write(svg_code)
        with open(svg_pub, "w", encoding="utf-8") as f:
            f.write(svg_code)
        print(f"  Created dfd-{slug}.svg ({len(svg_code)} bytes)")
    else:
        print(f"  Failed to extract SVG for {slug}")

# Clean temporary files
try:
    shutil.rmtree(TEMP_DIR)
except Exception:
    pass

print("All Lucidchart assets (.xml, .svg, .csv) generated successfully!")
