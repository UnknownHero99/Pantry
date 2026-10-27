"""
Pantry wall scanner mainboard: the one place the circuit is described.

Replaces the Sunton ESP32-8048S043C. A 100 x 60 mm, 4-layer board that sits
behind a bare 4.3" 800x480 RGB panel (40-pin 0.5 mm ribbon + GT911 touch on a
6-pin 1.0 mm ribbon; both ribbons wrap around the bottom edge to the back,
where every part is). In KiCad terms the top side is the back of the unit.

  ESP32-S3-WROOM-1-N16R8, native USB-C (flashing + power), 3.3 V buck
  display: RGB on GPIOs in connector order (see ESP_PINS), 5-6-5 bits like the Sunton
  backlight: TPS61169 boost, constant current, PWM from IO5
  touch:     GT911 on IO39 (SDA) / IO40 (SCL) / IO41 (INT) / IO42 (RST)
  scanner:   UART0 (IO43/IO44, free now that USB does the flashing):
             SparkFun 2D Barcode Scanner (DE2120, red line) on a 1x6 socket,
             or any 5 V UART module (GM65, GM805, GM861) on the 4-pin socket
  buzzer IO2, side-view status LED IO1 (shines down out of the case), radar OUT IO4

make_sch.py turns this into the schematic, make_pcb.py places it, route.py routes it.
"""

NAME, TITLE, PAPER = 'mainboard', 'Pantry wall scanner mainboard', 'A3'
BOARD_W, BOARD_H = 100.0, 60.0
LAYERS = 4                      # F.Cu signals | In1 GND | In2 +3V3 | B.Cu signals
PLANES = {'In1.Cu': 'GND', 'In2.Cu': '+3V3'}

# Net classes (net name -> class). Everything else is Default (0.25 mm).
FINE = ['R3', 'R4', 'R5', 'R6', 'R7', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'B3', 'B4', 'B5', 'B6', 'B7',
	'PCLK', 'HSYNC', 'VSYNC', 'DE', 'DISP', 'VLED', 'LED_K', 'USB_DP', 'USB_DN', 'USB_CON_DP', 'USB_CON_DN']
POWER = ['+5V', 'BUCK_LX', 'BL_SW', 'BUZZ_SW']

# The SparkFun header row, seen from the back: GND RX TX 3V3 TRIG STAT, left to right.
SF_GND_X, SF_ROW_Y = 10.0, 47.0

# ESP32 module: pins by name (resolved against the symbol), everything else unconnected.
# The S3 can put its RGB display signals on any GPIO, so they're assigned in the
# order they meet the module's edge seen from the ribbon connector below it (left
# side top to bottom, bottom row left to right, right side bottom to top): the
# 20 display lines reach the connector without crossing. Touch sits on the right
# side (toward its ribbon), buzzer and LED top right, radar and backlight top left.
ESP_PINS = {
	'GND': 'GND', '3V3': '+3V3', 'EN': 'EN', 'IO0': 'BOOT',
	'USB_D-': 'USB_DN', 'USB_D+': 'USB_DP', 'RXD0': 'SCAN_TX', 'TXD0': 'SCAN_RX',
	'IO4': 'PRESENCE', 'IO5': 'BL_PWM',
	'IO6': 'R3', 'IO7': 'R4', 'IO15': 'R5', 'IO16': 'R6', 'IO17': 'R7',
	'IO18': 'G2', 'IO8': 'G3', 'IO3': 'G4', 'IO46': 'G5', 'IO9': 'G6', 'IO10': 'G7',
	'IO11': 'B3', 'IO12': 'B4', 'IO13': 'B5', 'IO14': 'B6', 'IO21': 'B7',
	'IO47': 'PCLK', 'IO48': 'HSYNC', 'IO45': 'VSYNC', 'IO38': 'DE',
	'IO39': 'TP_SDA', 'IO40': 'TP_SCL', 'IO41': 'TP_INT', 'IO42': 'TP_RST',
	'IO2': 'BUZZ', 'IO1': 'LED_3V3',
}

# Standard 40-pin RGB TFT ribbon (as on the Sunton): unused low colour bits to GND,
# the 4-wire resistive touch pins (37-40) left open.
PANEL = {'1': 'LED_K', '2': 'VLED', '3': 'GND', '4': '+3V3',
	'5': 'GND', '6': 'GND', '7': 'GND', '8': 'R3', '9': 'R4', '10': 'R5', '11': 'R6', '12': 'R7',
	'13': 'GND', '14': 'GND', '15': 'G2', '16': 'G3', '17': 'G4', '18': 'G5', '19': 'G6', '20': 'G7',
	'21': 'GND', '22': 'GND', '23': 'GND', '24': 'B3', '25': 'B4', '26': 'B5', '27': 'B6', '28': 'B7',
	'29': 'GND', '30': 'PCLK', '31': 'DISP', '32': 'HSYNC', '33': 'VSYNC', '34': 'DE', '36': 'GND'}

R = lambda v, lcsc: dict(symbol='Device:R', value=v, footprint='Resistor_SMD:R_0603_1608Metric', lcsc=lcsc)
C = lambda v, lcsc, size='0603': dict(symbol='Device:C', value=v, footprint=f'Capacitor_SMD:C_{size}_{"1608" if size == "0603" else "2012"}Metric', lcsc=lcsc)
C100N, C10U, C22U, C1U50 = ('100nF', 'C14663'), ('10uF', 'C15850'), ('22uF', 'C45783'), ('1uF 50V', 'C28323')

def part(base, pins, at, sch, **kw):
	return dict(base, pins=pins, at=at, sch=sch, **kw)

PARTS = {
	# ── USB-C: power and native USB ───────────────────────────────────────
	'J1': dict(symbol='Connector:USB_C_Receptacle_USB2.0_16P', value='USB-C',
		footprint='Connector_USB:USB_C_Receptacle_HRO_TYPE-C-31-M-12', lcsc='C165948',
		pins={'A1': 'GND', 'A12': 'GND', 'B1': 'GND', 'B12': 'GND', 'SH': 'GND',
			'A4': '+5V', 'A9': '+5V', 'B4': '+5V', 'B9': '+5V', 'A5': 'CC1', 'B5': 'CC2',
			'A6': 'USB_CON_DP', 'B6': 'USB_CON_DP', 'A7': 'USB_CON_DN', 'B7': 'USB_CON_DN'},
		at=(95.5, 30.0, 90), sch=(25, 45)),
	'R1': part(R('5.1k', 'C23186'), {'1': 'CC1', '2': 'GND'}, (87.0, 38.0, 0), (50, 40)),
	'R2': part(R('5.1k', 'C23186'), {'1': 'CC2', '2': 'GND'}, (87.0, 22.0, 0), (55, 40)),
	'U1': dict(symbol='Power_Protection:USBLC6-2SC6', value='USBLC6-2SC6', footprint='Package_TO_SOT_SMD:SOT-23-6',
		lcsc='C7519', pins={'1': 'USB_CON_DP', '6': 'USB_DP', '3': 'USB_CON_DN', '4': 'USB_DN', '2': 'GND', '5': '+5V'},
		at=(86.0, 30.0, 180), sch=(65, 45)),

	# ── 3.3 V: SY8089 buck, 2 A ───────────────────────────────────────────
	'U2': dict(symbol='Pantry:SY8089AAAC', value='SY8089AAAC', footprint='Package_TO_SOT_SMD:SOT-23-5', lcsc='C78988',
		pins={'4': '+5V', '1': '+5V', '2': 'GND', '3': 'BUCK_LX', '5': 'BUCK_FB'}, at=(84.0, 16.0, 0), sch=(110, 40)),
	'L1': dict(symbol='Device:L', value='2.2uH', footprint='Inductor_SMD:L_Taiyo-Yuden_NR-40xx', lcsc='C92959',
		pins={'1': 'BUCK_LX', '2': '+3V3'}, at=(76.0, 16.0, 0), sch=(130, 32)),
	'R8': part(R('100k', 'C25803'), {'1': '+3V3', '2': 'BUCK_FB'}, (80.0, 20.5, 0), (140, 45)),
	'R9': part(R('22k', 'C31850'), {'1': 'BUCK_FB', '2': 'GND'}, (84.0, 20.5, 0), (140, 58)),
	'C1': part(C(*C10U, '0805'), {'1': '+5V', '2': 'GND'}, (88.5, 16.0, 90), (95, 50)),
	'C2': part(C(*C22U, '0805'), {'1': '+3V3', '2': 'GND'}, (70.5, 16.0, 90), (150, 50)),
	'C3': part(C(*C22U, '0805'), {'1': '+5V', '2': 'GND'}, (93.0, 40.5, 0), (85, 50)),

	# ── ESP32-S3 ──────────────────────────────────────────────────────────
	'U3': dict(symbol='RF_Module:ESP32-S3-WROOM-1', value='ESP32-S3-WROOM-1-N16R8', footprint='RF_Module:ESP32-S3-WROOM-1',
		lcsc='C2913202', pins_by_name=ESP_PINS, at=(50.0, 6.9, 0), sch=(200, 110)),
	'C4': part(C(*C22U, '0805'), {'1': '+3V3', '2': 'GND'}, (37.5, 6.0, 90), (165, 70)),
	'C5': part(C(*C100N), {'1': '+3V3', '2': 'GND'}, (37.5, 10.0, 90), (172, 70)),
	'R10': part(R('10k', 'C25804'), {'1': '+3V3', '2': 'EN'}, (37.5, 14.0, 90), (165, 90)),
	'C6': part(C('1uF', 'C15849'), {'1': 'EN', '2': 'GND'}, (35.5, 14.0, 90), (172, 95)),
	'R11': part(R('10k', 'C25804'), {'1': '+3V3', '2': 'BOOT'}, (62.5, 14.0, 90), (230, 70)),
	'SW1': dict(symbol='Switch:SW_Push', value='RESET', footprint='Button_Switch_SMD:SW_Push_1P1T_XKB_TS-1187A',
		lcsc='C318884', pins={'1': 'EN', '2': 'GND'}, at=(31.0, 6.0, 0), sch=(165, 105)),
	'SW2': dict(symbol='Switch:SW_Push', value='BOOT', footprint='Button_Switch_SMD:SW_Push_1P1T_XKB_TS-1187A',
		lcsc='C318884', pins={'1': 'BOOT', '2': 'GND'}, at=(65.5, 6.0, 0), sch=(240, 80)),

	# ── display ribbon (40-pin 0.5 mm) and backlight ──────────────────────
	'J2': dict(symbol='Connector_Generic:Conn_01x40', value='4.3" RGB panel', footprint='Connector_FFC-FPC:Hirose_FH12-40S-0.5SH_1x40-1MP_P0.50mm_Horizontal',
		lcsc='C202114', pins=PANEL, at=(50.0, 54.5, 0), sch=(290, 110)),
	'R12': part(R('10k', 'C25804'), {'1': '+3V3', '2': 'DISP'}, (62.0, 44.0, 90), (265, 160)),
	'C7': part(C(*C100N), {'1': '+3V3', '2': 'GND'}, (38.0, 44.0, 90), (265, 175)),
	'U5': dict(symbol='Pantry:TPS61169', value='TPS61169', footprint='Package_TO_SOT_SMD:SOT-353_SC-70-5', lcsc='C71045',
		pins={'5': '+5V', '4': 'BL_PWM', '2': 'GND', '1': 'BL_SW', '3': 'LED_K'}, at=(28.0, 36.0, 0), sch=(110, 150)),
	'L2': dict(symbol='Device:L', value='10uH', footprint='Inductor_SMD:L_Taiyo-Yuden_NR-40xx', lcsc='C222882',
		pins={'1': '+5V', '2': 'BL_SW'}, at=(21.0, 36.0, 0), sch=(95, 140)),
	'D1': dict(symbol='Device:D_Schottky', value='B5819W', footprint='Diode_SMD:D_SOD-123', lcsc='C8598',
		pins={'1': 'VLED', '2': 'BL_SW'}, at=(28.0, 40.5, 180), sch=(135, 140)),
	'C8': part(C(*C1U50, '0805'), {'1': 'VLED', '2': 'GND'}, (33.0, 40.5, 90), (150, 150)),
	'C9': part(C(*C10U, '0805'), {'1': '+5V', '2': 'GND'}, (16.0, 36.0, 90), (85, 150)),
	'R13': part(R('10', 'C22859'), {'1': 'LED_K', '2': 'GND'}, (32.5, 36.0, 90), (135, 165)),
	'R14': part(R('100k', 'C25803'), {'1': 'BL_PWM', '2': 'GND'}, (24.5, 32.0, 0), (95, 165)),

	# ── touch ribbon (6-pin 1.0 mm, GT911) ────────────────────────────────
	'J3': dict(symbol='Connector_Generic:Conn_01x06', value='GT911 touch', footprint='Connector_FFC-FPC:JUSHUO_AFA07-S06FCA-00_1x6-1MP_P1.0mm_Horizontal',
		lcsc='C262712', pins={'1': 'GND', '2': 'TP_SDA', '3': 'TP_SCL', '4': 'TP_RST', '5': 'TP_INT', '6': '+3V3'},
		at=(75.0, 54.5, 0), sch=(290, 175)),
	'R15': part(R('4.7k', 'C23162'), {'1': '+3V3', '2': 'TP_SDA'}, (72.0, 47.5, 90), (265, 190)),
	'R16': part(R('4.7k', 'C23162'), {'1': '+3V3', '2': 'TP_SCL'}, (74.0, 47.5, 90), (270, 190)),

	# ── scanner: SparkFun 2D Barcode Scanner on a 1x6 socket, or a 5 V UART module ──
	'J4': dict(symbol='Connector_Generic:Conn_01x06', value='SparkFun 2D Barcode Scanner',
		footprint='Connector_PinSocket_2.54mm:PinSocket_1x06_P2.54mm_Vertical', lcsc='C40877',
		pins={'1': 'SCAN_STAT', '2': 'SCAN_TRIG', '3': '+3V3', '4': 'SCAN_TX', '5': 'SCAN_RX', '6': 'GND'},
		labels=['STAT', 'TRIG', '3V3', 'TX', 'RX', 'GND'], at=(SF_GND_X + 5 * 2.54, SF_ROW_Y, 'row-left'), sch=(30, 120)),
	'TP1': dict(symbol='Connector:TestPoint', value='TRIG', footprint='TestPoint:TestPoint_Pad_D1.0mm', lcsc=None,
		pins={'1': 'SCAN_TRIG'}, at=(SF_GND_X + 6 * 2.54 + 1.0, SF_ROW_Y - 2.5, 0), sch=(55, 110)),
	'TP2': dict(symbol='Connector:TestPoint', value='STAT', footprint='TestPoint:TestPoint_Pad_D1.0mm', lcsc=None,
		pins={'1': 'SCAN_STAT'}, at=(SF_GND_X + 6 * 2.54 + 1.0, SF_ROW_Y + 0.5, 0), sch=(62, 110)),
	'J5': dict(symbol='Connector_Generic:Conn_01x04', value='UART scanner (GM65)',
		footprint='Connector_Molex:Molex_PicoBlade_53261-0471_1x04-1MP_P1.25mm_Horizontal', lcsc='C696092',
		pins={'1': 'GND', '2': '+5V', '3': 'SCAN_TX', '4': 'SCAN_RX'}, labels=['GND', '5V', 'TX', 'RX'],
		at=(3.0, 24.0, 270), sch=(30, 160)),

	# ── buzzer ────────────────────────────────────────────────────────────
	'LS1': dict(symbol='Device:Buzzer', value='MLT-8530', footprint='Pantry:Buzzer_MLT-8530', lcsc='C94599',
		pins={'1': '+5V', '2': 'BUZZ_SW'}, at=(88.0, 6.5, 0), sch=(30, 200)),
	'D2': dict(symbol='Diode:1N4148W', value='1N4148W', footprint='Diode_SMD:D_SOD-123', lcsc='C81598',
		pins={'1': '+5V', '2': 'BUZZ_SW'}, at=(81.5, 9.0, 90), sch=(55, 200)),
	'Q1': dict(symbol='Transistor_FET:AO3400A', value='AO3400A', footprint='Package_TO_SOT_SMD:SOT-23', lcsc='C20917',
		pins={'1': 'BUZZ_G', '2': 'GND', '3': 'BUZZ_SW'}, at=(77.5, 9.0, 0), sch=(45, 225)),
	'R17': part(R('100', 'C22775'), {'1': 'BUZZ', '2': 'BUZZ_G'}, (72.0, 9.5, 90), (20, 225)),
	'R18': part(R('100k', 'C25803'), {'1': 'BUZZ_G', '2': 'GND'}, (73.0, 12.6, 0), (30, 240)),

	# ── status LED: side-view SK6812 on the bottom edge, shines down ───────
	'U4': dict(symbol='74xGxx:74AHCT1G125', value='74AHCT1G125', footprint='Package_TO_SOT_SMD:SOT-23-5', lcsc='C7484',
		pins={'1': 'GND', '2': 'LED_3V3', '3': 'GND', '4': 'LED_5V', '5': '+5V'}, at=(88.0, 46.0, 0), sch=(110, 200)),
	'C10': part(C(*C100N), {'1': '+5V', '2': 'GND'}, (84.5, 46.0, 90), (95, 215)),
	'R19': part(R('330', 'C23138'), {'1': 'LED_5V', '2': 'LED_DIN'}, (92.0, 46.0, 0), (135, 200)),
	'D3': dict(symbol='LED:SK6812', value='SK6812SIDE-A', footprint='Pantry:LED_SK6812SIDE-A_4.0x1.6mm', lcsc='C5378721',
		pins={'1': 'GND', '2': 'LED_DIN', '3': '+5V'}, at=(90.0, 57.0, 0), sch=(165, 200)),
	'C11': part(C(*C100N), {'1': '+5V', '2': 'GND'}, (85.5, 52.0, 90), (185, 205)),

	# ── presence radar (HLK-LD2410C) on a 3-pin cable ─────────────────────
	'J6': dict(symbol='Connector_Generic:Conn_01x03', value='LD2410C radar',
		footprint='Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical', lcsc='C2937625',
		pins={'1': '+5V', '2': 'GND', '3': 'RADAR_OUT'}, labels=['5V', 'GND', 'OUT'], at=(10.0, 7.0, 0), sch=(30, 85)),
	'R20': part(R('1k', 'C21190'), {'1': 'RADAR_OUT', '2': 'PRESENCE'}, (13.5, 9.5, 90), (55, 85)),

	# ── mounting: M3 at the corners ───────────────────────────────────────
	**{f'H{i + 1}': dict(symbol='Mechanical:MountingHole', value='M3', footprint='MountingHole:MountingHole_3.2mm_M3',
		lcsc=None, pins={}, at=(x, y, 0), sch=(200 + 15 * i, 190))
		for i, (x, y) in enumerate(((3.5, 3.5), (96.5, 3.5), (3.5, 56.5), (96.5, 56.5)))},
}

# Fixed copper the router builds on: the USB-C data escape. The receptacle's pads
# alternate D+ (B6, A6) and D- (A7, B7); D+ joins its pads on top in a U, D- drops
# through two vias tucked between the D+ stubs and joins underneath.
# (net, layer 'F'/'B', points, width) and (net, x, y) for vias. Board coordinates.
_jx = 95.5 - 4.045 - 0.725     # inner end of J1's pads
_py = lambda local: 30.0 + local   # J1 is at y = 30, turned 90 degrees
PREROUTES = [
	('USB_CON_DP', 'F', [(_jx + 0.05, _py(-0.75)), (88.6, _py(-0.75)), (88.6, _py(0.25)), (_jx + 0.05, _py(0.25))], 0.15),
	('USB_CON_DN', 'F', [(_jx + 0.05, _py(-0.25)), (89.9, _py(-0.25))], 0.15),
	('USB_CON_DN', 'F', [(_jx + 0.05, _py(0.75)), (89.2, _py(0.75))], 0.15),
	('USB_CON_DN', 'B', [(89.9, _py(-0.25)), (89.2, _py(0.75))], 0.15),
]
PREVIAS = [('USB_CON_DN', 89.9, _py(-0.25)), ('USB_CON_DN', 89.2, _py(0.75))]

# The display ribbon's escape: every signal pin gets a stub straight up from its
# pad, 0.6 / 1.6 / 2.6 mm long in turn, so a via can sit at the end of any of them
# (neighbouring stub ends are 1 mm apart in height) without crowding the next pin.
_j2x, _j2y = 50.0, 54.5                  # J2's position (see PARTS); pin 1 at x - 9.75
_signal_pins = [int(p) for p, net in sorted(PANEL.items(), key=lambda kv: int(kv[0])) if net not in ('GND', '+3V3')]
# Ground pins between signal pins are too hemmed in for the pour to reach from the
# side: each gets a stub down into the strip behind the connector, where it's poured.
# A few of them carry on to a via into the inner ground plane, which ties the strip
# to the rest of the ground.
for _p, _net in PANEL.items():
	if _net == 'GND':
		_x = _j2x - 9.75 + 0.5 * (int(_p) - 1)
		_via = _p in ('6', '14', '22', '36')
		PREROUTES.append(('GND', 'F', [(_x, _j2y - 1.85), (_x, _j2y + (1.5 if _via else 0.6))], 0.15))
		if _via:
			PREVIAS.append(('GND', _x, _j2y + 1.5))
for _i, _pin in enumerate(_signal_pins):
	_x = _j2x - 9.75 + 0.5 * (_pin - 1)
	PREROUTES.append((PANEL[str(_pin)], 'F', [(_x, _j2y - 2.2), (_x, _j2y - 2.5 - (0.6, 1.6, 2.6)[_i % 3])], 0.15))

# Top-layer strips the router leaves to the ground pour: behind the two ribbon
# connectors, where the pour reaches their fine-pitch ground pins from behind.
KEEP_CLEAR = [('F', 37.0, 53.45, 63.0, 59.4), ('F', 68.0, 52.15, 82.0, 59.4)]

POWER_FLAGS = {'+5V': (60, 25), 'GND': (75, 25), '+3V3': (90, 25)}

NOTES = [
	(15, 18, 'USB-C: power + native USB (flashing, logs).'),
	(95, 18, '3.3 V: SY8089 buck, Vout = 0.6 V x (1 + 100k / 22k) = 3.33 V'),
	(150, 60, 'ESP32-S3-WROOM-1-N16R8'),
	(255, 60, '4.3" 800x480 RGB panel, standard 40-pin ribbon.\nRGB on GPIOs in connector order (5-6-5 bits, low bits to GND).'),
	(80, 128, 'Backlight: TPS61169 boost, I = 204 mV / R13 = 20 mA.\nPWM dimming from IO5. 37.5 V overvoltage limit.'),
	(255, 150, 'GT911 touch ribbon (6-pin 1.0 mm)'),
	(15, 108, 'Scanner on UART0: SparkFun 2D Barcode Scanner (3.3 V)\nor a 5 V UART module on J5. Fit only one.'),
	(15, 190, 'Buzzer: MLT-8530 from 5 V, PWM on IO2.'),
	(95, 190, 'Status LED: side-view SK6812 on the bottom edge, data 3.3 V -> 5 V.'),
	(15, 75, 'Radar: HLK-LD2410C OUT -> IO4 (wakes the screen).'),
]
