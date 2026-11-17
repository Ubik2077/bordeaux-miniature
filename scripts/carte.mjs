#!/usr/bin/env node
// Données de la carte « papier + maquettes 3D », sur toute la zone (de la gare Saint-Jean aux bassins à flot).
// À partir des données brutes de scripts/fetch.mjs (IGN BD TOPO, OpenStreetMap), écrit :
//   data/carte/fond.json  → terre, eau, parcs, rues, voies ferrées, bâtiments à plat, arbres, halos des lieux
//                           (format compact de scripts/compact.mjs, ≈ 4× plus léger que le GeoJSON)
//   data/carte/batis.json → contours des bâtiments modélisés en 3D dans la page (js/monuments3d.js) :
//                           bâtiments des lieux à visiter (avec leur style) et monuments dessinés à part
// Usage : node scripts/carte.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import pc from 'polygon-clipping';
import { compacter, compacterPoints } from './compact.mjs';

const RAW = path.join(os.tmpdir(), 'canele-quest-raw'); // même cache que scripts/fetch.mjs
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'carte');
const lire = async (f) => JSON.parse(await readFile(path.join(RAW, f + '.json'), 'utf8'));

const B = { o: -0.5935, s: 44.8215, e: -0.5415, n: 44.8755 };
const cadre = [[[B.o, B.s], [B.e, B.s], [B.e, B.n], [B.o, B.n], [B.o, B.s]]];
const dedans = ([x, y]) => x > B.o && x < B.e && y > B.s && y < B.n;
const polygones = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const lignes = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
const deuxD = (c) => (typeof c[0] === 'number' ? [c[0], c[1]] : c.map(deuxD));
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const arrondir = (c) => (typeof c[0] === 'number' ? [r5(c[0]), r5(c[1])] : c.map(arrondir));
const F = (geometry, properties = {}) => ({ type: 'Feature', properties, geometry });
const MX = 111320 * Math.cos((44.84 * Math.PI) / 180), MY = 110540;
const distM = (a, b) => Math.hypot((a[0] - b[0]) * MX, (a[1] - b[1]) * MY);
const centre = (r) => { let x = 0, y = 0; for (const p of r) { x += p[0]; y += p[1]; } return [x / r.length, y / r.length]; };
const aireM2 = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * MX * r[i + 1][1] * MY - r[i + 1][0] * MX * r[i][1] * MY; return Math.abs(a / 2); };
// allège un contour : retire les points presque alignés (écart < tol mètres), sans changer la forme visible
function simplifier(r, tol = 0.6) {
  if (r.length < 6) return r;
  const garder = [r[0]];
  for (let i = 1; i < r.length - 1; i++) {
    const a = garder[garder.length - 1], b = r[i], c = r[i + 1];
    const ax = (c[0] - a[0]) * MX, ay = (c[1] - a[1]) * MY, bx = (b[0] - a[0]) * MX, by = (b[1] - a[1]) * MY;
    const d = Math.abs(ax * by - ay * bx) / (Math.hypot(ax, ay) || 1);
    if (d > tol) garder.push(b);
  }
  garder.push(r[r.length - 1]);
  return garder.length >= 4 ? garder : r;
}
function dansAnneau([x, y], r) {
  let ins = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}

// ---------- eau et terre (les petits bassins brouilleraient les lignes de profondeur) ----------
const eau = [];
for (const f of (await lire('ign-eau')).features) {
  if (f.properties.nature === "Réservoir-bassin d'orage") continue;
  for (const p of polygones(f.geometry)) eau.push(...pc.intersection(deuxD(p), cadre));
}
const eauUnie = pc.union(...eau.map((p) => [p])).filter((p) => aireM2(p[0]) > 20000);
const terre = pc.difference(cadre, ...eauUnie.map((p) => [p]));
console.log(`eau : ${eauUnie.length} étendues, terre : ${terre.length} morceaux`);

// ---------- verdure et arbres ----------
const parcs = [], arbres = [];
for (const el of (await lire('osm-vert')).elements) {
  const t = el.tags || {};
  if (el.type === 'node' && t.natural === 'tree') { if (dedans([el.lon, el.lat])) arbres.push([el.lon, el.lat]); continue; }
  const vert = ['park', 'garden', 'playground'].includes(t.leisure) || ['grass', 'meadow', 'recreation_ground'].includes(t.landuse);
  if (!vert || el.type !== 'way' || !el.geometry) continue;
  const anneau = el.geometry.map((p) => [p.lon, p.lat]);
  if (anneau.length < 4 || !anneau.some(dedans)) continue;
  parcs.push(F({ type: 'Polygon', coordinates: [anneau] }, { jeux: t.leisure === 'playground' ? 1 : 0 }));
}

// ---------- rues et voies ferrées ----------
const rues = [];
for (const f of (await lire('ign-route')).features) {
  const p = f.properties;
  if (Number(p.position_par_rapport_au_sol) < 0) continue;
  const petit = /Sentier|Chemin|Escalier|empierrée/.test(p.nature);
  for (const l of lignes(f.geometry)) {
    if (!l.some(dedans)) continue;
    rues.push(F({ type: 'LineString', coordinates: deuxD(l) }, {
      l: petit ? 1.5 : Math.max(4, (p.largeur_de_chaussee || 4) + 4), // largeur en mètres (chaussée + trottoirs)
      pont: Number(p.position_par_rapport_au_sol) > 0 ? 1 : 0,
      petit: petit ? 1 : 0,
    }));
  }
}
const fer = [];
for (const f of (await lire('ign-fer')).features) {
  const p = f.properties;
  if (!['Voie ferrée principale', 'Voie de service'].includes(p.nature) || Number(p.position_par_rapport_au_sol) < 0) continue;
  for (const l of lignes(f.geometry)) if (l.some(dedans)) fer.push(F({ type: 'LineString', coordinates: deuxD(l) }, { n: Number(p.nombre_de_voies) || 1 }));
}

// ---------- monuments dessinés à part : contours exacts dans OpenStreetMap (mis en cache) ----------
const IDS_OSM = [119097731, 79734107, 1093782523, 53246398, 568436009, 568436012, 568436013, 79978925, 79715950];
async function osmMonuments() {
  const cache = path.join(RAW, 'osm-monuments.json');
  try { return JSON.parse(await readFile(cache, 'utf8')); } catch { /* à télécharger */ }
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'bordeaux-miniature/0.1' },
    body: 'data=' + encodeURIComponent(`[out:json][timeout:60];way(id:${IDS_OSM.join(',')});out geom;`),
  });
  const json = await res.json();
  await writeFile(cache, JSON.stringify(json));
  return json;
}
const OSM = Object.fromEntries((await osmMonuments()).elements.map((e) => [e.id, e.geometry.map((p) => [p.lon, p.lat])]));
const REMPLACES = [79734107, 1093782523, 79978925, 79715950].map((id) => OSM[id]); // remplacés par leur maquette détaillée

// ---------- bâtiments des lieux : style de maquette ----------
//   classique : pierre, fenêtres, toit à la Mansart et lucarnes · moderne : béton clair et vitrages, toit plat
//   bunker : béton massif (base sous-marine) · hangar / entrepot : grands volumes bas · halle : marché couvert
//   serre : verre · cite : la Cité du Vin (courbes dorées) · gothique : cathédrale
const { lieux, hotel } = JSON.parse(await readFile(path.join(ROOT, 'data', 'lieux.json'), 'utf8'));
const STYLES = {
  'musee-aquitaine': 'classique', musba: 'classique', capc: 'entrepot', madd: 'classique', douanes: 'classique',
  'mer-marine': 'moderne', 'bassins-lumieres': 'bunker', 'cap-sciences': 'hangar', 'cite-du-vin': 'cite',
  'musee-illusion': 'classique', museum: 'classique', 'jardin-botanique': 'serre', meriadeck: 'moderne',
  capucins: 'halle', darwin: 'entrepot',
};
// grands repères du paysage, sans fiche
const REPERES = [
  { id: 'bourse', style: 'classique', p: [-0.57063, 44.84203] },
  { id: 'bourse', style: 'classique', p: [-0.57038, 44.8409] },
  { id: 'cathedrale', style: 'gothique', p: [-0.5776, 44.8378] },
  { id: 'cathedrale', style: 'gothique', p: [-0.57718, 44.83774] },
  { id: 'gare', style: 'gare', p: [-0.55628, 44.82592] },
];
// quand le repère du lieu n'est pas sur son bâtiment (centre d'un jardin, d'un ensemble) : points posés à la main
const SUR_LE_BATI = {
  'jardin-botanique': [[-0.55528, 44.84257]],                       // serres et galerie
  darwin: [[-0.56178, 44.84871], [-0.56152, 44.84903]],              // bâtiments de l'ancienne caserne Niel
};
const cibles = [
  ...lieux.filter((l) => STYLES[l.id]).flatMap((l) => (SUR_LE_BATI[l.id] || [[l.lon, l.lat]]).map((p) => ({ id: l.id, style: STYLES[l.id], cat: l.categories[0], p }))),
  ...REPERES.map((r) => ({ ...r, cat: 'repere' })),
  { id: 'hotel', style: 'moderne', cat: 'hotel', p: [hotel.lon, hotel.lat] },
];

const plats = [], halos = [], batis = [], trouves = new Set();
for (const f of (await lire('ign-batiment')).features) {
  const pr = f.properties;
  for (const p of polygones(f.geometry)) {
    const a = deuxD(p);
    if (!a[0].some(dedans) || a[0].length < 4) continue;
    const c = centre(a[0].slice(0, -1));
    if (REMPLACES.some((r) => dansAnneau(c, r))) continue;
    const cible = cibles.find((x) => dansAnneau(x.p, a[0])) || cibles.find((x) => distM(x.p, c) < 20 && aireM2(a[0]) > 150);
    if (cible) {
      trouves.add(cible.id);
      batis.push({ id: cible.id, style: cible.style, cat: cible.cat, h: Math.max(6, pr.hauteur || 10), anneau: arrondir(a[0]) });
      halos.push(F({ type: 'Polygon', coordinates: [a[0]] }, { cat: cible.cat }));
    } else if (aireM2(a[0]) > 12) plats.push(F({ type: 'Polygon', coordinates: [simplifier(a[0])] })); // abris et kiosques minuscules : ignorés
  }
}
const manquants = cibles.filter((c) => !trouves.has(c.id)).map((c) => c.id);
for (const [id, cat] of [[79734107, 'shopping'], [79715950, 'shopping'], [1093782523, 'repere'], [79978925, 'repere']]) {
  halos.push(F({ type: 'Polygon', coordinates: [OSM[id]] }, { cat }));
}
// le pont de pierre est modélisé en 3D : on retire sa chaussée de la carte à plat
for (let i = rues.length - 1; i >= 0; i--) {
  const f = rues[i];
  if (f.properties.pont && dansAnneau(centre(f.geometry.coordinates), OSM[119097731])) rues.splice(i, 1);
}
const monuments = {
  grandTheatre: OSM[79734107], pont: OSM[119097731], girondins: OSM[568436009],
  rostrales: [OSM[568436012], OSM[568436013]], cailhau: OSM[1093782523], peyBerland: OSM[79978925],
  grandsHommes: OSM[79715950], miroir: OSM[53246398],
};
for (const k of Object.keys(monuments)) monuments[k] = arrondir(monuments[k]);
console.log(`bâtiments : ${plats.length} à plat, ${batis.length} modélisés${manquants.length ? ` ; sans bâtiment trouvé : ${manquants.join(', ')}` : ''}`);

// ---------- écriture ----------
await mkdir(OUT, { recursive: true });
const S = 1e5; // ≈ 1 m de précision
const fond = {
  cadre: B,
  terre: compacter(terre.map((p) => F({ type: 'Polygon', coordinates: p })), [], S),
  eau: compacter(eauUnie.map((p) => F({ type: 'Polygon', coordinates: p })), [], S),
  parcs: compacter(parcs, ['jeux'], S),
  rues: compacter(rues, ['l', 'pont', 'petit'], S),
  fer: compacter(fer, ['n'], S),
  plats: compacter(plats, [], S),
  halos: compacter(halos, ['cat'], S),
  arbres: compacterPoints(arbres, S),
};
for (const [nom, donnees] of [['fond', fond], ['batis', { batis, monuments }]]) {
  const fichier = path.join(OUT, nom + '.json');
  await writeFile(fichier, JSON.stringify(donnees));
  console.log(`✓ data/carte/${nom}.json ${((await readFile(fichier)).length / 1e6).toFixed(2)} Mo`);
}
