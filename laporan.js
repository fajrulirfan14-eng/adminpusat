// ── DATA MENU TETAP (bukan dari Firestore, ini nav tetap) ──
const LAPORAN_LIST = [
  { id: "bahanbaku", judul: "Laporan Bahan Baku", icon: "fa-boxes-stacked", expandable: false },
  { id: "cabang", judul: "Laporan Cabang", icon: "fa-building", expandable: true },
];

let laporanActiveId = null;       // id item yang lagi dipilih (buka detail kanan)
let laporanExpandedId = null;     // id item yang lagi di-expand (misal "cabang")
let laporanCabangList = [];
let laporanCabangLoaded = false;

window.initLaporanView = function () {
  renderLaporanList();
  initLaporanTopbarBack();

  const backBtn = document.getElementById("topbarBackBtn");
  if (backBtn) backBtn.style.display = "flex";
};

function renderLaporanList() {
  const listEl = document.getElementById("lapList");
  if (!listEl) return;

  listEl.innerHTML = LAPORAN_LIST.map(item => `
    <div class="lap-group">
      <div class="lap-item ${!item.expandable && item.id === laporanActiveId ? "active" : ""} ${item.expandable && laporanExpandedId === item.id ? "expanded" : ""}" data-id="${item.id}" data-expandable="${item.expandable}">
        <div class="lap-item-icon"><i class="fa-solid ${item.icon}"></i></div>
        <div class="lap-item-judul">${item.judul}</div>
        <i class="fa-solid fa-chevron-${item.expandable ? "down" : "right"} lap-item-arrow"></i>
      </div>
      ${item.expandable && laporanExpandedId === item.id ? renderLaporanCabangSublist() : ""}
    </div>
  `).join("");

  listEl.querySelectorAll(".lap-item").forEach(el => {
    el.addEventListener("click", () => {
      const isExpandable = el.dataset.expandable === "true";
      if (isExpandable) {
        toggleLaporanExpand(el.dataset.id);
      } else {
        selectLaporan(el.dataset.id);
      }
    });
  });

  listEl.querySelectorAll(".lap-sub-item").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      selectLaporanCabang(el.dataset.id, el.dataset.nama);
    });
  });
}

// ── EXPAND/COLLAPSE "Laporan Cabang" -> nampilin list nama kantorCabang ──
async function toggleLaporanExpand(id) {
  if (laporanExpandedId === id) {
    laporanExpandedId = null;
    renderLaporanList();
    return;
  }

  laporanExpandedId = id;

  if (id === "cabang" && !laporanCabangLoaded) {
    renderLaporanList(); // render dulu biar muncul loading di sublist
    await loadLaporanCabangList();
  }

  renderLaporanList();
}

async function loadLaporanCabangList() {
  try {
    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    laporanCabangList = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.namaCabang || "").localeCompare(b.namaCabang || ""));
    laporanCabangLoaded = true;
  } catch (e) {
    console.error("❌ loadLaporanCabangList:", e);
    laporanCabangList = [];
  }
}

function renderLaporanCabangSublist() {
  if (!laporanCabangLoaded) {
    return `<div class="lap-sub-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;
  }
  if (!laporanCabangList.length) {
    return `<div class="lap-sub-loading">Belum ada cabang.</div>`;
  }
  return `
    <div class="lap-sublist">
      ${laporanCabangList.map(c => `
        <div class="lap-sub-item ${laporanActiveId === c.id ? "active" : ""}" data-id="${c.id}" data-nama="${c.namaCabang || "-"}">
          <span>${c.namaCabang || "-"}</span>
          <i class="fa-solid fa-chevron-right lap-sub-arrow"></i>
        </div>
      `).join("")}
    </div>
  `;
}

// ── SELECT: Laporan Bahan Baku (bypass tab, langsung tabel penuh) ──
function selectLaporan(id) {
  const item = LAPORAN_LIST.find(i => i.id === id);
  if (!item) return;

  laporanActiveId = id;
  renderLaporanList();
  openLaporanBahanBakuDetail(item.judul);
}

function openLaporanBahanBakuDetail(title) {
  const empty = document.getElementById("lapDetailEmpty");
  const content = document.getElementById("lapDetailContent");
  const tabs = document.getElementById("lapTabs");
  const wrapper = document.querySelector(".lap-detail-wrapper");

  const wasOpen = wrapper?.classList.contains("show");
  if (empty) empty.style.display = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");
  if (!wasOpen) window.pusatPushDetailState?.("laporan");

  document.getElementById("lapDetailTitle").textContent = title;
  if (tabs) tabs.style.display = "none"; // Bahan Baku gak pakai sistem tab

  const bodyEl = document.getElementById("lapDetailBody");
  if (typeof window.renderLaporanBahanBaku === "function") {
    window.renderLaporanBahanBaku(bodyEl);
  }
}

// ── SELECT: salah satu Cabang di dalam sublist ──
function selectLaporanCabang(cabangId, namaCabang) {
  laporanActiveId = cabangId;
  renderLaporanList();
  openLaporanDetail(`Laporan Cabang — ${namaCabang}`);
}

let laporanActiveTab = "rincian";

// ── BUKA PANEL DETAIL (khusus Cabang, dengan tabs) ──
function openLaporanDetail(title) {
  const empty = document.getElementById("lapDetailEmpty");
  const content = document.getElementById("lapDetailContent");
  const tabs = document.getElementById("lapTabs");
  const wrapper = document.querySelector(".lap-detail-wrapper");

  const wasOpen = wrapper?.classList.contains("show");
  if (empty) empty.style.display = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");
  if (!wasOpen) window.pusatPushDetailState?.("laporan");

  document.getElementById("lapDetailTitle").textContent = title;
  if (tabs) tabs.style.display = "flex"; // pastikan tabs balik muncul (mungkin disembunyikan pas buka Bahan Baku)

  laporanActiveTab = "rincian";
  initLaporanTabs();
  renderLaporanTabBody();
}

// ── TABS ──
function initLaporanTabs() {
  document.querySelectorAll(".lap-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === laporanActiveTab);
    tab.onclick = () => {
      laporanActiveTab = tab.dataset.tab;
      document.querySelectorAll(".lap-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === laporanActiveTab));
      renderLaporanTabBody();
    };
  });
}

// ── DELEGATOR: tiap tab punya render function sendiri di file terpisah ──
// laporanrincian.js     -> window.renderLaporanRincian(bodyEl, context)
// laporanaudit.js       -> window.renderLaporanAudit(bodyEl, context)
// laporanneracasaldo.js -> window.renderLaporanNeracaSaldo(bodyEl, context)
function renderLaporanTabBody() {
  const bodyEl = document.getElementById("lapDetailBody");
  if (!bodyEl) return;

  // context: info tentang laporan apa yang lagi dibuka (bahan baku atau cabang tertentu)
  const context = {
    activeId: laporanActiveId,
    isCabang: laporanExpandedId === "cabang" || (laporanCabangList.some(c => c.id === laporanActiveId)),
    cabangData: laporanCabangList.find(c => c.id === laporanActiveId) || null
  };

  const renderFns = {
    rincian: window.renderLaporanRincian,
    audit: window.renderLaporanAudit,
    neracasaldo: window.renderLaporanNeracaSaldo
  };

  const fn = renderFns[laporanActiveTab];
  if (typeof fn === "function") {
    fn(bodyEl, context);
  } else {
    bodyEl.innerHTML = `
      <div class="lap-body-empty">
        <div class="lap-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="lap-empty-title">Modul Belum Dimuat</div>
        <div class="lap-empty-sub">File JS untuk tab ini belum tersedia.</div>
      </div>
    `;
  }
}

// ── BACK TERPUSAT ──
function initLaporanTopbarBack() {
  if (window._laporanBackBtnBound) return;
  window._laporanBackBtnBound = true;

  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (window.innerWidth <= 768 && history.state?.pusatDetail === "laporan") {
      history.back();
      return;
    }
    if (history.state?.pusatView === "laporan") {
      history.back();
    }
  });
}
