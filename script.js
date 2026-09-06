// SUPABASE CLIENT (Optional initialization)
const SUPABASE_URL = "https://utmzjbdubwwiwqizxtsb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Jg9XTAkUQM8Hpc6iUbWVJw__kYPaBgY";
let supabase = null;
if (window.supabase && typeof window.supabase.createClient === "function") {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn("Supabase init bypassed:", e);
  }
}

let currentUser = null;

// PET DATA & ODDS
const PET_TABLE = [
  { name: "Common Slime", icon: "🟢", rarity: "COMMON", weight: 5000, color: "#a4b0be" },
  { name: "Loyal Pup", icon: "🐕", rarity: "UNCOMMON", weight: 2500, color: "#1dd1a1" },
  { name: "Ember Fox", icon: "🦊", rarity: "RARE", weight: 1200, color: "#54a0ff" },
  { name: "Thunder Falcon", icon: "🦅", rarity: "EPIC", weight: 400, color: "#5f27cd" },
  { name: "Golden Drake", icon: "🐉", rarity: "LEGENDARY", weight: 50, color: "#ff9f43" },
  { name: "Abyssal Leviathan", icon: "👾", rarity: "MYTHIC", weight: 5, color: "#ff6b6b" }
];

const ITEM_POOL = {
  easy: [
    { name: "Wood Charm", icon: "🪵", luckBoost: 0.1, sellPrice: 15 },
    { name: "Rusty Ring", icon: "💍", luckBoost: 0.2, sellPrice: 30 }
  ],
  medium: [
    { name: "Silver Amulet", icon: "🧿", luckBoost: 0.5, sellPrice: 80 },
    { name: "Lucky Clover", icon: "🍀", luckBoost: 0.8, sellPrice: 150 }
  ],
  hard: [
    { name: "Dragon Eye", icon: "🔮", luckBoost: 2.0, sellPrice: 500 },
    { name: "Crown of Riches", icon: "👑", luckBoost: 5.0, sellPrice: 1500 }
  ]
};

// INITIAL STATE
let state = {
  coins: 100,
  playerLevel: 1,
  activePet: null,
  equippedGear: null,
  inventory: [],
  isMissionRunning: false
};

// LOAD SAVED STATE
try {
  const localSave = localStorage.getItem("rng_pet_save");
  if (localSave) state = Object.assign(state, JSON.parse(localSave));
} catch (e) {
  console.warn("Local storage read error:", e);
}

function saveState() {
  try {
    localStorage.setItem("rng_pet_save", JSON.stringify(state));
  } catch (e) {}

  if (currentUser && supabase) {
    supabase.from("player_saves").upsert({
      user_id: currentUser.id,
      save_data: state,
      updated_at: new Date().toISOString()
    }).catch(err => console.warn(err));
  }
  render();
}

function getTotalLuck() {
  let base = 1.0;
  if (state.equippedGear) base += (state.equippedGear.luckBoost || 0);
  return parseFloat(base.toFixed(2));
}

// PET ROLLING
function rollPet() {
  const currentLuck = getTotalLuck();
  let totalWeight = 0;
  const weightedList = PET_TABLE.map(p => {
    let weight = p.weight;
    if (p.rarity !== "COMMON") weight *= currentLuck;
    totalWeight += weight;
    return { ...p, adjustedWeight: totalWeight };
  });

  const rand = Math.random() * totalWeight;
  const picked = weightedList.find(p => rand <= p.adjustedWeight) || PET_TABLE[0];

  state.activePet = picked;
  saveState();
}

// EXPEDITIONS
function startMission(seconds, tier) {
  if (state.isMissionRunning) return;
  if (!state.activePet) {
    alert("Hatch a pet first!");
    return;
  }

  state.isMissionRunning = true;
  const progressBar = document.getElementById("mission-progress-bar");
  const progressBox = document.getElementById("progress-container");
  const statusText = document.getElementById("mission-status-text");

  if (progressBox) progressBox.style.display = "block";
  if (statusText) {
    statusText.innerText = "Exploring...";
    statusText.style.color = "#00d2d3";
  }

  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 0.2;
    const pct = Math.min(100, (elapsed / seconds) * 100);
    if (progressBar) progressBar.style.width = `${pct}%`;

    if (elapsed >= seconds) {
      clearInterval(interval);
      completeMission(tier);
    }
  }, 200);
}

function completeMission(tier) {
  state.isMissionRunning = false;
  const progressBox = document.getElementById("progress-container");
  const statusText = document.getElementById("mission-status-text");

  if (progressBox) progressBox.style.display = "none";
  if (statusText) {
    statusText.innerText = "Idle";
    statusText.style.color = "#8395a7";
  }

  if (tier === "hard" && state.equippedGear && Math.random() < 0.05) {
    alert(`⚠️ Disaster! Your ${state.equippedGear.name} broke during the raid!`);
    state.equippedGear = null;
  }

  const possibleItems = ITEM_POOL[tier] || ITEM_POOL.easy;
  const rolledItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
  const itemInstance = { ...rolledItem, id: Date.now() };

  state.inventory.push(itemInstance);
  state.coins += 20;
  saveState();
}

// INVENTORY INTERACTIONS
window.equipItem = function(id) {
  const idx = state.inventory.findIndex(i => i.id === id);
  if (idx > -1) {
    const item = state.inventory[idx];
    if (state.equippedGear) state.inventory.push(state.equippedGear);
    state.equippedGear = item;
    state.inventory.splice(idx, 1);
    saveState();
  }
};

window.sellItem = function(id) {
  const idx = state.inventory.findIndex(i => i.id === id);
  if (idx > -1) {
    state.coins += state.inventory[idx].sellPrice;
    state.inventory.splice(idx, 1);
    saveState();
  }
};

window.unequipGear = function() {
  if (state.equippedGear) {
    state.inventory.push(state.equippedGear);
    state.equippedGear = null;
    saveState();
  }
};

// RENDER FUNCTION
function render() {
  const coinDisp = document.getElementById("coin-display");
  const luckDisp = document.getElementById("luck-display");
  const lvlDisp = document.getElementById("player-lvl");

  if (coinDisp) coinDisp.innerText = state.coins;
  if (luckDisp) luckDisp.innerText = `${getTotalLuck()}x`;
  if (lvlDisp) lvlDisp.innerText = state.playerLevel;

  const hatchScreen = document.getElementById("hatch-screen");
  const petScreen = document.getElementById("active-pet-screen");

  if (state.activePet) {
    if (hatchScreen) hatchScreen.style.display = "none";
    if (petScreen) petScreen.style.display = "block";
    const sprite = document.getElementById("pet-sprite");
    const pName = document.getElementById("pet-name");
    const badge = document.getElementById("pet-rarity");

    if (sprite) sprite.innerText = state.activePet.icon;
    if (pName) pName.innerText = state.activePet.name;
    if (badge) {
      badge.innerText = state.activePet.rarity;
      badge.style.background = state.activePet.color;
    }
  } else {
    if (hatchScreen) hatchScreen.style.display = "block";
    if (petScreen) petScreen.style.display = "none";
  }

  const gearSlot = document.getElementById("gear-slot-display");
  if (gearSlot) {
    if (state.equippedGear) {
      gearSlot.innerHTML = `
        <div>${state.equippedGear.icon} <strong>${state.equippedGear.name}</strong> (+${state.equippedGear.luckBoost}x Luck)</div>
        <button onclick="unequipGear()" class="btn small-btn">Unequip</button>
      `;
    } else {
      gearSlot.innerHTML = `<span class="slot-placeholder">Empty Gear Slot</span>`;
    }
  }

  const invGrid = document.getElementById("inventory-grid");
  if (invGrid) {
    invGrid.innerHTML = "";
    if (state.inventory.length === 0) {
      invGrid.innerHTML = `<p class="subtext" style="grid-column: span 2; text-align: center;">Bag is empty. Complete missions for loot!</p>`;
    }
    state.inventory.forEach(item => {
      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div>${item.icon} <strong>${item.name}</strong></div>
        <div class="subtext">+${item.luckBoost}x Luck</div>
        <div class="subtext">Value: ${item.sellPrice} 💰</div>
        <div class="item-actions">
          <button onclick="equipItem(${item.id})" class="btn" style="background: #10ac84; color: white;">Equip</button>
          <button onclick="sellItem(${item.id})" class="btn" style="background: #e1b12c; color: #000;">Sell</button>
        </div>
      `;
      invGrid.appendChild(card);
    });
  }
}

// SAFE EVENT ATTACHMENTS
document.addEventListener("DOMContentLoaded", () => {
  const rollBtn = document.getElementById("roll-btn");
  const eggBtn = document.getElementById("egg-btn");
  const rerollBtn = document.getElementById("re-roll-btn");

  if (rollBtn) rollBtn.addEventListener("click", rollPet);
  if (eggBtn) eggBtn.addEventListener("click", rollPet);

  if (rerollBtn) {
    rerollBtn.addEventListener("click", () => {
      if (state.coins >= 100) {
        state.coins -= 100;
        rollPet();
      } else {
        alert("Need 100 coins to reroll!");
      }
    });
  }

  document.querySelectorAll(".mission-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const time = parseInt(btn.dataset.time, 10);
      const tier = btn.dataset.tier;
      startMission(time, tier);
    });
  });

  // Modal handlers
  const authModal = document.getElementById("auth-modal");
  const openAuth = document.getElementById("open-auth-btn");
  const closeAuth = document.getElementById("close-modal-btn");
  const guestBtn = document.getElementById("guest-dismiss-btn");

  if (openAuth && authModal) openAuth.onclick = () => authModal.style.display = "flex";
  if (closeAuth && authModal) closeAuth.onclick = () => authModal.style.display = "none";
  if (guestBtn && authModal) guestBtn.onclick = () => authModal.style.display = "none";

  render();
});

// Fallback initial render
render();
