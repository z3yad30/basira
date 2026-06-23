const modal = document.getElementById('comingSoonModal');
const modalOkBtn = document.getElementById('modalOkBtn');
const modalText = document.getElementById('modalText');
const navTabs = document.querySelectorAll('.nav-tab');

const openModal = (text) => {
  if (modal) {
    if (text) modalText.textContent = text;
    modal.classList.add('open');
    modalOkBtn.focus();
  }
};

const closeModal = () => {
  if (modal) {
    modal.classList.remove('open');
  }
};

// Nav tabs coming soon
navTabs.forEach((tab) => {
  tab.addEventListener('click', (e) => {
    if (!tab.classList.contains('active')) {
      e.preventDefault();
      openModal('سيتم إطلاق هذه الصفحة قريباً.');
    }
  });
});

if (modalOkBtn) {
  modalOkBtn.addEventListener('click', closeModal);
}

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.classList.contains('open')) {
    closeModal();
  }
});

// ── Stock Search ──
const searchInput = document.querySelector('.search-input');
const searchResults = document.getElementById('searchResults');
let stocksData = [];

const fetchStocks = async () => {
  try {
    const response = await fetch('/server/egx_stocks.json');
    if (!response.ok) throw new Error('Failed to load stocks');
    stocksData = await response.json();
  } catch (err) {
    console.error('Error loading stocks:', err);
    stocksData = [];
  }
};

const filterStocks = (query) => {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return stocksData.filter(stock => {
    const ticker = (stock.ticker || '').toLowerCase();
    const code = (stock.code || '').toLowerCase();
    const name = (stock.name || '').toLowerCase();
    return ticker.includes(q) || code.includes(q) || name.includes(q);
  }).slice(0, 8);
};

const renderResults = (results) => {
  searchResults.innerHTML = '';
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="search-results-empty">لا توجد نتائج</div>';
    searchResults.classList.add('open');
    return;
  }

  results.forEach(stock => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.innerHTML = `
      <span class="result-name">${stock.name}</span>
      <span class="result-ticker">${stock.ticker}</span>
    `;
    item.addEventListener('click', () => {
      if (stock.code) {
        window.location.href = `/analysis/analysis.html?stock=${encodeURIComponent(stock.code)}&scenario=mean`;
      } else {
        openModal('سيتم إضافة صفحة التحليل لهذا السهم قريباً.');
      }
      searchResults.classList.remove('open');
      searchInput.value = '';
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });
    searchResults.appendChild(item);
  });

  searchResults.classList.add('open');
};

const hideResults = () => {
  searchResults.classList.remove('open');
};

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    if (query.trim().length === 0) {
      hideResults();
      return;
    }
    const results = filterStocks(query);
    renderResults(results);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideResults();
      searchInput.blur();
    }
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-bar-wrapper')) {
    hideResults();
  }
});

fetchStocks();

// ============================================
// Market Overview - Analyze Stock Data
// ============================================

let stocksByCategory = {
  up: [],
  down: [],
  neutral: [],
};

let currentModalStocks = [];
let currentModalCategory = '';

const analyzeMarketData = async () => {
  try {
    const res = await fetch('/server/up_down_stocks.json');
    if (!res.ok) throw new Error('Failed to load up/down stocks JSON');
    const data = await res.json();

    stocksByCategory = {
      up: data.up || [],
      down: data.down || [],
      neutral: data.neutral || [],
    };

    const upCount = stocksByCategory.up.length;
    const downCount = stocksByCategory.down.length;
    const neutralCount = stocksByCategory.neutral.length;

    document.getElementById('stocksUp').textContent = upCount;
    document.getElementById('stocksDown').textContent = downCount;
    document.getElementById('stocksNeutral').textContent = neutralCount;

    createMarketChart(upCount, downCount, neutralCount);
    await renderMetalsPriceChart();
    setupStockCardClickHandlers();
    renderTopMovers();
  } catch (err) {
    console.error('❌ Error analyzing market data:', err);
  }
};

const parseCsvText = (text) => {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const dateIdx = headers.indexOf('Date');
  const closeIdx = headers.indexOf('Close') !== -1 ? headers.indexOf('Close') : headers.indexOf('Adj Close');
  if (dateIdx === -1 || closeIdx === -1) return [];
  return lines.slice(1).map(line => {
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return { date: cols[dateIdx]?.replace(/"/g, '').trim(), close: parseFloat((cols[closeIdx] || '').replace(/"/g, '')) };
  }).filter(r => r.date && !isNaN(r.close));
};

const renderMetalsPriceChart = async () => {
  try {
    const [goldRes, silverRes, usdRes, brentRes, wtiRes] = await Promise.all([
      fetch('/stock_data/stock_data/Gold_COMEX.csv'),
      fetch('/stock_data/stock_data/Silver_COMEX.csv'),
      fetch('/stock_data/stock_data/USD_EGP_Exchange_Rate.csv'),
      fetch('/stock_data/stock_data/Brent_Crude_BZ.csv'),
      fetch('/stock_data/stock_data/WTI_Crude_CL.csv'),
    ]);
    if (!goldRes.ok || !silverRes.ok || !usdRes.ok || !brentRes.ok || !wtiRes.ok) return;

    const [goldText, silverText, usdText, brentText, wtiText] = await Promise.all([goldRes.text(), silverRes.text(), usdRes.text(), brentRes.text(), wtiRes.text()]);
    const goldData = parseCsvText(goldText);
    const silverData = parseCsvText(silverText);
    const usdData = parseCsvText(usdText);
    const brentData = parseCsvText(brentText);
    const wtiData = parseCsvText(wtiText);
    if (!goldData.length || !silverData.length || !usdData.length || !brentData.length || !wtiData.length) return;

    const goldMap = new Map(goldData.map(item => [item.date, item.close]));
    const silverMap = new Map(silverData.map(item => [item.date, item.close]));
    const usdMap = new Map(usdData.map(item => [item.date, item.close]));
    const brentMap = new Map(brentData.map(item => [item.date, item.close]));
    const wtiMap = new Map(wtiData.map(item => [item.date, item.close]));
    const dates = Array.from(new Set([
      ...goldData.map(i => i.date),
      ...silverData.map(i => i.date),
      ...usdData.map(i => i.date),
      ...brentData.map(i => i.date),
      ...wtiData.map(i => i.date),
    ])).sort();

    const goldSeries = dates.map(date => goldMap.get(date) ?? null);
    const silverSeries = dates.map(date => silverMap.get(date) ?? null);
    const usdSeries = dates.map(date => usdMap.get(date) ?? null);
    const brentSeries = dates.map(date => brentMap.get(date) ?? null);
    const wtiSeries = dates.map(date => wtiMap.get(date) ?? null);

    const ctx = document.getElementById('metalsChart');
    if (!ctx) return;
    if (window._basiraMetalsChart) window._basiraMetalsChart.destroy();

    window._basiraMetalsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          { label: 'Gold', data: goldSeries, borderColor: '#b8860b', backgroundColor: 'rgba(184,134,11,0.08)', tension: 0.2, spanGaps: true },
          { label: 'Silver', data: silverSeries, borderColor: '#9fa8a3', backgroundColor: 'rgba(159,168,163,0.08)', tension: 0.2, spanGaps: true },
          { label: 'USD/EGP', data: usdSeries, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.08)', tension: 0.2, spanGaps: true },
          { label: 'Brent (BZ)', data: brentSeries, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)', tension: 0.2, spanGaps: true },
          { label: 'WTI (CL)', data: wtiSeries, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.08)', tension: 0.2, spanGaps: true },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: { title: { display: true, text: 'التاريخ' } },
          y: { title: { display: true, text: 'السعر' } },
        },
      },
    });

    // Setup controls: time range and timezone
    const timeRangeSelect = document.getElementById('metalsTimeRange');
    const timeZoneSelect = document.getElementById('metalsTimeZone');

    const applyFilters = () => {
      const range = timeRangeSelect ? timeRangeSelect.value : '2m';
      const tz = timeZoneSelect ? timeZoneSelect.value : 'browser';

      // compute cutoff date
      const allDates = dates.map(d => new Date(d));
      const latest = new Date(Math.max.apply(null, allDates));
      let cutoff = new Date(latest);
      if (range === '2m') cutoff.setMonth(cutoff.getMonth() - 2);
      else if (range === '6m') cutoff.setMonth(cutoff.getMonth() - 6);
      else if (range === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);
      else if (range === '2y') cutoff.setFullYear(cutoff.getFullYear() - 2);
      else cutoff = new Date(Math.min.apply(null, allDates));

      // filter by cutoff
      const filteredIdx = dates.map((d, i) => ({ d: new Date(d), i })).filter(x => x.d >= cutoff).map(x => x.i);
      const filteredLabels = filteredIdx.map(i => dates[i]);
      const filteredGold = filteredIdx.map(i => goldSeries[i]);
      const filteredSilver = filteredIdx.map(i => silverSeries[i]);
      const filteredUsd = filteredIdx.map(i => usdSeries[i]);
      const filteredBrent = filteredIdx.map(i => brentSeries[i]);
      const filteredWti = filteredIdx.map(i => wtiSeries[i]);

      // timezone handling: convert labels display according to tz selection
      const formattedLabels = filteredLabels.map(l => {
        const d = new Date(l + 'T00:00:00Z');
        if (tz === 'browser' || !Intl || !Intl.DateTimeFormat) return d.toLocaleDateString();
        try {
          return new Intl.DateTimeFormat('ar-EG', { timeZone: tz, year: 'numeric', month: 'short', day: 'numeric' }).format(d);
        } catch (e) {
          return d.toLocaleDateString();
        }
      });

      // update chart
      if (window._basiraMetalsChart) {
        window._basiraMetalsChart.data.labels = formattedLabels;
        window._basiraMetalsChart.data.datasets[0].data = filteredGold;
        window._basiraMetalsChart.data.datasets[1].data = filteredSilver;
        window._basiraMetalsChart.data.datasets[2].data = filteredUsd;
        window._basiraMetalsChart.data.datasets[3].data = filteredBrent;
        window._basiraMetalsChart.data.datasets[4].data = filteredWti;
        window._basiraMetalsChart.update();
      }
    };

    if (timeRangeSelect) timeRangeSelect.addEventListener('change', applyFilters);
    if (timeZoneSelect) timeZoneSelect.addEventListener('change', applyFilters);

    // apply default filters on first render
    setTimeout(applyFilters, 0);
  } catch (err) {
    console.error('Error loading metals prices:', err);
  }
};

const setupStockCardClickHandlers = () => {
  const upCard = document.querySelector('.stat-card.stat-up');
  const downCard = document.querySelector('.stat-card.stat-down');
  const neutralCard = document.querySelector('.stat-card.stat-neutral');

  if (upCard) upCard.addEventListener('click', () => openStocksModal('up', 'أسهم صاعدة'));
  if (downCard) downCard.addEventListener('click', () => openStocksModal('down', 'أسهم هابطة'));
  if (neutralCard) neutralCard.addEventListener('click', () => openStocksModal('neutral', 'أسهم ثابتة'));
};

// ── Stocks List Modal ──
const stocksModalOverlay = document.createElement('div');
stocksModalOverlay.className = 'stocks-modal-overlay';
stocksModalOverlay.id = 'stocksModalOverlay';
stocksModalOverlay.setAttribute('role', 'dialog');
stocksModalOverlay.setAttribute('aria-modal', 'true');
stocksModalOverlay.setAttribute('aria-labelledby', 'stocksModalTitle');
stocksModalOverlay.innerHTML = `
  <div class="stocks-modal">
    <div class="stocks-modal-header">
      <h3 id="stocksModalTitle" class="stocks-modal-title">قائمة الأسهم</h3>
      <button class="stocks-modal-close" id="stocksModalClose" aria-label="إغلاق">✕</button>
    </div>
    <div class="stocks-modal-content">
      <div class="stocks-modal-search">
        <input id="stocksModalSearch" type="search" placeholder="ابحث ضمن هذه الفئة..." aria-label="بحث في الأسهم" autocomplete="off" />
      </div>
      <div class="stocks-list" id="stocksList"></div>
    </div>
  </div>
`;
document.body.appendChild(stocksModalOverlay);

const stocksModalSearch = document.getElementById('stocksModalSearch');
if (stocksModalSearch) {
  stocksModalSearch.addEventListener('input', (e) => {
    filterStocksModal(e.target.value);
  });

  stocksModalSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      filterStocksModal('');
      e.target.blur();
    }
  });
}

const renderStocksModalList = (stocks, category) => {
  const list = document.getElementById('stocksList');
  if (!list) return;

  list.innerHTML = '';

  if (stocks.length === 0) {
    list.innerHTML = '<div class="stocks-list-empty">لا توجد نتائج</div>';
    return;
  }

  stocks.forEach(stock => {
    const item = document.createElement('div');
    item.className = `stock-item ${category}`;
    item.innerHTML = `
      <div class="stock-item-info">
        <div class="stock-item-name">${stock.name}</div>
        <div class="stock-item-ticker">${stock.ticker}</div>
      </div>
      <div class="stock-item-badge">${stock.changePercent}%</div>
    `;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (stock.code) {
        window.location.href = `/analysis/analysis.html?stock=${encodeURIComponent(stock.code)}&scenario=mean`;
      } else {
        openModal('سيتم إضافة صفحة التحليل لهذا السهم قريباً.');
      }
    });
    list.appendChild(item);
  });
};

const filterStocksModal = (query) => {
  const normalized = (query || '').trim().toLowerCase();
  const filtered = normalized
    ? currentModalStocks.filter(stock => {
        const ticker = (stock.ticker || '').toLowerCase();
        const name = (stock.name || '').toLowerCase();
        const code = (stock.code || '').toLowerCase();
        return ticker.includes(normalized) || name.includes(normalized) || code.includes(normalized);
      })
    : currentModalStocks;
  renderStocksModalList(filtered, currentModalCategory);
};

const openStocksModal = (category, categoryName) => {
  const title = document.getElementById('stocksModalTitle');
  const searchInput = document.getElementById('stocksModalSearch');

  currentModalCategory = category;
  currentModalStocks = [...(stocksByCategory[category] || [])];
  currentModalStocks.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  title.textContent = categoryName;

  if (searchInput) {
    searchInput.value = '';
    searchInput.placeholder = 'ابحث ضمن هذه الفئة...';
  }

  filterStocksModal('');
  stocksModalOverlay.classList.add('open');
  if (searchInput) searchInput.focus();
};

const closeStocksModal = () => {
  stocksModalOverlay.classList.remove('open');
};

// Stocks modal close handlers
const stocksModalClose = document.getElementById('stocksModalClose');
if (stocksModalClose) {
  stocksModalClose.addEventListener('click', closeStocksModal);
}

stocksModalOverlay.addEventListener('click', (e) => {
  if (e.target === stocksModalOverlay) {
    closeStocksModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stocksModalOverlay.classList.contains('open')) {
    closeStocksModal();
  }
});

const createMarketChart = (upCount, downCount, neutralCount) => {
  const ctx = document.getElementById('marketChart');
  if (!ctx) return;

  const total = upCount + downCount + neutralCount;
  const upPercent = ((upCount / total) * 100).toFixed(1);
  const downPercent = ((downCount / total) * 100).toFixed(1);
  const neutralPercent = ((neutralCount / total) * 100).toFixed(1);

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [
        `أسهم صاعدة (${upPercent}%)`,
        `أسهم هابطة (${downPercent}%)`,
        `أسهم ثابتة (${neutralPercent}%)`,
      ],
      datasets: [
        {
          data: [upCount, downCount, neutralCount],
          backgroundColor: [
            'rgba(16, 185, 129, 0.7)',
            'rgba(239, 68, 68, 0.7)',
            'rgba(100, 116, 139, 0.7)',
          ],
          borderColor: [
            'rgba(16, 185, 129, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(100, 116, 139, 1)',
          ],
          borderWidth: 2,
          borderRadius: 8,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#ede6dd',
            font: {
              family: "'Tajawal', sans-serif",
              size: 14,
              weight: '600',
            },
            padding: 20,
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleColor: '#f7e8c4',
          bodyColor: '#ede6dd',
          borderColor: 'rgba(217, 180, 113, 0.5)',
          borderWidth: 1,
          padding: 12,
          titleFont: {
            family: "'Tajawal', sans-serif",
            size: 14,
            weight: 'bold',
          },
          bodyFont: {
            family: "'Tajawal', sans-serif",
            size: 13,
          },
          callbacks: {
            label: function (context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              const percent = ((value / total) * 100).toFixed(1);
              return `${label}: ${value} سهم (${percent}%)`;
            },
          },
        },
      },
    },
  });
};

// ============================================
// Top Movers Section — NEW LEADERBOARD DESIGN
// ============================================

let currentMoversTab = 'gainers';

const renderTopMovers = () => {
  const list = document.getElementById('topMoversList');
  if (!list) return;

  // Get data based on active tab
  let stocks = [];
  let type = '';

  if (currentMoversTab === 'gainers') {
    stocks = [...stocksByCategory.up]
      .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent))
      .slice(0, 5);
    type = 'gainer';
  } else {
    stocks = [...stocksByCategory.down]
      .sort((a, b) => parseFloat(a.changePercent) - parseFloat(b.changePercent))
      .slice(0, 5);
    type = 'loser';
  }

  list.innerHTML = '';

  if (stocks.length === 0) {
    list.innerHTML = '<div class="top-movers-empty">لا توجد أسهم في هذه الفئة</div>';
    return;
  }

  // Find max absolute change for spark bar scaling
  const maxChange = Math.max(...stocks.map(s => Math.abs(parseFloat(s.changePercent))));

  stocks.forEach((stock, index) => {
    const row = document.createElement('div');
    row.className = `mover-row ${type}`;
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    const absPercent = Math.abs(parseFloat(stock.changePercent));
    const sparkWidth = maxChange > 0 ? (absPercent / maxChange) * 100 : 0;
    const sign = type === 'gainer' ? '+' : '';

    row.innerHTML = `
      <div class="mover-rank">#${index + 1}</div>
      <div class="mover-stock-info">
        <div class="mover-name">${stock.name}</div>
        <div class="mover-ticker">${stock.ticker}</div>
      </div>
      <div class="mover-change">EGP ${stock.change.toFixed(2)}</div>
      <div class="mover-percent">${sign}${stock.changePercent}%</div>
      <div class="mover-spark">
        <div class="spark-bar">
          <div class="spark-fill" style="width: ${sparkWidth}%"></div>
        </div>
      </div>
    `;

    row.addEventListener('click', () => {
      if (stock.code) {
        window.location.href = `/analysis/analysis.html?stock=${encodeURIComponent(stock.code)}&scenario=mean`;
      } else {
        openModal('سيتم إضافة صفحة التحليل لهذا السهم قريباً.');
      }
    });

    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        row.click();
      }
    });

    list.appendChild(row);
  });
};

// Tab switching
const setupMoversTabs = () => {
  const tabs = document.querySelectorAll('.movers-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      currentMoversTab = tab.dataset.tab;
      renderTopMovers();
    });
  });
};

setupMoversTabs();

// Analyze market data on page load
analyzeMarketData();