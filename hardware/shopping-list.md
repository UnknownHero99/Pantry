# Wall scanner shopping list

Everything for one wall scanner, with no custom board, at the lowest delivered price found.
Checked on AliExpress on 30 October 2026, shipping to Slovenia, EUR with VAT. Pick the
option named in the table: the price depends on it.

| Part | Store | Pick | Price | Shipping | Delivered |
|---|---|---|---|---|---|
| **Guition JC4880P443C**, 4.3" ESP32-P4 display board, [listing](https://www.aliexpress.com/item/1005009621821443.html) | Guition Store | `JC4880P443C-I-W` | €34.40 | free | **€34.40** |
| **GROW GM67** barcode module, with its USB and UART cables, [listing](https://www.aliexpress.com/item/1005007150284044.html) | WAVGAT Official Store | (one option) | €18.36 | €4.30 | **€22.66** |
| **Speaker**, 8 Ω 2 W, 28 mm, 1.25 mm plug on a 15 cm lead (two), [listing](https://www.aliexpress.com/item/1005006056014552.html) | Repair-parts Store | `Q-8R2W 28MM` | €4.00 | free over €15 | **€4.00** |
| **WS2812B single LED**, [listing](https://www.aliexpress.com/item/1005007580679026.html) | YX Electronic Components | `1 bit` | €1.19 | free over €15 | **€1.19** |
| **MX1.25 4-pin pigtails**, 15 cm (ten), [listing](https://www.aliexpress.com/item/1005007277110532.html) | XMS Store | `15CM`, `Single head`, `4P` | €2.44 | free over €15 | **€2.44** |
| **Dupont wires**, female to female, 10 cm (a 40-wire strip), [listing](https://www.aliexpress.com/item/32825558073.html) | All-goods-are-freeshipping Store | `10C female to female`, `1pack` | €1.05 | free (arrives about 26 Nov–2 Dec) | **€1.05** |
| **Right-angle USB-A to C cable**, 1 m, [listing](https://www.aliexpress.com/item/1005008645902348.html) | Boutique Phone Accessories Store | `1pcs Black`, `1m` (1.5 m: €3.48) | €3.06 | free over €15 | **€3.06** |
| **M3 × 8 self-tapping screws**, stainless (fifty), [listing](https://www.aliexpress.com/item/4000982209705.html) | ZONSANTA Official Store | `M3 x 50Pieces`, `8mm` | €1.79 | free over €15 | **€1.79** |

**Total: €70.59 delivered**, if the "free over €15" items ship free together (next
paragraph). From **1 November** (11.11 sale) the board drops to €32.00 and the GM67 to
€15.06, about **€65**.

**"Free shipping over €15":** five of the small parts show it. Together they come to
€12.48, so AliExpress may add a small shipping charge for them. The cart shows it before
you pay; if it's more than about €2.50, adding something you'd use anyway (a heat-shrink
assortment, a spare LED) to get past €15 is cheaper.

Other GM67 sellers, for reference: €22.78 (Shop1102210483), €23.19 (WAVGAT authorization
Store), €25.37 (grow Growtech, HZGROW).

## Probably already at home

- **5 V 2 A USB charger** with a USB-A port. A phone charger you trust beats a €3 no-name
  one for something plugged in all day.
- A soldering iron, solder and heat-shrink: for the crossed TX/RX wires between the CN2
  pigtail and the GM67's cable, and for the LED board, which has solder pads, not pins.
- Thin double-sided foam tape and hot glue.
- 2 wall screws with heads up to 8 mm, and plugs for your wall.
- About 150 g of PETG or PLA for the [case](enclosure). Its two parts are about 116 cm³
  of plastic if printed solid, so less with normal infill.

## Notes

- The **GM67** and the display board's CN2 have the same pin order (5V, TX, RX, GND), so a
  straight cable won't work: cross TX and RX between the pigtail and the GM67's UART cable.
  See [Wiring](../README.md#wiring).
- The **speaker's 15 cm lead** reaches from the floor to the board's speaker socket on its
  top edge (about 12 cm). Speakers sold with 10 cm leads are too short; a spare 2-pin
  pigtail soldered on would lengthen one.
- Instead of the GM67 you can use a **GM65** (€18.85 delivered, no confirmed red aiming
  light) or the **SparkFun 2D Barcode Scanner Breakout v2** (about €65–80, red aiming
  line). Both work with the same firmware. The case's `scanner = "sparkfun"` mount was made
  for the SparkFun v1, so check a v2 against it; a GM65 needs a mount of its own.
