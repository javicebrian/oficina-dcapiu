# AGENTS.md — oficina-dcapiu

Interactive 3D model of a three-bedroom flat ("Vivienda Tipo D", second floor)
in Bormujos, Sevilla, built from the sales plan and three kitchen renders.
React + Vite + React Three Fiber, fully static. UI in Spanish. A simpler
sibling of `../abeto45` (same stack, scene code adapted from it), with no Home
Assistant integration: visualisation plus doors, windows and lights you can
click.

This file is the source of truth for humans and coding agents working in this
repo. `CLAUDE.md` is a symlink to it. Non-obvious decisions go in the
Decision log at the bottom, with a date and the reason.

---

## Quick start

Node lives in `~/.local/node-v22.14.0-linux-x64/bin` and is **not on `PATH` by
default**:

```bash
export PATH="$HOME/.local/node-v22.14.0-linux-x64/bin:$PATH"
cd ~/workspaces/oficina-dcapiu
npm install          # first time only
npm run build        # type-check + production build -> dist/ + dist guard
```

The dev server is owned by **pm2** (see the workspace `AGENTS.md`):

```bash
pm2 start ~/pm2/ecosystem.config.js --only oficina-dev   # vite on :5178
```

It is on the workspaces dashboard as a `vite dev` row, linked directly to `:5178`.

## Publishing

**https://javicebrian.github.io/oficina-dcapiu/** — one **public** repo,
`javicebrian/oficina-dcapiu` (`origin`), source and site together. Every push
to `main` builds and deploys through GitHub Actions (`.github/workflows/pages.yml`).
The plan and renders are anonymised (no names, no address), so unlike abeto45
there is no private/public split; `docs/` is in the repo but never shipped
(`scripts/check-dist.mjs` fails the build if it reaches `dist/`). The site
names only the town, never the building.

## Layout

```
docs/                    Sales plan (scanned PDF, 3 pages; page 2 has the dimensions)
                         and three kitchen renders (WhatsApp JPEGs). Not deployed.
src/
  data/
    flat.ts              Everything measured: scale, levels, walls, openings (doors and
                         windows, how each moves), rooms. Read off the scan in pixels.
    furniture.ts         The light switches (ids, names) and the cupboards that open.
  scene/
    geometry.ts          Plan cm -> scene metres; prism/flat/segmentBox helpers.
    materials.ts         Shared materials + the section-cut clipping plane.
    Model.tsx            Walls, sills and lintels, floor slab, ceiling, terrace railing.
    Doors.tsx            Clickable, animated doors (swing) and windows (two sliding sashes).
    Furniture.tsx        Kitchen, bathrooms, bedrooms, salón, terrace, and every light
                         fitting. The water-heater column opens on a click.
    Lights.tsx           Switch (clickable fitting) and Glow (point light).   } from
    cutaway.ts           Selected room: cone cutaway of the walls hiding it.   } abeto45,
    picking.ts           Which object really is under the pointer.             } barely
    sun.ts, Sun.tsx      Real sun over Bormujos; sky from day to night.        } changed
    floorTexture.ts      Oak planks, bathroom porcelain, terrace tile (canvas textures).
    Rooms.tsx            Clickable floors and DOM labels.
    Compass.tsx          N/S/E/O on the table round the model.
    Viewer.tsx           Canvas, camera presets, cut plane, contexts.
  ui/                    Sidebar, room card, title block.
  App.tsx                State: ceiling, cut, labels, selection, doors, lights, sun.
  urlState.ts            Opening state from and to the link (?vista, techo, rotulos,
                         mobiliario, controles).
```

## Coordinates and units

- **Scan pixels → plan cm.** The plan is a 200 dpi raster scan, so nothing can
  be extracted as in abeto45: every wall was read by eye on page 2
  (`pdfimages -j` gives the 1646 × 2331 page). The scale bar spans 1016 px for
  10 m, so `px(x, y)` in `flat.ts` turns scan pixels into plan cm (×0.985, origin
  at pixel 380, 320). The written dimensions check out within a couple of cm
  (3.97, 2.20, 5.92, 6.20). To change a wall, find it on the scan and edit its
  pixels.
- **Plan**: centimetres, x → east, y → south (page-down). **Heights**: cm above
  the finished floor. **Scene**: metres, y up, the flat centred on the origin;
  only `scene/geometry.ts` converts.
- North is up the sheet (the plan's arrow), taken as true north.

## Verifying in a browser

Headless Chromium works with SwiftShader (see the workspace memory on headless
Chromium; the libraries it needs are in `~/.local/poppler/root`). Serve `dist/`
rather than running vite alongside it. `#debug` in the URL exposes
`window.__flat.lookAt(px, py, pz, tx, ty, tz)` and `window.__flat.project(x, y, z)`
(scene metres) for scripted screenshots and clicks.

---

## Decision log

- **2026-10-05 — Scope chosen by the owner.** Same stack as abeto45, but only for
  GitHub Pages: no Home Assistant. Furnished as a home, following the plan
  (double bed, L sofa, dining for six; the small rooms changed since, see below), with the renders for the
  kitchen and our own choices for the rest. Doors, windows and lights respond
  to clicks. Kept from abeto45: section cut and camera presets, room cards,
  sun. Not kept: the plan overlay.
- **2026-10-05 — Real sun over Bormujos** (owner gave the location: next to the
  Hospital San Juan de Dios). Town coordinates only (37.37, −6.07). "Día" and
  "Noche" buttons jump to 13:00 and 22:30 for a quick look at the lights.
- **2026-10-05 — Kitchen from the renders, not the plan** (owner chose the
  closed fronts, with the column opening on a click to show the water heater).
  The plan draws a straight run; the renders show an L with the washer under
  the window. Reading of the plan behind it: the thin full-height partition
  from the east wall (render 2) and a peninsula west of it, drawers to the
  kitchen, where the plan draws a light rectangle. Render 1 hides that
  partition, as renders do.
- **2026-10-05 — Heights not on the plan:** ceiling 2.60, doors 2.10, windows
  0.90–2.15 (kitchen sill 1.05 over the worktop, en-suite 1.10). Kitchen tall
  units and wall cupboards top out at 2.25, as in the renders.
- **2026-10-05 — Metals are barely metallic** (metalness ≤ 0.4): there is no
  environment map, and a truly metallic fridge renders black.
- **2026-10-05 — Plan view turns with the screen:** north up on portrait, east up
  on landscape, so the long flat fills either.
- **2026-10-05 — The two small bedrooms are children's rooms** (owner: the plan's
  2 × 2 singles and a desk squeezed into dormitorio 3's strip made little
  sense). Each has one single bed with its head to the north wall in the
  north-east corner, a desk with shelves on the north wall, a chair and a
  round rug (`KidRoom`); a low bookcase in dormitorio 2 only (the one in
  dormitorio 3's strip by the door was in the way, owner). Dormitorio 2 is the boy's (navy, teal,
  mustard), dormitorio 3 the girl's (lilac, coral, blush, a beanbag by the
  door). Which room is whose is our choice.
