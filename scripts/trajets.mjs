#!/usr/bin/env node
// Trajets depuis l'hôtel vers chaque lieu, calculés une fois pour toutes (la carte reste utilisable hors ligne) :
//   - à pied, sur le réseau des rues IGN BD TOPO (données de scripts/fetch.mjs) ;
//   - en tram, avec la marche jusqu'à l'arrêt et depuis l'arrêt, une correspondance au plus.
// Réseau piéton repris de « Port de la Lune » (scripts/promenades.mjs), tram repris de « Bordeaux à la carte »
// (js/routing.js, data/tram.json : lignes et arrêts TBM issus d'OpenStreetMap).
// Écrit data/trajets.json. Usage : node scripts/trajets.mjs

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const RAW = path.join(os.tmpdir(), 'canele-quest-raw');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = async (f) => JSON.parse(await readFile(path.join(ROOT, f), 'utf8'));

const PIED = 70;            // m/min (≈ 4,2 km/h, allure avec des enfants)
const TRAM = 20000 / 60;    // m/min, vitesse commerciale entre arrêts
const ARRET_MIN = 0.5;      // arrêt en station
const ATTENTE = 5;          // attente moyenne
const CORRESP = 4;          // correspondance (marche + attente)
const GAIN_MIN = 5;         // on ne propose le tram que s'il fait gagner au moins 5 min

const { hotel, lieux } = await lire('data/lieux.json');
const tram = await lire('data/tram.json');
const fond = await lire('data/fond.json');

// ---------- réseau piéton ----------
const MX = 111320 * Math.cos((44.84 * Math.PI) / 180), MY = 110540;
const dist = (a, b) => Math.hypot((a[0] - b[0]) * MX, (a[1] - b[1]) * MY);
const cle = ([x, y]) => `${x.toFixed(7)},${y.toFixed(7)}`;
const noeuds = new Map(), segments = [];
const noeud = (p) => { const k = cle(p); if (!noeuds.has(k)) noeuds.set(k, { p, voisins: [] }); return k; };
const surPont = new Set();
for (const f of JSON.parse(await readFile(path.join(RAW, 'ign-route.json'), 'utf8')).features) {
  const p = f.properties;
  if (Number(p.position_par_rapport_au_sol) < 0 || p.nature === 'Bretelle') continue;
  const pont = Number(p.position_par_rapport_au_sol) > 0;
  const ls = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const l of ls) for (let i = 1; i < l.length; i++) {
    // découpe en tronçons de 15 m au plus, pour pouvoir traverser n'importe où (voir plus bas)
    const n = Math.ceil(dist(l[i - 1], l[i]) / 15);
    for (let j = 0; j < n; j++) {
      const P = (t) => [l[i - 1][0] + t * (l[i][0] - l[i - 1][0]), l[i - 1][1] + t * (l[i][1] - l[i - 1][1])];
      const pa = P(j / n), pb = P((j + 1) / n);
      const a = noeud(pa), b = noeud(pb), d = dist(pa, pb);
      noeuds.get(a).voisins.push([b, d]); noeuds.get(b).voisins.push([a, d]);
      segments.push([a, b]);
      if (pont) { surPont.add(a); surPont.add(b); }
    }
  }
}
// Traversées : les données IGN décrivent les chaussées, reliées seulement aux carrefours ; un piéton, lui,
// traverse une avenue ou une place où il veut. On relie donc les points de rue distants de moins de 25 m
// (sauf sur les ponts), avec un petit surcoût.
{
  const CASE = 25, grille = new Map();
  const cleCase = (p) => `${Math.floor(p[0] * MX / CASE)},${Math.floor(p[1] * MY / CASE)}`;
  for (const [k, n] of noeuds) if (!surPont.has(k)) {
    const c = cleCase(n.p); (grille.get(c) || grille.set(c, []).get(c)).push(k);
  }
  let ajouts = 0;
  for (const [k, n] of noeuds) {
    if (surPont.has(k)) continue;
    const cx = Math.floor(n.p[0] * MX / CASE), cy = Math.floor(n.p[1] * MY / CASE);
    const deja = new Set(n.voisins.map(([v]) => v));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const v of grille.get(`${cx + dx},${cy + dy}`) || []) {
        if (v <= k || deja.has(v)) continue;
        const d = dist(n.p, noeuds.get(v).p);
        if (d < CASE) { n.voisins.push([v, d * 1.3]); noeuds.get(v).voisins.push([k, d * 1.3]); ajouts++; }
      }
    }
  }
  console.log(`traversées ajoutées : ${ajouts}`);
}
// on n'accroche les points qu'au réseau principal (des bouts de rue isolés existent dans les données)
const composante = new Map();
let plusGrande = null;
for (const depart of noeuds.keys()) {
  if (composante.has(depart)) continue;
  const pile = [depart]; let n = 0;
  composante.set(depart, depart);
  while (pile.length) {
    const k = pile.pop(); n++;
    for (const [v] of noeuds.get(k).voisins) if (!composante.has(v)) { composante.set(v, depart); pile.push(v); }
  }
  if (!plusGrande || n > plusGrande.n) plusGrande = { id: depart, n };
}
const principaux = segments.filter(([a]) => composante.get(a) === plusGrande.id);
console.log(`réseau piéton : ${noeuds.size} nœuds, composante principale ${plusGrande.n}`);

let nTemp = 0;
function accrocher(p) {
  let best = null;
  for (const [a, b] of principaux) {
    const A = noeuds.get(a).p, B = noeuds.get(b).p;
    const ax = (B[0] - A[0]) * MX, ay = (B[1] - A[1]) * MY, px = (p[0] - A[0]) * MX, py = (p[1] - A[1]) * MY;
    const t = Math.max(0, Math.min(1, (px * ax + py * ay) / (ax * ax + ay * ay || 1)));
    const d = Math.hypot(px - t * ax, py - t * ay);
    if (!best || d < best.d) best = { d, a, b, q: [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])] };
  }
  const k = `tmp${nTemp++}`, A = noeuds.get(best.a), B = noeuds.get(best.b);
  const da = dist(best.q, A.p), db = dist(best.q, B.p);
  noeuds.set(k, { p: best.q, voisins: [[best.a, da], [best.b, db]] });
  A.voisins.push([k, da]); B.voisins.push([k, db]);
  return { k, ecart: best.d };
}

// plus courts chemins depuis un nœud vers tout le réseau
function arbre(depart) {
  const cout = new Map([[depart, 0]]), prec = new Map(), tas = [[0, depart]];
  const pousser = (e) => { tas.push(e); let i = tas.length - 1; while (i) { const j = (i - 1) >> 1; if (tas[j][0] <= tas[i][0]) break; [tas[i], tas[j]] = [tas[j], tas[i]]; i = j; } };
  const tirer = () => {
    const top = tas[0], fin = tas.pop();
    if (tas.length) { tas[0] = fin; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < tas.length && tas[l][0] < tas[m][0]) m = l; if (r < tas.length && tas[r][0] < tas[m][0]) m = r; if (m === i) break; [tas[i], tas[m]] = [tas[m], tas[i]]; i = m; } }
    return top;
  };
  while (tas.length) {
    const [c, k] = tirer();
    if (c > cout.get(k)) continue;
    for (const [v, w] of noeuds.get(k).voisins) {
      const nc = c + w;
      if (nc < (cout.get(v) ?? Infinity)) { cout.set(v, nc); prec.set(v, k); pousser([nc, v]); }
    }
  }
  return { cout, prec, depart };
}
function trace(ar, arrivee, sens = 1) { // points du départ de l'arbre jusqu'à « arrivee » (sens -1 : à l'envers)
  const ks = [arrivee];
  while (ks[0] !== ar.depart) {
    const p = ar.prec.get(ks[0]);
    if (p === undefined) throw new Error('point hors du réseau : ' + arrivee);
    ks.unshift(p);
  }
  const pts = ks.map((k) => noeuds.get(k).p);
  return simplifier(sens < 0 ? pts.reverse() : pts);
}
// Douglas-Peucker (tolérance 3 m), coordonnées arrondies à 5 décimales (≈ 1 m)
function simplifier(pts, tol = 3) {
  if (pts.length < 3) return pts.map(r5p);
  const garder = new Uint8Array(pts.length); garder[0] = garder[pts.length - 1] = 1;
  const pile = [[0, pts.length - 1]];
  while (pile.length) {
    const [i, j] = pile.pop(); let dmax = 0, imax = -1;
    const A = pts[i], B = pts[j], ax = (B[0] - A[0]) * MX, ay = (B[1] - A[1]) * MY, n = Math.hypot(ax, ay) || 1;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs(((pts[k][0] - A[0]) * MX) * ay - ((pts[k][1] - A[1]) * MY) * ax) / n;
      if (d > dmax) { dmax = d; imax = k; }
    }
    if (dmax > tol) { garder[imax] = 1; pile.push([i, imax], [imax, j]); }
  }
  return pts.filter((_, k) => garder[k]).map(r5p);
}
const r5p = ([x, y]) => [Math.round(y * 1e5) / 1e5, Math.round(x * 1e5) / 1e5]; // → [lat, lon]
const min = (m) => Math.max(1, Math.round(m / PIED));

// ---------- tram ----------
const dedans = (s) => s.lo > fond.ouest - 0.01 && s.lo < fond.est + 0.01 && s.la > fond.sud - 0.01 && s.la < fond.nord + 0.01;
const arrets = tram.stops.filter(dedans);
const parNom = new Map(arrets.map((s) => [s.name, s]));
const couleur = Object.fromEntries(tram.lines.map((l) => [l.ref, l.colour]));
const voisinsTram = new Map(); // « arrêt|ligne » → [[« arrêt|ligne », minutes]]
const hav = (A, B) => dist([A.lo, A.la], [B.lo, B.la]);
for (const L of tram.lines) for (const v of L.variants) for (let i = 1; i < v.length; i++) {
  const A = parNom.get(v[i - 1]), B = parNom.get(v[i]);
  if (!A || !B) continue;
  const t = (hav(A, B) * 1.15) / TRAM + ARRET_MIN;
  for (const [x, y] of [[A, B], [B, A]]) {
    const k = `${x.name}|${L.ref}`, liste = voisinsTram.get(k) || [];
    if (!liste.some(([n]) => n === `${y.name}|${L.ref}`)) liste.push([`${y.name}|${L.ref}`, t]);
    voisinsTram.set(k, liste);
  }
}

// tous les points sont accrochés au réseau avant de calculer les plus courts chemins
const aHotel = accrocher([hotel.lon, hotel.lat]);
const ancreArret = new Map(arrets.map((s) => [s.name, accrocher([s.lo, s.la]).k]));
const ancreLieu = new Map(lieux.map((l) => [l.id, accrocher([l.lon, l.lat])]));
const arbreHotel = arbre(aHotel.k);

function meilleurTram(arbreLieu, lieuK) {
  // départ : chaque arrêt atteignable à pied depuis l'hôtel ; Dijkstra sur (arrêt, ligne)
  const cout = new Map(), prec = new Map(), file = [];
  for (const s of arrets) {
    const m = arbreHotel.cout.get(ancreArret.get(s.name));
    if (m == null || m > 1500) continue;
    for (const ligne of s.lines) {
      const k = `${s.name}|${ligne}`, c = m / PIED + ATTENTE;
      if (c < (cout.get(k) ?? Infinity)) { cout.set(k, c); prec.set(k, null); file.push(k); }
    }
  }
  const fait = new Set();
  while (file.length) {
    file.sort((a, b) => cout.get(a) - cout.get(b));
    const k = file.shift();
    if (fait.has(k)) continue; fait.add(k);
    const [nom, ligne] = k.split('|');
    const succ = [...(voisinsTram.get(k) || []).map(([n, t]) => [n, t])];
    for (const autre of parNom.get(nom).lines) if (autre !== ligne) succ.push([`${nom}|${autre}`, CORRESP]);
    for (const [n, t] of succ) {
      const c = cout.get(k) + t;
      if (c < (cout.get(n) ?? Infinity)) { cout.set(n, c); prec.set(n, k); file.push(n); }
    }
  }
  let best = null;
  for (const [k, c] of cout) {
    const nom = k.split('|')[0], m = arbreLieu.cout.get(ancreArret.get(nom));
    if (m == null || m > 1500) continue;
    const total = c + m / PIED;
    if (!best || total < best.total) best = { k, total, apres: m };
  }
  if (!best) return null;
  // reconstitue les étapes
  const chaine = [best.k];
  while (prec.get(chaine[0])) chaine.unshift(prec.get(chaine[0]));
  const legs = [];
  for (const k of chaine) {
    const [nom, ligne] = k.split('|');
    const der = legs[legs.length - 1];
    if (der && der.ligne === ligne) der.arrets.push(nom);
    else legs.push({ ligne, couleur: couleur[ligne], arrets: [nom] });
  }
  const etapes = legs.filter((l) => l.arrets.length > 1);
  if (etapes.length > 2 || !etapes.length) return null;
  const premier = etapes[0].arrets[0], dernier = etapes[etapes.length - 1].arrets.at(-1);
  const mAvant = arbreHotel.cout.get(ancreArret.get(premier));
  const mApres = arbreLieu.cout.get(ancreArret.get(dernier));
  return {
    min: Math.round(best.total),
    avant: { m: Math.round(mAvant), min: min(mAvant), trace: trace(arbreHotel, ancreArret.get(premier)) },
    legs: etapes.map((l) => ({ ligne: l.ligne, couleur: l.couleur, de: l.arrets[0], a: l.arrets.at(-1), nb: l.arrets.length - 1,
      pts: l.arrets.map((n) => [parNom.get(n).la, parNom.get(n).lo]) })),
    apres: { m: Math.round(mApres), min: min(mApres), trace: trace(arbreLieu, ancreArret.get(dernier), -1) },
  };
}

const sortie = {};
for (const l of lieux) {
  const a = ancreLieu.get(l.id);
  const arbreLieu = arbre(a.k);
  const m = arbreHotel.cout.get(a.k);
  const pied = { m: Math.round(m), min: min(m), trace: trace(arbreHotel, a.k) };
  // arrêt le plus proche du lieu, à pied
  let proche = null;
  for (const s of arrets) {
    const d = arbreLieu.cout.get(ancreArret.get(s.name));
    if (d != null && (!proche || d < proche.m)) proche = { nom: s.name, lignes: s.lines, m: Math.round(d), min: min(d) };
  }
  let t = meilleurTram(arbreLieu, a.k);
  if (t && t.min > pied.min - GAIN_MIN) t = null;
  sortie[l.id] = { pied, tram: t, arret: proche };
  if (a.ecart > 60) console.log(`  ⚠ ${l.id} : repère à ${Math.round(a.ecart)} m de la rue la plus proche`);
  console.log(`✓ ${l.id.padEnd(18)} ${String(pied.min).padStart(3)} min à pied (${(pied.m / 1000).toFixed(1)} km)` +
    (t ? ` · tram ${t.legs.map((x) => x.ligne).join('+')} ${t.min} min (${t.legs[0].de} → ${t.legs.at(-1).a})` : '') +
    ` · arrêt ${proche.nom} ${proche.lignes.join('/')} ${proche.min} min`);
}
const fichier = path.join(ROOT, 'data', 'trajets.json');
await writeFile(fichier, JSON.stringify({ vitesse: PIED, lieux: sortie }));
console.log(`✓ data/trajets.json ${((await readFile(fichier)).length / 1000).toFixed(0)} Ko`);
