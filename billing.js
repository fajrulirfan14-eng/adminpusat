let billingDataCache = null;

// Kuota gratis Firebase Blaze plan (cek ulang di firebase.google.com/pricing kalau Firebase update angkanya)
const FREE_QUOTA = {
  firestoreReadsPerDay:    50000,
  firestoreWritesPerDay:   20000,
  firestoreDeletesPerDay:  20000,
  storageGB:               5,
  functionsInvocationsPerMonth: 2000000, // ⚠️ belum keliatan di screenshot, cek ulang manual
};

window.initBillingView = function() {
  loadBillingData();
  document.getElementById("billingRefreshBtn")?.addEventListener("click", () => {
    billingDataCache = null;
    loadBillingData();
  });
};

async function loadBillingData() {
  const container = document.getElementById("billingContent");
  if (!container) return;

  if (billingDataCache) {
    renderBillingContent(billingDataCache);
    return;
  }

  container.innerHTML = `<div class="billing-loading"><i class="fa-solid fa-spinner fa-spin"></i> Memuat data...</div>`;

  const [billingRes, usageRes] = await Promise.allSettled([
    window.callFunction("getBillingSummary"),
    window.callFunction("getUsageStats"),
  ]);

  const billing    = billingRes.status === "fulfilled" ? billingRes.value.data : null;
  const billingErr = billingRes.status === "rejected"  ? billingRes.reason     : null;
  const usage       = usageRes.status === "fulfilled" ? usageRes.value.data : null;
  const usageErr    = usageRes.status === "rejected"  ? usageRes.reason     : null;

  billingDataCache = { billing, billingErr, usage, usageErr };
  renderBillingContent(billingDataCache);

  const lastUpdatedEl = document.getElementById("billingLastUpdated");
  if (lastUpdatedEl) {
    const jam = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    lastUpdatedEl.textContent = `Terakhir diperbarui: ${jam}`;
  }
}

function renderBillingContent({ billing, billingErr, usage, usageErr }) {
  const container = document.getElementById("billingContent");
  if (!container) return;

  const billingHtml = billingErr
    ? `<div class="billing-error"><i class="fa-solid fa-triangle-exclamation"></i> ${billingErr.message || "Gagal memuat data billing."}</div>`
    : `
      <div class="billing-total-card">
        <div class="billing-total-label">Total Bulan Ini</div>
        <div class="billing-total-value">${billing.currency} ${billing.total.toFixed(4)}</div>
        <div class="billing-total-periode">${billing.periode}</div>
      </div>
      <div class="billing-service-list">
        ${billing.perService.length ? billing.perService.map(s => `
          <div class="billing-service-row">
            <span class="billing-service-name">${s.service}</span>
            <span class="billing-service-cost">${s.currency} ${s.cost.toFixed(4)}</span>
          </div>
        `).join("") : `<div class="billing-empty">Belum ada biaya tercatat bulan ini.</div>`}
      </div>
    `;

  const usageHtml = usageErr
    ? `<div class="billing-error"><i class="fa-solid fa-triangle-exclamation"></i> ${usageErr.message || "Gagal memuat data usage."}</div>`
    : `
      <div class="billing-usage-grid">
        <div class="billing-usage-card">
          <div class="billing-usage-icon"><i class="fa-solid fa-database"></i></div>
          <div class="billing-usage-value">${usage.firestore.reads.toLocaleString("id-ID")}</div>
          <div class="billing-usage-label">Firestore Reads</div>
        </div>
        <div class="billing-usage-card">
          <div class="billing-usage-icon"><i class="fa-solid fa-pen"></i></div>
          <div class="billing-usage-value">${usage.firestore.writes.toLocaleString("id-ID")}</div>
          <div class="billing-usage-label">Firestore Writes</div>
        </div>
        <div class="billing-usage-card">
          <div class="billing-usage-icon"><i class="fa-solid fa-trash"></i></div>
          <div class="billing-usage-value">${usage.firestore.deletes.toLocaleString("id-ID")}</div>
          <div class="billing-usage-label">Firestore Deletes</div>
        </div>
        <div class="billing-usage-card">
          <div class="billing-usage-icon"><i class="fa-solid fa-box-archive"></i></div>
          <div class="billing-usage-value">${usage.storage.totalGB} GB</div>
          <div class="billing-usage-label">Storage Terpakai</div>
        </div>
        <div class="billing-usage-card">
          <div class="billing-usage-icon"><i class="fa-solid fa-bolt"></i></div>
          <div class="billing-usage-value">${usage.functions.invocations.toLocaleString("id-ID")}</div>
          <div class="billing-usage-label">Functions Invocations</div>
        </div>
      </div>
      <div class="billing-usage-periode">${usage.periode}</div>
    `;

  const quotaHtml = usageErr ? "" : renderQuotaSection(usage);

  container.innerHTML = `
    <div class="billing-section">
      <div class="billing-section-title"><i class="fa-solid fa-wallet"></i> Billing</div>
      ${billingHtml}
    </div>
    <div class="billing-section">
      <div class="billing-section-title"><i class="fa-solid fa-chart-column"></i> Usage (30 Hari Terakhir)</div>
      ${usageHtml}
    </div>
    ${quotaHtml}
  `;
}

function renderQuotaSection(usage) {
  const readsPerDay   = (Number(usage.firestore?.reads)   || 0) / 30;
  const writesPerDay  = (Number(usage.firestore?.writes)  || 0) / 30;
  const deletesPerDay = (Number(usage.firestore?.deletes) || 0) / 30;

  const items = [
    {
      label: "Firestore Reads",
      sub: "rata-rata/hari, kuota gratis per hari",
      value: readsPerDay,
      quota: FREE_QUOTA.firestoreReadsPerDay,
      fmt: v => Math.round(v).toLocaleString("id-ID"),
    },
    {
      label: "Firestore Writes",
      sub: "rata-rata/hari, kuota gratis per hari",
      value: writesPerDay,
      quota: FREE_QUOTA.firestoreWritesPerDay,
      fmt: v => Math.round(v).toLocaleString("id-ID"),
    },
    {
      label: "Firestore Deletes",
      sub: "rata-rata/hari, kuota gratis per hari",
      value: deletesPerDay,
      quota: FREE_QUOTA.firestoreDeletesPerDay,
      fmt: v => Math.round(v).toLocaleString("id-ID"),
    },
    {
      label: "Storage Terpakai",
      sub: "total tersimpan, kuota gratis total",
      value: Number(usage.storage?.totalGB) || 0,
      quota: FREE_QUOTA.storageGB,
      fmt: v => `${Number(v).toFixed(2)} GB`,
    },
    {
      label: "Functions Invocations",
      sub: "30 hari terakhir, kuota gratis per bulan",
      value: Number(usage.functions?.invocations) || 0,
      quota: FREE_QUOTA.functionsInvocationsPerMonth,
      fmt: v => Math.round(Number(v)).toLocaleString("id-ID"),
    },
  ];

  const rows = items.map(it => {
    const pct = Math.min(100, (it.value / it.quota) * 100);
    const over = it.value > it.quota;
    const statusClass = over ? "over" : pct >= 80 ? "warn" : "safe";
    return `
      <div class="billing-quota-row">
        <div class="billing-quota-top">
          <span class="billing-quota-label">${it.label}</span>
          <span class="billing-quota-value ${statusClass}">${it.fmt(it.value)} / ${it.fmt(it.quota)}</span>
        </div>
        <div class="billing-quota-bar-track">
          <div class="billing-quota-bar-fill ${statusClass}" style="width:${pct}%"></div>
        </div>
        <div class="billing-quota-sub">
          ${over ? "Sudah melewati kuota gratis — mulai dikenakan biaya" : `${it.sub} • sisa ${(100 - pct).toFixed(0)}%`}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="billing-section">
      <div class="billing-section-title"><i class="fa-solid fa-gauge-high"></i> Estimasi Kuota Gratis</div>
      <div class="billing-quota-list">${rows}</div>
      <div class="billing-quota-footnote">
        Kuota gratis Firebase Blaze plan, per Januari 2026. Bisa berubah — cek halaman pricing resmi Firebase untuk angka terbaru.
      </div>
    </div>
  `;
}
