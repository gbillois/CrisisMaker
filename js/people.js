/* People of the exercise (Cells & actors).
   - Players: the real participants. One list; each player sits in one cell (cell.players) or in
     no cell yet (project.player_pool). A cell takes its players from that list.
   - Simulated actors: the characters who send the injects, played by the exercise team. They
     are grouped by category: a built-in one per type (ROLES), or one of the project's own
     (project.actor_categories: a label on top of a type, which drives channels and tone).
   Players are often invented by the AI at first, then replaced by the real names: a player keeps
   the name, role and email last written into the injects (player.synced), so Update can replace
   them in the injects, exactly, without AI. */

function cePlayerPool(project = appState.scenario) {
  if (!Array.isArray(project.player_pool)) project.player_pool = [];
  return project.player_pool;
}

/* Every player with the cell they sit in (null: not in a cell yet). */
function ceAllPlayers(project = appState.scenario) {
  return [
    ...(project.cells || []).flatMap((cell) => cell.players.map((player) => ({ player, cell }))),
    ...cePlayerPool(project).map((player) => ({ player, cell: null }))
  ];
}

function ceFindPlayer(project, playerId) {
  return ceAllPlayers(project).find((entry) => entry.player.id === playerId) || null;
}

/* Moves a player into a cell ('' or null: out of every cell), keeping the same record. */
function ceMovePlayer(project, playerId, cellId) {
  const entry = ceFindPlayer(project, playerId);
  const target = cellId ? (project.cells || []).find((cell) => cell.id === cellId) : null;
  if (!entry || (cellId && !target) || entry.cell === target) return false;
  if (entry.cell) entry.cell.players = entry.cell.players.filter((player) => player.id !== playerId);
  else project.player_pool = cePlayerPool(project).filter((player) => player.id !== playerId);
  (target ? target.players : cePlayerPool(project)).push(entry.player);
  return true;
}

/* A field of a player edited by hand: the version the injects know is kept once. */
function ceEditPlayer(player, field, value) {
  if (!['name', 'role', 'email'].includes(field)) return;
  const text = sbText(value, 200);
  if (text === player[field]) return;
  if (!player.synced) player.synced = { name: player.name, role: player.role, email: player.email };
  player[field] = text;
  if (['name', 'role', 'email'].every((key) => (player.synced[key] || '') === (player[key] || ''))) delete player.synced;
}

function ceActorCategories(project = appState.scenario) {
  if (!Array.isArray(project.actor_categories)) project.actor_categories = [];
  project.actor_categories = project.actor_categories.filter((item) => item && typeof item === 'object').slice(0, 40).map((item) => ({
    id: sbSafeId(item.id, 'category'),
    label: sbText(item.label, 120) || tt('New category', 'Nouvelle catégorie', 'Neue Kategorie'),
    role: sbRoleValue(item.role)
  }));
  return project.actor_categories;
}

/* The group of an actor in the table: its own category, else the built-in one of its type. */
function ceActorGroup(actor, categories) {
  const own = actor.category && categories.find((item) => item.id === actor.category);
  return own ? `cat:${own.id}` : `role:${sbRoleValue(actor.role)}`;
}

// ── Real names replacing invented ones ───────────────────────────────────────
function ceEscapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* Replacements for one player: full name, then (in an inject naming the player) the first name,
   the role and the email. Short or empty values are never replaced on their own. */
/* A name that is really a job title: the role repeated, an acronym such as CEO or CISO, or a placeholder such as Player 3. */
function ceIsTitleLike(name, role) {
  const text = String(name || '').trim();
  return !!text && (text.toLowerCase() === String(role || '').trim().toLowerCase() || /^[A-Z]{2,5}$/.test(text) || /^(player|participant|joueur|spieler)\s*\d+$/i.test(text));
}

function ceRenamePairs(player) {
  const from = player.synced || {};
  const pairs = [];
  const add = (a, b, word = true) => { if (a && b !== undefined && a !== b && a.length >= 3) pairs.push({ from: a, to: b || '', word }); };
  if (!ceIsTitleLike(from.name, from.role)) add(from.name, player.name);
  add(from.email, player.email, false);
  const first = (text) => String(text || '').trim().split(/\s+/)[0] || '';
  if (from.name && !ceIsTitleLike(from.name, from.role) && player.name && first(from.name) !== first(player.name) && from.name.trim().includes(' ')) add(first(from.name), first(player.name));
  add(from.role, player.role);
  return pairs;
}

function ceReplaceText(text, pairs) {
  let out = text;
  for (const pair of pairs) {
    const pattern = pair.word ? new RegExp(`(^|[^\\p{L}\\p{N}_])${ceEscapeRegExp(pair.from)}(?=$|[^\\p{L}\\p{N}_])`, 'gu') : new RegExp(ceEscapeRegExp(pair.from), 'g');
    out = pair.word ? out.replace(pattern, (match, before) => `${before}${pair.to}`) : out.replace(pattern, pair.to);
  }
  return out;
}

function ceMapStrings(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((item) => ceMapStrings(item, fn));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, /(_data|_url|^avatar)/.test(key) ? item : ceMapStrings(item, fn)]));
  return value;
}

/* The injects that still name the player as the injects knew them. */
function ceRenameTargets(project, player) {
  // A job title kept as the name ("CEO") is not searched: every inject citing the role would match.
  const name = ceIsTitleLike(player.synced?.name, player.synced?.role) ? '' : player.synced?.name;
  const email = player.synced?.email;
  if (!name && !email) return [];
  const mentions = (text) => (name && name.length >= 3 && ceReplaceText(text, [{ from: name, to: '\u0000', word: true }]) !== text) || (email && email.length >= 3 && text.includes(email));
  return project.stimuli.filter((stimulus) => mentions(JSON.stringify(stimulus.fields || {})));
}

/* One Update item per player whose real name, role or email is not in the injects yet. */
function ceRenameImpacts(project = appState.scenario) {
  const impacts = [];
  for (const { player } of ceAllPlayers(project)) {
    if (!player.synced) continue;
    const targets = ceRenameTargets(project, player);
    if (!targets.length) continue;
    const from = [player.synced.name, player.synced.role].filter(Boolean).join(', ');
    const to = [player.name, player.role].filter(Boolean).join(', ');
    impacts.push({ kind: 'rename', target: 'player', player_id: player.id, label: `${from} → ${to}`, detail: tt(`Named in ${targets.length} inject(s): replaced exactly, without AI.`, `Cité dans ${targets.length} inject(s) : remplacé à l’identique, sans IA.`, `In ${targets.length} Inject(s) genannt: exakt ersetzt, ohne KI.`), options: ['apply', 'skip'], action: 'apply' });
  }
  return impacts;
}

/* Writes the player's current name, role and email into the injects that named the old ones.
   An inject not edited by hand stays "in sync" (its content baseline follows). */
function ceApplyPlayerRename(project, playerId) {
  const entry = ceFindPlayer(project, playerId);
  if (!entry?.player.synced) return 0;
  const player = entry.player;
  const pairs = ceRenamePairs(player);
  let changed = 0;
  for (const stimulus of ceRenameTargets(project, player)) {
    const manual = typeof sbIsManuallyEdited === 'function' && sbIsManuallyEdited(stimulus);
    // Only injects naming the player: there, the first name and the role follow the full name.
    const fields = ceMapStrings(stimulus.fields || {}, (text) => ceReplaceText(text, pairs));
    if (JSON.stringify(fields) === JSON.stringify(stimulus.fields)) continue;
    saveStimulus(stimulus, fields, tt('Update: real names of the players', 'Mise à jour : noms réels des joueurs', 'Aktualisierung: echte Namen der Spieler'));
    const link = typeof sbStimulusLink === 'function' ? sbStimulusLink(stimulus) : null;
    if (link && !manual) link.content_hash = sbStimulusContentHash(stimulus);
    changed++;
  }
  delete player.synced;
  return changed;
}
