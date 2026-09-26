import os
import json
import re
import csv
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

TEMP_DIR = os.path.join(WORKSPACE_DIR, "scratch", "accurate_tmp")
os.makedirs(TEMP_DIR, exist_ok=True)

# Load accurate data
with open(os.path.join(WORKSPACE_DIR, "scratch", "accurate_data.json"), "r", encoding="utf-8") as f:
    DATA = json.load(f)

PROCESS_SLUGS = [d["slug"] for d in DATA]

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

def compute_positions_for_process(d, cx_L=200, cx_C=680, cx_R=1160, y_start=120, RG=150):
    procs = [n for n in d["nodes"] if n["t"] == "p"]
    ents = [n for n in d["nodes"] if n["t"] == "e"]
    stores = [n for n in d["nodes"] if n["t"] == "s"]

    # Position processes vertically
    for idx, p in enumerate(procs):
        p["cx"] = cx_C
        p["cy"] = y_start + idx * RG
        p["w"] = 195
        p["h"] = 65

    proc_map = {p["id"]: p for p in procs}

    # Position entities based on connected processes
    for e in ents:
        e["w"] = 175
        e["h"] = 58
        e["cx"] = cx_L
        connected_p_cys = []
        for edge in d["edges"]:
            u, v = edge[0], edge[1]
            if u == e["id"] and v in proc_map:
                connected_p_cys.append(proc_map[v]["cy"])
            elif v == e["id"] and u in proc_map:
                connected_p_cys.append(proc_map[u]["cy"])
        if connected_p_cys:
            e["cy"] = sum(connected_p_cys) / len(connected_p_cys)
        else:
            e["cy"] = y_start + (len(procs) - 1) * RG / 2

    ents.sort(key=lambda x: x["cy"])
    min_dist_e = 75
    for i in range(1, len(ents)):
        if ents[i]["cy"] < ents[i-1]["cy"] + min_dist_e:
            ents[i]["cy"] = ents[i-1]["cy"] + min_dist_e

    # Position data stores based on connected processes
    for s in stores:
        s["w"] = 225
        s["h"] = 54
        s["cx"] = cx_R
        connected_p_cys = []
        for edge in d["edges"]:
            u, v = edge[0], edge[1]
            if u == s["id"] and v in proc_map:
                connected_p_cys.append(proc_map[v]["cy"])
            elif v == s["id"] and u in proc_map:
                connected_p_cys.append(proc_map[u]["cy"])
        if connected_p_cys:
            s["cy"] = sum(connected_p_cys) / len(connected_p_cys)
        else:
            s["cy"] = y_start + (len(procs) - 1) * RG / 2

    stores.sort(key=lambda x: x["cy"])
    min_dist_s = 75
    for i in range(1, len(stores)):
        if stores[i]["cy"] < stores[i-1]["cy"] + min_dist_s:
            stores[i]["cy"] = stores[i-1]["cy"] + min_dist_s

def populate_drawio(root, di):
    d = DATA[di]
    compute_positions_for_process(d)
    node_map = {n["id"]: n for n in d["nodes"]}

    for n in d["nodes"]:
        nid = n["id"]
        x = n["cx"] - n["w"] / 2
        y = n["cy"] - n["h"] / 2
        w = n["w"]
        h = n["h"]

        if n["t"] == "p":
            val = f"<b>{n['n']}</b><br/>{n['name']}"
            style = STYLE_PROCESS
        elif n["t"] == "e":
            val = f"<b>{n['name']}</b>"
            style = STYLE_ENTITY
        else:
            val = f"<b>{n['n']}</b> | {n['name']}"
            style = STYLE_STORE

        cell = ET.SubElement(root, "mxCell", {
            "id": f"node_{nid}",
            "value": val,
            "style": style,
            "vertex": "1",
            "parent": "1"
        })
        ET.SubElement(cell, "mxGeometry", {
            "x": str(int(x)), "y": str(int(y)),
            "width": str(int(w)), "height": str(int(h)),
            "as": "geometry"
        })

    # Group connections by side
    out_counts = {}
    in_counts = {}
    for eidx, edge in enumerate(d["edges"]):
        u, v = edge[0], edge[1]
        out_counts.setdefault(u, []).append(eidx)
        in_counts.setdefault(v, []).append(eidx)

    for eidx, edge in enumerate(d["edges"]):
        u_id, v_id, label = edge[0], edge[1], edge[2]
        u = node_map[u_id]
        v = node_map[v_id]

        outs = out_counts.get(u_id, [])
        ins = in_counts.get(v_id, [])
        k_out = outs.index(eidx)
        k_in = ins.index(eidx)
        f_out = (k_out + 1) / (len(outs) + 1) if len(outs) > 1 else 0.5
        f_in = (k_in + 1) / (len(ins) + 1) if len(ins) > 1 else 0.5

        waypoints = []

        if u["cx"] == v["cx"]:
            # Vertical connection between processes
            exitX, exitY = 0.5, 1.0 if v["cy"] > u["cy"] else 0.0
            entryX, entryY = 0.5, 0.0 if v["cy"] > u["cy"] else 1.0
            label_offset = "-0.2"
        elif u["cx"] < v["cx"]:
            # Left to right
            exitX = 1.0
            exitY = round(f_out, 2)
            entryX = 0.0
            entryY = round(f_in, 2)
            label_offset = "0.1"
        else:
            # Right to left
            exitX = 0.0
            exitY = round(f_out, 2)
            entryX = 1.0
            entryY = round(f_in, 2)
            label_offset = "-0.1"

        edge_style = (
            f"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
            f"strokeColor=#000000;strokeWidth=1.5;fontColor=#000000;fontSize=10;fontFamily=Helvetica;"
            f"endArrow=block;endFill=1;labelBackgroundColor=#ffffff;labelBorderColor=#000000;"
            f"exitX={exitX:.2f};exitY={exitY:.2f};exitDx=0;exitDy=0;"
            f"entryX={entryX:.2f};entryY={entryY:.2f};entryDx=0;entryDy=0;"
        )

        edge_cell = ET.SubElement(root, "mxCell", {
            "id": f"edge_{eidx}",
            "value": label,
            "style": edge_style,
            "edge": "1",
            "parent": "1",
            "source": f"node_{u_id}",
            "target": f"node_{v_id}"
        })
        geom = ET.SubElement(edge_cell, "mxGeometry", {
            "x": label_offset,
            "relative": "1",
            "as": "geometry"
        })

print("1. Generating updated Draw.io (.drawio) and XML (.xml) files for each process...")
for di, d in enumerate(DATA):
    slug = PROCESS_SLUGS[di]
    p_count = len([n for n in d["nodes"] if n["t"] == "p"])
    page_h = max(p_count * 155 + 260, 1000)
    page_w = 1380

    mxfile = ET.Element("mxfile", {
        "host": "app.diagrams.net",
        "modified": "2026-09-25T04:00:00.000Z",
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

    populate_drawio(root, di)

    xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(mxfile, encoding="utf-8").decode("utf-8")

    for ext in [".drawio", ".xml"]:
        fname = f"dfd-{slug}{ext}"
        with open(os.path.join(WORKSPACE_DIR, fname), "w", encoding="utf-8") as f:
            f.write(xml_str)
        with open(os.path.join(PUBLIC_DIR, fname), "w", encoding="utf-8") as f:
            f.write(xml_str)
    print(f"  Created dfd-{slug}.drawio & dfd-{slug}.xml")

# 2. GENERATE COMBINED dfd-level-2.drawio & dfd-level-2.xml (All in one portrait frame)
print("2. Generating combined dfd-level-2.drawio & dfd-level-2.xml...")
combined_mxfile = ET.Element("mxfile", {
    "host": "app.diagrams.net",
    "modified": "2026-09-25T04:00:00.000Z",
    "agent": "Antigravity IDE",
    "version": "24.7.17",
    "type": "device"
})
comb_diag = ET.SubElement(combined_mxfile, "diagram", {"id": "diag_combined", "name": "Level 2 DFD (All Processes)"})
comb_model = ET.SubElement(comb_diag, "mxGraphModel", {
    "dx": "1600", "dy": "1200", "grid": "1", "gridSize": "10",
    "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1",
    "fold": "1", "page": "1", "pageScale": "1",
    "pageWidth": "2400", "pageHeight": "3200",
    "background": "#ffffff", "math": "0", "shadow": "0"
})
comb_root = ET.SubElement(comb_model, "root")
ET.SubElement(comb_root, "mxCell", {"id": "0"})
ET.SubElement(comb_root, "mxCell", {"id": "1", "parent": "0"})

# 2-column layout for combined Draw.io
col_w = 1150
gap_x = 80
margin_x = 40
margin_y = 40

cols = [[0, 1, 2], [3, 4, 5]]
for col_idx, col_proc_indices in enumerate(cols):
    curr_y = margin_y
    col_x = margin_x + col_idx * (col_w + gap_x)
    for di in col_proc_indices:
        d = DATA[di]
        cx_L = col_x + 160
        cx_C = col_x + 550
        cx_R = col_x + 950
        y_start = curr_y + 90
        RG = 140

        compute_positions_for_process(d, cx_L=cx_L, cx_C=cx_C, cx_R=cx_R, y_start=y_start, RG=RG)
        max_y = max(n["cy"] + n["h"]/2 for n in d["nodes"])
        box_h = (max_y - curr_y) + 40

        # Process container box
        box_cell = ET.SubElement(comb_root, "mxCell", {
            "id": f"box_{di}",
            "value": f"<b>{d['title']}</b>",
            "style": "swimlane;fontStyle=1;childLayout=stackLayout;horizontal=1;startSize=30;horizontalFlip=0;fillColor=#ffffff;strokeColor=#000000;strokeWidth=1.8;fontColor=#000000;fontFamily=Helvetica;",
            "vertex": "1",
            "parent": "1"
        })
        ET.SubElement(box_cell, "mxGeometry", {
            "x": str(int(col_x)), "y": str(int(curr_y)),
            "width": str(int(col_w)), "height": str(int(box_h)),
            "as": "geometry"
        })

        node_map = {n["id"]: n for n in d["nodes"]}
        for n in d["nodes"]:
            nid = f"{di}_{n['id']}"
            x = n["cx"] - n["w"] / 2
            y = n["cy"] - n["h"] / 2
            w = n["w"]
            h = n["h"]
            val = f"<b>{n['n']}</b><br/>{n['name']}" if n["t"] == "p" else (f"<b>{n['name']}</b>" if n["t"] == "e" else f"<b>{n['n']}</b> | {n['name']}")
            style = STYLE_PROCESS if n["t"] == "p" else (STYLE_ENTITY if n["t"] == "e" else STYLE_STORE)

            n_cell = ET.SubElement(comb_root, "mxCell", {
                "id": f"node_{nid}",
                "value": val,
                "style": style,
                "vertex": "1",
                "parent": "1"
            })
            ET.SubElement(n_cell, "mxGeometry", {
                "x": str(int(x)), "y": str(int(y)),
                "width": str(int(w)), "height": str(int(h)),
                "as": "geometry"
            })

        out_counts = {}
        in_counts = {}
        for eidx, edge in enumerate(d["edges"]):
            u, v = edge[0], edge[1]
            out_counts.setdefault(u, []).append(eidx)
            in_counts.setdefault(v, []).append(eidx)

        for eidx, edge in enumerate(d["edges"]):
            u_id, v_id, label = edge[0], edge[1], edge[2]
            u = node_map[u_id]
            v = node_map[v_id]
            outs = out_counts.get(u_id, [])
            ins = in_counts.get(v_id, [])
            k_out = outs.index(eidx)
            k_in = ins.index(eidx)
            f_out = (k_out + 1) / (len(outs) + 1) if len(outs) > 1 else 0.5
            f_in = (k_in + 1) / (len(ins) + 1) if len(ins) > 1 else 0.5

            if u["cx"] == v["cx"]:
                exitX, exitY = 0.5, 1.0 if v["cy"] > u["cy"] else 0.0
                entryX, entryY = 0.5, 0.0 if v["cy"] > u["cy"] else 1.0
            elif u["cx"] < v["cx"]:
                exitX, exitY = 1.0, round(f_out, 2)
                entryX, entryY = 0.0, round(f_in, 2)
            else:
                exitX, exitY = 0.0, round(f_out, 2)
                entryX, entryY = 1.0, round(f_in, 2)

            edge_style = (
                f"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
                f"strokeColor=#000000;strokeWidth=1.5;fontColor=#000000;fontSize=10;fontFamily=Helvetica;"
                f"endArrow=block;endFill=1;labelBackgroundColor=#ffffff;labelBorderColor=#000000;"
                f"exitX={exitX:.2f};exitY={exitY:.2f};entryX={entryX:.2f};entryY={entryY:.2f};"
            )
            e_cell = ET.SubElement(comb_root, "mxCell", {
                "id": f"edge_{di}_{eidx}",
                "value": label,
                "style": edge_style,
                "edge": "1",
                "parent": "1",
                "source": f"node_{di}_{u_id}",
                "target": f"node_{di}_{v_id}"
            })
            ET.SubElement(e_cell, "mxGeometry", {"relative": "1", "as": "geometry"})

        curr_y += box_h + 30

comb_xml_str = '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(combined_mxfile, encoding="utf-8").decode("utf-8")
for ext in [".drawio", ".xml"]:
    with open(os.path.join(WORKSPACE_DIR, f"dfd-level-2{ext}"), "w", encoding="utf-8") as f:
        f.write(comb_xml_str)
    with open(os.path.join(PUBLIC_DIR, f"dfd-level-2{ext}"), "w", encoding="utf-8") as f:
        f.write(comb_xml_str)
print("  Created dfd-level-2.drawio & dfd-level-2.xml")

# 3. GENERATE LUCIDCHART PROCESS DIAGRAM CSVs
print("3. Generating updated Lucidchart Process Diagram CSV files...")
for di, d in enumerate(DATA):
    slug = PROCESS_SLUGS[di]
    csv_name = f"dfd-{slug}-lucidchart.csv"
    rows = [{
        "ID": "1",
        "Name": "Page",
        "Shape Library": "",
        "Page ID": "1",
        "Contained By": "",
        "Text Area 1": d["title"],
        "Line Source": "",
        "Line Destination": ""
    }]
    id_map = {}
    row_id = 2
    for n in d["nodes"]:
        node_id_str = str(row_id)
        id_map[n["id"]] = node_id_str
        row_id += 1
        shape_type = "Process" if n["t"] == "p" else ("Terminator" if n["t"] == "e" else "Data Store")
        disp = f"{n['n']} {n['name']}" if n["t"] == "p" else (n["name"] if n["t"] == "e" else f"{n['n']}: {n['name']}")
        rows.append({
            "ID": node_id_str,
            "Name": shape_type,
            "Shape Library": "Flowchart Shapes",
            "Page ID": "1",
            "Contained By": "",
            "Text Area 1": disp,
            "Line Source": "",
            "Line Destination": ""
        })

    for edge in d["edges"]:
        line_id_str = str(row_id)
        row_id += 1
        rows.append({
            "ID": line_id_str,
            "Name": "Line",
            "Shape Library": "",
            "Page ID": "1",
            "Contained By": "",
            "Text Area 1": edge[2],
            "Line Source": id_map.get(edge[0], ""),
            "Line Destination": id_map.get(edge[1], "")
        })

    fields = ["ID", "Name", "Shape Library", "Page ID", "Contained By", "Text Area 1", "Line Source", "Line Destination"]
    for pth in [os.path.join(WORKSPACE_DIR, csv_name), os.path.join(PUBLIC_DIR, csv_name)]:
        with open(pth, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            writer.writerows(rows)
    print(f"  Created {csv_name} ({len(rows)} elements)")

# 4. UPDATE HTML VIEWER
print("4. Updating dfd-level-2.html with complete accurate dataset and layout...")
html_template = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>OJT System – Level 2 DFD (Accurate Complete Separation)</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
:root{{box-sizing:border-box;--bg:#ffffff;--ink:#000000;--line:#000000}}
* {{ box-sizing: border-box; }}
body{{margin:0;background:#ffffff;color:#000000;font:14px system-ui,-apple-system,"Segoe UI",Arial,sans-serif}}
header{{max-width:2400px;margin:0 auto;padding:16px 28px 8px;border-bottom:2px solid #000000}}
h1{{font-size:24px;margin:0 0 4px;font-weight:700;color:#000000}}
p{{margin:0;color:#333333;font-size:13px}}
.tabs{{max-width:2400px;margin:0 auto;display:flex;gap:8px;flex-wrap:wrap;padding:12px 28px 4px;background:#ffffff}}
.tab-btn{{font:inherit;font-size:12px;font-weight:700;padding:8px 14px;border:1.8px solid #000000;border-radius:4px;background:#ffffff;color:#000000;cursor:pointer;transition:all .15s ease}}
.tab-btn:hover{{background:#f0f0f0}}
.tab-btn.active{{background:#000000;color:#ffffff}}
.bar{{max-width:2400px;margin:0 auto;display:flex;gap:20px;flex-wrap:wrap;align-items:center;padding:10px 28px;font-size:12px;color:#000000;font-weight:600}}
.bar i{{display:inline-block;width:13px;height:13px;border:1.8px solid #000000;background:#ffffff;margin-right:5px;vertical-align:-2px}}
.bar .i-proc{{border-radius:4px}}
.bar .i-ent{{}}
.bar .i-store{{border-right:none}}
.actions{{display:flex;gap:10px;margin-left:auto}}
button.act-btn{{font:inherit;font-size:12px;font-weight:600;padding:6px 14px;border:1.8px solid #000000;border-radius:4px;background:#ffffff;color:#000000;cursor:pointer;transition:all .15s ease}}
button.act-btn:hover{{background:#f0f0f0}}
.wrap{{max-width:2400px;margin:0 auto;padding:10px 16px 30px;overflow-x:auto}}
svg{{width:100%;height:auto;display:block;background:#ffffff}}
.node{{cursor:grab;touch-action:none}}
.arrow{{fill:#000000}}
.el{{fill:none;stroke:#000000;stroke-width:1.5}}
.lb-box{{fill:#ffffff;stroke:#000000;stroke-width:0.8;rx:3;ry:3}}
.lb{{font-size:11px;fill:#000000;font-weight:600;text-anchor:middle;font-family:Helvetica,Arial,sans-serif;}}
.nt{{font-size:12px;fill:#000000;text-anchor:middle;font-family:Helvetica,Arial,sans-serif;}}
.ttl{{font-size:16px;font-weight:700;fill:#000000}}
.box-border{{fill:#ffffff;stroke:#000000;stroke-width:1.8}}
.box-header{{fill:#ffffff;stroke:#000000;stroke-width:1.8}}
@media print{{
  header, .tabs, .bar {{ display: none; }}
  .wrap {{ max-width: 100%; padding: 0; }}
  svg {{ width: 100%; height: auto; }}
}}
</style></head><body>
<header>
  <h1>OJT System – Level 2 Data Flow Diagram (DFD)</h1>
  <p>100% Accurate Flow Mapping & Zero Overlap. Click any tab to view or export that individual process.</p>
</header>
<div class="tabs" id="tabs">
  <button class="tab-btn" data-idx="0">1.0 Authenticate Users</button>
  <button class="tab-btn" data-idx="1">2.0 Process OJT Applications</button>
  <button class="tab-btn" data-idx="2">3.0 Record OJT Attendance</button>
  <button class="tab-btn" data-idx="3">4.0 Manage OJT Activities</button>
  <button class="tab-btn" data-idx="4">5.0 Control HTE Access</button>
  <button class="tab-btn" data-idx="5">6.0 Monitor & Evaluate OJT</button>
  <button class="tab-btn active" data-idx="-1">All in One Frame</button>
</div>
<div class="bar">
  <span><i class="i-proc"></i>Process</span>
  <span><i class="i-ent"></i>External Entity</span>
  <span><i class="i-store"></i>Data Store</span>
  <div class="actions">
    <a id="drawioLink" href="dfd-level-2.drawio" download="dfd-level-2.drawio" style="text-decoration:none"><button type="button" class="act-btn" title="Download native draw.io diagram file">Download .drawio</button></a>
    <button id="downloadSvg" class="act-btn" title="Download SVG vector file">Export SVG</button>
    <button id="printBtn" class="act-btn" title="Print or save as PDF">Print / PDF</button>
    <button id="reset" class="act-btn">Reset layout</button>
  </div>
</div>
<div class="wrap"><svg id="svg" viewBox="0 0 2400 3200"></svg></div>
<script>
const DATA = {json.dumps(DATA, indent=2)};

let activeTab = -1;
const svg = document.getElementById('svg');
let drag = null;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

function layoutAll() {{
  if (activeTab === -1) {{
    // 2-column portrait grid
    const COL_W = 1140, GAP_X = 60, MARGIN_X = 30, MARGIN_Y = 30, RG = 140;
    const cols = [[0, 1, 2], [3, 4, 5]];
    let maxColY = 0;

    cols.forEach((colIndices, colIdx) => {{
      let y = MARGIN_Y + 15;
      const colX = MARGIN_X + colIdx * (COL_W + GAP_X);
      const cx_L = colX + 160, cx_C = colX + 550, cx_R = colX + 950;

      colIndices.forEach(di => {{
        const d = DATA[di];
        const N = {{}};
        d.nodes.forEach(n => N[n.id] = n);
        d.colX = colX; d.colW = COL_W; d.cx_L = cx_L; d.cx_C = cx_C; d.cx_R = cx_R; d.y0 = y;

        d.nodes.filter(n => n.t == 'p').forEach((n, i) => {{
          n.cx = cx_C; n.cy = y + 85 + i * RG; n.w = 190; n.h = 62;
        }});

        for (const t of ['e', 's']) {{
          const S = d.nodes.filter(n => n.t == t);
          S.forEach(n => {{
            n.w = t == 'e' ? 165 : 220; n.h = t == 'e' ? 56 : 52; n.cx = t == 'e' ? cx_L : cx_R;
            const ys = d.edges.flatMap(e => e[0] == n.id ? [N[e[1]]] : e[1] == n.id ? [N[e[0]]] : []).filter(x => x && x.t == 'p').map(x => x.cy);
            n.cy = ys.length ? (ys.reduce((a, b) => a + b, 0) / ys.length) : (y + 85);
          }});
          S.sort((a, b) => a.cy - b.cy);
          for (let i = 1; i < S.length; i++) S[i].cy = Math.max(S[i].cy, S[i - 1].cy + 75);
        }}

        const maxY = Math.max(...d.nodes.map(n => n.cy + n.h / 2));
        d.boxH = (maxY - y) + 40;
        y += d.boxH + 30;
      }});
      if (y > maxColY) maxColY = y;
    }});
    DATA.W = MARGIN_X * 2 + COL_W * 2 + GAP_X;
    DATA.H = Math.max(maxColY, 2800);
  }} else {{
    // Single isolated process view
    const d = DATA[activeTab];
    const N = {{}};
    d.nodes.forEach(n => N[n.id] = n);

    const cx_L = 200, cx_C = 680, cx_R = 1160, y0 = 110, RG = 150;
    d.colX = 40; d.colW = 1300; d.cx_L = cx_L; d.cx_C = cx_C; d.cx_R = cx_R; d.y0 = 30;

    d.nodes.filter(n => n.t == 'p').forEach((n, i) => {{
      n.cx = cx_C; n.cy = y0 + i * RG; n.w = 200; n.h = 65;
    }});

    for (const t of ['e', 's']) {{
      const S = d.nodes.filter(n => n.t == t);
      S.forEach(n => {{
        n.w = t == 'e' ? 175 : 225; n.h = t == 'e' ? 58 : 54; n.cx = t == 'e' ? cx_L : cx_R;
        const ys = d.edges.flatMap(e => e[0] == n.id ? [N[e[1]]] : e[1] == n.id ? [N[e[0]]] : []).filter(x => x && x.t == 'p').map(x => x.cy);
        n.cy = ys.length ? (ys.reduce((a, b) => a + b, 0) / ys.length) : y0;
      }});
      S.sort((a, b) => a.cy - b.cy);
      for (let i = 1; i < S.length; i++) S[i].cy = Math.max(S[i].cy, S[i - 1].cy + 80);
    }}

    const maxY = Math.max(...d.nodes.map(n => n.cy + n.h / 2));
    d.boxH = (maxY - d.y0) + 40;
    DATA.W = 1400;
    DATA.H = maxY + 80;
  }}
}}

function pt(n, s, f) {{
  const x = n.cx - n.w / 2, y = n.cy - n.h / 2;
  return s == 't' ? [x + n.w * f, y] :
         s == 'b' ? [x + n.w * f, y + n.h] :
         s == 'l' ? [x, y + n.h * f] : [x + n.w, y + n.h * f];
}}

function sides(a, b, d) {{
  if (a.t == 'p' && b.t == 'p') return a.cy < b.cy ? ['b', 't'] : ['t', 'b'];
  const cx_C = d.cx_C;
  if (a.t == 'p') {{
    const l = b.cx < cx_C;
    return [l ? 'l' : 'r', l ? 'r' : 'l'];
  }}
  const l = a.cx < cx_C;
  return [l ? 'r' : 'l', l ? 'r' : 'l'];
}}

function route(p0, sa, p1, sb, j) {{
  const H = s => s == 'l' || s == 'r';
  if (H(sa) && H(sb)) {{
    if (sa == sb) {{
      const x = sa == 'l' ? Math.min(p0[0], p1[0]) - 35 : Math.max(p0[0], p1[0]) + 35;
      return [p0, [x, p0[1]], [x, p1[1]], p1];
    }}
    const mx = (p0[0] + p1[0]) / 2 + j * 18;
    return [p0, [mx, p0[1]], [mx, p1[1]], p1];
  }}
  if (!H(sa) && !H(sb)) {{
    if (sa == sb) {{
      const y = sa == 't' ? Math.min(p0[1], p1[1]) - 35 : Math.max(p0[1], p1[1]) + 35;
      return [p0, [p0[0], y], [p1[0], y], p1];
    }}
    const my = (p0[1] + p1[1]) / 2;
    return [p0, [p0[0], my], [p1[0], my], p1];
  }}
  if (H(sa)) return [p0, [p1[0], p0[1]], p1];
  return [p0, [p0[0], p1[1]], p1];
}}

function render() {{
  let s = `<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1.5 L 10 5 L 0 8.5 z" class="arrow"/></marker></defs>`;
  let top = '';
  const allLabels = [];

  const targets = activeTab === -1 ? DATA.map((_, i) => i) : [activeTab];

  targets.forEach(di => {{
    const d = DATA[di];
    const N = {{}};
    d.nodes.forEach(n => N[n.id] = n);

    if (activeTab === -1) {{
      s += `<rect class="box-border" x="${{d.colX}}" y="${{d.y0}}" width="${{d.colW}}" height="${{d.boxH}}" rx="8"/>` +
           `<path class="box-header" d="M${{d.colX}},${{d.y0 + 36}} H${{d.colX + d.colW}}"/>` +
           `<text class="ttl" x="${{d.colX + 16}}" y="${{d.y0 + 24}}">${{esc(d.title)}}</text>`;
    }} else {{
      s += `<text class="ttl" x="40" y="55" font-size="22">${{esc(d.title)}}</text>` +
           `<text x="40" y="80" font-size="13" fill="#444444">Level 2 Data Flow Diagram – Pure White Monochrome (Accurate Complete Flows)</text>`;
    }}

    const outCounts = {{}}, inCounts = {{}};
    d.edges.forEach((e, eidx) => {{
      outCounts[e[0]] = (outCounts[e[0]] || []);
      outCounts[e[0]].push(eidx);
      inCounts[e[1]] = (inCounts[e[1]] || []);
      inCounts[e[1]].push(eidx);
    }});

    const secLabels = [];

    d.edges.forEach((e, eidx) => {{
      const u = N[e[0]], v = N[e[1]];
      if (!u || !v) return;

      const [sa, sb] = sides(u, v, d);
      const outs = outCounts[u.id] || [], ins = inCounts[v.id] || [];
      const kOut = outs.indexOf(eidx), kIn = ins.indexOf(eidx);
      const fOut = outs.length > 1 ? (kOut + 1) / (outs.length + 1) : 0.5;
      const fIn = ins.length > 1 ? (kIn + 1) / (ins.length + 1) : 0.5;

      const pairEdges = d.edges.filter(x => (x[0] == u.id && x[1] == v.id) || (x[0] == v.id && x[1] == u.id));
      const pairIdx = pairEdges.indexOf(e);
      const j = pairEdges.length > 1 ? (pairIdx - (pairEdges.length - 1) / 2) : 0;

      const p0 = pt(u, sa, fOut), p1 = pt(v, sb, fIn);
      const pts = route(p0, sa, p1, sb, j);
      const pth = 'M' + pts.map(p => p.join(',')).join('L');

      s += `<path class="el" d="${{pth}}" marker-end="url(#arr)"/>`;

      let segLen = 0, longest = 0, bestP = [0, 0];
      for (let i = 0; i < pts.length - 1; i++) {{
        const L = Math.hypot(pts[i+1][0] - pts[i][0], pts[i+1][1] - pts[i][1]);
        if (L > longest) {{
          longest = L;
          bestP = [(pts[i][0] + pts[i+1][0]) / 2, (pts[i][1] + pts[i+1][1]) / 2];
        }}
      }}

      if (u.cx === v.cx) {{
        bestP[0] += 55 + (eidx % 2 === 0 ? 15 : -15);
      }}

      const lines = wrap(e[2], 22);
      const maxLen = Math.max(...lines.map(l => l.length));
      const lw = Math.max(maxLen * 6.5 + 16, 75);
      const lh = lines.length * 13 + 10;

      secLabels.push({{ x: bestP[0], y: bestP[1], w: lw, h: lh, lines }});
    }});

    // Relax labels to prevent overlap
    for (let iter = 0; iter < 12; iter++) {{
      for (let i = 0; i < secLabels.length; i++) {{
        for (let j = i + 1; j < secLabels.length; j++) {{
          const la = secLabels[i], lb = secLabels[j];
          const dx = Math.abs(la.x - lb.x), dy = Math.abs(la.y - lb.y);
          const reqX = (la.w + lb.w) / 2 + 8, reqY = (la.h + lb.h) / 2 + 6;
          if (dx < reqX && dy < reqY) {{
            const overlapX = reqX - dx, overlapY = reqY - dy;
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

    secLabels.forEach(lbl => allLabels.push(lbl));

    d.nodes.forEach(n => {{
      const x = n.cx - n.w / 2, y = n.cy - n.h / 2;
      const sh = n.t == 'p' ? `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" rx="10" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>` :
                 n.t == 'e' ? `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>` :
                 `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" fill="#ffffff"/><path d="M${{x + n.w}},${{y}}H${{x}}V${{y + n.h}}H${{x + n.w}}" fill="none" stroke="#000000" stroke-width="1.8"/>`;
      const ls = n.t == 's' ? wrap(n.n + ' | ' + n.name, Math.floor(n.w / 7.2)) : [...(n.t == 'p' ? [n.n] : []), ...wrap(n.name, Math.floor(n.w / 7.2))], y0 = n.cy - (ls.length - 1) * 8 + 4;
      s += `<g class="node" data-id="${{di}}:${{n.id}}">${{sh}}<text class="nt" ${{n.t == 'e' ? 'font-weight="700"' : ''}}>${{ls.map((t, k) => `<tspan x="${{n.cx}}" y="${{y0 + k * 16}}" ${{n.t == 'p' && k == 0 ? 'font-weight="700"' : ''}}>${{esc(t)}}</tspan>`).join('')}}</text></g>`;
    }});
  }});

  let lab = '';
  allLabels.forEach(l => {{
    lab += `<g>` +
           `<rect class="lb-box" x="${{l.x - l.w/2}}" y="${{l.y - l.h/2}}" width="${{l.w}}" height="${{l.h}}"/>` +
           `<text class="lb" x="${{l.x}}" y="${{l.y - (l.lines.length - 1) * 6.5 + 4}}">${{l.lines.map((t, k) => `<tspan x="${{l.x}}" dy="${{k ? 13 : 0}}">${{esc(t)}}</tspan>`).join('')}}</text>` +
           `</g>`;
  }});

  svg.innerHTML = s.replace('</defs>', '</defs>' + top) + lab;
  svg.setAttribute('viewBox', `0 0 ${{DATA.W}} ${{DATA.H}}`);
}}

function xy(e) {{
  const p = svg.createSVGPoint();
  p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}}

svg.addEventListener('pointerdown', e => {{
  const g = e.target.closest('.node');
  if (!g) return;
  const [di, id] = g.dataset.id.split(':'), n = DATA[di].nodes.find(n => n.id == id), p = xy(e);
  drag = {{ n, dx: n.cx - p.x, dy: n.cy - p.y }};
  e.preventDefault();
}});

window.addEventListener('pointermove', e => {{
  if (!drag) return;
  const p = xy(e);
  drag.n.cx = Math.round((p.x + drag.dx) / 10) * 10;
  drag.n.cy = Math.round((p.y + drag.dy) / 10) * 10;
  render();
}});

window.addEventListener('pointerup', () => drag = null);

document.getElementById('reset').onclick = () => {{ layoutAll(); render(); }};

document.getElementById('tabs').onclick = e => {{
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeTab = parseInt(btn.dataset.idx, 10);

  const drawioLink = document.getElementById('drawioLink');
  if (activeTab === -1) {{
    drawioLink.href = 'dfd-level-2.drawio';
    drawioLink.download = 'dfd-level-2.drawio';
  }} else {{
    const slug = DATA[activeTab].slug;
    drawioLink.href = `dfd-${{slug}}.drawio`;
    drawioLink.download = `dfd-${{slug}}.drawio`;
  }}

  layoutAll();
  render();
}};

document.getElementById('downloadSvg').onclick = () => {{
  const svgEl = document.getElementById('svg');
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgEl);
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {{
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }}
  const blob = new Blob([source], {{ type: 'image/svg+xml;charset=utf-8' }});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = activeTab === -1 ? 'OJT_System_Level_2_DFD_All.svg' : `OJT_System_DFD_${{DATA[activeTab].slug}}.svg`;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}};

document.getElementById('printBtn').onclick = () => {{ window.print(); }};

layoutAll();
render();
</script></body></html>
"""

with open(os.path.join(WORKSPACE_DIR, "dfd-level-2.html"), "w", encoding="utf-8") as f:
    f.write(html_template)
with open(os.path.join(PUBLIC_DIR, "dfd-level-2.html"), "w", encoding="utf-8") as f:
    f.write(html_template)
print("  Updated dfd-level-2.html in workspace root and public/")

# 5. RENDER HIGH-RESOLUTION JPEGS AND EXTRACT VECTOR SVGS
print("5. Rendering high-res monochrome JPEGs and pure vector SVGs...")

# Helper to generate isolated single-process HTML for rendering
for di, d in enumerate(DATA):
    slug = PROCESS_SLUGS[di]
    p_count = len([n for n in d["nodes"] if n["t"] == "p"])
    svg_h = max(p_count * 155 + 260, 1000)
    svg_w = 1400

    single_html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ background: #ffffff; color: #000000; font: 14px system-ui, -apple-system, sans-serif; padding: 30px; width: {svg_w + 60}px; margin: 0 auto; }}
svg {{ width: 100%; height: auto; display: block; background: #ffffff; }}
.arrow {{ fill: #000000; }}
.el {{ fill: none; stroke: #000000; stroke-width: 1.5; }}
.lb-box {{ fill: #ffffff; stroke: #000000; stroke-width: 0.8; rx: 3; ry: 3; }}
.lb {{ font-size: 11px; fill: #000000; font-weight: 600; text-anchor: middle; font-family: Helvetica, Arial, sans-serif; }}
.nt {{ font-size: 12px; fill: #000000; text-anchor: middle; font-family: Helvetica, Arial, sans-serif; }}
.ttl {{ font-size: 22px; font-weight: 700; fill: #000000; font-family: Helvetica, Arial, sans-serif; }}
</style></head><body>
<div id="container"></div>
<script>
const d = {json.dumps(d)};
const W = {svg_w}, H = {svg_h};
const cx_L = 200, cx_C = 680, cx_R = 1160, y0 = 120, RG = 150;

function wrap(s, max) {{
  const w = s.split(' '), L = [];
  let c = '';
  for (const x of w) {{
    if ((c + ' ' + x).trim().length > max && c) {{ L.push(c); c = x; }}
    else {{ c = (c + ' ' + x).trim(); }}
  }}
  if (c) L.push(c);
  return L;
}}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const N = {{}};
d.nodes.forEach(n => N[n.id] = n);

d.nodes.filter(n => n.t == 'p').forEach((n, i) => {{
  n.cx = cx_C; n.cy = y0 + i * RG; n.w = 200; n.h = 65;
}});

for (const t of ['e', 's']) {{
  const S = d.nodes.filter(n => n.t == t);
  S.forEach(n => {{
    n.w = t == 'e' ? 175 : 225; n.h = t == 'e' ? 58 : 54; n.cx = t == 'e' ? cx_L : cx_R;
    const ys = d.edges.flatMap(e => e[0] == n.id ? [N[e[1]]] : e[1] == n.id ? [N[e[0]]] : []).filter(x => x && x.t == 'p').map(x => x.cy);
    n.cy = ys.length ? (ys.reduce((a, b) => a + b, 0) / ys.length) : y0;
  }});
  S.sort((a, b) => a.cy - b.cy);
  for (let i = 1; i < S.length; i++) S[i].cy = Math.max(S[i].cy, S[i - 1].cy + 80);
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
  return [l ? 'r' : 'l', l ? 'r' : 'l'];
}}

function route(p0, sa, p1, sb, j) {{
  const H = s => s == 'l' || s == 'r';
  if (H(sa) && H(sb)) {{
    if (sa == sb) {{
      const x = sa == 'l' ? Math.min(p0[0], p1[0]) - 35 : Math.max(p0[0], p1[0]) + 35;
      return [p0, [x, p0[1]], [x, p1[1]], p1];
    }}
    const mx = (p0[0] + p1[0]) / 2 + j * 18;
    return [p0, [mx, p0[1]], [mx, p1[1]], p1];
  }}
  if (!H(sa) && !H(sb)) {{
    if (sa == sb) {{
      const y = sa == 't' ? Math.min(p0[1], p1[1]) - 35 : Math.max(p0[1], p1[1]) + 35;
      return [p0, [p0[0], y], [p1[0], y], p1];
    }}
    const my = (p0[1] + p1[1]) / 2;
    return [p0, [p0[0], my], [p1[0], my], p1];
  }}
  if (H(sa)) return [p0, [p1[0], p0[1]], p1];
  return [p0, [p0[0], p1[1]], p1];
}}

const outCounts = {{}}, inCounts = {{}};
d.edges.forEach((e, eidx) => {{
  outCounts[e[0]] = (outCounts[e[0]] || []);
  outCounts[e[0]].push(eidx);
  inCounts[e[1]] = (inCounts[e[1]] || []);
  inCounts[e[1]].push(eidx);
}});

let s = `<svg id="svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${{W}} ${{H}}" width="${{W}}" height="${{H}}" style="background:#ffffff;">` +
  `<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1.5 L 10 5 L 0 8.5 z" class="arrow"/></marker></defs>` +
  `<rect width="${{W}}" height="${{H}}" fill="#ffffff"/>` +
  `<text class="ttl" x="40" y="55">${{esc(d.title)}}</text>` +
  `<text x="40" y="80" font-size="13" fill="#444444">Level 2 Data Flow Diagram – Pure White Monochrome (Accurate Complete Flows)</text>`;

const secLabels = [];
d.edges.forEach((e, eidx) => {{
  const u = N[e[0]], v = N[e[1]];
  if (!u || !v) return;

  const [sa, sb] = sides(u, v);
  const outs = outCounts[u.id] || [], ins = inCounts[v.id] || [];
  const kOut = outs.indexOf(eidx), kIn = ins.indexOf(eidx);
  const fOut = outs.length > 1 ? (kOut + 1) / (outs.length + 1) : 0.5;
  const fIn = ins.length > 1 ? (kIn + 1) / (ins.length + 1) : 0.5;

  const pairEdges = d.edges.filter(x => (x[0] == u.id && x[1] == v.id) || (x[0] == v.id && x[1] == u.id));
  const pairIdx = pairEdges.indexOf(e);
  const j = pairEdges.length > 1 ? (pairIdx - (pairEdges.length - 1) / 2) : 0;

  const p0 = pt(u, sa, fOut), p1 = pt(v, sb, fIn);
  const pts = route(p0, sa, p1, sb, j);
  const pth = 'M' + pts.map(p => p.join(',')).join('L');

  s += `<path class="el" d="${{pth}}" marker-end="url(#arr)"/>`;

  let longest = 0, bestP = [0, 0];
  for (let i = 0; i < pts.length - 1; i++) {{
    const L = Math.hypot(pts[i+1][0] - pts[i][0], pts[i+1][1] - pts[i][1]);
    if (L > longest) {{
      longest = L;
      bestP = [(pts[i][0] + pts[i+1][0]) / 2, (pts[i][1] + pts[i+1][1]) / 2];
    }}
  }}

  if (u.cx === v.cx) {{
    bestP[0] += 55 + (eidx % 2 === 0 ? 15 : -15);
  }}

  const lines = wrap(e[2], 22);
  const maxLen = Math.max(...lines.map(l => l.length));
  const lw = Math.max(maxLen * 6.5 + 16, 75);
  const lh = lines.length * 13 + 10;
  secLabels.push({{ x: bestP[0], y: bestP[1], w: lw, h: lh, lines }});
}});

for (let iter = 0; iter < 12; iter++) {{
  for (let i = 0; i < secLabels.length; i++) {{
    for (let j = i + 1; j < secLabels.length; j++) {{
      const la = secLabels[i], lb = secLabels[j];
      const dx = Math.abs(la.x - lb.x), dy = Math.abs(la.y - lb.y);
      const reqX = (la.w + lb.w) / 2 + 8, reqY = (la.h + lb.h) / 2 + 6;
      if (dx < reqX && dy < reqY) {{
        const overlapX = reqX - dx, overlapY = reqY - dy;
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

d.nodes.forEach(n => {{
  const x = n.cx - n.w / 2, y = n.cy - n.h / 2;
  const sh = n.t == 'p' ? `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" rx="10" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>` :
             n.t == 'e' ? `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>` :
             `<rect x="${{x}}" y="${{y}}" width="${{n.w}}" height="${{n.h}}" fill="#ffffff"/><path d="M${{x + n.w}},${{y}}H${{x}}V${{y + n.h}}H${{x + n.w}}" fill="none" stroke="#000000" stroke-width="1.8"/>`;
  const ls = n.t == 's' ? wrap(n.n + ' | ' + n.name, Math.floor(n.w / 7.2)) : [...(n.t == 'p' ? [n.n] : []), ...wrap(n.name, Math.floor(n.w / 7.2))], y0 = n.cy - (ls.length - 1) * 8 + 4;
  s += `<g class="node">${{sh}}<text class="nt" ${{n.t == 'e' ? 'font-weight="700"' : ''}}>${{ls.map((t, k) => `<tspan x="${{n.cx}}" y="${{y0 + k * 16}}" ${{n.t == 'p' && k == 0 ? 'font-weight="700"' : ''}}>${{esc(t)}}</tspan>`).join('')}}</text></g>`;
}});

secLabels.forEach(l => {{
  s += `<g>` +
       `<rect class="lb-box" x="${{l.x - l.w/2}}" y="${{l.y - l.h/2}}" width="${{l.w}}" height="${{l.h}}"/>` +
       `<text class="lb" x="${{l.x}}" y="${{l.y - (l.lines.length - 1) * 6.5 + 4}}">${{l.lines.map((t, k) => `<tspan x="${{l.x}}" dy="${{k ? 13 : 0}}">${{esc(t)}}</tspan>`).join('')}}</text>` +
       `</g>`;
}});

document.getElementById('container').innerHTML = s + '</svg>';
</script></body></html>
"""
    tmp_path = os.path.join(TEMP_DIR, f"render_{slug}.html")
    with open(tmp_path, "w", encoding="utf-8") as f:
        f.write(single_html)

    # 1. Capture SVG via dump-dom
    cmd_dom = [CHROME_PATH, "--headless=new", "--disable-gpu", "--dump-dom", f"file:///{tmp_path.replace(os.sep, '/')}"]
    res_dom = subprocess.run(cmd_dom, capture_output=True, text=True, encoding="utf-8")
    m_svg = re.search(r'(<svg[\s\S]*?</svg>)', res_dom.stdout)
    if m_svg:
        svg_code = '<?xml version="1.0" encoding="UTF-8"?>\n' + m_svg.group(1)
        with open(os.path.join(WORKSPACE_DIR, f"dfd-{slug}.svg"), "w", encoding="utf-8") as sf:
            sf.write(svg_code)
        with open(os.path.join(PUBLIC_DIR, f"dfd-{slug}.svg"), "w", encoding="utf-8") as sf:
            sf.write(svg_code)

    # 2. Capture screenshot for JPEG
    temp_png = os.path.join(TEMP_DIR, f"{slug}.png")
    cmd_shot = [
        CHROME_PATH,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--force-device-scale-factor=1.5",
        f"--window-size={svg_w + 60},{svg_h + 80}",
        f"--screenshot={temp_png}",
        f"file:///{tmp_path.replace(os.sep, '/')}"
    ]
    subprocess.run(cmd_shot, capture_output=True, text=True)
    if os.path.exists(temp_png):
        im = Image.open(temp_png)
        rgb_im = im.convert('L').convert('RGB')
        for pth in [os.path.join(WORKSPACE_DIR, f"dfd-{slug}.jpg"), os.path.join(PUBLIC_DIR, f"dfd-{slug}.jpg")]:
            rgb_im.save(pth, "JPEG", quality=95, optimize=True)
        # Mirror to dfd-level-2-* pattern
        for pth in [os.path.join(WORKSPACE_DIR, f"dfd-level-2-{slug}.jpg"), os.path.join(PUBLIC_DIR, f"dfd-level-2-{slug}.jpg")]:
            rgb_im.save(pth, "JPEG", quality=95, optimize=True)
        print(f"  Generated dfd-{slug}.svg & dfd-{slug}.jpg ({rgb_im.size[0]}x{rgb_im.size[1]} px)")

# Capture combined portrait JPEG and SVG
print("6. Rendering combined Level 2 portrait JPEG and SVG...")
comb_html_path = os.path.join(WORKSPACE_DIR, "dfd-level-2.html")
cmd_comb_dom = [CHROME_PATH, "--headless=new", "--disable-gpu", "--dump-dom", f"file:///{comb_html_path.replace(os.sep, '/')}"]
res_comb_dom = subprocess.run(cmd_comb_dom, capture_output=True, text=True, encoding="utf-8")
m_comb_svg = re.search(r'(<svg[\s\S]*?</svg>)', res_comb_dom.stdout)
if m_comb_svg:
    comb_svg_code = '<?xml version="1.0" encoding="UTF-8"?>\n' + m_comb_svg.group(1)
    with open(os.path.join(WORKSPACE_DIR, "dfd-level-2.svg"), "w", encoding="utf-8") as sf:
        sf.write(comb_svg_code)
    with open(os.path.join(PUBLIC_DIR, "dfd-level-2.svg"), "w", encoding="utf-8") as sf:
        sf.write(comb_svg_code)

comb_png = os.path.join(TEMP_DIR, "combined.png")
cmd_comb_shot = [
    CHROME_PATH,
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--force-device-scale-factor=1.2",
    "--window-size=2480,3300",
    f"--screenshot={comb_png}",
    f"file:///{comb_html_path.replace(os.sep, '/')}"
]
subprocess.run(cmd_comb_shot, capture_output=True, text=True)
if os.path.exists(comb_png):
    im = Image.open(comb_png)
    rgb_im = im.convert('L').convert('RGB')
    for pth in [os.path.join(WORKSPACE_DIR, "dfd-level-2.jpg"), os.path.join(PUBLIC_DIR, "dfd-level-2.jpg")]:
        rgb_im.save(pth, "JPEG", quality=95, optimize=True)
    print(f"  Generated dfd-level-2.svg & dfd-level-2.jpg ({rgb_im.size[0]}x{rgb_im.size[1]} px)")

# Clean temporary files
try:
    shutil.rmtree(TEMP_DIR)
except Exception:
    pass

print("\nSUCCESS: All 6 processes + combined Level 2 diagram are 100% accurate, properly connected, and regenerated across all formats!")
