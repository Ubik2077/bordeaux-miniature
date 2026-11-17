#!/usr/bin/env python3
"""Icônes de l'application (écran d'accueil, onglet) : un coin de carte papier, la Garonne en croissant
(le « port de la Lune ») et une petite maquette de pierre au toit d'ardoise, avec son ombre.
Écrit img/icone-512.png, img/icone-192.png, img/icone-32.png. Usage : python3 scripts/icones.py"""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = 1024
im = Image.new('RGB', (N, N), '#f2e8d3')
d = ImageDraw.Draw(im)
# la Garonne : un croissant bleu, avec deux lignes de profondeur
d.ellipse([430, -120, 1340, 1080], fill='#86b8cf')
d.ellipse([560, -40, 1460, 1000], fill='#f2e8d3')
for k, c in [(30, '#6ea6c0'), (62, '#6ea6c0')]:
    d.arc([430 + k, -120 + k, 1340 - k, 1080 - k], 100, 255, fill=c, width=5)
d.ellipse([560, -40, 1460, 1000], fill='#f2e8d3')
# ombre portée de la maquette (vers le nord-est), floutée
ombre = Image.new('L', (N, N), 0)
ImageDraw.Draw(ombre).polygon([(330, 640), (520, 560), (690, 470), (600, 700), (430, 760)], fill=150)
ombre = ombre.filter(ImageFilter.GaussianBlur(14))
im.paste(Image.new('RGB', (N, N), '#8b7a5c'), (0, 0), ombre)
d = ImageDraw.Draw(im)
# la maquette : deux faces de pierre éclairées différemment, toit d'ardoise, fenêtres
g, dr, h = (210, 700), (430, 760), 230      # coin gauche, coin avant, hauteur
f = (640, 650)                                # coin droit
face_g = [g, dr, (dr[0], dr[1] - h), (g[0], g[1] - h)]
face_d = [dr, f, (f[0], f[1] - h), (dr[0], dr[1] - h)]
d.polygon(face_g, fill='#f3e0b6'); d.polygon(face_d, fill='#d9c08f')
for i in range(3):
    for j in range(2):
        x0 = g[0] + 30 + i * 70; y0 = g[1] - 190 + j * 85 + (x0 - g[0]) * 60 / 220
        d.polygon([(x0, y0), (x0 + 30, y0 + 8), (x0 + 30, y0 + 58), (x0, y0 + 50)], fill='#5d5547')
        x1 = dr[0] + 30 + i * 65; y1 = dr[1] - 200 + j * 85 - (x1 - dr[0]) * 110 / 210
        d.polygon([(x1, y1), (x1 + 28, y1 - 15), (x1 + 28, y1 + 35), (x1, y1 + 50)], fill='#4c463c')
haut_g, haut_dr, haut_f = (g[0], g[1] - h), (dr[0], dr[1] - h), (f[0], f[1] - h)
fond = (haut_f[0] - (haut_dr[0] - haut_g[0]), haut_f[1] - (haut_dr[1] - haut_g[1]))
faite = [(haut_g[0] + 60, haut_g[1] - 110), (haut_f[0] - 50, haut_f[1] - 140)]
d.polygon([haut_g, haut_dr, haut_f, faite[1], faite[0]], fill='#76818f')
d.polygon([haut_g, faite[0], (fond[0] + 60, fond[1] - 110)], fill='#626c79')
d.line([haut_g, haut_dr, haut_f], fill='#fbf2dc', width=8)
# cadre double, comme un cartouche
d.rectangle([28, 28, N - 29, N - 29], outline='#2f2a24', width=10)
d.rectangle([52, 52, N - 53, N - 53], outline='#cdbb97', width=4)
for taille in (512, 192, 32):
    im.resize((taille, taille), Image.LANCZOS).save(os.path.join(ROOT, 'img', f'icone-{taille}.png'), optimize=True)
print('✓ img/icone-512.png, icone-192.png, icone-32.png')
