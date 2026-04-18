import { fmt, fmtVol, fmtPct, apiFetch } from '../../utils.js';

export default async function loadQuoteCard(card, body) {
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
