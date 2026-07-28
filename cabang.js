
window.cabangData = [];
let cabangData = window.cabangData;
let activeCabangId = null;

// ── FORMAT RIBUAN (Rp) ──
function rpFormat(val) {
  const digits = String(val || "").replace(/\D/g, "");
  if (!digits) return "";
  return parseInt(digits, 10).toLocaleString("id-ID");
}
function rpNum(val) {
  return parseInt(String(val || "").replace(/\D/g, ""), 10) || 0;
}
async function hashPassword(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
window.hashPassword = hashPassword;

// ── SIMPAN PASSWORD ASLI KE COLLECTION "akun" (buat ditampilkan di UI) ──
async function simpanAkunPassword(cabangId, passwordAsli, namaCabang) {
  try {
    await window.setDoc(window.doc(window.db, "akun", cabangId), {
      idCabang: cabangId,
      password: passwordAsli,
      kantorCabang: namaCabang
    }, { merge: true });
  } catch (err) {
    console.error("❌ simpanAkunPassword:", err);
  }
}
document.addEventListener("input", e => {
  if (e.target.matches(".rp-input")) {
    const fromEnd = e.target.value.length - e.target.selectionStart;
    e.target.value = rpFormat(e.target.value);
    const pos = Math.max(0, e.target.value.length - fromEnd);
    e.target.setSelectionRange(pos, pos);
  }
});

// ── FOTO POPUP ──
function openFotoPopup(url) {
  const existing = document.getElementById("fotoPopupOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "fotoPopupOverlay";
  overlay.className = "foto-popup-overlay";

  overlay.innerHTML = `
    <div class="foto-popup-wrap">
      <img id="fotoPopupImg" src="${url}" class="foto-popup-img">
      <button id="fotoPopupClose" class="foto-popup-close">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  document.getElementById("fotoPopupClose").onclick = () => closePopup();
  overlay.onclick = e => { if (e.target === overlay) closePopup(); };

  function closePopup() {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 250);
  }

  const img = document.getElementById("fotoPopupImg");
  let scale = 1, lastScale = 1, startDist = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0, posX = 0, posY = 0;

  function getDistance(t) {
    return Math.sqrt((t[0].clientX-t[1].clientX)**2 + (t[0].clientY-t[1].clientY)**2);
  }
  function applyTransform() {
    img.style.transform = `translate(${posX}px,${posY}px) scale(${scale})`;
  }

  img.addEventListener("touchstart", e => {
    if (e.touches.length === 2) { startDist = getDistance(e.touches); lastScale = scale; }
    else if (e.touches.length === 1 && scale > 1) {
      isDragging = true;
      dragStartX = e.touches[0].clientX - posX;
      dragStartY = e.touches[0].clientY - posY;
    }
  }, { passive: true });

  img.addEventListener("touchmove", e => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      scale = Math.min(Math.max(lastScale * (getDistance(e.touches) / startDist), 1), 4);
      applyTransform();
    } else if (e.touches.length === 1 && isDragging) {
      posX = e.touches[0].clientX - dragStartX;
      posY = e.touches[0].clientY - dragStartY;
      applyTransform();
    }
  }, { passive: true });

  img.addEventListener("touchend", e => {
    if (e.touches.length < 2) isDragging = false;
    if (scale <= 1) { scale = 1; posX = 0; posY = 0; applyTransform(); }
  }, { passive: true });

  let lastTap = 0;
  img.addEventListener("touchend", () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      scale = scale > 1 ? 1 : 2.5;
      posX = 0; posY = 0;
      img.style.transition = "transform 0.25s ease";
      applyTransform();
      setTimeout(() => { img.style.transition = "transform 0.1s ease"; }, 300);
    }
    lastTap = now;
  }, { passive: true });
}
window.openFotoPopup = openFotoPopup;

// ── INIT ──
window.initCabangView = async function () {
  await loadCabangList();
  initCabangSearch();
  initCabangBackBtn();
  initCabangAddBtn();
};

// ── LOAD LIST ──
async function loadCabangList() {
  const list = document.getElementById("cabangList");
  if (!list) return;

  list.innerHTML = [1,2,3].map(() => `
    <div class="cabang-sk-item">
      <div class="cabang-sk cabang-sk-foto"></div>
      <div class="cabang-sk-info">
        <div class="cabang-sk cabang-sk-nama"></div>
        <div class="cabang-sk cabang-sk-pt"></div>
      </div>
    </div>
  `).join("");

  try {
    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    cabangData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCabangList(cabangData);
  } catch(e) {
    list.innerHTML = `<div class="cabang-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── RENDER LIST ──
function renderCabangList(data) {
  const list = document.getElementById("cabangList");
  if (!list) return;
  if (!data.length) {
    list.innerHTML = `<div class="cabang-empty-msg">Belum ada cabang.</div>`;
    return;
  }
  list.innerHTML = data.map(c => `
    <div class="cabang-item ${activeCabangId === c.id ? 'active' : ''}" data-id="${c.id}" onclick="selectCabang('${c.id}')">
      ${c.fotoKantor
        ? `<img src="${c.fotoKantor}" class="cabang-item-foto">`
        : `<div class="cabang-item-foto-placeholder"><i class="fa-solid fa-building"></i></div>`
      }
      <div class="cabang-item-info">
        <div class="cabang-item-nama">${c.namaCabang || "-"}</div>
        <div class="cabang-item-pt">${c.namaPt || "-"}</div>
      </div>
      <i class="fa-solid fa-chevron-right cabang-item-arrow"></i>
    </div>
  `).join("");
}

// ── SELECT CABANG ──
window.selectCabang = function(id) {
  activeCabangId = id;
  const cabang = cabangData.find(c => c.id === id);
  if (!cabang) return;

  document.querySelectorAll(".cabang-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  const empty   = document.getElementById("cabangDetailEmpty");
  const content = document.getElementById("cabangDetailContent");
  const panel   = document.getElementById("cabangDetailPanel");
  const wrapper = panel?.closest(".cabang-detail-wrapper");

  const wasOpen = wrapper?.classList.contains("show");
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");
  if (!wasOpen) window.pusatPushDetailState?.("cabang");

  if (window.innerWidth <= 768) {
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  const el = id => document.getElementById(id);
  if (el("cabangDetailNama"))   el("cabangDetailNama").textContent   = cabang.namaCabang || "-";
  if (el("cabangDetailPt"))     el("cabangDetailPt").textContent     = cabang.namaPt || "-";
  if (el("cabangDetailAlamat")) el("cabangDetailAlamat").textContent = cabang.alamatCabang || "-";

  const foto            = el("cabangDetailFoto");
  const fotoPlaceholder = el("cabangDetailFotoPlaceholder");
  if (cabang.fotoKantor) {
    if (foto) { foto.src = cabang.fotoKantor; foto.style.display = "block"; foto.style.cursor = "pointer"; foto.onclick = () => openFotoPopup(cabang.fotoKantor); }
    if (fotoPlaceholder) fotoPlaceholder.style.display = "none";
  } else {
    if (foto) foto.style.display = "none";
    if (fotoPlaceholder) fotoPlaceholder.style.display = "flex";
  }

  setActiveTab("info", cabang);
  initCabangTabs(cabang);
  initCabangActions(cabang);
};

// ── TABS ──
function initCabangTabs(cabang) {
  document.querySelectorAll(".cabang-tab").forEach(tab => {
    tab.onclick = () => setActiveTab(tab.dataset.tab, cabang);
  });
}

function setActiveTab(tabName, cabang) {
  document.querySelectorAll(".cabang-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  renderTabContent(tabName, cabang);
}

window.setActiveTabExternal = function(tabName, cabang) {
  setActiveTab(tabName, cabang);
};

function renderTabContent(tab, c) {
  const body = document.getElementById("cabangTabBody");
  if (!body) return;

  if (tab === "info") {
    body.innerHTML = `
      <div class="tab-card">
        <div class="tab-section-title">Informasi Umum</div>
        <div class="tab-row"><span class="tab-row-label">Nama Cabang</span><span class="tab-row-value">${c.namaCabang || "-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Nama PT</span><span class="tab-row-value">${c.namaPt || "-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Alamat</span><span class="tab-row-value tab-row-value--wrap">${c.alamatCabang || "-"}</span></div>
        <div class="tab-row">
          <span class="tab-row-label">Lokasi Cabang</span>
          <span class="tab-row-value">
            <button class="btn-lihat-peta" onclick="
              ${c.lokasiCabang?.latitude
                ? `window.openCabangMap(${JSON.stringify(c).replace(/"/g, '&quot;')})`
                : `showWarning(['Lokasi cabang belum diatur. Silakan edit tab Info untuk mengatur lokasi.'])`
              }">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Lihat Peta
            </button>
          </span>
        </div>
        <div class="tab-row"><span class="tab-row-label">Password Page</span><span class="tab-row-value" id="infoPagePasswordVal">Memuat...</span></div>
        <div class="tab-row">
          <span class="tab-row-label">Akun Cabang</span>
          <span class="tab-row-value">
            <button class="btn-lihat-peta" onclick="window.bukaAkunCabang('${c.id}')">
              <i class="fa-solid fa-users"></i> Kelola Akun
            </button>
          </span>
        </div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Hari Libur</div>
        <div class="tab-row"><span class="tab-row-label">Distribusi</span><span class="tab-row-value">${c.hariLibur?.distribusi || "-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Produksi</span><span class="tab-row-value">${c.hariLibur?.produksi || "-"}</span></div>
      </div>
    `;
    loadAkunPasswordDisplay(c.id);
  }

  else if (tab === "operasional") {
    const varian = c.varian || {};
    const harga  = c.harga  || {};
    const pengeluaran = c.pengeluaran || {};
    const pengeluaranDistribusi = c.pengeluaranDistribusi || {};
    const loyang = c.loyang || [];
    const potongan = c.potongan || {};
    body.innerHTML = `
      <div class="tab-card">
        <div class="tab-section-title">Varian & Harga</div>
        ${Object.keys(varian).map(k => `
          <div class="tab-row">
            <span class="tab-row-label">${varian[k]} (${k})</span>
            <span class="tab-row-value">${(harga[k]||0).toLocaleString("id-ID")}</span>
          </div>
        `).join("")}
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Upah</div>
        <div class="tab-row"><span class="tab-row-label">Upah Harian</span><span class="tab-row-value">${(c.upahHarian||0).toLocaleString("id-ID")}</span></div>
        <div class="tab-row"><span class="tab-row-label">Upah Hunter</span><span class="tab-row-value">${(c.upahHunter||0).toLocaleString("id-ID")}</span></div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Pengeluaran Fix</div>
        ${(pengeluaran.fix||[]).map(item => `
          <div class="tab-row"><span class="tab-row-label">${item}</span><span class="tab-row-value">-</span></div>
        `).join("")}
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Pengeluaran Variable</div>
        ${(pengeluaran.variable||[]).map(item => `
          <div class="tab-row">
            <span class="tab-row-label">${item.jenis}</span>
            <span class="tab-row-value">${(item.harga||0).toLocaleString("id-ID")}</span>
          </div>
        `).join("")}
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Loyang</div>
        ${loyang.map(item => `
          <div class="tab-row">
            <span class="tab-row-label">${item.jenisLoyang || "-"} ${item.status ? "" : "(Nonaktif)"}</span>
            <span class="tab-row-value">Upah: ${(item.upah||0).toLocaleString("id-ID")} · Harga Paket: ${(item.hargaPaket||0).toLocaleString("id-ID")}</span>
          </div>
        `).join("")}
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Estimasi Loyang (Kapasitas per Varian)</div>
        ${Object.keys(c.estimasi || {}).length
          ? Object.entries(c.estimasi || {}).map(([key, capMap]) => `
              <div class="tab-row">
                <span class="tab-row-label">${key.replace(/^loyang/i, "")}</span>
                <span class="tab-row-value">${Object.entries(capMap).map(([kode, kap]) => `${kode}: ${kap}`).join(" · ") || "-"}</span>
              </div>
            `).join("")
          : `<div class="tab-row"><span class="tab-row-label">Belum diatur</span><span class="tab-row-value">-</span></div>`
        }
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Bonus Admin (Efisiensi Produksi)</div>
        ${(c.bonusAdmin || []).length
          ? c.bonusAdmin.map((item, i) => `
              <div class="tab-row">
                <span class="tab-row-label">Rule ${i + 1}</span>
                <span class="tab-row-value">Target: &lt;${item.target ?? 0}% · Bonus: ${item.bonus ?? 0}%</span>
              </div>
            `).join("")
          : `<div class="tab-row"><span class="tab-row-label">Belum diatur</span><span class="tab-row-value">-</span></div>`
        }
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Bonus Produksi (Efisiensi Produksi)</div>
        ${(c.bonusProduksi || []).length
          ? c.bonusProduksi.map((item, i) => `
              <div class="tab-row">
                <span class="tab-row-label">Rule ${i + 1}</span>
                <span class="tab-row-value">Patokan: ${item.patokan ?? 0} · Bonus: ${item.bonus ?? 0}%</span>
              </div>
            `).join("")
          : `<div class="tab-row"><span class="tab-row-label">Belum diatur</span><span class="tab-row-value">-</span></div>`
        }
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Pengeluaran Distribusi (Fix)</div>
        ${(pengeluaranDistribusi.fix||[]).map(item => `
          <div class="tab-row"><span class="tab-row-label">${item}</span><span class="tab-row-value">-</span></div>
        `).join("")}
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Pengeluaran Distribusi (Variable)</div>
        ${(pengeluaranDistribusi.variable||[]).map(item => `
          <div class="tab-row">
            <span class="tab-row-label">${item.jenis}</span>
            <span class="tab-row-value">${(item.harga||0).toLocaleString("id-ID")}</span>
          </div>
        `).join("")}
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Potongan</div>
        <div class="tab-row"><span class="tab-row-label">Kelipatan Upah - Batas</span><span class="tab-row-value">${potongan.kelipatanUpah?.batas ?? "-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Kelipatan Upah - Kelipatan</span><span class="tab-row-value">${potongan.kelipatanUpah?.kelipatan ?? "-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Kelipatan Upah - Potongan</span><span class="tab-row-value">${(potongan.kelipatanUpah?.potonganUpah||0).toLocaleString("id-ID")}</span></div>
        <div class="tab-row"><span class="tab-row-label">Setengah Upah - Batas</span><span class="tab-row-value">${potongan.setengahUpah?.batas ?? "-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Setengah Upah - Potongan</span><span class="tab-row-value">${(potongan.setengahUpah?.potonganUpah||0).toLocaleString("id-ID")}</span></div>
      </div>
    `;
  }

  else if (tab === "bonus") {
    const bonus  = c.bonus  || {};
    const margin = bonus.margin || {};
    body.innerHTML = `
      <div class="tab-card">
        <div class="tab-section-title">Bonus Data</div>
        <div class="tab-row"><span class="tab-row-label">Target Customer</span><span class="tab-row-value">${bonus.data?.targetCustomer||"-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Insentif</span><span class="tab-row-value">${(bonus.data?.insentif||0).toLocaleString("id-ID")}</span></div>
        <div class="tab-row"><span class="tab-row-label">Kehadiran</span><span class="tab-row-value">${(bonus.kehadiran||0).toLocaleString("id-ID")}</span></div>
        <div class="tab-row"><span class="tab-row-label">Ketentuan</span><span class="tab-row-value">${bonus.ketentuan||"-"} hari</span></div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Bonus Customer</div>
        <div class="tab-row"><span class="tab-row-label">Target</span><span class="tab-row-value">${bonus.customer?.target||"-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Kelipatan</span><span class="tab-row-value">${bonus.customer?.kelipatan||"-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Uang</span><span class="tab-row-value">${(bonus.customer?.uang||0).toLocaleString("id-ID")}</span></div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Bonus Margin</div>
        ${Object.keys(margin).map(tier => `
          <div class="tab-row">
            <span class="tab-row-label tab-row-label--capitalize">${tier}</span>
            <span class="tab-row-value">${margin[tier].minimal}-${margin[tier].maksimal} → ${(margin[tier].uang||0).toLocaleString("id-ID")}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  else if (tab === "trikotomi") {
    const trik = c.trikotomi || {};
    body.innerHTML = `
      ${["produktif","stabil","nonProduktif"].map(k => `
        <div class="tab-card">
          <div class="tab-section-title tab-section-title--capitalize">${k}</div>
          <div class="tab-row"><span class="tab-row-label">Expired</span><span class="tab-row-value">${trik[k]?.expired?.min??"-"} - ${trik[k]?.expired?.max??"-"}</span></div>
          <div class="tab-row"><span class="tab-row-label">Return</span><span class="tab-row-value">${trik[k]?.return?.min??"-"} - ${trik[k]?.return?.max??"-"}</span></div>
        </div>
      `).join("")}
      <div class="tab-card">
        <div class="tab-section-title">Target</div>
        <div class="tab-row"><span class="tab-row-label">Expired</span><span class="tab-row-value">${c.target?.expired||"-"}%</span></div>
      </div>
    `;
  }

  else if (tab === "owner") {
    body.innerHTML = `<div class="cabang-loading-msg">Memuat data owner...</div>`;
    loadOwnerData(c.id);
  }
}
async function loadAkunPasswordDisplay(cabangId) {
  const el = document.getElementById("infoPagePasswordVal");
  if (!el) return;
  try {
    const snap = await window.getDoc(window.doc(window.db, "akun", cabangId));
    el.textContent = snap.exists() ? (snap.data()?.password || "-") : "-";
  } catch (err) {
    console.error("❌ loadAkunPasswordDisplay:", err);
    el.textContent = "-";
  }
}

// ── LOAD OWNER ──
async function loadOwnerData(cabangId) {
  const body = document.getElementById("cabangTabBody");
  try {
    const snap = await window.getDocs(
      window.query(window.collection(window.db, "ownerMitra"), window.where("idCabang", "==", cabangId))
    );
    if (snap.empty) {
      body.innerHTML = `<div class="cabang-empty-msg">Belum ada data owner.</div>`;
      return;
    }
    const o   = snap.docs[0].data();
    const tgl = o.tanggalLahir?.toDate
      ? o.tanggalLahir.toDate().toLocaleDateString("id-ID", { day:"2-digit", month:"long", year:"numeric" })
      : "-";
    body.innerHTML = `
      <div class="owner-profile">
        ${o.fotoOwner
          ? `<img src="${o.fotoOwner}" class="owner-foto" onclick="openFotoPopup('${o.fotoOwner}')">`
          : `<div class="owner-foto-placeholder"><i class="fa-solid fa-user"></i></div>`
        }
        <div class="owner-profile-info">
          <div class="owner-profile-nama">${o.namaOwner||"-"}</div>
          <div class="owner-profile-email">${o.email||"-"}</div>
        </div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Data Owner Mitra</div>
        <div class="tab-row"><span class="tab-row-label">No HP</span><span class="tab-row-value">${o.noHp||"-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Alamat</span><span class="tab-row-value tab-row-value--wrap">${o.alamat||"-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Tempat Lahir</span><span class="tab-row-value">${o.tempatLahir||"-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Tanggal Lahir</span><span class="tab-row-value">${tgl}</span></div>
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<div class="cabang-empty-msg">Gagal memuat owner.</div>`;
  }
}

// ── SEARCH ──
function initCabangSearch() {
  const input = document.getElementById("cabangSearch");
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    renderCabangList(cabangData.filter(c =>
      (c.namaCabang||"").toLowerCase().includes(q) ||
      (c.namaPt||"").toLowerCase().includes(q)
    ));
  });
}

// ── BACK BTN ──
function initCabangBackBtn() {
  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (window.innerWidth <= 768 && history.state?.pusatDetail === "cabang") {
      history.back(); // biar popstate yang urus, state konsisten
      return;
    }
    document.getElementById("cabangDetailPanel")?.closest(".cabang-detail-wrapper")?.classList.remove("show");
    document.getElementById("topbarBackBtn").style.display = "none";
    activeCabangId = null;
    document.querySelectorAll(".cabang-item").forEach(el => el.classList.remove("active"));
  });
}

// ── ACTIONS ──
function initCabangActions(cabang) {
  document.getElementById("cabangEditBtn")?.addEventListener("click", () => {
    const activeTab = document.querySelector(".cabang-tab.active")?.dataset.tab || "info";
    openEditTab(activeTab, cabang);
  });

  document.getElementById("cabangHapusBtn")?.addEventListener("click", () => {
    showConfirmHapus(cabang);
  });
}
// ── CONFIRM HAPUS ──
function showConfirmHapus(cabang) {
  const existing = document.getElementById("confirmOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "confirmOverlay";
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon">
        <i class="fa-solid fa-lock"></i>
      </div>
      <div class="confirm-title">Konfirmasi Hapus</div>
      <div class="confirm-msg">
        Masukkan password akun kamu untuk menghapus <strong>${cabang.namaCabang}</strong>.
      </div>
      <div class="confirm-warning">
        <i class="fa-solid fa-triangle-exclamation"></i>
        Tindakan ini tidak bisa dibatalkan!
      </div>
      <div class="confirm-pass-wrap">
        <input type="password" id="confirmPassInput" class="edit-field-input" placeholder="Password akun kamu...">
        <div class="confirm-pass-error" id="confirmPassError"></div>
      </div>
      <div class="confirm-actions">
        <button class="btn-batal" id="confirmBatal">Batal</button>
        <button class="btn-hapus" id="confirmHapus">
          <i class="fa-solid fa-trash"></i> Hapus
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  setTimeout(() => document.getElementById("confirmPassInput")?.focus(), 300);

  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  };

  document.getElementById("confirmBatal").onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };

  document.getElementById("confirmPassInput").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("confirmHapus").click();
  });

  document.getElementById("confirmHapus").onclick = async () => {
    const btn      = document.getElementById("confirmHapus");
    const passInput = document.getElementById("confirmPassInput");
    const errEl    = document.getElementById("confirmPassError");
    const password = passInput.value;

    if (!password) {
      errEl.textContent = "Password tidak boleh kosong.";
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi...`;
    errEl.textContent = "";

    try {
      // Re-authenticate
      const user       = window.auth.currentUser;
      const credential = window.EmailAuthProvider.credential(user.email, password);
      await window.reauthenticateWithCredential(user, credential);

      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menghapus...`;

      // Hapus foto kantor
      try {
        await window.deleteObject(window.storageRef(window.storage, `fotoKantor/${cabang.id}.jpg`));
      } catch(e) {}

      // Hapus owner + foto owner
      try {
        const ownerSnap = await window.getDocs(
          window.query(window.collection(window.db, "ownerMitra"), window.where("idCabang", "==", cabang.id))
        );
        for (const ownerDoc of ownerSnap.docs) {
          try {
            await window.deleteObject(window.storageRef(window.storage, `fotoOwner/${ownerDoc.id}.jpg`));
          } catch(e) {}
          await window.deleteDoc(window.doc(window.db, "ownerMitra", ownerDoc.id));
        }
      } catch(e) { console.error("hapus owner:", e); }

      // Hapus kantorCabang
      await window.deleteDoc(window.doc(window.db, "kantorCabang", cabang.id));

      cabangData = cabangData.filter(c => c.id !== cabang.id);
      renderCabangList(cabangData);
      activeCabangId = null;

      document.getElementById("cabangDetailEmpty").style.display   = "flex";
      document.getElementById("cabangDetailContent").style.display = "none";
      document.getElementById("cabangDetailPanel")?.closest(".cabang-detail-wrapper")?.classList.remove("show");
      document.getElementById("topbarBackBtn").style.display = "none";

      close();

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-trash"></i> Hapus`;

      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        errEl.textContent = "Password salah, coba lagi.";
      } else if (e.code === "auth/too-many-requests") {
        errEl.textContent = "Terlalu banyak percobaan, coba lagi nanti.";
      } else {
        errEl.textContent = "Gagal memverifikasi, coba lagi.";
      }
      passInput.value = "";
      passInput.focus();
    }
  };
}
// ── WARNING POPUP ──
function showWarning(items) {
  const existing = document.getElementById("warningOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "warningOverlay";
  overlay.className = "warning-overlay";
  overlay.innerHTML = `
    <div class="warning-box">
      <div class="warning-icon">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <div class="warning-title">Lengkapi Data Dulu</div>
      <ul class="warning-list">
        ${items.map(item => `
          <li><i class="fa-solid fa-circle-exclamation"></i> ${item}</li>
        `).join("")}
      </ul>
      <button class="warning-btn-ok" id="warningOk">Oke, Saya Lengkapi</button>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  const close = () => {
    overlay.classList.remove("show");
    setTimeout(() => overlay.remove(), 200);
  };

  document.getElementById("warningOk").onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
}
// ── VALIDASI PER STEP ──
function validateStep(step, newData, tempLokasi, tempFotoKantorBlob, tempFotoOwnerBlob) {
  const errors = [];
  const g = id => document.getElementById(id)?.value?.trim() || "";

  if (step === 1) {
    if (!tempFotoKantorBlob && !newData.info.fotoKantor) errors.push("Foto kantor belum dipilih");
    if (!g("addNamaCabang"))  errors.push("Nama Cabang belum diisi");
    if (!g("addNamaPt"))      errors.push("Nama PT belum diisi");
    if (!g("addAlamat"))      errors.push("Alamat belum diisi");
    if (!g("addPassword"))    errors.push("Password Page belum diisi");
    if (!tempLokasi.latitude) errors.push("Lokasi cabang belum dipilih");
  }

  else if (step === 2) {
    const op = newData.operasional;
    if (Object.keys(op.varian).length === 0) errors.push("Minimal 1 varian harus diisi");
    Object.keys(op.varian).forEach(k => {
      if (!op.varian[k]) errors.push(`Nama varian "${k}" belum diisi`);
    });
    if (!document.getElementById("addUpahHarian")?.value) errors.push("Upah Harian belum diisi");
    if (!document.getElementById("addUpahHunter")?.value) errors.push("Upah Hunter belum diisi");
    if (op.pengeluaran.fix.length === 0)      errors.push("Minimal 1 pengeluaran fix harus diisi");
    if (op.pengeluaran.variable.length === 0) errors.push("Minimal 1 pengeluaran variable harus diisi");
    op.pengeluaran.variable.forEach((item, i) => {
      if (!item.jenis) errors.push(`Jenis pengeluaran variable #${i+1} belum diisi`);
    });
  }

  else if (step === 3) {
    if (!document.getElementById("addBonusTargetCustomer")?.value) errors.push("Target Customer belum diisi");
    if (!document.getElementById("addBonusInsentif")?.value)       errors.push("Insentif belum diisi");
    if (!document.getElementById("addBonusKehadiran")?.value)      errors.push("Kehadiran belum diisi");
    if (!document.getElementById("addBonusKetentuan")?.value)      errors.push("Ketentuan belum diisi");
    if (!document.getElementById("addBonusCustTarget")?.value)     errors.push("Target Customer bonus belum diisi");
    if (!document.getElementById("addBonusCustKelipatan")?.value)  errors.push("Kelipatan bonus belum diisi");
    if (!document.getElementById("addBonusCustUang")?.value)       errors.push("Uang bonus customer belum diisi");
    const b = newData.bonus;
    Object.keys(b.margin).forEach(tier => {
      if (!document.getElementById(`addMargin_${tier}_min`)?.value)  errors.push(`Margin ${tier} Min belum diisi`);
      if (!document.getElementById(`addMargin_${tier}_max`)?.value)  errors.push(`Margin ${tier} Max belum diisi`);
      if (!document.getElementById(`addMargin_${tier}_uang`)?.value) errors.push(`Margin ${tier} Uang belum diisi`);
    });
  }

  else if (step === 4) {
    ["produktif","stabil","nonProduktif"].forEach(k => {
      if (!document.getElementById(`addTrik_${k}_exp_min`)?.value) errors.push(`${k} Expired Min belum diisi`);
      if (!document.getElementById(`addTrik_${k}_exp_max`)?.value) errors.push(`${k} Expired Max belum diisi`);
      if (!document.getElementById(`addTrik_${k}_ret_min`)?.value) errors.push(`${k} Return Min belum diisi`);
      if (!document.getElementById(`addTrik_${k}_ret_max`)?.value) errors.push(`${k} Return Max belum diisi`);
    });
    if (!document.getElementById("addTargetExpired")?.value) errors.push("Target Expired belum diisi");
  }

  else if (step === 5) {
    if (!tempFotoOwnerBlob && !newData.owner.fotoOwner) errors.push("Foto owner belum dipilih");
    if (!g("addOwnerNama"))   errors.push("Nama Owner belum diisi");
    if (!g("addOwnerNoHp"))   errors.push("No HP belum diisi");
    if (!g("addOwnerEmail"))  errors.push("Email belum diisi");
    if (!g("addOwnerAlamat")) errors.push("Alamat owner belum diisi");
    if (!g("addOwnerTempat")) errors.push("Tempat Lahir belum diisi");
    if (!document.getElementById("addOwnerTanggal")?.value) errors.push("Tanggal Lahir belum diisi");
  }

  return errors;
}
// ── EDIT TAB ──
function openEditTab(tab, cabang) {
  if (tab === "info")             renderEditInfo(cabang);
  else if (tab === "operasional") renderEditOperasional(cabang);
  else if (tab === "bonus")       renderEditBonus(cabang);
  else if (tab === "trikotomi")   renderEditTrikotomi(cabang);
  else if (tab === "owner")       renderEditOwner(cabang);
}
// ── EDIT OPERASIONAL ──
function renderEditOperasional(cabang) {
  const body = document.getElementById("cabangTabBody");
  if (!body) return;

  const varian      = { ...( cabang.varian      || {}) };
  const harga       = { ...( cabang.harga        || {}) };
  const penFix      = [...( cabang.pengeluaran?.fix      || [])];
  const penVariable = [...( cabang.pengeluaran?.variable || [])];
  const loyang         = JSON.parse(JSON.stringify(cabang.loyang || []));
  const estimasi       = JSON.parse(JSON.stringify(cabang.estimasi || {}));
  const bonusAdmin     = JSON.parse(JSON.stringify(cabang.bonusAdmin || []));
  const bonusProduksi  = JSON.parse(JSON.stringify(cabang.bonusProduksi || []));
  const penDistFix     = [...(cabang.pengeluaranDistribusi?.fix || [])];
  const penDistVariable = JSON.parse(JSON.stringify(cabang.pengeluaranDistribusi?.variable || []));
  const potongan = JSON.parse(JSON.stringify(cabang.potongan || {
    kelipatanUpah: { batas: 0, kelipatan: 0, potonganUpah: 0 },
    setengahUpah:  { batas: 0, potonganUpah: 0 }
  }));

  function render() {
    body.innerHTML = `
      <div class="edit-form">

        <!-- VARIAN & HARGA -->
        <div class="tab-card">
          <div class="tab-section-title">Varian & Harga</div>
          <div id="editVarianList">
            ${Object.keys(varian).map(k => `
              <div class="edit-varian-row" data-key="${k}">
                <div class="edit-varian-fields">
                  <input class="edit-field-input edit-varian-kode" value="${k}" placeholder="Kode" data-original="${k}">
                  <input class="edit-field-input edit-varian-nama" value="${varian[k]}" placeholder="Nama">
                  <input class="edit-field-input edit-varian-harga rp-input" type="text" inputmode="numeric" value="${rpFormat(harga[k]||0)}" placeholder="Harga">
                </div>
                <button class="btn-hapus-row" data-key="${k}"><i class="fa-solid fa-trash"></i></button>
              </div>
            `).join("")}
          </div>
          <button class="btn-tambah-row" id="btnTambahVarian">
            <i class="fa-solid fa-plus"></i> Tambah Varian
          </button>
        </div>

        <!-- UPAH -->
        <div class="tab-card">
          <div class="tab-section-title">Upah</div>
          <div class="edit-field">
            <div class="edit-field-label">Upah Harian</div>
            <input id="editUpahHarian" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(cabang.upahHarian || 0)}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Upah Hunter</div>
            <input id="editUpahHunter" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(cabang.upahHunter || 0)}">
          </div>
        </div>

        <!-- PENGELUARAN FIX -->
        <div class="tab-card">
          <div class="tab-section-title">Pengeluaran Fix</div>
          <div id="editPenFixList">
            ${penFix.map((item, i) => `
              <div class="edit-pen-fix-row" data-index="${i}">
                <input class="edit-field-input edit-pen-fix-input" value="${item}" placeholder="Nama pengeluaran..." data-index="${i}">
                <button class="btn-hapus-row btn-hapus-fix" data-index="${i}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            `).join("")}
          </div>
          <div class="edit-pen-fix-add">
            <input id="editPenFixInput" class="edit-field-input" placeholder="Nama pengeluaran...">
            <button class="btn-tambah-row" id="btnTambahFix">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>

        <!-- PENGELUARAN VARIABLE -->
        <div class="tab-card">
          <div class="tab-section-title">Pengeluaran Variable</div>
          <div id="editPenVarList">
            ${penVariable.map((item, i) => `
              <div class="edit-varian-row" data-index="${i}">
                <div class="edit-varian-fields">
                  <input class="edit-field-input edit-pen-var-jenis" value="${item.jenis}" placeholder="Jenis" data-index="${i}">
                  <input class="edit-field-input edit-pen-var-harga rp-input" type="text" inputmode="numeric" value="${rpFormat(item.harga || 0)}" placeholder="Harga" data-index="${i}">
                </div>
                <button class="btn-hapus-row btn-hapus-var" data-index="${i}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            `).join("")}
          </div>
          <button class="btn-tambah-row" id="btnTambahVar">
            <i class="fa-solid fa-plus"></i> Tambah Variable
          </button>
        </div>

        <!-- LOYANG -->
        <div class="tab-card">
          <div class="tab-section-title">Loyang</div>
          <div id="editLoyangList">
            ${loyang.map((item, i) => `
              <div class="edit-varian-row" data-index="${i}">
                <div class="edit-varian-fields">
                  <input class="edit-field-input edit-loyang-jenis" value="${item.jenisLoyang||""}" placeholder="Jenis Loyang" data-index="${i}">
                  <input class="edit-field-input edit-loyang-upah rp-input" type="text" inputmode="numeric" value="${rpFormat(item.upah||0)}" placeholder="Upah" data-index="${i}">
                  <input class="edit-field-input edit-loyang-hargapaket rp-input" type="text" inputmode="numeric" value="${rpFormat(item.hargaPaket||0)}" placeholder="Harga Paket" data-index="${i}">
                  <label class="edit-loyang-status-label">
                    <input type="checkbox" class="edit-loyang-status" data-index="${i}" ${item.status !== false ? "checked" : ""}> Aktif
                  </label>
                </div>
                <button class="btn-hapus-row btn-hapus-loyang" data-index="${i}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            `).join("")}
          </div>
          <button class="btn-tambah-row" id="btnTambahLoyang">
            <i class="fa-solid fa-plus"></i> Tambah Loyang
          </button>
        </div>

        <!-- ESTIMASI LOYANG -->
        <div class="tab-card">
          <div class="tab-section-title">Estimasi Loyang (Kapasitas per Varian)</div>
          <div id="editEstimasiList">
            ${Object.keys(estimasi).map(groupKey => `
              <div class="edit-estimasi-group" data-group-key="${groupKey}">
                <div class="edit-estimasi-group-header">
                  <input class="edit-field-input edit-estimasi-group-name" value="${groupKey}" placeholder="Nama Grup (misal loyangOriginal)" data-group-key="${groupKey}">
                  <button class="btn-hapus-row btn-hapus-estimasi-group" data-group-key="${groupKey}"><i class="fa-solid fa-trash"></i></button>
                </div>
                <div class="edit-estimasi-varian-list">
                  ${Object.entries(estimasi[groupKey] || {}).map(([kode, kap]) => `
                    <div class="edit-estimasi-varian-row" data-group-key="${groupKey}" data-kode="${kode}">
                      <input class="edit-field-input edit-estimasi-kode" value="${kode}" placeholder="Kode Varian" data-group-key="${groupKey}" data-original-kode="${kode}">
                      <input type="number" min="0" class="edit-field-input edit-estimasi-kapasitas" value="${kap}" placeholder="Kapasitas" data-group-key="${groupKey}" data-kode="${kode}">
                      <button class="btn-hapus-row btn-hapus-estimasi-varian" data-group-key="${groupKey}" data-kode="${kode}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                  `).join("")}
                </div>
                <button class="btn-tambah-row btn-tambah-estimasi-varian" data-group-key="${groupKey}">
                  <i class="fa-solid fa-plus"></i> Tambah Varian
                </button>
              </div>
            `).join("")}
          </div>
          <button class="btn-tambah-row" id="btnTambahEstimasiGroup">
            <i class="fa-solid fa-plus"></i> Tambah Grup Loyang
          </button>
        </div>

        <!-- BONUS ADMIN (Efisiensi Produksi - adminCabang) -->
        <div class="tab-card">
          <div class="tab-section-title">Bonus Admin (Efisiensi Produksi)</div>
          <div id="editBonusAdminList">
            ${bonusAdmin.map((item, i) => `
              <div class="edit-bonus-row" data-index="${i}">
                <div class="edit-bonus-field">
                  <label class="edit-bonus-field-label">Target (di bawah %)</label>
                  <input type="number" min="0" class="edit-field-input edit-bonusadmin-target" value="${item.target ?? 0}" data-index="${i}">
                </div>
                <div class="edit-bonus-field">
                  <label class="edit-bonus-field-label">Bonus (%)</label>
                  <input type="number" min="0" class="edit-field-input edit-bonusadmin-bonus" value="${item.bonus ?? 0}" data-index="${i}">
                </div>
                <button class="btn-hapus-row btn-hapus-bonusadmin" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
              </div>
            `).join("")}
          </div>
          <button class="btn-tambah-row" id="btnTambahBonusAdmin">
            <i class="fa-solid fa-plus"></i> Tambah Rule
          </button>
        </div>

        <!-- BONUS PRODUKSI (Efisiensi Produksi - koki) -->
        <div class="tab-card">
          <div class="tab-section-title">Bonus Produksi (Efisiensi Produksi)</div>
          <div id="editBonusProduksiList">
            ${bonusProduksi.map((item, i) => `
              <div class="edit-bonus-row" data-index="${i}">
                <div class="edit-bonus-field">
                  <label class="edit-bonus-field-label">Patokan / Loyang</label>
                  <input type="number" min="0" class="edit-field-input edit-bonusprod-patokan" value="${item.patokan ?? 0}" data-index="${i}">
                </div>
                <div class="edit-bonus-field">
                  <label class="edit-bonus-field-label">Bonus (%)</label>
                  <input type="number" min="0" class="edit-field-input edit-bonusprod-bonus" value="${item.bonus ?? 0}" data-index="${i}">
                </div>
                <button class="btn-hapus-row btn-hapus-bonusprod" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
              </div>
            `).join("")}
          </div>
          <button class="btn-tambah-row" id="btnTambahBonusProduksi">
            <i class="fa-solid fa-plus"></i> Tambah Rule
          </button>
        </div>

        <!-- PENGELUARAN DISTRIBUSI FIX -->
        <div class="tab-card">
          <div class="tab-section-title">Pengeluaran Distribusi (Fix)</div>
          <div id="editPenDistFixList">
            ${penDistFix.map((item, i) => `
              <div class="edit-pen-fix-row" data-index="${i}">
                <input class="edit-field-input edit-pendist-fix-input" value="${item}" placeholder="Nama pengeluaran..." data-index="${i}">
                <button class="btn-hapus-row btn-hapus-pendist-fix" data-index="${i}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            `).join("")}
          </div>
          <div class="edit-pen-fix-add">
            <input id="editPenDistFixInput" class="edit-field-input" placeholder="Nama pengeluaran...">
            <button class="btn-tambah-row" id="btnTambahPenDistFix">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>

        <!-- PENGELUARAN DISTRIBUSI VARIABLE -->
        <div class="tab-card">
          <div class="tab-section-title">Pengeluaran Distribusi (Variable)</div>
          <div id="editPenDistVarList">
            ${penDistVariable.map((item, i) => `
              <div class="edit-varian-row" data-index="${i}">
                <div class="edit-varian-fields">
                  <input class="edit-field-input edit-pendist-var-jenis" value="${item.jenis}" placeholder="Jenis" data-index="${i}">
                  <input class="edit-field-input edit-pendist-var-harga rp-input" type="text" inputmode="numeric" value="${rpFormat(item.harga || 0)}" placeholder="Harga" data-index="${i}">
                </div>
                <button class="btn-hapus-row btn-hapus-pendist-var" data-index="${i}">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            `).join("")}
          </div>
          <button class="btn-tambah-row" id="btnTambahPenDistVar">
            <i class="fa-solid fa-plus"></i> Tambah Variable
          </button>
        </div>

        <!-- POTONGAN -->
        <div class="tab-card">
          <div class="tab-section-title">Potongan</div>
          <div class="edit-field">
            <div class="edit-field-label">Kelipatan Upah - Batas</div>
            <input id="editPotKelipatanBatas" type="number" class="edit-field-input" value="${potongan.kelipatanUpah?.batas||0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Kelipatan Upah - Kelipatan</div>
            <input id="editPotKelipatanKelipatan" type="number" class="edit-field-input" value="${potongan.kelipatanUpah?.kelipatan||0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Kelipatan Upah - Potongan (Rp)</div>
            <input id="editPotKelipatanPotongan" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(potongan.kelipatanUpah?.potonganUpah||0)}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Setengah Upah - Batas</div>
            <input id="editPotSetengahBatas" type="number" class="edit-field-input" value="${potongan.setengahUpah?.batas||0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Setengah Upah - Potongan (Rp)</div>
            <input id="editPotSetengahPotongan" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(potongan.setengahUpah?.potonganUpah||0)}">
          </div>
        </div>

        <!-- ACTIONS -->
        <div class="edit-actions">
          <button class="btn-batal" id="editOpBatal">Batal</button>
          <button class="btn-simpan" id="editOpSimpan">
            <i class="fa-solid fa-floppy-disk"></i> Simpan
          </button>
        </div>

      </div>
    `;

    // ── VARIAN events ──
    document.getElementById("btnTambahVarian").onclick = () => {
      varian[""] = "";
      harga[""]  = 0;
      render();
    };

    document.querySelectorAll(".btn-hapus-row[data-key]").forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        delete varian[key];
        delete harga[key];
        render();
      };
    });

    document.querySelectorAll(".edit-varian-row[data-key]").forEach(row => {
      const oldKey  = row.dataset.key;
      const kodeEl  = row.querySelector(".edit-varian-kode");
      const namaEl  = row.querySelector(".edit-varian-nama");
      const hargaEl = row.querySelector(".edit-varian-harga");

      kodeEl.oninput  = () => { const nk = kodeEl.value.toUpperCase(); delete varian[oldKey]; delete harga[oldKey]; varian[nk] = namaEl.value; harga[nk] = rpNum(hargaEl.value); row.dataset.key = nk; };
      namaEl.oninput  = () => { varian[kodeEl.value.toUpperCase()] = namaEl.value; };
      hargaEl.oninput = () => { harga[kodeEl.value.toUpperCase()]  = rpNum(hargaEl.value); };
    });

    // ── PENGELUARAN FIX events ──
    document.getElementById("btnTambahFix").onclick = () => {
      penFix.push("");
      render();
    };

    document.querySelectorAll(".btn-hapus-fix").forEach(btn => {
      btn.onclick = () => {
        penFix.splice(parseInt(btn.dataset.index), 1);
        render();
      };
    });

    document.querySelectorAll(".edit-pen-fix-input").forEach(el => {
      el.oninput = () => { penFix[parseInt(el.dataset.index)] = el.value; };
    });

    // ── PENGELUARAN VARIABLE events ──
    document.getElementById("btnTambahVar").onclick = () => {
      penVariable.push({ jenis: "", harga: 0 });
      render();
    };

    document.querySelectorAll(".btn-hapus-var").forEach(btn => {
      btn.onclick = () => {
        penVariable.splice(parseInt(btn.dataset.index), 1);
        render();
      };
    });

    document.querySelectorAll(".edit-pen-var-jenis").forEach(el => {
      el.oninput = () => { penVariable[parseInt(el.dataset.index)].jenis = el.value; };
    });
    document.querySelectorAll(".edit-pen-var-harga").forEach(el => {
      el.oninput = () => { penVariable[parseInt(el.dataset.index)].harga = rpNum(el.value); };
    });

    // ── LOYANG events ──
    document.getElementById("btnTambahLoyang").onclick = () => {
      loyang.push({ jenisLoyang: "", status: true, upah: 0, hargaPaket: 0 });
      render();
    };
    document.querySelectorAll(".btn-hapus-loyang").forEach(btn => {
      btn.onclick = () => { loyang.splice(parseInt(btn.dataset.index), 1); render(); };
    });
    document.querySelectorAll(".edit-loyang-jenis").forEach(el => {
      el.oninput = () => { loyang[parseInt(el.dataset.index)].jenisLoyang = el.value; };
    });
    document.querySelectorAll(".edit-loyang-upah").forEach(el => {
      el.oninput = () => { loyang[parseInt(el.dataset.index)].upah = rpNum(el.value); };
    });
    document.querySelectorAll(".edit-loyang-hargapaket").forEach(el => {
      el.oninput = () => { loyang[parseInt(el.dataset.index)].hargaPaket = rpNum(el.value); };
    });
    document.querySelectorAll(".edit-loyang-status").forEach(el => {
      el.onchange = () => { loyang[parseInt(el.dataset.index)].status = el.checked; };
    });

    // ── ESTIMASI LOYANG events ──
    document.getElementById("btnTambahEstimasiGroup").onclick = () => {
      let newKey = "loyangBaru", i = 1;
      while (newKey in estimasi) { newKey = `loyangBaru${i}`; i++; }
      estimasi[newKey] = {};
      render();
    };
    document.querySelectorAll(".btn-hapus-estimasi-group").forEach(btn => {
      btn.onclick = () => { delete estimasi[btn.dataset.groupKey]; render(); };
    });
    document.querySelectorAll(".edit-estimasi-group-name").forEach(el => {
      el.onchange = () => {
        const oldKey = el.dataset.groupKey;
        const newKey = el.value.trim();
        if (!newKey || newKey === oldKey) { render(); return; }
        estimasi[newKey] = estimasi[oldKey] || {};
        delete estimasi[oldKey];
        render();
      };
    });
    document.querySelectorAll(".btn-tambah-estimasi-varian").forEach(btn => {
      btn.onclick = () => {
        const groupKey = btn.dataset.groupKey;
        if (!estimasi[groupKey]) estimasi[groupKey] = {};
        let newKode = "KODE", i = 1;
        while (newKode in estimasi[groupKey]) { newKode = `KODE${i}`; i++; }
        estimasi[groupKey][newKode] = 0;
        render();
      };
    });
    document.querySelectorAll(".btn-hapus-estimasi-varian").forEach(btn => {
      btn.onclick = () => {
        const groupKey = btn.dataset.groupKey;
        if (estimasi[groupKey]) delete estimasi[groupKey][btn.dataset.kode];
        render();
      };
    });
    document.querySelectorAll(".edit-estimasi-kode").forEach(el => {
      el.onchange = () => {
        const groupKey = el.dataset.groupKey;
        const oldKode  = el.dataset.originalKode;
        const newKode  = el.value.trim().toUpperCase();
        if (!newKode || !estimasi[groupKey]) { render(); return; }
        const val = estimasi[groupKey][oldKode] || 0;
        delete estimasi[groupKey][oldKode];
        estimasi[groupKey][newKode] = val;
        render();
      };
    });
    document.querySelectorAll(".edit-estimasi-kapasitas").forEach(el => {
      el.oninput = () => {
        const groupKey = el.dataset.groupKey;
        const kode = el.dataset.kode;
        if (!estimasi[groupKey]) estimasi[groupKey] = {};
        estimasi[groupKey][kode] = parseInt(el.value) || 0;
      };
    });

    // ── BONUS ADMIN events ──
    document.getElementById("btnTambahBonusAdmin").onclick = () => {
      bonusAdmin.push({ target: 0, bonus: 0 });
      render();
    };
    document.querySelectorAll(".btn-hapus-bonusadmin").forEach(btn => {
      btn.onclick = () => { bonusAdmin.splice(parseInt(btn.dataset.index), 1); render(); };
    });
    document.querySelectorAll(".edit-bonusadmin-target").forEach(el => {
      el.oninput = () => { bonusAdmin[parseInt(el.dataset.index)].target = parseInt(el.value) || 0; };
    });
    document.querySelectorAll(".edit-bonusadmin-bonus").forEach(el => {
      el.oninput = () => { bonusAdmin[parseInt(el.dataset.index)].bonus = parseInt(el.value) || 0; };
    });

    // ── BONUS PRODUKSI events ──
    document.getElementById("btnTambahBonusProduksi").onclick = () => {
      bonusProduksi.push({ patokan: 0, bonus: 0 });
      render();
    };
    document.querySelectorAll(".btn-hapus-bonusprod").forEach(btn => {
      btn.onclick = () => { bonusProduksi.splice(parseInt(btn.dataset.index), 1); render(); };
    });
    document.querySelectorAll(".edit-bonusprod-patokan").forEach(el => {
      el.oninput = () => { bonusProduksi[parseInt(el.dataset.index)].patokan = parseInt(el.value) || 0; };
    });
    document.querySelectorAll(".edit-bonusprod-bonus").forEach(el => {
      el.oninput = () => { bonusProduksi[parseInt(el.dataset.index)].bonus = parseInt(el.value) || 0; };
    });

    // ── PENGELUARAN DISTRIBUSI FIX events ──
    document.getElementById("btnTambahPenDistFix").onclick = () => {
      penDistFix.push("");
      render();
    };
    document.querySelectorAll(".btn-hapus-pendist-fix").forEach(btn => {
      btn.onclick = () => { penDistFix.splice(parseInt(btn.dataset.index), 1); render(); };
    });
    document.querySelectorAll(".edit-pendist-fix-input").forEach(el => {
      el.oninput = () => { penDistFix[parseInt(el.dataset.index)] = el.value; };
    });

    // ── PENGELUARAN DISTRIBUSI VARIABLE events ──
    document.getElementById("btnTambahPenDistVar").onclick = () => {
      penDistVariable.push({ jenis: "", harga: 0 });
      render();
    };
    document.querySelectorAll(".btn-hapus-pendist-var").forEach(btn => {
      btn.onclick = () => { penDistVariable.splice(parseInt(btn.dataset.index), 1); render(); };
    });
    document.querySelectorAll(".edit-pendist-var-jenis").forEach(el => {
      el.oninput = () => { penDistVariable[parseInt(el.dataset.index)].jenis = el.value; };
    });
    document.querySelectorAll(".edit-pendist-var-harga").forEach(el => {
      el.oninput = () => { penDistVariable[parseInt(el.dataset.index)].harga = rpNum(el.value); };
    });

    // ── BATAL ──
    document.getElementById("editOpBatal").onclick = () => setActiveTab("operasional", cabang);

    // ── SIMPAN ──
    document.getElementById("editOpSimpan").onclick = async () => {
      const btn = document.getElementById("editOpSimpan");
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

      try {
        const varianFinal = {};
        const hargaFinal  = {};
        document.querySelectorAll(".edit-varian-row[data-key]").forEach(row => {
          const kode  = row.querySelector(".edit-varian-kode")?.value?.trim().toUpperCase();
          const nama  = row.querySelector(".edit-varian-nama")?.value?.trim();
          const hargaVal = rpNum(row.querySelector(".edit-varian-harga")?.value);
          if (kode && nama) {
            varianFinal[kode] = nama;
            hargaFinal[kode]  = hargaVal;
          }
        });

        const penVariableFinal = [];
        document.querySelectorAll(".edit-pen-var-jenis").forEach((el, i) => {
          const jenis = el.value?.trim();
          const hargaEl = document.querySelectorAll(".edit-pen-var-harga")[i];
          if (jenis) {
            penVariableFinal.push({
              jenis,
              harga: rpNum(hargaEl?.value)
            });
          }
        });

        const penDistVariableFinal = [];
        document.querySelectorAll(".edit-pendist-var-jenis").forEach((el, i) => {
          const jenis = el.value?.trim();
          const hargaEl = document.querySelectorAll(".edit-pendist-var-harga")[i];
          if (jenis) {
            penDistVariableFinal.push({
              jenis,
              harga: rpNum(hargaEl?.value)
            });
          }
        });

        const loyangFinal = [];
        document.querySelectorAll(".edit-loyang-jenis").forEach((el, i) => {
          const jenisLoyang = el.value?.trim();
          const upahEl       = document.querySelectorAll(".edit-loyang-upah")[i];
          const hargaPaketEl = document.querySelectorAll(".edit-loyang-hargapaket")[i];
          const statusEl     = document.querySelectorAll(".edit-loyang-status")[i];
          if (jenisLoyang) {
            loyangFinal.push({
              jenisLoyang,
              upah: rpNum(upahEl?.value),
              hargaPaket: rpNum(hargaPaketEl?.value),
              status: statusEl?.checked ?? true
            });
          }
        });

        const estimasiFinal      = JSON.parse(JSON.stringify(estimasi));
        const bonusAdminFinal    = JSON.parse(JSON.stringify(bonusAdmin));
        const bonusProduksiFinal = JSON.parse(JSON.stringify(bonusProduksi));

        const updates = {
          varian: varianFinal,
          harga:  hargaFinal,
          upahHarian: rpNum(document.getElementById("editUpahHarian").value),
          upahHunter: rpNum(document.getElementById("editUpahHunter").value),
          pengeluaran: { fix: penFix, variable: penVariableFinal },
          pengeluaranDistribusi: { fix: penDistFix, variable: penDistVariableFinal },
          loyang: loyangFinal,
          estimasi: estimasiFinal,
          bonusAdmin: bonusAdminFinal,
          bonusProduksi: bonusProduksiFinal,
          potongan: {
            kelipatanUpah: {
              batas:       parseInt(document.getElementById("editPotKelipatanBatas").value) || 0,
              kelipatan:   parseInt(document.getElementById("editPotKelipatanKelipatan").value) || 0,
              potonganUpah: rpNum(document.getElementById("editPotKelipatanPotongan").value),
            },
            setengahUpah: {
              batas:       parseInt(document.getElementById("editPotSetengahBatas").value) || 0,
              potonganUpah: rpNum(document.getElementById("editPotSetengahPotongan").value),
            }
          }
        };

        await new Promise(r => setTimeout(r, 1000));
        await window.updateDoc(window.doc(window.db, "kantorCabang", cabang.id), updates);

        const idx = cabangData.findIndex(c => c.id === cabang.id);
        if (idx !== -1) {
          cabangData[idx] = { ...cabangData[idx], ...updates };
          renderCabangList(cabangData);
          selectCabang(cabang.id);
        }

        btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
        btn.classList.add("btn-simpan--success");
        setTimeout(() => setActiveTab("operasional", cabangData.find(c => c.id === cabang.id)), 1000);

      } catch(e) {
        console.error(e);
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
        btn.classList.remove("btn-simpan--success");
        alert("Gagal menyimpan.");
      }
    };
  }

  render();
}
// ── EDIT BONUS ──
function renderEditBonus(cabang) {
  const body = document.getElementById("cabangTabBody");
  if (!body) return;

  const bonus  = cabang.bonus || {};
  const data   = { ...(bonus.data   || {}) };
  const cust   = { ...(bonus.customer || {}) };
  const margin = { ...(bonus.margin  || {}) };

  function render() {
    body.innerHTML = `
      <div class="edit-form">

        <!-- BONUS DATA -->
        <div class="tab-card">
          <div class="tab-section-title">Bonus Data</div>
          <div class="edit-field">
            <div class="edit-field-label">Target Customer</div>
            <input id="editBonusTargetCustomer" type="number" class="edit-field-input" value="${data.targetCustomer || 0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Insentif (Rp)</div>
            <input id="editBonusInsentif" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(data.insentif || 0)}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Kehadiran (Rp)</div>
            <input id="editBonusKehadiran" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(bonus.kehadiran || 0)}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Ketentuan (hari)</div>
            <input id="editBonusKetentuan" type="number" class="edit-field-input" value="${bonus.ketentuan || 0}">
          </div>
        </div>

        <!-- BONUS CUSTOMER -->
        <div class="tab-card">
          <div class="tab-section-title">Bonus Customer</div>
          <div class="edit-field">
            <div class="edit-field-label">Target</div>
            <input id="editBonusCustTarget" type="number" class="edit-field-input" value="${cust.target || 0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Kelipatan</div>
            <input id="editBonusCustKelipatan" type="number" class="edit-field-input" value="${cust.kelipatan || 0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Uang (Rp)</div>
            <input id="editBonusCustUang" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(cust.uang || 0)}">
          </div>
        </div>

        <!-- BONUS MARGIN -->
        <div class="tab-card">
          <div class="tab-section-title">Bonus Margin</div>
          <div id="editMarginList">
            ${Object.keys(margin).map(tier => `
              <div class="edit-margin-row" data-tier="${tier}">
                <div class="edit-margin-tier">${tier}</div>
                <div class="edit-varian-fields">
                  <div class="edit-margin-group">
                    <div class="edit-field-label">Min</div>
                    <input class="edit-field-input edit-margin-min" type="number" value="${margin[tier].minimal || 0}" data-tier="${tier}">
                  </div>
                  <div class="edit-margin-group">
                    <div class="edit-field-label">Max</div>
                    <input class="edit-field-input edit-margin-max" type="number" value="${margin[tier].maksimal || 0}" data-tier="${tier}">
                  </div>
                  <div class="edit-margin-group">
                    <div class="edit-field-label">Uang (Rp)</div>
                    <input class="edit-field-input edit-margin-uang rp-input" type="text" inputmode="numeric" value="${rpFormat(margin[tier].uang || 0)}" data-tier="${tier}">
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- ACTIONS -->
        <div class="edit-actions">
          <button class="btn-batal" id="editBonusBatal">Batal</button>
          <button class="btn-simpan" id="editBonusSimpan">
            <i class="fa-solid fa-floppy-disk"></i> Simpan
          </button>
        </div>

      </div>
    `;

    // margin input sync
    document.querySelectorAll(".edit-margin-min").forEach(el => {
      el.oninput = () => { margin[el.dataset.tier].minimal = parseInt(el.value) || 0; };
    });
    document.querySelectorAll(".edit-margin-max").forEach(el => {
      el.oninput = () => { margin[el.dataset.tier].maksimal = parseInt(el.value) || 0; };
    });
    document.querySelectorAll(".edit-margin-uang").forEach(el => {
      el.oninput = () => { margin[el.dataset.tier].uang = rpNum(el.value); };
    });

    // batal
    document.getElementById("editBonusBatal").onclick = () => setActiveTab("bonus", cabang);

    // simpan
    document.getElementById("editBonusSimpan").onclick = async () => {
      const btn = document.getElementById("editBonusSimpan");
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

      try {
        const updates = {
          bonus: {
            data: {
              targetCustomer: parseInt(document.getElementById("editBonusTargetCustomer").value) || 0,
              insentif:       rpNum(document.getElementById("editBonusInsentif").value),
            },
            customer: {
              target:    parseInt(document.getElementById("editBonusCustTarget").value)    || 0,
              kelipatan: parseInt(document.getElementById("editBonusCustKelipatan").value) || 0,
              uang:      rpNum(document.getElementById("editBonusCustUang").value),
            },
            margin,
            kehadiran: rpNum(document.getElementById("editBonusKehadiran").value),
            ketentuan: parseInt(document.getElementById("editBonusKetentuan").value) || 0,
          }
        };

        await new Promise(r => setTimeout(r, 1000));
        await window.updateDoc(window.doc(window.db, "kantorCabang", cabang.id), updates);

        const idx = cabangData.findIndex(c => c.id === cabang.id);
        if (idx !== -1) {
          cabangData[idx] = { ...cabangData[idx], ...updates };
          renderCabangList(cabangData);
          selectCabang(cabang.id);
        }

        btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
        btn.classList.add("btn-simpan--success");
        setTimeout(() => setActiveTab("bonus", cabangData.find(c => c.id === cabang.id)), 1000);

      } catch(e) {
        console.error(e);
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
        btn.classList.remove("btn-simpan--success");
        alert("Gagal menyimpan.");
      }
    };
  }

  render();
}
// ── EDIT TRIKOTOMI ──
function renderEditTrikotomi(cabang) {
  const body = document.getElementById("cabangTabBody");
  if (!body) return;

  const trik = {
    produktif:    { ...( cabang.trikotomi?.produktif    || {}) },
    stabil:       { ...( cabang.trikotomi?.stabil       || {}) },
    nonProduktif: { ...( cabang.trikotomi?.nonProduktif || {}) },
  };

  body.innerHTML = `
    <div class="edit-form">

      ${["produktif","stabil","nonProduktif"].map(k => `
        <div class="tab-card">
          <div class="tab-section-title tab-section-title--capitalize">${k}</div>
          <div class="edit-field">
            <div class="edit-field-label">Expired Min</div>
            <input id="edit_${k}_exp_min" type="number" class="edit-field-input" value="${trik[k]?.expired?.min ?? 0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Expired Max</div>
            <input id="edit_${k}_exp_max" type="number" class="edit-field-input" value="${trik[k]?.expired?.max ?? 0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Return Min</div>
            <input id="edit_${k}_ret_min" type="number" class="edit-field-input" value="${trik[k]?.return?.min ?? 0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Return Max</div>
            <input id="edit_${k}_ret_max" type="number" class="edit-field-input" value="${trik[k]?.return?.max ?? 0}">
          </div>
        </div>
      `).join("")}

      <div class="tab-card">
        <div class="tab-section-title">Target</div>
        <div class="edit-field">
          <div class="edit-field-label">Expired (%)</div>
          <input id="editTargetExpired" type="number" class="edit-field-input" value="${cabang.target?.expired || 0}">
        </div>
      </div>

      <div class="edit-actions">
        <button class="btn-batal" id="editTrikBatal">Batal</button>
        <button class="btn-simpan" id="editTrikSimpan">
          <i class="fa-solid fa-floppy-disk"></i> Simpan
        </button>
      </div>

    </div>
  `;

  document.getElementById("editTrikBatal").onclick = () => setActiveTab("trikotomi", cabang);

  document.getElementById("editTrikSimpan").onclick = async () => {
    const btn = document.getElementById("editTrikSimpan");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    const g = id => parseInt(document.getElementById(id)?.value) || 0;

    try {
      const updates = {
        trikotomi: {
          produktif: {
            expired: { min: g("edit_produktif_exp_min"), max: g("edit_produktif_exp_max") },
            return:  { min: g("edit_produktif_ret_min"), max: g("edit_produktif_ret_max") },
          },
          stabil: {
            expired: { min: g("edit_stabil_exp_min"), max: g("edit_stabil_exp_max") },
            return:  { min: g("edit_stabil_ret_min"), max: g("edit_stabil_ret_max") },
          },
          nonProduktif: {
            expired: { min: g("edit_nonProduktif_exp_min"), max: g("edit_nonProduktif_exp_max") },
            return:  { min: g("edit_nonProduktif_ret_min"), max: g("edit_nonProduktif_ret_max") },
          },
        },
        target: {
          expired: g("editTargetExpired")
        }
      };

      await new Promise(r => setTimeout(r, 1000));
      await window.updateDoc(window.doc(window.db, "kantorCabang", cabang.id), updates);

      const idx = cabangData.findIndex(c => c.id === cabang.id);
      if (idx !== -1) {
        cabangData[idx] = { ...cabangData[idx], ...updates };
        renderCabangList(cabangData);
        selectCabang(cabang.id);
      }

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
      btn.classList.add("btn-simpan--success");
      setTimeout(() => setActiveTab("trikotomi", cabangData.find(c => c.id === cabang.id)), 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
      btn.classList.remove("btn-simpan--success");
      alert("Gagal menyimpan.");
    }
  };
}
// ── EDIT OWNER ──
async function renderEditOwner(cabang) {
  const body = document.getElementById("cabangTabBody");
  if (!body) return;

  body.innerHTML = `<div class="cabang-loading-msg">Memuat data owner...</div>`;

  let ownerDoc  = null;
  let ownerId   = null;
  let tempFotoBlob = null;

  try {
    const snap = await window.getDocs(
      window.query(window.collection(window.db, "ownerMitra"), window.where("idCabang", "==", cabang.id))
    );
    if (!snap.empty) {
      ownerDoc = snap.docs[0].data();
      ownerId  = snap.docs[0].id;
    }
  } catch(e) {
    body.innerHTML = `<div class="cabang-empty-msg">Gagal memuat owner.</div>`;
    return;
  }

  const o = ownerDoc || {};
  const tglValue = o.tanggalLahir?.toDate
    ? o.tanggalLahir.toDate().toISOString().split("T")[0]
    : (o.tanggalLahir || "");

  body.innerHTML = `
    <div class="edit-form">

      <!-- FOTO OWNER -->
      <div class="tab-card edit-foto-card">
        <div class="tab-section-title">Foto Owner</div>
        <div class="edit-owner-foto-wrap" id="editOwnerFotoWrap">
          ${o.fotoOwner
            ? `<img src="${o.fotoOwner}" class="edit-owner-foto-preview" id="editOwnerFotoPreview">`
            : `<div class="edit-owner-foto-empty" id="editOwnerFotoPreview"><i class="fa-solid fa-user"></i></div>`
          }
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Ganti Foto</div>
        </div>
        <input type="file" id="editOwnerFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <!-- DATA OWNER -->
      <div class="tab-card">
        <div class="tab-section-title">Data Owner Mitra</div>
        ${editField("Nama Owner",    "editOwnerNama",    o.namaOwner  || "")}
        ${editField("No HP",         "editOwnerNoHp",    o.noHp       || "")}
        ${editField("Email",         "editOwnerEmail",   o.email      || "")}
        ${editField("Alamat",        "editOwnerAlamat",  o.alamat     || "", "textarea")}
        ${editField("Tempat Lahir",  "editOwnerTempat",  o.tempatLahir|| "")}
        <div class="edit-field">
          <div class="edit-field-label">Tanggal Lahir</div>
          <input id="editOwnerTanggal" type="date" class="edit-field-input" value="${tglValue}">
        </div>
      </div>

      <div class="edit-actions">
        <button class="btn-batal" id="editOwnerBatal">Batal</button>
        <button class="btn-simpan" id="editOwnerSimpan">
          <i class="fa-solid fa-floppy-disk"></i> Simpan
        </button>
      </div>

    </div>
  `;

  // Foto
  const fotoWrap  = document.getElementById("editOwnerFotoWrap");
  const fotoInput = document.getElementById("editOwnerFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 16/9, outputSize: { w: 1280, h: 720 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      const preview = fotoWrap.querySelector(".edit-owner-foto-preview, .edit-owner-foto-empty");
      preview.outerHTML = `<img src="${url}" class="edit-owner-foto-preview" id="editOwnerFotoPreview">`;
    }});
  };

  // Batal
  document.getElementById("editOwnerBatal").onclick = () => setActiveTab("owner", cabang);

  // Simpan
  document.getElementById("editOwnerSimpan").onclick = async () => {
    const btn = document.getElementById("editOwnerSimpan");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
      const tglRaw = document.getElementById("editOwnerTanggal").value;
      const updates = {
        namaOwner:    document.getElementById("editOwnerNama").value.trim(),
        noHp:         document.getElementById("editOwnerNoHp").value.trim(),
        email:        document.getElementById("editOwnerEmail").value.trim(),
        alamat:       document.getElementById("editOwnerAlamat").value.trim(),
        tempatLahir:  document.getElementById("editOwnerTempat").value.trim(),
        tanggalLahir: tglRaw ? new Date(tglRaw) : null,
        idCabang:     cabang.id,
        createdAt:    ownerDoc ? (o.createdAt || window.serverTimestamp()) : window.serverTimestamp(),
      };

      // Upload foto
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 1280, 0.78);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const ref = window.storageRef(window.storage, `fotoOwner/${ownerId || cabang.id}.jpg`);
        updates.fotoOwner = await window.uploadWithProgress(ref, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto owner ${pct}%...`;
        });
      }

      await new Promise(r => setTimeout(r, 1000));

      if (ownerId) {
        await window.updateDoc(window.doc(window.db, "ownerMitra", ownerId), updates);
      } else {
        await window.addDoc(window.collection(window.db, "ownerMitra"), updates);
      }

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
      btn.classList.add("btn-simpan--success");
      setTimeout(() => setActiveTab("owner", cabang), 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
      btn.classList.remove("btn-simpan--success");
      alert("Gagal menyimpan.");
    }
  };
}
// ── EDIT INFO ──
function renderEditInfo(cabang) {
  const body = document.getElementById("cabangTabBody");
  if (!body) return;

  body.innerHTML = `
    <div class="edit-form">

      <div class="tab-card edit-foto-card">
        <div class="tab-section-title">Foto Kantor</div>
        <div class="edit-foto-wrap" id="editFotoWrap">
          ${cabang.fotoKantor
            ? `<img src="${cabang.fotoKantor}" class="edit-foto-preview" id="editFotoPreview">`
            : `<div class="edit-foto-empty" id="editFotoPreview"><i class="fa-solid fa-camera"></i></div>`
          }
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i></div>
        </div>
        <input type="file" id="editFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Informasi Umum</div>
        ${editField("Nama Cabang",  "editNamaCabang", cabang.namaCabang)}
        ${editField("Nama PT",      "editNamaPt",     cabang.namaPt)}
        ${editField("Alamat",       "editAlamat",     cabang.alamatCabang, "textarea")}
        ${editField("Password Page","editPassword",   cabang.pagePassword)}
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Lokasi Cabang</div>
        <div class="edit-lokasi-row">
          <div class="edit-lokasi-info">
            <div class="edit-lokasi-label">Koordinat</div>
            <div class="edit-lokasi-val" id="editLokasiVal">
              ${cabang.lokasiCabang?.latitude||"-"}, ${cabang.lokasiCabang?.longitude||"-"}
            </div>
          </div>
          <button class="btn-peta" id="editLokasiBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Pilih di Peta
          </button>
        </div>
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Hari Libur</div>
        ${editDropdown("Distribusi", "editHariDistribusi", cabang.hariLibur?.distribusi)}
        ${editDropdown("Produksi",   "editHariProduksi",   cabang.hariLibur?.produksi)}
      </div>

      <div class="edit-actions">
        <button class="btn-batal" id="editInfoBatal">Batal</button>
        <button class="btn-simpan" id="editInfoSimpan">
          <i class="fa-solid fa-floppy-disk"></i> Simpan
        </button>
      </div>

    </div>
  `;

  let tempLokasi  = { latitude: cabang.lokasiCabang?.latitude||null, longitude: cabang.lokasiCabang?.longitude||null };
  let tempFotoBlob = null;

  // Foto
  const fotoWrap  = document.getElementById("editFotoWrap");
  const fotoInput = document.getElementById("editFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 16/9, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.querySelector(".edit-foto-preview, .edit-foto-empty").outerHTML = `<img src="${url}" class="edit-foto-preview" id="editFotoPreview">`;
    }});
  };

  // Lokasi
  document.getElementById("editLokasiBtn").onclick = () => {
    openEditLokasiMap(cabang, tempLokasi, (lat, lng) => {
      tempLokasi = { latitude: lat, longitude: lng };
      renderEditInfo({ ...cabang, lokasiCabang: { latitude: lat, longitude: lng } });
    });
  };

  // Batal
  document.getElementById("editInfoBatal").onclick = () => setActiveTab("info", cabang);

  // Simpan
  document.getElementById("editInfoSimpan").onclick = async () => {
    const btn = document.getElementById("editInfoSimpan");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;
    try {
      const passwordRaw = document.getElementById("editPassword").value.trim();
      const passwordHashed = passwordRaw ? await hashPassword(passwordRaw) : cabang.pagePassword;
      const namaCabangBaru = document.getElementById("editNamaCabang").value.trim();

      const updates = {
        namaCabang:   namaCabangBaru,
        namaPt:       document.getElementById("editNamaPt").value.trim(),
        alamatCabang: document.getElementById("editAlamat").value.trim(),
        pagePassword: passwordHashed,
        hariLibur: {
          distribusi: getDropdownVal("editHariDistribusi"),
          produksi:   getDropdownVal("editHariProduksi"),
        },
        lokasiCabang: { latitude: tempLokasi.latitude, longitude: tempLokasi.longitude }
      };

      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const ref = window.storageRef(window.storage, `fotoKantor/${cabang.id}.jpg`);
        updates.fotoKantor = await uploadWithProgress(ref, tempFotoBlob, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto ${pct}%...`;
        });
      }

      await new Promise(r => setTimeout(r, 1000));
      await window.updateDoc(window.doc(window.db, "kantorCabang", cabang.id), updates);

      if (passwordRaw) {
        await simpanAkunPassword(cabang.id, passwordRaw, namaCabangBaru);
      }

      const idx = cabangData.findIndex(c => c.id === cabang.id);
      if (idx !== -1) {
        cabangData[idx] = { ...cabangData[idx], ...updates };
        renderCabangList(cabangData);
        selectCabang(cabang.id);
      }

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
      btn.classList.add("btn-simpan--success");
      setTimeout(() => setActiveTab("info", cabangData.find(c => c.id === cabang.id)), 1000);
    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
      btn.classList.remove("btn-simpan--success");
      alert("Gagal menyimpan, coba lagi.");
    }
  };

  // Init custom dropdowns
  initCustomDropdowns();
}
// ── EDIT FIELD ──
function editField(label, id, value, type = "input") {
  if (type === "textarea") return `
    <div class="edit-field">
      <div class="edit-field-label">${label}</div>
      <textarea id="${id}" class="edit-field-input edit-field-textarea" rows="3">${value||""}</textarea>
    </div>
  `;
  return `
    <div class="edit-field">
      <div class="edit-field-label">${label}</div>
      <input id="${id}" type="text" class="edit-field-input" value="${value||""}">
    </div>
  `;
}
// ── CUSTOM DROPDOWN HARI ──
const HARI = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
function editDropdown(label, id, value) {
  return `
    <div class="edit-field">
      <div class="edit-field-label">${label}</div>
      <div class="custom-dropdown" id="wrap_${id}">
        <button class="custom-dropdown-btn" type="button" data-id="${id}">
          <span class="custom-dropdown-val" id="val_${id}">${value||HARI[0]}</span>
          <i class="fa-solid fa-chevron-down custom-dropdown-arrow"></i>
        </button>
        <div class="custom-dropdown-list" id="list_${id}">
          ${HARI.map(h => `
            <div class="custom-dropdown-option ${h === (value||HARI[0]) ? "active" : ""}" data-val="${h}" data-id="${id}">
              ${h}
              ${h === (value||HARI[0]) ? `<i class="fa-solid fa-check"></i>` : ""}
            </div>
          `).join("")}
        </div>
        <input type="hidden" id="${id}" value="${value||HARI[0]}">
      </div>
    </div>
  `;
}
function getDropdownVal(id) {
  return document.getElementById(id)?.value || "";
}
function initCustomDropdowns() {
  document.querySelectorAll(".custom-dropdown-btn").forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const id   = btn.dataset.id;
      const list = document.getElementById(`list_${id}`);
      document.querySelectorAll(".custom-dropdown-list.show").forEach(l => {
        if (l !== list) l.classList.remove("show");
      });
      list.classList.toggle("show");
      btn.classList.toggle("open");
    };
  });

  document.querySelectorAll(".custom-dropdown-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      const id  = opt.dataset.id;
      const val = opt.dataset.val;
      document.getElementById(id).value = val;
      document.getElementById(`val_${id}`).textContent = val;
      document.querySelectorAll(`#list_${id} .custom-dropdown-option`).forEach(o => {
        o.classList.toggle("active", o.dataset.val === val);
        o.innerHTML = `${o.dataset.val}${o.dataset.val === val ? ' <i class="fa-solid fa-check"></i>' : ""}`;
      });
      document.getElementById(`list_${id}`).classList.remove("show");
      document.querySelector(`[data-id="${id}"].custom-dropdown-btn`)?.classList.remove("open");
    };
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".custom-dropdown-list.show").forEach(l => l.classList.remove("show"));
    document.querySelectorAll(".custom-dropdown-btn.open").forEach(b => b.classList.remove("open"));
  });
}

// ── TAMBAH CABANG ──
function initCabangAddBtn() {
  document.getElementById("cabangAddBtn")?.addEventListener("click", () => {
    renderTambahCabang();
  });
}
function renderTambahCabang() {
  const empty   = document.getElementById("cabangDetailEmpty");
  const content = document.getElementById("cabangDetailContent");
  const panel   = document.getElementById("cabangDetailPanel");
  const wrapper = panel?.closest(".cabang-detail-wrapper");

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "none";
  if (wrapper) wrapper.classList.add("show");
  // Buat container tambah di dalam panel
  let addWrap = document.getElementById("cabangAddWrap");
  if (!addWrap) {
    addWrap = document.createElement("div");
    addWrap.id = "cabangAddWrap";
    addWrap.className = "cabang-add-wrap";
    panel.appendChild(addWrap);
  }
  addWrap.style.display = "flex";

  if (window.innerWidth <= 768) {
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
    backBtn.onclick = () => closeTambah();
  }

  // State data baru
  const newData = {
    info: {},
    operasional: {
      varian: {}, harga: {},
      upahHarian: 0, upahHunter: 0,
      pengeluaran: { fix: [], variable: [] },
      pengeluaranDistribusi: { fix: [], variable: [] },
      loyang: [],
      estimasi: {},
      bonusAdmin: [],
      bonusProduksi: [],
      potongan: {
        kelipatanUpah: { batas: 0, kelipatan: 0, potonganUpah: 0 },
        setengahUpah:  { batas: 0, potonganUpah: 0 }
      }
    },
    bonus: {
      data: { targetCustomer: 0, insentif: 0 },
      customer: { target: 0, kelipatan: 0, uang: 0 },
      margin: { silver: { minimal: 0, maksimal: 0, uang: 0 }, gold: { minimal: 0, maksimal: 0, uang: 0 }, premium: { minimal: 0, maksimal: 0, uang: 0 } },
      kehadiran: 0, ketentuan: 0
    },
    trikotomi: {
      produktif:    { expired: { min: 0, max: 0 }, return: { min: 0, max: 0 } },
      stabil:       { expired: { min: 0, max: 0 }, return: { min: 0, max: 0 } },
      nonProduktif: { expired: { min: 0, max: 0 }, return: { min: 0, max: 0 } },
    },
    target: { expired: 0 },
    owner: {},
  };

  let currentStep = 1;
  const totalStep = 5;
  let tempFotoKantorBlob = null;
  let tempFotoOwnerBlob  = null;
  let tempLokasi = { latitude: null, longitude: null };

  function closeTambah() {
    addWrap.style.display = "none";
    if (empty) empty.style.display = "flex";
    const wrapper = document.getElementById("cabangDetailPanel")?.closest(".cabang-detail-wrapper");
    if (wrapper) wrapper.classList.remove("show");
    document.getElementById("topbarBackBtn").style.display = "none";
  }

  function renderStep() {
    addWrap.innerHTML = `
      <div class="add-header">
        <div class="add-header-top">
          <div class="add-title">Tambah Cabang Baru</div>
          <button class="add-close-btn" id="addCloseBtn">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="add-steps">
          ${["Info","Operasional","Bonus","Trikotomi","Owner"].map((s, i) => `
            <div class="add-step ${i+1 === currentStep ? "active" : ""} ${i+1 < currentStep ? "done" : ""}">
              <div class="add-step-dot">${i+1 < currentStep ? '<i class="fa-solid fa-check"></i>' : i+1}</div>
              <div class="add-step-label">${s}</div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="add-body" id="addBody"></div>

      <div class="add-footer">
        <button class="btn-batal" id="addPrev" ${currentStep === 1 ? "style='opacity:0.4;pointer-events:none;'" : ""}>
          <i class="fa-solid fa-arrow-left"></i> Kembali
        </button>
        ${currentStep < totalStep
          ? `<button class="btn-simpan" id="addNext">
               Lanjut <i class="fa-solid fa-arrow-right"></i>
             </button>`
          : `<button class="btn-simpan" id="addSimpan">
               <i class="fa-solid fa-floppy-disk"></i> Simpan
             </button>`
        }
      </div>
    `;

    document.getElementById("addCloseBtn").onclick = closeTambah;
    if (currentStep > 1) document.getElementById("addPrev").onclick = () => { saveCurrentStep(); currentStep--; renderStep(); };

    if (currentStep < totalStep) document.getElementById("addNext").onclick = () => {
      const errors = validateStep(currentStep, newData, tempLokasi, tempFotoKantorBlob, tempFotoOwnerBlob);
      if (errors.length > 0) { showWarning(errors); return; }
      saveCurrentStep();
      currentStep++;
      renderStep();
    };

    if (currentStep === totalStep) document.getElementById("addSimpan").onclick = () => {
      const errors = validateStep(currentStep, newData, tempLokasi, tempFotoKantorBlob, tempFotoOwnerBlob);
      if (errors.length > 0) { showWarning(errors); return; }
      simpanCabang();
    };
    renderStepBody();
  }

  // ── DISPATCHER ──
  function renderStepBody() {
    const body = document.getElementById("addBody");
    if (!body) return;

    if      (currentStep === 1) renderStepInfo(body);
    else if (currentStep === 2) renderStepOperasional(body);
    else if (currentStep === 3) renderStepBonus(body);
    else if (currentStep === 4) renderStepTrikotomi(body);
    else if (currentStep === 5) renderStepOwner(body);
  }

  // ── STEP 1: INFO ──
  function renderStepInfo(body) {
      const d = newData.info;
      body.innerHTML = `
        <div class="tab-card edit-foto-card">
          <div class="tab-section-title">Foto Kantor</div>
          <div class="edit-foto-wrap" id="addFotoWrap">
            ${tempFotoKantorBlob
              ? `<img src="${URL.createObjectURL(tempFotoKantorBlob)}" class="edit-foto-preview">`
              : `<div class="edit-foto-empty"><i class="fa-solid fa-camera"></i></div>`
            }
            <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Foto</div>
          </div>
          <input type="file" id="addFotoInput" accept="image/*" class="edit-foto-input">
        </div>
        <div class="tab-card">
          <div class="tab-section-title">Informasi Umum</div>
          ${editField("Nama Cabang",   "addNamaCabang", d.namaCabang  || "")}
          ${editField("Nama PT",       "addNamaPt",     d.namaPt      || "")}
          ${editField("Alamat",        "addAlamat",     d.alamatCabang|| "", "textarea")}
          ${editField("Password Page", "addPassword",   d.pagePassword|| "")}
        </div>
        <div class="tab-card">
          <div class="tab-section-title">Lokasi Cabang</div>
          <div class="edit-lokasi-row">
            <div class="edit-lokasi-info">
              <div class="edit-lokasi-label">Koordinat</div>
              <div class="edit-lokasi-val" id="addLokasiVal">
                ${tempLokasi.latitude ? `${tempLokasi.latitude}, ${tempLokasi.longitude}` : "Belum dipilih"}
              </div>
            </div>
            <button class="btn-peta" id="addLokasiBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              Pilih di Peta
            </button>
          </div>
        </div>
        <div class="tab-card">
          <div class="tab-section-title">Hari Libur</div>
          ${editDropdown("Distribusi", "addHariDistribusi", d.hariLibur?.distribusi || "Minggu")}
          ${editDropdown("Produksi",   "addHariProduksi",   d.hariLibur?.produksi   || "Sabtu")}
        </div>
      `;

      // Foto
      const fotoWrap  = document.getElementById("addFotoWrap");
      const fotoInput = document.getElementById("addFotoInput");
      fotoWrap.onclick = () => fotoInput.click();
      fotoInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        window.openCropModal({ file, ratio: 16/9, outputSize: { w: 1280, h: 720 }, onSave: blob => {
          saveCurrentStep(); // simpan isian form dulu SEBELUM render ulang, biar ga ke-reset
          tempFotoKantorBlob = blob;
          renderStepBody();
        }});
      };

      // Lokasi
      document.getElementById("addLokasiBtn").onclick = () => {
        saveCurrentStep();

        const buka = (lat, lng) => {
          const fakeCabang = { id: "new", lokasiCabang: { latitude: lat, longitude: lng } };
          openEditLokasiMap(fakeCabang, { latitude: lat, longitude: lng }, (la, ln) => {
            tempLokasi = { latitude: la, longitude: ln };
            renderStep();
          });
        };

        if (tempLokasi.latitude) {
          buka(tempLokasi.latitude, tempLokasi.longitude);
        } else {
          navigator.geolocation.getCurrentPosition(
            pos => buka(pos.coords.latitude, pos.coords.longitude),
            ()   => buka(-6.2, 106.8)
          );
        }
      };
      initCustomDropdowns();
  }

  // ── STEP 2: OPERASIONAL ──
  function renderStepOperasional(body) {
    const op = newData.operasional;
    const varian      = op.varian;
    const harga       = op.harga;
    const penFix      = op.pengeluaran.fix;
    const penVariable = op.pengeluaran.variable;
    const loyang          = op.loyang;
    const estimasi        = op.estimasi;
    const bonusAdmin      = op.bonusAdmin;
    const bonusProduksi   = op.bonusProduksi;
    const penDistFix      = op.pengeluaranDistribusi.fix;
    const penDistVariable = op.pengeluaranDistribusi.variable;
  
    body.innerHTML = `
      <div class="tab-card">
        <div class="tab-section-title">Varian & Harga</div>
        <div id="addVarianList">
          ${Object.keys(varian).map(k => `
            <div class="edit-varian-row" data-key="${k}">
              <div class="edit-varian-fields">
                <input class="edit-field-input edit-varian-kode" value="${k}" placeholder="Kode" data-original="${k}">
                <input class="edit-field-input edit-varian-nama" value="${varian[k]}" placeholder="Nama">
                <input class="edit-field-input edit-varian-harga rp-input" type="text" inputmode="numeric" value="${rpFormat(harga[k]||0)}" placeholder="Harga">
              </div>
              <button class="btn-hapus-row" data-key="${k}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="addTambahVarian">
          <i class="fa-solid fa-plus"></i> Tambah Varian
        </button>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Upah</div>
        <div class="edit-field">
          <div class="edit-field-label">Upah Harian</div>
          <input id="addUpahHarian" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(op.upahHarian || 0)}">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Upah Hunter</div>
          <input id="addUpahHunter" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(op.upahHunter || 0)}">
        </div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Pengeluaran Fix</div>
        <div id="addPenFixList">
          ${penFix.map((item, i) => `
            <div class="edit-pen-fix-row" data-index="${i}">
              <input class="edit-field-input add-pen-fix-input" value="${item}" placeholder="Nama pengeluaran..." data-index="${i}">
              <button class="btn-hapus-row btn-hapus-fix" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="btnTambahFix">
          <i class="fa-solid fa-plus"></i> Tambah Fix
        </button>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Pengeluaran Variable</div>
        <div id="addPenVarList">
          ${penVariable.map((item, i) => `
            <div class="edit-varian-row">
              <div class="edit-varian-fields">
                <input class="edit-field-input edit-pen-var-jenis" value="${item.jenis}" placeholder="Jenis" data-index="${i}">
                <input class="edit-field-input edit-pen-var-harga rp-input" type="text" inputmode="numeric" value="${rpFormat(item.harga||0)}" placeholder="Harga" data-index="${i}">
              </div>
              <button class="btn-hapus-row btn-hapus-var" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="addTambahVar">
          <i class="fa-solid fa-plus"></i> Tambah Variable
        </button>
      </div>
  
      <div class="tab-card">
        <div class="tab-section-title">Loyang</div>
        <div id="addLoyangList">
          ${loyang.map((item, i) => `
            <div class="edit-varian-row" data-index="${i}">
              <div class="edit-varian-fields">
                <input class="edit-field-input add-loyang-jenis" value="${item.jenisLoyang||""}" placeholder="Jenis Loyang" data-index="${i}">
                <input class="edit-field-input add-loyang-upah rp-input" type="text" inputmode="numeric" value="${rpFormat(item.upah||0)}" placeholder="Upah" data-index="${i}">
                <input class="edit-field-input add-loyang-hargapaket rp-input" type="text" inputmode="numeric" value="${rpFormat(item.hargaPaket||0)}" placeholder="Harga Paket" data-index="${i}">
                <label class="add-loyang-status-label">
                  <input type="checkbox" class="add-loyang-status" data-index="${i}" ${item.status !== false ? "checked" : ""}> Aktif
                </label>
              </div>
              <button class="btn-hapus-row btn-hapus-loyang" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="addTambahLoyang">
          <i class="fa-solid fa-plus"></i> Tambah Loyang
        </button>
      </div>
  
      <div class="tab-card">
        <div class="tab-section-title">Estimasi Loyang (Kapasitas per Varian)</div>
        <div id="addEstimasiList">
          ${Object.keys(estimasi).map(groupKey => `
            <div class="edit-estimasi-group" data-group-key="${groupKey}">
              <div class="edit-estimasi-group-header">
                <input class="edit-field-input add-estimasi-group-name" value="${groupKey}" placeholder="Nama Grup (misal loyangOriginal)" data-group-key="${groupKey}">
                <button class="btn-hapus-row btn-hapus-add-estimasi-group" data-group-key="${groupKey}"><i class="fa-solid fa-trash"></i></button>
              </div>
              <div class="edit-estimasi-varian-list">
                ${Object.entries(estimasi[groupKey] || {}).map(([kode, kap]) => `
                  <div class="edit-estimasi-varian-row" data-group-key="${groupKey}" data-kode="${kode}">
                    <input class="edit-field-input add-estimasi-kode" value="${kode}" placeholder="Kode Varian" data-group-key="${groupKey}" data-original-kode="${kode}">
                    <input type="number" min="0" class="edit-field-input add-estimasi-kapasitas" value="${kap}" placeholder="Kapasitas" data-group-key="${groupKey}" data-kode="${kode}">
                    <button class="btn-hapus-row btn-hapus-add-estimasi-varian" data-group-key="${groupKey}" data-kode="${kode}"><i class="fa-solid fa-trash"></i></button>
                  </div>
                `).join("")}
              </div>
              <button class="btn-tambah-row btn-tambah-add-estimasi-varian" data-group-key="${groupKey}">
                <i class="fa-solid fa-plus"></i> Tambah Varian
              </button>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="addTambahEstimasiGroup">
          <i class="fa-solid fa-plus"></i> Tambah Grup Loyang
        </button>
      </div>
  
      <div class="tab-card">
        <div class="tab-section-title">Bonus Admin (Efisiensi Produksi)</div>
        <div id="addBonusAdminList">
          ${bonusAdmin.map((item, i) => `
            <div class="edit-bonus-row" data-index="${i}">
              <div class="edit-bonus-field">
                <label class="edit-bonus-field-label">Target (di bawah %)</label>
                <input type="number" min="0" class="edit-field-input add-bonusadmin-target" value="${item.target ?? 0}" data-index="${i}">
              </div>
              <div class="edit-bonus-field">
                <label class="edit-bonus-field-label">Bonus (%)</label>
                <input type="number" min="0" class="edit-field-input add-bonusadmin-bonus" value="${item.bonus ?? 0}" data-index="${i}">
              </div>
              <button class="btn-hapus-row btn-hapus-add-bonusadmin" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="addTambahBonusAdmin">
          <i class="fa-solid fa-plus"></i> Tambah Rule
        </button>
      </div>
  
      <div class="tab-card">
        <div class="tab-section-title">Bonus Produksi (Efisiensi Produksi)</div>
        <div id="addBonusProduksiList">
          ${bonusProduksi.map((item, i) => `
            <div class="edit-bonus-row" data-index="${i}">
              <div class="edit-bonus-field">
                <label class="edit-bonus-field-label">Patokan / Loyang</label>
                <input type="number" min="0" class="edit-field-input add-bonusprod-patokan" value="${item.patokan ?? 0}" data-index="${i}">
              </div>
              <div class="edit-bonus-field">
                <label class="edit-bonus-field-label">Bonus (%)</label>
                <input type="number" min="0" class="edit-field-input add-bonusprod-bonus" value="${item.bonus ?? 0}" data-index="${i}">
              </div>
              <button class="btn-hapus-row btn-hapus-add-bonusprod" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="addTambahBonusProduksi">
          <i class="fa-solid fa-plus"></i> Tambah Rule
        </button>
      </div>
  
      <div class="tab-card">
        <div class="tab-section-title">Pengeluaran Distribusi (Fix)</div>
        <div id="addPenDistFixList">
          ${penDistFix.map((item, i) => `
            <div class="edit-pen-fix-row">
              <input class="edit-field-input add-pendist-fix" value="${item}" placeholder="Nama pengeluaran..." data-index="${i}">
              <button class="btn-hapus-row btn-hapus-pendist-fix" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join("")}
        </div>
        <div class="edit-pen-fix-add">
          <input id="addPenDistFixInput" class="edit-field-input" placeholder="Nama pengeluaran...">
          <button class="btn-tambah-row" id="addTambahPenDistFix">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>
  
      <div class="tab-card">
        <div class="tab-section-title">Pengeluaran Distribusi (Variable)</div>
        <div id="addPenDistVarList">
          ${penDistVariable.map((item, i) => `
            <div class="edit-varian-row">
              <div class="edit-varian-fields">
                <input class="edit-field-input add-pendist-var-jenis" value="${item.jenis}" placeholder="Jenis" data-index="${i}">
                <input class="edit-field-input add-pendist-var-harga rp-input" type="text" inputmode="numeric" value="${rpFormat(item.harga||0)}" placeholder="Harga" data-index="${i}">
              </div>
              <button class="btn-hapus-row btn-hapus-pendist-var" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="addTambahPenDistVar">
          <i class="fa-solid fa-plus"></i> Tambah Variable
        </button>
      </div>
  
      <div class="tab-card">
        <div class="tab-section-title">Potongan</div>
        <div class="edit-field">
          <div class="edit-field-label">Kelipatan Upah - Batas</div>
          <input id="addPotKelipatanBatas" type="number" class="edit-field-input" value="${op.potongan.kelipatanUpah.batas||0}">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Kelipatan Upah - Kelipatan</div>
          <input id="addPotKelipatanKelipatan" type="number" class="edit-field-input" value="${op.potongan.kelipatanUpah.kelipatan||0}">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Kelipatan Upah - Potongan (Rp)</div>
          <input id="addPotKelipatanPotongan" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(op.potongan.kelipatanUpah.potonganUpah||0)}">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Setengah Upah - Batas</div>
          <input id="addPotSetengahBatas" type="number" class="edit-field-input" value="${op.potongan.setengahUpah.batas||0}">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Setengah Upah - Potongan (Rp)</div>
          <input id="addPotSetengahPotongan" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(op.potongan.setengahUpah.potonganUpah||0)}">
        </div>
      </div>
    `;
  
    document.getElementById("addTambahVarian").onclick = () => {
      varian[""] = ""; harga[""] = 0;
      renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-row[data-key]").forEach(btn => {
      btn.onclick = () => { delete varian[btn.dataset.key]; delete harga[btn.dataset.key]; renderStepBody(); };
    });
    document.querySelectorAll(".edit-varian-row[data-key]").forEach(row => {
      const oldKey  = row.dataset.key;
      const kodeEl  = row.querySelector(".edit-varian-kode");
      const namaEl  = row.querySelector(".edit-varian-nama");
      const hargaEl = row.querySelector(".edit-varian-harga");
      kodeEl.oninput  = () => { const nk = kodeEl.value.toUpperCase(); delete varian[oldKey]; delete harga[oldKey]; varian[nk] = namaEl.value; harga[nk] = parseInt(hargaEl.value)||0; row.dataset.key = nk; };
      namaEl.oninput  = () => { varian[kodeEl.value.toUpperCase()] = namaEl.value; };
      hargaEl.oninput = () => { harga[kodeEl.value.toUpperCase()]  = parseInt(hargaEl.value)||0; };
    });
  
    document.getElementById("btnTambahFix").onclick = () => {
      penFix.push(""); renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-fix").forEach(btn => {
      btn.onclick = () => { penFix.splice(parseInt(btn.dataset.index), 1); renderStepBody(); };
    });
    document.querySelectorAll(".add-pen-fix-input").forEach(el => {
      el.oninput = () => { penFix[parseInt(el.dataset.index)] = el.value; };
    });
  
    document.getElementById("addTambahVar").onclick = () => {
      penVariable.push({ jenis: "", harga: 0 }); renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-var").forEach(btn => {
      btn.onclick = () => { penVariable.splice(parseInt(btn.dataset.index), 1); renderStepBody(); };
    });
    document.querySelectorAll(".edit-pen-var-jenis").forEach(el => {
      el.oninput = () => { penVariable[parseInt(el.dataset.index)].jenis = el.value; };
    });
    document.querySelectorAll(".edit-pen-var-harga").forEach(el => {
      el.oninput = () => { penVariable[parseInt(el.dataset.index)].harga = rpNum(el.value); };
    });
  
    document.getElementById("addTambahLoyang").onclick = () => {
      loyang.push({ jenisLoyang: "", status: true, upah: 0, hargaPaket: 0 });
      renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-loyang").forEach(btn => {
      btn.onclick = () => { loyang.splice(parseInt(btn.dataset.index), 1); renderStepBody(); };
    });
    document.querySelectorAll(".add-loyang-jenis").forEach(el => {
      el.oninput = () => { loyang[parseInt(el.dataset.index)].jenisLoyang = el.value; };
    });
    document.querySelectorAll(".add-loyang-upah").forEach(el => {
      el.oninput = () => { loyang[parseInt(el.dataset.index)].upah = rpNum(el.value); };
    });
    document.querySelectorAll(".add-loyang-hargapaket").forEach(el => {
      el.oninput = () => { loyang[parseInt(el.dataset.index)].hargaPaket = rpNum(el.value); };
    });
    document.querySelectorAll(".add-loyang-status").forEach(el => {
      el.onchange = () => { loyang[parseInt(el.dataset.index)].status = el.checked; };
    });
  
    document.getElementById("addTambahEstimasiGroup").onclick = () => {
      let newKey = "loyangBaru", i = 1;
      while (newKey in estimasi) { newKey = `loyangBaru${i}`; i++; }
      estimasi[newKey] = {};
      renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-add-estimasi-group").forEach(btn => {
      btn.onclick = () => { delete estimasi[btn.dataset.groupKey]; renderStepBody(); };
    });
    document.querySelectorAll(".add-estimasi-group-name").forEach(el => {
      el.onchange = () => {
        const oldKey = el.dataset.groupKey;
        const newKey = el.value.trim();
        if (!newKey || newKey === oldKey) { renderStepBody(); return; }
        estimasi[newKey] = estimasi[oldKey] || {};
        delete estimasi[oldKey];
        renderStepBody();
      };
    });
    document.querySelectorAll(".btn-tambah-add-estimasi-varian").forEach(btn => {
      btn.onclick = () => {
        const groupKey = btn.dataset.groupKey;
        if (!estimasi[groupKey]) estimasi[groupKey] = {};
        let newKode = "KODE", i = 1;
        while (newKode in estimasi[groupKey]) { newKode = `KODE${i}`; i++; }
        estimasi[groupKey][newKode] = 0;
        renderStepBody();
      };
    });
    document.querySelectorAll(".btn-hapus-add-estimasi-varian").forEach(btn => {
      btn.onclick = () => {
        const groupKey = btn.dataset.groupKey;
        if (estimasi[groupKey]) delete estimasi[groupKey][btn.dataset.kode];
        renderStepBody();
      };
    });
    document.querySelectorAll(".add-estimasi-kode").forEach(el => {
      el.onchange = () => {
        const groupKey = el.dataset.groupKey;
        const oldKode  = el.dataset.originalKode;
        const newKode  = el.value.trim().toUpperCase();
        if (!newKode || !estimasi[groupKey]) { renderStepBody(); return; }
        const val = estimasi[groupKey][oldKode] || 0;
        delete estimasi[groupKey][oldKode];
        estimasi[groupKey][newKode] = val;
        renderStepBody();
      };
    });
    document.querySelectorAll(".add-estimasi-kapasitas").forEach(el => {
      el.oninput = () => {
        const groupKey = el.dataset.groupKey;
        const kode = el.dataset.kode;
        if (!estimasi[groupKey]) estimasi[groupKey] = {};
        estimasi[groupKey][kode] = parseInt(el.value) || 0;
      };
    });
  
    document.getElementById("addTambahBonusAdmin").onclick = () => {
      bonusAdmin.push({ target: 0, bonus: 0 });
      renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-add-bonusadmin").forEach(btn => {
      btn.onclick = () => { bonusAdmin.splice(parseInt(btn.dataset.index), 1); renderStepBody(); };
    });
    document.querySelectorAll(".add-bonusadmin-target").forEach(el => {
      el.oninput = () => { bonusAdmin[parseInt(el.dataset.index)].target = parseInt(el.value) || 0; };
    });
    document.querySelectorAll(".add-bonusadmin-bonus").forEach(el => {
      el.oninput = () => { bonusAdmin[parseInt(el.dataset.index)].bonus = parseInt(el.value) || 0; };
    });
  
    document.getElementById("addTambahBonusProduksi").onclick = () => {
      bonusProduksi.push({ patokan: 0, bonus: 0 });
      renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-add-bonusprod").forEach(btn => {
      btn.onclick = () => { bonusProduksi.splice(parseInt(btn.dataset.index), 1); renderStepBody(); };
    });
    document.querySelectorAll(".add-bonusprod-patokan").forEach(el => {
      el.oninput = () => { bonusProduksi[parseInt(el.dataset.index)].patokan = parseInt(el.value) || 0; };
    });
    document.querySelectorAll(".add-bonusprod-bonus").forEach(el => {
      el.oninput = () => { bonusProduksi[parseInt(el.dataset.index)].bonus = parseInt(el.value) || 0; };
    });
  
    document.getElementById("addTambahPenDistFix").onclick = () => {
      const val = document.getElementById("addPenDistFixInput").value.trim();
      if (!val) return;
      penDistFix.push(val); renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-pendist-fix").forEach(btn => {
      btn.onclick = () => { penDistFix.splice(parseInt(btn.dataset.index), 1); renderStepBody(); };
    });
    document.querySelectorAll(".add-pendist-fix").forEach(el => {
      el.oninput = () => { penDistFix[parseInt(el.dataset.index)] = el.value; };
    });
  
    document.getElementById("addTambahPenDistVar").onclick = () => {
      penDistVariable.push({ jenis: "", harga: 0 }); renderStepBody();
    };
    document.querySelectorAll(".btn-hapus-pendist-var").forEach(btn => {
      btn.onclick = () => { penDistVariable.splice(parseInt(btn.dataset.index), 1); renderStepBody(); };
    });
    document.querySelectorAll(".add-pendist-var-jenis").forEach(el => {
      el.oninput = () => { penDistVariable[parseInt(el.dataset.index)].jenis = el.value; };
    });
    document.querySelectorAll(".add-pendist-var-harga").forEach(el => {
      el.oninput = () => { penDistVariable[parseInt(el.dataset.index)].harga = rpNum(el.value); };
    });
  }

  // ── STEP 3: BONUS ──
  function renderStepBonus(body) {
      const b = newData.bonus;
      body.innerHTML = `
        <div class="tab-card">
          <div class="tab-section-title">Bonus Data</div>
          ${editField("Target Customer", "addBonusTargetCustomer", b.data.targetCustomer)}
          <div class="edit-field">
            <div class="edit-field-label">Insentif (Rp)</div>
            <input id="addBonusInsentif" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(b.data.insentif || 0)}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Kehadiran (Rp)</div>
            <input id="addBonusKehadiran" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(b.kehadiran || 0)}">
          </div>
          ${editField("Ketentuan (hari)","addBonusKetentuan",      b.ketentuan)}
        </div>
        <div class="tab-card">
          <div class="tab-section-title">Bonus Customer</div>
          ${editField("Target",    "addBonusCustTarget",    b.customer.target)}
          ${editField("Kelipatan", "addBonusCustKelipatan", b.customer.kelipatan)}
          <div class="edit-field">
            <div class="edit-field-label">Uang (Rp)</div>
            <input id="addBonusCustUang" type="text" inputmode="numeric" class="edit-field-input rp-input" value="${rpFormat(b.customer.uang || 0)}">
          </div>
        </div>
        <div class="tab-card">
          <div class="tab-section-title">Bonus Margin</div>
          ${Object.keys(b.margin).map(tier => `
            <div class="edit-margin-row">
              <div class="edit-margin-tier">${tier}</div>
              <div class="edit-varian-fields">
                <div class="edit-margin-group">
                  <div class="edit-field-label">Min</div>
                  <input class="edit-field-input" type="number" id="addMargin_${tier}_min" value="${b.margin[tier].minimal}">
                </div>
                <div class="edit-margin-group">
                  <div class="edit-field-label">Max</div>
                  <input class="edit-field-input" type="number" id="addMargin_${tier}_max" value="${b.margin[tier].maksimal}">
                </div>
                <div class="edit-margin-group">
                  <div class="edit-field-label">Uang (Rp)</div>
                  <input class="edit-field-input rp-input" type="text" inputmode="numeric" id="addMargin_${tier}_uang" value="${rpFormat(b.margin[tier].uang || 0)}">
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `;
  }

  // ── STEP 4: TRIKOTOMI ──
  function renderStepTrikotomi(body) {
      const trik = newData.trikotomi;
      body.innerHTML = `
        <div class="edit-form">
          ${["produktif","stabil","nonProduktif"].map(k => `
            <div class="tab-card">
              <div class="tab-section-title tab-section-title--capitalize">${k}</div>
              ${editField("Expired Min", `addTrik_${k}_exp_min`, trik[k].expired.min)}
              ${editField("Expired Max", `addTrik_${k}_exp_max`, trik[k].expired.max)}
              ${editField("Return Min",  `addTrik_${k}_ret_min`, trik[k].return.min)}
              ${editField("Return Max",  `addTrik_${k}_ret_max`, trik[k].return.max)}
            </div>
          `).join("")}
          <div class="tab-card">
            <div class="tab-section-title">Target</div>
            ${editField("Expired (%)", "addTargetExpired", newData.target.expired)}
          </div>
        </div>
      `;
  }

  // ── STEP 5: OWNER ──
  function renderStepOwner(body) {
      const o = newData.owner;
      body.innerHTML = `
        <div class="tab-card edit-foto-card">
          <div class="tab-section-title">Foto Owner</div>
          <div class="edit-foto-wrap" id="addOwnerFotoWrap">
            ${tempFotoOwnerBlob
              ? `<img src="${URL.createObjectURL(tempFotoOwnerBlob)}" class="edit-foto-preview">`
              : `<div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>`
            }
            <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Foto</div>
          </div>
          <input type="file" id="addOwnerFotoInput" accept="image/*" class="edit-foto-input">
        </div>
        <div class="tab-card">
          <div class="tab-section-title">Data Owner</div>
          ${editField("Nama Owner",   "addOwnerNama",   o.namaOwner   || "")}
          ${editField("No HP",        "addOwnerNoHp",   o.noHp        || "")}
          ${editField("Email",        "addOwnerEmail",  o.email       || "")}
          ${editField("Alamat",       "addOwnerAlamat", o.alamat      || "", "textarea")}
          ${editField("Tempat Lahir", "addOwnerTempat", o.tempatLahir || "")}
          <div class="edit-field">
            <div class="edit-field-label">Tanggal Lahir</div>
            <input id="addOwnerTanggal" type="date" class="edit-field-input" value="${o.tanggalLahir instanceof Date ? o.tanggalLahir.toISOString().split('T')[0] : (o.tanggalLahir || "")}">
          </div>
        </div>
      `;

      const fotoWrap  = document.getElementById("addOwnerFotoWrap");
      const fotoInput = document.getElementById("addOwnerFotoInput");
      fotoWrap.onclick = () => fotoInput.click();
      fotoInput.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        window.openCropModal({ file, ratio: 16/9, outputSize: { w: 1280, h: 720 }, onSave: blob => {
          saveCurrentStep(); // simpan isian form dulu SEBELUM render ulang, biar ga ke-reset
          tempFotoOwnerBlob = blob;
          renderStepBody();
        }});
      };
  }


  function saveCurrentStep() {
    const g = id => document.getElementById(id)?.value || "";
    const n = id => parseInt(document.getElementById(id)?.value) || 0;

    if (currentStep === 1) {
      newData.info = {
        namaCabang:   g("addNamaCabang"),
        namaPt:       g("addNamaPt"),
        alamatCabang: g("addAlamat"),
        pagePassword: g("addPassword"),
        hariLibur: {
          distribusi: getDropdownVal("addHariDistribusi"),
          produksi:   getDropdownVal("addHariProduksi"),
        },
        lokasiCabang: { latitude: tempLokasi.latitude, longitude: tempLokasi.longitude }
      };
    }
    else if (currentStep === 2) {
      const rp = id => rpNum(document.getElementById(id)?.value);
      newData.operasional.upahHarian = rp("addUpahHarian");
      newData.operasional.upahHunter = rp("addUpahHunter");
      newData.operasional.potongan.kelipatanUpah.batas        = n("addPotKelipatanBatas");
      newData.operasional.potongan.kelipatanUpah.kelipatan    = n("addPotKelipatanKelipatan");
      newData.operasional.potongan.kelipatanUpah.potonganUpah = rp("addPotKelipatanPotongan");
      newData.operasional.potongan.setengahUpah.batas         = n("addPotSetengahBatas");
      newData.operasional.potongan.setengahUpah.potonganUpah  = rp("addPotSetengahPotongan");
    }
    else if (currentStep === 3) {
      const rp = id => rpNum(document.getElementById(id)?.value);
      newData.bonus.data.targetCustomer = n("addBonusTargetCustomer");
      newData.bonus.data.insentif       = rp("addBonusInsentif");
      newData.bonus.kehadiran           = rp("addBonusKehadiran");
      newData.bonus.ketentuan           = n("addBonusKetentuan");
      newData.bonus.customer.target     = n("addBonusCustTarget");
      newData.bonus.customer.kelipatan  = n("addBonusCustKelipatan");
      newData.bonus.customer.uang       = rp("addBonusCustUang");
      Object.keys(newData.bonus.margin).forEach(tier => {
        newData.bonus.margin[tier].minimal  = n(`addMargin_${tier}_min`);
        newData.bonus.margin[tier].maksimal = n(`addMargin_${tier}_max`);
        newData.bonus.margin[tier].uang     = rp(`addMargin_${tier}_uang`);
      });
    }
    else if (currentStep === 4) {
      ["produktif","stabil","nonProduktif"].forEach(k => {
        newData.trikotomi[k].expired.min = n(`addTrik_${k}_exp_min`);
        newData.trikotomi[k].expired.max = n(`addTrik_${k}_exp_max`);
        newData.trikotomi[k].return.min  = n(`addTrik_${k}_ret_min`);
        newData.trikotomi[k].return.max  = n(`addTrik_${k}_ret_max`);
      });
      newData.target.expired = n("addTargetExpired");
    }
    else if (currentStep === 5) {
      newData.owner = {
        namaOwner:   g("addOwnerNama"),
        noHp:        g("addOwnerNoHp"),
        email:       g("addOwnerEmail"),
        alamat:      g("addOwnerAlamat"),
        tempatLahir: g("addOwnerTempat"),
        tanggalLahir: document.getElementById("addOwnerTanggal")?.value
          ? new Date(document.getElementById("addOwnerTanggal").value)
          : null,
      };
    }
  }
  async function simpanCabang() {
    saveCurrentStep();

    const btn = document.getElementById("addSimpan");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
      const passwordRawWizard = newData.info.pagePassword;
      const passwordHashed = passwordRawWizard
        ? await hashPassword(passwordRawWizard)
        : "";

      const payload = {
        ...newData.info,
        pagePassword: passwordHashed,
        ...newData.operasional,
        bonus:      newData.bonus,
        trikotomi:  newData.trikotomi,
        target:     newData.target,
        createdAt:  window.serverTimestamp(),
      };

      // Simpan kantorCabang dulu untuk dapat docRef.id
      const docRef = await window.addDoc(window.collection(window.db, "kantorCabang"), payload);

      if (passwordRawWizard) {
        await simpanAkunPassword(docRef.id, passwordRawWizard, newData.info.namaCabang);
      }

      // Upload foto kantor langsung ke path final
      if (tempFotoKantorBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto kantor...`;
        const compressedKantor = await window.compressImage(tempFotoKantorBlob, 1280, 0.78);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto kantor 0%...`;
        const finalRef = window.storageRef(window.storage, `fotoKantor/${docRef.id}.jpg`);
        payload.fotoKantor = await window.uploadWithProgress(finalRef, compressedKantor, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto kantor ${pct}%...`;
        });
        await window.updateDoc(window.doc(window.db, "kantorCabang", docRef.id), { fotoKantor: payload.fotoKantor });
      }

      // Simpan owner
      if (newData.owner.namaOwner) {
        const ownerDocRef = window.doc(window.collection(window.db, "ownerMitra"));
        const ownerPayload = { ...newData.owner, idCabang: docRef.id, createdAt: window.serverTimestamp() };
        if (tempFotoOwnerBlob) {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto owner...`;
          const compressedOwner = await window.compressImage(tempFotoOwnerBlob, 1280, 0.78);
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto owner 0%...`;
          const ownerRef = window.storageRef(window.storage, `fotoOwner/${ownerDocRef.id}.jpg`);
          ownerPayload.fotoOwner = await window.uploadWithProgress(ownerRef, compressedOwner, "image/jpeg", pct => {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto owner ${pct}%...`;
          });
        }
        await window.setDoc(ownerDocRef, ownerPayload);
      }

      await new Promise(r => setTimeout(r, 1000));

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
      btn.classList.add("btn-simpan--success");

      // Refresh list
      cabangData.push({ id: docRef.id, ...payload });
      renderCabangList(cabangData);

      setTimeout(() => {
        addWrap.style.display = "none";
        if (empty) empty.style.display = "flex";
        selectCabang(docRef.id);
      }, 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
      btn.classList.remove("btn-simpan--success");
      alert("Gagal menyimpan cabang.");
    }
  }

  renderStep();
}
