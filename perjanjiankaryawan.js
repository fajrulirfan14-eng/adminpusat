// ── TOAST & MODAL MANDIRI ──
function pkrShowToast(message, type = "success") {
  document.getElementById("pkrToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "pkrToast";
  toast.className = `pkr-toast pkr-toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function pkrShowModal({ title = "Perhatian", message = "", icon = "fa-triangle-exclamation", confirmText = "Oke", showCancel = false, onConfirm = null }) {
  document.getElementById("pkrModalContainer")?.remove();
  const container = document.createElement("div");
  container.id = "pkrModalContainer";
  document.body.appendChild(container);
  container.innerHTML = `
    <div class="pkr-modal-overlay" id="pkrModalOverlay">
      <div class="pkr-modal-box">
        <div class="pkr-modal-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="pkr-modal-title">${title}</div>
        <div class="pkr-modal-message">${message}</div>
        <div class="pkr-modal-actions">
          ${showCancel ? `<button class="pkr-modal-btn-cancel" id="pkrModalCancel">Batal</button>` : ""}
          <button class="pkr-modal-btn-ok" id="pkrModalOk">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => document.getElementById("pkrModalOverlay").classList.add("show"));
  const closeModal = () => {
    document.getElementById("pkrModalOverlay")?.classList.remove("show");
    setTimeout(() => container.remove(), 200);
  };
  document.getElementById("pkrModalOk").addEventListener("click", () => { closeModal(); onConfirm?.(); });
  document.getElementById("pkrModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("pkrModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "pkrModalOverlay") closeModal();
  });
}

function pkrEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// daftar placeholder resmi yang beneran di-substitusi sistem
const PKR_PLACEHOLDER_KEYS = ["nama", "kantorCabang"];

function pkrHighlightPlaceholder(text) {
  const escaped = pkrEscapeHtml(text);
  const pattern = new RegExp(`"(${PKR_PLACEHOLDER_KEYS.join("|")})"`, "g");
  return escaped.replace(pattern, `<span class="pkr-placeholder-badge" title="Placeholder otomatis">"$1"</span>`);
}

// ── EDIT GUARD HELPER ──
function pkrTryStartEdit(key) {
  if (window._pusatEditGuardKey && window._pusatEditGuardKey !== key) {
    pkrShowToast("Selesaikan dulu perubahan yang sedang berlangsung.", "error");
    return false;
  }
  return true;
}

// ── STATE ──
let pkrDocId = null;
let pkrData = null; // { infoPerusahaan: {...}, pasal: [...] }
let pkrAddingPasal = false;

const PKR_INFO_FIELDS = [
  { key: "nama", label: "Nama Perusahaan", full: true },
  { key: "email", label: "Email" },
  { key: "noTelepon", label: "No Telepon" },
  { key: "npwp", label: "NPWP" },
  { key: "nib", label: "NIB" },
  { key: "sk", label: "No SK" },
  { key: "web", label: "Website" },
  { key: "sekretariat", label: "Alamat Sekretariat", full: true },
];

window.initPerjanjianKaryawanView = function () {
  loadPkrData();

  const backBtn = document.getElementById("topbarBackBtn");
  if (backBtn) backBtn.style.display = "flex";
  initPkrTopbarBack();
};

// ── LOAD DATA (1 dokumen saja di collection) ──
async function loadPkrData() {
  const grid = document.getElementById("pkrFieldGrid");
  const list = document.getElementById("pkrPasalList");
  if (grid) grid.innerHTML = `<div class="pkr-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(window.collection(window.db, "suratPerjanjianKaryawan"));
    if (snap.empty) {
      if (grid) grid.innerHTML = `
        <div class="pkr-loading">
          <p>Dokumen belum tersedia.</p>
          <button class="pkr-add-pasal-btn" id="pkrCreateDocBtn" style="margin-top:12px;">
            <i class="fa-solid fa-plus"></i> Buat Dokumen Pertama
          </button>
        </div>
      `;
      if (list) list.innerHTML = "";
      document.getElementById("pkrCreateDocBtn")?.addEventListener("click", createPkrInitialDoc);
      return;
    }
    const d = snap.docs[0];
    pkrDocId = d.id;
    pkrData = d.data();
    pkrData.infoPerusahaan = pkrData.infoPerusahaan || {};
    pkrData.pasal = pkrData.pasal || [];

    renderPkrInfoFields();
    renderPkrMedia();
    renderPkrPasalList();
  } catch (e) {
    console.error("❌ loadPkrData:", e);
    if (grid) grid.innerHTML = `<div class="pkr-loading">Gagal memuat data.</div>`;
  }
}

// ── BUAT DOKUMEN PERTAMA (kalau collection masih kosong) ──
async function createPkrInitialDoc() {
  try {
    const docRef = await window.addDoc(window.collection(window.db, "suratPerjanjianKaryawan"), {
      infoPerusahaan: {
        nama: "", email: "", noTelepon: "", npwp: "", nib: "",
        sk: "", web: "", sekretariat: "", foto: "", ttd: ""
      },
      pasal: []
    });

    pkrDocId = docRef.id;
    pkrData = { infoPerusahaan: {}, pasal: [] };

    renderPkrInfoFields();
    renderPkrMedia();
    renderPkrPasalList();
    pkrShowToast("Dokumen berhasil dibuat.", "success");
  } catch (e) {
    console.error("❌ createPkrInitialDoc:", e);
    pkrShowToast("Gagal membuat dokumen.", "error");
  }
}

// ── RENDER MEDIA (FOTO & TTD) ──
function renderPkrMedia() {
  const foto = pkrData.infoPerusahaan.foto;
  const ttd = pkrData.infoPerusahaan.ttd;

  const fotoImg = document.getElementById("pkrFotoImg");
  const fotoPlaceholder = document.getElementById("pkrFotoPlaceholder");
  if (foto) {
    fotoImg.src = foto; fotoImg.style.display = "block";
    fotoPlaceholder.style.display = "none";
  } else {
    fotoImg.style.display = "none";
    fotoPlaceholder.style.display = "flex";
  }

  const ttdImg = document.getElementById("pkrTtdImg");
  const ttdPlaceholder = document.getElementById("pkrTtdPlaceholder");
  if (ttd) {
    ttdImg.src = ttd; ttdImg.style.display = "block";
    ttdPlaceholder.style.display = "none";
  } else {
    ttdImg.style.display = "none";
    ttdPlaceholder.style.display = "flex";
  }

  bindPkrMediaUpload("pkrFotoEditBtn", "pkrFotoInput", "foto", "suratPerjanjianKaryawan/logo");
  bindPkrMediaUpload("pkrTtdEditBtn", "pkrTtdInput", "ttd", "suratPerjanjianKaryawan/ttd");
}

function bindPkrMediaUpload(btnId, inputId, fieldKey, storagePath) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.onclick = () => input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";

    if (!file.type.startsWith("image/")) {
      pkrShowModal({ title: "Format Tidak Didukung", message: "File yang dipilih bukan gambar.", icon: "fa-triangle-exclamation" });
      return;
    }

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      const compressedBlob = await window.compressImage(file, 1000, 0.85);
      const storageRef = window.storageRef(window.storage, storagePath);
      await window.uploadBytes(storageRef, compressedBlob, { contentType: "image/jpeg" });
      const url = await window.getDownloadURL(storageRef);

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianKaryawan", pkrDocId),
        { [`infoPerusahaan.${fieldKey}`]: url }
      );

      pkrData.infoPerusahaan[fieldKey] = url;
      renderPkrMedia();
      pkrShowToast(`${fieldKey === "foto" ? "Logo" : "Tanda tangan"} berhasil diperbarui.`, "success");
    } catch (e) {
      console.error("❌ pkrMediaUpload:", e);
      pkrShowToast("Gagal mengunggah gambar.", "error");
      btn.innerHTML = `<i class="fa-solid fa-camera"></i>`;
    }
  };
}

// ── RENDER FIELD INFO PERUSAHAAN ──
function renderPkrInfoFields() {
  const grid = document.getElementById("pkrFieldGrid");
  if (!grid) return;

  grid.innerHTML = PKR_INFO_FIELDS.map(f => `
    <div class="pkr-field ${f.full ? "pkr-field-full" : ""}">
      <label class="pkr-field-label">${f.label}</label>
      <div class="pkr-field-edit-wrap">
        <input type="text" class="pkr-field-input" id="pkrField_${f.key}" readonly>
        <button class="pkr-field-edit-btn" data-key="${f.key}"><i class="fa-solid fa-pen"></i></button>
      </div>
    </div>
  `).join("");

  PKR_INFO_FIELDS.forEach(f => {
    const input = document.getElementById(`pkrField_${f.key}`);
    if (input) input.value = pkrData.infoPerusahaan[f.key] || "";
  });

  grid.querySelectorAll(".pkr-field-edit-btn").forEach(btn => bindPkrFieldEdit(btn));
}

function bindPkrFieldEdit(btn) {
  const key = btn.dataset.key;
  const input = document.getElementById(`pkrField_${key}`);
  const guardKey = `pkr-field-${key}`;
  let editing = false;

  const cancelEdit = () => {
    editing = false;
    input.readOnly = true;
    input.value = pkrData.infoPerusahaan[key] || "";
    btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
  };

  btn.onclick = async () => {
    if (!editing) {
      if (!pkrTryStartEdit(guardKey)) return;
      editing = true;
      input.readOnly = false;
      input.focus();
      btn.innerHTML = `<i class="fa-solid fa-check"></i>`;
      window.pusatPushEditGuard(guardKey, cancelEdit);
      return;
    }

    const valBaru = input.value.trim();
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianKaryawan", pkrDocId),
        { [`infoPerusahaan.${key}`]: valBaru }
      );
      pkrData.infoPerusahaan[key] = valBaru;
      window.pusatConsumeEditGuard(guardKey);

      editing = false;
      input.readOnly = true;
      btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
      pkrShowToast("Berhasil disimpan.", "success");
    } catch (e) {
      console.error("❌ simpanFieldInfo:", e);
      pkrShowToast("Gagal menyimpan.", "error");
      btn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
  };
}

// ── RENDER LIST PASAL ──
function pkrNextNomor() {
  if (!pkrData.pasal.length) return 1;
  const maxNo = Math.max(...pkrData.pasal.map(p => Number(p.pasal?.no) || 0));
  return maxNo + 1;
}

function renderPkrPasalList() {
  const listEl = document.getElementById("pkrPasalList");
  if (!listEl) return;

  const sorted = pkrData.pasal
    .map((p, idx) => ({ ...p, _idx: idx }))
    .sort((a, b) => (Number(a.pasal?.no) || 0) - (Number(b.pasal?.no) || 0));

  listEl.innerHTML = (sorted.length ? sorted.map(p => {
    const judul = p.pasal?.judul || "";
    const isi = p.pasal?.isi || "";
    const no = p.pasal?.no || "-";
    return `
    <div class="pkr-pasal-card" data-idx="${p._idx}">
      <div class="pkr-pasal-head">
        <div class="pkr-pasal-nomor">Pasal ${no}</div>
        <div class="pkr-pasal-actions">
          <button class="pkr-pasal-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="pkr-pasal-delete-btn" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="pkr-pasal-judul-display">${pkrEscapeHtml(judul || "-")}</div>
      <div class="pkr-pasal-isi-display">${pkrHighlightPlaceholder(isi)}</div>
    </div>
  `;}).join("") : `<div class="pkr-loading">Belum ada pasal.</div>`) + (pkrAddingPasal ? renderPkrNewPasalHTML() : "");

  listEl.querySelectorAll(".pkr-pasal-card:not(.pkr-pasal-card-new)").forEach(card => bindPkrPasalCard(card));
  if (pkrAddingPasal) bindPkrNewPasalCard();

  const addBtn = document.getElementById("pkrAddPasalBtn");
  if (addBtn) addBtn.disabled = pkrAddingPasal;
}

// ── EDIT PASAL (JUDUL + ISI SEKALIGUS) ──
function bindPkrPasalCard(card) {
  const idx = Number(card.dataset.idx);
  const editBtn = card.querySelector(".pkr-pasal-edit-btn");
  const deleteBtn = card.querySelector(".pkr-pasal-delete-btn");
  const guardKey = `pkr-pasal-${idx}`;
  let editing = false;

  deleteBtn.onclick = () => confirmDeletePkrPasal(idx);

  editBtn.onclick = async () => {
    if (!editing) {
      if (!pkrTryStartEdit(guardKey)) return;
      editing = true;

      const judulDisplay = card.querySelector(".pkr-pasal-judul-display");
      const isiDisplay = card.querySelector(".pkr-pasal-isi-display");
      const judulVal = pkrData.pasal[idx].pasal?.judul || "";
      const isiVal = pkrData.pasal[idx].pasal?.isi || "";

      const judulInput = document.createElement("input");
      judulInput.type = "text";
      judulInput.className = "pkr-pasal-judul-input";
      judulInput.value = judulVal;
      judulDisplay.replaceWith(judulInput);

      const isiTextarea = document.createElement("textarea");
      isiTextarea.className = "pkr-pasal-isi-textarea";
      isiTextarea.value = isiVal;
      isiDisplay.replaceWith(isiTextarea);

      card.classList.add("editing");
      requestAnimationFrame(() => {
        isiTextarea.style.height = "auto";
        isiTextarea.style.height = isiTextarea.scrollHeight + "px";
      });
      isiTextarea.addEventListener("input", () => {
        isiTextarea.style.height = "auto";
        isiTextarea.style.height = isiTextarea.scrollHeight + "px";
      });

      editBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
      window.pusatPushEditGuard(guardKey, () => renderPkrPasalList());
      return;
    }

    const judulInput = card.querySelector(".pkr-pasal-judul-input");
    const isiTextarea = card.querySelector(".pkr-pasal-isi-textarea");
    const judulBaru = judulInput.value.trim();
    const isiBaru = isiTextarea.value.trim();

    if (!judulBaru || !isiBaru) {
      pkrShowModal({ title: "Data Kosong", message: "Judul dan isi pasal wajib diisi.", icon: "fa-triangle-exclamation" });
      return;
    }

    editBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      const pasalBaru = JSON.parse(JSON.stringify(pkrData.pasal));
      pasalBaru[idx].pasal.judul = judulBaru;
      pasalBaru[idx].pasal.isi = isiBaru;

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianKaryawan", pkrDocId),
        { pasal: pasalBaru }
      );

      pkrData.pasal = pasalBaru;
      window.pusatConsumeEditGuard(guardKey);
      editing = false;
      renderPkrPasalList();
      pkrShowToast("Pasal berhasil disimpan.", "success");
    } catch (e) {
      console.error("❌ simpanPasal:", e);
      pkrShowToast("Gagal menyimpan pasal.", "error");
      editBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
  };
}

function confirmDeletePkrPasal(idx) {
  const p = pkrData.pasal[idx];
  if (!p) return;
  const judul = p.pasal?.judul || "-";
  const no = p.pasal?.no || "-";
  pkrShowModal({
    title: "Hapus Pasal?",
    message: `Pasal ${no} — "${judul}" akan dihapus permanen.`,
    icon: "fa-trash",
    confirmText: "Hapus",
    showCancel: true,
    onConfirm: async () => {
      try {
        const pasalBaru = pkrData.pasal
          .filter((_, i) => i !== idx)
          .sort((a, b) => (Number(a.pasal?.no) || 0) - (Number(b.pasal?.no) || 0))
          .map((item, i) => ({ pasal: { ...item.pasal, no: i + 1 } }));

        await window.updateDoc(
          window.doc(window.db, "suratPerjanjianKaryawan", pkrDocId),
          { pasal: pasalBaru }
        );

        pkrData.pasal = pasalBaru;
        renderPkrPasalList();
        pkrShowToast("Pasal berhasil dihapus.", "success");
      } catch (e) {
        console.error("❌ deletePasal:", e);
        pkrShowToast("Gagal menghapus pasal.", "error");
      }
    }
  });
}

// ── TAMBAH PASAL (inline) ──
function renderPkrNewPasalHTML() {
  const nomorBaru = pkrNextNomor();
  return `
    <div class="pkr-pasal-card pkr-pasal-card-new">
      <div class="pkr-pasal-head">
        <div class="pkr-pasal-nomor">Pasal ${nomorBaru} (Baru)</div>
      </div>
      <input type="text" class="pkr-pasal-judul-input" id="pkrNewPasalJudul" placeholder="Judul pasal...">
      <textarea class="pkr-pasal-isi-textarea" id="pkrNewPasalIsi" placeholder='Isi pasal... gunakan "kata" untuk placeholder otomatis'></textarea>
      <div class="pkr-new-actions">
        <button class="pkr-new-btn-cancel" id="pkrNewPasalCancel">Batal</button>
        <button class="pkr-new-btn-save" id="pkrNewPasalSave">Simpan Pasal</button>
      </div>
    </div>
  `;
}

function bindPkrNewPasalCard() {
  const judulInput = document.getElementById("pkrNewPasalJudul");
  const isiTextarea = document.getElementById("pkrNewPasalIsi");
  const cancelBtn = document.getElementById("pkrNewPasalCancel");
  const saveBtn = document.getElementById("pkrNewPasalSave");
  if (!judulInput) return;

  isiTextarea.addEventListener("input", () => {
    isiTextarea.style.height = "auto";
    isiTextarea.style.height = isiTextarea.scrollHeight + "px";
  });

  cancelBtn.onclick = () => {
    window.pusatConsumeEditGuard("pkr-pasal-add");
    pkrAddingPasal = false;
    renderPkrPasalList();
  };

  saveBtn.onclick = async () => {
    const judul = judulInput.value.trim();
    const isi = isiTextarea.value.trim();
    if (!judul || !isi) {
      pkrShowModal({ title: "Data Kosong", message: "Judul dan isi pasal wajib diisi.", icon: "fa-triangle-exclamation" });
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Menyimpan...";
    try {
      const nomorBaru = pkrNextNomor();
      const pasalBaru = [...pkrData.pasal, { pasal: { judul, isi, no: nomorBaru } }];

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianKaryawan", pkrDocId),
        { pasal: pasalBaru }
      );

      pkrData.pasal = pasalBaru;
      window.pusatConsumeEditGuard("pkr-pasal-add");
      pkrAddingPasal = false;
      renderPkrPasalList();
      pkrShowToast("Pasal baru berhasil ditambahkan.", "success");
    } catch (e) {
      console.error("❌ tambahPasal:", e);
      pkrShowToast("Gagal menambahkan pasal.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Simpan Pasal";
    }
  };
}

document.addEventListener("click", (e) => {
  if (e.target?.id === "pkrAddPasalBtn") {
    if (!pkrData || !pkrDocId) {
      pkrShowModal({ title: "Dokumen Belum Ada", message: "Dokumen surat perjanjian karyawan belum tersedia di database.", icon: "fa-triangle-exclamation" });
      return;
    }
    if (pkrAddingPasal) return;
    if (!pkrTryStartEdit("pkr-pasal-add")) return;

    pkrAddingPasal = true;
    renderPkrPasalList();
    window.pusatPushEditGuard("pkr-pasal-add", () => {
      pkrAddingPasal = false;
      renderPkrPasalList();
    });

    setTimeout(() => {
      document.getElementById("pkrNewPasalJudul")?.focus();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 50);
  }
});

// ── BACK TERPUSAT ──
function initPkrTopbarBack() {
  if (window._pkrBackBtnBound) return;
  window._pkrBackBtnBound = true;

  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (history.state?.pusatView === "perjanjiankaryawan") {
      history.back();
    }
  });
}