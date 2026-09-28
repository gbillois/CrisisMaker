/* ═══════════════════════════════════════════════════════════════════════════════
   Exercise model: the pivot every tab reads.

   CrisisMaker stores one project (appState.scenario). This module does not store
   anything: it gives every tab the same answers about that project, so the
   Detailed storyline, Check & Challenge, Play, Injects, the export, the Checker and
   the agent agree on what an inject is, its phase, its number, its cell and sender.

   Entities (where they live in the project):
     Exercise ── context: client, scenario (summary, learning objectives, incident timeline),
     │           exercise (players, cells count), storyboard.meta (brief, synopsis, threat)
     ├─ Phase ─────────── storyboard.blocks on the main track: title, "what happens"
     │   │                (brief), hidden story (narrative), notes, start, duration
     │   └─ Planned inject  block.beats: time in the phase, recipient cell, role, channel,
     │                    title and intent (the plan)
     ├─ Cell ──────────── cells: name, mission, players
     ├─ Role ──────────── storyboard.cast: who speaks in the story (CISO, journalist…)
     │   └─ Actor ─────── actors: the simulated person who plays the role and signs
     ├─ Inject ────────── stimuli: the written inject (content, sender actor, recipient
     │                    cell, time, run status), linked to its planned inject by
     │                    scenario_link { block_id, beat_id, hashes }
     └─ Run ───────────── play: clock, speed, exercise log

   Dependencies (what the Update button reflects, in this order):
     Phase "what happens" ──► Planned injects (re-plan)   block.plan_hash
     Planned inject ─────────► Inject content and time    link.source_hash, link.at
     Role ───────────────────► Actor                      actor.scenario_link
     Actor ──────────────────► Injects it sends           link.actor_hash
     Cell ───────────────────► Injects it receives        link.cell_hash

   Rules shared by every view:
     - The phase of an inject is its linked phase when it is on the main track,
       otherwise the phase at its time.
     - Written injects are numbered #01..#NN in play order (time, then creation);
       planned injects have no number until they are written. Once the run starts
       the numbers are frozen; an inject added later takes the next free number.
     - Two statuses, never mixed: `run` (planned / draft / ready / sent: the pilot's
       view) and `sync` (in sync, outdated, time changed, orphan, locked, manual edit,
       unlinked: the designer's view).
     - The sender shown is the actor who signs a written inject, else the role of the
       planned inject; the recipient is the inject's cell, else the planned cell.
   ═══════════════════════════════════════════════════════════════════════════════ */

const ExerciseModel = {
  DEPENDENCIES: [
    { from: 'phase.what_happens', to: 'planned_injects', tracked_by: 'block.plan_hash', update: 're-plan with AI' },
    { from: 'planned_inject', to: 'inject', tracked_by: 'scenario_link.source_hash, scenario_link.at', update: 'rewrite, retime, create or remove' },
    { from: 'role', to: 'actor', tracked_by: 'actor.scenario_link.source_hash', update: 'update the actor' },
    { from: 'actor', to: 'inject', tracked_by: 'scenario_link.actor_hash', update: 'adapt the content' },
    { from: 'cell', to: 'inject', tracked_by: 'scenario_link.cell_hash', update: 'adapt the content' }
  ],

  /* The whole exercise, computed once per render pass (or fresh outside one). */
  of(project = appState.scenario) {
    if (typeof sbRenderMemo !== 'undefined' && sbRenderMemo) {
      sbRenderMemo.exerciseModels = sbRenderMemo.exerciseModels || new Map();
      if (!sbRenderMemo.exerciseModels.has(project)) sbRenderMemo.exerciseModels.set(project, this.build(project));
      return sbRenderMemo.exerciseModels.get(project);
    }
    return this.build(project);
  },

  build(project) {
    const storyboard = project.storyboard || null;
    const phases = storyboard ? sbMainBlocks(storyboard) : [];
    const numbers = this.numbers(project);
    const total = numbers.size;
    const top = this.numberTop(numbers);
    // Sync statuses cost hashing: computed only when a view reads inject.sync.
    const injects = (storyboard ? sbExerciseItems(project, { status: false }) : this.stimuliOnly(project)).map((item) => {
      const stimulus = item.stimulus || null;
      const phase = stimulus ? this.phaseOfStimulus(project, stimulus) : this.phaseOfPlanned(project, item.block, item.time);
      const cell = this.cellById(project, stimulus?.cell_id || item.cell_id);
      const actor = stimulus ? (project.actors || []).find((entry) => entry.id === stimulus.actor_id) || null : null;
      const number = stimulus ? numbers.get(stimulus.id) || null : null;
      const inject = {
        key: item.key,
        stimulus, beat: item.beat || null, block: item.block || null,
        phase, phase_id: phase?.id || '',
        time: item.time,
        cell, cell_id: cell?.id || '',
        actor, role: item.beat && storyboard ? sbCastLabel(storyboard, item.beat.cast_id) : '',
        sender: actor?.name || (item.beat && storyboard ? sbCastLabel(storyboard, item.beat.cast_id) : '') || item.sender || '',
        channel: stimulus?.channel || item.channel,
        title: item.title, intent: item.intent,
        run: this.runStatus(stimulus),
        number, numberLabel: number ? this.numberLabel(number, top) : ''
      };
      let sync;
      Object.defineProperty(inject, 'sync', {
        enumerable: true,
        get() {
          if (sync === undefined) sync = !stimulus ? 'planned' : !sbStimulusLink(stimulus) ? 'unlinked' : (storyboard ? sbStimulusStatus(project, stimulus)?.key : null) || 'unlinked';
          return sync;
        }
      });
      return inject;
    });
    return {
      project, storyboard, phases,
      cells: project.cells || [], actors: project.actors || [], roles: storyboard?.cast || [],
      injects, total,
      written: injects.filter((inject) => inject.stimulus),
      planned: injects.filter((inject) => !inject.stimulus),
      byStimulus: new Map(injects.filter((inject) => inject.stimulus).map((inject) => [inject.stimulus.id, inject]))
    };
  },

  /* Projects without a storyboard (older files): the written injects only. */
  stimuliOnly(project) {
    return [...(project.stimuli || [])].sort((a, b) => a.timestamp_offset_minutes - b.timestamp_offset_minutes).map((stimulus) => ({
      key: `stim:${stimulus.id}`, kind: 'stimulus', block: null, beat: null, stimulus, time: stimulus.timestamp_offset_minutes,
      cell_id: stimulus.cell_id || '', channel: stimulus.channel, title: typeof sbStimulusLabel === 'function' ? sbStimulusLabel(stimulus) : stimulus.name || '',
      intent: stimulus.generation_prompt || '', sender: '', status: 'manual'
    }));
  },

  // ── Phases ──────────────────────────────────────────────────────────────────
  /* The main-storyline phase at a time. strict: only a phase that covers it. */
  phaseAt(project, minute, { strict = false } = {}) {
    const storyboard = project.storyboard;
    if (!storyboard) return null;
    if (strict) return sbMainBlocks(storyboard).find((block) => minute >= block.start_minutes && minute < sbBlockEnd(block)) || null;
    return sbMainBlockAt(storyboard, minute) || null;
  },
  isMainPhase(project, block) {
    return !!(block && project.storyboard && sbTrack(project.storyboard, block.track_id)?.kind === 'main');
  },
  /* A written inject: its linked phase when on the main track, else the phase at its time. */
  phaseOfStimulus(project, stimulus) {
    const storyboard = project.storyboard;
    if (!storyboard || !stimulus) return null;
    const blockId = sbStimulusLink(stimulus)?.block_id;
    const linked = blockId ? sbBlock(storyboard, blockId) : null;
    return this.isMainPhase(project, linked) ? linked : this.phaseAt(project, stimulus.timestamp_offset_minutes);
  },
  phaseOfPlanned(project, block, minute) {
    return this.isMainPhase(project, block) ? block : this.phaseAt(project, minute);
  },

  // ── Numbers and statuses ────────────────────────────────────────────────────
  /* #01..#NN for written injects in play order; shared by Play, the ZIP and the chronogram.
     Frozen once the run starts (play.numbers): an inject added later takes the next free
     number, so the log and the printed stimuli keep matching. */
  numbers(project = appState.scenario) {
    const sorted = project === appState.scenario && typeof getSortedStimuli === 'function'
      ? getSortedStimuli()
      : [...(project.stimuli || [])].sort((a, b) => a.timestamp_offset_minutes - b.timestamp_offset_minutes);
    const frozen = project.play?.numbers && typeof project.play.numbers === 'object' ? project.play.numbers : null;
    if (!frozen) return new Map(sorted.map((stimulus, index) => [stimulus.id, index + 1]));
    const valid = (value) => Number.isInteger(value) && value > 0;
    // Numbers of deleted injects are never given again.
    let max = Math.max(0, ...Object.values(frozen).filter(valid));
    const numbers = new Map();
    for (const stimulus of sorted) if (valid(frozen[stimulus.id])) numbers.set(stimulus.id, frozen[stimulus.id]);
    for (const stimulus of sorted) if (!numbers.has(stimulus.id)) numbers.set(stimulus.id, ++max);
    return numbers;
  },
  /* The highest number, for the label width (#01 or #001). */
  numberTop(numbers) {
    return Math.max(numbers.size, 0, ...numbers.values());
  },
  numberLabel(number, total) {
    return `#${String(number).padStart(Math.max(2, String(total).length), '0')}`;
  },
  runStatus(stimulus) {
    if (!stimulus) return 'planned';
    return ['draft', 'ready', 'sent'].includes(stimulus.status) ? stimulus.status : 'draft';
  },

  cell(project, stimulus) {
    return this.cellById(project, stimulus?.cell_id);
  },

  /* A cell, or "All cells" for an inject every cell receives (a main stimulus). */
  cellById(project, id) {
    if (sbIsAllCells(id)) return { id: SB_ALL_CELLS, name: 'All cells', color: '#451dc7', description: '', players: [] };
    // Several cells: one entry naming them all, in the colour of the first.
    const ids = sbRecipientIds(id);
    if (ids.length > 1) {
      const cells = ids.map((cellId) => sbCell(project, cellId)).filter(Boolean);
      if (cells.length) return { id, name: cells.map((cell) => cell.name).join(' + '), color: cells[0].color, description: '', players: cells.flatMap((cell) => cell.players || []) };
    }
    return sbCell(project, id) || null;
  }
};
