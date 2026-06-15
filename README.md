# Snake — The Way of the Serpent

A premium HTML5 Snake game with a Japanese-inspired Kaya Wood board game aesthetic. Guide a continuous, evolving serpent to eat gold coins and grow longer.

![](cover.png)

## Features

- **Two Game Modes** — Classic (walls kill) or Wrap (teleport through walls)
- **Three Speed Levels** — Easy / Medium / Hard (speed also ramps up with score)
- **4 Evolution Forms** — Snake evolves every 120 points:
  - 🐍 **Hatchling** (0–119) — Cute bright green baby snake, big round eyes, dot scales
  - 🦎 **Serpent** (120–239) — Sleek emerald snake, diamond scale pattern
  - 🐲 **Viper** (240–359) — Dark purple forest viper, slit eyes, hex scales
  - 🐉 **Dragon** (360+) — Legendary gold dragon, fiery eyes, horns, scute armor
- **Continuous Snake Body** — Smooth Catmull-Rom spline rendering, no segmented look
- **Realistic Head** — Eyes follow movement direction; tongue flicks; horns on dragon form
- **Premium Design** — Kaya Wood aesthetic: warm wooden board, gold leaf food, single clean frame
- **Procedural Music** — Pentatonic Web Audio engine with dynamic tempo
- **Sound Effects** — Eating chimes, turn clicks, death sequence, evolution fanfare
- **Evolution Flash** — Screen glow when snake evolves to next form
- **High Score** — Persists to localStorage across sessions
- **Pause Support** — Space bar to pause/resume
- **Keyboard Shortcuts** — `WASD` / `Arrows` to move, `N` new game, `Space` pause, `M` music
- **Mobile Support** — Swipe to control, responsive layout
- **Zero Dependencies** — Single HTML file, no build step, no framework

## How to Play

Use **arrow keys** or **WASD** to guide the snake. Eat the gold coins (✦) to grow longer and increase your score. **Don't hit the walls** (Classic mode) or **your own tail!**

In **Wrap mode**, going off the edge teleports you to the opposite side.

Speed increases as your score goes up — easy starts relaxed, hard starts fast, and both get faster as you grow!

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑↓←→` / `WASD` | Move snake |
| `Space` | Pause / Resume |
| `N` | New game |
| `M` | Toggle music |
| `R` | Play again (when game over) |
| `Esc` | Close game over overlay / Pause |

## Project Structure

```
Snake/
├── index.html        ← The complete game (open in browser to play)
├── Launch.bat        ← Double-click to launch on Windows
├── cover.png         ← itch.io cover image (630×500)
├── README.md         ← This file
└── STORE_PAGE.md     ← itch.io store page copy (copy-paste)
```

## Technical Notes

- **Zero dependencies** — no npm, no build step, no framework. Just open `index.html`.
- **Canvas rendering** — the board uses HTML5 Canvas with Catmull-Rom splines for smooth snake body
- **Web Audio API** — procedural pentatonic music and sound effects; no audio files needed
- **Responsive** — works from 360px mobile to 4K desktop
- **All modern browsers** — Chrome, Firefox, Safari, Edge (last 3 versions)

## License

You own this code. Sell it, modify it, do whatever you want with it. No attribution required.

---

Built with the Kaya Wood design language — warm wood, vermillion red, gold leaf accents.
