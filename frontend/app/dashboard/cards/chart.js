import { apiFetch } from '../../utils.js';
import { createPriceChart } from '../../chart-builder.js';
import { dashboard } from '../../state.js';

export default async function loadChartCard(card, body) {
  const data = await apiFetch(`/api/chart/${card.ticker}?period=1mo&interval=1d`);
  if (!data || !data.length) {
    body.innerHTML = `<div class="card-err">No data for ${card.ticker}</div>`;
    return;
  }

  body.innerHTML = `<div data-cc style="width:100%;height:100%;"></div>`;
  const container = body.querySelector('[data-cc]');

  if (dashboard.charts[card.id]) { try { dashboard.charts[card.id].remove(); } catch (_) {} }

  const { chart } = createPriceChart({
    container, data, theme: 'card',
    width: body.clientWidth, height: body.clientHeight,
  });
  dashboard.charts[card.id] = chart;

  new ResizeObserver(() => {
    if (dashboard.charts[card.id]) {
      dashboard.charts[card.id].applyOptions({ width: body.clientWidth, height: body.clientHeight });
    }
  }).observe(body);
}
