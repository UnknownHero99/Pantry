# Wall scanner shopping list

Everything for one wall scanner, with no custom board, at the lowest delivered price found.
Prices are from AliExpress on 1 November 2026 (11.11 sale), shipping to Slovenia, EUR with
VAT. Pick the option named in the table, because the price depends on it.

## Import charges decide what to buy where

Since 1 July 2026 every item shipped into the EU from outside it pays a **€3 customs duty**.
Since 1 November it also pays a **€2 handling fee**. In Slovenia both carry 22% VAT, so
AliExpress adds about **€6.10 per item** at checkout as "estimated import charges". It's per
item line, not per euro. Ordering all eight parts from China cost about €49 in charges on
€60 of parts, and six of those parts cost €1–4 each.

So only the parts that have to come from China are ordered there (four lines, about
€24 in charges). The rest are generic and cost less from a local or EU shop, or from the
parts box. None of the AliExpress listings here has EU warehouse stock (the "Ships from:
EU" filter finds no JC4880P443C, GM67 or matching speaker), and Botland, which has the
LED, only sells to registered businesses.

## From AliExpress

| Part | Store | Pick | Price | Shipping | Import charges | All in |
|---|---|---|---|---|---|---|
| **Guition JC4880P443C**, 4.3" ESP32-P4 display board, [listing](https://www.aliexpress.com/item/1005009621821443.html) | Guition Store | `JC4880P443C-I-W` | €31.92 | free | ~€6.10 | **€38.02** |
| **GROW GM67** barcode module, with its USB and UART cables, [listing](https://www.aliexpress.com/item/1005007150284044.html) | WAVGAT Official Store | (one option) | €15.06 | €4.30 | ~€6.10 | **€25.46** |
| **Speaker**, 8 Ω 2 W, 28 mm, 1.25 mm plug on a 15 cm lead (two), [listing](https://www.aliexpress.com/item/1005006056014552.html) | Repair-parts Store | `Q-8R2W 28MM` | €4.00 | free over €15 | ~€6.10 | **€10.10** |
| **MX1.25 4-pin pigtails**, 15 cm (ten), [listing](https://www.aliexpress.com/item/1005007277110532.html) | XMS Store | `15CM`, `Single head`, `4P` | €2.44 | free over €15 | ~€6.10 | **€8.54** |

**About €82**, against about €110 for the full cart. The speaker and the pigtails are each
under their store's €15 free-shipping line, so the cart may add a little shipping for them.
The board and GM67 pages also show "€3 off over €18", which may take a few euros off.

The speaker and the pigtails stay on AliExpress because of their 1.25 mm plugs. EU shops
mostly carry JST-PH, JST-SH and Grove leads, not 1.25 mm (MX1.25/PicoBlade), and the case
holds a 28 mm round speaker.

## From a local shop or the parts box

These cost €1–3 on AliExpress, so the €6.10 charge would make each one cost two to six
times its price.

| Part | Qty | Notes | On AliExpress, all in |
|---|---|---|---|
| **WS2812B LED**, single, on a small board | 1 | Any WS2812B works: one cut from a 5 V strip has the same three pads. Without it the scanner works, minus its status light. | [€1.19](https://www.aliexpress.com/item/1005007580679026.html) + €6.10 |
| **Dupont wires**, female to female | 3 | Only for the LED, on JP1's pins 2, 4 and 6 | [€1.05](https://www.aliexpress.com/item/32825558073.html) + €6.10 |
| **Right-angle USB-A to C cable**, 90° plug on the C end, 1 m or longer | 1 | The case leaves room for an angled plug, not a straight one | [€3.06](https://www.aliexpress.com/item/1005008645902348.html) + €6.10 |
| **M3 × 8 self-tapping screws**, pan head | 4 | Any hardware store | [€1.79](https://www.aliexpress.com/item/4000982209705.html) + €6.10 |

If you order any of them from AliExpress anyway, the GM67's alternative sellers are worth
a look too: €22.78 before the sale (Shop1102210483), €23.19 (WAVGAT authorization Store),
€25.37 (grow Growtech, HZGROW).

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
