/* Scenario Builder history: in-memory undo/redo of the storyboard (with the cells, actors
   and written injects an edit changes) plus persisted versions (automatic ones in
   IndexedDB, named ones in the project). */
const SB_UNDO_LIMIT = 100;
const SB_AUTO_VERSION_LIMIT = 40;
const SB_NAMED_VERSION_LIMIT = 30;
const SB_AUTO_VERSION_INTERVAL = 5 * 60 * 1000;
const SB_TEXT_COMMIT_DELAY = 800;

/* Minimal key/value store: IndexedDB when available, memory otherwise. */
const SbStore = {
  memory: new Map(),
  dbPromise: null,
  open() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const request = indexedDB.open('crisismaker_scenario_builder', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('kv');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
    return this.dbPromise;
  },
  async get(key) {
    const db = await this.open();
    if (!db) return this.memory.get(key);
    return new Promise((resolve) => {
      try {
        const request = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(this.memory.get(key));
      } catch (_) { resolve(this.memory.get(key)); }
    });
  },
  async set(key, value) {
    this.memory.set(key, value);
    const db = await this.open();
    if (!db) return;
    await new Promise((resolve) => {
      try {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(value, key);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
        tx.onabort = resolve;
      } catch (_) { resolve(); }
    });
  }
};

function sbSerialize(storyboard) {
  return JSON.stringify(storyboard);
}

/* Cells, actors and written injects live beside the storyboard. An edit that changes them
   calls StoryboardHistory.track() first: its undo step then keeps only the items that
   changed (by id, before and after) and the order of each list, not full copies. */
const SB_SIDE_LISTS = ['cells', 'actors', 'stimuli', 'player_pool', 'actor_categories'];
const SB_SIDE_BIG = 4096;

/* A long string (an image or a video as data URL) is not copied into the JSON of its item:
   it stands there as a short token (length and a sample of its characters), and the string
   itself, which JavaScript never copies, is kept beside it for the undo. */
function sbSideToken(text) {
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(text.length / 512));
  for (let index = 0; index < text.length; index += step) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  for (let index = Math.max(0, text.length - 64); index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `\u0000sb:${text.length}:${(hash >>> 0).toString(36)}`;
}

function sbSideRecord(item) {
  const bigs = new Map();
  const json = JSON.stringify(item, (key, value) => {
    if (typeof value !== 'string' || value.length < SB_SIDE_BIG) return value;
    const token = sbSideToken(value);
    bigs.set(token, value);
    return token;
  });
  return { json, bigs };
}

function sbSideState(project) {
  const state = {};
  for (const name of SB_SIDE_LISTS) state[name] = new Map((project[name] || []).map((item) => [item.id, sbSideRecord(item)]));
  return state;
}

function sbSideDiff(before, after) {
  let diff = null;
  for (const name of SB_SIDE_LISTS) {
    const changed = [];
    for (const id of new Set([...before[name].keys(), ...after[name].keys()])) {
      const from = before[name].get(id) || null;
      const to = after[name].get(id) || null;
      if (from?.json !== to?.json) changed.push({ id, before: from, after: to });
    }
    const orderBefore = [...before[name].keys()];
    const orderAfter = [...after[name].keys()];
    if (!changed.length && orderBefore.join('\n') === orderAfter.join('\n')) continue;
    diff = diff || {};
    diff[name] = { changed, before: orderBefore, after: orderAfter };
  }
  return diff;
}

function sbSideParse(record, withBigs = true) {
  return JSON.parse(record.json, (key, value) => (withBigs && typeof value === 'string' && record.bigs.has(value) ? record.bigs.get(value) : value));
}

const sbIsPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

/* Changes in `current` only what the edit changed from `from` to `to`, down into nested
   objects (the fields of an inject): an edit made later to another property stays. */
function sbPatchItem(current, from, to, value) {
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if (JSON.stringify(from[key]) === JSON.stringify(to[key])) continue;
    if (sbIsPlainObject(from[key]) && sbIsPlainObject(to[key]) && sbIsPlainObject(current[key])) sbPatchItem(current[key], from[key], to[key], value[key]);
    else if (to[key] === undefined) delete current[key];
    else current[key] = value[key];
  }
}

/* Puts the recorded items back as they were before (undo) or after (redo) the edit.
   Items the edit did not touch are kept as they are now, and so are the properties of a
   touched item that the edit did not change. */
function sbApplySide(project, diff, direction) {
  if (!diff) return;
  const other = direction === 'before' ? 'after' : 'before';
  for (const name of Object.keys(diff)) {
    const byId = new Map((project[name] || []).map((item) => [item.id, item]));
    for (const entry of diff[name].changed) {
      const target = entry[direction];
      const source = entry[other];
      if (target === null) { byId.delete(entry.id); continue; }
      const current = byId.get(entry.id);
      if (current && source) sbPatchItem(current, sbSideParse(source, false), sbSideParse(target, false), sbSideParse(target));
      else byId.set(entry.id, sbSideParse(target));
    }
    const order = diff[name][direction];
    const rank = new Map(order.map((id, index) => [id, index]));
    const place = (item, index) => (rank.has(item.id) ? rank.get(item.id) : order.length + index);
    project[name] = [...byId.values()].map((item, index) => ({ item, at: place(item, index) })).sort((a, b) => a.at - b.at).map((entry) => entry.item);
  }
  // The cell count of the Context follows the cells, as when a cell is added or deleted.
  if (diff.cells && project.exercise) project.exercise.cells_count = project.cells.length;
  if (diff.stimuli && typeof sortStimuli === 'function' && project === appState.scenario) sortStimuli();
}

const StoryboardHistory = {
  projectId: null,
  bound: null,
  baseline: '',
  undoStack: [],
  redoStack: [],
  autoVersions: [],
  pendingLabel: '',
  pendingTimer: null,
  side: null,
  lastAutoVersionAt: 0,
  loadedFor: null,

  /* Keeps history attached to the current project and storyboard object. */
  ensure(project = appState.scenario, label = 'External change') {
    if (!project.storyboard) project.storyboard = normalizeStoryboard(null, project.scenario?.phases);
    if (this.projectId !== project.id) {
      this.reset(project);
    } else if (this.bound !== project.storyboard) {
      // Replaced as a whole (template, AI skeleton, agent or generation undo): keep it undoable.
      const current = sbSerialize(project.storyboard);
      if (this.baseline && current !== this.baseline) this.push(this.baseline, label);
      this.bound = project.storyboard;
      this.baseline = current;
      sbAfterStoryboardChange(project, { save: false });
    }
    return project.storyboard;
  },

  /* Accepts the current state without an undo step (e.g. a coherence report). */
  silent() {
    const project = appState.scenario;
    this.ensure(project);
    this.baseline = sbSerialize(project.storyboard);
    if (typeof saveLocal === 'function') saveLocal(false);
  },

  reset(project = appState.scenario) {
    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pendingLabel = '';
    this.side = null;
    this.projectId = project.id;
    this.bound = project.storyboard;
    this.baseline = sbSerialize(project.storyboard);
    this.undoStack = [];
    this.redoStack = [];
    this.autoVersions = [];
    this.lastAutoVersionAt = Date.now();
    this.load(project.id);
  },

  async load(projectId) {
    if (this.loadedFor === projectId) return;
    this.loadedFor = projectId;
    try {
      const saved = await SbStore.get(`auto:${projectId}`);
      if (this.projectId !== projectId || !Array.isArray(saved)) return;
      const known = new Set(this.autoVersions.map((version) => version.id));
      this.autoVersions = [...this.autoVersions, ...saved.filter((version) => !known.has(version.id))]
        .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, SB_AUTO_VERSION_LIMIT);
    } catch (_) { /* Versions are a convenience; the storyboard itself is saved with the project. */ }
  },

  push(snapshot, label, side = null) {
    this.undoStack.push({ snapshot, label, at: Date.now(), side });
    if (this.undoStack.length > SB_UNDO_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  },

  /* Call right before an edit that also changes cells, actors or written injects: the
     next commit records them in the same undo step. */
  track() {
    const project = appState.scenario;
    this.ensure(project);
    this.flush();
    this.side = sbSideState(project);
  },

  /* Records the current storyboard state (and what track() watches) as one undoable step. */
  commit(label = 'Edit', options = {}) {
    const project = appState.scenario;
    this.ensure(project);
    if (options.debounce) {
      this.pendingLabel = label;
      clearTimeout(this.pendingTimer);
      this.pendingTimer = setTimeout(() => this.flush(), SB_TEXT_COMMIT_DELAY);
      sbAfterStoryboardChange(project, { save: false });
      return false;
    }
    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.pendingLabel = '';
    const side = this.side ? sbSideDiff(this.side, sbSideState(project)) : null;
    this.side = null;
    const current = sbSerialize(project.storyboard);
    if (current === this.baseline && !side) return false;
    this.push(this.baseline, label, side);
    project.storyboard.rev += 1;
    this.baseline = sbSerialize(project.storyboard);
    sbAfterStoryboardChange(project, { save: options.save !== false });
    if (Date.now() - this.lastAutoVersionAt > SB_AUTO_VERSION_INTERVAL) this.snapshot('Autosave', 'auto');
    return true;
  },

  flush() {
    if (!this.pendingTimer && !this.pendingLabel) return false;
    const label = this.pendingLabel || 'Edit text';
    return this.commit(label);
  },

  canUndo() { return this.undoStack.length > 0 || !!this.pendingTimer; },
  canRedo() { return this.redoStack.length > 0; },

  apply(snapshot, side = null, direction = 'before') {
    const project = appState.scenario;
    this.side = null;
    sbApplySide(project, side, direction);
    const restored = normalizeStoryboard(JSON.parse(snapshot));
    restored.rev = (project.storyboard?.rev || 0) + 1;
    project.storyboard = restored;
    this.bound = restored;
    this.baseline = sbSerialize(restored);
    sbAfterStoryboardChange(project, { save: true });
  },

  undo() {
    this.flush();
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push({ snapshot: this.baseline, label: entry.label, at: Date.now(), side: entry.side || null });
    this.apply(entry.snapshot, entry.side, 'before');
    return entry.label;
  },

  redo() {
    this.flush();
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push({ snapshot: this.baseline, label: entry.label, at: Date.now(), side: entry.side || null });
    this.apply(entry.snapshot, entry.side, 'after');
    return entry.label;
  },

  lastLabel(stack = 'undo') {
    const list = stack === 'undo' ? this.undoStack : this.redoStack;
    return list[list.length - 1]?.label || '';
  },

  /* Stores a restorable version. kind: auto | ai | generation | restore | named. */
  snapshot(label, kind = 'auto') {
    const project = appState.scenario;
    this.ensure(project);
    this.flush();
    const storyboard = project.storyboard;
    const version = {
      id: uid('version'),
      label: sbText(label, 160) || 'Version',
      kind,
      created_at: new Date().toISOString(),
      rev: storyboard.rev,
      stats: { blocks: storyboard.blocks.length, beats: storyboard.blocks.reduce((sum, block) => sum + block.beats.length, 0), duration: storyboard.duration_minutes },
      data: sbSerialize(storyboard)
    };
    if (kind === 'named') {
      project.storyboard_versions = [version, ...(project.storyboard_versions || [])].slice(0, SB_NAMED_VERSION_LIMIT);
      saveLocal(false);
    } else {
      const latest = this.autoVersions[0];
      if (latest && latest.data === version.data && kind === 'auto') return latest;
      this.autoVersions = [version, ...this.autoVersions].slice(0, SB_AUTO_VERSION_LIMIT);
      this.lastAutoVersionAt = Date.now();
      SbStore.set(`auto:${project.id}`, this.autoVersions);
    }
    return version;
  },

  versions() {
    const named = (appState.scenario.storyboard_versions || []).filter((version) => version && typeof version.data === 'string');
    return [...named, ...this.autoVersions].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  findVersion(id) {
    return this.versions().find((version) => version.id === id) || null;
  },

  restore(id) {
    const version = this.findVersion(id);
    if (!version) return false;
    this.snapshot(`Before restoring "${version.label}"`, 'restore');
    this.flush();
    this.push(this.baseline, `Restore "${version.label}"`);
    this.apply(version.data);
    return true;
  },

  deleteVersion(id) {
    const project = appState.scenario;
    const before = (project.storyboard_versions || []).length;
    project.storyboard_versions = (project.storyboard_versions || []).filter((version) => version.id !== id);
    if (project.storyboard_versions.length !== before) { saveLocal(false); return true; }
    const count = this.autoVersions.length;
    this.autoVersions = this.autoVersions.filter((version) => version.id !== id);
    if (this.autoVersions.length !== count) SbStore.set(`auto:${project.id}`, this.autoVersions);
    return this.autoVersions.length !== count;
  },

  diff(id) {
    const version = this.findVersion(id);
    if (!version) return null;
    return storyboardDiff(normalizeStoryboard(JSON.parse(version.data)), appState.scenario.storyboard);
  }
};

/* Everything derived from the storyboard stays in sync after each change. */
function sbAfterStoryboardChange(project = appState.scenario, options = {}) {
  const storyboard = project.storyboard;
  storyboard.duration_minutes = Math.max(30, storyboard.duration_minutes, sbStoryboardEnd(storyboard));
  project.scenario.phases = sbDerivePhases(storyboard);
  if (appState.checkerState) appState.checkerState.analysisResult = null;
  delete project.challenge; // A challenge of an older version would come back on reload.
  if (options.save !== false && typeof saveLocal === 'function') saveLocal(false);
}

function sbNormalizeVersions(value) {
  return (Array.isArray(value) ? value : []).filter((version) => version && typeof version.data === 'string' && typeof version.id === 'string')
    .slice(0, SB_NAMED_VERSION_LIMIT)
    .map((version) => ({
      id: version.id,
      label: sbText(version.label, 160) || 'Version',
      kind: 'named',
      created_at: sbText(version.created_at, 40) || new Date().toISOString(),
      rev: Number.isInteger(version.rev) ? version.rev : 0,
      stats: version.stats && typeof version.stats === 'object' ? version.stats : {},
      data: version.data
    }));
}
