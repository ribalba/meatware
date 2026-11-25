# MEATWARE

*The Human Labour Heritage Experience*

In 2071 robots do every job. For fun, they now watch humans do the boring ones. Live.

A browser game in 3D (Three.js, TypeScript, Vite). The first job is the shelf stacker at the SHOPOTRON 9000 hypermarket.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
```

## Controls

| Key | Action |
| --- | --- |
| WASD, mouse | move and look |
| Shift | run |
| E | take, stock, use |
| G | throw |
| Q | put the held item in your pocket (steal) |
| I | inspect per Regulation 4.2.1 (8 seconds, makes Brad overheat) |
| P | pee |
| M / V | sound / boss voice on and off |
| Esc | pause |

## What is in version 0.1

- One shift of about 5 minutes (09:00 to 17:00) plus up to two rounds of "just five more minutes".
- Pallet in the back, five shelves (cereal, cans, pet food, paper, fruit) and some trap items like "Dog Food for Humans" (it is cereal).
- Brad, the supervisor drone, with a visible vision cone. He writes you up for standing around, wrong sorting he sees, peeing and hitting him. Three write-ups and you are fired.
- Bladder meter. The only approved toilet is in the far corner, and its key hangs on a car tire at the service desk.
- Stealing with pockets that slow you down, Brad checks bulging pockets, and an exit scanner at the end.
- Malicious compliance. Inspecting items in front of Brad raises his temperature until he overheats and lies on the floor for 25 seconds.
- Seven kinds of robot customers. They buy what you put on the shelves, comment on wrong items and slip on puddles.
  - Customer-Bot 3000 shops normally.
  - Karen-Unit 9 follows you and asks for your manager when a shelf is empty or wrong. Press E to apologize.
  - Toddler-Bot throws items off the shelves.
  - Vacu-Max, a robot vacuum, eats items on the floor and drinks puddles.
  - RoboGran blocks the aisle and asks for a product. Bring it for a tip, which Brad takes.
  - Bulk-Buyer 9000 empties a shelf in one go.
  - Influencer-Bot films you. While it films, chaos counts double.
- E on a customer talks to them or hands over what you hold.
- A live chat of robot viewers. Chaos raises the viewer count, competence bores them.
- Performance review and payslip with deductions at the end, plus achievements.
- An intro cutscene of about 80 seconds before the title screen. It tells the story of how robots took every job and how one unemployed human gets a letter from the Human Labour Heritage Center. It plays on its own dark stage, so it fits every job, and it explains no game rules. Any key skips it, and the title screen has a button to watch it again.

## Look

The game renders in a late 90s console style: low resolution, wobbling vertices, 15-bit color with dithering, pixel textures and dark warm fog (`src/styles.ts`). The textures are drawn in code (`src/textures.ts`) and the store clutter is in `src/details.ts`. For comparison the other prototypes are still reachable with `?style=comic`, `?style=noir`, `?style=toy` or `?style=default`.

## 3D models

All models are CC0. Sources and authors are listed in `public/models/CREDITS.md`. If a model file is missing the game falls back to simple shapes.

## Code layout

| File | Content |
| --- | --- |
| `src/game.ts` | game loop, rules, scoring, input |
| `src/world.ts` | the store: shelves, pallet, desk, toilet booth, plants, posters |
| `src/boss.ts` | Brad: patrol, micromanaging, vision cone, overheating |
| `src/customers.ts` | robot customers, their kinds and behaviour |
| `src/intro.ts` | the intro cutscene: shots, captions, camera moves |
| `src/nav.ts` | walkable grid and A* pathfinding for the robots |
| `src/customerModels.ts` | what the customers look like, animations |
| `src/assets.ts` | model manifest and loader |
| `src/items.ts` | item types and their meshes |
| `src/player.ts` | first person controller |
| `src/hud.ts`, `src/style.css` | HUD, chat, screens |
| `src/review.ts` | performance review and payslip |
| `src/audio.ts` | synthesized sounds, muzak and boss voice |
| `src/texts.ts` | all jokes and lines |

In dev mode the game object is available as `window.game` in the browser console.

## Play online

The game is published with GitHub Pages at https://ribalba.github.io/meatware/ (built by `.github/workflows/deploy.yml` on every push to `main`).

## License

The code is licensed under the GNU Affero General Public License v3.0 or later, see `LICENSE`.
The 3D models in `public/models/` are CC0 (public domain), see `public/models/CREDITS.md` and the license files next to them.
The pixel fonts Press Start 2P and VT323 come from npm (`@fontsource/*`) under the SIL Open Font License.
