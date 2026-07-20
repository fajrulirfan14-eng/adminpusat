// ── DATA DUMMY (placeholder, belum konek Firestore) ──
const SOP_LIST = [
  { id: "sop-1", judul: "SOP Penerimaan Barang", icon: "fa-box" },
  { id: "sop-2", judul: "SOP Produksi Harian", icon: "fa-mug-hot" },
  { id: "sop-3", judul: "SOP Distribusi Kurir", icon: "fa-truck" },
  { id: "sop-4", judul: "SOP Penanganan Komplain", icon: "fa-headset" },
];

let sopActiveId = null;

window.initSopView = function () {
  renderSopList();
  initSopSearch();
  initSopAddBabBtn();
  initSopTopbarBack();

  const backBtn = document.getElementById("topbarBackBtn");
  if (backBtn) backBtn.style.display = "flex";
};

function renderSopList() {
  const listEl = document.getElementById("sopList");
  if (!listEl) return;

  const q = (document.getElementById("sopBabSearch")?.value || "").trim().toLowerCase();
  const filtered = q ? SOP_LIST.filter(s => s.judul.toLowerCase().includes(q)) : SOP_LIST;

  if (!filtered.length) {
    listEl.innerHTML = `<div class="sop-loading">Tidak ada SOP yang cocok.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(s => `
    <div class="sop-item ${s.id === sopActiveId ? "active" : ""}" data-id="${s.id}">
      <div class="sop-item-icon"><i class="fa-solid ${s.icon}"></i></div>
      <div class="sop-item-judul">${s.judul}</div>
      <i class="fa-solid fa-chevron-right sop-item-arrow"></i>
    </div>
  `).join("");

  listEl.querySelectorAll(".sop-item").forEach(el => {
    el.addEventListener("click", () => selectSop(el.dataset.id));
  });
}

function selectSop(id) {
  const sop = SOP_LIST.find(s => s.id === id);
  if (!sop) return;

  sopActiveId = id;
  document.querySelectorAll(".sop-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });

  const empty = document.getElementById("sopDetailEmpty");
  const content = document.getElementById("sopDetailContent");
  const wrapper = document.querySelector(".sop-detail-wrapper");

  const wasOpen = wrapper?.classList.contains("show");
  if (empty) empty.style.display = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");
  if (!wasOpen) window.pusatPushDetailState?.("sop");

  const titleInput = document.getElementById("sopDetailTitleInput");
  if (titleInput) titleInput.value = sop.judul;

  document.getElementById("sopAddPasalBtnPlaceholder"); // no-op, placeholder marker
}

// ── SEARCH ──
function initSopSearch() {
  document.getElementById("sopBabSearch")?.addEventListener("input", renderSopList);
}

// ── TOMBOL TAMBAH SOP (placeholder) ──
function initSopAddBabBtn() {
  document.getElementById("sopAddBabBtn")?.addEventListener("click", () => {
    if (window.pusatShowToastGeneric) {
      window.pusatShowToastGeneric("Fitur tambah SOP belum tersedia.", "error");
    } else {
      alert("Fitur tambah SOP belum tersedia.");
    }
  });
}

// ── TOMBOL TAMBAH LANGKAH (placeholder) ──
document.addEventListener("click", (e) => {
  if (e.target?.closest("#sopAddLangkahBtn")) {
    alert("Fitur tambah langkah belum tersedia.");
  }
});

// ── EDIT JUDUL (placeholder, gak nyimpen kemana-mana) ──
document.addEventListener("click", (e) => {
  const btn = e.target?.closest("#sopDetailTitleEditBtn");
  if (!btn) return;
  const input = document.getElementById("sopDetailTitleInput");
  if (!input) return;

  if (input.readOnly) {
    input.readOnly = false;
    input.focus();
    btn.innerHTML = `<i class="fa-solid fa-check"></i>`;
  } else {
    input.readOnly = true;
    btn.innerHTML = `<i class="fa-solid fa-pen"></i>`;
    alert("Fitur simpan judul belum tersedia (placeholder).");
  }
});

// ── BACK TERPUSAT ──
function initSopTopbarBack() {
  if (window._sopBackBtnBound) return;
  window._sopBackBtnBound = true;

  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (window.innerWidth <= 768 && history.state?.pusatDetail === "sop") {
      history.back();
      return;
    }
    if (history.state?.pusatView === "sop") {
      history.back();
    }
  });
}