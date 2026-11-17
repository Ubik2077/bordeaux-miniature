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
- Médaillons photo des lieux (repliés en simple point quand la place manque), noms écrits sur la carte,
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

## Reste à faire

Affiche (inspirée de
l'affiche « La Rochelle » : ville découpée en île sur une carte papier, bords déchirés, titre espacé, lignes de
rappel vers les monuments, QR code), liens vers les deux autres cartes, mise en ligne (dépôt bordeaux-miniature).

Fait : fiches (photo créditée, état d'ouverture, description, trajets, infos pratiques), liste repliable,
filtres par catégorie, médaillons ternis quand le lieu est fermé, tracé des trajets à pied et en tram ;
menu des 5 langues, « vous êtes ici » et lieu le plus proche, mode hors ligne (`sw.js`, testé serveur coupé),
ajout à l'écran d'accueil (`manifest.webmanifest`, icônes : `python3 scripts/icones.py`).
