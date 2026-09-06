
// SUPABASE CLIENT
const SUPABASE_URL = "https://utmzjbdubwwiwqizxtsb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Jg9XTAkUQM8Hpc6iUbWVJw__kYPaBgY";
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null;

// PET DATA & TABLES
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

// INITIAL DEFAULT STATE
let state = {
  coins: 100,
  playerLevel: 1,
  activePet: null,
  equippedGear: null,
  inventory: [],
  isMissionRunning: false
};

// LOAD LOCAL SAVE INITIALLY
const localSave = localStorage.getItem("rng_pet_save");
if (localSave) state = Object.assign(state, JSON.parse(localSave));

// SYNC ENGINE
async function saveState() {
  localStorage.setItem("rng_pet_save", JSON.stringify(state));

  if (currentUser && supabase) {
    await supabase.from("player_saves").upsert({
      user_id: currentUser.id,
      save_data: state,
      updated_at: new Date().toISOString()
    });
  }
  render();
}

async function loadCloudSave(userId) {
  if (!supabase) return;
  const { data } = await supabase
    .from("player_saves")
    .select("save_data")
    .eq("user_id", userId)
    .single();

  if (data && data.save_data) {
    state = Object.assign(state, data.save_data);
  } else {
    await saveState();
  }
  render();
}

function getTotalLuck() {
  let base = 1.0;
  if (state.equippedGear) base += state.equippedGear.luckBoost;
  return parseFloat(base.toFixed(2));
}

// PET HATCHING
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

  progressBox.style.display = "block";
  statusText.innerText = "Exploring...";
  statusText.style.color = "#00d2d3";

  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 0.2;
    const pct = Math.min(100, (elapsed / seconds) * 100);
    progressBar.style.width = `${pct}%`;

    if (elapsed >= seconds) {
      clearInterval(interval);
      completeMission(tier);
    }
  }, 200);
}

function completeMission(tier) {
  state.isMissionRunning = false;
  document.getElementById("progress-container").style.display = "none";
  document.getElementById("mission-status-text").innerText = "Idle";
  document.getElementById("mission-status-text").style.color = "#8395a7";

  if (tier === "hard" && state.equippedGear && Math.random() < 0.05) {
    alert(`⚠️ Disaster! Your ${state.equippedGear.name} was broken during the raid!`);
    state.equippedGear = null;
  }

  const possibleItems = ITEM_POOL[tier];
  const rolledItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];
  const itemInstance = { ...rolledItem, id: Date.now() };

  state.inventory.push(itemInstance);
  state.coins += 20;
  saveState();
}

// INVENTORY HANDLERS
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

// UI RENDER
function render() {
  document.getElementById("coin-display").innerText = state.coins;
  document.getElementById("luck-display").innerText = `${getTotalLuck()}x`;
  document.getElementById("player-lvl").innerText = state.playerLevel;

  const hatchScreen = document.getElementById("hatch-screen");
  const petScreen = document.getElementById("active-pet-screen");

  if (state.activePet) {
    hatchScreen.style.display = "none";
    petScreen.style.display = "block";
    document.getElementById("pet-sprite").innerText = state.activePet.icon;
    document.getElementById("pet-name").innerText = state.activePet.name;
    const badge = document.getElementById("pet-rarity");
    badge.innerText = state.activePet.rarity;
    badge.style.background = state.activePet.color;
  } else {
    hatchScreen.style.display = "block";
    petScreen.style.display = "none";
  }

  const gearSlot = document.getElementById("gear-slot-display");
  if (state.equippedGear) {
    gearSlot.innerHTML = `
      <div>${state.equippedGear.icon} <strong>${state.equippedGear.name}</strong> (+${state.equippedGear.luckBoost}x Luck)</div>
      <button onclick="unequipGear()" class="btn small-btn">Unequip</button>
    `;
  } else {
    gearSlot.innerHTML = `<span class="slot-placeholder">Empty Gear Slot</span>`;
  }

  const invGrid = document.getElementById("inventory-grid");
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

// EVENT LISTENERS
document.getElementById("roll-btn").addEventListener("click", rollPet);
document.getElementById("egg-btn").addEventListener("click", rollPet);

document.getElementById("re-roll-btn").addEventListener("click", () => {
  if (state.coins >= 100) {
    state.coins -= 100;
    rollPet();
  } else {
    alert("Need 100 coins to reroll!");
  }
});

document.querySelectorAll(".mission-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const time = parseInt(btn.dataset.time);
    const tier = btn.dataset.tier;
    startMission(time, tier);
  });
});

// AUTH SYSTEM
let isSignUpMode = false;
const authModal = document.getElementById("auth-modal");
const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const submitBtn = document.getElementById("auth-submit-btn");
const authMsg = document.getElementById("auth-msg");

tabLogin.onclick = () => {
  isSignUpMode = false;
  tabLogin.classList.add("active");
  tabSignup.classList.remove("active");
  submitBtn.innerText = "Log In";
};

tabSignup.onclick = () => {
  isSignUpMode = true;
  tabSignup.classList.add("active");
  tabLogin.classList.remove("active");
  submitBtn.innerText = "Sign Up";
};

document.getElementById("open-auth-btn").onclick = async () => {
  if (currentUser && supabase) {
    await supabase.auth.signOut();
    location.reload();
  } else {
    authModal.style.display = "flex";
  }
};

document.getElementById("close-modal-btn").onclick = () => authModal.style.display = "none";
document.getElementById("guest-dismiss-btn").onclick = () => authModal.style.display = "none";

submitBtn.onclick = async () => {
  if (!supabase) return;
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value.trim();

  if (!email || !password) {
    authMsg.innerText = "Please provide both email and password.";
    return;
  }

  authMsg.innerText = "Processing...";

  if (isSignUpMode) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) authMsg.innerText = error.message;
    else authMsg.innerText = "Verification sent! Check your email.";
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) authMsg.innerText = error.message;
    else authModal.style.display = "none";
  }
};

if (supabase) {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
      currentUser = session.user;
      document.getElementById("account-status").innerHTML = `Logged in as <strong>${session.user.email}</strong>`;
      document.getElementById("open-auth-btn").innerText = "Log Out";
      authModal.style.display = "none";
      await loadCloudSave(currentUser.id);
    } else {
      currentUser = null;
      document.getElementById("account-status").innerHTML = `Playing as <strong>Guest</strong> (Local Only)`;
      document.getElementById("open-auth-btn").innerText = "Log In / Sync";
    }
  });
}

render();
