# Pantry

Self-hosted home inventory: pantry, fridge, freezer, garage, anything with a shelf.
Scan things **in** when you put them away and **out** when you use them, and always
know what you have.

- **Store-bought:** scan the product's own barcode (EAN/UPC). Name, brand and photo
  come from Open Food Facts. Packs of the same product are counted together.
- **Home-made** (harvest, bulk meat, meal prep): *Pack & label* prints one QR label per
  package on a Bluetooth cat printer. Each package keeps its own weight, packed date
  and use-by date, and scanning it OUT removes that exact package.
- **Wall scanner:** ESP32-S3 4.3" touchscreen + GM65 module, ESPHome firmware
  (`esphome/`). TAKE OUT / PUT AWAY modes, product photo, count before → after,
  −/+ for multiples, QR to name unknown barcodes, offline queue, ambient night clock.
- **Phone PWA:** camera scanning, inventory, shopping list, inbox for unknown barcodes,
  history with undo. Pages still open offline, and offline scans are queued and replayed.
- **Home Assistant:** shopping list mirrored to a to-do list; `/api/summary` for sensors.

Stack: SvelteKit (adapter-node) + SQLite (`node:sqlite`, no native deps), one container.

## Run

```bash
cp .env.example .env     # set ORIGIN, optionally HA_*
docker compose up -d --build
```

Data (SQLite DB + cached product photos) lives in `./data` → `/data` in the container.

Dev: `npm install && npm run dev` (port 5190, data in `./data`).

### Environment

| Var | |
|---|---|
| `ORIGIN` | Public HTTPS URL behind your reverse proxy, e.g. `https://pantry.example.com`. SvelteKit form posts check it. |
| `DATA_DIR` | Defaults to `/data` in the image. |
| `HA_URL`, `HA_TOKEN`, `HA_TODO_ENTITY` | Optional shopping-list sync, e.g. `http://192.168.10.10:20810`, a long-lived token, `todo.shopping_list`. |

### Reverse proxy

The phone needs **HTTPS** for the camera, PWA install and Web Bluetooth. Proxy to port
5190. `/api/events` is a server-sent-events stream, so turn off response buffering for
it (nginx: `proxy_buffering off;`; the app also sends `X-Accel-Buffering: no`).

The wall scanner talks plain HTTP straight to `http://<nas>:5190`, not through the proxy.

**There is no login.** Keep the app LAN-only or put proxy auth in front of the HTTPS
side. The wall scanner bypasses the proxy, so proxy auth doesn't affect it.

## Using it

| Screen | |
|---|---|
| **Stock** | Everything on hand by location, "use soon" packages, +/- buttons |
| **Scan** | Phone camera, IN/OUT (IN falls back to OUT after 2 min, same as the wall), undo |
| **Pack** | Home-made goods: product, number of packages × amount, where, use-by → labels |
| **Shop** | Products below their *min stock*, with ticks kept on your phone |
| **More → Inbox** | Barcodes Open Food Facts didn't know: name, retry the lookup, or merge into an existing product |
| **More → History** | Every movement, undo any of them |
| **More → Settings** | Locations, printer darkness + test print |

Set **Min stock** on a product to have it appear on the shopping list.
**Keeps (days)** pre-fills use-by when packing. It's learned from the first pack if blank.

### Label printer (C15 / Fun Print cat printer)

Printing happens **from the phone over Web Bluetooth**: Chrome on Android, over HTTPS.
On the first print, Chrome lists nearby Bluetooth devices; pick the printer (often shown
as its model name). Then:

- Print a test label in **Settings** and adjust **Darkness**. Sticker paper usually
  needs more than plain receipt paper.
- Use **57 mm self-adhesive thermal sticker rolls**. Stick labels on dry bags *before*
  freezing.
- The protocol is the community-reverse-engineered `51 78 …` one (MX/GB models).
  If your unit prints garbage or nothing, note the name it advertises and the Fun Print
  model so the driver (`src/lib/catprinter.js`) can be adjusted.

Labels encode `PNTRY:I:000123`. The wall scanner and phone camera both read them.

## Wall scanner (`esphome/`)

### Parts

| | |
|---|---|
| Sunton **ESP32-8048S043C** (ESP32-S3 N16R8, 4.3" 800×480, *capacitive* GT911 touch) | ~€28 |
| **GM65** (or GM861S) barcode module, 1D + 2D, **TTL UART** (not the RS-232 variant) | ~€18 |
| JST 1.25 mm 4-pin cable, 5 V 2 A USB-C supply, wall enclosure | |

### Wiring

Board's 4-pin **UART** connector → scanner:
`5V → VCC`, `GND → GND`, `TX (GPIO43) → scanner RX`, `RX (GPIO44) → scanner TX`.

GPIO43/44 is also the board's USB serial, so **unplug the scanner for the very first USB
flash**. After that, update over Wi-Fi.

### Scanner module setup

Using the configuration barcodes in the GM65 manual: **serial (UART) output, 9600 baud,
induction/continuous mode, add CR suffix**, and make sure QR codes are enabled.

### Flash

```bash
cd esphome
cp secrets.example.yaml secrets.yaml   # Wi-Fi, API key: openssl rand -base64 32 (OTA uses it too)
# edit substitutions at the top of pantry-scanner.yaml: server URL, location name
docker run --rm -it -v "$PWD":/config --device /dev/ttyUSB0 esphome/esphome run pantry-scanner.yaml
```

Or use the ESPHome dashboard in Home Assistant: copy `pantry-scanner.yaml`,
`pantry-ui.yaml` (the screens, included as a package) and `pantry_ui.h` into its config
folder. The board shows up in HA with a backlight light
and a "Last scan" sensor, and takes its clock from HA, so it needs no internet.

Set `ORIGIN` on the server: the unknown-barcode screen shows a QR code of
`<ORIGIN>/product/<id>`, which opens the product on your phone to name it.

The config is validated and compiles against ESPHome 2026.10. The **display timing and
pins are the commonly published ones for this board** and have not been tested on
hardware. If the image is shifted, try `pclk_frequency: 12MHz` or toggle `pclk_inverted`.

### Try it without the hardware

`pantry-sim.yaml` runs the same screens in an 800×480 window on a Linux desktop (X11).
The mouse is the touchscreen, and a small script stands in for the barcode module.
It talks to the app on `http://127.0.0.1:5190`, so start that first (`npm run dev`).

```bash
esphome/sim/run.sh                   # builds a Docker image with SDL, compiles, opens the window
esphome/sim/scan 3017620422003       # "scan" a barcode (Nutella); PNTRY:I:000001 for a label
```

The first build takes a few minutes. Set `ORIGIN` in `.env` to see the QR code on
the unknown-barcode screen. The backlight does nothing in the window, so the night screen
shows at full brightness.

**Network:** if the scanner lives on the IoT VLAN, the router needs an allow rule from
it to the NAS on TCP 5190.

### On the wall

The screen has a status bar on top (clock, or a blue "PUTTING AWAY" band), a card in the
middle, and a fixed bottom bar: **TAKE OUT | PUT AWAY** and **UNDO**.

- **Take out** is the default. Scan anything you take: the card shows the photo,
  **3 → 2 left**, and goes back to the home screen (what to buy, what to use soon,
  items to name) after 8 seconds. Took two? Tap **+**.
- **Put away** before unpacking shopping. The top bar turns blue and counts down; after
  2 minutes without a scan it falls back to take out. Each scan shows **2 → 3** and lands
  in the *This trip* list. Bought six of the same? Scan one, tap **+** five times.
- **First time a barcode is seen:** "Looking it up…" while the server asks Open Food
  Facts in the background. If it isn't found, the screen shows a **QR code**: point
  your phone at it to name the product right away, or do it later from the inbox.
- **Took the last one:** an amber banner says so, and whether it's on the shopping list
  (set *Min stock* on the product for that).
- **Home-made package:** packed date, use-by, what's left, and a hint if an older pack
  should be used first.
- **Nothing in stock** (counts drifted): *It was there, fix count* records the one the
  app didn't know about.
- **UNDO** opens a list of this scanner's last 5 scans from the past day, newest on top.
  Tap the one to reverse (any −/+ on it is reversed too); **CLOSE** or 20 s without a
  tap closes the list.
- **Server unreachable:** keep scanning. Scans wait on the scanner and are sent when the
  server is back (kept in RAM, so a power cut loses them).
- After 5 minutes without a touch or scan it shows a dim clock with what to buy and use
  soon; a touch or scan wakes it.

## Home Assistant

Shopping list: set the `HA_*` variables. The app adds and removes only the items it put
there, so items you add by hand are left alone.

Sensors from `/api/summary`:

```yaml
rest:
  - resource: http://192.168.10.10:5190/api/summary
    scan_interval: 300
    sensor:
      - name: Pantry low stock
        value_template: "{{ value_json.low_count }}"
        json_attributes: [low]
      - name: Pantry use soon
        value_template: "{{ value_json.expiring_count }}"
        json_attributes: [expiring]
      - name: Pantry inbox
        value_template: "{{ value_json.inbox_count }}"
```

## API

| | |
|---|---|
| `POST /api/scan` `{code, mode: "in"\|"out", device?, location?, default_location?, async_lookup?}` — `location` forces a place, `default_location` only applies to products without a usual place, `async_lookup` answers at once and looks a new barcode up in the background | → `{status: ok\|lookup\|unknown\|empty\|error, title, detail, count, prev, units, meta, image, qr, last_one, pkg, use_by, older, product_id, event_id, …}` (see `scanReply` in `inventory.js`) |
| `GET /api/scan/:event` | The same reply for an earlier scan; the wall polls it while `status` is `lookup` |
| `POST /api/scan/:event/adjust` `{by: 1\|-1}` | One more or one fewer of that scan ("bought six") |
| `POST /api/scan/:event/fix` | For a nothing-in-stock OUT: record that there was one |
| `GET /api/scan/recent?device=wall` | That device's last 5 scans from the past day that can still be undone (the wall's UNDO list) |
| `POST /api/undo` `{event_id?}` | Undo that event, or the latest one |
| `GET /api/summary` | `{low_count, low[], expiring_count, expiring[], soon[{name, n, days}], inbox_count}` |
| `GET /api/labels?ids=1,2` | Label data for reprinting |
| `GET /api/events` | SSE stream: `change` whenever stock moves |
