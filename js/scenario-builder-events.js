/* Scenario Builder interactions: actions, inputs, pointer editing of clips,
   drag and drop from the bin, playhead scrubbing and keyboard shortcuts. */
const SB_TEXT_FIELDS = new Set(['title', 'brief', 'narrative', 'notes']);
const SB_NUMBER_FIELDS = new Set(['start_minutes', 'duration_minutes', 'stimuli_target']);

function sbCommitRender(label) {
  StoryboardHistory.commit(label);
  App.render();
}

function sbSnap(minutes) {
  const step = Number(sbUI().snap) || 1;
  return Math.round(minutes / step) * step;
}

function sbSetZoom(value) {
  const ui = sbUI();
  const scroller = document.getElementById('sb-timeline-scroll');
  const centerMinute = scroller ? (scroller.scrollLeft + Math.max(0, scroller.clientWidth - sbHeaderWidth()) / 2) / ui.zoom : ui.playhead;
  ui.zoom = Math.min(SB_ZOOM_MAX, Math.max(SB_ZOOM_MIN, Math.round(value * 100) / 100));
  if (scroller) ui.scrollLeft = Math.max(0, centerMinute * ui.zoom - Math.max(0, scroller.clientWidth - sbHeaderWidth()) / 2);
}

function sbFitZoom() {
  const scroller = document.getElementById('sb-timeline-scroll');
  if (!scroller || !scroller.clientWidth) return false;
  const ui = sbUI();
  const storyboard = sbStoryboard();
  const available = scroller.clientWidth - sbHeaderWidth() - 36;
  const next = Math.min(SB_ZOOM_MAX, Math.max(SB_ZOOM_MIN, Math.floor(100 * available / Math.max(60, storyboard.duration_minutes)) / 100));
  const changed = Math.abs(next - ui.zoom) > 0.01;
  ui.zoom = next;
  ui.scrollLeft = 0;
  return changed;
}

function sbEnsureTrackFor(storyboard, type) {
  const preset = SB_BLOCK_TYPES[type] || SB_BLOCK_TYPES.custom;
  let track = sbTrackByKey(storyboard, preset.track);
  if (!track && preset.track === 'main') track = sbMainTrack(storyboard);
  if (!track) {
    const trackPreset = SB_TRACK_PRESETS.find((item) => item.key === preset.track);
    track = { id: uid('track'), key: trackPreset.key, name: trackPreset.name, kind: 'workstream', color: trackPreset.color, collapsed: false };
    storyboard.tracks.push(track);
  }
  return track;
}

function sbAddBlock(type, trackId = null, start = null) {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  const track = trackId ? sbTrack(storyboard, trackId) : sbEnsureTrackFor(storyboard, type);
  let at = start;
  if (at === null) at = track.kind === 'main' ? sbNextMainStart(storyboard) : sbSnap(ui.playhead);
  const block = sbMakeBlock(type, { track_id: track.id, start_minutes: Math.max(0, at) }, storyboard);
  if (ui.ripple && track.kind === 'main' && start !== null) {
    for (const other of storyboard.blocks) if (!other.locked && other.start_minutes >= block.start_minutes) other.start_minutes += block.duration_minutes;
  }
  storyboard.blocks.push(block);
  storyboard.duration_minutes = Math.max(storyboard.duration_minutes, sbStoryboardEnd(storyboard));
  ui.selected = [block.id];
  ui.inspector = 'brief';
  ui.scrollTo = block.id;
  sbCommitRender(`Add ${SB_BLOCK_TYPES[type]?.label || 'block'}`);
  return block;
}

function sbDeleteSelected() {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  const blocks = ui.selected.map((id) => sbBlock(storyboard, id)).filter((block) => block && !block.locked);
  if (!blocks.length) return;
  const linked = blocks.reduce((sum, block) => sum + sbStimuliForBlock(appState.scenario, block.id).length, 0);
  const message = `Delete ${blocks.length === 1 ? `"${blocks[0].title}"` : `${blocks.length} blocks`}?${linked ? `\n${linked} linked inject(s) are kept and will be listed as orphans in Sync.` : ''}`;
  if (!window.confirm(message)) return;
  const ids = new Set(blocks.map((block) => block.id));
  if (ui.ripple && blocks.length === 1 && sbTrack(storyboard, blocks[0].track_id)?.kind === 'main') {
    const removed = blocks[0];
    for (const other of storyboard.blocks) if (!ids.has(other.id) && !other.locked && other.start_minutes >= sbBlockEnd(removed)) other.start_minutes -= removed.duration_minutes;
  }
  storyboard.blocks = storyboard.blocks.filter((block) => !ids.has(block.id));
  ui.selected = [];
  sbCommitRender(blocks.length === 1 ? 'Delete block' : 'Delete blocks');
}

function sbDuplicateSelected() {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  const copies = ui.selected.map((id) => sbDuplicateBlock(storyboard, id)).filter(Boolean);
  if (!copies.length) return;
  ui.selected = copies.map((block) => block.id);
  sbCommitRender('Duplicate block');
}

function sbNudgeSelected(delta) {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  const blocks = ui.selected.map((id) => sbBlock(storyboard, id)).filter((block) => block && !block.locked);
  if (!blocks.length) return;
  const shift = Math.max(delta, -Math.min(...blocks.map((block) => block.start_minutes)));
  if (!shift) return;
  blocks.forEach((block) => { block.start_minutes += shift; });
  sbCommitRender('Move block');
}

/* Wraps an AI storyboard operation: version before, one undo step, feedback. */
async function sbRunAI(label, task) {
  if (sbReadOnly()) return null;
  StoryboardHistory.ensure();
  StoryboardHistory.flush();
  StoryboardHistory.snapshot(`Before ${label.toLowerCase()}`, 'ai');
  try {
    const result = await task();
    pushToast(`${label}: done. Undo is available.`, 'success');
    return result;
  } catch (error) {
    pushToast(error?.name === 'AbortError' ? 'AI operation stopped.' : sbErrorMessage(error), error?.name === 'AbortError' ? 'info' : 'error');
    return null;
  } finally {
    StoryboardHistory.commit(label);
    App.render();
  }
}

function sbReplaceStoryboard(storyboard, label) {
  const project = appState.scenario;
  StoryboardHistory.ensure(project);
  StoryboardHistory.flush();
  storyboard.rev = (project.storyboard?.rev || 0) + 1;
  project.storyboard = storyboard;
  sbFlattenWorkstreams(project);
  StoryboardHistory.ensure(project, label);
  sbAfterStoryboardChange(project, { save: true });
}

async function sbHandleAction(event) {
  const element = event.currentTarget;
  const action = element.dataset.sbAction;
  const ui = sbUI();
  const project = appState.scenario;
  const storyboard = sbStoryboard();
  const block = sbSelectedBlock();
  const allowedWhileBusy = ['stop-ai', 'stop-pipeline', 'close-modal', 'open-modal', 'set-bin', 'set-inspector', 'select-block', 'select-blocks', 'deselect', 'zoom-in', 'zoom-out', 'zoom-fit', 'dismiss-error', 'open-stimulus', 'library-category', 'preview-template', 'compare-version', 'generate-scope', 'open-library', 'export-template'];
  if (sbReadOnly() && !allowedWhileBusy.includes(action)) return;
  try {
    switch (action) {
      case 'undo': {
        const label = StoryboardHistory.undo();
        if (label) pushToast(`Undone: ${label}`, 'info');
        App.render();
        break;
      }
      case 'redo': {
        const label = StoryboardHistory.redo();
        if (label) pushToast(`Redone: ${label}`, 'info');
        App.render();
        break;
      }
      case 'open-modal':
        ui.modal = element.dataset.sbModal;
        if (['sync', 'generate'].includes(ui.modal) && !SbPipeline.active) SbPipeline.log = [];
        if (ui.modal === 'sync') ui.impacts = null;
        if (ui.modal === 'generate') ui.generate.scope = ui.selected.length ? 'selection' : 'all';
        if (ui.modal === 'coherence' && !storyboard.meta.coherence) {
          await SbAI.coherence({ ai: false });
          StoryboardHistory.silent();
        }
        if (ui.modal === 'versions') ui.diffVersionId = null;
        App.render();
        break;
      case 'close-modal':
        ui.modal = null;
        ui.previewId = null;
        App.render();
        break;
      case 'dismiss-error':
        SbAI.lastError = '';
        App.render();
        break;
      case 'set-bin':
        ui.bin = element.dataset.sbValue;
        App.render();
        break;
      case 'open-library':
        ui.modal = null;
        appState.route = 'scenario';
        App.render();
        break;
      case 'set-inspector':
        ui.inspector = element.dataset.sbValue;
        App.render();
        break;
      case 'select-block':
        ui.selected = [element.dataset.sbBlock];
        ui.scrollTo = element.dataset.sbBlock;
              App.render();
        break;
      case 'select-blocks':
        ui.selected = element.dataset.sbBlocks.split(',').filter((id) => sbBlock(storyboard, id));
        ui.scrollTo = ui.selected[0];
        ui.modal = null;
              App.render();
        break;
      case 'deselect':
        ui.selected = [];
        App.render();
        break;
      case 'add-block':
        sbAddBlock(element.dataset.sbType);
        break;
      case 'duplicate-block':
        sbDuplicateSelected();
        break;
      case 'delete-block':
        sbDeleteSelected();
        break;
      case 'toggle-lock':
        if (block) { block.locked = !block.locked; sbCommitRender(block.locked ? 'Lock block' : 'Unlock block'); }
        break;
      case 'deepen-block':
        if (block) await sbRunAI(element.dataset.sbLevel === '3' ? 'Plan injects' : 'Deepen block', () => SbAI.deepen([block.id], element.dataset.sbLevel ? Number(element.dataset.sbLevel) : null));
        break;
      case 'deepen-selection':
      case 'deepen-all': {
        const pool = action === 'deepen-all' ? storyboard.blocks : ui.selected.map((id) => sbBlock(storyboard, id)).filter(Boolean);
        const targets = pool.filter((item) => !item.locked && (sbDetailLevel(item) < 3 || item.beats.length < item.stimuli_target));
        if (!targets.length) { pushToast('Every block already has a complete inject plan.', 'info'); break; }
        await sbRunAI(`Deepen ${targets.length} block(s)`, () => SbAI.deepen(targets.map((item) => item.id), null));
        break;
      }
      case 'rewrite-block': {
        const instruction = ui.rewrite.trim();
        if (!block) break;
        if (!instruction) { pushToast('Write an instruction first.', 'info'); break; }
        const result = await sbRunAI('Rewrite block', () => SbAI.rewrite(block.id, instruction));
        if (result) ui.rewrite = '';
        App.render();
        break;
      }
      case 'generate-block':
        ui.generate.scope = 'selection';
        ui.modal = 'generate';
        App.render();
        break;
      case 'generate-beat': {
        const beatId = element.dataset.sbBeatId;
        const owner = storyboard.blocks.find((item) => item.beats.some((beat) => beat.id === beatId));
        if (!owner) break;
        const result = await SbPipeline.run({ blockIds: [owner.id], beatIds: [beatId], plan: false, cast: true, write: isLLMAvailable() });
        pushToast(`${result.created} inject created${result.written ? ' and written' : ''}.`, 'success');
        App.render();
        break;
      }
      case 'send-to-agent':
        if (block) { sbSendToAgent(block); pushToast('Agent brief prepared for this block. Review it and press Start.', 'info'); App.render(); }
        break;
      case 'add-beat': {
        if (!block) break;
        const last = block.beats[block.beats.length - 1];
        const offset = Math.min(Math.max(0, block.duration_minutes - 1), last ? last.offset_minutes + Math.max(5, Math.round(block.duration_minutes / Math.max(2, block.stimuli_target + 1))) : 0);
        block.beats.push(sbMakeBeat({ offset_minutes: offset, channel: last?.channel || 'email_internal', cast_id: last?.cast_id || '' }));
        block.stimuli_target = Math.max(block.stimuli_target, block.beats.length);
        ui.inspector = 'plan';
        sbCommitRender('Add planned inject');
        break;
      }
      case 'delete-beat': {
        if (!block) break;
        const beatId = element.dataset.sbBeatId;
        const linked = sbStimulusForBeat(project, beatId);
        block.beats = block.beats.filter((beat) => beat.id !== beatId);
        if (linked) pushToast('The generated inject is kept; Sync lists it as an orphan.', 'info');
        sbCommitRender('Remove planned inject');
        break;
      }
      case 'open-stimulus':
        if (element.dataset.sbStimulus) {
          appState.selectedStimulusId = element.dataset.sbStimulus;
          appState.stimulusModalId = element.dataset.sbStimulus;
        } else if (element.dataset.sbBlock) {
          ui.selected = [element.dataset.sbBlock];
          ui.inspector = 'plan';
        }
        App.render();
        break;
      case 'lock-stimulus': {
        const stimulus = getStimulus(element.dataset.sbStimulus);
        if (stimulus?.scenario_link) { sbLockStimulus(stimulus, !stimulus.scenario_link.locked); saveLocal(false); App.render(); }
        break;
      }
      case 'unlink-stimulus': {
        const stimulus = getStimulus(element.dataset.sbStimulus);
        if (stimulus && window.confirm('Unlink this inject from the storyboard? It will no longer follow scenario changes.')) { delete stimulus.scenario_link; saveLocal(false); App.render(); }
        break;
      }
      case 'link-stimulus': {
        const select = document.querySelector('[data-sb-link-select]');
        const stimulus = select && getStimulus(select.value);
        if (!block || !stimulus) break;
        sbStampStimulus(stimulus, block, null, storyboard);
        saveLocal(false);
        pushToast('Inject linked to this block.', 'success');
        App.render();
        break;
      }
      case 'auto-link': {
        const count = sbAutoLinkByTime(project);
        saveLocal(false);
        pushToast(`${count} inject(s) linked to the storyboard.`, 'success');
        App.render();
        break;
      }
      case 'zoom-in': sbSetZoom(ui.zoom * 1.25); App.render(); break;
      case 'zoom-out': sbSetZoom(ui.zoom / 1.25); App.render(); break;
      case 'zoom-fit': sbFitZoom(); App.render(); break;
      case 'toggle-ripple': ui.ripple = !ui.ripple; App.render(); break;
      case 'add-track': {
        const used = new Set(storyboard.tracks.map((track) => track.key));
        const preset = SB_TRACK_PRESETS.find((item) => item.kind !== 'main' && !used.has(item.key));
        storyboard.tracks.push({ id: uid('track'), key: preset?.key || 'custom', name: preset?.name || 'New workstream', kind: 'workstream', color: preset?.color || '#6d687e', collapsed: false });
        sbCommitRender('Add track');
        break;
      }
      case 'delete-track': {
        const track = sbTrack(storyboard, element.dataset.sbTrack);
        if (!track || track.kind === 'main') break;
        const blocks = storyboard.blocks.filter((item) => item.track_id === track.id);
        if (blocks.length && !window.confirm(`Delete the track "${track.name}" and its ${blocks.length} block(s)?`)) break;
        storyboard.blocks = storyboard.blocks.filter((item) => item.track_id !== track.id);
        storyboard.tracks = storyboard.tracks.filter((item) => item.id !== track.id);
        sbCommitRender('Delete track');
        break;
      }
      case 'move-track': {
        const index = storyboard.tracks.findIndex((track) => track.id === element.dataset.sbTrack);
        const target = index + Number(element.dataset.sbValue);
        if (index < 1 || target < 1 || target >= storyboard.tracks.length) break;
        const [track] = storyboard.tracks.splice(index, 1);
        storyboard.tracks.splice(target, 0, track);
        sbCommitRender('Reorder tracks');
        break;
      }
      case 'library-category':
        ui.libraryCategory = element.dataset.sbValue || '';
        App.render();
        break;
      case 'preview-template':
        ui.previewId = element.dataset.sbTemplate;
        ui.modal = 'preview';
        App.render();
        break;
      case 'use-template': {
        const template = sbFindTemplate(element.dataset.sbTemplate);
        if (!template) break;
        const mode = element.dataset.sbMode === 'insert' ? 'insert' : 'replace';
        if (mode === 'replace' && storyboard.blocks.length && !window.confirm(`Replace the current storyboard with "${template.name}"? A version is saved first and Undo is available.`)) break;
        StoryboardHistory.snapshot(`Before template "${template.name}"`, 'ai');
        const before = project.storyboard;
        sbApplyTemplate(template, mode);
        if (project.storyboard !== before) StoryboardHistory.ensure(project, `Use template "${template.name}"`);
        else StoryboardHistory.commit(`Insert template "${template.name}"`);
        sbAfterStoryboardChange(project, { save: true });
        ui.modal = null;
        ui.previewId = null;
        ui.selected = [];
        ui.playhead = 0;
        if (mode === 'replace') ui.zoom = null;
        appState.route = 'storyline';
        pushToast(`"${template.name}" ${mode === 'insert' ? 'inserted' : 'loaded'}. Refine blocks, then generate injects.`, 'success');
        App.render();
        break;
      }
      case 'adapt-template': {
        const template = sbFindTemplate(element.dataset.sbTemplate);
        if (!template) break;
        if (storyboard.blocks.length && !window.confirm(`Adapt "${template.name}" to your organisation with AI and replace the current storyboard? A version is saved first.`)) break;
        StoryboardHistory.snapshot(`Before adapting "${template.name}"`, 'ai');
        try {
          const adapted = await SbAI.adaptTemplate(template);
          const before = project.storyboard;
          sbApplyTemplate({ ...adapted, id: template.id, name: adapted.name || template.name }, 'replace');
          if (project.storyboard !== before) StoryboardHistory.ensure(project, `Adapt template "${template.name}"`);
          sbAfterStoryboardChange(project, { save: true });
          ui.modal = null;
          ui.selected = [];
          ui.zoom = null;
          appState.route = 'storyline';
          pushToast(`"${template.name}" adapted to your organisation.`, 'success');
        } catch (error) {
          pushToast(error?.name === 'AbortError' ? 'AI operation stopped.' : sbErrorMessage(error), 'error');
        }
        App.render();
        break;
      }
      case 'export-template': {
        const template = sbFindTemplate(element.dataset.sbTemplate);
        if (template) sbExportTemplate(template);
        break;
      }
      case 'delete-template':
        if (window.confirm('Delete this template from your library?')) {
          sbDeleteUserTemplate(element.dataset.sbTemplate);
          ui.modal = null;
          App.render();
        }
        break;
      case 'save-template': {
        const template = sbSaveCurrentAsTemplate(ui.templateName || project.name || 'My scenario');
        ui.templateName = '';
        pushToast(`Template "${template.name}" saved in this browser. Export it to share it.`, 'success');
        App.render();
        break;
      }
      case 'import-template': {
        const template = await sbImportTemplateFile();
        if (template) { pushToast(`Template "${template.name}" imported.`, 'success'); ui.bin = 'library'; App.render(); }
        break;
      }
      case 'add-cast':
        storyboard.cast.push(sbMakeCast({ organization: project.client.name || '' }));
        sbCommitRender('Add role');
        break;
      case 'delete-cast': {
        const castId = element.dataset.sbCastId;
        const used = storyboard.blocks.reduce((sum, item) => sum + item.beats.filter((beat) => beat.cast_id === castId).length, 0);
        if (used && !window.confirm(`This role sends ${used} planned inject(s). Remove it anyway?`)) break;
        storyboard.cast = storyboard.cast.filter((cast) => cast.id !== castId);
        storyboard.blocks.forEach((item) => item.beats.forEach((beat) => { if (beat.cast_id === castId) beat.cast_id = ''; }));
        sbCommitRender('Remove role');
        break;
      }
      case 'plan-cast':
        await sbRunAI('Suggest roles', () => SbAI.planCast());
        break;
      case 'create-actors': {
        const missing = storyboard.cast.filter((cast) => !sbFindActorForCast(project, cast));
        storyboard.cast.forEach((cast) => { const actor = sbFindActorForCast(project, cast); if (actor && cast.actor_id !== actor.id) cast.actor_id = actor.id; });
        if (!missing.length) { StoryboardHistory.commit('Link actors'); pushToast('Every role already has an actor.', 'info'); App.render(); break; }
        let details = {};
        if (isLLMAvailable()) {
          try { details = await SbAI.nameCast(missing.map((cast) => cast.id)); } catch (error) { if (error?.name !== 'AbortError') pushToast(`AI naming failed; roles are used as names. ${sbErrorMessage(error)}`, 'info'); }
        }
        missing.forEach((cast) => sbCreateActorForCast(project, cast, details[cast.id] || {}));
        StoryboardHistory.commit('Create actors');
        saveLocal(false);
        pushToast(`${missing.length} actor(s) created.`, 'success');
        App.render();
        break;
      }
      case 'save-version': {
        const version = StoryboardHistory.snapshot(ui.versionLabel.trim() || `Version rev ${storyboard.rev}`, 'named');
        ui.versionLabel = '';
        ui.diffVersionId = version.id;
        pushToast('Version saved with the project.', 'success');
        App.render();
        break;
      }
      case 'mark-validated':
        storyboard.meta.validated_rev = storyboard.rev + 1;
        StoryboardHistory.commit('Mark as validated');
        StoryboardHistory.snapshot(`Validated rev ${storyboard.rev}`, 'named');
        pushToast(`Storyboard rev ${storyboard.rev} marked as validated.`, 'success');
        App.render();
        break;
      case 'compare-version':
        ui.diffVersionId = element.dataset.sbVersion;
        App.render();
        break;
      case 'restore-version': {
        const version = StoryboardHistory.findVersion(element.dataset.sbVersion);
        if (!version || !window.confirm(`Restore "${version.label}"? The current storyboard is saved as a version first.`)) break;
        StoryboardHistory.restore(version.id);
        ui.modal = null;
        ui.selected = [];
        pushToast(`Restored "${version.label}".`, 'success');
        App.render();
        break;
      }
      case 'delete-version':
        StoryboardHistory.deleteVersion(element.dataset.sbVersion);
        ui.diffVersionId = null;
        App.render();
        break;
      case 'generate-skeleton': {
        const brief = (ui.skeleton.brief || storyboard.meta.brief || project.scenario.summary || '').trim();
        if (!brief) { pushToast('Describe the exercise you want in the brief.', 'info'); break; }
        const duration = sbInt(ui.skeleton.duration || storyboard.duration_minutes, SB_DEFAULT_DURATION, 30, SB_MAX_DURATION);
        StoryboardHistory.flush();
        StoryboardHistory.snapshot('Before AI skeleton', 'ai');
        try {
          const result = await SbAI.skeleton({ brief, duration, tracks: ui.skeleton.tracks, injects: Number(ui.skeleton.injects) || 0 });
          result.storyboard.meta.brief = brief;
          for (const cast of result.storyboard.cast) { const actor = sbFindActorForCast(project, cast); if (actor) cast.actor_id = actor.id; }
          sbReplaceStoryboard(result.storyboard, 'AI skeleton');
          if (!sbObjectivesList(project).length && result.objectives.length) project.scenario.objectives = result.objectives.join('\n');
          if (!project.scenario.summary?.trim() && result.storyboard.meta.synopsis) project.scenario.summary = result.storyboard.meta.synopsis;
          if (!project.name?.trim() && result.title) project.name = result.title;
          saveLocal(false);
          ui.modal = null;
          ui.selected = [];
          ui.zoom = null;
          appState.route = 'storyline';
          pushToast('Skeleton generated. Deepen blocks layer by layer, then generate injects.', 'success');
        } catch (error) {
          pushToast(error?.name === 'AbortError' ? 'AI operation stopped.' : sbErrorMessage(error), 'error');
        }
        App.render();
        break;
      }
      case 'run-coherence':
        try {
          await SbAI.coherence({ ai: element.dataset.sbValue === 'ai' });
          StoryboardHistory.silent();
        } catch (error) {
          pushToast(error?.name === 'AbortError' ? 'AI review stopped.' : sbErrorMessage(error), 'error');
        }
        App.render();
        break;
      case 'apply-fix': {
        const report = storyboard.meta.coherence;
        const issue = report?.issues?.[Number(element.dataset.sbIssue)];
        const target = issue?.fix && sbBlock(storyboard, issue.fix.block_id);
        if (!target) break;
        if (target.locked) { pushToast('This block is locked.', 'info'); break; }
        Object.assign(target, issue.fix.patch);
        target.ai_rev = storyboard.rev + 1;
        report.issues.splice(Number(element.dataset.sbIssue), 1);
        sbCommitRender('Apply coherence fix');
        break;
      }
      case 'generate-scope':
        ui.generate.scope = element.dataset.sbValue;
        App.render();
        break;
      case 'start-generation': {
        const ids = ui.generate.scope === 'selection' ? ui.selected.filter((id) => sbBlock(storyboard, id)) : null;
        const cellIds = ui.generate.scope === 'cell' && sbCell(project, ui.generate.cellId) ? [ui.generate.cellId] : null;
        const result = await SbPipeline.run({ blockIds: ids && ids.length ? ids : null, cellIds, plan: ui.generate.plan && !cellIds, cast: ui.generate.cast, write: ui.generate.write });
        ui.impacts = null;
        if (SbPipeline.status === 'complete') pushToast(`${result.created} inject(s) created, ${result.written} written with AI.`, 'success');
        App.render();
        break;
      }
      case 'stop-pipeline':
        SbPipeline.stop();
        App.render();
        break;
      case 'stop-ai':
        SbAI.stop();
        break;
      case 'undo-generation':
        if (window.confirm(`Restore actors, injects and storyboard from before the ${SbPipeline.checkpoint?.label || 'last generation'}? Later edits are replaced too.`)) {
          SbPipeline.undo();
          ui.impacts = null;
          App.render();
        }
        break;
      case 'refresh-sync':
        ui.impacts = null;
        App.render();
        break;
      case 'apply-sync': {
        const impacts = ui.impacts || sbComputeImpacts(project);
        const destructive = impacts.filter((impact) => impact.action === 'delete').length;
        if (destructive && !window.confirm(`${destructive} inject(s) will be deleted. Continue?`)) break;
        await SbPipeline.applyImpacts(impacts);
        ui.impacts = null;
        App.render();
        break;
      }
      default:
        break;
    }
  } catch (error) {
    pushToast(sbErrorMessage(error), 'error');
    App.render();
  }
}

// ── Inputs ───────────────────────────────────────────────────────────────────
function sbBindInputs(root) {
  const ui = sbUI();
  const project = appState.scenario;
  const storyboard = sbStoryboard();

  root.querySelectorAll('[data-sb-field]').forEach((input) => {
    const field = input.dataset.sbField;
    if (SB_TEXT_FIELDS.has(field)) {
      input.addEventListener('input', () => {
        const block = sbSelectedBlock();
        if (!block) return;
        block[field] = sbText(input.value, field === 'narrative' ? 8000 : field === 'title' ? 200 : 4000);
        StoryboardHistory.commit(`Edit ${field}`, { debounce: true });
        if (field === 'title') {
          const title = document.querySelector(`[data-sb-clip="${block.id}"] .sb-clip-head strong`);
          if (title) title.textContent = input.value;
        }
      });
      input.addEventListener('change', () => StoryboardHistory.flush());
      return;
    }
    input.addEventListener('change', () => {
      const block = sbSelectedBlock();
      if (!block) return;
      if (SB_NUMBER_FIELDS.has(field)) {
        const previousEnd = sbBlockEnd(block);
        const value = sbInt(input.value, block[field], field === 'duration_minutes' ? 5 : 0, field === 'stimuli_target' ? SB_MAX_BEATS : SB_MAX_DURATION);
        block[field] = value;
        if (field === 'duration_minutes') block.beats.forEach((beat) => { beat.offset_minutes = Math.min(beat.offset_minutes, Math.max(0, value - 1)); });
        if (ui.ripple && field !== 'stimuli_target' && sbTrack(storyboard, block.track_id)?.kind === 'main') sbRipple(storyboard, block, previousEnd);
      } else if (field === 'type') {
        const previous = SB_BLOCK_TYPES[block.type] || SB_BLOCK_TYPES.custom;
        if (block.title === previous.label) block.title = SB_BLOCK_TYPES[input.value]?.label || block.title;
        block.type = SB_BLOCK_TYPES[input.value] ? input.value : 'custom';
      } else if (field === 'track_id') {
        if (sbTrack(storyboard, input.value)) block.track_id = input.value;
      } else if (field === 'status') {
        block.status = ['draft', 'refined', 'validated'].includes(input.value) ? input.value : 'draft';
      }
      sbCommitRender(`Edit ${field.replace(/_/g, ' ')}`);
    });
  });

  root.querySelectorAll('[data-sb-objective]').forEach((input) => {
    input.addEventListener('change', () => {
      const block = sbSelectedBlock();
      if (!block) return;
      const objective = input.dataset.sbObjective;
      block.objectives = input.checked ? [...new Set([...block.objectives, objective])] : block.objectives.filter((item) => item !== objective);
      StoryboardHistory.commit('Edit objectives');
    });
  });

  root.querySelectorAll('[data-sb-beat]').forEach((input) => {
    const [beatId, field] = input.dataset.sbBeat.split('.');
    const findBeat = () => { const block = sbSelectedBlock(); return block ? { block, beat: block.beats.find((item) => item.id === beatId) } : {}; };
    if (field === 'title' || field === 'intent') {
      input.addEventListener('input', () => {
        const { beat } = findBeat();
        if (!beat) return;
        beat[field] = sbText(input.value, field === 'title' ? 300 : 2000);
        StoryboardHistory.commit('Edit planned inject', { debounce: true });
      });
      input.addEventListener('change', () => StoryboardHistory.flush());
      return;
    }
    input.addEventListener('change', () => {
      const { block, beat } = findBeat();
      if (!beat) return;
      if (field === 'offset_minutes') beat.offset_minutes = sbInt(input.value, beat.offset_minutes, 0, Math.max(0, block.duration_minutes - 1));
      else if (field === 'channel') { beat.channel = sbValidChannel(input.value); beat.template_id = ''; }
      else if (field === 'template_id') beat.template_id = sbValidTemplateId(beat.channel, input.value);
      else if (field === 'cast_id') beat.cast_id = storyboard.cast.some((cast) => cast.id === input.value) ? input.value : '';
      if (field === 'offset_minutes') block.beats.sort((a, b) => a.offset_minutes - b.offset_minutes);
      sbCommitRender('Edit planned inject');
    });
  });

  root.querySelectorAll('[data-sb-meta]').forEach((input) => {
    input.addEventListener('input', () => {
      storyboard.meta[input.dataset.sbMeta] = sbText(input.value, 8000);
      StoryboardHistory.commit(`Edit ${input.dataset.sbMeta}`, { debounce: true });
    });
    input.addEventListener('change', () => StoryboardHistory.flush());
  });

  root.querySelectorAll('[data-sb-project]').forEach((input) => {
    input.addEventListener('input', () => {
      setByPath(project, input.dataset.sbProject, input.value);
      clearTimeout(window._sbProjectSaveTimer);
      window._sbProjectSaveTimer = setTimeout(() => saveLocal(false), 600);
      if (input.dataset.sbProject === 'name') {
        const nav = document.querySelector('.nav-project-name');
        if (nav) nav.textContent = input.value || 'CrisisMaker project';
      }
    });
  });

  root.querySelectorAll('[data-sb-cast]').forEach((input) => {
    const [castId, field] = input.dataset.sbCast.split('.');
    const cast = storyboard.cast.find((item) => item.id === castId);
    if (!cast) return;
    if (field === 'label' || field === 'organization' || field === 'description') {
      input.addEventListener('input', () => {
        cast[field] = sbText(input.value, field === 'description' ? 1000 : 200);
        StoryboardHistory.commit('Edit role', { debounce: true });
      });
      input.addEventListener('change', () => StoryboardHistory.flush());
      return;
    }
    input.addEventListener('change', () => {
      if (field === 'role') cast.role = sbRoleValue(input.value);
      if (field === 'actor_id') {
        const actor = getActor(input.value);
        cast.actor_id = actor ? actor.id : '';
        if (actor) actor.scenario_link = { cast_id: cast.id, source_hash: sbCastSourceHash(cast), content_hash: sbActorContentHash(actor), locked: false };
      }
      sbCommitRender('Edit role');
    });
  });

  root.querySelectorAll('[data-sb-track-name]').forEach((input) => {
    input.addEventListener('input', () => {
      const track = sbTrack(storyboard, input.dataset.sbTrackName);
      if (!track) return;
      track.name = sbText(input.value, 120) || track.name;
      StoryboardHistory.commit('Rename track', { debounce: true });
    });
    input.addEventListener('change', () => StoryboardHistory.flush());
  });

  root.querySelectorAll('[data-sb-ui]').forEach((input) => {
    input.addEventListener('input', () => {
      const path = input.dataset.sbUi.split('.');
      let target = ui;
      path.slice(0, -1).forEach((key) => { target = target[key]; });
      target[path[path.length - 1]] = input.value;
    });
  });

  root.querySelectorAll('[data-sb-ui-select]').forEach((select) => {
    select.addEventListener('change', () => {
      ui[select.dataset.sbUiSelect] = Number(select.value) || select.value;
      App.render();
    });
  });

  root.querySelectorAll('[data-sb-skeleton-track]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.sbSkeletonTrack;
      ui.skeleton.tracks = input.checked ? [...new Set([...ui.skeleton.tracks, key])] : ui.skeleton.tracks.filter((item) => item !== key);
    });
  });

  root.querySelectorAll('[data-sb-generate]').forEach((input) => {
    input.addEventListener('change', () => {
      ui.generate[input.dataset.sbGenerate] = input.checked;
      App.render();
    });
  });

  root.querySelectorAll('[data-sb-impact]').forEach((select) => {
    select.addEventListener('change', () => {
      const impact = (ui.impacts || []).find((item) => item.id === select.dataset.sbImpact);
      if (impact) impact.action = select.value;
      App.render();
    });
  });

  root.querySelectorAll('[data-sb-duration]').forEach((input) => {
    input.addEventListener('change', () => {
      storyboard.duration_minutes = Math.max(sbStoryboardEnd(storyboard), sbInt(input.value, storyboard.duration_minutes, 30, SB_MAX_DURATION));
      sbCommitRender('Change duration');
    });
  });

  root.querySelectorAll('[data-sb-zoom]').forEach((input) => {
    input.addEventListener('input', () => {
      const canvas = document.querySelector('.sb-canvas');
      if (!canvas) return;
      const value = Number(input.value);
      canvas.style.setProperty('--ppm', value);
      canvas.querySelectorAll('[data-sb-clip]').forEach((clip) => {
        const target = sbBlock(storyboard, clip.dataset.sbClip);
        if (!target) return;
        clip.style.left = `${target.start_minutes * value}px`;
        clip.style.width = `${Math.max(6, target.duration_minutes * value)}px`;
      });
    });
    input.addEventListener('change', () => { sbSetZoom(Number(input.value)); App.render(); });
  });

  root.querySelectorAll('[data-sb-filter="library"]').forEach((input) => {
    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      root.querySelectorAll('.sb-template-card').forEach((card) => { card.hidden = !!query && !card.dataset.sbSearch.includes(query); });
    });
  });

  root.querySelectorAll('[data-sb-backdrop]').forEach((backdrop) => {
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop && !SbPipeline.active) { ui.modal = null; App.render(); }
    });
  });
}

// ── Pointer editing on the timeline ──────────────────────────────────────────
function sbEdgeCandidates(storyboard, excluded) {
  const edges = [0, storyboard.duration_minutes, sbUI().playhead];
  for (const block of storyboard.blocks) {
    if (excluded.has(block.id)) continue;
    edges.push(block.start_minutes, sbBlockEnd(block));
  }
  return edges;
}

function sbSnapWithEdges(value, edges, ppm) {
  const tolerance = 8 / ppm;
  let best = null;
  for (const edge of edges) {
    if (Math.abs(edge - value) <= tolerance && (best === null || Math.abs(edge - value) < Math.abs(best - value))) best = edge;
  }
  return best !== null ? best : sbSnap(value);
}

function sbDragTip(canvas, text, x, y) {
  let tip = canvas.querySelector('.sb-drag-tip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'sb-drag-tip'; canvas.appendChild(tip); }
  tip.textContent = text;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

function sbStartClipPointer(event, clip) {
  if (event.button !== 0) return;
  const ui = sbUI();
  const storyboard = sbStoryboard();
  const id = clip.dataset.sbClip;
  const block = sbBlock(storyboard, id);
  if (!block) return;
  const handle = event.target.closest('[data-sb-resize]');
  const additive = event.shiftKey || event.metaKey || event.ctrlKey;
  if (additive) ui.selected = ui.selected.includes(id) ? ui.selected.filter((item) => item !== id) : [...ui.selected, id];
  else if (!ui.selected.includes(id)) ui.selected = [id];
  if (sbReadOnly() || additive) { App.render(); return; }
  event.preventDefault();
  const ppm = ui.zoom;
  const canvas = clip.closest('.sb-canvas');
  const startX = event.clientX;
  const startY = event.clientY;
  const mode = handle ? `resize-${handle.dataset.sbResize}` : 'move';
  const ids = mode === 'move' ? ui.selected.filter((item) => { const target = sbBlock(storyboard, item); return target && !target.locked; }) : [id];
  if (!ids.length || (mode !== 'move' && block.locked)) { App.render(); return; }
  const originals = new Map(ids.map((item) => { const target = sbBlock(storyboard, item); return [item, { start: target.start_minutes, duration: target.duration_minutes }]; }));
  const elements = new Map(ids.map((item) => [item, canvas.querySelector(`[data-sb-clip="${item}"]`)]));
  const edges = sbEdgeCandidates(storyboard, new Set(ids));
  const minOriginal = Math.min(...[...originals.values()].map((value) => value.start));
  let moved = false;
  let delta = 0;
  let targetLane = null;
  try { clip.setPointerCapture(event.pointerId); } catch (_) { /* Older browsers. */ }

  const onMove = (moveEvent) => {
    const dx = moveEvent.clientX - startX;
    if (!moved && Math.abs(dx) < 4 && Math.abs(moveEvent.clientY - startY) < 4) return;
    moved = true;
    document.body.classList.add('sb-dragging');
    const raw = dx / ppm;
    const original = originals.get(id);
    if (mode === 'move') {
      const candidateStart = sbSnapWithEdges(original.start + raw, edges, ppm);
      const candidateEnd = sbSnapWithEdges(original.start + original.duration + raw, edges, ppm);
      const byStart = candidateStart - original.start;
      const byEnd = candidateEnd - original.start - original.duration;
      delta = Math.abs(byStart - raw) <= Math.abs(byEnd - raw) ? byStart : byEnd;
      delta = Math.max(-minOriginal, delta);
      elements.forEach((element, item) => { if (element) element.style.left = `${(originals.get(item).start + delta) * ppm}px`; });
      if (ids.length === 1) {
        const lane = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-sb-lane]');
        canvas.querySelectorAll('.sb-lane.is-drop-target').forEach((element) => element.classList.remove('is-drop-target'));
        targetLane = lane && lane.dataset.sbLane !== block.track_id ? lane.dataset.sbLane : null;
        if (targetLane) lane.classList.add('is-drop-target');
      }
      sbDragTip(canvas, `${sbFormatOffset(original.start + delta)} → ${sbFormatOffset(original.start + delta + original.duration)}`, sbHeaderWidth() + (original.start + delta) * ppm, clip.offsetTop + clip.parentElement.offsetTop - 26);
    } else if (mode === 'resize-right') {
      const end = sbSnapWithEdges(original.start + original.duration + raw, edges, ppm);
      delta = Math.max(5, end - original.start) - original.duration;
      clip.style.width = `${(original.duration + delta) * ppm}px`;
      sbDragTip(canvas, `${sbFormatDuration(original.duration + delta)} · ends ${sbFormatOffset(original.start + original.duration + delta)}`, sbHeaderWidth() + (original.start + original.duration + delta) * ppm, clip.offsetTop + clip.parentElement.offsetTop - 26);
    } else {
      const start = Math.max(0, sbSnapWithEdges(original.start + raw, edges, ppm));
      delta = Math.min(start, original.start + original.duration - 5) - original.start;
      clip.style.left = `${(original.start + delta) * ppm}px`;
      clip.style.width = `${(original.duration - delta) * ppm}px`;
      sbDragTip(canvas, `starts ${sbFormatOffset(original.start + delta)} · ${sbFormatDuration(original.duration - delta)}`, sbHeaderWidth() + (original.start + delta) * ppm, clip.offsetTop + clip.parentElement.offsetTop - 26);
    }
  };

  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.body.classList.remove('sb-dragging');
    canvas.querySelector('.sb-drag-tip')?.remove();
    if (!moved || (!delta && !targetLane)) { App.render(); return; }
    const main = sbMainTrack(storyboard);
    if (mode === 'move') {
      const previousEnd = sbBlockEnd(block);
      ids.forEach((item) => { sbBlock(storyboard, item).start_minutes = originals.get(item).start + delta; });
      if (targetLane && sbTrack(storyboard, targetLane)) block.track_id = targetLane;
      if (ui.ripple && ids.length === 1 && block.track_id === main.id && !targetLane) sbRipple(storyboard, block, previousEnd);
      sbCommitRender(ids.length > 1 ? 'Move blocks' : targetLane ? 'Move block to track' : 'Move block');
    } else {
      const previousEnd = sbBlockEnd(block);
      const original = originals.get(id);
      if (mode === 'resize-right') block.duration_minutes = original.duration + delta;
      else { block.start_minutes = original.start + delta; block.duration_minutes = original.duration - delta; }
      block.beats.forEach((beat) => { beat.offset_minutes = Math.min(beat.offset_minutes, Math.max(0, block.duration_minutes - 1)); });
      if (ui.ripple && mode === 'resize-right' && block.track_id === main.id) sbRipple(storyboard, block, previousEnd);
      sbCommitRender('Resize block');
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

function sbStartScrub(event) {
  if (event.button !== 0) return;
  const ui = sbUI();
  const storyboard = sbStoryboard();
  const ruler = document.querySelector('[data-sb-ruler]');
  const playhead = document.getElementById('sb-playhead');
  if (!ruler || !playhead) return;
  event.preventDefault();
  const label = playhead.querySelector('[data-sb-playhead]');
  const update = (clientX) => {
    const rect = ruler.getBoundingClientRect();
    const minute = Math.max(0, Math.min(storyboard.duration_minutes, Math.round((clientX - rect.left) / ui.zoom)));
    ui.playhead = minute;
    playhead.style.left = `${sbHeaderWidth() + minute * ui.zoom}px`;
    if (label) label.textContent = sbFormatOffset(minute);
  };
  update(event.clientX);
  document.body.classList.add('sb-dragging');
  const onMove = (moveEvent) => update(moveEvent.clientX);
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.classList.remove('sb-dragging');
    App.render();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function sbBindTimeline(root) {
  const ui = sbUI();
  const storyboard = sbStoryboard();
  const scroller = root.querySelector('#sb-timeline-scroll');
  if (scroller) {
    scroller.scrollLeft = ui.scrollLeft || 0;
    scroller.scrollTop = ui.scrollTop || 0;
    scroller.addEventListener('scroll', () => { ui.scrollLeft = scroller.scrollLeft; ui.scrollTop = scroller.scrollTop; }, { passive: true });
    scroller.addEventListener('wheel', (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      sbSetZoom(ui.zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
      App.render();
    }, { passive: false });
  }
  root.querySelectorAll('[data-sb-clip]').forEach((clip) => {
    clip.addEventListener('pointerdown', (event) => sbStartClipPointer(event, clip));
    clip.addEventListener('dblclick', () => {
      ui.selected = [clip.dataset.sbClip];
          ui.inspector = 'brief';
      ui.focus = { key: 'sbField', value: 'title', start: null, end: null };
      App.render();
      sbRestoreFocus();
    });
    clip.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); ui.selected = [clip.dataset.sbClip]; App.render(); }
    });
  });
  root.querySelectorAll('[data-sb-lane]').forEach((lane) => {
    lane.addEventListener('pointerdown', (event) => {
      if (event.target !== lane || event.button !== 0) return;
      if (ui.selected.length) { ui.selected = []; App.render(); }
    });
    lane.addEventListener('dragover', (event) => {
      if (!event.dataTransfer?.types?.includes('text/plain') || sbReadOnly()) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      lane.classList.add('is-drop-target');
    });
    lane.addEventListener('dragleave', () => lane.classList.remove('is-drop-target'));
    lane.addEventListener('drop', (event) => {
      lane.classList.remove('is-drop-target');
      const data = event.dataTransfer?.getData('text/plain') || '';
      if (!data.startsWith('sb-block:') || sbReadOnly()) return;
      event.preventDefault();
      const type = data.slice('sb-block:'.length);
      if (!SB_BLOCK_TYPES[type]) return;
      const rect = lane.getBoundingClientRect();
      const minute = Math.max(0, sbSnap((event.clientX - rect.left) / ui.zoom));
      sbAddBlock(type, lane.dataset.sbLane, minute);
    });
  });
  root.querySelectorAll('[data-sb-palette]').forEach((item) => {
    item.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', `sb-block:${item.dataset.sbPalette}`);
      event.dataTransfer.effectAllowed = 'copy';
    });
  });
  root.querySelector('[data-sb-ruler]')?.addEventListener('pointerdown', sbStartScrub);
  root.querySelector('[data-sb-playhead]')?.addEventListener('pointerdown', sbStartScrub);
  if (ui.scrollTo && scroller) {
    const block = sbBlock(storyboard, ui.scrollTo);
    if (block) {
      const left = block.start_minutes * ui.zoom;
      const visible = scroller.clientWidth - sbHeaderWidth();
      if (left < scroller.scrollLeft || left > scroller.scrollLeft + visible - 60) scroller.scrollLeft = Math.max(0, left - 40);
      ui.scrollLeft = scroller.scrollLeft;
    }
  }
  ui.scrollTo = null;
}

// ── Keyboard ─────────────────────────────────────────────────────────────────
function sbOnKeyDown(event) {
  if (appState.route !== 'storyline' || appState.stimulusModalId || appState.settingsDrawerOpen || appState.launchScreenOpen) return;
  const ui = sbUI();
  const target = event.target;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || '') || target?.isContentEditable;
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (event.key === 'Escape') {
    if (ui.modal && !SbPipeline.active) { ui.modal = null; App.render(); }
    else if (!typing && ui.selected.length) { ui.selected = []; App.render(); }
    return;
  }
  if (typing || ui.modal) return;
  if (mod && (key === 'z' || key === 'y')) {
    event.preventDefault();
    if (sbReadOnly()) return;
    const label = (key === 'y' || event.shiftKey) ? StoryboardHistory.redo() : StoryboardHistory.undo();
    if (label) pushToast(`${key === 'y' || event.shiftKey ? 'Redone' : 'Undone'}: ${label}`, 'info');
    App.render();
    return;
  }
  if (event.key === '+' || event.key === '=') { sbSetZoom(ui.zoom * 1.25); App.render(); return; }
  if (event.key === '-' || event.key === '_') { sbSetZoom(ui.zoom / 1.25); App.render(); return; }
  if (sbReadOnly() || !ui.selected.length) return;
  if (mod && key === 'd') { event.preventDefault(); sbDuplicateSelected(); return; }
  if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); sbDeleteSelected(); return; }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    const step = event.shiftKey ? 1 : (Number(ui.snap) || 5);
    sbNudgeSelected(event.key === 'ArrowLeft' ? -step : step);
  }
}

function bindScenarioBuilderEvents() {
  if (typeof window !== 'undefined' && !window._sbKeysInstalled) {
    window._sbKeysInstalled = true;
    window.addEventListener('keydown', sbOnKeyDown);
    let resizeTimer = null;
    let compact = sbCompact();
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (['storyline', 'detailed'].includes(appState.route) && sbCompact() !== compact) { compact = sbCompact(); App.render(); }
      }, 200);
    });
  }
  if (!SB_LIVE_ROUTES.includes(appState.route)) return;
  const roots = [...document.querySelectorAll('[data-sb-scope]')];
  if (!roots.length) return;
  const ui = sbUI();
  for (const root of roots) {
    root.querySelectorAll('[data-sb-action]').forEach((element) => element.addEventListener('click', sbHandleAction));
    sbBindInputs(root);
    if (root.classList.contains('sb-workspace')) sbBindTimeline(root);
    if (sbReadOnly()) {
      root.querySelectorAll('.sb-inspector input, .sb-inspector textarea, .sb-inspector select, .sb-bin input, .sb-bin select, .sb-bin textarea, [data-sb-duration], .sb-track-name, .sb-framing input, .sb-framing textarea').forEach((element) => { element.disabled = true; });
    }
  }
  if (appState.route === 'storyline' && ui.needsFit) {
    ui.needsFit = false;
    if (sbFitZoom()) { App.render(); return; }
  }
  sbRestoreFocus();
}
