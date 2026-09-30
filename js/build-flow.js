/* Building an exercise in two stages:
   1. the framing: phases, main events and their consequences, cells and senders (Main storyline);
   2. the injects of every cell, planned and written under that framing (Detailed storyline),
      then challenged (Check & Challenge). */

function bfFramingObjective(project, { adapted = false, only = null } = {}) {
  return [
    only && only.phases === false ? 'THIS RUN BUILDS ONLY the player cells with their players, and the cast roles with their actors (upsertCells, upsertCast). Do not change the scenario, the phases or their main events.' : '',
    only && only.cells === false ? 'THIS RUN BUILDS ONLY the scenario and its phases with their main events. Do not change the player cells, their players or the cast.' : '',
    'STAGE 1 OF 2, FRAMING ONLY. The injects of the cells are planned and written in stage 2.',
    adapted ? 'The library scenario is already adapted to the client (phases, roles and planned injects): keep its phases and planned injects, correct only what contradicts the context, and spend your steps on what is missing: main events, cells and players, actors for the roles.' : '',
    'Build: scenario name, type and summary; objectives; synopsis and threat; the phases of the main storyline, ending with a closing phase (recovery, return to normal, end of exercise) unless the context says otherwise; the main events of each phase with the main consequences the players must manage; the player cells and their players; the cast roles with their actors.',
    bfSourceListsStimuli()
      ? 'Injects: plan now (planPhaseInjects), in their phase, only the stimuli the source file lists (one planned inject each, not written); do not invent others and do not write any (no createStimulus): stage 2 completes the plan of each cell and writes the injects once the framing is validated. Ignore consistency findings about cells without injects or unwritten injects. Keep the main events (setMainEvents) for the few pieces of information or actions that structure each phase (a sequence summary or presentation), never for the listed stimuli.'
      : 'Do NOT plan or write injects for the cells (no planPhaseInjects, no addPlannedInjects, no createStimulus): stage 2 plans and writes them. Ignore consistency findings about cells without injects or unwritten injects.',
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
      pushToast(tt('Main storyline ready. Review it with the client, then write the injects.', 'Storyline principale prête. Relisez-la avec le client, puis rédigez les injects.', 'Haupt-Storyline fertig. Mit dem Kunden prüfen, dann die Injects schreiben.'), 'success');
    }
    App.render();
    return done;
  },

  /* Stage 2: every cell's injects are planned and written under the framing, then challenged. */
  async stimuli({ challenge = true } = {}) {
    const project = appState.scenario;
    if (this.busy()) return false;
    if (!sbMainBlocks(project.storyboard).length) {
      pushToast(tt('Build the framing first: its phases frame the injects of every cell.', 'Construisez d’abord le cadrage : ses phases structurent les injects de chaque cellule.', 'Erstellen Sie zuerst den Rahmen: Seine Phasen strukturieren die Injects jeder Zelle.'), 'info');
      return false;
    }
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
