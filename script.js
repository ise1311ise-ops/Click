/*
 * Client‑side logic for the Space Tycoon mini‑app.
 *
 * This script runs inside the Telegram WebApp environment. It handles user
 * interactions (clicking the collect button, buying upgrades, viewing the
 * leaderboard), communicates with the backend API to persist progress and
 * fetch leaderboard data, and can send a summary back to the bot when the
 * user chooses to exit.
 */

// Initialize Telegram WebApp interface
const tg = window.Telegram.WebApp;
tg.ready && tg.ready();
// Expand the web app to full height so the page feels native
tg.expand && tg.expand();

// Retrieve user information from Telegram initDataUnsafe
const initData = tg.initDataUnsafe || {};
const user = initData.user || {};
const userId = user.id ? user.id.toString() : null;
const firstName = user.first_name || "Explorer";

// DOM elements
const greetingElem = document.getElementById("greeting");
const stardustElem = document.getElementById("stardust");
const clickPowerElem = document.getElementById("click-power");
const autoMinersElem = document.getElementById("auto-miners");
const collectButton = document.getElementById("collect-button");
const upgradeClickButton = document.getElementById("upgrade-click");
const upgradeAutoButton = document.getElementById("upgrade-auto");
const upgradeClickCostElem = document.getElementById("upgrade-click-cost");
const upgradeAutoCostElem = document.getElementById("upgrade-auto-cost");
const leaderboardSection = document.getElementById("leaderboard");
const leaderboardList = document.getElementById("leaderboard-list");

// Game state
let stardust = 0;
let clickPower = 1;
let autoMiners = 0;
let upgradeClickCost = 50;
let upgradeAutoCost = 200;

// On load, personalise greeting and fetch existing data from backend
function init() {
  greetingElem.textContent = `Привет, ${firstName}!`;
  if (!userId) {
    // Without a user ID we can't persist progress or show leaderboard
    console.warn("No user ID available – data will not be saved.");
    return;
  }
  fetch(`/api/user/${userId}`)
    .then((resp) => resp.json())
    .then((data) => {
      stardust = data.stardust || 0;
      clickPower = data.upgrades?.click_power ?? 1;
      autoMiners = data.upgrades?.auto_miner ?? 0;
      updateDisplay();
    })
    .catch((err) => console.error("Failed to load user data", err));
}

// Update the DOM with the current state
function updateDisplay() {
  stardustElem.textContent = Math.floor(stardust);
  clickPowerElem.textContent = clickPower;
  autoMinersElem.textContent = autoMiners;
  upgradeClickCostElem.textContent = upgradeClickCost;
  upgradeAutoCostElem.textContent = upgradeAutoCost;
}

// Increment stardust when the player taps the collect button
function collectStardust() {
  stardust += clickPower;
  updateDisplay();
}

// Purchase an upgrade that increases click power
function buyClickUpgrade() {
  if (stardust >= upgradeClickCost) {
    stardust -= upgradeClickCost;
    clickPower += 1;
    upgradeClickCost = Math.floor(upgradeClickCost * 1.6);
    updateDisplay();
  } else {
    tg.showAlert && tg.showAlert("Недостаточно звёздной пыли для улучшения.");
  }
}

// Purchase an auto miner that generates stardust every second
function buyAutoMiner() {
  if (stardust >= upgradeAutoCost) {
    stardust -= upgradeAutoCost;
    autoMiners += 1;
    upgradeAutoCost = Math.floor(upgradeAutoCost * 1.7);
    updateDisplay();
  } else {
    tg.showAlert && tg.showAlert("Недостаточно звёздной пыли для покупки авто‑шахтёра.");
  }
}

// Auto generate stardust periodically based on auto miners
setInterval(() => {
  stardust += autoMiners;
  updateDisplay();
}, 1000);

// Persist the game state to the backend
function saveProgress(sendDataToBot = false) {
  if (!userId) return;
  const payload = {
    user_id: userId,
    stardust: Math.floor(stardust),
    upgrades: {
      click_power: clickPower,
      auto_miner: autoMiners,
    },
  };
  fetch("/api/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error("Failed to save data", err));
  if (sendDataToBot && tg.sendData) {
    tg.sendData(JSON.stringify(payload));
  }
}

// Show the leaderboard section
function showLeaderboard() {
  leaderboardSection.classList.remove("hidden");
  leaderboardList.innerHTML = "Loading...";
  fetch("/api/leaderboard")
    .then((resp) => resp.json())
    .then((data) => {
      leaderboardList.innerHTML = "";
      data.forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = `${entry.rank}. ${entry.user_id} — ${entry.stardust} пыли`;
        leaderboardList.appendChild(li);
      });
    })
    .catch((err) => {
      leaderboardList.textContent = "Не удалось загрузить таблицу лидеров.";
      console.error(err);
    });
}

// Record a booster purchase (mock – does not process payment)
function buyBooster() {
  if (!userId) return;
  // In a real app you would call Telegram.Payments to create an invoice for Stars
  // and handle the callback to credit the purchase. Here we simulate the effect.
  fetch("/api/purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, item: "booster" }),
  })
    .then(() => {
      // Increase click power for each booster purchase
      clickPower += 1;
      updateDisplay();
      tg.showAlert && tg.showAlert("Спасибо за покупку бустера! Ваша мощь клика увеличена.");
    })
    .catch((err) => console.error(err));
}

// Event listeners
collectButton.addEventListener("click", collectStardust);
upgradeClickButton.addEventListener("click", buyClickUpgrade);
upgradeAutoButton.addEventListener("click", buyAutoMiner);
document.getElementById("show-leaderboard").addEventListener("click", showLeaderboard);
document.getElementById("save-exit").addEventListener("click", () => {
  saveProgress(true);
  tg.showAlert && tg.showAlert("Прогресс сохранён, данные отправлены боту. Можете закрыть игру.");
});
document.getElementById("buy-booster").addEventListener("click", buyBooster);

// Initialise the game when the page loads
init();