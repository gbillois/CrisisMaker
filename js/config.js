      function field(key, label, type, extra = {}) { return { key, label, type, ...extra }; }

      const STORAGE_KEY = 'crisismaker_autosave_v1';
      const SETTINGS_KEY = 'crisismaker_settings_v1';
      const DEFAULT_MODELS = {
        anthropic: ['claude-sonnet-4-20250514'],
        openai: ['gpt-5.2', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini', 'o3-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini'],
        azure_openai: ['gpt-5.2', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'o3', 'o4-mini', 'o3-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini']
      };
      const PROVIDER_STORAGE_KEYS = {
        aiProvider: 'aiProvider',
        azureEndpoint: 'azureEndpoint',
        azureApiKey: 'azureApiKey',       // legacy key - cleaned up on load
        azureDeployment: 'azureDeployment',
        apiKey: 'crisismaker_api_key',    // dedicated key for API key, separate from project data
        azureApiKeyStore: 'crisismaker_azure_api_key' // dedicated key for Azure API key
      };
      const ROLES = [
        { value: 'journalist', label: 'Journalist' },
        { value: 'authority', label: 'Authority' },
        { value: 'client_b2b', label: 'B2B Client' },
        { value: 'client_b2c', label: 'B2C Client' },
        { value: 'internal', label: 'Internal' },
        { value: 'partner', label: 'Partner' },
        { value: 'attacker', label: 'Attacker' },
        { value: 'analyst', label: 'Analyst' }
      ];
      const LANGUAGES = [
        { value: 'fr', label: 'Français' }, { value: 'en', label: 'English' },
        { value: 'de', label: 'Deutsch' }, { value: 'es', label: 'Español' },
        { value: 'it', label: 'Italiano' }, { value: 'pt', label: 'Português' },
        { value: 'nl', label: 'Nederlands' }, { value: 'ja', label: '日本語' }, { value: 'zh', label: '中文' }
      ];
      const TIMEZONES = ['Europe/Paris', 'Europe/Berlin', 'UTC', 'Europe/London', 'America/New_York'];
      const CHANNEL_META = {
        email_internal: { label: 'Internal email', color: '#2563eb', category: 'Email' },
        email_external: { label: 'External email', color: '#3b82f6', category: 'Email' },
        email_authority: { label: 'Authority email', color: '#0f766e', category: 'Email' },
        article_press: { label: 'Press article', color: '#6b7280', category: 'Press' },
        breaking_news_tv: { label: 'Breaking News TV', color: '#dc2626', category: 'TV' },
        post_twitter: { label: 'X/Twitter post', color: '#16a34a', category: 'Social' },
        post_linkedin: { label: 'LinkedIn post', color: '#0a66c2', category: 'Social' },
        post_reddit: { label: 'Reddit post', color: '#ff4500', category: 'Social' },
        press_release: { label: 'Press release', color: '#7c3aed', category: 'Corporate' },
        sms_notification: { label: 'SMS / Notification', color: '#f59e0b', category: 'Mobile' },
        internal_memo: { label: 'Internal memo', color: '#4b5563', category: 'Corporate' }
      };

      const ARTICLE_TEMPLATE_LIBRARY = {
        lemonde: {
          label: 'Le Monde',
          template_id: 'lemonde',
          defaults: {
            headline: 'Une cyberattaque massive paralyse le groupe pharmaceutique StonaWave',
            subheadline: 'Un rançongiciel a chiffré les systèmes de production et les données cliniques du laboratoire, présent sur trois continents. Le groupe criminel PharmLeaks revendique l\'opération.',
            author: 'Par Florian Music et Martin Untersinger',
            date: '15 mars 2026 à 10h10',
            category: 'Pixels',
            body: '<p>C\'est une attaque d\'une ampleur rare qui frappe le secteur pharmaceutique. Depuis les premières heures de dimanche 15 mars, les systèmes informatiques de StonaWave, géant mondial du médicament dont le siège se trouve en région parisienne, sont largement paralysés par un rançongiciel. Les sites de production de New Jersey, Francfort et Hyderabad fonctionnent en mode dégradé, et les chaînes de fabrication de traitements oncologiques ont été mises à l\'arrêt.</p><p>Selon plusieurs sources proches du dossier, le groupe cybercriminel PharmLeaks, affilié à un réseau d\'opérateurs de rançongiciel bien connu des services de renseignement, a revendiqué l\'attaque en début d\'après-midi, affirmant avoir exfiltré 2,4 téraoctets de données, dont des résultats d\'essais cliniques et des dossiers de patients. Une rançon de 25 millions de dollars en bitcoins est exigée sous 72 heures.</p><p>« La cellule de crise a été activée dès 8 heures du matin. La priorité absolue est la continuité de l\'approvisionnement en médicaments critiques et la protection des données patients », a déclaré un porte-parole de StonaWave, sans préciser de calendrier de rétablissement.</p><p>L\'Agence nationale de la sécurité des systèmes d\'information (ANSSI) a été saisie et le CERT-FR a émis un bulletin d\'alerte liant l\'intrusion à l\'exploitation d\'une vulnérabilité critique sur des concentrateurs VPN. L\'Agence européenne des médicaments (EMA) suit la situation de près, tandis que la FDA américaine a demandé des précisions sur l\'impact potentiel sur la chaîne d\'approvisionnement en médicaments.</p>',
            image_caption: 'Le siège européen de StonaWave, en région parisienne.',
            read_time: '4 min de lecture',
            is_premium: false,
            has_photo: false,
            photo_data: ''
          },
          fields: [field('headline', 'Headline', 'text'), field('subheadline', 'Standfirst', 'textarea'), field('author', 'Author', 'text'), field('date', 'Date', 'text'), field('category', 'Section', 'text'), field('read_time', 'Read time', 'text'), field('is_premium', 'Premium article', 'checkbox'), field('has_photo', 'Show photo', 'checkbox'), field('photo_data', 'Photo', 'photo_upload'), field('image_caption', 'Image caption', 'text'), field('body', 'HTML body', 'textarea')]
        },
        nyt: {
          label: 'The New York Times',
          template_id: 'nyt',
          defaults: {
            headline: 'Ransomware Attack on StonaWave Disrupts Drug Manufacturing Across Three Continents',
            subheadline: 'The criminal group PharmLeaks claims to have stolen 2.4 terabytes of patient and clinical trial data, demanding $25 million. The F.D.A. and European regulators are seeking urgent answers on drug supply continuity.',
            author: 'By Nicole Perlroth and David E. Sanger',
            date: 'March 15, 2026',
            update_time: 'Updated 11:15 a.m. ET',
            category: 'Technology',
            body: '<p>PARIS — A devastating ransomware attack on StonaWave, one of the world\'s largest pharmaceutical companies, has crippled manufacturing execution systems, clinical trial platforms, and supply chain operations across sites in New Jersey, Frankfurt, and Hyderabad, according to company executives and cybersecurity advisers briefed on the response.</p><p>The criminal group PharmLeaks claimed responsibility on Sunday afternoon, stating it had exfiltrated 2.4 terabytes of data — including clinical trial results and patient records — before encrypting the company\'s systems. The group is demanding $25 million in Bitcoin within 72 hours, threatening to publish the stolen data on its leak site if the deadline is not met.</p><p>StonaWave activated its crisis cell before dawn and began isolating compromised network segments. Investigators from the French cybersecurity agency ANSSI and external forensics teams have traced the initial intrusion to a compromised VPN credential, purchased from an initial access broker, that gave the attackers a foothold two weeks before the encryption was triggered.</p><p>”The attackers chose Sunday morning deliberately — minimal staffing, maximum impact window,” said Elise Warren, a senior cybersecurity analyst at Delta Advisory. “The pattern we\'re seeing — VPN access, Active Directory lateral movement, backup mapping, then simultaneous encryption — is consistent with well-resourced ransomware-as-a-service affiliates.”</p><p>The F.D.A. has contacted StonaWave seeking assurances that the disruption will not affect the supply of critical oncology medications, while the European Medicines Agency said it was monitoring the situation closely. StonaWave\'s contract manufacturing partner, MediChem Manufacturing, reported that electronic data interchange links had gone down, raising concerns about downstream drug supply orders already in the pipeline.</p><p>The incident is likely to sharpen regulatory scrutiny of pharmaceutical cybersecurity preparedness as the European Union\'s NIS2 directive enters its enforcement phase and the F.D.A. expands its expectations for manufacturing system resilience.</p>',
            image_caption: 'StonaWave\'s European headquarters outside Paris. The company activated its crisis cell before dawn on Sunday. Credit: Thomas Samson/Agence France-Presse',
            read_time: '6 min read',
            is_premium: false,
            location: 'PARIS',
            has_photo: false,
            photo_data: ''
          },
          fields: [field('headline', 'Headline', 'text'), field('subheadline', 'Subheadline', 'textarea'), field('author', 'Author', 'text'), field('date', 'Date', 'text'), field('update_time', 'Update time', 'text'), field('category', 'Category', 'text'), field('location', 'Location', 'text'), field('read_time', 'Read time', 'text'), field('is_premium', 'Premium article', 'checkbox'), field('has_photo', 'Show photo', 'checkbox'), field('photo_data', 'Photo', 'photo_upload'), field('image_caption', 'Image caption', 'text'), field('body', 'HTML body', 'textarea')]
        },
        faz: {
          label: 'Frankfurter Allgemeine Zeitung',
          template_id: 'faz',
          defaults: {
            kicker: 'Cyberangriff',
            headline: 'Angreifer drohen mit Veröffentlichung gestohlener Patientendaten von StonaWave',
            subheadline: 'Die Hackergruppe PharmLeaks hat nach eigenen Angaben 2,4 Terabyte an Daten erbeutet — darunter Ergebnisse klinischer Studien. Das BSI warnt vor weiteren Angriffen auf den Pharmasektor.',
            author: 'Von Bastian Benrath, Frankfurt',
            date: '15.03.2026',
            time: '13:20 Uhr',
            category: 'Wirtschaft',
            body: '<p>Der Cyberangriff auf den Pharmakonzern StonaWave nimmt eine bedrohliche Wendung: Die kriminelle Gruppe PharmLeaks hat am Sonntagmittag damit gedroht, gestohlene Patientendaten und Ergebnisse klinischer Studien zu veröffentlichen, sollte das Unternehmen nicht innerhalb von 72 Stunden eine Lösegeldforderung in Höhe von 25 Millionen Dollar in Bitcoin begleichen.</p><p>Wie die F.A.Z. aus dem Umfeld der Ermittlungen erfuhr, verschafften sich die Angreifer bereits vor zwei Wochen über gestohlene VPN-Zugangsdaten Zugang zum Unternehmensnetzwerk. Von dort bewegten sie sich unbemerkt durch das Active Directory, kartierten die Backup-Infrastruktur und positionierten die Verschlüsselungssoftware auf Produktionssteuerungssystemen (MES), dem System für klinische Studien (CTMS) und der ERP-Plattform. Die Verschlüsselung wurde am Sonntagmorgen um 7:45 Uhr Ortszeit ausgelöst — gezielt an einem Wochenende mit minimaler Personalbesetzung.</p><p>Das Bundesamt für Sicherheit in der Informationstechnik (BSI) hat eine Warnung herausgegeben, die den Angriff mit der Ausnutzung einer kritischen Schwachstelle in VPN-Konzentratoren in Verbindung bringt. „Der Fall zeigt einmal mehr, dass Unternehmen der kritischen Infrastruktur ihre Angriffsfläche konsequent minimieren müssen”, sagte ein BSI-Sprecher der F.A.Z.</p><p>Am Standort Frankfurt, wo StonaWave ein bedeutendes Produktionswerk betreibt, stehen die Fertigungslinien für Onkologie-Präparate still. Die Europäische Arzneimittel-Agentur (EMA) prüft, ob die Versorgungssicherheit für kritische Medikamente gefährdet ist. Unterdessen hat der Vertragsfertigungspartner MediChem Manufacturing bestätigt, dass die elektronischen Datenaustausch-Verbindungen zu StonaWave seit Sonntagmorgen unterbrochen sind.</p><p>Der Vorfall dürfte die Debatte um die Umsetzung der europäischen NIS2-Richtlinie im Pharmasektor erheblich beschleunigen.</p>',
            image_caption: 'Das Produktionswerk von StonaWave in Frankfurt. Bild: dpa',
            is_faz_plus: true,
            content_type: 'Bericht',
            has_photo: false,
            photo_data: ''
          },
          fields: [field('kicker', 'Kicker', 'text'), field('headline', 'Headline', 'text'), field('subheadline', 'Subheadline', 'textarea'), field('author', 'Author', 'text'), field('date', 'Date', 'text'), field('time', 'Time', 'text'), field('category', 'Category', 'text'), field('content_type', 'Content type', 'select', { options: ['Bericht', 'Analyse', 'Kommentar'] }), field('is_faz_plus', 'F+ article', 'checkbox'), field('has_photo', 'Show photo', 'checkbox'), field('photo_data', 'Photo', 'photo_upload'), field('image_caption', 'Image caption', 'text'), field('body', 'HTML body', 'textarea')]
        },
        ft: {
          label: 'Financial Times',
          template_id: 'ft',
          defaults: {
            headline: 'StonaWave hackers threaten to release patient data as $25mn ransom deadline looms',
            subheadline: 'PharmLeaks ransomware group claims 2.4TB of clinical trial and patient records stolen from pharmaceutical giant.',
            author: 'Hannah Murphy and Robert Smith in London',
            date: 'March 15 2026',
            time: '2:47 pm GMT',
            category: 'Cyber Security',
            body: '<p>StonaWave, one of the world\'s largest pharmaceutical companies, is facing an escalating crisis after the ransomware group PharmLeaks threatened to publish stolen patient data unless a $25mn Bitcoin ransom is paid within 72 hours.</p><p>The group claims to have exfiltrated 2.4 terabytes of data — including clinical trial results and patient records — from StonaWave\'s systems before deploying ransomware that encrypted manufacturing, supply chain, and clinical platforms across sites in three countries on Sunday morning.</p><p>Cyber insurance advisers said the double extortion tactic — combining operational disruption with the threat of data publication — significantly complicated the company\'s response calculus. “The moment patient data is in play, this stops being a pure business continuity question and becomes a regulatory and reputational event,” said one London-based adviser.</p><p>The incident has already triggered outreach from the FDA and the European Medicines Agency, both seeking assurances that critical drug supplies will not be disrupted. StonaWave\'s contract manufacturer MediChem reported that electronic data interchange links had been severed since Sunday morning.</p><p>The attack is expected to accelerate implementation timelines for the EU\'s NIS2 directive in the pharmaceutical sector, where enforcement has lagged behind other critical infrastructure industries.</p>',
            image_caption: 'StonaWave manufacturing operations have been running on contingency procedures since Sunday morning.',
            is_premium: true,
            content_type: 'News',
            has_photo: false,
            photo_data: ''
          },
          fields: [field('headline', 'Headline', 'text'), field('subheadline', 'Subheadline', 'textarea'), field('author', 'Author', 'text'), field('date', 'Date', 'text'), field('time', 'Time', 'text'), field('category', 'Category', 'text'), field('content_type', 'Content type', 'select', { options: ['News', 'Analysis', 'Opinion', 'Exclusive'] }), field('is_premium', 'Premium article', 'checkbox'), field('has_photo', 'Show photo', 'checkbox'), field('photo_data', 'Photo', 'photo_upload'), field('image_caption', 'Image caption', 'text'), field('body', 'HTML body', 'textarea')]
        },
        nikkei: {
          label: '日本経済新聞 (Nikkei)',
          template_id: 'nikkei',
          defaults: {
            headline: '製薬大手StonaWaveにランサムウエア攻撃、犯行グループが患者データ公開を警告',
            subheadline: '3大陸の製造拠点が停止、2500万ドルの身代金を要求',
            author: '田中太郎',
            date: '2026年3月15日 12:30',
            update_time: '14:00更新',
            category: 'テクノロジー',
            body: '<p>グローバル製薬大手のStonaWaveは15日、大規模なランサムウエア攻撃を受け、米ニュージャージー州、ドイツ・フランクフルト、インド・ハイデラバードの製造拠点で生産管理システム（MES）や臨床試験管理システム（CTMS）に深刻な障害が発生したと発表した。</p><p>犯行グループ「PharmLeaks」は同日、2.4テラバイトの患者データおよび臨床試験結果を窃取したと主張し、72時間以内に2500万ドル（約37億円）相当のビットコインを支払わなければデータを公開すると脅迫している。</p><p>フランス情報システムセキュリティ庁（ANSSI）の調査によると、攻撃者はVPN機器の脆弱性を悪用して約2週間前にネットワークに侵入し、Active Directoryを通じて横方向に移動。バックアップインフラを把握した上で日曜早朝に一斉暗号化を実行したとみられる。</p><p>欧州医薬品庁（EMA）は医薬品供給への影響を注視しており、米食品医薬品局（FDA）も抗がん剤の供給継続について確認を求めている。委託製造パートナーのMediChem Manufacturingは電子データ交換（EDI）接続が断絶したことを確認した。</p><p>今回の事案は、EU NIS2指令の施行期限が迫る中、製薬業界のサイバーセキュリティ対策の遅れを改めて浮き彫りにしている。</p>',
            image_caption: 'StonaWaveの欧州本社（パリ近郊）',
            is_premium: false,
            related_tags: 'サイバーセキュリティ,製薬,ランサムウエア,患者データ,PharmLeaks',
            has_photo: false,
            photo_data: ''
          },
          fields: [field('headline', 'Headline (見出し)', 'text'), field('subheadline', 'Subheadline (副見出し)', 'textarea'), field('author', 'Author (記者)', 'text'), field('date', 'Date (日付)', 'text'), field('update_time', 'Update time (更新)', 'text'), field('category', 'Category (カテゴリ)', 'text'), field('is_premium', 'Premium (有料)', 'checkbox'), field('has_photo', 'Show photo (写真を表示)', 'checkbox'), field('photo_data', 'Photo (写真)', 'photo_upload'), field('image_caption', 'Image caption (写真説明)', 'text'), field('related_tags', 'Tags (タグ, comma-separated)', 'text'), field('body', 'HTML body (本文)', 'textarea')]
        }
      };

      const TEMPLATE_LIBRARY = {
        email_internal: {
          label: 'Internal Outlook',
          template_id: 'outlook',
          defaults: {
            from_name: 'Sophie Delacroix',
            from_email: 'sophie.delacroix@stonawave.com',
            to: 'Crisis Committee',
            cc: 'Jean-Luc Moreau (CEO), Thomas Bergmann (IT Director)',
            subject: 'CRITICAL - Ransomware attack confirmed - Crisis cell activated',
            date: formatLocalDateTime(new Date()),
            body: '<p>All,</p><p>The SOC confirmed at 07:52 ET that a ransomware attack is actively encrypting systems across our infrastructure. The encryption appears to have started at approximately 07:45 ET. We have activated the crisis cell and I am declaring a severity-1 incident.</p><p><strong>What we know so far:</strong></p><ul><li>Manufacturing execution systems (MES) at New Jersey, Frankfurt, and Hyderabad are affected</li><li>The clinical trial management system (CTMS) is unreachable</li><li>ERP platforms show signs of encryption in progress</li><li>Active Directory may be compromised — authentication is intermittent</li></ul><p><strong>Immediate actions in progress:</strong></p><ul><li>Network isolation of affected segments has begun</li><li>VPN concentrators are being taken offline as a precaution</li><li>External forensics team (Delta Advisory) has been engaged</li><li>Backup integrity verification is underway</li></ul><p><strong>Instructions to all crisis cell members:</strong></p><ul><li>Do NOT connect to the corporate VPN until further notice</li><li>Do NOT reboot or power off any workstation</li><li>Join the crisis bridge immediately — dial-in details sent via SMS</li><li>Report any unusual activity to the SOC at +33 1 55 00 00 01</li></ul><p>Next situation update at H+1 (09:00 ET).</p><p>Sophie Delacroix<br>CISO — StonaWave</p>',
            has_attachment: true,
            attachment_name: 'Incident_Report_Preliminary.pdf',
            importance: 'high'
          },
          fields: [field('from_name', 'Sender', 'text'), field('from_email', 'Sender email', 'text'), field('to', 'To', 'text'), field('cc', 'Cc', 'text'), field('subject', 'Subject', 'text'), field('date', 'Date', 'text'), field('importance', 'Importance', 'select', { options: ['high', 'normal'] }), field('has_attachment', 'Attachment', 'checkbox'), field('attachment_name', 'Attachment name', 'text'), field('body', 'HTML body', 'textarea')]
        },
        article_press: {
          label: 'Press article',
          template_id: 'nyt',
          defaults: deepClone(ARTICLE_TEMPLATE_LIBRARY.nyt.defaults),
          fields: ARTICLE_TEMPLATE_LIBRARY.nyt.fields
        },
        post_twitter: {
          label: 'Post X/Twitter',
          template_id: 'twitter',
          defaults: {
            display_name: 'Elise Warren',
            handle: '@elise_warren_cyber',
            verified: true,
            verified_type: 'blue',
            avatar_initials: 'EW',
            avatar_color: '#6366f1',
            text: 'BREAKING: StonaWave ransomware attack confirmed. Seeing the same TTP pattern discussed on r/cybersecurity — initial access via compromised VPN creds, lateral movement through AD, then coordinated encryption across MES, CTMS, and ERP.\n\nThree manufacturing sites down across US, Germany, and India. This is a big one.\n\nThe group claiming responsibility (PharmLeaks) is an emerging RaaS affiliate. Watch this space. #cybersecurity #ransomware #pharma',
            date: '10:20 AM · Mar 15, 2026',
            retweets: 2847,
            quotes: 156,
            likes: 8932,
            views: 342000,
            replies: 521,
            has_image: false
          },
          fields: [field('display_name', 'Display name', 'text'), field('handle', 'Handle', 'text'), field('verified', 'Verified account', 'checkbox'), field('verified_type', 'Badge type', 'select', { options: ['blue', 'gold', 'grey'] }), field('avatar_initials', 'Avatar initials', 'text'), field('avatar_color', 'Avatar color', 'text'), field('text', 'Text', 'textarea'), field('date', 'Date', 'text'), field('retweets', 'Reposts', 'number'), field('quotes', 'Quotes', 'number'), field('likes', 'Likes', 'number'), field('views', 'Views', 'number'), field('replies', 'Replies', 'number')]
        },
        post_linkedin: {
          label: 'Post LinkedIn',
          template_id: 'linkedin',
          defaults: {
            display_name: 'Elise Warren',
            title: 'Senior Cybersecurity Analyst at Delta Advisory',
            avatar_initials: 'EW',
            avatar_color: '#6366f1',
            text: 'The StonaWave ransomware incident is a textbook case of what happens when pharmaceutical companies underinvest in segmentation and assume their manufacturing networks are isolated from IT.\n\nPharmLeaks exploited a single compromised VPN credential to reach Active Directory, then moved laterally to manufacturing execution systems, clinical trial platforms, and ERP — all within two weeks, undetected.\n\nThree observations for security leaders:\n\n1. VPN as a single point of failure: without MFA and continuous posture assessment, remote access is an open door for initial access brokers.\n\n2. Backup infrastructure was mapped before encryption: the attackers specifically targeted the recovery path. If your backups share the same AD trust, they are not backups — they are additional targets.\n\n3. The $25M ransom demand with a 72-hour deadline and a data leak threat is classic double extortion. The real cost will be measured in weeks of manufacturing downtime, regulatory penalties under NIS2, and long-term reputational damage.\n\nPharma companies preparing for NIS2 compliance: this is your wake-up call. #cybersecurity #pharma #NIS2 #ransomware #crisismanagement',
            date: '5h',
            reactions_count: 1847,
            comments_count: 234,
            reposts_count: 89,
            reaction_types: ['👍', '💡', '👏']
          },
          fields: [field('display_name', 'Display name', 'text'), field('title', 'Title', 'text'), field('avatar_initials', 'Avatar initials', 'text'), field('avatar_color', 'Avatar color', 'text'), field('text', 'Text', 'textarea'), field('date', 'Relative date', 'text'), field('reactions_count', 'Reactions', 'number'), field('comments_count', 'Comments', 'number'), field('reposts_count', 'Reposts', 'number'), field('reaction_types', 'Reactions (JSON array)', 'textarea')]
        },
        post_reddit: {
          label: 'Reddit post',
          template_id: 'reddit',
          defaults: {
            subreddit: 'r/cybersecurity',
            subreddit_icon_color: '#FF4500',
            author: 'u/threat_intel_analyst',
            author_flair: 'Incident Responder',
            flair_color: '#0079D3',
            post_flair: 'Breaking News',
            post_flair_color: '#FF0000',
            title: 'StonaWave pharma infrastructure going dark — signs of coordinated ransomware across manufacturing sites in US, Germany, and India',
            body: '<p>Multiple sources reporting that StonaWave has invoked full incident response since early Sunday morning. Their manufacturing execution systems (MES), clinical trial management system (CTMS), and ERP platforms appear to be encrypted across New Jersey, Frankfurt, and Hyderabad sites.</p><p>The TTP pattern looks familiar to anyone following RaaS affiliates in western Europe: initial access via compromised VPN credentials (likely purchased from an IAB), quiet lateral movement through Active Directory over ~2 weeks, backup infrastructure mapped, then simultaneous encryption triggered at 07:45 ET on a Sunday when staffing is minimal.</p><p>If anyone has IOCs tied to the access brokers active in the pharma sector this month, please share what you can confirm. Particularly interested in whether others are seeing the same AD lateral movement patterns.</p><p><strong>What we know so far:</strong></p><ul><li>Manufacturing sites running on contingency/manual procedures</li><li>VPN concentrators taken offline</li><li>Contract manufacturer MediChem reports EDI links severed</li><li>No official statement from StonaWave yet</li></ul>',
            link_url: '',
            link_domain: '',
            upvotes: 6234,
            upvote_ratio: '97% upvoted',
            comments_count: 1247,
            awards: ['gold', 'silver', 'helpful'],
            date: '2 hours ago',
            is_pinned: false,
            top_comment: { author: 'u/soc_manager_42', flair: 'SOC Lead', text: 'Can confirm — two of our pharma clients have started isolating their StonaWave EDI/API connections as a precaution. MediChem is reportedly scrambling to reroute supply chain orders manually. This is going to have downstream impact on drug supply within days if manufacturing doesn\'t come back online.', upvotes: 2891, date: '1 hour ago' }
          },
          fields: [field('subreddit', 'Subreddit', 'text'), field('subreddit_icon_color', 'Subreddit icon color', 'text'), field('author', 'Author', 'text'), field('author_flair', 'Author flair', 'text'), field('flair_color', 'Author flair color', 'text'), field('post_flair', 'Post flair', 'text'), field('post_flair_color', 'Post flair color', 'text'), field('title', 'Title', 'text'), field('body', 'HTML body', 'textarea'), field('link_url', 'Link URL', 'text'), field('link_domain', 'Link domain', 'text'), field('upvotes', 'Upvotes', 'number'), field('upvote_ratio', 'Upvote ratio', 'text'), field('comments_count', 'Comments', 'number'), field('awards', 'Awards (JSON array)', 'textarea'), field('date', 'Relative date', 'text'), field('is_pinned', 'Pinned post', 'checkbox'), field('top_comment', 'Top comment (JSON object)', 'textarea')]
        },
        breaking_news_tv: {
          label: 'Breaking news banner',
          template_id: 'bfm',
          defaults: {
            headline: 'CYBERATTACK ON STONAWAVE: DRUG PRODUCTION HALTED',
            subline: 'Hackers demand $25M ransom and threaten to publish stolen patient data',
            ticker: 'PharmLeaks ransomware group claims 2.4TB of patient data stolen from StonaWave - Manufacturing halted at sites in New Jersey, Frankfurt, and Hyderabad - FDA and EMA seeking urgent answers on drug supply - CERT-FR links attack to critical VPN vulnerability - Company activates crisis cell, engages external forensics',
            time: '11:30',
            category: 'BREAKING NEWS'
          },
          fields: [field('headline', 'Headline', 'text'), field('subline', 'Subheadline', 'text'), field('ticker', 'Ticker', 'textarea'), field('time', 'Time', 'text'), field('category', 'Category', 'text')]
        },
        email_authority: {
          label: 'ANSSI / CERT-FR alert',
          template_id: 'anssi',
          defaults: {
            reference: 'CERTFR-2026-ALE-003',
            from_name: 'CERT-FR',
            from_email: 'cert-fr@ssi.gouv.fr',
            to: 'Sophie Delacroix, CISO — StonaWave',
            subject: 'ALERT — Active exploitation of CVE-2026-21337 linked to StonaWave incident',
            date: 'March 15, 2026',
            body: '<p>Madam,</p><p>CERT-FR has established a link between the incident affecting your organization and the active exploitation of the critical vulnerability <strong>CVE-2026-21337</strong> (CVSS 9.8) affecting VPN concentrators from multiple vendors.</p><p><strong>Attack pattern observed:</strong></p><ul><li>Exploitation of CVE-2026-21337 on internet-exposed VPN appliances to obtain valid session tokens</li><li>Use of stolen credentials to authenticate to Active Directory and establish persistence</li><li>Lateral movement via administrative shares and RDP, targeting backup infrastructure and manufacturing systems</li><li>Pre-positioning of ransomware payloads on MES, CTMS, and ERP platforms before coordinated encryption</li></ul><p><strong>Indicators of compromise:</strong></p><ul><li>C2 domains: <code>update-service-cdn[.]net</code>, <code>pharma-sync-api[.]com</code></li><li>SHA256 (ransomware payload): <code>a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1</code></li><li>Tor payment portal: <code>pharmleaks[.]onion</code></li></ul><p><strong>Immediate recommendations:</strong></p><ul><li>Isolate all VPN concentrators and apply vendor patches for CVE-2026-21337</li><li>Reset all Active Directory credentials, starting with privileged accounts</li><li>Verify backup integrity from offline or immutable copies only</li><li>Search for the above IOCs across your entire infrastructure</li><li>Preserve all forensic evidence and logs for judicial proceedings</li></ul><p>CERT-FR remains at your disposal to coordinate the response. Please communicate any additional IOCs identified during your investigation.</p>',
            severity: 'critical'
          },
          fields: [field('reference', 'Reference', 'text'), field('from_name', 'Sender name', 'text'), field('from_email', 'Sender email', 'text'), field('to', 'Recipient', 'text'), field('subject', 'Subject', 'text'), field('date', 'Date', 'text'), field('severity', 'Severity', 'select', { options: ['critical', 'high', 'medium'] }), field('body', 'HTML body', 'textarea')]
        },
        press_release: {
          label: 'Press release',
          template_id: 'press_release',
          defaults: {
            organization: 'StonaWave',
            logo_text: 'STONAWAVE',
            logo_color: '#003366',
            has_logo: false,
            logo_image: '',
            date: 'Paris, March 15, 2026 — 12:30 p.m. ET',
            title: 'StonaWave confirms cybersecurity incident — patient safety and drug supply continuity are the absolute priority',
            body: '<p>StonaWave confirms that it has been the target of a cybersecurity incident that was detected in the early hours of Sunday, March 15, 2026. The incident has affected parts of the company\'s information systems, including certain manufacturing and supply chain platforms.</p><p>Upon detection, StonaWave immediately activated its crisis management procedures and engaged leading external cybersecurity experts to assist with the investigation and response. The company has taken precautionary measures to contain the incident, including the isolation of affected systems.</p><p>StonaWave is working closely with the relevant health and cybersecurity authorities, including ANSSI (the French National Cybersecurity Agency), the European Medicines Agency (EMA), and the U.S. Food and Drug Administration (FDA), to ensure full transparency and coordination.</p><p><strong>Key facts:</strong></p><ul><li>Patient safety remains our absolute priority. At this stage, there is no confirmed impact on the integrity of manufactured products.</li><li>Critical manufacturing operations are being maintained through adapted contingency procedures.</li><li>Our teams are working around the clock to progressively restore affected systems.</li><li>We are conducting a thorough investigation to determine the full scope of the incident.</li></ul><p>StonaWave will provide regular updates as the situation evolves and the investigation progresses. The company is committed to acting with full transparency toward its patients, partners, regulators, and stakeholders.</p>',
            contact_name: 'StonaWave Communications Office',
            contact_email: 'press@stonawave.com',
            contact_phone: '+33 1 55 00 00 00'
          },
          fields: [field('organization', 'Organization', 'text'), field('logo_text', 'Logo text', 'text'), field('logo_color', 'Logo color', 'text'), field('has_logo', 'Use logo image', 'checkbox'), field('logo_image', 'Logo image', 'photo_upload'), field('date', 'Date', 'text'), field('title', 'Title', 'text'), field('body', 'HTML body', 'textarea'), field('contact_name', 'Contact', 'text'), field('contact_email', 'Contact email', 'text'), field('contact_phone', 'Phone', 'text')]
        },
        email_external: {
          label: 'External email',
          template_id: 'generic',
          defaults: {
            from_name: 'David Chen',
            from_email: 'david.chen@medichem-mfg.com',
            to: 'sophie.delacroix@stonawave.com',
            cc: 'supply.chain@stonawave.com',
            subject: 'URGENT — EDI/API links down since 08:00 ET — impact on drug supply orders',
            date: formatLocalDateTime(new Date()),
            body: '<p>Dear Sophie,</p><p>I am writing to alert you that all electronic data interchange (EDI) and API connections between MediChem Manufacturing and StonaWave have been down since approximately 08:00 ET this morning. Our monitoring systems flagged the disconnection and our teams have been unable to re-establish connectivity.</p><p><strong>Immediate impact on our side:</strong></p><ul><li>12 active drug supply orders currently in the manufacturing pipeline cannot be confirmed or updated</li><li>Quality release documentation for 3 oncology batches scheduled for shipment Monday is inaccessible</li><li>Automated inventory replenishment feeds from your ERP have stopped</li></ul><p>We have switched to manual tracking procedures as a precaution, but we need an urgent status update from your team to understand:</p><ol><li>The expected duration of the disruption</li><li>Whether we should activate our business continuity protocol for alternative order processing</li><li>Whether there is any risk to the integrity of data exchanged prior to the disconnection</li></ol><p>Please let me know the best way to coordinate. I am available on my mobile at +1 (201) 555-0147 at any time.</p><p>Best regards,<br>David Chen<br>VP Supply Chain Operations — MediChem Manufacturing</p>',
            has_attachment: false,
            attachment_name: '',
            importance: 'high'
          },
          fields: [field('from_name', 'Sender', 'text'), field('from_email', 'Sender email', 'text'), field('to', 'To', 'text'), field('cc', 'Cc', 'text'), field('subject', 'Subject', 'text'), field('date', 'Date', 'text'), field('importance', 'Importance', 'select', { options: ['high', 'normal'] }), field('has_attachment', 'Attachment', 'checkbox'), field('attachment_name', 'Attachment name', 'text'), field('body', 'HTML body', 'textarea')]
        },
        internal_memo: {
          label: 'Internal memo',
          template_id: 'memo',
          defaults: {
            from_name: 'Jean-Luc Moreau, Chief Executive Officer',
            to: 'All StonaWave employees worldwide',
            subject: 'Message from the CEO — Cybersecurity incident and immediate instructions',
            date: formatLocalDateTime(new Date()),
            body: '<p>Dear colleagues,</p><p>As some of you may already be aware, StonaWave has been the target of a serious cybersecurity incident that was detected early this morning. Our crisis management team, IT department, and external cybersecurity experts have been working non-stop since the first hours to contain the situation and protect our systems.</p><p>I want to be transparent with you: this is a significant event that will require time and effort to resolve fully. However, I also want to reassure you that we are taking every necessary measure and that our priority remains the safety of our patients, the continuity of our operations, and the protection of your data.</p><p><strong>What you need to do right now:</strong></p><ul><li><strong>Do NOT connect to the corporate VPN</strong> until the IT team confirms it is safe to do so</li><li><strong>Do NOT discuss the incident</strong> on social media, with the press, or with external contacts — all communications are being handled by our Communications Office</li><li><strong>Do NOT use personal devices</strong> to access corporate systems or data</li><li><strong>Report any suspicious activity</strong> to the IT helpdesk at helpdesk@stonawave.com or +33 1 55 00 00 02</li><li><strong>Remote work is temporarily suspended</strong> for roles requiring access to affected systems — your manager will provide specific guidance</li></ul><p>I will send a follow-up communication this afternoon with an update on the situation. In the meantime, please follow the instructions above and reach out to your manager if you have questions about your specific role.</p><p>Thank you for your patience and professionalism during this difficult time.</p><p>Jean-Luc Moreau<br>Chief Executive Officer — StonaWave</p>',
            classification: 'Confidential'
          },
          fields: [field('from_name', 'From', 'text'), field('to', 'To', 'text'), field('subject', 'Subject', 'text'), field('date', 'Date', 'text'), field('classification', 'Classification', 'select', { options: ['Confidential', 'Internal', 'Restricted'] }), field('body', 'HTML body', 'textarea')]
        },
        sms_notification: {
          label: 'SMS / Notification',
          template_id: 'sms',
          defaults: {
            sender: 'StonaWave Crisis',
            text: 'EMERGENCY — Ransomware attack confirmed. Join crisis bridge NOW: +33 1 55 00 00 99 / PIN 4471. Do NOT connect to corporate VPN. Await instructions. — CISO',
            time: '08:30',
            device: 'iphone'
          },
          fields: [field('sender', 'Sender', 'text'), field('text', 'Text', 'textarea'), field('time', 'Time', 'text'), field('device', 'Device', 'select', { options: ['iphone', 'android'] })]
        }
      };
