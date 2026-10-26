# Multiple storages: garage and beyond (proposal)

Status: **design only, not built.** For discussion. Mockups: the
"Storage (proposal)" page of the design canvas
(https://claude.ai/artifact/CqD2XJfxkmNZyGzz8CLZbG).

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
| **Space** | Pantry (home), Garage, Basement | Top level. Has its own Stock view, tiles and shopping list section. Exactly one is the *home* space (Pantry). |
| **Place** | Fridge, Shelf A, Workbench, Chest freezer | Where things physically are. Can nest (Workbench › Drawer 2). |
| **Box** | A·2 "Power tools" | A place you can carry. Gets a P15 label `PNTRY:B:000012`. Scanning it opens the box; moving it moves everything inside. |
| **Counted thing** | Nutella, Screws 4×40, Motor oil | Today's products: quantity, min stock → shopping list, use-by for packs. |
| **Located thing** | Cordless drill, Tent | No count, just *where*. Optional photo, optional "lent to…". |

Food can live in the garage too: the chest freezer is a place in Garage, but
its food still shows in the Pantry space's *Use soon* and shopping list. The
rule: **what something is** (food vs. hardware) decides which lists it's on;
**where it is** is just its place in the tree.

## Data model (changes to today's SQLite)

```
locations          + parent_id   → tree (space › place › box…)
                   + kind        'space' | 'place' | 'box'
                   + code        box label number (PNTRY:B:…)
                   + is_home     exactly one space (Pantry)
products           + counted     1 = counted (today), 0 = located only
                   + group       'food' | 'household' (decides lists; default food)
stock / items      unchanged: they already point at a location, now any node
events             unchanged; moving a box logs one 'move' event
```

Migration: create space *Pantry* (home) and put today's Pantry, Fridge and
Freezer under it. Everything else keeps working as is.

## How the existing parts fit

- **Wall scanner:** belongs to the Pantry space and behaves exactly as today.
  A second scanner could hang in the garage later (it would send
  `default_location: Garage`).
- **Phone Scan tab:** scans file into the space you're looking at (Pantry by
  default). Scanning a **box label** opens that box: "Put in" then scan or
  photograph things to file them there.
- **Shopping list:** one list, grouped *Food* / *Household & garage*. The HA sync
  can send each group to its own to-do list (e.g. *Groceries* and *Hardware
  store*).
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

## Building it in steps

1. **Spaces and nested places**, the space switcher, paths everywhere, search
   everywhere. (Biggest value, small risk; Pantry is unchanged.)
2. **Located things:** add without a barcode (photo + name), Move…, Took it /
   put back.
3. **Boxes with P15 labels:** scan a box to open it, put in by scanning, move a
   box with its contents.
4. **Lists per group:** food vs. household on the shopping list, separate HA
   to-do lists. Optional: *Lent to…*, a garage wall scanner.

## Questions for later

1. What's in the garage mostly: tools and gear (where-is), consumables (counted:
   screws, oil, paint), food/drinks (crates, potatoes, a freezer)? All three?
2. Is it organised into shelves and boxes already, and are you up for putting a
   P15 label on each box?
3. Other spaces you'd add soon (basement, attic, car, workshop)?
4. Garage consumables on the same shopping list as food, or their own list?
5. Do you want "lent to…" (and a reminder to get it back)?
6. Naming: should the home space be called "Pantry" with the places Pantry
   (cupboard), Fridge, Freezer under it, or "Kitchen"?
