# Wall scanner enclosure

A printable case in the style of a shop price checker (like the Champtek SG-15), for the
Sunton ESP32-8048S043C as it comes, the SparkFun 2D Barcode Scanner, and a buzzer module
and a WS2812B LED module. No custom board. (For the optional [mainboard](../mainboard),
see [The mainboard version](#the-mainboard-version).)

![Front](renders/front.png)

| | |
|---|---|
| ![Side](renders/side.png) | ![From below](renders/below.png) |
| The screen face tilts up 15° toward you | The scanner looks down and forward through the bevelled "mouth"; the slit beside it is the status light, the vents in the floor are the buzzer's |
| ![Inside](renders/inside.png) | ![Exploded](renders/exploded.png) |
| Inside, back plate off: the Sunton behind its screen, the scanner in the mouth, the LED and buzzer modules | Back plate: keyholes, and posts that hold the board |

Outside about **138 wide × 139 high × 51 deep** (mm, including the back plate). The
Sunton's board is 123 mm wide, wider than its screen, and its USB-C and P1 sockets face
the left wall with room for P1's plug, so the screen sits 4.5 mm right of centre.

## The shape

Seen from the side it has five faces:

- **Back**, flat on the wall.
- **Top**: a 45° bevel.
- **Screen face**, tilted 15° up toward you. Below the screen it continues as a chin with
  an engraved arrow pointing down at the scanner.
- **Mouth**: a 45° bevel under the chin with the scanner window. The scanner looks 45°
  forward of straight down, where you'd hold a product, like at a shop's price checker.
- **Bottom**, flat.

Seen from the front the top corners are rounded (30 mm), the bottom ones slightly.

## Parts

| File | Print |
|---|---|
| [stl/pantry-scanner-shell.stl](stl/pantry-scanner-shell.stl) | Everything but the back. **Stands on its flat bottom, no supports**: every face is within 45° of vertical, and the windows' edges are chamfered so the screen window's top edge isn't a 100 mm bridge. PETG or PLA, 0.2 mm layers, 3 walls. |
| [stl/pantry-scanner-back.stl](stl/pantry-scanner-back.stl) | Back plate. Outside face down, posts up, no supports. |

Also: 4 × **M3 × 8** self-tapping screws (or machine screws into heat-set inserts), 2 wall
screws with heads up to 8 mm, thin double-sided foam tape, a little hot glue, and Dupont
wires for the modules (wiring: [main README](../../README.md#wiring)).

## Assembly

1. **Sunton**: stick it into the shell, glass against the bezel, with a few strips of foam
   tape. USB-C to the left (as you look at the screen), the ESP32 to the right.
2. **Scanner**: solder a straight 6-pin header to the SparkFun board on the **back** (pins
   away from the module). Drop it onto the two pins in the mouth, module facing the window;
   a dab of hot glue keeps it there.
3. **LED module**: hot-glue it inside the mouth over the slit left of the scanner window,
   LED facing the slit.
4. **Buzzer module**: hot-glue it on the floor, buzzer down over the five vents (right of
   centre, seen from the front).
5. **Wires**: the scanner's to P1 (its plug points at the left wall; there's room for it
   and the cable to bend down), the rest to P4 on the board's bottom edge.
6. **Close**: back plate on (its posts land on the board's corner holes, pins in the
   holes), four screws, hang it on the two wall screws.

USB-C comes out of the left side; the hole is big enough for the plug's moulding.

## The mainboard version

Set `board = "mainboard"` at the top of [pantry-scanner.scad](pantry-scanner.scad) for the
[mainboard](../mainboard) behind a bare panel: 111 mm wide, screen centred, the LED shines
down from the board onto the slit, the buzzer sounds through vents in the left wall, and
the scanner plugs into the board's J4 with a 6-wire Dupont cable. Its STLs are
[stl/mainboard-shell.stl](stl/mainboard-shell.stl) and
[stl/mainboard-back.stl](stl/mainboard-back.stl).

## Changing it

[pantry-scanner.scad](pantry-scanner.scad) is parametric OpenSCAD: the board, the panel's
size and thickness, the room beside the board, the screen tilt, the mouth's angle, chin
height, depth, corner radii and where the scanner, LED and buzzer go are variables at the
top. Then:

```bash
hardware/enclosure/render.sh
```

exports the STLs and the pictures (Docker for OpenSCAD; the pictures come from
[render.py](render.py), a small renderer that needs only Python and Pillow).

Checked in OpenSCAD, for both boards: the panel, board, scanner and module stand-ins and
the back plate don't intersect the shell (only touch where they should), including the
Sunton's tallest parts and the plugs in P1 and P4.

## Not verified yet

Nothing has been printed. The Sunton's outline, corner holes (Ø3.2 mm, 3.5 mm in) and
screen position come from its maker's dimension drawing; the USB-C and P1 positions are
read off that drawing. `panel_t = 5` (glass, LCD and the tape between them and the board)
and the module sizes are estimates: measure yours and adjust `panel_t`, `room` and the
module positions before printing. The DE2120 module's height (`module_h = 12.5`) sets how
far the scanner sits behind its window; check it on yours.
