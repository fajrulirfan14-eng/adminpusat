
// ── TOAST & MODAL MANDIRI ──
function profilShowToast(message, type = "success") {
  document.getElementById("profilToast")?.remove();
  const toast = document.createElement("div");
  toast.id = "profilToast";
  toast.className = `profil-toast profil-toast-${type}`;
  toast.innerHTML = `<i class="fa-solid ${type === "success" ? "fa-circle-check" : "fa-circle-exclamation"}"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function profilShowModal({ title = "Perhatian", message = "", icon = "fa-triangle-exclamation", confirmText = "Oke", showCancel = false, onConfirm = null }) {
  document.getElementById("profilModalContainer")?.remove();
  const container = document.createElement("div");
  container.id = "profilModalContainer";
  document.body.appendChild(container);

  container.innerHTML = `
    <div class="profil-modal-overlay" id="profilModalOverlay">
      <div class="profil-modal-box">
        <div class="profil-modal-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="profil-modal-title">${title}</div>
        <div class="profil-modal-message">${message}</div>
        <div class="profil-modal-actions">
          ${showCancel ? `<button class="profil-modal-btn-cancel" id="profilModalCancel">Batal</button>` : ""}
          <button class="profil-modal-btn-ok" id="profilModalOk">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => document.getElementById("profilModalOverlay").classList.add("show"));

  const closeModal = () => {
    document.getElementById("profilModalOverlay")?.classList.remove("show");
    setTimeout(() => container.remove(), 200);
  };
  document.getElementById("profilModalOk").addEventListener("click", () => { closeModal(); onConfirm?.(); });
  document.getElementById("profilModalCancel")?.addEventListener("click", closeModal);
  document.getElementById("profilModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "profilModalOverlay") closeModal();
  });
}

// ── MODAL DENGAN INPUT FIELD (buat Ubah Email/Password) ──
function profilShowSecureModal({ title, fields, confirmText = "Simpan", onConfirm }) {
  document.getElementById("profilModalContainer")?.remove();
  const container = document.createElement("div");
  container.id = "profilModalContainer";
  document.body.appendChild(container);

  const fieldsHtml = fields.map(f => `
    <div class="profil-secure-field">
      <label class="profil-secure-field-label">${f.label}</label>
      <input type="${f.type || 'text'}" id="${f.id}" class="profil-field-input" placeholder="${f.placeholder || ''}" autocomplete="${f.autocomplete || 'off'}">
    </div>
  `).join("");

  container.innerHTML = `
    <div class="profil-modal-overlay" id="profilModalOverlay">
      <div class="profil-modal-box">
        <div class="profil-modal-icon"><i class="fa-solid fa-lock"></i></div>
        <div class="profil-modal-title">${title}</div>
        ${fieldsHtml}
        <div class="profil-secure-error" id="profilSecureError"></div>
        <div class="profil-modal-actions">
          <button class="profil-modal-btn-cancel" id="profilModalCancel">Batal</button>
          <button class="profil-modal-btn-ok" id="profilModalOk">${confirmText}</button>
        </div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => document.getElementById("profilModalOverlay").classList.add("show"));
  setTimeout(() => document.getElementById(fields[0]?.id)?.focus(), 250);

  const closeModal = () => {
    document.getElementById("profilModalOverlay")?.classList.remove("show");
    setTimeout(() => container.remove(), 200);
  };

  document.getElementById("profilModalCancel").addEventListener("click", closeModal);
  document.getElementById("profilModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "profilModalOverlay") closeModal();
  });

  document.getElementById("profilModalOk").addEventListener("click", async () => {
    const btn = document.getElementById("profilModalOk");
    const errEl = document.getElementById("profilSecureError");
    errEl.textContent = "";
    const values = {};
    for (const f of fields) {
      const val = document.getElementById(f.id)?.value?.trim() || "";
      if (f.required !== false && !val) {
        errEl.textContent = `${f.label} wajib diisi.`;
        return;
      }
      values[f.id] = val;
    }
    const originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Memproses...`;
    try {
      await onConfirm(values);
      closeModal();
    } catch (err) {
      errEl.textContent = err.message || "Terjadi kesalahan, coba lagi.";
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  });
}

// ── UBAH PASSWORD ──
function initProfilPasswordEdit() {
  const btn = document.getElementById("profilPasswordEditBtn");
  if (!btn) return;

  btn.onclick = () => {
    profilShowSecureModal({
      title: "Ubah Password",
      confirmText: "Simpan",
      fields: [
        { id: "profilCurrentPass", label: "Password Saat Ini", type: "password", placeholder: "Masukkan password lama" },
        { id: "profilNewPass", label: "Password Baru", type: "password", placeholder: "Minimal 6 karakter" },
        { id: "profilNewPassConfirm", label: "Ulangi Password Baru", type: "password", placeholder: "Ulangi password baru" },
      ],
      onConfirm: async (values) => {
        const { profilCurrentPass, profilNewPass, profilNewPassConfirm } = values;

        if (profilNewPass.length < 6) throw new Error("Password baru minimal 6 karakter.");
        if (profilNewPass !== profilNewPassConfirm) throw new Error("Konfirmasi password tidak cocok.");

        const user = window.auth.currentUser;
        try {
          const credential = window.EmailAuthProvider.credential(user.email, profilCurrentPass);
          await window.reauthenticateWithCredential(user, credential);
        } catch (err) {
          throw new Error("Password saat ini salah.");
        }

        try {
          await window.updatePassword(user, profilNewPass);
        } catch (err) {
          if (err.code === "auth/weak-password") throw new Error("Password baru terlalu lemah.");
          throw new Error("Gagal mengubah password.");
        }

        profilShowToast("Password berhasil diubah.", "success");
      }
    });
  };
}

// ── INIT VIEW ──
window.initProfilView = function () {
  renderProfilData();
  initProfilFotoUpload();
  initProfilFotoPreview();
  initProfilNamaEdit();
  initProfilPasswordEdit();
  initProfilMenuNavigasi();
  initProfilAksesibilitas();
  initProfilLogout();
};

// ── NAVIGASI MENU PENGATURAN ──
function initProfilMenuNavigasi() {
  document.querySelectorAll(".profil-menu-item[data-view]").forEach(item => {
    item.onclick = () => {
      const view = item.dataset.view;
      if (view) window.showView(view, false, true);
    };
  });
}

// ── SHEET AKSESIBILITAS ──
function initProfilAksesibilitas() {
  const btn = document.getElementById("profilMenuAksesibilitas");
  const overlay = document.getElementById("profilAksesibilitasOverlay");
  const sheet = document.getElementById("profilAksesibilitasSheet");
  const closeBtn = document.getElementById("profilAksesibilitasClose");
  if (!btn || !overlay || !sheet) return;

  btn.onclick = () => overlay.classList.add("show");
  const closeSheet = () => {
    overlay.classList.remove("show");
    sheet.style.transform = "";
  };
  closeBtn.onclick = closeSheet;
  overlay.onclick = (e) => { if (e.target === overlay) closeSheet(); };

  profilInitAksesSheetSwipe(sheet, overlay, closeSheet);

  initProfilDarkModeSwitch();
  initProfilTextSizeControl();
  initProfilAksesReset();
}

// ── SWIPE DOWN TO CLOSE (mobile only) ──
function profilInitAksesSheetSwipe(sheetEl, overlayEl, closeFn) {
  const bodyEl = sheetEl.querySelector(".profil-aksesibilitas-body");
  let startY = 0, currentY = 0, dragging = false;

  const onStart = (e) => {
    if (window.innerWidth > 768) return; // desktop: panel samping, ga perlu swipe close
    startY = e.touches[0].clientY;
    currentY = startY;
    dragging = true;
    sheetEl.style.transition = "none";
  };

  const onMove = (e) => {
    if (!dragging) return;
    currentY = e.touches[0].clientY;
    const delta = currentY - startY;

    // masih di dalam konten & belum sampai paling atas -> biarin scroll normal
    if (delta > 0 && bodyEl && bodyEl.scrollTop > 0) {
      dragging = false;
      sheetEl.style.transition = "";
      return;
    }

    if (delta > 0) {
      e.preventDefault(); // cegah pull-to-refresh browser
      sheetEl.style.transform = `translateY(${delta}px)`;
    }
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheetEl.style.transition = "";
    const delta = currentY - startY;
    if (delta > 120) {
      closeFn();
    } else {
      sheetEl.style.transform = "";
    }
    startY = 0; currentY = 0;
  };

  sheetEl.addEventListener("touchstart", onStart, { passive: true });
  sheetEl.addEventListener("touchmove", onMove, { passive: false });
  sheetEl.addEventListener("touchend", onEnd);
}

// ── DARK MODE ──
function profilApplyDarkMode(isDark) {
  document.documentElement.classList.toggle("dark-mode", isDark);
  localStorage.setItem("darkMode", isDark ? "true" : "false");
  const switchEl = document.getElementById("profilDarkModeSwitch");
  switchEl?.classList.toggle("active", isDark);
}

function initProfilDarkModeSwitch() {
  const switchEl = document.getElementById("profilDarkModeSwitch");
  if (!switchEl) return;

  const isDark = localStorage.getItem("darkMode") === "true";
  switchEl.classList.toggle("active", isDark);

  switchEl.onclick = () => {
    const next = !switchEl.classList.contains("active");
    profilApplyDarkMode(next);
  };
}

// ── UKURAN TEKS ──
const PROFIL_TEXT_SIZE_STEPS = [85, 90, 95, 100, 105, 110, 115, 120];

function profilApplyTextSize(index) {
  const clamped = Math.max(0, Math.min(PROFIL_TEXT_SIZE_STEPS.length - 1, index));
  const percent = PROFIL_TEXT_SIZE_STEPS[clamped];
  document.documentElement.style.setProperty("--app-zoom", percent / 100);
  localStorage.setItem("textSizeIndex", clamped);

  const label = document.getElementById("profilTextSizeLabel");
  const progress = document.getElementById("profilTextSizeProgress");
  const minusBtn = document.getElementById("profilTextSizeMinus");
  const plusBtn  = document.getElementById("profilTextSizePlus");

  if (label) label.textContent = `${percent === 100 ? "Normal" : (percent > 100 ? "Besar" : "Kecil")} (${percent}%)`;
  if (progress) progress.style.width = `${(clamped / (PROFIL_TEXT_SIZE_STEPS.length - 1)) * 100}%`;
  if (minusBtn) minusBtn.disabled = clamped === 0;
  if (plusBtn)  plusBtn.disabled  = clamped === PROFIL_TEXT_SIZE_STEPS.length - 1;

  return clamped;
}

function initProfilTextSizeControl() {
  const minusBtn = document.getElementById("profilTextSizeMinus");
  const plusBtn  = document.getElementById("profilTextSizePlus");
  if (!minusBtn || !plusBtn) return;

  let currentIndex = parseInt(localStorage.getItem("textSizeIndex"), 10);
  if (isNaN(currentIndex)) currentIndex = 3; // default 100%
  currentIndex = profilApplyTextSize(currentIndex);

  minusBtn.onclick = () => { currentIndex = profilApplyTextSize(currentIndex - 1); };
  plusBtn.onclick  = () => { currentIndex = profilApplyTextSize(currentIndex + 1); };
}

// ── RESET KE DEFAULT ──
function initProfilAksesReset() {
  const btn = document.getElementById("profilAksesReset");
  if (!btn) return;

  btn.onclick = () => {
    profilApplyDarkMode(false);
    profilApplyTextSize(3); // index default = 100%
    profilShowToast("Pengaturan aksesibilitas dikembalikan ke default.", "success");
  };
}

// ── TERAPKAN PREFERENSI TERSIMPAN SAAT APP LOAD (biar konsisten di semua halaman) ──
(function profilBootAksesibilitas() {
  const isDark = localStorage.getItem("darkMode") === "true";
  document.documentElement.classList.toggle("dark-mode", isDark);

  let savedIndex = parseInt(localStorage.getItem("textSizeIndex"), 10);
  if (isNaN(savedIndex)) savedIndex = 3;
  const percent = PROFIL_TEXT_SIZE_STEPS[Math.max(0, Math.min(PROFIL_TEXT_SIZE_STEPS.length - 1, savedIndex))];
  document.documentElement.style.setProperty("--app-zoom", percent / 100);
})();

// ── PREVIEW FOTO ──
function initProfilFotoPreview() {
  const fotoImg = document.getElementById("profilFotoImg");
  const overlay = document.getElementById("profilFotoPreviewOverlay");
  const previewImg = document.getElementById("profilFotoPreviewImg");
  const closeBtn = document.getElementById("profilFotoPreviewClose");
  if (!fotoImg || !overlay) return;

  fotoImg.onclick = (e) => {
    e.stopPropagation();
    if (!window.currentUser?.foto) return;
    previewImg.src = window.currentUser.foto;
    overlay.classList.add("show");
  };

  const closePreview = () => overlay.classList.remove("show");
  closeBtn.onclick = closePreview;
  overlay.onclick = (e) => { if (e.target === overlay) closePreview(); };
}

function renderProfilData() {
  const user = window.currentUser;
  if (!user) return;

  const namaDisplay = document.getElementById("profilNamaDisplay");
  const roleBadge   = document.getElementById("profilRoleBadge");
  const namaInput   = document.getElementById("profilNamaInput");
  const emailInput  = document.getElementById("profilEmailInput");
  const fotoImg     = document.getElementById("profilFotoImg");
  const fotoPlaceholder = document.getElementById("profilFotoPlaceholder");

  if (namaDisplay) namaDisplay.textContent = user.nama || "-";
  if (roleBadge)   roleBadge.textContent   = user.role || "Admin Pusat";
  if (namaInput)   namaInput.value         = user.nama || "";
  if (emailInput)  emailInput.value        = user.email || "-";

  if (user.foto) {
    if (fotoImg) { fotoImg.src = user.foto; fotoImg.style.display = "block"; }
    if (fotoPlaceholder) fotoPlaceholder.style.display = "none";
  } else {
    if (fotoImg) fotoImg.style.display = "none";
    if (fotoPlaceholder) {
      fotoPlaceholder.style.display = "flex";
      fotoPlaceholder.textContent = (user.nama || user.email || "A")[0].toUpperCase();
    }
  }
}

// ── UPLOAD FOTO ──
function initProfilFotoUpload() {
  const editBtn = document.getElementById("profilFotoEditBtn");
  const input   = document.getElementById("profilFotoInput");
  if (!editBtn || !input) return;

  editBtn.onclick = () => input.click();

  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    input.value = "";

    if (!file.type.startsWith("image/")) {
      profilShowModal({ title: "Format Tidak Didukung", message: "File yang dipilih bukan gambar.", icon: "fa-triangle-exclamation" });
      return;
    }

    window.openCropModal({
      file,
      ratio: 1, // foto profil bulat -> crop persegi
      onSave: async (croppedBlob) => {
        editBtn.querySelector("i").className = "fa-solid fa-spinner fa-spin";
        try {
          const compressedBlob = await window.compressImage(croppedBlob, 720, 0.8);

          if (compressedBlob.size > 3 * 1024 * 1024) {
            profilShowModal({ title: "Ukuran Terlalu Besar", message: "Foto masih melebihi 3MB setelah dikompres. Coba foto lain.", icon: "fa-triangle-exclamation" });
            editBtn.querySelector("i").className = "fa-solid fa-camera";
            return;
          }

          const user = window.currentUser;
          const path = `fotoUsers/${user.uid}`;
          const storageRef = window.storageRef(window.storage, path);
          await window.uploadBytes(storageRef, compressedBlob, { contentType: "image/jpeg" });
          const url = await window.getDownloadURL(storageRef);

          await window.updateDoc(window.doc(window.db, "users", user.uid), { foto: url });
          window.currentUser.foto = url;

          renderProfilData();
          window.setTopbarAvatarPusat?.();
          profilShowToast("Foto profil berhasil diperbarui.", "success");
        } catch (e) {
          console.error("❌ profilFotoUpload:", e);
          profilShowToast("Gagal mengunggah foto.", "error");
        } finally {
          editBtn.querySelector("i").className = "fa-solid fa-camera";
        }
      }
    });
  };
}

// ── EDIT NAMA INLINE ──
function initProfilNamaEdit() {
  const btn   = document.getElementById("profilNamaEditBtn");
  const input = document.getElementById("profilNamaInput");
  if (!btn || !input) return;

  let editing = false;

  btn.onclick = async () => {
    if (!editing) {
      editing = true;
      input.readOnly = false;
      input.focus();
      btn.innerHTML = `<i class="fa-solid fa-check"></i>`;
      btn.classList.add("saving");
      return;
    }

    const namaBaru = input.value.trim();
    if (!namaBaru) {
      profilShowModal({ title: "Nama Kosong", message: "Nama tidak boleh kosong.", icon: "fa-triangle-exclamation" });
      return;
    }

    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
    try {
      const user = window.currentUser;
      await window.updateDoc(window.doc(window.db, "users", user.uid), { nama: namaBaru });
      window.currentUser.nama = namaBaru;

      editing = false;
      input.readOnly = true;
      btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
      btn.classList.remove("saving");
      renderProfilData();
      window.setTopbarAvatar?.();
      profilShowToast("Nama berhasil diperbarui.", "success");
    } catch (e) {
      console.error("❌ profilNamaEdit:", e);
      profilShowToast("Gagal menyimpan nama.", "error");
      btn.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }
  };
}

// ── LOGOUT ──
function initProfilLogout() {
  const btn = document.getElementById("profilBtnLogout");
  if (!btn) return;

  btn.onclick = () => {
    profilShowModal({
      title: "Keluar Akun?",
      message: "Kamu akan keluar dari akun ini dan diarahkan ke halaman login.",
      icon: "fa-right-from-bracket",
      confirmText: "Keluar",
      showCancel: true,
      onConfirm: async () => {
        try {
          await window.auth.signOut();
          localStorage.removeItem("userCache");
          window.location.href = "login.html";
        } catch (e) {
          console.error("❌ profilLogout:", e);
          profilShowToast("Gagal keluar akun.", "error");
        }
      }
    });
  };
}