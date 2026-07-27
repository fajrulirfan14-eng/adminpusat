// ── STATE MODUL AUDIT ──
let lapaState = {
  cabangId: null,
  adminUid: null,
  bulan: new Date().getMonth(),
  tahun: new Date().getFullYear()
};

const LAPA_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// in-memory cache, hilang kalau reload halaman
let lapaCache = {}; // key: "cabangId-periode" -> { auditData }
const LAPA_CACHE_KEY = (cabangId, periode) => `${cabangId}-${periode}`;

// label kategori buat header grup tabel
const LAPA_KATEGORI_LABEL = {
  loyang: "Paket Loyang",
  variable: "Bahan Variable",
  varian: "Varian Produk"
};

// ── ENTRY POINT (dipanggil laporan.js) ──
window.renderLaporanAudit = async function (bodyEl, context) {
  if (!context.isCabang || !context.cabangData) {
    bodyEl.innerHTML = `
      <div class="lapa-placeholder-empty">
        <div class="lapa-empty-icon"><i class="fa-solid fa-building"></i></div>
        <div class="lapa-empty-title">Pilih Cabang Dulu</div>
        <div class="lapa-empty-sub">Audit ini khusus per kantor cabang. Buka menu "Laporan Cabang" di kiri, lalu pilih salah satu cabang.</div>
      </div>
    `;
    return;
  }

  const cabangId = context.cabangData.id;

  if (lapaState.cabangId !== cabangId) {
    lapaState.cabangId = cabangId;
    lapaState.bulan = new Date().getMonth();
    lapaState.tahun = new Date().getFullYear();
    lapaState.adminUid = null;
  }

  bodyEl.innerHTML = renderLapaSkeleton();
  initLapaFilterUI();

  const emptyAdmin = document.getElementById("lapaEmptyAdmin");
  const content = document.getElementById("lapaContentWrap");

  if (!lapaState.adminUid) {
    lapaState.adminUid = await lapaResolveAdminUid(cabangId);
  }

  if (!lapaState.adminUid) {
    if (emptyAdmin) emptyAdmin.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  if (emptyAdmin) emptyAdmin.style.display = "none";
  if (content) content.style.display = "flex";

  await refreshLapaData();
};

// ── CARI UID ADMIN CABANG AKTIF ──
async function lapaResolveAdminUid(cabangId) {
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
    console.error("❌ lapaResolveAdminUid:", e);
    return null;
  }
}

// ── SKELETON HTML ──
function renderLapaSkeleton() {
  return `
    <div class="lapa-wrap">

      <div class="lapa-toolbar">
        <div class="lapa-filter-wrap">
          <button class="lapa-filter-btn" id="lapaBulanBtn">
            <i class="fa-solid fa-calendar"></i>
            <span id="lapaBulanLabel">${LAPA_BULAN_NAMA[lapaState.bulan]}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="lapa-dropdown" id="lapaBulanDropdown" style="display:none;"></div>

          <button class="lapa-filter-btn" id="lapaTahunBtn">
            <span id="lapaTahunLabel">${lapaState.tahun}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="lapa-dropdown" id="lapaTahunDropdown" style="display:none;"></div>

        </div>
      </div>

      <div class="lapa-empty-admin" id="lapaEmptyAdmin" style="display:none;">
        <div class="lapa-empty-icon"><i class="fa-solid fa-user-slash"></i></div>
        <div class="lapa-empty-title">Admin Cabang Belum Ada</div>
        <div class="lapa-empty-sub">Cabang ini belum punya Admin Cabang aktif.</div>
      </div>

      <div class="lapa-content-wrap" id="lapaContentWrap" style="display:none;">

        <div class="lapa-kpi-grid">
          <div class="lapa-kpi-card lapa-kpi-brown">
            <div class="lapa-kpi-label">HPP Real</div>
            <div class="lapa-kpi-value" id="lapaKpiHpp">-</div>
          </div>
          <div class="lapa-kpi-card lapa-kpi-green">
            <div class="lapa-kpi-label">Hasil Audit</div>
            <div class="lapa-kpi-value" id="lapaKpiHasilAudit">-</div>
          </div>
          <div class="lapa-kpi-card lapa-kpi-red">
            <div class="lapa-kpi-label">Pengeluaran Fixed</div>
            <div class="lapa-kpi-value" id="lapaKpiFixed">-</div>
          </div>
          <div class="lapa-kpi-card lapa-kpi-purple">
            <div class="lapa-kpi-label">Total Slip Gaji</div>
            <div class="lapa-kpi-value" id="lapaKpiGaji">-</div>
          </div>
        </div>

        <div class="lapa-card">
          <div class="lapa-card-title"><i class="fa-solid fa-boxes-stacked"></i> Rincian Audit Bahan Baku</div>
          <div class="lapa-table-wrap">
            <table class="lapa-table">
              <thead>
                <tr>
                  <th class="lapa-th-nama">Jenis Bahan Baku</th>
                  <th>Stock Awal</th>
                  <th>Belanja</th>
                  <th>HPP Real</th>
                  <th>Saldo</th>
                  <th>Stock Akhir</th>
                </tr>
              </thead>
              <tbody id="lapaTableBody"></tbody>
            </table>
          </div>
        </div>

        <div class="lapa-updated-at" id="lapaUpdatedAt"></div>

      </div>
    </div>
  `;
}

// ── FILTER BULAN/TAHUN (portal ke body) ──
function initLapaFilterUI() {
  const bulanBtn = document.getElementById("lapaBulanBtn");
  const tahunBtn = document.getElementById("lapaTahunBtn");
  const bulanDD  = document.getElementById("lapaBulanDropdown");
  const tahunDD  = document.getElementById("lapaTahunDropdown");
  if (!bulanBtn || !tahunBtn) return;

  document.body.appendChild(bulanDD);
  document.body.appendChild(tahunDD);

  bulanDD.innerHTML = LAPA_BULAN_NAMA.map((nama, i) => `
    <div class="lapa-dropdown-option ${i === lapaState.bulan ? "selected" : ""}" data-bulan="${i}">${nama}</div>
  `).join("");

  const nowYear = new Date().getFullYear();
  const tahunList = [nowYear - 1, nowYear, nowYear + 1];
  tahunDD.innerHTML = tahunList.map(y => `
    <div class="lapa-dropdown-option ${y === lapaState.tahun ? "selected" : ""}" data-tahun="${y}">${y}</div>
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
    const opt = e.target.closest(".lapa-dropdown-option");
    if (!opt) return;
    lapaState.bulan = Number(opt.dataset.bulan);
    document.getElementById("lapaBulanLabel").textContent = LAPA_BULAN_NAMA[lapaState.bulan];
    bulanDD.querySelectorAll(".lapa-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshLapaData();
  };

  tahunDD.onclick = async (e) => {
    const opt = e.target.closest(".lapa-dropdown-option");
    if (!opt) return;
    lapaState.tahun = Number(opt.dataset.tahun);
    document.getElementById("lapaTahunLabel").textContent = lapaState.tahun;
    tahunDD.querySelectorAll(".lapa-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshLapaData();
  };

  document.addEventListener("click", closeAll);
}

// ── LOAD DATA AUDIT ──
async function loadLapaAuditData(adminUid, periode) {
  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid, "audit", periode));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) {
    console.error("❌ loadLapaAuditData:", e);
    return null;
  }
}

// ── RENDER KPI ──
function renderLapaKpi(auditData) {
  const fmtRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

  const hppEl = document.getElementById("lapaKpiHpp");
  const hasilAuditEl = document.getElementById("lapaKpiHasilAudit");
  const fixedEl = document.getElementById("lapaKpiFixed");
  const gajiEl = document.getElementById("lapaKpiGaji");

  if (hppEl) hppEl.textContent = fmtRp(Math.round(auditData?.hppReal || 0));
  if (hasilAuditEl) hasilAuditEl.textContent = fmtRp(Math.round(auditData?.hasilAudit || 0));
  if (fixedEl) fixedEl.textContent = fmtRp(auditData?.hasilFixed || 0);
  if (gajiEl) gajiEl.textContent = fmtRp(auditData?.hasilGaji || 0);
}

// ── RENDER TABEL (dikelompokkan per kategori) ──
function renderLapaTable(auditData) {
  const tbody = document.getElementById("lapaTableBody");
  const updatedAtEl = document.getElementById("lapaUpdatedAt");
  if (!tbody) return;

  const items = auditData?.data || [];

  if (updatedAtEl) {
    if (auditData?.updatedAt) {
      const d = new Date(auditData.updatedAt);
      updatedAtEl.textContent = `Terakhir diperbarui: ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      updatedAtEl.textContent = "";
    }
  }

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="lapa-empty-row">Belum ada data audit untuk periode ini.</td></tr>`;
    return;
  }

  // kelompokkan per kategori, urutan tetap: loyang -> variable -> varian
  const kategoriOrder = ["loyang", "variable", "varian"];
  const grouped = {};
  items.forEach(item => {
    const kat = item.kategori || "lainnya";
    if (!grouped[kat]) grouped[kat] = [];
    grouped[kat].push(item);
  });

  const allKategori = [...kategoriOrder.filter(k => grouped[k]), ...Object.keys(grouped).filter(k => !kategoriOrder.includes(k))];

  const fmt = (n) => {
    const num = Number(n) || 0;
    if (Number.isInteger(num)) return num.toLocaleString("id-ID");
    return num.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  };

  tbody.innerHTML = allKategori.map(kat => {
    const rows = grouped[kat].map(item => `
      <tr>
        <td class="lapa-td-nama">${item.nama || "-"}</td>
        <td>${fmt(item.stockAwal)}</td>
        <td>${fmt(item.belanja)}</td>
        <td>${fmt(item.hppReal)}</td>
        <td>${fmt(item.saldo)}</td>
        <td>${fmt(item.stockAkhir)}</td>
      </tr>
    `).join("");

    return `
      <tr class="lapa-kategori-row">
        <td colspan="6">${LAPA_KATEGORI_LABEL[kat] || kat}</td>
      </tr>
      ${rows}
    `;
  }).join("");
}

// ── REFRESH DATA (pakai cache, kecuali forceRefresh true) ──
async function refreshLapaData(forceRefresh = false) {
  const { adminUid, cabangId, bulan, tahun } = lapaState;
  if (!adminUid) return;

  const periode = `${tahun}-${String(bulan + 1).padStart(2, "0")}`;
  const cacheKey = LAPA_CACHE_KEY(cabangId, periode);
  const cached = lapaCache[cacheKey];

  let auditData;

  if (cached && !forceRefresh) {
    auditData = cached.auditData;
  } else {
    auditData = await loadLapaAuditData(adminUid, periode);
    lapaCache[cacheKey] = { auditData, ts: Date.now() };
  }

  if (!auditData) {
    const kpiEls = ["lapaKpiHpp", "lapaKpiHasilAudit", "lapaKpiFixed", "lapaKpiGaji"];
    kpiEls.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = "Rp 0"; });
    const tbody = document.getElementById("lapaTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="lapa-empty-row">Belum ada data audit untuk periode ini.</td></tr>`;
    const updatedAtEl = document.getElementById("lapaUpdatedAt");
    if (updatedAtEl) updatedAtEl.textContent = "";
    return;
  }

  renderLapaKpi(auditData);
  renderLapaTable(auditData);
}