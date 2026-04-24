import { contentPanel } from '../dom.js';
import { fmtLarge, apiFetch } from '../utils.js';
import { setStatus, showLoading, showError } from '../views.js';

export const meta = {
  desc:  'Financial statements',
  usage: 'FIN <TICKER>',
};

export default async function renderFinancials(ticker, type = 'income', period = 'annual') {
  if (!ticker) { showError('Usage: FIN <TICKER>  e.g. FIN AAPL'); return; }
  showLoading(`LOADING FINANCIALS ${ticker}`);

  try {
    const data = await apiFetch(`/api/financials/${ticker}?type=${type}&period=${period}`);
    const stmt = data.data || {};

    const rows = Object.keys(stmt);
    const cols = rows.length > 0 ? Object.keys(stmt[rows[0]] || {}) : [];

    const tabHTML = (lbl, t) => `
      <button class="tab-btn ${type === t ? 'active' : ''}"
              data-action="fin-tab"
              data-ticker="${ticker}" data-type="${t}" data-period="${period}">
        ${lbl}
      </button>`;

    const periodHTML = (lbl, p) => `
      <button class="tab-btn ${period === p ? 'active' : ''}"
              data-action="fin-tab"
              data-ticker="${ticker}" data-type="${type}" data-period="${p}">
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
