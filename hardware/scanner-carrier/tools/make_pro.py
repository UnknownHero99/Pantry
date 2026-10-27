"""Write scanner-carrier.kicad_pro: KiCad's defaults plus rules JLCPCB's cheapest 2-layer process can make."""
import json, sys
from pathlib import Path

base = json.loads(Path(sys.argv[1]).read_text())   # a stock KiCad 10 project, for the defaults
out = Path(__file__).parent.parent / 'scanner-carrier.kicad_pro'

ds = base['board']['design_settings']
ds['rules'].update({
	'min_clearance': 0.15, 'min_track_width': 0.15, 'min_via_diameter': 0.6, 'min_via_annular_width': 0.15,
	'min_through_hole_diameter': 0.3, 'min_hole_to_hole': 0.5, 'min_hole_clearance': 0.25,
	'min_copper_edge_clearance': 0.3, 'min_text_height': 0.7, 'min_text_thickness': 0.12, 'min_silk_clearance': 0.0,
})
ds['track_widths'] = [0.0, 0.25, 0.4, 0.5, 0.8]
ds['via_dimensions'] = [{'diameter': 0.0, 'drill': 0.0}, {'diameter': 0.6, 'drill': 0.3}]
ds['drc_exclusions'] = []

ns = base['net_settings']
default = dict(ns['classes'][0], clearance=0.2, track_width=0.25, via_diameter=0.6, via_drill=0.3)
power = dict(default, name='Power', track_width=0.5, priority=0)
ns['classes'] = [default, power]
ns['netclass_assignments'] = None
ns['netclass_patterns'] = [{'netclass': 'Power', 'pattern': p} for p in ('/+5V', '/+3V3', '/GND', '/BUZZ_SW')]

base['meta']['filename'] = out.name
base['sheets'] = []
base['boards'] = []
out.write_text(json.dumps(base, indent=2) + '\n')
print(f'wrote {out.name}')
