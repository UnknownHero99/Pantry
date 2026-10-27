"""
Build scanner-carrier.kicad_pcb from the schematic's netlist and design.py.

  make_pcb.py place <netlist> <board.dsn>   footprints, outline, labels, ground pours; export for Freerouting
  make_pcb.py finish <routed.ses>           import Freerouting's tracks, fill the pours

Runs inside the kicad/kicad image (needs pcbnew). Footprints keep their link to
the schematic symbols, so "Update PCB from Schematic" still works afterwards.
"""
import sys
from pathlib import Path

import pcbnew as k

sys.path.insert(0, str(Path(__file__).parent))
from sexpr import parse, find, find_all
from design import PARTS, BOARD_W, BOARD_H, SF_X, SF_Y, SF_W, SF_H

ROOT = Path(__file__).parent.parent
PCB = ROOT / 'scanner-carrier.kicad_pcb'
LIBS = {'Pantry': ROOT / 'lib/Pantry.pretty'}
X0, Y0 = 100.0, 80.0   # board corner on the page

mm = k.FromMM
def pt(x, y):
	return k.VECTOR2I(mm(X0 + x), mm(Y0 + y))

def shape(board, kind, layer, width=0.1):
	s = k.PCB_SHAPE(board, kind)
	s.SetLayer(layer)
	s.SetWidth(mm(width))
	board.Add(s)
	return s

def text(board, s, x, y, layer=k.F_SilkS, size=0.8, angle=0, just=k.GR_TEXT_H_ALIGN_CENTER):
	t = k.PCB_TEXT(board)
	t.SetText(s)
	t.SetLayer(layer)
	t.SetTextSize(k.VECTOR2I(mm(size), mm(size)))
	t.SetTextThickness(mm(0.15 if size >= 0.8 else 0.13))
	t.SetPosition(pt(x, y))
	t.SetTextAngleDegrees(angle)
	t.SetHorizJustify(just)
	t.SetVertJustify(k.GR_TEXT_V_ALIGN_CENTER)
	if layer in (k.B_SilkS, k.B_Cu):
		t.SetMirrored(True)
	board.Add(t)

def outline(board, w, h, r=2.0):
	"""Board edge: a rectangle with rounded corners."""
	for (x1, y1, x2, y2) in ((r, 0, w - r, 0), (w, r, w, h - r), (w - r, h, r, h), (0, h - r, 0, r)):
		s = shape(board, k.SHAPE_T_SEGMENT, k.Edge_Cuts)
		s.SetStart(pt(x1, y1))
		s.SetEnd(pt(x2, y2))
	c = r * (1 - 0.70710678)
	for (sx, sy, mx, my, ex, ey) in ((0, r, c, c, r, 0), (w - r, 0, w - c, c, w, r),
			(w, h - r, w - c, h - c, w - r, h), (r, h, c, h - c, 0, h - r)):
		a = shape(board, k.SHAPE_T_ARC, k.Edge_Cuts)
		a.SetArcGeometry(pt(sx, sy), pt(mx, my), pt(ex, ey))

def ground_pour(board, net, layer):
	z = k.ZONE(board)
	z.SetLayer(layer)
	z.SetNetCode(net.GetNetCode())
	z.SetMinThickness(mm(0.25))
	z.SetLocalClearance(mm(0.25))
	z.SetPadConnection(k.ZONE_CONNECTION_THERMAL)
	z.SetThermalReliefGap(mm(0.3))
	z.SetThermalReliefSpokeWidth(mm(0.4))
	o = z.Outline()
	o.NewOutline()
	e = 0.3
	for x, y in ((e, e), (BOARD_W - e, e), (BOARD_W - e, BOARD_H - e), (e, BOARD_H - e)):
		o.Append(mm(X0 + x), mm(Y0 + y))
	board.Add(z)

def load_footprint(lib_id):
	lib, name = lib_id.split(':')
	path = LIBS.get(lib, Path('/usr/share/kicad/footprints') / f'{lib}.pretty')
	fp = k.FootprintLoad(str(path), name)
	if fp is None:
		raise SystemExit(f'footprint not found: {lib_id}')
	return fp

def pad_xy(fp, number):
	p = next(p for p in fp.Pads() if p.GetNumber() == number).GetPosition()
	return k.ToMM(p.x) - X0, k.ToMM(p.y) - Y0

def place(netlist, dsn):
	nl = parse(Path(netlist).read_text())
	comps = {find(c, 'ref')[1]: c for c in find_all(find(nl, 'components'), 'comp')}
	board = k.LoadBoard(str(PCB))   # the empty board build.sh wrote, so the project's rules apply
	board.GetDesignSettings().SetCopperLayerCount(2)

	nets = {}
	for n in find_all(find(nl, 'nets'), 'net'):
		ni = k.NETINFO_ITEM(board, find(n, 'name')[1])
		board.Add(ni)
		for node in find_all(n, 'node'):
			nets[(find(node, 'ref')[1], find(node, 'pin')[1])] = ni

	for ref, part in PARTS.items():
		fp = load_footprint(part['footprint'])
		fp.SetFPIDAsString(part['footprint'])
		fp.SetReference(ref)
		fp.SetValue(part['value'])
		comp = comps[ref]
		fp.SetPath(k.KIID_PATH('/' + find(comp, 'tstamps')[1]))
		fp.SetSheetname('/')
		fp.SetSheetfile('scanner-carrier.kicad_sch')
		# The symbol's other fields, hidden, so the schematic parity check is happy.
		for f in find_all(find(comp, 'fields') or [], 'field') + find_all(comp, 'property'):
			name, value = find(f, 'name')[1], (f[2] if len(f) > 2 and not isinstance(f[2], list) else (find(f, 'value') or ['', ''])[1])
			if name in ('Reference', 'Value', 'Footprint', 'Sheetname', 'Sheetfile') or name.startswith('ki_'):
				continue
			fp.SetField(name, value)
			fp.GetField(name).SetVisible(False)
		if ref.startswith('H'):
			fp.Reference().SetVisible(False)
		fp.Reference().SetTextSize(k.VECTOR2I(mm(0.8), mm(0.8)))
		fp.Reference().SetTextThickness(mm(0.15))
		x, y, rot = part['at']
		board.Add(fp)
		fp.SetPosition(pt(x, y))
		if rot == 'row-left':
			# A row of pins going left from pin 1 (the SparkFun header is numbered right to left).
			fp.SetOrientationDegrees(270)
			if pad_xy(fp, '6')[0] > pad_xy(fp, '1')[0]:
				fp.SetOrientationDegrees(90)
			assert pad_xy(fp, '6')[0] < pad_xy(fp, '1')[0]
		else:
			fp.SetOrientationDegrees(rot)
		for pad in fp.Pads():
			ni = nets.get((ref, pad.GetNumber()))
			if ni:
				pad.SetNet(ni)
		# Silkscreen pin names next to connector pins.
		for i, label in enumerate(part.get('labels', [])):
			px, py = pad_xy(fp, str(i + 1))
			if part['footprint'].startswith('Connector_Molex'):
				text(board, label, px, py - 2.3, angle=90, just=k.GR_TEXT_H_ALIGN_LEFT, size=0.7)
			elif ref == 'J3':
				text(board, label, px, py + 1.6, angle=90, just=k.GR_TEXT_H_ALIGN_RIGHT, size=0.8)
			elif ref == 'J5':
				text(board, label, px + 1.4, py, just=k.GR_TEXT_H_ALIGN_LEFT, size=0.7)
		if part['footprint'].startswith('Connector_Molex'):
			text(board, part['value'].replace('Sunton ', ''), x, y - 0.3, layer=k.B_SilkS, size=0.8)
			fp.Reference().SetPosition(pt(x - 6.0, y - 0.6))
			fp.Reference().SetTextAngleDegrees(90)

	outline(board, BOARD_W, BOARD_H)

	# Where the scanner board sits, for the assembly drawing.
	r = shape(board, k.SHAPE_T_RECTANGLE, k.F_Fab, 0.1)
	r.SetStart(pt(SF_X, SF_Y))
	r.SetEnd(pt(SF_X + SF_W, SF_Y + SF_H))
	text(board, 'SparkFun 2D Barcode Scanner (on 11 mm standoffs)', SF_X + SF_W / 2, SF_Y + SF_H / 2, layer=k.F_Fab, size=1.0)
	text(board, 'PANTRY SCANNER CARRIER rev 1', BOARD_W / 2, 3.0, layer=k.B_SilkS, size=1.2)
	text(board, 'Sunton cables: check pin 1 to pin 1 before power-up', BOARD_W / 2, 5.2, layer=k.B_SilkS, size=0.8)

	gnd = board.FindNet('/GND')
	ground_pour(board, gnd, k.B_Cu)
	ground_pour(board, gnd, k.F_Cu)

	k.SaveBoard(str(PCB), board)
	board = k.LoadBoard(str(PCB))
	if not k.ExportSpecctraDSN(board, dsn):
		raise SystemExit('DSN export failed')
	print(f'placed {len(PARTS)} footprints, {board.GetNetCount()} nets; wrote {dsn}')

def finish(ses):
	board = k.LoadBoard(str(PCB))
	if not k.ImportSpecctraSES(board, ses):
		raise SystemExit('SES import failed')
	k.ZONE_FILLER(board).Fill(board.Zones())
	k.SaveBoard(str(PCB), board)
	tracks = [t for t in board.GetTracks() if t.GetClass() == 'PCB_TRACK']
	vias = [t for t in board.GetTracks() if t.GetClass() == 'PCB_VIA']
	print(f'imported {len(tracks)} track segments, {len(vias)} vias; pours filled')

if __name__ == '__main__':
	{'place': lambda: place(sys.argv[2], sys.argv[3]), 'finish': lambda: finish(sys.argv[2])}[sys.argv[1]]()
