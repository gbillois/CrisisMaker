      const CrisisError = (() => {
        const MAX_DETAIL_LENGTH = 1200;

        function trimDetail(value, max = MAX_DETAIL_LENGTH) {
          const text = String(value ?? '').trim();
          if (!text) return '';
          return text.length > max ? `${text.slice(0, max)}...` : text;
        }

        function errorText(error) {
          if (!error) return '';
          if (typeof error === 'string') return error;
          return error.message || error.name || String(error);
        }

        function payloadMessage(payload) {
          const data = payload?.json ?? payload;
          if (!data || typeof data !== 'object') return '';
          if (typeof data.error === 'string') return data.error;
          return data.error?.message
            || data.error?.details
            || data.message
            || data.detail
            || data.title
            || '';
        }

        function payloadCode(payload) {
          const data = payload?.json ?? payload;
          if (!data || typeof data !== 'object') return '';
          return data.error?.code || data.error?.type || data.code || data.type || '';
        }

        async function readResponsePayload(response) {
          const textSource = typeof response.clone === 'function' ? response.clone() : response;
          try {
            const json = await response.json();
            return { json, raw: trimDetail(JSON.stringify(json)) };
          } catch (_) {
            try {
              const text = await textSource.text();
              return { text, raw: trimDetail(text) };
            } catch (_textErr) {
              return { raw: '' };
            }
          }
        }

        function create(message, details = {}) {
          const error = new Error(message || tt('Operation failed.', 'Opération échouée.', 'Vorgang fehlgeschlagen.'));
          error.name = details.name || 'CrisisMakerError';
          error.operation = details.operation || '';
          error.provider = details.provider || '';
          error.model = details.model || '';
          error.status = details.status || null;
          error.statusText = details.statusText || '';
          error.code = details.code || '';
          error.detail = trimDetail(details.detail || details.raw || '');
          error.fileName = details.fileName || '';
          error.fileSize = details.fileSize || null;
          if (details.cause) error.cause = details.cause;
          return error;
        }

        function wrap(error, details = {}) {
          if (error?.name === 'AbortError') return error;
          const base = errorText(error);
          const message = details.message || base || tt('Operation failed.', 'Opération échouée.', 'Vorgang fehlgeschlagen.');
          return create(message, { ...details, cause: error, detail: details.detail || error?.detail });
        }

        async function fromHttpResponse(response, details = {}) {
          const payload = await readResponsePayload(response);
          const status = response.status || 0;
          const statusText = response.statusText || '';
          const message = payloadMessage(payload)
            || tt(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`, `HTTP ${status}${statusText ? ` ${statusText}` : ''}`, `HTTP ${status}${statusText ? ` ${statusText}` : ''}`);
          return create(message, {
            ...details,
            status,
            statusText,
            code: payloadCode(payload),
            detail: payload.raw
          });
        }

        async function responseJson(response, details = {}) {
          const payload = await readResponsePayload(response);
          if (!response.ok) {
            throw create(payloadMessage(payload) || `HTTP ${response.status}`, {
              ...details,
              status: response.status,
              statusText: response.statusText || '',
              code: payloadCode(payload),
              detail: payload.raw
            });
          }
          if (payload.json !== undefined) return payload.json;
          throw create(tt('The server returned a non-JSON response.', 'Le serveur a renvoyé une réponse non JSON.', 'Der Server hat eine Nicht-JSON-Antwort zurückgegeben.'), {
            ...details,
            status: response.status,
            statusText: response.statusText || '',
            detail: payload.raw
          });
        }

        function format(error, details = {}) {
          const merged = { ...details };
          const parts = [];
          const operation = error?.operation || merged.operation;
          const provider = error?.provider || merged.provider;
          const model = error?.model || merged.model;
          const status = error?.status || merged.status;
          const statusText = error?.statusText || merged.statusText;
          const code = error?.code || merged.code;
          const detail = trimDetail(error?.detail || merged.detail);
          const fileName = error?.fileName || merged.fileName;
          const fileSize = error?.fileSize || merged.fileSize;
          const base = errorText(error) || merged.fallback || tt('An error occurred.', 'Une erreur est survenue.', 'Ein Fehler ist aufgetreten.');

          if (operation) parts.push(tt(`Operation: ${operation}`, `Opération : ${operation}`, `Vorgang: ${operation}`));
          if (provider) parts.push(model ? `Provider: ${provider} / ${model}` : `Provider: ${provider}`);
          if (status) parts.push(`HTTP: ${status}${statusText ? ` ${statusText}` : ''}`);
          if (code) parts.push(`Code: ${code}`);
          if (fileName) parts.push(fileSize ? `File: ${fileName} (${fileSize} bytes)` : `File: ${fileName}`);
          if (detail) parts.push(`Details: ${detail}`);
          return parts.length ? `${base}\n${parts.join('\n')}` : base;
        }

        function log(error, details = {}) {
          console.error('[CrisisMaker]', format(error, details), error);
        }

        function toast(error, details = {}) {
          const message = format(error, details);
          if (typeof pushToast === 'function') pushToast(message, 'error');
          return message;
        }

        return { create, wrap, fromHttpResponse, responseJson, format, log, toast, trimDetail };
      })();
