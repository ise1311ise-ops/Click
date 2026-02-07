(() => {
  // ===== Telegram init =====
  const tg = window.Telegram?.WebApp;
  const tgStatus = document.getElementById("tgStatus");
  if (tg) {
    tg.ready();
    tg.expand();
    tgStatus.textContent = "Открыто в Telegram ✅";
  }

  // ===== Game config =====
  const SIZE = 7;
  const TYPES = [
    { id: 0, emoji: "💎" },
    { id: 1, emoji: "🍀" },
    { id: 2, emoji: "🔥" },
    { id: 3, emoji: "🌙" },
    { id: 4, emoji: "⚡" },
    { id: 5, emoji: "🍒" },
  ];
  const START_MOVES = 30;

  // ===== State =====
  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const movesEl = document.getElementById("moves");
  const hintEl = document.getElementById("hint");
  const btnRestart = document.getElementById("btnRestart");
  const btnHint = document.getElementById("btnHint");

  boardEl.style.setProperty("--size", String(SIZE));

  let grid = []; // number[][] typeId
  let score = 0;
  let moves = START_MOVES;
  let selected = null; // {r,c}
  let locked = false;

  // touch drag/swipe
  let pointerDown = false;
  let startCell = null;
  let startXY = null;

  // ===== Helpers =====
  const rndType = () => Math.floor(Math.random() * TYPES.length);

  const inBounds = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

  const idx = (r, c) => r * SIZE + c;

  const getCellEl = (r, c) => boardEl.children[idx(r, c)];

  const setSelected = (pos) => {
    if (selected) getCellEl(selected.r, selected.c).classList.remove("sel");
    selected = pos;
    if (selected) getCellEl(selected.r, selected.c).classList.add("sel");
  };

  const swap = (a, b) => {
    const t = grid[a.r][a.c];
    grid[a.r][a.c] = grid[b.r][b.c];
    grid[b.r][b.c] = t;
  };

  const neighbors = (a, b) => {
    const dr = Math.abs(a.r - b.r);
    const dc = Math.abs(a.c - b.c);
    return (dr + dc) === 1;
  };

  const updateHUD = () => {
    scoreEl.textContent = String(score);
    movesEl.textContent = String(moves);
  };

  // ===== Match finding =====
  function findMatches() {
    const marks = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    let any = false;

    // rows
    for (let r = 0; r < SIZE; r++) {
      let runStart = 0;
      for (let c = 1; c <= SIZE; c++) {
        const same = c < SIZE && grid[r][c] === grid[r][c - 1];
        if (!same) {
          const runLen = c - runStart;
          if (runLen >= 3) {
            any = true;
            for (let k = runStart; k < c; k++) marks[r][k] = true;
          }
          runStart = c;
        }
      }
    }

    // cols
    for (let c = 0; c < SIZE; c++) {
      let runStart = 0;
      for (let r = 1; r <= SIZE; r++) {
        const same = r < SIZE && grid[r][c] === grid[r - 1][c];
        if (!same) {
          const runLen = r - runStart;
          if (runLen >= 3) {
            any = true;
            for (let k = runStart; k < r; k++) marks[k][c] = true;
          }
          runStart = r;
        }
      }
    }

    return { any, marks };
  }

  function countMarked(marks) {
    let n = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (marks[r][c]) n++;
    return n;
  }

  // ===== Resolve (pop + gravity + refill) =====
  async function resolveBoard(scoring = true) {
    while (true) {
      const { any, marks } = findMatches();
      if (!any) break;

      const toPop = countMarked(marks);
      if (scoring) score += toPop * 10;

      // pop anim
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (marks[r][c]) getCellEl(r, c).classList.add("pop");
        }
      }
      updateHUD();
      await wait(140);

      // remove
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (marks[r][c]) grid[r][c] = null;
        }
      }

      // gravity
      for (let c = 0; c < SIZE; c++) {
        let write = SIZE - 1;
        for (let r = SIZE - 1; r >= 0; r--) {
          if (grid[r][c] != null) {
            grid[write][c] = grid[r][c];
            if (write !== r) grid[r][c] = null;
            write--;
          }
        }
        for (let r = write; r >= 0; r--) grid[r][c] = rndType();
      }

      // clear pop classes + rerender
      render();
      await wait(80);
    }
  }

  const wait = (ms) => new Promise(res => setTimeout(res, ms));

  // ===== Render =====
  function render() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const el = getCellEl(r, c);
        el.classList.remove("pop");
        const gem = el.querySelector(".gem");
        const t = grid[r][c];
        gem.textContent = TYPES[t].emoji;
        gem.setAttribute("data-type", String(t));
      }
    }
  }

  // ===== Build DOM =====
  function buildBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);

        const gem = document.createElement("div");
        gem.className = "gem";
        cell.appendChild(gem);

        cell.addEventListener("click", () => onCellTap(r, c));
        boardEl.appendChild(cell);
      }
    }

    // pointer swipe
    boardEl.addEventListener("pointerdown", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || locked) return;
      pointerDown = true;
      startCell = { r: +cell.dataset.r, c: +cell.dataset.c };
      startXY = { x: e.clientX, y: e.clientY };
      setSelected(startCell);
    });

    boardEl.addEventListener("pointermove", (e) => {
      if (!pointerDown || locked || !startCell) return;
      const dx = e.clientX - startXY.x;
      const dy = e.clientY - startXY.y;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (Math.max(adx, ady) < 18) return;

      let dir = null;
      if (adx > ady) dir = dx > 0 ? { r: 0, c: 1 } : { r: 0, c: -1 };
      else dir = dy > 0 ? { r: 1, c: 0 } : { r: -1, c: 0 };

      const target = { r: startCell.r + dir.r, c: startCell.c + dir.c };
      pointerDown = false;

      if (inBounds(target.r, target.c)) {
        tryMove(startCell, target);
      }
    });

    boardEl.addEventListener("pointerup", () => {
      pointerDown = false;
      startCell = null;
      startXY = null;
    });
    boardEl.addEventListener("pointercancel", () => {
      pointerDown = false;
      startCell = null;
      startXY = null;
    });
  }

  // ===== Gameplay =====
  async function onCellTap(r, c) {
    if (locked) return;

    const pos = { r, c };

    if (!selected) {
      setSelected(pos);
      return;
    }

    if (selected.r === r && selected.c === c) {
      setSelected(null);
      return;
    }

    if (!neighbors(selected, pos)) {
      setSelected(pos);
      return;
    }

    await tryMove(selected, pos);
  }

  async function tryMove(a, b) {
    if (locked) return;
    if (moves <= 0) {
      hintEl.textContent = "Ходы закончились. Нажми «Новая игра».";
      return;
    }

    locked = true;
    hintEl.textContent = "";

    swap(a, b);
    render();

    // valid move?
    const { any } = findMatches();
    if (!any) {
      // rollback
      await wait(90);
      swap(a, b);
      render();
      setSelected(null);
      locked = false;
      if (tg) tg.HapticFeedback?.notificationOccurred("error");
      return;
    }

    moves -= 1;
    updateHUD();
    if (tg) tg.HapticFeedback?.impactOccurred("medium");

    await resolveBoard(true);
    setSelected(null);
    locked = false;

    if (moves <= 0) {
      hintEl.textContent = `Игра окончена! Очки: ${score}.`;
      if (tg) {
        tg.MainButton.setText("Поделиться результатом");
        tg.MainButton.show();
        tg.MainButton.onClick(() => {
          // Можно отправить результат боту через tg.sendData
          // Здесь просто закрываем, если надо:
          tg.sendData?.(JSON.stringify({ score }));
          tg.close?.();
        });
      }
    }
  }

  function findAnyHint() {
    // brute force: try all adjacent swaps and see if match appears
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const a = { r, c };
        const dirs = [{r:0,c:1},{r:1,c:0},{r:0,c:-1},{r:-1,c:0}];
        for (const d of dirs) {
          const b = { r: r + d.r, c: c + d.c };
          if (!inBounds(b.r, b.c)) continue;
          swap(a, b);
          const ok = findMatches().any;
          swap(a, b);
          if (ok) return { a, b };
        }
      }
    }
    return null;
  }

  btnHint.addEventListener("click", () => {
    const h = findAnyHint();
    if (!h) {
      hintEl.textContent = "Ходов нет — нажми «Новая игра».";
      return;
    }
    hintEl.textContent = `Подсказка: поменяй (${h.a.r+1},${h.a.c+1}) ↔ (${h.b.r+1},${h.b.c+1})`;
  });

  btnRestart.addEventListener("click", () => newGame());

  function newGame() {
    if (tg) tg.MainButton.hide();
    score = 0;
    moves = START_MOVES;
    setSelected(null);
    hintEl.textContent = "";
    updateHUD();

    // fill grid without initial matches
    do {
      grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, rndType));
    } while (findMatches().any);

    render();
  }

  // ===== Init =====
  buildBoard();
  // init grid values before first render
  grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, rndType));
  // avoid initial matches
  while (findMatches().any) {
    grid = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, rndType));
  }
  updateHUD();
  render();
})();
