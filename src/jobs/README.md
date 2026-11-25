# Writing a job for MEATWARE

MEATWARE is a first person browser game (Three.js, TypeScript, Vite). In 2071 robots do
every job and watch humans do boring jobs live for fun. Every job is one shift of about
5 real minutes (09:00 to 17:00) under Brad, a flying supervisor drone with a tie.

The supermarket job (`src/jobs/shelves.ts` with its building in `src/world.ts` and
`src/details.ts`) is the reference. Read it before you start.

## What the engine already does for every job (src/game.ts)

You get all of this for free. Do not rebuild it.

- First person player (WASD, mouse, Shift run), collision with `level.colliders`.
- Brad: patrols `level.bossWaypoints`, vision cone, writes you up for standing still,
  for peeing outside the toilet, for hitting him, for mess on the floor. Overheats when he
  watches the player inspect items (I key, "Regulation 4.2.1"). Three write-ups = fired.
- Bladder and the staff toilet: a locked booth (`kit.toiletBooth`), opened only while the
  player holds an item with `toiletKey: true`. Peeing anywhere else makes a puddle.
- Items: E picks up any item lying around, E again drops it, G throws, Q pockets (steals),
  I inspects. Thrown items have simple physics and bounce off colliders.
- Robot live chat with viewers and hype, corporate messages, achievements, the clock,
  overtime ("just five more minutes"), the exit scanner for stolen goods and the payslip.
- Retro rendering: every `MeshStandardMaterial` is automatically converted to the 1996
  console look (low resolution, vertex wobble, dithering, fog). Just use standard materials.

## The contract

Everything is in `src/jobs/types.ts`. In short:

- `JobEntry` (what the title screen lists): `id`, `title`, `place`, `teaser`, optional
  `models`, and `create(scene)` that returns your `Job`.
- `Job`: your `level`, `start(shift)`, `update(dt)`, `interact(look)`, `hint(look)`,
  `quota()`, review rows, payslip rows and optional line tables for Brad, the chat and
  achievements. Return `false` / `null` from `interact` / `hint` for everything you do not
  handle, so the engine's defaults (pick up, doors, toilet, plants, signs) still work.
- `Shift` (passed to `start`): what you may use from the engine. Key parts:
  `scene`, `hud`, `sfx`, `boss`, `player`, `nav`, `items`, `held`, `seen`, `t`,
  `hype` (raise it for chaos), `annoyance` (raise it when Brad sees bad work),
  `count()`/`counter()` for your stats, `movementLocked` (set it while the player works at a
  station that needs no walking, so they cannot walk away and Brad does not see them as idle), `addItem`, `removeItem`, `pickUp`, `detachHeld`,
  `removeHeld`, `writeUp`, `fire`, `achieve`, `bossSay`, `chat`, `say`, `makePuddle`.

Optional `info.startHour` changes when the 8 hour shift starts on the clock (default 9).

## Building the level

Extend `LevelKit` from `src/level.ts` (like `World` in `src/world.ts`). It gives you
`box`, `sign`, `prop` (3D model from the manifest), `solid` (collider), `plant`,
`toiletBooth(x0, z0, keyLines)`, `onTick`, and the fields the engine reads:
`bounds`, `spawn`, `bossWaypoints`, `ceiling`, `initialItems`.

- The booth inside spans `x0..x0+5`, `z0..z0+4`, its door is on the west side (x = x0).
  Put it in a corner far away from where the player works. That walk is part of the joke.
- Put the toilet key item somewhere silly and far from the booth, as a `fixed` item in
  `initialItems` (see `TIRE_DEF` in `src/items.ts`: `toiletKey`, `heavy`, `holdPos`,
  `pickupLine`, `fixture`).
- Add at least two plants (`kit.plant`). Players will pee in them.
- Floor, walls and ceiling with pixel textures (`src/textures.ts`: `floorTex`, `wallTex`,
  `ceilingTex`, ... or your own with the exported `make()` helper). Tessellate big floor
  planes (for example `new THREE.PlaneGeometry(w, d, w, d)`), otherwise they shimmer.
- Lots of detail and clutter. The user explicitly does not want empty or plain rooms:
  lamps (some PointLights, one may flicker), pipes, signs, posters with corporate jokes,
  security cameras, boxes (`boxMaterials()` from `src/details.ts`), trash, stains,
  machines. Look at `src/details.ts` and `src/introSets.ts` for how that is done.
- Interactive things: set `mesh.userData.interact = { kind: 'yourKind', ...data }` and push
  the object into `level.interactables`. The engine raycasts those, finds the nearest object
  with `userData.interact` and hands it to your `interact(look)` / `hint(look)`.
- Text in the world: `kit.sign(lines, w, h, x, y, z, rotY, { bg, fg, border, font })`.
  For the pixel look use `font: '"Press Start 2P", monospace'`.
- The retro style puts a dark indoor fog on the scene. Outdoor levels can set their own:
  `scene.userData.retroFog = { color: '#3a2a3a', near: 20, far: 90 }` (set it before the first frame).
- Emissive screens: `MeshBasicMaterial` with a canvas texture (it is not converted and glows).

## Mischief and secrets

Players should discover something new in every shift. The engine already does this in every
level, so do not rebuild it:

- **Kick** (K or right mouse). Kicks items lying around or on shelves, breaks breakables, jump-kicks
  Brad. A boot swings into view.
- **Push**: walking into items on the floor pushes them along.
- **Beer crate**: placed at a random reachable spot every shift. Drinking blurs the view.
- **Random shift events** (two or three per shift, in random order): power cut (dark, red tint, Brad
  blind), Brad firmware update (Brad offline 30 s), zero gravity (loose items float), the office
  cat (wanders, can be petted, always dodges kicks), a golden item (pocket it).
- **Engine secrets** (`eng.*` in `src/fun.ts`) count for every job.

What a job adds (all in `src/level.ts` and `src/jobs/types.ts`):

- `kit.breakable(obj, { name, hp?, collider?, price?, line?, colors?, onBreak? })`: kicking it or
  hitting it with a thrown item breaks it into debris. It costs money on the payslip and gets a
  write-up if Brad sees it. Pass the `collider` from `kit.solid` so it disappears too. If the object
  already has its own `interact` kind, it keeps it (your `hint` and `interact` still work).
- `kit.hideSpot(minX, minZ, maxX, maxZ, name)`: while the player stands inside, Brad cannot see
  them (inside a locker, behind a curtain, in a laundry cart). `name` reads like "the lockers".
- `kit.movable(obj, name, opts?)`: turns a decorative object into an item that can be picked up,
  carried, thrown, kicked and pushed (chairs, cones, bins, lamps, signs). The object's origin must be
  at its base. Do not add a collider for it. `opts` takes `ItemDef` fields (`heavy`, `pickupLine`,
  `pocketable`, `holdPos` ...).
- `job.secrets`: a record of secret ids (prefix them with your job id, like `'dishes.fridge'`) to
  titles. Call `shift.secret(id)` when the player finds one. The engine shows a toast, remembers it
  in localStorage between shifts, and counts "SECRETS 3/14" on the title screen and in the review.
- `job.onKick(look)`: react when the player kicks a robot or a machine of your job. Return true if
  you handled it. Items, breakables and the cat already work without it.

Ideas for good secrets: things that only happen sometimes or in a random place each shift (which
locker holds the snack, which drawer has the note), interactions nobody expects (E on a poster, a
phone that rings, a vent, a radio, a computer with funny e-mails, a button that should not be
pressed), combinations (throw X at Y, put the wrong thing into a machine, kick the machine that is
stuck), and hidden rooms or corners. A secret should be funny when found, not a chore.

## Items

`ItemDef` in `src/items.ts`. For job items set `category: null`, a unique `id`, a `name`,
`shape` (any value, use `'box'` if unsure), `label: []`, `weight: 0`, `pocketable`, and
`build: () => THREE.Group` to make your own mesh (centered, base near y = 0). Use `tags`
or your own maps (keyed by `Item`) for job state. Create items with
`shift.addItem(def, pos, fixed?)` and put one in the hands with `shift.pickUp(item)`.

## Robots (NPCs)

- Looks: `buildCustomerVisual(kind, color)` from `src/customerModels.ts` gives an animated
  robot (`shopper`, `karen`, `toddler`, `roomba`, `gran`, `bulk`, `influencer`). Call
  `visual.play('idle' | 'walk' | 'run' | 'talk' | 'dead' | 'act')` and `visual.update(dt)`.
- Speech: `bubbles.say(group, visual.height + 0.45, text, seconds, name)` from `src/bubbles.ts`.
- Paths: `shift.nav.route(from, to)` returns waypoints around all colliders.
- Return their positions from `obstacles()` and their groups from `lookTargets()` so the
  player bumps into them and can talk to them. Make the group interactable.

## Text and humor

- Dry, deadpan corporate satire. Robots are polite and terrible. Brad speaks in LinkedIn
  phrases. Players find out mechanics by doing, so do not explain rules in text. Short
  hints under the crosshair ("E: flip patty") are fine.
- No real brand names or imitations of them. Fictional names only.
- No em dashes. Do not join two sentences with a semicolon. Use a colon only before a list.
- Give Brad a `shiftStart` greeting and at least 10 job lines, give the chat at least 8 job
  keys, and add 3 to 5 job achievements.

Optional hooks: `helpKeys` adds your own keys to the help bar, `onEnd(fired)` runs when the
shift ends (remove your DOM panels and key listeners there), `payRows(fired)` knows whether the
player got fired.

## UI for minigames

The HUD is shared (`src/hud.ts`). For a timing bar use `shift.hud.progress(label, frac)`.
If you need more (order tickets, a keypad), create your own DOM element from your folder,
import your own CSS file there, and match the HUD look: dark warm panels with pixel bevel
borders, fonts `'Press Start 2P'` (labels) and `'VT323'` (text), no rounded corners.
Keys the engine uses: W A S D, Shift, E, G, Q, I, P, M, V, Esc. You may listen to other keys
(R, F, 1 to 9, arrows) yourself, only while `document.pointerLockElement` is set.

## 3D models

Free CC0 models are staged in `asset-staging/` (Kenney food, furniture, mini shop, factory,
car, retro urban kits). To use one, copy the `.glb` and its `Textures/` folder into
`public/models/<your job id>/` and declare it in your entry's `models` record, then
`kit.prop(key, ...)` or `instantiate(key)` from `src/assets.ts`. Keep the pack's License.txt
next to the files. Kenney GLBs reference `Textures/colormap.png` relative to the GLB.

## Testing

- `npx tsc --noEmit` (fix every error in your folder).
- Do not test against the shared dev server, other agents edit files at the same time and it
  reloads. Build your own copy and preview it on your own port:
  `NODE_ENV=development npx vite build --mode development --outDir <scratch>/dist --emptyOutDir`
  then `npx vite preview --outDir <scratch>/dist --port <your port> --strictPort`.
  `window.game` is available in that build. Open `http://localhost:<port>/?job=<id>&skipintro`.
- Drive it with Playwright (`playwright-core`, see the scripts in the scratchpad `pw/` folder):
  click `#startBtn`, click the canvas for pointer lock, then use `page.evaluate` on
  `window.game` to place the player (`game.player.pos`, `game.player.yaw`, `pitch`),
  press keys, and take screenshots. Look at every screenshot.
