let leafletMap = null;

const mapTiles = {
  "Alidade Smooth": {
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    attribution: "© Stadia Maps"
  },
  "CartoDB Positron": {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB"
  },
  "CartoDB Dark": {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© CartoDB"
  },
  "Esri Street": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri"
  },
  "Esri Topo": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri"
  },
  "Esri Satelit": {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri"
  },
  "OpenStreetMap": {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap"
  },
  "OpenTopoMap": {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap"
  },
};

let activeTileLayer = null;
let savedTile = localStorage.getItem("mapTile") || "Alidade Smooth";

const hariColors = {
  "Senin":   "#e74c3c",
  "Selasa":  "#e67e22",
  "Rabu":    "#f1c40f",
  "Kamis":   "#2ecc71",
  "Jumat":   "#3498db",
  "Sabtu":   "#9b59b6",
  "Minggu":  "#1abc9c",
};

const ROLE_LABEL = { kurir: "Kurir", sales: "Sales", hunter: "Hunter" };
const HUNTER_IDB_BUCKET = "_HUNTER_ALL_"; // harus sama persis kayak di customer.js
const HUNTER_COLOR = "#8e44ad";

// ── LOAD LEAFLET ──
function loadLeaflet() {
  return new Promise(resolve => {
    if (window.L) return resolve();
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

// ── LOAD MARKER CLUSTER ──
function loadMarkerCluster() {
  return new Promise(resolve => {
    if (window.L?.markerClusterGroup) return resolve();
    const css = document.createElement("link");
    css.rel  = "stylesheet";
    css.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
    document.head.appendChild(css);
    const css2 = document.createElement("link");
    css2.rel  = "stylesheet";
    css2.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
    document.head.appendChild(css2);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

// ── OPEN CABANG MAP ──
window.openCabangMap = async function(activeCabang) {
  const tabBody = document.getElementById("cabangTabBody");
  if (!tabBody) return;

  tabBody.innerHTML = `
    <div class="cabang-map-wrap" id="cabangMapWrap">
      <div class="cabang-map-header">
        <div class="cabang-map-title">
          <i class="fa-solid fa-map-location-dot"></i>
          Lokasi Kantor Cabang
        </div>
        <div class="cabang-map-header-right">
          <div class="map-tile-select-wrap" id="mapTileWrap">
            <button class="map-tile-btn" id="mapTileBtn">
              <i class="fa-solid fa-layer-group"></i>
              <span id="mapTileBtnLabel">${savedTile}</span>
              <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="map-tile-dropdown" id="mapTileDropdown">
              ${Object.keys(mapTiles).map(k => `
                <div class="map-tile-option ${k === savedTile ? "active" : ""}" data-tile="${k}">${k}</div>
              `).join("")}
            </div>
          </div>
          <button class="cabang-map-close" id="cabangMapClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
      <div id="cabangMapEl"></div>
    </div>
  `;

  document.getElementById("cabangMapClose").onclick = () => {
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    if (typeof window.setActiveTabExternal === "function") {
      window.setActiveTabExternal("info", activeCabang);
    }
  };

  if (!document.getElementById("leafletCSS")) {
    const link = document.createElement("link");
    link.id = "leafletCSS"; link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }

  await loadLeaflet();

  if (leafletMap) { leafletMap.remove(); leafletMap = null; }

  leafletMap = L.map("cabangMapEl", {
    center: [activeCabang.lokasiCabang?.latitude || -2.5, activeCabang.lokasiCabang?.longitude || 118],
    zoom: 13, zoomControl: true,
  });

  setTimeout(() => leafletMap.invalidateSize(), 100);

  function applyTile(name) {
    const tile = mapTiles[name] || mapTiles["Alidade Smooth"];
    if (activeTileLayer) leafletMap.removeLayer(activeTileLayer);
    activeTileLayer = L.tileLayer(tile.url, { attribution: tile.attribution, maxZoom: 20 }).addTo(leafletMap);
    savedTile = name;
    localStorage.setItem("mapTile", name);
  }

  applyTile(savedTile);

  const tileBtn      = document.getElementById("mapTileBtn");
  const tileDropdown = document.getElementById("mapTileDropdown");
  const tileBtnLabel = document.getElementById("mapTileBtnLabel");

  tileBtn.addEventListener("click", e => { e.stopPropagation(); tileDropdown.classList.toggle("show"); });
  document.addEventListener("click", () => tileDropdown.classList.remove("show"));
  tileDropdown.querySelectorAll(".map-tile-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      const name = opt.dataset.tile;
      applyTile(name);
      tileBtnLabel.textContent = name;
      tileDropdown.querySelectorAll(".map-tile-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      tileDropdown.classList.remove("show");
    });
  });

  const pinIcon = L.icon({ iconUrl: "pin.png", iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-30] });

  try {
    const snap = await window.getDocs(window.collection(window.db, "kantorCabang"));
    snap.docs.forEach(d => {
      const c = d.data();
      const lat = c.lokasiCabang?.latitude;
      const lng = c.lokasiCabang?.longitude;
      if (!lat || !lng) return;

      const isActive = d.id === activeCabang.id;
      L.marker([lat, lng], { icon: pinIcon }).addTo(leafletMap);

      const namaLabel  = (c.namaCabang || "").length > 15 ? (c.namaCabang || "").substring(0, 15) + "..." : (c.namaCabang || "");
      const labelWidth = Math.min(namaLabel.length * 7, 100);
      const label = L.divIcon({
        className: "",
        html: `<div class="map-pin-label" style="${isActive ? "background:var(--brand-dark);" : ""}">${namaLabel}</div>`,
        iconSize: [labelWidth, 20],
        iconAnchor: [labelWidth / 2, 52],
      });
      L.marker([lat, lng], { icon: label, interactive: false }).addTo(leafletMap);
    });
  } catch(e) { console.error("openCabangMap:", e); }
};

// ── OPEN PETA GLOBAL ──
let _petaGlobalCloserRegistered = false;

window.openPetaGlobal = async function(focusCustomer = null) {
  const overlay = document.getElementById("petaGlobalOverlay");
  if (!overlay) return;

  // daftarkan di sini (bukan top-level file) supaya gak kejebak masalah urutan
  // load script; saat fungsi ini dipanggil, main.js dipastikan sudah ke-load.
  if (!_petaGlobalCloserRegistered && window.registerPusatOverlayCloser) {
    window.registerPusatOverlayCloser("petaGlobal", closePetaGlobal);
    _petaGlobalCloserRegistered = true;
  }

  window.pusatPushOverlayState?.("petaGlobal");

  const tileDropdown = document.getElementById("petaTileDropdown");
  tileDropdown.innerHTML = Object.keys(mapTiles).map(k => `
    <div class="map-tile-option ${k === savedTile ? "active" : ""}" data-tile="${k}">${k}</div>
  `).join("");
  document.getElementById("petaTileBtnLabel").textContent = savedTile;

  overlay.style.display = "flex";
  requestAnimationFrame(() => overlay.classList.add("show"));
  // Tombol locate
  document.getElementById("petaLocateBtn").onclick = () => {
    const btn = document.getElementById("petaLocateBtn");
    btn.classList.add("active");
    const icon = btn.querySelector("i");
    icon.classList.add("fa-spin");

    if (!navigator.geolocation) {
      alert("Browser tidak support geolocation");
      btn.classList.remove("active");
      icon.classList.remove("fa-spin");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        icon.classList.remove("fa-spin");
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Hapus marker lokasi lama
        if (window._locateMarker) {
          leafletMap.removeLayer(window._locateMarker);
        }

        // Tambah marker lokasi
        window._locateMarker = L.circleMarker([lat, lng], {
          radius: 10,
          fillColor: "#3498db",
          fillOpacity: 1,
          color: "#fff",
          weight: 3,
        }).addTo(leafletMap);

        window._locateMarker.bindPopup("📍 Lokasi Saya").openPopup();
        leafletMap.flyTo([lat, lng], 14, { animate: true, duration: 1 });
      },
      err => {
        icon.classList.remove("fa-spin");
        btn.classList.remove("active");
        alert("Gagal mendapat lokasi: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  document.getElementById("petaGlobalClose").onclick = closePetaGlobal;
  overlay.onclick = e => { if (e.target === overlay) closePetaGlobal(); };

  if (!document.getElementById("leafletCSS")) {
    const link = document.createElement("link");
    link.id = "leafletCSS"; link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  // Ambil kurir/sales/hunter langsung dari Firestore — jangan andalin IDB, sering stale/kosong
  let staffMapPeta = {};
  try {
    const staffSnap = await window.getDocs(
      window.query(
        window.collection(window.db, "users"),
        window.where("role", "in", ["kurir", "sales", "hunter"])
      )
    );
    staffSnap.docs.forEach(d => { staffMapPeta[d.id] = { id: d.id, ...d.data() }; });
  } catch(e) { console.error("❌ fetch staff peta:", e); }

  await loadLeaflet();
  const renderer = L.canvas({ padding: 0.5 });
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }

  leafletMap = L.map("petaGlobalMapEl", { center: [-6.5, 108.5], zoom: 10, zoomControl: true });
  setTimeout(() => leafletMap.invalidateSize(), 100);

  let petaTileLayer = null;
  function applyTilePeta(name) {
    const tile = mapTiles[name] || mapTiles["Alidade Smooth"];
    if (petaTileLayer) leafletMap.removeLayer(petaTileLayer);
    petaTileLayer = L.tileLayer(tile.url, { attribution: tile.attribution, maxZoom: 20 }).addTo(leafletMap);
    savedTile = name;
    localStorage.setItem("mapTile", name);
  }
  applyTilePeta(savedTile);

  const tileBtn      = document.getElementById("petaTileBtn");
  const tileBtnLabel = document.getElementById("petaTileBtnLabel");
  tileBtn.onclick = e => { e.stopPropagation(); tileDropdown.classList.toggle("show"); };
  document.addEventListener("click", () => tileDropdown?.classList.remove("show"));
  tileDropdown.querySelectorAll(".map-tile-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      const name = opt.dataset.tile;
      applyTilePeta(name);
      tileBtnLabel.textContent = name;
      tileDropdown.querySelectorAll(".map-tile-option").forEach(o => o.classList.remove("active"));
      opt.classList.add("active");
      tileDropdown.classList.remove("show");
    });
  });
  // Pin kantor cabang
  const cabangData = await window.idbGetCabang() || [];
  const pinIcon = L.icon({ iconUrl: "pin.png", iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-32] });
  cabangData.forEach(c => {
    const lat = c.lokasiCabang?.latitude;
    const lng = c.lokasiCabang?.longitude;
    if (!lat || !lng) return;
    const marker = L.marker([lat, lng], { icon: pinIcon });
    marker.bindPopup(`
      <div class="cust-popup">
        ${c.fotoKantor ? `<img src="${c.fotoKantor}" class="cust-popup-foto">` : ""}
        <div class="cust-popup-info">
          <strong>${c.namaCabang || "-"}</strong>
          <span>${c.namaPt || "-"}</span>
          <span>${c.alamatCabang || "-"}</span>
        </div>
      </div>
    `, { maxWidth: 220 });
    marker.addTo(leafletMap);
  });
  const HARI_LIST = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  const layerGroups = {};
  const allBounds   = [];

  for (const h of HARI_LIST) {
    const layerGroup = L.layerGroup();

    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("pusatDB");
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e);
      });
      const keys = await new Promise((res, rej) => {
        const tx  = db.transaction("cust", "readonly");
        const req = tx.objectStore("cust").getAllKeys();
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e);
      });

      const hariKeys = keys.filter(k => k.endsWith(`_${h}`));
      for (const key of hariKeys) {
        const cached = await new Promise((res, rej) => {
          const tx  = db.transaction("cust", "readonly");
          const req = tx.objectStore("cust").get(key);
          req.onsuccess = e => res(e.target.result?.data || []);
          req.onerror   = e => rej(e);
        });

        cached.forEach(c => {
          const lat = c.lokasiCustomer?._lat || c.lokasiCustomer?.latitude;
          const lng = c.lokasiCustomer?._long || c.lokasiCustomer?.longitude;
          if (!lat || !lng) return;

          allBounds.push([lat, lng]);

          // Cari nama & role pemilik langsung dari Firestore (staffMapPeta), bukan IDB
          let kurirNama = "-";
          let pemilikRole = "kurir";
          const foundStaff = staffMapPeta[c.pemilik];
          if (foundStaff) { kurirNama = foundStaff.nama || "-"; pemilikRole = foundStaff.role || "kurir"; }
          const roleLabel = ROLE_LABEL[pemilikRole] || "Kurir";

          const marker = L.circleMarker([lat, lng], {
            renderer,
            radius: 7,
            fillColor: hariColors[h],
            fillOpacity: 1,
            color: "#fff",
            weight: 2,
          });
          marker._petaNama      = c.namaCustomer || "";
          marker._petaHari      = h;
          marker._petaPemilikId = c.pemilik || "";
          marker._petaPemilikNama = kurirNama;
          marker._petaPemilikRole = pemilikRole;
          marker._petaId = c.id || "";
          marker.bindPopup(`
            <div class="cust-popup">
              ${c.foto ? `<img src="${c.foto}" class="cust-popup-foto">` : ""}
              <div class="cust-popup-info">
                <strong>${c.namaCustomer || "-"}</strong>
                <span>${roleLabel}: ${kurirNama}</span>
                <span style="color:${hariColors[h]};font-weight:600;">${h}</span>
                <span>${parseFloat(c.jarak || 0).toFixed(1)} km</span>
              </div>
            </div>
          `, { maxWidth: 220 });

          layerGroup.addLayer(marker);
        });
      }
    } catch(e) { console.error(e); }

    layerGroups[h] = layerGroup;
    layerGroup.addTo(leafletMap);
  }

  // ── HUNTER: flat list, bukan per-hari — baca dari bucket IDB terpisah ──
  {
    const hunterLayerGroup = L.layerGroup();
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("pusatDB");
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e);
      });
      const keys = await new Promise((res, rej) => {
        const tx  = db.transaction("cust", "readonly");
        const req = tx.objectStore("cust").getAllKeys();
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e);
      });

      const hunterKeys = keys.filter(k => k.endsWith(`_${HUNTER_IDB_BUCKET}`));
      for (const key of hunterKeys) {
        const cached = await new Promise((res, rej) => {
          const tx  = db.transaction("cust", "readonly");
          const req = tx.objectStore("cust").get(key);
          req.onsuccess = e => res(e.target.result?.data || []);
          req.onerror   = e => rej(e);
        });

        cached.forEach(c => {
          if (c.diserahkan === true) return; // udah pindah kepemilikan, jangan ikut ditampilin
          const lat = c.lokasiCustomer?._lat || c.lokasiCustomer?.latitude;
          const lng = c.lokasiCustomer?._long || c.lokasiCustomer?.longitude;
          if (!lat || !lng) return;

          allBounds.push([lat, lng]);

          let kurirNama = "-";
          const foundStaff = staffMapPeta[c.pemilik];
          if (foundStaff) kurirNama = foundStaff.nama || "-";

          const marker = L.circleMarker([lat, lng], {
            renderer,
            radius: 7,
            fillColor: HUNTER_COLOR,
            fillOpacity: 1,
            color: "#fff",
            weight: 2,
          });
          marker._petaNama        = c.namaCustomer || "";
          marker._petaHari        = "Hunter";
          marker._petaPemilikId   = c.pemilik || "";
          marker._petaPemilikNama = kurirNama;
          marker._petaPemilikRole = "hunter";
          marker._petaId          = c.id || "";
          marker.bindPopup(`
            <div class="cust-popup">
              ${c.foto ? `<img src="${c.foto}" class="cust-popup-foto">` : ""}
              <div class="cust-popup-info">
                <strong>${c.namaCustomer || "-"}</strong>
                <span>Hunter: ${kurirNama}</span>
                <span style="color:${HUNTER_COLOR};font-weight:600;">Baru (belum diserahkan)</span>
                <span>${parseFloat(c.jarak || 0).toFixed(1)} km</span>
              </div>
            </div>
          `, { maxWidth: 220 });

          hunterLayerGroup.addLayer(marker);
        });
      }
    } catch(e) { console.error("hunter map load:", e); }

    layerGroups["Hunter"] = hunterLayerGroup;
    hunterLayerGroup.addTo(leafletMap);
  }

  if (focusCustomer?.lat && focusCustomer?.lng) {
    // Fit bounds dulu lalu smooth zoom ke customer
    if (allBounds.length) leafletMap.fitBounds(allBounds, { padding: [40,40] });
    setTimeout(() => {
      leafletMap.flyTo([focusCustomer.lat, focusCustomer.lng], 13, {
        animate: true, duration: 1.5
      });
      // Highlight setelah animasi selesai
      setTimeout(() => {
        allMarkers.forEach(m => {
          if (m._petaId === focusCustomer.id) {
            m.setStyle({ radius: 12, weight: 3, color: "#fff" });
            setTimeout(() => m.openPopup(), 300);
          }
        });
      }, 1600);
    }, 500);
  } else if (allBounds.length) {
    leafletMap.fitBounds(allBounds, { padding: [40,40] });
  }
  // Update count
  document.getElementById("petaCustomerCount").textContent = `${allBounds.length} Customer`;

  // Search
  const allMarkers = [];
  // kumpulkan semua marker dari layerGroups
  Object.values(layerGroups).forEach(lg => {
    lg.eachLayer(m => allMarkers.push(m));
  });
  // Kumpulkan nama kurir unik langsung dari Firestore (staffMapPeta), bukan dari marker customer
  const kurirMap = {};
  Object.values(staffMapPeta).forEach(s => {
    if (s.id && s.nama) kurirMap[s.id] = s.nama;
  });

  let filterPemilik = null;
  let filterHari    = null;

  function applyFilter() {
    const q = document.getElementById("petaSearchInput")?.value.toLowerCase().trim() || "";
    let count = 0;
    allMarkers.forEach((m, i) => {
      const namaMatch    = !q || (m._petaNama || "").toLowerCase().includes(q);
      const pemilikMatch = !filterPemilik || m._petaPemilikId === filterPemilik;
      const hariMatch    = !filterHari    || m._petaHari === filterHari;
      const match = namaMatch && pemilikMatch && hariMatch;
      const h = m._petaHari;
      if (match) {
        count++;
        if (layerGroups[h] && !layerGroups[h].hasLayer(m)) layerGroups[h].addLayer(m);
        if (showNama && leafletMap.getZoom() >= 14 && namaLabels[i]) namaLabels[i].addTo(leafletMap);
      } else {
        if (layerGroups[h]) layerGroups[h].removeLayer(m);
        if (namaLabels[i]) leafletMap.removeLayer(namaLabels[i]);
      }
    });
    document.getElementById("petaCustomerCount").textContent = `${count} Customer`;
  }

  // Dropdown pemilik
  const pemilikDropdown = document.getElementById("petaFilterPemilikDropdown");
  const pemilikBtn      = document.getElementById("petaFilterPemilikBtn");
  const pemilikLabel    = document.getElementById("petaFilterPemilikLabel");

  pemilikDropdown.innerHTML = [
    `<div class="peta-filter-option ${!filterPemilik ? 'selected' : ''}" data-id="">Semua Pemilik</div>`,
    ...Object.entries(kurirMap).map(([id, nama]) =>
      `<div class="peta-filter-option" data-id="${id}">${nama}</div>`
    )
  ].join("");

  pemilikBtn.onclick = e => {
    e.stopPropagation();
    hariDropdown.classList.remove("show");
    pemilikDropdown.classList.toggle("show");
  };

  pemilikDropdown.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      filterPemilik = opt.dataset.id || null;
      pemilikLabel.textContent = filterPemilik ? kurirMap[filterPemilik] : "Pemilik";
      pemilikBtn.classList.toggle("active", !!filterPemilik);
      document.getElementById("petaFilterPemilikClear").style.display = filterPemilik ? "flex" : "none";
      pemilikDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      pemilikDropdown.classList.remove("show");
      applyFilter();
    };
  });

  // Dropdown hari
  const HARI_LIST_FILTER = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
  const hariDropdown = document.getElementById("petaFilterHariDropdown");
  const hariBtn      = document.getElementById("petaFilterHariBtn");
  const hariLabel    = document.getElementById("petaFilterHariLabel");

  hariDropdown.innerHTML = [
    `<div class="peta-filter-option selected" data-hari="">Semua Hari</div>`,
    ...HARI_LIST_FILTER.map(h =>
      `<div class="peta-filter-option" data-hari="${h}" style="border-left: 3px solid ${hariColors[h]};padding-left:9px;">${h}</div>`
    )
  ].join("");

  hariBtn.onclick = e => {
    e.stopPropagation();
    pemilikDropdown.classList.remove("show");
    hariDropdown.classList.toggle("show");
  };

  hariDropdown.querySelectorAll(".peta-filter-option").forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      filterHari = opt.dataset.hari || null;
      hariLabel.textContent = filterHari || "Hari";
      hariBtn.classList.toggle("active", !!filterHari);
      document.getElementById("petaFilterHariClear").style.display = filterHari ? "flex" : "none";
      hariDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      hariDropdown.classList.remove("show");
      applyFilter();
    };
  });
  // Tombol clear pemilik
  document.getElementById("petaFilterPemilikClear").onclick = e => {
    e.stopPropagation();
    filterPemilik = null;
    pemilikLabel.textContent = "Pemilik";
    pemilikBtn.classList.remove("active");
    document.getElementById("petaFilterPemilikClear").style.display = "none";
    pemilikDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
    pemilikDropdown.querySelector("[data-id='']")?.classList.add("selected");
    pemilikDropdown.classList.remove("show");
    applyFilter();
  };

  // Tombol clear hari
  document.getElementById("petaFilterHariClear").onclick = e => {
    e.stopPropagation();
    filterHari = null;
    hariLabel.textContent = "Hari";
    hariBtn.classList.remove("active");
    document.getElementById("petaFilterHariClear").style.display = "none";
    hariDropdown.querySelectorAll(".peta-filter-option").forEach(o => o.classList.remove("selected"));
    hariDropdown.querySelector("[data-hari='']")?.classList.add("selected");
    applyFilter();
  };
  // Toggle nama
  const namaLabels = [];
  let showNama = false;

  allMarkers.forEach(m => {
    const lat = m.getLatLng().lat;
    const lng = m.getLatLng().lng;
    const label = L.marker([lat, lng], {
      icon: L.divIcon({
        html: `<div class="peta-nama-label">${m._petaNama}</div>`,
        className: "",
        iconSize: null,
        iconAnchor: [0, 20],
      }),
      interactive: false,
    });
    label._forMarker = m;
    namaLabels.push(label);
  });
  function updateNamaLabels() {
    if (!showNama) {
      namaLabels.forEach(label => leafletMap.removeLayer(label));
      return;
    }
    const zoom = leafletMap.getZoom();
    namaLabels.forEach((label, i) => {
      const m = label._forMarker;
      const h = m._petaHari;
      const visible = layerGroups[h]?.hasLayer(m);
      if (visible && zoom >= 14) label.addTo(leafletMap);
      else leafletMap.removeLayer(label);
    });
  }

  leafletMap.on("zoomend", updateNamaLabels);

  const namaBtn = document.getElementById("petaFilterNamaBtn");
  namaBtn.onclick = e => {
    e.stopPropagation();
    showNama = !showNama;
    namaBtn.classList.toggle("active", showNama);
    updateNamaLabels();
  };
  // Tutup dropdown klik luar
  document.addEventListener("click", () => {
    pemilikDropdown.classList.remove("show");
    hariDropdown.classList.remove("show");
  });
  document.getElementById("petaSearchInput")?.addEventListener("input", () => applyFilter());
};

function closePetaGlobal() {
  const overlay = document.getElementById("petaGlobalOverlay");
  overlay.classList.remove("show");
  setTimeout(() => {
    overlay.style.display = "none";
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  }, 250);
}

// ── OPEN EDIT LOKASI MAP ──
window.openEditLokasiMap = async function(cabang, currentLokasi, onConfirm) {
  const body = document.getElementById("addBody") || document.getElementById("cabangTabBody");
  if (!body) return;

  let tempLat = currentLokasi.latitude  || -6.2;
  let tempLng = currentLokasi.longitude || 106.8;

  body.innerHTML = `
    <div class="cabang-map-wrap" id="editLokasiMapWrap">
      <div class="cabang-map-header">
        <div class="cabang-map-title">
          <i class="fa-solid fa-map-location-dot"></i> Pilih Lokasi
        </div>
        <div class="edit-lokasi-map-actions">
          <button class="btn-ok-lokasi" id="editLokasiOk">OK</button>
          <button class="cabang-map-close" id="editLokasiClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
      <div class="edit-lokasi-search-bar">
        <input id="editLokasiSearch" type="text" class="edit-lokasi-search-input" placeholder="Contoh: -6.730667,108.480256">
        <button class="edit-lokasi-search-btn" id="editLokasiSearchBtn">
          <i class="fa-solid fa-magnifying-glass"></i>
        </button>
      </div>
      <div class="edit-lokasi-info-bar">
        Koordinat: <span id="editLokasiCoord">${tempLat}, ${tempLng}</span> — seret pin untuk ubah posisi
      </div>
      <div id="editLokasiMapEl"></div>
    </div>
  `;

  if (!document.getElementById("leafletCSS")) {
    const link = document.createElement("link");
    link.id = "leafletCSS"; link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  // Load users dari IndexedDB ke cache
  if (!window._idbUsersCache) {
    window._idbUsersCache = await window.idbGetUsers() || [];
    console.log("idbUsersCache:", window._idbUsersCache.length);
  }
  await loadLeaflet();

  if (leafletMap) { leafletMap.remove(); leafletMap = null; }

  leafletMap = L.map("editLokasiMapEl", { center: [tempLat, tempLng], zoom: 15, zoomControl: true });
  setTimeout(() => leafletMap.invalidateSize(), 100);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "© CartoDB", maxZoom: 19,
  }).addTo(leafletMap);

  const pinIcon = L.icon({ iconUrl: "pin.png", iconSize: [36,36], iconAnchor: [18,36] });
  const marker  = L.marker([tempLat, tempLng], { icon: pinIcon, draggable: true }).addTo(leafletMap);

  marker.on("dragend", e => {
    const pos = e.target.getLatLng();
    tempLat = parseFloat(pos.lat.toFixed(6));
    tempLng = parseFloat(pos.lng.toFixed(6));
    document.getElementById("editLokasiCoord").textContent = `${tempLat}, ${tempLng}`;
  });

  document.getElementById("editLokasiSearchBtn").onclick = () => {
    const parts = document.getElementById("editLokasiSearch").value.trim().split(",");
    if (parts.length !== 2) return alert("Format: -6.730667,108.480256");
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (isNaN(lat)||isNaN(lng)) return alert("Koordinat tidak valid");
    tempLat = lat; tempLng = lng;
    marker.setLatLng([lat,lng]);
    leafletMap.setView([lat,lng], 16);
    document.getElementById("editLokasiCoord").textContent = `${lat}, ${lng}`;
  };

  document.getElementById("editLokasiSearch").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("editLokasiSearchBtn").click();
  });

  document.getElementById("editLokasiOk").onclick = () => {
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    onConfirm(tempLat, tempLng);
  };

  document.getElementById("editLokasiClose").onclick = () => {
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    onConfirm(cabang.lokasiCabang?.latitude || tempLat, cabang.lokasiCabang?.longitude || tempLng);
  };
};
