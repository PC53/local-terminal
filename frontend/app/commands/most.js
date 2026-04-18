import { contentPanel } from '../dom.js';
import { fmt, fmtVol, fmtLarge, fmtPct, colorClass, apiFetch } from '../utils.js';
import { setStatus, showLoading, showError } from '../views.js';

export const meta = {
  desc:  'Most active, top gainers & losers',
  usage: 'MOST',
};

export default async function renderMost(_, tab = 'active') {
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
