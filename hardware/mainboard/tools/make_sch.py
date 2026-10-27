"""
Write the KiCad schematic from design.py.

Every pin gets a net label instead of a wire: KiCad joins equal labels into one
net, and the sheet stays readable without a router. Runs inside the kicad/kicad
image (it reads the stock symbol libraries).
"""
import copy, sys, uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from sexpr import Str, parse, dump, find, find_all
from design import NAME, TITLE, PAPER, PARTS, POWER_FLAGS, NOTES

SYMBOLS = Path('/usr/share/kicad/symbols')
PROJECT_LIBS = {'Pantry': Path(__file__).parent.parent / 'lib/Pantry.kicad_sym'}   # parts KiCad doesn't have
OUT = Path(__file__).parent.parent / f'{NAME}.kicad_sch'
NS = uuid.UUID('6f1d2a52-3c1b-4c55-9a7e-70616e747279')
uid = lambda *k: Str(str(uuid.uuid5(NS, '/'.join(map(str, k)))))
ROOT = uid('root')

_libs = {}
def lib_symbol(lib_id):
	"""The library symbol, flattened if it 'extends' another, named Lib:Name."""
	lib, name = lib_id.split(':')
	if lib not in _libs:
		path = PROJECT_LIBS.get(lib, SYMBOLS / f'{lib}.kicad_sym')
		_libs[lib] = {s[1]: s for s in find_all(parse(path.read_text()), 'symbol')}
	syms = _libs[lib]
	sym = copy.deepcopy(syms[name])
	ext = find(sym, 'extends')
	if ext:
		parent = copy.deepcopy(syms[ext[1]])
		props = {p[1]: p for p in find_all(sym, 'property')}
		flat = [c for c in parent if not (isinstance(c, list) and c[0] in ('property', 'symbol'))]
		flat += [props.pop(p[1], p) for p in find_all(parent, 'property')] + list(props.values())
		for sub in find_all(parent, 'symbol'):
			sub[1] = Str(sub[1].replace(ext[1], name, 1))
			flat.append(sub)
		sym = flat
	sym[1] = Str(lib_id)
	return sym

def pins(sym):
	"""pin number -> (x, y, angle) of its connection point, symbol coordinates."""
	out = {}
	for sub in find_all(sym, 'symbol'):
		for p in find_all(sub, 'pin'):
			at = find(p, 'at')
			out[find(p, 'number')[1]] = (float(at[1]), float(at[2]), int(float(at[3])))
	return out

def by_name(lib_id, names):
	"""{pin name: net} -> {pin number: net}; a name like GND can cover several pins."""
	out = {}
	for sub in find_all(lib_symbol(lib_id), 'symbol'):
		for p in find_all(sub, 'pin'):
			net = names.get(find(p, 'name')[1])
			if net:
				out[find(p, 'number')[1]] = net
	missing = set(names) - {find(p, 'name')[1] for sub in find_all(lib_symbol(lib_id), 'symbol') for p in find_all(sub, 'pin')}
	assert not missing, f'{lib_id}: no pins named {missing}'
	return out

def font(size=1.27):
	return ['effects', ['font', ['size', size, size]]]

def prop(name, value, x, y, hide=False):
	p = ['property', Str(name), Str(value), ['at', x, y, 0]]
	if hide:
		p.append(['hide', 'yes'])
	p.append(font())
	return p

items, used = [], {}

# Symbol origins on the 2.54 mm grid keep every pin end on KiCad's connection grid.
snap = lambda v: round(round(v / 2.54) * 2.54, 2)

def place(ref, lib_id, value, x, y, footprint='', fields=None, connections=None, in_bom=True):
	"""Place one symbol and label its pins. connections: pin -> net (missing pins get a no-connect)."""
	sym = used.setdefault(lib_id, lib_symbol(lib_id))
	lib_props = {p[1]: p for p in find_all(sym, 'property')}
	inst = ['symbol', ['lib_id', Str(lib_id)], ['at', x, y, 0], ['unit', 1],
		['exclude_from_sim', 'no'], ['in_bom', 'yes' if in_bom and not ref.startswith('#') else 'no'],
		['on_board', 'no' if ref.startswith('#') else 'yes'], ['dnp', 'no'], ['uuid', uid('sym', ref)]]
	values = {'Reference': ref, 'Value': value, 'Footprint': footprint}
	for name, lp in lib_props.items():
		if name.startswith('ki_'):
			continue   # library-only (keywords, footprint filters); KiCad keeps them off placed symbols
		at = find(lp, 'at')
		hidden = find(lp, 'hide') is not None or name not in ('Reference', 'Value')
		inst.append(prop(name, values.get(name, lp[2]), x + float(at[1]), y - float(at[2]), hidden))
	for k, v in (fields or {}).items():
		inst.append(prop(k, v, x, y, True))
	for n in pins(sym):
		inst.append(['pin', Str(n), ['uuid', uid('pin', ref, n)]])
	inst.append(['instances', ['project', Str(NAME), ['path', Str('/' + ROOT), ['reference', Str(ref)], ['unit', 1]]]])
	items.append(inst)
	for n, (px, py, ang) in pins(sym).items():
		wx, wy = round(x + px, 2), round(y - py, 2)
		net = (connections or {}).get(n)
		if net is None:
			items.append(['no_connect', ['at', wx, wy], ['uuid', uid('nc', ref, n)]])
			continue
		# A pin's angle points from its end into the body; the label goes the other way.
		la = {0: 180, 180: 0, 90: 270, 270: 90}[ang]
		just = ['justify', 'right' if la in (180, 270) else 'left', 'bottom']
		items.append(['label', Str(net), ['at', wx, wy, la], ['fields_autoplaced', 'yes'],
			['effects', ['font', ['size', 1.27, 1.27]], just], ['uuid', uid('label', ref, n)]])

for ref, p in PARTS.items():
	sx, sy = (snap(v) for v in p['sch'])
	fields = {'LCSC': p['lcsc']} if p.get('lcsc') else {}
	if p.get('labels'):
		fields['Pins'] = ' / '.join(f'{i + 1} {l}' for i, l in enumerate(p['labels']))
	# Holes and test pads are bare copper: nothing to buy, so not in the BOM.
	connections = by_name(p['symbol'], p['pins_by_name']) if 'pins_by_name' in p else p['pins']
	place(ref, p['symbol'], p['value'], sx, sy, p['footprint'], fields, connections, in_bom=not ref.startswith(('H', 'TP')))

for i, (net, (x, y)) in enumerate(POWER_FLAGS.items()):
	place(f'#FLG0{i + 1}', 'power:PWR_FLAG', 'PWR_FLAG', snap(x), snap(y), connections={'1': net})

for i, (x, y, text) in enumerate(NOTES):
	items.append(['text', Str(text), ['exclude_from_sim', 'no'], ['at', x, y, 0],
		['effects', ['font', ['size', 1.27, 1.27]], ['justify', 'left', 'bottom']], ['uuid', uid('note', i)]])

sch = ['kicad_sch', ['version', 20250610], ['generator', Str('pantry')], ['generator_version', Str('10.0')],
	['uuid', ROOT], ['paper', Str(PAPER)],
	['title_block', ['title', Str(TITLE)], ['date', Str('2026-10-27')], ['rev', Str('1')],
		['comment', 1, Str('Generated by tools/make_sch.py from tools/design.py')]],
	['lib_symbols'] + list(used.values())] + items + [
	['sheet_instances', ['path', Str('/'), ['page', Str('1')]]], ['embedded_fonts', 'no']]
OUT.write_text(dump(sch) + '\n')
print(f'wrote {OUT.name}: {len(PARTS)} parts, {len(used)} symbols')
