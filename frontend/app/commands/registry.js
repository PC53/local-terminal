// Central command table. Order here is the order used by HELP.
//
// ADD and DASH depend on modules that aren't extracted yet
// (dashboard engine + views), so main.js calls register() to wire
// their fns at bootstrap. Metadata stays here to keep the HELP order
// stable. help.js imports COMMANDS directly from this file.
import renderDES,        { meta as desMeta }   from './des.js';
import renderChart,      { meta as chartMeta } from './chart.js';
import renderNews,       { meta as newsMeta }  from './news.js';
import renderFinancials, { meta as finMeta }   from './financials.js';
import renderMost,       { meta as mostMeta }  from './most.js';
import renderHelp,       { meta as helpMeta }  from './help.js';

export const COMMANDS = {
  'DES':   { ...desMeta,   fn: renderDES },
  'CHART': { ...chartMeta, fn: renderChart },
  'NEWS':  { ...newsMeta,  fn: renderNews },
  'FIN':   { ...finMeta,   fn: renderFinancials },
  'MOST':  { ...mostMeta,  fn: renderMost },
  'ADD':   { desc: 'Add a widget card to the dashboard', usage: 'ADD CHART|QUOTE|NEWS|WATCH <TKR>', fn: null },
  'DASH':  { desc: 'Return to the dashboard canvas',     usage: 'DASH',                             fn: null },
  'HELP':  { ...helpMeta,  fn: renderHelp },
};

export function register(name, fn) {
  if (COMMANDS[name]) COMMANDS[name].fn = fn;
}

export { renderDES, renderChart, renderNews, renderFinancials, renderMost, renderHelp };
