# Wall scanner shopping list

Everything for one wall scanner, with no custom board. Prices were checked on AliExpress on
30 October 2026, shipping to Slovenia, in EUR with VAT. Listings come and go, so the model
and the option to pick matter more than the link.

| Part | Qty | Pick | Price | Shipping |
|---|---|---|---|---|
| **Guition JC4880P443C**, 4.3" ESP32-P4 display board, [Guition Store](https://www.aliexpress.com/item/1005009621821443.html) | 1 | `JC4880P443C-I-W` (capacitive, no shell) | €34.40 (€32.00 in the 11.11 sale) | free |
| **GROW GM67** barcode module, [listing](https://www.aliexpress.com/item/1005007150284044.html) (346 sold); also [this one](https://www.aliexpress.com/item/1005005353980674.html) (€17.75) or [this one](https://www.aliexpress.com/item/4000873144062.html) (€18.55) | 1 | comes with its USB and UART cables | €18.36 (€15.06 in the sale) | not checked |
| **Passive buzzer module**, 3-pin with transistor, [YX Electronic Components](https://www.aliexpress.com/item/1005005528181661.html) | 1 | `passive Buzzer` | €1.13 | free over €15 in this store |
| **WS2812B single LED**, [same store](https://www.aliexpress.com/item/1005007580679026.html) | 1 | `1 bit` | €1.19 | as above |
| **MX1.25 4-pin pigtail**, single plug, [listing](https://www.aliexpress.com/item/1005007277110532.html) | 1 (pack of 10) | 4 pin, 10 or 15 cm | from €1.58 | free over €15 |
| **Dupont jumper wires**, female to female, 10 cm, [listing](https://www.aliexpress.com/item/32825558073.html) | 6 (a 40-wire strip) | female–female, 10 cm | from €1.05 | |
| **Right-angle USB-C cable**: USB-A to C, 90° plug on the C end, [listing](https://www.aliexpress.com/item/1005008645902348.html) | 1 | 1 m or longer, to reach the socket | from €2.53 | |
| **M3 × 8 self-tapping screws**, pan head, [listing](https://www.aliexpress.com/item/4000982209705.html) | 4 | M3 × 8 | from €0.83 | free over €15 |

**Total:** about **€61**, plus shipping for the GM67 and anything under a store's €15
free-shipping line. Put it all in one cart: AliExpress shows the delivered total there.
Prices drop on 1 November for the 11.11 sale.

## Probably already at home

- **5 V 2 A USB charger.** A phone charger you trust beats a €3 no-name one
  ([like this](https://www.aliexpress.com/item/1005010044221239.html)) for something
  plugged in all day. If yours has a USB-C port, get a C-to-C right-angle cable instead,
  [like this one](https://www.aliexpress.com/item/1005011568065323.html) (€3.95).
- Thin double-sided foam tape, hot glue, heat-shrink and a soldering iron (for the crossed
  TX/RX wires and the pigtail).
- 2 wall screws with heads up to 8 mm, and plugs for your wall.
- About 150 g of PETG or PLA for the [case](enclosure). Its two parts are about 116 cm³
  of plastic if printed solid, so less with normal infill.

## Notes

- The **GM67** and the display board's CN2 have the same pin order (5V, TX, RX, GND), so a
  straight cable won't work: cross TX and RX between the pigtail and the GM67's UART cable.
  See [Wiring](../README.md#wiring).
- **Shipping on the GM67**: AliExpress hid its product pages behind a robot check when
  these prices were taken, so the GM67's shipping is the one cost not checked here. The GM65 from a
  similar seller cost €3.80 to ship.
- Instead of the GM67 you can use a **GM65** (€18.85 delivered, no confirmed red aiming
  light) or the **SparkFun 2D Barcode Scanner Breakout v2** (about €65–80, red aiming
  line). Both work with the same firmware. The case's `scanner = "sparkfun"` mount was made
  for the SparkFun v1, so check a v2 against it; a GM65 needs a mount of its own.
