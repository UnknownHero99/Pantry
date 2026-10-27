"""Write mainboard.kicad_pro: KiCad's defaults plus rules inside JLCPCB's standard process."""
import json, sys
from pathlib import Path

base = json.loads(Path(sys.argv[1]).read_text())   # a stock KiCad 10 project, for the defaults
out = Path(__file__).parent.parent / 'mainboard.kicad_pro'

ds = base['board']['design_settings']
ds['rules'].update({
	'min_clearance': 0.15, 'min_track_width': 0.15, 'min_via_diameter': 0.45, 'min_via_annular_width': 0.1,
	'min_through_hole_diameter': 0.2,   # the ESP32 footprint's thermal vias; fine on JLCPCB 4-layer
	 'min_hole_to_hole': 0.3, 'min_hole_clearance': 0.25,
	'min_copper_edge_clearance': 0.3, 'min_text_height': 0.7, 'min_text_thickness': 0.12, 'min_silk_clearance': 0.0,
})
ds['track_widths'] = [0.0, 0.25, 0.4, 0.5, 0.8]
ds['via_dimensions'] = [{'diameter': 0.0, 'drill': 0.0}, {'diameter': 0.45, 'drill': 0.2}]
ds['drc_exclusions'] = []
# The demo project these defaults come from ignores these; parts must not overlap.
ds['rule_severities'].update({'courtyards_overlap': 'error', 'missing_courtyard': 'warning'})

ns = base['net_settings']
default = dict(ns['classes'][0], clearance=0.2, track_width=0.25, via_diameter=0.45, via_drill=0.2)
power = dict(default, name='Power', track_width=0.5, priority=0)
fine = dict(default, name='Fine', clearance=0.15, track_width=0.15, priority=1)
ns['classes'] = [default, power, fine]
ns['netclass_assignments'] = None
sys.path.insert(0, str(Path(__file__).parent))
from design import FINE, POWER
ns['netclass_patterns'] = [{'netclass': 'Power', 'pattern': '/' + p} for p in POWER + ['+3V3', 'GND']] + \
	[{'netclass': 'Fine', 'pattern': '/' + p} for p in FINE]
# The ESP32 module's silkscreen past the board edge is moved to the fab layer on purpose.
ds['rule_severities']['lib_footprint_mismatch'] = 'ignore'

base['meta']['filename'] = out.name
base['sheets'] = []
base['boards'] = []
out.write_text(json.dumps(base, indent=2) + '\n')
print(f'wrote {out.name}')
