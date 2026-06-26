import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  updateDoc,
  addDoc,
  setDoc,
  serverTimestamp,
  deleteField,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── FIREBASE CONFIG ──
const firebaseConfig = {
  apiKey: "AIzaSyCp32H2WeN3A4ZwwWeUWe3Qcjqh0mz_vvQ",
  authDomain: "teh-tarik-nusantara-26371.firebaseapp.com",
  projectId: "teh-tarik-nusantara-26371",
  storageBucket: "teh-tarik-nusantara-26371.firebasestorage.app",
  messagingSenderId: "354760960352",
  appId: "1:354760960352:web:7d6a6c07dace937a74d605"
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

// ── GLOBALS ──
window.auth            = auth;
window.db              = db;
window.doc             = doc;
window.getDoc          = getDoc;
window.collection      = collection;
window.query           = query;
window.where           = where;
window.orderBy         = orderBy;
window.limit           = limit;
window.getDocs         = getDocs;
window.onSnapshot      = onSnapshot;
window.updateDoc       = updateDoc;
window.addDoc          = addDoc;
window.setDoc          = setDoc;
window.serverTimestamp = serverTimestamp;
window.deleteField     = deleteField;
window.deleteDoc       = deleteDoc;
window.storage         = storage;
window.storageRef      = storageRef;
window.uploadBytes     = uploadBytes;
window.getDownloadURL  = getDownloadURL;
window.deleteObject    = deleteObject;
window.currentUser     = null;
window.reauthenticateWithCredential = reauthenticateWithCredential;
window.EmailAuthProvider = EmailAuthProvider;
window.uploadBytesResumable = uploadBytesResumable;
// ── COMPRESS IMAGE ──
window.compressImage = function(blob, maxWidth = 1280, quality = 0.78) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(b => resolve(b), "image/jpeg", quality);
    };
    img.src = url;
  });
};
// ── UPLOAD WITH PROGRESS ──
window.uploadWithProgress = function(ref, blob, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const task = window.uploadBytesResumable(ref, blob, { contentType });
    task.on("state_changed",
      snap => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        if (onProgress) onProgress(pct);
      },
      err => reject(err),
      async () => {
        const url = await window.getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
};

// ── AUTH STATE ──
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        window.currentUser = { uid: user.uid, email: user.email, ...snap.data() };
        localStorage.setItem("userCache", JSON.stringify(window.currentUser));
      }
    } catch {
      const cache = localStorage.getItem("userCache");
      if (cache) {
        window.currentUser = JSON.parse(cache);
      } else {
        window.location.href = "login.html";
        return;
      }
    }
    initApp();
  } else {
    window.location.href = "login.html";
  }
});

// ── INIT APP ──
function initApp() {
  initSidebar();
  initTopbar();
  initPullToRefresh();

  // restore sidebar state
  const sidebarOpen = localStorage.getItem("sidebarOpen") === "true";
  if (sidebarOpen && window.innerWidth >= 769) {
    document.getElementById("sidebar")?.classList.add("open");
    document.getElementById("hamburger")?.classList.add("open");
  }

  const lastView = localStorage.getItem("lastView") || "home";
  showView(lastView);
  requestAnimationFrame(() => {
    document.getElementById("app").style.visibility = "visible";
  });
}
function initPullToRefresh() {
  let startY = 0;
  let pulling = false;
  let refreshing = false;
  let indicator = null;
  const threshold = 200;

  function getScroll() {
    return document.querySelector(".view.active .view-scroll");
  }

  function createIndicator() {
    const existing = document.getElementById("ptrIndicator");
    if (existing) return existing;
    const el = document.createElement("div");
    el.id = "ptrIndicator";
    el.style.cssText = `
      position: fixed;
      top: 0; left: 50%;
      transform: translateX(-50%) translateY(-60px);
      width: 40px; height: 40px;
      background: var(--brand-mid);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 16px;
      opacity: 0;
      z-index: 9999;
      will-change: transform, opacity;
    `;
    el.innerHTML = `<i class="fa-solid fa-rotate-right"></i>`;
    document.body.appendChild(el);
    return el;
  }

  document.addEventListener("touchstart", e => {
    if (refreshing) return;
    // Disable pull to refresh jika ada sheet/popup terbuka
    if (
      document.getElementById("akunSheet")?.classList.contains("show") ||
      document.getElementById("custSheet")?.classList.contains("show") ||
      document.getElementById("confirmOverlay")?.classList.contains("show") ||
      document.getElementById("warningOverlay")?.classList.contains("show") ||
      document.getElementById("petaGlobalOverlay")?.classList.contains("show")
    ) return;
    startY = e.touches[0].clientY;
    pulling = true;
    indicator = createIndicator();
    indicator.style.transition = "none";
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if (!pulling || refreshing) return;

    // Kalau ada map atau bottom sheet aktif, disable pull to refresh
    if (
      document.getElementById("cabangMapEl") ||
      document.getElementById("editLokasiMapEl") ||
      document.getElementById("akunSheet")?.classList.contains("show")
    ) { pulling = false; return; }

    // cek hanya elemen yang benar-benar bisa scroll
    let el = e.target;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const overflow = style.overflowY;
      const canScroll = (overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight;
      if (canScroll && el.scrollTop > 0) { pulling = false; return; }
      el = el.parentElement;
    }

    const dy = e.touches[0].clientY - startY;
    if (dy < 0) { pulling = false; return; }
    const pull = Math.min(dy * 0.4, 200);
    const opacity = Math.min(dy / threshold, 1);
    const rotate = dy * 1.5;
    indicator.style.opacity = opacity;
    indicator.style.transform = `translateX(-50%) translateY(${-60 + pull}px) rotate(${rotate}deg)`;
  }, { passive: true });

  document.addEventListener("touchend", e => {
    if (!pulling) return;
    pulling = false;
    const dy = e.changedTouches[0].clientY - startY;
    indicator.style.transition = "transform 0.35s ease, opacity 0.35s ease";
    if (dy >= threshold) {
      indicator.style.transform = `translateX(-50%) translateY(20px) rotate(720deg)`;
      indicator.style.opacity = "1";
      setTimeout(() => {
        indicator.style.opacity = "0";
        setTimeout(() => window.location.reload(), 200);
      }, 500);
    } else {
      indicator.style.opacity = "0";
      indicator.style.transform = `translateX(-50%) translateY(-60px)`;
    }
  }, { passive: true });
}

// ── SHOW VIEW ──
window.showView = function(viewName) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add("active");

  document.querySelectorAll(".nav-item, .bottom-nav-item").forEach(n => {
    n.classList.toggle("active", n.dataset.view === viewName);
  });

  localStorage.setItem("lastView", viewName);

  if (viewName === "home" && typeof window.initHomeView === "function" && !window._homeInited) {
    window._homeInited = true;
    window.initHomeView();
  }
  if (viewName === "cabang" && typeof window.initCabangView === "function" && !window._cabangInited) {
    window._cabangInited = true;
    window.initCabangView();
  }
  if (viewName === "akun" && typeof window.initAkunView === "function" && !window._akunInited) {
    window._akunInited = true;
    window.initAkunView();
  }
  // Sembunyikan reload btn sesuai view
  const reloadBtn = document.getElementById("topbarReload");
  if (reloadBtn) reloadBtn.style.display = (viewName === "customer" || viewName === "home") ? "flex" : "none";
  if (viewName === "customer" && typeof window.initCustomerView === "function" && !window._customerInited) {
    window._customerInited = true;
    window.initCustomerView();
  }

  const titles = {
    home:      "Dashboard",
    cabang:    "Cabang",
    laporan:   "Laporan",
    customer: "Customer",
    akun:      "Kelola Akun"
  };
  const topbarTitle = document.getElementById("topbarTitle");
  if (topbarTitle) topbarTitle.textContent = titles[viewName] || viewName;

  const isMobile = window.innerWidth <= 768;
  if (isMobile) closeSidebar();
};

// ── SIDEBAR ──
function initSidebar() {
  const hamburger      = document.getElementById("hamburger");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const sidebar        = document.getElementById("sidebar");

  hamburger?.addEventListener("click", toggleSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);

  document.querySelectorAll(".nav-item, .bottom-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      if (view) showView(view);
    });
  });

  // User info
  const user = window.currentUser;
  if (user) {
    const initial = (user.nama || user.email || "A")[0].toUpperCase();
    const topbarAvatar = document.getElementById("topbarAvatar");
    if (topbarAvatar) topbarAvatar.textContent = initial;
  }
}

function toggleSidebar() {
  const sidebar        = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const hamburger      = document.getElementById("hamburger");
  const isOpen = sidebar.classList.toggle("open");
  hamburger.classList.toggle("open", isOpen);
  sidebarOverlay.classList.toggle("show", isOpen);
  localStorage.setItem("sidebarOpen", isOpen);
}

function closeSidebar() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("hamburger")?.classList.remove("open");
    document.getElementById("sidebarOverlay")?.classList.remove("show");
  }
}

// ── TOPBAR ──
function initTopbar() {
  document.getElementById("topbarNotif")?.addEventListener("click", () => {
    alert("Notifikasi coming soon");
  });

  document.getElementById("topbarPeta")?.addEventListener("click", () => {
    window.openPetaGlobal();
  });

  document.getElementById("topbarReload")?.addEventListener("click", () => {
    const view = localStorage.getItem("lastView");
    if (view === "home" && typeof window.onHomeReload === "function") {
      window.onHomeReload();
    }
    if (view === "customer" && typeof window.onCustomerReload === "function") {
      window.onCustomerReload();
    }
  });
}
