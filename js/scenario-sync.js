/* Scenario Builder ↔ exercise content: links between storyboard beats and
   stimuli/actors, the guided generation pipeline and change propagation. */
const SB_MEDIA_FIELD = /(^|_)(photo|logo_image|avatar_url|audio|video)|_data$/;

/* Render-scoped memo: rendering asks for the same link statuses many times. */
let sbRenderMemo = null;
function sbWithRenderMemo(task) {
  sbRenderMemo = { hashes: new Map(), beats: null };
  try { return task(); } finally { sbRenderMemo = null; }
}

// ── Hashes used to detect manual edits and outdated content ──────────────────
function sbStimulusContentHash(stimulus) {
  if (sbRenderMemo?.hashes.has(stimulus)) return sbRenderMemo.hashes.get(stimulus);
  const hash = sbComputeStimulusContentHash(stimulus);
  sbRenderMemo?.hashes.set(stimulus, hash);
  return hash;
}
/* Hashes are reused while the values they cover are the same (compared with ===), so
   renders and the Update count do not re-hash long texts. The hash itself is unchanged. */
const SB_HASH_CACHE = new WeakMap();
function sbCachedHash(owner, slot, parts, compute) {
  if (!owner || typeof owner !== 'object') return compute();
  let entry = SB_HASH_CACHE.get(owner);
  if (!entry) { entry = {}; SB_HASH_CACHE.set(owner, entry); }
  const cached = entry[slot];
  if (cached && cached.parts.length === parts.length && cached.parts.every((value, index) => value === parts[index])) return cached.hash;
  const hash = compute();
  entry[slot] = { parts, hash };
  return hash;
}
function sbComputeStimulusContentHash(stimulus) {
  const entries = Object.entries(stimulus.fields || {}).filter(([key]) => !SB_MEDIA_FIELD.test(key));
  const compute = () => sbHash({ fields: Object.fromEntries(entries), name: stimulus.name || '', actor_id: stimulus.actor_id, channel: stimulus.channel, template_id: stimulus.template_id });
  // Nested values (lists) can change in place: only flat fields are cached.
  if (entries.some(([, value]) => value !== null && typeof value === 'object')) return compute();
  return sbCachedHash(stimulus, 'content', [stimulus.name, stimulus.actor_id, stimulus.channel, stimulus.template_id, ...entries.flat()], compute);
}
function sbBeatSourceHash(block, beat) {
  const compute = () => sbHash({ block: [block.title, block.brief, block.narrative, block.objectives], beat: beat ? [beat.title, beat.intent, beat.channel, beat.template_id, beat.cast_id, beat.cell_id] : null });
  const parts = [block.title, block.brief, block.narrative, ...(block.objectives || []), (block.objectives || []).length];
  if (beat) parts.push(beat.title, beat.intent, beat.channel, beat.template_id, beat.cast_id, beat.cell_id);
  return sbCachedHash(beat || block, beat ? 'source' : 'block-source', beat ? [block, ...parts] : parts, compute);
}
/* What a phase says, as far as its inject plan is concerned: its title and what happens. */
function sbPlanSourceHash(block) {
  return sbHash({ title: block.title, brief: block.brief });
}
function sbMarkPlanned(block) {
  if (block) block.plan_hash = sbPlanSourceHash(block);
}
/* A phase whose "what happens" changed since its injects were planned. */
function sbNeedsReplan(block) {
  return !!(block && block.beats.length && block.plan_hash && block.plan_hash !== sbPlanSourceHash(block));
}
function sbCellContentHash(cell) {
  return sbHash({ name: cell.name, description: cell.description, objectives: cell.objectives || '' });
}
function sbActorContentHash(actor) {
  return sbHash({ name: actor.name, role: actor.role, organization: actor.organization, title: actor.title, language: actor.language });
}
function sbCastSourceHash(cast) {
  return sbHash({ label: cast.label, role: cast.role, organization: cast.organization, description: cast.description });
}

function sbStimulusLink(stimulus) {
  return stimulus?.scenario_link && typeof stimulus.scenario_link === 'object' ? stimulus.scenario_link : null;
}
function sbStimuliForBlock(project, blockId) {
  return project.stimuli.filter((stimulus) => sbStimulusLink(stimulus)?.block_id === blockId)
    .sort((a, b) => a.timestamp_offset_minutes - b.timestamp_offset_minutes);
}
function sbStimulusForBeat(project, beatId) {
  if (sbRenderMemo) {
    if (!sbRenderMemo.beats) {
      sbRenderMemo.beats = new Map();
      for (const stimulus of project.stimuli) { const id = sbStimulusLink(stimulus)?.beat_id; if (id && !sbRenderMemo.beats.has(id)) sbRenderMemo.beats.set(id, stimulus); }
    }
    return sbRenderMemo.beats.get(beatId) || null;
  }
  return project.stimuli.find((stimulus) => sbStimulusLink(stimulus)?.beat_id === beatId) || null;
}
function sbIsManuallyEdited(stimulus) {
  const link = sbStimulusLink(stimulus);
  return !!(link?.content_hash && sbStimulusContentHash(stimulus) !== link.content_hash);
}

/* Records that a stimulus now reflects the current block/beat. */
function sbStampStimulus(stimulus, block, beat, storyboard, project = appState.scenario) {
  const previous = sbStimulusLink(stimulus);
  if (beat?.cell_id) stimulus.cell_id = beat.cell_id;
  const actor = (project?.actors || []).find((item) => item.id === stimulus.actor_id);
  const cell = (project?.cells || []).find((item) => item.id === stimulus.cell_id);
  stimulus.scenario_link = sbNormalizeLink({
    block_id: block.id,
    beat_id: beat?.id || '',
    offset: beat ? beat.offset_minutes : Math.max(0, stimulus.timestamp_offset_minutes - block.start_minutes),
    // The planned time the inject was stamped at; kept on re-stamping so a time moved by hand
    // stays recognised (and is not proposed for retiming at the next Update).
    at: previous && previous.block_id === block.id && previous.beat_id === (beat?.id || '') && previous.at !== null ? previous.at : stimulus.timestamp_offset_minutes,
    source_hash: sbBeatSourceHash(block, beat),
    content_hash: sbStimulusContentHash(stimulus),
    actor_hash: actor ? sbActorContentHash(actor) : '',
    cell_hash: cell ? sbCellContentHash(cell) : '',
    rev: storyboard.rev,
    locked: previous?.locked === true
  });
  return stimulus.scenario_link;
}

/* Establishes baseline hashes for links created without them (example, auto-link). */
function sbSealLinks(project) {
  const storyboard = project.storyboard;
  if (!storyboard) return;
  for (const stimulus of project.stimuli) {
    const link = sbStimulusLink(stimulus);
    if (!link) continue;
    if (!link.source_hash) {
      const block = sbBlock(storyboard, link.block_id);
      if (!block) continue;
      const beat = link.beat_id ? block.beats.find((item) => item.id === link.beat_id) : null;
      sbStampStimulus(stimulus, block, beat, storyboard, project);
      continue;
    }
    // Older links: record the current sender and cell as the baseline.
    if (!link.actor_hash) { const actor = (project.actors || []).find((item) => item.id === stimulus.actor_id); if (actor) link.actor_hash = sbActorContentHash(actor); }
    if (!link.cell_hash) { const cell = (project.cells || []).find((item) => item.id === stimulus.cell_id); if (cell) link.cell_hash = sbCellContentHash(cell); }
  }
  for (const block of storyboard.blocks) if (block.beats.length && !block.plan_hash) sbMarkPlanned(block);
  for (const cast of storyboard.cast) {
    const actor = cast.actor_id ? project.actors.find((item) => item.id === cast.actor_id) : null;
    if (actor && !actor.scenario_link) actor.scenario_link = { cast_id: cast.id, source_hash: sbCastSourceHash(cast), content_hash: sbActorContentHash(actor), title: actor.title || '', locked: false };
  }
}

/* Links unlinked stimuli to the main-storyline block covering their time. */
function sbAutoLinkByTime(project) {
  const storyboard = project.storyboard;
  let linked = 0;
  for (const stimulus of project.stimuli) {
    if (sbStimulusLink(stimulus)) continue;
    const block = sbMainBlocks(storyboard).find((item) => stimulus.timestamp_offset_minutes >= item.start_minutes && stimulus.timestamp_offset_minutes < sbBlockEnd(item));
    if (!block) continue;
    sbStampStimulus(stimulus, block, null, storyboard);
    linked++;
  }
  return linked;
}

function sbLockStimulus(stimulus, locked) {
  const link = sbStimulusLink(stimulus);
  if (link) link.locked = !!locked;
}

/* Short status used by badges in the builder and the Injects tab. */
function sbStimulusStatus(project, stimulus) {
  const link = sbStimulusLink(stimulus);
  if (!link) return null;
  const storyboard = project.storyboard;
  const block = storyboard && sbBlock(storyboard, link.block_id);
  const beat = block && link.beat_id ? block.beats.find((item) => item.id === link.beat_id) : null;
  const manual = sbIsManuallyEdited(stimulus);
  if (!block || (link.beat_id && !beat)) return { key: 'orphan', label: 'Orphan', manual, locked: link.locked, block };
  const outdated = link.source_hash && sbBeatSourceHash(block, beat) !== link.source_hash;
  const expected = sbExpectedOffset(block, beat, link);
  const mistimed = stimulus.timestamp_offset_minutes !== expected;
  if (link.locked) return { key: 'locked', label: 'Locked', manual, locked: true, block, beat, outdated, mistimed };
  if (outdated) return { key: 'outdated', label: 'Outdated', manual, locked: false, block, beat };
  if (mistimed) return { key: 'retime', label: 'Time changed', manual, locked: false, block, beat };
  return { key: manual ? 'manual' : 'synced', label: manual ? 'Manual edit' : 'In sync', manual, locked: false, block, beat };
}

function sbExpectedOffset(block, beat, link) {
  const relative = beat ? beat.offset_minutes : (link?.offset || 0);
  return block.start_minutes + Math.min(relative, Math.max(0, block.duration_minutes - 1));
}

// ── Impact analysis ──────────────────────────────────────────────────────────
function sbComputeImpacts(project = appState.scenario) {
  const storyboard = project.storyboard;
  const impacts = [];
  const add = (impact) => impacts.push({ id: `impact_${impacts.length + 1}`, ...impact });
  const ai = isLLMAvailable();
  // 1. Phases whose "what happens" changed: their inject plan follows the old text.
  for (const block of storyboard.blocks) {
    if (block.locked || !sbNeedsReplan(block)) continue;
    const written = block.beats.filter((beat) => sbStimulusForBeat(project, beat.id)).length;
    add({ kind: 'replan', target: 'block', block_id: block.id, label: block.title, detail: `What happens changed since its ${block.beats.length} inject(s) were planned${written ? ` (${written} written)` : ''}. The AI updates the plan, then the injects follow.`, options: ai ? ['replan', 'accept', 'skip'] : ['accept', 'skip'], action: ai ? 'replan' : 'skip' });
  }
  const replanning = new Set(impacts.map((impact) => impact.block_id));
  for (const stimulus of project.stimuli) {
    const link = sbStimulusLink(stimulus);
    if (!link) continue;
    const label = sbStimulusLabel(stimulus);
    const block = sbBlock(storyboard, link.block_id);
    const beat = block && link.beat_id ? block.beats.find((item) => item.id === link.beat_id) : null;
    const manual = sbIsManuallyEdited(stimulus);
    if (!block || (link.beat_id && !beat)) {
      add({ kind: 'orphan', target: 'stimulus', stimulus_id: stimulus.id, label, detail: block ? 'Its planned inject was removed from the block.' : 'Its block was removed from the storyboard.', manual, locked: link.locked, options: ['unlink', 'delete', 'skip'], action: 'unlink' });
      continue;
    }
    if (link.locked) continue;
    const expected = sbExpectedOffset(block, beat, link);
    if (stimulus.timestamp_offset_minutes !== expected) {
      const movedByHand = link.at !== null && link.at !== stimulus.timestamp_offset_minutes;
      add({ kind: 'retime', target: 'stimulus', stimulus_id: stimulus.id, block_id: block.id, beat_id: beat?.id || '', label, detail: `${sbFormatOffset(stimulus.timestamp_offset_minutes)} → ${sbFormatOffset(expected)}${movedByHand ? ' (moved by hand in the timeline)' : ''}`, from: stimulus.timestamp_offset_minutes, to: expected, manual: movedByHand, options: ['apply', 'skip'], action: movedByHand ? 'skip' : 'apply' });
    }
    // Injects of a phase being re-planned are handled after the new plan.
    if (replanning.has(block.id)) continue;
    const reasons = [];
    if (link.source_hash && sbBeatSourceHash(block, beat) !== link.source_hash) reasons.push('the storyline changed');
    const actor = project.actors.find((item) => item.id === stimulus.actor_id);
    if (link.actor_hash && actor && sbActorContentHash(actor) !== link.actor_hash) reasons.push(`its sender changed (${actor.name})`);
    const cell = (project.cells || []).find((item) => item.id === stimulus.cell_id);
    if (link.cell_hash && cell && sbCellContentHash(cell) !== link.cell_hash) reasons.push(`its recipient cell changed (${cell.name})`);
    if (reasons.length) {
      const storyline = reasons[0] === 'the storyline changed';
      add({ kind: storyline ? 'outdated' : 'people', target: 'stimulus', stimulus_id: stimulus.id, block_id: block.id, beat_id: beat?.id || '', label, detail: `Since it was written, ${reasons.join(', ')}.${manual ? ' Its content was edited by hand.' : ''}`, manual, options: manual || !storyline ? ['adapt', 'regenerate', 'accept', 'skip'] : ['regenerate', 'adapt', 'accept', 'skip'], action: manual || !storyline ? 'adapt' : 'regenerate' });
    }
  }
  // New planned injects are proposed only in blocks that were already generated;
  // blocks never generated are handled by "Generate injects".
  const generatedBlocks = new Set(project.stimuli.map((stimulus) => sbStimulusLink(stimulus)?.block_id).filter(Boolean));
  for (const block of storyboard.blocks) {
    if (!generatedBlocks.has(block.id) || replanning.has(block.id)) continue;
    for (const beat of block.beats) {
      if (sbStimulusForBeat(project, beat.id)) continue;
      add({ kind: 'missing', target: 'beat', block_id: block.id, beat_id: beat.id, label: beat.title || channelLabel(beat.channel), detail: `${block.title} · ${sbFormatOffset(sbBeatAbsolute(block, beat))}`, options: ['create', 'skip'], action: 'create' });
    }
  }
  for (const cast of storyboard.cast) {
    const actor = cast.actor_id ? project.actors.find((item) => item.id === cast.actor_id) : null;
    const used = storyboard.blocks.some((block) => generatedBlocks.has(block.id) && block.beats.some((beat) => beat.cast_id === cast.id));
    if (!actor) {
      if (used) add({ kind: 'actor_missing', target: 'cast', cast_id: cast.id, label: cast.label, detail: 'No actor plays this role yet.', options: ['create', 'skip'], action: 'create' });
      continue;
    }
    const link = actor.scenario_link;
    if (link?.cast_id === cast.id && !link.locked && link.source_hash && link.source_hash !== sbCastSourceHash(cast)) {
      const manual = link.content_hash && link.content_hash !== sbActorContentHash(actor);
      add({ kind: 'actor_outdated', target: 'actor', cast_id: cast.id, actor_id: actor.id, label: `${actor.name} (${cast.label})`, detail: manual ? 'Role changed; actor was edited by hand.' : 'Role description changed.', manual, options: ['update', 'accept', 'skip'], action: manual ? 'accept' : 'update' });
    }
  }
  return impacts;
}

function sbStimulusLabel(stimulus) {
  const fields = stimulus.fields || {};
  return sbText(stimulus.name || fields.subject || fields.headline || fields.title || fields.thread_title || fields.text || channelLabel(stimulus.channel), 140);
}

function sbPendingSyncCount(project = appState.scenario) {
  // Once per render pass (the button appears on several tabs and in the phase editor).
  if (sbRenderMemo) {
    sbRenderMemo.pending = sbRenderMemo.pending || new Map();
    if (!sbRenderMemo.pending.has(project)) sbRenderMemo.pending.set(project, sbComputePendingSyncCount(project));
    return sbRenderMemo.pending.get(project);
  }
  return sbComputePendingSyncCount(project);
}
function sbComputePendingSyncCount(project) {
  // A changed phase always counts, even without AI to re-plan it.
  return sbComputeImpacts(project).filter((impact) => impact.kind !== 'missing' && (impact.action !== 'skip' || impact.kind === 'replan')).length;
}

// ── Content generation with storyboard context ───────────────────────────────
function sbLanguageName(project = appState.scenario) {
  const code = project.settings.inject_language || project.settings.language || 'en';
  return (typeof LANGUAGES !== 'undefined' && LANGUAGES.find((item) => item.value === code)?.label) || code;
}

function sbPrimaryFieldKey(stimulus) {
  const keys = Object.keys(getTemplateDefinition(stimulus)?.defaults || stimulus.fields || {});
  return ['subject', 'headline', 'thread_title', 'title', 'text'].find((key) => keys.includes(key)) || null;
}

function sbGenerationBrief(project, block, beat, options = {}) {
  const storyboard = project.storyboard;
  const actor = getActor(options.actorId);
  const neighbours = block.beats.filter((item) => item.id !== beat?.id).map((item) => `${sbFormatOffset(sbBeatAbsolute(block, item))} ${channelLabel(item.channel)}: ${item.title}`).slice(0, 8);
  const previousBlock = sbMainBlocks(storyboard).filter((item) => sbBlockEnd(item) <= block.start_minutes).pop();
  const lines = [
    'Exercise storyboard context (use it to write realistic content; never mention that this is an exercise or a storyboard):',
    `- Organisation: ${project.client.name || 'the organisation'}${project.client.sector ? ` (${project.client.sector})` : ''}.`,
    storyboard.meta.synopsis ? `- Scenario synopsis: ${sbText(storyboard.meta.synopsis, 1600)}` : '',
    storyboard.meta.threat ? `- Threat: ${sbText(storyboard.meta.threat, 500)}` : '',
    previousBlock ? `- Previously: "${previousBlock.title}" - ${sbText(previousBlock.brief || previousBlock.narrative, 400)}` : '',
    `- Current phase "${block.title}" (${sbFormatOffset(block.start_minutes)} to ${sbFormatOffset(sbBlockEnd(block))}): ${sbText(block.brief, 800)}`,
    block.narrative ? `- What is happening: ${sbText(block.narrative, 1600)}` : '',
    block.objectives.length ? `- Objectives tested: ${block.objectives.join('; ')}` : '',
    beat ? `- THIS INJECT (${channelLabel(beat.channel)} at ${sbFormatOffset(sbBeatAbsolute(block, beat))}): "${beat.title}". ${beat.intent}` : '',
    (() => { const cell = sbCell(project, beat?.cell_id || options.cellId); return cell ? `- Recipient: the ${cell.name}${cell.description ? ` (${cell.description})` : ''}. Address the inject to them.` : ''; })(),
    actor ? `- Sender: ${actor.name}, ${actor.title || ''} at ${actor.organization || ''}.` : '',
    neighbours.length ? `- Other injects in this phase (stay consistent, do not repeat them): ${neighbours.join(' | ')}` : '',
    `- Write in ${sbLanguageName(project)} unless the channel has its own language. Replace every example or placeholder value of the template (names, dates, organisations) with content consistent with this scenario.`
  ];
  if (options.preserve) {
    lines.push(`The current content was edited by hand by the exercise designer. Update it minimally so it matches the scenario above: keep the designer's wording, facts, names and style wherever they remain valid, and change only what the scenario change requires. Current content: ${JSON.stringify(Object.fromEntries(Object.entries(options.preserve).filter(([key]) => !SB_MEDIA_FIELD.test(key))))}`);
  }
  return lines.filter(Boolean).join('\n');
}

/* Generates template fields for one stimulus; unknown keys are ignored. */
async function sbGenerateStimulusContent(stimulus, block, beat, options = {}) {
  const project = appState.scenario;
  const brief = sbGenerationBrief(project, block, beat, { actorId: stimulus.actor_id, preserve: options.preserve ? deepClone(stimulus.fields) : null });
  const generated = await agentAwait(
    AITextGenerator.generateForStimulus(stimulus, null, agentRedact(brief), { signal: options.signal, quiet: true, maxTokens: 3000, promptFilter: agentRedact }),
    options.signal, 150000
  );
  if (options.assertActive) options.assertActive();
  if (!generated || typeof generated !== 'object' || Array.isArray(generated)) throw new AgentValidationError('The AI returned no usable content.');
  const allowed = new Set([...(getTemplateDefinition(stimulus).fields || []).map((field) => field.key), ...Object.keys(stimulus.fields || {})]);
  const scrub = (value) => typeof value === 'string' ? sanitizeBody(value) : Array.isArray(value) ? value.map(scrub) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item)])) : value;
  const clean = {};
  for (const [key, value] of Object.entries(generated)) {
    if (!allowed.has(key) || SB_MEDIA_FIELD.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    clean[key] = scrub(value);
  }
  if (!Object.keys(clean).length) throw new AgentValidationError('The AI returned no field of this template.');
  saveStimulus(stimulus, { ...stimulus.fields, ...clean }, options.preserve ? 'Storyline: adapted to scenario change' : 'Storyline: AI generation');
  Object.assign(stimulus.generated_text, clean);
  stimulus.status = 'ready';
  stimulus.updated_at = new Date().toISOString();
  return clean;
}

// ── Actors for cast roles ────────────────────────────────────────────────────
function sbFindActorForCast(project, cast) {
  if (cast.actor_id) {
    const actor = project.actors.find((item) => item.id === cast.actor_id);
    if (actor) return actor;
  }
  const label = cast.label.trim().toLowerCase();
  return project.actors.find((actor) => [actor.name, actor.title].some((value) => String(value || '').trim().toLowerCase() === label)) || null;
}

function sbCreateActorForCast(project, cast, details = {}) {
  const registry = createAgentToolRegistry();
  const organization = cast.organization && !/^the organi[sz]ation$/i.test(cast.organization) ? cast.organization : (project.client.name || cast.organization || '');
  const args = {
    name: sbText(details.name || cast.label, 300),
    role: sbRoleValue(details.role || cast.role),
    organization: sbText(details.organization || organization, 300),
    title: sbText(details.title || cast.label, 300)
  };
  const language = details.language || project.settings.inject_language;
  if ((typeof LANGUAGES !== 'undefined' ? LANGUAGES : []).some((item) => item.value === language)) args.language = language;
  ToolValidator.validate(args, registry.get('createActor').inputSchema);
  const created = registry.get('createActor').execute(args);
  const actor = project.actors.find((item) => item.id === created.id);
  cast.actor_id = actor.id;
  actor.scenario_link = { cast_id: cast.id, source_hash: sbCastSourceHash(cast), content_hash: sbActorContentHash(actor), title: actor.title || '', locked: false };
  return actor;
}

// ── Pipeline: plan → cast → create → write ───────────────────────────────────
const SbPipeline = {
  status: 'idle',
  label: '',
  step: 0,
  total: 0,
  log: [],
  controller: null,
  checkpoint: null,

  get active() { return this.status === 'running'; },

  note(kind, message) {
    this.log.push({ kind, message, at: Date.now() });
    if (this.log.length > 200) this.log.shift();
    sbNotify();
  },

  saveCheckpoint(label) {
    this.checkpoint = { projectId: appState.scenario.id, label, snapshot: agentSnapshot(), videoFiles: { ...appState.videoFiles }, audioFiles: { ...appState.audioFiles }, at: new Date().toISOString() };
  },

  undo() {
    if (this.active || !this.checkpoint || this.checkpoint.projectId !== appState.scenario.id) return false;
    agentRestore(this.checkpoint.snapshot);
    appState.videoFiles = this.checkpoint.videoFiles;
    appState.audioFiles = this.checkpoint.audioFiles;
    const label = this.checkpoint.label;
    this.checkpoint = null;
    StoryboardHistory.ensure(appState.scenario, `Undo ${label}`);
    sbAfterStoryboardChange(appState.scenario, { save: true });
    this.note('success', `Restored the exercise from before: ${label}.`);
    return true;
  },

  stop() {
    if (!this.active) return;
    this.controller?.abort();
    this.status = 'stopped';
    this.note('warning', 'Stopped. Completed items remain; use Undo to restore the checkpoint.');
  },

  /* scope: array of block ids, or null for the whole storyboard. */
  async run({ blockIds = null, beatIds = null, cellIds = null, plan = true, cast = true, write = true, keepCheckpoint = false } = {}) {
    if (this.active || SbAI.busy) throw new AgentValidationError('Another storyline operation is running.');
    if (getCrisisAgent().active || getCrisisAgent().busy) throw new AgentValidationError('Wait for the agent run to finish.');
    const project = appState.scenario;
    StoryboardHistory.ensure(project);
    StoryboardHistory.flush();
    const storyboard = project.storyboard;
    const blocks = (blockIds ? blockIds.map((id) => sbBlock(storyboard, id)).filter(Boolean) : sbSortedBlocks(storyboard)).filter((block) => block.stimuli_target > 0 || block.beats.length);
    if (!blocks.length) throw new AgentValidationError('Nothing to generate: set a number of injects on at least one block.');
    const aiAvailable = isLLMAvailable();
    this.controller = new AbortController();
    const controller = this.controller;
    const assertActive = () => { if (controller.signal.aborted || appState.scenario !== project) throw new DOMException('Stopped', 'AbortError'); };
    this.status = 'running';
    this.log = [];
    this.step = 0;
    if (!keepCheckpoint || !this.checkpoint) this.saveCheckpoint(blockIds && blockIds.length === 1 ? `generation for "${blocks[0].title}"` : 'storyboard generation');
    StoryboardHistory.snapshot('Before generation', 'generation');
    let created = 0;
    let written = 0;
    try {
      // 1. Plan missing beats with AI (inject plan = level 3).
      const needPlan = beatIds || cellIds ? [] : blocks.filter((block) => !block.locked && block.beats.length < block.stimuli_target);
      if (plan && needPlan.length) {
        if (!aiAvailable) this.note('warning', `${needPlan.length} block(s) have no complete inject plan and AI is not configured: only planned injects will be created.`);
        else {
          this.label = 'Planning injects';
          this.note('info', `Planning injects for ${needPlan.length} block(s)…`);
          await SbAI.deepen(needPlan.map((block) => block.id), 3, { signal: controller.signal, nested: true });
          assertActive();
          this.note('success', 'Inject plan ready.');
        }
      }
      const beats = blocks.flatMap((block) => block.beats.map((beat) => ({ block, beat })))
        .filter(({ beat }) => !sbStimulusForBeat(project, beat.id) && (!beatIds || beatIds.includes(beat.id)) && (!cellIds || cellIds.includes(beat.cell_id)));
      this.total = beats.length;
      if (!beats.length) this.note('info', 'Every planned inject already has a stimulus. Use Sync to update existing ones.');
      // 2. Actors for the roles used by these beats.
      if (cast) {
        const castIds = [...new Set(beats.map(({ beat }) => beat.cast_id).filter(Boolean))];
        const missing = castIds.map((id) => storyboard.cast.find((item) => item.id === id)).filter((item) => item && !sbFindActorForCast(project, item));
        if (missing.length) {
          this.label = 'Casting actors';
          let details = {};
          if (aiAvailable) {
            try { details = await SbAI.nameCast(missing.map((item) => item.id), { signal: controller.signal }); }
            catch (error) { if (error?.name === 'AbortError') throw error; this.note('warning', 'AI casting failed; roles are used as actor names.'); }
            assertActive();
          }
          for (const item of missing) {
            const actor = sbCreateActorForCast(project, item, details[item.id] || {});
            this.note('success', `Actor created: ${actor.name} (${item.label}).`);
          }
        }
        for (const id of castIds) {
          const item = storyboard.cast.find((entry) => entry.id === id);
          const actor = item && sbFindActorForCast(project, item);
          if (item && actor && item.actor_id !== actor.id) item.actor_id = actor.id;
        }
      }
      // 3. Create stimuli through the agent tool (same validation as the Agent tab).
      const registry = createAgentToolRegistry();
      const createTool = registry.get('createStimulus');
      const fallbackActor = () => project.actors[0] || sbCreateActorForCast(project, storyboard.cast[0] || sbMakeCast({ label: 'Crisis cell' }));
      const toWrite = [];
      for (const { block, beat } of beats) {
        assertActive();
        this.label = `Creating ${beat.title || channelLabel(beat.channel)}`;
        const castEntry = storyboard.cast.find((item) => item.id === beat.cast_id);
        const actor = (castEntry && sbFindActorForCast(project, castEntry)) || fallbackActor();
        const probe = makeStimulus(beat.channel, actor.id, 0, beat.template_id || null);
        const primary = sbPrimaryFieldKey(probe);
        const args = {
          name: sbText(beat.title || `${block.title} · ${channelLabel(beat.channel)}`, 500),
          actor_id: actor.id,
          timestamp_offset_minutes: sbBeatAbsolute(block, beat),
          channel: beat.channel,
          generation_prompt: sbText(beat.intent, 8000),
          status: 'draft'
        };
        if (beat.template_id) args.template_id = beat.template_id;
        if (primary && beat.title) args.fields = { [primary]: beat.title };
        ToolValidator.validate(args, createTool.inputSchema);
        const result = createTool.execute(args);
        const stimulus = getStimulus(result.id);
        stimulus.generation_mode = 'ai_guided';
        sbStampStimulus(stimulus, block, beat, storyboard);
        created++;
        toWrite.push({ stimulus, block, beat });
        this.note('success', `Inject created: ${args.name} (${sbFormatOffset(args.timestamp_offset_minutes)}).`);
      }
      saveLocal(false);
      // 4. Write content with AI.
      if (write && toWrite.length) {
        if (!aiAvailable) this.note('warning', 'AI is not configured: injects were created as drafts without content.');
        else {
          for (const [index, item] of toWrite.entries()) {
            assertActive();
            this.step = index + 1;
            this.label = `Writing ${index + 1}/${toWrite.length}: ${sbStimulusLabel(item.stimulus)}`;
            sbNotify();
            try {
              await sbGenerateStimulusContent(item.stimulus, item.block, item.beat, { signal: controller.signal, assertActive });
              sbStampStimulus(item.stimulus, item.block, item.beat, storyboard);
              written++;
              saveLocal(false);
            } catch (error) {
              if (error?.name === 'AbortError' || controller.signal.aborted) throw error;
              this.note('warning', `Content not written for "${sbStimulusLabel(item.stimulus)}": ${sbErrorMessage(error)}`);
            }
          }
        }
      }
      this.status = 'complete';
      this.note('success', `Done: ${created} inject(s) created, ${written} written with AI.`);
    } catch (error) {
      if (controller.signal.aborted || appState.scenario !== project || error?.name === 'AbortError') this.status = 'stopped';
      else { this.status = 'failed'; this.note('error', sbErrorMessage(error)); }
    } finally {
      this.label = '';
      if (appState.scenario === project) {
        StoryboardHistory.commit('Generate injects');
        sbAfterStoryboardChange(project, { save: true });
      }
      sbNotify();
    }
    return { created, written };
  },

  /* Applies the selected update actions (impact.action) with one checkpoint, in cascade:
     changed phases are re-planned first, then the consequences of the new plans (timing,
     content, orphans, new injects) are computed again and applied with the other changes. */
  async applyImpacts(impacts) {
    if (this.active || SbAI.busy) throw new AgentValidationError('Another storyline operation is running.');
    if (getCrisisAgent().active || getCrisisAgent().busy) throw new AgentValidationError('Wait for the agent run to finish.');
    const project = appState.scenario;
    const storyboard = project.storyboard;
    const selected = impacts.filter((impact) => impact.action && impact.action !== 'skip');
    if (!selected.length) return { applied: 0 };
    this.controller = new AbortController();
    const controller = this.controller;
    const assertActive = () => { if (controller.signal.aborted || appState.scenario !== project) throw new DOMException('Stopped', 'AbortError'); };
    this.status = 'running';
    this.log = [];
    this.step = 0;
    this.total = selected.length;
    this.saveCheckpoint('update');
    let applied = 0;
    const missingBlocks = new Set();
    const missingBeats = new Set();
    let queue = selected.filter((impact) => impact.kind !== 'replan');
    try {
      // 1. Re-plan the phases whose "what happens" changed.
      const replans = selected.filter((impact) => impact.kind === 'replan');
      if (replans.length) {
        StoryboardHistory.flush();
        StoryboardHistory.snapshot('Before update', 'generation');
        const replanned = new Set();
        try {
          for (const impact of replans) {
            assertActive();
            this.step++;
            const block = sbBlock(storyboard, impact.block_id);
            if (!block) continue;
            this.label = `Re-planning ${block.title}`;
            sbNotify();
            if (impact.action === 'accept') { sbMarkPlanned(block); applied++; continue; }
            try {
              const keep = { title: block.title, brief: block.brief, start_minutes: block.start_minutes, duration_minutes: block.duration_minutes };
              await SbAI.rewrite(block.id, SB_REPLAN_INSTRUCTION, { nested: true, signal: controller.signal });
              assertActive();
              // The designer's text and timing stay exactly as written.
              Object.assign(block, keep);
              block.beats.forEach((beat) => { beat.offset_minutes = Math.min(beat.offset_minutes, Math.max(0, block.duration_minutes - 1)); });
              sbMarkPlanned(block);
              replanned.add(block.id);
              applied++;
              this.note('success', `Inject plan updated: ${block.title} (${block.beats.length} inject(s)).`);
            } catch (error) {
              if (error?.name === 'AbortError' || controller.signal.aborted) throw error;
              this.note('warning', `${block.title}: ${sbErrorMessage(error)}`);
            }
          }
        } finally {
          // Committed even when stopped halfway, so Undo stays consistent.
          StoryboardHistory.commit('Update: re-plan phases');
          sbAfterStoryboardChange(project, { save: true });
        }
        // 2. The consequences of the new plans, keeping the choices made in the dialog.
        const key = (impact) => [impact.kind, impact.stimulus_id, impact.beat_id, impact.cast_id, impact.block_id].join(':');
        const chosen = new Map(impacts.filter((impact) => impact.kind !== 'replan').map((impact) => [key(impact), impact.action]));
        queue = sbComputeImpacts(project).filter((impact) => impact.kind !== 'replan').map((impact) => {
          if (chosen.has(key(impact))) return { ...impact, action: chosen.get(key(impact)) };
          const stimulus = impact.stimulus_id ? getStimulus(impact.stimulus_id) : null;
          // Injects of a dropped planned item: removed, unless edited by hand.
          if (impact.kind === 'orphan' && stimulus && replanned.has(sbStimulusLink(stimulus)?.block_id) && !impact.manual && !impact.locked) return { ...impact, action: 'delete' };
          return impact;
        }).filter((impact) => impact.action && impact.action !== 'skip');
        this.total = this.step + queue.length;
        if (queue.length) this.note('info', `Then ${queue.length} consequence(s): timing, content and injects of the new plans.`);
      }
      // 3. Timing, content, orphans, actors and new injects.
      const updatedActors = new Set();
      const applyOne = async (impact) => {
        assertActive();
        this.step++;
        this.label = `${impact.kind}: ${impact.label}`;
        const aiBound = ['regenerate', 'adapt'].includes(impact.action);
        // Re-render (progress) for AI steps and every 10th quick one, not after each change.
        if (aiBound || this.step % 10 === 0) sbNotify();
        const stimulus = impact.stimulus_id ? getStimulus(impact.stimulus_id) : null;
        const block = impact.block_id ? sbBlock(storyboard, impact.block_id) : null;
        const beat = block && impact.beat_id ? block.beats.find((item) => item.id === impact.beat_id) : null;
        try {
          if (impact.kind === 'orphan' && stimulus) {
            if (impact.action === 'delete') project.stimuli = project.stimuli.filter((item) => item.id !== stimulus.id);
            else delete stimulus.scenario_link;
          } else if (impact.kind === 'retime' && stimulus && block) {
            stimulus.timestamp_offset_minutes = impact.to;
            stimulus.scenario_link.at = impact.to;
            stimulus.updated_at = new Date().toISOString();
          } else if (['outdated', 'people'].includes(impact.kind) && stimulus && block) {
            if (impact.action === 'accept') sbStampStimulus(stimulus, block, beat, storyboard, project);
            else {
              if (!isLLMAvailable()) throw new AgentValidationError('AI is not configured.');
              await sbGenerateStimulusContent(stimulus, block, beat, { signal: controller.signal, assertActive, preserve: impact.action === 'adapt' });
              sbStampStimulus(stimulus, block, beat, storyboard, project);
            }
          } else if (impact.kind === 'missing' && block) {
            missingBlocks.add(block.id);
            if (impact.beat_id) missingBeats.add(impact.beat_id);
            return;
          } else if (impact.kind === 'actor_missing') {
            const cast = storyboard.cast.find((item) => item.id === impact.cast_id);
            if (cast) sbCreateActorForCast(project, cast);
          } else if (impact.kind === 'actor_outdated') {
            const cast = storyboard.cast.find((item) => item.id === impact.cast_id);
            const actor = getActor(impact.actor_id);
            if (cast && actor) {
              if (impact.action === 'update') {
                actor.role = cast.role;
                if (cast.organization && !/^the organi[sz]ation$/i.test(cast.organization)) actor.organization = cast.organization;
                if (!actor.title || actor.title === actor.scenario_link?.title) actor.title = cast.label;
                updatedActors.add(actor.id);
              }
              actor.scenario_link = { cast_id: cast.id, source_hash: sbCastSourceHash(cast), content_hash: sbActorContentHash(actor), title: actor.title || '', locked: false };
            }
          }
          applied++;
        } catch (error) {
          if (error?.name === 'AbortError' || controller.signal.aborted) throw error;
          this.note('warning', `${impact.label}: ${sbErrorMessage(error)}`);
        }
        // Saved after each AI rewrite (costly to lose); quick changes are saved at the end.
        if (aiBound) saveLocal(false);
      };
      for (const impact of queue) await applyOne(impact);
      // 4. Actors updated from their role: their injects follow in the same run.
      if (updatedActors.size) {
        const done = new Set(queue.filter((impact) => impact.stimulus_id).map((impact) => impact.stimulus_id));
        const follow = sbComputeImpacts(project).filter((impact) => impact.kind === 'people' && !done.has(impact.stimulus_id) && updatedActors.has(getStimulus(impact.stimulus_id)?.actor_id) && impact.action !== 'skip');
        this.total += follow.length;
        for (const impact of follow) await applyOne(impact);
      }
      sortStimuli();
      this.status = 'idle';
      this.note('success', `Update applied: ${applied} change(s).`);
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') this.status = 'stopped';
      else { this.status = 'failed'; this.note('error', sbErrorMessage(error)); }
    } finally {
      this.label = '';
      if (this.status === 'running') this.status = 'idle';
      saveLocal(false);
      sbNotify();
    }
    if (missingBlocks.size && this.status === 'idle') {
      // Only the planned injects chosen in the dialog (not every unwritten one of the phase).
      await this.run({ blockIds: [...missingBlocks], beatIds: [...missingBeats], plan: false, cast: true, write: isLLMAvailable(), keepCheckpoint: true });
    }
    return { applied };
  }
};

const SB_REPLAN_INSTRUCTION = 'The designer rewrote what happens during this phase (its brief). Update the inject plan so that every inject reflects the new description: adjust titles, intents, channels, senders and timing where needed, drop injects that no longer fit and add ones the new events need. Keep the id of every inject that remains relevant, keep the recipient cells and about the same number of injects per cell. Do not change the phase title, brief or duration.';

// ── Whole-exercise view: every planned or written inject ─────────────────────
/* Planned injects (beats, with their stimulus when generated) plus stimuli that are
   not attached to a planned inject (manual, imported or orphan). Sorted by time. */
function sbExerciseItems(project = appState.scenario, options = {}) {
  // Once per render pass and option set; callers only read the list.
  if (sbRenderMemo) {
    const key = options.status === false ? 'items-nostatus' : 'items';
    sbRenderMemo[key] = sbRenderMemo[key] || new Map();
    if (!sbRenderMemo[key].has(project)) sbRenderMemo[key].set(project, sbBuildExerciseItems(project, options));
    return sbRenderMemo[key].get(project);
  }
  return sbBuildExerciseItems(project, options);
}
function sbBuildExerciseItems(project, { status: withStatus = true } = {}) {
  const storyboard = project.storyboard;
  const items = [];
  const beatIds = new Set();
  const attached = new Set();
  for (const block of storyboard?.blocks || []) {
    for (const beat of block.beats) {
      beatIds.add(beat.id);
      const stimulus = sbStimulusForBeat(project, beat.id);
      if (stimulus) attached.add(stimulus);
      const status = stimulus && withStatus ? sbStimulusStatus(project, stimulus) : null;
      items.push({
        key: `beat:${beat.id}`, kind: 'beat', block, beat, stimulus,
        time: stimulus ? stimulus.timestamp_offset_minutes : sbBeatAbsolute(block, beat),
        cell_id: beat.cell_id || '', channel: beat.channel,
        title: beat.title || (stimulus ? sbStimulusLabel(stimulus) : channelLabel(beat.channel)),
        intent: beat.intent,
        sender: sbCastLabel(storyboard, beat.cast_id) || (stimulus ? getActor(stimulus.actor_id)?.name || '' : ''),
        status: status?.key || 'planned'
      });
    }
  }
  for (const stimulus of project.stimuli || []) {
    // Skip only the inject attached to its planned item (a copy sharing the link still shows).
    if (attached.has(stimulus)) continue;
    const status = withStatus ? sbStimulusStatus(project, stimulus) : null;
    items.push({
      key: `stim:${stimulus.id}`, kind: 'stimulus', block: storyboard ? sbMainBlockAt(storyboard, stimulus.timestamp_offset_minutes) : null, beat: null, stimulus,
      time: stimulus.timestamp_offset_minutes, cell_id: stimulus.cell_id || '', channel: stimulus.channel,
      title: sbStimulusLabel(stimulus), intent: stimulus.generation_prompt || '',
      sender: getActor(stimulus.actor_id)?.name || '', status: status?.key || 'manual'
    });
  }
  return items.sort((a, b) => a.time - b.time);
}

/* Deterministic rhythm and consistency checks over the whole exercise. */
function sbExerciseChecks(project = appState.scenario) {
  const issues = [];
  const add = (severity, code, message, extra = {}) => issues.push({ severity, code, message, at: null, cell_id: '', item_key: '', suggestion: '', source: 'rules', ...extra });
  const items = sbExerciseItems(project);
  const duration = project.storyboard?.duration_minutes || Math.max(0, ...items.map((item) => item.time));
  const cells = project.cells || [];
  if (!items.length) { add('info', 'empty', 'No inject yet: plan injects in the Detailed storyline.'); return issues; }
  if (!cells.length) add('warning', 'no_cells', 'No player cell: create cells in Cells & actors.');
  for (const cell of cells) {
    const times = items.filter((item) => item.cell_id === cell.id).map((item) => item.time).sort((a, b) => a - b);
    if (!times.length) { add('warning', 'cell_idle', `The ${cell.name} receives no inject.`, { cell_id: cell.id }); continue; }
    const marks = [0, ...times, duration];
    // Dead time is judged against the cell's own rhythm: a quiet cell is not flagged for every half hour.
    const threshold = Math.max(45, Math.round(1.8 * duration / (times.length + 1)));
    for (let index = 1; index < marks.length; index++) {
      const gap = marks[index] - marks[index - 1];
      if (gap > threshold) add('warning', 'gap', `The ${cell.name} receives nothing between ${sbFormatOffset(marks[index - 1])} and ${sbFormatOffset(marks[index])} (${sbFormatDuration(gap)}).`, { at: marks[index - 1], cell_id: cell.id });
    }
    for (let index = 0; index < times.length; index++) {
      const burst = times.filter((time) => time >= times[index] && time < times[index] + 10).length;
      if (burst > 3) { add('warning', 'peak', `${burst} injects reach the ${cell.name} within 10 minutes from ${sbFormatOffset(times[index])}: risk of overload.`, { at: times[index], cell_id: cell.id }); break; }
    }
  }
  for (const block of project.storyboard ? sbMainBlocks(project.storyboard) : []) {
    if (!items.some((item) => item.time >= block.start_minutes && item.time < sbBlockEnd(block))) add('warning', 'phase_empty', `Phase "${block.title}" has no inject.`, { at: block.start_minutes });
  }
  for (const item of items) {
    if (!item.cell_id || !cells.some((cell) => cell.id === item.cell_id)) add('warning', 'no_cell', `"${item.title}" has no recipient cell.`, { at: item.time, item_key: item.key });
    if (!item.sender) add('info', 'no_sender', `"${item.title}" has no sender.`, { at: item.time, cell_id: item.cell_id, item_key: item.key });
    if (item.status === 'orphan') add('warning', 'orphan', `"${item.title}" no longer matches the storyline (orphan).`, { at: item.time, cell_id: item.cell_id, item_key: item.key });
    if (item.time > duration) add('error', 'after_end', `"${item.title}" is scheduled after the end of the exercise.`, { at: item.time, cell_id: item.cell_id, item_key: item.key });
  }
  return issues.slice(0, 80);
}

// ── Handoff to the Agent tab ─────────────────────────────────────────────────
function sbAgentBrief(project, block) {
  const storyboard = project.storyboard;
  const beats = block.beats.map((beat) => `- ${sbFormatOffset(sbBeatAbsolute(block, beat))} · ${channelLabel(beat.channel)} · from ${sbCastLabel(storyboard, beat.cast_id) || 'any relevant actor'}: ${beat.title}${beat.intent ? ` (${beat.intent})` : ''}`).join('\n');
  return sbText([
    `Main storyline phase: "${block.title}" (${SB_BLOCK_TYPES[block.type]?.label || 'Custom'}), from ${sbFormatOffset(block.start_minutes)} to ${sbFormatOffset(sbBlockEnd(block))} (minutes ${block.start_minutes}–${sbBlockEnd(block)}).`,
    block.brief ? `Brief: ${block.brief}` : '',
    block.narrative ? `Narrative: ${block.narrative}` : '',
    block.objectives.length ? `Objectives to test: ${block.objectives.join('; ')}` : '',
    `Target: ${block.stimuli_target} inject(s) in this window.`,
    beats ? `Planned injects:\n${beats}` : '',
    'Work ONLY on injects scheduled inside this time window. Create missing injects, improve weak ones and keep consistency with the rest of the exercise. Do not modify or delete injects outside this window.'
  ].filter(Boolean).join('\n'), 7900);
}

function sbSendToAgent(block) {
  const agent = getCrisisAgent();
  if (agent.active || agent.busy) throw new AgentValidationError('An agent run is already active.');
  agent.kind = 'designer';
  agent.mode = 'agent';
  agent.objective = sbAgentBrief(appState.scenario, block);
  appState.route = 'agent';
}

const SB_LIVE_ROUTES = ['project', 'scenario', 'storyline', 'cells', 'detailed', 'summary'];
function sbNotify() {
  if (typeof App !== 'undefined' && SB_LIVE_ROUTES.includes(appState.route)) App.render();
}
