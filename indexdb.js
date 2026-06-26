// ── PUSAT DB ──
const DB_NAME      = "pusatDB";
const DB_VERSION   = 3;
const STORE_CUST   = "cust";
const STORE_USERS  = "users";
const STORE_CABANG = "cabang";

function openPusatDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CUST)) {
        db.createObjectStore(STORE_CUST, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_USERS)) {
        db.createObjectStore(STORE_USERS, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_CABANG)) {
        db.createObjectStore(STORE_CABANG, { keyPath: "key" });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// ── GET ──
window.idbGetCust = async function(kurirId, hari) {
  try {
    const db  = await openPusatDB();
    const key = `${kurirId}_${hari}`;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_CUST, "readonly");
      const req = tx.objectStore(STORE_CUST).get(key);
      req.onsuccess = e => resolve(e.target.result?.data || null);
      req.onerror   = e => reject(e.target.error);
    });
  } catch(e) {
    console.error("idbGetCust:", e);
    return null;
  }
};

// ── SET ──
window.idbSetCust = async function(kurirId, hari, data) {
  try {
    const db  = await openPusatDB();
    const key = `${kurirId}_${hari}`;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_CUST, "readwrite");
      const req = tx.objectStore(STORE_CUST).put({ key, data });
      req.onsuccess = () => resolve(true);
      req.onerror   = e => reject(e.target.error);
    });
  } catch(e) {
    console.error("idbSetCust:", e);
    return false;
  }
};

// ── DELETE ──
window.idbDeleteCust = async function(kurirId, hari) {
  try {
    const db  = await openPusatDB();
    const key = `${kurirId}_${hari}`;
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_CUST, "readwrite");
      const req = tx.objectStore(STORE_CUST).delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror   = e => reject(e.target.error);
    });
  } catch(e) {
    console.error("idbDeleteCust:", e);
    return false;
  }
};

// ── GET ALL USERS ──
window.idbGetUsers = async function() {
  try {
    const db = await openPusatDB();
    if (!db.objectStoreNames.contains(STORE_USERS)) return null;
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE_USERS, "readonly");
      const req = tx.objectStore(STORE_USERS).get("all");
      req.onsuccess = e => resolve(e.target.result?.data || null);
      req.onerror   = () => resolve(null);
    });
  } catch(e) {
    console.error("idbGetUsers:", e);
    return null;
  }
};

// ── SET ALL USERS ──
window.idbSetUsers = async function(data) {
  try {
    const db = await openPusatDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_USERS, "readwrite");
      const req = tx.objectStore(STORE_USERS).put({ key: "all", data });
      req.onsuccess = () => resolve(true);
      req.onerror   = e => reject(e.target.error);
    });
  } catch(e) {
    console.error("idbSetUsers:", e);
    return false;
  }
};

// ── GET ALL CABANG ──
window.idbGetCabang = async function() {
  try {
    const db = await openPusatDB();
    if (!db.objectStoreNames.contains(STORE_CABANG)) return null;
    return new Promise((resolve) => {
      const tx  = db.transaction(STORE_CABANG, "readonly");
      const req = tx.objectStore(STORE_CABANG).get("all");
      req.onsuccess = e => resolve(e.target.result?.data || null);
      req.onerror   = () => resolve(null);
    });
  } catch(e) {
    console.error("idbGetCabang:", e);
    return null;
  }
};

// ── SET ALL CABANG ──
window.idbSetCabang = async function(data) {
  try {
    const db = await openPusatDB();
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_CABANG, "readwrite");
      const req = tx.objectStore(STORE_CABANG).put({ key: "all", data });
      req.onsuccess = () => resolve(true);
      req.onerror   = e => {
      console.error("openPusatDB error:", e.target.error);
      reject(e.target.error);
    };
    });
  } catch(e) {
    console.error("idbSetCabang:", e);
    return false;
  }
};