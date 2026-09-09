function renderExercisePlan() {
  const s = appState.scenario.scenario;
  return `<article class="card"><h3>${tt('Exercise plan', 'Plan de l’exercice', 'Übungsplan')}</h3>
    <label class="field">${tt('Exercise objectives', 'Objectifs de l’exercice', 'Übungsziele')}<textarea data-bind="scenario.objectives" placeholder="${tt('Decisions and capabilities to test', 'Décisions et capacités à tester', 'Zu testende Entscheidungen und Fähigkeiten')}">${escapeHtml(s.objectives || '')}</textarea></label>
    <label class="field">${tt('Narrative arc', 'Arc narratif', 'Handlungsbogen')}<textarea data-bind="scenario.narrative_arc">${escapeHtml(s.narrative_arc || '')}</textarea></label>
    ${(s.phases || []).length ? `<div class="agent-phases">${s.phases.map(p => `<div><strong>T+${escapeHtml(p.start_minutes)}–${escapeHtml(p.end_minutes)} · ${escapeHtml(p.name)}</strong><p>${escapeHtml(p.purpose)}</p></div>`).join('')}</div>` : `<p class="subtle">${tt('The agent can organize timed phases from your brief.', 'L’agent peut organiser les phases à partir de votre brief.', 'Der Agent kann zeitliche Phasen aus Ihrem Briefing erstellen.')}</p>`}
  </article>`;
}
function renderAgentView() {
  const run = getCrisisAgent(), disabled = run.active || run.busy ? 'disabled' : '';
  const status = { idle: tt('Ready', 'Prêt', 'Bereit'), running: tt('Working', 'En cours', 'Aktiv'), approval: tt('Awaiting approval', 'Validation requise', 'Freigabe erforderlich'), stopped: tt('Stopped', 'Arrêté', 'Gestoppt'), complete: tt('Complete', 'Terminé', 'Abgeschlossen'), failed: tt('Failed', 'Échec', 'Fehlgeschlagen'), limit: tt('Limit reached', 'Limite atteinte', 'Limit erreicht') };
  return `<section class="grid agent-workspace">
    <article class="card"><div class="section-header"><div><h2>Agent</h2><p class="subtle">${tt('Human-led, AI-accelerated exercise design.', 'Conception d’exercices pilotée par l’humain, accélérée par l’IA.', 'Menschlich gesteuert, KI-beschleunigtes Übungsdesign.')}</p></div><span class="agent-status" role="status">${status[run.status]} · ${Math.min(run.step, run.maxSteps)} / ${run.maxSteps}</span></div>
    <div class="field-grid cols-2">
      <label class="field">${tt('Agent', 'Agent', 'Agent')}<select id="agent-kind" ${disabled}><option value="designer" ${run.kind === 'designer' ? 'selected' : ''}>${tt('Build my exercise', 'Construire mon exercice', 'Meine Übung erstellen')}</option><option value="reviewer" ${run.kind === 'reviewer' ? 'selected' : ''}>${tt('Challenge my exercise', 'Challenger mon exercice', 'Meine Übung hinterfragen')}</option></select></label>
      <label class="field">${tt('Autonomy', 'Autonomie', 'Autonomie')}<select id="agent-mode" ${disabled}>${[['assist', 'Assist'], ['agent', 'Agent'], ['auto', 'Auto-build']].map(([value, label]) => `<option value="${value}" ${run.mode === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
    <p class="${run.mode === 'auto' ? 'agent-warning' : 'subtle'}">${run.mode === 'auto' ? tt('Auto-build active: substantial changes are automatic. Deletion still requires approval.', 'Auto-build actif : les modifications importantes sont automatiques. La suppression nécessite une validation.', 'Auto-build aktiv: Umfangreiche Änderungen erfolgen automatisch. Löschen erfordert eine Freigabe.') : run.mode === 'assist' ? tt('Assist: approve or reject every proposed modification.', 'Assist : validez ou refusez chaque modification proposée.', 'Assist: Jede vorgeschlagene Änderung freigeben oder ablehnen.') : tt('Agent: normal edits are automatic; broad changes and deletion require approval.', 'Agent : modifications courantes automatiques ; modifications importantes et suppressions soumises à validation.', 'Agent: Normale Änderungen automatisch; umfangreiche Änderungen und Löschen erfordern eine Freigabe.')}</p>
    <label class="field">${tt('Brief or review objective', 'Brief ou objectif de revue', 'Briefing oder Prüfziel')}<textarea id="agent-objective" maxlength="8000" ${disabled} placeholder="${tt('Create a 4-hour ransomware exercise for a bank, testing isolation, communication and recovery decisions…', 'Créer un exercice ransomware de 4 heures pour une banque, testant les décisions d’isolation, de communication et de restauration…', 'Eine vierstündige Ransomware-Übung für eine Bank erstellen…')}">${escapeHtml(run.objective)}</textarea></label>
    <p class="subtle">${tt('Uses your existing AI provider settings. Exercise text is sent to the selected provider. Each step may make an AI request. Other exercise editing is paused during a run.', 'Utilise vos paramètres IA existants. Le texte de l’exercice est envoyé au fournisseur sélectionné. Chaque étape peut appeler l’IA. Les autres modifications sont suspendues pendant l’exécution.', 'Verwendet Ihre bestehenden KI-Einstellungen. Übungstext wird an den gewählten Anbieter gesendet. Jede Phase kann eine KI-Anfrage auslösen. Andere Bearbeitungen pausieren während des Laufs.')}</p>
    <div class="actions"><button class="btn btn-primary" data-agent-action="start" ${disabled} ${!isLLMAvailable() ? 'disabled' : ''}>${tt('Start', 'Démarrer', 'Starten')}</button><button class="btn btn-secondary" data-agent-action="stop" ${!run.active ? 'disabled' : ''}>${tt('Stop', 'Arrêter', 'Stoppen')}</button><button class="btn btn-secondary" data-agent-action="undo" ${disabled} ${!run.checkpoint || run.checkpoint.id !== appState.scenario.id ? 'disabled' : ''}>${tt('Undo agent changes', 'Annuler les modifications de l’agent', 'Agent-Änderungen rückgängig machen')}</button><button class="btn btn-secondary" data-action="toggle-settings-drawer">${tt('AI settings', 'Paramètres IA', 'KI-Einstellungen')}</button></div>
    ${!isLLMAvailable() ? `<p class="agent-warning">${tt('Configure an AI connection in Settings to start.', 'Configurez une connexion IA dans les paramètres pour démarrer.', 'Zum Starten eine KI-Verbindung in den Einstellungen konfigurieren.')}</p>` : ''}</article>
    ${run.pending ? `<article class="card agent-approval"><h3>${tt('Review proposed change', 'Vérifier la modification proposée', 'Vorgeschlagene Änderung prüfen')} · ${escapeHtml(run.pending.tool)}</h3><p>${escapeHtml(run.pending.reason || '')}</p><pre>${escapeHtml(agentRedact(run.pending.arguments))}</pre><details><summary>${tt('Current exercise context', 'Contexte actuel de l’exercice', 'Aktueller Übungskontext')}</summary><pre>${escapeHtml(agentRedact(run.pending.before))}</pre></details><div class="actions"><button class="btn btn-primary" data-agent-action="approve">${tt('Approve change', 'Valider la modification', 'Änderung freigeben')}</button><button class="btn btn-secondary" data-agent-action="reject">${tt('Reject', 'Refuser', 'Ablehnen')}</button></div></article>` : ''}
    <article class="card"><h3>${tt('Activity', 'Activité', 'Aktivität')}</h3><ol class="agent-log" aria-live="polite" aria-relevant="additions">${run.log.length ? run.log.map(entry => `<li class="agent-log-${entry.kind}"><span>${entry.kind === 'success' ? '✓' : entry.kind === 'warning' || entry.kind === 'error' ? '⚠' : '→'} ${entry.step} · ${escapeHtml(entry.message)}</span>${entry.detail ? `<details><summary>${tt('Inspect action / result', 'Inspecter l’action / le résultat', 'Aktion / Ergebnis ansehen')}</summary><pre>${escapeHtml(entry.detail)}</pre></details>` : ''}</li>`).join('') : `<li>${tt('Start a run to inspect and improve the current exercise.', 'Démarrez pour inspecter et améliorer l’exercice actuel.', 'Starten, um die aktuelle Übung zu prüfen und zu verbessern.')}</li>`}</ol></article>
    ${renderExercisePlan()}
  </section>`;
}
function bindAgentEvents() {
  const run = crisisAgentRunner;
  const activity = document.querySelector('.agent-log');
  if (activity) activity.scrollTop = activity.scrollHeight;
  document.getElementById('agent-objective')?.addEventListener('input', event => { getCrisisAgent().objective = event.target.value; });
  for (const key of ['kind', 'mode']) document.getElementById(`agent-${key}`)?.addEventListener('change', event => { getCrisisAgent()[key] = event.target.value; App.render(); });
  document.querySelectorAll('[data-agent-action]').forEach(button => button.addEventListener('click', async () => {
    const agent = getCrisisAgent();
    switch (button.dataset.agentAction) {
      case 'start': try { await agent.start(); } catch (error) { pushToast(agentFailureMessage(error), 'error'); } break;
      case 'stop': agent.stop(); break;
      case 'approve': agent.approve(true); break;
      case 'reject': agent.approve(false); break;
      case 'undo': if (window.confirm(tt('Restore the entire exercise to immediately before the last agent run? This also replaces edits made since that run. AI settings are preserved.', 'Restaurer tout l’exercice juste avant la dernière exécution ? Les modifications ultérieures seront aussi remplacées. Les paramètres IA sont conservés.', 'Die gesamte Übung vor dem letzten Agent-Lauf wiederherstellen? Spätere Änderungen werden ebenfalls ersetzt. KI-Einstellungen bleiben erhalten.'))) agent.undo(); break;
    }
  }));
  if (run?.active || run?.busy) {
    if (appState.route !== 'agent') document.querySelector('main.content')?.setAttribute('inert', '');
    document.querySelectorAll('#app input, #app textarea, #app select, #app [data-action]').forEach(element => { element.disabled = true; });
  }
}
