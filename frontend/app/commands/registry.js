// Central command table. Order here is the order used by HELP.
import renderDES,        { meta as desMeta }   from './des.js';
import renderChart,      { meta as chartMeta } from './chart.js';
import renderNews,       { meta as newsMeta }  from './news.js';
import renderFinancials, { meta as finMeta }   from './financials.js';
import renderMost,       { meta as mostMeta }  from './most.js';
import renderAdd,        { meta as addMeta }   from './add.js';
import renderHelp,       { meta as helpMeta }  from './help.js';
import { showDashboard } from '../views.js';

export const COMMANDS = {
  'DES':   { ...desMeta,   fn: renderDES },
  'CHART': { ...chartMeta, fn: renderChart },
  'NEWS':  { ...newsMeta,  fn: renderNews },
  'FIN':   { ...finMeta,   fn: renderFinancials },
  'MOST':  { ...mostMeta,  fn: renderMost },
  'ADD':   { ...addMeta,   fn: renderAdd },
  'DASH':  { desc: 'Return to the dashboard canvas', usage: 'DASH', fn: showDashboard },
  'HELP':  { ...helpMeta,  fn: renderHelp },
};

export { renderDES, renderChart, renderNews, renderFinancials, renderMost, renderHelp };
