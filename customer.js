// ── CUSTOMER VIEW ──
let activeCustCabangId = null;
let activeCustKurirId  = null;
let activeCustKurir    = null;
let activeHari         = "Senin";
let lastHariTambah     = "Senin";
let kurirCache         = {}; // cache kurir per cabang

window.initCustomerView = async function() {
  await renderCustomerCabangList();
  initCustomerBackBtn();
};

// ── RENDER LIST CABANG ──
async function renderCustomerCabangList() {
  const list = document.getElementById("customerCabangList");
  if (!list) return;

  if (!window.cabangData || !window.cabangData.length) {
    list.innerHTML = [1,2,3].map(() => `
      <div class="customer-sk-item">
        <div class="customer-sk customer-sk-foto"></div>
        <div class="customer-sk-info">
          <div class="customer-sk customer-sk-nama"></div>
          <div class="customer-sk customer-sk-pt"></div>
        </div>
      </div>
    `).join("");

    try {
      const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
      window.cabangData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      list.innerHTML = `<div class="customer-empty-msg">Gagal memuat data.</div>`;
      return;
    }
  }

  list.innerHTML = window.cabangData.map(c => `
    <div class="customer-cabang-wrap" data-id="${c.id}">
      <div class="customer-cabang-item" onclick="toggleCabangKurir('${c.id}')">
        ${c.fotoKantor
          ? `<img src="${c.fotoKantor}" class="customer-cabang-foto">`
          : `<div class="customer-cabang-foto-placeholder"><i class="fa-solid fa-building"></i></div>`
        }
        <div class="customer-cabang-info">
          <div class="customer-cabang-nama">${c.namaCabang || "-"}</div>
          <div class="customer-cabang-pt">${c.namaPt || "-"}</div>
        </div>
        <i class="fa-solid fa-chevron-down customer-cabang-arrow" id="arrow_${c.id}"></i>
      </div>
      <div class="customer-kurir-list" id="kurirList_${c.id}">
        <div class="customer-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i></div>
      </div>
    </div>
  `).join("");
}

// ── TOGGLE CABANG ──
window.toggleCabangKurir = async function(cabangId) {
  const kurirList = document.getElementById(`kurirList_${cabangId}`);
  const arrow     = document.getElementById(`arrow_${cabangId}`);
  if (!kurirList) return;

  const isOpen = kurirList.classList.contains("open");

  if (isOpen) {
    kurirList.classList.remove("open");
    arrow.style.transform = "";
    document.querySelector(`.customer-cabang-wrap[data-id="${cabangId}"] .customer-cabang-item`)
      ?.classList.remove("active");
    return;
  }

  // Buka yang diklik
  kurirList.classList.add("open");
  arrow.style.transform = "rotate(180deg)";
  document.querySelector(`.customer-cabang-wrap[data-id="${cabangId}"] .customer-cabang-item`)
    ?.classList.add("active");

  activeCustCabangId = cabangId;

  // Load kurir kalau belum ada cache
  if (!kurirCache[cabangId]) {
    try {
      const snap = await window.getDocs(
        window.query(
          window.collection(window.db, "users"),
          window.where("idCabang", "==", cabangId),
          window.where("role", "==", "kurir")
        )
      );
      kurirCache[cabangId] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      kurirList.innerHTML = `<div class="customer-empty-msg">Gagal memuat kurir.</div>`;
      return;
    }
  }

  const kurirData = kurirCache[cabangId];
  if (!kurirData.length) {
    kurirList.innerHTML = `<div class="customer-empty-msg">Belum ada kurir.</div>`;
    return;
  }

  kurirList.innerHTML = `<div>` + kurirData.map(k => {
    const initial = (k.nama || "?")[0].toUpperCase();
    return `
      <div class="customer-kurir-item ${activeCustKurirId === k.id ? 'active' : ''}"
           onclick="selectKurir('${k.id}', '${cabangId}')">
        ${k.foto
          ? `<img src="${k.foto}" class="customer-kurir-foto">`
          : `<div class="customer-kurir-foto-placeholder">${initial}</div>`
        }
        <div class="customer-kurir-nama">${k.nama || "-"}</div>
        <i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:11px;"></i>
      </div>
    `;
  }).join("") + `</div>`;
};

// ── SELECT KURIR ──
window.selectKurir = function(kurirId, cabangId) {
  activeCustKurirId  = kurirId;
  activeCustCabangId = cabangId;

  const kurirData = kurirCache[cabangId] || [];
  activeCustKurir  = kurirData.find(k => k.id === kurirId);
  if (!activeCustKurir) return;

  // Update active state kurir
  document.querySelectorAll(".customer-kurir-item").forEach(el => {
    el.classList.toggle("active", el.getAttribute("onclick")?.includes(kurirId));
  });

  // Buka aside kanan
  const empty   = document.getElementById("customerDetailEmpty");
  const content = document.getElementById("customerDetailContent");
  const wrapper = document.getElementById("customerDetailPanel")?.closest(".customer-detail-wrapper");

  const wasOpen = wrapper?.classList.contains("show");
  if (empty)   empty.style.display   = "none";
  if (content) content.style.display = "flex";
  if (wrapper) wrapper.classList.add("show");
  if (!wasOpen) window.pusatPushDetailState?.("customer");

  if (window.innerWidth <= 768) {
    const backBtn = document.getElementById("topbarBackBtn");
    if (backBtn) backBtn.style.display = "flex";
  }

  // Header kurir
  const initial = (activeCustKurir.nama || "?")[0].toUpperCase();
  document.getElementById("customerDetailNama").textContent = activeCustKurir.nama || "-";
  const fotoWrap = document.getElementById("customerKurirFotoWrap");
  if (fotoWrap) {
    fotoWrap.innerHTML = activeCustKurir.foto
      ? `<img src="${activeCustKurir.foto}" class="customer-detail-foto">`
      : `<div class="customer-detail-foto-placeholder">${initial}</div>`;
  }

  // Load tab Senin default
  activeHari = "Senin";
  document.querySelectorAll(".customer-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.hari === "Senin");
  });
  initCustomerTabs();
  loadCustomerTab("Senin");

  document.getElementById("customerAddBtn").onclick = () => renderTambahCustomer();
  // Init search
  initCustomerSearch();
  // Update total header
  updateCustomerTotal();

  // Preload semua hari di background
  const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  (async () => {
    for (const h of HARI_LIST) {
      let cached = await window.idbGetCust(activeCustKurirId, h);
      if (!cached) {
        try {
          const snap = await window.getDocs(
            window.query(
              window.collection(window.db, "customer"),
              window.where("pemilik", "==", activeCustKurirId),
              window.where("hari", "==", h)
            )
          );
          cached = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          await window.idbSetCust(activeCustKurirId, h, cached);
        } catch(e) { continue; }
      }
      updateTabBadge(h);
    }
    updateCustomerTotal();
  })();
  // Tombol reload
  window.onCustomerReload = async () => {
    const reloadBtn = document.getElementById("topbarReload");
    const icon = reloadBtn?.querySelector("i");
    if (icon) icon.classList.add("fa-spin");
    await window.idbDeleteCust(activeCustKurirId, activeHari);
    await loadCustomerTab(activeHari);
    if (icon) icon.classList.remove("fa-spin");
  };
};

// ── TABS ──
function initCustomerTabs() {
  document.querySelectorAll(".customer-tab").forEach(tab => {
    tab.onclick = () => setCustomerTab(tab.dataset.hari);
  });
}
function setCustomerTab(hari) {
  activeHari = hari;
  document.querySelectorAll(".customer-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.hari === hari);
  });
  loadCustomerTab(hari);
}

// ── LOAD CUSTOMER ──
async function loadCustomerTab(hari) {
  const body = document.getElementById("customerTabBody");
  if (!body) return;
  body.innerHTML = `<div class="customer-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    // Cek IndexedDB dulu
    let customers = await window.idbGetCust(activeCustKurirId, hari);

    if (!customers) {
      const snap = await window.getDocs(
        window.query(
          window.collection(window.db, "customer"),
          window.where("pemilik", "==", activeCustKurirId),
          window.where("hari", "==", hari)
        )
      );
      customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      await window.idbSetCust(activeCustKurirId, hari, customers);
    }

    // Selalu update badge dan total setelah data tersedia
    updateTabBadge(hari);
    updateCustomerTotal();

    if (!customers.length) {
      body.innerHTML = `<div class="customer-empty-msg">Belum ada customer di hari ${hari}.</div>`;
      return;
    }

    body.innerHTML = customers.map(c => {
      const initial = (c.namaCustomer || "?")[0].toUpperCase();
      return `
        <div class="customer-card ${c.status === false ? 'nonaktif' : ''}"
             onclick="openCustomerDetail('${c.id}')">
          ${c.foto
            ? `<img src="${c.foto}" class="customer-card-foto">`
            : `<div class="customer-card-foto-placeholder">${initial}</div>`
          }
          <div class="customer-card-info">
            <div class="customer-card-nama">${c.namaCustomer || "-"}</div>
            <div class="customer-card-sub">${parseFloat(c.jarak || 0).toFixed(1)} km</div>
          </div>
          <i class="fa-solid fa-chevron-right customer-card-arrow"></i>
        </div>
      `;
    }).join("");

  } catch(e) {
    console.error(e);
    body.innerHTML = `<div class="customer-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── BACK BTN ──
function initCustomerBackBtn() {
  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (window.innerWidth <= 768 && history.state?.pusatDetail === "customer") {
      history.back(); // biar popstate yang urus, state konsisten
      return;
    }
    const wrapper = document.getElementById("customerDetailPanel")?.closest(".customer-detail-wrapper");
    if (wrapper) wrapper.classList.remove("show");
    document.getElementById("topbarBackBtn").style.display = "none";
    activeCustKurirId = null;
    document.querySelectorAll(".customer-kurir-item").forEach(el => el.classList.remove("active"));
  });
}

// ── OPEN DETAIL CUSTOMER ──
window.openCustomerDetail = async function(custId) {
  let c = null;
  const cached = await window.idbGetCust(activeCustKurirId, activeHari);
  if (cached) c = cached.find(x => x.id === custId);

  if (!c) {
    const snap = await window.getDoc(window.doc(window.db, "customer", custId));
    if (!snap.exists()) return;
    c = { id: snap.id, ...snap.data() };
  }

  const kurirData = kurirCache[activeCustCabangId] || [];
  const kurir     = kurirData.find(k => k.id === c.pemilik);

  document.getElementById("custSheetOverlay")?.remove();
  document.getElementById("custSheet")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "custSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  const isAktif     = c.status !== false;
  const initial     = (c.namaCustomer || "?")[0].toUpperCase();
  const jarak       = parseFloat(c.jarak || 0).toFixed(1);
  const dataKemarin = c.dataKemarin || {};

  const dkRows = Object.keys(dataKemarin).length
    ? Object.keys(dataKemarin).map(k => `
        <div class="tab-row">
          <span class="tab-row-label">${k}</span>
          <span class="tab-row-value">${dataKemarin[k]?.qty ?? 0} pcs</span>
        </div>
      `).join("")
    : `<div class="customer-empty-msg">Belum ada data</div>`;

  const sheet = document.createElement("div");
  sheet.id = "custSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>

    <div class="akun-sheet-header">
      ${c.foto
        ? `<img src="${c.foto}" class="akun-sheet-foto" onclick="openFotoPopup('${c.foto}')">`
        : `<div class="akun-sheet-foto-placeholder">${initial}</div>`
      }
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">${c.namaCustomer || "-"}</div>
        <div class="cust-sheet-header-badges">
          <span class="cust-badge cust-badge-hari">${c.hari || "-"}</span>
          <span class="cust-badge ${isAktif ? 'cust-badge-aktif' : 'cust-badge-nonaktif'}">${isAktif ? 'Aktif' : 'Nonaktif'}</span>
          ${c.isNew ? `<span class="cust-badge cust-badge-baru">Baru</span>` : ""}
        </div>
      </div>
      <button class="akun-sheet-close" id="custSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="custSheetBody">

      <div class="tab-card">
        <div class="tab-section-title">Informasi</div>
        <div class="tab-row">
          <span class="tab-row-label">Alamat</span>
          <span class="tab-row-value tab-row-value--wrap">${c.alamatCustomer || "-"}</span>
        </div>
        <div class="tab-row">
          <span class="tab-row-label">Jarak</span>
          <span class="tab-row-value">${jarak} km</span>
        </div>
        <div class="tab-row">
          <span class="tab-row-label">Pemilik</span>
          <span class="tab-row-value">${kurir?.nama || "-"}</span>
        </div>
        <div class="tab-row">
          <span class="tab-row-label">Lokasi</span>
          <span class="tab-row-value">
            ${(c.lokasiCustomer?._lat || c.lokasiCustomer?.latitude)
              ? `<button class="btn-lihat-peta" onclick="
                  document.getElementById('custSheetClose')?.click();
                  setTimeout(() => window.openPetaGlobal({
                    lat: ${c.lokasiCustomer._lat || c.lokasiCustomer.latitude},
                    lng: ${c.lokasiCustomer._long || c.lokasiCustomer.longitude},
                    id: '${c.id}'
                  }), 350);
                ">
                  <i class="fa-solid fa-map-location-dot"></i> Lihat Peta
                </button>`
              : "-"
            }
          </span>
        </div>
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Data Kemarin</div>
        ${dkRows}
      </div>

    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    sheet.classList.add("show");
  });

  const closeSheet = () => {
    if (window.innerWidth < 769) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform  = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity    = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      overlay.classList.remove("show");
      sheet.classList.remove("show");
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 250);
    }
  };

  document.getElementById("custSheetClose").onclick = closeSheet;
  if (window.innerWidth >= 769) {
    overlay.onclick = closeSheet;
  }

  let startY = 0, dragging = false, currentDy = 0;
  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const body = document.getElementById("custSheetBody");
    if (body && body.scrollTop > 0) return;
    startY = e.touches[0].clientY; currentDy = 0; dragging = true;
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
      sheet.style.transform  = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity    = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform  = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });
};
// ── INIT SEARCH ──
function initCustomerSearch() {
  const inputDesktop  = document.getElementById("customerSearchInput");
  const inputMobile   = document.getElementById("customerSearchInputMobile");
  const suggestDesk   = document.getElementById("customerSuggestDesktop");
  const suggestMobile = document.getElementById("customerSuggestMobile");

  const hideSuggest = () => {
    suggestDesk?.classList.remove("show");
    suggestMobile?.classList.remove("show");
  };

  const handleSearch = async (q) => {
    if (!q.trim()) {
      hideSuggest();
      return;
    }

    const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
    let allCustomers = [];
    for (const h of HARI_LIST) {
      const cached = await window.idbGetCust(activeCustKurirId, h);
      if (cached) allCustomers = allCustomers.concat(cached);
    }

    const hasil = allCustomers.filter(c =>
      (c.namaCustomer || "").toLowerCase().includes(q.toLowerCase()) ||
      (c.alamatCustomer || "").toLowerCase().includes(q.toLowerCase())
    ).slice(0, 7);

    if (!hasil.length) {
      hideSuggest();
      return;
    }

    const html = hasil.map(c => {
      const initial = (c.namaCustomer || "?")[0].toUpperCase();
      return `
        <div class="customer-suggest-item" onclick="selectSuggest('${c.id}', '${c.hari}')">
          ${c.foto
            ? `<img src="${c.foto}" class="customer-suggest-foto">`
            : `<div class="customer-suggest-foto-placeholder">${initial}</div>`
          }
          <div class="customer-suggest-info">
            <div class="customer-suggest-nama">${c.namaCustomer || "-"}</div>
            <span class="customer-suggest-hari">${c.hari || "-"}</span>
          </div>
        </div>
      `;
    }).join("");

    if (suggestDesk)   { suggestDesk.innerHTML   = html; suggestDesk.classList.add("show"); }
    if (suggestMobile) { suggestMobile.innerHTML = html; suggestMobile.classList.add("show"); }
  };

  inputDesktop?.addEventListener("input",  e => handleSearch(e.target.value));
  inputMobile?.addEventListener("input",   e => handleSearch(e.target.value));

  // Tutup suggest kalau klik di luar
  document.addEventListener("click", e => {
    if (!e.target.closest("#customerSearchWrap") && !e.target.closest("#customerSearchMobile")) {
      hideSuggest();
    }
  });
}
// ── SELECT SUGGEST ──
window.selectSuggest = async function(custId, hari) {
  // Tutup suggest
  document.getElementById("customerSuggestDesktop")?.classList.remove("show");
  document.getElementById("customerSuggestMobile")?.classList.remove("show");

  // Clear search input
  const inputDesktop = document.getElementById("customerSearchInput");
  const inputMobile  = document.getElementById("customerSearchInputMobile");
  if (inputDesktop) inputDesktop.value = "";
  if (inputMobile)  inputMobile.value  = "";

  // Pindah ke tab hari
  await setCustomerTab(hari);

  // Tunggu render selesai lalu highlight
  setTimeout(() => {
    const card = document.querySelector(`.customer-card[onclick*="${custId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("highlight");
      setTimeout(() => {
        card.style.transition = "background 0.8s ease, border-color 0.8s ease";
        card.classList.remove("highlight");
      }, 2000);
    }
  }, 400);
};
// ── RENDER CUSTOMER LIST ──
function renderCustomerList(customers) {
  const body = document.getElementById("customerTabBody");
  if (!body) return;

  if (!customers.length) {
    body.innerHTML = `<div class="customer-empty-msg">Customer tidak ditemukan.</div>`;
    return;
  }

  body.innerHTML = customers.map(c => {
    const initial = (c.namaCustomer || "?")[0].toUpperCase();
    return `
      <div class="customer-card ${c.status === false ? 'nonaktif' : ''}"
           onclick="openCustomerDetail('${c.id}')">
        ${c.foto
          ? `<img src="${c.foto}" class="customer-card-foto">`
          : `<div class="customer-card-foto-placeholder">${initial}</div>`
        }
        <div class="customer-card-info">
          <div class="customer-card-nama">${c.namaCustomer || "-"}</div>
          <div class="customer-card-sub">${parseFloat(c.jarak || 0).toFixed(1)} km</div>
        </div>
        <i class="fa-solid fa-chevron-right customer-card-arrow"></i>
      </div>
    `;
  }).join("");
}

// ── UPDATE TOTAL HEADER ──
async function updateCustomerTotal() {
  const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  let total = 0;
  for (const h of HARI_LIST) {
    const cached = await window.idbGetCust(activeCustKurirId, h);
    if (cached) total += cached.length;
  }
  const el = document.getElementById("customerDetailPt");
  if (el) el.textContent = `Kurir • ${total} Customer`;
}

// ── UPDATE TAB BADGE ──
async function updateTabBadge(hari) {
  const cached = await window.idbGetCust(activeCustKurirId, hari);
  if (!cached) return;

  const wrap = document.querySelector(`.customer-tab-wrap:has([data-hari="${hari}"])`);
  if (!wrap) return;

  let badge = wrap.querySelector(".customer-tab-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "customer-tab-badge";
    wrap.appendChild(badge);
  }
  badge.textContent = cached.length;
}
// ── TAMBAH CUSTOMER ──
async function renderTambahCustomer() {
  document.getElementById("custSheetOverlay")?.remove();
  document.getElementById("custSheet")?.remove();

  // Ambil createdBy dari adminCabang aktif
  let createdBy = window.auth.currentUser.uid;
  try {
    const users = await window.idbGetUsers() || [];
    const adminCabang = users.find(u =>
      u.idCabang === activeCustCabangId && u.role === "adminCabang" && u.status === true
    );
    if (adminCabang) createdBy = adminCabang.id;
  } catch(e) {}

  // Ambil varian dari kantorCabang untuk dataKemarin
  let dataKemarin = {};
  try {
    const cabangList = await window.idbGetCabang() || [];
    const cabang = cabangList.find(c => c.id === activeCustCabangId);
    const varianKantor = cabang?.varian || {};
    Object.keys(varianKantor).forEach(kode => { dataKemarin[kode] = { qty: 0 }; });
  } catch(e) { console.error("dataKemarin error:", e); }

  const overlay = document.createElement("div");
  overlay.id = "custSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  const sheet = document.createElement("div");
  sheet.id = "custSheet";
  sheet.className = "akun-sheet";
  sheet.innerHTML = `
    <div class="akun-sheet-handle"></div>
    <div class="akun-sheet-header">
      <div class="akun-sheet-foto-placeholder">
        <i class="fa-solid fa-user"></i>
      </div>
      <div class="akun-sheet-info">
        <div class="akun-sheet-nama">Tambah Customer</div>
        <div class="akun-sheet-role">${activeCustKurir?.nama || "-"}</div>
      </div>
      <button class="akun-sheet-close" id="custSheetClose">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="akun-sheet-body" id="custSheetBody">

      <div class="tab-card">
        <div class="tab-section-title">Foto</div>
        <div class="edit-foto-wrap" id="custFotoWrap" style="cursor:pointer;">
          <div class="edit-foto-empty"><i class="fa-solid fa-user"></i></div>
          <div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Pilih Foto</div>
        </div>
        <input type="file" id="custFotoInput" accept="image/*" class="edit-foto-input">
      </div>

      <div class="tab-card">
        <div class="tab-section-title">Data Customer</div>
        <div class="edit-field">
          <div class="edit-field-label">Nama Customer</div>
          <input id="custAddNama" type="text" class="edit-field-input" placeholder="Nama customer...">
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Alamat</div>
          <textarea id="custAddAlamat" class="edit-field-input" rows="2" placeholder="Alamat customer..."></textarea>
        </div>
        <div class="edit-field">
          <div class="edit-field-label">Hari Kunjungan</div>
          <div class="cust-hari-dropdown-wrap" id="custHariWrap">
            <button class="cust-hari-btn" id="custHariBtn" type="button">
              <span id="custHariBtnLabel">${lastHariTambah}</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="cust-hari-dropdown" id="custHariDropdown">
              ${["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"].map(h => `
                <div class="cust-hari-option ${h === lastHariTambah ? 'selected' : ''}" data-hari="${h}">${h}</div>
              `).join("")}
            </div>
          </div>
          <input type="hidden" id="custAddHari" value="${lastHariTambah}">
        </div>
      </div>
      <div class="tab-card">
        <div class="tab-section-title">Data Kemarin</div>
        <div class="cust-dk-grid">
          ${Object.keys(dataKemarin).map(k => `
            <div class="cust-dk-row">
              <span class="cust-dk-label">${k}</span>
              <input id="custDK_${k}" type="number" class="cust-dk-input" value="0" min="0">
            </div>
          `).join("")}
        </div>
      </div>
      <div id="custAddError" style="color:#dc2626;font-size:12px;text-align:center;min-height:16px;margin-top:4px;"></div>

    </div>

    <div class="akun-sheet-footer">
      <button class="btn-simpan" id="custAddSimpan" style="flex:1;">
        <i class="fa-solid fa-user-plus"></i> Simpan Customer
      </button>
    </div>
  `;

  document.body.appendChild(sheet);
  requestAnimationFrame(() => {
    overlay.classList.add("show");
    sheet.classList.add("show");
  });

  let tempFotoBlob = null;

  const closeSheet = () => {
    if (window.innerWidth < 769) {
      sheet.style.transition = "transform 0.28s cubic-bezier(0.4,0,0.6,1)";
      sheet.style.transform  = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity    = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      overlay.classList.remove("show");
      sheet.classList.remove("show");
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 250);
    }
  };

  document.getElementById("custSheetClose").onclick = closeSheet;
  if (window.innerWidth >= 769) overlay.onclick = closeSheet;

  // Swipe mobile
  let startY = 0, dragging = false, currentDy = 0;
  sheet.addEventListener("touchstart", e => {
    if (window.innerWidth >= 769) return;
    const body = document.getElementById("custSheetBody");
    if (body && body.scrollTop > 0) return;
    startY = e.touches[0].clientY; currentDy = 0; dragging = true;
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
      sheet.style.transform  = "translateY(110%)";
      overlay.style.transition = "opacity 0.28s ease";
      overlay.style.opacity    = "0";
      setTimeout(() => { overlay.remove(); sheet.remove(); }, 300);
    } else {
      sheet.style.transition = "transform 0.22s cubic-bezier(0.2,0,0,1)";
      sheet.style.transform  = "translateY(0)";
      setTimeout(() => { sheet.style.transition = ""; }, 220);
    }
  }, { passive: true });

  // Foto
  const fotoWrap  = document.getElementById("custFotoWrap");
  const fotoInput = document.getElementById("custFotoInput");
  fotoWrap.onclick = () => fotoInput.click();
  fotoInput.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    window.openCropModal({ file, ratio: 16/9, outputSize: { w: 800, h: 450 }, onSave: blob => {
      tempFotoBlob = blob;
      const url = URL.createObjectURL(blob);
      fotoWrap.innerHTML = `<img src="${url}" class="edit-foto-preview"><div class="edit-foto-overlay"><i class="fa-solid fa-camera"></i> Ganti Foto</div>`;
    }});
  };

  // Dropdown hari custom
  const hariBtn      = document.getElementById("custHariBtn");
  const hariDropdown = document.getElementById("custHariDropdown");
  const hariBtnLabel = document.getElementById("custHariBtnLabel");
  const hariInput    = document.getElementById("custAddHari");

  hariBtn.onclick = e => {
    e.stopPropagation();
    hariDropdown.classList.toggle("show");
  };

  hariDropdown.querySelectorAll(".cust-hari-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      const val = opt.dataset.hari;
      hariInput.value    = val;
      hariBtnLabel.textContent = val;
      lastHariTambah     = val;
      hariDropdown.querySelectorAll(".cust-hari-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      hariDropdown.classList.remove("show");
    };
  });

  document.addEventListener("click", () => hariDropdown.classList.remove("show"));
  // Enter pindah field
  const dkKeys = Object.keys(dataKemarin);
  const fields = [
    "custAddNama",
    "custAddAlamat",
    "custAddHari",
    ...dkKeys.map(k => `custDK_${k}`)
  ];
  fields.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = document.getElementById(fields[i + 1]);
      if (next) next.focus();
      else document.getElementById("custAddSimpan")?.click();
    });
  });
  // Simpan
  document.getElementById("custAddSimpan").onclick = async () => {
    const btn    = document.getElementById("custAddSimpan");
    const errEl  = document.getElementById("custAddError");
    errEl.textContent = "";

    const nama   = document.getElementById("custAddNama").value.trim();
    const alamat = document.getElementById("custAddAlamat").value.trim();
    const hari   = document.getElementById("custAddHari").value;

    if (!nama) return errEl.textContent = "Nama customer wajib diisi";

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
      let fotoUrl = "";
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 800, 0.78);
        const tmpRef = window.storageRef(window.storage, `fotoCustomer/tmp_${Date.now()}.jpg`);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        fotoUrl = await window.uploadWithProgress(tmpRef, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto ${pct}%...`;
        });
      }

      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;
      // Baca dataKemarin dari input
      Object.keys(dataKemarin).forEach(k => {
        dataKemarin[k] = { qty: parseInt(document.getElementById(`custDK_${k}`)?.value) || 0 };
      });
      const now = new Date().toISOString();
      const payload = {
        namaCustomer:  nama,
        alamatCustomer: alamat,
        foto:          fotoUrl,
        hari,
        pemilik:       activeCustKurirId,
        idCabang:      activeCustCabangId,
        createdBy,
        createdAt:     now,
        updatedAt:     now,
        isNew:         true,
        status:        true,
        dataKemarin,
        lokasiCustomer: { _lat: 0, _long: 0 },
        jarak:         0,
      };

      const docRef = await window.addDoc(
        window.collection(window.db, "customer"), payload
      );

      // Rename foto ke docId
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalisasi foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 800, 0.78);
        const finalRef = window.storageRef(window.storage, `fotoCustomer/${docRef.id}_${Date.now()}.jpg`);
        fotoUrl = await window.uploadWithProgress(finalRef, compressed, "image/jpeg");
        await window.updateDoc(window.doc(window.db, "customer", docRef.id), { foto: fotoUrl });
        payload.foto = fotoUrl;
      }

      // Simpan ke IndexedDB — tambah ke array yang sudah ada
      const existing = await window.idbGetCust(activeCustKurirId, hari) || [];
      existing.push({ id: docRef.id, ...payload });
      await window.idbSetCust(activeCustKurirId, hari, existing);

      // Update badge dan total
      updateTabBadge(hari);
      updateCustomerTotal();

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
      btn.classList.add("btn-simpan--success");

      setTimeout(() => {
        closeSheet();
        // Kalau tab aktif sama dengan hari yang baru ditambah, reload tab
        if (activeHari === hari) loadCustomerTab(hari);
      }, 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Simpan Customer`;
      errEl.textContent = "Gagal menyimpan, coba lagi.";
    }
  };
}
