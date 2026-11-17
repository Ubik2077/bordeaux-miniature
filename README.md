# Bordeaux Miniature

Troisième carte pour les clients de l'hôtel Ibis Bordeaux Centre Gare Saint-Jean Euratlantique, après
« Bordeaux à la carte » (bars et restaurants) et « Port de la Lune » (patrimoine). Musées, sorties en famille
et shopping, sur une carte de papier posée sur une table, où seuls les lieux à visiter se dressent en maquette.
Refonte de « Canelé Quest » (version 8 bits), dont elle reprend les données vérifiées.

## Direction visuelle

- Fond 2D façon carte imprimée : papier texturé, Garonne avec hauts-fonds et lignes de profondeur, parcs,
  rues à leur vraie largeur, arbres d'alignement, ville à plat (1 m de relief).
- Lieux à visiter et grands repères en 3D fine (three.js, `js/monuments3d.js`) avec de vraies ombres portées
  (soleil de fin d'après-midi au sud-ouest) : styles classique (pierre, fenêtres, toit à la Mansart, lucarnes),
  moderne, bunker, halle, serre, Cité du Vin ; monuments dessinés pièce par pièce (Grand Théâtre, pont de pierre,
  Girondins, colonnes rostrales, porte Cailhau, tour Pey-Berland, Grands Hommes, miroir d'eau).
- Nom de chaque lieu sur une étiquette placée là où il y a de la place (jamais cachée, trait de rappel si besoin),
  médaillon photo en aperçu au survol, noms de quartiers écrits sur la carte,
  cartouche du titre, rose des vents qui tourne avec la vue. Rotation à deux doigts.

## Données

```sh
node scripts/fetch.mjs        # IGN BD TOPO + OpenStreetMap → cache dans le dossier temporaire
node scripts/carte.mjs        # → data/carte/fond.json (format compact) et data/carte/batis.json
node scripts/trajets.mjs      # → data/trajets.json (à pied et en tram depuis l'hôtel)
python3 scripts/photos.py     # → img/lieux/ et data/photos.json (Wikimedia Commons, crédits)
python3 -m http.server 8645   # puis http://localhost:8645/
```

`data/lieux.json` : 24 lieux, horaires vérifiés le 16 novembre 2026 avec leur source (repris de Canelé Quest).

## Affiche A5

`affiche.html` (+ `js/affiche.js`) : l'illustration « maquette » de Bordeaux (`img/affiche/illustration.webp`, générée
par IA, 1086 × 1448 px) montée comme un tirage, puis le QR code vers la carte et le texte en cinq langues.
Imprimer depuis le navigateur (A5, marges aucune, graphiques d'arrière-plan) ; `sh scripts/affiche.sh` produit le PDF
avec Chrome ou Brave sans fenêtre (le mode sans fenêtre de Brave 157 ne fonctionne pas sur ce Mac).
Inexactitudes connues de l'illustration : pont Chaban-Delmas dessiné haubané (c'est un pont levant à quatre pylônes),
Cité du Vin trop basse, monuments réarrangés librement.

## Reste à faire

Mise en ligne (dépôt bordeaux-miniature).

Fait : menu « Nos autres cartes » au pied du cartouche (la langue suit, `?lang=xx`), fiches (photo créditée, état d'ouverture, description, trajets, infos pratiques), liste repliable,
filtres par catégorie, médaillons ternis quand le lieu est fermé, tracé des trajets à pied et en tram ;
menu des 5 langues, « vous êtes ici » et lieu le plus proche, mode hors ligne (`sw.js`, testé serveur coupé),
ajout à l'écran d'accueil (`manifest.webmanifest`, icônes : `python3 scripts/icones.py`).
