import { contentPanel } from '../dom.js';
import { fmt, fmtVol, apiFetch } from '../utils.js';
import { setStatus, showLoading, showError } from '../views.js';
import { createPriceChart } from '../chart-builder.js';

export const meta = {
  desc:  'Interactive price chart',
  usage: 'CHART <TICKER>',
};

let _chartInstance = null;

const TIMEFRAMES = [
  { label: '1D',  period: '1d',  interval: '5m'  },
  { label: '5D',  period: '5d',  interval: '15m' },
  { label: '1M',  period: '1mo', interval: '1d'  },
  { label: '3M',  period: '3mo', interval: '1d'  },
  { label: '6M',  period: '6mo', interval: '1d'  },
  { label: '1Y',  period: '1y',  interval: '1d'  },
  { label: '2Y',  period: '2y',  interval: '1wk' },
  { label: '5Y',  period: '5y',  interval: '1wk' },
];

export default async function renderChart(ticker, activePeriod = '1mo', activeInterval = '1d') {
  if (!ticker) { showError('Usage: CHART <TICKER>  e.g. CHART TSLA'); return; }

  if (_chartInstance) { try { _chartInstance.remove(); } catch (_) {} _chartInstance = null; }

  showLoading(`LOADING CHART ${ticker}`);

  try {
    const data = await apiFetch(`/api/chart/${ticker}?period=${activePeriod}&interval=${activeInterval}`);
    if (!data || data.length === 0) { showError(`No chart data for ${ticker}`); return; }

    const tfButtons = TIMEFRAMES.map(tf => `
      <button class="tf-btn ${tf.period === activePeriod ? 'active' : ''}"
              onclick="renderChart('${ticker}','${tf.period}','${tf.interval}')">
        ${tf.label}
      </button>
    `).join('');

    contentPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-header">
          <span>CHART</span>
          <span class="panel-ticker">${ticker}</span>
        </div>
        <div class="timeframe-bar">${tfButtons}</div>
        <div id="chart-container"></div>
        <div id="chart-info" style="margin-top:8px;font-size:11px;color:var(--text-dim);display:flex;gap:24px;"></div>
      </div>
    `;

    const container = document.getElementById('chart-container');
    const { chart, candleSeries, volSeries } = createPriceChart({
      container, data, theme: 'full',
      width: container.clientWidth, height: 420,
    });
    _chartInstance = chart;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    ro.observe(container);

    const chartInfo = document.getElementById('chart-info');
    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time) {
        chartInfo.innerHTML = '';
        return;
      }
      const ohlcv = param.seriesData.get(candleSeries);
      const vol   = param.seriesData.get(volSeries);
      if (ohlcv) {
        const changeColor = ohlcv.close >= ohlcv.open ? 'var(--positive)' : 'var(--negative)';
        chartInfo.innerHTML = `
          <span>O: <span style="color:${changeColor}">${fmt(ohlcv.open)}</span></span>
          <span>H: <span style="color:${changeColor}">${fmt(ohlcv.high)}</span></span>
          <span>L: <span style="color:${changeColor}">${fmt(ohlcv.low)}</span></span>
          <span>C: <span style="color:${changeColor}">${fmt(ohlcv.close)}</span></span>
          ${vol ? `<span>V: <span style="color:var(--text-dim)">${fmtVol(vol.value)}</span></span>` : ''}
        `;
      }
    });

    setStatus(`CHART ${ticker} — ${data.length} candles · ${activePeriod.toUpperCase()}`);
  } catch (err) {
    showError(`Could not load chart for ${ticker}: ${err.message}`);
  }
}
