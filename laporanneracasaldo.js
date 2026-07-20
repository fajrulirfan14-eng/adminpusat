// ── STATE MODUL NERACA SALDO (read-only, preview aja) ──
let lapnState = {
  cabangId: null,
  adminUid: null,
  bulan: new Date().getMonth(),
  tahun: new Date().getFullYear()
};

const LAPN_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// in-memory cache, hilang kalau reload halaman
let lapnCache = {}; // key: "cabangId-periode" -> { neracaData }
const LAPN_CACHE_KEY = (cabangId, periode) => `${cabangId}-${periode}`;

// ── ENTRY POINT (dipanggil laporan.js) ──
window.renderLaporanNeracaSaldo = async function (bodyEl, context) {
  if (!context.isCabang || !context.cabangData) {
    bodyEl.innerHTML = `
      <div class="lapn-placeholder-empty">
        <div class="lapn-empty-icon"><i class="fa-solid fa-building"></i></div>
        <div class="lapn-empty-title">Pilih Cabang Dulu</div>
        <div class="lapn-empty-sub">Neraca Saldo ini khusus per kantor cabang. Buka menu "Laporan Cabang" di kiri, lalu pilih salah satu cabang.</div>
      </div>
    `;
    return;
  }

  const cabangId = context.cabangData.id;

  if (lapnState.cabangId !== cabangId) {
    lapnState.cabangId = cabangId;
    lapnState.bulan = new Date().getMonth();
    lapnState.tahun = new Date().getFullYear();
    lapnState.adminUid = null;
  }

  bodyEl.innerHTML = renderLapnSkeleton();
  initLapnFilterUI();

  const emptyAdmin = document.getElementById("lapnEmptyAdmin");
  const content = document.getElementById("lapnContentWrap");

  if (!lapnState.adminUid) {
    lapnState.adminUid = await lapnResolveAdminUid(cabangId);
  }

  if (!lapnState.adminUid) {
    if (emptyAdmin) emptyAdmin.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  if (emptyAdmin) emptyAdmin.style.display = "none";
  if (content) content.style.display = "flex";

  await refreshLapnData();
};

// ── CARI UID ADMIN CABANG AKTIF ──
async function lapnResolveAdminUid(cabangId) {
  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", cabangId),
        window.where("role", "==", "adminCabang"),
        window.where("status", "==", true)
      )
    );
    return snap.empty ? null : snap.docs[0].id;
  } catch (e) {
    console.error("❌ lapnResolveAdminUid:", e);
    return null;
  }
}

// ── SKELETON HTML ──
function renderLapnSkeleton() {
  return `
    <div class="lapn-wrap">

      <div class="lapn-toolbar">
        <div class="lapn-filter-wrap">
          <button class="lapn-filter-btn" id="lapnBulanBtn">
            <i class="fa-solid fa-calendar"></i>
            <span id="lapnBulanLabel">${LAPN_BULAN_NAMA[lapnState.bulan]}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="lapn-dropdown" id="lapnBulanDropdown" style="display:none;"></div>

          <button class="lapn-filter-btn" id="lapnTahunBtn">
            <span id="lapnTahunLabel">${lapnState.tahun}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="lapn-dropdown" id="lapnTahunDropdown" style="display:none;"></div>

          <button class="lapn-filter-btn" id="lapnReloadBtn" title="Reload">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <div class="lapn-empty-admin" id="lapnEmptyAdmin" style="display:none;">
        <div class="lapn-empty-icon"><i class="fa-solid fa-user-slash"></i></div>
        <div class="lapn-empty-title">Admin Cabang Belum Ada</div>
        <div class="lapn-empty-sub">Cabang ini belum punya Admin Cabang aktif.</div>
      </div>

      <div class="lapn-content-wrap" id="lapnContentWrap" style="display:none;">

        <div class="lapn-kpi-grid" id="lapnKpiRow"></div>

        <div class="lapn-laba-card" id="lapnLabaCard">
          <div class="lapn-laba-label">Laba Berjalan</div>
          <div class="lapn-laba-value" id="lapnLabaBerjalan">Rp 0</div>
        </div>

        <div class="lapn-body-layout">
          <div class="lapn-col">
            <div class="lapn-card">
              <div class="lapn-card-title">Aset Lancar</div>
              <div class="lapn-preview-list" id="lapnListLancar"></div>
            </div>
            <div class="lapn-card">
              <div class="lapn-card-title">Aset Tetap</div>
              <div class="lapn-preview-list" id="lapnListTetap"></div>
            </div>
            <div class="lapn-total-row">
              <span>Total Kiri (Aset)</span>
              <span id="lapnTotalKiri">Rp 0</span>
            </div>
          </div>

          <div class="lapn-col">
            <div class="lapn-card">
              <div class="lapn-card-title">Liabilitas</div>
              <div class="lapn-preview-list" id="lapnListLiabilitas"></div>
            </div>
            <div class="lapn-card">
              <div class="lapn-card-title">Ekuitas</div>
              <div class="lapn-preview-list" id="lapnListEkuitas"></div>
            </div>
            <div class="lapn-total-row">
              <span>Total Kanan (Liabilitas + Ekuitas)</span>
              <span id="lapnTotalKanan">Rp 0</span>
            </div>
          </div>
        </div>

        <div class="lapn-updated-at" id="lapnUpdatedAt"></div>

      </div>
    </div>
  `;
}

// ── FILTER BULAN/TAHUN (portal ke body) ──
function initLapnFilterUI() {
  const bulanBtn = document.getElementById("lapnBulanBtn");
  const tahunBtn = document.getElementById("lapnTahunBtn");
  const bulanDD  = document.getElementById("lapnBulanDropdown");
  const tahunDD  = document.getElementById("lapnTahunDropdown");
  const reloadBtn = document.getElementById("lapnReloadBtn");
  if (!bulanBtn || !tahunBtn) return;

  document.body.appendChild(bulanDD);
  document.body.appendChild(tahunDD);

  bulanDD.innerHTML = LAPN_BULAN_NAMA.map((nama, i) => `
    <div class="lapn-dropdown-option ${i === lapnState.bulan ? "selected" : ""}" data-bulan="${i}">${nama}</div>
  `).join("");

  const nowYear = new Date().getFullYear();
  const tahunList = [nowYear - 1, nowYear, nowYear + 1];
  tahunDD.innerHTML = tahunList.map(y => `
    <div class="lapn-dropdown-option ${y === lapnState.tahun ? "selected" : ""}" data-tahun="${y}">${y}</div>
  `).join("");

  const positionDD = (btn, dd) => {
    const rect = btn.getBoundingClientRect();
    dd.style.position = "fixed";
    dd.style.top = `${rect.bottom + 6}px`;
    dd.style.left = `${rect.left}px`;
  };

  const closeAll = () => { bulanDD.style.display = "none"; tahunDD.style.display = "none"; };

  bulanBtn.onclick = (e) => {
    e.stopPropagation();
    const willOpen = bulanDD.style.display === "none";
    closeAll();
    if (willOpen) { positionDD(bulanBtn, bulanDD); bulanDD.style.display = "block"; }
  };
  tahunBtn.onclick = (e) => {
    e.stopPropagation();
    const willOpen = tahunDD.style.display === "none";
    closeAll();
    if (willOpen) { positionDD(tahunBtn, tahunDD); tahunDD.style.display = "block"; }
  };

  bulanDD.onclick = async (e) => {
    const opt = e.target.closest(".lapn-dropdown-option");
    if (!opt) return;
    lapnState.bulan = Number(opt.dataset.bulan);
    document.getElementById("lapnBulanLabel").textContent = LAPN_BULAN_NAMA[lapnState.bulan];
    bulanDD.querySelectorAll(".lapn-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshLapnData();
  };

  tahunDD.onclick = async (e) => {
    const opt = e.target.closest(".lapn-dropdown-option");
    if (!opt) return;
    lapnState.tahun = Number(opt.dataset.tahun);
    document.getElementById("lapnTahunLabel").textContent = lapnState.tahun;
    tahunDD.querySelectorAll(".lapn-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshLapnData();
  };

  document.addEventListener("click", closeAll);

  reloadBtn.onclick = async () => {
    reloadBtn.classList.add("spinning");
    await refreshLapnData(true);
    reloadBtn.classList.remove("spinning");
  };
}

// ── LOAD DATA ──
async function loadLapnNeracaData(adminUid, periode) {
  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "neracaSaldo", periode));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) {
    console.error("❌ loadLapnNeracaData:", e);
    return null;
  }
}

function lapnHitungTotal(list) {
  return (list || []).reduce((sum, item) => sum + (Number(item.nilai) || 0), 0);
}

function renderLapnPreviewList(list, elId) {
  const wrap = document.getElementById(elId);
  if (!wrap) return;

  if (!list || !list.length) {
    wrap.innerHTML = `<div class="lapn-preview-list-empty">Belum ada akun</div>`;
    return;
  }

  wrap.innerHTML = list.map(item => `
    <div class="lapn-preview-list-row">
      <span class="lapn-nama">${item.nama || "-"}</span>
      <span class="lapn-nilai">${item.nilai ? Number(item.nilai).toLocaleString("id-ID") : "-"}</span>
    </div>
  `).join("");
}

function renderLapnKpi(data) {
  const wrap = document.getElementById("lapnKpiRow");
  if (!wrap) return;

  const cards = [
    { label: "Aset Lancar", value: lapnHitungTotal(data?.asetLancar), cls: "lapn-kpi-brown" },
    { label: "Aset Tetap", value: lapnHitungTotal(data?.asetTetap), cls: "lapn-kpi-green" },
    { label: "Liabilitas", value: lapnHitungTotal(data?.liabilitas), cls: "lapn-kpi-red" },
    { label: "Ekuitas", value: lapnHitungTotal(data?.ekuitas), cls: "lapn-kpi-purple" }
  ];

  wrap.innerHTML = cards.map(c => `
    <div class="lapn-kpi-card ${c.cls}">
      <div class="lapn-kpi-label">${c.label}</div>
      <div class="lapn-kpi-value">Rp ${c.value.toLocaleString("id-ID")}</div>
    </div>
  `).join("");
}

function renderLapnBody(data) {
  const asetLancar = data?.asetLancar || [];
  const asetTetap = data?.asetTetap || [];
  const liabilitas = data?.liabilitas || [];
  const ekuitas = data?.ekuitas || [];
  const labaBerjalan = Number(data?.labaBerjalan) || 0;

  renderLapnPreviewList(asetLancar, "lapnListLancar");
  renderLapnPreviewList(asetTetap, "lapnListTetap");
  renderLapnPreviewList(liabilitas, "lapnListLiabilitas");
  renderLapnPreviewList(ekuitas, "lapnListEkuitas");

  const totalKiri = lapnHitungTotal(asetLancar) + lapnHitungTotal(asetTetap);
  const totalKanan = lapnHitungTotal(liabilitas) + lapnHitungTotal(ekuitas);

  const totalKiriEl = document.getElementById("lapnTotalKiri");
  const totalKananEl = document.getElementById("lapnTotalKanan");
  const labaEl = document.getElementById("lapnLabaBerjalan");

  if (totalKiriEl) totalKiriEl.textContent = `Rp ${totalKiri.toLocaleString("id-ID")}`;
  if (totalKananEl) totalKananEl.textContent = `Rp ${totalKanan.toLocaleString("id-ID")}`;
  if (labaEl) {
    labaEl.textContent = `Rp ${labaBerjalan.toLocaleString("id-ID")}`;
    labaEl.style.color = labaBerjalan < 0 ? "var(--danger)" : "var(--brand-primary)";
  }

  renderLapnKpi(data);
}

// ── REFRESH DATA (pakai cache, kecuali forceRefresh true) ──
async function refreshLapnData(forceRefresh = false) {
  const { adminUid, cabangId, bulan, tahun } = lapnState;
  if (!adminUid) return;

  const periode = `${tahun}-${String(bulan + 1).padStart(2, "0")}`;
  const cacheKey = LAPN_CACHE_KEY(cabangId, periode);
  const cached = lapnCache[cacheKey];

  let neracaData;

  if (cached && !forceRefresh) {
    neracaData = cached.neracaData;
  } else {
    neracaData = await loadLapnNeracaData(adminUid, periode);
    lapnCache[cacheKey] = { neracaData, ts: Date.now() };
  }

  const updatedAtEl = document.getElementById("lapnUpdatedAt");

  if (!neracaData) {
    renderLapnKpi(null);
    renderLapnBody(null);
    if (updatedAtEl) updatedAtEl.textContent = "Belum ada data neraca saldo untuk periode ini.";
    return;
  }

  renderLapnBody(neracaData);

  if (updatedAtEl) {
    if (neracaData.updatedAt) {
      const d = new Date(neracaData.updatedAt);
      updatedAtEl.textContent = `Terakhir diperbarui: ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      updatedAtEl.textContent = "";
    }
  }
}