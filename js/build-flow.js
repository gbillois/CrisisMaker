/* Build my exercise, in the two stages of the work with a client:
   1. the framing: phases, main events and their consequences, cells and senders (Main storyline),
      reviewed and validated with the client;
   2. the stimuli of every cell, planned and written under that framing (Detailed storyline),
      then challenged (Check & Challenge).
   The validation keeps a named version of the storyline and a fingerprint of each phase, so the
   next tabs can say what changed in the framing since the client validated it. */

/* What the client validates: the phases of the main storyline and their main events, not the
   injects planned under them. */
function bfFramingPrints(project = appState.scenario) {
  const storyboard = project.storyboard;
  if (!storyboard) return {};
  return Object.fromEntries(sbMainBlocks(storyboard).map((block) => [block.id, sbHash({
    type: block.type, title: block.title, start: block.start_minutes, duration: block.duration_minutes,
    brief: block.brief, narrative: block.narrative,
    events: (block.events || []).map((event) => [event.offset_minutes, event.text || event.title || ''])
  })]));
}

function bfFramingValidation(project = appState.scenario) {
  const saved = project.framing_validation;
  return saved && typeof saved === 'object' && saved.prints && typeof saved.prints === 'object' ? saved : null;
}

/* The phases added, removed or changed since the validation (null when never validated). */
function bfFramingChanges(project = appState.scenario) {
  const saved = bfFramingValidation(project);
  if (!saved) return null;
  const now = bfFramingPrints(project);
  const added = Object.keys(now).filter((id) => !(id in saved.prints)).length;
  const removed = Object.keys(saved.prints).filter((id) => !(id in now)).length;
  const changed = Object.keys(now).filter((id) => id in saved.prints && saved.prints[id] !== now[id]).length;
  return { added, removed, changed, total: added + removed + changed };
}

function bfValidateFraming(project = appState.scenario) {
  if (!sbMainBlocks(project.storyboard).length) return false;
  const at = new Date();
  const when = at.toLocaleString(uiLocale(), { dateStyle: 'short', timeStyle: 'short' });
  const version = StoryboardHistory.snapshot(tt(`Framing validated (${when})`, `Cadrage validé (${when})`, `Rahmen freigegeben (${when})`), 'named');
  project.framing_validation = { at: at.toISOString(), version_id: version?.id || '', prints: bfFramingPrints(project) };
  saveLocal(false);
  return true;
}

function bfFramingObjective(project, { adapted = false, only = null } = {}) {
  return [
    only && only.phases === false ? 'THIS RUN BUILDS ONLY the player cells with their players, and the cast roles with their actors (upsertCells, upsertCast). Do not change the scenario, the phases or their main events.' : '',
    only && only.cells === false ? 'THIS RUN BUILDS ONLY the scenario and its phases with their main events. Do not change the player cells, their players or the cast.' : '',
    'STAGE 1 OF 2, FRAMING ONLY. The designer reviews and validates the framing with the client before any inject is planned.',
    adapted ? 'The library scenario is already adapted to the client (phases, roles and planned injects): keep its phases and planned injects, correct only what contradicts the context, and spend your steps on what is missing: main events, cells and players, actors for the roles.' : '',
    'Build: scenario name, type and summary; objectives; synopsis and threat; the phases of the main storyline, ending with a closing phase (recovery, return to normal, end of exercise) unless the context says otherwise; the main events of each phase with the main consequences the players must manage; the player cells and their players; the cast roles with their actors.',
    bfSourceListsStimuli()
      ? 'Injects: plan now (planPhaseInjects), in their phase, only the stimuli the source file lists (one planned inject each, not written); do not invent others and do not write any (no createStimulus): stage 2 completes the plan of each cell and writes the injects once the framing is validated. Ignore consistency findings about cells without injects or unwritten injects. Keep the main events (setMainEvents) for the few pieces of information or actions that structure each phase (a sequence summary or presentation), never for the listed stimuli.'
      : 'Do NOT plan or write injects for the cells (no planPhaseInjects, no addPlannedInjects, no createStimulus): stage 2 plans and writes them once the framing is validated. Ignore consistency findings about cells without injects or unwritten injects.',
    bfSourceDefinesPhases() ? 'The source file defines the phases: build exactly those, in its order, and no other (no added closing phase unless the file has one).' : '',
    contextAgentObjective(project)
  ].filter(Boolean).join('\n').slice(0, 7900);
}

/* What the file loaded in the Context says: its own phases, its own stimuli. */
function bfSourceDefinesPhases() {
  return !!appState.checkerState?.parsedData?.analysis?.sections?.phases?.length;
}
function bfSourceListsStimuli() {
  const analysis = appState.checkerState?.parsedData?.analysis;
  return !!(analysis && (analysis.chronogramRows || analysis.sections?.chronogram?.length));
}

const BuildFlow = {
  stage: '',
  progress: null,

  busy() {
    return !!this.stage || (typeof ContextGeneration !== 'undefined' && !!ContextGeneration.stage) || getCrisisAgent().active || (typeof SbPipeline !== 'undefined' && SbPipeline.active) || !!appState.checkerState?.analysisLoading;
  },

  /* Stage 1: the builder agent sets the framing, then the Main storyline opens for review. */
  async framing({ openStoryline = true, only = null } = {}) {
    const project = appState.scenario;
    if (this.busy()) return false;
    // What this framing builds: the cells and cast, the phases, or both (default).
    this.only = only;
    const template = contextLibraryTemplate(project);
    let adapted = false;
    if (template && project.storyboard.meta.template_id !== template.id) {
      // The library scenario is made the client's own (texts only) before it lands on the
      // storyline; without AI, or when that fails, it lands as it is and the agent adapts it.
      let instance = template;
      this.stage = 'adapting';
      App.render();
      try {
        instance = await SbAI.instantiateTemplate(template, { onProgress: (done, total) => { this.progress = { done, total }; App.render(); } });
        adapted = true;
        if (instance.kept_phases) pushToast(tt(`${instance.kept_phases} phase(s) of the library scenario kept their original story: the AI could not rewrite them.`, `${instance.kept_phases} phase(s) du scénario de bibliothèque gardent leur histoire d’origine : l’IA n’a pas pu les réécrire.`, `${instance.kept_phases} Phase(n) des Bibliotheksszenarios behalten ihre ursprüngliche Geschichte: Die KI konnte sie nicht umschreiben.`), 'warning');
      } catch (error) {
        pushToast(tt(`The library scenario could not be adapted by the AI (${sbErrorMessage(error)}): the agent adapts it instead.`, `Le scénario de bibliothèque n’a pas pu être adapté par l’IA (${sbErrorMessage(error)}) : l’agent l’adapte à la place.`, `Das Bibliotheksszenario konnte nicht von der KI angepasst werden (${sbErrorMessage(error)}): Der Agent passt es stattdessen an.`), 'warning');
      } finally {
        this.stage = '';
        this.progress = null;
      }
      if (appState.scenario !== project) return false;
      // The phases are fitted to the exercise duration set in the Context (the library
      // scenarios are written for 3 hours).
      const duration = project.storyboard.duration_minutes;
      if (duration && Number(instance.duration_minutes) !== duration) instance = { ...instance, duration_minutes: duration };
      if (!sbUseTemplate(instance, 'replace')) return false;
      project.storyboard.meta.template_id = template.id;
      project.storyboard.meta.library_id = template.id;
      if (adapted && instance.name && !project.name) project.name = instance.name;
    }
    saveLocal(false);
    this.stage = 'framing';
    try {
      await startCrisisAgent({ kind: 'builder', mode: tabUI('context').mode || 'agent', objective: bfFramingObjective(project, { adapted, only }), origin: 'context', scope: 'framing' });
    } finally {
      this.stage = '';
      this.only = null;
    }
    const done = appState.scenario === project && getCrisisAgent().status === 'complete' && sbMainBlocks(project.storyboard).length > 0;
    if (done && openStoryline) {
      appState.route = 'storyline';
      pushToast(tt('Framing ready. Review it with the client, then validate it and build the stimuli.', 'Cadrage prêt. Relisez-le avec le client, puis validez-le et construisez les stimuli.', 'Rahmen fertig. Mit dem Kunden prüfen, dann freigeben und die Stimuli erstellen.'), 'success');
    }
    App.render();
    return done;
  },

  /* Stage 2: every cell's injects are planned and written under the framing, then challenged. */
  async stimuli({ confirmUnvalidated = true, challenge = true } = {}) {
    const project = appState.scenario;
    if (this.busy()) return false;
    if (!sbMainBlocks(project.storyboard).length) {
      pushToast(tt('Build the framing first: its phases frame the injects of every cell.', 'Construisez d’abord le cadrage : ses phases structurent les injects de chaque cellule.', 'Erstellen Sie zuerst den Rahmen: Seine Phasen strukturieren die Injects jeder Zelle.'), 'info');
      return false;
    }
    if (confirmUnvalidated && !bfFramingValidation(project) && !window.confirm(tt('The framing is not validated yet. Build the stimuli of every cell anyway?', 'Le cadrage n’est pas encore validé. Construire quand même les stimuli de chaque cellule ?', 'Der Rahmen ist noch nicht freigegeben. Trotzdem die Stimuli aller Zellen erstellen?'))) return false;
    // A framing plans no inject: each phase gets a target from its length and the cells
    // (about one inject per cell every 20 minutes), unless the designer set one.
    if (sbFillInjectTargets(project).length) StoryboardHistory.commit('Set inject targets');
    this.stage = 'stimuli';
    appState.route = 'detailed';
    App.render();
    let result = null;
    try {
      result = await SbPipeline.run({ plan: true, cast: true, write: isLLMAvailable() });
    } catch (error) {
      pushToast(sbErrorMessage(error), 'error');
    }
    if (appState.scenario !== project || SbPipeline.status !== 'complete') { this.stage = ''; App.render(); return false; }
    pushToast(challenge
      ? tt(`${result?.created || 0} inject(s) created, ${result?.written || 0} written. Challenging the exercise…`, `${result?.created || 0} inject(s) créé(s), ${result?.written || 0} rédigé(s). Challenge de l’exercice…`, `${result?.created || 0} Inject(s) erstellt, ${result?.written || 0} geschrieben. Die Übung wird geprüft…`)
      : tt(`${result?.created || 0} inject(s) created, ${result?.written || 0} written.`, `${result?.created || 0} inject(s) créé(s), ${result?.written || 0} rédigé(s).`, `${result?.created || 0} Inject(s) erstellt, ${result?.written || 0} geschrieben.`), 'success');
    this.stage = 'challenge';
    appState.route = 'summary';
    appState.checkerState.mode = 'scenario';
    App.render();
    try {
      if (challenge && isLLMAvailable()) await ccChallenge();
    } finally {
      this.stage = '';
      App.render();
    }
    return true;
  }
};

function bfChangesLabel(changes) {
  const parts = [];
  if (changes.changed) parts.push(tt(`${changes.changed} phase(s) changed`, `${changes.changed} phase(s) modifiée(s)`, `${changes.changed} Phase(n) geändert`));
  if (changes.added) parts.push(tt(`${changes.added} added`, `${changes.added} ajoutée(s)`, `${changes.added} hinzugefügt`));
  if (changes.removed) parts.push(tt(`${changes.removed} removed`, `${changes.removed} supprimée(s)`, `${changes.removed} entfernt`));
  return tt(`Changed since validation: ${parts.join(', ')}`, `Modifié depuis la validation : ${parts.join(', ')}`, `Seit der Freigabe geändert: ${parts.join(', ')}`);
}

/* The line under the toolbar of the Main and Detailed storylines: where the framing stands. */
function renderFramingBar(project, route) {
  if (!sbMainBlocks(project.storyboard).length) return '';
  const validation = bfFramingValidation(project);
  const changes = bfFramingChanges(project);
  const busy = BuildFlow.busy();
  let text;
  let tone = 'info';
  if (!validation) {
    text = route === 'storyline'
      ? tt('Stage 1, framing. Review the phases and main events with the client, then validate the framing before building the stimuli of each cell.', 'Étape 1, cadrage. Relisez les phases et les événements principaux avec le client, puis validez le cadrage avant de construire les stimuli de chaque cellule.', 'Schritt 1, Rahmen. Phasen und Hauptereignisse mit dem Kunden prüfen, dann den Rahmen freigeben, bevor die Stimuli jeder Zelle erstellt werden.')
      : tt('The framing of the main storyline is not validated yet.', 'Le cadrage de la storyline principale n’est pas encore validé.', 'Der Rahmen der Haupt-Storyline ist noch nicht freigegeben.');
  } else if (changes.total) {
    tone = 'warn';
    text = `${bfChangesLabel(changes)}.`;
  } else {
    tone = 'ok';
    text = tt(`Framing validated on ${new Date(validation.at).toLocaleString(uiLocale(), { dateStyle: 'short', timeStyle: 'short' })}, unchanged since.`, `Cadrage validé le ${new Date(validation.at).toLocaleString(uiLocale(), { dateStyle: 'short', timeStyle: 'short' })}, inchangé depuis.`, `Rahmen freigegeben am ${new Date(validation.at).toLocaleString(uiLocale(), { dateStyle: 'short', timeStyle: 'short' })}, seitdem unverändert.`);
  }
  const validate = !validation || changes.total
    ? `<button class="btn ${validation ? 'btn-secondary' : 'btn-primary'} btn-xs" data-bf-action="validate" ${busy ? 'disabled' : ''}>${sbUiIcon('checkCircle', 13)} ${escapeHtml(validation ? tt('Validate again', 'Valider à nouveau', 'Erneut freigeben') : tt('Validate the framing', 'Valider le cadrage', 'Rahmen freigeben'))}</button>`
    : '';
  const compare = validation?.version_id && changes.total && StoryboardHistory.findVersion(validation.version_id)
    ? `<button class="btn btn-ghost btn-xs" data-bf-action="compare">${sbUiIcon('history', 13)} ${escapeHtml(tt('Compare', 'Comparer', 'Vergleichen'))}</button>`
    : '';
  const next = route === 'storyline' && validation && !changes.total
    ? `<button class="btn btn-primary btn-xs" data-bf-action="stimuli" ${busy || !isLLMAvailable() ? 'disabled' : ''}>${sbUiIcon('play', 13)} ${escapeHtml(tt('Build the stimuli', 'Construire les stimuli', 'Stimuli erstellen'))}</button>`
    : '';
  return `<div class="bf-bar is-${tone}">${sbUiIcon(tone === 'ok' ? 'checkCircle' : tone === 'warn' ? 'alert' : 'info', 14)}<span>${escapeHtml(text)}</span><div class="bf-bar-actions">${compare}${validate}${next}</div></div>`;
}

/* One listener for the framing bar of the storylines (it is re-rendered with the page). */
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', async (event) => {
  const button = event.target?.closest?.('[data-bf-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.bfAction;
  try {
    if (action === 'validate') {
      if (bfValidateFraming()) pushToast(tt('Framing validated: a version of the storyline was kept. Later changes to the phases will show.', 'Cadrage validé : une version de la storyline a été conservée. Les modifications ultérieures des phases seront signalées.', 'Rahmen freigegeben: Eine Version der Storyline wurde gespeichert. Spätere Änderungen an den Phasen werden angezeigt.'), 'success');
      App.render();
    } else if (action === 'compare') {
      const ui = sbUI();
      ui.diffVersionId = bfFramingValidation()?.version_id || null;
      ui.modal = 'versions';
      appState.route = 'storyline';
      App.render();
    } else if (action === 'stimuli') {
      await BuildFlow.stimuli();
    }
  } catch (error) {
    pushToast(sbErrorMessage(error), 'error');
    App.render();
  }
});
