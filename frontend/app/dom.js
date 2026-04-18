// Cached DOM references. Module evaluation is deferred, so #ids are present.
const $ = (id) => document.getElementById(id);

export const commandWrapper = $('command-input-wrapper');
export const commandInput   = $('command-input');
export const contentPanel   = $('content-panel');
export const dashboardView  = $('dashboard-view');
export const canvas         = $('canvas');
export const articleReader  = $('article-reader');
export const autocomplete   = $('autocomplete');
export const statusMsg      = $('status-msg');
export const marketIndices  = $('market-indices');
