let homeChartInstance = null;
let homeChartCache = {};
let homeChartSelectedSet = new Set();
let homeChartGabunganMode = false;
let homeChartLastResult = null;
let homeChartRawLabels = [];

const HOME_CHART_COLOR_PALETTE = [
  "#8A6234", "#16a34a", "#2563eb", "#dc2626", "#7c3aed", "#ea580c", "#0891b2", "#c026d3",
  "#65a30d", "#0d9488", "#e11d48", "#4338ca", "#ca8a04", "#059669", "#db2777", "#6366f1",
  "#d97706", "#059212", "#be185d", "#1d4ed8"
];

function homeChartCurrentPeriode() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function homeChartGetAdminCabangList() {
  const allUsers = await window.idbGetUsers();
  if (!allUsers) return [];
  return allUsers
    .filter(u => u.role === "adminCabang" && u.status === true)
    .map(u => ({ uid: u.id, idCabang: u.idCabang, nama: u.kantorCabang || "Cabang" }));
}

async function homeChartLoadData(periode) {
  const adminList = await homeChartGetAdminCabangList();
  const now = new Date();
  const isCurrentMonth = periode === homeChartCurrentPeriode();
  const [tahun, bulan] = periode.split("-").map(Number);
  const daysInMonth = new Date(tahun, bulan, 0).getDate();
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;

  const labels = [];
  for (let d = 1; d <= lastDay; d++) {
    labels.push(`${periode}-${String(d).padStart(2, "0")}`);
  }

  const series = await Promise.all(adminList.map(async (admin, idx) => {
    const perTanggal = {};
    const perTanggalClosing = {};

    try {
      const snap = await window.getDocs(window.collection(window.db, "users", admin.uid, "laporanAdmin"));
      snap.forEach(docSnap => {
        if (!docSnap.id.startsWith(periode)) return;
        const dataPerUid = docSnap.data() || {};
        let totalHari = 0;
        const closingHari = {};

        Object.values(dataPerUid).forEach(uidData => {
          const bayar = Number(uidData?.pembayaran?.nota?.bayar) || 0;
          const keterangan = Number(uidData?.pembayaran?.nota?.keterangan) || 0;
          totalHari += bayar + keterangan;

          const closing = uidData?.pembayaran?.closing || {};
          Object.entries(closing).forEach(([varian, nilai]) => {
            closingHari[varian] = (closingHari[varian] || 0) + (Number(nilai) || 0);
          });
        });

        perTanggal[docSnap.id] = totalHari;
        perTanggalClosing[docSnap.id] = closingHari;
      });
    } catch (e) {
      console.error(`❌ homeChartLoadData (${admin.nama}):`, e);
    }

    return {
      cabangId: admin.idCabang,
      nama: admin.nama,
      color: HOME_CHART_COLOR_PALETTE[idx % HOME_CHART_COLOR_PALETTE.length],
      data: labels.map(tgl => perTanggal[tgl] || 0),
      closingData: labels.map(tgl => perTanggalClosing[tgl] || {})
    };
  }));

  return { labels, series };
}

function homeChartInitFilterPopup(series) {
  const btn = document.getElementById("homeChartFilterBtn");
  const listEl = document.getElementById("homeChartFilterList");
  if (!btn || !listEl) return;

  if (listEl.parentElement !== document.body) {
    document.body.appendChild(listEl);
  }

  const positionDropdown = () => {
    const rect = btn.getBoundingClientRect();
    listEl.style.position = "fixed";
    listEl.style.top = `${rect.bottom + 6}px`;
    listEl.style.left = `${rect.left}px`;
    listEl.style.minWidth = `${rect.width}px`;
  };

  const renderList = () => {
    listEl.innerHTML = `
      ${series.map(s => `
        <div class="home-chart-filter-option ${homeChartSelectedSet.has(s.cabangId) ? "selected" : ""}" data-cabang-id="${s.cabangId}">
          <span class="home-chart-filter-dot" style="background:${s.color};"></span>
          <span class="home-chart-filter-nama">${s.nama}</span>
          ${homeChartSelectedSet.has(s.cabangId) ? `<i class="fa-solid fa-check"></i>` : ""}
        </div>
      `).join("")}
      <div class="home-chart-filter-divider"></div>
      <div class="home-chart-filter-option gabungan-option ${homeChartGabunganMode ? "selected" : ""}" id="homeChartFilterGabungan">
        <span class="home-chart-filter-dot gabungan-dot"><i class="fa-solid fa-layer-group"></i></span>
        <span class="home-chart-filter-nama">Gabungan Cabang</span>
        ${homeChartGabunganMode ? `<i class="fa-solid fa-check"></i>` : ""}
      </div>
    `;

    listEl.querySelectorAll(".home-chart-filter-option:not(.gabungan-option)").forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        const id = opt.dataset.cabangId;
        homeChartGabunganMode = false;
        if (homeChartSelectedSet.has(id)) homeChartSelectedSet.delete(id);
        else homeChartSelectedSet.add(id);
        renderList();
        homeChartUpdateFilterLabel(series);
        homeChartRebuildView();
      };
    });

    document.getElementById("homeChartFilterGabungan").onclick = (e) => {
      e.stopPropagation();
      homeChartGabunganMode = !homeChartGabunganMode;
      if (homeChartGabunganMode) homeChartSelectedSet.clear();
      renderList();
      homeChartUpdateFilterLabel(series);
      homeChartRebuildView();
    };
  };

  renderList();

  btn.onclick = (e) => {
    e.stopPropagation();
    const willOpen = listEl.style.display === "none";
    listEl.style.display = "none";
    if (willOpen) {
      positionDropdown();
      listEl.style.display = "block";
    }
  };

  document.addEventListener("click", () => { listEl.style.display = "none"; });
  window.addEventListener("scroll", () => {
    if (listEl.style.display !== "none") positionDropdown();
  }, true);
  window.addEventListener("resize", () => {
    if (listEl.style.display !== "none") positionDropdown();
  });
}

function homeChartUpdateFilterLabel(series) {
  const labelEl = document.getElementById("homeChartFilterLabel");
  if (!labelEl) return;

  if (homeChartGabunganMode) {
    labelEl.textContent = "Gabungan Cabang";
  } else if (homeChartSelectedSet.size === 0) {
    labelEl.textContent = "Semua Cabang";
  } else if (homeChartSelectedSet.size === 1) {
    const s = series.find(x => homeChartSelectedSet.has(x.cabangId));
    labelEl.textContent = s?.nama || "1 Cabang";
  } else {
    labelEl.textContent = `${homeChartSelectedSet.size} Cabang Dipilih`;
  }
}

function homeChartRebuildView() {
  if (!homeChartLastResult) return;
  const { labels, series } = homeChartLastResult;

  if (homeChartGabunganMode) {
    const gabunganData = labels.map((_, idx) => series.reduce((sum, s) => sum + (s.data[idx] || 0), 0));
    const gabunganClosing = labels.map((_, idx) => {
      const merged = {};
      series.forEach(s => {
        const closing = s.closingData[idx] || {};
        Object.entries(closing).forEach(([varian, v]) => {
          merged[varian] = (merged[varian] || 0) + v;
        });
      });
      return merged;
    });

    homeChartRender(labels, [{
      cabangId: "__gabungan__",
      nama: "Gabungan Semua Cabang",
      color: "#8A6234",
      data: gabunganData,
      closingData: gabunganClosing
    }]);
    return;
  }

  const filtered = homeChartSelectedSet.size === 0
    ? series
    : series.filter(s => homeChartSelectedSet.has(s.cabangId));

  homeChartRender(labels, filtered);
}

let homeChartTooltipScrollBound = false;

function homeChartHideTooltip() {
  const el = document.getElementById("homeChartTooltip");
  if (el) el.style.opacity = 0;
}

function homeChartTooltipHandler(context) {
  const { chart, tooltip } = context;
  let tooltipEl = document.getElementById("homeChartTooltip");

  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.id = "homeChartTooltip";
    tooltipEl.className = "home-chart-tooltip";
    document.body.appendChild(tooltipEl);
  }

  if (!homeChartTooltipScrollBound) {
    homeChartTooltipScrollBound = true;
    window.addEventListener("scroll", homeChartHideTooltip, true);
    window.addEventListener("resize", homeChartHideTooltip);
  }

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  const point = tooltip.dataPoints?.[0];
  if (!point) { tooltipEl.style.opacity = 0; return; }

  const dataset = chart.data.datasets[point.datasetIndex];
  const idx = point.dataIndex;
  const rawTgl = homeChartRawLabels[idx];
  const dateFormatted = rawTgl
    ? new Date(rawTgl).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
    : "";

  const nama = dataset.label || "-";
  const total = Number(point.parsed.y || 0).toLocaleString("id-ID");
  const closing = dataset._closingData?.[idx] || {};
  const closingEntries = Object.entries(closing).filter(([, v]) => v);

  tooltipEl.innerHTML = `
    <div class="home-chart-tooltip-date">${dateFormatted}</div>
    <div class="home-chart-tooltip-cabang" style="color:${dataset.borderColor};">${nama}</div>
    <div class="home-chart-tooltip-total">${total}</div>
    ${closingEntries.length ? `
      <div class="home-chart-tooltip-breakdown">
        ${closingEntries.map(([varian, v]) => `<span>${varian}: ${Number(v).toLocaleString("id-ID")}</span>`).join("")}
      </div>
    ` : ""}
  `;

  // posisi dihitung dari bounding rect canvas di viewport (bukan offsetLeft/offsetTop relatif parent),
  // karena tooltip sekarang position:fixed nempel ke body, bukan lagi child dari wrapper yang bisa discroll.
  const canvasRect = chart.canvas.getBoundingClientRect();
  tooltipEl.style.opacity = 1;
  tooltipEl.style.left = `${canvasRect.left + tooltip.caretX}px`;
  tooltipEl.style.top = `${canvasRect.top + tooltip.caretY}px`;
}

function homeChartHexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function homeChartRender(labels, series) {
  const canvas = document.getElementById("homeChartCanvas");
  if (!canvas) return;

  if (homeChartInstance) {
    homeChartInstance.destroy();
    homeChartInstance = null;
  }

  homeChartRawLabels = labels;

  const dateLabels = labels.map(l => {
    const d = new Date(l);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  });

  const datasets = series.map(s => {
    const rgb = homeChartHexToRgb(s.color);
    return {
      label: s.nama,
      data: s.data,
      borderColor: s.color,
      backgroundColor: `rgba(${rgb}, 0.08)`,
      borderWidth: 2,
      tension: 0.4,
      pointRadius: 0,
      pointHoverRadius: 5,
      fill: true,
      _cabangId: s.cabangId,
      _closingData: s.closingData
    };
  });

  homeChartInstance = new Chart(canvas, {
    type: "line",
    data: { labels: dateLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false,
          external: homeChartTooltipHandler
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#8B7A69" } },
        y: {
          grid: { color: "rgba(138,98,52,0.08)" },
          ticks: {
            font: { size: 10 }, color: "#8B7A69",
            callback: (val) => val >= 1000000 ? (val / 1000000) + "jt" : val.toLocaleString("id-ID")
          }
        }
      }
    }
  });

  requestAnimationFrame(() => {
    homeChartInstance?.resize();
    homeChartTriggerReveal(canvas);
  });
}

function homeChartTriggerReveal(canvas) {
  canvas.classList.remove("home-chart-reveal");
  void canvas.offsetWidth;
  canvas.classList.add("home-chart-reveal");
}

async function homeChartRefresh(forceRefresh = false) {
  const periode = homeChartCurrentPeriode();
  const wrap = document.querySelector(".home-chart-canvas-wrap");

  let result;
  if (homeChartCache[periode] && !forceRefresh) {
    result = homeChartCache[periode];
  } else {
    if (wrap) wrap.innerHTML = `<div class="home-chart-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat grafik...</div>`;
    result = await homeChartLoadData(periode);
    homeChartCache[periode] = result;
    if (wrap && !wrap.querySelector("canvas")) {
      wrap.innerHTML = `<div class="home-chart-canvas-inner"><canvas id="homeChartCanvas"></canvas></div>`;
    }
  }

  if (!result.series.length) {
    if (wrap) wrap.innerHTML = `<div class="home-chart-empty">Belum ada data admin cabang aktif.</div>`;
    return;
  }

  homeChartLastResult = result;
  homeChartInitFilterPopup(result.series);
  homeChartUpdateFilterLabel(result.series);
  homeChartRebuildView();
}

window.initHomeChart = function () {
  homeChartSelectedSet = new Set();
  homeChartGabunganMode = false;
  homeChartRefresh();

  const reloadBtn = document.getElementById("homeChartReloadBtn");
  reloadBtn?.addEventListener("click", async () => {
    reloadBtn.classList.add("spinning");
    await homeChartRefresh(true);
    reloadBtn.classList.remove("spinning");
  });
};
