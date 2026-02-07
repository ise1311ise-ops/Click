# Gravity Defied Mini Game

This project is a lightweight homage to the classic **Gravity Defied** motorcycle game.  It runs entirely in a browser without any external dependencies, using a custom physics implementation and the HTML5 canvas.  You can play it locally or host it anywhere static files are served (for example GitHub Pages) — no server code is required.

## Running locally

1. Clone or download this repository.
2. Open the `index.html` file in a modern desktop or mobile browser.  All resources are loaded from CDNs and the local files, so there is nothing to install.

## Controls

The game supports both keyboard and on‑screen button controls.  On mobile, tap the buttons along the bottom of the screen.  On desktop you can use either the buttons or your keyboard.

| Action         | Keyboard          | On‑screen button |
|--------------- |------------------ |------------------|
| Accelerate     | `→` or `D`       | **Газ**          |
| Brake / reverse| `←` or `A`       | **Тормоз**       |
| Lean backward  | `↓` or `S`       | **Наклон ←**     |
| Lean forward   | `↑` or `W`       | **Наклон →**     |

## Structure

This mini‑app consists of three files:

* `index.html` — the main HTML page that loads the canvas, control buttons and JavaScript libraries.
* `style.css` — simple styling for the game canvas and control panel.  Feel free to customise colours and fonts to match your taste.
* `script.js` — the core game logic: creation of the physics world, the motorcycle, a procedurally generated track, user input handling and a basic camera to follow the bike.

The project is intentionally kept lean and readable, so you can extend it with your own levels, graphics or UI.  To make the track harder or more interesting, open `script.js` and modify how the `trackPieces` array is populated.