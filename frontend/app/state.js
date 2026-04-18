// Command-bar + history state
export const state = {
  currentCommand: null,
  currentTicker:  null,
  history:        [],
  historyIndex:   -1,
  acSelected:     -1,
};

// Dashboard state. Keep arrays/maps as properties on a shared object so
// consumers can mutate `dashboard.cards = [...]` without reassigning the export.
export const dashboard = {
  cards:  [],
  charts: {},
  timers: {},
};
