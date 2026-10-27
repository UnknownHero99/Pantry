# Wall scanner enclosure

A printable case in the style of a shop price checker (like the Champtek SG-15), for the
[mainboard](../mainboard) behind a 4.3" 800×480 capacitive panel and the SparkFun 2D
Barcode Scanner.

![Front](renders/front.png)

| | |
|---|---|
| ![Side](renders/side.png) | ![From below](renders/below.png) |
| The screen face tilts up 15° toward you | The scanner looks down and forward through the bevelled "mouth"; the slit beside it is the status light |
| ![Inside](renders/inside.png) | ![Exploded](renders/exploded.png) |
| Inside, back plate off: board behind the panel, radar in the chin, scanner in the mouth | Back plate: keyholes, and posts that hold the board |

Outside about **111 wide × 143 high × 52 deep** (mm, including the back plate).

## The shape

Seen from the side it has five faces:

- **Back**, flat on the wall.
- **Top**: a 45° bevel.
- **Screen face**, tilted 15° up toward you. Below the screen it continues as a chin with
  an engraved arrow pointing down at the scanner; the radar looks forward through it.
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
screws with heads up to 8 mm, thin double-sided foam tape for the panel, and a 6-wire
male-to-female Dupont cable (10 cm) for the scanner.

Print the shell in a plain filament (not metallic or carbon-filled) so the radar can see
through the chin.

## Assembly

1. **Panel**: stick it into the shell, glass against the bezel, with a few strips of foam
   tape.
2. **Board**: plug the panel's two ribbons into it (they wrap around its bottom edge) and lay
   it on the panel's back, ESP32 antenna at the top.
3. **Scanner**: solder a straight 6-pin header to the SparkFun board on the **back** (pins
   away from the module). Drop it onto the two pins in the mouth, module facing the window;
   a dab of hot glue keeps it there. A Dupont cable goes from its header to the board's J4,
   name to name (GND, RX, TX, 3V3; TRIG and STAT can stay free).
4. **Radar**: slide the LD2410C between the two rails inside the chin, antenna side forward,
   and plug its cable into J6.
5. **Close**: back plate on (its posts land on the board's corners, pins in the holes), four
   screws, hang it on the two wall screws.

USB-C comes out of the left side.

## Changing it

[pantry-scanner.scad](pantry-scanner.scad) is parametric OpenSCAD: the panel's size and
thickness, the screen tilt, the mouth's angle, chin height, depth, corner radii and the
scanner and radar positions are variables at the top. Then:

```bash
hardware/enclosure/render.sh
```

exports both STLs and the pictures (Docker for OpenSCAD; the pictures come from
[render.py](render.py), a small renderer that needs only Python and Pillow).

Checked in OpenSCAD: the panel, board, scanner and radar stand-ins and the back plate don't
intersect the shell (only touch where they should).

## Not verified yet

Nothing has been printed. The panel outline (105.5 × 67.2 mm) and thickness are typical for
these panels; measure yours and adjust `panel_w`, `panel_h`, `panel_t` before printing. The
DE2120 module's height (`module_h = 12.5`) sets how far the scanner sits behind its window;
check it on yours.
