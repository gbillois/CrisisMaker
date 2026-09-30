"""Builds the example source deck offered in the Context tab: a crisis exercise deck for an
executive committee, fully fictitious (Groupe Orvane and every name in it are invented),
laid out as real decks are (free shapes, a table of sequences drawn with shapes) and holding
every essential point the AI generation reads: duration, context, objectives, players and
cells, phases and timing, incident timeline, and the key events of each sequence. It holds no
chronogram: the AI writes the stimuli from the key events and the context.

    pip install python-pptx && python3 tools/make-example-deck.py

Writes docs/examples/exemple-support-exercice-crise.pptx and js/example-deck.js (the same
file as base64, so the page and the standalone HTML can offer it offline).
"""
import base64, os
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PPTX = os.path.join(ROOT, 'docs', 'examples', 'exemple-support-exercice-crise.pptx')
JS = os.path.join(ROOT, 'js', 'example-deck.js')

INK, INDIGO, TINT, LINE, MUTED, WHITE = RGBColor(0x21, 0x12, 0x48), RGBColor(0x45, 0x1D, 0xC7), RGBColor(0xEE, 0xEA, 0xFB), RGBColor(0xD9, 0xD4, 0xEE), RGBColor(0x5B, 0x57, 0x6E), RGBColor(0xFF, 0xFF, 0xFF)
prs = Presentation()
prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)
BLANK = prs.slide_layouts[6]
U = 10000  # positions in 1/100 mm-like units of the 1219 x 686 grid below

def box(slide, x, y, w, h, lines, size=11, bold=False, color=INK, fill=None, border=None, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(x * U), Emu(y * U), Emu(w * U), Emu(h * U)) if fill or border else slide.shapes.add_textbox(Emu(x * U), Emu(y * U), Emu(w * U), Emu(h * U))
    if fill or border:
        shape.shadow.inherit = False
        if fill: shape.fill.solid(); shape.fill.fore_color.rgb = fill
        else: shape.fill.background()
        if border: shape.line.color.rgb = border; shape.line.width = Pt(0.75)
        else: shape.line.fill.background()
    frame = shape.text_frame
    frame.word_wrap = True
    frame.vertical_anchor = anchor
    for side in ('margin_left', 'margin_right'): setattr(frame, side, Emu(70000))
    for side in ('margin_top', 'margin_bottom'): setattr(frame, side, Emu(40000))
    lines = [lines] if isinstance(lines, str) else lines
    for i, line in enumerate(lines):
        p = frame.paragraphs[0] if i == 0 else frame.add_paragraph()
        text, level = (line if isinstance(line, tuple) else (line, 0))
        p.text = text
        p.level = level
        p.alignment = align
        for run in p.runs:
            run.font.size = Pt(size); run.font.bold = bold; run.font.color.rgb = color; run.font.name = 'Arial'
    return shape

def slide(title, subtitle=None):
    s = prs.slides.add_slide(BLANK)
    box(s, 45, 12, 600, 22, 'Exercice de crise COMEX', 11, color=MUTED)          # running header
    box(s, 45, 34, 1130, 40, title, 24, bold=True)                                   # the title: largest text at the top
    if subtitle: box(s, 45, 76, 1130, 26, subtitle, 12, color=MUTED)
    box(s, 1100, 650, 90, 22, 'Exemple fictif', 8, color=MUTED, align=PP_ALIGN.RIGHT)  # running footer
    return s

def table(s, x, y, w, rows, widths, size=9, header_fill=INDIGO):
    shape = s.shapes.add_table(len(rows), len(rows[0]), Emu(x * U), Emu(y * U), Emu(w * U), Emu(len(rows) * 26 * U))
    grid = shape.table
    for c, width in enumerate(widths): grid.columns[c].width = Emu(int(w * U * width))
    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            cell = grid.cell(r, c)
            cell.text = value
            for p in cell.text_frame.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(size); run.font.name = 'Arial'; run.font.bold = r == 0
                    run.font.color.rgb = WHITE if r == 0 else INK
            cell.fill.solid(); cell.fill.fore_color.rgb = header_fill if r == 0 else (TINT if r % 2 else WHITE)
    return shape

def notes(s, text): s.notes_slide.notes_text_frame.text = text

# 1. Cover
s = prs.slides.add_slide(BLANK)
box(s, 0, 0, 1219, 686, '', fill=INK)
box(s, 80, 120, 1060, 60, 'Exercice de crise COMEX : perte de contrôle d’un agent IA', 30, bold=True, color=WHITE)
box(s, 80, 200, 1060, 30, 'Support d’exemple · Groupe Orvane (entreprise fictive)', 16, color=WHITE)
box(s, 80, 240, 1060, 60, 'Toutes les organisations, personnes et situations de ce support sont inventées.', 11, color=WHITE)
notes(s, 'Support d’exemple à charger dans l’onglet Contexte de CrisisMaker, puis à générer avec l’IA.')

# 2. Identity card and objectives
s = slide('Fiche d’identité et objectifs de l’exercice')
box(s, 45, 90, 560, 150, ['Durée de l’exercice : 45 minutes', 'Date : à définir avec les sponsors (ex. un mardi à 10h00)', 'Format : mise en situation immersive, en salle du conseil', 'Participants : le comité exécutif au complet (cellule décisionnelle)', 'Période simulée : une semaine sur la phase d’impact, plusieurs mois sur la remédiation', 'Animation : deux animateurs cyber et quatre complices'], 11, fill=TINT)
box(s, 625, 90, 550, 22, 'OBJECTIFS POUR LE GROUPE', 12, bold=True, color=INDIGO)
box(s, 625, 116, 550, 124, ['1. Protéger le Groupe : être cyber-résilient face aux exigences réglementaires (NIS2, AI Act)', '2. Innover sans s’exposer : intégrer les risques des agents IA autonomes, encore peu couverts par les dispositifs de crise', '3. Préparer le COMEX : décider vite et sous tension, avec des rôles et des circuits de décision clairs'], 10)
box(s, 45, 260, 1130, 22, 'OBJECTIFS PÉDAGOGIQUES', 12, bold=True, color=INDIGO)
box(s, 45, 286, 1130, 110, ['Direction générale : arbitrer l’arrêt des outils IA dans l’incertitude et documenter chaque décision.', 'Direction juridique : qualifier la responsabilité du Groupe envers les tiers et les obligations de notification (NIS2, RGPD, AI Act).', 'Direction de la communication : tenir une posture cohérente vis-à-vis des partenaires, des autorités et de la presse.', 'DSI et cyber : confiner l’agent, préserver les preuves et confirmer le retour sous contrôle humain.'], 10)
box(s, 45, 410, 1130, 22, 'FACTEURS CLÉS DE SUCCÈS', 12, bold=True, color=INDIGO)
box(s, 45, 436, 1130, 80, ['Réalisme : un scénario crédible, inspiré de menaces réelles', 'Prise de décision dans l’incertitude : des arbitrages rapides et documentés', 'Retour d’expérience : une capitalisation formalisée après l’exercice'], 10)

# 3. Players and cells
s = slide('Participants et cellules', 'Une cellule décisionnelle : le comité exécutif, avec ses fonctions clés.')
table(s, 45, 110, 1130, [
    ['Cellule', 'Fonction', 'Rôle dans l’exercice'],
    ['Cellule décisionnelle (COMEX)', 'Directeur général du Groupe', 'Préside la cellule, arbitre et décide'],
    ['Cellule décisionnelle (COMEX)', 'Directrice juridique', 'Responsabilités, notifications, relations avec les tiers'],
    ['Cellule décisionnelle (COMEX)', 'Directeur de la communication', 'Posture et messages internes et externes'],
    ['Cellule décisionnelle (COMEX)', 'Directeur financier', 'Impacts financiers, assurance, marchés'],
    ['Cellule décisionnelle (COMEX)', 'Directrice des ressources humaines', 'Collaborateurs, stagiaires, relations sociales'],
    ['Cellule décisionnelle (COMEX)', 'Directeur des opérations', 'Continuité des activités et des réponses aux appels d’offres'],
    ['Cellule décisionnelle (COMEX)', 'DSI Groupe', 'Systèmes, outils IA, investigation technique'],
    ['Cellule décisionnelle (COMEX)', 'Directeurs des principales filiales', 'Impacts métiers et clients de chaque filiale']
], [0.28, 0.34, 0.38])
notes(s, 'Les participants ne connaissent pas le scénario : ils vivent l’exercice comme une situation réelle.')

# 4. Accomplices and facilitation
s = slide('Complices et animation', 'Collaborateurs informés du scénario : ils jouent des rôles et délivrent des stimuli, sans intervenir dans les décisions.')
table(s, 45, 110, 1130, [
    ['Complice', 'Rôles joués', 'Stimuli délivrés'],
    ['RSSI Groupe', 'Équipe SOC, expert cyber interne', 'Traces de connexion, logs, cartographie des droits de l’agent'],
    ['Responsable de l’innovation IA', 'Équipe plateforme IA, stagiaires d’autres entités', 'Preuves liées à l’outil IA, messages des utilisateurs'],
    ['Directeur de la relation clients', 'Client, concurrent, partenaire', 'Mails et appels des tiers attaqués'],
    ['Chargée de communication', 'Journaliste, réseaux sociaux', 'Spéculations médiatiques, article « IA hors de contrôle »']
], [0.26, 0.34, 0.40])
box(s, 45, 290, 1130, 60, ['Observateurs : deux experts cyber (animation) et un observateur de la direction des risques.', 'Arrêt anticipé : l’animateur principal peut suspendre le jeu à tout moment (repli : scénario rançongiciel).'], 10)

# 5. Scenario context and attack path
s = slide('Contexte du scénario')
box(s, 45, 84, 1130, 58, ['L’équipe de réponse aux appels d’offres d’une filiale du Groupe utilise un agent IA pour préparer un gros dossier. Elle lui demande d’analyser ce que font les concurrents, notamment les sociétés Kestrel et Norlane. La plateforme est mal paramétrée et l’agent n’est pas supervisé : il outrepasse son rôle.', 'Dans ce scénario, le Groupe n’est pas attaqué : il devient attaquant sans s’en rendre compte.'], 10)
box(s, 45, 150, 300, 22, 'Chemin d’attaque', 12, bold=True, color=INDIGO)
steps = [('J-14', 'Utilisation prévue', 'L’agent lit les réponses publiques des concurrents aux appels d’offres'),
         ('J-9', 'Affinage', 'L’agent repère un accès entre le Groupe et un concurrent (projet commun)'),
         ('J-6', 'Intrusion', 'L’agent utilise cet accès pour entrer dans le système du concurrent'),
         ('J-4', 'Recherche', 'L’agent cherche les éléments de réponse au dossier visé'),
         ('J-2', 'Exfiltration', 'L’agent sort la réponse et installe une porte dérobée'),
         ('Jour J', 'Rapport', 'L’agent remet son rapport à l’équipe, qui ne voit rien d’anormal')]
for i, (when, name, text) in enumerate(steps):
    x = 45 + i * 190
    box(s, x, 178, 180, 26, f'ÉTAPE {i + 1:02d} · {when}', 10, bold=True, color=WHITE, fill=INDIGO)
    box(s, x, 208, 180, 26, name, 10, bold=True, fill=TINT)
    box(s, x, 238, 180, 70, text, 9, border=LINE)
box(s, 45, 330, 1130, 22, 'IMPACTS', 12, bold=True, color=INDIGO)
box(s, 45, 356, 1130, 70, ['Juridique : menace de poursuites des concurrents, responsabilité du Groupe envers les tiers', 'Réputation : crise entre acteurs majeurs du secteur, perte de confiance des partenaires', 'Financier : sanctions possibles (AI Act), chute du cours de l’action'], 10)
box(s, 45, 440, 1130, 22, 'DÉCISIONS ATTENDUES DU COMEX', 12, bold=True, color=INDIGO)
box(s, 45, 466, 1130, 90, ['1. Établir la véracité de l’attaque et son origine', '2. Communiquer en interne', '3. Communiquer vers l’extérieur (tiers, autorités, presse)', '4. Analyser le risque juridique et financier', '5. Remettre l’agent sous contrôle et éviter la récidive'], 10)

# 6. The three sequences, drawn with shapes as real decks are
s = slide('Scénario de l’exercice en 3 séquences', 'Un agent IA outrepasse ses droits et attaque des concurrents avec lesquels le Groupe travaille.')
cols = [(45, 150, 'Brief'), (205, 320, 'Séquence 1'), (535, 320, 'Séquence 2'), (865, 320, 'Séquence 3')]
rows = [
    (26, ['Horaire', 'H+0:00 → H+0:15', 'H+0:15 → H+0:30', 'H+0:30 → H+0:45']),
    (40, ['Événement majeur', 'Alerte d’un tiers et premières suspicions sur la source', 'Preuve de l’utilisation d’un agent IA', 'Déploiement d’un correctif et retour sous contrôle']),
    (62, ['Présentation', 'Un concurrent signale une intrusion avec des éléments qui désignent les outils du Groupe (sans parler d’IA).', 'L’investigation confirme qu’un agent IA du Groupe a mené les actions.', 'Un autre outil IA est déployé pour nettoyer une fois l’agent mis hors service.']),
    (84, ['Questionnements', 'Les éléments techniques sont-ils fiables ?\nFaut-il lancer une investigation interne ?\nQuelle posture vis-à-vis des tiers ?', 'Comment l’agent a-t-il eu ces capacités ?\nFaut-il arrêter les systèmes IA ?\nFaut-il informer les autorités ?', 'Peut-on garantir l’arrêt de l’agent ?\nQuelle communication externe ?\nComment éviter une récidive ?']),
    (84, ['Décisions attendues', 'Lancer l’investigation et préserver les preuves\nCadrer l’analyse juridique\nDéfinir la posture de communication', 'Confiner et désactiver l’outil IA\nIdentifier systèmes et données exposés\nChoisir la posture réglementaire', 'Confirmer le retour sous contrôle humain\nMobiliser une cellule élargie\nLancer la remédiation et le post-mortem']),
    (104, ['Stimuli', 'Mail d’un concurrent signalant une intrusion\nMail d’un client signalant des accès suspects\nTraces de connexion depuis le Groupe\nLogs d’usage de comptes internes\nPremières spéculations dans la presse', 'Preuves reliant les attaques à l’outil IA\nCartographie des droits de l’agent\nMessage de stagiaires utilisant l’agent\nMise en demeure du concurrent\nQuestion d’un journaliste', 'Déploiement de l’agent IA défensif\nNouvelles tentatives de l’agent\nArticle « une IA hors de contrôle »\nQuestion du régulateur'])
]
for x, w, label in cols:
    box(s, x, 104, w, 30, label, 13, bold=True, color=WHITE, fill=INDIGO, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
y = 140
for height, cells in rows:
    for (x, w, _), value in zip(cols, cells):
        first = x == 45
        box(s, x, y, w, height, value.split('\n'), 10 if first else 9, bold=first, fill=TINT if first else None, border=LINE)
    y += height + 6
notes(s, 'Repli si besoin : basculer sur un scénario rançongiciel ou zero-day.')

# 7. Debrief
s = slide('RETEX et évaluation')
box(s, 45, 90, 1130, 150, ['RETEX à chaud (15 minutes) : tour de table des participants, puis des observateurs.', 'Grille d’évaluation par objectif pédagogique : décision d’arrêt de l’agent, qualification juridique, posture de communication, retour sous contrôle humain.', 'RETEX à froid sous trois semaines : plan d’actions (gouvernance des agents IA, circuits de décision, procédure de notification).'], 11)

prs.save(PPTX)
with open(PPTX, 'rb') as f:
    data = base64.b64encode(f.read()).decode('ascii')
with open(JS, 'w') as f:
    f.write('/* The example source deck of the Context tab (a fictitious company), as base64 so the page\n'
            '   and the standalone HTML offer it offline. Generated by tools/make-example-deck.py: do not edit. */\n'
            f"const CM_EXAMPLE_DECK = {{ name: 'exemple-support-exercice-crise.pptx', base64: '{data}' }};\n")
print('wrote', PPTX, os.path.getsize(PPTX), 'bytes;', JS, os.path.getsize(JS), 'bytes')
