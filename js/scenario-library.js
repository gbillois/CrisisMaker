/* Scenario library: built-in storyboards (scenario-library-data.js) and the
   user's own templates, stored in this browser and exchangeable as files. */
const SB_USER_TEMPLATES_KEY = 'crisismaker_scenario_templates_v1';
const SB_TEMPLATE_FILE_SUFFIX = '.crisisscenario.json';
const SB_SCENARIO_TYPES = { ransomware: 'Ransomware', 'personal-data-breach': 'Data Breach', 'software-supply-chain': 'Supply Chain', 'ddos-hacktivism': 'DDoS', 'insider-threat-sabotage': 'Insider Threat' };

function sbBuiltinTemplates() {
  return typeof SCENARIO_LIBRARY !== 'undefined' && Array.isArray(SCENARIO_LIBRARY) ? SCENARIO_LIBRARY : [];
}

function sbUserTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(SB_USER_TEMPLATES_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter((item) => item && typeof item === 'object' && Array.isArray(item.blocks)) : [];
  } catch (_) {
    return [];
  }
}

function sbSaveUserTemplates(list) {
  localStorage.setItem(SB_USER_TEMPLATES_KEY, JSON.stringify(list.slice(0, 60)));
}

function sbLibraryEntries() {
  return [
    ...sbBuiltinTemplates().map((template) => ({ ...template, builtin: true })),
    ...sbUserTemplates().map((template) => ({ ...template, builtin: false, category: template.category || 'Custom' }))
  ];
}

function sbFindTemplate(id) {
  return sbLibraryEntries().find((template) => template.id === id) || null;
}

function sbTemplateStats(template) {
  const blocks = Array.isArray(template.blocks) ? template.blocks : [];
  return {
    blocks: blocks.length,
    injects: blocks.reduce((sum, block) => sum + (Number(block.stimuli) || (block.beats || []).length || 0), 0),
    workstreams: new Set(blocks.map((block) => block.track || 'main').filter((track) => track !== 'main')).size,
    duration: Number(template.duration_minutes) || SB_DEFAULT_DURATION
  };
}

/* What a storyline leaves behind when it is replaced: the injects written from its plan (linked to
   one of its phases) and the actors cast for its roles that no remaining inject sends. */
function sbStaleStorylineContent(project, storyboard) {
  const blockIds = new Set((storyboard?.blocks || []).map((block) => block.id));
  const castIds = new Set((storyboard?.cast || []).map((cast) => cast.id));
  const stimuli = new Set((project.stimuli || []).filter((stimulus) => blockIds.has(stimulus.scenario_link?.block_id)).map((stimulus) => stimulus.id));
  const kept = new Set((project.stimuli || []).filter((stimulus) => !stimuli.has(stimulus.id)).map((stimulus) => stimulus.actor_id));
  const cast = new Set([
    ...(storyboard?.cast || []).map((item) => item.actor_id).filter(Boolean),
    ...(project.actors || []).filter((actor) => castIds.has(actor.scenario_link?.cast_id)).map((actor) => actor.id)
  ]);
  const actors = new Set([...cast].filter((id) => !kept.has(id)));
  return { stimuli, actors };
}

/* What the last template applied removed from the replaced storyline (see sbStaleStorylineContent). */
let sbTemplateCleanup = { stimuli: 0, actors: 0 };

/* Replaces the storyboard, or inserts the template blocks after the current main storyline. */
function sbApplyTemplate(template, mode = 'replace', { clean = true } = {}) {
  sbTemplateCleanup = { stimuli: 0, actors: 0 };
  const project = appState.scenario;
  StoryboardHistory.ensure(project);
  const repaired = sbRepairTemplate(deepClone(template), template.duration_minutes);
  // Recipients named by cell key become cells of this project (created when missing, or the closest
  // one when the number of cells is set in Context).
  const cellFor = (key) => (SB_CELL_PRESETS.some((preset) => preset.key === key) ? sbEnsureCell(project, key).id : '');
  const { storyboard: incoming, objectives, title } = sbTemplateToStoryboard(repaired, { templateId: template.id, cellFor });
  const current = project.storyboard;
  if (mode === 'insert' && current.blocks.length) {
    const offset = sbNextMainStart(current);
    for (const track of incoming.tracks) {
      if (!current.tracks.some((item) => item.key && item.key === track.key)) current.tracks.push({ ...track, id: uid('track') });
    }
    const castMap = sbMergeCastFromAI(current, incoming.cast);
    const idMap = new Map(incoming.cast.map((cast) => [cast.id, castMap.get(cast.label) || '']));
    for (const block of incoming.blocks) {
      const sourceTrack = sbTrack(incoming, block.track_id);
      const target = sourceTrack.kind === 'main' ? sbMainTrack(current) : current.tracks.find((item) => item.key === sourceTrack.key) || sbMainTrack(current);
      current.blocks.push(sbNormalizeBlock({
        ...block,
        track_id: target.id,
        start_minutes: block.start_minutes + offset,
        key_cast: block.key_cast.map((id) => idMap.get(id)).filter(Boolean),
        beats: block.beats.map((beat) => ({ ...beat, cast_id: idMap.get(beat.cast_id) || '' }))
      }, current));
    }
    current.duration_minutes = Math.max(current.duration_minutes, sbStoryboardEnd(current));
  } else {
    incoming.rev = (current?.rev || 0) + 1;
    incoming.meta.brief = current?.meta?.brief || '';
    incoming.meta.library_id = current?.meta?.library_id || '';
    // A library scenario replacing the storyline: the injects and actors of the replaced one
    // belong to another story, they go and the new roles are never played by them. Injects and
    // actors added by hand stay. The agent's own storylines (clean: false) keep them.
    const stale = clean ? sbStaleStorylineContent(project, current) : { stimuli: new Set(), actors: new Set() };
    project.stimuli = (project.stimuli || []).filter((stimulus) => !stale.stimuli.has(stimulus.id));
    project.actors = (project.actors || []).filter((actor) => !stale.actors.has(actor.id));
    for (const cast of incoming.cast) {
      const actor = sbFindActorForCast(project, cast);
      if (actor) cast.actor_id = actor.id;
    }
    project.storyboard = incoming;
    if (typeof appState !== 'undefined' && stale.stimuli.has(appState.selectedStimulusId)) appState.selectedStimulusId = project.stimuli[0]?.id || null;
    sbTemplateCleanup = { stimuli: stale.stimuli.size, actors: stale.actors.size };
  }
  // Block objectives reference the template objectives: bring them along.
  if (objectives.length) {
    const existing = sbObjectivesList(project);
    project.scenario.objectives = (mode === 'insert' ? [...existing, ...objectives.filter((item) => !existing.includes(item))] : objectives).join('\n');
  }
  if (!project.scenario.summary?.trim() && template.summary) project.scenario.summary = template.summary;
  if (!project.name?.trim() && title) project.name = title;
  const type = Object.entries(SB_SCENARIO_TYPES).find(([key]) => String(template.id || '').startsWith(key))?.[1];
  if (type && !project.stimuli.length) project.scenario.type = type;
  sbFlattenWorkstreams(project);
  // The plans come with the template: later edits of a phase's text call for a re-plan.
  for (const block of project.storyboard.blocks) if (block.beats.length && !block.plan_hash) sbMarkPlanned(block);
  // The number of cells set in Context stays; otherwise it follows the cells now in the project.
  project.exercise = { ...(project.exercise || {}), cells_count: Number(project.exercise?.cells_count) || project.cells.length };
  return project.storyboard;
}

function sbSaveCurrentAsTemplate(name) {
  const project = appState.scenario;
  const template = sbStoryboardToTemplate(project.storyboard, project, sbText(name, 160));
  if (!template.blocks.length) throw new AgentValidationError('The storyboard is empty.');
  sbSaveUserTemplates([template, ...sbUserTemplates()]);
  return template;
}

function sbDeleteUserTemplate(id) {
  sbSaveUserTemplates(sbUserTemplates().filter((template) => template.id !== id));
}

function sbExportTemplate(template) {
  const { builtin, ...clean } = template;
  const data = { schema: 'crisismaker-scenario-template', version: 1, template: clean };
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${slugify(template.name || 'scenario')}${SB_TEMPLATE_FILE_SUFFIX}`);
}

function sbParseTemplateFile(text) {
  const data = JSON.parse(text);
  const template = data?.schema === 'crisismaker-scenario-template' ? data.template : data;
  if (!template || typeof template !== 'object' || !Array.isArray(template.blocks)) throw new AgentValidationError('This file is not a CrisisMaker scenario template.');
  const repaired = sbRepairTemplate(template, template.duration_minutes);
  if (!repaired.blocks.length) throw new AgentValidationError('The template has no block.');
  return {
    ...repaired,
    id: uid('tpl'),
    name: sbText(template.name, 160) || 'Imported scenario',
    category: sbText(template.category, 60) || 'Custom',
    icon: SB_ICON_PATHS[template.icon] ? template.icon : 'square',
    summary: sbText(template.summary, 4000),
    threat: sbText(template.threat, 1000),
    objectives: sbTextList(template.objectives, 20, 600),
    cast: (Array.isArray(template.cast) ? template.cast : []).slice(0, 60),
    created_at: new Date().toISOString()
  };
}

function sbImportTemplateFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${SB_TEMPLATE_FILE_SUFFIX},.json`;
    input.style.display = 'none';
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return resolve(null);
      try {
        if (file.size > 2 * 1024 * 1024) throw new AgentValidationError('Template file too large (max 2 MB).');
        const template = sbParseTemplateFile(await file.text());
        sbSaveUserTemplates([template, ...sbUserTemplates()]);
        resolve(template);
      } catch (error) {
        pushToast(error instanceof SyntaxError ? 'Invalid JSON file.' : sbErrorMessage(error), 'error');
        resolve(null);
      }
    }, { once: true });
    input.addEventListener('cancel', () => { cleanup(); resolve(null); }, { once: true });
    input.click();
  });
}
