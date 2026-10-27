"""
JLCPCB assembly files from design.py and KiCad's placement export:
  fab/bom-jlcpcb.csv   Comment, Designator, Footprint, LCSC Part #
  fab/cpl-jlcpcb.csv   Designator, Mid X, Mid Y, Layer, Rotation
Parts without an LCSC number (holes, test pads) are left out of both.
"""
import csv, sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from design import PARTS

ROOT = Path(__file__).parent.parent
FAB = ROOT / 'fab'

# One line per part number; the four 1.25 mm sockets have different values but are one part.
COMMENT = {'C696092': 'Molex PicoBlade 53261-0471 1x4 right-angle'}
groups = defaultdict(list)
for ref, p in PARTS.items():
	if p.get('lcsc'):
		groups[(COMMENT.get(p['lcsc'], p['value']), p['footprint'].split(':')[1], p['lcsc'])].append(ref)
with open(FAB / 'bom-jlcpcb.csv', 'w', newline='') as f:
	w = csv.writer(f)
	w.writerow(['Comment', 'Designator', 'Footprint', 'LCSC Part #'])
	for (value, fp, lcsc), refs in sorted(groups.items(), key=lambda g: g[1][0]):
		w.writerow([value, ','.join(sorted(refs, key=lambda r: (r.rstrip('0123456789'), int(r[len(r.rstrip('0123456789')):])))), fp, lcsc])

pos = list(csv.DictReader(open(sys.argv[1])))   # kicad-cli pcb export pos --format csv --units mm
with open(FAB / 'cpl-jlcpcb.csv', 'w', newline='') as f:
	w = csv.writer(f)
	w.writerow(['Designator', 'Mid X', 'Mid Y', 'Layer', 'Rotation'])
	for row in pos:
		ref = row['Ref']
		if PARTS.get(ref, {}).get('lcsc'):
			w.writerow([ref, f"{float(row['PosX']):.3f}mm", f"{float(row['PosY']):.3f}mm",
				'Top' if row['Side'] == 'top' else 'Bottom', f"{float(row['Rot']):.0f}"])
print(f'wrote bom-jlcpcb.csv ({len(groups)} lines) and cpl-jlcpcb.csv')
