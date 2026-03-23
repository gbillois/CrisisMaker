      function currentLanguage() {
        return appState?.scenario?.settings?.language === 'fr' ? 'fr' : 'en';
      }

      function isFrenchUI() {
        return currentLanguage() === 'fr';
      }

      function tt(en, fr) {
        return isFrenchUI() ? fr : en;
      }

      function setDocumentLanguage() {
        const lang = currentLanguage();
        document.documentElement.lang = lang;
        document.title = tt('CrisisStim by Wavestone - Stimulus Generator', 'CrisisStim by Wavestone - Générateur de stimuli');
      }

      function roleLabel(value) {
        const labels = {
          journalist: ['Journalist', 'Journaliste'],
          authority: ['Authority', 'Autorité'],
          client_b2b: ['B2B Client', 'Client B2B'],
          client_b2c: ['B2C Client', 'Client B2C'],
          internal: ['Internal', 'Interne'],
          partner: ['Partner', 'Partenaire'],
          attacker: ['Attacker', 'Attaquant'],
          analyst: ['Analyst', 'Analyste']
        };
        const [en, fr] = labels[value] || [value, value];
        return tt(en, fr);
      }

      function channelLabel(value) {
        const labels = {
          email_internal: ['Internal email', 'Email interne'],
          email_external: ['External email', 'Email externe'],
          email_authority: ['Authority email', 'Email autorité'],
          article_press: ['Press article', 'Article de presse'],
          breaking_news_tv: ['Breaking News TV', 'Breaking News TV'],
          post_twitter: ['X/Twitter post', 'Post X/Twitter'],
          post_linkedin: ['LinkedIn post', 'Post LinkedIn'],
          post_reddit: ['Reddit post', 'Post Reddit'],
          press_release: ['Press release', 'Communiqué de presse'],
          sms_notification: ['SMS / Notification', 'SMS / Notification'],
          internal_memo: ['Internal memo', 'Note interne']
        };
        const [en, fr] = labels[value] || [value, value];
        return tt(en, fr);
      }

      function uid(prefix = 'id') {
        return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
      }

      function formatLocalDateTime(date) {
        const d = new Date(date);
        const pad = (value) => String(value).padStart(2, '0');
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }

      function defaultScenario() {
        const actors = [
          { id: uid('actor'), name: 'John Carter', role: 'journalist', organization: 'Global Daily', title: 'Cybersecurity reporter', country: 'US', avatar_initials: 'JC', avatar_url: '' },
          { id: uid('actor'), name: 'Claire Martin', role: 'internal', organization: 'Group X', title: 'Cyber crisis director', country: 'FR', avatar_initials: 'CM', avatar_url: '' },
          { id: uid('actor'), name: 'CERT-FR', role: 'authority', organization: 'ANSSI', title: 'Government cyber alert and response center', country: 'FR', avatar_initials: 'CF', avatar_url: '' }
        ];
        const scenario = {
          id: uid('scenario'),
          name: 'Ransomware exercise - ClientX',
          client: { name: 'Client X', sector: 'Banking', country: 'US', logo_url: '' },
          scenario: { type: 'Ransomware', summary: 'A ransomware attack hits the information system of a large listed company. Critical operations are disrupted, the press starts reporting the incident, and authorities are alerted.', start_date: '2026-03-15T08:00', timezone: 'America/New_York' },
          actors,
          stimuli: [],
          settings: { language: 'en', ai_provider: 'anthropic', ai_model: 'claude-sonnet-4-20250514', ai_api_key: '', azure_endpoint: '', azure_api_key: '', azure_deployment: '' }
        };
        const samples = [
          makeStimulus('email_internal', actors[1].id, 0),
          makeStimulus('article_press', actors[0].id, 120, 'lemonde'),
          makeStimulus('article_press', actors[0].id, 125, 'nyt'),
          makeStimulus('post_reddit', actors[0].id, 130),
          makeStimulus('post_twitter', actors[0].id, 135),
          makeStimulus('breaking_news_tv', actors[0].id, 165),
          makeStimulus('email_authority', actors[2].id, 180),
          makeStimulus('press_release', actors[1].id, 240)
        ];
        scenario.stimuli = samples;
        return scenario;
      }

      function makeStimulus(channel, actorId, offsetMinutes, templateId = null) {
        const template = channel === 'article_press'
          ? (ARTICLE_TEMPLATE_LIBRARY[templateId] || ARTICLE_TEMPLATE_LIBRARY[TEMPLATE_LIBRARY.article_press.template_id] || ARTICLE_TEMPLATE_LIBRARY.nyt)
          : (TEMPLATE_LIBRARY[channel] || TEMPLATE_LIBRARY.email_internal);
        return {
          id: uid('stimulus'),
          timestamp_offset_minutes: offsetMinutes,
          channel,
          template_id: template.template_id,
          actor_id: actorId,
          status: 'draft',
          fields: deepClone(template.defaults),
          generated_text: {},
          manual_overrides: {}
        };
      }

      function loadInitialScenario() {
        const saved = localStorage.getItem(STORAGE_KEY);
        const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
        const providerSettings = loadProviderSettings();
        let scenario = defaultScenario();
        if (saved) {
          try {
            scenario = mergeScenario(JSON.parse(saved));
          } catch (error) {
            console.warn(tt('Unable to restore the saved scenario.', 'Impossible de restaurer le scénario sauvegardé.'), error);
          }
        }
        if (settings) {
          scenario.settings = { ...scenario.settings, ...settings };
        }
        scenario.settings = { ...scenario.settings, ...providerSettings };
        normalizeProviderSettingsInPlace(scenario.settings);
        if (!scenario.stimuli.length) scenario.stimuli = [makeStimulus('email_internal', scenario.actors[0]?.id || uid('actor'), 0)];
        return scenario;
      }

      function mergeScenario(input) {
        const base = defaultScenario();
        const merged = {
          ...base,
          ...input,
          client: { ...base.client, ...(input.client || {}) },
          scenario: { ...base.scenario, ...(input.scenario || {}) },
          settings: { ...base.settings, ...(input.settings || {}) },
          actors: Array.isArray(input.actors) && input.actors.length ? input.actors : base.actors,
          stimuli: Array.isArray(input.stimuli) ? input.stimuli.map(normalizeStimulus) : base.stimuli
        };
        normalizeProviderSettingsInPlace(merged.settings);
        return merged;
      }

      function normalizeStimulus(stimulus) {
        const channel = stimulus.channel || 'email_internal';
        const templateId = channel === 'article_press' ? (stimulus.template_id || 'nyt') : (stimulus.template_id || (TEMPLATE_LIBRARY[channel] || TEMPLATE_LIBRARY.email_internal).template_id);
        const library = getTemplateDefinition({ channel, template_id: templateId }) || TEMPLATE_LIBRARY.email_internal;
        return {
          id: stimulus.id || uid('stimulus'),
          timestamp_offset_minutes: Number(stimulus.timestamp_offset_minutes || 0),
          channel,
          template_id: templateId,
          actor_id: stimulus.actor_id || appState?.scenario?.actors?.[0]?.id || '',
          status: stimulus.status || 'draft',
          fields: { ...deepClone(library.defaults), ...(stimulus.fields || {}) },
          generated_text: stimulus.generated_text || {},
          manual_overrides: stimulus.manual_overrides || {}
        };
      }

      function getTemplateDefinition(stimulus) {
        if (stimulus?.channel === 'article_press') return ARTICLE_TEMPLATE_LIBRARY[stimulus.template_id] || ARTICLE_TEMPLATE_LIBRARY.nyt;
        return TEMPLATE_LIBRARY[stimulus?.channel] || TEMPLATE_LIBRARY.email_internal;
      }

      function deepClone(data) {
        return JSON.parse(JSON.stringify(data));
      }
