
window.cabangData = [];
let cabangData = window.cabangData;
let activeCabangId = null;

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

  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (panel) panel.closest(".cabang-detail-wrapper")?.classList.add("show");

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
        <div class="tab-row"><span class="tab-row-label">Password Page</span><span class="tab-row-value">${c.pagePassword || "-"}</span></div>
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
  }

  else if (tab === "operasional") {
    const varian = c.varian || {};
    const harga  = c.harga  || {};
    const pengeluaran = c.pengeluaran || {};
    body.innerHTML = `
      <div class="tab-card">
        <div class="tab-section-title">Varian & Harga</div>
        ${Object.keys(varian).map(k => `
          <div class="tab-row">
            <span class="tab-row-label">${varian[k]} (${k})</span>
            <span class="tab-row-value">Rp ${(harga[k]||0).toLocaleString("id-ID")}</span>
          </div>
        `).join("")}
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Upah</div>
        <div class="tab-row"><span class="tab-row-label">Upah Harian</span><span class="tab-row-value">Rp ${(c.upahHarian||0).toLocaleString("id-ID")}</span></div>
        <div class="tab-row"><span class="tab-row-label">Upah Hunter</span><span class="tab-row-value">Rp ${(c.upahHunter||0).toLocaleString("id-ID")}</span></div>
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
            <span class="tab-row-value">Rp ${(item.harga||0).toLocaleString("id-ID")}</span>
          </div>
        `).join("")}
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
        <div class="tab-row"><span class="tab-row-label">Insentif</span><span class="tab-row-value">Rp ${(bonus.data?.insentif||0).toLocaleString("id-ID")}</span></div>
        <div class="tab-row"><span class="tab-row-label">Kehadiran</span><span class="tab-row-value">Rp ${(bonus.kehadiran||0).toLocaleString("id-ID")}</span></div>
        <div class="tab-row"><span class="tab-row-label">Ketentuan</span><span class="tab-row-value">${bonus.ketentuan||"-"} hari</span></div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Bonus Customer</div>
        <div class="tab-row"><span class="tab-row-label">Target</span><span class="tab-row-value">${bonus.customer?.target||"-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Kelipatan</span><span class="tab-row-value">${bonus.customer?.kelipatan||"-"}</span></div>
        <div class="tab-row"><span class="tab-row-label">Uang</span><span class="tab-row-value">Rp ${(bonus.customer?.uang||0).toLocaleString("id-ID")}</span></div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Bonus Margin</div>
        ${Object.keys(margin).map(tier => `
          <div class="tab-row">
            <span class="tab-row-label tab-row-label--capitalize">${tier}</span>
            <span class="tab-row-value">${margin[tier].minimal}-${margin[tier].maksimal} → Rp ${(margin[tier].uang||0).toLocaleString("id-ID")}</span>
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
            await window.deleteObject(window.storageRef(window.storage, `fotoOwner/${cabang.id}.jpg`));
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
                  <input class="edit-field-input edit-varian-harga" type="number" value="${harga[k] || 0}" placeholder="Harga">
                </div>
                <button class="btn-hapus-row" data-key="${k}">
                  <i class="fa-solid fa-trash"></i>
                </button>
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
            <input id="editUpahHarian" type="number" class="edit-field-input" value="${cabang.upahHarian || 0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Upah Hunter</div>
            <input id="editUpahHunter" type="number" class="edit-field-input" value="${cabang.upahHunter || 0}">
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
                  <input class="edit-field-input edit-pen-var-harga" type="number" value="${item.harga || 0}" placeholder="Harga" data-index="${i}">
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

    // sync varian input live
    document.querySelectorAll(".edit-varian-row[data-key]").forEach(row => {
      const oldKey  = row.dataset.key;
      const kodeEl  = row.querySelector(".edit-varian-kode");
      const namaEl  = row.querySelector(".edit-varian-nama");
      const hargaEl = row.querySelector(".edit-varian-harga");

      kodeEl.oninput = () => {
        const newKey = kodeEl.value.toUpperCase();
        delete varian[oldKey];
        delete harga[oldKey];
        varian[newKey] = namaEl.value;
        harga[newKey]  = parseInt(hargaEl.value) || 0;
        row.dataset.key = newKey;
      };
      namaEl.oninput  = () => { varian[kodeEl.value.toUpperCase()] = namaEl.value; };
      hargaEl.oninput = () => { harga[kodeEl.value.toUpperCase()]  = parseInt(hargaEl.value) || 0; };
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

    document.querySelectorAll(".btn-hapus-fix").forEach(btn => {
      btn.onclick = () => {
        penFix.splice(parseInt(btn.dataset.index), 1);
        render();
      };
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
      el.oninput = () => { penVariable[parseInt(el.dataset.index)].harga = parseInt(el.value) || 0; };
    });

    // ── BATAL ──
    document.getElementById("editOpBatal").onclick = () => setActiveTab("operasional", cabang);

    // ── SIMPAN ──
    document.getElementById("editOpSimpan").onclick = async () => {
      const btn = document.getElementById("editOpSimpan");
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

      try {
        // Baca varian & harga langsung dari DOM
        const varianFinal = {};
        const hargaFinal  = {};
        document.querySelectorAll(".edit-varian-row[data-key]").forEach(row => {
          const kode  = row.querySelector(".edit-varian-kode")?.value?.trim().toUpperCase();
          const nama  = row.querySelector(".edit-varian-nama")?.value?.trim();
          const hargaVal = parseInt(row.querySelector(".edit-varian-harga")?.value) || 0;
          if (kode && nama) {
            varianFinal[kode] = nama;
            hargaFinal[kode]  = hargaVal;
          }
        });

        // Baca pengeluaran variable dari DOM
        const penVariableFinal = [];
        document.querySelectorAll(".edit-pen-var-jenis").forEach((el, i) => {
          const jenis = el.value?.trim();
          const hargaEl = document.querySelectorAll(".edit-pen-var-harga")[i];
          if (jenis) {
            penVariableFinal.push({
              jenis,
              harga: parseInt(hargaEl?.value) || 0
            });
          }
        });
        const updates = {
          varian: varianFinal,
          harga:  hargaFinal,
          upahHarian: parseInt(document.getElementById("editUpahHarian").value) || 0,
          upahHunter: parseInt(document.getElementById("editUpahHunter").value) || 0,
          pengeluaran: { fix: penFix, variable: penVariableFinal }
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
            <input id="editBonusInsentif" type="number" class="edit-field-input" value="${data.insentif || 0}">
          </div>
          <div class="edit-field">
            <div class="edit-field-label">Kehadiran (Rp)</div>
            <input id="editBonusKehadiran" type="number" class="edit-field-input" value="${bonus.kehadiran || 0}">
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
            <input id="editBonusCustUang" type="number" class="edit-field-input" value="${cust.uang || 0}">
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
                    <input class="edit-field-input edit-margin-uang" type="number" value="${margin[tier].uang || 0}" data-tier="${tier}">
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
      el.oninput = () => { margin[el.dataset.tier].uang = parseInt(el.value) || 0; };
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
              insentif:       parseInt(document.getElementById("editBonusInsentif").value)       || 0,
            },
            customer: {
              target:    parseInt(document.getElementById("editBonusCustTarget").value)    || 0,
              kelipatan: parseInt(document.getElementById("editBonusCustKelipatan").value) || 0,
              uang:      parseInt(document.getElementById("editBonusCustUang").value)      || 0,
            },
            margin,
            kehadiran: parseInt(document.getElementById("editBonusKehadiran").value) || 0,
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
      const updates = {
        namaCabang:   document.getElementById("editNamaCabang").value.trim(),
        namaPt:       document.getElementById("editNamaPt").value.trim(),
        alamatCabang: document.getElementById("editAlamat").value.trim(),
        pagePassword: document.getElementById("editPassword").value.trim(),
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
      pengeluaran: { fix: [], variable: [] }
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

  function renderStepBody() {
    const body = document.getElementById("addBody");
    if (!body) return;

    if (currentStep === 1) {
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

    else if (currentStep === 2) {
      const op = newData.operasional;
      const varian      = op.varian;
      const harga       = op.harga;
      const penFix      = op.pengeluaran.fix;
      const penVariable = op.pengeluaran.variable;

      body.innerHTML = `
        <div class="tab-card">
          <div class="tab-section-title">Varian & Harga</div>
          <div id="addVarianList">
            ${Object.keys(varian).map(k => `
              <div class="edit-varian-row" data-key="${k}">
                <div class="edit-varian-fields">
                  <input class="edit-field-input edit-varian-kode" value="${k}" placeholder="Kode" data-original="${k}">
                  <input class="edit-field-input edit-varian-nama" value="${varian[k]}" placeholder="Nama">
                  <input class="edit-field-input edit-varian-harga" type="number" value="${harga[k]||0}" placeholder="Harga">
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
          ${editField("Upah Harian", "addUpahHarian", op.upahHarian || 0)}
          ${editField("Upah Hunter", "addUpahHunter", op.upahHunter || 0)}
        </div>
        <div class="tab-card">
          <div class="tab-section-title">Pengeluaran Fix</div>
          <div id="addPenFixList">
            ${penFix.map((item, i) => `
              <div class="edit-pen-fix-row">
                <span class="edit-pen-fix-label">${item}</span>
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
                  <input class="edit-field-input edit-pen-var-harga" type="number" value="${item.harga||0}" placeholder="Harga" data-index="${i}">
                </div>
                <button class="btn-hapus-row btn-hapus-var" data-index="${i}"><i class="fa-solid fa-trash"></i></button>
              </div>
            `).join("")}
          </div>
          <button class="btn-tambah-row" id="addTambahVar">
            <i class="fa-solid fa-plus"></i> Tambah Variable
          </button>
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

      document.getElementById("addTambahFix").onclick = () => {
        const val = document.getElementById("addPenFixInput").value.trim();
        if (!val) return;
        penFix.push(val); renderStepBody();
      };
      document.querySelectorAll(".btn-hapus-fix").forEach(btn => {
        btn.onclick = () => { penFix.splice(parseInt(btn.dataset.index), 1); renderStepBody(); };
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
        el.oninput = () => { penVariable[parseInt(el.dataset.index)].harga = parseInt(el.value)||0; };
      });
    }

    else if (currentStep === 3) {
      const b = newData.bonus;
      body.innerHTML = `
        <div class="tab-card">
          <div class="tab-section-title">Bonus Data</div>
          ${editField("Target Customer", "addBonusTargetCustomer", b.data.targetCustomer)}
          ${editField("Insentif (Rp)",   "addBonusInsentif",       b.data.insentif)}
          ${editField("Kehadiran (Rp)",  "addBonusKehadiran",      b.kehadiran)}
          ${editField("Ketentuan (hari)","addBonusKetentuan",      b.ketentuan)}
        </div>
        <div class="tab-card">
          <div class="tab-section-title">Bonus Customer</div>
          ${editField("Target",    "addBonusCustTarget",    b.customer.target)}
          ${editField("Kelipatan", "addBonusCustKelipatan", b.customer.kelipatan)}
          ${editField("Uang (Rp)", "addBonusCustUang",      b.customer.uang)}
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
                  <input class="edit-field-input" type="number" id="addMargin_${tier}_uang" value="${b.margin[tier].uang}">
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    else if (currentStep === 4) {
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

    else if (currentStep === 5) {
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
            <input id="addOwnerTanggal" type="date" class="edit-field-input" value="${o.tanggalLahir || ""}">
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
          tempFotoOwnerBlob = blob;
          renderStepBody();
        }});
      };
    }
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
      newData.operasional.upahHarian = n("addUpahHarian");
      newData.operasional.upahHunter = n("addUpahHunter");
    }
    else if (currentStep === 3) {
      newData.bonus.data.targetCustomer = n("addBonusTargetCustomer");
      newData.bonus.data.insentif       = n("addBonusInsentif");
      newData.bonus.kehadiran           = n("addBonusKehadiran");
      newData.bonus.ketentuan           = n("addBonusKetentuan");
      newData.bonus.customer.target     = n("addBonusCustTarget");
      newData.bonus.customer.kelipatan  = n("addBonusCustKelipatan");
      newData.bonus.customer.uang       = n("addBonusCustUang");
      Object.keys(newData.bonus.margin).forEach(tier => {
        newData.bonus.margin[tier].minimal  = n(`addMargin_${tier}_min`);
        newData.bonus.margin[tier].maksimal = n(`addMargin_${tier}_max`);
        newData.bonus.margin[tier].uang     = n(`addMargin_${tier}_uang`);
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
      const payload = {
        ...newData.info,
        ...newData.operasional,
        bonus:      newData.bonus,
        trikotomi:  newData.trikotomi,
        target:     newData.target,
        createdAt:  window.serverTimestamp(),
      };

      // Simpan kantorCabang dulu untuk dapat docRef.id
      const docRef = await window.addDoc(window.collection(window.db, "kantorCabang"), payload);

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
        const ownerPayload = { ...newData.owner, idCabang: docRef.id, createdAt: window.serverTimestamp() };
        if (tempFotoOwnerBlob) {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto owner...`;
          const compressedOwner = await window.compressImage(tempFotoOwnerBlob, 1280, 0.78);
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto owner 0%...`;
          const ownerRef = window.storageRef(window.storage, `fotoOwner/${docRef.id}.jpg`);
          ownerPayload.fotoOwner = await window.uploadWithProgress(ownerRef, compressedOwner, "image/jpeg", pct => {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto owner ${pct}%...`;
          });
        }
        await window.addDoc(window.collection(window.db, "ownerMitra"), ownerPayload);
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
