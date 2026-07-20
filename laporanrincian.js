// ── STATE MODUL RINCIAN ──
let laprState = {
  cabangId: null,
  adminUid: null,
  bulan: new Date().getMonth(),
  tahun: new Date().getFullYear(),
  varianList: [],
  marketingList: [],
  laporanAgg: {}
};


let laprCache = {};
const LAPR_CACHE_KEY = (cabangId, bulan, tahun) => `${cabangId}-${bulan}-${tahun}`;

const LAPR_BULAN_NAMA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

// ── ENTRY POINT (dipanggil laporan.js) ──
window.renderLaporanRincian = async function (bodyEl, context) {
  if (!context.isCabang || !context.cabangData) {
    bodyEl.innerHTML = `
      <div class="lapr-placeholder-empty">
        <div class="lapr-empty-icon"><i class="fa-solid fa-building"></i></div>
        <div class="lapr-empty-title">Pilih Cabang Dulu</div>
        <div class="lapr-empty-sub">Rincian ini khusus per kantor cabang. Buka menu "Laporan Cabang" di kiri, lalu pilih salah satu cabang.</div>
      </div>
    `;
    return;
  }

  const cabangId = context.cabangData.id;

  // reset state kalau ganti cabang
  if (laprState.cabangId !== cabangId) {
    laprState.cabangId = cabangId;
    laprState.bulan = new Date().getMonth();
    laprState.tahun = new Date().getFullYear();
    laprState.adminUid = null;
  }

  bodyEl.innerHTML = renderLaprSkeleton();
  initLaprFilterUI();

  const emptyAdmin = document.getElementById("laprEmptyAdmin");
  const content = document.getElementById("laprContentWrap");

  if (!laprState.adminUid) {
    laprState.adminUid = await laprResolveAdminUid(cabangId);
  }

  if (!laprState.adminUid) {
    if (emptyAdmin) emptyAdmin.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  if (emptyAdmin) emptyAdmin.style.display = "none";
  if (content) content.style.display = "flex";

  await refreshLaprData();
};

// ── CARI UID ADMIN CABANG AKTIF (pola sama kayak PBB) ──
async function laprResolveAdminUid(cabangId) {
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
    console.error("❌ laprResolveAdminUid:", e);
    return null;
  }
}

// ── SKELETON HTML ──
function renderLaprSkeleton() {
  return `
    <div class="lapr-wrap">

      <div class="lapr-toolbar">
        <div class="lapr-filter-wrap">
          <button class="lapr-filter-btn" id="laprBulanBtn">
            <i class="fa-solid fa-calendar"></i>
            <span id="laprBulanLabel">${LAPR_BULAN_NAMA[laprState.bulan]}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="lapr-dropdown" id="laprBulanDropdown" style="display:none;"></div>

          <button class="lapr-filter-btn" id="laprTahunBtn">
            <span id="laprTahunLabel">${laprState.tahun}</span>
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="lapr-dropdown" id="laprTahunDropdown" style="display:none;"></div>

          <button class="lapr-filter-btn" id="laprReloadBtn" title="Reload">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <div class="lapr-empty-admin" id="laprEmptyAdmin" style="display:none;">
        <div class="lapr-empty-icon"><i class="fa-solid fa-user-slash"></i></div>
        <div class="lapr-empty-title">Admin Cabang Belum Ada</div>
        <div class="lapr-empty-sub">Cabang ini belum punya Admin Cabang aktif.</div>
      </div>

      <div class="lapr-content-wrap" id="laprContentWrap" style="display:none;">
        <div class="lapr-summary-row">
          <div class="lapr-summary-card" data-tipe="pemasukan">
            <div class="lapr-summary-label">Total Pemasukan</div>
            <div class="lapr-summary-total" id="laprTotalPemasukan">Rp 0</div>
          </div>
          <div class="lapr-summary-card" data-tipe="pengeluaran">
            <div class="lapr-summary-label">Total Pengeluaran</div>
            <div class="lapr-summary-total" id="laprTotalPengeluaran">Rp 0</div>
          </div>
          <div class="lapr-summary-card" data-tipe="selisih">
            <div class="lapr-summary-label">Selisih</div>
            <div class="lapr-summary-total" id="laprSelisih">Rp 0</div>
          </div>
        </div>

        <div class="lapr-card">
          <div class="lapr-card-title"><i class="fa-solid fa-sack-dollar"></i> Rincian Pemasukan Bulanan</div>
          <div class="lapr-table-wrap">
            <table class="lapr-table" id="laprTable">
              <thead>
                <tr id="laprTableHeadTop"></tr>
                <tr id="laprTableHeadSub"></tr>
              </thead>
              <tbody id="laprTableBody"></tbody>
            </table>
          </div>
        </div>

        <div class="lapr-card">
          <div class="lapr-card-title"><i class="fa-solid fa-money-bill-wave"></i> Rincian Pengeluaran</div>
          <div class="lapr-table-wrap">
            <table class="lapr-table" id="laprPengeluaranTable">
              <thead>
                <tr>
                  <th class="lapr-th-nama">Jenis</th>
                  <th>Qty</th>
                  <th>Nominal</th>
                </tr>
              </thead>
              <tbody id="laprPengeluaranTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ── FILTER BULAN/TAHUN (portal ke body, cegah clipping) ──
function initLaprFilterUI() {
  const bulanBtn = document.getElementById("laprBulanBtn");
  const tahunBtn = document.getElementById("laprTahunBtn");
  const bulanDD  = document.getElementById("laprBulanDropdown");
  const tahunDD  = document.getElementById("laprTahunDropdown");
  const reloadBtn = document.getElementById("laprReloadBtn");
  if (!bulanBtn || !tahunBtn) return;

  document.body.appendChild(bulanDD);
  document.body.appendChild(tahunDD);

  bulanDD.innerHTML = LAPR_BULAN_NAMA.map((nama, i) => `
    <div class="lapr-dropdown-option ${i === laprState.bulan ? "selected" : ""}" data-bulan="${i}">${nama}</div>
  `).join("");

  const nowYear = new Date().getFullYear();
  const tahunList = [nowYear - 1, nowYear, nowYear + 1];
  tahunDD.innerHTML = tahunList.map(y => `
    <div class="lapr-dropdown-option ${y === laprState.tahun ? "selected" : ""}" data-tahun="${y}">${y}</div>
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
    const opt = e.target.closest(".lapr-dropdown-option");
    if (!opt) return;
    laprState.bulan = Number(opt.dataset.bulan);
    document.getElementById("laprBulanLabel").textContent = LAPR_BULAN_NAMA[laprState.bulan];
    bulanDD.querySelectorAll(".lapr-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshLaprData();
  };

  tahunDD.onclick = async (e) => {
    const opt = e.target.closest(".lapr-dropdown-option");
    if (!opt) return;
    laprState.tahun = Number(opt.dataset.tahun);
    document.getElementById("laprTahunLabel").textContent = laprState.tahun;
    tahunDD.querySelectorAll(".lapr-dropdown-option").forEach(o => o.classList.remove("selected"));
    opt.classList.add("selected");
    closeAll();
    await refreshLaprData();
  };

  document.addEventListener("click", closeAll);

  reloadBtn.onclick = async () => {
    reloadBtn.classList.add("spinning");
    await refreshLaprData(true);
    reloadBtn.classList.remove("spinning");
  };
}

// ── LOAD DATA ──
async function loadLaprVarianList(adminUid) {
  try {
    const snap = await window.getDoc(window.doc(window.db, "users", adminUid));
    if (!snap.exists()) return [];
    const varianArr = snap.data()?.varian || [];
    const aktifList = [];
    varianArr.forEach(item => {
      const namaVarian = Object.keys(item)[0];
      const detail = item[namaVarian];
      if (detail?.isAktif === true) aktifList.push(namaVarian);
    });
    return aktifList;
  } catch (e) {
    console.error("❌ loadLaprVarianList:", e);
    return [];
  }
}

async function loadLaprMarketingList(cabangId) {
  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", cabangId),
        window.where("role", "in", ["kurir", "sales"])
      )
    );
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    console.error("❌ loadLaprMarketingList:", e);
    return [];
  }
}

async function loadLaprLaporanAgg(adminUid, bulan, tahun) {
  const result = {};
  try {
    const prefix = `${tahun}-${String(bulan + 1).padStart(2, "0")}`;

    // Path: users/{adminUid}/laporanAdmin/{tanggal} -> tanggal adalah ID dokumen,
    // BUKAN field di dalam data. Jadi filter berdasarkan awalan ID dokumen, bukan where("tanggal", ...).
    const snap = await window.getDocs(
      window.collection(window.db, "users", adminUid, "laporanAdmin")
    );

    snap.forEach(docSnap => {
      if (!docSnap.id.startsWith(prefix)) return; // skip dokumen di luar bulan/tahun yang dipilih

      const dataPerUid = docSnap.data() || {};
      Object.entries(dataPerUid).forEach(([uid, uidData]) => {
        if (!result[uid]) result[uid] = { order: {}, pembayaran: 0, keterangan: 0 };

        const closing = uidData?.pembayaran?.closing || {};
        Object.entries(closing).forEach(([varian, nilai]) => {
          result[uid].order[varian] = (result[uid].order[varian] || 0) + Number(nilai || 0);
        });

        const bayar = Number(uidData?.pembayaran?.nota?.bayar) || 0;
        const keterangan = Number(uidData?.pembayaran?.nota?.keterangan) || 0;
        result[uid].pembayaran += bayar;
        result[uid].keterangan += keterangan;
      });
    });
  } catch (e) {
    console.error("❌ loadLaprLaporanAgg:", e);
  }
  return result;
}

async function loadLaprPengeluaranAgg(adminUid, bulan, tahun) {
  const result = {};
  try {
    const mm = String(bulan + 1).padStart(2, "0");
    const start = `${tahun}-${mm}-01`;
    const end = `${tahun}-${mm}-31`;

    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users", adminUid, "pengeluaran"),
        window.where("tanggal", ">=", start),
        window.where("tanggal", "<=", end)
      )
    );

    snap.forEach(docSnap => {
      const produksi = docSnap.data().produksi || [];
      produksi.forEach(item => {
        const jenis = item.jenis || "Lainnya";
        const nama = item.nama || "Tanpa Nama";
        const qty = Number(item.qty) || 0;
        const nominal = Number(item.nominal) || 0;

        if (!result[jenis]) result[jenis] = { qty: 0, nominal: 0, items: {} };
        result[jenis].qty += qty;
        result[jenis].nominal += nominal;

        if (!result[jenis].items[nama]) result[jenis].items[nama] = { qty: 0, nominal: 0 };
        result[jenis].items[nama].qty += qty;
        result[jenis].items[nama].nominal += nominal;
      });
    });
  } catch (e) {
    console.error("❌ loadLaprPengeluaranAgg:", e);
  }
  return result;
}

async function loadLaprPembelianBahanBakuAgg(adminUid, bulan, tahun) {
  const periode = `${tahun}-${String(bulan + 1).padStart(2, "0")}`;
  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users", adminUid, "pembelianBahanBaku"),
        window.where("periode", "==", periode)
      )
    );
    let qty = 0, nominal = 0;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      qty += Number(data.qty) || 0;
      nominal += Number(data.dibayar) || 0;
    });
    return { qty, nominal };
  } catch (e) {
    console.error("❌ loadLaprPembelianBahanBakuAgg:", e);
    return { qty: 0, nominal: 0 };
  }
}

async function gabungkanPembelianBahanBakuKeVariable(adminUid, bulan, tahun, groupedData) {
  const { qty, nominal } = await loadLaprPembelianBahanBakuAgg(adminUid, bulan, tahun);
  if (qty === 0 && nominal === 0) return;

  if (!groupedData["variable"]) groupedData["variable"] = { qty: 0, nominal: 0, items: {} };
  groupedData["variable"].qty += qty;
  groupedData["variable"].nominal += nominal;
  groupedData["variable"].items["Pembelian Paket Bahan Baku"] = { qty, nominal };
}

async function loadLaprSlipGajiPerUser(employeeUid, periode) {
  try {
    const snap = await window.getDoc(window.doc(window.db, "users", employeeUid, "slipGaji", periode));
    if (!snap.exists()) return 0;
    return Number(snap.data().totalPendapatan) || 0;
  } catch (e) {
    console.error(`❌ loadLaprSlipGajiPerUser (${employeeUid}):`, e);
    return 0;
  }
}

async function gabungkanGajiKeRincianPengeluaran(cabangId, bulan, tahun, groupedData) {
  const jenisGaji = "Total Pemberian Gaji";
  const periode = `${tahun}-${String(bulan + 1).padStart(2, "0")}`;

  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", cabangId),
        window.where("role", "in", ["adminCabang", "produksi"])
      )
    );
    const relevantUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    if (!relevantUsers.length) return;

    const hasilPerUser = await Promise.all(
      relevantUsers.map(async u => {
        const nama = u.nama || "Tanpa Nama";
        const total = await loadLaprSlipGajiPerUser(u.uid, periode);
        return { nama, total };
      })
    );

    if (!groupedData[jenisGaji]) groupedData[jenisGaji] = { qty: 0, nominal: 0, items: {} };
    hasilPerUser.forEach(({ nama, total }) => {
      groupedData[jenisGaji].items[nama] = { qty: 0, nominal: total };
      groupedData[jenisGaji].nominal += total;
    });
  } catch (e) {
    console.error("❌ gabungkanGajiKeRincianPengeluaran:", e);
  }
}

// ── RENDER TABEL PEMASUKAN ──
function renderLaprPemasukanTable() {
  const theadTop = document.getElementById("laprTableHeadTop");
  const theadSub = document.getElementById("laprTableHeadSub");
  const tbody = document.getElementById("laprTableBody");
  if (!theadTop || !theadSub || !tbody) return 0;

  theadTop.innerHTML = `
    <th class="lapr-th-nama" rowspan="2">Nama Marketing</th>
    <th colspan="${laprState.varianList.length}">Order</th>
    <th rowspan="2">Pembayaran</th>
    <th rowspan="2">Keterangan</th>
    <th rowspan="2">Total</th>
  `;
  theadSub.innerHTML = laprState.varianList.map(v => `<th>${v}</th>`).join("");

  if (!laprState.marketingList.length) {
    const totalCols = 1 + laprState.varianList.length + 3;
    tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada marketing (kurir/sales)</td></tr>`;
    return 0;
  }

  const grandTotal = { order: {}, pembayaran: 0, keterangan: 0, total: 0 };

  tbody.innerHTML = laprState.marketingList.map(u => {
    const agg = laprState.laporanAgg[u.uid] || { order: {}, pembayaran: 0, keterangan: 0 };
    const pembayaran = agg.pembayaran || 0;
    const keterangan = agg.keterangan || 0;
    const total = pembayaran + keterangan;

    laprState.varianList.forEach(v => {
      const nilai = agg.order[v] || 0;
      grandTotal.order[v] = (grandTotal.order[v] || 0) + nilai;
    });
    grandTotal.pembayaran += pembayaran;
    grandTotal.keterangan += keterangan;
    grandTotal.total += total;

    return `
      <tr>
        <td class="lapr-td-nama">${u.nama || "Tanpa Nama"} <span class="lapr-role-badge">${u.role || "-"}</span></td>
        ${laprState.varianList.map(v => {
          const nilai = agg.order[v];
          return `<td>${nilai ? nilai.toLocaleString("id-ID") : ""}</td>`;
        }).join("")}
        <td>${pembayaran ? pembayaran.toLocaleString("id-ID") : ""}</td>
        <td>${keterangan ? keterangan.toLocaleString("id-ID") : ""}</td>
        <td class="lapr-td-total">${total ? total.toLocaleString("id-ID") : ""}</td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML += `
    <tr class="lapr-total-row">
      <td class="lapr-td-nama">Total</td>
      ${laprState.varianList.map(v => {
        const nilai = grandTotal.order[v];
        return `<td>${nilai ? nilai.toLocaleString("id-ID") : ""}</td>`;
      }).join("")}
      <td>${grandTotal.pembayaran ? grandTotal.pembayaran.toLocaleString("id-ID") : ""}</td>
      <td>${grandTotal.keterangan ? grandTotal.keterangan.toLocaleString("id-ID") : ""}</td>
      <td class="lapr-td-total">${grandTotal.total ? grandTotal.total.toLocaleString("id-ID") : ""}</td>
    </tr>
  `;

  return grandTotal.total;
}

// ── RENDER TABEL PENGELUARAN ──
function renderLaprPengeluaranTable(groupedData) {
  const tbody = document.getElementById("laprPengeluaranTableBody");
  if (!tbody) return 0;

  const jenisKeys = Object.keys(groupedData || {});
  if (!jenisKeys.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="lapr-empty-row">Belum ada data pengeluaran</td></tr>`;
    return 0;
  }

  let totalNominal = 0;

  tbody.innerHTML = jenisKeys.map(jenis => {
    const data = groupedData[jenis];
    const slug = jenis.toLowerCase().replace(/\s+/g, "-");
    totalNominal += data.nominal || 0;

    const namaRows = Object.entries(data.items || {}).map(([nama, item]) => `
      <tr class="lapr-nama-row" data-parent="${slug}">
        <td>${nama}</td>
        <td>${item.qty ? item.qty.toLocaleString("id-ID") : ""}</td>
        <td>${item.nominal ? item.nominal.toLocaleString("id-ID") : ""}</td>
      </tr>
    `).join("");

    return `
      <tr class="lapr-jenis-row" data-jenis="${slug}">
        <td class="lapr-td-nama"><span class="lapr-chevron">▶</span>${jenis}</td>
        <td>${data.qty ? data.qty.toLocaleString("id-ID") : ""}</td>
        <td>${data.nominal ? data.nominal.toLocaleString("id-ID") : ""}</td>
      </tr>
      ${namaRows}
    `;
  }).join("");

  tbody.innerHTML += `
    <tr class="lapr-total-row">
      <td class="lapr-td-nama">Total</td>
      <td></td>
      <td>${totalNominal ? totalNominal.toLocaleString("id-ID") : ""}</td>
    </tr>
  `;

  initLaprPengeluaranToggle();
  return totalNominal;
}

function initLaprPengeluaranToggle() {
  const tbody = document.getElementById("laprPengeluaranTableBody");
  if (!tbody) return;
  tbody.onclick = (e) => {
    const row = e.target.closest(".lapr-jenis-row");
    if (!row) return;
    const slug = row.dataset.jenis;
    row.classList.toggle("expanded");
    document.querySelectorAll(`.lapr-nama-row[data-parent="${slug}"]`).forEach(r => r.classList.toggle("show"));
  };
}

// ── REFRESH SEMUA DATA (pakai cache, kecuali forceRefresh true) ──
async function refreshLaprData(forceRefresh = false) {
  const { adminUid, cabangId, bulan, tahun } = laprState;
  if (!adminUid) return;

  const cacheKey = LAPR_CACHE_KEY(cabangId, bulan, tahun);
  const cached = laprCache[cacheKey];

  let pengeluaranAgg;

  if (cached && !forceRefresh) {
    // ── PAKAI CACHE, GAK FETCH ULANG ──
    laprState.varianList = cached.varianList;
    laprState.marketingList = cached.marketingList;
    laprState.laporanAgg = cached.laporanAgg;
    pengeluaranAgg = cached.pengeluaranAgg;
  } else {
    // ── FETCH FRESH DARI FIRESTORE ──
    laprState.varianList = await loadLaprVarianList(adminUid);
    laprState.marketingList = await loadLaprMarketingList(cabangId);
    laprState.laporanAgg = await loadLaprLaporanAgg(adminUid, bulan, tahun);

    pengeluaranAgg = await loadLaprPengeluaranAgg(adminUid, bulan, tahun);
    await gabungkanPembelianBahanBakuKeVariable(adminUid, bulan, tahun, pengeluaranAgg);
    await gabungkanGajiKeRincianPengeluaran(cabangId, bulan, tahun, pengeluaranAgg);

    laprCache[cacheKey] = {
      varianList: laprState.varianList,
      marketingList: laprState.marketingList,
      laporanAgg: laprState.laporanAgg,
      pengeluaranAgg,
      ts: Date.now()
    };
  }

  const totalPemasukan = renderLaprPemasukanTable() || 0;
  const totalPengeluaran = renderLaprPengeluaranTable(pengeluaranAgg) || 0;
  const selisih = totalPemasukan - totalPengeluaran;

  const pemasukanEl = document.getElementById("laprTotalPemasukan");
  const pengeluaranEl = document.getElementById("laprTotalPengeluaran");
  const selisihEl = document.getElementById("laprSelisih");

  if (pemasukanEl) pemasukanEl.textContent = `Rp ${totalPemasukan.toLocaleString("id-ID")}`;
  if (pengeluaranEl) pengeluaranEl.textContent = `Rp ${totalPengeluaran.toLocaleString("id-ID")}`;
  if (selisihEl) selisihEl.textContent = `${selisih < 0 ? "-Rp " : "Rp "}${Math.abs(selisih).toLocaleString("id-ID")}`;
}
