      function makeDefaultAIModelCatalog() {
        return { provider: '', status: 'idle', models: [], error: '', loadedAt: null, requestId: 0 };
      }

      function resetAIModelCatalog() {
        appState.aiModelCatalog = makeDefaultAIModelCatalog();
      }

      function availableAIModels(settings = appState.scenario.settings) {
        const fallback = DEFAULT_MODELS[settings.ai_provider] || [];
        const catalog = appState.aiModelCatalog;
        const dynamic = catalog?.provider === settings.ai_provider && catalog.models?.length ? catalog.models : fallback;
        return [...new Set([settings.ai_model, ...dynamic].filter(Boolean))];
      }

      function filterOpenAIChatModels(models) {
        return models
          .map((model) => model.id)
          .filter((id) => /^(gpt-|o\d|chatgpt)/.test(id))
          .filter((id) => !/(audio|realtime|search|transcribe|tts|embed|image|moderation|instruct)/i.test(id));
      }

      function filterMistralChatModels(models) {
        return models
          .filter((model) => model.capabilities?.completion_chat !== false)
          .map((model) => model.id)
          .filter((id) => id && !/(embed|moderation|ocr|transcribe|tts|voxtral|codestral-embed)/i.test(id));
      }

      async function fetchAIModels(settings = appState.scenario.settings) {
        const { ai_provider: provider, ai_api_key: apiKey } = settings;
        if (!apiKey?.trim()) {
          throw new Error(tt(
            'Enter the provider API key to load its models.',
            'Saisissez la clé API du fournisseur pour charger ses modèles.',
            'Geben Sie den API-Schlüssel des Anbieters ein, um seine Modelle zu laden.'
          ));
        }

        const requestModels = async (url, options = {}) => {
          try {
            return await fetch(url, options);
          } catch (networkError) {
            throw CrisisError.wrap(networkError, {
              operation: 'Load AI model list',
              provider,
              message: `Model list network error: ${networkError.message}`
            });
          }
        };

        let response;
        if (provider === 'anthropic') {
          response = await requestModels('https://api.anthropic.com/v1/models?limit=100', {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true'
            }
          });
        } else if (provider === 'openai') {
          response = await requestModels('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
        } else if (provider === 'google_gemini') {
          response = await requestModels(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
        } else if (provider === 'mistral') {
          response = await requestModels('https://api.mistral.ai/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
        } else {
          return [];
        }

        const data = await CrisisError.responseJson(response, {
          operation: 'Load AI model list',
          provider
        });

        let models = [];
        if (provider === 'openai') {
          models = filterOpenAIChatModels(data.data || []);
        } else if (provider === 'google_gemini') {
          models = (data.models || [])
            .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
            .map((model) => String(model.name || '').replace(/^models\//, ''));
        } else if (provider === 'mistral') {
          models = filterMistralChatModels(data.data || []);
        } else {
          models = (data.data || []).map((model) => model.id);
        }
        return [...new Set(models.filter(Boolean))].sort((a, b) => a.localeCompare(b));
      }

      async function refreshAIModelCatalog(force = false) {
        const settings = appState.scenario.settings;
        const provider = settings.ai_provider;
        if (provider === 'azure_openai') return;

        const current = appState.aiModelCatalog || makeDefaultAIModelCatalog();
        if (!force && current.provider === provider && ['loading', 'success'].includes(current.status)) return;

        const requestId = (current.requestId || 0) + 1;
        const catalog = { provider, status: 'loading', models: current.provider === provider ? current.models : [], error: '', loadedAt: null, requestId };
        appState.aiModelCatalog = catalog;
        App.render();

        try {
          const models = await fetchAIModels(settings);
          if (appState.aiModelCatalog !== catalog || appState.scenario.settings.ai_provider !== provider) return;
          if (!models.length) throw new Error(tt('The provider returned no compatible models.', 'Le fournisseur n’a renvoyé aucun modèle compatible.', 'Der Anbieter hat keine kompatiblen Modelle zurückgegeben.'));
          catalog.status = 'success';
          catalog.models = models;
          catalog.loadedAt = new Date().toISOString();
        } catch (error) {
          if (appState.aiModelCatalog !== catalog || appState.scenario.settings.ai_provider !== provider) return;
          catalog.status = settings.ai_api_key?.trim() ? 'error' : 'missing-key';
          catalog.error = error.message || String(error);
        }
        App.render();
      }

      const AITextGenerator = {
        lastRawResponse: '',
        async testConnection() {
          const { ai_provider, ai_api_key, azure_endpoint, azure_api_key, azure_deployment } = appState.scenario.settings;
          if (['anthropic', 'openai', 'google_gemini', 'mistral'].includes(ai_provider) && !ai_api_key) {
            throw new Error(ai_provider === 'openai'
              ? tt('Please enter an OpenAI API key before testing the connection.', 'Veuillez saisir une clé API OpenAI avant de tester la connexion.', 'Bitte geben Sie einen OpenAI-API-Schlüssel ein, bevor Sie die Verbindung testen.')
              : ai_provider === 'google_gemini'
              ? tt('Please enter a Google Gemini API key before testing the connection.', 'Veuillez saisir une clé API Google Gemini avant de tester la connexion.', 'Bitte geben Sie einen Google Gemini-API-Schlüssel ein, bevor Sie die Verbindung testen.')
              : ai_provider === 'mistral'
              ? tt('Please enter a Mistral API key before testing the connection.', 'Veuillez saisir une clé API Mistral avant de tester la connexion.', 'Bitte geben Sie einen Mistral-API-Schlüssel ein, bevor Sie die Verbindung testen.')
              : tt('Please enter an Anthropic API key before testing the connection.', 'Veuillez saisir une clé API Anthropic avant de tester la connexion.', 'Bitte geben Sie einen Anthropic-API-Schlüssel ein, bevor Sie die Verbindung testen.'));
          }
          if (ai_provider === 'azure_openai') {
            if (!azure_endpoint || !azure_api_key || !azure_deployment) throw new Error(tt('Please provide the Azure endpoint, API key, and deployment name before testing the connection.', 'Veuillez renseigner l\'endpoint, la clé API et le déploiement Azure avant de tester la connexion.', 'Bitte geben Sie den Azure-Endpunkt, den API-Schlüssel und den Bereitstellungsnamen an, bevor Sie die Verbindung testen.'));
          }
          const prompt = 'Reply only with a JSON object {"ok": true, "message": "valid connection"}';
          return this.generate('settings_test', prompt, null, true);
        },
        async generateScenario(userInput) {
          const { systemPrompt, userPrompt } = LLMConfigPrompts.scenario(userInput);
          return this.generate('llm_config_scenario', systemPrompt, userPrompt);
        },
        async generateActors(userInput, scenario) {
          const { systemPrompt, userPrompt } = LLMConfigPrompts.actors(userInput, scenario);
          return this.generate('llm_config_actors', systemPrompt, userPrompt);
        },
        async generateDebrief(userInput, scenario) {
          const { systemPrompt, userPrompt } = LLMConfigPrompts.debrief(userInput, scenario);
          return this.generate('llm_config_debrief', systemPrompt, userPrompt, false, 5000);
        },
        async generateStimulusConfig(userInput, scenario, actors, maxTokens = 3000) {
          const { systemPrompt, userPrompt } = LLMConfigPrompts.stimulus(userInput, scenario, actors);
          return this.generate('llm_config_stimulus', systemPrompt, userPrompt, false, maxTokens);
        },
        async generateForStimulus(stimulus, fieldName = null, guidedPrompt = null) {
          const actor = getActor(stimulus.actor_id);
          const promptInfo = PromptBuilder.forStimulus(stimulus, actor, appState.scenario, fieldName, guidedPrompt);
          return this.generate(stimulus.channel, promptInfo.systemPrompt, promptInfo.userPrompt);
        },
        async generateStreaming(channel, systemPrompt, userPrompt = null, onChunk = null, maxTokens = 2000) {
          const { ai_provider, ai_api_key, ai_model, azure_endpoint, azure_api_key, azure_deployment } = appState.scenario.settings;

          const readSSE = async (response, extractDelta) => {
            if (!response.ok) {
              throw await CrisisError.fromHttpResponse(response, {
                operation: 'Stream LLM response',
                provider: ai_provider,
                model: ai_provider === 'azure_openai' ? azure_deployment : ai_model
              });
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullText = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop();
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const data = line.slice(6).trim();
                if (!data || data === '[DONE]') continue;
                try {
                  const event = JSON.parse(data);
                  if (event.type === 'error') throw new Error(event.error?.message || 'Stream error');
                  const delta = extractDelta(event);
                  if (delta) {
                    fullText += delta;
                    if (onChunk) onChunk(delta);
                  }
                } catch (e) {
                  if (e.message === 'Stream error' || e.message?.startsWith('HTTP')) throw e;
                }
              }
            }
            this.lastRawResponse = fullText;
            return fullText;
          };

          const requestStream = async (url, options, context) => {
            try {
              return await fetch(url, options);
            } catch (networkError) {
              throw CrisisError.wrap(networkError, {
                ...context,
                message: `${context.provider || 'LLM'} streaming network error: ${networkError.message}`
              });
            }
          };

          if (ai_provider === 'anthropic') {
            if (!ai_api_key) throw new Error(tt('Missing Anthropic API key.', 'Clé API Anthropic manquante.', 'Fehlender Anthropic-API-Schlüssel.'));
            const response = await requestStream('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': ai_api_key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
              body: JSON.stringify({ model: ai_model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt || 'Reply in strict JSON.' }], stream: true })
            }, { operation: 'Stream Anthropic response', provider: 'anthropic', model: ai_model });
            const fullText = await readSSE(response, (event) => {
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') return event.delta.text;
              return null;
            });
            return parseLLMJson(fullText);
          }

          if (ai_provider === 'openai') {
            if (!ai_api_key) throw new Error(tt('Missing OpenAI API key.', 'Clé API OpenAI manquante.', 'Fehlender OpenAI-API-Schlüssel.'));
            const response = await requestStream('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai_api_key}` },
              body: JSON.stringify({ model: ai_model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt || 'Reply in strict JSON.' }], stream: true })
            }, { operation: 'Stream OpenAI response', provider: 'openai', model: ai_model });
            const fullText = await readSSE(response, (event) => event.choices?.[0]?.delta?.content || null);
            return parseLLMJson(fullText);
          }

          if (ai_provider === 'mistral') {
            if (!ai_api_key) throw new Error(tt('Missing Mistral API key.', 'Clé API Mistral manquante.', 'Fehlender Mistral-API-Schlüssel.'));
            const response = await requestStream('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai_api_key}` },
              body: JSON.stringify({
                model: ai_model,
                messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt || 'Reply in strict JSON.' }],
                max_tokens: maxTokens,
                response_format: { type: 'json_object' },
                stream: true
              })
            }, { operation: 'Stream Mistral response', provider: 'mistral', model: ai_model });
            const fullText = await readSSE(response, (event) => event.choices?.[0]?.delta?.content || null);
            return parseLLMJson(fullText);
          }

          if (ai_provider === 'azure_openai') {
            if (!azure_endpoint || !azure_api_key || !azure_deployment) throw new Error(tt('Incomplete Azure OpenAI configuration.', 'Configuration Azure OpenAI incomplète.', 'Unvollständige Azure-OpenAI-Konfiguration.'));
            const normalizedEndpoint = azure_endpoint.replace(/\/+$/, '');
            const response = await requestStream(`${normalizedEndpoint}/openai/deployments/${encodeURIComponent(azure_deployment)}/chat/completions?api-version=2024-02-01`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': azure_api_key },
              body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt || 'Reply in strict JSON.' }], stream: true })
            }, { operation: 'Stream Azure OpenAI response', provider: 'azure_openai', model: azure_deployment });
            const fullText = await readSSE(response, (event) => event.choices?.[0]?.delta?.content || null);
            return parseLLMJson(fullText);
          }

          if (ai_provider === 'google_gemini') {
            if (!ai_api_key) throw new Error(tt('Missing Google Gemini API key.', 'Clé API Google Gemini manquante.', 'Fehlender Google Gemini-API-Schlüssel.'));
            const response = await requestStream(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai_model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(ai_api_key)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + (userPrompt || 'Reply in strict JSON.') }] }], generationConfig: { maxOutputTokens: maxTokens } })
            }, { operation: 'Stream Google Gemini response', provider: 'google_gemini', model: ai_model });
            const fullText = await readSSE(response, (event) => {
              const parts = event.candidates?.[0]?.content?.parts;
              return parts?.[0]?.text || null;
            });
            return parseLLMJson(fullText);
          }

          throw new Error(tt(`Unsupported provider: ${ai_provider}`, `Fournisseur non supporté : ${ai_provider}`, `Nicht unterstützter Anbieter: ${ai_provider}`));
        },

        async generate(channel, systemPrompt, userPrompt = null, quiet = false, maxTokens = 2000) {
          const { ai_provider, ai_api_key, ai_model, azure_endpoint, azure_api_key, azure_deployment } = appState.scenario.settings;
          if (ai_provider === 'anthropic' && !ai_api_key) throw new Error(tt('Missing Anthropic API key.', 'Clé API Anthropic manquante.', 'Fehlender Anthropic-API-Schlüssel.'));
          if (ai_provider === 'openai' && !ai_api_key) throw new Error(tt('Missing OpenAI API key.', 'Clé API OpenAI manquante.', 'Fehlender OpenAI-API-Schlüssel.'));
          if (ai_provider === 'google_gemini' && !ai_api_key) throw new Error(tt('Missing Google Gemini API key.', 'Clé API Google Gemini manquante.', 'Fehlender Google Gemini-API-Schlüssel.'));
          if (ai_provider === 'mistral' && !ai_api_key) throw new Error(tt('Missing Mistral API key.', 'Clé API Mistral manquante.', 'Fehlender Mistral-API-Schlüssel.'));
          if (ai_provider === 'azure_openai') {
            if (!azure_endpoint || !azure_api_key || !azure_deployment) throw new Error(tt('Incomplete Azure OpenAI configuration.', 'Configuration Azure OpenAI incomplète.', 'Unvollständige Azure-OpenAI-Konfiguration.'));
            const normalizedEndpoint = azure_endpoint.replace(/\/+$/, '');
            try {
              const endpointUrl = new URL(normalizedEndpoint);
              if (endpointUrl.protocol !== 'https:') throw new Error(tt('Azure endpoint must use HTTPS.', 'L\'endpoint Azure doit utiliser HTTPS.', 'Der Azure-Endpunkt muss HTTPS verwenden.'));
            } catch (urlErr) {
              if (urlErr.message.includes('HTTPS') || urlErr.message.includes('HTTPS')) throw urlErr;
              throw new Error(tt('Invalid Azure endpoint URL.', 'URL d\'endpoint Azure invalide.', 'Ungültige Azure-Endpunkt-URL.'));
            }
            let response;
            try {
              response = await fetch(`${normalizedEndpoint}/openai/deployments/${encodeURIComponent(azure_deployment)}/chat/completions?api-version=2024-02-01`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api-key': azure_api_key },
                body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, ...(userPrompt ? [{ role: 'user', content: userPrompt }] : [{ role: 'user', content: 'Reply in strict JSON.' }])] })
              });
            } catch (networkError) {
              throw CrisisError.wrap(networkError, { operation: 'Call Azure OpenAI', provider: 'azure_openai', model: azure_deployment, message: `Azure OpenAI network error: ${networkError.message}` });
            }
            const data = await CrisisError.responseJson(response, { operation: 'Call Azure OpenAI', provider: 'azure_openai', model: azure_deployment });
            this.lastRawResponse = JSON.stringify(data, null, 2);
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error(tt('Empty Azure OpenAI response.', 'Réponse Azure OpenAI vide.', 'Leere Azure-OpenAI-Antwort.'));
            this.lastRawResponse = content;
            const parsed = parseLLMJson(content);
            if (!quiet) pushToast(tt('Content generated with Azure OpenAI.', 'Contenu généré avec Azure OpenAI.', 'Inhalt mit Azure OpenAI generiert.'), 'success');
            return parsed;
          }
          if (ai_provider === 'anthropic') {
            let response;
            try {
              response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': ai_api_key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
                body: JSON.stringify({ model: ai_model, max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userPrompt || 'Reply in strict JSON.' }] })
              });
            } catch (networkError) {
              throw CrisisError.wrap(networkError, { operation: 'Call Anthropic', provider: 'anthropic', model: ai_model, message: `Anthropic network error: ${networkError.message}` });
            }
            const data = await CrisisError.responseJson(response, { operation: 'Call Anthropic', provider: 'anthropic', model: ai_model });
            this.lastRawResponse = JSON.stringify(data, null, 2);
            const text = data.content?.[0]?.text || '{}';
            this.lastRawResponse = text;
            const parsed = parseLLMJson(text);
            if (!quiet) pushToast(tt('Content generated with Anthropic.', 'Contenu généré avec Anthropic.', 'Inhalt mit Anthropic generiert.'), 'success');
            return parsed;
          }
          if (ai_provider === 'openai') {
            let response;
            try {
              response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai_api_key}` },
                body: JSON.stringify({
                  model: ai_model,
                  messages: [{ role: 'system', content: systemPrompt }, ...(userPrompt ? [{ role: 'user', content: userPrompt }] : [{ role: 'user', content: 'Reply in strict JSON.' }])]
                })
              });
            } catch (networkError) {
              throw CrisisError.wrap(networkError, { operation: 'Call OpenAI', provider: 'openai', model: ai_model, message: `OpenAI network error: ${networkError.message}` });
            }
            const data = await CrisisError.responseJson(response, { operation: 'Call OpenAI', provider: 'openai', model: ai_model });
            this.lastRawResponse = JSON.stringify(data, null, 2);
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error(tt('Empty OpenAI response.', 'Réponse OpenAI vide.', 'Leere OpenAI-Antwort.'));
            this.lastRawResponse = content;
            const parsed = parseLLMJson(content);
            if (!quiet) pushToast(tt('Content generated with OpenAI.', 'Contenu généré avec OpenAI.', 'Inhalt mit OpenAI generiert.'), 'success');
            return parsed;
          }
          if (ai_provider === 'mistral') {
            let response;
            try {
              response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai_api_key}` },
                body: JSON.stringify({
                  model: ai_model,
                  messages: [{ role: 'system', content: systemPrompt }, ...(userPrompt ? [{ role: 'user', content: userPrompt }] : [{ role: 'user', content: 'Reply in strict JSON.' }])],
                  max_tokens: maxTokens,
                  response_format: { type: 'json_object' }
                })
              });
            } catch (networkError) {
              throw CrisisError.wrap(networkError, { operation: 'Call Mistral', provider: 'mistral', model: ai_model, message: `Mistral network error: ${networkError.message}` });
            }
            const data = await CrisisError.responseJson(response, { operation: 'Call Mistral', provider: 'mistral', model: ai_model });
            this.lastRawResponse = JSON.stringify(data, null, 2);
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error(tt('Empty Mistral response.', 'Réponse Mistral vide.', 'Leere Mistral-Antwort.'));
            this.lastRawResponse = content;
            const parsed = parseLLMJson(content);
            if (!quiet) pushToast(tt('Content generated with Mistral.', 'Contenu généré avec Mistral.', 'Inhalt mit Mistral generiert.'), 'success');
            return parsed;
          }
          if (ai_provider === 'google_gemini') {
            let response;
            try {
              response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai_model)}:generateContent?key=${encodeURIComponent(ai_api_key)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + (userPrompt || 'Reply in strict JSON.') }] }], generationConfig: { maxOutputTokens: maxTokens } })
              });
            } catch (networkError) {
              throw CrisisError.wrap(networkError, { operation: 'Call Google Gemini', provider: 'google_gemini', model: ai_model, message: `Google Gemini network error: ${networkError.message}` });
            }
            const data = await CrisisError.responseJson(response, { operation: 'Call Google Gemini', provider: 'google_gemini', model: ai_model });
            this.lastRawResponse = JSON.stringify(data, null, 2);
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!content) throw new Error(tt('Empty Google Gemini response.', 'Réponse Google Gemini vide.', 'Leere Google Gemini-Antwort.'));
            this.lastRawResponse = content;
            const parsed = parseLLMJson(content);
            if (!quiet) pushToast(tt('Content generated with Google Gemini.', 'Contenu généré avec Google Gemini.', 'Inhalt mit Google Gemini generiert.'), 'success');
            return parsed;
          }
          throw new Error(tt(`Unsupported provider: ${ai_provider}`, `Fournisseur non supporté : ${ai_provider}`, `Nicht unterstützter Anbieter: ${ai_provider}`));
        }
      };

      const LLMConfigPrompts = {
        scenario(userInput) {
          const today = new Date().toISOString().slice(0, 10);
          const injectLang = appState?.scenario?.settings?.inject_language || appState?.scenario?.settings?.language || 'en';
          const injectLangName = { en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', ja: 'Japanese', zh: 'Chinese' }[injectLang] || 'English';
          return {
            systemPrompt: `You are an assistant specialized in preparing cybersecurity crisis exercises.
The user describes a scenario in natural language. Extract and structure the information to configure the exercise.

INSTRUCTIONS:
- Extract all information mentioned by the user
- For information NOT mentioned, INVENT realistic values consistent with the described context
- The "summary" field must be a professional 3-5 sentence summary of the scenario
- The "detailed_context" field must elaborate with plausible technical details (attack vector, affected systems, timeline)
- The client language must match the mentioned country/context (French company → "fr", German company → "de", etc.)
- If no date is mentioned, use today's date (${today})
- If no timezone is mentioned, infer it from the country
- Generate the "summary" and "detailed_context" text fields in ${injectLangName}

Reply ONLY with a JSON object following exactly this structure:
{
  "client": {
    "name": "Organization name",
    "sector": "Banking | Energy | Healthcare | Transport | Industry | Telecom | Retail | Public sector | Other",
    "language": "fr | en | de | es | it | pt | nl | ja | zh"
  },
  "scenario": {
    "type": "Ransomware | Data Breach | Supply Chain | DDoS | Insider Threat | Other",
    "summary": "Professional 3-5 sentence summary",
    "detailed_context": "Detailed context with plausible technical information (1-2 paragraphs)",
    "start_date": "2026-03-15T08:00:00",
    "timezone": "Europe/Paris"
  }
}`,
            userPrompt: `USER DESCRIPTION:\n${userInput}`
          };
        },
        actors(userInput, scenario) {
          return {
            systemPrompt: `You are an assistant specialized in preparing cybersecurity crisis exercises.
The user describes the actors they want for their exercise. Generate a structured list of actors.

SCENARIO CONTEXT:
- Client: ${scenario.client.name} (${scenario.client.sector}), language: ${scenario.client.language}
- Scenario: ${scenario.scenario.summary}
- Type: ${scenario.scenario.type}

INSTRUCTIONS:
- Generate the actors described by the user with realistic fictional names
- For details NOT mentioned (exact names, titles, organizations), INVENT realistic and consistent values
- If the user vaguely asks for "journalists" or "realistic actors", create a complete and balanced set of at least 6 actors
- Each actor must have a name consistent with their language/country
- Each actor's language corresponds to their area of activity

Reply ONLY with a JSON array:
[
  {
    "name": "First Last",
    "role": "journalist | authority | client_b2b | client_b2c | internal | partner | attacker | analyst",
    "organization": "Organization name",
    "title": "Title / function",
    "language": "fr | en | de | es | it"
  }
]`,
            userPrompt: `ACTOR DESCRIPTION:\n${userInput}`
          };
        },
        stimulus(userInput, scenario, actors) {
          const actorsList = actors.map((a) => ({ name: a.name, role: a.role, organization: a.organization, language: a.language }));
          const injectLang = scenario.settings?.inject_language || scenario.settings?.language || 'en';
          const injectLangName = { en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', ja: 'Japanese', zh: 'Chinese' }[injectLang] || 'English';
          return {
            systemPrompt: `You are an assistant specialized in preparing cybersecurity crisis exercises.
The user describes one or more stimuli (crisis messages). Extract the configuration AND generate the content.

SCENARIO CONTEXT:
- Client: ${scenario.client.name} (${scenario.client.sector}), language: ${scenario.client.language}
- Scenario: ${scenario.scenario.summary}
- Detailed context: ${scenario.scenario.detailed_context || 'Not provided'}
- Available actors: ${JSON.stringify(actorsList)}

AVAILABLE TEMPLATES:
- article_press: lemonde, nyt, faz, ft
- email_internal: outlook
- email_external: generic
- email_authority: anssi
- post_twitter: twitter
- post_linkedin: linkedin
- post_reddit: reddit
- dark_web_forum: breach_forum
- breaking_news_tv: bfm, cnn, bloomberg, cna
- press_release: generic_pr
- sms_notification: sms
- internal_memo: memo

INSTRUCTIONS:
- Determine the most suitable channel and template for the description
- If an actor is mentioned or matches the description, put their name in actor_id (the code will resolve it)
- For timeline position, interpret "H+2" as 120 minutes, "H+30" as 30, etc. If not mentioned, use 0
- If the user requests a batch ("create 30 stimuli…" with categories), return EXACTLY the requested number and distribute timestamps credibly if no precise schedule is given
- For external stimuli ("client", "regulator", "press", etc.), alternate actors/sources to reflect the requested distribution
- Generate field content in ${injectLangName} by default, EXCEPT press articles which must use their publication's native language
- Strict press media rule: template_id = "lemonde" → all text content in French; "nyt" → English; "faz" → German; "ft" → British English; "nikkei" → Japanese
- For information NOT mentioned, INVENT realistic coherent details
- The generation_mode field must be "ai_guided"
- If the user describes MULTIPLE stimuli, return a JSON ARRAY of objects. If ONE stimulus, return a single object.

AUTHOR/SENDER CONSISTENCY by channel:
- article_press / breaking_news_tv: author/journalist must have a realistic journalist name (e.g. "By John Smith" for NYT)
- email_internal / internal_memo: from_name must be an internal employee first+last name, from_email with client organization domain
- email_authority: from_name must be an official body (ANSSI, CERT-FR, BSI, CISA…)
- post_twitter / post_linkedin / post_reddit: display_name and handle consistent with actor role
- dark_web_forum: leaker_name must be a fictional handle; never use real credentials, live download links, or operational infrastructure
- press_release: logo_text and contact_name consistent with the issuing organization
- sms_notification: short recognizable sender (e.g. "BANK-ALERT")

FIELDS TO FILL IN "fields" by channel (generate realistic complete content):
- email_internal: subject, from_name, from_email, to, body (HTML with <p> and <strong>), date, importance ("normal"|"high")
- email_external: subject, from_name, from_email, to, body (HTML), date
- email_authority: subject, from_name, from_email, to, body (HTML), severity ("critical"|"high"|"medium"), reference, date
- article_press (lemonde): headline, subheadline, author, date, category, body (HTML 3-4 paragraphs), image_caption, read_time — required language: French
- article_press (nyt): headline, subheadline, author, date, category, body (HTML), image_caption, read_time, location — required language: English
- article_press (faz): kicker, headline, subheadline, author, date, category, body (HTML), image_caption, content_type — required language: German
- article_press (ft): headline, subheadline, author, date, category, body (HTML), image_caption, content_type — required language: British English
- post_twitter: text (≤280 chars), display_name, handle, date, verified (true|false), replies, retweets, likes, views
- post_linkedin: text, display_name, title, date, reactions_count, comments_count
- post_reddit: title, body (HTML), subreddit, author, date, upvotes, comments_count
- dark_web_forum: thread_title, leaker_name, leaker_rank, post_date, message_content (HTML), victim, victim_domain, breach_date, records_count, data_size, price, escrow, sample_status, files (JSON array), replies_count, views_count
- breaking_news_tv: headline, subline, category, time, ticker
- press_release: title, body (HTML), logo_text, date, contact_name, contact_email, contact_phone
- sms_notification: sender, text, time
- internal_memo: subject, from_name, to, body (HTML), date

Stimulus format:
{
  "channel": "article_press | email_internal | post_twitter | ...",
  "template_id": "lemonde | nyt | outlook | twitter | ...",
  "actor_id": "actor name or null",
  "source_label": "label if no actor",
  "timestamp_offset_minutes": 120,
  "generation_mode": "ai_guided",
  "generation_prompt": "original user description",
  "fields": { /* all channel fields filled with realistic content */ }
}`,
            userPrompt: `STIMULUS DESCRIPTION:\n${userInput}`
          };
        },
        debrief(userInput, scenario) {
          const language = scenario.settings?.language || scenario.client?.language || 'en';
          const languageName = { en: 'English', fr: 'French', de: 'German', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch' }[language] || 'English';
          const supportingInjectContext = [...(scenario.stimuli || [])]
            .sort((a, b) => Number(a.timestamp_offset_minutes || 0) - Number(b.timestamp_offset_minutes || 0))
            .map((stimulus) => ({
              offset_minutes: Number(stimulus.timestamp_offset_minutes || 0),
              channel: stimulus.channel,
              title: cleanDebriefText(stimulus.fields?.subject || stimulus.fields?.headline || stimulus.fields?.thread_title || stimulus.fields?.title || stimulus.fields?.text || stimulus.name || ''),
              content: debriefStimulusText(stimulus).slice(0, 600)
            }));
          return {
            systemPrompt: `You are a senior crisis scenario writer preparing the final reveal and story reconstruction shown after a crisis exercise.

Your output explains WHAT REALLY HAPPENED in the fictional scenario, including hidden events participants could not see. It is not a review of participant actions and it is never a list or summary of injects.

SCENARIO:
- Client: ${scenario.client?.name || ''}
- Sector: ${scenario.client?.sector || ''}
- Crisis type: ${scenario.scenario?.type || ''}
- Summary: ${scenario.scenario?.summary || ''}
- Detailed context: ${scenario.scenario?.detailed_context || ''}

INJECTS SHOWN DURING THE EXERCISE — SUPPORTING CONTEXT ONLY, NEVER TURN THEM DIRECTLY INTO EVENTS:
${JSON.stringify(supportingInjectContext)}

INSTRUCTIONS:
- Reconstruct a coherent causal story from before the first visible alert through recovery and root causes
- Create 10 to 18 story events, including hidden attacker preparation, detonation, propagation, business impacts, stakeholder consequences, response, recovery, and lessons
- Do not mention emails, SMS, articles, posts, injects, facilitators, or participants
- Each title states a real scenario event
- headline is a concise narrative hook explaining why the event matters
- body explains what actually happened with concrete technical and business detail
- Use exactly these phase ids: prelude, detonation, fallout
- Severity is an integer from 1 to 5
- Give each event a meaningful time label such as J-21, H0, H+2, Day +5, or Week +6
- Add a real-world location and [latitude, longitude] coordinates whenever relevant, so the interactive globe can tell the story
- Include impacts, costs, and evidence when relevant
- Write all generated text in ${languageName}
- Preserve chronological order
- Return strict JSON only

Return this structure:
{
  "meta": {
    "title": "Scenario operation or crisis name",
    "subtitle": "— crisis reconstruction",
    "badge": "SCENARIO REVEAL"
  },
  "events": [
    {
      "phase": "prelude | detonation | fallout",
      "dateLabel": "J-21 | H0 | Day +5",
      "title": "What really happened",
      "location": "City, country or meaningful global location",
      "coords": [48.86, 2.35],
      "headline": "Why this story event matters",
      "body": "Concrete reconstruction of what actually happened",
      "severity": 1,
      "kind": "context | intrusion | exfiltration | attack | impact | threat | regulatory | media | decision | recovery | leak | lessons",
      "artifacts": ["Relevant evidence or trace"],
      "casualties": "Optional human or operational impact",
      "damageUSD": "Optional cost or financial exposure"
    }
  ]
}`,
            userPrompt: `STORY RECONSTRUCTION GUIDANCE:\n${userInput || 'Reconstruct the complete hidden story and its major causal arc.'}`
          };
        }
      };

      function parseLLMJson(text) {
        const trimmed = String(text || '').trim();
        if (!trimmed) throw CrisisError.create(tt('LLM response was empty.', 'La réponse du LLM était vide.', 'LLM-Antwort war leer.'), { operation: 'Parse LLM JSON response' });
        try {
          return JSON.parse(trimmed);
        } catch (err) {
          const match = trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
          if (!match) throw CrisisError.create(tt('LLM response was not valid JSON.', 'La réponse du LLM n\'était pas un JSON valide.', 'LLM-Antwort war kein gültiges JSON.'), {
            operation: 'Parse LLM JSON response',
            detail: trimmed
          });
          try {
            return JSON.parse(match[0]);
          } catch (innerErr) {
            throw CrisisError.wrap(innerErr, {
              operation: 'Parse extracted LLM JSON',
              message: tt('LLM response contained malformed JSON.', 'La réponse du LLM contenait un JSON mal formé.', 'Die LLM-Antwort enthielt fehlerhaftes JSON.'),
              detail: match[0]
            });
          }
        }
      }

      const PromptBuilder = {
        forStimulus(stimulus, actor, scenario, fieldName = null, guidedPrompt = null) {
          const common = {
            scenarioSummary: scenario.scenario.summary,
            timestamp: `H+${stimulus.timestamp_offset_minutes} minutes`,
            actorName: actor?.name || 'Spokesperson',
            actorTitle: actor?.title || 'Lead',
            actorRole: actor?.role || 'internal',
            language: (() => { const l = scenario.settings.inject_language || scenario.settings.language || 'en'; return { fr: 'French', de: 'German', en: 'English', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', ja: 'Japanese', zh: 'Chinese' }[l] || 'English'; })()
          };
          const eventDescription = stimulus.fields.subject || stimulus.fields.headline || stimulus.fields.thread_title || stimulus.fields.text || stimulus.fields.title || 'New development in the cyber crisis';
          const guidedSuffix = guidedPrompt ? ` Additional instruction from the operator: ${guidedPrompt}` : '';
          let result;
          switch (stimulus.channel) {
            case 'article_press': {
              const variant = stimulus.template_id || 'nyt';
              const pressPrompts = {
                nyt: `You are a New York Times journalist in the ${stimulus.fields.category || 'Technology'} section. Write in American English about a cyber security incident. Scenario: ${common.scenarioSummary}. Event: ${eventDescription}. Timeline: ${common.timestamp}. Instructions: factual headline with no final punctuation, one-sentence subheadline, byline formatted "By Firstname Lastname and Firstname Lastname", body of 4-5 HTML paragraphs in NYT style with the first paragraph summarising who/what/when/where/why, include 1-2 fictional expert or spokesperson quotes, include location in caps if relevant, calm authoritative tone, never mention this is an exercise. Reply only with JSON containing headline, subheadline, author, body, image_caption.`,
                faz: `Du bist Journalist der Frankfurter Allgemeinen Zeitung, Ressort ${stimulus.fields.category || 'Wirtschaft'}. Du schreibst auf Deutsch über einen Cybersicherheitsvorfall. Kontext: ${common.scenarioSummary}. Ereignis: ${eventDescription}. Zeitpunkt: ${common.timestamp}. Vorgaben: Kicker mit 1-2 Wörtern, sachliche präzise Überschrift im Stil der F.A.Z., Subheadline mit systemischer oder regulatorischer Einordnung, Byline im Format "Von Vorname Nachname, Stadt", 4-5 dichte HTML-Absätze mit langen strukturierten Sätzen, Verweise auf DORA/NIS2/BSI wenn relevant, 1-2 fiktive Zitate, nüchterner analytischer Ton, nie erwähnen, dass es eine Übung ist. Antworte nur mit JSON mit kicker, headline, subheadline, author, body, content_type, image_caption.`,
                ft: `You are a Financial Times journalist covering ${stimulus.fields.category || 'Cyber Security'}. Write in British English about a cyber security incident. Scenario: ${common.scenarioSummary}. Event: ${eventDescription}. Timeline: ${common.timestamp}. Instructions: factual headline with no final punctuation, analytical subheadline, byline formatted "Firstname Lastname and Firstname Lastname in City", 4-5 HTML paragraphs with concise first paragraph and subsequent financial, regulatory and market context, include 1-2 fictional quotes, sober FT tone, never mention this is an exercise. Reply only with JSON containing headline, subheadline, author, body, content_type, image_caption.`,
                lemonde: `You are a Le Monde journalist writing in French about a cyber crisis. Context: ${common.scenarioSummary}. Event: ${eventDescription}. Timeline: ${common.timestamp}. Instructions: factual headline, concise standfirst, 3-4 HTML paragraphs, one fictional quote, serious newspaper tone, never mention this is an exercise. Reply only with JSON containing headline, subheadline, author, body, image_caption.`,
                nikkei: `あなたは日本経済新聞の${stimulus.fields.category || 'テクノロジー'}面の記者です。サイバーセキュリティ事案について日本語で記事を書いてください。背景: ${common.scenarioSummary}。事象: ${eventDescription}。時点: ${common.timestamp}。指示: 簡潔で事実を伝える見出し（20-30文字、句読点なし）、副見出し1文（分析的な角度）、記者名は漢字のフルネーム、日付は「2026年3月15日 10:42」形式、本文は4-5段落のHTMLで<p>タグを使用、日経スタイルの客観的・分析的な語調（だ/である体）、1-2件の架空の専門家コメント引用（です/ます体）、経済・ビジネスへの影響を必ず言及、DORAやNIS2など規制面の言及可、演習であることは絶対に言及しない。JSONのみで回答: {"headline":"...","subheadline":"...","author":"...","date":"...","category":"テクノロジー","body":"<p>...</p>","image_caption":"...","related_tags":"タグ1,タグ2,タグ3"}`
              };
              result = {
                systemPrompt: pressPrompts[variant] || pressPrompts.nyt,
                userPrompt: fieldName ? `Generate the best possible value for field ${fieldName}, but still answer with JSON containing all expected keys.` : 'Write the full article.'
              };
              break;
            }
            case 'post_twitter':
              result = {
                systemPrompt: `You are ${common.actorName}, ${common.actorTitle}. You are reacting on X/Twitter to a cybersecurity event. Context: ${common.scenarioSummary}. Event: ${eventDescription}. Character role: ${common.actorRole}. Instructions: maximum 280 characters, authentic tone, may include 1-2 hashtags, write in ${common.language}. Reply only with JSON {"text":"..."}.`,
                userPrompt: fieldName ? `Improve field ${fieldName}.` : 'Generate a credible post.'
              };
              break;
            case 'post_linkedin':
              result = {
                systemPrompt: `You are ${common.actorName}, ${common.actorTitle}. You are posting on LinkedIn about a cybersecurity event. Context: ${common.scenarioSummary}. Event: ${eventDescription}. Instructions: 500-1000 characters, professional but engaged tone, structure hook + analysis + perspective, restrained hashtags, write in ${common.language}. Reply only with JSON {"text":"..."}.`,
                userPrompt: 'Write the LinkedIn post.'
              };
              break;
            case 'post_reddit': {
              const subreddit = stimulus.fields.subreddit || 'r/cybersecurity';
              const redditLanguage = /^r\/(france|francais|cybersecurite)$/i.test(subreddit) ? 'French' : /^r\/(de|deutsch|germany|netzpolitik|sicherheit)$/i.test(subreddit) ? 'German' : ((() => { const l = scenario.settings.inject_language || scenario.settings.language || 'en'; return { fr: 'French', de: 'German', en: 'English', es: 'Spanish', it: 'Italian', pt: 'Portuguese', nl: 'Dutch', ja: 'Japanese', zh: 'Chinese' }[l] || 'English'; })());
              const postType = stimulus.fields.link_url ? 'link' : 'text';
              result = {
                systemPrompt: `Generate a realistic Reddit post for ${subreddit} about a cyber security incident. Scenario: ${common.scenarioSummary}. Event: ${eventDescription}. Simulated author: ${common.actorName}, ${common.actorTitle}. Post type: ${postType}. Instructions: catchy but informative title, ${postType === 'text' ? '100-300 words of authentic Reddit-style HTML body with community-specific tone, optional technical acronyms, questions or field observations.' : 'no body text, title should summarise the linked article.'} Pick a relevant post flair such as Breaking News, Threat Intel, Discussion or Incident Response. Language must be ${redditLanguage}. If a top comment is needed, include an informal complementary comment with author and flair. Never mention this is an exercise. Reply only with JSON containing title, body, post_flair, top_comment.`,
                userPrompt: fieldName ? `Improve field ${fieldName} while keeping the JSON schema.` : 'Write the Reddit post.'
              };
              break;
            }
            case 'dark_web_forum':
              result = {
                systemPrompt: `Generate a realistic fictional underground-forum post for a cyber crisis exercise. Scenario: ${common.scenarioSummary}. Event: ${eventDescription}. Timeline: ${common.timestamp}. Visual style: ${stimulus.fields.forum_style || 'breachforums'}. Instructions: use an anonymous fictional handle and terse informal forum language with lowercase shorthand. Keep the wording rough and direct, but do not force fake terminal notation or excessive leetspeak. Include a claimed dataset summary, plausible but fictional counts and a proof-file manifest. Use non-routable example domains only, no real credentials, no live download links, and no actionable intrusion instructions. Avoid polished corporate prose. Write in ${common.language}. Reply only with JSON containing thread_title, leaker_name, leaker_rank, post_date, message_content, victim, victim_domain, breach_date, records_count, data_size, price, escrow, sample_status, files, replies_count, views_count.`,
                userPrompt: fieldName ? `Improve field ${fieldName} while keeping the JSON schema and safety constraints.` : 'Write the full fictional forum thread.'
              };
              break;
            case 'email_internal':
              result = {
                systemPrompt: `Write an internal email during a cyber crisis. Sender: ${stimulus.fields.from_name || common.actorName}. Recipient: ${stimulus.fields.to || 'Crisis Committee'}. Context: ${common.scenarioSummary}. Goal: status update and instructions. Time: ${common.timestamp}. Instructions: clear subject line, structured HTML body using <p>, <ul>, <strong>, write in ${common.language}. Reply only with JSON {"subject":"...","body":"..."}.`,
                userPrompt: 'Write a structured and credible internal email.'
              };
              break;
            case 'email_authority':
              result = {
                systemPrompt: `Write an official CERT-FR alert. Context: ${common.scenarioSummary}. Alert type: critical vulnerability actively exploited. Severity: ${stimulus.fields.severity || 'high'}. Instructions: institutional, precise, technical tone, structure as summary / affected systems / recommendations / indicators of compromise, write in ${common.language}. Reply only with JSON {"reference":"...","subject":"...","body":"..."}.`,
                userPrompt: 'Write the official alert.'
              };
              break;
            case 'press_release':
              result = {
                systemPrompt: `Write an official press release for ${stimulus.fields.organization || scenario.client.name}. Context: ${common.scenarioSummary}. Time: ${common.timestamp}. Positioning: first reaction. Instructions: corporate, reassuring but transparent tone, include date/location, title, context, measures, commitments, and press contact, write in ${common.language}. Reply only with JSON {"title":"...","body":"..."}.`,
                userPrompt: 'Write the press release.'
              };
              break;
            case 'audio_message': {
              const character = stimulus.fields.audio_character || 'attacker_best';
              const isAttacker = character.startsWith('attacker');
              const isFemale = character === 'female';
              const voiceInstruction = isAttacker
                ? `The text will be read by a TTS engine with a deep, distorted, anonymous voice (cybercriminal ransom demands). Write a menacing, cold, and direct ransom message or threat. Use short, impactful sentences. No pleasantries. The tone should be intimidating and clinical.`
                : isFemale
                  ? `The text will be read by a professional female radio presenter. Write a clear, well-structured news bulletin or announcement. Use a journalistic, calm, and authoritative tone. Structure sentences for easy oral reading: short paragraphs, no complex subordinate clauses.`
                  : `The text will be read by a professional male radio presenter. Write a clear, well-structured news bulletin or announcement. Use a journalistic, calm, and authoritative tone. Structure sentences for easy oral reading: short paragraphs, no complex subordinate clauses.`;
              result = {
                systemPrompt: `Write text for an audio message in a cyber crisis exercise. Context: ${common.scenarioSummary}. Event: ${eventDescription}. Timeline: ${common.timestamp}. Actor: ${common.actorName}, ${common.actorTitle}. ${voiceInstruction} Write in ${common.language}. Reply only with JSON {"title":"...", "text":"..."}.`,
                userPrompt: fieldName ? `Improve field ${fieldName}.` : 'Write the full audio message text.'
              };
              break;
            }
            default:
              result = {
                systemPrompt: `Help create a realistic cyber-crisis stimulus. Context: ${common.scenarioSummary}. Event: ${eventDescription}. Reply only with JSON consistent with channel ${stimulus.channel}.`,
                userPrompt: fieldName ? `Generate a credible value for ${fieldName}.` : 'Generate the full content.'
              };
          }
          if (guidedSuffix) result.systemPrompt += guidedSuffix;
          return result;
        }
      };
