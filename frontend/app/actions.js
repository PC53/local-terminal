// Single delegated click handler. Every clickable element in the app
// declares its intent via `data-action="<name>"` plus the `data-*`
// attributes that action needs. No more inline onclick=, no more
// window.* shim.
import { runCommand } from './command-bar.js';
import { showDashboard } from './views.js';
import { openArticle, closeArticle } from './article-reader.js';
import { refreshCard, removeCard } from './dashboard/engine.js';
import { renderChart, renderNews, renderFinancials, renderMost } from './commands/registry.js';

const HANDLERS = {
  'run-command'(el) {
    runCommand(el.dataset.cmd);
  },
  'chart-timeframe'(el) {
    renderChart(el.dataset.ticker, el.dataset.period, el.dataset.interval);
  },
  'fin-tab'(el) {
    renderFinancials(el.dataset.ticker, el.dataset.type, el.dataset.period);
  },
  'most-tab'(el) {
    renderMost(null, el.dataset.tab);
  },
  'open-article'(el) {
    const ret = el.dataset.return || '';
    const onReturn = ret.startsWith('news:')
      ? () => renderNews(ret.slice(5))
      : () => showDashboard();
    openArticle({
      url:         el.dataset.url,
      title:       el.dataset.title,
      sentiment:   el.dataset.sentiment,
      source:      el.dataset.publisher,
      publishedAt: el.dataset.publishedAt,
      onReturn,
    });
  },
  'close-article'() {
    closeArticle();
  },
  'card-refresh'(el) {
    refreshCard(el.dataset.card);
  },
  'card-remove'(el) {
    removeCard(el.dataset.card);
  },
};

export function bindActions(root = document) {
  root.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const handler = HANDLERS[target.dataset.action];
    if (!handler) return;
    if (target.tagName === 'A') e.preventDefault();
    handler(target);
  });
}
