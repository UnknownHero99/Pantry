// Pantry wall scanner enclosure, price-checker style: the screen face tilts up toward
// you, an arrow under it points to the scanner in a bevelled "mouth" that looks down
// and forward, where you hold the product. For the SparkFun 2D Barcode Scanner and
// one of these (`board`):
//   guition   - the Guition JC4880P443C (ESP32-P4) as it comes, plus a buzzer module
//               and a WS2812 LED module. No custom board.
//   sunton    - the Sunton ESP32-8048S043C, with the same modules.
//   mainboard - hardware/mainboard behind a bare 4.3" 800x480 capacitive panel.
//
// Two printed parts:
//   shell - everything but the back. Prints standing on its flat bottom, no supports:
//           every face is within 45 degrees of vertical, the windows have chamfered edges.
//   back  - back plate: closes the shell with 4 x M3, hangs on 2 wall screws (keyholes),
//           and its 4 posts hold the board against the panel (pins in its mounting holes).
//
//   openscad -D 'part="shell"' -o shell.stl pantry-scanner.scad
//
// Frame: X right (seen from the front), Y up, Z out of the wall. The back is z = 0.

part = "assembly";            // shell | back | assembly | v_shell | v_back | v_panel | v_pcb | v_scanner
board = "guition";            // guition | sunton | mainboard
guition = board == "guition";
sunton = board == "sunton";
mainboard = board == "mainboard";
function pick(g, s, m) = guition ? g : sunton ? s : m;

/* [Panel: 4.3" 800x480 TFT with capacitive touch] */
panel_w = pick(117.01, 105.5, 105.5);   // outline of the cover glass
panel_h = pick(69.41, 67.2, 67.2);
panel_t = pick(4.8, 5.0, 5.0);          // glass + TFT (+ foam tape)
lip = 2.5;                    // how far the bezel covers the glass edge
// The window in the bezel. The Guition's glass has a wide black border around its
// 93.6 x 56.16 picture; the window shows the picture and a little of the border.
win = pick([101, 61.5], [panel_w - 2 * lip, panel_h - 2 * lip], [panel_w - 2 * lip, panel_h - 2 * lip]);

/* [Shape] */
tilt = 15;                    // screen face, degrees back from vertical
mouth_angle = 45;             // where the scanner looks: degrees forward of straight down
top_margin = 12;              // face above the panel
chin = 15;                    // face below the panel, with the arrow
mouth_len = 34;               // the bevelled face the scanner looks through
depth_top = pick(28, 24, 24); // depth at the top of the screen face (the Guition's header and USB plug face back)
wall = 2.2;
gap = 0.4;                    // around the panel
round_r = 2.5;                // edge rounding
corner_top = 30;              // front-view corner radius, top
corner_bottom = 6;
back_t = 3;

/* [Board] */
// Board coordinates are seen from its back (the side away from the panel), x from the
// left, y from the top, as in the makers' dimension drawings and KiCad's view of the
// mainboard. The Guition's board and parts are one block here (its drawing gives only
// the outline: 102.6 x 65.06, 9 mm deep behind the glass), and it mounts by four
// 2 mm holes in ears on its frame, 5 mm behind the glass, outside that block.
pcb_t = pick(9, 1.6, 1.6);
pcb_w = pick(102.6, 123, 100);
pcb_h = pick(65.06, 74, 60);
pcb_top = pick((69.41 - 65.06) / 2, -3.0, 6.5);   // board's top edge below the panel's top
pcb_holes = pick([[-2.7, 2.53], [105.3, 2.53], [-2.7, 62.53], [105.3, 62.53]],
                 [[3.5, 3.5], [119.5, 3.5], [3.5, 70.5], [119.5, 70.5]],
                 [[3.5, 3.5], [96.5, 3.5], [3.5, 56.5], [96.5, 56.5]]);
hole_d = pick(2, 3.2, 3.2);
post_from = pick(5, pcb_t, pcb_t);  // where the back plate's posts land, behind the board's front
post_d = pick(4.6, 6, 6);
// Room between the board's edges and the side walls, seen from the front. The Sunton's
// USB-C and P1 sockets face the left wall; P1's plug and cable need about 9 mm.
room = pick([0, 0], [10, 1], [0, 0]);   // left, right
usb_y = pick(undef, 33.8, 30);          // USB-C on the left edge (board x = pcb_w); the Guition's faces back
cable_x = -34;                // the Guition's USB cable leaves through a notch in the floor here

/* [Scanner: SparkFun 2D Barcode Scanner, module facing the window] */
sf_w = 44.45; sf_d = 25.4;
module_h = 12.5;              // the DE2120 module's height above the SparkFun board
sf_t = 1.6;
scan_win = [32, 24];          // window in the mouth, across by along

$fn = 40;

// ── derived ──────────────────────────────────────────────────────────────
// Inside, from the screen's centre to each side wall; the case is centred on x = 0.
in_l = max(panel_w / 2 + gap, pcb_w / 2 + room[0]);
in_r = max(panel_w / 2 + gap, pcb_w / 2 + room[1]);
W = in_l + in_r + 2 * wall;                         // outside width
scr_x = (in_l - in_r) / 2;                          // the screen's centre
s_face = top_margin + panel_h + chin;               // screen face length, top to mouth
mouth_y = mouth_len * sin(mouth_angle);             // mouth's top edge height (its bottom edge is y = 0)
face_z_bottom = depth_top + s_face * sin(tilt);
face_top_y = mouth_y + s_face * cos(tilt);
H = face_top_y + depth_top;                         // the top bevel is 45 degrees
bottom_z = face_z_bottom - mouth_len * cos(mouth_angle);
echo(str("outside: ", W, " wide x ", H, " high x ", face_z_bottom + back_t, " deep (mm)"));

// Screen-face frame: u right of the screen's centre, s down the face from its top edge,
// w into the case.
module in_face() multmatrix([[1, 0, 0, scr_x], [0, -cos(tilt), -sin(tilt), face_top_y], [0, sin(tilt), -cos(tilt), depth_top]]) children();
// Mouth frame: u right of the screen's centre, m down the mouth from its top edge, k into the case.
module in_mouth() multmatrix([[1, 0, 0, scr_x], [0, -sin(mouth_angle), cos(mouth_angle), mouth_y], [0, -cos(mouth_angle), -sin(mouth_angle), face_z_bottom]]) children();

// A board point (x, y seen from its back) in the face frame.
function bu(x) = pcb_w / 2 - x;
function bs(y) = top_margin + pcb_top + y;
board_w = wall + panel_t;                           // the board's front face, in w

// ── outline ──────────────────────────────────────────────────────────────
// Side profile [z, y]: back, bottom, mouth, screen face, top bevel. Convex.
function profile(back = 0) = [[back, 0], [bottom_z, 0], [face_z_bottom, mouth_y], [depth_top, face_top_y], [back, H - back]];

module side(shape) rotate([0, -90, 0]) linear_extrude(W + 2, center = true) children();
module front_view() linear_extrude(200) children();

module silhouette(inset = 0) offset(delta = -inset) hull() {
	for (x = [-W / 2 + corner_bottom, W / 2 - corner_bottom]) translate([x, corner_bottom]) circle(corner_bottom);
	for (x = [-W / 2 + corner_top, W / 2 - corner_top]) translate([x, H - corner_top]) circle(corner_top);
}

module outer() intersection() {
	minkowski() {
		intersection() {
			side() offset(delta = -round_r) polygon(profile(-round_r - 2));
			translate([0, 0, -10]) front_view() silhouette(round_r);
		}
		sphere(round_r, $fn = 16);
	}
	translate([-W, -1, 0]) cube([2 * W, H + 10, 100]);   // flat back at z = 0
}

module cavity() intersection() {
	side() offset(delta = -wall) polygon(profile(-10));
	translate([0, 0, -20]) front_view() silhouette(wall);
}

// ── shell ────────────────────────────────────────────────────────────────
module shell() {
	difference() {
		union() {
			difference() { outer(); cavity(); }
			bosses();
			// scanner: pegs with pins for the SparkFun board's two holes. Mounted this way
			// round, it lies on top of them (the module hangs toward the window).
			in_mouth() {
				m0 = (mouth_len - sf_d) / 2;
				left = -0.73 * sf_w;                  // its hole edge; this centres the module
				for (m = [m0 + 2.54, m0 + sf_d - 2.54]) {
					translate([left + 2.54, m, wall]) cylinder(d = 5.5, h = module_h + 0.5);
					translate([left + 2.54, m, wall]) cylinder(d = 2.8, h = module_h + 0.5 + sf_t + 1.5);
				}
			}
		}
		// screen window, edges chamfered 45 degrees (so its top edge needs no bridge)
		in_face() hull() {
			wm = (panel_h - win[1]) / 2;
			translate([-win[0] / 2, top_margin + wm, wall - 0.01]) cube([win[0], win[1], 0.02]);
			translate([-win[0] / 2 - wall, top_margin + wm - wall, -0.02]) cube([win[0] + 2 * wall, win[1] + 2 * wall, 0.02]);
		}
		// scanner window, chamfered the same way
		in_mouth() hull() {
			translate([-scan_win[0] / 2, (mouth_len - scan_win[1]) / 2, wall - 0.01]) cube([scan_win[0], scan_win[1], 0.02]);
			translate([-scan_win[0] / 2 - wall, (mouth_len - scan_win[1]) / 2 - wall, -0.02]) cube([scan_win[0] + 2 * wall, scan_win[1] + 2 * wall, 0.02]);
		}
		// status light: the LED module sits behind this slit (on the mainboard, the
		// side-view LED at board (90, 57) shines down onto it)
		in_mouth() translate([led_u - 5, 9, -1]) cube([10, 4, wall + 2]);
		// arrow pointing down at the scanner, engraved 1 mm into the chin
		in_face() translate([0, top_margin + panel_h + chin / 2, -0.5]) linear_extrude(1.5)
			polygon([[-8, -4.5], [-5.5, -4.5], [0, 1], [5.5, -4.5], [8, -4.5], [0, 4.5]]);
		// USB-C in the left wall, big enough for the plug's moulding
		if (!guition) in_face() translate([-W / 2 - scr_x - 1, bs(usb_y), board_w + pcb_t + 1.6]) rotate([0, 90, 0]) hull()
			for (d = [-2.75, 2.75]) translate([0, d, 0]) cylinder(d = 7.5, h = wall + 3);
		// the Guition's USB-C faces back: a right-angle plug's cable leaves through the floor
		if (guition) translate([cable_x - 3.5, -1, -1]) cube([7, wall + 2, 7]);
		// buzzer vents: in the floor under the buzzer module, or in the left wall beside
		// the mainboard's buzzer (board 88, 6.5)
		if (!mainboard) for (i = [-2:2]) translate([scr_x + buzz_xz[0] + 3 * i - 0.8, -1, buzz_xz[1] - 5]) cube([1.6, wall + 2, 10]);
		else in_face() for (i = [-2:2]) translate([-W / 2 - scr_x - 1, bs(6.5) + 3 * i - 0.8, board_w + pcb_t + 0.5]) cube([wall + 3, 1.6, 8]);
		// M3 pilot holes in the bosses, from the back
		for (b = boss_xy()) translate([b[0], b[1], -1]) cylinder(d = 2.6, h = 13);
	}
}

led_u = -40;                  // status LED slit, across the mouth
buzz_xz = [40, 13];           // buzzer module on the floor: right of the screen's centre, out from the back

// Screw bosses: top corners just below the top bevel, bottom corners above the floor.
// They sink 0.3 mm into the side walls: only touching them leaves a non-manifold edge.
function boss_xy() = [for (x = [-(W / 2 - wall - 3.2), W / 2 - wall - 3.2], y = [9, face_top_y - 6]) [x, y]];
// Teardrop-shaped in front view, so they print upright without support.
module boss_shape(grow = 0) offset(grow) hull() {
	circle(3.5);
	translate([0, -3.5 * sqrt(2)]) rotate(45) square(0.1, center = true);
}
module bosses() for (b = boss_xy()) translate([b[0], b[1], 0]) linear_extrude(12) boss_shape();

// ── back plate ───────────────────────────────────────────────────────────
// The shell's opening over the first 2 mm, shrunk by `inset`: the front outline,
// cut at the bottom by the floor and at the top by the 45-degree bevel's inside.
module opening(inset) intersection() {
	silhouette(wall + inset);
	translate([-W, wall + inset]) square([2 * W, H - wall * sqrt(2) - 2 - 2 * inset - wall]);
}

module back() {
	difference() {
		union() {
			translate([0, 0, -back_t]) linear_extrude(back_t) silhouette(round_r * 0.3);
			// lip that keys into the shell's opening (lower at the top, where the bevel is)
			linear_extrude(2) difference() { opening(0.3); opening(2.3); }
			// posts that hold the board against the panel, square to the board
			for (h = pcb_holes) {
				s = bs(h[1]);
				w_wall = (depth_top + s * sin(tilt)) / cos(tilt);    // where the post meets the plate
				in_face() translate([bu(h[0]), s, board_w + post_from]) {
					cylinder(d = post_d, h = w_wall - board_w - post_from + 1);
					translate([0, 0, -min(post_from, 2.5) + 0.2]) cylinder(d = hole_d - 0.4, h = min(post_from, 2.5));   // pin in the hole
				}
			}
		}
		// the lip makes way for the USB cable's notch
		if (guition) translate([cable_x - 4, wall - 1, -0.01]) cube([8, 4, 2.1]);
		// clear of the bosses, and countersunk screws into them
		for (b = boss_xy()) translate([b[0], b[1], 0]) {
			linear_extrude(3) boss_shape(0.4);
			translate([0, 0, -back_t - 1]) cylinder(d = 3.4, h = back_t + 2);
			translate([0, 0, -back_t - 0.01]) cylinder(d1 = 6.4, d2 = 3.4, h = 1.6);
		}
		// keyholes for two wall screws (heads up to 8 mm)
		for (x = [-30, 30]) translate([x, H * 0.62, -back_t - 1]) {
			cylinder(d = 8.5, h = back_t + 2);
			translate([-2.1, 0, 0]) cube([4.2, 9, back_t + 2]);
		}
	}
}

// ── stand-ins for the pictures ───────────────────────────────────────────
module panel() in_face() translate([-panel_w / 2, top_margin, wall]) cube([panel_w, panel_h, panel_t - 0.4]);
// The board with its tallest parts (and the plugs in it), and the buzzer and LED modules.
module pcb() {
	in_face() {
		translate([bu(pcb_w), bs(0), board_w]) cube([pcb_w, pcb_h, pcb_t]);
		on_board = pick(
			  [[98.4, 15.9, 5.5, 34.1, 18],      // 2x13 header with Dupont plugs on it
			   [92, 24.6, 8, 28, 12]],           // right-angle USB-C plug in the full-speed port
			  [[26.1, 16, 25.5, 18, 3.2],        // ESP32 module
			   [124, 29.3, 8.5, 9, 3.3],         // USB-C
			   [129, 47.5, 11, 6.5, 4.5],        // P1 with its plug, out past the edge
			   [112, 70, 7.2, 10, 4.5]],         // P4 with its plug, out past the bottom
			  [[59, -6, 18, 25.5, 3.2]]);        // ESP32 module, antenna over the top edge
		for (p = on_board) translate([bu(p[0]), bs(p[1]), board_w + pcb_t]) cube([p[2], p[3], p[4]]);
		// the Guition's mounting ears, at its corners
		if (guition) for (h = pcb_holes) translate([bu(h[0]), bs(h[1]), board_w]) difference() {
			translate([-2.5, -2.5, 0]) cube([5, 5, post_from]);
			translate([0, 0, -1]) cylinder(d = hole_d, h = post_from + 2);
		}
	}
	if (!mainboard) {
		translate([scr_x + buzz_xz[0] - 11, wall, buzz_xz[1] - 7.5]) cube([22, 9.6, 15]);   // buzzer down
		in_mouth() translate([led_u - 5, 6, wall]) cube([10, 10, 3]);                    // LED facing the slit
	}
}
module scanner() in_mouth() {
	m0 = (mouth_len - sf_d) / 2;
	translate([-0.73 * sf_w, m0, wall + module_h + 0.5]) cube([sf_w, sf_d, sf_t]);
	translate([-11, mouth_len / 2 - 10.75, wall + 0.5]) cube([22, 21.5, module_h]);
}

explode = 30;

// Printable parts in print orientation; everything else as it hangs on the wall,
// turned so Z is up and the front faces -Y.
if (part == "shell") rotate([90, 0, 0]) shell();          // standing on its flat bottom
else if (part == "back") translate([0, 0, back_t]) back();  // outside face down, posts up
else if (part == "assembly") rotate([90, 0, 0]) {
	shell();
	translate([0, 0, -explode]) back();
	panel(); pcb(); scanner();
}
if (part == "v_shell") rotate([90, 0, 0]) shell();
if (part == "v_back") rotate([90, 0, 0]) back();
if (part == "v_panel") rotate([90, 0, 0]) panel();
if (part == "v_pcb") rotate([90, 0, 0]) pcb();
if (part == "v_scanner") rotate([90, 0, 0]) scanner();
