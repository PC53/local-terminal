import { fmt, fmtPct, colorClass, apiFetch } from '../../utils.js';
import { getHoldings } from '../../portfolio-store.js';

export default async function loadPortfolioCard(card, body) {
  const holdings = getHoldings();

  if (!holdings.length) {
    body.innerHTML = `<div class="port-empty">
      <div class="dimmed" style="font-size:11px;text-align:center;line-height:1.8;padding:16px 8px">
        No holdings yet.<br>
        <span class="accent">PORT ADD &lt;TKR&gt; &lt;SHARES&gt; &lt;COST&gt;</span>
      </div>
    </div>`;
    return;
  }

  const quotes = await Promise.all(holdings.map(async h => {
    try {
      const d = await apiFetch(`/api/quote/${h.ticker}`);
      return { ...h, price: d.price, change: d.change, change_pct: d.change_pct };
    } catch { return { ...h, price: null, change: null, change_pct: null }; }
  }));

  let totalValue = 0, totalCost = 0, totalDayPnl = 0;
  const rows = quotes.map(q => {
    const mv    = q.price !== null ? q.price * q.shares : null;
    const cb    = q.avgCost * q.shares;
    const pnl   = mv !== null ? mv - cb : null;
    const dayPnl = q.change !== null ? q.change * q.shares : null;
    if (mv !== null) totalValue += mv;
    totalCost += cb;
    if (dayPnl !== null) totalDayPnl += dayPnl;

    return `
      <div class="port-row" onclick="runCommand('DES ${q.ticker}')">
        <span class="port-sym">${q.ticker}</span>
        <span class="port-shares dimmed">${q.shares}sh</span>
        <span class="port-val">${mv !== null ? '$' + fmt(mv) : '—'}</span>
        <span class="port-pnl ${colorClass(pnl)}">${pnl !== null ? (pnl >= 0 ? '+' : '') + '$' + fmt(Math.abs(pnl)) : '—'}</span>
        <span class="port-daypct ${colorClass(q.change_pct)}">${q.change_pct !== null ? fmtPct(q.change_pct) : '—'}</span>
      </div>`;
  }).join('');

  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  body.innerHTML = `
    <div class="port-summary">
      <span class="port-total-val">$${fmt(totalValue)}</span>
      <span class="port-total-pnl ${colorClass(totalPnl)}">${totalPnl >= 0 ? '+' : ''}${fmtPct(totalPnlPct)}</span>
    </div>
    <div class="port-rows">${rows}</div>
    <div class="port-footer">
      <span class="dimmed" style="font-size:10px">DAY P&L</span>
      <span class="${colorClass(totalDayPnl)}" style="font-size:11px">${totalDayPnl >= 0 ? '+' : ''}$${fmt(Math.abs(totalDayPnl))}</span>
    </div>
  `;
}
