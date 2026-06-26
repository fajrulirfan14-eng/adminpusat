window.initHomeView = async function () {
  const user = window.currentUser;
  const now  = new Date();
  window.onHomeReload = async () => {
    const reloadBtn = document.getElementById("topbarReload");
    const icon = reloadBtn?.querySelector("i");
    if (icon) icon.classList.add("fa-spin");
    if (reloadBtn) reloadBtn.disabled = true;
    try {
      await syncGlobalData();
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
  if (el("topbarAvatar"))       el("topbarAvatar").textContent       = (user?.nama || "A")[0].toUpperCase();

  await Promise.all([loadStatCards(), loadCabangList()]);
};

async function loadStatCards() {
  const el = id => document.getElementById(id);
  try {
    const [cabangSnap, usersSnap] = await Promise.all([
      window.getDocs(window.collection(window.db, "kantorCabang")),
      window.getDocs(window.collection(window.db, "users"))
    ]);

    let totalMarketing = 0;
    cabangSnap.forEach(d => { totalMarketing += (d.data().totalMarketing || 0); });

    if (el("statCabang"))       el("statCabang").textContent       = cabangSnap.size;
    if (el("statCabangSub"))    el("statCabangSub").textContent    = "Cabang terdaftar";
    if (el("statMarketing"))    el("statMarketing").textContent    = totalMarketing;
    if (el("statMarketingSub")) el("statMarketingSub").textContent = "Sales, Kurir, Hunter";
    if (el("statAkun"))         el("statAkun").textContent         = usersSnap.size;
    if (el("statAkunSub"))      el("statAkunSub").textContent      = "Semua role";
    if (el("statLaporan"))      el("statLaporan").textContent      = "-";
    if (el("statLaporanSub"))   el("statLaporanSub").textContent   = "Data Firestore";

    if (el("ringAktif"))     el("ringAktif").textContent     = cabangSnap.size + " cabang";
    if (el("ringMarketing")) el("ringMarketing").textContent  = totalMarketing + " orang";
    if (el("ringLaporan"))   el("ringLaporan").textContent   = "-";
    if (el("ringOmset"))     el("ringOmset").textContent     = "Rp -";

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
          <div class="cabang-card-icon"><i class="fa-solid fa-mug-hot"></i></div>
          <div class="cabang-card-info">
            <div class="cabang-card-name">${data.nama || d.id}</div>
            <div class="cabang-card-meta">${data.kota || "-"} · ${data.totalMarketing || 0} marketing</div>
          </div>
          <div class="cabang-card-status"></div>
        </div>
      `;
    }).join("");
  } catch(e) {
    grid.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:20px 0;">Gagal memuat data.</div>`;
  }
}

// ── SYNC GLOBAL DATA ──
async function syncGlobalData() {
  try {
    const usersSnap = await window.getDocs(window.collection(window.db, "users"));
    const usersData = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    await window.idbSetUsers(usersData);
    const cabangSnap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    const cabangData = cabangSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    await window.idbSetCabang(cabangData);
  } catch(e) {  }
}