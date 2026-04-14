// static/script.js — SpendAI Premium Frontend

const state = {
  expenses: [],
  summary:  {},
  filter:   { category: "All", month: "" },
};

const CATEGORY_COLORS = {
  Food:      "#f0a04a",
  Transport: "#5b9cf6",
  Shopping:  "#b07ef8",
  Bills:     "#f26a6a",
  Other:     "#7a8090",
};

let pieChart = null;
const categories = window.categories || [];

// ── Utilities ──
const $  = id => document.getElementById(id);
const qs = s  => document.querySelector(s);

function fmt(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2
  }).format(n);
}

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function toast(msg, type = "ok") {
  $("toast-msg").textContent = msg;
  const el = $("toast");
  el.className = "show" + (type === "error" ? " error" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = ""; }, 3400);
}

function setLoading(on) {
  const btn = $("add-btn");
  if (!btn) return;
  btn.disabled = on;
  btn.textContent = on ? "Classifying…" : "Add & Classify";
}

// ── Clock ──
function updateClock() {
  const now = new Date();
  $("current-date").textContent = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  $("current-time").textContent = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── API ──
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Load ──
async function loadExpenses() {
  const params = new URLSearchParams();
  if (state.filter.category !== "All") params.set("category", state.filter.category);
  if (state.filter.month)             params.set("month", state.filter.month);
  const data = await api(`/api/expenses?${params}`);
  state.expenses = data.expenses;
  renderTable();
}

async function loadSummary() {
  const params = new URLSearchParams();
  if (state.filter.month) params.set("month", state.filter.month);
  const data = await api(`/api/summary?${params}`);
  state.summary = data;
  renderStats();
  renderCategorySummary();
  renderChart();
  renderMonthlyTable();
}

// ── Render: table ──
function renderTable() {
  const tbody = $("expense-tbody");
  const countBadge = $("count-badge");
  if (!tbody) return;
  if (countBadge) countBadge.textContent = `${state.expenses.length} entr${state.expenses.length === 1 ? "y" : "ies"}`;

  if (!state.expenses.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty">
      <div class="empty-icon">◈</div>
      <p>No expenses found. Add your first one above.</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = state.expenses.map((e, i) => {
    const conf = Math.round(e.confidence * 100);
    return `
      <tr style="animation-delay:${i * 0.04}s">
        <td>${fmtDate(e.date)}</td>
        <td><span class="desc-text">${escHtml(e.description)}</span></td>
        <td><span class="cat cat-${e.category}"><span class="cat-dot"></span>${e.category}</span></td>
        <td><span class="amount-cell">${fmt(e.amount)}</span></td>
        <td>
          <div class="conf">
            <div class="conf-bar"><div class="conf-fill" style="width:${conf}%"></div></div>
            <span class="conf-num">${conf}%</span>
          </div>
        </td>
        <td><button class="btn-del" onclick="deleteExpense(${e.id})" title="Delete">✕</button></td>
      </tr>`;
  }).join("");
}

// ── Render: stats ──
function renderStats() {
  const statTotal = $("stat-total");
  if (!statTotal) return;

  const s = state.summary;
  statTotal.textContent = fmt(s.total || 0);

  const statCount = $("stat-count");
  if (statCount) statCount.textContent = state.expenses.length;

  const top = (s.by_category || [])[0];
  const statTopCat = $("stat-top-cat");
  if (statTopCat) statTopCat.textContent = top ? top.category : "—";

  const statTopAmt = $("stat-top-amt");
  if (statTopAmt) statTopAmt.textContent = top ? fmt(top.total) : "";

  const statPeriod = $("stat-period");
  if (statPeriod) {
    if (state.filter.month) {
      const [y, m] = state.filter.month.split("-");
      const label = new Date(+y, +m - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
      statPeriod.textContent = label;
    } else {
      statPeriod.textContent = "all time";
    }
  }
}

// ── Render: category bars ──
function renderCategorySummary() {
  const el = $("cat-summary");
  if (!el) return;

  const cats  = state.summary.by_category || [];
  const total = state.summary.total || 1;

  if (!cats.length) {
    el.innerHTML = `<div class="empty" style="padding:16px 0"><p>No data yet</p></div>`;
    return;
  }

  el.innerHTML = cats.map(c => {
    const pct   = Math.round((c.total / total) * 100);
    const color = CATEGORY_COLORS[c.category] || "#7a8090";
    return `
      <div class="cat-row">
        <div class="cat-row-label">
          <span class="cat-row-name">${c.category} <span style="color:var(--text-3);font-size:11px">(${c.count})</span></span>
          <span class="cat-row-amount">${fmt(c.total)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="cat-pct">${pct}%</div>
      </div>`;
  }).join("");
}

// ── Render: pie chart ──
function renderChart() {
  const pie = $("pie-chart");
  if (!pie) return;

  const cats = state.summary.by_category || [];
  const ctx  = pie.getContext("2d");
  if (pieChart) { pieChart.destroy(); pieChart = null; }
  if (!cats.length) return;

  pieChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels:   cats.map(c => c.category),
      datasets: [{
        data:            cats.map(c => c.total),
        backgroundColor: cats.map(c => CATEGORY_COLORS[c.category] + "cc"),
        borderColor:     cats.map(c => CATEGORY_COLORS[c.category]),
        borderWidth: 1.5,
        hoverOffset: 8,
      }],
    },
    options: {
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 10, boxHeight: 10,
            padding: 16,
            font: { size: 12, family: "'DM Sans'" },
            color: "#a09c90",
            usePointStyle: true,
          },
        },
        tooltip: {
          backgroundColor: "#13141d",
          borderColor: "rgba(255,255,255,.1)",
          borderWidth: 1,
          titleColor: "#f0eee8",
          bodyColor: "#a09c90",
          padding: 12,
          callbacks: {
            label: ctx => ` ${fmt(ctx.raw)}  (${Math.round(ctx.raw / (state.summary.total || 1) * 100)}%)`,
          },
        },
      },
    },
  });
}

// ── Render: monthly ──
function renderMonthlyTable() {
  const el = $("monthly-tbody");
  if (!el) return;

  const monthly = state.summary.monthly || [];
  if (!monthly.length) {
    el.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-3);padding:24px;font-size:13px">No history yet</td></tr>`;
    return;
  }
  el.innerHTML = monthly.map(m => `
    <tr class="monthly-row">
      <td style="font-family:var(--font-mono);font-size:11.5px">${m.month}</td>
      <td>${m.count}</td>
      <td><span style="font-family:var(--font-display);font-size:15px;color:var(--text-1)">${fmt(m.total)}</span></td>
    </tr>`).join("");
}

function renderMonthlyView() {
  const cardsContainer = $("monthly-cards");
  const yearSelector = $("year-selector");
  if (!cardsContainer || !yearSelector) return;

  const year = yearSelector.value;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthlyMap = (state.summary.monthly || []).reduce((acc, item) => {
    if (item.month.startsWith(`${year}-`)) {
      acc[item.month.slice(5)] = item;
    }
    return acc;
  }, {});

  cardsContainer.innerHTML = months.map((month, index) => {
    const key = String(index + 1).padStart(2, '0');
    const data = monthlyMap[key] || { total: 0, count: 0 };
    return `
      <div class="stat-card">
        <div class="stat-label">${month} ${year}</div>
        <div class="stat-value">${fmt(data.total)}</div>
        <div class="stat-sub">${data.count} transactions</div>
        <div class="stat-icon">📅</div>
      </div>`;
  }).join("");
}

function renderPageDetails() {
  if ($("ai-summary")) {
    generateInsights();
  }
  if ($("monthly-cards")) {
    renderMonthlyView();
  }
}

function generateInsights() {
  const summaryEl = $("ai-summary");
  if (!summaryEl) return;

  const total = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  const average = state.expenses.length ? total / state.expenses.length : 0;

  const totalsByCategory = state.expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {});

  const topCategory = Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
  const topCatName = topCategory[0] || "—";
  const topAmount = topCategory[1] || 0;

  summaryEl.innerHTML = `
    <p>📊 <strong>Spending Overview:</strong> ${state.expenses.length} transactions totaling <strong style="color: var(--accent-gold);">${fmt(total)}</strong>.</p>
    <p>🧠 <strong>Average Expense:</strong> ${fmt(average)}</p>
    <p>🏆 <strong>Top Category:</strong> ${escHtml(topCatName)} at ${fmt(topAmount)}.</p>
  `;

  generateSpendingPatterns();
  generateAnomalies();
  generateSavings();
  generatePredictions();
}

function generateSpendingPatterns() {
  const patterns = $("spending-patterns");
  if (!patterns) return;
  patterns.innerHTML = '';

  const weekdayTotals = {
    Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
  };

  state.expenses.forEach(exp => {
    const date = new Date(exp.date);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    weekdayTotals[weekday] += exp.amount;
  });

  const maxDay = Object.entries(weekdayTotals).reduce((a, b) => a[1] > b[1] ? a : b);

  patterns.innerHTML += `
    <div style="padding: 12px; background: var(--bg-elevated); border-radius: 12px; margin-bottom: 12px; border-left: 3px solid var(--accent-gold);">
      <div style="font-weight: 600;">📅 Highest Spending Day</div>
      <div>You spend the most on <strong>${maxDay[0]}</strong> with ₹${maxDay[1].toFixed(2)}</div>
    </div>`;

  const descCount = {};
  state.expenses.forEach(exp => {
    const key = exp.description.toLowerCase();
    descCount[key] = (descCount[key] || 0) + 1;
  });

  const recurring = Object.entries(descCount).filter(([_, count]) => count >= 3);
  if (recurring.length > 0) {
    patterns.innerHTML += `
      <div style="padding: 12px; background: var(--bg-elevated); border-radius: 12px;">
        <div style="font-weight: 600;">🔄 Recurring Expenses Detected</div>
        <div>${recurring.slice(0,3).map(([desc]) => `• ${desc}`).join('<br>')}</div>
      </div>`;
  }
}

function generateAnomalies() {
  const anomalies = $("anomalies");
  if (!anomalies) return;
  anomalies.innerHTML = '';

  const avgByCategory = {};
  categories.forEach(cat => {
    const catExpenses = state.expenses.filter(e => e.category === cat);
    if (catExpenses.length > 0) {
      avgByCategory[cat] = catExpenses.reduce((s, e) => s + e.amount, 0) / catExpenses.length;
    }
  });

  const anomaliesList = [];
  state.expenses.forEach(exp => {
    const avg = avgByCategory[exp.category];
    if (avg && exp.amount > avg * 2) {
      anomaliesList.push(exp);
    }
  });

  if (anomaliesList.length > 0) {
    anomaliesList.slice(0, 3).forEach(exp => {
      anomalies.innerHTML += `
        <div style="padding: 12px; background: var(--bg-elevated); border-radius: 12px; margin-bottom: 12px; border-left: 3px solid #FF7A6E;">
          <div style="font-weight: 600;">⚠️ Unusually high ${exp.category} expense</div>
          <div>₹${exp.amount.toFixed(2)} on ${exp.date} for "${exp.description}"</div>
        </div>`;
    });
  } else {
    anomalies.innerHTML = '<div style="text-align: center; color: var(--text-muted);">No anomalies detected ✅</div>';
  }
}

function generateSavings() {
  const savings = $("savings");
  if (!savings) return;
  savings.innerHTML = '';

  const categoryTotals = {};
  state.expenses.forEach(e => categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount);

  const suggestions = [];
  if (categoryTotals['Food'] > 5000) suggestions.push('🍜 Consider meal prepping to reduce food expenses by up to 30%');
  if (categoryTotals['Shopping'] > 8000) suggestions.push('🛍️ Wait 48 hours before non-essential purchases to avoid impulse buying');
  if (categoryTotals['Transport'] > 4000) suggestions.push('🚕 Try public transport or carpooling to cut transport costs');
  if (suggestions.length === 0) suggestions.push('✅ Your spending looks balanced. Keep tracking to improve savings.');

  savings.innerHTML = suggestions.map(s => `<div style="margin-bottom: 12px;">• ${s}</div>`).join("");
}

function generatePredictions() {
  const el = $("predictions");
  if (!el) return;

  const totals = state.expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {});

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    el.innerHTML = '<div class="empty">Add expenses to see predictions.</div>';
    return;
  }

  const suggestions = [];
  if (totals.Food > 5000) suggestions.push('🍜 Consider reducing takeout or cooking more meals at home.');
  if (totals.Shopping > 8000) suggestions.push('🛍️ Pause non-essential shopping for a week to save instantly.');
  if (totals.Transport > 4000) suggestions.push('🚕 Explore public transit or ride-share pooling to cut costs.');
  if (suggestions.length === 0) suggestions.push('✅ Your spending looks balanced. Keep tracking to improve savings.');

  el.innerHTML = suggestions.map(s => `<div style="margin-bottom: 12px;">• ${s}</div>`).join("");
}

// ── Add expense ──
async function handleAddExpense(e) {
  e.preventDefault();
  const desc = $("inp-desc").value.trim();
  const amt  = parseFloat($("inp-amount").value);
  const date = $("inp-date").value;
  if (!desc || !amt || !date) { toast("Please fill all fields", "error"); return; }

  setLoading(true);
  try {
    const res = await api("/api/expenses", {
      method: "POST",
      body: JSON.stringify({ description: desc, amount: amt, date }),
    });

    $("inp-desc").value   = "";
    $("inp-amount").value = "";

    const ai = res.ai;
    const conf = Math.round(ai.confidence * 100);

    $("ai-result").innerHTML = `
      <div class="ai-result-wrap">
        <div class="ai-dot"></div>
        <div>
          AI classified as <span class="ai-cat-name">${escHtml(ai.category)}</span>
          — ${conf}% confidence
          ${ai.matched_keyword ? `· matched <em style="color:var(--text-3)">${escHtml(ai.matched_keyword)}</em>` : ""}
        </div>
      </div>`;

    toast(`✓ ${escHtml(ai.category)} · ${conf}% confidence`);
    await Promise.all([loadExpenses(), loadSummary()]);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    setLoading(false);
  }
  renderPageDetails();
}

// ── Delete ──
async function deleteExpense(id) {
  if (!confirm("Remove this expense?")) return;
  try {
    await api(`/api/expenses/${id}`, { method: "DELETE" });
    toast("Removed");
    await Promise.all([loadExpenses(), loadSummary()]);
  } catch (err) {
    toast(err.message, "error");
  }
}

// ── Filters ──
function applyFilters() {
  const filterCat = $("filter-cat");
  const filterMonth = $("filter-month");
  if (filterCat) state.filter.category = filterCat.value;
  if (filterMonth) state.filter.month = filterMonth.value;
  loadExpenses();
  loadSummary();
}

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  const inpDate = $("inp-date");
  if (inpDate) inpDate.value = new Date().toISOString().split("T")[0];

  const filterMonth = $("filter-month");
  if (filterMonth) {
    filterMonth.value = new Date().toISOString().slice(0, 7);
    state.filter.month = filterMonth.value;
    filterMonth.addEventListener("change", applyFilters);
  }

  const expenseForm = $("expense-form");
  if (expenseForm) expenseForm.addEventListener("submit", handleAddExpense);

  const filterCat = $("filter-cat");
  if (filterCat) filterCat.addEventListener("change", applyFilters);

  const yearSelector = $("year-selector");
  if (yearSelector) {
    const currentYear = String(new Date().getFullYear());
    if (!Array.from(yearSelector.options).some(o => o.value === currentYear)) {
      const option = document.createElement("option");
      option.value = currentYear;
      option.textContent = currentYear;
      yearSelector.appendChild(option);
    }
    yearSelector.value = currentYear;
    yearSelector.addEventListener("change", renderPageDetails);
  }

  const refreshInsights = $("refresh-insights");
  if (refreshInsights) {
    refreshInsights.addEventListener("click", () => {
      Promise.all([loadExpenses(), loadSummary()]).then(() => {
        renderPageDetails();
        toast("AI insights refreshed!");
      });
    });
  }

  const refreshYear = $("refresh-year");
  if (refreshYear) {
    refreshYear.addEventListener("click", () => {
      Promise.all([loadExpenses(), loadSummary()]).then(() => {
        renderPageDetails();
        toast("Monthly data updated for " + $("year-selector").value);
      });
    });
  }

  updateClock();
  setInterval(updateClock, 60000);

  Promise.all([loadExpenses(), loadSummary()]).then(renderPageDetails);
});
