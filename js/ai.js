      const AITextGenerator = {
        async testConnection() {
          const { ai_provider, ai_api_key, azure_endpoint, azure_api_key, azure_deployment } = appState.scenario.settings;
          if (['anthropic', 'openai'].includes(ai_provider) && !ai_api_key) {
            throw new Error(ai_provider === 'openai'
              ? tt('Please enter an OpenAI API key before testing the connection.', 'Veuillez saisir une clé API OpenAI avant de tester la connexion.')
              : tt('Please enter an Anthropic API key before testing the connection.', 'Veuillez saisir une clé API Anthropic avant de tester la connexion.'));
          }
          if (ai_provider === 'azure_openai') {
            if (!azure_endpoint || !azure_api_key || !azure_deployment) throw new Error(tt('Please provide the Azure endpoint, API key, and deployment name before testing the connection.', 'Veuillez renseigner l’endpoint, la clé API et le déploiement Azure avant de tester la connexion.'));
          }
          const prompt = 'Reply only with a JSON object {"ok": true, "message": "valid connection"}';
          return this.generate('settings_test', prompt, null, true);
        },
        async generateForStimulus(stimulus, fieldName = null, guidedPrompt = null) {
          const actor = getActor(stimulus.actor_id);
          const promptInfo = PromptBuilder.forStimulus(stimulus, actor, appState.scenario, fieldName, guidedPrompt);
          return this.generate(stimulus.channel, promptInfo.systemPrompt, promptInfo.userPrompt);
        },
        async generate(channel, systemPrompt, userPrompt = null, quiet = false) {
          const { ai_provider, ai_api_key, ai_model, azure_endpoint, azure_api_key, azure_deployment } = appState.scenario.settings;
          if (ai_provider === 'anthropic' && !ai_api_key) throw new Error(tt('Missing Anthropic API key.', 'Clé API Anthropic manquante.'));
          if (ai_provider === 'openai' && !ai_api_key) throw new Error(tt('Missing OpenAI API key.', 'Clé API OpenAI manquante.'));
          if (ai_provider === 'azure_openai') {
            if (!azure_endpoint || !azure_api_key || !azure_deployment) throw new Error(tt('Incomplete Azure OpenAI configuration.', 'Configuration Azure OpenAI incomplète.'));
            const normalizedEndpoint = azure_endpoint.replace(/\/+$/, '');
            const response = await fetch(`${normalizedEndpoint}/openai/deployments/${encodeURIComponent(azure_deployment)}/chat/completions?api-version=2024-02-01`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'api-key': azure_api_key },
              body: JSON.stringify({ temperature: 0.8, messages: [{ role: 'system', content: systemPrompt }, ...(userPrompt ? [{ role: 'user', content: userPrompt }] : [{ role: 'user', content: 'Reply in strict JSON.' }])] })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Erreur API Azure OpenAI');
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error(tt('Empty Azure OpenAI response.', 'Réponse Azure OpenAI vide.'));
            const parsed = JSON.parse(content);
            if (!quiet) pushToast(tt('Content generated with Azure OpenAI.', 'Contenu généré avec Azure OpenAI.'), 'success');
            return parsed;
          }
          if (ai_provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': ai_api_key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
              body: JSON.stringify({ model: ai_model, max_tokens: 2000, system: systemPrompt, messages: [{ role: 'user', content: userPrompt || 'Reply in strict JSON.' }] })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Erreur API Anthropic');
            const text = data.content?.[0]?.text || '{}';
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) throw new Error(tt('Anthropic response was not valid JSON.', 'Réponse Anthropic non JSON.'));
            const parsed = JSON.parse(match[0]);
            if (!quiet) pushToast(tt('Content generated with Anthropic.', 'Contenu généré avec Anthropic.'), 'success');
            return parsed;
          }
          if (ai_provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai_api_key}` },
              body: JSON.stringify({
                model: ai_model,
                temperature: 0.8,
                response_format: { type: 'json_object' },
                messages: [{ role: 'system', content: systemPrompt }, ...(userPrompt ? [{ role: 'user', content: userPrompt }] : [{ role: 'user', content: 'Reply in strict JSON.' }])]
              })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error(tt('Empty OpenAI response.', 'Réponse OpenAI vide.'));
            const parsed = JSON.parse(content);
            if (!quiet) pushToast(tt('Content generated with OpenAI.', 'Contenu généré avec OpenAI.'), 'success');
            return parsed;
          }
          throw new Error(tt(`Unsupported provider: ${ai_provider}`, `Fournisseur non supporté : ${ai_provider}`));
        }
      };

      const PromptBuilder = {
        forStimulus(stimulus, actor, scenario, fieldName = null, guidedPrompt = null) {
          const common = {
            scenarioSummary: scenario.scenario.summary,
            timestamp: `H+${stimulus.timestamp_offset_minutes} minutes`,
            actorName: actor?.name || 'Spokesperson',
            actorTitle: actor?.title || 'Lead',
            actorRole: actor?.role || 'internal',
            language: scenario.settings.language === 'fr' ? 'French' : 'English'
          };
          const eventDescription = stimulus.fields.subject || stimulus.fields.headline || stimulus.fields.text || stimulus.fields.title || 'New development in the cyber crisis';
          const guidedSuffix = guidedPrompt ? ` Additional instruction from the operator: ${guidedPrompt}` : '';
          let result;
          switch (stimulus.channel) {
            case 'article_press': {
              const variant = stimulus.template_id || 'nyt';
              const pressPrompts = {
                nyt: `You are a New York Times journalist in the ${stimulus.fields.category || 'Technology'} section. Write in American English about a cyber security incident. Scenario: ${common.scenarioSummary}. Event: ${eventDescription}. Timeline: ${common.timestamp}. Instructions: factual headline with no final punctuation, one-sentence subheadline, byline formatted "By Firstname Lastname and Firstname Lastname", body of 4-5 HTML paragraphs in NYT style with the first paragraph summarising who/what/when/where/why, include 1-2 fictional expert or spokesperson quotes, include location in caps if relevant, calm authoritative tone, never mention this is an exercise. Reply only with JSON containing headline, subheadline, author, body, image_caption.`,
                faz: `Du bist Journalist der Frankfurter Allgemeinen Zeitung, Ressort ${stimulus.fields.category || 'Wirtschaft'}. Du schreibst auf Deutsch über einen Cybersicherheitsvorfall. Kontext: ${common.scenarioSummary}. Ereignis: ${eventDescription}. Zeitpunkt: ${common.timestamp}. Vorgaben: Kicker mit 1-2 Wörtern, sachliche präzise Überschrift im Stil der F.A.Z., Subheadline mit systemischer oder regulatorischer Einordnung, Byline im Format "Von Vorname Nachname, Stadt", 4-5 dichte HTML-Absätze mit langen strukturierten Sätzen, Verweise auf DORA/NIS2/BSI wenn relevant, 1-2 fiktive Zitate, nüchterner analytischer Ton, nie erwähnen, dass es eine Übung ist. Antworte nur mit JSON mit kicker, headline, subheadline, author, body, content_type, image_caption.`,
                ft: `You are a Financial Times journalist covering ${stimulus.fields.category || 'Cyber Security'}. Write in British English about a cyber security incident. Scenario: ${common.scenarioSummary}. Event: ${eventDescription}. Timeline: ${common.timestamp}. Instructions: factual headline with no final punctuation, analytical subheadline, byline formatted "Firstname Lastname and Firstname Lastname in City", 4-5 HTML paragraphs with concise first paragraph and subsequent financial, regulatory and market context, include 1-2 fictional quotes, sober FT tone, never mention this is an exercise. Reply only with JSON containing headline, subheadline, author, body, content_type, image_caption.`,
                lemonde: `You are a Le Monde journalist writing in French about a cyber crisis. Context: ${common.scenarioSummary}. Event: ${eventDescription}. Timeline: ${common.timestamp}. Instructions: factual headline, concise standfirst, 3-4 HTML paragraphs, one fictional quote, serious newspaper tone, never mention this is an exercise. Reply only with JSON containing headline, subheadline, author, body, image_caption.`
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
              const redditLanguage = /^r\/(france|francais|cybersecurite)$/i.test(subreddit) ? 'French' : 'English';
              const postType = stimulus.fields.link_url ? 'link' : 'text';
              result = {
                systemPrompt: `Generate a realistic Reddit post for ${subreddit} about a cyber security incident. Scenario: ${common.scenarioSummary}. Event: ${eventDescription}. Simulated author: ${common.actorName}, ${common.actorTitle}. Post type: ${postType}. Instructions: catchy but informative title, ${postType === 'text' ? '100-300 words of authentic Reddit-style HTML body with community-specific tone, optional technical acronyms, questions or field observations.' : 'no body text, title should summarise the linked article.'} Pick a relevant post flair such as Breaking News, Threat Intel, Discussion or Incident Response. Language must be ${redditLanguage}. If a top comment is needed, include an informal complementary comment with author and flair. Never mention this is an exercise. Reply only with JSON containing title, body, post_flair, top_comment.`,
                userPrompt: fieldName ? `Improve field ${fieldName} while keeping the JSON schema.` : 'Write the Reddit post.'
              };
              break;
            }
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
