// ── STATE MODUL LAPORAN BAHAN BAKU (lintas cabang) ──
let lapbState = {
  bulan: new Date().getMonth(),
  tahun: new Date().getFullYear(),
  sortMode: "tanggal", // "tanggal" | "cabang"
  filterStatus: null   // null | "belumTerima" | "sudahTerima" | "lunas" | "kurang"
};

const LAPB_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

const LAPB_FILTER_OPTIONS = [
  { key: "belumTerima", label: "Belum Diterima" },
  { key: "sudahTerima", label: "Sudah Diterima" },
  { key: "lunas", label: "Lunas" },
  { key: "kurang", label: "Kurang" }
];

// in-memory cache
let lapbCache = {};            // key: periode -> array transaksi gabungan
let lapbAdminUidCache = {};    // key: cabangId -> adminUid (stabil, gak perlu refetch tiap bulan)
let lapbCabangListCache = null; // daftar kantorCabang (id + nama), stabil

// ── TOAST & MODAL MANDIRI ──
function lapbShowToast(message, type = "success") {
  document.getElementById("lapbToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "lapbToast";
  toast.className = `lapb-toast lapb-toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function lapbShowModal({ title = "Perhatian", message = "", icon = "fa-triangle-exclamation", confirmText = "Oke", showCancel = false, onConfirm = null }) {
  document.getElementById("lapbModalContainer")?.remove();
  const container = document.createElement("div");
  container.id = "lapbModalContainer";
  document.body.appendChild(container);
  container.innerHTML = `
    <div class="lapb-modal-overlay" id="lapbModalOverlay">
      <div class="lapb-modal-box">
        <div class="lapb-modal-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="lapb-modal-title">${title}</div>
        <div class="lapb-modal-message">${message}</div>
        <div class="lapb-modal-actions">
          ${showCancel ? `<button class="lapb-modal-btn-cancel" id="lapbModalCancel">Batal</button>` : ""}
          <button class="lapb-modal-btn-ok" id="lapbModalOk">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => document.getElementById("lapbModalOverlay").classList.add("show"));
  const closeModal = () => {
    document.getElementById("lapbModalOverlay")?.classList.remove("show");
    setTimeout(() => container.remove(), 200);
  };
  document.getElementById("lapbModalOk").addEventListener("click", () => { closeModal(); onConfirm?.(); });
  document.getElementById("lapbModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("lapbModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "lapbModalOverlay") closeModal();
  });
}

function fmtRupiahLapb(n) { return "Rp" + Number(n || 0).toLocaleString("id-ID"); }
function fmtAngkaLapb(n) { return Number(n || 0).toLocaleString("id-ID"); }
function lapbFmtTanggal(str) {
  if (!str) return "-";
  const d = new Date(str);
  const formatted = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

window.lapbLoadCabangList = lapbLoadCabangList;
window.lapbResolveAdminUid = lapbResolveAdminUid;
window.lapbLoadAllData = lapbLoadAllData;
window.lapbGetCacheForPeriode = function (periode) {
  return lapbCache[periode] || null;
};

// ── ENTRY POINT (dipanggil laporan.js) ──
window.renderLaporanBahanBaku = async function (bodyEl) {
  bodyEl.innerHTML = renderLapbSkeleton();
  initLapbFilterUI();
  await refreshLapbData();
};

// ── SKELETON ──
function renderLapbSkeleton() {
  return `
    <div class="lapb-wrap">

      <div class="lapb-kpi-grid" id="lapbKpiGrid"></div>

      <div class="lapb-toolbar">
        <div class="lapb-filter-group">
          <button class="lapb-filter-btn" id="lapbBulanBtn">
            <i class="fa-solid fa-calendar"></i>
            <span id="lapbBulanLabel">${LAPB_BULAN_NAMA[lapbState.bulan]}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="lapb-dropdown" id="lapbBulanDropdown" style="display:none;"></div>

          <button class="lapb-filter-btn" id="lapbTahunBtn">
            <span id="lapbTahunLabel">${lapbState.tahun}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="lapb-dropdown" id="lapbTahunDropdown" style="display:none;"></div>

          <button class="lapb-filter-btn" id="lapbSortBtn">
            <i class="fa-solid fa-arrow-down-wide-short"></i>
            <span id="lapbSortLabel">Urutan: Tanggal</span>
          </button>

          <div class="lapb-filter-status-wrap">
            <button class="lapb-filter-status-btn" id="lapbFilterStatusBtn">
              <i class="fa-solid fa-filter"></i>
              <span id="lapbFilterStatusLabel">Filter Status</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="lapb-filter-status-menu" id="lapbFilterStatusMenu" style="display:none;"></div>
          </div>

          <button class="lapb-filter-btn" id="lapbReloadBtn" title="Reload">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <div class="lapb-table-wrap">
        <table class="lapb-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Cabang</th>
              <th>Jenis Paket</th>
              <th>Qty</th>
              <th>Harga Paket</th>
              <th>Total Pembayaran</th>
              <th>Dibayar</th>
              <th>Status</th>
              <th>Sisa Pembayaran</th>
            </tr>
          </thead>
          <tbody id="lapbTableBody">
            <tr><td colspan="9" class="lapb-loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</td></tr>
          </tbody>
        </table>
      </div>

    </div>
  `;
}

// ── FILTER UI ──
function initLapbFilterUI() {
  const bulanBtn = document.getElementById("lapbBulanBtn");
  const tahunBtn = document.getElementById("lapbTahunBtn");
  const bulanDD  = document.getElementById("lapbBulanDropdown");
  const tahunDD  = document.getElementById("lapbTahunDropdown");
  const sortBtn  = document.getElementById("lapbSortBtn");
  const reloadBtn = document.getElementById("lapbReloadBtn");
  const filterStatusBtn = document.getElementById("lapbFilterStatusBtn");
  const filterStatusMenu = document.getElementById("lapbFilterStatusMenu");

  document.body.appendChild(bulanDD);
  document.body.appendChild(tahunDD);
  document.body.appendChild(filterStatusMenu);

  bulanDD.innerHTML = LAPB_BULAN_NAMA.map((nama, i) => `
    <div class="lapb-dropdown-option ${i === lapbState.bulan ? "selected" : ""}" data-bulan="${i}">${nama}</div>
  `).join("");

  const nowYear = new Date().getFullYear();
  tahunDD.innerHTML = [nowYear - 1, nowYear, nowYear + 1].map(y => `
    <div class="lapb-dropdown-option ${y === lapbState.tahun ? "selected" : ""}" data-tahun="${y}">${y}</div>
  `).join("");

  filterStatusMenu.innerHTML = `
    <div class="lapb-filter-status-option ${!lapbState.filterStatus ? "selected" : ""}" data-key="">
      <i class="fa-solid fa-list"></i> Semua
    </div>
    ${LAPB_FILTER_OPTIONS.map(o => `
      <div class="lapb-filter-status-option ${lapbState.filterStatus === o.key ? "selected" : ""}" data-key="${o.key}">
        <i class="fa-solid fa-circle-check"></i> ${o.label}
      </div>
    `).join("")}
  `;

  const positionDD = (btn, dd) => {
    const rect = btn.getBoundingClientRect();
    dd.style.position = "fixed";
    dd.style.top = `${rect.bottom + 6}px`;
    dd.style.left = `${rect.left}px`;
  };

  const closeAll = () => { bulanDD.style.display = "none"; tahunDD.style.display = "none"; filterStatusMenu.style.display = "none"; };

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
  filterStatusBtn.onclick = (e) => {
    e.stopPropagation();
    const willOpen = filterStatusMenu.style.display === "none";
    closeAll();
    if (willOpen) { positionDD(filterStatusBtn, filterStatusMenu); filterStatusMenu.style.display = "block"; }
  };

  bulanDD.onclick = async (e) => {
    const opt = e.target.closest(".lapb-dropdown-option");
    if (!opt) return;
    lapbState.bulan = Number(opt.dataset.bulan);
    document.getElementById("lapbBulanLabel").textContent = LAPB_BULAN_NAMA[lapbState.bulan];
    bulanDD.querySelectorAll(".lapb-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshLapbData();
  };

  tahunDD.onclick = async (e) => {
    const opt = e.target.closest(".lapb-dropdown-option");
    if (!opt) return;
    lapbState.tahun = Number(opt.dataset.tahun);
    document.getElementById("lapbTahunLabel").textContent = lapbState.tahun;
    tahunDD.querySelectorAll(".lapb-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshLapbData();
  };

  filterStatusMenu.onclick = (e) => {
    const opt = e.target.closest(".lapb-filter-status-option");
    if (!opt) return;
    lapbState.filterStatus = opt.dataset.key || null;
    document.getElementById("lapbFilterStatusLabel").textContent = lapbState.filterStatus
      ? LAPB_FILTER_OPTIONS.find(o => o.key === lapbState.filterStatus)?.label
      : "Filter Status";
    filterStatusMenu.querySelectorAll(".lapb-filter-status-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    renderLapbTableFromState();
  };

  document.addEventListener("click", closeAll);

  sortBtn.onclick = () => {
    lapbState.sortMode = lapbState.sortMode === "tanggal" ? "cabang" : "tanggal";
    document.getElementById("lapbSortLabel").textContent = `Urutan: ${lapbState.sortMode === "tanggal" ? "Tanggal" : "Cabang"}`;
    renderLapbTableFromState();
  };

  reloadBtn.onclick = async () => {
    reloadBtn.classList.add("spinning");
    await refreshLapbData(true);
    reloadBtn.classList.remove("spinning");
  };
}

// ── RESOLVE ADMIN UID PER CABANG (di-cache, stabil antar bulan) ──
async function lapbResolveAdminUid(cabangId) {
  if (lapbAdminUidCache[cabangId] !== undefined) return lapbAdminUidCache[cabangId];
  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", cabangId),
        window.where("role", "==", "adminCabang"),
        window.where("status", "==", true)
      )
    );
    const uid = snap.empty ? null : snap.docs[0].id;
    lapbAdminUidCache[cabangId] = uid;
    return uid;
  } catch (e) {
    console.error("❌ lapbResolveAdminUid:", e);
    return null;
  }
}

async function lapbLoadCabangList() {
  if (lapbCabangListCache) return lapbCabangListCache;
  try {
    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    lapbCabangListCache = snap.docs.map(d => ({ id: d.id, nama: d.data().namaCabang || "-" }));
    return lapbCabangListCache;
  } catch (e) {
    console.error("❌ lapbLoadCabangList:", e);
    return [];
  }
}

// ── LOAD DATA LINTAS CABANG ──
async function lapbLoadAllData(periode) {
  const cabangList = await lapbLoadCabangList();
  const allTrx = [];

  await Promise.all(cabangList.map(async (cabang) => {
    const adminUid = await lapbResolveAdminUid(cabang.id);
    if (!adminUid) return;

    try {
      const snap = await window.getDocs(
        window.query(
          window.collection(window.db, "users", adminUid, "pembelianBahanBaku"),
          window.where("periode", "==", periode)
        )
      );
      snap.forEach(d => {
        allTrx.push({ id: d.id, ...d.data(), cabangId: cabang.id, namaCabang: cabang.nama });
      });
    } catch (e) {
      console.error(`❌ lapbLoadAllData (${cabang.nama}):`, e);
    }
  }));

  return allTrx;
}

// ── FILTER MATCH (sama pola kayak PBB) ──
function lapbFilterMatch(t, filterKey) {
  const riwayat = t.riwayatBayar || [];
  switch (filterKey) {
    case "belumTerima": return riwayat.some(c => !c.diterima);
    case "sudahTerima": return riwayat.length > 0 && riwayat.every(c => c.diterima);
    case "lunas": return t.status === "lunas";
    case "kurang": return t.status === "kurang";
    default: return true;
  }
}

// ── RENDER KPI ──
function renderLapbKpi(data) {
  const wrap = document.getElementById("lapbKpiGrid");
  if (!wrap) return;

  const totalBeli = data.reduce((s, t) => s + (t.totalHarga || 0), 0);
  const totalBayar = data.reduce((s, t) => s + (t.dibayar || 0), 0);
  const totalSisa = data.reduce((s, t) => s + (t.sisa < 0 ? Math.abs(t.sisa) : 0), 0);
  const belumLunas = data.filter(t => t.status === "kurang").length;

  const jenisMap = {};
  data.forEach(t => {
    const jenis = t.jenisPaket || "-";
    if (!jenisMap[jenis]) jenisMap[jenis] = { qty: 0, total: 0 };
    jenisMap[jenis].qty += (t.qty || 0);
    jenisMap[jenis].total += (t.totalHarga || 0);
  });
  const jenisBreakdown = Object.keys(jenisMap)
    .sort((a, b) => jenisMap[b].total - jenisMap[a].total)
    .map(jenis => ({ jenis, ...jenisMap[jenis] }));

  wrap.innerHTML = `
    <div class="lapb-kpi-card lapb-kpi-brown">
      <div class="lapb-kpi-label">Total Pembelian</div>
      <div class="lapb-kpi-value">${fmtRupiahLapb(totalBeli)}</div>
      ${jenisBreakdown.length ? `
        <div class="lapb-kpi-breakdown">
          ${jenisBreakdown.map(j => `
            <div class="lapb-kpi-breakdown-row">
              <span class="lapb-kpi-breakdown-jenis">${j.jenis} <span class="lapb-kpi-breakdown-qty">${j.qty}</span></span>
              <span class="lapb-kpi-breakdown-total">${fmtRupiahLapb(j.total)}</span>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
    <div class="lapb-kpi-card lapb-kpi-green">
      <div class="lapb-kpi-label">Sudah Dibayar</div>
      <div class="lapb-kpi-value">${fmtRupiahLapb(totalBayar)}</div>
    </div>
    <div class="lapb-kpi-card lapb-kpi-red">
      <div class="lapb-kpi-label">Sisa Tagihan</div>
      <div class="lapb-kpi-value">${fmtRupiahLapb(totalSisa)}</div>
    </div>
    <div class="lapb-kpi-card lapb-kpi-purple">
      <div class="lapb-kpi-label">Belum Lunas</div>
      <div class="lapb-kpi-value">${belumLunas} Transaksi</div>
    </div>
  `;
}

// ── RENDER TABEL ──
function lapbStatusLabel(t) {
  const s = t.status || "kurang";
  return s === "lunas" ? "Lunas" : (s === "lebih" ? "Lebih Bayar" : "Kurang");
}

function renderLapbTable(data) {
  const tbody = document.getElementById("lapbTableBody");
  if (!tbody) return;

  let filtered = lapbState.filterStatus ? data.filter(t => lapbFilterMatch(t, lapbState.filterStatus)) : data;

  if (lapbState.sortMode === "cabang") {
    filtered = filtered.slice().sort((a, b) => {
      const namaCmp = (a.namaCabang || "").localeCompare(b.namaCabang || "");
      if (namaCmp !== 0) return namaCmp;
      return new Date(b.tanggal) - new Date(a.tanggal);
    });
  } else {
    filtered = filtered.slice().sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="lapb-empty-row">Tidak ada data pembelian bahan baku.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => `
    <tr class="lapb-table-row" data-cabang-id="${t.cabangId}" data-nama-cabang="${t.namaCabang}">
      <td>${lapbFmtTanggal(t.tanggal)}</td>
      <td>${t.namaCabang || "-"}</td>
      <td>${t.jenisPaket || "-"}</td>
      <td>${t.qty || 0}</td>
      <td>${fmtAngkaLapb(t.hargaPerPaket)}</td>
      <td>${fmtAngkaLapb(t.totalHarga)}</td>
      <td>${fmtAngkaLapb(t.dibayar)}</td>
      <td><span class="lapb-status-badge ${t.status || "kurang"}">${lapbStatusLabel(t)}</span></td>
      <td class="${t.sisa < 0 ? "neg" : (t.sisa > 0 ? "pos" : "zero")}">${fmtAngkaLapb(Math.abs(t.sisa || 0))}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".lapb-table-row").forEach(row => {
    row.addEventListener("click", () => {
      const cabangId = row.dataset.cabangId;
      const namaCabang = row.dataset.namaCabang;
      lapbShowModal({
        title: "Buka Cabang?",
        message: `Lihat detail pembelian bahan baku untuk cabang "${namaCabang}"?`,
        icon: "fa-truck-fast",
        confirmText: "Buka",
        showCancel: true,
        onConfirm: () => window.pbbGotoCabang?.(cabangId)
      });
    });
  });
}

let lapbCurrentData = [];
function renderLapbTableFromState() {
  renderLapbKpi(
    lapbState.filterStatus ? lapbCurrentData.filter(t => lapbFilterMatch(t, lapbState.filterStatus)) : lapbCurrentData
  );
  renderLapbTable(lapbCurrentData);
}

// ── REFRESH DATA (cache per periode) ──
async function refreshLapbData(forceRefresh = false) {
  const periode = `${lapbState.tahun}-${String(lapbState.bulan + 1).padStart(2, "0")}`;

  if (lapbCache[periode] && !forceRefresh) {
    lapbCurrentData = lapbCache[periode];
  } else {
    const tbody = document.getElementById("lapbTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="lapb-loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</td></tr>`;

    lapbCurrentData = await lapbLoadAllData(periode);
    lapbCache[periode] = lapbCurrentData;
  }

  renderLapbTableFromState();
}