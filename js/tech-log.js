/* Technical log: the last AI calls and errors, to investigate a failure (Settings → Technical log).
   In memory only (lost on reload), never the prompts themselves: sizes, provider, model, host,
   status, stop reason, duration, attempt, and the start of the raw reply or error, with every
   API key, token and key parameter masked. */
const CrisisTechLog = {
  entries: [],
  max: 300,
  seq: 0,

  /* Masks secrets: the configured keys, bearer tokens, provider key shapes, ?key= parameters. */
  redact(value) {
    let text = String(value ?? '');
    const settings = typeof appState !== 'undefined' ? appState?.scenario?.settings || {} : {};
    for (const [name, secret] of Object.entries(settings)) {
      if (/(key|token|secret)$/i.test(name) && typeof secret === 'string' && secret.trim().length >= 6) text = text.split(secret.trim()).join('[redacted]');
    }
    return text
      .replace(/Bearer\s+[\w.~+/=-]+/gi, 'Bearer [redacted]')
      .replace(/\bsk-(?:ant-|proj-|or-)?[\w-]{12,}/g, '[redacted]')
      .replace(/\bAIza[\w-]{20,}/g, '[redacted]')
      .replace(/([?&](?:key|api[-_]?key|token)=)[^&\s"']+/gi, '$1[redacted]')
      .replace(/("?(?:api[-_]?key|x-api-key|authorization)"?\s*[:=]\s*"?)[^",\s}]+/gi, '$1[redacted]');
  },

  clip(value, max = 2000) {
    const text = this.redact(value);
    return text.length > max ? `${text.slice(0, max)}… [${text.length - max} more chars]` : text;
  },

  /* host + path of a URL, never its query (the Gemini key travels in ?key=). */
  where(url) {
    try { const parsed = new URL(url); return `${parsed.host}${parsed.pathname}`; } catch (_) { return ''; }
  },

  add(entry) {
    const clean = { id: ++this.seq, ts: new Date().toISOString(), ...entry };
    // A failed reply is kept longer: the flaw of a malformed answer is often past its start.
    for (const key of ['raw', 'stack', 'message', 'detail']) if (clean[key]) clean[key] = this.clip(clean[key], key === 'raw' ? (clean.ok === false ? 8000 : 2000) : key === 'detail' && clean.ok === false ? 8000 : 1500);
    this.entries.push(clean);
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
    return clean;
  },

  /* A call in progress: finished with end(), which records its duration and outcome. */
  start(context = {}) {
    return { t0: Date.now(), ...context };
  },

  end(trace, patch = {}) {
    const { t0, ...context } = trace || {};
    const error = patch.error;
    return this.add({
      kind: 'ai',
      ...context,
      ms: t0 ? Date.now() - t0 : null,
      ok: !error,
      ...(error ? {
        status: error.status || null, code: error.code || '', message: error.message || String(error),
        detail: error.detail || '', stack: error.stack || ''
      } : {}),
      ...Object.fromEntries(Object.entries(patch).filter(([key]) => key !== 'error'))
    });
  },

  /* One entry per error: the same error object logged, then shown as a toast, is recorded once. */
  logged: typeof WeakSet !== 'undefined' ? new WeakSet() : null,

  error(error, details = {}) {
    if (error && typeof error === 'object' && this.logged) {
      if (this.logged.has(error)) return null;
      this.logged.add(error);
    }
    return this.add({
      kind: 'error', op: details.operation || error?.operation || '', provider: error?.provider || details.provider || '', model: error?.model || details.model || '',
      status: error?.status || null, code: error?.code || '', message: error?.message || String(error), detail: error?.detail || '', stack: error?.stack || ''
    });
  },

  clear() { this.entries = []; },

  /* The log as text, newest first, for the viewer and the download. */
  text() {
    const settings = typeof appState !== 'undefined' ? appState?.scenario?.settings || {} : {};
    const head = [
      `CrisisMaker technical log · ${new Date().toISOString()}`,
      `Provider: ${settings.ai_provider || '-'} · model: ${settings.ai_provider === 'azure_openai' ? settings.azure_deployment || '-' : settings.ai_model || '-'}${settings.ai_provider === 'ollama' ? ` · Ollama ${settings.ollama_mode === 'cloud' ? 'Cloud (relay)' : 'local'}` : ''}${settings.ai_provider === 'local_server' ? ` · AI local server ${this.where(settings.local_server_url || '') || '-'} (direct)` : ''}`,
      `Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''}`,
      `Entries: ${this.entries.length} (the prompts are never logged, only their size)`, ''
    ];
    const lines = this.entries.slice().reverse().map((entry) => {
      const parts = [`#${entry.id} ${entry.ts} ${entry.kind === 'error' ? 'ERROR' : entry.ok ? 'OK' : 'FAILED'}`];
      const fields = ['op', 'channel', 'provider', 'model', 'host', 'stream', 'attempt', 'reqChars', 'maxTokens', 'numCtx', 'ms', 'status', 'finish', 'code', 'chunks', 'replyChars'];
      parts.push(fields.filter((key) => entry[key] !== undefined && entry[key] !== '' && entry[key] !== null).map((key) => `${key}=${typeof entry[key] === 'object' ? JSON.stringify(entry[key]) : entry[key]}`).join(' '));
      if (entry.message) parts.push(`message: ${entry.message}`);
      if (entry.detail) parts.push(`detail: ${entry.detail}`);
      if (entry.raw) parts.push(`raw: ${entry.raw}`);
      if (entry.stack) parts.push(`stack: ${entry.stack}`);
      return parts.join('\n  ');
    });
    return this.redact([...head, ...lines].join('\n'));
  }
};

if (typeof window !== 'undefined') window.CrisisTechLog = CrisisTechLog;
