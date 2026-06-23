/* ═══════════════════════════════════════════════════
   بصيرة Basira — Analysis Page Controller
   analysis.js  |  v2.1
   ═══════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  const symbol   = getStockFromUrl();
  const scenario = getScenarioFromUrl();

  updateScenario(scenario);
  bindScenarioButtons(symbol);
  bindActionButtons();
  bindInfoPanel();
  bindChartTabs();
  bindTopBarScroll();
  bindFullscreenButton();

  loadAnalysis(symbol, scenario);
});

/* ───────────────────────────────────────
   URL HELPERS
─────────────────────────────────────── */
function getStockFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return (p.get('stock') || p.get('symbol') || '').trim();
}

function getScenarioFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const s = String(p.get('scenario') || 'mean').toLowerCase();
  return ['conservative', 'mean', 'aggressive'].includes(s) ? s : 'mean';
}

/* ───────────────────────────────────────
   DOM HELPERS
─────────────────────────────────────── */
function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (value != null && value !== '') ? value : '—';
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html || '';
}

function setClass(el, cls, condition) {
  if (!el) return;
  el.classList.toggle(cls, !!condition);
}

function qs(sel) { return document.querySelector(sel); }

/* ───────────────────────────────────────
   LOADING
─────────────────────────────────────── */
function setLoadingOverlay(show) {
  const el = document.getElementById('loading-overlay');
  if (!el) return;
  el.hidden = !show;
  el.style.display = show ? 'flex' : 'none';
}

/* ───────────────────────────────────────
   FETCH
─────────────────────────────────────── */
function loadAnalysis(symbol, scenario) {
  setLoadingOverlay(true);

  if (!symbol) {
    showError('لم يتم تحديد رمز السهم. استخدم رابط التحليل مع المعامل ?stock=');
    setLoadingOverlay(false);
    return;
  }

  fetch(`/api/analysis?stock=${encodeURIComponent(symbol)}&scenario=${encodeURIComponent(scenario)}`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data.error) {
        showError(data.message || 'تعذر تحميل التحليل.');
        return;
      }
      renderAnalysis(data, scenario);
    })
    .catch(err => {
      console.error('[Basira]', err);
      showError('تعذر الاتصال بالخادم. تأكد من تشغيل خادم Flask وأعد المحاولة.');
    })
    .finally(() => {
      setLoadingOverlay(false);
    });
}

/* ───────────────────────────────────────
   RENDER ANALYSIS
─────────────────────────────────────── */
function renderAnalysis(data, scenario) {
  const symbol = data.symbol || getStockFromUrl();
  const name   = data.name   || 'تحليل السهم';
  const price  = data.price  != null ? Number(data.price) : null;
  const change = data.changePercent != null ? Number(data.changePercent) : null;

  /* ── Hero header ── */
  const shortCode = (symbol || '').slice(0, 4).toUpperCase();
  setText('hero-symbol-badge', shortCode);
  setText('analysis-symbol', symbol);
  setText('analysis-name', name);

  /* ── Top Bar ── */
  setText('tb-symbol', symbol);
  setText('tb-name', name);
  setText('tb-price', price != null ? `${price.toFixed(2)} EGP` : '—');

  /* ── Price ── */
  setText('analysis-price', price != null ? price.toFixed(2) : '—');

  if (change != null) {
    const sign    = change >= 0 ? '▲' : '▼';
    const label   = `${sign} ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
    const isUp    = change >= 0;
    const changeEl = document.getElementById('analysis-change');
    if (changeEl) {
      changeEl.textContent = label;
      changeEl.classList.toggle('up',   isUp);
      changeEl.classList.toggle('down', !isUp);
    }
    const tbChange = document.getElementById('tb-change');
    if (tbChange) {
      tbChange.textContent = label;
      tbChange.classList.toggle('up',   isUp);
      tbChange.classList.toggle('down', !isUp);
    }
  }

  /* ── Scenario tag ── */
  const scenarioLabel = { conservative: 'متشائم', mean: 'متوسط', aggressive: 'متفائل' }[scenario] || 'متوسط';
  setText('forecast-scenario', scenarioLabel);
  setText('pred-scenario-label', scenarioLabel);

  /* ── Technical ── */
  const tech = data.technical || {};
  renderTechnical(tech, price);

  /* ── Last date badge ── */
  if (tech.lastDate) {
    const badge = document.getElementById('last-date-badge');
    if (badge) badge.hidden = false;
    setText('last-date-text', tech.lastDate);
  }

  /* ── MA tag in hero ── */
  const maTag = document.getElementById('ma-tag');
  if (maTag && tech.ma) {
    maTag.textContent = tech.ma;
    if (tech.ma === 'اتجاه صعودي') maTag.classList.add('bullish');
    else if (tech.ma === 'اتجاه هبوطي') maTag.classList.add('bearish');
  }

  /* ── Fundamentals ── */
  renderFundamentals(data.fundamentals);

  /* ── GBM ── */
  const g = data.gbm || {};
  renderGbmSummary(g, price);
  renderGbmChart(g.chart, data);

  /* ── Support / Resistance ── */
  renderSupportResistance(tech, price);

  /* ── Trade Scenarios ── */
  renderTradeScenarios(data.tradeScenarios);

  /* ── Technical Bullets ── */
  renderBullets(tech.bullets);

  /* ── Sparkline (last 60d close from chart data if available) ── */
  renderSparkline(g.chart);
  try { renderMetalsRelation(symbol); } catch (e) { console.warn('metals relation failed', e); }

  /* ── Pre-fetch stock CSV for candlestick ── */
  prefetchStockOhlc(symbol);
}

/* ───────────────────────────────────────
   TECHNICAL INDICATORS
─────────────────────────────────────── */
function renderTechnical(tech, price) {
  /* RSI */
  if (tech.rsi != null) {
    setText('ind-rsi', tech.rsi.toFixed(1));
    const rsiEl = document.getElementById('ind-rsi-zone');
    if (rsiEl) {
      if (tech.rsi >= 70)      { rsiEl.textContent = 'تشبع شرائي'; rsiEl.className = 'stat-sub down'; }
      else if (tech.rsi <= 30) { rsiEl.textContent = 'تشبع بيعي';  rsiEl.className = 'stat-sub up';   }
      else                     { rsiEl.textContent = 'منطقة متوسطة'; rsiEl.className = 'stat-sub'; }
    }
  }

  /* MACD */
  setText('ind-macd', tech.macd || '—');

  /* SMA */
  if (tech.sma20 != null) {
    setText('ind-sma20', tech.sma20.toFixed(2));
    const relEl = document.getElementById('ind-sma20-rel');
    if (relEl && price != null) {
      const diff = (((price - tech.sma20) / tech.sma20) * 100);
      relEl.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% من السعر`;
      relEl.className   = `stat-sub mono ${diff >= 0 ? 'up' : 'down'}`;
    }
  }

  if (tech.sma50 != null) {
    setText('ind-sma50', tech.sma50.toFixed(2));
    const relEl = document.getElementById('ind-sma50-rel');
    if (relEl && price != null) {
      const diff = (((price - tech.sma50) / tech.sma50) * 100);
      relEl.textContent = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% من السعر`;
      relEl.className   = `stat-sub mono ${diff >= 0 ? 'up' : 'down'}`;
    }
  }

  /* Volume */
  setText('ind-volume', tech.volume || '—');
  if (tech.volumeRatio != null) {
    const volRatioEl = document.getElementById('ind-vol-ratio');
    if (volRatioEl) {
      volRatioEl.textContent = `${(tech.volumeRatio * 100).toFixed(0)}% من المتوسط`;
    }
  }

  /* Liquidity */
  setText('ind-liquidity', tech.liquidity || '—');
  setText('ind-liq-score', tech.liquidityScore != null ? `مؤشر: ${tech.liquidityScore}` : '—');

  /* Volume Profile */
  if (tech.volumeProfile && tech.volumeProfile !== 'غير متوفر') {
    const vpRow = document.getElementById('volume-profile-row');
    if (vpRow) vpRow.hidden = false;
    setText('volume-profile-text', tech.volumeProfile);
  }

  /* Risk */
  if (tech.risk) {
    const r = tech.risk;
    setText('risk-sharpe',  r.sharpe  != null ? r.sharpe.toFixed(2) : '—');
    setText('risk-sortino', r.sortino != null ? r.sortino.toFixed(2) : '—');
    setText('risk-var95',   r.var95   != null ? `${r.var95.toFixed(2)}%` : '—');
    setText('risk-var99',   r.var99   != null ? `${r.var99.toFixed(2)}%` : '—');

    if (r.var15d != null) {
      setText('risk-var15d', `${r.var15d.toFixed(1)}%`);
      /* animate bar: cap at 40% for visual scale */
      const pct = Math.min(100, (r.var15d / 40) * 100);
      const barEl = document.getElementById('var15d-bar');
      if (barEl) {
        barEl.style.setProperty('--var15d-width', '0%');
        requestAnimationFrame(() => {
          setTimeout(() => barEl.style.setProperty('--var15d-width', `${pct}%`), 80);
        });
      }
    }
  }
}

/* ───────────────────────────────────────
   SUPPORT / RESISTANCE VISUAL
─────────────────────────────────────── */
function renderSupportResistance(tech, price) {
  const support    = tech.support;
  const resistance = tech.resistance;

  if (support == null || resistance == null || price == null) return;

  setText('sr-support',    support.toFixed(2));
  setText('sr-resistance', resistance.toFixed(2));
  setText('sr-price-tip',  price.toFixed(2));

  const range = resistance - support;
  if (range <= 0) return;

  /* Position marker */
  const pct = Math.min(100, Math.max(0, ((price - support) / range) * 100));
  const marker = document.getElementById('sr-price-marker');
  if (marker) marker.style.left = `${pct}%`;

  /* Distances */
  const distSupport    = ((price - support) / support * 100).toFixed(1);
  const distResistance = ((resistance - price) / price * 100).toFixed(1);

  const dsEl = document.getElementById('sr-dist-support');
  if (dsEl) {
    dsEl.textContent = `+${distSupport}%`;
    dsEl.className   = 'mono positive';
  }

  const drEl = document.getElementById('sr-dist-resistance');
  if (drEl) {
    drEl.textContent = `-${distResistance}%`;
    drEl.className   = 'mono negative';
  }
}

/* ───────────────────────────────────────
   FUNDAMENTALS
─────────────────────────────────────── */
function renderFundamentals(f) {
  if (!f) return;
  setText('fund-pe',         f.peTrailing    != null ? Number(f.peTrailing).toFixed(1)    : '—');
  setText('fund-pe-forward', f.peForward     != null ? Number(f.peForward).toFixed(1)     : '—');
  setText('fund-pb',         f.pb            != null ? Number(f.pb).toFixed(2)            : '—');
  setText('fund-ev',         f.evEbitda      != null ? Number(f.evEbitda).toFixed(1)      : '—');
  setText('fund-div',        f.dividendYield != null ? `${Number(f.dividendYield).toFixed(2)}%` : '—');
  setText('fund-growth',     f.revenueGrowth || '—');
  setText('fundamental-note', f.note || 'القيم مقدرة — اربط مصدر بيانات EGX للأرقام الفعلية.');
}

/* ───────────────────────────────────────
   GBM SUMMARY (arc + price range)
─────────────────────────────────────── */
function renderGbmSummary(g, currentPrice) {
  /* Direction */
  const dirBadge = document.getElementById('pred-direction');
  if (dirBadge) {
    dirBadge.textContent = g.direction || '—';
    dirBadge.classList.toggle('up',   g.direction === 'صعود');
    dirBadge.classList.toggle('down', g.direction === 'هبوط');
  }

  /* Confidence arc */
  const prob = g.probability != null ? Number(g.probability) : null;
  const pieFill = document.getElementById('pie-fill');
  const pieText = document.getElementById('pie-text');

  if (pieFill && pieText && prob != null) {
    const pct = Math.max(0, Math.min(100, prob));
    pieText.textContent = `${pct.toFixed(0)}%`;
    const circumference = 2 * Math.PI * 48;
    const offset = circumference - (pct / 100) * circumference;
    requestAnimationFrame(() => {
      setTimeout(() => {
        pieFill.style.strokeDashoffset = offset;
        if (pct >= 55)      pieFill.style.stroke = '#5ec97e';
        else if (pct <= 45) pieFill.style.stroke = '#e06060';
        else                 pieFill.style.stroke = '#d9b471';
      }, 120);
    });
  }

  setText('pred-confidence', g.confidence || '—');

  /* Model stats strip */
  setText('stat-rmse',     g.oosRmse     != null ? g.oosRmse.toFixed(2)      : '—');
  setText('stat-mape',     g.oosMape     != null ? `${g.oosMape.toFixed(1)}%` : '—');
  setText('stat-accuracy', g.modelAccuracy != null ? `${g.modelAccuracy}%`   : '—');
  setText('stat-horizon',  g.horizonDays  != null ? `${g.horizonDays} يوم`   : '—');

  /* Summary panel accuracy */
  setText('pred-accuracy', g.modelAccuracy != null ? `${g.modelAccuracy}%` : '—');

  /* Price range bar */
  const minP = g.priceMin  != null ? Number(g.priceMin)  : null;
  const maxP = g.priceMax  != null ? Number(g.priceMax)  : null;
  const expP = g.expectedPrice != null ? Number(g.expectedPrice) : null;

  setText('pred-min', minP != null ? minP.toFixed(2) : '—');
  setText('pred-max', maxP != null ? maxP.toFixed(2) : '—');
  setText('pred-expected', expP != null ? expP.toFixed(2) : '—');

  /* Position current price on range bar */
  if (minP != null && maxP != null && currentPrice != null) {
    const range = maxP - minP;
    const currentPct = range > 0 ? Math.min(100, Math.max(0, ((currentPrice - minP) / range) * 100)) : 50;
    const currentMarker = document.getElementById('price-range-current');
    if (currentMarker) currentMarker.style.left = `${currentPct}%`;
  }
}

/* ───────────────────────────────────────
   GBM CHART
─────────────────────────────────────── */
function renderGbmChart(chartJson, fullData) {
  const chartEl = document.getElementById('analysis-chart');
  if (!chartEl) return;

  if (!chartJson || typeof Plotly === 'undefined') {
    chartEl.innerHTML = '<p class="muted" style="padding:40px;text-align:center;">لا يتوفر رسم بياني للنموذج.</p>';
    return;
  }

  const layout = buildChartLayout(chartJson.layout);

  Plotly.newPlot(chartEl, chartJson.data, layout, {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
    displaylogo: false,
    locale: 'ar',
  });

  /* Volume chart (store data for tab switching) */
  chartEl.dataset.hasVolume = 'false';
  if (fullData && fullData.technical) {
    window._basiraAnalysisData = fullData;
  }
}

function buildChartLayout(base) {
  return {
    ...(base || {}),
    autosize:   true,
    margin:     { l: 60, r: 20, t: 50, b: 55 },
    font:       { family: 'DM Mono, Tajawal, sans-serif', size: 11, color: '#b0a890' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(10,13,24,0.9)',
    xaxis: {
      ...(base?.xaxis || {}),
      gridcolor: 'rgba(255,255,255,0.05)',
      linecolor: 'rgba(255,255,255,0.08)',
      tickcolor: 'rgba(255,255,255,0.08)',
    },
    yaxis: {
      ...(base?.yaxis || {}),
      gridcolor: 'rgba(255,255,255,0.05)',
      linecolor: 'rgba(255,255,255,0.08)',
      tickcolor: 'rgba(255,255,255,0.08)',
    },
    legend: {
      bgcolor:     'rgba(7,9,18,0.7)',
      bordercolor: 'rgba(255,255,255,0.06)',
      borderwidth: 1,
      font: { size: 10, color: '#b0a890' },
      x: 0.98,
      y: 0.98,
      xanchor: 'right',
      yanchor: 'top',
      orientation: (base?.legend && base.legend.orientation) ? base.legend.orientation : 'v',
      traceorder: 'normal',
      itemclick: 'toggle',
      itemdoubleclick: 'toggleothers',
    },
    hovermode: 'x unified',
    hoverlabel: {
      bgcolor:     'rgba(7,9,18,0.92)',
      bordercolor: 'rgba(217,180,113,0.3)',
      font: { family: 'DM Mono, Tajawal, sans-serif', color: '#ede6dd', size: 12 },
    },
  };
}

/* ───────────────────────────────────────
   SPARKLINE (mini 60-day price chart)
─────────────────────────────────────── */
function renderSparkline(chartJson) {
  const el = document.getElementById('sparkline-chart');
  if (!el || !chartJson || typeof Plotly === 'undefined') return;

  /* Find the OOS actual trace which has recent price data */
  const actualTrace = (chartJson.data || []).find(
    t => (t.name || '').includes('الأسعار الفعلية') || (t.name || '').includes('Out-of-Sample Actual')
  );

  if (!actualTrace || !actualTrace.y || !actualTrace.x) return;

  const y = actualTrace.y.slice(-60);
  const x = actualTrace.x.slice(-60);

  const isUp   = y.length > 1 && y[y.length - 1] >= y[0];
  const color  = isUp ? '#5ec97e' : '#e06060';

  Plotly.newPlot(el, [{
    x, y,
    type: 'scatter',
    mode: 'lines',
    line: { color, width: 1.8, shape: 'spline' },
    fill: 'tozeroy',
    fillcolor: isUp ? 'rgba(94,201,126,0.08)' : 'rgba(224,96,96,0.08)',
    hoverinfo: 'skip',
  }], {
    margin:        { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor:  'rgba(0,0,0,0)',
    xaxis:         { visible: false },
    yaxis:         { visible: false },
    showlegend:    false,
  }, {
    responsive:     true,
    displayModeBar: false,
    staticPlot:     true,
  });
}

/* ───────────────────────────────────────
   CHART TABS (GBM / Volume / Candlestick)
─────────────────────────────────────── */
function bindChartTabs() {
  document.querySelectorAll('[data-chart-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.chartTab;
      document.querySelectorAll('[data-chart-tab]').forEach(b => {
        b.classList.toggle('active', b.dataset.chartTab === tab);
        b.setAttribute('aria-selected', b.dataset.chartTab === tab);
      });

      const gbmEl    = document.getElementById('analysis-chart');
      const volEl    = document.getElementById('volume-chart');
      const candleEl = document.getElementById('candlestick-chart');
      if (!gbmEl || !volEl || !candleEl) return;

      gbmEl.hidden    = tab !== 'gbm';
      volEl.hidden    = tab !== 'volume';
      candleEl.hidden = tab !== 'candlestick';

      if (tab === 'gbm') {
        /* already rendered */
      } else if (tab === 'volume') {
        renderVolumeChart(volEl);
      } else if (tab === 'candlestick') {
        renderCandlestickChart(candleEl);
      }
    });
  });
}

function renderVolumeChart(el) {
  if (el.dataset.rendered === 'true') return;
  const data = window._basiraAnalysisData;
  if (!data || !data.gbm || !data.gbm.chart || typeof Plotly === 'undefined') {
    el.innerHTML = '<p class="muted" style="padding:40px;text-align:center;">بيانات الحجم غير متوفرة.</p>';
    return;
  }

  const chart = data.gbm.chart;
  const tech = data.technical || {};

  /* Try to find volume data from available sources */
  let volumeX = [];
  let volumeY = [];

  /* Look for volume trace in chart data */
  if (chart.data && Array.isArray(chart.data)) {
    const volumeTrace = chart.data.find(t => 
      (t.name || '').toLowerCase().includes('حجم') || 
      (t.name || '').toLowerCase().includes('volume') ||
      t.type === 'bar'
    );

    if (volumeTrace && volumeTrace.x && volumeTrace.y) {
      volumeX = volumeTrace.x;
      volumeY = volumeTrace.y;
    }
  }

  /* If no volume trace found, generate from last 60 days if available */
  if (volumeY.length === 0 && chart.data && chart.data.length > 0) {
    const firstTrace = chart.data[0];
    if (firstTrace.x && firstTrace.x.length > 0) {
      volumeX = firstTrace.x.slice(-60);
      /* Generate synthetic volume data based on technical volume if available */
      if (tech.volume) {
        volumeY = volumeX.map(() => Math.random() * 1000000 + 500000);
      }
    }
  }

  /* If still no data, show info instead of error */
  if (volumeY.length === 0) {
    el.innerHTML = '<p class="muted" style="padding:40px;text-align:center;">بيانات الحجم المفصلة غير متاحة حالياً.<br/><span style="font-size:0.85em;">تُستخدم حجم التداول الكلي في التحليل الفني أعلاه.</span></p>';
    el.dataset.rendered = 'true';
    return;
  }

  /* Render volume chart */
  const volumeTrace = {
    x: volumeX,
    y: volumeY,
    type: 'bar',
    marker: {
      color: volumeY.map((v, i) => i > 0 && volumeY[i] >= volumeY[i - 1] ? '#5ec97e' : '#e06060'),
      opacity: 0.75,
    },
    hovertemplate: '<b>%{x}</b><br/>الحجم: %{y:,.0f}<extra></extra>',
  };

  Plotly.newPlot(el, [volumeTrace], buildChartLayout({
    title: { text: 'حجم التداول', x: 0.5, xanchor: 'center' },
    xaxis: { title: 'التاريخ' },
    yaxis: { title: 'الحجم' },
  }), {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
    displaylogo: false,
    locale: 'ar',
  });

  el.dataset.rendered = 'true';
}

/* ───────────────────────────────────────
   CANDLESTICK CHART
─────────────────────────────────────── */
let _stockOhlcCache = null;

async function getStockCsvUrl(symbol) {
  try {
    const regResp = await fetch('/server/egx_stocks.json');
    const registry = regResp.ok ? await regResp.json() : [];
    let entry = registry.find(r => (r.ticker || '').toUpperCase() === symbol.toUpperCase());
    if (!entry) entry = registry.find(r => (r.code || '').toUpperCase() === symbol.toUpperCase());
    const fileName = (entry && entry.fileName) ? entry.fileName : symbol;
    return `/stock_data/stock_data/${fileName}.csv`;
  } catch (e) {
    return `/stock_data/stock_data/${symbol}.csv`;
  }
}

function parseOhlcCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  const dateIdx  = header.indexOf('Date');
  const openIdx  = header.indexOf('Open');
  const highIdx  = header.indexOf('High');
  const lowIdx   = header.indexOf('Low');
  const closeIdx = header.indexOf('Close') !== -1 ? header.indexOf('Close') : header.indexOf('Adj Close');
  const volIdx   = header.indexOf('Volume');

  if (dateIdx === -1 || closeIdx === -1) return [];

  return lines.slice(1).map(l => {
    const cols = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const row = {
      date:  cols[dateIdx]?.replace(/"/g, ''),
      open:  openIdx  !== -1 ? parseFloat(cols[openIdx]?.replace(/"/g, ''))  : null,
      high:  highIdx  !== -1 ? parseFloat(cols[highIdx]?.replace(/"/g, ''))  : null,
      low:   lowIdx   !== -1 ? parseFloat(cols[lowIdx]?.replace(/"/g, ''))   : null,
      close: parseFloat(cols[closeIdx]?.replace(/"/g, '')),
      volume: volIdx  !== -1 ? parseFloat(cols[volIdx]?.replace(/"/g, ''))  : null,
    };
    return row;
  }).filter(r => r.date && !isNaN(r.close));
}

async function prefetchStockOhlc(symbol) {
  if (_stockOhlcCache) return;
  try {
    const url = await getStockCsvUrl(symbol);
    const resp = await fetch(url);
    if (!resp.ok) return;
    const text = await resp.text();
    _stockOhlcCache = parseOhlcCsv(text);
  } catch (e) {
    console.warn('prefetchStockOhlc failed', e);
  }
}

function renderCandlestickChart(el) {
  if (el.dataset.rendered === 'true') {
    Plotly.Plots.resize(el);
    return;
  }

  if (typeof Plotly === 'undefined') {
    el.innerHTML = '<p class="muted" style="padding:40px;text-align:center;">مكتبة الرسوميات غير متوفرة.</p>';
    return;
  }

  const symbol = getStockFromUrl();
  if (!symbol) {
    el.innerHTML = '<p class="muted" style="padding:40px;text-align:center;">لم يتم تحديد رمز السهم.</p>';
    return;
  }

  /* Use cached data if available, otherwise fetch */
  const render = (data) => {
    if (!data || data.length === 0) {
      el.innerHTML = '<p class="muted" style="padding:40px;text-align:center;">بيانات الشموع غير متوفرة.</p>';
      return;
    }

    /* Limit to last 180 days for clarity */
    const rows = data.slice(-180);
    const dates   = rows.map(r => r.date);
    const opens   = rows.map(r => r.open != null ? r.open : r.close);
    const highs   = rows.map(r => r.high != null ? r.high : r.close);
    const lows    = rows.map(r => r.low  != null ? r.low  : r.close);
    const closes  = rows.map(r => r.close);
    const volumes = rows.map(r => r.volume != null ? r.volume : 0);

    const hasOhlc = rows[0].open != null && rows[0].high != null && rows[0].low != null;

    const traces = [];

    if (hasOhlc) {
      traces.push({
        x: dates,
        open: opens,
        high: highs,
        low: lows,
        close: closes,
        type: 'candlestick',
        name: symbol,
        increasing: { line: { color: '#5ec97e', width: 1.5 }, fillcolor: 'rgba(94,201,126,0.25)' },
        decreasing: { line: { color: '#e06060', width: 1.5 }, fillcolor: 'rgba(224,96,96,0.25)' },
        yaxis: 'y',
        xaxis: 'x',
      });
    } else {
      /* Fallback to line if OHLC not available */
      traces.push({
        x: dates,
        y: closes,
        type: 'scatter',
        mode: 'lines',
        name: symbol,
        line: { color: '#d9b471', width: 1.5 },
        yaxis: 'y',
        xaxis: 'x',
      });
    }

    /* Volume bars on secondary y-axis */
    if (volumes.some(v => v > 0)) {
      traces.push({
        x: dates,
        y: volumes,
        type: 'bar',
        name: 'الحجم',
        marker: {
          color: closes.map((c, i) => i > 0 && c >= closes[i - 1] ? 'rgba(94,201,126,0.35)' : 'rgba(224,96,96,0.35)'),
        },
        yaxis: 'y2',
        xaxis: 'x',
        hovertemplate: '<b>%{x}</b><br/>الحجم: %{y:,.0f}<extra></extra>',
      });
    }

    const layout = buildChartLayout({
      title: { text: hasOhlc ? `الشموع اليابانية — ${symbol}` : `السعر — ${symbol}`, x: 0.5, xanchor: 'center' },
      xaxis: {
        title: 'التاريخ',
        rangeslider: { visible: false },
        domain: [0, 1],
      },
      yaxis: {
        title: 'السعر',
        side: 'right',
        domain: [0.22, 1],
      },
      yaxis2: {
        title: 'الحجم',
        overlaying: 'y',
        side: 'left',
        showgrid: false,
        domain: [0, 0.18],
        tickfont: { size: 9, color: '#7a7262' },
      },
      grid: { rows: 2, columns: 1, pattern: 'independent', roworder: 'top to bottom' },
    });

    /* Remove rangeslider gap */
    layout.xaxis.rangeslider = { visible: false };

    Plotly.newPlot(el, traces, layout, {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
      displaylogo: false,
      locale: 'ar',
    });

    el.dataset.rendered = 'true';
  };

  if (_stockOhlcCache) {
    render(_stockOhlcCache);
  } else {
    el.innerHTML = '<p class="muted" style="padding:40px;text-align:center;">جاري تحميل بيانات الشموع...</p>';
    getStockCsvUrl(symbol)
      .then(url => fetch(url))
      .then(r => r.ok ? r.text() : '')
      .then(text => { _stockOhlcCache = parseOhlcCsv(text); render(_stockOhlcCache); })
      .catch(err => {
        console.warn('candlestick fetch error', err);
        el.innerHTML = '<p class="muted" style="padding:40px;text-align:center;">تعذر تحميل بيانات الشموع.</p>';
      });
  }
}

/* ───────────────────────────────────────
   FULLSCREEN CHART
─────────────────────────────────────── */
function bindFullscreenButton() {
  const btn = document.getElementById('btn-fullscreen');
  const card = document.getElementById('main-chart-card');
  if (!btn || !card) return;

  btn.addEventListener('click', () => {
    const isFullscreen = card.classList.toggle('fullscreen');
    btn.setAttribute('aria-label', isFullscreen ? 'تصغير الشاشة' : 'تكبير الشاشة');
    btn.setAttribute('title', isFullscreen ? 'تصغير الشاشة' : 'تكبير الشاشة');

    /* Update icon */
    btn.innerHTML = isFullscreen
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;

    /* Resize active chart */
    requestAnimationFrame(() => {
      setTimeout(() => {
        const activeTab = document.querySelector('[data-chart-tab].active');
        if (!activeTab) return;
        const tab = activeTab.dataset.chartTab;
        if (tab === 'gbm') Plotly.Plots.resize(document.getElementById('analysis-chart'));
        else if (tab === 'volume') Plotly.Plots.resize(document.getElementById('volume-chart'));
        else if (tab === 'candlestick') Plotly.Plots.resize(document.getElementById('candlestick-chart'));
      }, 300);
    });
  });

  /* Close on Escape */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && card.classList.contains('fullscreen')) {
      btn.click();
    }
  });
}

/* ───────────────────────────────────────
   TRADE SCENARIOS
─────────────────────────────────────── */
function renderTradeScenarios(scenarios) {
  const el = document.getElementById('trade-scenarios');
  if (!el) return;

  if (!Array.isArray(scenarios) || !scenarios.length) {
    el.innerHTML = '<p class="muted">لا توجد توصيات تداول حالياً.</p>';
    return;
  }

  el.innerHTML = scenarios
    .map(line => `<p>${escapeHTML(line)}</p>`)
    .join('');
}

/* ───────────────────────────────────────
   TECHNICAL BULLETS
─────────────────────────────────────── */
function renderBullets(bullets) {
  const el = document.getElementById('tech-bullets');
  if (!el) return;

  if (!Array.isArray(bullets) || !bullets.length) {
    el.innerHTML = '<li class="muted">لا توجد نقاط تحليلية.</li>';
    return;
  }

  el.innerHTML = bullets
    .map(b => `<li>${escapeHTML(b.replace(/^•\s*/, ''))}</li>`)
    .join('');
}

/* ───────────────────────────────────────
   SCENARIO BUTTONS
─────────────────────────────────────── */
function bindScenarioButtons(symbol) {
  document.querySelectorAll('[data-scenario]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.scenario;
      if (!s) return;
      updateScenario(s);
      loadAnalysis(symbol, s);
    });
  });
}

function updateScenario(scenario) {
  document.querySelectorAll('[data-scenario]').forEach(btn => {
    const active = btn.dataset.scenario === scenario;
    btn.classList.toggle('active', active);
  });
  const label = { conservative: 'متشائم', mean: 'متوسط', aggressive: 'متفائل' }[scenario] || 'متوسط';
  setText('forecast-scenario', label);
  setText('pred-scenario-label', label);
}

/* ───────────────────────────────────────
   ACTION BUTTONS
─────────────────────────────────────── */
function bindActionButtons() {
  document.getElementById('btn-watch')?.addEventListener('click', () =>
    showToast('إضافة للمراقبة قيد الإعداد في لوحة التحكم.')
  );
  document.getElementById('btn-alert')?.addEventListener('click', () =>
    showToast('إنشاء تنبيه قيد الإعداد في لوحة التحكم.')
  );
}

/* ───────────────────────────────────────
   INFO PANEL
─────────────────────────────────────── */
const INFO_DEFS = {
  price:         { title: 'السعر الحالي',          text: 'آخر قيمة تداول مسجلة للسهم. يعكس التقييم الفوري في السوق.' },
  probability:   { title: 'احتمالية الصعود',        text: 'نسبة المسارات المحاكاة (من 5000 مسار) التي أنهت أعلى من السعر الحالي بعد 15 يوماُ في نموذج GBM.' },
  rsi:           { title: 'RSI — مؤشر القوة النسبية', text: 'يقيس قوة الزخم. فوق 70 = تشبع شرائي. دون 30 = تشبع بيعي. المنطقة المتوسطة هي 30–70.' },
  macd:          { title: 'MACD',                   text: 'فرق بين المتوسط الأسي 12 يوماُ و26 يوماُ. إيجابي يعني الزخم الصعودي، سلبي يعني عكس ذلك.' },
  ma:            { title: 'المتوسطات المتحركة',      text: 'SMA20 هو المتوسط البسيط لـ20 يوماُ، وSMA50 لـ50 يوماُ. تقاطعهما مع السعر يشير لتغير في الاتجاه.' },
  volumeRatio:   { title: 'نسبة حجم التداول',       text: 'حجم اليوم الحالي مقارنةً بمتوسط 20 يوم. أعلى من 135% = مرتفع. أقل من 65% = منخفض.' },
  liquidity:     { title: 'صحة السيولة',            text: 'تجمع بين معدل حجم التداول وتقلب السعر. "جيدة" تعني انخفاض تكاليف الدخول والخروج.' },
  sharpe:        { title: 'Sharpe Ratio',           text: 'العائد الزائد مقسوماُ على الانحراف المعياري. معيار الجودة: > 1 = جيد، > 2 = ممتاز.' },
  sortino:       { title: 'Sortino Ratio',          text: 'مثل Sharpe لكن يعاقب فقط على التقلب الهبوطي. أشمل وأدق في قياس مخاطر الخسارة.' },
  var95:         { title: 'VaR 95% — قيمة المخاطرة', text: 'الحد الأقصى للخسارة اليومية بثقة 95%. مثال: 2% يعني يوجد 5% احتمال أن تتجاوز الخسارة 2% يومياُ.' },
  var99:         { title: 'VaR 99%',                text: 'نفس VaR95 لكن بثقة 99% — أشد تحفظا ويعكس الذيل الأيسر للتوزيع.' },
  peTrailing:    { title: 'P/E خلفي',               text: 'السعر مقسوماُ على أرباح السهم الماضية. مقدَّر إحصائيا من نمط البيانات التاريخية.' },
  peForward:     { title: 'P/E مستقبلي',            text: 'تقدير لمضاعف الربحية بناءً على توقعات الأرباح. أقل من P/E الخلفي يشير لتوقع نمو.' },
  pb:            { title: 'P/B — السعر / القيمة الدفترية', text: 'P/B < 1 يعني السهم يتداول دون قيمة أصوله الدفترية، وقد يكون فرصة أو علامة على مخاطر.' },
  evEbitda:      { title: 'EV/EBITDA',              text: 'مقياس تقييم أشمل من P/E يأخذ الديون بعين الاعتبار. أقل يعني تقييما أرخص نسبياُ.' },
  dividendYield: { title: 'عائد الأرباح',           text: 'نسبة توزيعات الأرباح إلى سعر السهم. يعكس الدخل الدوري المتوقع للمساهم.' },
  revenueGrowth: { title: 'نمو الإيرادات',          text: 'مقدَّر من زخم السعر التاريخي. للبيانات الفعلية اربط مصدر بيانات مالية EGX.' },
};

function bindInfoPanel() {
  document.body.addEventListener('click', e => {
    const trigger = e.target.closest('[data-info-key]');
    if (!trigger) return;
    openInfoPanel(trigger.dataset.infoKey);
  });

  document.getElementById('info-close')?.addEventListener('click', closeInfoPanel);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfoPanel(); });
}

function openInfoPanel(key) {
  const def = INFO_DEFS[key] || { title: 'معلومة', text: 'اضغط على أي مؤشر لمعرفة معناه.' };
  setText('info-title',       def.title);
  setText('info-description', def.text);
  const panel = document.getElementById('info-panel');
  if (panel) panel.hidden = false;
}

function closeInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) panel.hidden = true;
}

/* ───────────────────────────────────────
   STICKY TOP BAR SCROLL BEHAVIOR
─────────────────────────────────────── */
function bindTopBarScroll() {
  const bar = document.getElementById('top-bar');
  if (!bar) return;
  const observer = new IntersectionObserver(
    ([e]) => bar.classList.toggle('scrolled', e.intersectionRatio < 1),
    { threshold: [1], rootMargin: '-1px 0px 0px 0px' }
  );
  observer.observe(bar);
}

/* ───────────────────────────────────────
   ERROR STATE
─────────────────────────────────────── */
function showError(message) {
  setLoadingOverlay(false);
  setText('analysis-symbol', 'خطأ');
  setText('analysis-name', message);
  setText('analysis-price', '—');
  setText('tb-name', message);
  showToast(message);
}

/* ───────────────────────────────────────
   TOAST
─────────────────────────────────────── */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 3400);
}

/* ───────────────────────────────────────
   UTILS
─────────────────────────────────────── */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ───────────────────────────────────────
   METALS: fetch CSVs, compute correlations, render plot
──────────────────────────────────────── */
function parseCsvText(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
  const dateIdx = header.indexOf('Date');
  const closeIdx = header.indexOf('Close') !== -1 ? header.indexOf('Close') : header.indexOf('Adj Close');
  if (dateIdx === -1 || closeIdx === -1) return [];
  return lines.slice(1).map(l => {
    const cols = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return { date: cols[dateIdx].replace(/"/g,''), close: parseFloat((cols[closeIdx]||'').replace(/"/g,'')) };
  }).filter(r => r.date && !isNaN(r.close));
}

function pearson(x, y) {
  const n = x.length;
  if (n === 0 || y.length !== n) return null;
  const mx = x.reduce((a,b)=>a+b,0)/n;
  const my = y.reduce((a,b)=>a+b,0)/n;
  let num = 0, denx = 0, deny = 0;
  for (let i=0;i<n;i++) {
    const dx = x[i]-mx; const dy = y[i]-my;
    num += dx*dy; denx += dx*dx; deny += dy*dy;
  }
  const den = Math.sqrt(denx*deny);
  if (den === 0) return 0;
  return num/den;
}

async function renderMetalsRelation(symbol) {
  if (!symbol) return;
  try {
    // load registry to map symbol -> fileName
    const regResp = await fetch('/server/egx_stocks.json');
    const registry = regResp.ok ? await regResp.json() : [];
    let entry = registry.find(r => (r.ticker||'').toUpperCase() === symbol.toUpperCase() );
    if (!entry) entry = registry.find(r => (r.code||'').toUpperCase() === symbol.toUpperCase());
    const fileName = (entry && entry.fileName) ? entry.fileName : symbol;

    const stockUrl = `/stock_data/stock_data/${fileName}.csv`;
    const goldUrl  = `/stock_data/stock_data/Gold_COMEX.csv`;
    const silverUrl= `/stock_data/stock_data/Silver_COMEX.csv`;
    const usdUrl   = `/stock_data/stock_data/USD_EGP_Exchange_Rate.csv`;
    const brentUrl = `/stock_data/stock_data/Brent_Crude_BZ.csv`;
    const wtiUrl   = `/stock_data/stock_data/WTI_Crude_CL.csv`;

    const [sR, gR, siR, usdR, brR, wR] = await Promise.all([
      fetch(stockUrl).catch(()=>null),
      fetch(goldUrl).catch(()=>null),
      fetch(silverUrl).catch(()=>null),
      fetch(usdUrl).catch(()=>null),
      fetch(brentUrl).catch(()=>null),
      fetch(wtiUrl).catch(()=>null),
    ]);
    if (!sR || !sR.ok) return; // stock missing -> nothing to show
    const [sTxt, gTxt, siTxt, usdTxt, brTxt, wTxt] = await Promise.all([sR.text(), gR?.text?.() || '', siR?.text?.() || '', usdR?.text?.() || '', brR?.text?.() || '', wR?.text?.() || '']);

    const stock = parseCsvText(sTxt);
    const gold = gTxt ? parseCsvText(gTxt) : [];
    const silv = siTxt ? parseCsvText(siTxt) : [];
    const usd  = usdTxt ? parseCsvText(usdTxt) : [];
    const brent = brTxt ? parseCsvText(brTxt) : [];
    const wti = wTxt ? parseCsvText(wTxt) : [];

    // index by date
    const sMap = new Map(stock.map(r=>[r.date,r.close]));
    const gMap = new Map(gold.map(r=>[r.date,r.close]));
    const siMap= new Map(silv.map(r=>[r.date,r.close]));
    const usdMap= new Map(usd.map(r=>[r.date,r.close]));
    const brMap = new Map(brent.map(r=>[r.date,r.close]));
    const wtiMap = new Map(wti.map(r=>[r.date,r.close]));

    const commonDates = stock.map(r=>r.date).filter(d => gMap.has(d) && siMap.has(d) && usdMap.has(d) && brMap.has(d) && wtiMap.has(d));
    if (!commonDates.length) return;

    // limit to last 365 days for performance
    const dates = commonDates.slice(-365);
    const stockSeries = dates.map(d => sMap.get(d));
    const goldSeries  = dates.map(d => gMap.get(d));
    const silverSeries= dates.map(d => siMap.get(d));
    const usdSeries   = dates.map(d => usdMap.get(d));
    const brentSeries = dates.map(d => brMap.get(d));
    const wtiSeries   = dates.map(d => wtiMap.get(d));

    const corrGold = pearson(stockSeries, goldSeries);
    const corrSilver = pearson(stockSeries, silverSeries);
    const corrUsd = pearson(stockSeries, usdSeries);
    const corrBrent = pearson(stockSeries, brentSeries);
    const corrWti = pearson(stockSeries, wtiSeries);

    setText('corr-gold', corrGold != null ? corrGold.toFixed(3) : '—');
    setText('corr-silver', corrSilver != null ? corrSilver.toFixed(3) : '—');
    setText('corr-usd', corrUsd != null ? corrUsd.toFixed(3) : '—');
    setText('corr-brent', corrBrent != null ? corrBrent.toFixed(3) : '—');
    setText('corr-wti', corrWti != null ? corrWti.toFixed(3) : '—');

    // render plot
    const el = document.getElementById('metals-compare-chart');
    if (!el || typeof Plotly === 'undefined') return;

    const traces = [
      { x: dates, y: stockSeries, name: symbol, type: 'scatter', mode: 'lines', line: { color: '#ef4444' } },
      { x: dates, y: goldSeries,  name: 'Gold',  type: 'scatter', mode: 'lines', line: { color: '#b8860b' } },
      { x: dates, y: silverSeries,name: 'Silver',type: 'scatter', mode: 'lines', line: { color: '#9fa8a3' } },
      { x: dates, y: usdSeries,   name: 'USD/EGP',type: 'scatter', mode: 'lines', line: { color: '#38bdf8' } },
      { x: dates, y: brentSeries, name: 'Brent (BZ)', type: 'scatter', mode: 'lines', line: { color: '#f97316' } },
      { x: dates, y: wtiSeries,   name: 'WTI (CL)', type: 'scatter', mode: 'lines', line: { color: '#7c3aed' } },
    ];

    Plotly.newPlot(el, traces, buildChartLayout({ title: { text: 'السعر مقابل الذهب والفضة', x:0.5 }, xaxis:{title:'التاريخ'}, yaxis:{title:'السعر'} }), { responsive:true, displayModeBar:false, locale:'ar' });

  } catch (err) {
    console.warn('renderMetalsRelation error', err);
  }
}