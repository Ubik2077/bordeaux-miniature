// Bordeaux Miniature : la carte de papier (MapLibre), les maquettes en 3D (js/monuments3d.js) et les médaillons des lieux.

import { habiller, COUL } from './fond-carte.js';
import { chargerVacances, statut } from './horaires.js';
import { afficherFiche, fermerFiche, badgeStatut, puce, echap } from './fiche.js';
import { LANGS, t, tLieu, setLang, getLang, applyStatic } from './i18n.js';

const charger = (u) => fetch(u).then((r) => r.json());
const [fond, batis, { lieux, hotel, verifie }, photos, vacances, { lieux: trajets }] = await Promise.all(
  ['data/carte/fond.json', 'data/carte/batis.json', 'data/lieux.json', 'data/photos.json', 'data/vacances.json', 'data/trajets.json'].map(charger));
chargerVacances(vacances);
await setLang(getLang());
applyStatic();
const B = fond.cadre;
const $ = (id) => document.getElementById(id);

const etroit = innerWidth < 600;
const map = new maplibregl.Map({
  container: 'carte',
  style: { version: 8, sources: {}, layers: [{ id: 'mer', type: 'background', paint: { 'background-color': '#86b8cf' } }] },
  center: etroit ? [-0.5655, 44.8372] : [-0.5672, 44.8385], zoom: etroit ? 14.1 : 14.7, pitch: 55, bearing: -18,
  maxBounds: [[B.o, B.s], [B.e, B.n]], minZoom: 13.3, maxZoom: 18.5, maxPitch: 65,
  attributionControl: false,
});
map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: 'IGN BD TOPO · © OpenStreetMap' }));
window.carteBM = map; // accès depuis la console, pour les essais
map.on('error', (e) => console.error('carte :', e.error || e));

map.on('load', () => {
  habiller(map, fond, batis);

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
    $('proche').hidden = true;
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
    majProche();
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

  // ---------- « vous êtes ici » : position du visiteur et lieu le plus proche ----------
  const distance = (a, b) => new maplibregl.LngLat(a[0], a[1]).distanceTo(new maplibregl.LngLat(b[0], b[1])); // en mètres
  let ici = null, suivi = null, pointIci = null, dejaCentre = false, minuterie = null;
  function message(texte) {
    $('message').textContent = texte; $('message').hidden = false;
    clearTimeout(minuterie); minuterie = setTimeout(() => { $('message').hidden = true; }, 5000);
  }
  function majProche() {
    if (!ici || choisi || trajetAffiche) { $('proche').hidden = true; return; }
    let best = null;
    for (const l of lieux) if (visible(l)) { const d = distance(ici, [l.lon, l.lat]); if (!best || d < best.d) best = { l, d }; }
    if (!best) { $('proche').hidden = true; return; }
    $('proche').innerHTML = `<span>${t('geo.proche')} <b>${echap(tLieu(best.l, 'nom'))}</b> · ${t('geo.temps', { n: Math.max(1, Math.round((best.d * 1.3) / 70)) })}</span><button id="voir-proche">${t('geo.voir')}</button>`;
    $('proche').hidden = false;
    $('voir-proche').addEventListener('click', () => ouvrir(best.l.id));
  }
  function localiser(actif) {
    $('geo').setAttribute('aria-pressed', String(actif));
    if (!actif) {
      if (suivi != null) navigator.geolocation.clearWatch(suivi);
      suivi = null; ici = null; dejaCentre = false; pointIci?.remove(); pointIci = null; majProche();
      return;
    }
    if (!navigator.geolocation) { message(t('geo.indispo')); return localiser(false); }
    suivi = navigator.geolocation.watchPosition((pos) => {
      const p = [pos.coords.longitude, pos.coords.latitude];
      if (p[0] < B.o || p[0] > B.e || p[1] < B.s || p[1] > B.n) { message(t('geo.loin')); return localiser(false); }
      ici = p;
      if (!pointIci) {
        const el = document.createElement('div'); el.className = 'ici'; el.title = t('geo.ici');
        el.innerHTML = '<span class="halo"></span><span class="point"></span>';
        pointIci = new maplibregl.Marker({ element: el }).setLngLat(p).addTo(map);
      } else pointIci.setLngLat(p);
      if (!dejaCentre) { dejaCentre = true; map.easeTo({ center: p, zoom: Math.max(map.getZoom(), 16), duration: 1000 }); }
      majProche();
    }, (err) => { message(t(err.code === 1 ? 'geo.refus' : 'geo.indispo')); localiser(false); },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  }
  $('geo').addEventListener('click', () => localiser($('geo').getAttribute('aria-pressed') !== 'true'));
  for (const ev of ['fiche-fermer', 'liste-fermer']) $(ev).addEventListener('click', () => setTimeout(majProche, 0));

  // ---------- langues : menu, langue du téléphone détectée au premier lancement ----------
  const btnLangue = $('btn-langue'), menuLangue = $('menu-langue');
  const majBoutonLangue = () => { btnLangue.textContent = `${getLang().toUpperCase()} ▾`; btnLangue.setAttribute('aria-label', `${t('langue.titre')} (${getLang().toUpperCase()})`); };
  function menuOuvert(o) {
    menuLangue.hidden = !o; btnLangue.setAttribute('aria-expanded', String(o));
    if (o) menuLangue.innerHTML = LANGS.map((l) => `<button role="menuitemradio" aria-checked="${l.code === getLang()}" data-lang="${l.code}" lang="${l.code}"><span>${l.flag}</span>${l.name}</button>`).join('');
  }
  btnLangue.addEventListener('click', (e) => { e.stopPropagation(); menuOuvert(menuLangue.hidden); });
  document.addEventListener('click', (e) => { if (!menuLangue.hidden && !e.target.closest('.langue')) menuOuvert(false); });
  menuLangue.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-lang]'); if (!b) return;
    menuOuvert(false);
    await setLang(b.dataset.lang);
    traduire();
  });
  // réécrit tout ce qui est affiché, sans bouger la carte
  function traduire() {
    applyStatic();
    majBoutonLangue();
    for (const [id, md] of medaillons) {
      const nom = md.el.querySelector('.nom');
      nom.textContent = id === 'hotel' ? t('hotel.nom') : tLieu(md.l, 'nom').replace(/ \(.*\)$/, '');
    }
    if (pointIci) pointIci.getElement().title = t('geo.ici');
    if (!$('liste').hidden) remplirListe();
    if (trajetAffiche) barreTrajet();
    else if (choisi) ouvrir(choisi, { centrer: false, garderDefilement: true });
    majProche();
    placer();
  }
  majBoutonLangue();

  placer();
  majEtats();
  setInterval(majEtats, 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  map.once('idle', () => $('chargement').classList.add('fini'));
});
