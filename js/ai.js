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
        async generateScenario(userInput) {
          const { systemPrompt, userPrompt } = LLMConfigPrompts.scenario(userInput);
          return this.generate('llm_config_scenario', systemPrompt, userPrompt);
        },
        async generateActors(userInput, scenario) {
          const { systemPrompt, userPrompt } = LLMConfigPrompts.actors(userInput, scenario);
          return this.generate('llm_config_actors', systemPrompt, userPrompt);
        },
        async generateStimulusConfig(userInput, scenario, actors) {
          const { systemPrompt, userPrompt } = LLMConfigPrompts.stimulus(userInput, scenario, actors);
          return this.generate('llm_config_stimulus', systemPrompt, userPrompt);
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
              body: JSON.stringify({ messages: [{ role: 'system', content: systemPrompt }, ...(userPrompt ? [{ role: 'user', content: userPrompt }] : [{ role: 'user', content: 'Reply in strict JSON.' }])] })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Erreur API Azure OpenAI');
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error(tt('Empty Azure OpenAI response.', 'Réponse Azure OpenAI vide.'));
            const parsed = parseLLMJson(content);
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
            const parsed = parseLLMJson(text);
            if (!quiet) pushToast(tt('Content generated with Anthropic.', 'Contenu généré avec Anthropic.'), 'success');
            return parsed;
          }
          if (ai_provider === 'openai') {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ai_api_key}` },
              body: JSON.stringify({
                model: ai_model,
                messages: [{ role: 'system', content: systemPrompt }, ...(userPrompt ? [{ role: 'user', content: userPrompt }] : [{ role: 'user', content: 'Reply in strict JSON.' }])]
              })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'OpenAI API error');
            const content = data.choices?.[0]?.message?.content;
            if (!content) throw new Error(tt('Empty OpenAI response.', 'Réponse OpenAI vide.'));
            const parsed = parseLLMJson(content);
            if (!quiet) pushToast(tt('Content generated with OpenAI.', 'Contenu généré avec OpenAI.'), 'success');
            return parsed;
          }
          throw new Error(tt(`Unsupported provider: ${ai_provider}`, `Fournisseur non supporté : ${ai_provider}`));
        }
      };

      const LLMConfigPrompts = {
        scenario(userInput) {
          const today = new Date().toISOString().slice(0, 10);
          return {
            systemPrompt: `Tu es un assistant spécialisé dans la préparation d'exercices de crise cybersécurité.
L'utilisateur décrit un scénario en langage naturel. Tu dois extraire et structurer les informations pour configurer l'exercice.

CONSIGNES :
- Extrais toutes les informations mentionnées par l'utilisateur
- Pour les informations NON mentionnées, INVENTE des valeurs réalistes et cohérentes avec le contexte décrit
- Le champ "summary" doit être un résumé professionnel de 3-5 phrases du scénario
- Le champ "detailed_context" doit développer avec des détails techniques plausibles (vecteur d'attaque, systèmes affectés, chronologie)
- La langue du client doit correspondre au pays/contexte mentionné (entreprise française → "fr", entreprise allemande → "de", etc.)
- Si aucune date n'est mentionnée, utilise la date du jour (${today})
- Si aucun fuseau horaire n'est mentionné, déduis-le du pays

Réponds UNIQUEMENT avec un objet JSON respectant exactement cette structure :
{
  "client": {
    "name": "Nom de l'organisation",
    "sector": "Banking | Energy | Healthcare | Transport | Industry | Telecom | Retail | Public sector | Other",
    "language": "fr | en | de | es | it | pt | nl | ja | zh"
  },
  "scenario": {
    "type": "Ransomware | Data Breach | Supply Chain | DDoS | Insider Threat | Other",
    "summary": "Résumé professionnel de 3-5 phrases",
    "detailed_context": "Contexte détaillé avec informations techniques plausibles (1-2 paragraphes)",
    "start_date": "2026-03-15T08:00:00",
    "timezone": "Europe/Paris"
  }
}`,
            userPrompt: `DESCRIPTION DE L'UTILISATEUR :\n${userInput}`
          };
        },
        actors(userInput, scenario) {
          return {
            systemPrompt: `Tu es un assistant spécialisé dans la préparation d'exercices de crise cybersécurité.
L'utilisateur décrit les acteurs qu'il souhaite pour son exercice. Tu dois générer une liste d'acteurs structurée.

CONTEXTE DU SCÉNARIO :
- Client : ${scenario.client.name} (${scenario.client.sector}), langue : ${scenario.client.language}
- Scénario : ${scenario.scenario.summary}
- Type : ${scenario.scenario.type}

CONSIGNES :
- Génère les acteurs décrits par l'utilisateur avec des noms fictifs réalistes
- Pour les détails NON mentionnés (noms, titres exacts, organisations), INVENTE des valeurs réalistes et cohérentes
- Si l'utilisateur demande vaguement "des journalistes" ou "des acteurs réalistes", crée un jeu complet et équilibré d'au moins 6 acteurs
- Chaque acteur doit avoir un nom cohérent avec sa langue/pays
- La langue de chaque acteur correspond à sa zone d'activité

Réponds UNIQUEMENT avec un tableau JSON :
[
  {
    "name": "Prénom Nom",
    "role": "journalist | authority | client_b2b | client_b2c | internal | partner | attacker | analyst",
    "organization": "Nom de l'organisation",
    "title": "Titre / fonction",
    "language": "fr | en | de | es | it"
  }
]`,
            userPrompt: `DESCRIPTION DES ACTEURS :\n${userInput}`
          };
        },
        stimulus(userInput, scenario, actors) {
          const actorsList = actors.map((a) => ({ name: a.name, role: a.role, organization: a.organization, language: a.language }));
          return {
            systemPrompt: `Tu es un assistant spécialisé dans la préparation d'exercices de crise cybersécurité.
L'utilisateur décrit un ou plusieurs stimuli (messages de crise). Tu dois extraire la configuration ET générer le contenu.

CONTEXTE DU SCÉNARIO :
- Client : ${scenario.client.name} (${scenario.client.sector}), langue : ${scenario.client.language}
- Scénario : ${scenario.scenario.summary}
- Contexte détaillé : ${scenario.scenario.detailed_context || 'Non renseigné'}
- Acteurs disponibles : ${JSON.stringify(actorsList)}

TEMPLATES DISPONIBLES :
- article_press : lemonde, nyt, faz, ft
- email_internal : outlook
- email_external : generic
- email_authority : anssi
- post_twitter : twitter
- post_linkedin : linkedin
- post_reddit : reddit
- breaking_news_tv : bfm
- press_release : generic_pr
- sms_notification : sms
- internal_memo : memo

CONSIGNES :
- Détermine le canal et le template les plus adaptés à la description
- Si un acteur est mentionné ou correspond à la description, mets son nom dans actor_id (le code fera la résolution)
- Pour la position timeline, interprète "H+2" comme 120 minutes, "H+30" comme 30, etc. Si non mentionné, utilise 0
- Si l'utilisateur demande un lot ("crée 30 stimuli…" avec des catégories), retourne EXACTEMENT le nombre demandé et répartis les timestamps de façon crédible si aucun horaire précis n'est donné
- Pour les stimuli externes ("client", "regulator", "press", etc.), alterne les acteurs/sources pour refléter la répartition demandée
- Génère le contenu des champs dans la LANGUE NATIVE DU MÉDIA
- Pour les informations NON mentionnées, INVENTE des détails réalistes cohérents
- Le champ generation_mode doit être "ai_guided"
- Si l'utilisateur décrit PLUSIEURS stimuli, retourne un TABLEAU JSON d'objets. Si UN SEUL stimulus, retourne un objet unique.

Format d'un stimulus :
{
  "channel": "article_press | email_internal | post_twitter | ...",
  "template_id": "lemonde | nyt | outlook | twitter | ...",
  "actor_id": "nom de l'acteur ou null",
  "source_label": "label si pas d'acteur",
  "timestamp_offset_minutes": 120,
  "generation_mode": "ai_guided",
  "generation_prompt": "description originale de l'utilisateur",
  "fields": {}
}`,
            userPrompt: `DESCRIPTION DU STIMULUS :\n${userInput}`
          };
        }
      };

      function parseLLMJson(text) {
        const trimmed = String(text || '').trim();
        if (!trimmed) throw new Error(tt('LLM response was empty.', 'La réponse du LLM était vide.'));
        try {
          return JSON.parse(trimmed);
        } catch (err) {
          const match = trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
          if (!match) throw new Error(tt('LLM response was not valid JSON.', 'La réponse du LLM n’était pas un JSON valide.'));
          return JSON.parse(match[0]);
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
