// Pantry wall scanner enclosure, price-checker style: the screen face tilts up toward
// you, an arrow under it points to the scanner in a bevelled "mouth" that looks down
// and forward, where you hold the product. For a GROW GM67 barcode scanner (or the
// SparkFun 2D Barcode Scanner: `scanner`) and one of these (`board`):
//   guition   - the Guition JC4880P443C (ESP32-P4) as it comes, plus a small speaker
//               (on the board's own amplifier) and a WS2812 LED module. No custom board.
//   sunton    - the Sunton ESP32-8048S043C, with a buzzer module and the LED module.
//   mainboard - hardware/mainboard behind a bare 4.3" 800x480 capacitive panel.
//
// Two printed parts:
//   shell - everything but the back. Prints lying on its screen face, no supports:
//           nothing overhangs more than 45 degrees that way, and the arrow is in the
//           first five layers.
//   back  - back plate: closes the shell with 4 x M3 and hangs on 2 wall screws (keyholes).
//           For the Sunton and the mainboard its 4 posts hold the board against the panel
//           (pins in its mounting holes); the Guition is held by the adhesive on its glass.
// And optionally:
//   arrow - the arrow on the chin, 1 mm thick, exported where it sits in the shell as
//           printed (on the bed): load it together with the shell as one object to print
//           it in another colour.
//
//   openscad -D 'part="shell"' -o shell.stl pantry-scanner.scad
//
// Frame: X right (seen from the front), Y up, Z out of the wall. The back is z = 0.

part = "assembly";            // shell | back | arrow | assembly | v_shell | v_back | v_arrow | v_panel | v_pcb | v_scanner
board = "guition";            // guition | sunton | mainboard
guition = board == "guition";
sunton = board == "sunton";
mainboard = board == "mainboard";
scanner = "gm67";             // gm67 | sparkfun
gm67 = scanner == "gm67";
function pick(g, s, m) = guition ? g : sunton ? s : m;

/* [Panel: 4.3" 800x480 TFT with capacitive touch] */
// Outline of the cover glass. The Guition's is from its dimension drawing (114.40 x
// 66.80, the picture centred in it); measure yours and put it here.
panel_w = pick(114.4, 105.5, 105.5);
panel_h = pick(66.8, 67.2, 67.2);
panel_t = pick(4.8, 5.0, 5.0);          // glass + TFT (+ adhesive or foam tape)
lip = 2.5;                    // how far the bezel covers the glass edge
// The window in the bezel. The Guition's glass has a black border around its 93.6 x 56.16
// picture, with adhesive on it from the factory that sticks the glass to the inside of
// the bezel: the window shows the picture and 1.5 mm of border, so the bezel covers the
// rest (about 3.8 mm above and below, 8.9 mm each side, over the camera hole on the right).
win = pick([93.6 + 3, 56.16 + 3], [panel_w - 2 * lip, panel_h - 2 * lip], [panel_w - 2 * lip, panel_h - 2 * lip]);
// Ribs inside the face just above and below the glass, so it goes in straight (its sides
// are held by the side walls). Lower than the glass, clear of the board behind it.
rib_h = 2; rib_l = 60;

/* [Shape] */
tilt = 15;                    // screen face, degrees back from vertical
mouth_angle = 45;             // where the scanner looks: degrees forward of straight down
top_margin = 12;              // face above the panel
chin = 15;                    // face below the panel, with the arrow
mouth_len = 34;               // the bevelled face the scanner looks through
// The top, degrees up from level, rising toward the wall. The shell prints lying on its
// screen face, which leans 15 degrees, so a top steeper than 30 would overhang more than 45.
top_angle = 30;
// Depth at the top of the screen face: more for the Guition (its header and USB plug face
// back) and the GM67 (a 46.5 mm board along the scanner's line of sight, plug on its end).
depth_top = max(pick(28, 24, 24), gm67 ? 31 : 0);
wall = 2.2;
gap = 0.4;                    // around the panel
round_r = 2.5;                // edge rounding
corner_top = 30;              // front-view corner radius, top
corner_bottom = 6;
back_t = 3;

/* [Board] */
// Board coordinates are seen from its back (the side away from the panel), x from the
// left, y from the top, as in the makers' dimension drawings and KiCad's view of the
// mainboard. The Guition's board and parts are one block here (102.6 x 65.06, 9 mm deep
// behind the glass, from a P443C spec sheet; not measured on a board). It has no posts:
// the adhesive on its glass holds it, as Guition means it to be mounted.
pcb_t = pick(9, 1.6, 1.6);
pcb_w = pick(102.6, 123, 100);
pcb_h = pick(65.06, 74, 60);
pcb_top = pick((panel_h - pcb_h) / 2, -3.0, 6.5);   // board's top edge below the panel's top
pcb_holes = pick([],
                 [[3.5, 3.5], [119.5, 3.5], [3.5, 70.5], [119.5, 70.5]],
                 [[3.5, 3.5], [96.5, 3.5], [3.5, 56.5], [96.5, 56.5]]);
hole_d = 3.2;
post_from = pcb_t;            // where the back plate's posts land, behind the board's front
post_d = 6;                   // the posts where they land, on the board
post_main = 7.5;              // and behind it, back to the plate
post_clear = 5;               // behind the board, where they can widen: clear of its parts
// Room between the board's edges and the side walls, seen from the front. The Sunton's
// USB-C and P1 sockets face the left wall; P1's plug and cable need about 9 mm.
room = pick([0, 0], [10, 1], [0, 0]);   // left, right
usb_y = pick(undef, 33.8, 30);          // USB-C on the left edge (board x = pcb_w); the Guition's faces back
cable_x = -34;                // the Guition's USB cable leaves through a notch in the floor here

/* [Scanner] */
// GROW GM67: a 27.5 x 46.5 board with the scan engine on one end, looking out past that
// edge. It slides between two fins along the line of sight, engine against the window, its
// board toward the screen and its parts (engine, buzzer, sockets) toward the floor.
gm_w = 27.5; gm_l = 46.5; gm_t = 1.6;
gm_eng = [28, 12.5, 10];      // engine: across, height above the board, depth
gm_m = mouth_len / 2 - gm_t - 6;   // the board's screen-side face, down the mouth (engine's lens centred)
rail_l = 44;                  // how far the fins reach in from the mouth
fin_in = gm_eng[0] / 2 + 0.3; // the fins' faces beside the engine
fin_out = fin_in + 2.4;
// SparkFun 2D Barcode Scanner (v1, DE2120): lies on two pegs, module facing the window.
sf_w = 44.45; sf_d = 25.4;
module_h = 12.5;              // the DE2120 module's height above the SparkFun board
sf_t = 1.6;
scan_win = gm67 ? [27, 10] : [32, 24];   // window in the mouth, across by along

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
function top_y(z) = face_top_y + (depth_top - z) * tan(top_angle);   // the top's outside at depth z
H = top_y(0);
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
post_wide = board_w + pcb_t + post_clear;
// The back plate's inside (z = 0) in the face frame, and a face-frame point's height.
function w_wall(s) = (depth_top + s * sin(tilt)) / cos(tilt);
function face_y(s, w) = face_top_y - cos(tilt) * s - sin(tilt) * w;
// The GM67's fins end in a vertical edge, straight down from the rails' far end.
fin_back_z = face_z_bottom - cos(mouth_angle) * (gm_m - 1.5) - sin(mouth_angle) * (wall + rail_l);

// ── outline ──────────────────────────────────────────────────────────────
// Side profile [z, y]: back, bottom, mouth, screen face, top. Convex.
function profile(back = 0) = [[back, 0], [bottom_z, 0], [face_z_bottom, mouth_y], [depth_top, face_top_y], [back, top_y(back)]];

module flip(on) if (on) mirror([1, 0, 0]) children(); else children();
// A circle with a 90-degree point on it, toward +y (dir = 1) or -y (dir = -1).
module teardrop(r, dir) hull() { circle(r); translate([0, dir * r * sqrt(2)]) rotate(45) square(0.01, center = true); }
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
			// ribs above and below the glass
			if (guition) in_face() for (s = [top_margin - gap - 1.2, top_margin + panel_h + gap])
				translate([-rib_l / 2, s, wall - 0.01]) cube([rib_l, 1.2, rib_h + 0.01]);
			// a ring on the floor that holds the speaker over its grille: pointed toward the
			// screen face outside and toward the back inside (and so outside too, to go round
			// it), so with the shell on its face no part of it overhangs more than 45 degrees
			if (guition) intersection() {
				translate([scr_x + spk_xz[0], wall - 0.5, spk_xz[1]]) rotate([-90, 0, 0])   // 2D -y is toward the face
					linear_extrude(3.5) difference() {
						hull() for (d = [-1, 1]) teardrop(spk_d / 2 + 0.3 + 1.2, d);
						teardrop(spk_d / 2 + 0.3, 1);
					}
				translate([0, -0.5, 0]) cavity();
				translate([-W, -1, 0.01]) cube([2 * W, H, 100]);   // not past the back
			}
			// GM67: two fins, one each side, from the mouth back along the line of sight and
			// down to the floor, so they're held on two edges and print as plain walls.
			// Along the top of each a lip on the board's screen side, with the edge of the
			// board in a groove under it; below the board the fins stand clear of the
			// engine's width so it slides through, and a seat under the engine holds it
			// from the floor side. The lip's top is a 40-degree roof and the seat's underside
			// a V, so neither overhangs more than 45 degrees with the shell on its face.
			if (gm67) for (left = [false, true]) intersection() {
				in_mouth() flip(left) translate([0, 0, wall - 0.01]) {
					u0 = gm_w / 2 - 0.8; lip = gm_m - 1.5; band = gm_m + gm_t + 0.15;
					roof = (fin_out - u0) / 2 * tan(40);
					difference() {
						linear_extrude(rail_l) polygon([[u0, band], [u0, lip], [(u0 + fin_out) / 2, lip - roof], [fin_out, lip], [fin_out, band]]);
						translate([u0 - 0.01, gm_m - 0.15, -1]) cube([1.1 + 0.01, gm_t + 0.3, rail_l + 2]);
					}
					translate([fin_in, gm_m + gm_t + 0.1, 0]) cube([fin_out - fin_in, 100, rail_l]);
					seat = gm_m + gm_t + gm_eng[1] + 0.3; apex = gm_eng[0] / 2 - 1; s_in = fin_in - 3.3;
					linear_extrude(gm_eng[2] + 1) polygon([[s_in, seat + (apex - s_in) * tan(40)], [apex, seat],
						[fin_in + 0.1, seat + (fin_in + 0.1 - apex) * tan(40)], [fin_in + 0.1, 100], [s_in, 100]]);
				}
				// stop at the floor, and straight down from the rails' far end
				translate([-W, 1, fin_back_z]) cube([2 * W, H, 100]);
			}
			// SparkFun: pegs with pins for the board's two holes. Mounted this way round,
			// it lies on top of them (the module hangs toward the window).
			if (!gm67) in_mouth() {
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
		// scanner window, chamfered too, except its edge toward the floor, which widens
		// inward instead: on the screen face, the other way round it would overhang 75 degrees
		in_mouth() let(m0 = (mouth_len - scan_win[1]) / 2, m1 = m0 + scan_win[1]) hull() {
			translate([-scan_win[0] / 2, m0, wall - 0.01]) cube([scan_win[0], m1 + wall - m0, 0.02]);
			translate([-scan_win[0] / 2 - wall, m0 - wall, -0.02]) cube([scan_win[0] + 2 * wall, m1 - m0 + wall, 0.02]);
		}
		// status light: the LED module sits behind this slit (on the mainboard, the
		// side-view LED at board (90, 57) shines down onto it); widening inward like the window
		in_mouth() hull() {
			translate([led_u - 5, 9, -1]) cube([10, 4, 1]);
			translate([led_u - 5, 9, wall - 0.01]) cube([10, 4 + wall, 1]);
		}
		// arrow pointing down at the scanner, a pocket in the chin that the arrow part fills
		arrow(grow = 0.5);
		// USB-C in the left wall, big enough for the plug's moulding
		if (!guition) in_face() translate([-W / 2 - scr_x - 1, bs(usb_y), board_w + pcb_t + 1.6]) rotate([0, 90, 0]) hull()
			for (d = [-2.75, 2.75]) translate([0, d, 0]) cylinder(d = 7.5, h = wall + 3);
		// the Guition's USB-C faces back: a right-angle plug's cable leaves through the floor
		if (guition) translate([cable_x - 3.5, -1, -1]) cube([7, wall + 2, 7]);
		// sound: a round grille in the floor under the Guition's speaker, vents in the
		// floor under the Sunton's buzzer module, or in the left wall beside the
		// mainboard's buzzer (board 88, 6.5)
		if (guition) for (i = [-3:3]) let(l = 2 * sqrt(pow(spk_d / 2 - 3, 2) - pow(3 * i, 2)))
			translate([scr_x + spk_xz[0] + 3 * i - 0.8, -1, spk_xz[1] - l / 2]) cube([1.6, wall + 2, l]);
		if (sunton) for (i = [-2:2]) translate([scr_x + buzz_xz[0] + 3 * i - 0.8, -1, buzz_xz[1] - 5]) cube([1.6, wall + 2, 10]);
		if (mainboard) in_face() for (i = [-2:2]) translate([-W / 2 - scr_x - 1, bs(6.5) + 3 * i - 0.8, board_w + pcb_t + 0.5]) cube([wall + 3, 1.6, 8]);
		// M3 pilot holes in the bosses, from the back
		for (b = boss_xy()) translate([b[0], b[1], -1]) cylinder(d = 2.6, h = boss_l + 1);
	}
}

// The arrow on the chin: a separate part, flush with the face, that fills a pocket in the
// shell, so a multi-material printer can print it in another colour (or leave it out and
// the pocket is an engraved arrow). `grow` pokes it out past the face to cut the pocket.
arrow_depth = 1;
module arrow(grow = 0) in_face() translate([0, top_margin + panel_h + chin / 2, -grow]) linear_extrude(arrow_depth + grow)
	polygon([[-8, -4.5], [-5.5, -4.5], [0, 1], [5.5, -4.5], [8, -4.5], [0, 4.5]]);

led_u = -40;                  // status LED slit, across the mouth
buzz_xz = [40, 13];           // buzzer module on the floor: right of the screen's centre, out from the back
spk_d = 28; spk_t = 5;        // the Guition's speaker: round, 8 ohm, on a 1.25 mm 2-pin lead
spk_xz = [36, 16];            // on the floor, cone down, in a ring: right of the screen's centre, out from the back

// Screw bosses: top corners just below the top bevel, bottom corners above the floor.
function boss_xy() = [for (x = [-(W / 2 - wall - 3.2), W / 2 - wall - 3.2], y = [9, face_top_y - 6]) [x, y]];
// In front view: each is joined to its side wall all along, the bottom ones stand on the
// floor and the top ones on a gusset that meets the wall at 45 degrees or steeper, so
// they can't break off. Their inner ends slope back into the side wall at 45 degrees:
// with the shell on its screen face they'd otherwise be flat ceilings.
boss_l = 12;
module boss_shape(b, grow = 0) intersection() {
	offset(grow) flip(b[0] < 0) let(x = abs(b[0]), y = b[1], xw = W / 2 - wall, tip = y - 3.5 * sqrt(2)) hull() {
		translate([x, y]) circle(3.5);
		if (y < H / 2) translate([x - 3.5, 1]) square([xw + 1 - (x - 3.5), y - 1]);
		else {
			translate([x, tip]) rotate(45) square(0.1, center = true);
			translate([xw - 0.01, tip - (xw - x) - 0.5]) square([1.01, y + 3.5 - (tip - (xw - x) - 0.5)]);
		}
	}
	silhouette(1);   // inside the outer skin
}
module bosses() for (b = boss_xy()) let(xw = W / 2 - wall, reach = xw - 0.5 - (abs(b[0]) - 3.5)) hull() {
	linear_extrude(boss_l) boss_shape(b);
	translate([0, 0, boss_l]) linear_extrude(reach) intersection() {
		boss_shape(b);
		translate([b[0] > 0 ? xw - 0.5 : -xw - 1.5, 0]) square([2, 2 * H]);
	}
}

// ── back plate ───────────────────────────────────────────────────────────
// The shell's opening over the first 2 mm, shrunk by `inset`: the front outline,
// cut at the bottom by the floor and at the top by the inside of the sloping top.
module opening(inset) intersection() {
	silhouette(wall + inset);
	translate([-W, wall + inset]) square([2 * W, top_y(2) - (wall + inset) / cos(top_angle) - wall - inset]);
}

module back() {
	difference() {
		union() {
			translate([0, 0, -back_t]) linear_extrude(back_t) silhouette(round_r * 0.3);
			// lip that keys into the shell's opening (lower at the top, where the bevel is)
			linear_extrude(2) difference() { opening(0.3); opening(2.3); }
			// posts that hold the board against the panel, square to the board: thin where
			// they land beside it, thick behind it, flared where they meet the plate
			for (h = pcb_holes) {
				u = bu(h[0]); s = bs(h[1]);
				tip = board_w + post_from;
				cone = (post_main - post_d) / 2;
				in_face() translate([u, s, 0]) {
					translate([0, 0, tip]) cylinder(d = post_d, h = post_wide - tip + 0.01);
					translate([0, 0, post_wide]) cylinder(d1 = post_d, d2 = post_main, h = cone);
					translate([0, 0, post_wide + cone - 0.01]) cylinder(d = post_main, h = w_wall(s) - post_wide - cone + 1);
					translate([0, 0, tip - min(post_from, 2.5) + 0.2]) cylinder(d = hole_d - 0.4, h = min(post_from, 2.5));   // pin in the hole
				}
				// the flare: along the post's lean both ways, and in toward the middle
				hull() {
					in_face() translate([u, s, w_wall(s) - 12]) cylinder(d = post_main, h = 0.01);
					translate([scr_x + u, face_y(s, w_wall(s)), -0.01]) linear_extrude(0.01) hull() {
						for (dy = [-5, 5]) translate([0, dy]) circle(d = post_main);
						translate([-sign(u) * 4, 0]) circle(d = post_main);
					}
				}
			}
		}
		// the lip makes way for the USB cable's notch and the speaker's ring
		if (guition) translate([cable_x - 4, wall - 1, -0.01]) cube([8, 4, 2.1]);
		if (guition) translate([scr_x + spk_xz[0] - spk_d / 2 - 3, wall - 1, -0.01]) cube([spk_d + 6, 5, 2.1]);
		// clear of the bosses, and countersunk screws into them
		for (b = boss_xy()) {
			linear_extrude(3) boss_shape(b, 0.4);
			translate([b[0], b[1], -back_t - 1]) cylinder(d = 3.4, h = back_t + 2);
			translate([b[0], b[1], -back_t - 0.01]) cylinder(d1 = 6.4, d2 = 3.4, h = 1.6);
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
// The board with its tallest parts (and the plugs in it), and the sound and LED modules.
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
	}
	if (guition) translate([scr_x + spk_xz[0], wall, spk_xz[1]]) rotate([-90, 0, 0]) cylinder(d = spk_d, h = spk_t);   // speaker
	if (sunton) translate([scr_x + buzz_xz[0] - 11, wall, buzz_xz[1] - 7.5]) cube([22, 9.6, 15]);   // buzzer down
	if (!mainboard) {
		in_mouth() translate([led_u - 5, 6, wall]) cube([10, 10, 3]);                    // LED facing the slit
	}
}
module scanner() in_mouth() {
	if (gm67) {
		translate([-gm_w / 2, gm_m, wall]) cube([gm_w, gm_t, gm_l]);                               // board
		translate([-gm_eng[0] / 2, gm_m + gm_t, wall]) cube([gm_eng[0], gm_eng[1], gm_eng[2]]);   // engine
		translate([-12, gm_m + gm_t, wall + gm_l - 6]) cube([24, 6, 6 + 10]);                     // sockets, plug, cable bend
	} else {
		m0 = (mouth_len - sf_d) / 2;
		translate([-0.73 * sf_w, m0, wall + module_h + 0.5]) cube([sf_w, sf_d, sf_t]);
		translate([-11, mouth_len / 2 - 10.75, wall + 0.5]) cube([22, 21.5, module_h]);
	}
}

explode = 30;

// Printable parts in print orientation; everything else as it hangs on the wall,
// turned so Z is up and the front faces -Y.
// The shell lies on its screen face: the inverse of in_face(), so x = u, y = s (down the
// face) and z = w (into the case), the face on the bed at z = 0.
module on_face() multmatrix([[1, 0, 0, -scr_x],
	[0, -cos(tilt), sin(tilt), cos(tilt) * face_top_y - sin(tilt) * depth_top],
	[0, -sin(tilt), -cos(tilt), sin(tilt) * face_top_y + cos(tilt) * depth_top]]) children();
if (part == "shell") on_face() shell();                   // on its screen face
else if (part == "arrow") on_face() arrow();              // where it sits in the shell, as printed
else if (part == "back") translate([0, 0, back_t]) back();  // outside face down, posts up
else if (part == "assembly") rotate([90, 0, 0]) {
	shell(); color("tomato") arrow();
	translate([0, 0, -explode]) back();
	panel(); pcb(); scanner();
}
if (part == "v_shell") rotate([90, 0, 0]) shell();
if (part == "v_arrow") rotate([90, 0, 0]) arrow();
if (part == "v_back") rotate([90, 0, 0]) back();
if (part == "v_panel") rotate([90, 0, 0]) panel();
if (part == "v_pcb") rotate([90, 0, 0]) pcb();
if (part == "v_scanner") rotate([90, 0, 0]) scanner();
