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
        document.title = tt('CrisisMaker by Wavestone - Crisis exercise studio', 'CrisisMaker by Wavestone - Studio d\'exercices de crise');
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
          { id: uid('actor'), name: 'John Carter', role: 'journalist', organization: 'Global Daily', title: 'Cybersecurity reporter', language: 'en', avatar_initials: 'JC', avatar_url: '' },
          { id: uid('actor'), name: 'Claire Martin', role: 'internal', organization: 'Group X', title: 'Cyber crisis director', language: 'fr', avatar_initials: 'CM', avatar_url: '' },
          { id: uid('actor'), name: 'CERT-FR', role: 'authority', organization: 'ANSSI', title: 'Government cyber alert and response center', language: 'fr', avatar_initials: 'CF', avatar_url: '' }
        ];
        const scenario = {
          id: uid('scenario'),
          name: 'CrisisMaker - Ransomware exercise - ClientX',
          client: { name: 'Client X', sector: 'Banking', language: 'en', logo_url: '' },
          scenario: { type: 'Ransomware', summary: 'A ransomware attack hits the information system of a large listed company. Critical operations are disrupted, the press starts reporting the incident, and authorities are alerted.', detailed_context: '', start_date: '2026-03-15T08:00', timezone: 'America/New_York' },
          actors,
          stimuli: [],
          custom_templates: [],
          settings: { language: 'en', ai_provider: 'anthropic', ai_model: 'claude-sonnet-4-20250514', ai_api_key: '', azure_endpoint: '', azure_api_key: '', azure_deployment: '', max_versions: 3, auto_save_interval_seconds: 30, template_quality: 'basic' }
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

      function emptyScenario(settingsOverrides = {}) {
        const base = defaultScenario();
        return {
          ...base,
          id: uid('scenario'),
          name: '',
          client: { name: '', sector: base.client.sector, language: settingsOverrides.language || 'en', logo_url: '' },
          scenario: { ...base.scenario, type: base.scenario.type, summary: '', detailed_context: '', start_date: '', timezone: base.scenario.timezone },
          actors: [],
          stimuli: [],
          settings: { ...base.settings, ...settingsOverrides }
        };
      }

      function makeStimulus(channel, actorId, offsetMinutes, templateId = null) {
        const template = channel === 'article_press'
          ? (ARTICLE_TEMPLATE_LIBRARY[templateId] || ARTICLE_TEMPLATE_LIBRARY[TEMPLATE_LIBRARY.article_press.template_id] || ARTICLE_TEMPLATE_LIBRARY.nyt)
          : (TEMPLATE_LIBRARY[channel] || TEMPLATE_LIBRARY.email_internal);
        const now = new Date().toISOString();
        return {
          id: uid('stimulus'),
          name: '',
          timestamp_offset_minutes: offsetMinutes,
          channel,
          template_id: template.template_id,
          actor_id: actorId,
          source_label: '',
          generation_mode: 'ai',
          generation_prompt: '',
          status: 'draft',
          created_at: now,
          updated_at: now,
          fields: deepClone(template.defaults),
          generated_text: {},
          manual_overrides: {},
          history: []
        };
      }

      function loadInitialScenario() {
        const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('crisisstim_autosave_v1');
        const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || localStorage.getItem('crisisstim_settings_v1') || 'null');
        const providerSettings = loadProviderSettings();
        let scenario = defaultScenario();
        if (saved) {
          try {
            scenario = mergeScenario(migrateScenario(JSON.parse(saved)));
          } catch (error) {
            console.warn(tt('Unable to restore the saved scenario.', 'Impossible de restaurer le scénario sauvegardé.'), error);
          }
        }
        if (settings) {
          scenario.settings = { ...scenario.settings, ...settings };
        }
        scenario.settings = { ...scenario.settings, ...providerSettings };
        normalizeProviderSettingsInPlace(scenario.settings);
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
          stimuli: Array.isArray(input.stimuli) ? input.stimuli.map(normalizeStimulus) : base.stimuli,
          custom_templates: Array.isArray(input.custom_templates) ? input.custom_templates : []
        };
        normalizeProviderSettingsInPlace(merged.settings);
        return merged;
      }

      function normalizeStimulus(stimulus) {
        const channel = stimulus.channel || 'email_internal';
        const templateId = channel === 'article_press' ? (stimulus.template_id || 'nyt') : (stimulus.template_id || (TEMPLATE_LIBRARY[channel] || TEMPLATE_LIBRARY.email_internal).template_id);
        const library = getTemplateDefinition({ channel, template_id: templateId }) || TEMPLATE_LIBRARY.email_internal;
        const now = new Date().toISOString();
        return {
          id: stimulus.id || uid('stimulus'),
          name: stimulus.name ?? '',
          timestamp_offset_minutes: Number(stimulus.timestamp_offset_minutes || 0),
          channel,
          template_id: templateId,
          actor_id: stimulus.actor_id || appState?.scenario?.actors?.[0]?.id || '',
          source_label: stimulus.source_label || '',
          generation_mode: stimulus.generation_mode || 'ai',
          generation_prompt: stimulus.generation_prompt || '',
          status: stimulus.status || 'draft',
          created_at: stimulus.created_at || now,
          updated_at: stimulus.updated_at || now,
          fields: { ...deepClone(library.defaults), ...(stimulus.fields || {}) },
          generated_text: stimulus.generated_text || {},
          manual_overrides: stimulus.manual_overrides || {},
          history: stimulus.history || []
        };
      }

      function migrateScenario(raw) {
        if (!raw) return raw;
        // country → language on client
        if (raw.client && raw.client.country && !raw.client.language) {
          const map = { FR: 'fr', BE: 'fr', CH: 'fr', CA: 'fr', US: 'en', GB: 'en', DE: 'de', ES: 'es', IT: 'it', PT: 'pt', NL: 'nl' };
          raw.client.language = map[raw.client.country] || 'en';
        }
        // country → language on actors
        if (Array.isArray(raw.actors)) {
          raw.actors = raw.actors.map((actor) => {
            if (actor.country && !actor.language) {
              const map = { FR: 'fr', BE: 'fr', CH: 'fr', CA: 'fr', US: 'en', GB: 'en', DE: 'de', ES: 'es', IT: 'it', PT: 'pt', NL: 'nl' };
              actor.language = map[actor.country] || 'en';
            }
            return actor;
          });
        }
        // Add missing scenario fields
        if (raw.scenario && raw.scenario.detailed_context === undefined) raw.scenario.detailed_context = '';
        // Add missing settings fields
        if (raw.settings) {
          if (!raw.settings.max_versions) raw.settings.max_versions = 3;
          if (!raw.settings.auto_save_interval_seconds) raw.settings.auto_save_interval_seconds = 30;
          if (!raw.settings.template_quality) raw.settings.template_quality = 'basic';
        }
        // Add custom_templates array
        if (!Array.isArray(raw.custom_templates)) raw.custom_templates = [];
        return raw;
      }

      function saveStimulus(stimulus, newFields, changeSummary) {
        if (!stimulus.history) stimulus.history = [];
        const maxVersions = appState?.scenario?.settings?.max_versions || 3;
        stimulus.history.unshift({
          fields: deepClone(stimulus.fields),
          saved_at: new Date().toISOString(),
          change_summary: changeSummary || tt('Manual edit', 'Modification manuelle')
        });
        if (stimulus.history.length > maxVersions) stimulus.history = stimulus.history.slice(0, maxVersions);
        stimulus.fields = deepClone(newFields);
        stimulus.updated_at = new Date().toISOString();
      }

      function restoreVersion(stimulus, versionIndex) {
        const version = stimulus.history[versionIndex];
        if (!version) return;
        saveStimulus(stimulus, version.fields, tt(`Restore version from ${new Date(version.saved_at).toLocaleDateString()}`, `Restauration de la version du ${new Date(version.saved_at).toLocaleDateString()}`));
      }

      function getTemplateDefinition(stimulus) {
        if (stimulus?.channel === 'article_press') return ARTICLE_TEMPLATE_LIBRARY[stimulus.template_id] || ARTICLE_TEMPLATE_LIBRARY.nyt;
        if (TEMPLATE_LIBRARY[stimulus?.channel]) return TEMPLATE_LIBRARY[stimulus.channel];
        // Check custom templates
        const custom = (appState?.scenario?.custom_templates || []).find(
          t => t.template_id === stimulus?.template_id || t.template_id === stimulus?.channel
        );
        if (custom) return custom;
        return TEMPLATE_LIBRARY.email_internal;
      }

      function validateCustomTemplate(data) {
        const errors = [];
        if (!data || typeof data !== 'object') return [tt('Invalid template file.', 'Fichier template invalide.')];
        if (data.schema_version !== '1.0') errors.push(tt('Unsupported schema_version (expected "1.0").', 'schema_version non supporté (attendu "1.0").'));
        if (!data.template_id || typeof data.template_id !== 'string') errors.push(tt('Missing or invalid template_id.', 'template_id manquant ou invalide.'));
        if (!data.name && !data.label) errors.push(tt('Missing name/label.', 'name/label manquant.'));
        if (!data.render_html || typeof data.render_html !== 'string') errors.push(tt('Missing render_html.', 'render_html manquant.'));
        if (typeof data.render_css !== 'undefined' && typeof data.render_css !== 'string') errors.push(tt('render_css must be a string.', 'render_css doit être une chaîne.'));
        if (!Array.isArray(data.fields) || data.fields.length === 0) errors.push(tt('fields must be a non-empty array.', 'fields doit être un tableau non vide.'));
        else {
          const hasRequired = data.fields.some(f => f.required === true);
          if (!hasRequired) errors.push(tt('fields must contain at least one required field.', 'fields doit contenir au moins un champ requis.'));
          // Check render_html contains at least one placeholder matching a declared field
          const fieldNames = data.fields.map(f => f.name || f.key).filter(Boolean);
          const hasPlaceholder = fieldNames.some(name => data.render_html.includes(`{{${name}}}`));
          if (!hasPlaceholder) errors.push(tt('render_html must contain at least one {{field_name}} placeholder.', 'render_html doit contenir au moins un placeholder {{field_name}}.'));
        }
        // Collision check against native template IDs
        const nativeIds = new Set([
          ...Object.keys(ARTICLE_TEMPLATE_LIBRARY),
          ...Object.keys(TEMPLATE_LIBRARY),
          ...Object.keys(CHANNEL_META)
        ]);
        if (data.template_id && nativeIds.has(data.template_id)) {
          errors.push(tt(`template_id "${data.template_id}" collides with a built-in template.`, `template_id "${data.template_id}" entre en collision avec un template natif.`));
        }
        // Channel must be a known channel
        if (data.channel && !CHANNEL_META[data.channel]) {
          errors.push(tt(`Unknown channel "${data.channel}".`, `Canal inconnu "${data.channel}".`));
        }
        // Sanitize CSS: no @import, no url()
        if (data.render_css && (/url\s*\(/i.test(data.render_css) || /@import/i.test(data.render_css))) {
          errors.push(tt('render_css must not contain url() or @import.', 'render_css ne doit pas contenir url() ou @import.'));
        }
        // Sanitize HTML: no <script>, no on* handlers, no <iframe>
        if (data.render_html && (/<script/i.test(data.render_html) || /\bon\w+\s*=/i.test(data.render_html) || /<iframe/i.test(data.render_html))) {
          errors.push(tt('render_html contains forbidden elements (script, iframe, or event handlers).', 'render_html contient des éléments interdits (script, iframe ou gestionnaires d\'événements).'));
        }
        return errors;
      }

      function deepClone(data) {
        return JSON.parse(JSON.stringify(data));
      }

      function isLLMAvailable() {
        const s = appState?.scenario?.settings;
        if (!s) return false;
        if (s.ai_provider === 'azure_openai') {
          return !!(s.azure_api_key?.trim() && s.azure_endpoint?.trim() && s.azure_deployment?.trim());
        }
        return !!(s.ai_api_key?.trim());
      }
