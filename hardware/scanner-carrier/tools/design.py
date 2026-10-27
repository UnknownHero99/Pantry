"""
Pantry scanner carrier: the one place the circuit is described.

make_sch.py turns this into the KiCad schematic, make_pcb.py places the
footprints from it. Change parts, nets or positions here and rerun build.sh.

The board sits behind the Sunton ESP32-8048S043C and talks to it over three of
its 4-pin 1.25 mm headers:
  P1  GND, RX(44), TX(43), +5V   scanner UART + all power for this board
  P4  IO18, IO17, +3.3V, GND     buzzer, status LED (Sunton 3.3 V left unused)
  P2  IO13, IO12, IO11, IO19     radar UART + presence (IO19 is touch SDA: unused)
GPIO11-13 are the Sunton's SD card pins, so leave its SD slot empty.

The SparkFun 2D Barcode Scanner Breakout (DE2120, red aiming line) plugs into a
1x6 socket and two M3 standoffs, stacked over the low parts. A GM65/GM861 can
use the 4-pin "GM65" socket instead (same UART); fit only one scanner.
"""

# Board outline, mm. Origin top-left, y grows down (KiCad's convention).
BOARD_W, BOARD_H = 64.0, 44.0

# SparkFun breakout, 1.75" x 1.00", seen from above. Its header row is
# GND RX TX 3.3V TRIG STAT left to right, 0.25" in from its left edge and
# 0.05" up from its bottom edge; its holes are 0.1" in from the left corners.
SF_X, SF_Y = 2.0, 2.0
SF_W, SF_H = 44.45, 25.4
IN = 25.4

# Each part: ref -> dict(symbol, value, footprint, lcsc, pins={pin: net}, at=(x, y, rot), sch=(x, y))
#   footprint "Lib:Name" from KiCad's libraries, or "Pantry:..." from ../lib.
#   pins not listed are left unconnected (no-connect flag on the schematic).
#   lcsc: JLCPCB part number for assembly (checked in stock, Oct 2026); None = not assembled.
PARTS = {
	# ── connectors to the Sunton board ────────────────────────────────────
	'J1': dict(symbol='Connector_Generic:Conn_01x04', value='Sunton P1 UART',
		footprint='Connector_Molex:Molex_PicoBlade_53261-0471_1x04-1MP_P1.25mm_Horizontal', lcsc='C696092',
		pins={'1': 'GND', '2': 'SCAN_TX', '3': 'SCAN_RX', '4': '+5V'},
		labels=['GND', 'RX', 'TX', '5V'], at=(9.0, 41.2, 0), sch=(30, 40)),
	'J2': dict(symbol='Connector_Generic:Conn_01x04', value='Sunton P4 IO',
		footprint='Connector_Molex:Molex_PicoBlade_53261-0471_1x04-1MP_P1.25mm_Horizontal', lcsc='C696092',
		pins={'1': 'BUZZ', '2': 'LED_3V3', '4': 'GND'},
		labels=['IO18', 'IO17', '3V3', 'GND'], at=(22.5, 41.2, 0), sch=(30, 85)),
	'J6': dict(symbol='Connector_Generic:Conn_01x04', value='Sunton P2 IO',
		footprint='Connector_Molex:Molex_PicoBlade_53261-0471_1x04-1MP_P1.25mm_Horizontal', lcsc='C696092',
		pins={'1': 'IO13_RXD', '2': 'IO12_PRESENCE', '3': 'IO11_TXD'},
		labels=['IO13', 'IO12', 'IO11', 'IO19'], at=(36.0, 41.2, 0), sch=(30, 130)),
	'J4': dict(symbol='Connector_Generic:Conn_01x04', value='GM65 scanner',
		footprint='Connector_Molex:Molex_PicoBlade_53261-0471_1x04-1MP_P1.25mm_Horizontal', lcsc='C696092',
		pins={'1': 'GND', '2': '+5V', '3': 'SCAN_TX', '4': 'SCAN_RX'},
		labels=['GND', '5V', 'TX', 'RX'], at=(49.5, 41.2, 0), sch=(30, 170)),

	# ── scanner: SparkFun 2D Barcode Scanner Breakout on a 1x6 socket ──────
	# Pin 1 is STAT (rightmost), pin 6 GND (leftmost), as SparkFun numbers it.
	'J3': dict(symbol='Connector_Generic:Conn_01x06', value='SparkFun 2D Barcode Scanner',
		footprint='Connector_PinSocket_2.54mm:PinSocket_1x06_P2.54mm_Vertical', lcsc='C40877',
		pins={'1': 'SCAN_STAT', '2': 'SCAN_TRIG', '3': '+3V3', '4': 'SCAN_TX', '5': 'SCAN_RX', '6': 'GND'},
		labels=['STAT', 'TRIG', '3V3', 'TX', 'RX', 'GND'],
		at=(SF_X + 0.25 * IN + 5 * 2.54, SF_Y + 0.95 * IN, 'row-left'), sch=(240, 45)),
	'H1': dict(symbol='Mechanical:MountingHole', value='M3 standoff (scanner)',
		footprint='MountingHole:MountingHole_3.2mm_M3', lcsc=None, pins={},
		at=(SF_X + 0.1 * IN, SF_Y + 0.1 * IN, 0), sch=(220, 185)),
	'H2': dict(symbol='Mechanical:MountingHole', value='M3 standoff (scanner)',
		footprint='MountingHole:MountingHole_3.2mm_M3', lcsc=None, pins={},
		at=(SF_X + 0.1 * IN, SF_Y + 0.9 * IN, 0), sch=(235, 185)),
	'H3': dict(symbol='Mechanical:MountingHole', value='M3 (case)',
		footprint='MountingHole:MountingHole_3.2mm_M3', lcsc=None, pins={},
		at=(60.5, 3.5, 0), sch=(250, 185)),
	'H4': dict(symbol='Mechanical:MountingHole', value='M3 (case)',
		footprint='MountingHole:MountingHole_3.2mm_M3', lcsc=None, pins={},
		at=(60.5, 29.5, 0), sch=(265, 185)),
	'TP1': dict(symbol='Connector:TestPoint', value='TRIG',
		footprint='TestPoint:TestPoint_Pad_D1.0mm', lcsc=None, pins={'1': 'SCAN_TRIG'},
		at=(25.0, 30.0, 0), sch=(270, 45)),
	'TP2': dict(symbol='Connector:TestPoint', value='STAT',
		footprint='TestPoint:TestPoint_Pad_D1.0mm', lcsc=None, pins={'1': 'SCAN_STAT'},
		at=(28.0, 30.0, 0), sch=(270, 60)),

	# ── 3.3 V for the scanner (the SparkFun header takes 3.3 V, not 5 V) ───
	'U1': dict(symbol='Regulator_Linear:AMS1117-3.3', value='AMS1117-3.3',
		footprint='Package_TO_SOT_SMD:SOT-223-3_TabPin2', lcsc='C6186',
		pins={'1': 'GND', '2': '+3V3', '3': '+5V'}, at=(16.0, 9.0, 0), sch=(110, 40)),
	'C1': dict(symbol='Device:C', value='10uF', footprint='Capacitor_SMD:C_0805_2012Metric', lcsc='C15850',
		pins={'1': '+5V', '2': 'GND'}, at=(10.5, 9.0, 90), sch=(90, 50)),
	'C2': dict(symbol='Device:C', value='22uF', footprint='Capacitor_SMD:C_0805_2012Metric', lcsc='C45783',
		pins={'1': '+3V3', '2': 'GND'}, at=(21.5, 9.0, 90), sch=(135, 50)),
	'C3': dict(symbol='Device:C', value='100nF', footprint='Capacitor_SMD:C_0603_1608Metric', lcsc='C14663',
		pins={'1': '+3V3', '2': 'GND'}, at=(16.0, 22.5, 0), sch=(150, 50)),
	'C4': dict(symbol='Device:C', value='22uF', footprint='Capacitor_SMD:C_0805_2012Metric', lcsc='C45783',
		pins={'1': '+5V', '2': 'GND'}, at=(15.75, 35.5, 90), sch=(75, 50)),

	# ── status LED: WS2812B at 5 V, data level-shifted from 3.3 V ─────────
	'U2': dict(symbol='74xGxx:74AHCT1G125', value='74AHCT1G125',
		footprint='Package_TO_SOT_SMD:SOT-23-5', lcsc='C7484',
		pins={'1': 'GND', '2': 'LED_3V3', '3': 'GND', '4': 'LED_5V', '5': '+5V'},
		at=(31.0, 12.0, 0), sch=(110, 95)),
	'C5': dict(symbol='Device:C', value='100nF', footprint='Capacitor_SMD:C_0603_1608Metric', lcsc='C14663',
		pins={'1': '+5V', '2': 'GND'}, at=(27.5, 12.0, 90), sch=(95, 110)),
	'R3': dict(symbol='Device:R', value='330', footprint='Resistor_SMD:R_0603_1608Metric', lcsc='C23138',
		pins={'1': 'LED_5V', '2': 'LED_DIN'}, at=(35.0, 12.0, 0), sch=(140, 95)),
	'D2': dict(symbol='LED:WS2812B', value='WS2812B', footprint='LED_SMD:LED_WS2812B_PLCC4_5.0x5.0mm_P3.2mm',
		lcsc='C2874885', pins={'1': '+5V', '2': 'LED_DOUT', '3': 'GND', '4': 'LED_DIN'},
		at=(55.0, 32.5, 0), sch=(170, 95)),
	'C6': dict(symbol='Device:C', value='100nF', footprint='Capacitor_SMD:C_0603_1608Metric', lcsc='C14663',
		pins={'1': '+5V', '2': 'GND'}, at=(50.5, 31.0, 90), sch=(190, 95)),
	'TP3': dict(symbol='Connector:TestPoint', value='LED_DOUT',
		footprint='TestPoint:TestPoint_Pad_D1.0mm', lcsc=None, pins={'1': 'LED_DOUT'},
		at=(58.5, 36.0, 0), sch=(200, 85)),

	# ── buzzer: MLT-8530 from 5 V, low-side MOSFET, PWM from IO18 ─────────
	'LS1': dict(symbol='Device:Buzzer', value='MLT-8530', footprint='Pantry:Buzzer_MLT-8530', lcsc='C94599',
		pins={'1': '+5V', '2': 'BUZZ_SW'}, at=(53.0, 23.5, 0), sch=(150, 140)),
	'D1': dict(symbol='Diode:1N4148W', value='1N4148W', footprint='Diode_SMD:D_SOD-123', lcsc='C81598',
		pins={'1': '+5V', '2': 'BUZZ_SW'}, at=(47.5, 16.5, 90), sch=(170, 140)),
	'Q1': dict(symbol='Transistor_FET:AO3400A', value='AO3400A', footprint='Package_TO_SOT_SMD:SOT-23', lcsc='C20917',
		pins={'1': 'BUZZ_G', '2': 'GND', '3': 'BUZZ_SW'}, at=(41.5, 22.0, 0), sch=(145, 165)),
	'R1': dict(symbol='Device:R', value='100', footprint='Resistor_SMD:R_0603_1608Metric', lcsc='C22775',
		pins={'1': 'BUZZ', '2': 'BUZZ_G'}, at=(37.5, 21.5, 90), sch=(115, 165)),
	'R2': dict(symbol='Device:R', value='100k', footprint='Resistor_SMD:R_0603_1608Metric', lcsc='C25803',
		pins={'1': 'BUZZ_G', '2': 'GND'}, at=(35.5, 21.5, 90), sch=(130, 180)),

	# ── presence: HLK-LD2410C radar on a 1x5 header (Dupont cable) ────────
	'J5': dict(symbol='Connector_Generic:Conn_01x05', value='LD2410C radar',
		footprint='Connector_PinHeader_2.54mm:PinHeader_1x05_P2.54mm_Vertical', lcsc='C492404',
		pins={'1': '+5V', '2': 'GND', '3': 'RADAR_OUT', '4': 'RADAR_TX', '5': 'RADAR_RX'},
		labels=['5V', 'GND', 'OUT', 'TX', 'RX'], at=(59.5, 9.0, 0), sch=(250, 145)),
	'R5': dict(symbol='Device:R', value='1k', footprint='Resistor_SMD:R_0603_1608Metric', lcsc='C21190',
		pins={'1': 'RADAR_OUT', '2': 'IO12_PRESENCE'}, at=(55.0, 10.5, 0), sch=(195, 145)),
	'R6': dict(symbol='Device:R', value='1k', footprint='Resistor_SMD:R_0603_1608Metric', lcsc='C21190',
		pins={'1': 'RADAR_TX', '2': 'IO13_RXD'}, at=(55.0, 13.0, 0), sch=(210, 145)),
	'R7': dict(symbol='Device:R', value='1k', footprint='Resistor_SMD:R_0603_1608Metric', lcsc='C21190',
		pins={'1': 'IO11_TXD', '2': 'RADAR_RX'}, at=(55.0, 15.5, 0), sch=(225, 145)),
}

# Power flags: these nets come in on a connector, so tell ERC they're driven.
POWER_FLAGS = {'+5V': (60, 25), 'GND': (75, 25)}

# Schematic notes (x, y, text).
NOTES = [
	(20, 18, 'Sunton ESP32-8048S043C connectors (1.25 mm, 1:1 cables).\nCheck the cable maps pin 1 to pin 1 before power-up.'),
	(95, 18, '3.3 V for the scanner: the SparkFun header takes 3.3 V, not 5 V.'),
	(215, 18, 'SparkFun 2D Barcode Scanner Breakout (DE2120, red aiming line).\nPlugs in on top; M3 x 11 mm standoffs in H1/H2.\nGM65 instead: J4. Fit only one scanner.'),
	(95, 78, 'Status LED: WS2812B, data shifted 3.3 V -> 5 V (IO17).'),
	(95, 125, 'Buzzer: MLT-8530 from 5 V, PWM on IO18 (ESPHome rtttl).'),
	(185, 112, 'Radar: HLK-LD2410C on a Dupont cable. OUT -> IO12,\nUART on IO13 (RX) / IO11 (TX), 256000 baud.\nIO11-13 are the Sunton SD pins: leave the SD slot empty.'),
]
