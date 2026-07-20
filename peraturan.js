// ── TOAST & MODAL MANDIRI ──
function peraturanShowToast(message, type = "success") {
  document.getElementById("peraturanToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "peraturanToast";
  toast.className = `peraturan-toast peraturan-toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "error" ? "fa-circle-exclamation" : "fa-circle-check"}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function peraturanShowModal({ title = "Perhatian", message = "", icon = "fa-triangle-exclamation", confirmText = "Oke", showCancel = false, onConfirm = null }) {
  document.getElementById("peraturanModalContainer")?.remove();
  const container = document.createElement("div");
  container.id = "peraturanModalContainer";
  document.body.appendChild(container);
  container.innerHTML = `
    <div class="peraturan-modal-overlay" id="peraturanModalOverlay">
      <div class="peraturan-modal-box">
        <div class="peraturan-modal-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="peraturan-modal-title">${title}</div>
        <div class="peraturan-modal-message">${message}</div>
        <div class="peraturan-modal-actions">
          ${showCancel ? `<button class="peraturan-modal-btn-cancel" id="peraturanModalCancel">Batal</button>` : ""}
          <button class="peraturan-modal-btn-ok" id="peraturanModalOk">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => document.getElementById("peraturanModalOverlay").classList.add("show"));
  const closeModal = () => {
    document.getElementById("peraturanModalOverlay")?.classList.remove("show");
    setTimeout(() => container.remove(), 200);
  };
  document.getElementById("peraturanModalOk").addEventListener("click", () => { closeModal(); onConfirm?.(); });
  document.getElementById("peraturanModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("peraturanModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "peraturanModalOverlay") closeModal();
  });
}

// ── STATE ──
let peraturanBabList = [];
let peraturanActiveBabId = null;
let peraturanActiveBabData = null;
let peraturanExpandedPasalSet = new Set();

window.initPeraturanView = function () {
  loadPeraturanBab();
  initPeraturanTopbarBack();
  initPeraturanBabSearch();
  initPeraturanAddBabBtn();

  const backBtn = document.getElementById("topbarBackBtn");
  if (backBtn) backBtn.style.display = "flex";
};

// ── SEARCH BAB ──
let peraturanBabSearchQuery = "";

function initPeraturanBabSearch() {
  const input = document.getElementById("peraturanBabSearch");
  if (!input) return;
  input.value = "";
  peraturanBabSearchQuery = "";
  input.oninput = () => {
    peraturanBabSearchQuery = input.value.trim().toLowerCase();
    renderPeraturanList();
  };
}

// ── STATE TAMBAH BAB INLINE ──
let peraturanAddingBab = false;
function initPeraturanAddBabBtn() {
  const btn = document.getElementById("peraturanAddBabBtn");
  if (!btn) return;
  btn.onclick = () => {
    if (peraturanAddingBab) return;
    if (!peraturanTryStartEdit("bab-add")) return;

    peraturanAddingBab = true;
    renderPeraturanList();

    window.pusatPushEditGuard("bab-add", () => {
      peraturanAddingBab = false;
      renderPeraturanList();
    });

    setTimeout(() => {
      document.getElementById("peraturanNewBabJudul")?.focus();
      const listEl = document.getElementById("peraturanList");
      listEl?.scrollTo({ top: listEl.scrollHeight, behavior: "smooth" });
    }, 50);
  };
}
function peraturanNextBabNomor() {
  if (!peraturanBabList.length) return 1;
  const maxNomor = Math.max(...peraturanBabList.map(b => b.nomor || 0));
  return maxNomor + 1;
}
function renderNewBabCardHTML() {
  const nomorBaru = peraturanNextBabNomor();
  return `
    <div class="peraturan-item peraturan-item-new">
      <div class="peraturan-item-icon"><i class="fa-solid fa-book"></i></div>
      <div class="peraturan-item-new-form">
        <div class="peraturan-item-bab-label">Bab ${nomorBaru} (Baru)</div>
        <input type="text" class="peraturan-new-bab-input" id="peraturanNewBabJudul" placeholder="Judul bab...">
        <div class="peraturan-new-bab-warning">Bab tidak bisa dihapus, namun masih bisa diedit</div>
        <div class="peraturan-new-bab-actions">
          <button class="peraturan-new-bab-cancel" id="peraturanNewBabCancel">Batal</button>
          <button class="peraturan-new-bab-save" id="peraturanNewBabSave">Simpan</button>
        </div>
      </div>
    </div>
  `;
}
function bindNewBabCard() {
  const input = document.getElementById("peraturanNewBabJudul");
  const cancelBtn = document.getElementById("peraturanNewBabCancel");
  const saveBtn = document.getElementById("peraturanNewBabSave");
  if (!input) return;

  cancelBtn.onclick = () => {
    window.pusatConsumeEditGuard("bab-add");
    peraturanAddingBab = false;
    renderPeraturanList();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
  });

  saveBtn.onclick = async () => {
    const judul = input.value.trim();
    if (!judul) {
      peraturanShowModal({ title: "Judul Kosong", message: "Judul bab wajib diisi.", icon: "fa-triangle-exclamation" });
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Menyimpan...";

    try {
      const nomorBaru = peraturanNextBabNomor();
      const docId = `bab_${nomorBaru}`;

      const babBaru = {
        aktif: true,
        judul,
        nomor: nomorBaru,
        urutan: nomorBaru,
        pasal: [],
        updateAt: new Date().toISOString().slice(0, 10)
      };

      await window.setDoc(window.doc(window.db, "peraturanPerusahaan", docId), babBaru);

      peraturanBabList.push({ id: docId, ...babBaru });
      peraturanBabList.sort((a, b) => (a.nomor || 0) - (b.nomor || 0));

      window.pusatConsumeEditGuard("bab-add");
      peraturanAddingBab = false;
      renderPeraturanList();
      peraturanShowToast("Bab baru berhasil ditambahkan.", "success");
    } catch (e) {
      console.error("❌ simpanBabBaru:", e);
      peraturanShowToast("Gagal menambahkan bab.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Simpan";
    }
  };
}

// ── LOAD LIST BAB ──
async function loadPeraturanBab() {
  const listEl = document.getElementById("peraturanList");
  if (!listEl) return;
  listEl.innerHTML = `<div class="peraturan-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    const snap = await window.getDocs(window.collection(window.db, "peraturanPerusahaan"));
    peraturanBabList = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(b => b.aktif !== false)
      .sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
    renderPeraturanList();
  } catch (e) {
    console.error("❌ loadPeraturanBab:", e);
    listEl.innerHTML = `<div class="peraturan-loading">Gagal memuat data.</div>`;
  }
}

function renderPeraturanList() {
  const listEl = document.getElementById("peraturanList");
  if (!listEl) return;

  if (!peraturanBabList.length) {
    listEl.innerHTML = `<div class="peraturan-loading">Belum ada data peraturan.</div>`;
    return;
  }

  let filteredBab = peraturanBabList;
  if (peraturanBabSearchQuery) {
    filteredBab = peraturanBabList.filter(bab =>
      (bab.judul || "").toLowerCase().includes(peraturanBabSearchQuery)
    );
  }

  if (!filteredBab.length && !peraturanAddingBab) {
    listEl.innerHTML = `<div class="peraturan-loading">Tidak ada bab yang cocok.</div>`;
    return;
  }

  listEl.innerHTML = filteredBab.map(bab => `
    <div class="peraturan-item ${bab.id === peraturanActiveBabId ? "active" : ""}" data-id="${bab.id}">
      <div class="peraturan-item-icon"><i class="fa-solid fa-book"></i></div>
      <div class="peraturan-item-judul">
        <div class="peraturan-item-bab-label">Bab ${bab.nomor || "-"}</div>
        <div>${bab.judul || "-"}</div>
      </div>
      <i class="fa-solid fa-chevron-right peraturan-item-arrow"></i>
    </div>
  `).join("") + (peraturanAddingBab ? renderNewBabCardHTML() : "");

  listEl.querySelectorAll(".peraturan-item:not(.peraturan-item-new)").forEach(el => {
    el.addEventListener("click", () => selectPeraturanBab(el.dataset.id));
  });

  if (peraturanAddingBab) bindNewBabCard();

  const addBabBtn = document.getElementById("peraturanAddBabBtn");
  if (addBabBtn) addBabBtn.disabled = peraturanAddingBab;
}

// ── SELECT BAB ──
function selectPeraturanBab(id) {
  const bab = peraturanBabList.find(b => b.id === id);
  if (!bab) return;

  peraturanCancelActiveGuardIfAny();

  peraturanActiveBabId = id;
  peraturanActiveBabData = JSON.parse(JSON.stringify(bab));
  peraturanExpandedPasalSet = new Set();

  document.querySelectorAll(".peraturan-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  const empty   = document.getElementById("peraturanDetailEmpty");
  const content = document.getElementById("peraturanDetailContent");
  const wrapper = document.querySelector(".peraturan-detail-wrapper");

  const wasOpen = wrapper?.classList.contains("show");
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");
  if (!wasOpen) window.pusatPushDetailState?.("peraturan");

  const titleInput = document.getElementById("peraturanDetailTitleInput");
  if (titleInput) titleInput.value = `Bab ${bab.nomor || "-"} — ${bab.judul || "-"}`;
  bindPeraturanJudulBabEdit();
  peraturanSearchQuery = "";
  const searchInput = document.getElementById("peraturanPasalSearch");
  if (searchInput) searchInput.value = "";
  bindPeraturanSearch();
  bindPeraturanAddPasalBtn();
  renderPeraturanDetailBody();
}

let peraturanSearchQuery = "";
let peraturanAddingPasal = false;
let peraturanNewPasalAyatList = [];

function peraturanTryStartEdit(key) {
  if (window._pusatEditGuardKey && window._pusatEditGuardKey !== key) {
    peraturanShowToast("Selesaikan dulu perubahan yang sedang berlangsung.", "error");
    return false;
  }
  return true;
}
function peraturanCancelActiveGuardIfAny() {
  if (window._pusatEditGuardKey) {
    const key = window._pusatEditGuardKey;
    const cancelFn = window._pusatEditGuardClosers[key];
    window.pusatConsumeEditGuard(key);
    cancelFn?.();
  }
}
function peraturanEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
function peraturanHighlight(text, query) {
  const escaped = peraturanEscapeHtml(text);
  if (!query) return escaped;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return escaped.replace(regex, `<mark class="peraturan-highlight">$1</mark>`);
}
function bindPeraturanSearch() {
  const input = document.getElementById("peraturanPasalSearch");
  if (!input) return;
  input.oninput = () => {
    peraturanSearchQuery = input.value.trim().toLowerCase();
    renderPeraturanDetailBody();
  };
}

// ── TOMBOL TAMBAH PASAL ──
function bindPeraturanAddPasalBtn() {
  const btn = document.getElementById("peraturanAddPasalBtn");
  if (!btn) return;
  btn.onclick = () => {
    if (peraturanAddingPasal) return;
    if (!peraturanTryStartEdit("pasal-add")) return;

    peraturanAddingPasal = true;
    peraturanNewPasalAyatList = [""]; // mulai dengan 1 baris ayat kosong
    renderPeraturanDetailBody();

    window.pusatPushEditGuard("pasal-add", () => {
      peraturanAddingPasal = false;
      peraturanNewPasalAyatList = [];
      renderPeraturanDetailBody();
    });

    // scroll ke bawah biar card baru kelihatan
    setTimeout(() => {
      const bodyEl = document.getElementById("peraturanDetailBody");
      bodyEl?.scrollTo({ top: bodyEl.scrollHeight, behavior: "smooth" });
    }, 50);
  };
}
function peraturanNextNomor() {
  const pasalList = peraturanActiveBabData.pasal || [];
  if (!pasalList.length) return 1;
  const maxNomor = Math.max(...pasalList.map(p => p.nomor || 0));
  return maxNomor + 1;
}

// ── RENDER CARD FORM PASAL BARU (inline) ──
function renderNewPasalCardHTML() {
  const nomorBaru = peraturanNextNomor();
  return `
    <div class="peraturan-pasal-card peraturan-pasal-card-new expanded">
      <div class="peraturan-pasal-header peraturan-pasal-header-new">
        <div class="peraturan-pasal-header-text">
          <div class="peraturan-pasal-nomor">Pasal ${nomorBaru} (Baru)</div>
        </div>
      </div>
      <div class="peraturan-pasal-body">
        <div class="peraturan-new-field">
          <label class="peraturan-new-label">Judul Pasal</label>
          <input type="text" class="peraturan-new-judul-input" id="peraturanNewPasalJudul" placeholder="Contoh: Hak Karyawan">
        </div>

        <div class="peraturan-new-field">
          <label class="peraturan-new-label">Ayat</label>
          <div id="peraturanNewAyatList">
            ${peraturanNewPasalAyatList.map((val, i) => `
              <div class="peraturan-new-ayat-row" data-ayat-i="${i}">
                <div class="peraturan-ayat-nomor">${i + 1}.</div>
                <textarea class="peraturan-new-ayat-textarea" placeholder="Isi ayat ke-${i + 1}...">${peraturanEscapeHtml(val)}</textarea>
                ${peraturanNewPasalAyatList.length > 1 ? `<button class="peraturan-new-ayat-remove" title="Hapus ayat"><i class="fa-solid fa-trash"></i></button>` : ""}
              </div>
            `).join("")}
          </div>
          <button class="peraturan-new-add-ayat-btn" id="peraturanAddAyatRowBtn">
            <i class="fa-solid fa-plus"></i> Tambah Ayat
          </button>
        </div>

        <div class="peraturan-new-actions">
          <button class="peraturan-new-btn-cancel" id="peraturanNewPasalCancel">Batal</button>
          <button class="peraturan-new-btn-save" id="peraturanNewPasalSave">Simpan Pasal</button>
        </div>
      </div>
    </div>
  `;
}
function bindNewPasalCard() {
  const judulInput = document.getElementById("peraturanNewPasalJudul");
  const addAyatBtn = document.getElementById("peraturanAddAyatRowBtn");
  const cancelBtn  = document.getElementById("peraturanNewPasalCancel");
  const saveBtn    = document.getElementById("peraturanNewPasalSave");
  if (!judulInput) return;

  // simpan perubahan textarea ke state lokal tiap ketik, biar ga hilang pas re-render
  document.querySelectorAll(".peraturan-new-ayat-textarea").forEach((ta, i) => {
    peraturanAutoResize(ta);
    ta.addEventListener("input", () => {
      peraturanNewPasalAyatList[i] = ta.value;
      peraturanAutoResize(ta);
    });
  });

  document.querySelectorAll(".peraturan-new-ayat-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      const row = btn.closest(".peraturan-new-ayat-row");
      const i = Number(row.dataset.ayatI);
      peraturanNewPasalAyatList.splice(i, 1);
      renderPeraturanDetailBody();
    });
  });

  addAyatBtn.onclick = () => {
    peraturanNewPasalAyatList.push("");
    renderPeraturanDetailBody();
    setTimeout(() => document.querySelectorAll(".peraturan-new-ayat-textarea").item(peraturanNewPasalAyatList.length - 1)?.focus(), 50);
  };

  cancelBtn.onclick = () => {
    window.pusatConsumeEditGuard("pasal-add");
    peraturanAddingPasal = false;
    peraturanNewPasalAyatList = [];
    renderPeraturanDetailBody();
  };

  saveBtn.onclick = async () => {
    const judul = judulInput.value.trim();
    const ayatIsiList = peraturanNewPasalAyatList.map(v => v.trim()).filter(v => v.length > 0);

    if (!judul) {
      peraturanShowModal({ title: "Judul Kosong", message: "Judul pasal wajib diisi.", icon: "fa-triangle-exclamation" });
      return;
    }
    if (!ayatIsiList.length) {
      peraturanShowModal({ title: "Ayat Kosong", message: "Pasal wajib memiliki minimal 1 ayat.", icon: "fa-triangle-exclamation" });
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Menyimpan...";

    try {
      const nomorBaru = peraturanNextNomor();
      const pasalBaru = {
        aktif: true,
        judul,
        nomor: nomorBaru,
        urutan: nomorBaru,
        ayat: ayatIsiList.map((isi, i) => ({
          aktif: true,
          isi,
          nomor: i + 1,
          urutan: i + 1
        }))
      };

      const pasalArrayBaru = [...(peraturanActiveBabData.pasal || []), pasalBaru];

      await window.updateDoc(
        window.doc(window.db, "peraturanPerusahaan", peraturanActiveBabId),
        { pasal: pasalArrayBaru, updateAt: new Date().toISOString().slice(0, 10) }
      );

      peraturanActiveBabData.pasal = pasalArrayBaru;
      const babInList = peraturanBabList.find(b => b.id === peraturanActiveBabId);
      if (babInList) babInList.pasal = pasalArrayBaru;

      window.pusatConsumeEditGuard("pasal-add");
      peraturanAddingPasal = false;
      peraturanNewPasalAyatList = [];
      renderPeraturanDetailBody();
      peraturanShowToast("Pasal baru berhasil ditambahkan.", "success");
    } catch (e) {
      console.error("❌ simpanPasalBaru:", e);
      peraturanShowToast("Gagal menambahkan pasal.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Simpan Pasal";
    }
  };
}

// ── EDIT JUDUL BAB ──
function confirmDeleteAyat(pasalIdx, ayatIdx) {
  const pasal = peraturanActiveBabData.pasal[pasalIdx];
  const ayat = pasal?.ayat?.[ayatIdx];
  if (!ayat) return;

  peraturanShowModal({
    title: "Hapus Ayat?",
    message: `Ayat ${ayat.nomor || "-"} pada Pasal ${pasal.nomor || "-"} akan dihapus permanen.`,
    icon: "fa-trash",
    confirmText: "Hapus",
    showCancel: true,
    onConfirm: () => deleteAyat(pasalIdx, ayatIdx)
  });
}
async function deleteAyat(pasalIdx, ayatIdx) {
  try {
    const pasalArrayBaru = JSON.parse(JSON.stringify(peraturanActiveBabData.pasal));
    pasalArrayBaru[pasalIdx].ayat = pasalArrayBaru[pasalIdx].ayat
      .filter((_, idx) => idx !== ayatIdx)
      .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
      .map((a, i) => ({ ...a, nomor: i + 1, urutan: i + 1 }));

    await window.updateDoc(
      window.doc(window.db, "peraturanPerusahaan", peraturanActiveBabId),
      { pasal: pasalArrayBaru, updateAt: new Date().toISOString().slice(0, 10) }
    );

    peraturanActiveBabData.pasal = pasalArrayBaru;
    const babInList = peraturanBabList.find(b => b.id === peraturanActiveBabId);
    if (babInList) babInList.pasal = pasalArrayBaru;

    renderPeraturanDetailBody();
    peraturanShowToast("Ayat berhasil dihapus.", "success");
  } catch (e) {
    console.error("❌ deleteAyat:", e);
    peraturanShowToast("Gagal menghapus ayat.", "error");
  }
}
function bindPeraturanJudulBabEdit() {
  const btn = document.getElementById("peraturanDetailTitleEditBtn");
  const input = document.getElementById("peraturanDetailTitleInput");
  if (!btn || !input) return;

  const guardKey = "bab-judul-edit";
  let editing = false;

  const cancelJudulEdit = () => {
    editing = false;
    input.readOnly = true;
    input.value = `Bab ${peraturanActiveBabData.nomor || "-"} — ${peraturanActiveBabData.judul || "-"}`;
    btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
  };

  btn.onclick = async () => {
    if (!editing) {
      if (!peraturanTryStartEdit(guardKey)) return;

      editing = true;
      input.readOnly = false;
      input.value = peraturanActiveBabData.judul || "";
      input.focus();
      btn.innerHTML = `<i class="fa-solid fa-check"></i>`;

      window.pusatPushEditGuard(guardKey, cancelJudulEdit);
      return;
    }

    const judulBaru = input.value.trim();
    if (!judulBaru) {
      peraturanShowModal({ title: "Judul Kosong", message: "Judul bab tidak boleh kosong.", icon: "fa-triangle-exclamation" });
      return;
    }

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      await window.updateDoc(
        window.doc(window.db, "peraturanPerusahaan", peraturanActiveBabId),
        { judul: judulBaru, updateAt: new Date().toISOString().slice(0, 10) }
      );

      peraturanActiveBabData.judul = judulBaru;
      const babInList = peraturanBabList.find(b => b.id === peraturanActiveBabId);
      if (babInList) babInList.judul = judulBaru;

      window.pusatConsumeEditGuard(guardKey);

      editing = false;
      input.readOnly = true;
      input.value = `Bab ${peraturanActiveBabData.nomor || "-"} — ${judulBaru}`;
      btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
      renderPeraturanList();
      peraturanShowToast("Judul bab berhasil disimpan.", "success");
    } catch (e) {
      console.error("❌ simpanJudulBab:", e);
      peraturanShowToast("Gagal menyimpan judul bab.", "error");
      btn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
  };
}

// ── RENDER ACCORDION PASAL + AYAT ──
function renderPeraturanDetailBody() {
  const bodyEl = document.getElementById("peraturanDetailBody");
  if (!bodyEl || !peraturanActiveBabData) return;

  let pasalList = (peraturanActiveBabData.pasal || [])
    .map((p, idx) => ({ ...p, _idx: idx }))
    .filter(p => p.aktif !== false)
    .sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

  if (peraturanSearchQuery) {
    pasalList = pasalList.filter(p => {
      const judulMatch = (p.judul || "").toLowerCase().includes(peraturanSearchQuery);
      const ayatMatch = (p.ayat || []).some(a => (a.isi || "").toLowerCase().includes(peraturanSearchQuery));
      return judulMatch || ayatMatch;
    });
  }

  if (!pasalList.length) {
    bodyEl.innerHTML = `
      <div class="peraturan-body-empty">
        <div class="peraturan-empty-icon"><i class="fa-solid ${peraturanSearchQuery ? "fa-magnifying-glass" : "fa-file-lines"}"></i></div>
        <div class="peraturan-empty-title">${peraturanSearchQuery ? "Tidak Ditemukan" : "Belum Ada Pasal"}</div>
        <div class="peraturan-empty-sub">${peraturanSearchQuery ? "Tidak ada pasal atau ayat yang cocok dengan pencarian." : "Bab ini belum memiliki pasal."}</div>
      </div>
    `;
    return;
  }

  bodyEl.innerHTML = `
    <div class="peraturan-pasal-list">
      ${pasalList.map(p => {
        const autoExpand = !!peraturanSearchQuery && (p.ayat || []).some(a => (a.isi || "").toLowerCase().includes(peraturanSearchQuery));
        const isExpanded = peraturanExpandedPasalSet.has(p._idx) || autoExpand;
        return `
        <div class="peraturan-pasal-card ${isExpanded ? "expanded" : ""}" data-pasal-idx="${p._idx}">
          <div class="peraturan-pasal-header">
            <button class="peraturan-pasal-header-btn">
              <div class="peraturan-pasal-header-text">
                <div class="peraturan-pasal-nomor">Pasal ${p.nomor || "-"}</div>
                <div class="peraturan-pasal-judul">${peraturanHighlight(p.judul || "-", peraturanSearchQuery)}</div>
              </div>
              <i class="fa-solid fa-chevron-down peraturan-pasal-chevron"></i>
            </button>
            <button class="peraturan-pasal-delete-btn" data-pasal-idx="${p._idx}" title="Hapus Pasal">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="peraturan-pasal-body">
            ${(p.ayat || [])
              .map((a, aIdx) => ({ ...a, _aIdx: aIdx }))
              .filter(a => a.aktif !== false)
              .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
              .map(a => `
                <div class="peraturan-ayat-row" data-pasal-idx="${p._idx}" data-ayat-idx="${a._aIdx}">
                  <div class="peraturan-ayat-nomor">${a.nomor || "-"}.</div>
                  <div class="peraturan-ayat-display" data-raw-isi="${peraturanEscapeHtml(a.isi || "")}">${peraturanHighlight(a.isi || "", peraturanSearchQuery)}</div>
                  <div class="peraturan-ayat-actions">
                    <button class="peraturan-ayat-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="peraturan-ayat-delete-btn" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                  </div>
                </div>
              `).join("") || `<div class="peraturan-ayat-empty">Belum ada ayat.</div>`}
          </div>
        </div>
      `;}).join("")}
      ${peraturanAddingPasal ? renderNewPasalCardHTML() : ""}
    </div>
  `;

  bindPeraturanAccordion();
  bindPeraturanAyatEdit();
  peraturanAutoResizeAllTextarea();
  if (peraturanAddingPasal) bindNewPasalCard();

  const addBtn = document.getElementById("peraturanAddPasalBtn");
  if (addBtn) addBtn.disabled = peraturanAddingPasal;
}

// ── AUTO-RESIZE TEXTAREA (biar isi ayat ga perlu scroll) ──
function peraturanAutoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
function peraturanAutoResizeAllTextarea() {
  document.querySelectorAll(".peraturan-ayat-textarea").forEach(el => {
    peraturanAutoResize(el);
    el.addEventListener("input", () => peraturanAutoResize(el));
  });
}

// ── ACCORDION TOGGLE ──
function bindPeraturanAccordion() {
  document.querySelectorAll(".peraturan-pasal-header-btn").forEach(headerBtn => {
    headerBtn.addEventListener("click", () => {
      const card = headerBtn.closest(".peraturan-pasal-card");
      const idx = Number(card.dataset.pasalIdx);
      // toggle independen: buka/tutup pasal ini tanpa mempengaruhi pasal lain yang sudah terbuka
      if (peraturanExpandedPasalSet.has(idx)) {
        peraturanExpandedPasalSet.delete(idx);
      } else {
        peraturanExpandedPasalSet.add(idx);
      }
      renderPeraturanDetailBody();
    });
  });

  document.querySelectorAll(".peraturan-pasal-delete-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.pasalIdx);
      confirmDeletePasal(idx);
    });
  });
}
function confirmDeletePasal(pasalIdx) {
  const pasal = peraturanActiveBabData.pasal[pasalIdx];
  if (!pasal) return;

  peraturanShowModal({
    title: "Hapus Pasal?",
    message: `Pasal ${pasal.nomor || "-"} — "${pasal.judul || "-"}" beserta seluruh ayatnya akan dihapus permanen.`,
    icon: "fa-trash",
    confirmText: "Hapus",
    showCancel: true,
    onConfirm: () => deletePasal(pasalIdx)
  });
}
async function deletePasal(pasalIdx) {
  try {
    const pasalArrayBaru = peraturanActiveBabData.pasal
      .filter((_, idx) => idx !== pasalIdx)
      .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
      .map((p, i) => ({ ...p, nomor: i + 1, urutan: i + 1 }));

    await window.updateDoc(
      window.doc(window.db, "peraturanPerusahaan", peraturanActiveBabId),
      { pasal: pasalArrayBaru, updateAt: new Date().toISOString().slice(0, 10) }
    );

    peraturanActiveBabData.pasal = pasalArrayBaru;
    const babInList = peraturanBabList.find(b => b.id === peraturanActiveBabId);
    if (babInList) babInList.pasal = pasalArrayBaru;

    peraturanExpandedPasalSet = new Set(); // index lama udah gak valid setelah renumber
    renderPeraturanDetailBody();
    peraturanShowToast("Pasal berhasil dihapus.", "success");
  } catch (e) {
    console.error("❌ deletePasal:", e);
    peraturanShowToast("Gagal menghapus pasal.", "error");
  }
}

// ── EDIT AYAT INLINE ──
function bindPeraturanAyatEdit() {
  document.querySelectorAll(".peraturan-ayat-row").forEach(row => {
    const displayEl = row.querySelector(".peraturan-ayat-display");
    const editBtn   = row.querySelector(".peraturan-ayat-edit-btn");
    const deleteBtn = row.querySelector(".peraturan-ayat-delete-btn");
    let editing = false;
    let textarea = null;

    deleteBtn.addEventListener("click", () => {
      const pasalIdx = Number(row.dataset.pasalIdx);
      const ayatIdx  = Number(row.dataset.ayatIdx);
      confirmDeleteAyat(pasalIdx, ayatIdx);
    });

    editBtn.addEventListener("click", async () => {
      const pasalIdx = Number(row.dataset.pasalIdx);
      const ayatIdx  = Number(row.dataset.ayatIdx);

      const guardKey = `ayat-${pasalIdx}-${ayatIdx}`;

      if (!editing) {
        if (!peraturanTryStartEdit(guardKey)) return;

        editing = true;
        const rawIsi = displayEl.dataset.rawIsi;

        // ganti div display -> textarea beneran buat mode edit
        textarea = document.createElement("textarea");
        textarea.className = "peraturan-ayat-textarea";
        textarea.value = rawIsi;
        displayEl.replaceWith(textarea);

        textarea.focus();
        peraturanAutoResize(textarea);
        textarea.addEventListener("input", () => peraturanAutoResize(textarea));
        row.classList.add("editing");
        editBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;

        // back (Android/tombol) saat mode ini aktif -> batalkan, balik ke tampilan semula
        window.pusatPushEditGuard(guardKey, () => renderPeraturanDetailBody());
        return;
      }

      const isiBaru = textarea.value.trim();
      if (!isiBaru) {
        peraturanShowModal({ title: "Ayat Kosong", message: "Isi ayat tidak boleh kosong.", icon: "fa-triangle-exclamation" });
        return;
      }

      editBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
      try {
        peraturanActiveBabData.pasal[pasalIdx].ayat[ayatIdx].isi = isiBaru;

        await window.updateDoc(
          window.doc(window.db, "peraturanPerusahaan", peraturanActiveBabId),
          {
            pasal: peraturanActiveBabData.pasal,
            updateAt: new Date().toISOString().slice(0, 10)
          }
        );

        // sinkron ke cache list biar konsisten kalau bab dibuka ulang tanpa reload
        const babInList = peraturanBabList.find(b => b.id === peraturanActiveBabId);
        if (babInList) babInList.pasal = peraturanActiveBabData.pasal;

        window.pusatConsumeEditGuard(guardKey);

        editing = false;
        row.classList.remove("editing");
        editBtn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
        peraturanShowToast("Ayat berhasil disimpan.", "success");
        renderPeraturanDetailBody(); // re-render biar balik jadi div display + highlight terbaru
      } catch (e) {
        console.error("❌ simpanAyat:", e);
        peraturanShowToast("Gagal menyimpan ayat.", "error");
        editBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;
      }
    });
  });
}

// ── BACK TERPUSAT LEWAT #topbarBackBtn ──
function initPeraturanTopbarBack() {
  if (window._peraturanBackBtnBound) return;
  window._peraturanBackBtnBound = true;

  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (window.innerWidth <= 768 && history.state?.pusatDetail === "peraturan") {
      history.back();
      return;
    }
    if (history.state?.pusatView === "peraturan") {
      history.back();
      return;
    }
  });
}
