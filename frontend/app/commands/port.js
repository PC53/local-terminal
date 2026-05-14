import { contentPanel } from '../dom.js';
import { setStatus, showLoading, showError } from '../views.js';
import { fmt, fmtPct, colorClass, apiFetch } from '../utils.js';
import { getHoldings, addOrUpdateHolding, removeHolding, setHoldings } from '../portfolio-store.js';
import { dashboard } from '../state.js';
import { refreshCard } from '../dashboard/engine.js';

export const meta = {
  desc:  'Portfolio tracker — view & manage holdings',
  usage: 'PORT [ADD <TKR> <SH> <COST> | EDIT <TKR> <SH> <COST> | REMOVE <TKR> | CLEAR]',
};

function refreshPortCard() {
  const card = dashboard.cards.find(c => c.type === 'portfolio');
  if (card) refreshCard(card.id);
}

export default async function renderPort(args) {
  const parts = Array.isArray(args) ? args : [args];
  const sub   = (parts[0] || '').toUpperCase();

  if (sub === 'ADD' || sub === 'EDIT') {
    const ticker  = (parts[1] || '').toUpperCase();
    const shares  = parseFloat(parts[2]);
    const avgCost = parseFloat(parts[3]);
    if (!ticker || isNaN(shares) || isNaN(avgCost) || shares <= 0 || avgCost <= 0) {
      showError(`Usage: PORT ${sub} <TICKER> <SHARES> <AVG_COST>  e.g. PORT ${sub} AAPL 50 150.00`);
      return;
    }
    addOrUpdateHolding(ticker, shares, avgCost);
    refreshPortCard();
    setStatus(`PORT — ${ticker} ${sub === 'ADD' ? 'added/updated' : 'edited'}: ${shares} shares @ $${fmt(avgCost)}`);
    await renderPortFull();
    return;
  }

  if (sub === 'REMOVE') {
    const ticker = (parts[1] || '').toUpperCase();
    if (!ticker) { showError('Usage: PORT REMOVE <TICKER>  e.g. PORT REMOVE AAPL'); return; }
    if (!getHoldings().find(h => h.ticker === ticker)) { showError(`${ticker} not found in portfolio`); return; }
    await renderPortFull({ confirmRemove: ticker });
    return;
  }

  if (sub === 'CLEAR') {
    await renderPortFull({ confirmClear: true });
    return;
  }

  await renderPortFull();
  setStatus('PORT — Portfolio Overview');
}

export async function renderPortFull({
  tab           = 'holdings',
  confirmRemove = null,
  confirmClear  = false,
  editTicker    = null,
  editShares    = null,
  editCost      = null,
} = {}) {
  showLoading('LOADING PORTFOLIO');
  const holdings = getHoldings();

  if (!holdings.length) {
    contentPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-header"><span>PORTFOLIO</span></div>
        <div class="port-empty-panel">
          <p class="dimmed">No holdings yet.</p>
          <p style="margin-top:12px;font-size:12px;color:var(--text-dim)">
            Use <span class="accent">PORT ADD &lt;TICKER&gt; &lt;SHARES&gt; &lt;AVG_COST&gt;</span> to add a position.<br>
            Example: <span class="accent">PORT ADD AAPL 50 150.00</span>
          </p>
        </div>
      </div>`;
    return;
  }

  const quotes = await Promise.all(holdings.map(async h => {
    try {
      const d = await apiFetch(`/api/quote/${h.ticker}`);
      return { ...h, price: d.price, change: d.change, change_pct: d.change_pct, name: d.name, sector: d.sector };
    } catch { return { ...h, price: null, change: null, change_pct: null, name: h.ticker, sector: null }; }
  }));

  let totalValue = 0, totalCost = 0, totalDayPnl = 0;
  const enriched = quotes.map(q => {
    const mv     = q.price !== null ? q.price * q.shares : null;
    const cb     = q.avgCost * q.shares;
    const pnl    = mv !== null ? mv - cb : null;
    const pnlPct = pnl !== null && cb > 0 ? (pnl / cb) * 100 : null;
    const dayPnl = q.change !== null ? q.change * q.shares : null;
    if (mv !== null) totalValue += mv;
    totalCost += cb;
    if (dayPnl !== null) totalDayPnl += dayPnl;
    return { ...q, mv, cb, pnl, pnlPct, dayPnl };
  });

  const totalPnl    = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  function tabBtn(name, label) {
    return `<button class="tab-btn${tab === name ? ' active' : ''}" onclick="portTab('${name}')">${label}</button>`;
  }

  // ── Holdings tab ────────────────────────────────────────────────────────────
  function holdingsContent() {
    const rows = enriched.map(q => {
      if (q.ticker === editTicker) {
        return `<tr class="port-edit-row">
          <td colspan="9">
            <span class="port-edit-label"><strong>${q.ticker}</strong></span>
            <label class="port-edit-label">Shares
              <input id="edit-shares" type="number" value="${editShares}" min="0.0001" step="any" class="port-edit-input">
            </label>
            <label class="port-edit-label">Avg Cost $
              <input id="edit-cost" type="number" value="${editCost}" min="0.0001" step="any" class="port-edit-input">
            </label>
            <button class="port-confirm-yes" onclick="portSaveEdit('${q.ticker}')">SAVE</button>
            <button class="port-confirm-no"  onclick="portTab('holdings')">CANCEL</button>
          </td>
        </tr>`;
      }

      if (q.ticker === confirmRemove) {
        return `<tr class="port-confirm-row">
          <td colspan="9">
            Remove <strong>${q.ticker}</strong> — ${q.shares} shares @ $${fmt(q.avgCost)}?
            <button class="port-confirm-yes" onclick="portRemoveYes('${q.ticker}')">YES, REMOVE</button>
            <button class="port-confirm-no"  onclick="portTab('holdings')">NO</button>
          </td>
        </tr>`;
      }

      return `<tr class="port-row-tr" onclick="runCommand('DES ${q.ticker}')">
        <td class="port-td-sym"><strong>${q.ticker}</strong></td>
        <td class="port-td port-name dimmed">${q.name || '—'}</td>
        <td class="port-td">${q.shares}</td>
        <td class="port-td">$${fmt(q.avgCost)}</td>
        <td class="port-td">${q.price !== null ? '$' + fmt(q.price) : '—'}</td>
        <td class="port-td">${q.mv !== null ? '$' + fmt(q.mv) : '—'}</td>
        <td class="port-td ${colorClass(q.pnl)}">
          ${q.pnl !== null ? (q.pnl >= 0 ? '+' : '') + '$' + fmt(Math.abs(q.pnl)) : '—'}
          <span class="dimmed">(${q.pnlPct !== null ? fmtPct(q.pnlPct) : '—'})</span>
        </td>
        <td class="port-td ${colorClass(q.change_pct)}">${q.change_pct !== null ? fmtPct(q.change_pct) : '—'}</td>
        <td class="port-td-actions" onclick="event.stopPropagation()">
          <span class="port-action-btn" title="Edit" onclick="portStartEdit('${q.ticker}',${q.shares},${q.avgCost})">✎</span>
          <span class="port-action-btn port-delete-btn" title="Remove" onclick="portRemoveConfirm('${q.ticker}')">×</span>
        </td>
      </tr>`;
    }).join('');

    const clearBanner = confirmClear ? `
      <div class="port-clear-confirm">
        Remove ALL ${holdings.length} holding${holdings.length !== 1 ? 's' : ''} from portfolio?
        <button class="port-confirm-yes" onclick="portClearYes()">YES, CLEAR ALL</button>
        <button class="port-confirm-no"  onclick="portTab('holdings')">CANCEL</button>
      </div>` : '';

    return `${clearBanner}
      <div class="port-table-wrap">
        <table class="port-table">
          <thead><tr>
            <th>TICKER</th><th>NAME</th><th>SHARES</th><th>AVG COST</th>
            <th>PRICE</th><th>VALUE</th><th>TOTAL P&L</th><th>DAY</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ── Allocation tab ──────────────────────────────────────────────────────────
  function allocationContent() {
    const COLORS = ['#33E29A','#4fc4ff','#ffaa00','#ff6b8a','#a78bfa','#fb923c','#34d399','#60a5fa'];
    const bars = enriched.map((q, i) => {
      const pct = totalValue > 0 && q.mv !== null ? (q.mv / totalValue) * 100 : 0;
      const col = COLORS[i % COLORS.length];
      return `<div class="port-alloc-row">
        <span class="port-alloc-sym" style="color:${col}">${q.ticker}</span>
        <div class="port-alloc-track">
          <div class="port-alloc-fill" style="width:${pct.toFixed(1)}%;background:${col}"></div>
        </div>
        <span class="port-alloc-pct">${pct.toFixed(1)}%</span>
        <span class="port-alloc-val dimmed">$${fmt(q.mv)}</span>
      </div>`;
    }).join('');
    return `<div class="port-alloc-list">${bars}</div>`;
  }

  // ── Performance tab ─────────────────────────────────────────────────────────
  function performanceContent() {
    const ranked = [...enriched].filter(q => q.pnlPct !== null).sort((a, b) => b.pnlPct - a.pnlPct);
    const best   = ranked[0];
    const worst  = ranked[ranked.length - 1];
    return `<div class="grid-4">
      <div class="stat-box"><div class="stat-label">Total Invested</div><div class="stat-value small">$${fmt(totalCost)}</div></div>
      <div class="stat-box"><div class="stat-label">Market Value</div><div class="stat-value small">$${fmt(totalValue)}</div></div>
      <div class="stat-box"><div class="stat-label">Total P&L</div><div class="stat-value small ${colorClass(totalPnl)}">${totalPnl >= 0 ? '+' : ''}$${fmt(Math.abs(totalPnl))}</div></div>
      <div class="stat-box"><div class="stat-label">Total Return</div><div class="stat-value small ${colorClass(totalPnlPct)}">${fmtPct(totalPnlPct)}</div></div>
      <div class="stat-box"><div class="stat-label">Day P&L</div><div class="stat-value small ${colorClass(totalDayPnl)}">${totalDayPnl >= 0 ? '+' : ''}$${fmt(Math.abs(totalDayPnl))}</div></div>
      <div class="stat-box"><div class="stat-label">Positions</div><div class="stat-value small">${holdings.length}</div></div>
      ${best  ? `<div class="stat-box"><div class="stat-label">Best Performer</div><div class="stat-value small positive">${best.ticker} ${fmtPct(best.pnlPct)}</div></div>` : ''}
      ${worst && worst !== best ? `<div class="stat-box"><div class="stat-label">Worst Performer</div><div class="stat-value small negative">${worst.ticker} ${fmtPct(worst.pnlPct)}</div></div>` : ''}
    </div>`;
  }

  const tabContent = tab === 'allocation' ? allocationContent()
    : tab === 'performance'  ? performanceContent()
    : holdingsContent();

  const daySign = totalDayPnl >= 0 ? '+' : '';
  const pnlSign = totalPnl    >= 0 ? '+' : '';

  contentPanel.innerHTML = `
    <div class="panel-section">
      <div class="panel-header">
        <span>PORTFOLIO</span>
        <span class="panel-ticker">$${fmt(totalValue)}</span>
        <span class="dimmed" style="font-size:12px">${pnlSign}${fmtPct(totalPnlPct)} total</span>
      </div>
      <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:20px">
        <div class="price-big">$${fmt(totalValue)}</div>
        <div class="price-change ${colorClass(totalDayPnl)}">${daySign}$${fmt(Math.abs(totalDayPnl))} today</div>
        <div class="price-change ${colorClass(totalPnl)}" style="font-size:14px">
          ${pnlSign}$${fmt(Math.abs(totalPnl))} total (${fmtPct(totalPnlPct)})
        </div>
      </div>
    </div>

    <div class="panel-section">
      <div style="display:flex;gap:0;margin-bottom:0;align-items:center">
        <div class="tab-bar" style="flex:1">
          ${tabBtn('holdings',    'HOLDINGS')}
          ${tabBtn('allocation',  'ALLOCATION')}
          ${tabBtn('performance', 'PERFORMANCE')}
        </div>
        <button class="tf-btn port-clear-btn" onclick="portConfirmClear()">CLEAR ALL</button>
      </div>
      <div class="port-tab-content">${tabContent}</div>
    </div>

    <div class="panel-section port-cmd-ref">
      <code>PORT ADD &lt;TKR&gt; &lt;SH&gt; &lt;COST&gt;</code> &nbsp;·&nbsp;
      <code>PORT EDIT &lt;TKR&gt; &lt;SH&gt; &lt;COST&gt;</code> &nbsp;·&nbsp;
      <code>PORT REMOVE &lt;TKR&gt;</code> &nbsp;·&nbsp;
      <code>PORT CLEAR</code>
    </div>
  `;
}

// ── Interaction handlers — exposed via window.* in main.js ───────────────────
export function portTab(name) { renderPortFull({ tab: name }); }

export function portRemoveConfirm(ticker) { renderPortFull({ confirmRemove: ticker }); }

export function portRemoveYes(ticker) {
  removeHolding(ticker);
  refreshPortCard();
  setStatus(`PORT — ${ticker} removed`);
  renderPortFull();
}

export function portStartEdit(ticker, shares, avgCost) {
  renderPortFull({ editTicker: ticker, editShares: shares, editCost: avgCost });
}

export function portSaveEdit(ticker) {
  const shares  = parseFloat(document.getElementById('edit-shares')?.value);
  const avgCost = parseFloat(document.getElementById('edit-cost')?.value);
  if (!isNaN(shares) && !isNaN(avgCost) && shares > 0 && avgCost > 0) {
    addOrUpdateHolding(ticker, shares, avgCost);
    refreshPortCard();
    setStatus(`PORT — ${ticker} updated: ${shares} shares @ $${fmt(avgCost)}`);
  }
  renderPortFull();
}

export function portConfirmClear() { renderPortFull({ confirmClear: true }); }

export function portClearYes() {
  setHoldings([]);
  refreshPortCard();
  setStatus('PORT — Portfolio cleared');
  renderPortFull();
}
