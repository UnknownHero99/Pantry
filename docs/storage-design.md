# Multiple storages: garage and beyond (proposal)

Status: **design only, not built.** For discussion. Mockups: the
"Storage (proposal)" page of the design canvas
(https://claude.ai/artifact/CqD2XJfxkmNZyGzz8CLZbG).

## Decided so far (2026-10-26)

- **Spaces:** **Pantry** (home: shelves and a freezer, where the wall scanner hangs),
  **Kitchen** (fridge and its own freezer), **Garage**. More later if needed; there's
  an "Add a space" anyway.
- **Pantry and Kitchen are both food:** same *Use soon*, same grocery list, one
  search. They're two spaces only because they're two rooms.
- **Garage = tools and spare parts for things around the house.** Mostly *located*
  (where is the drill?), some *counted* (bulbs, filters, screws). Spare parts record
  what they **fit** ("Gorenje WA74 washer"), so you can search for the machine.
- **Garage has its own shopping list**, separate from groceries (its own HA to-do list).
- **Lent to…** yes, with a reminder to get it back.
- **The garage is a mess today.** So the first garage feature is a quick way to
  *sort* it (below), not just to record things one at a time.

## What we want

- Keep knowing what's in the **pantry** exactly as today. Pantry stays the
  default everywhere: the app opens on it, the wall scanner files into it, and
  new barcodes land there.
- Also organise the **garage** (and later basement, attic…), where the
  question is mostly *"where did I put X?"* rather than *"how many are left?"*.
- One search that answers "where is it?" across everything.

## The idea in one paragraph

Today there's one flat list of places (Pantry, Fridge, Freezer). Turn that
into a small tree. At the top are **spaces** (Pantry, Garage, Basement).
Inside them are **places** (Shelf A, Workbench, Chest freezer), and places
can hold **boxes** that get their own P15 label with a QR code. Every product
lives somewhere in that tree. Things in the garage can be *counted* like food
(screws, motor oil, with a minimum and the shopping list), or just *located*
(a drill, a tent: you want to know where it is, not count it). The Stock tab
gets a space switcher; search covers all spaces and answers with the path:
"Garage › Shelf A › Box A·2 Power tools".

## Concepts

| Concept | Example | Notes |
|---|---|---|
| **Space** | Pantry (home), Kitchen, Garage | Top level. Has its own Stock view and tiles. Exactly one is the *home* space (Pantry). |
| **Place** | Pantry shelves, Pantry freezer, Kitchen fridge, Shelf A, Workbench | Where things physically are. Can nest (Workbench › Drawer 2). |
| **Box** | A·2 "Power tools" | A place you can carry. Gets a P15 label `PNTRY:B:000012`. Scanning it opens the box; moving it moves everything inside. |
| **Counted thing** | Nutella, Screws 4×40, Motor oil | Today's products: quantity, min stock → shopping list, use-by for packs. |
| **Located thing** | Cordless drill, Tent | No count, just *where*. Optional photo, optional "lent to…". |

The rule: **what something is** (food vs. household) decides which lists it's on;
**where it is** is just its place in the tree. So the kitchen freezer's beef shows
in the same *Use soon* as the pantry freezer's, and a box of bulbs in the garage
goes on the garage list.

## Data model (changes to today's SQLite)

```
locations          + parent_id   → tree (space › place › box…)
                   + kind        'space' | 'place' | 'box'
                   + code        box label number (PNTRY:B:…)
                   + is_home     exactly one space (Pantry)
products           + counted     1 = counted (today), 0 = located only
                   + group       'food' | 'household' (decides lists; default food)
                   + fits        free text for spare parts ("Bosch SMS46 dishwasher")
                   + photo       for things without a barcode or Open Food Facts photo
loans (new)        product, person, since, remind_after_days, returned_at
stock / items      unchanged: they already point at a location, now any node
events             unchanged; moving a box logs one 'move' event
```

Migration: create spaces *Pantry* (home) and *Kitchen*. Today's "Pantry" becomes
*Pantry › Shelves*, "Fridge" becomes *Kitchen › Fridge*, and today's "Freezer" goes
to whichever freezer it really is (see the questions). Everything else keeps working.

## How the existing parts fit

- **Wall scanner:** belongs to the Pantry space and behaves exactly as today.
  A second scanner could hang in the garage later (it would send
  `default_location: Garage`).
- **Phone Scan tab:** scans file into the space you're looking at (Pantry by
  default). Scanning a **box label** opens that box: "Put in" then scan or
  photograph things to file them there.
- **Shopping lists:** *Groceries* (Pantry + Kitchen) and *Garage* are separate
  lists. The Shop tab gets a switch between them, and each syncs to its own HA to-do
  list.
- **Lent to…:** pick a person (free text) and how long. The garage tile shows
  "1 lent out", and Home Assistant sends a phone notification when it's overdue.
- **Stock tab:** opens on Pantry; the title becomes a switcher (*Pantry ▾*) with
  the other spaces and "Search everywhere".
- **Labels:** the P15 prints box labels (QR + "A·2 POWER TOOLS" + path) as well as
  the home-made food labels.

## Flows (mocked up)

1. **Switch space:** tap the title, pick Garage. The Pantry stays home.
2. **Garage view:** shelves with their boxes (number, name, a peek at what's
   inside), counted things with LOW warnings, food places like the chest freezer.
3. **Where is it:** search "drill", get the path as chips, when it was put
   there, *Move…* and *Lent to…*.
4. **Box:** scan its label, see what's inside, *Put in* (scan barcode or snap a
   photo + name), *Took it* for located things, *Move box*, print the label.
5. **Sorting the garage:** the way out of the mess, one box at a time.
   - Print a sheet of numbered box labels on the P15 (A·1, A·2, …) and stick them on.
   - Scan a box label to start *Filling box A·3*. Then, for each thing: snap a photo,
     type a name, tap *Tool / Spare part / Other*, add what it *fits* for spare
     parts, and choose *Just 1* or *Count them*. About 10 seconds per thing.
   - Not sure where something goes? It lands in *Unsorted*; file it later.
   - *Done*, then the next box. The garage gets organised in sessions, not in one go.

## Building it in steps

1. **Spaces and nested places:** Pantry / Kitchen / Garage, the space switcher,
   paths everywhere, search everywhere. Pantry works exactly as today.
2. **Boxes and sorting:** P15 box labels, *Filling box…* sessions with photo + name
   + fits, Unsorted. (This is what gets the garage out of the mess.)
3. **Garage day to day:** Move…, Took it / put back, counted spare parts with
   minimums, the separate Garage shopping list (+ its HA to-do list).
4. **Lent to…** with HA reminders. Later, maybe a second wall scanner in the garage.

## Still open

1. Today's single "Freezer": is it the **pantry** freezer or the **kitchen** freezer?
   (Its packages move there when spaces arrive.)
2. Does the kitchen have a fridge too, or only the freezer?
3. Box labels: is plain numbering (A·1, A·2… by shelf) fine, or do you want named
   boxes ("Camping") as well? The mockups show both: number plus a name.
4. "Lent to…" reminders: after how long by default, two weeks?
