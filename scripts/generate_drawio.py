import json
import os
import re
import html
import xml.etree.ElementTree as ET

WORKSPACE_DIR = r"c:\CAPSTONE 1 - CODE"
html_path = os.path.join(WORKSPACE_DIR, "dfd-level-2.html")

with open(html_path, "r", encoding="utf-8") as f:
    content = f.read()

m = re.search(r'const DATA\s*=\s*(\[[\s\S]*?\]);\s*const COL_W', content)
if not m:
    m = re.search(r'const DATA\s*=\s*(\[[\s\S]*?\]);\s*const CX', content)
if not m:
    raise Exception("Could not find DATA in dfd-level-2.html")

DATA = json.loads(m.group(1))

# Styles for Draw.io (Pure White & Sharp Black Borders)
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
STYLE_BOX = (
    "rounded=1;arcSize=6;whiteSpace=wrap;html=1;fillColor=#ffffff;"
    "strokeColor=#000000;strokeWidth=1.8;fontColor=#000000;fontStyle=1;fontSize=14;"
    "align=left;verticalAlign=top;spacingLeft=14;spacingTop=8;"
)
STYLE_EDGE_BASE = (
    "edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
    "strokeColor=#000000;strokeWidth=1.5;fontColor=#000000;fontSize=10;fontFamily=Helvetica;"
    "endArrow=block;endFill=1;labelBackgroundColor=#ffffff;labelBorderColor=#000000;"
)

def build_diagram_xml(diag_id, diag_name, page_w, page_h, populate_fn):
    diag = ET.Element("diagram", {"id": diag_id, "name": diag_name})
    model = ET.SubElement(diag, "mxGraphModel", {
        "dx": "1400", "dy": "900", "grid": "1", "gridSize": "10",
        "guides": "1", "tooltips": "1", "connect": "1", "arrows": "1",
        "fold": "1", "page": "1", "pageScale": "1",
        "pageWidth": str(page_w), "pageHeight": str(page_h),
        "background": "#ffffff", "math": "0", "shadow": "0"
    })
    root = ET.SubElement(model, "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    populate_fn(root)
    return diag

def populate_all_portrait(root):
    COL_W = 980
    GAP_X = 50
    MARGIN_X = 40
    MARGIN_Y = 30
    RG = 125

    cols = [
        [0, 1, 2],
        [3, 4, 5]
    ]

    for colIdx, colIndices in enumerate(cols):
        y = MARGIN_Y + 15
        colX = MARGIN_X + colIdx * (COL_W + GAP_X)
        cx_L = colX + 130
        cx_C = colX + 490
        cx_R = colX + 830

        for di in colIndices:
            d = DATA[di]
            N = {}
            for n in d["nodes"]:
                N[n["id"]] = n

            # Compute positions
            p_nodes = [n for n in d["nodes"] if n["t"] == "p"]
            for i, n in enumerate(p_nodes):
                n["cx"] = cx_C
                n["cy"] = y + 80 + i * RG
                n["w"] = 165
                n["h"] = 60

            for t in ["e", "s"]:
                s_nodes = [n for n in d["nodes"] if n["t"] == t]
                for n in s_nodes:
                    n["w"] = 145 if t == "e" else 195
                    n["h"] = 52 if t == "e" else 48
                    n["cx"] = cx_L if t == "e" else cx_R
                    ys = [N[e[1]]["cy"] for e in d["edges"] if e[0] == n["id"] and e[1] in N and N[e[1]]["t"] == "p"] + \
                         [N[e[0]]["cy"] for e in d["edges"] if e[1] == n["id"] and e[0] in N and N[e[0]]["t"] == "p"]
                    n["cy"] = sum(ys) / len(ys) if ys else (y + 80)
                s_nodes.sort(key=lambda x: x["cy"])
                for i in range(1, len(s_nodes)):
                    s_nodes[i]["cy"] = max(s_nodes[i]["cy"], s_nodes[i-1]["cy"] + 68)

            max_y = max(n["cy"] + n["h"]/2 for n in d["nodes"])
            box_h = (max_y - y) + 40

            # 1. Section Container Box
            box_cell_id = f"box_{di}"
            box_cell = ET.SubElement(root, "mxCell", {
                "id": box_cell_id,
                "value": f"Process {d['title']}",
                "style": STYLE_BOX,
                "vertex": "1",
                "parent": "1"
            })
            ET.SubElement(box_cell, "mxGeometry", {
                "x": str(colX), "y": str(y), "width": str(COL_W), "height": str(int(box_h)), "as": "geometry"
            })

            # 2. Nodes
            for n in d["nodes"]:
                node_cell_id = f"s{di}_{n['id']}"
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

            # 3. Edges with Anti-Collision Ports
            # Calculate counts of edges per (node, side)
            out_edges_per_node = {}
            in_edges_per_node = {}
            for ei, edge in enumerate(d["edges"]):
                src = N[edge[0]]
                tgt = N[edge[1]]
                out_edges_per_node.setdefault(src["id"], []).append(ei)
                in_edges_per_node.setdefault(tgt["id"], []).append(ei)

            for ei, edge in enumerate(d["edges"]):
                src = N[edge[0]]
                tgt = N[edge[1]]
                src_id = f"s{di}_{src['id']}"
                tgt_id = f"s{di}_{tgt['id']}"
                flow_label = edge[2]

                # Determine exit / entry sides
                if src["t"] == "p" and tgt["t"] == "p":
                    exit_side = "bottom" if src["cy"] < tgt["cy"] else "top"
                    entry_side = "top" if src["cy"] < tgt["cy"] else "bottom"
                elif src["t"] == "p":
                    exit_side = "left" if tgt["cx"] < src["cx"] else "right"
                    entry_side = "right" if tgt["cx"] < src["cx"] else "left"
                else: # src is e or s
                    exit_side = "right" if src["cx"] < tgt["cx"] else "left"
                    entry_side = "left" if src["cx"] < tgt["cx"] else "right"

                # Calculate fractional port
                out_list = out_edges_per_node[src["id"]]
                out_idx = out_list.index(ei)
                exit_frac = (out_idx + 1) / (len(out_list) + 1)

                in_list = in_edges_per_node[tgt["id"]]
                in_idx = in_list.index(ei)
                entry_frac = (in_idx + 1) / (len(in_list) + 1)

                # Map sides to exitX/exitY and entryX/entryY
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

                # Stagger label position along line
                label_x_offset = -0.2 if (ei % 2 == 0) else 0.2

                edge_cell_id = f"e_s{di}_{ei}"
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

            y += box_h + 30

def populate_single_process(root, di):
    d = DATA[di]
    N = {}
    for n in d["nodes"]:
        N[n["id"]] = n

    cx_L = 180
    cx_C = 570
    cx_R = 970
    y_start = 90
    RG = 130

    p_nodes = [n for n in d["nodes"] if n["t"] == "p"]
    for i, n in enumerate(p_nodes):
        n["cx"] = cx_C
        n["cy"] = y_start + i * RG
        n["w"] = 175
        n["h"] = 64

    for t in ["e", "s"]:
        s_nodes = [n for n in d["nodes"] if n["t"] == t]
        for n in s_nodes:
            n["w"] = 155 if t == "e" else 205
            n["h"] = 56 if t == "e" else 50
            n["cx"] = cx_L if t == "e" else cx_R
            ys = [N[e[1]]["cy"] for e in d["edges"] if e[0] == n["id"] and e[1] in N and N[e[1]]["t"] == "p"] + \
                 [N[e[0]]["cy"] for e in d["edges"] if e[1] == n["id"] and e[0] in N and N[e[0]]["t"] == "p"]
            n["cy"] = sum(ys) / len(ys) if ys else y_start
        s_nodes.sort(key=lambda x: x["cy"])
        for i in range(1, len(s_nodes)):
            s_nodes[i]["cy"] = max(s_nodes[i]["cy"], s_nodes[i-1]["cy"] + 72)

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
    out_edges_per_node = {}
    in_edges_per_node = {}
    for ei, edge in enumerate(d["edges"]):
        src = N[edge[0]]
        tgt = N[edge[1]]
        out_edges_per_node.setdefault(src["id"], []).append(ei)
        in_edges_per_node.setdefault(tgt["id"], []).append(ei)

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

        out_list = out_edges_per_node[src["id"]]
        out_idx = out_list.index(ei)
        exit_frac = (out_idx + 1) / (len(out_list) + 1)

        in_list = in_edges_per_node[tgt["id"]]
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

# Create root mxfile
mxfile = ET.Element("mxfile", {
    "host": "app.diagrams.net",
    "modified": "2026-09-25T03:00:00.000Z",
    "agent": "Antigravity IDE",
    "version": "24.7.17",
    "type": "device"
})

# Tab 1: All Processes in 1-Frame Portrait
diag_all = build_diagram_xml("diag_all_portrait", "All Processes (1-Frame Portrait)", 2100, 2650, populate_all_portrait)
mxfile.append(diag_all)

# Tabs 2 to 7: Individual Process Pages
for di, d in enumerate(DATA):
    page_h = max(len([n for n in d["nodes"] if n["t"] == "p"]) * 140 + 200, 800)
    diag_p = build_diagram_xml(f"diag_proc_{di+1}", d["title"], 1200, page_h, lambda r, di=di: populate_single_process(r, di))
    mxfile.append(diag_p)

# Serialize to file
xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
drawio_xml = xml_declaration + ET.tostring(mxfile, encoding="utf-8").decode("utf-8")

drawio_root = os.path.join(WORKSPACE_DIR, "dfd-level-2.drawio")
drawio_public = os.path.join(WORKSPACE_DIR, "public", "dfd-level-2.drawio")
xml_root = os.path.join(WORKSPACE_DIR, "dfd-level-2.xml")

with open(drawio_root, "w", encoding="utf-8") as f:
    f.write(drawio_xml)

with open(drawio_public, "w", encoding="utf-8") as f:
    f.write(drawio_xml)

with open(xml_root, "w", encoding="utf-8") as f:
    f.write(drawio_xml)

print(f"Generated {drawio_root} ({os.path.getsize(drawio_root)/1024:.1f} KB) with Anti-Collision Ports!")
