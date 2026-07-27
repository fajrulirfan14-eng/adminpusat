
// ── TOAST (khusus view Akun) ──
function showAkunToast(message, type = "success") {
  document.getElementById("akunToast")?.remove();

  const toast = document.createElement("div");
  toast.id = "akunToast";
  toast.className = `akun-toast akun-toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
window.showAkunToast = showAkunToast;

// ── AKUN VIEW ──
let akunCabangData = [];
let activeAkunCabangId = null;
let activeAkunCabang = null;
window.bukaAkunCabang = function(cabangId) {
  window.showView("akun");
  setTimeout(() => {
    window.selectAkunCabang(cabangId);
  }, 100);
};
window.initAkunView = async function() {
  await loadAkunCabangList();
  initAkunBackBtn();
};

// ── LOAD LIST CABANG ──
async function loadAkunCabangList() {
  const list = document.getElementById("akunCabangList");
  if (!list) return;

  list.innerHTML = [1,2,3].map(() => `
    <div class="akun-sk-item">
      <div class="akun-sk akun-sk-foto"></div>
      <div class="akun-sk-info">
        <div class="akun-sk akun-sk-nama"></div>
        <div class="akun-sk akun-sk-pt"></div>
      </div>
    </div>
  `).join("");

  try {
    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    akunCabangData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAkunCabangList(akunCabangData);
  } catch(e) {
    list.innerHTML = `<div class="akun-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── RENDER LIST CABANG ──
function renderAkunCabangList(data) {
  const list = document.getElementById("akunCabangList");
  if (!list) return;
  if (!data.length) {
    list.innerHTML = `<div class="akun-empty-msg">Belum ada cabang.</div>`;
    return;
  }
  list.innerHTML = data.map(c => `
    <div class="akun-cabang-item ${activeAkunCabangId === c.id ? 'active' : ''}" 
         data-id="${c.id}" onclick="selectAkunCabang('${c.id}')">
      ${c.fotoKantor
        ? `<img src="${c.fotoKantor}" class="akun-cabang-foto">`
        : `<div class="akun-cabang-foto-placeholder"><i class="fa-solid fa-building"></i></div>`
      }
      <div class="akun-cabang-info">
        <div class="akun-cabang-nama">${c.namaCabang || "-"}</div>
        <div class="akun-cabang-pt">${c.namaPt || "-"}</div>
      </div>
      <i class="fa-solid fa-chevron-right akun-cabang-arrow"></i>
    </div>
  `).join("");
}

// ── SELECT CABANG ──
window.selectAkunCabang = async function(id) {
  activeAkunCabangId = id;
  activeAkunCabang   = akunCabangData.find(c => c.id === id);
  if (!activeAkunCabang) return;

  document.querySelectorAll(".akun-cabang-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  const empty   = document.getElementById("akunDetailEmpty");
  const content = document.getElementById("akunDetailContent");
  const wrapper = document.getElementById("akunDetailPanel")?.closest(".akun-detail-wrapper");

  const wasOpen = wrapper?.classList.contains("show");
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");
  if (!wasOpen) window.pusatPushDetailState?.("akun");

  if (window.innerWidth <= 768) {
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) { backBtn.style.display = "flex"; }
  }

  document.getElementById("akunDetailNama").textContent = activeAkunCabang.namaCabang || "-";
  document.getElementById("akunDetailPt").textContent   = activeAkunCabang.namaPt || "-";

  // Init tabs
  setAkunTab("adminCabang");
  initAkunTabs();
  initAkunAddBtn();
};

// ── TABS ──
function initAkunTabs() {
  document.querySelectorAll(".akun-tab").forEach(tab => {
    tab.onclick = () => setAkunTab(tab.dataset.tab);
  });
}
function setAkunTab(tabName) {
  document.querySelectorAll(".akun-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabName);
  });
  if (tabName === "adminCabang") loadAdminCabangTab();
  else loadMarketingTab(tabName);
}

// ── TAB ADMIN CABANG ──
async function loadAdminCabangTab() {
  const body = document.getElementById("akunTabBody");
  if (!body) return;
  body.innerHTML = `<div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", activeAkunCabangId),
        window.where("role", "==", "adminCabang")
      )
    );

    if (snap.empty) {
      body.innerHTML = `<div class="akun-empty-msg">Belum ada admin cabang.</div>`;
      return;
    }

    body.innerHTML = snap.docs.map(d => {
      const u = d.data();
      const initial = (u.nama || "?")[0].toUpperCase();
      return `
        <div class="akun-card ${u.status === false ? 'nonaktif' : ''}" onclick="openAkunDetail('${d.id}')">
          ${u.foto
            ? `<img src="${u.foto}" class="akun-card-foto">`
            : `<div class="akun-card-foto-placeholder">${initial}</div>`
          }
          <div class="akun-card-info">
            <div class="akun-card-nama">${u.nama || "-"}</div>
            <div class="akun-card-role">${u.role || "-"}</div>
            <div class="akun-card-email">${u.email || "-"}</div>
          </div>
          <span class="akun-card-status ${u.status === false ? 'nonaktif' : 'aktif'}">
            ${u.status === false ? 'Nonaktif' : 'Aktif'}
          </span>
        </div>
      `;
    }).join("");

  } catch(e) {
    body.innerHTML = `<div class="akun-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── TAB MARKETING ──
async function loadMarketingTab(role) {
  const body = document.getElementById("akunTabBody");
  if (!body) return;
  body.innerHTML = `<div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", activeAkunCabangId),
        window.where("role", "==", role)
      )
    );

    if (snap.empty) {
      body.innerHTML = `<div class="akun-empty-msg">Belum ada akun marketing.</div>`;
      return;
    }

    // Sort: aktif dulu
    const sorted = snap.docs.sort((a, b) => {
      const aS = a.data().status !== false ? 1 : 0;
      const bS = b.data().status !== false ? 1 : 0;
      return bS - aS;
    });

    body.innerHTML = sorted.map(d => {
      const u = d.data();
      const initial = (u.nama || "?")[0].toUpperCase();
      return `
        <div class="akun-card ${u.status === false ? 'nonaktif' : ''}" onclick="openAkunDetail('${d.id}')">
          ${u.foto
            ? `<img src="${u.foto}" class="akun-card-foto">`
            : `<div class="akun-card-foto-placeholder">${initial}</div>`
          }
          <div class="akun-card-info">
            <div class="akun-card-nama">${u.nama || "-"}</div>
            <div class="akun-card-role">${u.role || "-"}</div>
            <div class="akun-card-email">${u.email || "-"}</div>
          </div>
          <span class="akun-card-status ${u.status === false ? 'nonaktif' : 'aktif'}">
            ${u.status === false ? 'Nonaktif' : 'Aktif'}
          </span>
        </div>
      `;
    }).join("");

  } catch(e) {
    body.innerHTML = `<div class="akun-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── BACK BTN ──
function initAkunBackBtn() {
  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (window.innerWidth <= 768 && history.state?.pusatDetail === "akun") {
      history.back(); // biar popstate yang urus, state konsisten
      return;
    }
    const wrapper = document.getElementById("akunDetailPanel")?.closest(".akun-detail-wrapper");
    if (wrapper) wrapper.classList.remove("show");
    document.getElementById("topbarBackBtn").style.display = "none";
    activeAkunCabangId = null;
    document.querySelectorAll(".akun-cabang-item").forEach(el => el.classList.remove("active"));
  });
}

// ── SECONDARY FIREBASE APP ──
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
const secondaryApp = initializeApp({
  apiKey: "AIzaSyCp32H2WeN3A4ZwwWeUWe3Qcjqh0mz_vvQ",
  authDomain: "teh-tarik-nusantara-26371.firebaseapp.com",
  projectId: "teh-tarik-nusantara-26371",
  storageBucket: "teh-tarik-nusantara-26371.firebasestorage.app",
  messagingSenderId: "354760960352",
  appId: "1:354760960352:web:7d6a6c07dace937a74d605",
}, "secondary");
const secondaryAuth = getAuth(secondaryApp);
// ── CEK ADMIN CABANG AKTIF ──
async function getActiveAdminCabang(cabangId) {
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
    console.error("❌ getActiveAdminCabang:", e);
    return null;
  }
}

// ── ADD BTN ──
function initAkunAddBtn() {
  document.getElementById("akunAddBtn").onclick = async () => {
    const activeTab = document.querySelector(".akun-tab.active")?.dataset.tab;

    if (activeTab === "adminCabang") {
      const existing = await getActiveAdminCabang(activeAkunCabangId);
      if (existing) {
        showAkunToast("Cabang ini sudah punya Admin Cabang aktif", "error");
        return;
      }
      renderTambahAkun();
    } else if (activeTab === "investor") {
      const existing = await getActiveAdminCabang(activeAkunCabangId);
      if (!existing) {
        showAkunToast("Admin Cabang belum ada, silakan buat dulu", "error");
        return;
      }
      renderTambahInvestor();
    } else {
      const existing = await getActiveAdminCabang(activeAkunCabangId);
      if (!existing) {
        showAkunToast("Admin Cabang belum ada, silakan buat dulu", "error");
        return;
      }
      renderTambahMarketing(activeTab);
    }
  };
}
// ── TAMBAH AKUN ADMIN CABANG ──
function renderTambahAkun() {
  document.getElementById("akunSheetOverlay")?.remove();
  document.getElementById("akunSheet")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "akunSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  const sheet = document.createElement("div");
  sheet.id = "akunSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>

    <div class="akun-sheet-header">
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">Tambah Admin Cabang</div>
        <div class="akun-sheet-role">${activeAkunCabang?.namaCabang || "-"}</div>
      </div>
      <button class="akun-sheet-close" id="akunSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="akunSheetBody">

      <!-- FOTO -->
      <div class="tab-card">
        <div class="tab-section-title">Foto Profil</div>
        <div class="edit-foto-wrap" id="akunSheetFotoWrap" style="cursor:pointer;">
          <div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Foto</div>
        </div>
        <input type="file" id="akunSheetFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <!-- DATA PRIBADI -->
      <div class="tab-card">
        <div class="tab-section-title">Data Pribadi</div>
        ${editAkunField("Nama", "akunAddNama", "")}
        ${editAkunField("NIK", "akunAddNik", "")}
        ${editAkunField("No Telpon", "akunAddNoTelpon", "")}
        ${editAkunField("Alamat", "akunAddAlamat", "", "textarea")}
        ${editAkunField("Motivasi", "akunAddMotivasi", "", "textarea")}
        <div class="edit-field">
          <div class="edit-field-label">Tanggal Lahir</div>
          <input id="akunAddTanggalLahir" type="date" class="edit-field-input">
        </div>
      </div>
      
      <!-- VARIAN -->
      <div class="tab-card" id="akunAddVarianCard">
        <div class="tab-section-title">Varian</div>
        <div id="akunAddVarianList">
          <div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat varian...</div>
        </div>
        <button class="btn-tambah-row" id="akunAddTambahVarian">
          <i class="fa-solid fa-plus"></i> Tambah Varian
        </button>
      </div>

      <!-- AKUN -->
      <div class="tab-card">
        <div class="tab-section-title">Akun</div>
        ${editAkunField("Email", "akunAddEmail", "")}
        ${editAkunField("Password", "akunAddPassword", "", "password")}
      </div>

      <!-- PEMBAGIAN LABA BERSIH (khusus Admin Cabang) -->
      <div class="tab-card">
        <div class="tab-section-title">Pembagian Laba Bersih (%)</div>
        <div class="edit-field">
          <div class="edit-field-label">Manager</div>
          <input id="akunAddLabaManager" type="number" class="edit-field-input" value="0">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Kas</div>
          <input id="akunAddLabaKas" type="number" class="edit-field-input" value="0">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Dividen</div>
          <input id="akunAddLabaDividen" type="number" class="edit-field-input" value="0">
        </div>
      </div>

      <div id="akunSheetError" style="color:#dc2626;font-size:12px;text-align:center;min-height:16px;margin-top:4px;"></div>

    </div>

    <div class="akun-sheet-footer">
      <button class="btn-simpan" id="akunSheetSimpan" style="flex:1;">
        <i class="fa-solid fa-user-plus"></i> Buat Akun
      </button>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    sheet.classList.add("show");
  });

  let tempFotoBlob = null;
  let tempTtdBlob  = null;
  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { overlay.remove(); sheet.remove(); }, 350);
  };

  document.getElementById("akunSheetClose").onclick = closeSheet;

  // Swipe
  let startY = 0, dragging = false, currentDy = 0;
  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const touchY = e.touches[0].clientY;
    const headerEl = sheet.querySelector(".akun-sheet-header");
    const headerBottom = headerEl.getBoundingClientRect().bottom;
    if (touchY > headerBottom) return;
    startY = touchY; currentDy = 0; dragging = true;
    sheet.style.willChange = "transform";
    sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentDy = e.touches[0].clientY - startY;
    if (currentDy < 0) currentDy = 0;
    const r = currentDy > 120 ? 120 + (currentDy - 120) * 0.25 : currentDy;
    sheet.style.transform = `translateY(${r}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false; sheet.style.willChange = "";
    if (currentDy > 90) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });
  
  // Load varian dari kantorCabang
  let varianList = [];
  window.getDoc(window.doc(window.db, "kantorCabang", activeAkunCabangId)).then(snap => {
    const kantorData   = snap.data() || {};
    const varianKantor = kantorData.varian || {};
    const hargaKantor  = kantorData.harga  || {};

    varianList = Object.keys(varianKantor).map(kode => ({
      kode,
      nama:          varianKantor[kode],
      hargaKonsumen: hargaKantor[kode] || 0,
      hargaProduksi: 0,
      isAktif:       true,
    }));

    renderVarianList();
  });

  function renderVarianList() {
    const container = document.getElementById("akunAddVarianList");
    if (!container) return;

    container.innerHTML = varianList.map((v, i) => `
      <div class="akun-varian-row">
        <div class="akun-varian-header">
          <div style="display:flex;gap:8px;align-items:center;flex:1;">
            <input class="edit-field-input akun-add-varian-kode" style="width:60px;font-weight:700;" 
              value="${v.kode}" placeholder="Kode" data-index="${i}">
            <input class="edit-field-input akun-add-varian-nama" style="flex:1;" 
              value="${v.nama}" placeholder="Nama" data-index="${i}">
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label class="akun-varian-toggle">
              <input type="checkbox" class="akun-add-varian-aktif" data-index="${i}" ${v.isAktif ? 'checked' : ''}>
              <span class="akun-toggle-label">Aktif</span>
            </label>
            <button class="btn-hapus-row akun-add-hapus-varian" data-index="${i}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="akun-varian-fields">
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Harga Konsumen</div>
            <input class="edit-field-input akun-add-varian-konsumen" type="number" 
              value="${v.hargaKonsumen}" data-index="${i}">
          </div>
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Harga Produksi</div>
            <input class="edit-field-input akun-add-varian-produksi" type="number" 
              value="${v.hargaProduksi}" data-index="${i}">
          </div>
        </div>
      </div>
    `).join("");

    // Events
    container.querySelectorAll(".akun-add-varian-kode").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].kode = el.value.toUpperCase(); };
    });
    container.querySelectorAll(".akun-add-varian-nama").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].nama = el.value; };
    });
    container.querySelectorAll(".akun-add-varian-konsumen").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].hargaKonsumen = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-varian-produksi").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].hargaProduksi = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-varian-aktif").forEach(el => {
      el.onchange = () => { varianList[parseInt(el.dataset.index)].isAktif = el.checked; };
    });
    container.querySelectorAll(".akun-add-hapus-varian").forEach(el => {
      el.onclick = () => { varianList.splice(parseInt(el.dataset.index), 1); renderVarianList(); };
    });
  }

  document.getElementById("akunAddTambahVarian").onclick = () => {
    varianList.push({ kode: "", nama: "", hargaKonsumen: 0, hargaProduksi: 0, isAktif: true });
    renderVarianList();
  };
  // Enter pindah field
  const fields = [
    "akunAddNama", "akunAddNik", "akunAddNoTelpon",
    "akunAddAlamat", "akunAddMotivasi",
    "akunAddEmail", "akunAddPassword"
  ];
  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = document.getElementById(fields[i + 1]);
      if (next) next.focus();
      else document.getElementById("akunSheetSimpan")?.click();
    });
  });

  // Foto
  const fotoWrap  = document.getElementById("akunSheetFotoWrap");
  const fotoInput = document.getElementById("akunSheetFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 1, outputSize: { w: 400, h: 400 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.querySelector(".edit-foto-empty, .edit-foto-preview").outerHTML =
        `<img src="${url}" class="edit-foto-preview">`;
    }});
  };

  // Simpan
  document.getElementById("akunSheetSimpan").onclick = async () => {
    const btn   = document.getElementById("akunSheetSimpan");
    const errEl = document.getElementById("akunSheetError");
    errEl.textContent = "";

    const nama      = document.getElementById("akunAddNama").value.trim();
    const nik       = document.getElementById("akunAddNik").value.trim();
    const noTelpon  = document.getElementById("akunAddNoTelpon").value.trim();
    const alamat    = document.getElementById("akunAddAlamat").value.trim();
    const motivasi  = document.getElementById("akunAddMotivasi").value.trim();
    const tglRaw    = document.getElementById("akunAddTanggalLahir").value;
    const email     = document.getElementById("akunAddEmail").value.trim();
    const password  = document.getElementById("akunAddPassword").value;

    if (!nama)                        return errEl.textContent = "Nama wajib diisi";
    if (!nik)                         return errEl.textContent = "NIK wajib diisi";
    if (!noTelpon)                    return errEl.textContent = "No Telpon wajib diisi";
    if (!alamat)                      return errEl.textContent = "Alamat wajib diisi";
    if (!email)                       return errEl.textContent = "Email wajib diisi";
    if (!password || password.length < 6) return errEl.textContent = "Password min. 6 karakter";

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membuat akun...`;

    try {
      // Konversi varian dari form ke format users
      const varianUsers = varianList.map(v => ({
        [v.kode]: {
          hargaKonsumen: v.hargaKonsumen,
          hargaProduksi: v.hargaProduksi,
          isAktif:       v.isAktif,
        }
      }));

      // Buat akun Auth via secondary app
      const cred   = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = cred.user.uid;

      // Upload foto
      let fotoUrl = "";
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 400, 0.78);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const ref = window.storageRef(window.storage, `fotoUsers/${newUid}`);
        fotoUrl = await window.uploadWithProgress(ref, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto ${pct}%...`;
        });
      }

      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan data...`;

      const pembagianLabaBersih = {
        manager: parseInt(document.getElementById("akunAddLabaManager")?.value) || 0,
        kas:     parseInt(document.getElementById("akunAddLabaKas")?.value) || 0,
        dividen: parseInt(document.getElementById("akunAddLabaDividen")?.value) || 0,
      };

      // Simpan ke Firestore
      await window.setDoc(window.doc(window.db, "users", newUid), {
        id:           newUid,
        nama,
        nik,
        noTelpon,
        alamat,
        motivasi,
        tanggalLahir: tglRaw ? new Date(tglRaw) : null,
        email,
        foto:         fotoUrl,
        role:         "adminCabang",
        idCabang:     activeAkunCabangId,
        kantorCabang: activeAkunCabang?.namaCabang || "",
        varian:       varianUsers,
        pembagianLabaBersih,
        status:       true,
        createdBy:    newUid,
        createdAt:    window.serverTimestamp(),
      });

      await window.setDoc(window.doc(window.db, "akun", newUid), {
        uid:      newUid,
        role:     "adminCabang",
        password,
        email,
        idCabang: activeAkunCabangId,
      });

      // Logout secondary
      await secondaryAuth.signOut();

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Berhasil!`;
      btn.classList.add("btn-simpan--success");

      setTimeout(() => {
        closeSheet();
        loadAdminCabangTab();
      }, 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Buat Akun`;
      if (e.code === "auth/email-already-in-use") {
        errEl.textContent = "Email sudah digunakan.";
      } else if (e.code === "auth/invalid-email") {
        errEl.textContent = "Format email tidak valid.";
      } else {
        errEl.textContent = "Gagal membuat akun, coba lagi.";
      }
    }
  };
}
// ── TAMBAH AKUN INVESTOR ──
async function renderTambahInvestor() {
  document.getElementById("akunSheetOverlay")?.remove();
  document.getElementById("akunSheet")?.remove();

  const adminCabang = await getActiveAdminCabang(activeAkunCabangId);
  if (!adminCabang) {
    showAkunToast("Admin Cabang belum ada, silakan buat dulu", "error");
    return;
  }
  const createdBy = adminCabang.id;
  const namaCabangAktif = activeAkunCabang?.namaCabang || "-";

  const overlay = document.createElement("div");
  overlay.id = "akunSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  const sheet = document.createElement("div");
  sheet.id = "akunSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>
    <div class="akun-sheet-header">
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">Tambah Investor</div>
        <div class="akun-sheet-role">${namaCabangAktif}</div>
      </div>
      <button class="akun-sheet-close" id="akunSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="akunSheetBody">

      <div class="tab-card">
        <div class="tab-section-title">Foto Profil</div>
        <div class="edit-foto-wrap" id="akunSheetFotoWrap" style="cursor:pointer;">
          <div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Foto</div>
        </div>
        <input type="file" id="akunSheetFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Data Pribadi</div>
        ${editAkunField("Nama", "akunAddNama", "")}
        ${editAkunField("NIK", "akunAddNik", "")}
        ${editAkunField("No Telepon", "akunAddNoTelepon", "")}
        ${editAkunField("Alamat", "akunAddAlamat", "", "textarea")}
        ${editAkunField("Pekerjaan", "akunAddPekerjaan", "")}
        ${editAkunField("Tempat, Tanggal Lahir", "akunAddTtl", "")}
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Data Investasi</div>
        <div class="edit-field">
          <div class="edit-field-label">Cabang Ekuitas</div>
          <input id="akunAddCabangEkuitas" type="text" class="edit-field-input" value="${namaCabangAktif}" readonly style="opacity:0.7;">
        </div>
        ${editAkunField("Tanggal Investasi", "akunAddTanggalInvest", "")}
        <div class="edit-field">
          <div class="edit-field-label">Ekuitas (Rp)</div>
          <input id="akunAddEkuitas" type="text" inputmode="numeric" class="edit-field-input rp-input" value="">
        </div>
      </div>

      <div class="tab-card edit-foto-card">
        <div class="tab-section-title">Tanda Tangan</div>
        <div class="edit-foto-wrap" id="akunAddTtdWrap" style="cursor:pointer;">
          <div class="edit-foto-empty"><i class="fa-solid fa-signature"></i></div>
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Gambar</div>
        </div>
        <input type="file" id="akunAddTtdInput" accept="image/*" class="edit-foto-input">
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Akun</div>
        ${editAkunField("Email", "akunAddEmail", "")}
        ${editAkunField("Password", "akunAddPassword", "", "password")}
      </div>

      <div id="akunSheetError" style="color:#dc2626;font-size:12px;text-align:center;min-height:16px;margin-top:4px;"></div>

    </div>

    <div class="akun-sheet-footer">
      <button class="btn-simpan" id="akunSheetSimpan" style="flex:1;">
        <i class="fa-solid fa-user-plus"></i> Buat Akun
      </button>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => { overlay.classList.add("show"); sheet.classList.add("show"); });

  let tempFotoBlob = null;
  let tempTtdBlob  = null;

  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { overlay.remove(); sheet.remove(); }, 350);
  };

  document.getElementById("akunSheetClose").onclick = closeSheet;

  // Swipe
  let startY = 0, dragging = false, currentDy = 0;
  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const touchY = e.touches[0].clientY;
    const headerEl = sheet.querySelector(".akun-sheet-header");
    const headerBottom = headerEl.getBoundingClientRect().bottom;
    if (touchY > headerBottom) return;
    startY = touchY; currentDy = 0; dragging = true;
    sheet.style.willChange = "transform";
    sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentDy = e.touches[0].clientY - startY;
    if (currentDy < 0) currentDy = 0;
    const r = currentDy > 120 ? 120 + (currentDy - 120) * 0.25 : currentDy;
    sheet.style.transform = `translateY(${r}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false; sheet.style.willChange = "";
    if (currentDy > 90) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });

  // format ribuan buat Ekuitas
  const ekuitasInput = document.getElementById("akunAddEkuitas");
  ekuitasInput.addEventListener("input", () => {
    const digits = ekuitasInput.value.replace(/\D/g, "");
    ekuitasInput.value = digits ? parseInt(digits, 10).toLocaleString("id-ID") : "";
  });

  // Foto profil
  const fotoWrap  = document.getElementById("akunSheetFotoWrap");
  const fotoInput = document.getElementById("akunSheetFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 1, outputSize: { w: 400, h: 400 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.querySelector(".edit-foto-empty, .edit-foto-preview").outerHTML =
        `<img src="${url}" class="edit-foto-preview">`;
    }});
  };

  // TTD
  const ttdWrap  = document.getElementById("akunAddTtdWrap");
  const ttdInput = document.getElementById("akunAddTtdInput");
  ttdWrap.onclick = () => ttdInput.click();
  ttdInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 16/9, outputSize: { w: 800, h: 450 }, onSave: blob => {
      tempTtdBlob = blob;
      const url = URL.createObjectURL(blob);
      ttdWrap.querySelector(".edit-foto-empty, .edit-foto-preview").outerHTML =
        `<img src="${url}" class="edit-foto-preview">`;
    }});
  };

  // Simpan
  document.getElementById("akunSheetSimpan").onclick = async () => {
    const btn   = document.getElementById("akunSheetSimpan");
    const errEl = document.getElementById("akunSheetError");
    errEl.textContent = "";

    const nama          = document.getElementById("akunAddNama").value.trim();
    const nik            = document.getElementById("akunAddNik").value.trim();
    const noTelepon       = document.getElementById("akunAddNoTelepon").value.trim();
    const alamat          = document.getElementById("akunAddAlamat").value.trim();
    const pekerjaan       = document.getElementById("akunAddPekerjaan").value.trim();
    const ttl             = document.getElementById("akunAddTtl").value.trim();
    const tanggalInvest   = document.getElementById("akunAddTanggalInvest").value.trim();
    const ekuitasRaw      = document.getElementById("akunAddEkuitas").value.replace(/\D/g, "");
    const email           = document.getElementById("akunAddEmail").value.trim();
    const password        = document.getElementById("akunAddPassword").value;

    if (!nama)     return errEl.textContent = "Nama wajib diisi";
    if (!nik)      return errEl.textContent = "NIK wajib diisi";
    if (!noTelepon) return errEl.textContent = "No Telepon wajib diisi";
    if (!alamat)   return errEl.textContent = "Alamat wajib diisi";
    if (!email)    return errEl.textContent = "Email wajib diisi";
    if (!password || password.length < 6) return errEl.textContent = "Password min. 6 karakter";

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membuat akun...`;

    try {
      const adminCheck = await getActiveAdminCabang(activeAkunCabangId);
      if (!adminCheck) {
        errEl.textContent = "Admin Cabang tidak aktif/tidak ditemukan. Akun batal dibuat.";
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Buat Akun`;
        return;
      }

      const cred   = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = cred.user.uid;

      let fotoUrl = "";
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const compressed = await window.compressImage(tempFotoBlob, 400, 0.78);
        const ref = window.storageRef(window.storage, `fotoUsers/${newUid}`);
        fotoUrl = await window.uploadWithProgress(ref, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto ${pct}%...`;
        });
      }

      let ttdUrl = "";
      if (tempTtdBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload TTD 0%...`;
        const compressedTtd = await window.compressImage(tempTtdBlob, 800, 0.78);
        const ttdRef = window.storageRef(window.storage, `ttd/${newUid}.png`);
        ttdUrl = await window.uploadWithProgress(ttdRef, compressedTtd, "image/png", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload TTD ${pct}%...`;
        });
      }

      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan data...`;

      await window.setDoc(window.doc(window.db, "users", newUid), {
        id: newUid,
        nama,
        nik,
        noTelepon,
        alamat,
        pekerjaan,
        tempatTanggalLahir: ttl,
        tanggalInvest,
        ekuitas: parseInt(ekuitasRaw, 10) || 0,
        return: 0,
        email,
        foto: fotoUrl,
        ttd: ttdUrl,
        role: "investor",
        idCabang: activeAkunCabangId,
        cabangEkuitas: namaCabangAktif,
        status: true,
        createdBy: adminCheck.id,
        createdAt: window.serverTimestamp(),
      });

      await window.setDoc(window.doc(window.db, "akun", newUid), {
        uid:      newUid,
        role:     "investor",
        password,
        email,
        idCabang: activeAkunCabangId,
      });

      await secondaryAuth.signOut();

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Berhasil!`;
      btn.classList.add("btn-simpan--success");

      setTimeout(() => {
        closeSheet();
        loadMarketingTab("investor");
      }, 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Buat Akun`;
      if (e.code === "auth/email-already-in-use") errEl.textContent = "Email sudah digunakan.";
      else if (e.code === "auth/invalid-email")   errEl.textContent = "Format email tidak valid.";
      else errEl.textContent = "Gagal membuat akun, coba lagi.";
    }
  };
}

// ── TAMBAH AKUN MARKETING ──
async function renderTambahMarketing(role) {
  document.getElementById("akunSheetOverlay")?.remove();
  document.getElementById("akunSheet")?.remove();

  // Wajib ada adminCabang aktif — validasi ulang (jaga-jaga race condition sejak tombol diklik)
  const adminCabang = await getActiveAdminCabang(activeAkunCabangId);
  if (!adminCabang) {
    showAkunToast("Admin Cabang belum ada, silakan buat dulu", "error");
    return;
  }
  const createdBy = adminCabang.id;

  const overlay = document.createElement("div");
  overlay.id = "akunSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  const sheet = document.createElement("div");
  sheet.id = "akunSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>
    <div class="akun-sheet-header">
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">Tambah ${role.charAt(0).toUpperCase() + role.slice(1)}</div>
        <div class="akun-sheet-role">${activeAkunCabang?.namaCabang || "-"}</div>
      </div>
      <button class="akun-sheet-close" id="akunSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="akunSheetBody">

      <div class="tab-card">
        <div class="tab-section-title">Foto Profil</div>
        <div class="edit-foto-wrap" id="akunSheetFotoWrap" style="cursor:pointer;">
          <div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Foto</div>
        </div>
        <input type="file" id="akunSheetFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Data Pribadi</div>
        ${editAkunField("Nama", "akunAddNama", "")}
        ${editAkunField("NIK", "akunAddNik", "")}
        ${editAkunField("No Telpon", "akunAddNoTelpon", "")}
        ${editAkunField("Alamat", "akunAddAlamat", "", "textarea")}
        ${editAkunField("Motivasi", "akunAddMotivasi", "", "textarea")}
        <div class="edit-field">
          <div class="edit-field-label">Tanggal Lahir</div>
          <input id="akunAddTanggalLahir" type="date" class="edit-field-input">
        </div>
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Akun</div>
        ${editAkunField("Email", "akunAddEmail", "")}
        ${editAkunField("Password", "akunAddPassword", "", "password")}
      </div>

      <div class="tab-card" id="akunAddVarianCard">
        <div class="tab-section-title">Varian</div>
        <div id="akunAddVarianList">
          <div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat varian...</div>
        </div>
        <button class="btn-tambah-row" id="akunAddTambahVarian">
          <i class="fa-solid fa-plus"></i> Tambah Varian
        </button>
      </div>

      ${role === "produksi" ? `
      <div class="tab-card" id="akunAddJenisLoyangCard">
        <div class="tab-section-title">Jenis Loyang</div>
        <div id="akunAddJenisLoyangList">
          <div class="akun-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat loyang...</div>
        </div>
        <button class="btn-tambah-row" id="akunAddTambahJenisLoyang">
          <i class="fa-solid fa-plus"></i> Tambah Jenis Loyang
        </button>
      </div>
      ` : ""}

      <div id="akunSheetError" style="color:#dc2626;font-size:12px;text-align:center;min-height:16px;margin-top:4px;"></div>
    </div>

    <div class="akun-sheet-footer">
      <button class="btn-simpan" id="akunSheetSimpan" style="flex:1;">
        <i class="fa-solid fa-user-plus"></i> Buat Akun
      </button>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => { overlay.classList.add("show"); sheet.classList.add("show"); });

  let tempFotoBlob = null;

  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { overlay.remove(); sheet.remove(); }, 350);
  };

  document.getElementById("akunSheetClose").onclick = closeSheet;

  // Swipe
  let startY = 0, dragging = false, currentDy = 0;
  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const touchY = e.touches[0].clientY;
    const headerEl = sheet.querySelector(".akun-sheet-header");
    const headerBottom = headerEl.getBoundingClientRect().bottom;
    if (touchY > headerBottom) return;
    startY = touchY; currentDy = 0; dragging = true;
    sheet.style.willChange = "transform";
    sheet.style.transition = "none";
  }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentDy = e.touches[0].clientY - startY;
    if (currentDy < 0) currentDy = 0;
    const r = currentDy > 120 ? 120 + (currentDy - 120) * 0.25 : currentDy;
    sheet.style.transform = `translateY(${r}px)`;
  }, { passive: true });
  sheet.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false; sheet.style.willChange = "";
    if (currentDy > 90) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });

  // Varian & Jenis Loyang
  let varianList = [];
  let jenisLoyangList = [];

  window.getDoc(window.doc(window.db, "kantorCabang", activeAkunCabangId)).then(snap => {
    const kantorData   = snap.data() || {};
    const varianKantor = kantorData.varian || {};
    const hargaKantor  = kantorData.harga  || {};
    varianList = Object.keys(varianKantor).map(kode => ({
      kode, nama: varianKantor[kode],
      hargaKonsumen: hargaKantor[kode] || 0,
      hargaProduksi: 0, isAktif: true,
    }));
    renderVarianList();

    if (role === "produksi") {
      const loyangKantor = kantorData.loyang || [];
      jenisLoyangList = loyangKantor.map(l => ({
        jenisLoyang: l.jenisLoyang || "",
        status:      l.status !== false,
        upah:        l.upah || 0,
      }));
      renderJenisLoyangList();
    }
  });

  function renderVarianList() {
    const container = document.getElementById("akunAddVarianList");
    if (!container) return;
    container.innerHTML = varianList.map((v, i) => `
      <div class="akun-varian-row">
        <div class="akun-varian-header">
          <div style="display:flex;gap:8px;align-items:center;flex:1;">
            <input class="edit-field-input akun-add-varian-kode" style="width:60px;font-weight:700;"
              value="${v.kode}" placeholder="Kode" data-index="${i}">
            <input class="edit-field-input akun-add-varian-nama" style="flex:1;"
              value="${v.nama}" placeholder="Nama" data-index="${i}">
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label class="akun-varian-toggle">
              <input type="checkbox" class="akun-add-varian-aktif" data-index="${i}" ${v.isAktif ? 'checked' : ''}>
              <span class="akun-toggle-label">Aktif</span>
            </label>
            <button class="btn-hapus-row akun-add-hapus-varian" data-index="${i}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="akun-varian-fields">
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Harga Konsumen</div>
            <input class="edit-field-input akun-add-varian-konsumen" type="number"
              value="${v.hargaKonsumen}" data-index="${i}">
          </div>
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Harga Produksi</div>
            <input class="edit-field-input akun-add-varian-produksi" type="number"
              value="${v.hargaProduksi}" data-index="${i}">
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".akun-add-varian-kode").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].kode = el.value.toUpperCase(); };
    });
    container.querySelectorAll(".akun-add-varian-nama").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].nama = el.value; };
    });
    container.querySelectorAll(".akun-add-varian-konsumen").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].hargaKonsumen = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-varian-produksi").forEach(el => {
      el.oninput = () => { varianList[parseInt(el.dataset.index)].hargaProduksi = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-varian-aktif").forEach(el => {
      el.onchange = () => { varianList[parseInt(el.dataset.index)].isAktif = el.checked; };
    });
    container.querySelectorAll(".akun-add-hapus-varian").forEach(el => {
      el.onclick = () => { varianList.splice(parseInt(el.dataset.index), 1); renderVarianList(); };
    });
  }

  function renderJenisLoyangList() {
    const container = document.getElementById("akunAddJenisLoyangList");
    if (!container) return;
    container.innerHTML = jenisLoyangList.map((l, i) => `
      <div class="akun-varian-row">
        <div class="akun-varian-header">
          <div style="display:flex;gap:8px;align-items:center;flex:1;">
            <input class="edit-field-input akun-add-loyang-jenis" style="flex:1;"
              value="${l.jenisLoyang}" placeholder="Jenis Loyang" data-index="${i}">
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label class="akun-varian-toggle">
              <input type="checkbox" class="akun-add-loyang-status" data-index="${i}" ${l.status ? 'checked' : ''}>
              <span class="akun-toggle-label">Aktif</span>
            </label>
            <button class="btn-hapus-row akun-add-hapus-loyang" data-index="${i}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="akun-varian-fields">
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Upah</div>
            <input class="edit-field-input akun-add-loyang-upah" type="number"
              value="${l.upah}" data-index="${i}">
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".akun-add-loyang-jenis").forEach(el => {
      el.oninput = () => { jenisLoyangList[parseInt(el.dataset.index)].jenisLoyang = el.value; };
    });
    container.querySelectorAll(".akun-add-loyang-upah").forEach(el => {
      el.oninput = () => { jenisLoyangList[parseInt(el.dataset.index)].upah = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-add-loyang-status").forEach(el => {
      el.onchange = () => { jenisLoyangList[parseInt(el.dataset.index)].status = el.checked; };
    });
    container.querySelectorAll(".akun-add-hapus-loyang").forEach(el => {
      el.onclick = () => { jenisLoyangList.splice(parseInt(el.dataset.index), 1); renderJenisLoyangList(); };
    });
  }

  document.getElementById("akunAddTambahVarian").onclick = () => {
    varianList.push({ kode: "", nama: "", hargaKonsumen: 0, hargaProduksi: 0, isAktif: true });
    renderVarianList();
  };

  document.getElementById("akunAddTambahJenisLoyang")?.addEventListener("click", () => {
    jenisLoyangList.push({ jenisLoyang: "", status: true, upah: 0 });
    renderJenisLoyangList();
  });

  // Foto
  const fotoWrap  = document.getElementById("akunSheetFotoWrap");
  const fotoInput = document.getElementById("akunSheetFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 1, outputSize: { w: 400, h: 400 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.querySelector(".edit-foto-empty, .edit-foto-preview").outerHTML =
        `<img src="${url}" class="edit-foto-preview">`;
    }});
  };

  // Enter pindah field
  const fields = ["akunAddNama","akunAddNik","akunAddNoTelpon","akunAddAlamat","akunAddMotivasi","akunAddEmail","akunAddPassword"];
  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = document.getElementById(fields[i + 1]);
      if (next) next.focus();
      else document.getElementById("akunSheetSimpan")?.click();
    });
  });

  // Simpan
  document.getElementById("akunSheetSimpan").onclick = async () => {
    const btn   = document.getElementById("akunSheetSimpan");
    const errEl = document.getElementById("akunSheetError");
    errEl.textContent = "";

    const nama      = document.getElementById("akunAddNama").value.trim();
    const nik       = document.getElementById("akunAddNik").value.trim();
    const noTelpon  = document.getElementById("akunAddNoTelpon").value.trim();
    const alamat    = document.getElementById("akunAddAlamat").value.trim();
    const motivasi  = document.getElementById("akunAddMotivasi").value.trim();
    const tglRaw    = document.getElementById("akunAddTanggalLahir").value;
    const email     = document.getElementById("akunAddEmail").value.trim();
    const password  = document.getElementById("akunAddPassword").value;

    if (!nama)                        return errEl.textContent = "Nama wajib diisi";
    if (!nik)                         return errEl.textContent = "NIK wajib diisi";
    if (!noTelpon)                    return errEl.textContent = "No Telpon wajib diisi";
    if (!alamat)                      return errEl.textContent = "Alamat wajib diisi";
    if (!email)                       return errEl.textContent = "Email wajib diisi";
    if (!password || password.length < 6) return errEl.textContent = "Password min. 6 karakter";

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Membuat akun...`;

    try {
      // Re-cek adminCabang aktif tepat sebelum eksekusi
      const adminCheck = await getActiveAdminCabang(activeAkunCabangId);
      if (!adminCheck) {
        errEl.textContent = "Admin Cabang tidak aktif/tidak ditemukan. Akun batal dibuat.";
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Buat Akun`;
        return;
      }
      const createdByFinal = adminCheck.id;

      const varianUsers = varianList.map(v => ({
        [v.kode]: {
          hargaKonsumen: v.hargaKonsumen,
          hargaProduksi: v.hargaProduksi,
          isAktif:       v.isAktif,
        }
      }));

      const cred   = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = cred.user.uid;

      let fotoUrl = "";
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 400, 0.78);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const ref = window.storageRef(window.storage, `fotoUsers/${newUid}`);
        fotoUrl = await window.uploadWithProgress(ref, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto ${pct}%...`;
        });
      }

      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan data...`;

      const payloadUser = {
        id:           newUid,
        nama, nik, noTelpon, alamat, motivasi,
        tanggalLahir: tglRaw ? new Date(tglRaw) : null,
        email,
        foto:         fotoUrl,
        role,
        idCabang:     activeAkunCabangId,
        kantorCabang: activeAkunCabang?.namaCabang || "",
        varian:       varianUsers,
        status:       true,
        createdBy: createdByFinal,
        createdAt:    window.serverTimestamp(),
      };

      if (role === "produksi") {
        payloadUser.loyang = jenisLoyangList.map(l => ({
          jenisLoyang: l.jenisLoyang,
          status: l.status,
          upah: l.upah,
        }));
      }

      await window.setDoc(window.doc(window.db, "users", newUid), payloadUser);

      await window.setDoc(window.doc(window.db, "akun", newUid), {
        uid:      newUid,
        role,
        password,
        email,
        idCabang: activeAkunCabangId,
      });

      await secondaryAuth.signOut();

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Berhasil!`;
      btn.classList.add("btn-simpan--success");

      setTimeout(() => {
        closeSheet();
        loadMarketingTab(role);
      }, 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Buat Akun`;
      if (e.code === "auth/email-already-in-use") errEl.textContent = "Email sudah digunakan.";
      else if (e.code === "auth/invalid-email")   errEl.textContent = "Format email tidak valid.";
      else errEl.textContent = "Gagal membuat akun, coba lagi.";
    }
  };
}

function showAkunReauthPopup(title, message, actionLabel, actionClass) {
  return new Promise(resolve => {
    document.getElementById("akunReauthOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "akunReauthOverlay";
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-icon"><i class="fa-solid fa-lock"></i></div>
        <div class="confirm-title">${title}</div>
        <div class="confirm-msg">${message}</div>
        <div class="confirm-pass-wrap">
          <input type="password" id="akunReauthPassInput" class="edit-field-input" placeholder="Password akun kamu...">
          <div class="confirm-pass-error" id="akunReauthPassError"></div>
        </div>
        <div class="confirm-actions">
          <button class="btn-batal" id="akunReauthBatal">Batal</button>
          <button class="${actionClass}" id="akunReauthOk">${actionLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    setTimeout(() => document.getElementById("akunReauthPassInput")?.focus(), 300);

    const close = (result) => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    document.getElementById("akunReauthBatal").onclick = () => close(null);
    overlay.onclick = e => { if (e.target === overlay) close(null); };
    document.getElementById("akunReauthPassInput").addEventListener("keydown", e => {
      if (e.key === "Enter") document.getElementById("akunReauthOk").click();
    });

    document.getElementById("akunReauthOk").onclick = async () => {
      const btn = document.getElementById("akunReauthOk");
      const passInput = document.getElementById("akunReauthPassInput");
      const errEl = document.getElementById("akunReauthPassError");
      const password = passInput.value;
      if (!password) { errEl.textContent = "Password tidak boleh kosong."; return; }

      const originalLabel = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi...`;
      errEl.textContent = "";

      try {
        const user = window.auth.currentUser;
        const credential = window.EmailAuthProvider.credential(user.email, password);
        await window.reauthenticateWithCredential(user, credential);
        close(true);
      } catch (err) {
        console.error("❌ reauth:", err);
        errEl.textContent = "Password salah.";
        btn.disabled = false;
        btn.innerHTML = originalLabel;
      }
    };
  });
}

function showAkunGantiPasswordPopup(u) {
  return new Promise(resolve => {
    document.getElementById("akunGantiPassOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "akunGantiPassOverlay";
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-icon"><i class="fa-solid fa-key"></i></div>
        <div class="confirm-title">Ubah Password Akun</div>
        <div class="confirm-msg">Masukkan password baru untuk <strong>${u.nama}</strong>, lalu password akun kamu sendiri untuk konfirmasi.</div>
        <div class="confirm-pass-wrap">
          <input type="password" id="akunGantiPassBaru" class="edit-field-input" placeholder="Password baru (min. 6 karakter)" style="margin-bottom:8px;">
          <input type="password" id="akunGantiPassSendiri" class="edit-field-input" placeholder="Password akun kamu...">
          <div class="confirm-pass-error" id="akunGantiPassError"></div>
        </div>
        <div class="confirm-actions">
          <button class="btn-batal" id="akunGantiPassBatal">Batal</button>
          <button class="btn-simpan" id="akunGantiPassOk">Simpan</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    setTimeout(() => document.getElementById("akunGantiPassBaru")?.focus(), 300);

    const close = (result) => {
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    document.getElementById("akunGantiPassBatal").onclick = () => close(null);
    overlay.onclick = e => { if (e.target === overlay) close(null); };

    document.getElementById("akunGantiPassOk").onclick = async () => {
      const btn = document.getElementById("akunGantiPassOk");
      const passBaru = document.getElementById("akunGantiPassBaru").value.trim();
      const passSendiri = document.getElementById("akunGantiPassSendiri").value;
      const errEl = document.getElementById("akunGantiPassError");

      if (passBaru.length < 6) { errEl.textContent = "Password baru minimal 6 karakter."; return; }
      if (!passSendiri) { errEl.textContent = "Password akun kamu wajib diisi."; return; }

      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memverifikasi...`;
      errEl.textContent = "";

      try {
        const user = window.auth.currentUser;
        const credential = window.EmailAuthProvider.credential(user.email, passSendiri);
        await window.reauthenticateWithCredential(user, credential);
        close(passBaru);
      } catch (err) {
        console.error("❌ reauth (ganti password):", err);
        errEl.textContent = "Password akun kamu salah.";
        btn.disabled = false;
        btn.innerHTML = "Simpan";
      }
    };
  });
}
async function gantiAkunPasswordAdminPusat(u) {
  const passwordBaru = await showAkunGantiPasswordPopup(u);
  if (!passwordBaru) return;

  try {
    const akunSnap = await window.getDocs(
      window.query(window.collection(window.db, "akun"), window.where("uid", "==", u.id))
    );
    if (akunSnap.empty) throw new Error("Data login akun tidak ditemukan");
    const akunDoc = akunSnap.docs[0];
    const { email, password: passwordLama, role, idCabang } = akunDoc.data();
    if (!email || !passwordLama) throw new Error("Email/password akun tidak lengkap");

    const cred = await signInWithEmailAndPassword(secondaryAuth, email, passwordLama);
    await updatePassword(cred.user, passwordBaru);
    await signOut(secondaryAuth);

    await window.deleteDoc(window.doc(window.db, "akun", akunDoc.id));
    await window.setDoc(window.doc(window.db, "akun", akunDoc.id), {
      uid: u.id, role, password: passwordBaru, email, idCabang,
    });

    window.showAkunToast("Password berhasil diubah", "success");
  } catch (err) {
    console.error("❌ gantiAkunPasswordAdminPusat:", err);
    const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
      ? "Password tersimpan tidak valid — user mungkin pernah ganti password sendiri"
      : err.code === "auth/weak-password"
      ? "Password baru terlalu lemah"
      : "Gagal mengubah password";
    window.showAkunToast(msg, "error");
  }
}
async function cekMasihPunyaCustomerAdminPusat(uid, role, idCabang) {
  try {
    let q;
    if (role === "kurir") {
      q = window.query(window.collection(window.db, "customer"), window.where("pemilik", "==", uid), window.where("idCabang", "==", idCabang), window.limit(1));
    } else if (role === "sales") {
      q = window.query(window.collection(window.db, "customerSales"), window.where("pemilik", "==", uid), window.where("idCabang", "==", idCabang), window.limit(1));
    } else if (role === "hunter") {
      q = window.query(window.collection(window.db, "users", uid, "customerBaruHunter"), window.where("idCabang", "==", idCabang), window.limit(1));
    } else {
      return false;
    }
    const snap = await window.getDocs(q);
    return !snap.empty;
  } catch (err) {
    console.error("❌ cekMasihPunyaCustomerAdminPusat:", err);
    window.showAkunToast("Gagal mengecek data customer, coba lagi", "error");
    return true;
  }
}
function showAkunMasihPunyaCustomerPopup(nama) {
  document.getElementById("akunMasihCustomerOverlay")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "akunMasihCustomerOverlay";
  overlay.className = "confirm-overlay";
  overlay.innerHTML = `
    <div class="confirm-box">
      <div class="confirm-icon" style="background:rgba(220,38,38,0.1);"><i class="fa-solid fa-triangle-exclamation" style="color:#dc2626"></i></div>
      <div class="confirm-title">Tidak Bisa Dihapus</div>
      <div class="confirm-msg">Akun <strong>${nama}</strong> masih memiliki customer yang terdaftar. Pindahkan atau hapus customer tersebut terlebih dahulu.</div>
      <div class="confirm-actions">
        <button class="btn-simpan" id="akunMasihCustomerOke" style="flex:1;">Mengerti</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));
  const close = () => { overlay.classList.remove("show"); setTimeout(() => overlay.remove(), 200); };
  document.getElementById("akunMasihCustomerOke").onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
}
async function hapusAkunPermanenAdminPusat(u) {
  if (["kurir", "sales", "hunter"].includes(u.role)) {
    const masihAda = await cekMasihPunyaCustomerAdminPusat(u.id, u.role, u.idCabang);
    if (masihAda) { showAkunMasihPunyaCustomerPopup(u.nama || "-"); return; }
  }

  const confirmed = await showAkunReauthPopup(
    "Hapus Akun Permanen",
    `Masukkan password akun kamu untuk menghapus <strong>${u.nama}</strong> secara permanen. Tindakan ini tidak bisa dibatalkan!`,
    "Hapus",
    "btn-hapus"
  );
  if (!confirmed) return;

  try {
    const akunSnap = await window.getDocs(
      window.query(window.collection(window.db, "akun"), window.where("uid", "==", u.id))
    );
    if (akunSnap.empty) throw new Error("Data login akun tidak ditemukan");
    const akunDoc = akunSnap.docs[0];
    const { email, password } = akunDoc.data();
    if (!email || !password) throw new Error("Email/password akun tidak lengkap");

    const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
    await cred.user.delete();
    await signOut(secondaryAuth);

    try {
      await window.deleteObject(window.storageRef(window.storage, `fotoUsers/${u.id}`));
    } catch (err) {
      if (err.code !== "storage/object-not-found") console.error("❌ hapus foto storage:", err);
    }

    await window.deleteDoc(window.doc(window.db, "akun", akunDoc.id));
    await window.deleteDoc(window.doc(window.db, "users", u.id));

    window.showAkunToast("Akun berhasil dihapus permanen", "success");

    document.getElementById("akunSheet")?.classList.remove("show");
    document.getElementById("akunSheetOverlay")?.classList.remove("show");
    setTimeout(() => {
      document.getElementById("akunSheet")?.remove();
      document.getElementById("akunSheetOverlay")?.remove();
    }, 350);

    const activeTab = document.querySelector(".akun-tab.active")?.dataset.tab;
    if (activeTab === "adminCabang") loadAdminCabangTab();
    else loadMarketingTab(activeTab);
  } catch (err) {
    console.error("❌ hapusAkunPermanenAdminPusat:", err);
    const msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
      ? "Password tersimpan tidak valid — user mungkin pernah ganti password sendiri"
      : "Gagal menghapus akun";
    window.showAkunToast(msg, "error");
  }
}

window.openAkunDetail = async function(uid) {
  const snap = await window.getDoc(window.doc(window.db, "users", uid));
  if (!snap.exists()) return;
  const u = { id: uid, ...snap.data() };
  renderAkunSheet(u);
};

async function loadAkunPasswordForSheet(uid) {
  const valueEl   = document.getElementById("akunSheetPasswordValue");
  const toggleBtn = document.getElementById("akunSheetPasswordToggle");
  if (!valueEl) return;

  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "akun"),
        window.where("uid", "==", uid)
      )
    );

    if (snap.empty) {
      valueEl.textContent = "-";
      return;
    }

    const rawPassword = snap.docs[0].data().password || "-";
    let visible = false;

    const render = () => {
      valueEl.textContent = visible ? rawPassword : "•".repeat(Math.min(rawPassword.length, 10));
    };
    render();

    toggleBtn?.addEventListener("click", () => {
      visible = !visible;
      render();
      const icon = toggleBtn.querySelector("i");
      if (icon) icon.className = visible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
    });
  } catch (e) {
    console.error("❌ loadAkunPasswordForSheet:", e);
    valueEl.textContent = "Gagal memuat";
  }
}

function renderAkunSheet(u) {
  // Hapus sheet lama
  document.getElementById("akunSheetOverlay")?.remove();
  document.getElementById("akunSheet")?.remove();

  const initial = (u.nama || "?")[0].toUpperCase();
  const isAktif = u.status !== false;

  // Overlay
  const overlay = document.createElement("div");
  overlay.id = "akunSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  // Sheet
  const sheet = document.createElement("div");
  sheet.id = "akunSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>

    <div class="akun-sheet-header">
      ${u.foto
        ? `<img src="${u.foto}" class="akun-sheet-foto" id="akunSheetFoto" onclick="openFotoPopup('${u.foto}')">`
        : `<div class="akun-sheet-foto-placeholder">${initial}</div>`
      }
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">${u.nama || "-"}</div>
        <div class="akun-sheet-role">${u.role || "-"} • <span class="akun-card-status ${isAktif ? 'aktif' : 'nonaktif'}">${isAktif ? 'Aktif' : 'Nonaktif'}</span></div>
      </div>
      <button class="akun-sheet-close" id="akunSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="akunSheetBody">

      <!-- FOTO -->
      <div class="tab-card">
        <div class="tab-section-title">Foto Profil</div>
        <div class="edit-foto-wrap" id="akunSheetFotoWrap" style="cursor:pointer;">
          ${u.foto
            ? `<img src="${u.foto}" class="edit-foto-preview">`
            : `<div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>`
          }
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Ganti Foto</div>
        </div>
        <input type="file" id="akunSheetFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      ${u.role === "investor" ? `
      <!-- DATA PRIBADI (khusus Investor) -->
      <div class="tab-card">
        <div class="tab-section-title">Data Pribadi</div>
        ${editAkunField("Nama", "akunEditNama", u.nama)}
        ${editAkunField("NIK", "akunEditNik", u.nik)}
        ${editAkunField("No Telepon", "akunEditNoTelepon", u.noTelepon)}
        ${editAkunField("Alamat", "akunEditAlamat", u.alamat, "textarea")}
        ${editAkunField("Pekerjaan", "akunEditPekerjaan", u.pekerjaan)}
        ${editAkunField("Tempat, Tanggal Lahir", "akunEditTtl", u.tempatTanggalLahir)}
        <div class="edit-field">
          <div class="edit-field-label">Password</div>
          <div class="akun-password-display">
            <span id="akunSheetPasswordValue" class="akun-password-text">Memuat...</span>
            <button type="button" class="akun-password-toggle" id="akunSheetPasswordToggle" title="Lihat password">
              <i class="fa-solid fa-eye"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Data Investasi</div>
        <div class="edit-field">
          <div class="edit-field-label">Cabang Ekuitas</div>
          <input id="akunEditCabangEkuitas" type="text" class="edit-field-input" value="${u.cabangEkuitas || ""}" readonly style="opacity:0.7;">
        </div>
        ${editAkunField("Tanggal Investasi", "akunEditTanggalInvest", u.tanggalInvest)}
        <div class="edit-field">
          <div class="edit-field-label">Ekuitas (Rp)</div>
          <input id="akunEditEkuitas" type="text" inputmode="numeric" class="edit-field-input" value="${(u.ekuitas || 0).toLocaleString("id-ID")}">
        </div>
      </div>

      <div class="tab-card edit-foto-card">
        <div class="tab-section-title">Tanda Tangan</div>
        <div class="edit-foto-wrap" id="akunEditTtdWrap" style="cursor:pointer;">
          ${u.ttd
            ? `<img src="${u.ttd}" class="edit-foto-preview">`
            : `<div class="edit-foto-empty"><i class="fa-solid fa-signature"></i></div>`
          }
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Ganti TTD</div>
        </div>
        <input type="file" id="akunEditTtdInput" accept="image/*" class="edit-foto-input">
      </div>
      ` : `
      <!-- DATA UMUM -->
      <div class="tab-card">
        <div class="tab-section-title">Data Umum</div>
        ${editAkunField("Nama", "akunEditNama", u.nama)}
        ${editAkunField("NIK", "akunEditNik", u.nik)}
        ${editAkunField("No Telpon", "akunEditNoTelpon", u.noTelpon)}
        ${editAkunField("Alamat", "akunEditAlamat", u.alamat, "textarea")}
        ${editAkunField("Motivasi", "akunEditMotivasi", u.motivasi, "textarea")}
        <div class="edit-field">
          <div class="edit-field-label">Tanggal Lahir</div>
          <input id="akunEditTanggalLahir" type="date" class="edit-field-input" value="${
            u.tanggalLahir?.toDate
              ? u.tanggalLahir.toDate().toISOString().split("T")[0]
              : (u.tanggalLahir || "")
          }">
        </div>
        ${u.role === "adminCabang" ? editAkunField("Kantor Cabang", "akunEditKantorCabang", u.kantorCabang) : ""}
        <div class="edit-field">
          <div class="edit-field-label">Password</div>
          <div class="akun-password-display">
            <span id="akunSheetPasswordValue" class="akun-password-text">Memuat...</span>
            <button type="button" class="akun-password-toggle" id="akunSheetPasswordToggle" title="Lihat password">
              <i class="fa-solid fa-eye"></i>
            </button>
          </div>
        </div>
      </div>

      ${u.role === "adminCabang" ? `
      <!-- PEMBAGIAN LABA BERSIH (khusus Admin Cabang) -->
      <div class="tab-card">
        <div class="tab-section-title">Pembagian Laba Bersih (%)</div>
        <div class="edit-field">
          <div class="edit-field-label">Manager</div>
          <input id="akunEditLabaManager" type="number" class="edit-field-input" value="${u.pembagianLabaBersih?.manager || 0}">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Kas</div>
          <input id="akunEditLabaKas" type="number" class="edit-field-input" value="${u.pembagianLabaBersih?.kas || 0}">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Dividen</div>
          <input id="akunEditLabaDividen" type="number" class="edit-field-input" value="${u.pembagianLabaBersih?.dividen || 0}">
        </div>
      </div>
      ` : ""}

      <!-- VARIAN -->
      <div class="tab-card">
        <div class="tab-section-title">Varian</div>
        ${(u.varian || []).map((v, i) => {
          const kode = Object.keys(v)[0];
          const val  = v[kode];
          return `
            <div class="akun-varian-row">
              <div class="akun-varian-header">
                <span class="akun-varian-kode">${kode}</span>
                <label class="akun-varian-toggle">
                  <input type="checkbox" id="akunVarianAktif_${i}" ${val.isAktif ? 'checked' : ''}>
                  <span class="akun-toggle-label">Aktif</span>
                </label>
              </div>
              <div class="akun-varian-fields">
                <div class="edit-field" style="flex:1;">
                  <div class="edit-field-label">Harga Konsumen</div>
                  <input id="akunVarianKonsumen_${i}" type="number" class="edit-field-input" value="${val.hargaKonsumen || 0}">
                </div>
                <div class="edit-field" style="flex:1;">
                  <div class="edit-field-label">Harga Produksi</div>
                  <input id="akunVarianProduksi_${i}" type="number" class="edit-field-input" value="${val.hargaProduksi || 0}">
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      ${u.role === "produksi" ? `
      <!-- JENIS LOYANG (khusus Produksi) -->
      <div class="tab-card" id="akunEditJenisLoyangCard">
        <div class="tab-section-title">Jenis Loyang</div>
        <div id="akunEditJenisLoyangList">
          ${(u.loyang || []).map((l, i) => `
            <div class="akun-varian-row" data-index="${i}">
              <div class="akun-varian-header">
                <div style="display:flex;gap:8px;align-items:center;flex:1;">
                  <input class="edit-field-input akun-edit-loyang-jenis" style="flex:1;"
                    value="${l.jenisLoyang || ""}" placeholder="Jenis Loyang" data-index="${i}">
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <label class="akun-varian-toggle">
                    <input type="checkbox" class="akun-edit-loyang-status" data-index="${i}" ${l.status !== false ? 'checked' : ''}>
                    <span class="akun-toggle-label">Aktif</span>
                  </label>
                  <button class="btn-hapus-row akun-edit-hapus-loyang" data-index="${i}">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </div>
              </div>
              <div class="akun-varian-fields">
                <div class="edit-field" style="flex:1;">
                  <div class="edit-field-label">Upah</div>
                  <input class="edit-field-input akun-edit-loyang-upah" type="number"
                    value="${l.upah || 0}" data-index="${i}">
                </div>
              </div>
            </div>
          `).join("")}
        </div>
        <button class="btn-tambah-row" id="akunEditTambahJenisLoyang">
          <i class="fa-solid fa-plus"></i> Tambah Jenis Loyang
        </button>
      </div>
      ` : ""}
      `}

      <div id="akunSheetError" style="color:#dc2626;font-size:12px;text-align:center;min-height:16px;margin-top:4px;"></div>
    </div>

    <div class="akun-sheet-footer" style="flex-wrap:wrap;">
      <button class="${isAktif ? 'btn-nonaktif' : 'btn-aktifkan'}" id="akunSheetToggleStatus">
        <i class="fa-solid ${isAktif ? 'fa-user-slash' : 'fa-user-check'}"></i>
        ${isAktif ? 'Nonaktifkan' : 'Aktifkan'}
      </button>
      <button class="btn-simpan" id="akunSheetSimpan" style="flex:2;">
        <i class="fa-solid fa-floppy-disk"></i> Simpan
      </button>
      <button class="btn-nonaktif" id="akunSheetGantiPassword" style="flex:1 1 100%; background:rgba(59,130,246,0.1); color:#3b82f6;">
        <i class="fa-solid fa-key"></i> Ganti Password
      </button>
      <button class="btn-hapus" id="akunSheetHapusPermanen" style="flex:1 1 100%;">
        <i class="fa-solid fa-trash"></i> Hapus Akun Permanen
      </button>
    </div>
  `;

  document.body.appendChild(sheet);

  // Animasi masuk
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    sheet.classList.add("show");
  });

  loadAkunPasswordForSheet(u.id);

  let tempFotoBlob = null;
  let jenisLoyangEditList = JSON.parse(JSON.stringify(u.loyang || []));

  function renderJenisLoyangEditList() {
    const container = document.getElementById("akunEditJenisLoyangList");
    if (!container) return;

    container.innerHTML = jenisLoyangEditList.map((l, i) => `
      <div class="akun-varian-row" data-index="${i}">
        <div class="akun-varian-header">
          <div style="display:flex;gap:8px;align-items:center;flex:1;">
            <input class="edit-field-input akun-edit-loyang-jenis" style="flex:1;"
              value="${l.jenisLoyang || ""}" placeholder="Jenis Loyang" data-index="${i}">
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label class="akun-varian-toggle">
              <input type="checkbox" class="akun-edit-loyang-status" data-index="${i}" ${l.status !== false ? 'checked' : ''}>
              <span class="akun-toggle-label">Aktif</span>
            </label>
            <button class="btn-hapus-row akun-edit-hapus-loyang" data-index="${i}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="akun-varian-fields">
          <div class="edit-field" style="flex:1;">
            <div class="edit-field-label">Upah</div>
            <input class="edit-field-input akun-edit-loyang-upah" type="number"
              value="${l.upah || 0}" data-index="${i}">
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".akun-edit-loyang-jenis").forEach(el => {
      el.oninput = () => { jenisLoyangEditList[parseInt(el.dataset.index)].jenisLoyang = el.value; };
    });
    container.querySelectorAll(".akun-edit-loyang-upah").forEach(el => {
      el.oninput = () => { jenisLoyangEditList[parseInt(el.dataset.index)].upah = parseInt(el.value) || 0; };
    });
    container.querySelectorAll(".akun-edit-loyang-status").forEach(el => {
      el.onchange = () => { jenisLoyangEditList[parseInt(el.dataset.index)].status = el.checked; };
    });
    container.querySelectorAll(".akun-edit-hapus-loyang").forEach(el => {
      el.onclick = () => { jenisLoyangEditList.splice(parseInt(el.dataset.index), 1); renderJenisLoyangEditList(); };
    });
  }

  document.getElementById("akunEditTambahJenisLoyang")?.addEventListener("click", () => {
    jenisLoyangEditList.push({ jenisLoyang: "", status: true, upah: 0 });
    renderJenisLoyangEditList();
  });

  // Close
  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.classList.remove("show");
    setTimeout(() => { overlay.remove(); sheet.remove(); }, 350);
  };

  document.getElementById("akunSheetClose").onclick = closeSheet;

  // Swipe down to close dari seluruh sheet header + handle
  const swipeZone = sheet.querySelector(".akun-sheet-header");
  let startY = 0, dragging = false, currentDy = 0;

  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const touchY = e.touches[0].clientY;
    const sheetTop = sheet.getBoundingClientRect().top;
    const headerEl = sheet.querySelector(".akun-sheet-header");
    const headerBottom = headerEl.getBoundingClientRect().bottom;
    if (touchY > headerBottom) return;
    startY = touchY;
    currentDy = 0;
    dragging = true;
    sheet.style.willChange = "transform";
    sheet.style.transition = "none";
  }, { passive: true });

  sheet.addEventListener("touchmove", e => {
    if (!dragging) return;
    currentDy = e.touches[0].clientY - startY;
    if (currentDy < 0) currentDy = 0;
    const resistance = currentDy > 120 ? 120 + (currentDy - 120) * 0.25 : currentDy;
    sheet.style.transform = `translateY(${resistance}px)`;
  }, { passive: true });

  sheet.addEventListener("touchend", () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.willChange = "";
    if (currentDy > 90) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });

  // Cegah scroll body sheet trigger pull to refresh
  const sheetBody = document.getElementById("akunSheetBody");
  sheetBody.addEventListener("touchmove", e => {
    e.stopPropagation();
  }, { passive: true });

  // Foto
  const fotoWrap  = document.getElementById("akunSheetFotoWrap");
  const fotoInput = document.getElementById("akunSheetFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 1, outputSize: { w: 400, h: 400 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.querySelector(".edit-foto-preview, .edit-foto-empty").outerHTML =
        `<img src="${url}" class="edit-foto-preview" id="akunSheetFotoPreview">`;
    }});
  };

  // TTD (khusus Investor)
  const ttdWrap  = document.getElementById("akunEditTtdWrap");
  const ttdInput = document.getElementById("akunEditTtdInput");
  if (ttdWrap && ttdInput) {
    ttdWrap.onclick = () => ttdInput.click();
    ttdInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      window.openCropModal({ file, ratio: 16/9, outputSize: { w: 800, h: 450 }, onSave: blob => {
        tempTtdBlob = blob;
        const url = URL.createObjectURL(blob);
        ttdWrap.querySelector(".edit-foto-preview, .edit-foto-empty").outerHTML =
          `<img src="${url}" class="edit-foto-preview">`;
      }});
    };
  }

  // Toggle status
  document.getElementById("akunSheetToggleStatus").onclick = () => {
    showConfirmToggleStatus(u, isAktif, closeSheet);
  };

  document.getElementById("akunSheetGantiPassword")?.addEventListener("click", () => gantiAkunPasswordAdminPusat(u));
  document.getElementById("akunSheetHapusPermanen")?.addEventListener("click", () => hapusAkunPermanenAdminPusat(u));

  // Simpan
  document.getElementById("akunSheetSimpan").onclick = async () => {
    const btn    = document.getElementById("akunSheetSimpan");
    const errEl  = document.getElementById("akunSheetError");
    errEl.textContent = "";
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
      let updates = {};

      if (u.role === "investor") {
        updates = {
          nama:               document.getElementById("akunEditNama").value.trim(),
          nik:                document.getElementById("akunEditNik").value.trim(),
          noTelepon:          document.getElementById("akunEditNoTelepon").value.trim(),
          alamat:             document.getElementById("akunEditAlamat").value.trim(),
          pekerjaan:          document.getElementById("akunEditPekerjaan").value.trim(),
          tempatTanggalLahir: document.getElementById("akunEditTtl").value.trim(),
          tanggalInvest:      document.getElementById("akunEditTanggalInvest").value.trim(),
          ekuitas:            parseInt(document.getElementById("akunEditEkuitas").value.replace(/\D/g, "")) || 0,
        };

        if (tempTtdBlob) {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload TTD 0%...`;
          const compressedTtd = await window.compressImage(tempTtdBlob, 800, 0.78);
          const ttdRef = window.storageRef(window.storage, `ttd/${u.id}.png`);
          updates.ttd = await window.uploadWithProgress(ttdRef, compressedTtd, "image/png", pct => {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload TTD ${pct}%...`;
          });
        }
      } else {
        // Baca varian dari DOM
        const varianFinal = (u.varian || []).map((v, i) => {
          const kode = Object.keys(v)[0];
          return {
            [kode]: {
              hargaKonsumen: parseInt(document.getElementById(`akunVarianKonsumen_${i}`)?.value) || 0,
              hargaProduksi: parseInt(document.getElementById(`akunVarianProduksi_${i}`)?.value) || 0,
              isAktif: document.getElementById(`akunVarianAktif_${i}`)?.checked ?? true,
            }
          };
        });

        const tglRaw = document.getElementById("akunEditTanggalLahir").value;
        updates = {
          nama:         document.getElementById("akunEditNama").value.trim(),
          nik:          document.getElementById("akunEditNik").value.trim(),
          noTelpon:     document.getElementById("akunEditNoTelpon").value.trim(),
          alamat:       document.getElementById("akunEditAlamat").value.trim(),
          motivasi:     document.getElementById("akunEditMotivasi").value.trim(),
          tanggalLahir: tglRaw ? new Date(tglRaw) : null,
          varian:       varianFinal,
        };

        if (u.role === "adminCabang") {
          updates.kantorCabang = document.getElementById("akunEditKantorCabang").value.trim();
          updates.pembagianLabaBersih = {
            manager: parseInt(document.getElementById("akunEditLabaManager")?.value) || 0,
            kas:     parseInt(document.getElementById("akunEditLabaKas")?.value) || 0,
            dividen: parseInt(document.getElementById("akunEditLabaDividen")?.value) || 0,
          };
        }

        if (u.role === "produksi") {
          const loyangFinal = [];
          document.querySelectorAll("#akunEditJenisLoyangList .akun-edit-loyang-jenis").forEach((el, i) => {
            const upahEl   = document.querySelectorAll("#akunEditJenisLoyangList .akun-edit-loyang-upah")[i];
            const statusEl = document.querySelectorAll("#akunEditJenisLoyangList .akun-edit-loyang-status")[i];
            loyangFinal.push({
              jenisLoyang: el.value.trim(),
              upah: parseInt(upahEl?.value) || 0,
              status: statusEl?.checked ?? true,
            });
          });
          updates.loyang = loyangFinal;
        }
      }

      // Upload foto profil (berlaku semua role)
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 400, 0.78);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        const ref = window.storageRef(window.storage, `fotoUsers/${u.id}`);
        updates.foto = await window.uploadWithProgress(ref, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload ${pct}%...`;
        });
      }

      await window.updateDoc(window.doc(window.db, "users", u.id), updates);

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
      btn.classList.add("btn-simpan--success");
      setTimeout(() => {
        closeSheet();
        // Reload tab yang aktif
        const activeTab = document.querySelector(".akun-tab.active")?.dataset.tab;
        if (activeTab === "adminCabang") loadAdminCabangTab();
        else loadMarketingTab();
      }, 1000);

    } catch(e) {
      console.error(e);
      errEl.textContent = "Gagal menyimpan, coba lagi.";
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan`;
    }
  };
}

// ── FIELD HELPER ──
function editAkunField(label, id, value, type = "input") {
  if (type === "textarea") return `
    <div class="edit-field">
      <div class="edit-field-label">${label}</div>
      <textarea id="${id}" class="edit-field-input edit-field-textarea" rows="2">${value || ""}</textarea>
    </div>`;
  if (type === "password") return `
    <div class="edit-field">
      <div class="edit-field-label">${label} (wajib diisi)</div>
      <input id="${id}" type="password" class="edit-field-input" placeholder="Minimal 6 karakter">
    </div>`;
  return `
    <div class="edit-field">
      <div class="edit-field-label">${label}</div>
      <input id="${id}" type="text" class="edit-field-input" value="${value || ""}">
    </div>`;
}

// ── CONFIRM TOGGLE STATUS ──
function showConfirmToggleStatus(u, isAktif, onDone) {
  const existing = document.getElementById("akunConfirmOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "akunConfirmOverlay";
  overlay.className = "akun-confirm-overlay";
  overlay.innerHTML = `
    <div class="akun-confirm-box" id="akunConfirmBox">
      <div class="akun-confirm-handle"></div>
      <div class="confirm-icon" style="background:${isAktif ? 'rgba(220,38,38,0.1)' : 'rgba(34,197,94,0.1)'};">
        <i class="fa-solid ${isAktif ? 'fa-user-slash' : 'fa-user-check'}" style="color:${isAktif ? '#dc2626' : 'var(--success)'}"></i>
      </div>
      <div class="confirm-title">${isAktif ? 'Nonaktifkan Akun?' : 'Aktifkan Akun?'}</div>
      <div class="confirm-msg">
        ${isAktif
          ? `Akun <strong>${u.nama}</strong> tidak bisa login setelah dinonaktifkan.`
          : `Akun <strong>${u.nama}</strong> akan aktif kembali dan bisa login.`
        }
      </div>
      <div class="confirm-actions">
        <button class="btn-batal" id="akunConfirmBatal">Batal</button>
        <button class="btn-hapus" id="akunConfirmOk" style="background:${isAktif ? '#dc2626' : 'var(--success)'}">
          ${isAktif ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const box = document.getElementById("akunConfirmBox");
  const scrollY = window.scrollY;
  document.body.classList.add("akun-confirm-sheet-open");
  document.body.style.top = `-${scrollY}px`;

  requestAnimationFrame(() => {
    overlay.classList.add("show");
    box.classList.add("show");
  });

  const close = () => {
    overlay.classList.remove("show");
    box.classList.remove("show");
    document.body.classList.remove("akun-confirm-sheet-open");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);
    setTimeout(() => overlay.remove(), 300);
  };

  document.getElementById("akunConfirmBatal").onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };

  // Swipe ke bawah buat nutup (mobile only)
  let startY = 0, currentY = 0, dragging = false;
  const onStart = (e) => {
    if (window.innerWidth > 768) return;
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    box.style.transition = "none";
  };
  const onMove = (e) => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;
    if (delta > 0) {
      e.preventDefault();
      box.style.transform = `translateY(${delta}px)`;
    }
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    box.style.transition = "";
    const delta = currentY - startY;
    if (delta > 120) {
      close();
    } else {
      box.style.transform = "";
    }
    startY = 0; currentY = 0;
  };
  box.addEventListener("touchstart", onStart, { passive: true });
  box.addEventListener("touchmove", onMove, { passive: false });
  box.addEventListener("touchend", onEnd);

  document.getElementById("akunConfirmOk").onclick = async () => {
    try {
      await window.updateDoc(window.doc(window.db, "users", u.id), { status: !isAktif });
      close();
      onDone();
      const activeTab = document.querySelector(".akun-tab.active")?.dataset.tab;
      if (activeTab === "adminCabang") loadAdminCabangTab();
      else loadMarketingTab();
    } catch(e) {
      console.error(e);
      alert("Gagal mengubah status.");
    }
  };
}
