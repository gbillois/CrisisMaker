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
}
function agentNormalizeResponse(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch (_) { throw new AgentValidationError('Response must be strict JSON.'); }
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
function agentFailureMessage(error) {
  if (error instanceof AgentValidationError) return error.message;
  if (error?.code === 'timeout') return 'The AI took too long to answer. Ask for a smaller change, for example one inject at a time.';
  if (agentTruncated(error)) return 'The AI reply was cut off at its length limit. Ask for a smaller change, for example one inject at a time.';
  if (error instanceof SyntaxError) return 'The AI reply was not valid JSON. Retry, or choose a more capable model in Settings.';
  const reason = agentProviderReason(error);
  if (error?.status) return `The AI provider refused the request (HTTP ${error.status})${reason ? `: ${reason}` : '.'} Completed edits are recoverable with Undo.`;
  if (/failed to fetch|network|load failed/i.test(reason)) return 'The AI provider could not be reached (network or connection settings). Completed edits are recoverable with Undo.';
  return `AI request or tool failed${reason ? `: ${reason}` : '.'} Check the AI connection settings and retry. Completed edits are recoverable with Undo.`;
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
  async start({ kind = this.kind, mode = this.mode, objective = this.objective } = {}) {
    if (this.active || this.busy) return;
    if (!AGENT_KINDS.includes(kind) || !['assist', 'agent', 'auto'].includes(mode) || typeof objective !== 'string' || !objective.trim() || objective.length > 8000) throw new AgentValidationError('Enter an objective of 1–8000 characters and select a valid mode.');
    if (appState.ui.generatingField || Object.values(appState.llmState).some(state => state?.loading) || appState.checkerState.analysisLoading || (typeof SbPipeline !== 'undefined' && SbPipeline.active) || (typeof SbAI !== 'undefined' && SbAI.busy)) throw new AgentValidationError('Wait for the current AI operation to finish before starting an agent.');
    this.kind = kind; this.mode = mode; this.objective = objective;
    this.status = 'running'; this.busy = true; this.controller = new AbortController(); this.project = appState.scenario;
    this.step = 0; this.log = []; this.history = []; this.answers = []; this.changed = 0; this.pending = null; this.question = null; this.questionRounds = 0; this.final = null;
    this.checkpointRun();
    AgentLog.append(this, 'info', 'Analyzing current exercise. A pre-run checkpoint is available.');
    const runController = this.controller, runProject = this.project;
    const execution = { controller: runController, assertActive: () => {
      if (runController.signal.aborted || runProject !== appState.scenario) throw new DOMException('Stopped', 'AbortError');
    } };
    const calls = new Map(); let invalidCount = 0;
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
            recent = this.history.map(entry => entry.result === undefined ? entry : { ...entry, result: agentExcerpt(entry.result, 2500) });
            input = build(recent);
            while (input.length + system.length > 100000 && recent.length) { recent = recent.slice(1); input = build(recent); }
            if (input.length + system.length > 100000) throw new AgentValidationError('The exercise is too large for one agent step. Narrow the objective to a phase or a cell.');
          }
          call = agentNormalizeResponse(await agentAwait(this.request(system, input, this.controller.signal), this.controller.signal));
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
          if (tool.risk !== 'read') { this.changed++; appState.checkerState.analysisResult = null; saveLocal(false); }
          this.remember(call, result); invalidCount = 0;
          AgentLog.append(this, 'success', `${call.tool}: ${tool.risk === 'read' ? 'reviewed' : 'applied'}`, result);
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
