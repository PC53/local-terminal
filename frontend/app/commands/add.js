import { dashboard } from '../state.js';
import { setStatus, showDashboard, showError } from '../views.js';
import { mountCard, saveCards, cardDims } from '../dashboard/engine.js';

export const meta = {
  desc:  'Add a widget card to the dashboard',
  usage: 'ADD CHART|QUOTE|NEWS|WATCH <TKR>',
};

const TYPES = ['chart', 'quote', 'news', 'watch'];

export default function renderAddCmd(typeOrRaw, ticker) {
  // "ADD CHART AAPL" arrives as typeOrRaw='chart', ticker='AAPL'.
  // "ADD AAPL" (no type) is treated as quote.
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

  const { w, h } = cardDims(type);
  const n = dashboard.cards.length;
  const x = 80 + (n % 4) * 40;
  const y = 80 + (n % 4) * 40;

  const card = { id: `c_${Date.now()}`, type, ticker: symbol, x, y, w, h };
  dashboard.cards.push(card);
  saveCards();
  showDashboard();
  mountCard(card, true);
  setStatus(`Added ${type.toUpperCase()}${symbol ? ' · ' + symbol : ''} card to dashboard`);
}
