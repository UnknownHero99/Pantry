"""
Route scanner-carrier.kicad_pcb: a small two-layer maze router (A* on a grid).

Every net keeps (clearance + half its width + a margin) from all copper of other
nets, holes and the board edge, so the result passes KiCad's DRC with the
project's rules. Power nets go first and wide; GND pads instead get a short
track to their own via into the bottom ground pour. Runs inside the kicad/kicad
image; DRC afterwards is the judge.
"""
import heapq, math, sys
from pathlib import Path

import pcbnew as k

PCB = Path(__file__).parent.parent / 'scanner-carrier.kicad_pcb'
G = 0.2                       # grid pitch, mm
CLR, EDGE, HOLE = 0.2, 0.35, 0.3
VIA_D, VIA_DRILL = 0.6, 0.3
SAFE = 0.04                   # margin for diagonal steps between grid points
POWER = {'/+5V', '/+3V3', '/BUZZ_SW'}
GND = '/GND'
LAYER_COST = (1.0, 1.25)      # keep the bottom mostly for the ground pour
VIA_COST, BEND = 8.0, 0.35
LAYERS = (k.F_Cu, k.B_Cu)

width = lambda net: 0.5 if net in POWER else 0.25
mm = k.ToMM

board = k.LoadBoard(str(PCB))
box = board.GetBoardEdgesBoundingBox()
BX, BY, BW, BH = mm(box.GetX()), mm(box.GetY()), mm(box.GetWidth()), mm(box.GetHeight())
NX, NY = int(BW / G) + 1, int(BH / G) + 1
N = NX * NY
cx = lambda i: BX + i * G
cy = lambda j: BY + j * G

# ── copper shapes ─────────────────────────────────────────────────────────
# ('rect', x, y, w, h, angle) | ('circle', x, y, r) | ('seg', x1, y1, x2, y2, w)
def dist(s, x, y):
	if s[0] == 'circle':
		return math.hypot(x - s[1], y - s[2]) - s[3]
	if s[0] == 'rect':
		_, px, py, w, h, a = s
		dx, dy = x - px, y - py
		ca, sa = math.cos(a), math.sin(a)
		lx, ly = dx * ca + dy * sa, -dx * sa + dy * ca
		ex, ey = max(abs(lx) - w / 2, 0), max(abs(ly) - h / 2, 0)
		if ex == 0 and ey == 0:
			return -min(w / 2 - abs(lx), h / 2 - abs(ly))
		return math.hypot(ex, ey)
	_, x1, y1, x2, y2, w = s
	vx, vy = x2 - x1, y2 - y1
	L = vx * vx + vy * vy
	t = 0 if L == 0 else max(0, min(1, ((x - x1) * vx + (y - y1) * vy) / L))
	return math.hypot(x - x1 - t * vx, y - y1 - t * vy) - w / 2

def bbox(s):
	if s[0] == 'circle':
		return s[1] - s[3], s[2] - s[3], s[1] + s[3], s[2] + s[3]
	if s[0] == 'rect':
		r = math.hypot(s[3], s[4]) / 2
		return s[1] - r, s[2] - r, s[1] + r, s[2] + r
	w = s[5] / 2
	return min(s[1], s[3]) - w, min(s[2], s[4]) - w, max(s[1], s[3]) + w, max(s[2], s[4]) + w

copper = []      # (shape, layers, net)  net None = belongs to nobody (mechanical pads)
holes = []       # (circle, net): every drill; a track may reach its own net's plated holes
pads_by_net = {}

for pad in board.GetPads():
	net = pad.GetNetname() or None
	p = pad.GetPosition()
	x, y = mm(p.x), mm(p.y)
	if pad.GetDrillSize().x > 0:
		holes.append((('circle', x, y, mm(pad.GetDrillSize().x) / 2), net if pad.GetAttribute() != k.PAD_ATTRIB_NPTH else None))
	if pad.GetAttribute() == k.PAD_ATTRIB_NPTH:
		continue
	sz = pad.GetSize(k.F_Cu if pad.IsOnLayer(k.F_Cu) else k.B_Cu)
	w, h = mm(sz.x), mm(sz.y)
	a = math.radians(pad.GetOrientation().AsDegrees())
	shape = ('circle', x, y, w / 2) if pad.GetShape(k.F_Cu if pad.IsOnLayer(k.F_Cu) else k.B_Cu) == k.PAD_SHAPE_CIRCLE \
		else ('rect', x, y, w, h, -a)
	layers = tuple(i for i, L in enumerate(LAYERS) if pad.IsOnLayer(L))
	copper.append((shape, layers, net))
	if net:
		pads_by_net.setdefault(net, []).append((shape, layers, pad))

def raster(mask, s, infl, value=1):
	x0, y0, x1, y1 = bbox(s)
	i0, i1 = max(0, int((x0 - infl - BX) / G)), min(NX - 1, int((x1 + infl - BX) / G) + 1)
	j0, j1 = max(0, int((y0 - infl - BY) / G)), min(NY - 1, int((y1 + infl - BY) / G) + 1)
	for j in range(j0, j1 + 1):
		y = cy(j)
		row = j * NX
		for i in range(i0, i1 + 1):
			if not mask[row + i] and dist(s, cx(i), y) < infl:
				mask[row + i] = value

def edge_mask(infl):
	m = bytearray(N)
	for j in range(NY):
		for i in range(NX):
			x, y = cx(i) - BX, cy(j) - BY
			if x < infl or y < infl or x > BW - infl or y > BH - infl:
				m[j * NX + i] = 1
	return m

def blocked_for(net, hw):
	"""Per-layer masks of where a track of half-width hw on net may not go, and where a via may not go."""
	base = edge_mask(EDGE + hw)
	m = [bytearray(base), bytearray(base)]
	via = edge_mask(EDGE + VIA_D / 2)
	for s, layers, n in copper:
		if n == net:
			continue
		for L in layers:
			raster(m[L], s, CLR + hw + SAFE)
		raster(via, s, CLR + VIA_D / 2 + SAFE)
	for h, hnet in holes:
		if hnet != net:
			for L in (0, 1):
				raster(m[L], h, HOLE + hw + SAFE)
		raster(via, h, max(HOLE + VIA_D / 2, 0.5 + VIA_DRILL) + SAFE)
	# No vias in our own pads either (they'd wick solder away).
	for s, layers, pad in pads_by_net.get(net, []):
		raster(via, s, CLR + VIA_D / 2)
	for L in (0, 1):
		for idx in range(N):
			if m[L][idx]:
				via[idx] = 1
	return m, via

def pad_cells(s, layers):
	out = set()
	for L in layers:
		x0, y0, x1, y1 = bbox(s)
		for j in range(max(0, int((y0 - BY) / G)), min(NY, int((y1 - BY) / G) + 2)):
			for i in range(max(0, int((x0 - BX) / G)), min(NX, int((x1 - BX) / G) + 2)):
				if dist(s, cx(i), cy(j)) < -0.08:
					out.add((L, i, j))
		if not out:   # tiny pad: the grid point nearest its centre
			out.add((L, round((s[1] - BX) / G), round((s[2] - BY) / G)))
	return out

DIRS = [(1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0),
	(1, 1, 1.4142), (1, -1, 1.4142), (-1, 1, 1.4142), (-1, -1, 1.4142)]

def astar(sources, targets, m, via, only_layer=None):
	tx = [t[1] for t in targets]; ty = [t[2] for t in targets]
	tbox = (min(tx), min(ty), max(tx), max(ty))
	def h(i, j):
		dx = max(tbox[0] - i, 0, i - tbox[2]); dy = max(tbox[1] - j, 0, j - tbox[3])
		return (max(dx, dy) + 0.4142 * min(dx, dy))
	gbest, came, heap = {}, {}, []
	for s in sources:
		gbest[s] = 0.0
		came[s] = (None, None)
		heapq.heappush(heap, (h(s[1], s[2]), 0.0, s, None))
	tset = set(targets)
	while heap:
		f, g, node, d = heapq.heappop(heap)
		if g > gbest.get(node, 1e9) + 1e-9:
			continue
		if node in tset:
			path = [node]
			while came[path[-1]][0] is not None:
				path.append(came[path[-1]][0])
			return path[::-1]
		L, i, j = node
		steps = []
		for di, dj, c in DIRS:
			ni, nj = i + di, j + dj
			if 0 <= ni < NX and 0 <= nj < NY and not m[L][nj * NX + ni]:
				if di and dj and (m[L][j * NX + ni] or m[L][nj * NX + i]):
					continue   # no corner cutting
				steps.append(((L, ni, nj), c * LAYER_COST[L] + (BEND if d not in (None, (di, dj)) else 0), (di, dj)))
		if only_layer is None and not via[j * NX + i] and not m[1 - L][j * NX + i]:
			steps.append(((1 - L, i, j), VIA_COST, None))
		for nxt, c, nd in steps:
			ng = g + c
			if ng < gbest.get(nxt, 1e9):
				gbest[nxt] = ng
				came[nxt] = (node, nd)
				heapq.heappush(heap, (ng + h(nxt[1], nxt[2]), ng, nxt, nd))
	return None

def to_items(path):
	"""Grid path -> track segments per layer and vias at layer changes."""
	segs, vias = [], []
	run = [path[0]]
	for p in path[1:]:
		if p[0] != run[-1][0]:
			vias.append((cx(p[1]), cy(p[2])))
			segs += corners(run)
			run = [p]
		else:
			run.append(p)
	segs += corners(run)
	return segs, vias

def corners(run):
	if len(run) < 2:
		return []
	pts = [run[0]]
	for a, b, c in zip(run, run[1:], run[2:]):
		if (b[1] - a[1], b[2] - a[2]) != (c[1] - b[1], c[2] - b[2]):
			pts.append(b)
	pts.append(run[-1])
	return [(p[0], cx(p[1]), cy(p[2]), cx(q[1]), cy(q[2])) for p, q in zip(pts, pts[1:])]

def commit(net, segs, vias, hw):
	for L, x1, y1, x2, y2 in segs:
		copper.append((('seg', x1, y1, x2, y2, hw * 2), (L,), net))
	for x, y in vias:
		copper.append((('circle', x, y, VIA_D / 2), (0, 1), net))
		holes.append((('circle', x, y, VIA_DRILL / 2), net))
	result.append((net, segs, vias, hw * 2))

def route_net(net):
	hw = width(net) / 2
	m, via = blocked_for(net, hw)
	terms = [pad_cells(s, layers) for s, layers, _ in pads_by_net[net]]
	tree = set(terms[0])
	left = terms[1:]
	segs, vias = [], []
	while left:
		left.sort(key=lambda t: min(abs(a[1] - b[1]) + abs(a[2] - b[2]) for a in list(t)[:4] for b in list(tree)[:200]))
		t = left.pop(0)
		if tree & t:
			tree |= t
			continue
		path = astar(list(tree), list(t), m, via)
		if not path:
			return False
		s, v = to_items(path)
		segs += s; vias += v
		tree |= set(path) | t
	commit(net, segs, vias, hw)
	return True

def fanout_gnd():
	"""Each GND pad: a short top-layer track to a via of its own (the bottom pour does the rest)."""
	hw = width(GND) / 2
	ok, failed = 0, []
	for s, layers, pad in pads_by_net[GND]:
		if 1 in layers:
			ok += 1      # through-hole: already in the bottom pour
			continue
		m, via = blocked_for(GND, hw)
		src = list(pad_cells(s, layers))
		ci, cj = round((s[1] - BX) / G), round((s[2] - BY) / G)
		targets = [(0, i, j) for j in range(max(0, cj - 15), min(NY, cj + 16)) for i in range(max(0, ci - 15), min(NX, ci + 16))
			if not via[j * NX + i] and not m[0][j * NX + i]]
		path = astar(src, targets, m, via, only_layer=0) if targets else None
		if not path:
			failed.append(f'{pad.GetParentFootprint().GetReference()}.{pad.GetNumber()}')
			continue
		segs, _ = to_items(path)
		end = path[-1]
		commit(GND, segs, [(cx(end[1]), cy(end[2]))], hw)
		ok += 1
	return ok, failed

def span(net):
	xs = [s[1] for s, _, _ in pads_by_net[net]]; ys = [s[2] for s, _, _ in pads_by_net[net]]
	return (max(xs) - min(xs)) + (max(ys) - min(ys))

# Order: wide power nets, then a via for every GND pad, then signals (shortest first).
# A net that fails is ripped up with everything else and goes first next time.
nets = [n for n in pads_by_net if n != GND and len(pads_by_net[n]) > 1]
order = sorted(nets, key=lambda n: (n not in POWER, span(n))) + [GND]
base_copper, base_holes = list(copper), list(holes)
for attempt in range(8):
	copper[:], holes[:] = list(base_copper), list(base_holes)
	result, failed = [], []
	for net in order:
		if net == GND:
			n, bad = fanout_gnd()
			failed += [GND] if bad else []
		elif not route_net(net):
			failed.append(net)
	print(f'attempt {attempt + 1}: ' + (f'failed {failed}' + (f' (GND pads {bad})' if GND in failed else '') if failed else 'everything routed'))
	if not failed:
		break
	order = failed + [n for n in order if n not in failed]
if failed:
	raise SystemExit(f'could not route {failed}')
print(f'GND: {n}/{len(pads_by_net[GND])} pads tied to the bottom pour')

for t in [t for t in board.GetTracks()]:
	board.Remove(t)
for net, segs, vias, w in result:
	ni = board.FindNet(net)
	for L, x1, y1, x2, y2 in segs:
		t = k.PCB_TRACK(board)
		t.SetStart(k.VECTOR2I(k.FromMM(x1), k.FromMM(y1)))
		t.SetEnd(k.VECTOR2I(k.FromMM(x2), k.FromMM(y2)))
		t.SetWidth(k.FromMM(w))
		t.SetLayer(LAYERS[L])
		t.SetNet(ni)
		board.Add(t)
	for x, y in vias:
		v = k.PCB_VIA(board)
		v.SetPosition(k.VECTOR2I(k.FromMM(x), k.FromMM(y)))
		v.SetLayerPair(k.F_Cu, k.B_Cu)
		v.SetWidth(k.FromMM(VIA_D))
		v.SetDrill(k.FromMM(VIA_DRILL))
		v.SetNet(ni)
		board.Add(v)
k.ZONE_FILLER(board).Fill(board.Zones())
k.SaveBoard(str(PCB), board)
tracks = sum(len(r[1]) for r in result); vias = sum(len(r[2]) for r in result)
print(f'wrote {tracks} track segments and {vias} vias; pours filled')
