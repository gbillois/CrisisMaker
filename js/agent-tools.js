/* Controlled operations only: no DOM or credentials are exposed to the model. */
class AgentValidationError extends Error {}
const AgentSchema = {
  text: (maxLength = 8000) => ({ type: 'string', maxLength }),
  id: { type: 'string', minLength: 1, maxLength: 120 },
  minutes: { type: 'integer', minimum: 0, maximum: 525600 },
  object: (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false }),
  array: (items, maxItems = 40) => ({ type: 'array', items, maxItems })
};
const ToolValidator = {
  validate(value, schema, path = 'arguments') {
    const fail = () => { throw new AgentValidationError(`Invalid ${path}`); };
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
      for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail();
      for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
        const child = schema.properties?.[key] || schema.additionalProperties;
        if (!child || child === false) fail();
        this.validate(item, child, `${path}.${key}`);
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value) || value.length > schema.maxItems) fail();
      value.forEach((item, i) => this.validate(item, schema.items, `${path}[${i}]`));
    } else if (schema.type === 'string') {
      if (typeof value !== 'string' || value.length > schema.maxLength || value.length < (schema.minLength || 0)) fail();
    } else if (schema.type === 'integer' || schema.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)) || value < schema.minimum || value > schema.maximum) fail();
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') fail();
    } else if (schema.type === 'json') {
      // Bounded JSON used only for template field values, never configuration or code.
      if (JSON.stringify(value).length > 16000) fail();
      if (value && typeof value === 'object') {
        if (path.split('.').length > 12) fail();
        for (const [key, item] of Object.entries(value)) {
          if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
          this.validate(item, schema, `${path}.${key}`);
        }
      }
    }
    if (schema.enum && !schema.enum.includes(value)) fail();
    return value;
  }
};

function agentPick(source, keys) {
  return Object.fromEntries(keys.filter(key => source?.[key] !== undefined).map(key => [key, deepClone(source[key])]));
}
function agentRedact(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const key of ['ai_api_key', 'azure_api_key', 'azure_speech_key']) {
    const secret = appState.scenario.settings?.[key];
    if (secret) text = text.split(secret).join('[REDACTED]');
  }
  return text;
}
function agentExcerpt(value, limit = 1200) {
  const text = agentRedact(value ?? '');
  return text.length > limit ? text.slice(0, limit) + '… [truncated; use detail tools]' : text;
}
function agentActor(actor) {
  return agentPick(actor, ['id', 'name', 'role', 'organization', 'title', 'language']);
}
function agentStimulus(stimulus, full = false) {
  const result = agentPick(stimulus, ['id', 'name', 'channel', 'template_id', 'actor_id', 'timestamp_offset_minutes', 'status', 'generation_mode', 'generation_prompt']);
  result.fields = Object.fromEntries(Object.entries(stimulus.fields || {}).filter(([key]) => !/photo|avatar_url|audio|video|_data/.test(key)).map(([key, value]) => [key, full ? value : agentExcerpt(value, 180)]));
  if (full) result.editableFields = (getTemplateDefinition(stimulus).fields || []).filter(f => !/upload/.test(f.type)).map(f => agentPick(f, ['key', 'type', 'options']));
  return result;
}
function agentScenario() {
  const s = appState.scenario;
  return { id: s.id, name: s.name, client: agentPick(s.client, ['name', 'sector', 'language']), scenario: agentPick(s.scenario, ['type', 'summary', 'detailed_context', 'start_date', 'timezone', 'objectives', 'narrative_arc', 'phases']), actorCount: s.actors.length, stimulusCount: s.stimuli.length };
}
const AgentContext = {
  build() {
    const s = agentScenario();
    s.scenario = Object.fromEntries(Object.entries(s.scenario).map(([k, v]) => [k, typeof v === 'string' ? agentExcerpt(v, 2500) : v]));
    return { ...s, language: appState.scenario.settings.inject_language, actors: appState.scenario.actors.slice(0, 12).map(agentActor), timeline: getSortedStimuli().slice(0, 20).map(s => ({ id: s.id, at: s.timestamp_offset_minutes, name: agentExcerpt(s.name || s.fields.subject || s.fields.headline || s.fields.text, 100) })), note: 'Actor/timeline previews limited to 12/20. Use paginated list tools for remaining items.' };
  }
};
function agentConsistencyCheck() {
  const s = appState.scenario, issues = [];
  if (!s.scenario.summary?.trim()) issues.push('Missing scenario summary.');
  if (!s.scenario.objectives?.trim()) issues.push('No explicit exercise objectives recorded.');
  if (!s.actors.length) issues.push('No actors.');
  if (!s.stimuli.length) issues.push('No stimuli.');
  const phases = s.scenario.phases || [];
  const seen = new Map();
  getSortedStimuli().forEach((item, i, list) => {
    if (!getActor(item.actor_id)) issues.push(`${item.id}: missing actor.`);
    if (!Number.isFinite(item.timestamp_offset_minutes) || item.timestamp_offset_minutes < 0) issues.push(`${item.id}: invalid timing.`);
    if (i && item.timestamp_offset_minutes - list[i - 1].timestamp_offset_minutes > 60) issues.push(`${item.id}: gap over 60 minutes; review pacing.`);
    if (phases.length && !phases.some(p => item.timestamp_offset_minutes >= p.start_minutes && item.timestamp_offset_minutes <= p.end_minutes)) issues.push(`${item.id}: outside planned phases.`);
    if (item.status === 'draft') issues.push(`${item.id}: still draft; review content.`);
    const body = JSON.stringify(item.fields);
    if (seen.has(body)) issues.push(`${item.id}: identical content to ${seen.get(body)}.`);
    seen.set(body, item.id);
  });
  return { issues: issues.slice(0, 50), totalIssues: issues.length, note: 'Structural checks only. Review full content for objective coverage, decisions, disclosure, pressure, ambiguity, escalation and consequences.' };
}
function agentValidatePhases(phases) {
  const ordered = [...phases].sort((a, b) => a.start_minutes - b.start_minutes);
  ordered.forEach((p, i) => {
    if (p.end_minutes <= p.start_minutes || (i && p.start_minutes < ordered[i - 1].end_minutes)) throw new AgentValidationError('Phases must have positive durations and must not overlap.');
  });
  return ordered;
}
function agentCleanFields(stimulus, fields) {
  const defs = getTemplateDefinition(stimulus).fields || [];
  const clean = {};
  for (const [key, value] of Object.entries(fields)) {
    const def = defs.find(f => f.key === key);
    if (!def || /upload/.test(def.type) || /url|_data|audio|video/.test(key)) throw new AgentValidationError(`Field not editable by agents: ${key}`);
    if (def.type === 'checkbox' && typeof value !== 'boolean') throw new AgentValidationError(`Expected boolean field: ${key}`);
    if (def.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new AgentValidationError(`Expected number field: ${key}`);
    if (['text', 'select'].includes(def.type) && typeof value !== 'string') throw new AgentValidationError(`Expected text field: ${key}`);
    if (def.type === 'textarea') {
      if (['reaction_types', 'awards'].includes(key)) {
        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) throw new AgentValidationError(`Expected text array: ${key}`);
      } else if (key === 'top_comment') {
        ToolValidator.validate(value, AgentSchema.object({ author: AgentSchema.text(), flair: AgentSchema.text(), text: AgentSchema.text(), upvotes: { type: 'number', minimum: 0, maximum: 1000000000 }, date: AgentSchema.text() }));
      } else if (typeof value !== 'string') throw new AgentValidationError(`Expected text field: ${key}`);
    }
    if (def.options && !def.options.includes(value)) throw new AgentValidationError(`Invalid field option: ${key}`);
    const scrub = v => typeof v === 'string' ? sanitizeBody(v) : Array.isArray(v) ? v.map(scrub) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, scrub(x)])) : v;
    clean[key] = scrub(value);
  }
  return clean;
}

function agentResolveStimulusTemplate(channel, templateId, fields = {}) {
  let resolved = templateId;
  let contentFields = fields;
  const legacyPublication = fields.publication;
  if (legacyPublication !== undefined) {
    if (channel !== 'article_press' || typeof legacyPublication !== 'string') throw new AgentValidationError('publication is a press template selector; use top-level template_id.');
    const wanted = legacyPublication.trim().toLowerCase();
    const match = Object.entries(ARTICLE_TEMPLATE_LIBRARY).find(([id, template]) => id.toLowerCase() === wanted || template.label?.toLowerCase() === wanted);
    if (!match) throw new AgentValidationError(`Unknown press publication. Use template_id: ${Object.keys(ARTICLE_TEMPLATE_LIBRARY).join(', ')}.`);
    if (resolved && resolved !== match[0]) throw new AgentValidationError('Conflicting template_id and fields.publication.');
    resolved = match[0];
    contentFields = Object.fromEntries(Object.entries(fields).filter(([key]) => key !== 'publication'));
  }
  if (resolved) {
    const library = channel === 'article_press' ? ARTICLE_TEMPLATE_LIBRARY : channel === 'breaking_news_tv' ? TV_TEMPLATE_LIBRARY : null;
    if (!library?.[resolved]) throw new AgentValidationError(`template_id is not valid for channel ${channel}.`);
  }
  return { templateId: resolved, fields: contentFields };
}

function createAgentToolRegistry() {
  const S = AgentSchema, registry = new Map();
  const add = (name, description, properties, required, execute, risk = 'read') => registry.set(name, { name, description, inputSchema: S.object(properties, required), execute, risk });
  const id = { id: S.id }, text = S.text(), fields = { type: 'object', additionalProperties: { type: 'json' } };
  const actorProps = { name: S.text(300), role: { ...S.text(), enum: ROLES.map(r => r.value) }, organization: S.text(300), title: S.text(300), language: { ...S.text(), enum: LANGUAGES.map(l => l.value) } };
  const requireItem = (getter, id) => { const item = getter(id); if (!item) throw new AgentValidationError('Unknown item ID.'); return item; };
  const page = { offset: { type: 'integer', minimum: 0, maximum: 100000 }, limit: { type: 'integer', minimum: 1, maximum: 40 } };
  const paginate = (items, args, mapper) => { const offset = args.offset || 0, limit = args.limit || 20; return { total: items.length, nextOffset: offset + limit < items.length ? offset + limit : null, items: items.slice(offset, offset + limit).map(mapper) }; };
  add('getScenario', 'Read scenario and planning metadata; no settings or credentials.', {}, [], agentScenario);
  add('updateScenario', 'Patch only supplied scenario/client values. Broad change requires approval in Agent mode.', { name: S.text(500), client: S.object({ name: S.text(300), sector: S.text(300), language: actorProps.language }), scenario: S.object({ type: S.text(300), summary: text, detailed_context: S.text(16000), start_date: S.text(30), timezone: { ...S.text(), enum: TIMEZONES }, narrative_arc: text }) }, [], args => {
    if (args.scenario?.start_date && !Number.isFinite(Date.parse(args.scenario.start_date))) throw new AgentValidationError('Invalid start date.');
    if (args.name !== undefined) appState.scenario.name = args.name;
    Object.assign(appState.scenario.client, args.client || {}); Object.assign(appState.scenario.scenario, args.scenario || {});
    return agentScenario();
  }, 'broad');
  add('getExerciseObjectives', 'Read objectives and narrative arc.', {}, [], () => agentPick(appState.scenario.scenario, ['objectives', 'narrative_arc']));
  add('updateExerciseObjectives', 'Set explicit objectives, including participant decisions to test.', { objectives: text }, ['objectives'], args => { appState.scenario.scenario.objectives = args.objectives; return args; }, 'write');
  add('getTimeline', 'Read timed phases and a paginated timeline.', page, [], args => ({ phases: appState.scenario.scenario.phases || [], ...paginate(getSortedStimuli(), args, s => agentPick(s, ['id', 'name', 'actor_id', 'channel', 'timestamp_offset_minutes'])) }));
  const phase = S.object({ name: S.text(200), start_minutes: S.minutes, end_minutes: S.minutes, purpose: S.text(1500) }, ['name', 'start_minutes', 'end_minutes', 'purpose']);
  add('setPhases', 'Create or replace the timed exercise phases (not debrief phases).', { phases: S.array(phase, 20) }, ['phases'], args => { appState.scenario.scenario.phases = agentValidatePhases(args.phases); return args; }, 'broad');
  add('listActors', 'Read actors with pagination.', page, [], args => paginate(appState.scenario.actors, args, agentActor));
  add('getActor', 'Read a single actor.', id, ['id'], args => agentActor(requireItem(getActor, args.id)));
  add('createActor', 'Create an actor using the same defaults as the UI.', actorProps, ['name', 'role'], args => agentActor(addActor(args, false)), 'write');
  add('updateActor', 'Patch an existing actor.', { ...id, patch: S.object(actorProps) }, ['id', 'patch'], args => { const actor = requireItem(getActor, args.id); Object.assign(actor, args.patch); actor.avatar_initials = initialsFromName(actor.name); return agentActor(actor); }, 'write');
  add('listStimuli', 'Read paginated content excerpts; getStimulus returns complete editable content.', page, [], args => paginate(getSortedStimuli(), args, s => agentStimulus(s)));
  add('getStimulus', 'Read complete content plus editable template fields and types.', id, ['id'], args => agentStimulus(requireItem(getStimulus, args.id), true));
  const stimulusProps = { name: S.text(500), actor_id: S.id, timestamp_offset_minutes: S.minutes, generation_prompt: text, status: { ...S.text(), enum: ['draft', 'ready'] }, fields };
  const specializedTemplateIds = [...new Set([...Object.keys(ARTICLE_TEMPLATE_LIBRARY), ...Object.keys(TV_TEMPLATE_LIBRARY)])];
  add('createStimulus', 'Create a scheduled inject. For article_press or breaking_news_tv, select the publication/station with top-level template_id. fields accepts only actual fields of that template; publication is not a content field. Omit fields and generate content afterwards when field names are unknown.', { ...stimulusProps, channel: { ...S.text(), enum: Object.keys(TEMPLATE_LIBRARY) }, template_id: { ...S.text(), enum: specializedTemplateIds } }, ['name', 'actor_id', 'timestamp_offset_minutes', 'channel'], args => {
    requireItem(getActor, args.actor_id);
    const selection = agentResolveStimulusTemplate(args.channel, args.template_id, args.fields || {});
    const stimulus = makeStimulus(args.channel, args.actor_id, args.timestamp_offset_minutes, selection.templateId);
    const clean = agentCleanFields(stimulus, selection.fields);
    Object.assign(stimulus, agentPick(args, ['name', 'generation_prompt', 'status']));
    saveStimulus(stimulus, { ...stimulus.fields, ...clean }, 'Agent: created content');
    appState.scenario.stimuli.push(stimulus); setDefaultVideoForStimulus(stimulus); sortStimuli();
    return agentStimulus(stimulus);
  }, 'write');
  add('updateStimulus', 'Patch an inject, preserving its channel/template and versioning changed content.', { ...id, patch: S.object(stimulusProps) }, ['id', 'patch'], args => {
    const stimulus = requireItem(getStimulus, args.id), patch = args.patch;
    if (patch.actor_id) requireItem(getActor, patch.actor_id);
    const clean = agentCleanFields(stimulus, patch.fields || {});
    if (patch.fields) saveStimulus(stimulus, { ...stimulus.fields, ...clean }, 'Agent: edited content');
    Object.assign(stimulus, agentPick(patch, Object.keys(stimulusProps).filter(k => k !== 'fields'))); stimulus.updated_at = new Date().toISOString(); sortStimuli(); return agentStimulus(stimulus);
  }, 'write');
  add('deleteStimulus', 'Delete one inject. Always requires explicit approval.', id, ['id'], args => { requireItem(getStimulus, args.id); deleteStimulus(args.id); return { deleted: args.id }; }, 'destructive');
  add('moveStimulus', 'Move an inject to a minute offset.', { ...id, timestamp_offset_minutes: S.minutes }, ['id', 'timestamp_offset_minutes'], args => { const item = requireItem(getStimulus, args.id); item.timestamp_offset_minutes = args.timestamp_offset_minutes; item.updated_at = new Date().toISOString(); sortStimuli(); return args; }, 'write');
  add('reorderStimuli', 'Atomically reschedule up to 40 injects; no other content changes.', { positions: S.array(S.object({ ...id, timestamp_offset_minutes: S.minutes }, ['id', 'timestamp_offset_minutes'])) }, ['positions'], args => {
    const items = args.positions.map(p => requireItem(getStimulus, p.id));
    if (new Set(args.positions.map(p => p.id)).size !== items.length) throw new AgentValidationError('Duplicate stimulus ID.');
    args.positions.forEach((p, i) => { items[i].timestamp_offset_minutes = p.timestamp_offset_minutes; }); sortStimuli(); return args;
  }, 'broad');
  for (const name of ['generateStimulusContent', 'improveStimulusContent']) {
    add(name, 'Generate/improve content through the existing provider and template prompts. Supply precise instructions. Preserves manual-mode injects.', { ...id, instructions: text }, ['id', 'instructions'], async (args, run) => {
      const stimulus = requireItem(getStimulus, args.id);
      if (stimulus.generation_mode === 'manual') throw new AgentValidationError('Manual-mode content is protected; propose explicit field edits instead.');
      const before = JSON.stringify(stimulus);
      const result = await AITextGenerator.generateForStimulus(stimulus, null, agentRedact(`${args.instructions}\nCurrent content: ${JSON.stringify(stimulus.fields)}`), { signal: run.controller.signal, quiet: true, strictJSON: true, promptFilter: agentRedact });
      run.assertActive();
      if (getStimulus(args.id) !== stimulus || JSON.stringify(stimulus) !== before) throw new AgentValidationError('Stimulus changed during generation; inspect it again.');
      ToolValidator.validate(result, fields);
      const clean = agentCleanFields(stimulus, result);
      if (!Object.keys(clean).length) throw new AgentValidationError('Generation returned no content.');
      saveStimulus(stimulus, { ...stimulus.fields, ...clean }, 'Agent: AI content generation');
      Object.assign(stimulus.generated_text, clean); stimulus.status = 'ready'; return agentStimulus(stimulus);
    }, 'write');
  }
  add('runConsistencyCheck', 'Run deterministic structural checks; findings need human/design judgment.', {}, [], agentConsistencyCheck);
  add('analyzeExerciseQuality', 'Return structural findings and critical review criteria. Read content and assess each criterion before deciding to improve or finish.', {}, [], () => ({ ...agentConsistencyCheck(), criteria: ['Objectives actually tested', 'Executive decisions and dilemmas', 'Realistic timing and escalation', 'Information disclosure and ambiguity', 'Stakeholder pressure', 'Consequences and narrative consistency'], instruction: 'Use getStimulus for evidence; prioritize issues, act, then re-analyze.' }));
  return registry;
}
