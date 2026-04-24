// Dashboard engine: mount/drag/resize/auto-refresh for the canvas cards.
// Card-body rendering for each type lives in ./cards/*.js.
import { dashboard } from '../state.js';
import { canvas } from '../dom.js';
import { initDrag, initResize } from './drag-resize.js';
import loadChartCard from './cards/chart.js';
import loadQuoteCard from './cards/quote.js';
import loadNewsCard  from './cards/news.js';
import loadWatchCard from './cards/watch.js';

const REFRESH_MS = { chart: 90000, quote: 15000, news: 120000, watch: 20000 };

const CARD_DIMS = {
  chart: { w: 460, h: 280 },
  quote: { w: 220, h: 160 },
  news:  { w: 320, h: 360 },
  watch: { w: 220, h: 320 },
};

export function saveCards() {
  localStorage.setItem('terminal_cards', JSON.stringify(dashboard.cards));
}

export function cardDims(type) {
  return CARD_DIMS[type] || { w: 300, h: 250 };
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

export function initDashboard() {
  try {
    const saved = localStorage.getItem('terminal_cards');
    dashboard.cards = saved ? JSON.parse(saved) : defaultCards();
  } catch (_) {
    dashboard.cards = defaultCards();
  }
  renderDashboard();
}

export function renderDashboard() {
  Object.values(dashboard.timers).forEach(t => clearInterval(t));
  Object.values(dashboard.charts).forEach(ch => { try { ch.remove(); } catch (_) {} });
  dashboard.timers = {};
  dashboard.charts = {};
  canvas.innerHTML = '';

  dashboard.cards.forEach(card => mountCard(card, false));
}

export function mountCard(card, animate = true) {
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
        <span class="card-btn card-refresh" title="Refresh" data-action="card-refresh" data-card="${card.id}">↻</span>
        <span class="card-btn card-close"   title="Remove"  data-action="card-remove"  data-card="${card.id}">×</span>
      </span>
    </div>
    <div class="card-body" id="body_${card.id}">
      <div class="card-loading">LOADING</div>
    </div>
    <div class="card-resize-handle"></div>
  `;

  canvas.appendChild(el);
  initDrag(el, card, saveCards);
  initResize(el, card, saveCards);
  loadCardContent(card);
  initAutoRefresh(card);
}

async function loadCardContent(card) {
  const body = document.getElementById(`body_${card.id}`);
  if (!body) return;
  try {
    if (card.type === 'chart')      await loadChartCard(card, body);
    else if (card.type === 'quote') await loadQuoteCard(card, body);
    else if (card.type === 'news')  await loadNewsCard(card, body);
    else if (card.type === 'watch') await loadWatchCard(card, body);
  } catch (err) {
    body.innerHTML = `<div class="card-err">⚠ ${err.message}</div>`;
  }
}

export function refreshCard(id) {
  const card = dashboard.cards.find(c => c.id === id);
  if (!card) return;
  if (dashboard.charts[id]) { try { dashboard.charts[id].remove(); } catch (_) {} delete dashboard.charts[id]; }
  const body = document.getElementById(`body_${id}`);
  if (body) body.innerHTML = '<div class="card-loading">LOADING</div>';
  loadCardContent(card);
}

export function removeCard(id) {
  if (dashboard.timers[id]) { clearInterval(dashboard.timers[id]); delete dashboard.timers[id]; }
  if (dashboard.charts[id]) { try { dashboard.charts[id].remove(); } catch (_) {} delete dashboard.charts[id]; }
  const el = document.getElementById(`card_${id}`);
  if (el) el.remove();
  dashboard.cards = dashboard.cards.filter(c => c.id !== id);
  saveCards();
}

function initAutoRefresh(card) {
  const ms = REFRESH_MS[card.type] || 60000;
  dashboard.timers[card.id] = setInterval(() => {
    if (!document.getElementById(`card_${card.id}`)) {
      clearInterval(dashboard.timers[card.id]);
      return;
    }
    // Charts refresh on demand only; others refresh silently.
    if (card.type === 'quote' || card.type === 'watch' || card.type === 'news') {
      loadCardContent(card);
    }
  }, ms);
}
