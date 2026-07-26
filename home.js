
window.initHomeView = async function () {
  const user = window.currentUser;
  const now  = new Date();
  window.onHomeReload = async () => {
    const reloadBtn = document.getElementById("topbarReload");
    const icon = reloadBtn?.querySelector("i");
    if (icon) icon.classList.add("fa-spin");
    if (reloadBtn) reloadBtn.disabled = true;
    try {
      await Promise.all([loadStatCards(), loadCabangList()]);
      Object.keys(homeKpiCache).forEach(k => delete homeKpiCache[k]);
      initHomeFinanceCards();
    } catch(e) { }
    if (icon) icon.classList.remove("fa-spin");
    if (reloadBtn) reloadBtn.disabled = false;
  };

  const greeting = now.getHours() < 11 ? "Selamat Pagi"
    : now.getHours() < 15 ? "Selamat Siang"
    : now.getHours() < 18 ? "Selamat Sore" : "Selamat Malam";

  const tanggal = now.toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const el = id => document.getElementById(id);
  if (el("homeBannerGreeting")) el("homeBannerGreeting").textContent = greeting + " 👋";
  if (el("homeBannerName"))     el("homeBannerName").textContent     = user?.nama || "Admin Pusat";
  if (el("homeBannerDate"))     el("homeBannerDate").textContent     = tanggal;

  await Promise.all([loadStatCards(), loadCabangList()]);
  initHomeFinanceCards();
  window.initHomeChart?.();
};

let homeKpiCache = {};
function homeCurrentPeriode() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function homeLoadPemasukanTotal(periode) {
  const cabangList = await window.lapbLoadCabangList?.() || [];
  if (!cabangList.length) console.warn("⚠️ homeLoadPemasukanTotal: cabangList kosong, cek lapbLoadCabangList");
  let total = 0;

  await Promise.all(cabangList.map(async (cabang) => {
    const adminUid = await window.lapbResolveAdminUid?.(cabang.id);
    if (!adminUid) return;

    try {
      const snap = await window.getDocs(window.collection(window.db, "users", adminUid, "laporanAdmin"));
      snap.forEach(docSnap => {
        if (!docSnap.id.startsWith(periode)) return;
        const dataPerUid = docSnap.data() || {};
        Object.values(dataPerUid).forEach(uidData => {
          const bayar = Number(uidData?.pembayaran?.nota?.bayar) || 0;
          const keterangan = Number(uidData?.pembayaran?.nota?.keterangan) || 0;
          total += bayar + keterangan;
        });
      });
    } catch (e) {
      console.error(`❌ homeLoadPemasukanTotal (${cabang.nama}):`, e);
    }
  }));

  return total;
}

async function homeLoadPengeluaranTotal(periode) {
  const cabangList = await window.lapbLoadCabangList?.() || [];
  if (!cabangList.length) console.warn("⚠️ homeLoadPengeluaranTotal: cabangList kosong, cek lapbLoadCabangList");
  let total = 0;

  const mm = periode.split("-")[1];
  const tahun = periode.split("-")[0];
  const start = `${tahun}-${mm}-01`;
  const end = `${tahun}-${mm}-31`;

  await Promise.all(cabangList.map(async (cabang) => {
    const adminUid = await window.lapbResolveAdminUid?.(cabang.id);
    if (!adminUid) return;

    try {
      const snap = await window.getDocs(
        window.query(
          window.collection(window.db, "users", adminUid, "pengeluaran"),
          window.where("tanggal", ">=", start),
          window.where("tanggal", "<=", end)
        )
      );
      snap.forEach(docSnap => {
        const produksi = docSnap.data().produksi || [];
        produksi.forEach(item => { total += Number(item.nominal) || 0; });
      });
    } catch (e) {
      console.error(`❌ homeLoadPengeluaranTotal (${cabang.nama}):`, e);
    }
  }));

  return total;
}

async function homeLoadPembelianData(periode) {
  // reuse cache & fetch dari modul Laporan Bahan Baku kalau sudah pernah dimuat
  let data = window.lapbGetCacheForPeriode?.(periode);
  if (!data) {
    if (typeof window.lapbLoadAllData !== "function") {
      console.warn("⚠️ lapbLoadAllData belum ter-load, cek urutan script laporanbahanbaku.js");
      return { total: 0, breakdown: [] };
    }
    data = await window.lapbLoadAllData(periode);
  }

  const total = data.reduce((s, t) => s + (t.totalHarga || 0), 0);

  const jenisMap = {};
  data.forEach(t => {
    const jenis = t.jenisPaket || "-";
    if (!jenisMap[jenis]) jenisMap[jenis] = { qty: 0, total: 0 };
    jenisMap[jenis].qty += (t.qty || 0);
    jenisMap[jenis].total += (t.totalHarga || 0);
  });
  const breakdown = Object.keys(jenisMap)
    .sort((a, b) => jenisMap[b].total - jenisMap[a].total)
    .map(jenis => ({ jenis, ...jenisMap[jenis] }));

  return { total, breakdown };
}

const HOME_FINANCE_LOADERS = {
  pemasukan: homeLoadPemasukanTotal,
  pengeluaran: homeLoadPengeluaranTotal,
  pembelian: homeLoadPembelianData
};
const HOME_FINANCE_LABEL_EL = {
  pemasukan: "homeValuePemasukan",
  pengeluaran: "homeValuePengeluaran",
  pembelian: "homeValuePembelian"
};
const HOME_FINANCE_SUB_EL = {
  pemasukan: "homeSubPemasukan",
  pengeluaran: "homeSubPengeluaran",
  pembelian: "homeSubPembelian"
};

async function homeRefreshFinanceCard(jenis, forceRefresh = false) {
  const periode = homeCurrentPeriode();
  const cacheKey = `${jenis}-${periode}`;
  const cardEl = document.getElementById(`homeCard${jenis.charAt(0).toUpperCase() + jenis.slice(1)}`);
  const valueEl = document.getElementById(HOME_FINANCE_LABEL_EL[jenis]);
  const subEl = document.getElementById(HOME_FINANCE_SUB_EL[jenis]);

  if (cardEl) cardEl.classList.add("loading");

  let result;
  if (homeKpiCache[cacheKey] !== undefined && !forceRefresh) {
    result = homeKpiCache[cacheKey];
  } else {
    try {
      result = await HOME_FINANCE_LOADERS[jenis](periode);
      homeKpiCache[cacheKey] = result;
    } catch (e) {
      console.error(`❌ homeRefreshFinanceCard (${jenis}):`, e);
      result = jenis === "pembelian" ? { total: 0, breakdown: [] } : 0;
    }
  }

  if (jenis === "pembelian") {
    const breakdownEl = document.getElementById("homeBreakdownPembelian");
    if (valueEl) valueEl.textContent = "Rp " + Number(result.total).toLocaleString("id-ID");
    if (breakdownEl) {
      breakdownEl.innerHTML = result.breakdown.length ? result.breakdown.map(j => `
        <div class="home-finance-breakdown-row">
          <span class="home-finance-breakdown-jenis">${j.jenis} <span class="home-finance-breakdown-qty">${j.qty}</span></span>
          <span class="home-finance-breakdown-total">Rp ${j.total.toLocaleString("id-ID")}</span>
        </div>
      `).join("") : "";
    }
  } else {
    if (valueEl) valueEl.textContent = "Rp " + Number(result).toLocaleString("id-ID");
  }

  if (subEl) subEl.textContent = "Klik untuk refresh";
  if (cardEl) cardEl.classList.remove("loading");
}

function initHomeFinanceCards() {
  ["pemasukan", "pengeluaran", "pembelian"].forEach(jenis => {
    homeRefreshFinanceCard(jenis); // load awal, pakai cache kalau ada

    const cardEl = document.querySelector(`.home-finance-card[data-jenis="${jenis}"]`);
    cardEl?.addEventListener("click", () => homeRefreshFinanceCard(jenis, true)); // klik = force refresh
  });
}

async function loadStatCards() {
  const el = id => document.getElementById(id);
  try {
    const [cabangSnap, usersSnap] = await Promise.all([
      window.getDocs(window.collection(window.db, "kantorCabang")),
      window.getDocs(window.collection(window.db, "users"))
    ]);

    if (el("statCabang"))       el("statCabang").textContent       = cabangSnap.size;
    if (el("statCabangSub"))    el("statCabangSub").textContent    = "Cabang terdaftar";
    if (el("statAkun"))         el("statAkun").textContent         = usersSnap.size;
    if (el("statAkunSub"))      el("statAkunSub").textContent      = "Semua role";
    
  } catch(e) {
    console.error("loadStatCards:", e);
  }
}
async function loadCabangList() {
  const grid = document.getElementById("homeCabangGrid");
  if (!grid) return;
  try {
    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    if (snap.empty) {
      grid.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:20px 0;">Belum ada data cabang.</div>`;
      return;
    }
    grid.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `
        <div class="cabang-card" onclick="window.showView('cabang')">
          ${data.fotoKantor
            ? `<img src="${data.fotoKantor}" class="cabang-card-icon" style="object-fit:cover;">`
            : `<div class="cabang-card-icon"><i class="fa-solid fa-mug-hot"></i></div>`
          }
          <div class="cabang-card-info">
            <div class="cabang-card-name">${data.namaCabang || "-"}</div>
            <div class="cabang-card-meta">${data.alamatCabang || "-"}</div>
          </div>
          <div class="cabang-card-status"></div>
        </div>
      `;
    }).join("");
  } catch(e) {
    grid.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:20px 0;">Gagal memuat data.</div>`;
  }
}
