// Bordeaux Miniature : la carte de papier (MapLibre), les maquettes en 3D (js/monuments3d.js) et les médaillons des lieux.

import { habiller, COUL } from './fond-carte.js';
import { graver } from './gravures.js';
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
  const couche3d = habiller(map, fond, batis);

  // noms des quartiers et de la Garonne gravés dans le papier (js/gravures.js), dès que leurs polices sont là
  graver().then((g) => couche3d.ajouterALaScene(g)).catch((e) => console.error('gravures :', e));

  // rose des vents : tourne avec la carte
  const majRose = () => { $('rose').querySelector('svg').style.transform = `rotate(${-map.getBearing()}deg)`; };
  map.on('rotate', majRose); majRose();
  $('rose').addEventListener('click', () => map.easeTo({ bearing: 0, duration: 600 }));

  // ---------- repères des lieux : un point au sol et le nom sur une étiquette ----------
  // Aucune étiquette n'est cachée : chacune cherche, autour de son point, la première place libre
  // (au-dessus, en biais, à côté, dessous, puis un peu plus loin avec un trait de rappel) ;
  // priorité au lieu choisi, puis à l'hôtel, aux musées, à la famille et au shopping.
  const ORDRE = { hotel: -1, musee: 0, famille: 1, shopping: 2 };
  const medaillons = new Map(); // id → { l, el, nom, trait, m, rang, w, h, pose }
  const actives = new Set(['musee', 'famille', 'shopping']);
  const visible = (l) => !l.categories || l.categories.some((c) => actives.has(c));
  const poser = (id, l, cat, nom) => {
    const el = document.createElement('div');
    el.className = 'repere' + (cat === 'hotel' ? ' hotel' : ''); el.style.setProperty('--c', COUL[cat]);
    el.innerHTML = `<div class="trait"></div><div class="pied"></div><button class="nom" type="button"><span class="texte"></span></button>`;
    el.querySelector('.texte').textContent = nom;
    // au survol du nom, le médaillon photo du lieu en aperçu
    const ph = photos[id];
    if (ph) el.querySelector('.nom').insertAdjacentHTML('afterbegin', `<span class="apercu" aria-hidden="true" style="background-image:url('${ph.mini}')"></span>`);
    el.addEventListener('click', (e) => { e.stopPropagation(); if (cat !== 'hotel') ouvrir(id); });
    const m = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport', pitchAlignment: 'viewport' }).setLngLat([l.lon, l.lat]).addTo(map);
    medaillons.set(id, { l, el, nom: el.querySelector('.nom'), trait: el.querySelector('.trait'), m, rang: ORDRE[cat], w: 0, h: 0, pose: '' });
  };
  poser('hotel', hotel, 'hotel', t('hotel.nom'));
  for (const l of lieux) poser(l.id, l, l.categories[0], tLieu(l, 'nom').replace(/ \(.*\)$/, ''));

  // places candidates [dx, dy, côté] : le point d'accroche de l'étiquette, relatif au point du lieu
  // de près à loin, et dans chaque cercle de préférence au-dessus, puis en biais, à côté, dessous
  const PLACES = [];
  for (const r of [22, 48, 80, 118, 160]) {
    for (const a of [-90, -45, -135, -20, -160, 0, 180, -68, -112, 30, 150, 90, 60, 120]) {
      const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180);
      const cote = Math.abs(c) < 0.4 ? (s < 0 ? 'haut' : 'bas') : (c > 0 ? 'droite' : 'gauche');
      PLACES.push([Math.round(r * c), Math.round(r * s), cote]);
    }
  }
  const boiteDe = (p, [dx, dy, cote], w, h) => {
    const x = p.x + dx, y = p.y + dy;
    if (cote === 'haut') return [x - w / 2, y - h, x + w / 2, y];
    if (cote === 'bas') return [x - w / 2, y, x + w / 2, y + h];
    if (cote === 'droite') return [x, y - h / 2, x + w, y + h / 2];
    return [x - w, y - h / 2, x, y + h / 2];
  };
  const recouvre = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
  const parRang = [...medaillons.values()].sort((a, b) => a.rang - b.rang);
  let attente = 0;
  function placer() {
    attente = 0;
    const ecran = map.getContainer().getBoundingClientRect(), marge = 8;
    const vus = parRang.filter((md) => !md.el.hidden);
    // le lieu choisi passe en premier, et au-dessus des autres
    vus.sort((a, b) => (b.el.classList.contains('choisi') - a.el.classList.contains('choisi')) || a.rang - b.rang);
    for (const md of vus) if (!md.w) { md.w = md.nom.offsetWidth; md.h = md.nom.offsetHeight; }
    const pts = new Map(vus.map((md) => [md, map.project(md.m.getLngLat())]));
    // un lieu hors de l'écran n'a pas besoin de son étiquette : elle prendrait la place des autres en débordant
    for (const [md, p] of pts) {
      const dehors = p.x < -4 || p.y < -4 || p.x > ecran.width + 4 || p.y > ecran.height + 4;
      md.el.classList.toggle('dehors', dehors);
      if (dehors) { pts.delete(md); vus.splice(vus.indexOf(md), 1); }
    }
    const prises = [...pts.values()].map((p) => [p.x - 7, p.y - 7, p.x + 7, p.y + 7]); // les points des lieux restent visibles
    // boutons et cartouche posés sur la carte : les étiquettes les évitent
    for (const el of document.querySelectorAll('.outils > *, .langue > button, .cartouche, .geo, .rose')) {
      const r = el.getBoundingClientRect();
      if (r.width) prises.push([r.left - ecran.left - 4, r.top - ecran.top - 4, r.right - ecran.left + 4, r.bottom - ecran.top + 4]);
    }
    vus.forEach((md, i) => {
      const p = pts.get(md);
      let meilleure = null, cout = Infinity;
      for (const [j, pl] of PLACES.entries()) {
        const b = boiteDe(p, pl, md.w + 4, md.h + 4);
        let c = j * 0.5;                                                         // préférence pour les places proches
        for (const q of prises) c += recouvre(b, q);
        c += 4 * (Math.max(0, marge - b[0]) + Math.max(0, b[2] - ecran.width + marge)) * md.h; // hors de l'écran
        c += 4 * (Math.max(0, marge - b[1]) + Math.max(0, b[3] - ecran.height + marge)) * md.w;
        if (c < cout) { cout = c; meilleure = { pl, b }; }
        if (c === j * 0.5) break;                                                // place libre : on la prend
      }
      prises.push(meilleure.b);
      md.el.classList.toggle('apercu-bas', meilleure.b[1] < 130);              // pas la place au-dessus : aperçu dessous
      const [dx, dy, cote] = meilleure.pl, cle = `${dx},${dy},${cote}`;
      md.el.style.zIndex = md.el.classList.contains('choisi') ? 1000 : 100 - i;
      if (cle === md.pose) return;
      md.pose = cle;
      const tx = { haut: '-50%', bas: '-50%', droite: '0', gauche: '-100%' }[cote], ty = { haut: '-100%', bas: '0', droite: '-50%', gauche: '-50%' }[cote];
      md.nom.style.transform = `translate(${dx}px, ${dy}px) translate(${tx}, ${ty})`;
      const long = Math.hypot(dx, dy);
      Object.assign(md.trait.style, { width: `${long}px`, transform: `rotate(${Math.atan2(dy, dx)}rad)` });
    });
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

  // ---------- nos autres cartes : la langue choisie suit (lien « ?lang=xx ») ----------
  const btnCartes = $('btn-cartes'), menuCartes = $('menu-cartes');
  function cartesOuvert(o) {
    menuCartes.hidden = !o; btnCartes.setAttribute('aria-expanded', String(o));
    if (!o) return;
    menuOuvert(false);
    for (const a of menuCartes.querySelectorAll('[data-carte]')) { const u = new URL(a.href); u.searchParams.set('lang', getLang()); a.href = u.href; }
  }
  btnCartes.addEventListener('click', (e) => { e.stopPropagation(); cartesOuvert(menuCartes.hidden); });
  document.addEventListener('click', (e) => { if (!menuCartes.hidden && !e.target.closest('.autres')) cartesOuvert(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menuCartes.hidden) { cartesOuvert(false); btnCartes.focus(); } });

  // ---------- langues : menu, langue du téléphone détectée au premier lancement ----------
  const btnLangue = $('btn-langue'), menuLangue = $('menu-langue');
  const majBoutonLangue = () => { btnLangue.textContent = `${getLang().toUpperCase()} ▾`; btnLangue.setAttribute('aria-label', `${t('langue.titre')} (${getLang().toUpperCase()})`); };
  function menuOuvert(o) {
    menuLangue.hidden = !o; btnLangue.setAttribute('aria-expanded', String(o));
    if (o && !menuCartes.hidden) cartesOuvert(false);
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
      md.nom.querySelector('.texte').textContent = id === 'hotel' ? t('hotel.nom') : tLieu(md.l, 'nom').replace(/ \(.*\)$/, '');
      md.w = 0; md.pose = '';                                  // la taille de l'étiquette change avec la langue
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
