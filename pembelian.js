
// ── PEMBELIAN BAHAN BAKU (ADMIN PUSAT) ──
let pbbCabangData = [];
let pbbActiveCabangId = null;
let pbbActiveCabang = null;
let pbbActiveAdminUid = null; // uid adminCabang aktif -> path nulis data

// ── CEK ADMIN CABANG AKTIF (sama pola kayak akun.js) ──
async function pbbGetActiveAdminCabang(cabangId) {
  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", cabangId),
        window.where("role", "==", "adminCabang"),
        window.where("status", "==", true)
      )
    );
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (e) {
    console.error("❌ pbbGetActiveAdminCabang:", e);
    return null;
  }
}

// ── LOAD LIST CABANG ── (reuse pattern loadCabangList, tapi ambil ulang biar file berdiri sendiri)
async function pbbLoadCabangList() {
  const listEl = document.getElementById("pbbCabangList");
  listEl.innerHTML = `<div class="pbb-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    pbbCabangData = [];
    snap.forEach(docSnap => pbbCabangData.push({ id: docSnap.id, ...docSnap.data() }));
    pbbRenderCabangList(pbbCabangData);
  } catch (e) {
    console.error("❌ pbbLoadCabangList:", e);
    listEl.innerHTML = `<div class="pbb-loading">Gagal memuat data cabang.</div>`;
  }
}

function pbbRenderCabangList(data) {
  const listEl = document.getElementById("pbbCabangList");
  if (!data.length) {
    listEl.innerHTML = `<div class="pbb-loading">Belum ada cabang.</div>`;
    return;
  }

  listEl.innerHTML = data.map(c => `
    <div class="pbb-cabang-item ${c.id === pbbActiveCabangId ? "active" : ""}" data-id="${c.id}">
      ${c.fotoKantor
        ? `<img src="${c.fotoKantor}" class="pbb-cabang-avatar">`
        : `<div class="pbb-cabang-avatar"><i class="fa-solid fa-building"></i></div>`
      }
      <div class="pbb-cabang-info">
        <div class="pbb-cabang-nama">${c.namaCabang || "-"}</div>
        <div class="pbb-cabang-pt">${c.namaPt || "-"}</div>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".pbb-cabang-item").forEach(item => {
    item.addEventListener("click", () => pbbSelectCabang(item.dataset.id));
  });
}

// ── PILIH CABANG ──
async function pbbSelectCabang(cabangId) {
  pbbActiveCabangId = cabangId;
  pbbActiveCabang = pbbCabangData.find(c => c.id === cabangId) || null;
  pbbRenderCabangList(pbbCabangData);

  document.getElementById("pbbDetailEmpty").style.display = "none";
  document.getElementById("pbbDetailNoAdmin").style.display = "none";
  document.getElementById("pbbDetailContent").style.display = "none";

  const wasOpen = document.querySelector(".pbb-detail-wrapper")?.classList.contains("show");
  document.querySelector(".pbb-detail-wrapper")?.classList.add("show");
  if (!wasOpen) window.pusatPushDetailState?.("pembelianbahanbaku");

  const adminCabang = await pbbGetActiveAdminCabang(cabangId);
  if (!adminCabang) {
    document.getElementById("pbbDetailNoAdmin").style.display = "flex";
    pbbActiveAdminUid = null;
    return;
  }

  pbbActiveAdminUid = adminCabang.id;

  document.getElementById("pbbDetailNama").textContent = pbbActiveCabang?.namaCabang || "-";
  document.getElementById("pbbDetailSub").textContent = `Admin: ${adminCabang.nama || "-"}`;
  document.getElementById("pbbDetailContent").style.display = "flex";

  pbbLoadTransaksi();
}

// ── STATE TAMBAHAN ──
let pbbTrxData = [];
let pbbEditingTrxId = null;
let pbbActiveBulan = new Date().getMonth() + 1;
let pbbActiveTahun = new Date().getFullYear();
let pbbViewMode = "card";
let pbbActiveFilter = null;

const PBB_FILTER_OPTIONS = [
  { key: "belumTerima", label: "Belum Diterima" },
  { key: "sudahTerima", label: "Sudah Diterima" },
  { key: "lunas", label: "Lunas" },
  { key: "kurang", label: "Kurang" }
];

function pbbFilterMatch(t, filterKey) {
  const riwayat = t.riwayatBayar || [];
  switch (filterKey) {
    case "belumTerima": return riwayat.some(c => !c.diterima);
    case "sudahTerima": return riwayat.length > 0 && riwayat.every(c => c.diterima);
    case "lunas": return t.status === "lunas";
    case "kurang": return t.status === "kurang";
    default: return true;
  }
}

function pbbGetFilteredTrxData() {
  if (!pbbActiveFilter) return pbbTrxData;
  return pbbTrxData.filter(t => pbbFilterMatch(t, pbbActiveFilter));
}

function fmtRupiah(n) { return "Rp" + Number(n || 0).toLocaleString("id-ID"); }
function pbbFmtTanggal(str) {
  if (!str) return "-";
  const d = new Date(str);
  const formatted = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// ── TOAST CUSTOM ──
function pbbShowToast(message, type = "success") {
  let toast = document.getElementById("pbbToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "pbbToast";
    document.body.appendChild(toast);
  }
  toast.className = `pbb-toast pbb-toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}"></i><span>${message}</span>`;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(pbbShowToast._timer);
  pbbShowToast._timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ── MODAL ALERT / CONFIRM CUSTOM ──
function pbbShowModal({ title = "Perhatian", message = "", icon = "fa-triangle-exclamation", confirmText = "Oke", showCancel = false, onConfirm = null }) {
  let container = document.getElementById("pbbModalContainer");
  if (container) container.remove();
  container = document.createElement("div");
  container.id = "pbbModalContainer";
  document.body.appendChild(container);

  container.innerHTML = `
    <div class="pbb-modal-overlay" id="pbbModalOverlay">
      <div class="pbb-modal-box">
        <div class="pbb-modal-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="pbb-modal-title">${title}</div>
        <div class="pbb-modal-message">${message}</div>
        <div class="pbb-modal-actions">
          ${showCancel ? `<button class="pbb-modal-btn-cancel" id="pbbModalCancel">Batal</button>` : ""}
          <button class="pbb-modal-btn-ok" id="pbbModalOk">${confirmText}</button>
        </div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => document.getElementById("pbbModalOverlay").classList.add("show"));

  const closeModal = () => {
    document.getElementById("pbbModalOverlay")?.classList.remove("show");
    setTimeout(() => container.remove(), 200);
  };

  document.getElementById("pbbModalOk").addEventListener("click", () => {
    closeModal();
    if (onConfirm) onConfirm();
  });
  document.getElementById("pbbModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("pbbModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "pbbModalOverlay") closeModal();
  });
}
async function pbbLoadTransaksi() {
  const bodyEl = document.getElementById("pbbBody");
  if (!pbbActiveAdminUid) return;
  pbbActiveFilter = null;
  bodyEl.innerHTML = `<div class="pbb-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</div>`;
  try {
    let snap;
    if (pbbActiveBulan) {
      const periode = `${pbbActiveTahun}-${String(pbbActiveBulan).padStart(2, "0")}`;
      snap = await window.getDocs(
        window.query(
          window.collection(window.db, "users", pbbActiveAdminUid, "pembelianBahanBaku"),
          window.where("periode", "==", periode)
        )
      );
    } else {
      // Semua Bulan: filter berdasarkan prefix periode "YYYY-" pakai range query
      const prefixStart = `${pbbActiveTahun}-01`;
      const prefixEnd = `${pbbActiveTahun}-12\uf8ff`;
      snap = await window.getDocs(
        window.query(
          window.collection(window.db, "users", pbbActiveAdminUid, "pembelianBahanBaku"),
          window.where("periode", ">=", prefixStart),
          window.where("periode", "<=", prefixEnd)
        )
      );
    }
    pbbTrxData = [];
    snap.forEach(d => pbbTrxData.push({ id: d.id, ...d.data() }));
    pbbRenderBody();
  } catch (e) {
    console.error("❌ pbbLoadTransaksi:", e);
    bodyEl.innerHTML = `<div class="pbb-loading">Gagal memuat data transaksi.</div>`;
  }
}
function pbbGroupByTanggal(list) {
  const map = {};
  list.forEach(t => {
    const key = t.tanggal || "-";
    if (!map[key]) map[key] = [];
    map[key].push(t);
  });
  return Object.keys(map)
    .sort((a, b) => new Date(b) - new Date(a))
    .map(tgl => ({ tanggal: tgl, items: map[tgl] }));
}
function pbbFmtBulanTahun(periode) {
  if (!periode) return "-";
  const [y, m] = periode.split("-");
  return `${PBB_BULAN_LIST[Number(m) - 1]} ${y}`;
}
function pbbGroupByBulan(list) {
  const map = {};
  list.forEach(t => {
    const key = t.periode || "-";
    if (!map[key]) map[key] = [];
    map[key].push(t);
  });
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map(periode => ({ periode, items: map[periode] }));
}
function pbbGroupByJenisPaket(list) {
  const map = {};
  list.forEach(t => {
    const jenis = t.jenisPaket || "-";
    if (!map[jenis]) map[jenis] = { qty: 0, total: 0 };
    map[jenis].qty += (t.qty || 0);
    map[jenis].total += (t.totalHarga || 0);
  });
  return Object.keys(map)
    .sort((a, b) => map[b].total - map[a].total)
    .map(jenis => ({ jenis, ...map[jenis] }));
}

function pbbRenderBody() {
  const bodyEl = document.getElementById("pbbBody");
  const filteredData = pbbGetFilteredTrxData();
  const totalBeli = filteredData.reduce((s, t) => s + (t.totalHarga || 0), 0);
  const jenisBreakdown = pbbGroupByJenisPaket(filteredData);
  document.getElementById("pbbViewToggleBtn")?.classList.toggle("active", pbbViewMode === "table");
  const totalBayar = filteredData.reduce((s, t) => s + (t.dibayar || 0), 0);
  const totalSisa   = filteredData.reduce((s, t) => s + (t.sisa < 0 ? Math.abs(t.sisa) : 0), 0);
  const belumLunas  = filteredData.filter(t => t.status === "kurang").length;

  bodyEl.innerHTML = `
    <div class="pbb-kpi-grid">
      <div class="pbb-kpi-card">
        <div class="pbb-kpi-icon total"><i class="fa-solid fa-basket-shopping"></i></div>
        <div class="pbb-kpi-label">Total Pembelian</div>
        <div class="pbb-kpi-value">${fmtRupiah(totalBeli)}</div>
        ${jenisBreakdown.length ? `
          <div class="pbb-kpi-breakdown">
            ${jenisBreakdown.map(j => `
              <div class="pbb-kpi-breakdown-row">
                <span class="pbb-kpi-breakdown-jenis">${j.jenis} <span class="pbb-kpi-breakdown-qty">${j.qty}</span></span>
                <span class="pbb-kpi-breakdown-total">${fmtRupiah(j.total)}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </div>
      <div class="pbb-kpi-card">
        <div class="pbb-kpi-icon success"><i class="fa-solid fa-circle-check"></i></div>
        <div class="pbb-kpi-label">Sudah Dibayar</div>
        <div class="pbb-kpi-value">${fmtRupiah(totalBayar)}</div>
      </div>
      <div class="pbb-kpi-card">
        <div class="pbb-kpi-icon danger"><i class="fa-solid fa-hourglass-half"></i></div>
        <div class="pbb-kpi-label">Sisa Tagihan</div>
        <div class="pbb-kpi-value">${fmtRupiah(totalSisa)}</div>
      </div>
      <div class="pbb-kpi-card">
        <div class="pbb-kpi-icon warning"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="pbb-kpi-label">Belum Lunas</div>
        <div class="pbb-kpi-value">${belumLunas} Transaksi</div>
      </div>
    </div>
    <div class="pbb-toolbar">
      <div class="pbb-filter-status-wrap">
        <button class="pbb-filter-status-btn ${pbbActiveFilter ? 'active' : ''}" id="pbbFilterStatusBtn">
          <i class="fa-solid fa-filter"></i>
          <span>${pbbActiveFilter ? PBB_FILTER_OPTIONS.find(o => o.key === pbbActiveFilter)?.label : "Filter Status"}</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="pbb-filter-status-menu" id="pbbFilterStatusMenu" style="display:none;">
          <div class="pbb-filter-status-option ${!pbbActiveFilter ? 'selected' : ''}" data-key="">
            <i class="fa-solid fa-list"></i> Semua
          </div>
          ${PBB_FILTER_OPTIONS.map(o => `
            <div class="pbb-filter-status-option ${pbbActiveFilter === o.key ? 'selected' : ''}" data-key="${o.key}">
              <i class="fa-solid fa-circle-check"></i> ${o.label}
            </div>
          `).join("")}
        </div>
      </div>
      <button class="pbb-add-btn" id="pbbAddTrxBtn"><i class="fa-solid fa-plus"></i> Tambah Pembelian</button>
    </div>
    ${filteredData.length ? `
      <div class="pbb-trx-groups">
        ${pbbActiveBulan ? pbbGroupByTanggal(filteredData).map(g => `
          <div class="pbb-trx-date-group">
            <div class="pbb-trx-date-label"><i class="fa-solid fa-calendar-day"></i> ${pbbFmtTanggal(g.tanggal)}</div>
            <div class="pbb-trx-row">${g.items.map(pbbTrxCardHTML).join("")}</div>
          </div>
        `).join("") : pbbGroupByBulan(filteredData).map(g => `
          <div class="pbb-trx-date-group">
            <div class="pbb-trx-date-label"><i class="fa-solid fa-calendar-days"></i> ${pbbFmtBulanTahun(g.periode)}</div>
            ${pbbGroupByTanggal(g.items).map(sg => `
              <div class="pbb-trx-date-group pbb-trx-date-subgroup">
                <div class="pbb-trx-date-label pbb-trx-date-sublabel"><i class="fa-solid fa-calendar-day"></i> ${pbbFmtTanggal(sg.tanggal)}</div>
                <div class="pbb-trx-row">${sg.items.map(pbbTrxCardHTML).join("")}</div>
              </div>
            `).join("")}
          </div>
        `).join("")}
      </div>
    ` : `<div class="pbb-trx-empty">${pbbActiveFilter ? "Tidak ada transaksi dengan filter ini." : "Belum ada transaksi pembelian."}</div>`}
  `;

  document.getElementById("pbbAddTrxBtn")?.addEventListener("click", () => pbbOpenTrxSheet(null));
  pbbInitFilterStatusDropdown();
  bodyEl.querySelectorAll(".pbb-trx-card").forEach(card => {
    const id = card.dataset.id;
    card.querySelector(".pbb-trx-toggle")?.addEventListener("click", () => card.classList.toggle("expanded"));
    card.querySelector(".pbb-trx-edit-btn")?.addEventListener("click", (e) => { e.stopPropagation(); pbbOpenTrxSheet(id); });
    card.querySelector(".pbb-trx-delete-btn")?.addEventListener("click", (e) => { e.stopPropagation(); pbbConfirmDeleteTrx(id); });
    card.querySelectorAll(".pbb-cicilan-toggle").forEach(btn => {
      btn.addEventListener("click", () => pbbToggleCicilanDiterima(id, btn.dataset.cicilanId));
    });
  });

  if (pbbViewMode === "table") pbbRenderTableOverlay(filteredData);
}

// ── DROPDOWN FILTER STATUS ──
function pbbInitFilterStatusDropdown() {
  const btn = document.getElementById("pbbFilterStatusBtn");
  const menu = document.getElementById("pbbFilterStatusMenu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  });

  menu.querySelectorAll(".pbb-filter-status-option").forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      pbbActiveFilter = opt.dataset.key || null;
      menu.style.display = "none";
      pbbRenderBody();
    });
  });

  document.addEventListener("click", () => { menu.style.display = "none"; }, { once: true });
}

// ── TOGGLE VIEW MODE ──
function pbbInitViewToggle() {
  document.getElementById("pbbViewToggleBtn")?.addEventListener("click", () => {
    pbbViewMode = pbbViewMode === "card" ? "table" : "card";
    pbbRenderBody();
  });
}

// ── RENDER TABEL ──
function pbbStatusLabel(t) {
  const statusClass = t.status || "kurang";
  return statusClass === "lunas" ? "Lunas" : (statusClass === "lebih" ? "Lebih Bayar" : "Kurang");
}
function pbbRenderTableOverlay(dataOverride) {
  const bodyEl = document.getElementById("pbbBody");
  const data = dataOverride || pbbGetFilteredTrxData();

  const sorted = data.slice().sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  const sumQty    = data.reduce((s, t) => s + (t.qty || 0), 0);
  const sumTotal  = data.reduce((s, t) => s + (t.totalHarga || 0), 0);
  const sumBayar  = data.reduce((s, t) => s + (t.dibayar || 0), 0);
  const sumSisa   = data.reduce((s, t) => s + (t.sisa || 0), 0);

  const tableHTML = `
    <div class="pbb-table-wrap">
      <table class="pbb-table">
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Jenis Paket</th>
            <th>Qty</th>
            <th>Harga Paket</th>
            <th>Total Pembayaran</th>
            <th>Dibayar</th>
            <th>Status</th>
            <th>Sisa Pembayaran</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.length ? sorted.map(t => `
            <tr class="pbb-table-row" data-id="${t.id}">
              <td>${pbbFmtTanggal(t.tanggal)}</td>
              <td>${t.jenisPaket || "-"}</td>
              <td>${t.qty || 0}</td>
              <td>${fmtRupiah(t.hargaPerPaket)}</td>
              <td>${fmtRupiah(t.totalHarga)}</td>
              <td>${fmtRupiah(t.dibayar)}</td>
              <td><span class="pbb-status-badge ${t.status || 'kurang'}">${pbbStatusLabel(t)}</span></td>
              <td class="${t.sisa < 0 ? 'neg' : (t.sisa > 0 ? 'pos' : 'zero')}">${fmtRupiah(Math.abs(t.sisa || 0))}</td>
            </tr>
          `).join("") : `<tr><td colspan="8" class="pbb-table-empty">Belum ada transaksi pembelian bulan ini.</td></tr>`}
        </tbody>
        ${sorted.length ? `
        <tfoot>
          <tr>
            <td colspan="2">Total</td>
            <td>${sumQty}</td>
            <td>-</td>
            <td>${fmtRupiah(sumTotal)}</td>
            <td>${fmtRupiah(sumBayar)}</td>
            <td>-</td>
            <td class="${sumSisa < 0 ? 'neg' : (sumSisa > 0 ? 'pos' : 'zero')}">${fmtRupiah(Math.abs(sumSisa))}</td>
          </tr>
        </tfoot>
        ` : ""}
      </table>
    </div>
  `;

  const kpiEl = bodyEl.querySelector(".pbb-kpi-grid");
  const toolbarEl = bodyEl.querySelector(".pbb-toolbar");
  const wrap = document.createElement("div");
  wrap.className = "pbb-table-container";
  wrap.innerHTML = tableHTML;

  bodyEl.querySelectorAll(".pbb-trx-groups, .pbb-trx-empty, .pbb-table-container").forEach(el => el.remove());
  bodyEl.appendChild(wrap);

  wrap.querySelectorAll(".pbb-table-row").forEach(row => {
    row.addEventListener("click", () => pbbOpenTrxSheet(row.dataset.id));
  });
}
function pbbTrxCardHTML(t) {
  const persen = t.totalHarga ? Math.min(100, Math.round(((t.dibayar || 0) / t.totalHarga) * 100)) : 0;
  const statusClass = t.status || "kurang";
  const statusLabel = statusClass === "lunas" ? "Lunas" : (statusClass === "lebih" ? "Lebih Bayar" : "Kurang");
  const sisaAbs = Math.abs(t.sisa || 0);
  const sisaLabel = statusClass === "lunas" ? "Lunas" : (statusClass === "lebih" ? `Lebih ${fmtRupiah(sisaAbs)}` : `Sisa ${fmtRupiah(sisaAbs)}`);
  const riwayat = (t.riwayatBayar || []).slice().sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  return `
    <div class="pbb-trx-card" data-id="${t.id}">
      <div class="pbb-trx-head">
        <div class="pbb-trx-title-wrap">
          <div class="pbb-trx-title">${t.jenisPaket || "-"}</div>
          <div class="pbb-trx-date">${pbbFmtTanggal(t.tanggal)}</div>
        </div>
        <div class="pbb-trx-actions">
          <span class="pbb-status-badge ${statusClass}">${statusLabel}</span>
          <button class="pbb-trx-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="pbb-trx-delete-btn" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="pbb-trx-info-row">
        <span>${t.qty || 0} paket × ${fmtRupiah(t.hargaPerPaket)}</span>
        <span class="pbb-trx-total">${fmtRupiah(t.totalHarga)}</span>
      </div>
      <div class="pbb-progress-wrap">
        <div class="pbb-progress-track">
          <div class="pbb-progress-fill ${statusClass === 'lunas' ? 'lunas' : ''}" style="width:${persen}%"></div>
        </div>
        <div class="pbb-progress-labels">
          <span>${fmtRupiah(t.dibayar)} dibayar</span>
          <span class="sisa ${statusClass === 'lunas' ? 'zero' : ''}">${sisaLabel}</span>
        </div>
      </div>
      <button class="pbb-trx-toggle">
        <span>Riwayat Cicilan (${riwayat.length})</span>
        <i class="fa-solid fa-chevron-down"></i>
      </button>
      <div class="pbb-trx-riwayat">
        <div class="pbb-cicilan-list">
          ${riwayat.length ? riwayat.map(c => `
            <div class="pbb-cicilan-item">
              <span class="pbb-cicilan-date">${pbbFmtTanggal(c.tanggal)}</span>
              <span class="pbb-cicilan-nominal">${fmtRupiah(c.nominal)}</span>
              <button class="pbb-cicilan-toggle ${c.diterima ? 'diterima' : 'belum'}" data-cicilan-id="${c.id}">
                ${c.diterima ? "Diterima" : "Belum"}
              </button>
            </div>
          `).join("") : `<div class="pbb-empty-msg">Belum ada cicilan.</div>`}
        </div>
      </div>
    </div>
  `;
}
function pbbConfirmDeleteTrx(trxId) {
  const trx = pbbTrxData.find(t => t.id === trxId);
  if (!trx) return;

  pbbShowModal({
    title: "Hapus Transaksi?",
    message: `Transaksi "${trx.jenisPaket || '-'}" pada ${pbbFmtTanggal(trx.tanggal)} akan dihapus permanen dan tidak bisa dikembalikan.`,
    icon: "fa-trash",
    confirmText: "Hapus",
    showCancel: true,
    onConfirm: () => pbbDeleteTrx(trxId)
  });
}
async function pbbDeleteTrx(trxId) {
  try {
    await window.deleteDoc(
      window.doc(window.db, "users", pbbActiveAdminUid, "pembelianBahanBaku", trxId)
    );
    pbbLoadTransaksi();
    pbbShowToast("Transaksi berhasil dihapus.", "success");
  } catch (e) {
    console.error("❌ pbbDeleteTrx:", e);
    pbbShowToast("Gagal menghapus transaksi.", "error");
  }
}

async function pbbToggleCicilanDiterima(trxId, cicilanId) {
  const trx = pbbTrxData.find(t => t.id === trxId);
  if (!trx) return;
  const cicilan = (trx.riwayatBayar || []).find(c => c.id === cicilanId);
  if (!cicilan) return;

  const willBe = !cicilan.diterima;
  pbbShowModal({
    title: "Konfirmasi",
    message: `Ubah status cicilan menjadi "${willBe ? "Diterima" : "Belum"}"?`,
    icon: "fa-circle-question",
    confirmText: "Oke",
    showCancel: true,
    onConfirm: async () => {
      cicilan.diterima = willBe;
      try {
        await window.updateDoc(
          window.doc(window.db, "users", pbbActiveAdminUid, "pembelianBahanBaku", trxId),
          { riwayatBayar: trx.riwayatBayar }
        );
        pbbRenderBody();
        pbbShowToast("Status cicilan berhasil diperbarui.", "success");
      } catch (e) {
        console.error("❌ pbbToggleCicilanDiterima:", e);
        pbbShowToast("Gagal memperbarui status cicilan.", "error");
      }
    }
  });
}
function pbbInitSheetSwipe(sheetEl, overlayEl, closeFn) {
  const bodyEl = sheetEl.querySelector('.pbb-sheet-body');
  let startY = 0, currentY = 0, dragging = false;

  const onStart = (e) => {
    if (window.innerWidth > 768) return; // swipe close cuma di mobile
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    sheetEl.style.transition = 'none';
  };

  const onMove = (e) => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;

    // masih di dalam konten & belum sampai paling atas → biarin scroll normal
    if (delta > 0 && bodyEl && bodyEl.scrollTop > 0) {
      dragging = false;
      sheetEl.style.transition = '';
      return;
    }

    if (delta > 0) {
      e.preventDefault(); // cegah pull-to-refresh browser
      sheetEl.style.transform = `translateY(${delta}px)`;
      overlayEl.style.opacity = Math.max(0, 1 - delta / 300);
    }
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheetEl.style.transition = '';
    const delta = currentY - startY;
    if (delta > 120) {
      closeFn();
    } else {
      sheetEl.style.transform = '';
      overlayEl.style.opacity = '';
    }
    startY = 0; currentY = 0;
  };

  sheetEl.addEventListener('touchstart', onStart, { passive: true });
  sheetEl.addEventListener('touchmove', onMove, { passive: false });
  sheetEl.addEventListener('touchend', onEnd);
}
function pbbInitTrxForm(trx) {
  const loyangList = pbbActiveCabang?.loyang || [];
  const dropdownEl = document.getElementById("fJenisPaketDropdown");
  const btnEl = document.getElementById("fJenisPaketBtn");
  const labelEl = document.getElementById("fJenisPaketLabel");
  const hiddenJenis = document.getElementById("fJenisPaket");
  const hiddenHarga = document.getElementById("fHarga");
  const hargaDisplay = document.getElementById("fHargaDisplay");
  const qtyEl = document.getElementById("fQty");
  const totalDisplay = document.getElementById("fTotalDisplay");
  const bayarAwalEl = document.getElementById("fBayarAwal");
  const keteranganEl = document.getElementById("fKeteranganDisplay");
  const warningEl = document.getElementById("fWarningLebih");
  const saveBtn = document.getElementById("pbbBtnSave");

  dropdownEl.innerHTML = loyangList.length
    ? loyangList.map(l => `
        <div class="pbb-form-dropdown-option ${l.jenisLoyang === hiddenJenis.value ? 'selected' : ''}" data-jenis="${l.jenisLoyang}" data-harga="${l.hargaPaket}">
          ${l.jenisLoyang} — ${fmtRupiah(l.hargaPaket)}
        </div>
      `).join("")
    : `<div class="pbb-form-dropdown-empty">Belum ada data loyang di cabang ini.</div>`;

  const parseAngka = (str) => Number((str || "").replace(/\D/g, "")) || 0;
  const formatRibuan = (n) => Number(n || 0).toLocaleString("id-ID");

  const recalc = () => {
    const qty = Number(qtyEl.value) || 0;
    const harga = parseAngka(hiddenHarga.value);
    const total = qty * harga;
    totalDisplay.value = fmtRupiah(total);

    const bayarAwal = parseAngka(bayarAwalEl.value);
    const selisih = bayarAwal - total;

    keteranganEl.classList.remove("minus", "zero");

    if (total === 0) {
      keteranganEl.value = "";
      keteranganEl.placeholder = "-";
      warningEl.style.display = "none";
      saveBtn.disabled = false;
      return;
    }

    if (selisih > 0) {
      keteranganEl.value = `Lebih Rp${formatRibuan(selisih)}`;
      keteranganEl.classList.add("minus");
      warningEl.style.display = "flex";
      saveBtn.disabled = true;
    } else if (selisih === 0) {
      keteranganEl.value = "Lunas";
      keteranganEl.classList.add("zero");
      warningEl.style.display = "none";
      saveBtn.disabled = false;
    } else {
      keteranganEl.value = `-Rp${formatRibuan(Math.abs(selisih))}`;
      keteranganEl.classList.add("minus");
      warningEl.style.display = "none";
      saveBtn.disabled = false;
    }
  };

  btnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownEl.style.display = dropdownEl.style.display === "none" ? "block" : "none";
  });

  dropdownEl.querySelectorAll(".pbb-form-dropdown-option").forEach(opt => {
    opt.addEventListener("click", () => {
      const jenis = opt.dataset.jenis;
      const harga = Number(opt.dataset.harga) || 0;
      hiddenJenis.value = jenis;
      hiddenHarga.value = harga;
      labelEl.textContent = jenis;
      btnEl.classList.remove("placeholder");
      hargaDisplay.value = fmtRupiah(harga);
      dropdownEl.querySelectorAll(".pbb-form-dropdown-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      dropdownEl.style.display = "none";
      recalc();
    });
  });

  document.addEventListener("click", () => { dropdownEl.style.display = "none"; });
  qtyEl.addEventListener("input", recalc);
  bayarAwalEl.addEventListener("input", () => {
    const raw = parseAngka(bayarAwalEl.value);
    bayarAwalEl.value = raw ? formatRibuan(raw) : "";
    recalc();
  });

  recalc();
}
function pbbAddFormHTML() {
  return `
    <div class="pbb-form-group">
      <label class="pbb-form-label">Tanggal Transaksi</label>
      <input type="date" class="pbb-form-input" id="fTanggal" value="${new Date().toISOString().slice(0,10)}">
    </div>

    <div class="pbb-form-group pbb-form-select-wrap">
      <label class="pbb-form-label">Jenis Paket</label>
      <button type="button" class="pbb-form-select placeholder" id="fJenisPaketBtn">
        <span id="fJenisPaketLabel">Pilih jenis paket</span>
        <i class="fa-solid fa-chevron-down"></i>
      </button>
      <div class="pbb-form-dropdown" id="fJenisPaketDropdown" style="display:none;"></div>
      <input type="hidden" id="fJenisPaket" value="">
    </div>

    <div class="pbb-form-row">
      <div class="pbb-form-group">
        <label class="pbb-form-label">Harga Paket (satuan)</label>
        <input type="text" class="pbb-form-input" id="fHargaDisplay" value="Rp0" readonly>
        <input type="hidden" id="fHarga" value="0">
      </div>
      <div class="pbb-form-group">
        <label class="pbb-form-label">Jumlah Pembelian Paket</label>
        <input type="number" class="pbb-form-input" id="fQty" value="" min="1">
      </div>
    </div>

    <div class="pbb-form-group">
      <label class="pbb-form-label">Total Harga</label>
      <input type="text" class="pbb-form-input" id="fTotalDisplay" value="Rp0" readonly>
    </div>

    <div class="pbb-form-group">
      <label class="pbb-form-label">Pembayaran Awal</label>
      <input type="text" class="pbb-form-input" id="fBayarAwal" inputmode="numeric" placeholder="0" value="">
    </div>

    <div class="pbb-form-group">
      <label class="pbb-form-label">Keterangan</label>
      <input type="text" class="pbb-form-input" id="fKeteranganDisplay" readonly value="" placeholder="-">
    </div>

    <div class="pbb-form-warning" id="fWarningLebih" style="display:none;">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>Pembayaran awal melebihi total harga.</span>
    </div>
  `;
}
function pbbRiwayatEditRowHTML(r) {
  const rid = r.id || Date.now().toString();
  return `
    <div class="pbb-riwayat-edit-row" data-id="${rid}">
      <input type="date" class="pbb-form-input r-tanggal" value="${r.tanggal || ''}">
      <input type="text" class="pbb-form-input r-nominal" inputmode="numeric" value="${r.nominal ? Number(r.nominal).toLocaleString('id-ID') : ''}" placeholder="0">
      <button type="button" class="pbb-riwayat-edit-remove" title="Hapus"><i class="fa-solid fa-trash"></i></button>
    </div>
  `;
}
function pbbEditFormHTML(trx) {
  const riwayat = (trx.riwayatBayar || []).slice().sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const statusClass = trx.status || "kurang";
  const statusLabel = statusClass === "lunas" ? "Lunas" : (statusClass === "lebih" ? "Lebih Bayar" : "Kurang Bayar");

  return `
    <div class="pbb-receipt">
      <div class="pbb-receipt-row">
        <span class="pbb-receipt-label">Tanggal Transaksi</span>
        <span class="pbb-receipt-value">${pbbFmtTanggal(trx.tanggal)}</span>
      </div>
      <div class="pbb-receipt-row">
        <span class="pbb-receipt-label">Jenis Paket</span>
        <span class="pbb-receipt-value">${trx.jenisPaket || "-"}</span>
      </div>
      <div class="pbb-receipt-row">
        <span class="pbb-receipt-label">Harga &amp; Qty</span>
        <span class="pbb-receipt-value">${trx.qty || 0} × ${fmtRupiah(trx.hargaPerPaket)}</span>
      </div>
      <div class="pbb-receipt-row">
        <span class="pbb-receipt-label">Total Harga</span>
        <span class="pbb-receipt-value total">${fmtRupiah(trx.totalHarga)}</span>
      </div>
      <div class="pbb-receipt-row">
        <span class="pbb-receipt-label">Keterangan</span>
        <span class="pbb-receipt-value status-${statusClass}" id="editStatusLabel">${statusLabel}</span>
      </div>
    </div>

    <div class="pbb-riwayat-edit-title">Riwayat Pembayaran</div>
    <div id="riwayatEditList">
      ${riwayat.map(r => pbbRiwayatEditRowHTML(r)).join("")}
    </div>
    <button type="button" class="pbb-riwayat-add-btn" id="btnTambahCicilan">
      <i class="fa-solid fa-plus"></i> Tambah Cicilan
    </button>

    <div class="pbb-form-warning" id="fWarningLebih" style="display:none; margin-top:14px;">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <span>Total pembayaran melebihi total harga.</span>
    </div>
  `;
}
function pbbInitEditForm(trx) {
  const listEl = document.getElementById("riwayatEditList");
  const addBtn = document.getElementById("btnTambahCicilan");
  const warningEl = document.getElementById("fWarningLebih");
  const statusEl = document.getElementById("editStatusLabel");
  const saveBtn = document.getElementById("pbbBtnSave");

  const parseAngka = (str) => Number((str || "").replace(/\D/g, "")) || 0;
  const formatRibuan = (n) => Number(n || 0).toLocaleString("id-ID");

  const recalc = () => {
    let totalDibayar = 0;
    listEl.querySelectorAll(".pbb-riwayat-edit-row").forEach(row => {
      totalDibayar += parseAngka(row.querySelector(".r-nominal").value);
    });

    const sisa = totalDibayar - trx.totalHarga;
    const status = sisa === 0 ? "lunas" : (sisa < 0 ? "kurang" : "lebih");

    statusEl.className = `pbb-receipt-value status-${status}`;
    statusEl.textContent = status === "lunas" ? "Lunas" : (status === "lebih" ? "Lebih Bayar" : "Kurang Bayar");

    if (status === "lebih") {
      warningEl.style.display = "flex";
      saveBtn.disabled = true;
    } else {
      warningEl.style.display = "none";
      saveBtn.disabled = false;
    }
  };

  const bindRow = (row) => {
    const nominalEl = row.querySelector(".r-nominal");
    nominalEl.addEventListener("input", () => {
      const raw = parseAngka(nominalEl.value);
      nominalEl.value = raw ? formatRibuan(raw) : "";
      recalc();
    });
    row.querySelector(".r-tanggal").addEventListener("input", recalc);
    row.querySelector(".pbb-riwayat-edit-remove").addEventListener("click", () => {
      row.remove();
      recalc();
    });
  };

  listEl.querySelectorAll(".pbb-riwayat-edit-row").forEach(bindRow);

  addBtn.addEventListener("click", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = pbbRiwayatEditRowHTML({ id: Date.now().toString(), nominal: "", tanggal: new Date().toISOString().slice(0, 10) });
    const row = wrapper.firstElementChild;
    listEl.appendChild(row);
    bindRow(row);
    recalc();
  });

  recalc();
}
async function pbbSaveRiwayat(closeSheet) {
  const trx = pbbTrxData.find(t => t.id === pbbEditingTrxId);
  if (!trx) return;

  const rows = document.querySelectorAll("#riwayatEditList .pbb-riwayat-edit-row");
  const riwayatBayar = [];
  let dibayar = 0;

  rows.forEach(row => {
    const id = row.dataset.id;
    const tanggal = row.querySelector(".r-tanggal").value;
    const nominal = Number(row.querySelector(".r-nominal").value.replace(/\D/g, "")) || 0;
    if (nominal > 0 && tanggal) {
      const existing = (trx.riwayatBayar || []).find(r => r.id === id);
      riwayatBayar.push({
        id, nominal, tanggal,
        diterima: existing?.diterima !== undefined ? existing.diterima : true
      });
      dibayar += nominal;
    }
  });

  const sisa = dibayar - trx.totalHarga;
  if (sisa > 0) {
    pbbShowModal({ title: "Tidak Bisa Disimpan", message: "Total pembayaran melebihi total harga.", icon: "fa-triangle-exclamation" });
    return;
  }
  const status = sisa === 0 ? "lunas" : "kurang";

  try {
    await window.updateDoc(
      window.doc(window.db, "users", pbbActiveAdminUid, "pembelianBahanBaku", pbbEditingTrxId),
      { riwayatBayar, dibayar, sisa, status, updatedAt: new Date().toISOString() }
    );
    closeSheet();
    pbbLoadTransaksi();
    pbbShowToast("Riwayat pembayaran berhasil disimpan.", "success");
  } catch (e) {
    console.error("❌ pbbSaveRiwayat:", e);
    pbbShowToast("Gagal menyimpan riwayat pembayaran.", "error");
  }
}
function pbbOpenTrxSheet(trxId) {
  pbbEditingTrxId = trxId;
  const trx = trxId ? pbbTrxData.find(t => t.id === trxId) : null;

  let container = document.getElementById("pbbSheetContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "pbbSheetContainer";
    document.body.appendChild(container);
  }

  container.innerHTML = `
    <div class="pbb-sheet-overlay" id="pbbSheetOverlay"></div>
    <div class="pbb-sheet" id="pbbSheet">
      <div class="pbb-sheet-handle"></div>
      <div class="pbb-sheet-header">
        <div class="pbb-sheet-title">${trx ? "Edit Riwayat Pembayaran" : "Tambah Pembelian"}</div>
        <button class="pbb-sheet-close" id="pbbSheetClose"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="pbb-sheet-body">
        ${trx ? pbbEditFormHTML(trx) : pbbAddFormHTML()}
      </div>
      <div class="pbb-sheet-footer">
        <button class="pbb-btn-cancel" id="pbbBtnCancel">Batal</button>
        <button class="pbb-btn-save" id="pbbBtnSave">Simpan</button>
      </div>
    </div>
  `;

  if (trx) {
    pbbInitEditForm(trx);
  } else {
    pbbInitTrxForm(trx);
  }

  requestAnimationFrame(() => {
    document.getElementById("pbbSheetOverlay").classList.add("show");
    document.getElementById("pbbSheet").classList.add("show");
  });

  const scrollY = window.scrollY;
  document.body.classList.add("pbb-sheet-open");
  document.body.style.top = `-${scrollY}px`;

  const closeSheet = () => {
    document.getElementById("pbbSheetOverlay").classList.remove("show");
    document.getElementById("pbbSheet").classList.remove("show");

    document.body.classList.remove("pbb-sheet-open");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);

    setTimeout(() => container.remove(), 300);
  };

  document.getElementById("pbbSheetClose").addEventListener("click", closeSheet);
  document.getElementById("pbbBtnCancel").addEventListener("click", closeSheet);
  document.getElementById("pbbSheetOverlay").addEventListener("click", closeSheet);
  document.getElementById("pbbBtnSave").addEventListener("click", () => {
    if (trx) pbbSaveRiwayat(closeSheet); else pbbSaveTrx(closeSheet);
  });

  pbbInitSheetSwipe(
    document.getElementById("pbbSheet"),
    document.getElementById("pbbSheetOverlay"),
    () => closeSheet()
  );
}
async function pbbSaveTrx(closeSheet) {
  const jenisPaket = document.getElementById("fJenisPaket").value.trim();
  const qty = Number(document.getElementById("fQty").value) || 0;
  const hargaPerPaket = Number(document.getElementById("fHarga").value) || 0;
  const tanggal = document.getElementById("fTanggal").value;
  const dibayar = Number(document.getElementById("fBayarAwal").value.replace(/\D/g, "")) || 0;

  if (!jenisPaket || !qty || !hargaPerPaket || !tanggal) {
    pbbShowModal({ title: "Lengkapi Data", message: "Lengkapi semua field dulu.", icon: "fa-triangle-exclamation" });
    return;
  }

  const totalHarga = qty * hargaPerPaket;
  if (dibayar > totalHarga) {
    pbbShowModal({ title: "Tidak Bisa Disimpan", message: "Pembayaran awal tidak boleh melebihi total harga.", icon: "fa-triangle-exclamation" });
    return;
  }

  const periode = tanggal.slice(0, 7);
  const sisa = dibayar - totalHarga; // negatif = kurang, 0 = lunas, positif = lebih
  const status = sisa === 0 ? "lunas" : (sisa < 0 ? "kurang" : "lebih");

  try {
    if (pbbEditingTrxId) {
      await window.updateDoc(
        window.doc(window.db, "users", pbbActiveAdminUid, "pembelianBahanBaku", pbbEditingTrxId),
        { jenisPaket, qty, hargaPerPaket, totalHarga, tanggal, periode, dibayar, sisa, status, keterangan: 0, updatedAt: new Date().toISOString() }
      );
    } else {
      const riwayatBayar = dibayar > 0
        ? [{ id: Date.now().toString(), nominal: dibayar, tanggal, diterima: true }]
        : [];

      await window.addDoc(
        window.collection(window.db, "users", pbbActiveAdminUid, "pembelianBahanBaku"),
        {
          jenisPaket, qty, hargaPerPaket, totalHarga, tanggal, periode,
          dibayar, sisa, status, keterangan: 0,
          riwayatBayar, createdBy: window.auth?.currentUser?.uid || "",
          updatedAt: new Date().toISOString()
        }
      );
    }
    closeSheet();
    pbbLoadTransaksi();
    pbbShowToast("Data pembelian berhasil disimpan.", "success");
  } catch (e) {
    console.error("❌ pbbSaveTrx:", e);
    pbbShowToast("Gagal menyimpan data.", "error");
  }
}

// ── SEARCH ──
function pbbInitSearch() {
  const input = document.getElementById("pbbSearch");
  input?.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const filtered = pbbCabangData.filter(c => (c.namaCabang || "").toLowerCase().includes(q));
    pbbRenderCabangList(filtered);
  });
}
// ── BACK KE LIST (mobile) ──
function pbbInitBackBtn() {
  document.getElementById("pbbBackBtn")?.addEventListener("click", () => {
    if (window.innerWidth <= 768 && history.state?.pusatDetail === "pembelianbahanbaku") {
      history.back(); // biar popstate yang urus, state konsisten
    } else {
      document.querySelector(".pbb-detail-wrapper")?.classList.remove("show");
    }
  });
}

// ── DROPDOWN FILTER BULAN & TAHUN ──
const PBB_BULAN_LIST = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function pbbPositionDropdown(btn, dropdown) {
  const rect = btn.getBoundingClientRect();
  dropdown.style.position = "fixed";
  dropdown.style.top = `${rect.bottom + 6}px`;
  dropdown.style.left = `${rect.left}px`;
}

function pbbInitFilterBulanTahun() {
  const bulanBtn = document.getElementById("pbbBulanBtn");
  const bulanDropdown = document.getElementById("pbbBulanDropdown");
  const bulanLabel = document.getElementById("pbbBulanLabel");
  const tahunBtn = document.getElementById("pbbTahunBtn");
  const tahunDropdown = document.getElementById("pbbTahunDropdown");
  const tahunLabel = document.getElementById("pbbTahunLabel");
  if (!bulanBtn || !tahunBtn) return;

  // pindahkan ke body biar lepas dari overflow:hidden header
  if (bulanDropdown.parentElement !== document.body) document.body.appendChild(bulanDropdown);
  if (tahunDropdown.parentElement !== document.body) document.body.appendChild(tahunDropdown);

  bulanLabel.textContent = pbbActiveBulan ? PBB_BULAN_LIST[pbbActiveBulan - 1] : "Semua Bulan";
  tahunLabel.textContent = pbbActiveTahun;

  // isi opsi bulan (+ Semua Bulan di atas)
  bulanDropdown.innerHTML = `
    <div class="pbb-dropdown-option ${!pbbActiveBulan ? 'selected' : ''}" data-bulan="">Semua Bulan</div>
    ${PBB_BULAN_LIST.map((nama, i) => `
      <div class="pbb-dropdown-option ${i + 1 === pbbActiveBulan ? 'selected' : ''}" data-bulan="${i + 1}">${nama}</div>
    `).join("")}
  `;

  // isi opsi tahun (rentang -3 s/d +1 dari tahun sekarang)
  const nowYear = new Date().getFullYear();
  const tahunList = [];
  for (let y = nowYear - 3; y <= nowYear + 1; y++) tahunList.push(y);
  tahunDropdown.innerHTML = tahunList.map(y => `
    <div class="pbb-dropdown-option ${y === pbbActiveTahun ? 'selected' : ''}" data-tahun="${y}">${y}</div>
  `).join("");

  bulanBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tahunDropdown.style.display = "none";
    if (bulanDropdown.style.display === "block") {
      bulanDropdown.style.display = "none";
    } else {
      pbbPositionDropdown(bulanBtn, bulanDropdown);
      bulanDropdown.style.display = "block";
    }
  });

  tahunBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    bulanDropdown.style.display = "none";
    if (tahunDropdown.style.display === "block") {
      tahunDropdown.style.display = "none";
    } else {
      pbbPositionDropdown(tahunBtn, tahunDropdown);
      tahunDropdown.style.display = "block";
    }
  });

  bulanDropdown.addEventListener("click", (e) => {
    const opt = e.target.closest(".pbb-dropdown-option");
    if (!opt) return;
    pbbActiveBulan = opt.dataset.bulan ? Number(opt.dataset.bulan) : null;
    bulanLabel.textContent = pbbActiveBulan ? PBB_BULAN_LIST[pbbActiveBulan - 1] : "Semua Bulan";
    bulanDropdown.querySelectorAll(".pbb-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    bulanDropdown.style.display = "none";
    pbbLoadTransaksi();
  });

  tahunDropdown.addEventListener("click", (e) => {
    const opt = e.target.closest(".pbb-dropdown-option");
    if (!opt) return;
    pbbActiveTahun = Number(opt.dataset.tahun);
    tahunLabel.textContent = pbbActiveTahun;
    tahunDropdown.querySelectorAll(".pbb-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    tahunDropdown.style.display = "none";
    pbbLoadTransaksi();
  });

  document.addEventListener("click", () => {
    bulanDropdown.style.display = "none";
    tahunDropdown.style.display = "none";
  });

  window.addEventListener("scroll", () => {
    if (bulanDropdown.style.display === "block") pbbPositionDropdown(bulanBtn, bulanDropdown);
    if (tahunDropdown.style.display === "block") pbbPositionDropdown(tahunBtn, tahunDropdown);
  }, true);
  window.addEventListener("resize", () => {
    if (bulanDropdown.style.display === "block") pbbPositionDropdown(bulanBtn, bulanDropdown);
    if (tahunDropdown.style.display === "block") pbbPositionDropdown(tahunBtn, tahunDropdown);
  });
}

// ── INIT VIEW ──
function pbbEnableDropdownPortal(btnId, dropdownId) {
  const btn = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  if (!btn || !dropdown) return;

  if (dropdown.parentElement !== document.body) {
    document.body.appendChild(dropdown);
  }

  const reposition = () => {
    const rect = btn.getBoundingClientRect();
    dropdown.style.position = "fixed";
    dropdown.style.top = `${rect.bottom + 6}px`;
    dropdown.style.left = `${rect.left}px`;
  };

  const observer = new MutationObserver(() => {
    if (dropdown.style.display !== "none") reposition();
  });
  observer.observe(dropdown, { attributes: true, attributeFilter: ["style"] });

  window.addEventListener("scroll", () => {
    if (dropdown.style.display !== "none") reposition();
  }, true);
  window.addEventListener("resize", () => {
    if (dropdown.style.display !== "none") reposition();
  });
}

// ── NAVIGASI LANGSUNG DARI LUAR (dipanggil dari Laporan Bahan Baku) ──
window.pbbGotoCabang = function (cabangId) {
  window.showView("pembelianbahanbaku");

  const trySelect = () => {
    if (typeof pbbCabangData !== "undefined" && pbbCabangData.length) {
      pbbSelectCabang(cabangId);
    } else {
      setTimeout(trySelect, 150);
    }
  };
  setTimeout(trySelect, 100);
};

window.initPembelianBahanBakuView = function () {
  pbbInitSearch();
  pbbLoadCabangList();
  pbbInitBackBtn();
  pbbInitViewToggle();
  pbbInitFilterBulanTahun();
};
