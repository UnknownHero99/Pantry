// Pantry wall scanner enclosure, for the mainboard (hardware/mainboard) behind a
// 4.3" 800x480 capacitive panel, with the SparkFun 2D Barcode Scanner looking down.
//
// Two printed parts:
//   front  - bezel, walls and a chin under the display (radar, scanner window, status-light slot)
//   back   - back plate: closes the box with 4 x M3, hangs on 2 wall screws (keyholes),
//            and its 4 posts press the board against the panel, pins in the board's corner holes
//
// Render one part with:  openscad -D 'part="front"' -o front.stl pantry-scanner.scad
// part = "assembly" shows everything, with stand-ins for the panel, board and modules.
//
// Frame: X right (seen from the front), Y down from the panel's top edge, Z back from
// the panel's glass. The board's own KiCad coordinates are seen from its back, so its
// x runs right to left here (see pcb()).

part = "assembly";            // front | back | assembly

/* [Panel: 4.3" 800x480 RGB TFT with capacitive touch] */
panel_w = 105.5;              // outline of the cover glass
panel_h = 67.2;
panel_t = 5.0;                // glass + TFT + foam tape
lip = 2.5;                    // how far the bezel overlaps the glass edge

/* [Board] */
pcb_w = 100; pcb_h = 60; pcb_t = 1.6;
pcb_top = 6.5;                // board's top edge below the panel's top (the antenna hangs over it)
pcb_holes = [[3.5, 3.5], [96.5, 3.5], [3.5, 56.5], [96.5, 56.5]];

/* [Scanner: SparkFun 2D Barcode Scanner on a right-angle header] */
scanner_socket = true;        // false: header soldered straight into the board (39 mm instead of 48 mm deep)
sf_w = 44.45; sf_d = 25.4;
sf_gnd_x = 10;                // board x of the socket's GND pin (design.py SF_GND_X)
sf_row_y = 47;                // board y of the socket row (design.py SF_ROW_Y)
scan_win = [30, 24];          // window in the chin bottom, X by Z

/* [Case] */
wall = 2.2;
face = 2.0;                   // front face in front of the glass
gap = 0.4;                    // clearance around the panel
chin = 18;                    // room under the display, inside
back_t = 2.5;
corner_r = 4;

/* [Radar: HLK-LD2410C behind the chin face] */
radar = [22, 16];             // board, X by Y
radar_x = 80;                 // its left edge

$fn = 48;

// ── derived ──────────────────────────────────────────────────────────────
pcb_x0 = (panel_w - pcb_w) / 2;                         // board's left edge, from the front
pcb_z = panel_t;                                         // board's front face
pcb_back = pcb_z + pcb_t;
sf_z0 = pcb_back + (scanner_socket ? 8.5 : 0) + 3;      // scanner board's near edge (socket + header bend)
depth = sf_z0 + sf_d + 2;                                // inside, glass to back plate
in_w = panel_w + 2 * gap;
in_h = panel_h + gap + chin;
out = [in_w + 2 * wall, in_h + gap + 2 * wall, depth + face];
echo(str("outside: ", out[0], " x ", out[1], " x ", out[2] + back_t, " mm"));

// A board point (KiCad x, y) in this frame.
function bx(x) = pcb_x0 + (pcb_w - x);
function by(y) = pcb_top + y;

// Scanner module: the DE2120 sits on the half of the SparkFun board away from its GND pin.
scan_cx = bx(sf_gnd_x - 6.35 + 0.73 * sf_w);             // centre of the DE2120 module
scan_cz = sf_z0 + sf_d / 2;

// Screw bosses: top corners behind the panel's corners, bottom corners in the chin.
boss = [[-gap + 3, -gap + 3], [panel_w + gap - 3, -gap + 3],
	[-gap + 3, in_h - gap - 3], [panel_w + gap - 3, in_h - gap - 3]];

module rounded_box(size, r) {
	hull() for (x = [r, size[0] - r], y = [r, size[1] - r]) translate([x, y, 0]) cylinder(r = r, h = size[2]);
}

module shell_outline(h) {
	translate([-gap - wall, -gap - wall, 0]) rounded_box([out[0], out[1], h], corner_r);
}

// ── front ────────────────────────────────────────────────────────────────
module front() {
	difference() {
		union() {
			difference() {
				translate([0, 0, -face]) shell_outline(out[2]);
				// the inside
				translate([-gap, -gap, 0]) rounded_box([in_w, in_h, depth + 1], corner_r - wall);
			}
			// screw bosses, from just behind the panel to the back plate
			for (b = boss) translate([b[0], b[1], panel_t + 0.5]) cylinder(d = 7, h = depth - panel_t - 0.5);
			// radar cradle on the chin face: two rails it slides between
			for (dx = [-1.6, radar[0] + 0.2]) translate([radar_x + dx, panel_h + gap + 1, 0]) cube([1.4, radar[1], 6]);
		}
		// display window
		translate([lip, lip, -face - 1]) rounded_box([panel_w - 2 * lip, panel_h - 2 * lip, face + 2], 1.5);
		// M3 pilot holes (self-tapping) in the bosses
		for (b = boss) translate([b[0], b[1], panel_t + 3]) cylinder(d = 2.6, h = depth);
		// scanner window in the chin bottom
		translate([scan_cx - scan_win[0] / 2, in_h - gap - 1, scan_cz - scan_win[1] / 2]) cube([scan_win[0], wall + 2, scan_win[1]]);
		// status light: the side-view LED at board (90, 57) shines down onto this slot
		translate([bx(90) - 5, in_h - gap - 1, pcb_back - 1]) cube([10, wall + 2, 5]);
		// USB-C on the left wall (board x 100 edge, y 30)
		translate([-gap - wall - 1, by(30), pcb_back + 1.6]) rotate([0, 90, 0]) hull()
			for (d = [-2.75, 2.75]) translate([0, d, 0]) cylinder(d = 7.5, h = wall + 2);
		// buzzer vents in the top wall over the buzzer (board 88, 6.5)
		for (i = [-2:2]) translate([bx(88) + i * 3 - 0.8, -gap - wall - 1, pcb_back + 2]) cube([1.6, wall + 2, 12]);
	}
}

// ── back ─────────────────────────────────────────────────────────────────
module back() {
	difference() {
		union() {
			translate([0, 0, depth]) shell_outline(back_t);
			// lip that keys into the shell
			translate([0, 0, depth - 2]) difference() {
				translate([-gap + 0.3, -gap + 0.3, 0]) rounded_box([in_w - 0.6, in_h - 0.6, 2], corner_r - wall);
				translate([-gap + 2, -gap + 2, -1]) rounded_box([in_w - 4, in_h - 4, 4], corner_r - wall - 1);
			}
			// posts that hold the board against the panel
			for (h = pcb_holes) translate([bx(h[0]), by(h[1]), 0]) {
				translate([0, 0, pcb_back]) cylinder(d = 6, h = depth - pcb_back);
				translate([0, 0, pcb_z + 0.3]) cylinder(d = 2.8, h = pcb_t + 0.5);   // pin in the board's hole
			}
		}
		// screws into the bosses
		for (b = boss) translate([b[0], b[1], depth - 3]) {
			cylinder(d = 3.4, h = back_t + 4);
			translate([0, 0, back_t + 3 - 1.8]) cylinder(d1 = 3.4, d2 = 6.4, h = 1.81);
		}
		// bosses pass the lip
		for (b = boss) translate([b[0], b[1], depth - 3]) cylinder(d = 7.6, h = 3);
		// keyholes for two wall screws (head up to 8 mm)
		for (x = [out[0] / 2 - wall - gap - 30, out[0] / 2 - wall - gap + 30]) translate([x, in_h * 0.35, depth - 1]) {
			cylinder(d = 8.5, h = back_t + 2);
			translate([-2.1, 0, 0]) cube([4.2, 9, back_t + 2]);
		}
		// cable channel from the USB-C down to the bottom
		translate([-gap - wall - 1, by(30) - 4, depth + back_t - 1.5]) cube([wall + 6, in_h, 2]);
	}
}

// ── stand-ins, for the assembly view ─────────────────────────────────────
module pcb() {
	color("darkgreen") translate([pcb_x0, pcb_top, pcb_z]) cube([pcb_w, pcb_h, pcb_t]);
	color("silver") translate([bx(50) - 9, pcb_top - 6, pcb_back]) cube([18, 25.5, 3.2]);   // ESP32 module
	color("dimgray") translate([bx(95.5) - 0.5, by(30) - 4.5, pcb_back]) cube([7.5, 9, 3.2]);  // USB-C
}
module scanner() {
	color("red") translate([bx(sf_gnd_x) + 6.35 - sf_w, by(sf_row_y), sf_z0]) cube([sf_w, 1.6, sf_d]);
	color("black") translate([scan_cx - 11, by(sf_row_y) + 1.6, sf_z0 + 2]) cube([22, 12, 21]);
}
module panel() {
	color("black") cube([panel_w, panel_h, panel_t - 0.4]);
	color("steelblue", 0.6) translate([lip + 2, lip + 2, -0.01]) cube([panel_w - 2 * lip - 4, panel_h - 2 * lip - 4, 0.1]);
}
module radar_board() {
	color("blue") translate([radar_x, panel_h + gap + 1, 1]) cube([radar[0], radar[1], 1.6]);
}

explode = 30;                 // assembly view: how far the back plate stands off

// Parts come out in print orientation; the assembly stands upright (Z up, front toward -Y).
if (part == "front") front();                         // face down on the bed
else if (part == "back") rotate([180, 0, 0]) back();  // outside face down
else if (part == "assembly") rotate([-90, 0, 0]) {
	front();
	translate([0, 0, explode]) back();
	panel(); pcb(); scanner(); radar_board();
}
// Single pieces in assembly position, for render.sh's pictures.
if (part == "v_front") rotate([-90, 0, 0]) front();
if (part == "v_back") rotate([-90, 0, 0]) back();
if (part == "v_panel") rotate([-90, 0, 0]) panel();
if (part == "v_pcb") rotate([-90, 0, 0]) pcb();
if (part == "v_scanner") rotate([-90, 0, 0]) scanner();
if (part == "v_radar") rotate([-90, 0, 0]) radar_board();
