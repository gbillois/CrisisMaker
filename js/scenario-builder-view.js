/* Scenario Builder tab: multi-track storyboard editor in the spirit of a video
   editing suite (bin, program monitor, timeline, inspector). */
const SB_HEADER_WIDTH = 188;
const SB_ROW_HEIGHT = 66;
const SB_MAIN_ROW_HEIGHT = 78;
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
  return CHANNEL_META[channel]?.color || '#5d7384';
}

function sbSvg(path, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
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
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>'
};
function sbUiIcon(name, size = 16) {
  return sbSvg(SB_UI_ICONS[name] || '', size);
}

// ── View ─────────────────────────────────────────────────────────────────────
function renderScenarioBuilderView() {
  return sbWithRenderMemo(renderScenarioBuilderMarkup);
}

function renderScenarioBuilderMarkup() {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  sbCaptureFocus();
  if (ui.zoom === null) { ui.zoom = 3; ui.needsFit = true; }
  ui.playhead = Math.min(Math.max(0, ui.playhead), storyboard.duration_minutes);
  const readOnly = sbReadOnly();
  return `<section class="sb-workspace ${readOnly ? 'is-readonly' : ''}" aria-label="Scenario Builder">
    ${renderSbToolbar(storyboard)}
    ${renderSbStatusBar()}
    <div class="sb-body">
      ${renderSbBin(storyboard)}
      <div class="sb-stage">
        ${renderSbMonitor(storyboard)}
        ${renderSbTimeline(storyboard)}
      </div>
      ${renderSbInspector(storyboard)}
    </div>
    ${renderSbModal(storyboard)}
  </section>`;
}

function renderSbToolbar(storyboard) {
  const project = appState.scenario;
  const coherence = storyboard.meta.coherence;
  const pending = sbPendingSyncCount(project);
  const missing = storyboard.blocks.reduce((sum, block) => sum + block.beats.filter((beat) => !sbStimulusForBeat(project, beat.id)).length, 0);
  const ai = isLLMAvailable();
  const aiTitle = ai ? '' : ' (configure AI in Settings)';
  const validated = storyboard.meta.validated_rev;
  return `<header class="sb-toolbar">
    <div class="sb-tb-title">
      <span class="sb-eyebrow">Scenario Builder</span>
      <div class="sb-tb-name-row">
        <input class="sb-title-input" data-sb-project="name" value="${escapeAttribute(project.name || '')}" placeholder="Untitled scenario" aria-label="Scenario name">
        <span class="sb-chip sb-chip-rev" title="Storyboard revision">rev ${storyboard.rev}</span>
        ${validated !== null ? `<span class="sb-chip sb-chip-ok" title="Validated revision">${sbUiIcon('check', 12)} validated rev ${validated}${validated !== storyboard.rev ? ' · changed since' : ''}</span>` : ''}
      </div>
    </div>
    <div class="sb-tb-group" role="group" aria-label="History">
      <button class="sb-tool" data-sb-action="undo" ${StoryboardHistory.canUndo() ? '' : 'disabled'} title="Undo ${escapeAttribute(StoryboardHistory.lastLabel('undo'))} (Ctrl+Z)">${sbUiIcon('undo')}</button>
      <button class="sb-tool" data-sb-action="redo" ${StoryboardHistory.canRedo() ? '' : 'disabled'} title="Redo ${escapeAttribute(StoryboardHistory.lastLabel('redo'))} (Ctrl+Shift+Z)">${sbUiIcon('redo')}</button>
      <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="versions" title="Versions and autosaves">${sbUiIcon('history')}<span>Versions</span></button>
    </div>
    <div class="sb-tb-group" role="group" aria-label="AI design">
      <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="skeleton" title="Generate a complete structure with AI${aiTitle}">${sbUiIcon('wand')}<span>Skeleton</span></button>
      <button class="sb-tool sb-tool-label" data-sb-action="deepen-all" ${ai && storyboard.blocks.length ? '' : 'disabled'} title="Add the next layer of detail to every block${aiTitle}">${sbUiIcon('layers')}<span>Deepen all</span></button>
      <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="coherence" title="Check global coherence">${sbScoreDot(coherence?.score)}<span>Coherence</span></button>
    </div>
    <div class="sb-tb-group sb-tb-output" role="group" aria-label="Injects">
      <button class="sb-tool sb-tool-label" data-sb-action="open-modal" data-sb-modal="sync" title="Propagate storyboard changes to actors and injects">${sbUiIcon('sync')}<span>Sync</span>${pending ? `<span class="sb-count">${pending}</span>` : ''}</button>
      <button class="btn btn-primary btn-sm sb-generate-btn" data-sb-action="open-modal" data-sb-modal="generate" title="Create actors and injects from the storyboard">${sbUiIcon('play', 14)} Generate injects${missing ? ` <span class="sb-count sb-count-light">${missing}</span>` : ''}</button>
    </div>
  </header>`;
}

function sbScoreDot(score) {
  if (score === undefined || score === null) return sbUiIcon('check');
  const tone = score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low';
  return `<span class="sb-score-dot is-${tone}">${score}</span>`;
}

function renderSbStatusBar() {
  const busy = SbAI.busy || (SbPipeline.active ? SbPipeline.label || 'Generating' : '');
  if (busy) {
    const progress = SbPipeline.active && SbPipeline.total ? Math.round(100 * SbPipeline.step / SbPipeline.total) : null;
    return `<div class="sb-statusbar is-busy" role="status"><span class="ai-spinner"></span><span>${escapeHtml(busy)}…</span>${progress !== null ? `<span class="sb-progress"><i style="width:${progress}%"></i></span>` : '<span class="sb-progress is-indeterminate"><i></i></span>'}<button class="btn btn-secondary btn-xs" data-sb-action="${SbPipeline.active ? 'stop-pipeline' : 'stop-ai'}">${sbUiIcon('stop', 12)} Stop</button></div>`;
  }
  if (SbAI.lastError) return `<div class="sb-statusbar is-error" role="alert"><span>⚠ ${escapeHtml(SbAI.lastError)}</span><button class="btn btn-secondary btn-xs" data-sb-action="dismiss-error">Dismiss</button></div>`;
  return '';
}

// ── Bin (left panel) ─────────────────────────────────────────────────────────
function renderSbBin(storyboard) {
  const ui = sbUI();
  const tabs = [['blocks', 'Blocks'], ['library', 'Library'], ['cast', `Cast · ${storyboard.cast.length}`]];
  return `<aside class="sb-bin" aria-label="Bin">
    <div class="sb-tabs" role="tablist">${tabs.map(([key, label]) => `<button role="tab" aria-selected="${ui.bin === key}" class="sb-tab ${ui.bin === key ? 'active' : ''}" data-sb-action="set-bin" data-sb-value="${key}">${escapeHtml(label)}</button>`).join('')}</div>
    <div class="sb-bin-body">
      ${ui.bin === 'library' ? renderSbLibrary() : ui.bin === 'cast' ? renderSbCast(storyboard) : renderSbPalette()}
    </div>
  </aside>`;
}

function renderSbPalette() {
  const groups = [['stage', 'Crisis stages', 'Main storyline'], ['workstream', 'Crisis management workstreams', 'Parallel tracks'], ['custom', 'Your own', '']];
  return `<p class="sb-help">Drag a block onto a track, or click to add it. Double-click a clip to edit it.</p>
    ${groups.map(([group, title, subtitle]) => `<div class="sb-palette-group">
      <div class="sb-palette-title">${escapeHtml(title)}${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ''}</div>
      ${Object.entries(SB_BLOCK_TYPES).filter(([, type]) => type.group === group).map(([key, type]) => `
        <button class="sb-palette-item" draggable="true" data-sb-palette="${key}" data-sb-action="add-block" data-sb-type="${key}" style="--clip-color:${type.color}" title="${escapeAttribute(type.hint)}">
          <span class="sb-palette-icon">${sbIcon(type.icon, 15)}</span>
          <span class="sb-palette-text"><strong>${escapeHtml(type.label)}</strong><small>${escapeHtml(sbFormatDuration(type.duration))} · ${type.stimuli} injects</small></span>
        </button>`).join('')}
    </div>`).join('')}`;
}

function renderSbLibrary() {
  const ui = sbUI();
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
      <button class="btn btn-ghost btn-xs" data-sb-action="import-template">${sbUiIcon('upload', 12)} Import a template file</button>
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
  return `<article class="sb-template-card" data-sb-search="${escapeAttribute(search)}">
    <div class="sb-template-head">
      <span class="sb-template-icon">${sbIcon(template.icon || 'square', 18)}</span>
      <div><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.category || 'Custom')}${template.builtin ? '' : ' · My template'}</small></div>
    </div>
    <p>${escapeHtml(template.summary || '')}</p>
    ${sbMiniTimeline(template)}
    <div class="sb-template-meta"><span>${escapeHtml(sbFormatDuration(stats.duration))}</span><span>${stats.blocks} blocks</span><span>${stats.injects} injects</span></div>
    <div class="sb-template-actions">
      <button class="btn btn-secondary btn-xs" data-sb-action="preview-template" data-sb-template="${escapeAttribute(template.id)}">Preview</button>
      <button class="btn btn-primary btn-xs" data-sb-action="use-template" data-sb-template="${escapeAttribute(template.id)}" data-sb-mode="replace">Use</button>
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
function renderSbMonitor(storyboard) {
  const ui = sbUI();
  const project = appState.scenario;
  const at = ui.playhead;
  const active = sbBlocksAt(storyboard, at);
  const main = active.find((block) => sbTrack(storyboard, block.track_id)?.kind === 'main');
  const parallel = active.filter((block) => block !== main);
  const stats = sbStats(storyboard, project.stimuli);
  const coherence = storyboard.meta.coherence;
  const pending = sbPendingSyncCount(project);
  const upcoming = storyboard.blocks.flatMap((block) => block.beats.map((beat) => ({ block, beat, time: sbBeatAbsolute(block, beat) })))
    .filter((item) => item.time >= at - 20 && item.time <= at + 90).sort((a, b) => a.time - b.time).slice(0, 7);
  const clock = sbClockTime(at, project.scenario.start_date);
  return `<section class="sb-monitor" aria-label="Program monitor">
    <div class="sb-monitor-program">
      <div class="sb-timecode"><strong>${sbFormatOffset(at)}</strong>${clock ? `<span>${escapeHtml(clock)}</span>` : ''}</div>
      ${main ? `<button class="sb-now" data-sb-action="select-block" data-sb-block="${main.id}" style="--clip-color:${sbBlockColor(main, storyboard)}">
          <span class="sb-now-kicker">${sbIcon((SB_BLOCK_TYPES[main.type] || SB_BLOCK_TYPES.custom).icon, 13)} ${escapeHtml((SB_BLOCK_TYPES[main.type] || SB_BLOCK_TYPES.custom).label)}</span>
          <strong>${escapeHtml(main.title)}</strong>
          <span class="sb-now-text">${escapeHtml(main.narrative || main.brief || 'No description yet.')}</span>
        </button>` : `<div class="sb-now is-empty"><strong>${storyboard.blocks.length ? 'No main storyline block here' : 'Empty storyboard'}</strong><span class="sb-now-text">${storyboard.blocks.length ? 'Move the playhead or add a crisis stage.' : 'Start from the Library, generate a Skeleton with AI, or drag blocks onto the timeline.'}</span></div>`}
      ${parallel.length ? `<div class="sb-parallel">${parallel.map((block) => `<button class="sb-parallel-chip" data-sb-action="select-block" data-sb-block="${block.id}" style="--clip-color:${sbBlockColor(block, storyboard)}">${escapeHtml(block.title)}</button>`).join('')}</div>` : ''}
    </div>
    <div class="sb-monitor-feed">
      <div class="sb-monitor-title">Around the playhead</div>
      ${upcoming.length ? `<ol class="sb-feed">${upcoming.map(({ block, beat, time }) => {
        const stimulus = sbStimulusForBeat(project, beat.id);
        const status = stimulus ? sbStimulusStatus(project, stimulus) : null;
        return `<li class="${time < at ? 'is-past' : ''}">
          <span class="sb-feed-time">${sbFormatOffset(time)}</span>
          <i class="sb-dot" style="background:${sbChannelColor(beat.channel)}"></i>
          <button class="sb-feed-title" data-sb-action="${stimulus ? 'open-stimulus' : 'select-block'}" data-sb-stimulus="${escapeAttribute(stimulus?.id || '')}" data-sb-block="${block.id}" title="${escapeAttribute(beat.intent)}">${escapeHtml(beat.title || channelLabel(beat.channel))}</button>
          <span class="sb-status is-${status?.key || 'planned'}">${escapeHtml(status?.label || 'Planned')}</span>
        </li>`;
      }).join('')}</ol>` : '<p class="sb-empty">No inject planned around this time.</p>'}
    </div>
    <div class="sb-monitor-kpis">
      ${sbKpi(sbFormatDuration(storyboard.duration_minutes), 'Duration')}
      ${sbKpi(stats.blocks, 'Blocks')}
      ${sbKpi(`${stats.beats}<small>/${stats.planned}</small>`, 'Injects planned', true)}
      ${sbKpi(stats.generated, 'Generated')}
      <button class="sb-kpi sb-kpi-btn" data-sb-action="open-modal" data-sb-modal="coherence">${sbScoreRing(coherence?.score)}<span>Coherence${coherence && coherence.checked_rev !== storyboard.rev ? ' · outdated' : ''}</span></button>
      <button class="sb-kpi sb-kpi-btn ${pending ? 'is-alert' : ''}" data-sb-action="open-modal" data-sb-modal="sync"><strong>${pending}</strong><span>To sync</span></button>
      <div class="sb-levels" title="Blocks per level of detail">${['Structure', 'Narrative', 'Inject plan'].map((label, index) => `<span><i class="sb-level-${index + 1}"></i>${label} ${stats.levels[index]}</span>`).join('')}</div>
    </div>
  </section>`;
}

function sbKpi(value, label, html = false) {
  return `<div class="sb-kpi"><strong>${html ? value : escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

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
        <label class="sb-inline-label">Duration<input type="number" min="30" max="${SB_MAX_DURATION}" step="15" value="${storyboard.duration_minutes}" data-sb-duration ${readOnly}><span>min</span></label>
      </div>
      <div class="sb-tb-group">
        <button class="sb-tool sb-tool-label" data-sb-action="add-track" ${readOnly} title="Add a workstream track">${sbUiIcon('plus', 14)}<span>Track</span></button>
      </div>
    </div>
    <div class="sb-timeline-scroll" id="sb-timeline-scroll">
      <div class="sb-canvas" style="width:${SB_HEADER_WIDTH + width}px;--ppm:${ppm};--hour:${(60 * ppm).toFixed(2)}px;--quarter:${(15 * ppm).toFixed(2)}px;--header:${SB_HEADER_WIDTH}px">
        <div class="sb-ruler-row">
          <div class="sb-corner"><span>Tracks</span><small>${storyboard.tracks.length}</small></div>
          <div class="sb-ruler" data-sb-ruler style="width:${width}px">${renderSbRuler(storyboard, ppm)}</div>
        </div>
        ${storyboard.tracks.map((track, index) => renderSbTrack(storyboard, track, index, width)).join('')}
        <div class="sb-end-zone" style="left:${SB_HEADER_WIDTH + storyboard.duration_minutes * ppm}px"></div>
        <div class="sb-playhead" id="sb-playhead" style="left:${SB_HEADER_WIDTH + ui.playhead * ppm}px"><span class="sb-playhead-handle" data-sb-playhead>${sbFormatOffset(ui.playhead)}</span></div>
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
  const rowHeight = track.kind === 'main' ? SB_MAIN_ROW_HEIGHT : SB_ROW_HEIGHT;
  const height = packing.rows * rowHeight + 10;
  const injects = blocks.reduce((sum, block) => sum + block.stimuli_target, 0);
  const readOnly = sbReadOnly() ? 'disabled' : '';
  return `<div class="sb-track-row ${track.kind === 'main' ? 'is-main' : ''}" style="--track-color:${track.color}">
    <div class="sb-track-head" style="height:${height}px">
      <input class="sb-track-name" data-sb-track-name="${track.id}" value="${escapeAttribute(track.name)}" aria-label="Track name" ${readOnly}>
      <small>${track.kind === 'main' ? 'Main storyline' : 'Workstream'} · ${blocks.length} blocks · ${injects} injects</small>
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
    return `<i class="sb-beat is-${status}" style="left:${(100 * Math.min(beat.offset_minutes, block.duration_minutes - 1) / block.duration_minutes).toFixed(2)}%;--beat-color:${sbChannelColor(beat.channel)}" title="${escapeAttribute(`${sbFormatOffset(sbBeatAbsolute(block, beat))} · ${channelLabel(beat.channel)} · ${beat.title}`)}"></i>`;
  }).join('');
  return `<div class="sb-clip ${selected ? 'is-selected' : ''} ${block.locked ? 'is-locked' : ''} ${widthPx < 90 ? 'is-narrow' : ''} ${aiFresh ? 'is-ai' : ''} is-${block.status}" data-sb-clip="${block.id}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escapeAttribute(`${block.title}, ${sbFormatOffset(block.start_minutes)} to ${sbFormatOffset(sbBlockEnd(block))}`)}"
      style="left:${(block.start_minutes * ppm).toFixed(1)}px;width:${Math.max(6, widthPx).toFixed(1)}px;top:${top}px;height:${height}px;--clip-color:${sbBlockColor(block, storyboard)}">
    <span class="sb-clip-handle is-left" data-sb-resize="left"></span>
    <div class="sb-clip-body">
      <div class="sb-clip-head"><span class="sb-clip-icon">${sbIcon(type.icon, 13)}</span><strong>${escapeHtml(block.title)}</strong></div>
      <div class="sb-clip-meta">
      <span class="sb-clip-sub">${sbFormatOffset(block.start_minutes)} · ${escapeHtml(sbFormatDuration(block.duration_minutes))} · ${block.beats.length || block.stimuli_target}${block.beats.length && block.beats.length !== block.stimuli_target ? `/${block.stimuli_target}` : ''} inj.</span>
      <span class="sb-clip-flags">
        <span class="sb-level-pips" title="Level of detail: ${['structure', 'narrative', 'inject plan'][level - 1]}">${[1, 2, 3].map((index) => `<i class="${index <= level ? 'on' : ''}"></i>`).join('')}</span>
        ${block.status === 'validated' ? `<span class="sb-flag is-ok" title="Validated">${sbUiIcon('check', 11)}</span>` : ''}
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
function renderSbInspector(storyboard) {
  const block = sbSelectedBlock();
  const ui = sbUI();
  if (!block) {
    return `<aside class="sb-inspector" aria-label="Inspector">
      ${ui.selected.length > 1 ? renderSbMultiInspector(storyboard) : renderSbScenarioInspector(storyboard)}
    </aside>`;
  }
  const type = SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom;
  const level = sbDetailLevel(block);
  const project = appState.scenario;
  const linked = sbStimuliForBlock(project, block.id);
  const complete = block.beats.length && block.beats.every((beat) => sbStimulusForBeat(project, beat.id));
  const readOnly = sbReadOnly() || block.locked ? 'disabled' : '';
  const tabs = [['brief', 'Brief'], ['narrative', 'Narrative'], ['plan', `Injects · ${block.beats.length}/${block.stimuli_target}`], ['links', `Links · ${linked.length}`]];
  const tab = tabs.some(([key]) => key === ui.inspector) ? ui.inspector : 'brief';
  return `<aside class="sb-inspector" aria-label="Inspector" style="--clip-color:${sbBlockColor(block, storyboard)}">
    <div class="sb-inspector-head">
      <div class="sb-inspector-kicker"><span class="sb-clip-icon">${sbIcon(type.icon, 14)}</span>
        <select data-sb-field="type" aria-label="Block type" ${readOnly}>${Object.entries(SB_BLOCK_TYPES).map(([key, value]) => sbOption(key, value.label, block.type)).join('')}</select>
        <button class="sb-icon-btn" data-sb-action="deselect" title="Close (Esc)">${sbUiIcon('close', 14)}</button>
      </div>
      <input class="sb-inspector-title" data-sb-field="title" value="${escapeAttribute(block.title)}" aria-label="Block title" ${readOnly}>
      <div class="sb-inspector-meta">
        <select data-sb-field="track_id" aria-label="Track" ${readOnly}>${storyboard.tracks.map((track) => sbOption(track.id, track.name, block.track_id)).join('')}</select>
        <select data-sb-field="status" aria-label="Status" ${sbReadOnly() ? 'disabled' : ''}>${[['draft', 'Draft'], ['refined', 'Refined'], ['validated', 'Validated']].map(([value, label]) => sbOption(value, label, block.status)).join('')}</select>
        <button class="sb-icon-btn ${block.locked ? 'is-on' : ''}" data-sb-action="toggle-lock" title="${block.locked ? 'Unlock' : 'Lock (protects from AI and sync)'}" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon(block.locked ? 'lock' : 'unlock', 14)}</button>
      </div>
      <ol class="sb-depth" aria-label="Level of detail">${['Structure', 'Narrative', 'Inject plan', 'Injects'].map((label, index) => `<li class="${index < level || (index === 3 && complete) ? 'done' : ''} ${index === level ? 'next' : ''}">${label}</li>`).join('')}</ol>
    </div>
    <div class="sb-tabs sb-tabs-small" role="tablist">${tabs.map(([key, label]) => `<button role="tab" aria-selected="${tab === key}" class="sb-tab ${tab === key ? 'active' : ''}" data-sb-action="set-inspector" data-sb-value="${key}">${escapeHtml(label)}</button>`).join('')}</div>
    <div class="sb-inspector-body">
      ${tab === 'brief' ? renderSbBriefTab(block, readOnly) : tab === 'narrative' ? renderSbNarrativeTab(block, readOnly) : tab === 'plan' ? renderSbPlanTab(storyboard, block, readOnly) : renderSbLinksTab(block)}
    </div>
    <div class="sb-inspector-foot">
      <button class="btn btn-primary btn-sm" data-sb-action="generate-block" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon('play', 13)} Generate injects</button>
      <button class="btn btn-secondary btn-sm" data-sb-action="send-to-agent" ${sbReadOnly() ? 'disabled' : ''} title="Open the Agent tab with a brief scoped to this block">${sbUiIcon('agent', 13)} Agent</button>
      <button class="sb-icon-btn" data-sb-action="duplicate-block" ${sbReadOnly() ? 'disabled' : ''} title="Duplicate (Ctrl+D)">${sbUiIcon('copy', 15)}</button>
      <button class="sb-icon-btn is-danger" data-sb-action="delete-block" ${readOnly} title="Delete (Del)">${sbUiIcon('trash', 15)}</button>
    </div>
  </aside>`;
}

function renderSbBriefTab(block, readOnly) {
  const objectives = sbObjectivesList(appState.scenario);
  const extra = block.objectives.filter((objective) => !objectives.includes(objective));
  const ai = isLLMAvailable();
  return `<div class="sb-field-grid">
      <label class="sb-mini-field">Start<span class="sb-inline"><input type="number" min="0" step="1" data-sb-field="start_minutes" value="${block.start_minutes}" ${readOnly}><em>${sbFormatOffset(block.start_minutes)}</em></span></label>
      <label class="sb-mini-field">Duration<span class="sb-inline"><input type="number" min="5" step="5" data-sb-field="duration_minutes" value="${block.duration_minutes}" ${readOnly}><em>min</em></span></label>
      <label class="sb-mini-field">Injects<input type="number" min="0" max="${SB_MAX_BEATS}" step="1" data-sb-field="stimuli_target" value="${block.stimuli_target}" ${readOnly}></label>
    </div>
    <label class="sb-mini-field">Brief · what should happen in this block
      <textarea data-sb-field="brief" rows="5" placeholder="${escapeAttribute((SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom).hint)}" ${readOnly}>${escapeHtml(block.brief)}</textarea>
    </label>
    <div class="sb-mini-field">Objectives tested
      ${objectives.length || extra.length ? `<div class="sb-checklist">${[...objectives, ...extra].map((objective) => `<label><input type="checkbox" data-sb-objective="${escapeAttribute(objective)}" ${block.objectives.includes(objective) ? 'checked' : ''} ${readOnly}><span>${escapeHtml(objective)}</span></label>`).join('')}</div>` : '<p class="sb-empty">Add exercise objectives in the scenario panel (click an empty area of the timeline).</p>'}
    </div>
    <label class="sb-mini-field">Designer notes
      <textarea data-sb-field="notes" rows="3" placeholder="Facilitation notes, expected reactions, props…" ${readOnly}>${escapeHtml(block.notes)}</textarea>
    </label>
    <div class="sb-ai-row">
      <button class="btn btn-secondary btn-sm" data-sb-action="deepen-block" ${ai && !readOnly ? '' : 'disabled'}>${sbUiIcon('layers', 13)} ${block.narrative.trim() ? (block.beats.length >= block.stimuli_target && block.beats.length ? 'Complete' : 'Plan injects') : 'Write narrative'}</button>
    </div>`;
}

function renderSbNarrativeTab(block, readOnly) {
  const ui = sbUI();
  const ai = isLLMAvailable();
  return `<label class="sb-mini-field">Narrative · hidden story, what players know, dilemmas
      <textarea data-sb-field="narrative" rows="10" placeholder="What really happens, what players know and do not know, which decisions and dilemmas they face, possible consequences…" ${readOnly}>${escapeHtml(block.narrative)}</textarea>
    </label>
    <div class="sb-ai-box">
      <div class="sb-ai-box-title">${sbUiIcon('wand', 13)} Iterate with AI</div>
      <button class="btn btn-secondary btn-sm" data-sb-action="deepen-block" data-sb-level="2" ${ai && !readOnly ? '' : 'disabled'}>${block.narrative.trim() ? 'Rewrite narrative' : 'Write narrative'}</button>
      <label class="sb-mini-field">Rewrite this block with an instruction
        <textarea data-sb-ui="rewrite" rows="3" placeholder="e.g. Make the attacker contact the CEO directly; add a regulator deadline; shorter and more ambiguous" ${readOnly}>${escapeHtml(ui.rewrite)}</textarea>
      </label>
      <button class="btn btn-secondary btn-sm" data-sb-action="rewrite-block" ${ai && !readOnly ? '' : 'disabled'}>Apply instruction</button>
    </div>`;
}

function renderSbPlanTab(storyboard, block, readOnly) {
  const project = appState.scenario;
  const ai = isLLMAvailable();
  const channels = Object.keys(TEMPLATE_LIBRARY);
  return `<div class="sb-plan-head">
      <span>${block.beats.length} of ${block.stimuli_target} injects planned</span>
      <span class="sb-inline">
        <button class="btn btn-secondary btn-xs" data-sb-action="deepen-block" data-sb-level="3" ${ai && !readOnly && block.beats.length < Math.max(1, block.stimuli_target) ? '' : 'disabled'}>${sbUiIcon('wand', 12)} Plan with AI</button>
        <button class="btn btn-secondary btn-xs" data-sb-action="add-beat" ${readOnly}>${sbUiIcon('plus', 12)} Inject</button>
      </span>
    </div>
    <div class="sb-beats">
      ${block.beats.map((beat) => {
        const stimulus = sbStimulusForBeat(project, beat.id);
        const status = stimulus ? sbStimulusStatus(project, stimulus) : null;
        const templates = beat.channel === 'article_press' ? Object.entries(ARTICLE_TEMPLATE_LIBRARY) : beat.channel === 'breaking_news_tv' ? Object.entries(TV_TEMPLATE_LIBRARY) : [];
        return `<div class="sb-beat-card" style="--beat-color:${sbChannelColor(beat.channel)}">
          <div class="sb-beat-row">
            <label class="sb-beat-time" title="Minutes from block start">+<input type="number" min="0" max="${Math.max(0, block.duration_minutes - 1)}" data-sb-beat="${beat.id}.offset_minutes" value="${beat.offset_minutes}" ${readOnly}><em>${sbFormatOffset(sbBeatAbsolute(block, beat))}</em></label>
            <select data-sb-beat="${beat.id}.channel" aria-label="Channel" ${readOnly}>${channels.map((channel) => sbOption(channel, channelLabel(channel), beat.channel)).join('')}</select>
            ${templates.length ? `<select data-sb-beat="${beat.id}.template_id" aria-label="Outlet" ${readOnly}>${sbOption('', 'Default outlet', beat.template_id)}${templates.map(([key, value]) => sbOption(key, value.label || key, beat.template_id)).join('')}</select>` : ''}
            <button class="sb-icon-btn" data-sb-action="delete-beat" data-sb-beat-id="${beat.id}" title="Remove" ${readOnly}>${sbUiIcon('trash', 13)}</button>
          </div>
          <select data-sb-beat="${beat.id}.cast_id" aria-label="Sender" ${readOnly}>${sbOption('', '- Sender role -', beat.cast_id)}${storyboard.cast.map((cast) => sbOption(cast.id, cast.label, beat.cast_id)).join('')}</select>
          <input type="text" data-sb-beat="${beat.id}.title" value="${escapeAttribute(beat.title)}" placeholder="Inject title" aria-label="Inject title" ${readOnly}>
          <textarea data-sb-beat="${beat.id}.intent" rows="2" placeholder="What it says and which pressure or decision it creates" ${readOnly}>${escapeHtml(beat.intent)}</textarea>
          <div class="sb-beat-foot">
            ${stimulus ? `<span class="sb-status is-${status?.key}">${escapeHtml(status?.label || '')}${status?.manual && status.key !== 'manual' ? ' · edited' : ''}</span><button class="btn btn-ghost btn-xs" data-sb-action="open-stimulus" data-sb-stimulus="${escapeAttribute(stimulus.id)}">${sbUiIcon('open', 11)} Open</button>`
              : `<span class="sb-status is-planned">Not generated</span><button class="btn btn-ghost btn-xs" data-sb-action="generate-beat" data-sb-beat-id="${beat.id}" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon('play', 11)} Create</button>`}
          </div>
        </div>`;
      }).join('') || `<p class="sb-empty">No inject planned yet. Add them manually or let the AI plan ${block.stimuli_target || 'them'}.</p>`}
    </div>`;
}

function renderSbLinksTab(block) {
  const project = appState.scenario;
  const linked = sbStimuliForBlock(project, block.id);
  const readOnly = sbReadOnly() ? 'disabled' : '';
  return `<p class="sb-help">Injects generated from or linked to this block. Manual edits are detected and preserved during sync; locked injects are never modified automatically.</p>
    <div class="sb-links">
      ${linked.map((stimulus) => {
        const status = sbStimulusStatus(project, stimulus);
        const locked = stimulus.scenario_link.locked;
        return `<div class="sb-link-row">
          <i class="sb-dot" style="background:${sbChannelColor(stimulus.channel)}"></i>
          <span class="sb-link-time">${sbFormatOffset(stimulus.timestamp_offset_minutes)}</span>
          <button class="sb-link-title" data-sb-action="open-stimulus" data-sb-stimulus="${escapeAttribute(stimulus.id)}">${escapeHtml(sbStimulusLabel(stimulus))}</button>
          <span class="sb-status is-${status?.key}">${escapeHtml(status?.label || '')}</span>
          <button class="sb-icon-btn ${locked ? 'is-on' : ''}" data-sb-action="lock-stimulus" data-sb-stimulus="${escapeAttribute(stimulus.id)}" title="${locked ? 'Unlock' : 'Lock: never modified by sync'}" ${readOnly}>${sbUiIcon(locked ? 'lock' : 'unlock', 13)}</button>
          <button class="sb-icon-btn" data-sb-action="unlink-stimulus" data-sb-stimulus="${escapeAttribute(stimulus.id)}" title="Unlink from the storyboard" ${readOnly}>${sbUiIcon('link', 13)}</button>
        </div>`;
      }).join('') || '<p class="sb-empty">No inject linked yet.</p>'}
    </div>
    ${renderSbLinkCandidates(block, readOnly)}`;
}

function renderSbLinkCandidates(block, readOnly) {
  const project = appState.scenario;
  const candidates = project.stimuli.filter((stimulus) => !sbStimulusLink(stimulus))
    .sort((a, b) => Math.abs(a.timestamp_offset_minutes - block.start_minutes) - Math.abs(b.timestamp_offset_minutes - block.start_minutes));
  if (!candidates.length) return '';
  const inside = (stimulus) => stimulus.timestamp_offset_minutes >= block.start_minutes && stimulus.timestamp_offset_minutes < sbBlockEnd(block);
  return `<div class="sb-ai-box"><div class="sb-ai-box-title">${sbUiIcon('link', 13)} Link an existing inject</div>
    <p class="sb-help">Injects created by hand or imported can follow this block: they are then retimed and flagged by Sync when the block changes.</p>
    <span class="sb-inline"><select data-sb-link-select ${readOnly}>${candidates.slice(0, 60).map((stimulus) => sbOption(stimulus.id, `${inside(stimulus) ? '● ' : ''}${sbFormatOffset(stimulus.timestamp_offset_minutes)} · ${sbStimulusLabel(stimulus)}`, candidates[0].id)).join('')}</select>
    <button class="btn btn-secondary btn-xs" data-sb-action="link-stimulus" ${readOnly}>Link</button></span>
  </div>`;
}

function renderSbMultiInspector(storyboard) {
  const blocks = sbUI().selected.map((id) => sbBlock(storyboard, id)).filter(Boolean);
  return `<div class="sb-inspector-head"><div class="sb-inspector-kicker">${blocks.length} blocks selected<button class="sb-icon-btn" data-sb-action="deselect" title="Clear selection">${sbUiIcon('close', 14)}</button></div></div>
    <div class="sb-inspector-body">
      <ul class="sb-multi-list">${blocks.map((block) => `<li style="--clip-color:${sbBlockColor(block, storyboard)}"><button data-sb-action="select-block" data-sb-block="${block.id}">${escapeHtml(block.title)}</button><small>${sbFormatOffset(block.start_minutes)}</small></li>`).join('')}</ul>
      <p class="sb-help">Drag one of them on the timeline to move all selected blocks together, or use the arrow keys.</p>
      <div class="sb-ai-row">
        <button class="btn btn-secondary btn-sm" data-sb-action="deepen-selection" ${isLLMAvailable() && !sbReadOnly() ? '' : 'disabled'}>${sbUiIcon('layers', 13)} Deepen selection</button>
        <button class="btn btn-primary btn-sm" data-sb-action="generate-block" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon('play', 13)} Generate injects</button>
        <button class="btn btn-secondary btn-sm" data-sb-action="delete-block" ${sbReadOnly() ? 'disabled' : ''}>${sbUiIcon('trash', 13)} Delete</button>
      </div>
    </div>`;
}

function renderSbScenarioInspector(storyboard) {
  const project = appState.scenario;
  const readOnly = sbReadOnly() ? 'disabled' : '';
  const unlinked = project.stimuli.filter((stimulus) => !sbStimulusLink(stimulus)).length;
  const stats = sbStats(storyboard, project.stimuli);
  return `<div class="sb-inspector-head"><div class="sb-inspector-kicker">${sbUiIcon('layers', 14)} Scenario</div>
      <p class="sb-help">Global framing used by every AI operation. Select a clip to edit a block.</p></div>
    <div class="sb-inspector-body">
      <label class="sb-mini-field">Designer brief
        <textarea data-sb-meta="brief" rows="4" placeholder="Audience, duration, what you want to test, constraints, tone…" ${readOnly}>${escapeHtml(storyboard.meta.brief)}</textarea>
      </label>
      <label class="sb-mini-field">Synopsis · the hidden story
        <textarea data-sb-meta="synopsis" rows="6" placeholder="What really happens from the attacker's first move to the end of the crisis" ${readOnly}>${escapeHtml(storyboard.meta.synopsis)}</textarea>
      </label>
      <label class="sb-mini-field">Threat
        <textarea data-sb-meta="threat" rows="2" placeholder="Threat actor, initial access, impact" ${readOnly}>${escapeHtml(storyboard.meta.threat)}</textarea>
      </label>
      <label class="sb-mini-field">Exercise objectives · one per line
        <textarea data-sb-project="scenario.objectives" rows="5" placeholder="Decide on isolation under uncertainty&#10;Notify authorities on time&#10;…" ${readOnly}>${escapeHtml(project.scenario.objectives || '')}</textarea>
      </label>
      <div class="sb-facts">
        <span><b>Client</b>${escapeHtml(project.client.name || '-')}</span>
        <span><b>Start</b>${escapeHtml(project.scenario.start_date ? project.scenario.start_date.replace('T', ' ') : '-')}</span>
        <span><b>Injects language</b>${escapeHtml(sbLanguageName(project))}</span>
        <span><b>Plan</b>${stats.beats}/${stats.planned} injects</span>
      </div>
      <button class="btn btn-ghost btn-xs" data-route="scenario">Client, dates and languages in the Scenario tab →</button>
      ${unlinked && storyboard.blocks.length ? `<div class="sb-ai-box"><div class="sb-ai-box-title">${unlinked} inject(s) not linked to the storyboard</div><p class="sb-help">Link them to the main storyline block covering their time so they follow future changes.</p><button class="btn btn-secondary btn-sm" data-sb-action="auto-link" ${readOnly}>${sbUiIcon('link', 13)} Link by time</button></div>` : ''}
    </div>`;
}

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
    case 'skeleton': return renderSbSkeletonModal(storyboard);
    case 'versions': return renderSbVersionsModal(storyboard);
    case 'coherence': return renderSbCoherenceModal(storyboard);
    case 'generate': return renderSbGenerateModal(storyboard);
    case 'sync': return renderSbSyncModal(storyboard);
    case 'preview': return renderSbPreviewModal();
    default: return '';
  }
}

function renderSbSkeletonModal(storyboard) {
  const ui = sbUI();
  const project = appState.scenario;
  const skeleton = ui.skeleton;
  const brief = skeleton.brief || storyboard.meta.brief || project.scenario.summary || '';
  const linked = project.stimuli.filter((stimulus) => sbStimulusLink(stimulus)).length;
  const body = `<p class="sb-help">The AI designs the full structure (level 1): main storyline, parallel workstreams, timing, number of injects per block, roles and objectives. You then refine it by hand or layer by layer.</p>
    <label class="sb-mini-field">Brief
      <textarea data-sb-ui="skeleton.brief" rows="6" placeholder="e.g. 4-hour ransomware exercise for the executive crisis cell of a regional hospital group, testing isolation, patient safety, communication and regulatory decisions">${escapeHtml(brief)}</textarea>
    </label>
    <div class="sb-field-grid">
      <label class="sb-mini-field">Duration (min)<input type="number" min="30" step="15" data-sb-ui="skeleton.duration" value="${skeleton.duration || storyboard.duration_minutes}"></label>
      <label class="sb-mini-field">Target injects (optional)<input type="number" min="0" step="1" data-sb-ui="skeleton.injects" value="${escapeAttribute(skeleton.injects)}"></label>
    </div>
    <div class="sb-mini-field">Workstreams
      <div class="sb-checklist sb-checklist-inline">${SB_TRACK_PRESETS.filter((track) => track.kind !== 'main').map((track) => `<label><input type="checkbox" data-sb-skeleton-track="${track.key}" ${skeleton.tracks.includes(track.key) ? 'checked' : ''}><span>${escapeHtml(track.name)}</span></label>`).join('')}</div>
    </div>
    ${storyboard.blocks.length ? `<p class="agent-warning">This replaces the current storyboard. A version is saved first and can be restored${linked ? `; ${linked} linked inject(s) will be flagged in Sync` : ''}.</p>` : ''}
    ${!isLLMAvailable() ? '<p class="agent-warning">Configure an AI connection in Settings to generate a skeleton, or start from the Library.</p>' : ''}`;
  const footer = `<button class="btn btn-ghost btn-sm" data-sb-action="open-library">Browse the library instead</button>
    <button class="btn btn-primary btn-sm" data-sb-action="generate-skeleton" ${isLLMAvailable() && !sbBusy() ? '' : 'disabled'}>${sbUiIcon('wand', 13)} Generate skeleton</button>`;
  return sbModalShell('Generate a storyboard skeleton', body, footer);
}

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
        <p class="sb-help">${report ? `${escapeHtml(report.summary || 'Deterministic checks only.')} Checked on rev ${report.checked_rev}${report.checked_rev !== storyboard.rev ? ' (storyboard changed since)' : ''}.` : 'Run the checks to review structure, timing, objectives coverage and workstream balance.'}</p>
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
  const selection = ui.selected.map((id) => sbBlock(storyboard, id)).filter(Boolean);
  const scope = options.scope === 'selection' && selection.length ? selection : sbSortedBlocks(storyboard);
  const toPlan = scope.filter((block) => !block.locked && block.beats.length < block.stimuli_target);
  const missing = scope.reduce((sum, block) => sum + block.beats.filter((beat) => !sbStimulusForBeat(project, beat.id)).length, 0);
  const toPlanCount = toPlan.reduce((sum, block) => sum + block.stimuli_target - block.beats.length, 0);
  const castMissing = storyboard.cast.filter((cast) => !sbFindActorForCast(project, cast)).length;
  const running = SbPipeline.active;
  const ai = isLLMAvailable();
  const body = `<div class="sb-generate">
      <div class="sb-mini-field">Scope
        <div class="sb-segmented">
          <button class="${options.scope !== 'selection' ? 'active' : ''}" data-sb-action="generate-scope" data-sb-value="all">Whole storyboard · ${storyboard.blocks.length} blocks</button>
          <button class="${options.scope === 'selection' ? 'active' : ''}" data-sb-action="generate-scope" data-sb-value="selection" ${selection.length ? '' : 'disabled'}>Selection · ${selection.length} block(s)</button>
        </div>
      </div>
      <div class="sb-pipeline">
        <label class="${options.plan && ai ? 'on' : ''}"><input type="checkbox" data-sb-generate="plan" ${options.plan && ai ? 'checked' : ''} ${ai ? '' : 'disabled'}><span><b>1 · Plan</b>Complete the inject plan with AI (${toPlanCount} to plan in ${toPlan.length} block(s))</span></label>
        <label class="${options.cast ? 'on' : ''}"><input type="checkbox" data-sb-generate="cast" ${options.cast ? 'checked' : ''}><span><b>2 · Cast</b>Create missing actors for the roles (${castMissing} role(s) without actor)</span></label>
        <label class="on"><input type="checkbox" checked disabled><span><b>3 · Create</b>Create one inject per planned item (${missing} ready now), linked to its block</span></label>
        <label class="${options.write && ai ? 'on' : ''}"><input type="checkbox" data-sb-generate="write" ${options.write && ai ? 'checked' : ''} ${ai ? '' : 'disabled'}><span><b>4 · Write</b>Write each inject with AI in ${escapeHtml(sbLanguageName(project))}, with the storyboard as context</span></label>
      </div>
      ${!ai ? '<p class="agent-warning">AI is not configured: injects already planned will be created as drafts, without content.</p>' : ''}
      ${SbPipeline.log.length ? `<ol class="agent-log sb-log">${SbPipeline.log.map((entry) => `<li class="agent-log-${entry.kind === 'error' ? 'error' : entry.kind === 'warning' ? 'warning' : 'success'}"><span>${entry.kind === 'success' ? '✓' : entry.kind === 'info' ? '→' : '⚠'} ${escapeHtml(entry.message)}</span></li>`).join('')}</ol>` : ''}
    </div>`;
  const footer = `${SbPipeline.checkpoint && SbPipeline.checkpoint.projectId === project.id && !running ? `<button class="btn btn-ghost btn-sm" data-sb-action="undo-generation" title="Restore actors, injects and storyboard from before ${escapeAttribute(SbPipeline.checkpoint.label)}">${sbUiIcon('undo', 13)} Undo ${escapeHtml(SbPipeline.checkpoint.label)}</button>` : ''}
    ${running ? `<button class="btn btn-secondary btn-sm" data-sb-action="stop-pipeline">${sbUiIcon('stop', 13)} Stop</button>` : `<button class="btn btn-primary btn-sm" data-sb-action="start-generation" ${sbReadOnly() || !scope.length ? 'disabled' : ''}>${sbUiIcon('play', 13)} Start</button>`}`;
  return sbModalShell('Generate actors and injects', body, footer, 'sb-modal-wide');
}

function renderSbSyncModal(storyboard) {
  const ui = sbUI();
  if (!ui.impacts) ui.impacts = sbComputeImpacts(appState.scenario);
  const impacts = ui.impacts;
  const kinds = [
    ['retime', 'Timing', 'Blocks or planned injects moved: injects are rescheduled; content is untouched.'],
    ['outdated', 'Content', 'Brief, narrative or inject plan changed after the inject was written. Manual edits are adapted, not overwritten.'],
    ['orphan', 'Orphans', 'Injects whose block or planned item was removed.'],
    ['missing', 'New injects', 'Planned injects without a stimulus yet.'],
    ['actor_missing', 'Missing actors', 'Roles used by planned injects without an actor.'],
    ['actor_outdated', 'Actors', 'Roles changed since their actor was created.']
  ];
  const actionLabels = { apply: 'Apply', skip: 'Skip', unlink: 'Keep, unlink', delete: 'Delete inject', regenerate: 'Regenerate', adapt: 'Adapt, keep manual edits', accept: 'Keep as is', create: 'Create', update: 'Update actor' };
  const body = `${impacts.length ? kinds.map(([kind, title, help]) => {
      const list = impacts.filter((impact) => impact.kind === kind);
      if (!list.length) return '';
      return `<section class="sb-sync-group"><h4>${escapeHtml(title)} · ${list.length}</h4><p class="sb-help">${escapeHtml(help)}</p>
        <ul class="sb-sync-list">${list.map((impact) => `<li>
          <span class="sb-sync-label">${escapeHtml(impact.label)}${impact.manual ? ' <span class="sb-status is-manual">manual</span>' : ''}<small>${escapeHtml(impact.detail || '')}</small></span>
          <select data-sb-impact="${impact.id}" ${SbPipeline.active ? 'disabled' : ''}>${impact.options.map((option) => sbOption(option, actionLabels[option] || option, impact.action)).join('')}</select>
        </li>`).join('')}</ul></section>`;
    }).join('') : '<p class="sb-empty">Everything is in sync: injects and actors match the storyboard.</p>'}
    ${SbPipeline.log.length ? `<ol class="agent-log sb-log">${SbPipeline.log.slice(-12).map((entry) => `<li class="agent-log-${entry.kind === 'error' ? 'error' : entry.kind === 'warning' ? 'warning' : 'success'}"><span>${escapeHtml(entry.message)}</span></li>`).join('')}</ol>` : ''}`;
  const count = impacts.filter((impact) => impact.action !== 'skip').length;
  const footer = `${SbPipeline.checkpoint && SbPipeline.checkpoint.projectId === appState.scenario.id && !SbPipeline.active ? `<button class="btn btn-ghost btn-sm" data-sb-action="undo-generation">${sbUiIcon('undo', 13)} Undo ${escapeHtml(SbPipeline.checkpoint.label)}</button>` : ''}
    <button class="btn btn-secondary btn-sm" data-sb-action="refresh-sync" ${SbPipeline.active ? 'disabled' : ''}>${sbUiIcon('sync', 13)} Refresh</button>
    ${SbPipeline.active ? `<button class="btn btn-secondary btn-sm" data-sb-action="stop-pipeline">${sbUiIcon('stop', 13)} Stop</button>` : `<button class="btn btn-primary btn-sm" data-sb-action="apply-sync" ${count && !sbReadOnly() ? '' : 'disabled'}>Apply ${count} change(s)</button>`}`;
  return sbModalShell('Synchronise actors and injects', body, footer, 'sb-modal-wide');
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
    <button class="btn btn-secondary btn-sm" data-sb-action="adapt-template" data-sb-template="${escapeAttribute(template.id)}" ${isLLMAvailable() && !sbBusy() ? '' : 'disabled'} title="Adapt names, systems, regulators and media to your organisation">${sbUiIcon('wand', 13)} Adapt with AI</button>
    <button class="btn btn-primary btn-sm" data-sb-action="use-template" data-sb-template="${escapeAttribute(template.id)}" data-sb-mode="replace">Use this scenario</button>`;
  return sbModalShell(escapeHtml(template.name), body, footer, 'sb-modal-wide');
}

// ── Focus preservation across full re-renders ────────────────────────────────
const SB_FOCUS_KEYS = ['sbField', 'sbMeta', 'sbProject', 'sbBeat', 'sbCast', 'sbTrackName', 'sbUi'];
function sbCaptureFocus() {
  const element = typeof document !== 'undefined' ? document.activeElement : null;
  const ui = sbUI();
  if (!element || !element.closest?.('.sb-workspace')) { ui.focus = null; return; }
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
