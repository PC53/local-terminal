import { contentPanel } from '../dom.js';
import { fmt, fmtLarge, fmtVol, fmtPct, colorClass, apiFetch } from '../utils.js';
import { setStatus, showLoading, showError } from '../views.js';

export const meta = {
  desc:  'Company overview & key statistics',
  usage: 'DES <TICKER>',
};

export default async function renderDES(ticker) {
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
        <button class="tf-btn" data-action="run-command" data-cmd="CHART ${data.symbol}">CHART ${data.symbol}</button>
        <button class="tf-btn" data-action="run-command" data-cmd="NEWS ${data.symbol}">NEWS ${data.symbol}</button>
        <button class="tf-btn" data-action="run-command" data-cmd="FIN ${data.symbol}">FIN ${data.symbol}</button>
      </div>
    `;

    setStatus(`DES ${ticker} — ${data.name} · $${fmt(data.price)} ${changeSign}${fmtPct(data.change_pct)}`);
  } catch (err) {
    showError(`Could not load data for ${ticker}: ${err.message}`);
  }
}
