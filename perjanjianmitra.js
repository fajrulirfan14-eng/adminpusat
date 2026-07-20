// ── TOAST & MODAL MANDIRI ──
function pkmShowToast(message, type = "success") {
  document.getElementById("pkmToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "pkmToast";
  toast.className = `pkm-toast pkm-toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function pkmShowModal({ title = "Perhatian", message = "", icon = "fa-triangle-exclamation", confirmText = "Oke", showCancel = false, onConfirm = null }) {
  document.getElementById("pkmModalContainer")?.remove();
  const container = document.createElement("div");
  container.id = "pkmModalContainer";
  document.body.appendChild(container);
  container.innerHTML = `
    <div class="pkm-modal-overlay" id="pkmModalOverlay">
      <div class="pkm-modal-box">
        <div class="pkm-modal-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="pkm-modal-title">${title}</div>
        <div class="pkm-modal-message">${message}</div>
        <div class="pkm-modal-actions">
          ${showCancel ? `<button class="pkm-modal-btn-cancel" id="pkmModalCancel">Batal</button>` : ""}
          <button class="pkm-modal-btn-ok" id="pkmModalOk">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => document.getElementById("pkmModalOverlay").classList.add("show"));
  const closeModal = () => {
    document.getElementById("pkmModalOverlay")?.classList.remove("show");
    setTimeout(() => container.remove(), 200);
  };
  document.getElementById("pkmModalOk").addEventListener("click", () => { closeModal(); onConfirm?.(); });
  document.getElementById("pkmModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("pkmModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "pkmModalOverlay") closeModal();
  });
}

function pkmEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// daftar placeholder resmi yang beneran di-substitusi sistem
const PKM_PLACEHOLDER_KEYS = ["kantorCabang", "namaOwner"];

function pkmHighlightPlaceholder(text) {
  const escaped = pkmEscapeHtml(text);
  const pattern = new RegExp(`"(${PKM_PLACEHOLDER_KEYS.join("|")})"`, "g");
  return escaped.replace(pattern, `<span class="pkm-placeholder-badge" title="Placeholder otomatis">"$1"</span>`);
}

// ── EDIT GUARD HELPER ──
function pkmTryStartEdit(key) {
  if (window._pusatEditGuardKey && window._pusatEditGuardKey !== key) {
    pkmShowToast("Selesaikan dulu perubahan yang sedang berlangsung.", "error");
    return false;
  }
  return true;
}

// ── STATE ──
let pkmDocId = null;
let pkmData = null; // { infoPerusahaan: {...}, pasal: [...] }
let pkmAddingPasal = false;

const PKM_INFO_FIELDS = [
  { key: "nama", label: "Nama Perusahaan", full: true },
  { key: "email", label: "Email" },
  { key: "noTelepon", label: "No Telepon" },
  { key: "npwp", label: "NPWP" },
  { key: "nib", label: "NIB" },
  { key: "sk", label: "No SK" },
  { key: "web", label: "Website" },
  { key: "sekretariat", label: "Alamat Sekretariat", full: true },
];

window.initPerjanjianMitraView = function () {
  loadPkmData();

  const backBtn = document.getElementById("topbarBackBtn");
  if (backBtn) backBtn.style.display = "flex";
  initPkmTopbarBack();
};

// ── LOAD DATA (1 dokumen saja di collection) ──
async function loadPkmData() {
  const grid = document.getElementById("pkmFieldGrid");
  const list = document.getElementById("pkmPasalList");
  if (grid) grid.innerHTML = `<div class="pkm-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(window.collection(window.db, "suratPerjanjianMitra"));
    if (snap.empty) {
      if (grid) grid.innerHTML = `
        <div class="pkm-loading">
          <p>Dokumen belum tersedia.</p>
          <button class="pkm-add-pasal-btn" id="pkmCreateDocBtn" style="margin-top:12px;">
            <i class="fa-solid fa-plus"></i> Buat Dokumen Pertama
          </button>
        </div>
      `;
      if (list) list.innerHTML = "";
      document.getElementById("pkmCreateDocBtn")?.addEventListener("click", createPkmInitialDoc);
      return;
    }
    const d = snap.docs[0];
    pkmDocId = d.id;
    pkmData = d.data();
    pkmData.infoPerusahaan = pkmData.infoPerusahaan || {};
    pkmData.pasal = pkmData.pasal || [];

    renderPkmInfoFields();
    renderPkmMedia();
    renderPkmPasalList();
  } catch (e) {
    console.error("❌ loadPkmData:", e);
    if (grid) grid.innerHTML = `<div class="pkm-loading">Gagal memuat data.</div>`;
  }
}

// ── BUAT DOKUMEN PERTAMA (kalau collection masih kosong) ──
async function createPkmInitialDoc() {
  try {
    const docRef = await window.addDoc(window.collection(window.db, "suratPerjanjianMitra"), {
      infoPerusahaan: {
        nama: "", email: "", noTelepon: "", npwp: "", nib: "",
        sk: "", web: "", sekretariat: "", foto: "", ttd: ""
      },
      pasal: []
    });

    pkmDocId = docRef.id;
    pkmData = { infoPerusahaan: {}, pasal: [] };

    renderPkmInfoFields();
    renderPkmMedia();
    renderPkmPasalList();
    pkmShowToast("Dokumen berhasil dibuat.", "success");
  } catch (e) {
    console.error("❌ createPkmInitialDoc:", e);
    pkmShowToast("Gagal membuat dokumen.", "error");
  }
}

// ── RENDER MEDIA (FOTO & TTD) ──
function renderPkmMedia() {
  const foto = pkmData.infoPerusahaan.foto;
  const ttd = pkmData.infoPerusahaan.ttd;

  const fotoImg = document.getElementById("pkmFotoImg");
  const fotoPlaceholder = document.getElementById("pkmFotoPlaceholder");
  if (foto) {
    fotoImg.src = foto; fotoImg.style.display = "block";
    fotoPlaceholder.style.display = "none";
  } else {
    fotoImg.style.display = "none";
    fotoPlaceholder.style.display = "flex";
  }

  const ttdImg = document.getElementById("pkmTtdImg");
  const ttdPlaceholder = document.getElementById("pkmTtdPlaceholder");
  if (ttd) {
    ttdImg.src = ttd; ttdImg.style.display = "block";
    ttdPlaceholder.style.display = "none";
  } else {
    ttdImg.style.display = "none";
    ttdPlaceholder.style.display = "flex";
  }

  bindPkmMediaUpload("pkmFotoEditBtn", "pkmFotoInput", "foto", "suratPerjanjianMitra/logo");
  bindPkmMediaUpload("pkmTtdEditBtn", "pkmTtdInput", "ttd", "suratPerjanjianMitra/ttd");
}

function bindPkmMediaUpload(btnId, inputId, fieldKey, storagePath) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.onclick = () => input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";

    if (!file.type.startsWith("image/")) {
      pkmShowModal({ title: "Format Tidak Didukung", message: "File yang dipilih bukan gambar.", icon: "fa-triangle-exclamation" });
      return;
    }

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      const compressedBlob = await window.compressImage(file, 1000, 0.85);
      const storageRef = window.storageRef(window.storage, storagePath);
      await window.uploadBytes(storageRef, compressedBlob, { contentType: "image/jpeg" });
      const url = await window.getDownloadURL(storageRef);

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianMitra", pkmDocId),
        { [`infoPerusahaan.${fieldKey}`]: url }
      );

      pkmData.infoPerusahaan[fieldKey] = url;
      renderPkmMedia();
      pkmShowToast(`${fieldKey === "foto" ? "Logo" : "Tanda tangan"} berhasil diperbarui.`, "success");
    } catch (e) {
      console.error("❌ pkmMediaUpload:", e);
      pkmShowToast("Gagal mengunggah gambar.", "error");
      btn.innerHTML = `<i class="fa-solid fa-camera"></i>`;
    }
  };
}

// ── RENDER FIELD INFO PERUSAHAAN ──
function renderPkmInfoFields() {
  const grid = document.getElementById("pkmFieldGrid");
  if (!grid) return;

  grid.innerHTML = PKM_INFO_FIELDS.map(f => `
    <div class="pkm-field ${f.full ? "pkm-field-full" : ""}">
      <label class="pkm-field-label">${f.label}</label>
      <div class="pkm-field-edit-wrap">
        <input type="text" class="pkm-field-input" id="pkmField_${f.key}" readonly>
        <button class="pkm-field-edit-btn" data-key="${f.key}"><i class="fa-solid fa-pen"></i></button>
      </div>
    </div>
  `).join("");

  PKM_INFO_FIELDS.forEach(f => {
    const input = document.getElementById(`pkmField_${f.key}`);
    if (input) input.value = pkmData.infoPerusahaan[f.key] || "";
  });

  grid.querySelectorAll(".pkm-field-edit-btn").forEach(btn => bindPkmFieldEdit(btn));
}

function bindPkmFieldEdit(btn) {
  const key = btn.dataset.key;
  const input = document.getElementById(`pkmField_${key}`);
  const guardKey = `pkm-field-${key}`;
  let editing = false;

  const cancelEdit = () => {
    editing = false;
    input.readOnly = true;
    input.value = pkmData.infoPerusahaan[key] || "";
    btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
  };

  btn.onclick = async () => {
    if (!editing) {
      if (!pkmTryStartEdit(guardKey)) return;
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
        window.doc(window.db, "suratPerjanjianMitra", pkmDocId),
        { [`infoPerusahaan.${key}`]: valBaru }
      );
      pkmData.infoPerusahaan[key] = valBaru;
      window.pusatConsumeEditGuard(guardKey);

      editing = false;
      input.readOnly = true;
      btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
      pkmShowToast("Berhasil disimpan.", "success");
    } catch (e) {
      console.error("❌ simpanFieldInfo:", e);
      pkmShowToast("Gagal menyimpan.", "error");
      btn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
  };
}

// ── RENDER LIST PASAL ──
function pkmNextNomor() {
  if (!pkmData.pasal.length) return 1;
  const maxNo = Math.max(...pkmData.pasal.map(p => Number(p.pasal?.no) || 0));
  return maxNo + 1;
}

function renderPkmPasalList() {
  const listEl = document.getElementById("pkmPasalList");
  if (!listEl) return;

  const sorted = pkmData.pasal
    .map((p, idx) => ({ ...p, _idx: idx }))
    .sort((a, b) => (Number(a.pasal?.no) || 0) - (Number(b.pasal?.no) || 0));

  listEl.innerHTML = (sorted.length ? sorted.map(p => {
    const judul = p.pasal?.judul || "";
    const isi = p.pasal?.isi || "";
    const no = p.pasal?.no || "-";
    return `
    <div class="pkm-pasal-card" data-idx="${p._idx}">
      <div class="pkm-pasal-head">
        <div class="pkm-pasal-nomor">Pasal ${no}</div>
        <div class="pkm-pasal-actions">
          <button class="pkm-pasal-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="pkm-pasal-delete-btn" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="pkm-pasal-judul-display">${pkmEscapeHtml(judul || "-")}</div>
      <div class="pkm-pasal-isi-display">${pkmHighlightPlaceholder(isi)}</div>
    </div>
  `;}).join("") : `<div class="pkm-loading">Belum ada pasal.</div>`) + (pkmAddingPasal ? renderPkmNewPasalHTML() : "");

  listEl.querySelectorAll(".pkm-pasal-card:not(.pkm-pasal-card-new)").forEach(card => bindPkmPasalCard(card));
  if (pkmAddingPasal) bindPkmNewPasalCard();

  const addBtn = document.getElementById("pkmAddPasalBtn");
  if (addBtn) addBtn.disabled = pkmAddingPasal;
}

// ── EDIT PASAL (JUDUL + ISI SEKALIGUS) ──
function bindPkmPasalCard(card) {
  const idx = Number(card.dataset.idx);
  const editBtn = card.querySelector(".pkm-pasal-edit-btn");
  const deleteBtn = card.querySelector(".pkm-pasal-delete-btn");
  const guardKey = `pkm-pasal-${idx}`;
  let editing = false;

  deleteBtn.onclick = () => confirmDeletePkmPasal(idx);

  editBtn.onclick = async () => {
    if (!editing) {
      if (!pkmTryStartEdit(guardKey)) return;
      editing = true;

      const judulDisplay = card.querySelector(".pkm-pasal-judul-display");
      const isiDisplay = card.querySelector(".pkm-pasal-isi-display");
      const judulVal = pkmData.pasal[idx].pasal?.judul || "";
      const isiVal = pkmData.pasal[idx].pasal?.isi || "";

      const judulInput = document.createElement("input");
      judulInput.type = "text";
      judulInput.className = "pkm-pasal-judul-input";
      judulInput.value = judulVal;
      judulDisplay.replaceWith(judulInput);

      const isiTextarea = document.createElement("textarea");
      isiTextarea.className = "pkm-pasal-isi-textarea";
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
      window.pusatPushEditGuard(guardKey, () => renderPkmPasalList());
      return;
    }

    const judulInput = card.querySelector(".pkm-pasal-judul-input");
    const isiTextarea = card.querySelector(".pkm-pasal-isi-textarea");
    const judulBaru = judulInput.value.trim();
    const isiBaru = isiTextarea.value.trim();

    if (!judulBaru || !isiBaru) {
      pkmShowModal({ title: "Data Kosong", message: "Judul dan isi pasal wajib diisi.", icon: "fa-triangle-exclamation" });
      return;
    }

    editBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      const pasalBaru = JSON.parse(JSON.stringify(pkmData.pasal));
      pasalBaru[idx].pasal.judul = judulBaru;
      pasalBaru[idx].pasal.isi = isiBaru;

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianMitra", pkmDocId),
        { pasal: pasalBaru }
      );

      pkmData.pasal = pasalBaru;
      window.pusatConsumeEditGuard(guardKey);
      editing = false;
      renderPkmPasalList();
      pkmShowToast("Pasal berhasil disimpan.", "success");
    } catch (e) {
      console.error("❌ simpanPasal:", e);
      pkmShowToast("Gagal menyimpan pasal.", "error");
      editBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
  };
}

function confirmDeletePkmPasal(idx) {
  const p = pkmData.pasal[idx];
  if (!p) return;
  const judul = p.pasal?.judul || "-";
  const no = p.pasal?.no || "-";
  pkmShowModal({
    title: "Hapus Pasal?",
    message: `Pasal ${no} — "${judul}" akan dihapus permanen.`,
    icon: "fa-trash",
    confirmText: "Hapus",
    showCancel: true,
    onConfirm: async () => {
      try {
        const pasalBaru = pkmData.pasal
          .filter((_, i) => i !== idx)
          .sort((a, b) => (Number(a.pasal?.no) || 0) - (Number(b.pasal?.no) || 0))
          .map((item, i) => ({ pasal: { ...item.pasal, no: i + 1 } }));

        await window.updateDoc(
          window.doc(window.db, "suratPerjanjianMitra", pkmDocId),
          { pasal: pasalBaru }
        );

        pkmData.pasal = pasalBaru;
        renderPkmPasalList();
        pkmShowToast("Pasal berhasil dihapus.", "success");
      } catch (e) {
        console.error("❌ deletePasal:", e);
        pkmShowToast("Gagal menghapus pasal.", "error");
      }
    }
  });
}

// ── TAMBAH PASAL (inline) ──
function renderPkmNewPasalHTML() {
  const nomorBaru = pkmNextNomor();
  return `
    <div class="pkm-pasal-card pkm-pasal-card-new">
      <div class="pkm-pasal-head">
        <div class="pkm-pasal-nomor">Pasal ${nomorBaru} (Baru)</div>
      </div>
      <input type="text" class="pkm-pasal-judul-input" id="pkmNewPasalJudul" placeholder="Judul pasal...">
      <textarea class="pkm-pasal-isi-textarea" id="pkmNewPasalIsi" placeholder='Isi pasal... gunakan "kata" untuk placeholder otomatis'></textarea>
      <div class="pkm-new-actions">
        <button class="pkm-new-btn-cancel" id="pkmNewPasalCancel">Batal</button>
        <button class="pkm-new-btn-save" id="pkmNewPasalSave">Simpan Pasal</button>
      </div>
    </div>
  `;
}

function bindPkmNewPasalCard() {
  const judulInput = document.getElementById("pkmNewPasalJudul");
  const isiTextarea = document.getElementById("pkmNewPasalIsi");
  const cancelBtn = document.getElementById("pkmNewPasalCancel");
  const saveBtn = document.getElementById("pkmNewPasalSave");
  if (!judulInput) return;

  isiTextarea.addEventListener("input", () => {
    isiTextarea.style.height = "auto";
    isiTextarea.style.height = isiTextarea.scrollHeight + "px";
  });

  cancelBtn.onclick = () => {
    window.pusatConsumeEditGuard("pkm-pasal-add");
    pkmAddingPasal = false;
    renderPkmPasalList();
  };

  saveBtn.onclick = async () => {
    const judul = judulInput.value.trim();
    const isi = isiTextarea.value.trim();
    if (!judul || !isi) {
      pkmShowModal({ title: "Data Kosong", message: "Judul dan isi pasal wajib diisi.", icon: "fa-triangle-exclamation" });
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Menyimpan...";
    try {
      const nomorBaru = pkmNextNomor();
      const pasalBaru = [...pkmData.pasal, { pasal: { judul, isi, no: nomorBaru } }];

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianMitra", pkmDocId),
        { pasal: pasalBaru }
      );

      pkmData.pasal = pasalBaru;
      window.pusatConsumeEditGuard("pkm-pasal-add");
      pkmAddingPasal = false;
      renderPkmPasalList();
      pkmShowToast("Pasal baru berhasil ditambahkan.", "success");
    } catch (e) {
      console.error("❌ tambahPasal:", e);
      pkmShowToast("Gagal menambahkan pasal.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Simpan Pasal";
    }
  };
}

document.addEventListener("click", (e) => {
  if (e.target?.id === "pkmAddPasalBtn") {
    if (!pkmData || !pkmDocId) {
      pkmShowModal({ title: "Dokumen Belum Ada", message: "Dokumen surat perjanjian mitra belum tersedia di database.", icon: "fa-triangle-exclamation" });
      return;
    }
    if (pkmAddingPasal) return;
    if (!pkmTryStartEdit("pkm-pasal-add")) return;

    pkmAddingPasal = true;
    renderPkmPasalList();
    window.pusatPushEditGuard("pkm-pasal-add", () => {
      pkmAddingPasal = false;
      renderPkmPasalList();
    });

    setTimeout(() => {
      document.getElementById("pkmNewPasalJudul")?.focus();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 50);
  }
});

// ── BACK TERPUSAT ──
function initPkmTopbarBack() {
  if (window._pkmBackBtnBound) return;
  window._pkmBackBtnBound = true;

  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (history.state?.pusatView === "perjanjianmitra") {
      history.back();
    }
  });
}