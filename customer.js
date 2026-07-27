// ── CUSTOMER VIEW (adminPusat) ──
// Sekarang support 3 role: kurir, sales, hunter — bukan cuma kurir.
const ROLE_LABEL      = { kurir: "Kurir", sales: "Sales", hunter: "Hunter" };
const ROLE_COLLECTION = { kurir: "customer", sales: "customerSales" }; // hunter pakai subcollection, ditangani terpisah
const HUNTER_IDB_BUCKET = "_HUNTER_ALL_"; // pseudo "hari" — biar tetap bisa reuse idbGetCust/idbSetCust yang sama

let activeCustCabangId = null;
let activeCustStaffId  = null; // dulu: activeCustKurirId
let activeCustStaff    = null; // dulu: activeCustKurir
let activeCustRole     = "kurir"; // kurir | sales | hunter
let activeHari         = "Senin";
let lastHariTambah     = "Senin";
let staffCache         = {}; // staffCache[cabangId] = { kurir: [...], sales: [...], hunter: [...] }
let activeRoleTabByCabang = {}; // ingat role tab terakhir yang dibuka per cabang

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

      <div class="customer-role-tabs" id="roleTabs_${c.id}">
        <button class="customer-role-tab active" data-role="kurir"  onclick="setCustomerRole('${c.id}','kurir')">Kurir</button>
        <button class="customer-role-tab" data-role="sales"  onclick="setCustomerRole('${c.id}','sales')">Sales</button>
        <button class="customer-role-tab" data-role="hunter" onclick="setCustomerRole('${c.id}','hunter')">Hunter</button>
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
  const roleTabs  = document.getElementById(`roleTabs_${cabangId}`);
  if (!kurirList) return;

  const isOpen = kurirList.classList.contains("open");

  if (isOpen) {
    kurirList.classList.remove("open");
    roleTabs?.classList.remove("open");
    arrow.style.transform = "";
    document.querySelector(`.customer-cabang-wrap[data-id="${cabangId}"] .customer-cabang-item`)
      ?.classList.remove("active");
    return;
  }

  // Buka yang diklik
  kurirList.classList.add("open");
  roleTabs?.classList.add("open");
  arrow.style.transform = "rotate(180deg)";
  document.querySelector(`.customer-cabang-wrap[data-id="${cabangId}"] .customer-cabang-item`)
    ?.classList.add("active");

  activeCustCabangId = cabangId;

  // Role tab terakhir yang dibuka di cabang ini (default: kurir)
  const role = activeRoleTabByCabang[cabangId] || "kurir";
  await setCustomerRole(cabangId, role);
};

// ── ROLE TAB (Kurir / Sales / Hunter) ──
window.setCustomerRole = async function(cabangId, role) {
  activeCustCabangId = cabangId;
  activeRoleTabByCabang[cabangId] = role;

  const roleTabs = document.getElementById(`roleTabs_${cabangId}`);
  roleTabs?.querySelectorAll(".customer-role-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.role === role);
  });

  const kurirList = document.getElementById(`kurirList_${cabangId}`);
  if (!kurirList) return;
  kurirList.innerHTML = `<div class="customer-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

  // Load staff kalau belum ada cache
  if (!staffCache[cabangId]) staffCache[cabangId] = {};
  if (!staffCache[cabangId][role]) {
    try {
      const snap = await window.getDocs(
        window.query(
          window.collection(window.db, "users"),
          window.where("idCabang", "==", cabangId),
          window.where("role", "==", role)
        )
      );
      staffCache[cabangId][role] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch(e) {
      kurirList.innerHTML = `<div class="customer-empty-msg">Gagal memuat ${ROLE_LABEL[role]}.</div>`;
      return;
    }
  }

  const staffData = staffCache[cabangId][role];
  if (!staffData.length) {
    kurirList.innerHTML = `<div class="customer-empty-msg">Belum ada ${ROLE_LABEL[role].toLowerCase()}.</div>`;
    return;
  }

  kurirList.innerHTML = `<div>` + staffData.map(k => {
    const initial = (k.nama || "?")[0].toUpperCase();
    return `
      <div class="customer-kurir-item ${activeCustStaffId === k.id ? 'active' : ''}"
           onclick="selectKurir('${k.id}', '${cabangId}', '${role}')">
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

// ── SELECT STAFF (kurir/sales/hunter) ──
window.selectKurir = function(staffId, cabangId, role) {
  activeCustStaffId  = staffId;
  activeCustCabangId = cabangId;
  activeCustRole      = role || "kurir";

  const staffData = staffCache[cabangId]?.[activeCustRole] || [];
  activeCustStaff  = staffData.find(k => k.id === staffId);
  if (!activeCustStaff) return;

  // Update active state di list kiri
  document.querySelectorAll(".customer-kurir-item").forEach(el => {
    el.classList.toggle("active", el.getAttribute("onclick")?.includes(`'${staffId}'`));
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

  // Header staff
  const initial = (activeCustStaff.nama || "?")[0].toUpperCase();
  document.getElementById("customerDetailNama").textContent = activeCustStaff.nama || "-";
  const fotoWrap = document.getElementById("customerKurirFotoWrap");
  if (fotoWrap) {
    fotoWrap.innerHTML = activeCustStaff.foto
      ? `<img src="${activeCustStaff.foto}" class="customer-detail-foto">`
      : `<div class="customer-detail-foto-placeholder">${initial}</div>`;
  }

  // Tampilkan/sembunyikan tab hari — hunter gak pakai tab hari (flat list)
  const hariTabWrap = document.getElementById("customerHariTabWrap");
  if (hariTabWrap) hariTabWrap.style.display = activeCustRole === "hunter" ? "none" : "";

  document.getElementById("customerAddBtn").onclick = () => renderTambahCustomer();
  initCustomerSearch();

  if (activeCustRole === "hunter") {
    loadHunterTab();
  } else {
    activeHari = "Senin";
    document.querySelectorAll(".customer-tab").forEach(t => {
      t.classList.toggle("active", t.dataset.hari === "Senin");
    });
    initCustomerTabs();
    loadCustomerTab("Senin");

    // Preload semua hari di background
    const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
    (async () => {
      for (const h of HARI_LIST) {
        let cached = await window.idbGetCust(activeCustStaffId, h);
        if (!cached) {
          try {
            const snap = await window.getDocs(
              window.query(
                window.collection(window.db, ROLE_COLLECTION[activeCustRole]),
                window.where("pemilik", "==", activeCustStaffId),
                window.where("hari", "==", h)
              )
            );
            cached = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            await window.idbSetCust(activeCustStaffId, h, cached);
          } catch(e) { continue; }
        }
        updateTabBadge(h);
      }
      updateCustomerTotal();
    })();
  }

  updateCustomerTotal();

  // Tombol reload — refresh SEMUA data staff yang lagi kebuka
  window.onCustomerReload = async () => {
    const reloadBtn = document.getElementById("topbarReload");
    const icon = reloadBtn?.querySelector("i");
    if (icon) icon.classList.add("fa-spin");

    if (activeCustRole === "hunter") {
      await window.idbDeleteCust(activeCustStaffId, HUNTER_IDB_BUCKET);
      await loadHunterTab();
      if (icon) icon.classList.remove("fa-spin");
      return;
    }

    const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];

    // tab yang lagi kebuka di-refresh duluan biar user langsung liat hasilnya
    await window.idbDeleteCust(activeCustStaffId, activeHari);
    await loadCustomerTab(activeHari);

    // sisa hari lain di-refresh di background, biar badge per hari ikut update
    for (const h of HARI_LIST) {
      if (h === activeHari) continue;
      try {
        const snap = await window.getDocs(
          window.query(
            window.collection(window.db, ROLE_COLLECTION[activeCustRole]),
            window.where("pemilik", "==", activeCustStaffId),
            window.where("hari", "==", h)
          )
        );
        const cached = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        await window.idbSetCust(activeCustStaffId, h, cached);
        updateTabBadge(h);
      } catch(e) { continue; }
    }
    updateCustomerTotal();

    if (icon) icon.classList.remove("fa-spin");
  };
};

// ── TABS HARI (kurir & sales) ──
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

// ── LOAD CUSTOMER (kurir & sales, per-hari) ──
async function loadCustomerTab(hari) {
  const body = document.getElementById("customerTabBody");
  if (!body) return;
  body.innerHTML = `<div class="customer-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    // Cek IndexedDB dulu
    let customers = await window.idbGetCust(activeCustStaffId, hari);

    if (!customers) {
      const snap = await window.getDocs(
        window.query(
          window.collection(window.db, ROLE_COLLECTION[activeCustRole]),
          window.where("pemilik", "==", activeCustStaffId),
          window.where("hari", "==", hari)
        )
      );
      customers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      await window.idbSetCust(activeCustStaffId, hari, customers);
    }

    updateTabBadge(hari);
    updateCustomerTotal();

    if (!customers.length) {
      body.innerHTML = `<div class="customer-empty-msg">Belum ada customer di hari ${hari}.</div>`;
      return;
    }

    renderCustomerList(customers);

  } catch(e) {
    console.error(e);
    body.innerHTML = `<div class="customer-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── LOAD HUNTER (flat list, gak per-hari — tetap lewat IDB pakai bucket khusus) ──
async function loadHunterTab() {
  const body = document.getElementById("customerTabBody");
  if (!body) return;
  body.innerHTML = `<div class="customer-empty-msg"><i class="fa-solid fa-spinner fa-spin"></i> Memuat...</div>`;

  try {
    let customers = await window.idbGetCust(activeCustStaffId, HUNTER_IDB_BUCKET);

    if (!customers) {
      const snap = await window.getDocs(
        window.collection(window.db, "users", activeCustStaffId, "customerBaruHunter")
      );
      // yang diserahkan:true udah pindah kepemilikan ke kurir/sales — jangan ikut ditampilin
      customers = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.diserahkan !== true);
      await window.idbSetCust(activeCustStaffId, HUNTER_IDB_BUCKET, customers);
    }

    updateCustomerTotal();

    if (!customers.length) {
      body.innerHTML = `<div class="customer-empty-msg">Belum ada customer baru dari hunter ini.</div>`;
      return;
    }

    renderCustomerList(customers);

  } catch(e) {
    console.error(e);
    body.innerHTML = `<div class="customer-empty-msg">Gagal memuat data.</div>`;
  }
}

// ── BACK BTN ──
function initCustomerBackBtn() {
  document.getElementById("topbarBackBtn")?.addEventListener("click", () => {
    if (window.innerWidth <= 768 && history.state?.pusatDetail === "customer") {
      history.back();
      return;
    }
    const wrapper = document.getElementById("customerDetailPanel")?.closest(".customer-detail-wrapper");
    if (wrapper) wrapper.classList.remove("show");
    document.getElementById("topbarBackBtn").style.display = "none";
    activeCustStaffId = null;
    document.querySelectorAll(".customer-kurir-item").forEach(el => el.classList.remove("active"));
  });
}

// ── OPEN DETAIL CUSTOMER ──
window.openCustomerDetail = async function(custId) {
  let c = null;
  const idbKey = activeCustRole === "hunter" ? HUNTER_IDB_BUCKET : activeHari;
  const cached = await window.idbGetCust(activeCustStaffId, idbKey);
  if (cached) c = cached.find(x => x.id === custId);

  if (!c) {
    const docRef = activeCustRole === "hunter"
      ? window.doc(window.db, "users", activeCustStaffId, "customerBaruHunter", custId)
      : window.doc(window.db, ROLE_COLLECTION[activeCustRole], custId);
    const snap = await window.getDoc(docRef);
    if (!snap.exists()) return;
    c = { id: snap.id, ...snap.data() };
  }

  document.getElementById("custSheetOverlay")?.remove();
  document.getElementById("custSheet")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "custSheetOverlay";
  overlay.className = "akun-sheet-overlay";
  document.body.appendChild(overlay);

  const isAktif     = c.status !== false;
  const initial     = (c.namaCustomer || "?")[0].toUpperCase();
  const jarak       = parseFloat(c.jarak || 0).toFixed(1);
  const qtyField    = activeCustRole === "hunter" ? "konsinyasi" : "dataKemarin";
  const qtyLabel    = activeCustRole === "hunter" ? "Konsinyasi" : "Data Kemarin";
  const qtyData     = c[qtyField] || {};

  const dkRows = Object.keys(qtyData).length
    ? Object.keys(qtyData).map(k => `
        <div class="tab-row">
          <span class="tab-row-label">${k}</span>
          <span class="tab-row-value">${qtyData[k]?.qty ?? 0} pcs</span>
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
          ${activeCustRole !== "hunter" ? `<span class="cust-badge cust-badge-hari">${c.hari || "-"}</span>` : ""}
          <span class="cust-badge ${isAktif ? 'cust-badge-aktif' : 'cust-badge-nonaktif'}">${isAktif ? 'Aktif' : 'Nonaktif'}</span>
          ${c.isNew ? `<span class="cust-badge cust-badge-baru">Baru</span>` : ""}
          ${activeCustRole === "hunter" ? `<span class="cust-badge ${c.diserahkan ? 'cust-badge-aktif' : 'cust-badge-nonaktif'}">${c.diserahkan ? 'Sudah Diserahkan' : 'Belum Diserahkan'}</span>` : ""}
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
          <span class="tab-row-value">${activeCustStaff?.nama || "-"}</span>
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
        <div class="tab-section-title">${qtyLabel}</div>
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

    let allCustomers = [];
    if (activeCustRole === "hunter") {
      const cached = await window.idbGetCust(activeCustStaffId, HUNTER_IDB_BUCKET);
      if (cached) allCustomers = cached;
    } else {
      const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
      for (const h of HARI_LIST) {
        const cached = await window.idbGetCust(activeCustStaffId, h);
        if (cached) allCustomers = allCustomers.concat(cached);
      }
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
        <div class="customer-suggest-item" onclick="selectSuggest('${c.id}', '${c.hari || ""}')">
          ${c.foto
            ? `<img src="${c.foto}" class="customer-suggest-foto">`
            : `<div class="customer-suggest-foto-placeholder">${initial}</div>`
          }
          <div class="customer-suggest-info">
            <div class="customer-suggest-nama">${c.namaCustomer || "-"}</div>
            ${activeCustRole !== "hunter" ? `<span class="customer-suggest-hari">${c.hari || "-"}</span>` : ""}
          </div>
        </div>
      `;
    }).join("");

    if (suggestDesk)   { suggestDesk.innerHTML   = html; suggestDesk.classList.add("show"); }
    if (suggestMobile) { suggestMobile.innerHTML = html; suggestMobile.classList.add("show"); }
  };

  inputDesktop?.addEventListener("input",  e => handleSearch(e.target.value));
  inputMobile?.addEventListener("input",   e => handleSearch(e.target.value));

  document.addEventListener("click", e => {
    if (!e.target.closest("#customerSearchWrap") && !e.target.closest("#customerSearchMobile")) {
      hideSuggest();
    }
  });
}

// ── SELECT SUGGEST ──
window.selectSuggest = async function(custId, hari) {
  document.getElementById("customerSuggestDesktop")?.classList.remove("show");
  document.getElementById("customerSuggestMobile")?.classList.remove("show");

  const inputDesktop = document.getElementById("customerSearchInput");
  const inputMobile  = document.getElementById("customerSearchInputMobile");
  if (inputDesktop) inputDesktop.value = "";
  if (inputMobile)  inputMobile.value  = "";

  if (activeCustRole !== "hunter" && hari) {
    await setCustomerTab(hari);
  }

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
        ${activeCustRole === "hunter"
          ? `<span class="cust-badge customer-card-badge-sm ${c.diserahkan ? 'cust-badge-aktif' : 'cust-badge-nonaktif'}">${c.diserahkan ? 'Diserahkan' : 'Baru'}</span>`
          : ""
        }
        <i class="fa-solid fa-chevron-right customer-card-arrow"></i>
      </div>
    `;
  }).join("");
}

// ── UPDATE TOTAL HEADER ──
async function updateCustomerTotal() {
  let total = 0;
  if (activeCustRole === "hunter") {
    const cached = await window.idbGetCust(activeCustStaffId, HUNTER_IDB_BUCKET);
    total = cached ? cached.length : 0;
  } else {
    const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
    for (const h of HARI_LIST) {
      const cached = await window.idbGetCust(activeCustStaffId, h);
      if (cached) total += cached.length;
    }
  }
  const el = document.getElementById("customerDetailPt");
  if (el) el.textContent = `${ROLE_LABEL[activeCustRole]} • ${total} Customer`;
}

// ── UPDATE TAB BADGE (kurir & sales) ──
async function updateTabBadge(hari) {
  const cached = await window.idbGetCust(activeCustStaffId, hari);
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

// ── TAMBAH CUSTOMER (kurir / sales / hunter) ──
async function renderTambahCustomer() {
  document.getElementById("custSheetOverlay")?.remove();
  document.getElementById("custSheet")?.remove();

  // Ambil createdBy dari adminCabang aktif
  let createdBy = window.auth.currentUser.uid;
  try {
    const snap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("idCabang", "==", activeCustCabangId),
        window.where("role", "==", "adminCabang"),
        window.where("status", "==", true)
      )
    );
    if (!snap.empty) createdBy = snap.docs[0].id;
  } catch(e) {
    console.error("❌ cari adminCabang aktif:", e);
  }

  // Ambil varian dari kantorCabang buat grid qty
  let qtyData = {};
  try {
    const cabang = (window.cabangData || []).find(c => c.id === activeCustCabangId);
    const varianKantor = cabang?.varian || {};
    Object.keys(varianKantor).forEach(kode => { qtyData[kode] = { qty: 0 }; });
  } catch(e) { console.error("qtyData error:", e); }

  const qtyField = activeCustRole === "hunter" ? "konsinyasi" : "dataKemarin";
  const qtyLabel = activeCustRole === "hunter" ? "Konsinyasi" : "Data Kemarin";
  const showHari = activeCustRole !== "hunter";

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
        <div class="akun-sheet-role">${activeCustStaff?.nama || "-"} • ${ROLE_LABEL[activeCustRole]}</div>
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
        ${showHari ? `
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
        ` : ""}
      </div>
      <div class="tab-card">
        <div class="tab-section-title">${qtyLabel}</div>
        <div class="cust-dk-grid">
          ${Object.keys(qtyData).map(k => `
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

  // Dropdown hari custom (kurir/sales doang)
  if (showHari) {
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
  }

  // Enter pindah field
  const dkKeys = Object.keys(qtyData);
  const fields = [
    "custAddNama",
    "custAddAlamat",
    ...(showHari ? ["custAddHari"] : []),
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
    const hari   = showHari ? document.getElementById("custAddHari").value : "";

    if (!nama) return errEl.textContent = "Nama customer wajib diisi";

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;

    try {
      let fotoUrl = "";
      const fotoFolder = activeCustRole === "hunter" ? "fotoCustomer" : "fotoCustomer"; // sama folder buat semua role
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kompres foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 800, 0.78);
        const tmpRef = window.storageRef(window.storage, `${fotoFolder}/tmp_${Date.now()}.jpg`);
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto 0%...`;
        fotoUrl = await window.uploadWithProgress(tmpRef, compressed, "image/jpeg", pct => {
          btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Upload foto ${pct}%...`;
        });
      }

      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;
      Object.keys(qtyData).forEach(k => {
        qtyData[k] = { qty: parseInt(document.getElementById(`custDK_${k}`)?.value) || 0 };
      });
      const now = new Date().toISOString();

      const payload = {
        namaCustomer:   nama,
        alamatCustomer: alamat,
        foto:           fotoUrl,
        pemilik:        activeCustStaffId,
        idCabang:       activeCustCabangId,
        createdBy,
        createdAt:      now,
        updatedAt:      now,
        isNew:          true,
        status:         true,
        [qtyField]:     qtyData,
        lokasiCustomer: { _lat: 0, _long: 0 },
        jarak:          0,
      };
      if (showHari) payload.hari = hari;
      if (activeCustRole === "hunter") payload.diserahkan = false;

      let docRef;
      if (activeCustRole === "hunter") {
        docRef = await window.addDoc(
          window.collection(window.db, "users", activeCustStaffId, "customerBaruHunter"), payload
        );
      } else {
        docRef = await window.addDoc(
          window.collection(window.db, ROLE_COLLECTION[activeCustRole]), payload
        );
      }

      // Rename foto ke docId
      if (tempFotoBlob) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Finalisasi foto...`;
        const compressed = await window.compressImage(tempFotoBlob, 800, 0.78);
        const finalRef = window.storageRef(window.storage, `${fotoFolder}/${docRef.id}_${Date.now()}.jpg`);
        fotoUrl = await window.uploadWithProgress(finalRef, compressed, "image/jpeg");
        if (activeCustRole === "hunter") {
          await window.updateDoc(window.doc(window.db, "users", activeCustStaffId, "customerBaruHunter", docRef.id), { foto: fotoUrl });
        } else {
          await window.updateDoc(window.doc(window.db, ROLE_COLLECTION[activeCustRole], docRef.id), { foto: fotoUrl });
        }
        payload.foto = fotoUrl;
      }

      // Simpan ke IndexedDB
      const idbKey = showHari ? hari : HUNTER_IDB_BUCKET;
      const existing = await window.idbGetCust(activeCustStaffId, idbKey) || [];
      existing.push({ id: docRef.id, ...payload });
      await window.idbSetCust(activeCustStaffId, idbKey, existing);

      if (showHari) updateTabBadge(hari);
      updateCustomerTotal();

      btn.innerHTML = `<i class="fa-solid fa-check"></i> Tersimpan!`;
      btn.classList.add("btn-simpan--success");

      setTimeout(() => {
        closeSheet();
        if (activeCustRole === "hunter") {
          loadHunterTab();
        } else if (activeHari === hari) {
          loadCustomerTab(hari);
        }
      }, 1000);

    } catch(e) {
      console.error(e);
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-user-plus"></i> Simpan Customer`;
      errEl.textContent = "Gagal menyimpan, coba lagi.";
    }
  };
}
