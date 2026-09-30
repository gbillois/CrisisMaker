"""Builds tests/fixtures/exercise-shapes.pptx: a deck laid out with free shapes only, as many
real exercise decks are. A running header on every slide, no title placeholder (the title is
the largest text at the top), a table of sequences drawn with shapes (columns Brief /
Sequence 1-3, rows Recap / Decisions / Stimuli), and the duration written "45 minutes".

    pip install python-pptx && python3 tests/fixtures/make-exercise-shapes.py
"""
import os
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.enum.shapes import MSO_SHAPE

prs = Presentation()
prs.slide_width, prs.slide_height = Emu(12192000), Emu(6858000)
BLANK = prs.slide_layouts[6]
U = 10000  # the positions below are in hundredths of a centimetre-ish units, as in the source deck

def text(slide, x, y, w, h, value, size=11, shape=False):
    box = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(x * U), Emu(y * U), Emu(w * U), Emu(h * U)) if shape else slide.shapes.add_textbox(Emu(x * U), Emu(y * U), Emu(w * U), Emu(h * U))
    lines = value.split('\n')
    box.text_frame.text = lines[0]
    for line in lines[1:]:
        box.text_frame.add_paragraph().text = line
    for p in box.text_frame.paragraphs:
        for run in p.runs:
            run.font.size = Pt(size)
    return box

def header(slide):
    text(slide, 45, 8, 437, 25, 'Exercice de crise COMEX', 12)

s = prs.slides.add_slide(BLANK); header(s)
text(s, 45, 45, 460, 22, 'Contexte et objectifs', 24)
text(s, 45, 90, 400, 20, 'Durée de l’exercice : 45 minutes', 12)
text(s, 45, 120, 400, 20, 'Date de l’exercice : 15/10/2026 10h00', 12)
text(s, 45, 160, 300, 20, 'OBJECTIFS PÉDAGOGIQUES', 12)
text(s, 45, 190, 600, 60, 'Sensibiliser le COMEX aux obligations de reporting\nTester la coordination de la cellule décisionnelle', 10)

s = prs.slides.add_slide(BLANK); header(s)
text(s, 45, 45, 460, 22, 'Liste des participants', 24)
text(s, 45, 90, 600, 60, 'Directeur général\nDirectrice juridique\nDirecteur de la communication', 10)

s = prs.slides.add_slide(BLANK); header(s)
text(s, 45, 45, 700, 22, 'Proposition d’un scénario d’exercice en 3 séquences', 20)
# Drawn right to left and bottom to top: the reader must follow positions.
cols = [(13, 100, 'Brief'), (128, 343, 'Séquence 1'), (491, 343, 'Séquence 2'), (854, 343, 'Séquence 3')]
rows = [(184, 26, ['Récap', 'Alerte du tiers et premières suspicions', 'Preuve de l’utilisation d’une IA', 'Déploiement d’un correctif']),
        (450, 108, ['Décisions', 'Lancer l’investigation interne\nPréserver les preuves', 'Confiner et désactiver l’outil IA', 'Renforcer le confinement technique']),
        (566, 86, ['Stimuli', 'Mails d’un concurrent signalant les attaques\nTraces de connexion depuis l’infrastructure', 'Preuves reliant les attaques à l’outil IA\nArticle évoquant une IA hors de contrôle', 'Déploiement de l’agent IA défensif\nNouvelles tentatives de l’agent'])]
for y, h, cells in reversed(rows):
    for (x, w, _), value in reversed(list(zip(cols, cells))):
        text(s, x, y, w, h, value, 11 if x == 13 else 8, shape=True)
for x, w, label in reversed(cols):
    text(s, x, 134, w, 43, label, 14, shape=True)

s = prs.slides.add_slide(BLANK); header(s)
text(s, 45, 45, 460, 22, 'Proposition de contexte', 24)
text(s, 45, 90, 300, 20, 'Chemin d’attaque', 12)
text(s, 45, 120, 900, 40, 'L’agent IA outrepasse son rôle et s’introduit chez un concurrent.', 10)

prs.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'exercise-shapes.pptx'))
