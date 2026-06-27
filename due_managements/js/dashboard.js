import {
  db,
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from './firebase.js';

/* ==============================
   CACHE KEYS
============================== */
const CACHE_KEYS = {
  DASHBOARD: "dash_stats_cache",
  MONTHLY: "dash_monthly_cache",
  RECENT: "dash_recent_cache"
};

/* ==============================
   CHART INSTANCES
============================== */
let dueChart = null;
let collectionChart = null;

/* ==============================
   MAIN DASHBOARD (ULTRA FAST)
============================== */
export async function loadDashboard() {
  showLoading(true);

  try {
    // ⚡ STEP 1: LOAD FROM CACHE FIRST
    const cachedStats = getCache(CACHE_KEYS.DASHBOARD);

    let stats;

    if (cachedStats) {
      stats = cachedStats;
    } else {
      // ⚡ STEP 2: FIREBASE READ (ONLY IF CACHE MISS)
      const snap = await getDoc(doc(db, "stats", "dashboard"));

      stats = snap.exists()
        ? snap.data()
        : {
            totalCustomers: 0,
            totalDue: 0,
            totalCollections: 0,
            todayCollection: 0
          };

      setCache(CACHE_KEYS.DASHBOARD, stats);
    }

    // ⚡ FAST UI UPDATE
    setText("totalCustomers", stats.totalCustomers);
    setText("totalDue", formatMoney(stats.totalDue));
    setText("totalCollections", formatMoney(stats.totalCollections));
    setText("todayCollection", formatMoney(stats.todayCollection));

    // ⚡ PARALLEL LOAD (FAST EXECUTION)
    await Promise.all([
      loadRecentTransactions(),
      loadCharts()
    ]);

  } catch (err) {
    console.error(err);
    showToast("Dashboard load failed", "error");
  }

  showLoading(false);
}

/* ==============================
   RECENT TRANSACTIONS (CACHE + LIMIT)
============================== */
async function loadRecentTransactions() {
  const cached = getCache(CACHE_KEYS.RECENT);

  let data;

  if (cached) {
    data = cached;
  } else {
    const q = query(
      collection(db, "transactions"),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const snap = await getDocs(q);

    data = snap.docs.map(d => d.data());

    setCache(CACHE_KEYS.RECENT, data);
  }

  const tbody = document.getElementById("recentTransactions");
  if (!tbody) return;

  tbody.innerHTML = data.map(t => `
    <tr>
      <td>${t.date || "-"}</td>
      <td>${formatType(t.type)}</td>
      <td>${formatMoney(t.amount || 0)}</td>
    </tr>
  `).join("");
}

/* ==============================
   CHARTS (CACHE + MIN READ)
============================== */
async function loadCharts() {
  const cached = getCache(CACHE_KEYS.MONTHLY);

  let data;

  if (cached) {
    data = cached;
  } else {
    const snap = await getDoc(doc(db, "stats", "monthly"));
    data = snap.exists() ? snap.data() : {};
    setCache(CACHE_KEYS.MONTHLY, data);
  }

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const dueData = [];
  const collectionData = [];

  for (let i = 0; i < 12; i++) {
    dueData.push(data[i]?.due || 0);
    collectionData.push(data[i]?.collection || 0);
  }

  // destroy old charts
  if (dueChart) dueChart.destroy();
  if (collectionChart) collectionChart.destroy();

  const dueCtx = document.getElementById("dueChart");
  const collectionCtx = document.getElementById("collectionChart");

  if (dueCtx) {
    dueChart = new Chart(dueCtx.getContext("2d"), {
      type: "bar",
      data: {
        labels: months,
        datasets: [{
          label: "Due",
          data: dueData,
          backgroundColor: "#ef4444"
        }]
      }
    });
  }

  if (collectionCtx) {
    collectionChart = new Chart(collectionCtx.getContext("2d"), {
      type: "bar",
      data: {
        labels: months,
        datasets: [{
          label: "Collection",
          data: collectionData,
          backgroundColor: "#10b981"
        }]
      }
    });
  }
}

/* ==============================
   CACHE SYSTEM (LOCAL STORAGE)
============================== */
function setCache(key, data) {
  localStorage.setItem(key, JSON.stringify({
    data,
    time: Date.now()
  }));
}

function getCache(key, maxAge = 1000 * 60 * 5) { // 5 min cache
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);

    if (Date.now() - parsed.time > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

/* ==============================
   UTILS
============================== */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatMoney(v) {
  return "৳" + Number(v || 0).toFixed(2);
}

function formatType(t) {
  return t === "due" ? "Due Added" : "Collection";
}

function showLoading(show) {
  const el = document.getElementById("loadingOverlay");
  if (el) el.style.display = show ? "flex" : "none";
}

function showToast(msg, type = "success") {
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.innerHTML = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}