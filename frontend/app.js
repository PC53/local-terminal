/* ═══════════════════════════════════════════════════════════
   LOCAL TERMINAL — app.js
   ═══════════════════════════════════════════════════════════ */

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  currentCommand: null,
  currentTicker: null,
  history: [],
  historyIndex: -1,
  acSelected: -1,
};

// Dashboard state — declared here to avoid TDZ errors in hoisted functions
let _cards      = [];
let _cardCharts = {};
let _cardTimers = {};

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
const COMMANDS = {
  'DES':   { desc: 'Company overview & key statistics',       usage: 'DES <TICKER>',                    fn: renderDES },
  'CHART': { desc: 'Interactive price chart',                 usage: 'CHART <TICKER>',                  fn: renderChart },
  'NEWS':  { desc: 'Latest news with sentiment analysis',     usage: 'NEWS <TICKER>',                   fn: renderNews },
  'FIN':   { desc: 'Financial statements',                    usage: 'FIN <TICKER>',                    fn: renderFinancials },
  'MOST':  { desc: 'Most active, top gainers & losers',       usage: 'MOST',                            fn: renderMost },
  'ADD':   { desc: 'Add a widget card to the dashboard',      usage: 'ADD CHART|QUOTE|NEWS|WATCH <TKR>', fn: renderAddCmd },
  'DASH':  { desc: 'Return to the dashboard canvas',          usage: 'DASH',                            fn: showDashboard },
  'HELP':  { desc: 'Show all available commands',             usage: 'HELP',                            fn: renderHelp },
};

// ─── DOM REFS ─────────────────────────────────────────────────────────────────
const commandWrapper  = document.getElementById('command-input-wrapper');
const commandInput    = document.getElementById('command-input');
const contentPanel    = document.getElementById('content-panel');
const dashboardView   = document.getElementById('dashboard-view');
const canvas          = document.getElementById('canvas');
const articleReader   = document.getElementById('article-reader');
const autocomplete    = document.getElementById('autocomplete');
const statusMsg       = document.getElementById('status-msg');
const marketIndices   = document.getElementById('market-indices');

// ─── COMMAND BAR ──────────────────────────────────────────────────────────────
function openCommandBar() {
  commandWrapper.classList.remove('hidden');
  commandInput.focus();
  commandInput.select();
  updateAutocomplete(commandInput.value);
}

function closeCommandBar() {
  commandWrapper.classList.add('hidden');
  commandInput.blur();
  autocomplete.style.display = 'none';
  state.acSelected = -1;
}

// ─── KEYBOARD HANDLING ────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === '`' || (e.key === '/' && document.activeElement !== commandInput)) {
    e.preventDefault();
    openCommandBar();
    return;
  }
  if (e.key === 'Escape') {
    closeCommandBar();
    return;
  }
});

commandInput.addEventListener('keydown', (e) => {
  const items = autocomplete.querySelectorAll('.ac-item');

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.acSelected = Math.min(state.acSelected + 1, items.length - 1);
    highlightAC(items);
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.acSelected = Math.max(state.acSelected - 1, -1);
    highlightAC(items);
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    if (state.acSelected >= 0 && items[state.acSelected]) {
      commandInput.value = items[state.acSelected].dataset.fill;
    }
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = (state.acSelected >= 0 && items[state.acSelected])
      ? items[state.acSelected].dataset.fill
      : commandInput.value;
    executeCommand(val);
    return;
  }
  if (e.key === 'ArrowUp' && state.history.length > 0) {
    state.historyIndex = Math.min(state.historyIndex + 1, state.history.length - 1);
    commandInput.value = state.history[state.historyIndex];
    return;
  }
});

commandInput.addEventListener('input', () => {
  state.acSelected = -1;
  updateAutocomplete(commandInput.value);
});

function highlightAC(items) {
  items.forEach((el, i) => {
    el.classList.toggle('selected', i === state.acSelected);
  });
}

// ─── AUTOCOMPLETE ─────────────────────────────────────────────────────────────

// Commands that accept a ticker as their last argument.
// For ADD the ticker is parts[2]; for all others it's parts[1].
const TICKER_COMMANDS = new Set(['DES', 'CHART', 'NEWS', 'FIN', 'ADD']);
const ADD_SUBTYPES    = new Set(['CHART', 'QUOTE', 'NEWS', 'WATCH']);

let _tickerCache = [];   // [{s: "AAPL", n: "Apple Inc."}, ...]

fetch('/tickers.json').then(r => r.json()).then(data => { _tickerCache = data; });

let _acDebounce = null;

function updateAutocomplete(raw) {
  const val     = raw.trim().toUpperCase();
  const parts   = val.split(/\s+/);
  const cmdPart = parts[0];

  if (!val) {
    renderACCommands(Object.entries(COMMANDS));
    return;
  }

  // ── Ticker-search phase ────────────────────────────────────────────────────
  // Conditions under which we should search for a ticker:
  //   • Normal commands (DES, CHART, NEWS, FIN): user has typed "<CMD> <partial>"
  //   • ADD command: user has typed "ADD <SUBTYPE> <partial>"
  const isNormalTickerPhase =
    TICKER_COMMANDS.has(cmdPart) &&
    cmdPart !== 'ADD' &&
    parts.length === 2 &&
    parts[1].length > 0;

  const isAddTickerPhase =
    cmdPart === 'ADD' &&
    parts.length === 3 &&
    ADD_SUBTYPES.has(parts[1]) &&
    parts[2].length > 0;

  if (isNormalTickerPhase || isAddTickerPhase) {
    const query  = isAddTickerPhase ? parts[2] : parts[1];
    const prefix = isAddTickerPhase ? `${parts[0]} ${parts[1]} ` : `${parts[0]} `;
    searchTickersLocal(query, prefix);
    return;
  }

  // ── Command-completion phase ───────────────────────────────────────────────
  // User is still typing the command name itself, OR has a complete command
  // with no ticker yet (show usage hint).
  if (COMMANDS[cmdPart] && parts.length === 1) {
    // Exact command typed — show its usage as a single hint
    const info = COMMANDS[cmdPart];
    renderAC([{ fill: cmdPart + ' ', cmd: cmdPart, desc: info.usage + ' — ' + info.desc }]);
    return;
  }

  if (COMMANDS[cmdPart] && parts.length >= 2) {
    // Full command + space but not yet in a ticker-search phase (e.g. ADD with no subtype yet)
    autocomplete.style.display = 'none';
    return;
  }

  const matches = Object.entries(COMMANDS)
    .filter(([cmd]) => cmd.startsWith(cmdPart))
    .map(([cmd, info]) => ({
      fill: cmd + ' ',
      cmd,
      desc: info.usage + ' — ' + info.desc,
    }));

  if (matches.length === 0 || (matches.length === 1 && matches[0].cmd === cmdPart)) {
    autocomplete.style.display = 'none';
    return;
  }

  renderAC(matches);
}

function searchTickersLocal(query, prefix) {
  if (!query) { autocomplete.style.display = 'none'; return; }
  const q = query.toUpperCase();
  const matches = _tickerCache
    .filter(t => t.s.startsWith(q) || t.n.toUpperCase().includes(q))
    .sort((a, b) => {
      // Exact symbol matches first, then symbol-prefix matches, then name matches
      const aExact = a.s === q, bExact = b.s === q;
      const aSym   = a.s.startsWith(q), bSym = b.s.startsWith(q);
      if (aExact !== bExact) return aExact ? -1 : 1;
      if (aSym   !== bSym)   return aSym   ? -1 : 1;
      return a.s.localeCompare(b.s);
    })
    .slice(0, 8)
    .map(t => ({ fill: prefix + t.s + ' ', cmd: t.s, desc: t.n }));

  renderAC(matches);
}

function renderACCommands(entries) {
  renderAC(entries.map(([cmd, info]) => ({
    fill: cmd + ' ',
    cmd,
    desc: info.usage + ' — ' + info.desc,
  })));
}

function renderAC(items) {
  if (!items.length) {
    autocomplete.style.display = 'none';
    return;
  }
  autocomplete.innerHTML = items.map(item => `
    <div class="ac-item" data-fill="${escapeAttr(item.fill)}">
      <span class="ac-cmd">${escapeHtml(item.cmd)}</span>
      <span class="ac-desc">${escapeHtml(item.desc)}</span>
    </div>
  `).join('');
  autocomplete.style.display = 'block';
  autocomplete.querySelectorAll('.ac-item').forEach(el => {
    el.addEventListener('click', () => {
      commandInput.value = el.dataset.fill;
      commandInput.focus();
      autocomplete.style.display = 'none';
      state.acSelected = -1;
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// ─── COMMAND DISPATCH ─────────────────────────────────────────────────────────
function executeCommand(input) {
  const trimmed = input.trim().toUpperCase();
  if (!trimmed) return;

  state.history.unshift(trimmed);
  if (state.history.length > 50) state.history.pop();
  state.historyIndex = -1;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  const ticker = parts[1] || '';

  closeCommandBar();
  setStatus(`Running: ${trimmed}`);

  if (cmd === 'ADD') {
    // ADD CHART AAPL / ADD QUOTE TSLA / ADD NEWS / ADD WATCH
    const cardType   = (parts[1] || 'quote').toLowerCase();
    const cardTicker = parts[2] || parts[1] || '';
    renderAddCmd(cardType, cardTicker);
    return;
  }

  if (COMMANDS[cmd]) {
    state.currentCommand = cmd;
    state.currentTicker = ticker;
    COMMANDS[cmd].fn(ticker);
  } else {
    // Try as ticker with DES
    if (cmd.length <= 6 && /^[A-Z0-9.\-^]+$/.test(cmd)) {
      state.currentCommand = 'DES';
      state.currentTicker = cmd;
      renderDES(cmd);
    } else {
      showError(`Unknown command: ${cmd}. Type HELP to see all commands.`);
    }
  }
}

// Expose for onclick in HTML
window.runCommand = (cmd) => {
  commandInput.value = cmd;
  executeCommand(cmd);
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function setStatus(msg) {
  statusMsg.textContent = msg;
}

function fmt(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtLarge(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3)  return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtVol(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9)  return `${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3)  return `${(abs / 1e3).toFixed(2)}K`;
  return String(abs);
}

function fmtPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return `${n > 0 ? '+' : ''}${Number(n).toFixed(2)}%`;
}

function colorClass(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return n > 0 ? 'positive' : n < 0 ? 'negative' : '';
}

function showLoading(msg = 'LOADING') {
  showContent();
  contentPanel.innerHTML = `<div class="loading">${msg}</div>`;
}

function showError(msg) {
  showContent();
  contentPanel.innerHTML = `<div class="error">ERROR: ${msg}</div>`;
  setStatus('Error');
}

async function apiFetch(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return dateStr; }
}

// ─── DES — COMPANY OVERVIEW ───────────────────────────────────────────────────
async function renderDES(ticker) {
  if (!ticker) { showError('Usage: DES <TICKER>  e.g. DES AAPL'); return; }
  showLoading(`LOADING ${ticker}`);

  try {
    const data = await apiFetch(`/api/quote/${ticker}`);
    const changeClass = colorClass(data.change);
    const changeSign  = data.change > 0 ? '+' : '';
    const yieldStr    = data.dividend_yield != null
      ? `${(data.dividend_yield * 100).toFixed(2)}%` : '—';

    contentPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-header">
          <span>DESCRIPTION</span>
          <span class="panel-ticker">${data.symbol}</span>
          <span class="dimmed" style="font-size:12px">${data.name}</span>
          ${data.exchange ? `<span class="dimmed" style="font-size:11px">· ${data.exchange}</span>` : ''}
        </div>

        <div style="display:flex; align-items:baseline; gap:16px; margin-bottom:20px;">
          <div class="price-big">${fmt(data.price)}</div>
          <div class="price-change ${changeClass}">
            ${changeSign}${fmt(data.change)} (${changeSign}${fmt(data.change_pct)}%)
          </div>
          <div class="dimmed" style="font-size:11px">${data.currency || 'USD'}</div>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-title">Key Statistics</div>
        <div class="grid-4">
          <div class="stat-box">
            <div class="stat-label">Market Cap</div>
            <div class="stat-value small">${fmtLarge(data.market_cap)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">P/E Ratio</div>
            <div class="stat-value small">${data.pe_ratio != null ? fmt(data.pe_ratio) : '—'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">EPS (TTM)</div>
            <div class="stat-value small">${data.eps != null ? fmt(data.eps) : '—'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Beta</div>
            <div class="stat-value small">${data.beta != null ? fmt(data.beta) : '—'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Volume</div>
            <div class="stat-value small">${fmtVol(data.volume)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Avg Volume</div>
            <div class="stat-value small">${fmtVol(data.avg_volume)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">52W High</div>
            <div class="stat-value small positive">${fmt(data.week_52_high)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">52W Low</div>
            <div class="stat-value small negative">${fmt(data.week_52_low)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Div Yield</div>
            <div class="stat-value small">${yieldStr}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Sector</div>
            <div class="stat-value small" style="font-size:11px">${data.sector || '—'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Industry</div>
            <div class="stat-value small" style="font-size:11px">${data.industry || '—'}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Exchange</div>
            <div class="stat-value small">${data.exchange || '—'}</div>
          </div>
        </div>
      </div>

      ${data.description ? `
      <div class="panel-section">
        <div class="section-title">About</div>
        <p class="company-description">${data.description}</p>
      </div>` : ''}

      <div class="panel-section" style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="tf-btn" onclick="runCommand('CHART ${data.symbol}')">CHART ${data.symbol}</button>
        <button class="tf-btn" onclick="runCommand('NEWS ${data.symbol}')">NEWS ${data.symbol}</button>
        <button class="tf-btn" onclick="runCommand('FIN ${data.symbol}')">FIN ${data.symbol}</button>
      </div>
    `;

    setStatus(`DES ${ticker} — ${data.name} · $${fmt(data.price)} ${changeSign}${fmtPct(data.change_pct)}`);
  } catch (err) {
    showError(`Could not load data for ${ticker}: ${err.message}`);
  }
}

// ─── CHART ────────────────────────────────────────────────────────────────────
let _chartInstance = null;

const TIMEFRAMES = [
  { label: '1D',  period: '1d',  interval: '5m'  },
  { label: '5D',  period: '5d',  interval: '15m' },
  { label: '1M',  period: '1mo', interval: '1d'  },
  { label: '3M',  period: '3mo', interval: '1d'  },
  { label: '6M',  period: '6mo', interval: '1d'  },
  { label: '1Y',  period: '1y',  interval: '1d'  },
  { label: '2Y',  period: '2y',  interval: '1wk' },
  { label: '5Y',  period: '5y',  interval: '1wk' },
];

async function renderChart(ticker, activePeriod = '1mo', activeInterval = '1d') {
  if (!ticker) { showError('Usage: CHART <TICKER>  e.g. CHART TSLA'); return; }

  // Destroy old chart
  if (_chartInstance) { try { _chartInstance.remove(); } catch (_) {} _chartInstance = null; }

  showLoading(`LOADING CHART ${ticker}`);

  try {
    const data = await apiFetch(`/api/chart/${ticker}?period=${activePeriod}&interval=${activeInterval}`);
    if (!data || data.length === 0) { showError(`No chart data for ${ticker}`); return; }

    const tfButtons = TIMEFRAMES.map(tf => `
      <button class="tf-btn ${tf.period === activePeriod ? 'active' : ''}"
              onclick="renderChart('${ticker}','${tf.period}','${tf.interval}')">
        ${tf.label}
      </button>
    `).join('');

    contentPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-header">
          <span>CHART</span>
          <span class="panel-ticker">${ticker}</span>
        </div>
        <div class="timeframe-bar">${tfButtons}</div>
        <div id="chart-container"></div>
        <div id="chart-info" style="margin-top:8px;font-size:11px;color:var(--text-dim);display:flex;gap:24px;"></div>
      </div>
    `;

    const container = document.getElementById('chart-container');
    const chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 420,
      layout: {
        background: { type: 'solid', color: '#0a0a0a' },
        textColor: '#666666',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: '#33E29A', labelBackgroundColor: '#33E29A' },
        horzLine: { color: '#33E29A', labelBackgroundColor: '#33E29A' },
      },
      rightPriceScale: {
        borderColor: '#1e1e1e',
        textColor: '#666',
      },
      timeScale: {
        borderColor: '#1e1e1e',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    _chartInstance = chart;

    // Candlestick series (v4+ API)
    const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor:        '#33E29A',
      downColor:      '#ff4455',
      borderUpColor:  '#33E29A',
      borderDownColor:'#ff4455',
      wickUpColor:    '#33E29A',
      wickDownColor:  '#ff4455',
    });
    candleSeries.setData(data);

    // Volume histogram (v4+ API)
    const volSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      color: '#1e1e1e',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    const volData = data.map(d => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? 'rgba(51,226,154,0.3)' : 'rgba(255,68,85,0.3)',
    }));
    volSeries.setData(volData);

    chart.timeScale().fitContent();

    // Responsive resize
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    // Crosshair info
    const chartInfo = document.getElementById('chart-info');
    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time) {
        chartInfo.innerHTML = '';
        return;
      }
      const ohlcv = param.seriesData.get(candleSeries);
      const vol   = param.seriesData.get(volSeries);
      if (ohlcv) {
        const changeColor = ohlcv.close >= ohlcv.open ? 'var(--positive)' : 'var(--negative)';
        chartInfo.innerHTML = `
          <span>O: <span style="color:${changeColor}">${fmt(ohlcv.open)}</span></span>
          <span>H: <span style="color:${changeColor}">${fmt(ohlcv.high)}</span></span>
          <span>L: <span style="color:${changeColor}">${fmt(ohlcv.low)}</span></span>
          <span>C: <span style="color:${changeColor}">${fmt(ohlcv.close)}</span></span>
          ${vol ? `<span>V: <span style="color:var(--text-dim)">${fmtVol(vol.value)}</span></span>` : ''}
        `;
      }
    });

    setStatus(`CHART ${ticker} — ${data.length} candles · ${activePeriod.toUpperCase()}`);
  } catch (err) {
    showError(`Could not load chart for ${ticker}: ${err.message}`);
  }
}

// ─── NEWS ─────────────────────────────────────────────────────────────────────
async function renderNews(ticker) {
  if (!ticker) { showError('Usage: NEWS <TICKER>  e.g. NEWS AAPL'); return; }
  showLoading(`LOADING NEWS ${ticker}`);

  try {
    const articles = await apiFetch(`/api/news/${ticker}`);

    if (!articles || articles.length === 0) {
      contentPanel.innerHTML = `
        <div class="panel-section">
          <div class="panel-header"><span>NEWS</span><span class="panel-ticker">${ticker}</span></div>
          <p class="dimmed">No news found for ${ticker}</p>
        </div>`;
      setStatus(`NEWS ${ticker} — No articles found`);
      return;
    }

    const items = articles.map(a => {
      const sentClass = a.sentiment === 'positive' ? 'badge-positive'
                      : a.sentiment === 'negative' ? 'badge-negative'
                      : 'badge-neutral';
      const timeStr = a.published_at ? timeAgo(a.published_at) : '';
      const escapedUrl  = (a.link || '').replace(/'/g, "\\'");
      const escapedTitle = (a.title || 'Untitled').replace(/'/g, "\\'");
      const titleHtml = a.link
        ? `<a href="#" onclick="event.preventDefault();_articleReturnFn=()=>{renderNews('${ticker}')};openArticle('${escapedUrl}','${escapedTitle}','${a.sentiment || ''}','${a.publisher || ''}','${a.published_at || ''}')">${a.title || 'Untitled'}</a>`
        : (a.title || 'Untitled');

      return `
        <div class="news-item">
          <div class="news-title">${titleHtml}</div>
          <div class="news-meta">
            ${a.publisher ? `<span>${a.publisher}</span>` : ''}
            ${timeStr ? `<span>${timeStr}</span>` : ''}
            ${a.sentiment ? `<span class="badge ${sentClass}">${a.sentiment}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Sentiment summary
    const counts = { positive: 0, neutral: 0, negative: 0 };
    articles.forEach(a => { if (a.sentiment) counts[a.sentiment]++; });
    const total = articles.length;

    contentPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-header">
          <span>NEWS</span>
          <span class="panel-ticker">${ticker}</span>
          <span class="dimmed" style="font-size:11px">${total} articles</span>
        </div>

        <div style="display:flex;gap:16px;margin-bottom:20px;font-size:12px;">
          <span>Sentiment:&nbsp;
            <span class="positive">${counts.positive} positive</span> ·
            <span class="dimmed">${counts.neutral} neutral</span> ·
            <span class="negative">${counts.negative} negative</span>
          </span>
        </div>

        <div>${items}</div>
      </div>
    `;

    setStatus(`NEWS ${ticker} — ${total} articles`);
  } catch (err) {
    showError(`Could not load news for ${ticker}: ${err.message}`);
  }
}

// ─── FINANCIALS ───────────────────────────────────────────────────────────────
async function renderFinancials(ticker, type = 'income', period = 'annual') {
  if (!ticker) { showError('Usage: FIN <TICKER>  e.g. FIN AAPL'); return; }
  showLoading(`LOADING FINANCIALS ${ticker}`);

  try {
    const data = await apiFetch(`/api/financials/${ticker}?type=${type}&period=${period}`);
    const stmt = data.data || {};

    const rows = Object.keys(stmt);
    const cols = rows.length > 0 ? Object.keys(stmt[rows[0]] || {}) : [];

    const tabHTML = (lbl, t) => `
      <button class="tab-btn ${type === t ? 'active' : ''}"
              onclick="renderFinancials('${ticker}','${t}','${period}')">
        ${lbl}
      </button>`;

    const periodHTML = (lbl, p) => `
      <button class="tab-btn ${period === p ? 'active' : ''}"
              onclick="renderFinancials('${ticker}','${type}','${p}')">
        ${lbl}
      </button>`;

    let tableHTML = '';
    if (rows.length === 0) {
      tableHTML = '<p class="dimmed">No data available.</p>';
    } else {
      const headerCells = cols.map(c => `<th class="fin-value">${c}</th>`).join('');
      const bodyRows = rows.map(row => {
        const cells = cols.map(col => {
          const val = stmt[row][col];
          return `<td class="fin-value">${fmtLarge(val)}</td>`;
        }).join('');
        return `<tr><td>${row}</td>${cells}</tr>`;
      }).join('');

      tableHTML = `
        <div style="overflow-x:auto">
          <table class="fin-table">
            <thead><tr><th>Item</th>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>`;
    }

    contentPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-header">
          <span>FINANCIALS</span>
          <span class="panel-ticker">${ticker}</span>
        </div>

        <div class="tab-bar">
          ${tabHTML('Income Statement', 'income')}
          ${tabHTML('Balance Sheet', 'balance')}
          ${tabHTML('Cash Flow', 'cashflow')}
          <div style="margin-left:auto;display:flex;">
            ${periodHTML('Annual', 'annual')}
            ${periodHTML('Quarterly', 'quarterly')}
          </div>
        </div>

        ${tableHTML}
      </div>
    `;

    setStatus(`FIN ${ticker} — ${type} · ${period}`);
  } catch (err) {
    showError(`Could not load financials for ${ticker}: ${err.message}`);
  }
}

// ─── MOST ACTIVE / GAINERS / LOSERS ───────────────────────────────────────────
async function renderMost(_, tab = 'active') {
  showLoading('LOADING MARKET MOVERS');

  try {
    const endpoint = tab === 'gainers' ? 'gainers'
                   : tab === 'losers'  ? 'losers'
                   : 'active';

    const stocks = await apiFetch(`/api/screen/${endpoint}`);

    const tabHTML = (lbl, t) => `
      <button class="tab-btn ${tab === t ? 'active' : ''}"
              onclick="renderMost(null,'${t}')">
        ${lbl}
      </button>`;

    const rows = stocks.map(s => {
      const cc = colorClass(s.change_pct);
      const sign = s.change > 0 ? '+' : '';
      return `
        <tr onclick="runCommand('DES ${s.symbol}')" style="cursor:pointer;">
          <td class="accent" style="font-weight:600">${s.symbol}</td>
          <td class="dimmed" style="font-size:11px">${s.name || ''}</td>
          <td>${fmt(s.price)}</td>
          <td class="${cc}">${sign}${fmt(s.change)}</td>
          <td class="${cc}">${fmtPct(s.change_pct)}</td>
          <td class="dimmed">${fmtVol(s.volume)}</td>
          <td class="dimmed">${fmtLarge(s.market_cap)}</td>
        </tr>`;
    }).join('');

    contentPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-header"><span>MARKET MOVERS</span></div>

        <div class="tab-bar">
          ${tabHTML('Most Active', 'active')}
          ${tabHTML('Top Gainers', 'gainers')}
          ${tabHTML('Top Losers', 'losers')}
        </div>

        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Name</th>
              <th>Price</th>
              <th>Change</th>
              <th>Chg%</th>
              <th>Volume</th>
              <th>Mkt Cap</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    setStatus(`MOST — ${tab.toUpperCase()} · ${stocks.length} results`);
  } catch (err) {
    showError(`Could not load market movers: ${err.message}`);
  }
}

// ─── HELP ─────────────────────────────────────────────────────────────────────
function renderHelp() {
  const cmds = Object.entries(COMMANDS).map(([cmd, info]) => `
    <div class="help-row">
      <span class="help-cmd">${cmd}</span>
      <span class="help-desc">${info.usage} — ${info.desc}</span>
    </div>
  `).join('');

  contentPanel.innerHTML = `
    <div class="panel-section">
      <div class="panel-header"><span>HELP</span></div>

      <div class="section-title" style="margin-bottom:12px;">Commands</div>
      <div class="help-grid">${cmds}</div>

      <div class="section-title" style="margin-top:24px;margin-bottom:12px;">Keyboard Shortcuts</div>
      <div class="shortcut-list">
        <div class="shortcut-row">
          <span class="shortcut-key">\`</span>
          <span class="dimmed">Open command bar</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">/</span>
          <span class="dimmed">Open command bar</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">ESC</span>
          <span class="dimmed">Close command bar</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">↑ / ↓</span>
          <span class="dimmed">Navigate autocomplete / history</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">TAB</span>
          <span class="dimmed">Accept autocomplete suggestion</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">ENTER</span>
          <span class="dimmed">Execute command</span>
        </div>
      </div>

      <div class="section-title" style="margin-top:24px;margin-bottom:12px;">Examples</div>
      <div class="help-grid">
        <div class="help-row" style="cursor:pointer" onclick="runCommand('DES AAPL')">
          <span class="help-cmd accent">DES AAPL</span>
          <span class="help-desc">Apple Inc. overview</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('CHART NVDA')">
          <span class="help-cmd accent">CHART NVDA</span>
          <span class="help-desc">NVIDIA price chart</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('NEWS TSLA')">
          <span class="help-cmd accent">NEWS TSLA</span>
          <span class="help-desc">Tesla latest news</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('FIN MSFT')">
          <span class="help-cmd accent">FIN MSFT</span>
          <span class="help-desc">Microsoft financials</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('MOST')">
          <span class="help-cmd accent">MOST</span>
          <span class="help-desc">Market movers</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('DES BTC-USD')">
          <span class="help-cmd accent">DES BTC-USD</span>
          <span class="help-desc">Bitcoin price</span>
        </div>
      </div>
    </div>
  `;

  setStatus('HELP — All commands listed');
}

// ─── CLOCK ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const clock = document.getElementById('clock');
  if (clock) {
    clock.textContent = now.toLocaleTimeString('en-US', {
      hour12: false,
      timeZoneName: 'short',
    });
  }
}

setInterval(updateClock, 1000);
updateClock();

// ─── MARKET STATUS ────────────────────────────────────────────────────────────
function updateMarketStatus() {
  const dot   = document.getElementById('market-status-dot');
  const label = document.getElementById('market-status-label');
  if (!dot || !label) return;

  const now = new Date();
  const nyNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day  = nyNow.getDay(); // 0=Sun, 6=Sat
  const hour = nyNow.getHours();
  const min  = nyNow.getMinutes();
  const hhmm = hour * 60 + min;

  const isWeekend = day === 0 || day === 6;
  const isPremarket  = !isWeekend && hhmm >= 4 * 60 && hhmm < 9 * 60 + 30;
  const isOpen       = !isWeekend && hhmm >= 9 * 60 + 30 && hhmm < 16 * 60;
  const isAfterHours = !isWeekend && hhmm >= 16 * 60 && hhmm < 20 * 60;

  dot.className = 'status-dot';

  if (isOpen) {
    dot.classList.add('open');
    label.textContent = 'MARKET OPEN';
    label.style.color = 'var(--positive)';
  } else if (isPremarket) {
    dot.classList.add('pre');
    label.textContent = 'PRE-MARKET';
    label.style.color = 'var(--warning)';
  } else if (isAfterHours) {
    dot.classList.add('pre');
    label.textContent = 'AFTER HOURS';
    label.style.color = 'var(--warning)';
  } else {
    dot.classList.add('closed');
    label.textContent = 'MARKET CLOSED';
    label.style.color = 'var(--text-dim)';
  }
}

setInterval(updateMarketStatus, 30000);
updateMarketStatus();

// ─── ARTICLE READER ───────────────────────────────────────────────────────────

// Track where to return when user presses Back
let _articleReturnFn = null;

async function openArticle(url, title, sentiment, source, publishedAt) {
  if (!url) return;

  // Remember what to go back to
  _articleReturnFn = _articleReturnFn || (() => showDashboard());

  showArticleReader();
  setStatus(`Loading article…`);

  const sentClass = sentiment === 'positive' ? 'positive'
                  : sentiment === 'negative' ? 'negative' : 'neutral';
  const sentLabel = sentiment || 'neutral';

  // Show skeleton while fetching
  articleReader.innerHTML = `
    <div class="ar-topbar">
      <button class="ar-back" onclick="closeArticle()">← BACK</button>
      ${source ? `<span class="ar-source-badge">${source}</span>` : ''}
      <span class="ar-sentiment ${sentClass}">${sentLabel}</span>
      ${publishedAt ? `<span class="dimmed" style="font-size:10px">${timeAgo(publishedAt)}</span>` : ''}
      <a class="ar-open-btn" href="${url}" target="_blank" rel="noopener">OPEN IN BROWSER ↗</a>
    </div>
    <div class="ar-loading">Fetching article</div>
  `;

  try {
    const data = await apiFetch(`/api/article/preview?url=${encodeURIComponent(url)}`);

    const heroHtml = data.image
      ? `<img class="ar-hero" src="${data.image}" alt="" onerror="this.style.display='none'" />`
      : '';

    let parasHtml;
    if (data.blocked) {
      parasHtml = `
        <div class="ar-blocked">
          <div class="ar-blocked-icon">⊘</div>
          <div class="ar-blocked-msg">This publisher requires browser access (cookie consent / paywall).</div>
          <a class="ar-blocked-btn" href="${url}" target="_blank" rel="noopener">Open Full Article ↗</a>
        </div>`;
    } else if (data.paragraphs && data.paragraphs.length) {
      parasHtml = `<div class="ar-paragraphs">${data.paragraphs.map(p => `<p class="ar-paragraph">${p}</p>`).join('')}</div>`;
    } else {
      parasHtml = `<p class="ar-no-content">Article body could not be extracted — the source may use JavaScript rendering.</p>`;
    }

    const displayTitle = data.title || title || 'Article';
    const siteName     = data.site_name || source || '';

    articleReader.innerHTML = `
      <div class="ar-topbar">
        <button class="ar-back" onclick="closeArticle()">← BACK</button>
        ${siteName ? `<span class="ar-source-badge">${siteName}</span>` : ''}
        <span class="ar-sentiment ${sentClass}">${sentLabel}</span>
        ${publishedAt ? `<span class="dimmed" style="font-size:10px">${timeAgo(publishedAt)}</span>` : ''}
        <a class="ar-open-btn" href="${url}" target="_blank" rel="noopener">OPEN IN BROWSER ↗</a>
      </div>
      ${heroHtml}
      <div class="ar-body">
        <h1 class="ar-title">${displayTitle}</h1>
        ${data.description ? `<p class="ar-description">${data.description}</p>` : ''}
        ${parasHtml}
      </div>
    `;

    setStatus(`${siteName ? siteName + ' · ' : ''}${displayTitle.slice(0, 60)}`);
  } catch (err) {
    articleReader.querySelector('.ar-loading')?.remove();
    articleReader.insertAdjacentHTML('beforeend',
      `<div class="ar-error">Could not load article: ${err.message}</div>
       <div class="ar-body"><h1 class="ar-title">${title || 'Article'}</h1></div>`
    );
  }
}

function closeArticle() {
  articleReader.classList.remove('visible');
  articleReader.style.display = 'none';
  // Return to wherever we came from
  if (_articleReturnFn) {
    _articleReturnFn();
    _articleReturnFn = null;
  } else {
    showDashboard();
  }
}

// Expose for inline onclick handlers
window.openArticle  = openArticle;
window.closeArticle = closeArticle;

// ─── INIT ─────────────────────────────────────────────────────────────────────
initDashboard();
setStatus("Dashboard — Press \` to enter a command");

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD ENGINE
   ═══════════════════════════════════════════════════════════════════════════ */

// (_cards, _cardCharts, _cardTimers declared at top of file)

// ─── VIEW SWITCHER ───────────────────────────────────────────────────────────
function showDashboard() {
  dashboardView.style.display = 'block';
  contentPanel.style.display  = 'none';
  articleReader.classList.remove('visible');
  articleReader.style.display = 'none';
  setStatus("Dashboard — Press \` to enter a command");
}

function showContent() {
  dashboardView.style.display = 'none';
  articleReader.classList.remove('visible');
  articleReader.style.display = 'none';
  contentPanel.style.display  = 'block';
}

function showArticleReader() {
  dashboardView.style.display = 'none';
  contentPanel.style.display  = 'none';
  articleReader.style.display = 'flex';
  articleReader.classList.add('visible');
}

// ─── PERSISTENCE ─────────────────────────────────────────────────────────────
function saveCards() {
  localStorage.setItem('terminal_cards', JSON.stringify(_cards));
}

function defaultCards() {
  return [
    { id: 'def_chart_spy',  type: 'chart',  ticker: 'SPY',    x: 16,  y: 16,  w: 460, h: 280 },
    { id: 'def_quote_aapl', type: 'quote',  ticker: 'AAPL',   x: 492, y: 16,  w: 220, h: 158 },
    { id: 'def_quote_nvda', type: 'quote',  ticker: 'NVDA',   x: 728, y: 16,  w: 220, h: 158 },
    { id: 'def_news_aapl',  type: 'news',   ticker: 'AAPL',   x: 492, y: 190, w: 456, h: 310 },
    { id: 'def_watch',      type: 'watch',  ticker: '',       x: 16,  y: 312, w: 220, h: 310 },
  ];
}

function initDashboard() {
  try {
    const saved = localStorage.getItem('terminal_cards');
    _cards = saved ? JSON.parse(saved) : defaultCards();
  } catch (_) {
    _cards = defaultCards();
  }
  renderDashboard();
}

// ─── RENDER ALL CARDS ─────────────────────────────────────────────────────────
function renderDashboard() {
  // Teardown existing timers & charts
  Object.values(_cardTimers).forEach(t => clearInterval(t));
  Object.values(_cardCharts).forEach(ch => { try { ch.remove(); } catch (_) {} });
  _cardTimers = {};
  _cardCharts = {};
  canvas.innerHTML = '';

  _cards.forEach(card => mountCard(card, false));
}

// ─── MOUNT A SINGLE CARD ──────────────────────────────────────────────────────
function mountCard(card, animate = true) {
  const el = document.createElement('div');
  el.className = 'card' + (animate ? ' card-new' : '');
  el.id = `card_${card.id}`;
  el.dataset.type = card.type;
  el.style.left   = card.x + 'px';
  el.style.top    = card.y + 'px';
  el.style.width  = card.w + 'px';
  el.style.height = card.h + 'px';

  const typeLabel = { chart: 'CHART', quote: 'QUOTE', news: 'NEWS', watch: 'WATCH' }[card.type] || card.type.toUpperCase();

  el.innerHTML = `
    <div class="card-header">
      <span class="card-drag-handle" title="Drag to move">⠿</span>
      <span class="card-type-label">${typeLabel}</span>
      ${card.ticker ? `<span class="card-ticker-label">${card.ticker}</span>` : '<span class="card-ticker-label">WATCHLIST</span>'}
      <span class="card-actions">
        <span class="card-btn card-refresh" title="Refresh" onclick="refreshCard('${card.id}')">↻</span>
        <span class="card-btn card-close"   title="Remove"  onclick="removeCard('${card.id}')">×</span>
      </span>
    </div>
    <div class="card-body" id="body_${card.id}">
      <div class="card-loading">LOADING</div>
    </div>
    <div class="card-resize-handle"></div>
  `;

  canvas.appendChild(el);
  initDrag(el, card);
  initResize(el, card);
  loadCardContent(card);
  initAutoRefresh(card);
}

// ─── DRAG ────────────────────────────────────────────────────────────────────
function initDrag(el, card) {
  const handle = el.querySelector('.card-drag-handle');
  let ox, oy, ox0, oy0;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    ox = e.clientX; oy = e.clientY;
    ox0 = card.x;   oy0 = card.y;
    el.classList.add('dragging');
    el.style.zIndex = 999;

    function onMove(e) {
      card.x = Math.max(0, ox0 + e.clientX - ox);
      card.y = Math.max(0, oy0 + e.clientY - oy);
      el.style.left = card.x + 'px';
      el.style.top  = card.y + 'px';
    }
    function onUp() {
      el.classList.remove('dragging');
      el.style.zIndex = '';
      saveCards();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ─── RESIZE ───────────────────────────────────────────────────────────────────
function initResize(el, card) {
  const handle = el.querySelector('.card-resize-handle');
  let sx, sy, sw, sh;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    sx = e.clientX; sy = e.clientY;
    sw = card.w;    sh = card.h;

    function onMove(e) {
      card.w = Math.max(200, sw + e.clientX - sx);
      card.h = Math.max(120, sh + e.clientY - sy);
      el.style.width  = card.w + 'px';
      el.style.height = card.h + 'px';
      // Notify chart of new dimensions
      if (_cardCharts[card.id]) {
        const body = document.getElementById(`body_${card.id}`);
        if (body) _cardCharts[card.id].applyOptions({ width: body.clientWidth, height: body.clientHeight });
      }
    }
    function onUp() {
      saveCards();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ─── CONTENT LOADING ─────────────────────────────────────────────────────────
async function loadCardContent(card) {
  const body = document.getElementById(`body_${card.id}`);
  if (!body) return;
  try {
    if (card.type === 'chart') await loadChartCard(card, body);
    else if (card.type === 'quote') await loadQuoteCard(card, body);
    else if (card.type === 'news')  await loadNewsCard(card, body);
    else if (card.type === 'watch') await loadWatchCard(card, body);
  } catch (err) {
    body.innerHTML = `<div class="card-err">⚠ ${err.message}</div>`;
  }
}

function refreshCard(id) {
  const card = _cards.find(c => c.id === id);
  if (!card) return;
  if (_cardCharts[id]) { try { _cardCharts[id].remove(); } catch (_) {} delete _cardCharts[id]; }
  const body = document.getElementById(`body_${id}`);
  if (body) body.innerHTML = '<div class="card-loading">LOADING</div>';
  loadCardContent(card);
}

function removeCard(id) {
  if (_cardTimers[id]) { clearInterval(_cardTimers[id]); delete _cardTimers[id]; }
  if (_cardCharts[id]) { try { _cardCharts[id].remove(); } catch (_) {} delete _cardCharts[id]; }
  const el = document.getElementById(`card_${id}`);
  if (el) el.remove();
  _cards = _cards.filter(c => c.id !== id);
  saveCards();
}

function initAutoRefresh(card) {
  const ms = { chart: 90000, quote: 15000, news: 120000, watch: 20000 }[card.type] || 60000;
  _cardTimers[card.id] = setInterval(() => {
    if (!document.getElementById(`card_${card.id}`)) {
      clearInterval(_cardTimers[card.id]);
      return;
    }
    // Charts refresh on demand only; others refresh silently
    if (card.type === 'quote' || card.type === 'watch' || card.type === 'news') {
      loadCardContent(card);
    }
  }, ms);
}

// ─── CHART CARD ───────────────────────────────────────────────────────────────
async function loadChartCard(card, body) {
  const data = await apiFetch(`/api/chart/${card.ticker}?period=1mo&interval=1d`);
  if (!data || !data.length) { body.innerHTML = `<div class="card-err">No data for ${card.ticker}</div>`; return; }

  body.innerHTML = `<div data-cc style="width:100%;height:100%;"></div>`;
  const container = body.querySelector('[data-cc]');

  // Destroy previous instance if any
  if (_cardCharts[card.id]) { try { _cardCharts[card.id].remove(); } catch (_) {} }

  const chart = LightweightCharts.createChart(container, {
    width:  body.clientWidth,
    height: body.clientHeight,
    layout: { background: { type: 'solid', color: '#0d0d0d' }, textColor: '#444' },
    grid:   { vertLines: { color: '#161616' }, horzLines: { color: '#161616' } },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: '#33E29A', labelBackgroundColor: '#33E29A' },
      horzLine: { color: '#33E29A', labelBackgroundColor: '#33E29A' },
    },
    rightPriceScale: { borderColor: '#1e1e1e', textColor: '#444' },
    timeScale: { borderColor: '#1e1e1e', timeVisible: true },
    handleScroll: { mouseWheel: true },
    handleScale:  { mouseWheel: true },
  });

  const candles = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: '#33E29A', downColor: '#ff4455',
    borderUpColor: '#33E29A', borderDownColor: '#ff4455',
    wickUpColor: '#33E29A', wickDownColor: '#ff4455',
  });
  candles.setData(data);

  const volSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'vol',
  });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  volSeries.setData(data.map(d => ({
    time: d.time, value: d.volume,
    color: d.close >= d.open ? 'rgba(51,226,154,0.25)' : 'rgba(255,68,85,0.25)',
  })));

  chart.timeScale().fitContent();
  _cardCharts[card.id] = chart;

  // Auto-size when card body changes
  new ResizeObserver(() => {
    if (_cardCharts[card.id]) {
      _cardCharts[card.id].applyOptions({ width: body.clientWidth, height: body.clientHeight });
    }
  }).observe(body);
}

// ─── QUOTE CARD ───────────────────────────────────────────────────────────────
async function loadQuoteCard(card, body) {
  const d  = await apiFetch(`/api/quote/${card.ticker}`);
  const cc = d.change >= 0 ? 'positive' : 'negative';
  const sg = d.change >= 0 ? '+' : '';
  const pct52 = (d.week_52_high && d.week_52_low && d.price)
    ? Math.min(100, Math.max(0, ((d.price - d.week_52_low) / (d.week_52_high - d.week_52_low)) * 100)).toFixed(0)
    : null;

  body.innerHTML = `
    <div class="qcard-price ${cc}">${fmt(d.price)}</div>
    <div class="qcard-change ${cc}">${sg}${fmt(d.change)} <span class="qcard-pct">(${fmtPct(d.change_pct)})</span></div>
    ${d.name ? `<div class="qcard-name">${d.name}</div>` : ''}
    ${pct52 !== null ? `
      <div class="qcard-range">
        <div class="range-bar"><div class="range-fill" style="width:${pct52}%"></div></div>
        <div class="range-labels">
          <span>${fmt(d.week_52_low)}</span>
          <span class="dimmed" style="font-size:9px">52W</span>
          <span>${fmt(d.week_52_high)}</span>
        </div>
      </div>` : ''}
    <div class="qcard-vol dimmed">Vol ${fmtVol(d.volume)}</div>
  `;
}

// ─── NEWS CARD ────────────────────────────────────────────────────────────────
async function loadNewsCard(card, body) {
  const articles = await apiFetch(`/api/news/${card.ticker || 'SPY'}`);
  if (!articles || !articles.length) { body.innerHTML = '<div class="card-err">No news found</div>'; return; }

  const items = articles.slice(0, 15).map(a => {
    const dot = a.sentiment === 'positive' ? 'dot-pos' : a.sentiment === 'negative' ? 'dot-neg' : 'dot-neu';
    const escapedUrl   = (a.link  || '').replace(/'/g, "\\'");
    const escapedTitle = (a.title || 'Untitled').replace(/'/g, "\\'");
    const titleHtml = a.link
      ? `<a href="#" onclick="event.preventDefault();_articleReturnFn=()=>showDashboard();openArticle('${escapedUrl}','${escapedTitle}','${a.sentiment || ''}','${a.publisher || ''}','${a.published_at || ''}')">${a.title || 'Untitled'}</a>`
      : (a.title || 'Untitled');
    return `
      <div class="ncard-item">
        <span class="sent-dot ${dot}"></span>
        <div class="ncard-title">${titleHtml}</div>
      </div>`;
  }).join('');

  body.innerHTML = `<div class="ncard-list">${items}</div>`;
}

// ─── WATCHLIST CARD ───────────────────────────────────────────────────────────
const WATCH_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'BTC-USD', 'AMZN'];

async function loadWatchCard(card, body) {
  const rows = await Promise.all(WATCH_TICKERS.map(async sym => {
    try {
      const d  = await apiFetch(`/api/quote/${sym}`);
      const cc = d.change >= 0 ? 'positive' : 'negative';
      return `
        <div class="wcard-row" onclick="runCommand('DES ${sym}')" title="Open ${sym}">
          <span class="wcard-sym">${sym}</span>
          <span class="wcard-price">${fmt(d.price)}</span>
          <span class="wcard-chg ${cc}">${fmtPct(d.change_pct)}</span>
        </div>`;
    } catch { return ''; }
  }));
  body.innerHTML = `<div class="wcard-list">${rows.join('')}</div>`;
}

// ─── ADD COMMAND ──────────────────────────────────────────────────────────────
function renderAddCmd(typeOrRaw, ticker) {
  // Normalise: "ADD CHART AAPL" arrives as typeOrRaw='chart', ticker='AAPL'
  // "ADD AAPL" (no type) — treat as quote
  const TYPES = ['chart', 'quote', 'news', 'watch'];
  let type   = (typeOrRaw || '').toLowerCase();
  let symbol = (ticker || '').toUpperCase();

  if (!TYPES.includes(type)) {
    // typeOrRaw might actually be a ticker symbol
    symbol = type.toUpperCase();
    type   = 'quote';
  }

  if ((type === 'chart' || type === 'quote' || type === 'news') && !symbol) {
    showError(`Usage: ADD ${type.toUpperCase()} <TICKER>  e.g. ADD ${type.toUpperCase()} AAPL`);
    return;
  }

  const id = `c_${Date.now()}`;
  const dims = { chart: { w: 460, h: 280 }, quote: { w: 220, h: 160 }, news: { w: 320, h: 360 }, watch: { w: 220, h: 320 } };
  const { w, h } = dims[type] || { w: 300, h: 250 };

  // Stagger new cards so they don't pile directly on top of each other
  const n = _cards.length;
  const x = 80 + (n % 4) * 40;
  const y = 80 + (n % 4) * 40;

  const card = { id, type, ticker: symbol, x, y, w, h };
  _cards.push(card);
  saveCards();
  showDashboard();
  mountCard(card, true);
  setStatus(`Added ${type.toUpperCase()}${symbol ? ' · ' + symbol : ''} card to dashboard`);
}
