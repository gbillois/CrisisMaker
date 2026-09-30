const AGENT_MAX_STEPS = 40;
const AGENT_MAX_QUESTION_ROUNDS = 2;
const AGENT_KINDS = ['assistant', 'builder', 'designer', 'reviewer'];
const AGENT_CHECKPOINT_KEY = 'crisismaker_agent_checkpoint_v1';
const AgentLog = {
  append(run, kind, message, detail) {
    run.log.push({ step: run.step, kind, message: agentExcerpt(message, 1600), detail: detail === undefined ? '' : agentExcerpt(detail, 16000) });
    if (run.log.length > 160) run.log.shift();
    run.notify();
  }
};
/* What stage 1 of the Build flow must leave in place before its final answer. */
function agentFramingGaps(project) {
  const gaps = [];
  const main = sbMainBlocks(project.storyboard);
  const cellsOnly = typeof BuildFlow !== 'undefined' && BuildFlow.only?.phases === false;
  if (!main.length && !cellsOnly) return ['no phase in the main storyline (buildMainStoryline or setPhases)'];
  const fromSource = typeof bfSourceDefinesPhases === 'function' && bfSourceDefinesPhases();
  const empty = main.filter(block => !(block.events || []).length && !(fromSource && block.beats.length));
  if (empty.length) gaps.push(`no main events in ${empty.map(block => `"${block.title}" (${block.id})`).join(', ')} (setMainEvents)`);
  // The phases of a source file are kept as they are, without an added closing phase.
  if (!fromSource && !sbEndsWithClosing(project.storyboard)) gaps.push('the last phase is not a closing phase');
  if (!project.cells.some(cell => cell.players.length)) gaps.push('no player in the cells (upsertCells)');
  if (!project.storyboard.cast.length) gaps.push('no cast role (upsertCast)');
  // A framing asked for the cells only, or the phases only, is checked on that part only.
  const only = typeof BuildFlow !== 'undefined' ? BuildFlow.only : null;
  if (only?.cells === false) return gaps.filter(gap => !/cells|cast/.test(gap));
  if (only?.phases === false) return gaps.filter(gap => /cells|cast/.test(gap));
  return gaps;
}

function agentSnapshot() {
  const { settings, ...exercise } = appState.scenario;
  return deepClone(exercise);
}
function agentRestore(snapshot) {
  const settings = appState.scenario.settings;
  // Keep the object identity so in-flight run guards remain reliable.
  for (const key of Object.keys(appState.scenario)) if (key !== 'settings') delete appState.scenario[key];
  Object.assign(appState.scenario, deepClone(snapshot), { settings });
  appState.selectedStimulusId = appState.scenario.stimuli[0]?.id || null;
  appState.stimulusModalId = null;
  appState.historyModalStimulusId = null;
  appState.checkerState.analysisResult = null;
  appState.checkerState.challengeRestoredFor = null;
}
function agentNormalizeResponse(value, registry = null) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (_) { throw new AgentValidationError('Response must be strict JSON.'); }
  }
  // Harmless slips of a model, fixed before the strict check (the tool's own schema still checks
  // every argument): a tool argument written next to "arguments", other names for "arguments",
  // a reason or summary too long, a final answer without its lists, a single question as text.
  // Several calls in one reply (an array, or a list under "tool_calls"): the first one runs, the next ones come in later steps.
  if (Array.isArray(value) && value[0] && typeof value[0] === 'object') value = value[0];
  const batch = value && typeof value === 'object' && !value.type && [value.tool_calls, value.calls].find((list) => Array.isArray(list) && list[0] && typeof list[0] === 'object');
  if (batch) value = { type: 'tool_call', ...batch[0] };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    value = { ...value };
    if (typeof value.tool !== 'string' && typeof value.name === 'string' && (value.type === 'tool_call' || value.arguments)) { value.tool = value.name; delete value.name; }
    // A reply without its "type", or with another name for it (seen with GPT and Claude models): inferred from its keys.
    if (!['tool_call', 'question', 'final'].includes(value.type)) {
      // Only the keys of that kind of reply: tool arguments picked out of a cut reply are never read as a final answer.
      const only = (keys) => Object.keys(value).every((key) => key === 'type' || keys.includes(key));
      const inferred = typeof value.tool === 'string' ? 'tool_call'
        : value.questions !== undefined && only(['questions', 'reason']) ? 'question'
        : typeof value.summary === 'string' && only(['summary', 'issues', 'changes']) ? 'final' : '';
      if (!inferred) throw new AgentValidationError('Invalid response: "type" must be "tool_call", "question" or "final".');
      value.type = inferred;
    }
    const clip = (text, max) => (typeof text === 'string' && text.length > max ? `${text.slice(0, max - 1)}…` : text);
    if (value.type === 'tool_call') {
      if (!value.arguments || typeof value.arguments !== 'object') {
        const alias = ['args', 'parameters', 'input'].find((key) => value[key] && typeof value[key] === 'object' && !Array.isArray(value[key]));
        value.arguments = alias ? value[alias] : {};
        if (alias) delete value[alias];
      }
      value.arguments = { ...value.arguments };
      // Only an argument the tool declares moves; anything else stays and is refused below.
      const declared = registry?.get?.(value.tool)?.inputSchema?.properties || {};
      const empty = (item) => item === '' || item === null || (typeof item === 'object' && !Object.keys(item).length);
      for (const key of Object.keys(value)) {
        if (['type', 'tool', 'arguments', 'reason'].includes(key)) continue;
        // A stray empty key (GLM writes "id": "" next to "arguments"), or a copy of an argument
        // already given, carries nothing: it is dropped.
        if (empty(value[key]) || (key in value.arguments && JSON.stringify(value[key]) === JSON.stringify(value.arguments[key]))) { delete value[key]; continue; }
        if (!Object.prototype.hasOwnProperty.call(declared, key) || key in value.arguments) continue;
        value.arguments[key] = value[key];
        delete value[key];
      }
      // Main events carry only their time and text: other keys a model adds are dropped.
      if (value.tool === 'setMainEvents' && Array.isArray(value.arguments.events)) {
        value.arguments.events = value.arguments.events.map((event) => event && typeof event === 'object' && !Array.isArray(event)
          ? Object.fromEntries(Object.entries(event).filter(([key]) => ['at', 'exercise_minute', 'text'].includes(key)))
          : event);
      }
      if (value.reason !== undefined) value.reason = clip(value.reason, 500);
    } else if (value.type === 'final') {
      if (typeof value.summary !== 'string') value.summary = typeof value.message === 'string' ? value.message : typeof value.answer === 'string' ? value.answer : '';
      delete value.message; delete value.answer;
      value.summary = clip(value.summary, 5000);
      for (const key of ['issues', 'changes']) value[key] = (Array.isArray(value[key]) ? value[key] : value[key] ? [value[key]] : []).map((item) => clip(typeof item === 'string' ? item : JSON.stringify(item), 1500));
    } else if (value.type === 'question') {
      if (typeof value.questions === 'string') value.questions = [value.questions];
      if (Array.isArray(value.questions)) value.questions = value.questions.map((item) => clip(String(item), 600)).slice(0, 5);
      if (value.reason !== undefined) value.reason = clip(value.reason, 500);
    }
  }
  const S = AgentSchema;
  const schema = value?.type === 'tool_call'
    ? S.object({ type: { ...S.text(), enum: ['tool_call'] }, tool: S.id, arguments: { type: 'object', additionalProperties: { type: 'json' } }, reason: S.text(500) }, ['type', 'tool', 'arguments'])
    : value?.type === 'question'
    ? S.object({ type: { ...S.text(), enum: ['question'] }, questions: { ...S.array(S.text(600), 5), minItems: 1 }, reason: S.text(500) }, ['type', 'questions'])
    : S.object({ type: { ...S.text(), enum: ['final'] }, summary: S.text(5000), issues: S.array(S.text(1500)), changes: S.array(S.text(1500)) }, ['type', 'summary', 'issues', 'changes']);
  ToolValidator.validate(value, schema, 'response');
  return value;
}
/* A reply cut at the token limit, or an answer that took too long: the agent retries
   with a smaller step. */
const AGENT_STEP_TIMEOUT = 240000;
function agentTruncated(error) {
  return error?.code === 'truncated' || error?.code === 'timeout';
}
/* The provider's own reason (rate limit, model, quota…), without secrets or links. */
function agentProviderReason(error) {
  const text = agentRedact(String(error?.message || '')).replace(/https?:\/\/\S+/g, '[link]').replace(/\b(sk|pk|rk|key|Bearer)[-_ ][A-Za-z0-9._-]{8,}/g, '[REDACTED]').replace(/\s+/g, ' ').trim();
  return text.length > 280 ? `${text.slice(0, 279)}…` : text;
}
/* Who answered: provider, model and the provider's error code, to investigate (Settings →
   Technical log has the full trace). */
function agentFailureSource(error) {
  const parts = [[error?.provider, error?.model].filter(Boolean).join(' / '), error?.code && !['timeout', 'truncated'].includes(error.code) ? `code ${error.code}` : ''].filter(Boolean);
  return parts.length ? ` [${agentRedact(parts.join(', '))}]` : '';
}
function agentFailureMessage(error) {
  return agentFailureText(error) + (error instanceof AgentValidationError ? '' : `${agentFailureSource(error)} Details in Settings → Technical log.`);
}
function agentFailureText(error) {
  if (error instanceof AgentValidationError) return error.message;
  if (error?.code === 'timeout') return 'The AI took too long to answer. Ask for a smaller change, for example one inject at a time.';
  if (agentTruncated(error)) return 'The AI reply was cut off at its length limit. Ask for a smaller change, for example one inject at a time.';
  if (error instanceof SyntaxError) return 'The AI reply was not valid JSON. Retry, or choose a more capable model in Settings.';
  const reason = agentProviderReason(error);
  if (error?.code === 'invalid_body') return 'The AI provider sent an unreadable or cut reply (connection reset?), even after retries. Retry in a moment. Completed edits are recoverable with Undo.';
  if (error?.status) return `The AI provider refused the request (HTTP ${error.status})${reason ? `: ${reason}` : '.'} Completed edits are recoverable with Undo.`;
  if (/failed to fetch|network|load failed/i.test(reason)) return 'The AI provider could not be reached (network or connection settings). Completed edits are recoverable with Undo.';
  return `AI request or tool failed${reason ? `: ${reason}` : '.'} Check the AI connection settings and retry. Completed edits are recoverable with Undo.`;
}
/* An AI call with a time limit that also cancels the request itself: start() receives a
   signal of its own, aborted with the caller's, on the time limit, and once settled. */
async function agentCall(start, signal, timeoutMs = AGENT_STEP_TIMEOUT) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal) { if (signal.aborted) controller.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  try {
    return await agentAwait(start(controller.signal), signal || controller.signal, timeoutMs);
  } finally {
    controller.abort();
    signal?.removeEventListener?.('abort', onAbort);
  }
}
function agentAwait(promise, signal, timeoutMs = AGENT_STEP_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const abort = () => finish(reject, new DOMException('Stopped', 'AbortError'));
    const timer = setTimeout(() => finish(reject, Object.assign(new Error('The AI took too long to answer.'), { code: 'timeout' })), timeoutMs);
    const finish = (settle, result) => { clearTimeout(timer); signal.removeEventListener('abort', abort); settle(result); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
  });
}
class AgentRunner {
  constructor({ request, notify, maxSteps = AGENT_MAX_STEPS } = {}) {
    this.request = request || ((system, user, signal) => AITextGenerator.generate('agent', system, user, true, 8000, { signal, strictJSON: true }));
    // Re-render wherever the agent is visible: its console, an embedded panel or the assistant.
    this.notify = notify || (() => { if (appState.route === 'agent' || (typeof document !== 'undefined' && document.querySelector('[data-agent-live]')) || (!this.active && !this.busy)) App.render(); });
    this.maxSteps = Math.max(1, Math.min(AGENT_MAX_STEPS, maxSteps));
    this.registry = createAgentToolRegistry();
    this.status = 'idle'; this.step = 0; this.log = []; this.history = []; this.pending = null; this.checkpoint = null;
    this.kind = 'designer'; this.mode = 'agent'; this.objective = ''; this.changed = 0;
  }
  get active() { return ['running', 'approval', 'question'].includes(this.status); }
  assertActive() {
    if (this.controller.signal.aborted || this.project !== appState.scenario) throw new DOMException('Stopped', 'AbortError');
  }
  stop() {
    if (!this.active) return;
    this.controller.abort();
    this.resolveApproval?.(false); this.resolveApproval = null; this.pending = null;
    this.resolveAnswer?.(null); this.resolveAnswer = null; this.question = null;
    this.status = 'stopped'; AgentLog.append(this, 'warning', 'Stopped. Completed edits remain; Undo restores the checkpoint.');
  }
  approve(allowed) {
    if (!this.pending || !this.resolveApproval) return;
    const resolve = this.resolveApproval; this.resolveApproval = null; this.pending = null; this.status = 'running'; resolve(allowed); this.notify();
  }
  /* The agent asked the user questions; resolves with the answers, or null when skipped. */
  answer(text) {
    if (!this.question || !this.resolveAnswer) return;
    const resolve = this.resolveAnswer; this.resolveAnswer = null; this.question = null; this.status = 'running';
    resolve(typeof text === 'string' && text.trim() ? text.trim().slice(0, 6000) : null); this.notify();
  }
  async ask(call) {
    this.status = 'question';
    this.question = { questions: call.questions, reason: call.reason || '' };
    const answered = new Promise(resolve => { this.resolveAnswer = resolve; });
    AgentLog.append(this, 'warning', 'Question for you', call.questions);
    const answers = await answered; this.assertActive(); return answers;
  }
  async approval(call) {
    this.status = 'approval';
    this.pending = { ...call, before: call.arguments.id && getStimulus(call.arguments.id) ? agentStimulus(getStimulus(call.arguments.id), true) : AgentContext.build() };
    const decision = new Promise(resolve => { this.resolveApproval = resolve; });
    AgentLog.append(this, 'warning', `Approval required: ${call.tool}`, call.arguments);
    const allowed = await decision; this.assertActive(); return allowed;
  }
  remember(call, result) {
    this.history.push({ tool: call.tool, arguments: agentExcerpt(call.arguments, 1800), result: agentExcerpt(result, 9000) });
    this.history = this.history.slice(-8);
  }
  checkpointRun() {
    this.checkpoint = agentSnapshot();
    this.videoCheckpoint = { ...appState.videoFiles }; this.audioCheckpoint = { ...appState.audioFiles };
    try {
      localStorage.setItem(AGENT_CHECKPOINT_KEY, JSON.stringify({ projectId: this.project.id, exercise: this.checkpoint }));
    } catch (_) {
      // Do not leave a stale checkpoint from an earlier run available after reload.
      try { localStorage.removeItem(AGENT_CHECKPOINT_KEY); } catch (_) { /* Storage disabled. */ }
      AgentLog.append(this, 'warning', 'Checkpoint is available in this tab only; browser storage is unavailable or full.');
    }
  }
  /* scope 'framing': stage 1 of the Build flow, phases and main events without injects. */
  async start({ kind = this.kind, mode = this.mode, objective = this.objective, scope = '' } = {}) {
    if (this.active || this.busy) return;
    if (!AGENT_KINDS.includes(kind) || !['assist', 'agent', 'auto'].includes(mode) || typeof objective !== 'string' || !objective.trim() || objective.length > 8000) throw new AgentValidationError('Enter an objective of 1–8000 characters and select a valid mode.');
    if (appState.ui.generatingField || Object.values(appState.llmState).some(state => state?.loading) || appState.checkerState.analysisLoading || (typeof SbPipeline !== 'undefined' && SbPipeline.active) || (typeof SbAI !== 'undefined' && SbAI.busy)) throw new AgentValidationError('Wait for the current AI operation to finish before starting an agent.');
    this.kind = kind; this.mode = mode; this.objective = objective; this.scope = scope === 'framing' ? 'framing' : '';
    this.status = 'running'; this.busy = true; this.controller = new AbortController(); this.project = appState.scenario;
    this.step = 0; this.log = []; this.history = []; this.answers = []; this.changed = 0; this.pending = null; this.question = null; this.questionRounds = 0; this.final = null;
    this.checkpointRun();
    AgentLog.append(this, 'info', 'Analyzing current exercise. A pre-run checkpoint is available.');
    const runController = this.controller, runProject = this.project;
    const execution = { controller: runController, assertActive: () => {
      if (runController.signal.aborted || runProject !== appState.scenario) throw new DOMException('Stopped', 'AbortError');
    } };
    const calls = new Map(); let invalidCount = 0, refusedFinals = 0; let readStreak = 0;
    const catalog = [...this.registry.values()].map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
    const system = AgentPrompts.protocol + '\n' + AgentPrompts[kind] + '\nTools:\n' + JSON.stringify(catalog);
    try {
      for (this.step = 1; this.step <= this.maxSteps; this.step++) {
        this.assertActive(); this.notify();
        let call;
        try {
          // Bound the whole prompt without ever sending invalid, sliced JSON: shorten, then drop,
          // the oldest tool results. The user's answers are kept for the whole run.
          const state = AgentContext.build();
          const build = (recent) => agentRedact({ objective, mode, step: this.step, remainingSteps: this.maxSteps - this.step, state, userAnswers: this.answers.length ? this.answers : undefined, recentResults: recent });
          let recent = this.history, input = build(recent);
          if (input.length + system.length > 100000) {
            // Older results are shortened first: the latest one, which the next step relies on, stays whole if it fits.
            const shorten = (entry, limit) => entry.result === undefined ? entry : { ...entry, result: agentExcerpt(entry.result, limit) };
            recent = this.history.map((entry, index) => index === this.history.length - 1 ? entry : shorten(entry, 2500));
            input = build(recent);
            if (input.length + system.length > 100000) { recent = recent.map((entry, index) => index === recent.length - 1 ? shorten(entry, 12000) : entry); input = build(recent); }
            while (input.length + system.length > 100000 && recent.length) { recent = recent.slice(1); input = build(recent); }
            if (input.length + system.length > 100000) throw new AgentValidationError('The exercise is too large for one agent step. Narrow the objective to a phase or a cell.');
          }
          call = agentNormalizeResponse(await agentCall((signal) => this.request(system, input, signal), this.controller.signal), this.registry);
          this.assertActive();
          if (call.type === 'question') {
            if (this.questionRounds >= AGENT_MAX_QUESTION_ROUNDS) {
              this.history.push({ questions: call.questions, instruction: 'No more questions: proceed with clearly disclosed assumptions.' }); this.history = this.history.slice(-8);
              continue;
            }
            this.questionRounds++;
            const answers = await this.ask(call);
            // Answers stay in every later step (not in the rolling history of tool results).
            this.answers.push(answers ? { questions: call.questions, answers } : { questions: call.questions, answers: null, instruction: 'The user skipped these questions. Proceed with clearly disclosed reasonable assumptions.' });
            AgentLog.append(this, 'info', answers ? 'Answers sent to the agent.' : 'Questions skipped: the agent will make assumptions.', answers || '');
            continue;
          }
          // A build or a fix that ends before changing anything (DeepSeek may "review" and stop at
          // step 1) is sent back once to do the work.
          // A framing is checked below, with what it misses.
          if (call.type === 'final' && !this.changed && ['builder', 'reviewer'].includes(kind) && this.scope !== 'framing' && !calls.has('final-without-change')) {
            calls.set('final-without-change', 1);
            this.history.push({ final: call.summary.slice(0, 600), instruction: 'Nothing has been changed yet: the objective asks you to change the exercise. Call the write tools now (read tools first if needed); give the final answer only once the work is applied.' }); this.history = this.history.slice(-8);
            AgentLog.append(this, 'warning', 'The agent ended before changing anything: asked to do the work.');
            continue;
          }
          // Stage 1 ends with a complete framing: a model that stops before (GPT-6 and DeepSeek may
          // skip the main events, or stop before building the phases) is sent back, twice at most.
          const gaps = call.type === 'final' && this.scope === 'framing' && refusedFinals < 2 ? agentFramingGaps(appState.scenario) : [];
          if (gaps.length) {
            refusedFinals++;
            const unbuilt = !sbMainBlocks(appState.scenario.storyboard).length;
            const instruction = unbuilt
              ? 'The framing is not built yet: the storyboard has no phase. Do not stop: build the phases and main events now (buildMainStoryline), then the cells and the cast, and only then give the final answer.'
              : `The framing is not complete: ${gaps.join('; ')}. Do not stop: fix these with the tools, then give the final answer.`;
            this.history.push({ finalRefused: call.summary.slice(0, 600), instruction }); this.history = this.history.slice(-8);
            AgentLog.append(this, 'warning', unbuilt ? 'The agent stopped before building the phases: asked to continue.' : `The framing is not complete: ${gaps.join('; ')}. Asked to finish it.`);
            continue;
          }
          if (call.type === 'final') {
            this.final = { summary: call.summary, issues: call.issues, changes: call.changes };
            this.status = 'complete'; AgentLog.append(this, 'success', call.summary, { issues: call.issues, reportedChanges: call.changes, appliedOperations: this.changed }); return;
          }
          const tool = this.registry.get(call.tool);
          if (!tool) throw new AgentValidationError('Unknown tool. Choose a listed tool.');
          ToolValidator.validate(call.arguments, tool.inputSchema);
          // The same call again with no change in between is a loop; after an edit it is a re-check.
          const signature = JSON.stringify([call.tool, call.arguments, this.changed]);
          calls.set(signature, (calls.get(signature) || 0) + 1);
          // A model that keeps re-reading (DeepSeek v4 pro reads the storyboard again and again)
          // is told once to act on what it has; a loop after that stops the run.
          if (calls.get(signature) > 3 && tool.risk === 'read' && !calls.has('read-loop')) {
            calls.set('read-loop', 1);
            this.history.push({ tool: call.tool, instruction: `You already read ${call.tool} with these arguments and nothing changed since: its result is above. Do not read it again; make the changes now with the write tools, or give the final answer.` }); this.history = this.history.slice(-8);
            AgentLog.append(this, 'warning', `Repeated read of ${call.tool}: asked to act on it.`);
            continue;
          }
          if (calls.get(signature) > 3) { this.status = 'limit'; AgentLog.append(this, 'warning', 'Repeated tool loop detected. Stopped for review.'); return; }
          const needsApproval = tool.risk === 'destructive' || (tool.risk !== 'read' && mode === 'assist') || (tool.risk === 'broad' && mode === 'agent');
          if (needsApproval && !await this.approval(call)) {
            this.remember(call, { rejected: true, instruction: 'User declined. Do not attempt this change again.' });
            AgentLog.append(this, 'warning', `Declined: ${call.tool}`); continue;
          }
          this.assertActive();
          // Validate again after an approval pause.
          ToolValidator.validate(call.arguments, tool.inputSchema);
          AgentLog.append(this, 'action', `${call.tool}${call.reason ? ': ' + call.reason : ''}`, call.arguments);
          const before = tool.risk !== 'read' ? agentSnapshot() : null;
          let result;
          try { result = await agentAwait(tool.execute(call.arguments, execution), this.controller.signal); }
          catch (error) {
            if (before && this.project === appState.scenario && !this.controller.signal.aborted) { agentRestore(before); saveLocal(false); }
            throw error;
          }
          this.assertActive();
          if (tool.risk !== 'read') { this.changed++; appState.checkerState.analysisResult = null; delete appState.scenario.challenge; saveLocal(false); }
          this.remember(call, result); invalidCount = 0;
          AgentLog.append(this, 'success', `${call.tool}: ${tool.risk === 'read' ? 'reviewed' : 'applied'}`, result);
          // A framing run that keeps reading (DeepSeek flash re-reads the storyboard and the frame
          // between every change) is told, after three reads in a row, what is still missing.
          readStreak = tool.risk === 'read' ? readStreak + 1 : 0;
          if (readStreak >= 3 && this.scope === 'framing') {
            const gaps = agentFramingGaps(appState.scenario);
            readStreak = 0;
            if (gaps.length) {
              this.history.push({ instruction: `Stop reading: the current state is in your context and in the results above. Still missing for the framing: ${gaps.join('; ')}. Make these changes now with the write tools, one per step.` }); this.history = this.history.slice(-8);
              AgentLog.append(this, 'warning', `Reading again and again: asked to fill what is missing (${gaps.join('; ')}).`);
            }
          }
        } catch (error) {
          this.assertActive();
          if (!(error instanceof AgentValidationError || error instanceof SyntaxError || agentTruncated(error))) throw error;
          const message = agentFailureMessage(error);
          const instruction = agentTruncated(error)
            ? 'Your last reply, or the content a tool generated, was cut off or took too long. Take a smaller step: one tool call on one inject, with fewer or shorter fields.'
            : 'Correct your JSON/tool arguments; use the exact schema. Reply with exactly ONE JSON object per step: one tool call, the next ones come in later steps.';
          this.history.push({ error: message, instruction }); this.history = this.history.slice(-8);
          AgentLog.append(this, 'warning', message);
          if (++invalidCount >= 3) throw error;
        }
      }
      this.step = this.maxSteps; this.status = 'limit'; AgentLog.append(this, 'warning', 'Maximum steps reached. Review completed edits and remaining work.');
    } catch (error) {
      if (this.controller.signal.aborted || this.project !== appState.scenario) { this.status = 'stopped'; }
      else { this.controller.abort(); this.status = 'failed'; AgentLog.append(this, 'error', agentFailureMessage(error)); }
    } finally {
      this.busy = false; this.pending = null; this.resolveApproval = null; this.question = null; this.resolveAnswer = null; this.notify();
    }
  }
  loadCheckpoint() {
    try {
      const saved = JSON.parse(localStorage.getItem(AGENT_CHECKPOINT_KEY) || 'null');
      if (saved?.projectId === appState.scenario.id && saved.exercise?.id === saved.projectId && Array.isArray(saved.exercise.actors) && Array.isArray(saved.exercise.stimuli)) this.checkpoint = saved.exercise;
    } catch (_) { /* Missing/unavailable storage never prevents running. */ }
  }
  undo() {
    if (this.active || this.busy || !this.checkpoint || this.checkpoint.id !== appState.scenario.id) return false;
    agentRestore(this.checkpoint);
    appState.videoFiles = this.videoCheckpoint || makeDefaultVideoFiles(appState.scenario);
    appState.audioFiles = this.audioCheckpoint || {};
    this.checkpoint = null;
    try { localStorage.removeItem(AGENT_CHECKPOINT_KEY); } catch (_) { /* In-memory undo still succeeds. */ }
    saveLocal(false); AgentLog.append(this, 'success', 'Restored the exercise from immediately before the agent run.'); App.render(); return true;
  }
}
let crisisAgentRunner;
function getCrisisAgent() {
  if (!crisisAgentRunner) { crisisAgentRunner = new AgentRunner(); crisisAgentRunner.loadCheckpoint(); }
  return crisisAgentRunner;
}
