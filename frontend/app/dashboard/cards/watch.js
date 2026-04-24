import { fmt, fmtPct, apiFetch } from '../../utils.js';

export const WATCH_TICKERS = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'BTC-USD', 'AMZN'];

export default async function loadWatchCard(card, body) {
  const rows = await Promise.all(WATCH_TICKERS.map(async sym => {
    try {
      const d  = await apiFetch(`/api/quote/${sym}`);
      const cc = d.change >= 0 ? 'positive' : 'negative';
      return `
        <div class="wcard-row" data-action="run-command" data-cmd="DES ${sym}" title="Open ${sym}">
          <span class="wcard-sym">${sym}</span>
          <span class="wcard-price">${fmt(d.price)}</span>
          <span class="wcard-chg ${cc}">${fmtPct(d.change_pct)}</span>
        </div>`;
    } catch { return ''; }
  }));
  body.innerHTML = `<div class="wcard-list">${rows.join('')}</div>`;
}
