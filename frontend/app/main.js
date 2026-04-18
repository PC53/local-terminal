/* ═══════════════════════════════════════════════════════════
   LOCAL TERMINAL — main.js  (ES module entry point)

   Responsibilities kept here (for now):
   - Dashboard engine (mount/drag/resize/auto-refresh)   → Phase 4
   - Article reader (open/close, return-fn)              → Phase 5
   - Clock + market-status ticker
   - ADD command (coupled to the dashboard engine)
   - Bootstrap: register ADD/DASH, wire command-bar, init dashboard
   - window.* shim for inline onclick= handlers          → Phase 6
   ═══════════════════════════════════════════════════════════ */
import { dashboard } from './state.js';
import { canvas, articleReader } from './dom.js';
import { fmt, fmtVol, fmtPct, apiFetch, timeAgo } from './utils.js';
import { setStatus, showDashboard, showArticleReader, showError } from './views.js';
import { createPriceChart } from './chart-builder.js';
import { bindKeyboard, executeCommand, runCommand } from './command-bar.js';
import {
  COMMANDS, register,
  renderChart, renderNews, renderFinancials, renderMost,
} from './commands/registry.js';

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

  const now   = new Date();
  const nyNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day   = nyNow.getDay(); // 0=Sun, 6=Sat
  const hour  = nyNow.getHours();
  const min   = nyNow.getMinutes();
  const hhmm  = hour * 60 + min;

  const isWeekend    = day === 0 || day === 6;
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
// _articleReturnFn lives on `window` so inline onclick strings can assign to it.
window._articleReturnFn = null;

async function openArticle(url, title, sentiment, source, publishedAt) {
  if (!url) return;

  window._articleReturnFn = window._articleReturnFn || (() => showDashboard());

  showArticleReader();
  setStatus(`Loading article…`);

  const sentClass = sentiment === 'positive' ? 'positive'
                  : sentiment === 'negative' ? 'negative' : 'neutral';
  const sentLabel = sentiment || 'neutral';

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
  if (window._articleReturnFn) {
    window._articleReturnFn();
    window._articleReturnFn = null;
  } else {
    showDashboard();
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD ENGINE
   ═══════════════════════════════════════════════════════════════════════════ */

function saveCards() {
  localStorage.setItem('terminal_cards', JSON.stringify(dashboard.cards));
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
    dashboard.cards = saved ? JSON.parse(saved) : defaultCards();
  } catch (_) {
    dashboard.cards = defaultCards();
  }
  renderDashboard();
}

function renderDashboard() {
  Object.values(dashboard.timers).forEach(t => clearInterval(t));
  Object.values(dashboard.charts).forEach(ch => { try { ch.remove(); } catch (_) {} });
  dashboard.timers = {};
  dashboard.charts = {};
  canvas.innerHTML = '';

  dashboard.cards.forEach(card => mountCard(card, false));
}

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
      if (dashboard.charts[card.id]) {
        const body = document.getElementById(`body_${card.id}`);
        if (body) dashboard.charts[card.id].applyOptions({ width: body.clientWidth, height: body.clientHeight });
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
  const card = dashboard.cards.find(c => c.id === id);
  if (!card) return;
  if (dashboard.charts[id]) { try { dashboard.charts[id].remove(); } catch (_) {} delete dashboard.charts[id]; }
  const body = document.getElementById(`body_${id}`);
  if (body) body.innerHTML = '<div class="card-loading">LOADING</div>';
  loadCardContent(card);
}

function removeCard(id) {
  if (dashboard.timers[id]) { clearInterval(dashboard.timers[id]); delete dashboard.timers[id]; }
  if (dashboard.charts[id]) { try { dashboard.charts[id].remove(); } catch (_) {} delete dashboard.charts[id]; }
  const el = document.getElementById(`card_${id}`);
  if (el) el.remove();
  dashboard.cards = dashboard.cards.filter(c => c.id !== id);
  saveCards();
}

function initAutoRefresh(card) {
  const ms = { chart: 90000, quote: 15000, news: 120000, watch: 20000 }[card.type] || 60000;
  dashboard.timers[card.id] = setInterval(() => {
    if (!document.getElementById(`card_${card.id}`)) {
      clearInterval(dashboard.timers[card.id]);
      return;
    }
    // Charts refresh on demand only; others refresh silently
    if (card.type === 'quote' || card.type === 'watch' || card.type === 'news') {
      loadCardContent(card);
    }
  }, ms);
}

// ─── CARD LOADERS ─────────────────────────────────────────────────────────────
async function loadChartCard(card, body) {
  const data = await apiFetch(`/api/chart/${card.ticker}?period=1mo&interval=1d`);
  if (!data || !data.length) { body.innerHTML = `<div class="card-err">No data for ${card.ticker}</div>`; return; }

  body.innerHTML = `<div data-cc style="width:100%;height:100%;"></div>`;
  const container = body.querySelector('[data-cc]');

  if (dashboard.charts[card.id]) { try { dashboard.charts[card.id].remove(); } catch (_) {} }

  const { chart } = createPriceChart({
    container, data, theme: 'card',
    width: body.clientWidth, height: body.clientHeight,
  });
  dashboard.charts[card.id] = chart;

  new ResizeObserver(() => {
    if (dashboard.charts[card.id]) {
      dashboard.charts[card.id].applyOptions({ width: body.clientWidth, height: body.clientHeight });
    }
  }).observe(body);
}

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

// ─── ADD COMMAND (tied to dashboard engine; lives here until Phase 4) ─────────
function renderAddCmd(typeOrRaw, ticker) {
  // "ADD CHART AAPL" arrives as typeOrRaw='chart', ticker='AAPL'
  // "ADD AAPL" (no type) — treat as quote
  const TYPES = ['chart', 'quote', 'news', 'watch'];
  let type   = (typeOrRaw || '').toLowerCase();
  let symbol = (ticker || '').toUpperCase();

  if (!TYPES.includes(type)) {
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
  const n = dashboard.cards.length;
  const x = 80 + (n % 4) * 40;
  const y = 80 + (n % 4) * 40;

  const card = { id, type, ticker: symbol, x, y, w, h };
  dashboard.cards.push(card);
  saveCards();
  showDashboard();
  mountCard(card, true);
  setStatus(`Added ${type.toUpperCase()}${symbol ? ' · ' + symbol : ''} card to dashboard`);
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
register('ADD',  renderAddCmd);
register('DASH', showDashboard);

bindKeyboard();
initDashboard();
setStatus("Dashboard — Press ` to enter a command");

// ─── GLOBAL EXPOSURE FOR INLINE onclick HANDLERS ──────────────────────────────
// Removed in Phase 6 once all inline handlers switch to event delegation.
window.runCommand       = runCommand;
window.showDashboard    = showDashboard;
window.openArticle      = openArticle;
window.closeArticle     = closeArticle;
window.renderChart      = renderChart;
window.renderNews       = renderNews;
window.renderFinancials = renderFinancials;
window.renderMost       = renderMost;
window.refreshCard      = refreshCard;
window.removeCard       = removeCard;
