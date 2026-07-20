// ── TOAST & MODAL MANDIRI ──
function pekShowToast(message, type = "success") {
  document.getElementById("pekToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "pekToast";
  toast.className = `pek-toast pek-toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function pekShowModal({ title = "Perhatian", message = "", icon = "fa-triangle-exclamation", confirmText = "Oke", showCancel = false, onConfirm = null }) {
  document.getElementById("pekModalContainer")?.remove();
  const container = document.createElement("div");
  container.id = "pekModalContainer";
  document.body.appendChild(container);
  container.innerHTML = `
    <div class="pek-modal-overlay" id="pekModalOverlay">
      <div class="pek-modal-box">
        <div class="pek-modal-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="pek-modal-title">${title}</div>
        <div class="pek-modal-message">${message}</div>
        <div class="pek-modal-actions">
          ${showCancel ? `<button class="pek-modal-btn-cancel" id="pekModalCancel">Batal</button>` : ""}
          <button class="pek-modal-btn-ok" id="pekModalOk">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => document.getElementById("pekModalOverlay").classList.add("show"));
  const closeModal = () => {
    document.getElementById("pekModalOverlay")?.classList.remove("show");
    setTimeout(() => container.remove(), 200);
  };
  document.getElementById("pekModalOk").addEventListener("click", () => { closeModal(); onConfirm?.(); });
  document.getElementById("pekModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("pekModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "pekModalOverlay") closeModal();
  });
}

function pekEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// daftar placeholder resmi yang beneran di-substitusi sistem (lihat app Investor: initSuratPerjanjianView)
const PEK_PLACEHOLDER_KEYS = ["ekuitas", "cabangEkuitas", "tanggalInvest"];
function pekHighlightPlaceholder(text) {
  const escaped = pekEscapeHtml(text);
  const pattern = new RegExp(`"(${PEK_PLACEHOLDER_KEYS.join("|")})"`, "g");
  return escaped.replace(pattern, `<span class="pek-placeholder-badge" title="Placeholder otomatis">"$1"</span>`);
}

// ── EDIT GUARD HELPER ──
function pekTryStartEdit(key) {
  if (window._pusatEditGuardKey && window._pusatEditGuardKey !== key) {
    pekShowToast("Selesaikan dulu perubahan yang sedang berlangsung.", "error");
    return false;
  }
  return true;
}

// ── STATE ──
let pekDocId = null;
let pekData = null; // { idCabang, infoPerusahaan: {...}, pasal: [...] }
let pekAddingPasal = false;

const PEK_INFO_FIELDS = [
  { key: "nama", label: "Nama Perusahaan", full: true },
  { key: "email", label: "Email" },
  { key: "noTelepon", label: "No Telepon" },
  { key: "npwp", label: "NPWP" },
  { key: "nib", label: "NIB" },
  { key: "sk", label: "No SK" },
  { key: "web", label: "Website" },
  { key: "sekretariat", label: "Alamat Sekretariat", full: true },
];

window.initPerjanjianEkuitasView = function () {
  loadPekData();

  const backBtn = document.getElementById("topbarBackBtn");
  if (backBtn) backBtn.style.display = "flex";
  initPekTopbarBack();
};

// ── LOAD DATA (1 dokumen saja di collection) ──
async function loadPekData() {
  const grid = document.getElementById("pekFieldGrid");
  const list = document.getElementById("pekPasalList");
  if (grid) grid.innerHTML = `<div class="pek-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(window.collection(window.db, "suratPerjanjianInvestasi"));
    if (snap.empty) {
      if (grid) grid.innerHTML = `
        <div class="pek-loading">
          <p>Dokumen belum tersedia.</p>
          <button class="pek-add-pasal-btn" id="pekCreateDocBtn" style="margin-top:12px;">
            <i class="fa-solid fa-plus"></i> Buat Dokumen Pertama
          </button>
        </div>
      `;
      if (list) list.innerHTML = "";
      document.getElementById("pekCreateDocBtn")?.addEventListener("click", createPekInitialDoc);
      return;
    }
    const d = snap.docs[0];
    pekDocId = d.id;
    pekData = d.data();
    pekData.infoPerusahaan = pekData.infoPerusahaan || {};
    pekData.pasal = pekData.pasal || [];

    renderPekInfoFields();
    renderPekMedia();
    renderPekPasalList();
  } catch (e) {
    console.error("❌ loadPekData:", e);
    if (grid) grid.innerHTML = `<div class="pek-loading">Gagal memuat data.</div>`;
  }
}

// ── BUAT DOKUMEN PERTAMA (kalau collection masih kosong) ──
async function createPekInitialDoc() {
  try {
    const docRef = await window.addDoc(window.collection(window.db, "suratPerjanjianInvestasi"), {
      infoPerusahaan: {
        nama: "", email: "", noTelepon: "", npwp: "", nib: "",
        sk: "", web: "", sekretariat: "", foto: "", ttd: ""
      },
      pasal: []
    });

    pekDocId = docRef.id;
    pekData = { infoPerusahaan: {}, pasal: [] };

    renderPekInfoFields();
    renderPekMedia();
    renderPekPasalList();
    pekShowToast("Dokumen berhasil dibuat.", "success");
  } catch (e) {
    console.error("❌ createPekInitialDoc:", e);
    pekShowToast("Gagal membuat dokumen.", "error");
  }
}

// ── RENDER MEDIA (FOTO & TTD) ──
function renderPekMedia() {
  const foto = pekData.infoPerusahaan.foto;
  const ttd = pekData.infoPerusahaan.ttd;

  const fotoImg = document.getElementById("pekFotoImg");
  const fotoPlaceholder = document.getElementById("pekFotoPlaceholder");
  if (foto) {
    fotoImg.src = foto; fotoImg.style.display = "block";
    fotoPlaceholder.style.display = "none";
  } else {
    fotoImg.style.display = "none";
    fotoPlaceholder.style.display = "flex";
  }

  const ttdImg = document.getElementById("pekTtdImg");
  const ttdPlaceholder = document.getElementById("pekTtdPlaceholder");
  if (ttd) {
    ttdImg.src = ttd; ttdImg.style.display = "block";
    ttdPlaceholder.style.display = "none";
  } else {
    ttdImg.style.display = "none";
    ttdPlaceholder.style.display = "flex";
  }

  bindPekMediaUpload("pekFotoEditBtn", "pekFotoInput", "foto", "suratPerjanjian/logo");
  bindPekMediaUpload("pekTtdEditBtn", "pekTtdInput", "ttd", "suratPerjanjian/ttd");
}

function bindPekMediaUpload(btnId, inputId, fieldKey, storagePath) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.onclick = () => input.click();

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";

    if (!file.type.startsWith("image/")) {
      pekShowModal({ title: "Format Tidak Didukung", message: "File yang dipilih bukan gambar.", icon: "fa-triangle-exclamation" });
      return;
    }

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      const compressedBlob = await window.compressImage(file, 1000, 0.85);
      const storageRef = window.storageRef(window.storage, storagePath);
      await window.uploadBytes(storageRef, compressedBlob, { contentType: "image/jpeg" });
      const url = await window.getDownloadURL(storageRef);

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianInvestasi", pekDocId),
        { [`infoPerusahaan.${fieldKey}`]: url }
      );

      pekData.infoPerusahaan[fieldKey] = url;
      renderPekMedia();
      pekShowToast(`${fieldKey === "foto" ? "Logo" : "Tanda tangan"} berhasil diperbarui.`, "success");
    } catch (e) {
      console.error("❌ pekMediaUpload:", e);
      pekShowToast("Gagal mengunggah gambar.", "error");
      btn.innerHTML = `<i class="fa-solid fa-camera"></i>`;
    }
  };
}

// ── RENDER FIELD INFO PERUSAHAAN ──
function renderPekInfoFields() {
  const grid = document.getElementById("pekFieldGrid");
  if (!grid) return;

  grid.innerHTML = PEK_INFO_FIELDS.map(f => `
    <div class="pek-field ${f.full ? "pek-field-full" : ""}">
      <label class="pek-field-label">${f.label}</label>
      <div class="pek-field-edit-wrap">
        <input type="text" class="pek-field-input" id="pekField_${f.key}" readonly>
        <button class="pek-field-edit-btn" data-key="${f.key}"><i class="fa-solid fa-pen"></i></button>
      </div>
    </div>
  `).join("");

  PEK_INFO_FIELDS.forEach(f => {
    const input = document.getElementById(`pekField_${f.key}`);
    if (input) input.value = pekData.infoPerusahaan[f.key] || "";
  });

  grid.querySelectorAll(".pek-field-edit-btn").forEach(btn => bindPekFieldEdit(btn));
}

function bindPekFieldEdit(btn) {
  const key = btn.dataset.key;
  const input = document.getElementById(`pekField_${key}`);
  const guardKey = `pek-field-${key}`;
  let editing = false;

  const cancelEdit = () => {
    editing = false;
    input.readOnly = true;
    input.value = pekData.infoPerusahaan[key] || "";
    btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
  };

  btn.onclick = async () => {
    if (!editing) {
      if (!pekTryStartEdit(guardKey)) return;
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
        window.doc(window.db, "suratPerjanjianInvestasi", pekDocId),
        { [`infoPerusahaan.${key}`]: valBaru }
      );
      pekData.infoPerusahaan[key] = valBaru;
      window.pusatConsumeEditGuard(guardKey);

      editing = false;
      input.readOnly = true;
      btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
      pekShowToast("Berhasil disimpan.", "success");
    } catch (e) {
      console.error("❌ simpanFieldInfo:", e);
      pekShowToast("Gagal menyimpan.", "error");
      btn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
  };
}

// ── RENDER LIST PASAL ──
function pekNextNomor() {
  if (!pekData.pasal.length) return 1;
  const maxNo = Math.max(...pekData.pasal.map(p => Number(p.pasal?.no) || 0));
  return maxNo + 1;
}

function renderPekPasalList() {
  const listEl = document.getElementById("pekPasalList");
  if (!listEl) return;

  const sorted = pekData.pasal
    .map((p, idx) => ({ ...p, _idx: idx }))
    .sort((a, b) => (Number(a.pasal?.no) || 0) - (Number(b.pasal?.no) || 0));

  listEl.innerHTML = (sorted.length ? sorted.map(p => {
    const judul = p.pasal?.judul || "";
    const isi = p.pasal?.isi || "";
    const no = p.pasal?.no || "-";
    return `
    <div class="pek-pasal-card" data-idx="${p._idx}">
      <div class="pek-pasal-head">
        <div class="pek-pasal-nomor">Pasal ${no}</div>
        <div class="pek-pasal-actions">
          <button class="pek-pasal-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="pek-pasal-delete-btn" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="pek-pasal-judul-display">${pekEscapeHtml(judul || "-")}</div>
      <div class="pek-pasal-isi-display">${pekHighlightPlaceholder(isi)}</div>
    </div>
  `;}).join("") : `<div class="pek-loading">Belum ada pasal.</div>`) + (pekAddingPasal ? renderPekNewPasalHTML() : "");

  listEl.querySelectorAll(".pek-pasal-card:not(.pek-pasal-card-new)").forEach(card => bindPekPasalCard(card));
  if (pekAddingPasal) bindPekNewPasalCard();

  const addBtn = document.getElementById("pekAddPasalBtn");
  if (addBtn) addBtn.disabled = pekAddingPasal;
}

// ── EDIT PASAL (JUDUL + ISI SEKALIGUS) ──
function bindPekPasalCard(card) {
  const idx = Number(card.dataset.idx);
  const editBtn = card.querySelector(".pek-pasal-edit-btn");
  const deleteBtn = card.querySelector(".pek-pasal-delete-btn");
  const guardKey = `pek-pasal-${idx}`;
  let editing = false;

  deleteBtn.onclick = () => confirmDeletePekPasal(idx);

  editBtn.onclick = async () => {
    if (!editing) {
      if (!pekTryStartEdit(guardKey)) return;
      editing = true;

      const judulDisplay = card.querySelector(".pek-pasal-judul-display");
      const isiDisplay = card.querySelector(".pek-pasal-isi-display");
      const judulVal = pekData.pasal[idx].pasal?.judul || "";
      const isiVal = pekData.pasal[idx].pasal?.isi || "";

      const judulInput = document.createElement("input");
      judulInput.type = "text";
      judulInput.className = "pek-pasal-judul-input";
      judulInput.value = judulVal;
      judulDisplay.replaceWith(judulInput);

      const isiTextarea = document.createElement("textarea");
      isiTextarea.className = "pek-pasal-isi-textarea";
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
      window.pusatPushEditGuard(guardKey, () => renderPekPasalList());
      return;
    }

    const judulInput = card.querySelector(".pek-pasal-judul-input");
    const isiTextarea = card.querySelector(".pek-pasal-isi-textarea");
    const judulBaru = judulInput.value.trim();
    const isiBaru = isiTextarea.value.trim();

    if (!judulBaru || !isiBaru) {
      pekShowModal({ title: "Data Kosong", message: "Judul dan isi pasal wajib diisi.", icon: "fa-triangle-exclamation" });
      return;
    }

    editBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      const pasalBaru = JSON.parse(JSON.stringify(pekData.pasal));
      pasalBaru[idx].pasal.judul = judulBaru;
      pasalBaru[idx].pasal.isi = isiBaru;

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianInvestasi", pekDocId),
        { pasal: pasalBaru }
      );

      pekData.pasal = pasalBaru;
      window.pusatConsumeEditGuard(guardKey);
      editing = false;
      renderPekPasalList();
      pekShowToast("Pasal berhasil disimpan.", "success");
    } catch (e) {
      console.error("❌ simpanPasal:", e);
      pekShowToast("Gagal menyimpan pasal.", "error");
      editBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
  };
}

function confirmDeletePekPasal(idx) {
  const p = pekData.pasal[idx];
  if (!p) return;
  const judul = p.pasal?.judul || "-";
  const no = p.pasal?.no || "-";
  pekShowModal({
    title: "Hapus Pasal?",
    message: `Pasal ${no} — "${judul}" akan dihapus permanen.`,
    icon: "fa-trash",
    confirmText: "Hapus",
    showCancel: true,
    onConfirm: async () => {
      try {
        const pasalBaru = pekData.pasal
          .filter((_, i) => i !== idx)
          .sort((a, b) => (Number(a.pasal?.no) || 0) - (Number(b.pasal?.no) || 0))
          .map((item, i) => ({ pasal: { ...item.pasal, no: i + 1 } }));

        await window.updateDoc(
          window.doc(window.db, "suratPerjanjianInvestasi", pekDocId),
          { pasal: pasalBaru }
        );

        pekData.pasal = pasalBaru;
        renderPekPasalList();
        pekShowToast("Pasal berhasil dihapus.", "success");
      } catch (e) {
        console.error("❌ deletePasal:", e);
        pekShowToast("Gagal menghapus pasal.", "error");
      }
    }
  });
}

// ── TAMBAH PASAL (inline) ──
function renderPekNewPasalHTML() {
  const nomorBaru = pekNextNomor();
  return `
    <div class="pek-pasal-card pek-pasal-card-new">
      <div class="pek-pasal-head">
        <div class="pek-pasal-nomor">Pasal ${nomorBaru} (Baru)</div>
      </div>
      <input type="text" class="pek-pasal-judul-input" id="pekNewPasalJudul" placeholder="Judul pasal...">
      <textarea class="pek-pasal-isi-textarea" id="pekNewPasalIsi" placeholder='Isi pasal... gunakan "kata" untuk placeholder otomatis'></textarea>
      <div class="pek-new-actions">
        <button class="pek-new-btn-cancel" id="pekNewPasalCancel">Batal</button>
        <button class="pek-new-btn-save" id="pekNewPasalSave">Simpan Pasal</button>
      </div>
    </div>
  `;
}

function bindPekNewPasalCard() {
  const judulInput = document.getElementById("pekNewPasalJudul");
  const isiTextarea = document.getElementById("pekNewPasalIsi");
  const cancelBtn = document.getElementById("pekNewPasalCancel");
  const saveBtn = document.getElementById("pekNewPasalSave");
  if (!judulInput) return;

  isiTextarea.addEventListener("input", () => {
    isiTextarea.style.height = "auto";
    isiTextarea.style.height = isiTextarea.scrollHeight + "px";
  });

  cancelBtn.onclick = () => {
    window.pusatConsumeEditGuard("pek-pasal-add");
    pekAddingPasal = false;
    renderPekPasalList();
  };

  saveBtn.onclick = async () => {
    const judul = judulInput.value.trim();
    const isi = isiTextarea.value.trim();
    if (!judul || !isi) {
      pekShowModal({ title: "Data Kosong", message: "Judul dan isi pasal wajib diisi.", icon: "fa-triangle-exclamation" });
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Menyimpan...";
    try {
      const nomorBaru = pekNextNomor();
      const pasalBaru = [...pekData.pasal, { pasal: { judul, isi, no: nomorBaru } }];

      await window.updateDoc(
        window.doc(window.db, "suratPerjanjianInvestasi", pekDocId),
        { pasal: pasalBaru }
      );

      pekData.pasal = pasalBaru;
      window.pusatConsumeEditGuard("pek-pasal-add");
      pekAddingPasal = false;
      renderPekPasalList();
      pekShowToast("Pasal baru berhasil ditambahkan.", "success");
    } catch (e) {
      console.error("❌ tambahPasal:", e);
      pekShowToast("Gagal menambahkan pasal.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Simpan Pasal";
    }
  };
}

document.addEventListener("click", (e) => {
  if (e.target?.id === "pekAddPasalBtn") {
    if (!pekData || !pekDocId) {
      pekShowModal({ title: "Dokumen Belum Ada", message: "Dokumen surat perjanjian ekuitas belum tersedia di database.", icon: "fa-triangle-exclamation" });
      return;
    }
    if (pekAddingPasal) return;
    if (!pekTryStartEdit("pek-pasal-add")) return;

    pekAddingPasal = true;
    renderPekPasalList();
    window.pusatPushEditGuard("pek-pasal-add", () => {
      pekAddingPasal = false;
      renderPekPasalList();
    });

    setTimeout(() => {
      document.getElementById("pekNewPasalJudul")?.focus();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 50);
  }
});

// ── BACK TERPUSAT ──
function initPekTopbarBack() {
  if (window._pekBackBtnBound) return;
  window._pekBackBtnBound = true;

  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (history.state?.pusatView === "perjanjianekuitas") {
      history.back();
    }
  });
}