// Bordeaux Miniature : la carte de papier (MapLibre), les maquettes en 3D (js/monuments3d.js) et les médaillons des lieux.

import { deplier, points } from './compact.js';
import { coucheMonuments } from './monuments3d.js';
import { chargerVacances, statut } from './horaires.js';
import { afficherFiche, fermerFiche, badgeStatut, puce, echap } from './fiche.js';
import { t, tLieu, setLang, getLang, applyStatic } from './i18n.js';

const charger = (u) => fetch(u).then((r) => r.json());
const [fond, batis, { lieux, hotel, verifie }, photos, vacances, { lieux: trajets }] = await Promise.all(
  ['data/carte/fond.json', 'data/carte/batis.json', 'data/lieux.json', 'data/photos.json', 'data/vacances.json', 'data/trajets.json'].map(charger));
chargerVacances(vacances);
await setLang(getLang());
applyStatic();
const B = fond.cadre;
const COUL = { musee: '#8c2342', famille: '#4f8a46', shopping: '#d9772f', repere: '#5f6b7d', hotel: '#2f6f9a' };
const $ = (id) => document.getElementById(id);

// ---------- textures dessinées ----------
function papier() {
  const n = 160, cv = new OffscreenCanvas(n, n), x = cv.getContext('2d'), img = x.createImageData(n, n);
  for (let i = 0; i < n * n; i++) {
    const v = 236 + Math.random() * 12 - (Math.random() < .03 ? 14 : 0);
    img.data.set([v, v - 10, v - 30, 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(150, 120, 80, .10)'; x.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const a = Math.random() * n, b = Math.random() * n, l = 4 + Math.random() * 14, t = Math.random() * Math.PI; x.beginPath(); x.moveTo(a, b); x.lineTo(a + l * Math.cos(t), b + l * Math.sin(t)); x.stroke(); }
  return x.getImageData(0, 0, n, n);
}
// mètres → pixels selon le zoom (à 44,84° N, 1 px ≈ 0,85 m au zoom 16)
const PX13 = 0.148;
const metres = (champ, k = 1) => ['interpolate', ['exponential', 2], ['zoom'], 12, ['*', ['get', champ], (PX13 / 2) * k], 19, ['*', ['get', champ], PX13 * 64 * k]];
const decal = (m) => ['interpolate', ['exponential', 2], ['zoom'], 12, (m * PX13) / 2, 19, m * PX13 * 64];
const decal2 = (m) => ['interpolate', ['exponential', 2], ['zoom'], 12, ['literal', [(m * PX13) / 2, (m * PX13) / 2]], 19, ['literal', [m * PX13 * 64, m * PX13 * 64]]];

const etroit = innerWidth < 600;
const map = new maplibregl.Map({
  container: 'carte',
  style: { version: 8, sources: {}, layers: [{ id: 'mer', type: 'background', paint: { 'background-color': '#86b8cf' } }] },
  center: etroit ? [-0.5655, 44.8372] : [-0.5672, 44.8385], zoom: etroit ? 14.1 : 14.7, pitch: 55, bearing: -18,
  maxBounds: [[B.o, B.s], [B.e, B.n]], minZoom: 13.3, maxZoom: 18.5, maxPitch: 65,
  attributionControl: false,
});
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'IGN BD TOPO · © OpenStreetMap' }));

map.on('load', () => {
  map.addImage('papier', papier());
  for (const k of ['terre', 'eau', 'profondeurs', 'parcs', 'rues', 'fer', 'plats', 'halos']) map.addSource(k, { type: 'geojson', data: deplier(fond[k]) });
  map.addSource('arbres', { type: 'geojson', data: points(fond.arbres) });

  // eau : hauts-fonds clairs le long des rives, puis lignes de profondeur
  map.addLayer({ id: 'hauts-fonds', type: 'line', source: 'eau', paint: { 'line-color': '#b3d6e3', 'line-width': decal(70), 'line-blur': decal(40) } });
  // lignes de profondeur : courbes d'égale distance à la rive, calculées par scripts/carte.mjs
  map.addLayer({ id: 'profondeurs', type: 'line', source: 'profondeurs', layout: { 'line-join': 'round' },
    paint: { 'line-color': '#4f8fae', 'line-width': 1.2, 'line-opacity': ['-', 0.78, ['*', ['get', 'n'], 0.12]] } });
  // le papier, son liseré de rive, la verdure, les rues
  map.addLayer({ id: 'terre', type: 'fill', source: 'terre', paint: { 'fill-pattern': 'papier' } });
  map.addLayer({ id: 'rive-ombre', type: 'line', source: 'terre', paint: { 'line-color': 'rgba(60, 90, 100, .35)', 'line-width': 3, 'line-blur': 2, 'line-translate': [1.5, 1.5] } });
  map.addLayer({ id: 'rive', type: 'line', source: 'terre', paint: { 'line-color': '#a8916a', 'line-width': 1.4 } });
  map.addLayer({ id: 'parcs', type: 'fill', source: 'parcs', paint: { 'fill-color': ['case', ['==', ['get', 'jeux'], 1], '#ecd28a', '#c6d89a'], 'fill-outline-color': '#a3b87a' } });
  map.addLayer({ id: 'fer', type: 'line', source: 'fer', paint: { 'line-color': '#b9ab90', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 17, 3], 'line-dasharray': [3, 1.5] } });
  map.addLayer({ id: 'rues-bord', type: 'line', source: 'rues', filter: ['==', ['get', 'petit'], 0],
    layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#d2c09b', 'line-width': metres('l', 1.25) } });
  map.addLayer({ id: 'rues', type: 'line', source: 'rues',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['case', ['==', ['get', 'petit'], 1], '#e6d9bd', '#fcf7ec'], 'line-width': metres('l') } });
  // la ville reste plate (1 m de relief) pour faire ressortir les lieux
  map.addLayer({ id: 'plats', type: 'fill-extrusion', source: 'plats', paint: { 'fill-extrusion-color': '#eadfc4', 'fill-extrusion-height': 1, 'fill-extrusion-opacity': 1 } });
  map.addLayer({ id: 'arbres-ombre', type: 'circle', source: 'arbres',
    paint: { 'circle-color': 'rgba(60, 45, 15, .25)', 'circle-radius': decal(3.4), 'circle-translate': decal2(2.2), 'circle-translate-anchor': 'map', 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'arbres', type: 'circle', source: 'arbres',
    paint: { 'circle-color': '#86a85b', 'circle-radius': decal(3.2), 'circle-stroke-color': '#678a42', 'circle-stroke-width': 0.8, 'circle-pitch-alignment': 'map' } });
  map.addLayer({ id: 'halos', type: 'line', source: 'halos',
    paint: { 'line-color': ['match', ['get', 'cat'], 'musee', COUL.musee, 'shopping', COUL.shopping, 'famille', COUL.famille, 'hotel', COUL.hotel, COUL.repere], 'line-width': decal(7), 'line-blur': decal(5), 'line-opacity': 0.55 } });
  // les maquettes en 3D, avec leurs ombres
  map.addLayer(coucheMonuments(batis));

  // noms écrits sur la carte : les quartiers restent à l'horizontale, le fleuve suit son cours quand on tourne
  const ecrits = [];
  const ecrire = (txt, cls, p, angle = null) => {
    const el = document.createElement('div'); el.className = 'etiquette ' + cls; el.textContent = txt;
    new maplibregl.Marker({ element: el, rotationAlignment: 'viewport', pitchAlignment: 'viewport' }).setLngLat(p).addTo(map);
    ecrits.push({ el, angle });
  };
  ecrire('La Garonne', 'fleuve', [-0.5632, 44.8445], -86);
  for (const [t, p] of [['Saint-Pierre', [-0.5728, 44.8398]], ["Triangle d'or", [-0.5772, 44.8452]], ['Quinconces', [-0.5728, 44.8442]], ['La Bastide', [-0.5605, 44.8415]],
    ['Chartrons', [-0.5710, 44.8510]], ['Saint-Michel', [-0.5660, 44.8335]], ['Bassins à flot', [-0.5560, 44.8650]], ['Mériadeck', [-0.5850, 44.8385]], ['Belcier', [-0.5520, 44.8262]], ['Bacalan', [-0.5520, 44.8700]]]) ecrire(t, 'quartier', p);
  const majEcrits = () => {
    const b = map.getBearing();
    for (const e of ecrits) if (e.angle !== null) e.el.style.transform = `rotate(${e.angle - b}deg)`;
    $('rose').querySelector('svg').style.transform = `rotate(${-b}deg)`;
  };
  map.on('rotate', majEcrits); majEcrits();
  $('rose').addEventListener('click', () => map.easeTo({ bearing: 0, duration: 600 }));

  // ---------- médaillons : les 24 lieux et l'hôtel (priorité : hôtel, musées, famille, shopping) ----------
  const ORDRE = { hotel: -1, musee: 0, famille: 1, shopping: 2 };
  const medaillons = new Map(); // id → { l, el, m, rang }
  const actives = new Set(['musee', 'famille', 'shopping']);
  const visible = (l) => !l.categories || l.categories.some((c) => actives.has(c));
  const poser = (id, l, cat, html) => {
    const el = document.createElement('div');
    el.className = 'medaillon' + (cat === 'hotel' ? ' hotel' : ''); el.style.setProperty('--c', COUL[cat]);
    el.innerHTML = html;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (el.classList.contains('replie')) { map.easeTo({ center: [l.lon, l.lat], zoom: Math.min(map.getZoom() + 1.2, 18.5), duration: 500 }); return; }
      if (cat === 'hotel') return;
      ouvrir(id);
    });
    const m = new maplibregl.Marker({ element: el, anchor: 'bottom', rotationAlignment: 'viewport', pitchAlignment: 'viewport' }).setLngLat([l.lon, l.lat]).addTo(map);
    medaillons.set(id, { l, el, m, rang: ORDRE[cat] });
  };
  poser('hotel', hotel, 'hotel', `<div class="rond">H</div><div class="nom" data-i18n="hotel.nom">${t('hotel.nom')}</div><div class="tige"></div><div class="pied"></div>`);
  for (const l of lieux) {
    const ph = photos[l.id];
    poser(l.id, l, l.categories[0], `<div class="rond" style="background-image:url('${ph ? ph.mini : ''}')"></div><div class="nom">${echap(tLieu(l, 'nom').replace(/ \(.*\)$/, ''))}</div><div class="tige"></div><div class="pied"></div>`);
  }
  const parRang = [...medaillons.values()].sort((a, b) => a.rang - b.rang);
  let attente = 0;
  function placer() {
    attente = 0;
    const poses = [];
    for (const md of parRang) {
      if (md.el.hidden) continue;
      const p = map.project(md.m.getLngLat());
      const boite = [p.x - 44, p.y - 124, p.x + 44, p.y - 28];
      const libre = md.el.classList.contains('choisi') || !poses.some((q) => boite[0] < q[2] && boite[2] > q[0] && boite[1] < q[3] && boite[3] > q[1]);
      md.el.classList.toggle('replie', !libre);
      if (libre) poses.push(boite);
    }
  }
  map.on('move', () => { if (!attente) attente = requestAnimationFrame(placer); });
  // un lieu fermé « dort » : médaillon terni (recalculé chaque minute)
  function majEtats() {
    for (const l of lieux) {
      const e = statut(l.horaires).etat;
      medaillons.get(l.id).el.classList.toggle('dort', e === 'ferme' || e === 'pause');
    }
    if (!$('liste').hidden) remplirListe();
  }

  // ---------- fiche ----------
  let choisi = null;
  function ouvrir(id, { centrer = true, garderDefilement = false } = {}) {
    effacerTrajet();
    fermerListe();
    if (choisi) medaillons.get(choisi).el.classList.remove('choisi');
    choisi = id;
    const md = medaillons.get(id), l = md.l;
    md.el.classList.add('choisi');
    afficherFiche(l, { photo: photos[id], verifie, trajet: trajets[id], onTrajet: (mode) => montrerTrajet(id, mode), garderDefilement });
    document.body.classList.add('fiche-ouverte');
    if (centrer) {
      // le lieu au centre de la partie de carte que la fiche laisse visible
      const large = innerWidth >= 760, f = $('fiche').getBoundingClientRect();
      const decal = large ? [-f.width / 2, 0] : [0, -Math.min(f.height, innerHeight * 0.6) / 2];
      map.easeTo({ center: [l.lon, l.lat], zoom: Math.max(map.getZoom(), 16.2), offset: decal, duration: 700 });
    }
    placer();
  }
  function fermer() {
    fermerFiche();
    effacerTrajet();
    document.body.classList.remove('fiche-ouverte');
    if (choisi) medaillons.get(choisi).el.classList.remove('choisi');
    choisi = null;
    placer();
  }
  $('fiche-fermer').addEventListener('click', fermer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { fermerListe(); fermer(); } });
  map.on('click', () => { if (!trajetAffiche) fermer(); });

  // ---------- trajets depuis l'hôtel : marche en pointillés, tram à la couleur de sa ligne ----------
  map.addSource('trajet', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'trajet-bord', type: 'line', source: 'trajet', layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#2f2a24', 'line-width': ['case', ['==', ['get', 'mode'], 'tram'], 8, 6], 'line-opacity': 0.85 } });
  map.addLayer({ id: 'trajet-tram', type: 'line', source: 'trajet', filter: ['==', ['get', 'mode'], 'tram'], layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': ['get', 'couleur'], 'line-width': 5 } });
  map.addLayer({ id: 'trajet-pied', type: 'line', source: 'trajet', filter: ['==', ['get', 'mode'], 'pied'], layout: { 'line-join': 'round' },
    paint: { 'line-color': '#f3d27a', 'line-width': 3, 'line-dasharray': [1.2, 1.2] } });
  map.addLayer({ id: 'trajet-arrets', type: 'circle', source: 'trajet', filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-radius': 4.5, 'circle-color': '#fff', 'circle-stroke-color': '#2f2a24', 'circle-stroke-width': 2 } });
  let trajetAffiche = null;
  const ll = ([la, lo]) => [lo, la];
  function montrerTrajet(id, mode) {
    const tr = trajets[id];
    const f = [];
    const pied = (pts) => f.push({ type: 'Feature', properties: { mode: 'pied' }, geometry: { type: 'LineString', coordinates: pts.map(ll) } });
    if (mode === 'tram' && tr.tram) {
      pied(tr.tram.avant.trace);
      for (const g of tr.tram.legs) {
        f.push({ type: 'Feature', properties: { mode: 'tram', couleur: g.couleur }, geometry: { type: 'LineString', coordinates: g.pts.map(ll) } });
        for (const p of g.pts) f.push({ type: 'Feature', properties: { mode: 'arret' }, geometry: { type: 'Point', coordinates: ll(p) } });
      }
      pied(tr.tram.apres.trace);
    } else pied(tr.pied.trace);
    map.getSource('trajet').setData({ type: 'FeatureCollection', features: f });
    trajetAffiche = { id, mode };
    fermerFiche();
    document.body.classList.remove('fiche-ouverte');
    barreTrajet();
    const b = new maplibregl.LngLatBounds();
    for (const x of f) (x.geometry.type === 'Point' ? [x.geometry.coordinates] : x.geometry.coordinates).forEach((c) => b.extend(c));
    map.fitBounds(b, { padding: { top: 70, bottom: 110, left: 40, right: 40 }, maxZoom: 16.5, duration: 800 });
  }
  function barreTrajet() {
    const { id, mode } = trajetAffiche, tr = trajets[id], l = medaillons.get(id).l;
    const quoi = mode === 'tram' && tr.tram ? `${t('trajet.tram')} ${tr.tram.legs.map(puce).join(' ')} · ${tr.tram.min} min` : t('trajet.marche', { n: tr.pied.min });
    $('barre-trajet').innerHTML = `<span><b>${echap(tLieu(l, 'nom'))}</b> · ${quoi}</span>
      <button id="revoir">${t('trajet.fiche')}</button><button id="fin-trajet" aria-label="${t('trajet.effacer')}">✕</button>`;
    $('barre-trajet').hidden = false;
    $('revoir').addEventListener('click', () => ouvrir(id, { centrer: false }));
    $('fin-trajet').addEventListener('click', fermer);
  }
  function effacerTrajet() {
    trajetAffiche = null;
    map.getSource('trajet')?.setData({ type: 'FeatureCollection', features: [] });
    $('barre-trajet').hidden = true;
  }

  // ---------- liste des lieux, du plus proche au plus loin de l'hôtel ----------
  function remplirListe() {
    $('liste-lieux').innerHTML = lieux.filter(visible)
      .sort((a, b) => trajets[a.id].pied.min - trajets[b.id].pied.min)
      .map((l) => {
        const b = badgeStatut(l.horaires), tr = trajets[l.id], ph = photos[l.id];
        const temps = tr.tram ? t('liste.temps', { p: tr.pied.min, t: tr.tram.min }) : `${tr.pied.min} min`;
        return `<li><button data-id="${l.id}" style="--c:${COUL[l.categories[0]]}">
          <span class="vignette-lieu" style="background-image:url('${ph ? ph.mini : ''}')"></span>
          <span class="nom">${echap(tLieu(l, 'nom'))}</span>
          ${b ? `<span class="etat etat-${b.cls}">${t('court.' + b.court)}</span>` : '<span></span>'}
          <span class="temps">${temps}</span></button></li>`;
      }).join('');
    for (const b of $('liste-lieux').querySelectorAll('button')) b.addEventListener('click', () => ouvrir(b.dataset.id));
  }
  function fermerListe() { $('liste').hidden = true; $('bouton-liste').setAttribute('aria-expanded', 'false'); }
  $('bouton-liste').addEventListener('click', () => {
    const ouvrirListe = $('liste').hidden;
    if (ouvrirListe) { fermer(); remplirListe(); }
    $('liste').hidden = !ouvrirListe;
    $('bouton-liste').setAttribute('aria-expanded', String(ouvrirListe));
  });
  $('liste-fermer').addEventListener('click', fermerListe);

  // ---------- filtres par catégorie ----------
  const filtrer = () => {
    for (const md of medaillons.values()) md.el.hidden = !visible(md.l);
    map.setFilter('halos', ['any', ['!', ['in', ['get', 'cat'], ['literal', ['musee', 'famille', 'shopping']]]], ['in', ['get', 'cat'], ['literal', [...actives]]]]);
    if (!$('liste').hidden) remplirListe();
    placer();
  };
  for (const b of document.querySelectorAll('[data-cat]')) {
    b.addEventListener('click', () => {
      const cat = b.dataset.cat, actif = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(actif));
      actif ? actives.add(cat) : actives.delete(cat);
      if (!actives.size) { actives.add(cat); b.setAttribute('aria-pressed', 'true'); } // jamais tout éteint
      filtrer();
    });
  }

  placer();
  majEtats();
  setInterval(majEtats, 60000);
  map.once('idle', () => $('chargement').classList.add('fini'));
  window.carteBM = map; // essais
});
