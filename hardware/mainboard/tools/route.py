"""
Route the board: a small maze router (A* on a grid) for the two outer layers.

Every track keeps (clearance + half its width + a margin) from copper of other
nets, holes and the board edge, so the result passes KiCad's DRC with the
project's rules. Order: power nets (wide, narrowing where a pin is too fine),
then a via per pad of each plane net (GND, +3V3: the inner layers carry them),
then signals, shortest first. A net that fails is ripped up with everything
else and goes first next time. Runs inside the kicad/kicad image; DRC after
it is the judge.
"""
import heapq, itertools, math, sys
from pathlib import Path

import pcbnew as k

sys.path.insert(0, str(Path(__file__).parent))
from design import NAME, FINE, POWER, PLANES, PREROUTES, PREVIAS, KEEP_CLEAR, POUR_FED

PCB = Path(__file__).parent.parent / f'{NAME}.kicad_pcb'
G = 0.125                     # grid pitch, mm (a quarter of the 0.5 mm ribbon pitch)
CLR, EDGE, HOLE = 0.2, 0.35, 0.3
VIA_D, VIA_DRILL = 0.45, 0.2   # JLCPCB's standard for 4-layer boards
HOLE_TO_HOLE = 0.3
SAFE = 0.05                   # margin for diagonal steps between grid points
VIA_SAFE = 0.02               # vias sit on grid points: no diagonal error, just rounding
LAYER_COST = (1.0, 1.1)
VIA_COST, BEND = 5.0, 0.3
AGAINST = 1.3                 # top prefers horizontal runs, bottom vertical: crossing nets use different layers
LAYERS = (k.F_Cu, k.B_Cu)

FINE_NETS = {'/' + n for n in FINE}
POWER_NETS = {'/' + n for n in POWER}
PLANE_NETS = ['/' + n for n in PLANES.values()]

def widths(net):
	"""Widths to try, widest first: a power net narrows where it must."""
	if net in FINE_NETS:
		return [0.15]
	if net in POWER_NETS:
		return [0.5, 0.25, 0.15]
	return [0.25, 0.15]

mm = k.ToMM
board = k.LoadBoard(str(PCB))
box = board.GetBoardEdgesBoundingBox()
# Grid points on exact multiples of G, so they line up with fine-pitch pads (the
# edge bounding box includes half the outline's line width, which would shift it).
BX, BY = math.floor(mm(box.GetX()) / G + 0.5) * G, math.floor(mm(box.GetY()) / G + 0.5) * G
BW, BH = mm(box.GetX() + box.GetWidth()) - BX, mm(box.GetY() + box.GetHeight()) - BY
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

def row_span(s, y, r):
	"""x interval of a circle or capsule (grown by r) on the line at height y, or None."""
	if s[0] == 'circle':
		dy = y - s[2]; rr = s[3] + r
		if abs(dy) >= rr:
			return None
		d = math.sqrt(rr * rr - dy * dy)
		return s[1] - d, s[1] + d
	_, x1, y1, x2, y2, w = s
	rr = w / 2 + r
	lo, hi = math.inf, -math.inf
	for px, py in ((x1, y1), (x2, y2)):     # the round ends
		dy = y - py
		if abs(dy) < rr:
			d = math.sqrt(rr * rr - dy * dy)
			lo, hi = min(lo, px - d), max(hi, px + d)
	vx, vy = x2 - x1, y2 - y1
	L = math.hypot(vx, vy)
	if L > 1e-9:                             # the straight band between them
		ux, uy = vx / L, vy / L
		# points p with |(p - p1) x u| < rr and 0 <= (p - p1) . u <= L, on this row
		cands = []
		if abs(uy) > 1e-9:   # band edges cross the row where the cross product = +-rr
			for c in (rr, -rr):
				# (x - x1) * uy - (y - y1) * ux = c
				cands.append(x1 + (c + (y - y1) * ux) / uy)
		if abs(ux) > 1e-9:
			for t in (0, L):
				# (x - x1) * ux + (y - y1) * uy = t
				cands.append(x1 + (t - (y - y1) * uy) / ux)
		inside = [x for x in cands
			if abs((x - x1) * uy - (y - y1) * ux) <= rr + 1e-9 and -1e-9 <= (x - x1) * ux + (y - y1) * uy <= L + 1e-9]
		if abs(uy) <= 1e-9 and abs(y - y1) < rr:   # horizontal segment
			inside += [min(x1, x2), max(x1, x2)]
		if inside:
			lo, hi = min(lo, min(inside)), max(hi, max(inside))
	return (lo, hi) if lo < hi else None

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
	layers = tuple(i for i, L in enumerate(LAYERS) if pad.IsOnLayer(L))
	if not layers:
		continue      # paste-only apertures
	lay = LAYERS[layers[0]]
	sz = pad.GetSize(lay)
	w, h = mm(sz.x), mm(sz.y)
	a = math.radians(pad.GetOrientation().AsDegrees())
	shape = ('circle', x, y, w / 2) if pad.GetShape(lay) == k.PAD_SHAPE_CIRCLE else ('rect', x, y, w, h, -a)
	copper.append((shape, layers, net))
	if net:
		pads_by_net.setdefault(net, []).append((shape, layers, pad))

# Fixed copper from design.py: real tracks and vias, and extra terminals of their
# nets, so the router connects to them like to a pad.
X0, Y0 = 100.0, 80.0          # make_pcb.py's board corner on the page; design.py works in board coordinates
prerouted = []
for net, layer, pts, w in PREROUTES:
	L = 0 if layer == 'F' else 1
	pts = [(x + X0, y + Y0) for x, y in pts]
	for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
		s = ('seg', x1, y1, x2, y2, w)
		copper.append((s, (L,), '/' + net))
		pads_by_net['/' + net].append((s, (L,), None))
		prerouted.append(('/' + net, [(L, x1, y1, x2, y2)], [], w))
for net, x, y in PREVIAS:
	x, y = x + X0, y + Y0
	s = ('circle', x, y, VIA_D / 2)
	copper.append((s, (0, 1), '/' + net))
	holes.append((('circle', x, y, VIA_DRILL / 2), '/' + net))
	pads_by_net['/' + net].append((s, (0, 1), None))
	prerouted.append(('/' + net, [], [(x, y)], 0.15))

def raster(mask, s, infl):
	x0, y0, x1, y1 = bbox(s)
	j0, j1 = max(0, int((y0 - infl - BY) / G)), min(NY - 1, int((y1 + infl - BY) / G) + 1)
	if s[0] == 'rect':
		i0, i1 = max(0, int((x0 - infl - BX) / G)), min(NX - 1, int((x1 + infl - BX) / G) + 1)
		for j in range(j0, j1 + 1):
			y, row = cy(j), j * NX
			for i in range(i0, i1 + 1):
				if not mask[row + i] and dist(s, cx(i), y) < infl:
					mask[row + i] = 1
		return
	for j in range(j0, j1 + 1):
		span = row_span(s, cy(j), infl)
		if span:
			# grid points strictly inside the interval, like dist() < infl
			i0 = max(0, math.floor((span[0] - BX) / G) + 1)
			i1 = min(NX - 1, math.ceil((span[1] - BX) / G) - 1)
			if i1 >= i0:
				row = j * NX
				mask[row + i0: row + i1 + 1] = b'\x01' * (i1 - i0 + 1)

_edges = {}
def edge_mask(infl):
	if infl not in _edges:
		m = bytearray(N)
		for j in range(NY):
			for i in range(NX):
				x, y = cx(i) - BX, cy(j) - BY
				if x < infl or y < infl or x > BW - infl or y > BH - infl:
					m[j * NX + i] = 1
		_edges[infl] = bytes(m)
	return bytearray(_edges[infl])

FINE_CLR = 0.15                # between two fine-class nets (the display bus), as the project rules allow
def clr(a, b):
	return FINE_CLR if a in FINE_NETS and b in FINE_NETS else CLR

def blocked_for(net, hw):
	"""Per-layer masks of where a track of half-width hw on net may not go, and where a via may not go."""
	m = [edge_mask(EDGE + hw), edge_mask(EDGE + hw)]
	via = edge_mask(EDGE + VIA_D / 2)
	for s, layers, n in copper:
		if n == net:
			continue
		for L in layers:
			raster(m[L], s, clr(net, n) + hw + SAFE)
		raster(via, s, clr(net, n) + VIA_D / 2 + VIA_SAFE)
	for h, hnet in holes:
		if hnet != net:
			for L in (0, 1):
				raster(m[L], h, HOLE + hw + SAFE)
		raster(via, h, max(HOLE + VIA_D / 2, HOLE_TO_HOLE + VIA_DRILL) + SAFE)
	# No vias in our own pads either (they'd wick solder away).
	for s, layers, pad in pads_by_net.get(net, []):
		if pad is not None:
			raster(via, s, CLR + VIA_D / 2)
	# Strips left to the pour (design.py KEEP_CLEAR): no tracks there, and no vias.
	for layer, x0, y0, x1, y1 in KEEP_CLEAR:
		L = 0 if layer == 'F' else 1
		r = ('rect', X0 + (x0 + x1) / 2, Y0 + (y0 + y1) / 2, x1 - x0, y1 - y0, 0)
		raster(m[L], r, hw)
		raster(via, r, VIA_D / 2)
	via = bytearray(a | b | c for a, b, c in zip(via, m[0], m[1]))
	return m, via

def pad_cells(s, layers, inset=0.06):
	if s[0] == 'seg':
		inset = -0.01      # a thin fixed track: anything on its centre line counts
	out = set()
	for L in layers:
		x0, y0, x1, y1 = bbox(s)
		for j in range(max(0, int((y0 - BY) / G)), min(NY, int((y1 - BY) / G) + 2)):
			for i in range(max(0, int((x0 - BX) / G)), min(NX, int((x1 - BX) / G) + 2)):
				if dist(s, cx(i), cy(j)) < -inset:
					out.add((L, i, j))
		if not any(c[0] == L for c in out):   # tiny pad: the grid point nearest its centre
			out.add((L, round((s[1] - BX) / G), round((s[2] - BY) / G)))
	return out

# A via is bigger than a track: other nets' keep-outs (made for track centre lines)
# must stay clear of this little disc around a via's centre, not just the centre.
VIA_DISC = [0, 1, -1, NX, -NX]

DIRS = [(1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0),
	(1, 1, 1.4142), (1, -1, 1.4142), (-1, 1, 1.4142), (-1, -1, 1.4142)]

def astar(sources, targets, m, via, only_layer=None, limit=400000, soft=None):
	"""soft = (occ, hist, pres): crossing other nets' keep-outs costs extra instead of being forbidden."""
	tx = [t[1] for t in targets]; ty = [t[2] for t in targets]
	tbox = (min(tx), min(ty), max(tx), max(ty))
	def h(i, j):
		dx = max(tbox[0] - i, 0, i - tbox[2]); dy = max(tbox[1] - j, 0, j - tbox[3])
		return max(dx, dy) + 0.4142 * min(dx, dy)
	gbest, came, heap = {}, {}, []
	for s in sources:
		gbest[s] = 0.0
		came[s] = (None, None)
		heapq.heappush(heap, (h(s[1], s[2]), 0.0, s, None))
	tset = set(targets)
	pops = 0
	while heap:
		f, g, node, d = heapq.heappop(heap)
		if g > gbest.get(node, 1e9) + 1e-9:
			continue
		pops += 1
		if pops > limit:
			return None
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
				against = (L == 0 and di == 0) or (L == 1 and dj == 0)
				cost = c * LAYER_COST[L] * (AGAINST if against else 1) + (BEND if d not in (None, (di, dj)) else 0)
				if soft:
					idx = nj * NX + ni
					cost *= (1 + soft[1][L][idx]) * (1 + soft[2] * soft[0][L][idx])
				steps.append(((L, ni, nj), cost, (di, dj)))
		if only_layer is None and not via[j * NX + i] and not m[1 - L][j * NX + i]:
			cost = VIA_COST
			if soft:
				idx = j * NX + i
				o = max(soft[0][LL][idx + d] for LL in (0, 1) for d in VIA_DISC if 0 <= idx + d < N)
				cost *= (1 + soft[1][0][idx] + soft[1][1][idx]) * (1 + soft[2] * o)
			steps.append(((1 - L, i, j), cost, None))
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

def commit(net, segs, vias, w):
	for L, x1, y1, x2, y2 in segs:
		copper.append((('seg', x1, y1, x2, y2, w), (L,), net))
	for x, y in vias:
		copper.append((('circle', x, y, VIA_D / 2), (0, 1), net))
		holes.append((('circle', x, y, VIA_DRILL / 2), net))
	result.append((net, segs, vias, w))

def route_net(net):
	for w in widths(net):
		m, via = blocked_for(net, w / 2)
		terms = [pad_cells(s, layers) for s, layers, _ in pads_by_net[net]]
		tree = set(terms[0])
		left = terms[1:]
		segs, vias, ok = [], [], True
		while left:
			left.sort(key=lambda t: min(abs(a[1] - b[1]) + abs(a[2] - b[2]) for a in list(t)[:4] for b in list(tree)[:300]))
			t = left.pop(0)
			if tree & t:
				tree |= t
				continue
			path = astar(list(tree), list(t), m, via)
			if not path:
				ok = False
				break
			s, v = to_items(path)
			segs += s; vias += v
			tree |= set(path) | t
		if ok:
			commit(net, segs, vias, w)
			return True
	return False

def fanout(net):
	"""Each surface pad of a plane net: a short top-layer track to a via of its own."""
	failed = []
	reached = set()   # grid cells (top layer) on this net's fanout copper so far
	w = 0.25
	m, via = blocked_for(net, w / 2)
	fine_m = None
	for s, layers, pad in pads_by_net[net]:
		if 1 in layers or pad is None:
			continue      # through-hole (the inner plane reaches it) or fixed copper from design.py
		narrow = s[0] == 'rect' and min(s[3], s[4]) < 0.45
		if narrow and net == '/GND' and pad.GetParentFootprint().GetReference() in POUR_FED:
			continue      # the ribbon connector's ground pins: the pour behind it reaches them
		if narrow and fine_m is None:
			fine_m, _ = blocked_for(net, 0.075)
		mm_ = fine_m if narrow else m
		src = list(pad_cells(s, layers))
		ci, cj = round((s[1] - BX) / G), round((s[2] - BY) / G)
		R = 24
		targets = [(0, i, j) for j in range(max(0, cj - R), min(NY, cj + R + 1)) for i in range(max(0, ci - R), min(NX, ci + R + 1))
			if not via[j * NX + i] and not mm_[0][j * NX + i]]
		joined = set(c for c in reached if abs(c[1] - ci) <= R and abs(c[2] - cj) <= R)   # this net's copper nearby
		path = astar(src, targets + list(joined), mm_, via, only_layer=0, limit=60000) if targets or joined else None
		if not path:
			failed.append(f'{pad.GetParentFootprint().GetReference()}.{pad.GetNumber()}')
			continue
		segs, _ = to_items(path)
		end = path[-1]
		if end in joined:
			commit(net, segs, [], 0.15 if narrow else w)      # tied to a neighbour that already has a via
		else:
			vx, vy = cx(end[1]), cy(end[2])
			commit(net, segs, [(vx, vy)], 0.15 if narrow else w)
			# Later vias of this net keep their distance from this one (hole to hole).
			raster(via, ('circle', vx, vy, VIA_DRILL / 2), HOLE_TO_HOLE + VIA_DRILL + SAFE)
		reached.update(set(path) | set(src))
	return failed

def span(net):
	xs = [s[1] for s, _, _ in pads_by_net[net]]; ys = [s[2] for s, _, _ in pads_by_net[net]]
	return (max(xs) - min(xs)) + (max(ys) - min(ys))

def cells_of(s, infl):
	"""Grid indices within infl of a circle or capsule (row spans, like raster)."""
	out = []
	x0, y0, x1, y1 = bbox(s)
	for j in range(max(0, int((y0 - infl - BY) / G)), min(NY - 1, int((y1 + infl - BY) / G) + 1) + 1):
		span = row_span(s, cy(j), infl)
		if span:
			i0, i1 = max(0, math.floor((span[0] - BX) / G) + 1), min(NX - 1, math.ceil((span[1] - BX) / G) - 1)
			out.extend(range(j * NX + i0, j * NX + i1 + 1))
	return out

def keepout(segs, vias, w, k):
	"""Per layer: cells another net's centre line must stay out of, k = its half width + clearance."""
	ko = ([], [])
	for L, x1, y1, x2, y2 in segs:
		ko[L].extend(cells_of(('seg', x1, y1, x2, y2, w), k + SAFE))
	for x, y in vias:
		c = cells_of(('circle', x, y, VIA_D / 2), k + VIA_SAFE)
		ko[0].extend(c); ko[1].extend(c)
	return ko

def keepouts(net, segs, vias, w):
	"""(seen by fine nets, seen by the others): fine next to fine may sit closer."""
	fine = net in FINE_NETS
	return keepout(segs, vias, w, 0.075 + (FINE_CLR if fine else CLR)), keepout(segs, vias, w, 0.2 + CLR)

nets = [n for n in pads_by_net if n not in PLANE_NETS and len(pads_by_net[n]) > 1]
base_copper, base_holes = list(copper), list(holes)

ROUNDS = int(__import__('os').environ.get('ROUNDS', 25))   # then a hard finishing pass for any stragglers

class Blocked(Exception):
	pass

def place_in_some_order(early, tries=150):
	"""Route the early nets one after another, backtracking to the last choice when
	one doesn't fit (depth first, at most `budget` route attempts in all)."""
	global result
	copper[:], holes[:] = list(base_copper), list(base_holes)
	result = list(prerouted)
	budget = [tries]
	def go(left):
		if not left:
			return True
		for net in left:
			if budget[0] <= 0:
				return False
			budget[0] -= 1
			saved = (list(copper), list(holes), list(result))
			if route_net(net) and go([n for n in left if n != net]):
				return True
			copper[:], holes[:], result[:] = saved
		return False
	return go(list(early))

def route_all(early):
	"""Phase 1 hard (any 'early' signal nets, then power, then plane vias), phase 2 negotiated."""
	global result
	# Early nets go in before anything else, in the first order where they all fit
	# (the two USB data pairs, for instance, each need a via and can block each other).
	if not place_in_some_order(early):
		raise SystemExit(f'no order fits all of {early}')
	for net in PLANE_NETS:
		bad = fanout(net)
		if bad:
			print(f'{net}: no via for pads {bad}', flush=True)
	print(f'phase 1 done (early: {early})', flush=True)
	return negotiate([n for n in nets if n not in early])

def negotiate(signals):
	"""Phase 2 (PathFinder): every signal net routes against the fixed copper as hard
	obstacles and against the other signal nets as a cost that grows each round,
	plus a history cost on cells that were fought over. Until nobody overlaps."""
	signals = sorted(signals, key=span)
	hard = {}
	for net in signals:
		# power nets negotiate at 0.4 mm, so they can still squeeze past fine pins
		w = 0.15 if net in FINE_NETS else 0.4 if net in POWER_NETS else 0.25
		hard[net] = (w, blocked_for(net, w / 2))
	occ = {True: (bytearray(N), bytearray(N)), False: (bytearray(N), bytearray(N))}   # seen by fine / other nets
	hist = ([0] * N, [0] * N)
	routes = {}      # net -> (segs, vias, w, centre cells, (keepouts seen by fine, by others))

	def lay_down(net, sign):
		for seen_by_fine in (True, False):
			ko = routes[net][4][0 if seen_by_fine else 1]
			for L in (0, 1):
				arr = occ[seen_by_fine][L]
				for idx in ko[L]:
					arr[idx] += sign

	pres = 0.5
	todo = list(signals)
	unfinished = set()     # nets that ran out of search budget this round
	for it in range(ROUNDS):
		for net in todo:
			if net in routes:
				lay_down(net, -1)
			w, (m, via) = hard[net]
			terms = [pad_cells(sh, layers) for sh, layers, _ in pads_by_net[net]]
			tree, left, segs, vias, centre = set(terms[0]), terms[1:], [], [], set()
			while left:
				left.sort(key=lambda t: min(abs(a[1] - b[1]) + abs(a[2] - b[2]) for a in list(t)[:4] for b in list(tree)[:300]))
				t = left.pop(0)
				if tree & t:
					tree |= t
					continue
				path = astar(list(tree), list(t), m, via, soft=(occ[net in FINE_NETS], hist, pres), limit=800000)
				if not path:
					# Out of search budget (costs got steep) or truly no way? Only the latter is fatal.
					if astar(list(tree), list(t), m, via, limit=800000) is None:
						raise Blocked(net)
					break
				sg, vs = to_items(path)
				segs += sg; vias += vs
				centre |= set(path)
				tree |= set(path) | t
			if left:
				unfinished.add(net)
				if net in routes:
					lay_down(net, +1)      # couldn't finish this round: keep last round's route
					continue
			else:
				unfinished.discard(net)
			routes[net] = (segs, vias, w, centre, keepouts(net, segs, vias, w))
			lay_down(net, +1)
		# Who overlaps? A net's centre line in another net's keep-out (its own removed first).
		todo = []
		for net in signals:
			lay_down(net, -1)
			mine = occ[net in FINE_NETS]
			clash = [c for c in routes[net][3] if mine[c[0]][c[2] * NX + c[1]]]
			for x, y in routes[net][1]:          # its vias
				idx = round((y - BY) / G) * NX + round((x - BX) / G)
				if any(mine[L][idx + d] for L in (0, 1) for d in VIA_DISC if 0 <= idx + d < N):
					clash.append((0, idx % NX, idx // NX))
			lay_down(net, +1)
			if clash:
				todo.append(net)
				for L, i, j in clash:
					hist[L][j * NX + i] += 1
		todo += [n for n in unfinished if n not in todo]
		print(f'round {it + 1}: {len(todo)} nets overlap' + (f' ({len(unfinished)} unfinished)' if unfinished else ''), flush=True)
		if not todo:
			break
		pres = min(pres * 1.6, 2000.0)  # steep, but not so steep the search runs out of budget
	if todo and len(todo) <= 8:
		# Finish: freeze everyone who doesn't overlap, then route the few that do one at
		# a time against all of it as hard obstacles, trying a few orders.
		frozen_copper, frozen_holes, frozen_result = list(copper), list(holes), list(result)
		for perm in list(itertools.permutations(todo))[:24]:
			copper[:], holes[:], result[:] = list(frozen_copper), list(frozen_holes), list(frozen_result)
			for net in signals:
				if net not in todo:
					segs, vias, w, _, _ = routes[net]
					commit(net, segs, vias, w)
			if all(route_net(net) for net in perm):
				print(f'finished {list(perm)} against the rest', flush=True)
				return
		copper[:], holes[:], result[:] = frozen_copper, frozen_holes, frozen_result
	if todo:
		# Where do they fight? Save the overlapping routes to look at, and list the spots.
		for net in signals:
			segs, vias, w, _, _ = routes[net]
			commit(net, segs, vias, w)
		write_board(Path(__file__).parent.parent / 'build/overlap.kicad_pcb')
		for net in todo:
			lay_down(net, -1)
			mine = occ[net in FINE_NETS]
			pts = [(cx(i) - X0, cy(j) - Y0, L) for L, i, j in routes[net][3] if mine[L][j * NX + i]]
			lay_down(net, +1)
			xs, ys = [p[0] for p in pts], [p[1] for p in pts]
			print(f'  {net}: {len(pts)} cells, x {min(xs):.1f}..{max(xs):.1f} y {min(ys):.1f}..{max(ys):.1f} layers {sorted(set(p[2] for p in pts))}')
		raise SystemExit(f'could not untangle {todo}')
	for net in signals:
		segs, vias, w, _, _ = routes[net]
		commit(net, segs, vias, w)

early = [n for n in ('/CC1', '/CC2', '/USB_CON_DP', '/USB_CON_DN', '/USB_DP', '/USB_DN') if n in pads_by_net]
def write_board(path):
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
	k.SaveBoard(str(path), board)

if len(sys.argv) > 1 and sys.argv[1] == 'trial':
	# Diagnosis: route these nets in this order on an empty board; save it to look at.
	copper[:], holes[:] = list(base_copper), list(base_holes)
	result = list(prerouted)
	for net in sys.argv[2:]:
		print(net, 'ok' if route_net(net) else 'FAILED', flush=True)
	write_board(Path(__file__).parent.parent / 'build/trial.kicad_pcb')
	raise SystemExit
if len(sys.argv) > 1 and sys.argv[1] == 'alone':
	# Diagnosis: can each of these nets route on an otherwise empty board?
	for net in sys.argv[2:] or early:
		copper[:], holes[:] = list(base_copper), list(base_holes)
		result = list(prerouted)
		print(net, 'routes alone' if route_net(net) else 'CANNOT route even alone', flush=True)
	raise SystemExit
for restart in range(10):
	try:
		route_all(early)
		break
	except Blocked as b:
		print(f'{b.args[0]} is walled in by power/plane copper: routing it first', flush=True)
		early.append(b.args[0])
else:
	raise SystemExit('gave up')



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
