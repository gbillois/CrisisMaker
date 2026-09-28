/* Scenario Builder tab: multi-track storyboard editor in the spirit of a video
   editing suite (bin, program monitor, timeline, inspector). */

/* Compact layout for laptop screens (13" and similar). */
function sbCompact() {
  return typeof window !== 'undefined' && Number(window.innerWidth) > 0 && window.innerWidth < 1440;
}
function sbHeaderWidth() {
  return sbCompact() ? 150 : 188;
}
function sbRowHeight(main) {
  if (main && appState.route === 'storyline') return sbCompact() ? 104 : 120;
  return sbCompact() ? (main ? 66 : 56) : (main ? 78 : 66);
}

/* Which side panels are open; remembered per browser. */
const SB_ZOOM_MIN = 0.6;
const SB_ZOOM_MAX = 24;
const SB_WORKSTREAM_DEFAULTS = ['technical', 'governance', 'communication', 'legal', 'business'];

function sbUI() {
  if (!appState.ui.builder) {
    appState.ui.builder = {
      selected: [],
      zoom: null,
      snap: 5,
      ripple: false,
      bin: 'blocks',
      inspector: 'brief',
      playhead: 0,
      scrollLeft: 0,
      scrollTop: 0,
      modal: null,
      libraryCategory: '',
      previewId: null,
      diffVersionId: null,
      impacts: null,
      generate: { scope: 'all', plan: true, cast: true, write: true },
      skeleton: { brief: '', duration: null, injects: '', tracks: [...SB_WORKSTREAM_DEFAULTS] },
      rewrite: '',
      versionLabel: '',
      templateName: '',
      focus: null
    };
  }
  return appState.ui.builder;
}

function sbStoryboard() {
  return StoryboardHistory.ensure(appState.scenario);
}

function sbSelectedBlock() {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  ui.selected = ui.selected.filter((id) => sbBlock(storyboard, id));
  return ui.selected.length === 1 ? sbBlock(storyboard, ui.selected[0]) : null;
}

function sbBusy() {
  return !!(SbAI.busy || SbPipeline.active);
}

function sbReadOnly() {
  const agent = typeof crisisAgentRunner !== 'undefined' ? crisisAgentRunner : null;
  return sbBusy() || !!(agent?.active || agent?.busy);
}

function sbOption(value, label, current) {
  return `<option value="${escapeAttribute(value)}" ${String(value) === String(current) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function sbChannelColor(channel) {
  return CHANNEL_META[channel]?.color || '#6d687e';
}

function sbSvg(path, size = 16) {
  return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
const SB_UI_ICONS = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/>',
  wand: '<path d="m15 4 5 5"/><path d="M4 20 16 8"/><path d="M19 13v4"/><path d="M17 15h4"/><path d="M8 3v3"/><path d="M6.5 4.5h3"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  play: '<path d="m6 4 14 8-14 8z"/>',
  sync: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  magnet: '<path d="M6 15a6 6 0 0 0 12 0V4h-4v11a2 2 0 0 1-4 0V4H6z"/><path d="M6 8h4"/><path d="M14 8h4"/>',
  ripple: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  agent: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  open: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v7H3V3h7"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  upload: '<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
  filePlus: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M12 12v6"/><path d="M9 15h6"/>',
  folderOpen: '<path d="M3 19V5a2 2 0 0 1 2-2h4l2 3h7a2 2 0 0 1 2 2v2"/><path d="M3 19l2.5-8H22l-2.5 8z"/>',
  sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  demo: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
  archive: '<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 3v4"/><path d="M17 5h4"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 4v4"/><circle cx="12" cy="3" r="1"/><path d="M9 13v2"/><path d="M15 13v2"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  paperclip: '<path d="m21 12-8.6 8.6a5 5 0 0 1-7-7l8.5-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.3-2.3l8-8"/>',
  headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3z"/><path d="M3 19a2 2 0 0 0 2 2h1v-6H3z"/>',
  pause: '<path d="M8 5v14"/><path d="M16 5v14"/>',
  rewind: '<path d="m19 20-10-8 10-8z"/><path d="M5 19V5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>'
};
function sbUiIcon(name, size = 16) {
  return sbSvg(SB_UI_ICONS[name] || '', size);
}


function renderSbStatusBar() {
  const busy = SbAI.busy || (SbPipeline.active ? SbPipeline.label || 'Generating' : '');
  if (busy) {
    const progress = SbPipeline.active && SbPipeline.total ? Math.round(100 * SbPipeline.step / SbPipeline.total) : null;
    return `<div class="sb-statusbar is-busy" role="status"><span class="ai-spinner"></span><span>${escapeHtml(busy)}…</span>${progress !== null ? `<span class="sb-progress"><i style="width:${progress}%"></i></span>` : '<span class="sb-progress is-indeterminate"><i></i></span>'}<button class="btn btn-secondary btn-xs" data-sb-action="${SbPipeline.active ? 'stop-pipeline' : 'stop-ai'}">${sbUiIcon('stop', 12)} Stop</button></div>`;
  }
  if (SbAI.lastError) return `<div class="sb-statusbar is-error" role="alert"><span>${sbUiIcon('alert', 14)} ${escapeHtml(SbAI.lastError)}</span><button class="btn btn-secondary btn-xs" data-sb-action="dismiss-error">Dismiss</button></div>`;
  return '';
}

// ── Bin (left panel) ─────────────────────────────────────────────────────────
function renderSbLibrary() {
  const ui = sbUI();
  ui.libraryCategory = ui.libraryCategory || '';
  const entries = sbLibraryEntries();
  const categories = [...new Set(entries.map((entry) => entry.category || 'Custom'))];
  const visible = entries.filter((entry) => !ui.libraryCategory || (entry.category || 'Custom') === ui.libraryCategory);
  return `<div class="sb-library-tools">
      <input type="search" class="sb-search" data-sb-filter="library" placeholder="Search scenarios…" aria-label="Search the library">
      <div class="sb-chips">${['', ...categories].map((category) => `<button class="sb-filter-chip ${ui.libraryCategory === category ? 'active' : ''}" data-sb-action="library-category" data-sb-value="${escapeAttribute(category)}">${escapeHtml(category || 'All')}</button>`).join('')}</div>
    </div>
    <div class="sb-library-list">
      ${visible.map(renderSbTemplateCard).join('') || '<p class="sb-empty">No scenario in this category.</p>'}
    </div>
    <div class="sb-library-footer">
      <label class="sb-mini-field">Save the current storyboard as a template
        <span class="sb-inline"><input type="text" data-sb-ui="templateName" value="${escapeAttribute(ui.templateName)}" placeholder="Template name"><button class="btn btn-secondary btn-xs" data-sb-action="save-template">Save</button></span>
      </label>
    </div>`;
}

function sbMiniTimeline(template) {
  const duration = Number(template.duration_minutes) || SB_DEFAULT_DURATION;
  const blocks = Array.isArray(template.blocks) ? template.blocks : [];
  const rows = [...new Set(blocks.map((block) => block.track || 'main'))];
  return `<div class="sb-mini-timeline" aria-hidden="true">${rows.slice(0, 5).map((row) => `<div class="sb-mini-row ${row === 'main' ? 'is-main' : ''}">${blocks.filter((block) => (block.track || 'main') === row).map((block) => `<i style="left:${(100 * (block.start || 0) / duration).toFixed(2)}%;width:${Math.max(1, 100 * (block.duration || 0) / duration).toFixed(2)}%;background:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}"></i>`).join('')}</div>`).join('')}</div>`;
}

function renderSbTemplateCard(template) {
  const stats = sbTemplateStats(template);
  const search = `${template.name} ${template.category} ${(template.tags || []).join(' ')} ${template.summary || ''}`.toLowerCase();
  const loaded = sbStoryboard().meta.library_id === template.id;
  return `<article class="sb-template-card ${loaded ? 'is-loaded' : ''}" data-sb-search="${escapeAttribute(search)}">
    <div class="sb-template-head">
      <span class="sb-template-icon">${sbIcon(template.icon || 'square', 18)}</span>
      <div><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.category || 'Custom')}${template.builtin ? '' : ' · My template'}</small></div>
      ${loaded ? `<span class="sb-loaded-tag">${sbUiIcon('check', 12)} Loaded</span>` : ''}
    </div>
    <p>${escapeHtml(template.summary || '')}</p>
    ${sbMiniTimeline(template)}
    <div class="sb-template-meta"><span>${escapeHtml(sbFormatDuration(stats.duration))}</span><span>${stats.blocks} blocks</span><span>${stats.injects} injects</span></div>
    <div class="sb-template-actions">
      <button class="btn btn-secondary btn-xs" data-sb-action="preview-template" data-sb-template="${escapeAttribute(template.id)}">Preview</button>
      <button class="btn btn-primary btn-xs" data-sb-action="select-template" data-sb-template="${escapeAttribute(template.id)}">Load</button>
    </div>
  </article>`;
}

function renderSbCast(storyboard) {
  const project = appState.scenario;
  const usage = new Map();
  storyboard.blocks.forEach((block) => block.beats.forEach((beat) => usage.set(beat.cast_id, (usage.get(beat.cast_id) || 0) + 1)));
  const readOnly = sbReadOnly() ? 'disabled' : '';
  return `<p class="sb-help">Roles who send injects. Each role is played by an actor of the exercise.</p>
    <div class="sb-cast-actions">
      <button class="btn btn-secondary btn-xs" data-sb-action="add-cast" ${readOnly}>${sbUiIcon('plus', 12)} Role</button>
      <button class="btn btn-secondary btn-xs" data-sb-action="plan-cast" ${readOnly} ${isLLMAvailable() && storyboard.blocks.length ? '' : 'disabled'}>${sbUiIcon('wand', 12)} Suggest roles</button>
      <button class="btn btn-secondary btn-xs" data-sb-action="create-actors" ${readOnly}>Create missing actors</button>
    </div>
    <div class="sb-cast-list">
      ${storyboard.cast.map((cast) => {
        const actor = cast.actor_id ? getActor(cast.actor_id) : null;
        return `<div class="sb-cast-card">
          <div class="sb-cast-row">
            <input type="text" data-sb-cast="${cast.id}.label" value="${escapeAttribute(cast.label)}" aria-label="Role label" ${readOnly}>
            <button class="sb-icon-btn" data-sb-action="delete-cast" data-sb-cast-id="${cast.id}" title="Remove role" ${readOnly}>${sbUiIcon('trash', 14)}</button>
          </div>
          <div class="sb-cast-row">
            <select data-sb-cast="${cast.id}.role" aria-label="Role type" ${readOnly}>${ROLES.map((role) => sbOption(role.value, roleLabel(role.value), cast.role)).join('')}</select>
            <input type="text" data-sb-cast="${cast.id}.organization" value="${escapeAttribute(cast.organization)}" placeholder="Organisation" aria-label="Organisation" ${readOnly}>
          </div>
          <select class="sb-cast-actor ${actor ? 'is-linked' : ''}" data-sb-cast="${cast.id}.actor_id" aria-label="Actor" ${readOnly}>
            ${sbOption('', '- No actor yet -', cast.actor_id)}
            ${project.actors.map((item) => sbOption(item.id, `${item.name} · ${item.title || roleLabel(item.role)}`, actor?.id || '')).join('')}
          </select>
          <small class="sb-cast-usage">${usage.get(cast.id) || 0} planned inject(s)</small>
        </div>`;
      }).join('') || '<p class="sb-empty">No role yet. Roles are created by the library, the AI skeleton, or manually.</p>'}
    </div>`;
}

// ── Program monitor ──────────────────────────────────────────────────────────
function sbScoreRing(score) {
  const value = Number.isFinite(score) ? score : null;
  const circumference = 2 * Math.PI * 15;
  const tone = value === null ? 'none' : value >= 80 ? 'good' : value >= 60 ? 'mid' : 'low';
  return `<span class="sb-ring is-${tone}"><svg viewBox="0 0 36 36" width="38" height="38"><circle cx="18" cy="18" r="15" class="sb-ring-track"/><circle cx="18" cy="18" r="15" class="sb-ring-value" stroke-dasharray="${value === null ? 0 : (circumference * value / 100).toFixed(1)} ${circumference.toFixed(1)}"/></svg><b>${value === null ? '-' : value}</b></span>`;
}

// ── Timeline ─────────────────────────────────────────────────────────────────
function renderSbTimeline(storyboard) {
  const ui = sbUI();
  const ppm = ui.zoom;
  const width = Math.ceil((storyboard.duration_minutes + 60) * ppm);
  const readOnly = sbReadOnly() ? 'disabled' : '';
  return `<section class="sb-timeline-panel" aria-label="Timeline">
    <div class="sb-timeline-toolbar">
      <div class="sb-tb-group">
        <button class="sb-tool" data-sb-action="zoom-out" title="Zoom out (-)">${sbUiIcon('minus')}</button>
        <input class="sb-zoom" type="range" min="${SB_ZOOM_MIN}" max="${SB_ZOOM_MAX}" step="0.1" value="${ppm}" data-sb-zoom aria-label="Zoom">
        <button class="sb-tool" data-sb-action="zoom-in" title="Zoom in (+)">${sbUiIcon('plus')}</button>
        <button class="sb-tool" data-sb-action="zoom-fit" title="Fit the whole exercise">${sbUiIcon('fit')}</button>
      </div>
      <div class="sb-tb-group">
        <label class="sb-inline-label" title="Snap blocks to a time grid">${sbUiIcon('magnet', 14)}<select data-sb-ui-select="snap">${[1, 5, 15, 30].map((value) => sbOption(value, `${value} min`, ui.snap)).join('')}</select></label>
        <button class="sb-tool sb-tool-label ${ui.ripple ? 'is-on' : ''}" data-sb-action="toggle-ripple" aria-pressed="${ui.ripple}" title="Ripple: moving or resizing a block shifts the following ones">${sbUiIcon('ripple', 14)}<span>Ripple</span></button>
        <label class="sb-inline-label" title="Exercise duration in minutes"><span class="sb-hide-compact">Duration</span><input type="number" min="30" max="${SB_MAX_DURATION}" step="15" value="${storyboard.duration_minutes}" data-sb-duration ${readOnly}><span>min</span></label>
      </div>
    </div>
    <div class="sb-timeline-scroll" id="sb-timeline-scroll">
      <div class="sb-canvas" style="width:${sbHeaderWidth() + width}px;--ppm:${ppm};--hour:${(60 * ppm).toFixed(2)}px;--quarter:${(15 * ppm).toFixed(2)}px;--header:${sbHeaderWidth()}px">
        <div class="sb-ruler-row">
          <div class="sb-corner"><span>Phases</span><small>${sbMainBlocks(storyboard).length}</small></div>
          <div class="sb-ruler" data-sb-ruler style="width:${width}px">${renderSbRuler(storyboard, ppm)}</div>
        </div>
        ${storyboard.tracks.map((track, index) => renderSbTrack(storyboard, track, index, width)).join('')}
        <div class="sb-end-zone" style="left:${sbHeaderWidth() + storyboard.duration_minutes * ppm}px"></div>
        <div class="sb-playhead" id="sb-playhead" style="left:${sbHeaderWidth() + ui.playhead * ppm}px"><span class="sb-playhead-handle" data-sb-playhead>${sbFormatOffset(ui.playhead)}</span></div>
      </div>
    </div>
  </section>`;
}

function renderSbRuler(storyboard, ppm) {
  const hourPx = 60 * ppm;
  const step = hourPx < 38 ? 240 : hourPx < 70 ? 120 : hourPx > 360 ? 15 : hourPx > 180 ? 30 : 60;
  const startDate = appState.scenario.scenario.start_date;
  const marks = [];
  for (let minute = 0; minute <= storyboard.duration_minutes + 60; minute += step) {
    const clock = minute % 60 === 0 ? sbClockTime(minute, startDate) : '';
    marks.push(`<span class="sb-tick ${minute % 60 === 0 ? 'is-hour' : ''}" style="left:${minute * ppm}px"><b>${sbFormatOffset(minute)}</b>${clock ? `<small>${escapeHtml(clock.split(' ')[1])}</small>` : ''}</span>`);
  }
  return marks.join('');
}

function renderSbTrack(storyboard, track, index, width) {
  const ui = sbUI();
  const blocks = sbSortedBlocks(storyboard, track.id);
  const packing = sbPackTrack(blocks);
  const rowHeight = sbRowHeight(track.kind === 'main');
  const height = packing.rows * rowHeight + 10;
  const injects = blocks.reduce((sum, block) => sum + block.stimuli_target, 0);
  const readOnly = sbReadOnly() ? 'disabled' : '';
  return `<div class="sb-track-row ${track.kind === 'main' ? 'is-main' : ''}" style="--track-color:${track.color}">
    <div class="sb-track-head" style="height:${height}px">
      <input class="sb-track-name" data-sb-track-name="${track.id}" value="${escapeAttribute(track.name)}" aria-label="Track name" ${readOnly}>
      <small>${blocks.length} phases · ${injects} injects</small>
      ${track.kind === 'main' ? '' : `<span class="sb-track-actions">
        <button class="sb-icon-btn" data-sb-action="move-track" data-sb-track="${track.id}" data-sb-value="-1" ${index <= 1 || readOnly ? 'disabled' : ''} title="Move up">${sbUiIcon('up', 13)}</button>
        <button class="sb-icon-btn" data-sb-action="move-track" data-sb-track="${track.id}" data-sb-value="1" ${index === storyboard.tracks.length - 1 || readOnly ? 'disabled' : ''} title="Move down">${sbUiIcon('down', 13)}</button>
        <button class="sb-icon-btn" data-sb-action="delete-track" data-sb-track="${track.id}" ${readOnly} title="Remove track">${sbUiIcon('trash', 13)}</button>
      </span>`}
    </div>
    <div class="sb-lane" data-sb-lane="${track.id}" style="width:${width}px;height:${height}px">
      ${blocks.map((block) => renderSbClip(storyboard, block, packing.placement.get(block.id) * rowHeight + 5, rowHeight - 8)).join('')}
      ${!blocks.length ? `<span class="sb-lane-hint">Drop ${track.kind === 'main' ? 'crisis stages' : 'workstream blocks'} here</span>` : ''}
    </div>
  </div>`;
}

function renderSbClip(storyboard, block, top, height) {
  const ui = sbUI();
  const project = appState.scenario;
  const ppm = ui.zoom;
  const type = SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom;
  const level = sbDetailLevel(block);
  const selected = ui.selected.includes(block.id);
  const stimuli = sbStimuliForBlock(project, block.id);
  const statuses = stimuli.map((stimulus) => sbStimulusStatus(project, stimulus));
  const outdated = statuses.filter((status) => status && ['outdated', 'orphan', 'retime'].includes(status.key)).length;
  const aiFresh = block.ai_rev !== null && block.ai_rev >= storyboard.rev - 1;
  const widthPx = block.duration_minutes * ppm;
  const beats = block.beats.map((beat) => {
    const stimulus = sbStimulusForBeat(project, beat.id);
    const status = stimulus ? sbStimulusStatus(project, stimulus)?.key : 'planned';
    return `<i class="sb-beat is-${status} ${beat.main ? 'is-main' : ''}" style="left:${(100 * Math.min(beat.offset_minutes, block.duration_minutes - 1) / block.duration_minutes).toFixed(2)}%;--beat-color:${sbChannelColor(beat.channel)}" title="${escapeAttribute(`${beat.main ? 'Main stimulus · ' : ''}${sbFormatOffset(sbBeatAbsolute(block, beat))} · ${channelLabel(beat.channel)} · ${beat.title}`)}"></i>`;
  }).join('');
  return `<div class="sb-clip ${selected ? 'is-selected' : ''} ${block.locked ? 'is-locked' : ''} ${widthPx < 90 ? 'is-narrow' : ''} ${aiFresh ? 'is-ai' : ''} is-${block.status}" data-sb-clip="${block.id}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escapeAttribute(`${block.title}, ${sbFormatOffset(block.start_minutes)} to ${sbFormatOffset(sbBlockEnd(block))}`)}"
      style="left:${(block.start_minutes * ppm).toFixed(1)}px;width:${Math.max(6, widthPx).toFixed(1)}px;top:${top}px;height:${height}px;--clip-color:${sbBlockColor(block, storyboard)}">
    <span class="sb-clip-handle is-left" data-sb-resize="left"></span>
    <div class="sb-clip-body">
      <div class="sb-clip-head"><span class="sb-clip-icon">${sbIcon(type.icon, 13)}</span><strong>${escapeHtml(block.title)}</strong></div>
      ${block.brief ? `<div class="sb-clip-brief">${escapeHtml(block.brief)}</div>` : ''}
      <div class="sb-clip-meta">
      <span class="sb-clip-sub">${sbFormatOffset(block.start_minutes)} · ${escapeHtml(sbFormatDuration(block.duration_minutes))} · ${block.beats.length || block.stimuli_target}${block.beats.length && block.beats.length !== block.stimuli_target ? `/${block.stimuli_target}` : ''} inj.</span>
      <span class="sb-clip-flags">
        <span class="sb-level-pips" title="Level of detail: ${['structure', 'narrative', 'inject plan'][level - 1]}">${[1, 2, 3].map((index) => `<i class="${index <= level ? 'on' : ''}"></i>`).join('')}</span>
        ${block.status === 'validated' ? `<span class="sb-flag is-ok" title="Validated">${sbUiIcon('check', 11)}</span>` : ''}
        ${block.beats.some((beat) => beat.main) ? `<span class="sb-flag is-main" title="${escapeAttribute(`Main stimuli: ${block.beats.filter((beat) => beat.main).map((beat) => beat.title || 'Untitled').join(', ')}`)}">${sbUiIcon('star', 10)}${block.beats.filter((beat) => beat.main).length}</span>` : ''}
        ${block.locked ? `<span class="sb-flag" title="Locked">${sbUiIcon('lock', 11)}</span>` : ''}
        ${aiFresh ? '<span class="sb-flag is-ai" title="Updated by AI">AI</span>' : ''}
        ${outdated ? `<span class="sb-flag is-warn" title="${outdated} inject(s) need sync">${outdated}</span>` : ''}
      </span>
      </div>
    </div>
    <div class="sb-clip-beats">${beats}</div>
    <span class="sb-clip-handle is-right" data-sb-resize="right"></span>
  </div>`;
}

// ── Inspector (right panel) ──────────────────────────────────────────────────
// ── Modals ───────────────────────────────────────────────────────────────────
function sbModalShell(title, body, footer = '', size = '') {
  return `<div class="modal-backdrop sb-modal-backdrop" data-sb-backdrop>
    <div class="modal-box sb-modal ${size}" role="dialog" aria-modal="true" aria-label="${escapeAttribute(title)}">
      <div class="modal-header"><h3>${title}</h3><button class="btn btn-secondary btn-xs" data-sb-action="close-modal" aria-label="Close">${sbUiIcon('close', 14)}</button></div>
      <div class="modal-body sb-modal-body">${body}</div>
      ${footer ? `<div class="sb-modal-foot">${footer}</div>` : ''}
    </div>
  </div>`;
}

function renderSbModal(storyboard) {
  const ui = sbUI();
  switch (ui.modal) {
    case 'versions': return renderSbVersionsModal(storyboard);
    case 'coherence': return renderSbCoherenceModal(storyboard);
    case 'generate': return renderSbGenerateModal(storyboard);
    case 'sync': return renderSbSyncModal(storyboard);
    case 'preview': return renderSbPreviewModal();
    default: return '';
  }
}


/* Scenario context tab: starting points (library, AI) and exercise framing. */
function renderSbVersionsModal(storyboard) {
  const ui = sbUI();
  const versions = StoryboardHistory.versions();
  const selected = ui.diffVersionId ? StoryboardHistory.findVersion(ui.diffVersionId) : null;
  const diff = selected ? StoryboardHistory.diff(selected.id) : null;
  const kinds = { named: 'Named', auto: 'Autosave', ai: 'Before AI', generation: 'Before generation', restore: 'Before restore' };
  const body = `<div class="sb-versions">
      <div class="sb-versions-list">
        <div class="sb-version-save">
          <input type="text" data-sb-ui="versionLabel" value="${escapeAttribute(ui.versionLabel)}" placeholder="Name this version (e.g. V1 sent to client)">
          <button class="btn btn-secondary btn-xs" data-sb-action="save-version">${sbUiIcon('star', 12)} Save</button>
        </div>
        <button class="btn btn-ghost btn-xs" data-sb-action="mark-validated">${sbUiIcon('check', 12)} Mark current storyboard as validated</button>
        <ol>${versions.map((version) => `<li class="${selected?.id === version.id ? 'active' : ''} is-${version.kind}">
          <button data-sb-action="compare-version" data-sb-version="${version.id}">
            <strong>${escapeHtml(version.label)}</strong>
            <small>${escapeHtml(kinds[version.kind] || version.kind)} · rev ${version.rev} · ${escapeHtml(new Date(version.created_at).toLocaleString())}</small>
            <small>${version.stats?.blocks ?? '?'} blocks · ${version.stats?.beats ?? '?'} planned injects</small>
          </button>
        </li>`).join('') || '<li class="sb-empty">No version yet. Versions are saved before every AI operation, restore and generation, every 5 minutes while you edit, and when you name one.</li>'}</ol>
      </div>
      <div class="sb-versions-detail">
        ${selected ? `<h4>${escapeHtml(selected.label)}</h4>
          <p class="sb-help">Changes from this version to the current storyboard.</p>
          ${renderSbDiff(diff)}
          <div class="actions">
            <button class="btn btn-primary btn-sm" data-sb-action="restore-version" data-sb-version="${selected.id}">Restore this version</button>
            <button class="btn btn-secondary btn-sm" data-sb-action="delete-version" data-sb-version="${selected.id}">${sbUiIcon('trash', 12)} Delete</button>
          </div>` : `<p class="sb-empty">Select a version to compare it with the current storyboard. Undo/redo (${StoryboardHistory.undoStack.length}/${StoryboardHistory.redoStack.length}) covers every edit of this session.</p>`}
      </div>
    </div>`;
  return sbModalShell('Versions', body, '', 'sb-modal-wide');
}

function renderSbDiff(diff) {
  if (!diff || !diff.count) return '<p class="sb-empty">Identical to the current storyboard.</p>';
  const fieldLabels = { title: 'title', type: 'type', track_id: 'track', start_minutes: 'start', duration_minutes: 'duration', stimuli_target: 'inject count', brief: 'brief', narrative: 'narrative', objectives: 'objectives', beats: 'inject plan', status: 'status', locked: 'lock', notes: 'notes' };
  return `<ul class="sb-diff">
    ${diff.added.map((item) => `<li class="is-added">+ ${escapeHtml(item.title)} <small>added since</small></li>`).join('')}
    ${diff.removed.map((item) => `<li class="is-removed">− ${escapeHtml(item.title)} <small>removed since</small></li>`).join('')}
    ${diff.changed.map((item) => `<li class="is-changed">~ ${escapeHtml(item.title)} <small>${item.fields.map((field) => fieldLabels[field] || field).join(', ')}</small></li>`).join('')}
    ${diff.meta.length ? `<li class="is-changed">~ Scenario <small>${diff.meta.join(', ')}</small></li>` : ''}
    ${diff.cast.added.length + diff.cast.removed.length + diff.cast.changed.length ? `<li class="is-changed">~ Cast <small>${[...diff.cast.added.map((label) => `+${label}`), ...diff.cast.removed.map((label) => `−${label}`), ...diff.cast.changed].map(escapeHtml).join(', ')}</small></li>` : ''}
  </ul>`;
}

function renderSbCoherenceModal(storyboard) {
  const report = storyboard.meta.coherence;
  const issues = report?.issues || [];
  const groups = [['error', 'Errors'], ['warning', 'Warnings'], ['info', 'Suggestions']];
  const body = `<div class="sb-coherence-head">
      ${sbScoreRing(report?.score)}
      <div>
        <strong>${report ? `Score ${report.score}/100` : 'Not checked yet'}</strong>
        <p class="sb-help">${report ? `${escapeHtml(report.summary || 'Deterministic checks only.')} Checked on rev ${report.checked_rev}${report.checked_rev !== storyboard.rev ? ' (storyboard changed since)' : ''}.` : 'Run the checks to review structure, timing, objectives coverage and workload across cells.'}</p>
      </div>
    </div>
    ${groups.map(([severity, title]) => {
      const list = issues.map((issue, index) => ({ issue, index })).filter(({ issue }) => issue.severity === severity);
      if (!list.length) return '';
      return `<h4 class="sb-issue-title is-${severity}">${title} · ${list.length}</h4><ul class="sb-issues">${list.map(({ issue, index }) => `<li class="is-${severity}">
        <span>${issue.source === 'ai' ? '<b class="sb-flag is-ai">AI</b> ' : ''}${escapeHtml(issue.message)}</span>
        <span class="sb-inline">
          ${issue.block_ids.length ? `<button class="btn btn-ghost btn-xs" data-sb-action="select-blocks" data-sb-blocks="${escapeAttribute(issue.block_ids.join(','))}">Show</button>` : ''}
          ${issue.fix ? `<button class="btn btn-secondary btn-xs" data-sb-action="apply-fix" data-sb-issue="${index}" title="${escapeAttribute(Object.entries(issue.fix.patch).map(([key, value]) => `${key}: ${value}`).join('\n'))}">Apply fix</button>` : ''}
        </span>
      </li>`).join('')}</ul>`;
    }).join('')}`;
  const footer = `<button class="btn btn-secondary btn-sm" data-sb-action="run-coherence" data-sb-value="rules" ${sbBusy() ? 'disabled' : ''}>Run checks</button>
    <button class="btn btn-primary btn-sm" data-sb-action="run-coherence" data-sb-value="ai" ${isLLMAvailable() && !sbBusy() && storyboard.blocks.length ? '' : 'disabled'}>${sbUiIcon('wand', 13)} Checks + AI review</button>`;
  return sbModalShell('Global coherence', body, footer, 'sb-modal-wide');
}

function renderSbGenerateModal(storyboard) {
  const ui = sbUI();
  const project = appState.scenario;
  const options = ui.generate;
  const cell = options.scope === 'cell' ? sbCell(project, options.cellId) : null;
  const scope = sbSortedBlocks(storyboard);
  const toPlan = cell ? [] : scope.filter((block) => !block.locked && block.beats.length < block.stimuli_target);
  const missing = scope.reduce((sum, block) => sum + block.beats.filter((beat) => !sbStimulusForBeat(project, beat.id) && (!cell || sbReaches(beat.cell_id, cell.id))).length, 0);
  const toPlanCount = toPlan.reduce((sum, block) => sum + block.stimuli_target - block.beats.length, 0);
  const castMissing = storyboard.cast.filter((cast) => !sbFindActorForCast(project, cast)).length;
  const running = SbPipeline.active;
  const ai = isLLMAvailable();
  const cellOption = sbCell(project, options.cellId);
  const body = `<div class="sb-generate">
      <div class="sb-mini-field">Scope
        <div class="sb-segmented">
          <button class="${!cell ? 'active' : ''}" data-sb-action="generate-scope" data-sb-value="all">Whole exercise · ${storyboard.blocks.length} phases</button>
          ${cellOption ? `<button class="${cell ? 'active' : ''}" data-sb-action="generate-scope" data-sb-value="cell">${escapeHtml(cellOption.name)} only</button>` : ''}
        </div>
      </div>
      <div class="sb-pipeline">
        <label class="${options.plan && ai && !cell ? 'on' : ''}"><input type="checkbox" data-sb-generate="plan" ${options.plan && ai && !cell ? 'checked' : ''} ${ai && !cell ? '' : 'disabled'}><span><b>1 · Plan</b>${cell ? 'Not used for a single cell: plan it with “Plan with AI”' : `Complete the inject plan with AI (${toPlanCount} to plan in ${toPlan.length} phase(s))`}</span></label>
        <label class="${options.cast ? 'on' : ''}"><input type="checkbox" data-sb-generate="cast" ${options.cast ? 'checked' : ''}><span><b>2 · Cast</b>Create missing actors for the roles (${castMissing} role(s) without actor)</span></label>
        <label class="on"><input type="checkbox" checked disabled><span><b>3 · Create</b>Create one inject per planned item (${missing} ready now), linked to its block</span></label>
        <label class="${options.write && ai ? 'on' : ''}"><input type="checkbox" data-sb-generate="write" ${options.write && ai ? 'checked' : ''} ${ai ? '' : 'disabled'}><span><b>4 · Write</b>Write each inject with AI in ${escapeHtml(sbLanguageName(project))}, with the storyboard as context</span></label>
      </div>
      ${!ai ? '<p class="agent-warning">AI is not configured: injects already planned will be created as drafts, without content.</p>' : ''}
      ${SbPipeline.log.length ? `<ol class="agent-log sb-log">${SbPipeline.log.map((entry) => `<li class="agent-log-${entry.kind === 'error' ? 'error' : entry.kind === 'warning' ? 'warning' : 'success'}"><span>${sbUiIcon(entry.kind === 'success' ? 'check' : entry.kind === 'info' ? 'chevronRight' : 'alert', 13)} ${escapeHtml(entry.message)}</span></li>`).join('')}</ol>` : ''}
    </div>`;
  const footer = `${SbPipeline.checkpoint && SbPipeline.checkpoint.projectId === project.id && !running ? `<button class="btn btn-ghost btn-sm" data-sb-action="undo-generation" title="Restore actors, injects and storyboard from before ${escapeAttribute(SbPipeline.checkpoint.label)}">${sbUiIcon('undo', 13)} Undo ${escapeHtml(SbPipeline.checkpoint.label)}</button>` : ''}
    ${running ? `<button class="btn btn-secondary btn-sm" data-sb-action="stop-pipeline">${sbUiIcon('stop', 13)} Stop</button>` : `<button class="btn btn-primary btn-sm" data-sb-action="start-generation" ${sbReadOnly() || !scope.length ? 'disabled' : ''}>${sbUiIcon('play', 13)} Start</button>`}`;
  return sbModalShell('Generate actors and injects', body, footer, 'sb-modal-wide');
}

function renderSbSyncModal(storyboard) {
  const ui = sbUI();
  if (!ui.impacts) ui.impacts = sbComputeImpacts(appState.scenario);
  const impacts = ui.impacts;
  // In cascade order: phases, then actors, then the injects.
  const kinds = [
    ['replan', 'Phases', 'What happens changed: the AI updates the inject plan of the phase, then its injects follow (timing, content, new and removed injects).'],
    ['actor_missing', 'Missing actors', 'Roles used by planned injects without an actor.'],
    ['actor_outdated', 'Actors', 'Roles changed since their actor was created.'],
    ['retime', 'Timing', 'Phases or planned injects moved: injects are rescheduled; content is untouched.'],
    ['outdated', 'Content', 'The storyline or the inject plan changed after the inject was written. Manual edits are adapted, not overwritten.'],
    ['people', 'Senders and cells', 'An actor or a cell was edited in Cells & actors after the inject was written: names, signatures and tone are adapted.'],
    ['orphan', 'Orphans', 'Injects whose phase or planned item was removed.'],
    ['missing', 'New injects', 'Planned injects without a stimulus yet.']
  ];
  const actionLabels = { apply: 'Apply', skip: 'Skip', unlink: 'Keep, unlink', delete: 'Delete inject', regenerate: 'Regenerate', adapt: 'Adapt, keep manual edits', accept: 'Keep as is', create: 'Create', update: 'Update actor', replan: 'Re-plan with AI' };
  const body = `<p class="sb-help sb-cascade">${sbUiIcon('sync', 13)} Changes flow down in cascade: <b>phases</b> → <b>inject plan</b> → <b>actors</b> → <b>timing and content of the injects</b>. One undo restores everything.</p>
    ${!isLLMAvailable() && impacts.some((impact) => ['replan', 'outdated', 'people'].includes(impact.kind)) ? '<p class="agent-warning">AI is not configured: re-planning a phase and rewriting injects need an AI connection (Settings). Timing, orphans and actors can still be updated.</p>' : ''}
    ${impacts.length ? kinds.map(([kind, title, help]) => {
      const list = impacts.filter((impact) => impact.kind === kind);
      if (!list.length) return '';
      return `<section class="sb-sync-group"><h4>${escapeHtml(title)} · ${list.length}</h4><p class="sb-help">${escapeHtml(help)}</p>
        <ul class="sb-sync-list">${list.map((impact) => `<li>
          <span class="sb-sync-label">${escapeHtml(impact.label)}${impact.manual ? ' <span class="sb-status is-manual">manual</span>' : ''}<small>${escapeHtml(impact.detail || '')}</small></span>
          <select data-sb-impact="${impact.id}" ${SbPipeline.active ? 'disabled' : ''}>${impact.options.map((option) => sbOption(option, actionLabels[option] || option, impact.action)).join('')}</select>
        </li>`).join('')}</ul></section>`;
    }).join('') : '<p class="sb-empty">Everything is up to date: the inject plans, actors and injects match the storyline, the cells and the actors.</p>'}
    ${SbPipeline.log.length ? `<ol class="agent-log sb-log">${SbPipeline.log.slice(-12).map((entry) => `<li class="agent-log-${entry.kind === 'error' ? 'error' : entry.kind === 'warning' ? 'warning' : 'success'}"><span>${escapeHtml(entry.message)}</span></li>`).join('')}</ol>` : ''}`;
  const count = impacts.filter((impact) => impact.action !== 'skip').length;
  const footer = `${SbPipeline.checkpoint && SbPipeline.checkpoint.projectId === appState.scenario.id && !SbPipeline.active ? `<button class="btn btn-ghost btn-sm" data-sb-action="undo-generation">${sbUiIcon('undo', 13)} Undo ${escapeHtml(SbPipeline.checkpoint.label)}</button>` : ''}
    <button class="btn btn-secondary btn-sm" data-sb-action="refresh-sync" ${SbPipeline.active ? 'disabled' : ''}>${sbUiIcon('sync', 13)} Refresh</button>
    ${SbPipeline.active ? `<button class="btn btn-secondary btn-sm" data-sb-action="stop-pipeline">${sbUiIcon('stop', 13)} Stop</button>` : `<button class="btn btn-primary btn-sm" data-sb-action="apply-sync" ${count && !sbReadOnly() ? '' : 'disabled'}>${sbUiIcon('sync', 13)} Update ${count} change(s)</button>`}`;
  return sbModalShell('Update the exercise', body, footer, 'sb-modal-wide');
}

function renderSbPreviewModal() {
  const ui = sbUI();
  const template = sbFindTemplate(ui.previewId);
  if (!template) return '';
  const stats = sbTemplateStats(template);
  const cast = new Map((template.cast || []).map((item) => [String(item.key), item.label]));
  const tracks = [...new Set((template.blocks || []).map((block) => block.track || 'main'))];
  const body = `<div class="sb-preview-head">
      <span class="sb-template-icon is-large">${sbIcon(template.icon || 'square', 24)}</span>
      <div><p class="sb-help">${escapeHtml(template.category || 'Custom')} · ${escapeHtml(sbFormatDuration(stats.duration))} · ${stats.blocks} blocks · ${stats.injects} injects</p>
      <p>${escapeHtml(template.summary || '')}</p>
      ${template.threat ? `<p class="sb-help"><b>Threat.</b> ${escapeHtml(template.threat)}</p>` : ''}</div>
    </div>
    <div class="sb-preview-timeline">${tracks.map((track) => `<div class="sb-preview-row"><span>${escapeHtml(SB_TRACK_PRESETS.find((preset) => preset.key === track)?.name || track)}</span><div>${(template.blocks || []).filter((block) => (block.track || 'main') === track).map((block) => `<i style="left:${(100 * block.start / stats.duration).toFixed(2)}%;width:${(100 * block.duration / stats.duration).toFixed(2)}%;--clip-color:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}" title="${escapeAttribute(`${sbFormatOffset(block.start)} · ${block.title}`)}">${escapeHtml(block.title)}</i>`).join('')}</div></div>`).join('')}</div>
    ${(template.objectives || []).length ? `<h4>Objectives</h4><ol class="sb-preview-objectives">${template.objectives.map((objective) => `<li>${escapeHtml(objective)}</li>`).join('')}</ol>` : ''}
    <h4>Storyboard</h4>
    <div class="sb-preview-blocks">${[...(template.blocks || [])].sort((a, b) => a.start - b.start).map((block) => `<details style="--clip-color:${(SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).color}">
        <summary><span>${sbFormatOffset(block.start)}</span><strong>${escapeHtml(block.title)}</strong><small>${escapeHtml(SB_TRACK_PRESETS.find((preset) => preset.key === (block.track || 'main'))?.name || '')} · ${block.stimuli || (block.beats || []).length} injects</small></summary>
        <p>${escapeHtml(block.brief || '')}</p>${block.narrative ? `<p class="sb-help">${escapeHtml(block.narrative)}</p>` : ''}
        ${(block.beats || []).length ? `<ul>${block.beats.map((beat) => `<li><i class="sb-dot" style="background:${sbChannelColor(beat.channel)}"></i>${sbFormatOffset(block.start + beat.at)} · ${escapeHtml(channelLabel(beat.channel))} · <b>${escapeHtml(cast.get(String(beat.cast)) || '')}</b> ${escapeHtml(beat.title)}</li>`).join('')}</ul>` : ''}
      </details>`).join('')}</div>
    ${(template.cast || []).length ? `<h4>Cast</h4><div class="sb-chips">${template.cast.map((item) => `<span class="sb-filter-chip">${escapeHtml(item.label)}</span>`).join('')}</div>` : ''}`;
  const hasBlocks = sbStoryboard().blocks.length > 0;
  const footer = `${template.builtin ? '' : `<button class="btn btn-ghost btn-sm" data-sb-action="delete-template" data-sb-template="${escapeAttribute(template.id)}">${sbUiIcon('trash', 13)} Delete</button>`}
    <button class="btn btn-ghost btn-sm" data-sb-action="export-template" data-sb-template="${escapeAttribute(template.id)}">${sbUiIcon('download', 13)} Export</button>
    ${hasBlocks ? `<button class="btn btn-secondary btn-sm" data-sb-action="use-template" data-sb-template="${escapeAttribute(template.id)}" data-sb-mode="insert">Insert after current storyline</button>` : ''}
    <button class="btn btn-primary btn-sm" data-sb-action="select-template" data-sb-template="${escapeAttribute(template.id)}" title="Load it, set the key information in Context, then generate with AI or load the basic scenario">Load</button>`;
  return sbModalShell(escapeHtml(template.name), body, footer, 'sb-modal-wide');
}

// ── Focus preservation across full re-renders ────────────────────────────────
const SB_FOCUS_KEYS = ['sbField', 'sbMeta', 'sbProject', 'sbBeat', 'sbCast', 'sbTrackName', 'sbUi'];
function sbCaptureFocus() {
  const element = typeof document !== 'undefined' ? document.activeElement : null;
  const ui = sbUI();
  if (!element || !element.closest?.('[data-sb-scope]')) { ui.focus = null; return; }
  const key = SB_FOCUS_KEYS.find((name) => element.dataset?.[name] !== undefined);
  ui.focus = key ? { key, value: element.dataset[key], start: element.selectionStart, end: element.selectionEnd } : null;
}
function sbRestoreFocus() {
  const ui = sbUI();
  const focus = ui.focus;
  ui.focus = null;
  if (!focus) return;
  const attribute = `data-${focus.key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
  const element = [...document.querySelectorAll(`[${attribute}]`)].find((item) => item.getAttribute(attribute) === focus.value);
  if (!element || element.disabled) return;
  element.focus({ preventScroll: true });
  try { if (focus.start !== null && focus.start !== undefined) element.setSelectionRange(focus.start, focus.end); } catch (_) { /* Not a text field. */ }
}
