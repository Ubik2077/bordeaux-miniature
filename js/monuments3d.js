// Monuments en 3D fine (three.js) posés sur la carte MapLibre, avec de vraies ombres portées.
// Repère local en mètres : x vers l'est, y vers le nord, z vers le haut (repère « droit », celui que three.js
// attend pour orienter les faces et la lumière) ; le passage aux coordonnées Mercator (y vers le sud) se fait dans
// la projection, qui contient déjà un retournement côté MapLibre : les deux s'annulent et les faces restent à l'endroit.
// Chaque bâtiment est construit à partir de son contour réel (IGN ou OpenStreetMap), selon un style :
// classique (pierre, fenêtres, Mansart, lucarnes), moderne, bunker, halle, serre, Cité du Vin… et quelques monuments
// dessinés pièce par pièce (Grand Théâtre, pont de pierre, Girondins, porte Cailhau, tour Pey-Berland…).

import * as THREE from '../vendor/three.module.min.js';

const ORIGINE = [-0.5675, 44.8485]; // centre de la zone
const EXAG = 1.6; // hauteurs exagérées, comme sur une maquette
// position exacte : on passe par les coordonnées Mercator de MapLibre (une simple conversion en mètres par degré
// décalait les bâtiments d'environ 0,7 % de leur distance au centre, soit près de 20 m aux bassins à flot,
// un écart qui devenait visible en zoomant)
const MERC0 = maplibregl.MercatorCoordinate.fromLngLat(ORIGINE, 0), ECHELLE = MERC0.meterInMercatorCoordinateUnits();
const loc = (p) => { const m = maplibregl.MercatorCoordinate.fromLngLat(p, 0); return new THREE.Vector2((m.x - MERC0.x) / ECHELLE, (MERC0.y - m.y) / ECHELLE); };
const anneauLocal = (a) => { const r = a.map(loc); if (r.length > 1 && r[0].distanceTo(r[r.length - 1]) < 0.01) r.pop(); return r; };

// ---------- matériaux ----------
function texture(l, h, dessin) {
  const cv = document.createElement('canvas'); cv.width = l; cv.height = h;
  dessin(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const fenetres = texture(64, 72, (x) => {
  x.fillStyle = '#f1dfb7'; x.fillRect(0, 0, 64, 72);
  x.fillStyle = '#e3cd9f'; x.fillRect(0, 0, 64, 4); x.fillRect(0, 36, 64, 1);           // cordons et joints
  x.fillStyle = '#fbf1d8'; x.fillRect(18, 14, 28, 46);                                    // encadrement
  x.fillStyle = '#4c463c'; x.fillRect(22, 18, 20, 40);                                    // fenêtre
  x.fillStyle = '#7d7466'; x.fillRect(31, 18, 2, 40); x.fillRect(22, 32, 20, 2); x.fillRect(22, 45, 20, 2);
  x.fillStyle = '#e8d3a6'; x.fillRect(16, 58, 32, 4);                                     // appui
});
fenetres.repeat.set(1 / 4.2, 1 / 4.6); // une fenêtre tous les 4,2 m, un étage tous les 4,6 m
const ardoisesTex = texture(32, 32, (x) => {
  x.fillStyle = '#717c8a'; x.fillRect(0, 0, 32, 32);
  x.fillStyle = '#626c79'; for (let y = 7; y < 32; y += 8) x.fillRect(0, y, 32, 1);
  x.fillStyle = '#808b98'; for (let y = 0; y < 32; y += 8) for (let i = (y / 8) % 2 ? 4 : 0; i < 32; i += 8) x.fillRect(i, y, 1, 7);
});
ardoisesTex.repeat.set(1 / 2.5, 1 / 2.5);
const vitrages = texture(64, 64, (x) => {
  x.fillStyle = '#e9e4da'; x.fillRect(0, 0, 64, 64);                                     // béton clair
  x.fillStyle = '#6f8796'; x.fillRect(0, 14, 64, 30);                                     // bandeau vitré
  x.fillStyle = '#9db4c0'; for (let i = 0; i < 64; i += 16) x.fillRect(i + 1, 16, 6, 26); // reflets
  x.fillStyle = '#d8d2c6'; for (let i = 0; i < 64; i += 16) x.fillRect(i, 14, 2, 30);     // meneaux
});
vitrages.repeat.set(1 / 6, 1 / 4);
const beton = texture(64, 64, (x) => {
  x.fillStyle = '#b9b3a8'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#aaa398'; for (let y = 0; y < 64; y += 16) x.fillRect(0, y, 64, 1);
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(80,70,60,${Math.random() * 0.08})`; x.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
});
beton.repeat.set(1 / 8, 1 / 8);
// base sous-marine : béton brut et rangée d'alvéoles sombres au pied (les anciens abris des sous-marins)
const alveoles = texture(128, 128, (x) => {
  x.fillStyle = '#b4aea3'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(70,60,50,${Math.random() * 0.1})`; x.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
  x.fillStyle = '#a49d92'; x.fillRect(0, 30, 128, 3);
  x.fillStyle = '#3a3631'; x.fillRect(14, 62, 100, 66);                    // l'alvéole
  x.fillStyle = '#5a554d'; x.fillRect(14, 62, 100, 6);
});
alveoles.repeat.set(1 / 22, 1 / 16);
const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });
const M = {
  pierre: mat({ color: '#f2e0b9' }),
  claire: mat({ color: '#fbf2dc', roughness: 0.85 }),
  facade: mat({ map: fenetres }),
  ardoise: mat({ map: ardoisesTex, roughness: 0.7, metalness: 0.1, flatShading: true }),
  ardoiseUnie: mat({ color: '#6e7987', roughness: 0.7, metalness: 0.1, flatShading: true }),
  bronze: mat({ color: '#5b7a61', roughness: 0.45, metalness: 0.55 }),
  or: mat({ color: '#e0b64e', roughness: 0.3, metalness: 0.85 }),
  verre: mat({ color: '#bcd8e0', roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.78 }),
  eau: mat({ color: '#d9eef6', roughness: 0.12, metalness: 0, emissive: '#9fc9da', emissiveIntensity: 0.25 }), // sans reflet d'environnement, le métal paraîtrait noir
  brique: mat({ color: '#cf977a' }),
  blanc: mat({ color: '#ffffff', roughness: 0.6 }),
  lumiere: mat({ color: '#fff6dc', emissive: '#ffe7a8', emissiveIntensity: 0.6 }),
  vitrages: mat({ map: vitrages, roughness: 0.5 }),
  betonClair: mat({ color: '#ece7dd' }),
  beton: mat({ map: beton }),
  alveoles: mat({ map: alveoles }),
  betonSombre: mat({ color: '#9c968c' }),
  zinc: mat({ color: '#a3abb3', roughness: 0.55, metalness: 0.2, flatShading: true }),
  cite: mat({ color: '#dcb95f', roughness: 0.32, metalness: 0.15, emissive: '#7a5a1a', emissiveIntensity: 0.12 }),
  verreCite: mat({ color: '#b7c4b8', roughness: 0.15, metalness: 0.25, emissive: '#3a3a26', emissiveIntensity: 0.12 }),
  hotel: mat({ color: '#e4eef3' }),
};

// ---------- outils de construction ----------
const groupe = new THREE.Group();
const ajouter = (geo, m, ombre = true) => {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = ombre; o.receiveShadow = true; o.frustumCulled = false;
  groupe.add(o);
  return o;
};
// volume droit à partir d'un contour (matériaux : [dessus, côtés])
function prisme(anneau, z0, z1, m = M.pierre) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(anneau), { depth: z1 - z0, bevelEnabled: false });
  g.translate(0, 0, z0);
  return ajouter(g, m);
}
const centreDe = (r) => r.reduce((s, p) => s.add(p), new THREE.Vector2()).divideScalar(r.length);
const rayonDe = (r) => { let a = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; a += p.x * q.y - q.x * p.y; } return Math.sqrt(Math.abs(a / 2) / Math.PI); };
const reduire = (r, d) => { const c = centreDe(r), k = 1 - d / rayonDe(r); return r.map((p) => c.clone().add(p.clone().sub(c).multiplyScalar(k))); };
// tronc de pyramide : le contour en bas, le même réduit de « retrait » mètres en haut (toits en pente, corniches)
function tronc(anneau, z0, z1, retrait, m) {
  const haut = reduire(anneau, retrait), pos = [];
  const n = anneau.length;
  for (let i = 0; i < n; i++) {
    const a = anneau[i], b = anneau[(i + 1) % n], c = haut[(i + 1) % n], d = haut[i];
    pos.push(a.x, a.y, z0, b.x, b.y, z0, c.x, c.y, z1, a.x, a.y, z0, c.x, c.y, z1, d.x, d.y, z1);
  }
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(haut, [])) for (const p of [haut[i], haut[j], haut[k]]) pos.push(p.x, p.y, z1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // coordonnées de texture en mètres, pour que les ardoises gardent leur taille
  const uv = []; for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] + pos[i + 1] * 0.3, pos[i + 2] * 1.6 + pos[i + 1] * 0.7);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  ajouter(g, m);
  return haut;
}
// rectangle d'encombrement minimal : centre, angle de l'axe long, longueur, largeur
function encombrement(r) {
  let best = null;
  for (let d = 0; d < 180; d += 0.5) {
    const a = (d * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of r) { const u = p.x * c + p.y * s, v = -p.x * s + p.y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    if (!best || (u1 - u0) * (v1 - v0) < best.aire) best = { aire: (u1 - u0) * (v1 - v0), a, u: (u0 + u1) / 2, v: (v0 + v1) / 2, l: u1 - u0, p: v1 - v0 };
  }
  const { a, u, v } = best;
  const e = { c: new THREE.Vector2(u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)), a, l: best.l, p: best.p };
  if (e.p > e.l) { e.a += Math.PI / 2; [e.l, e.p] = [e.p, e.l]; } // a : axe long
  return e;
}
// repère d'un bâtiment : (u le long de l'axe, v en travers) → point local
const repere = (c, a) => (u, v) => new THREE.Vector2(c.x + u * Math.cos(a) - v * Math.sin(a), c.y + u * Math.sin(a) + v * Math.cos(a));
const rect = (R, u, v, l, p) => [R(u - l / 2, v - p / 2), R(u + l / 2, v - p / 2), R(u + l / 2, v + p / 2), R(u - l / 2, v + p / 2)];
function cylindre(p, r, z0, z1, m, n = 16, r2 = r) {
  const g = new THREE.CylinderGeometry(r2, r, z1 - z0, n); g.rotateX(Math.PI / 2); g.translate(p.x, p.y, (z0 + z1) / 2);
  return ajouter(g, m);
}
function cone(p, r, z0, z1, m, n = 8, rot = 0) {
  const g = new THREE.ConeGeometry(r, z1 - z0, n); g.rotateX(Math.PI / 2); g.rotateZ(rot); g.translate(p.x, p.y, (z0 + z1) / 2);
  return ajouter(g, m);
}
function boule(p, r, z, m) { const g = new THREE.SphereGeometry(r, 16, 10); g.translate(p.x, p.y, z); return ajouter(g, m); }
// petits objets répétés (lucarnes, lampadaires, médaillons) : un seul maillage instancié par sorte
function repetes(geo, m, matrices, ombre = true) {
  const im = new THREE.InstancedMesh(geo, m, matrices.length);
  matrices.forEach((x, i) => im.setMatrixAt(i, x));
  im.castShadow = ombre; im.receiveShadow = true; im.frustumCulled = false;
  groupe.add(im);
}
const placement = (x, y, z, rotZ = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotZ), new THREE.Vector3(1, 1, 1));

// ---------- bâtiment de pierre à la bordelaise : façades à fenêtres, corniche, toit à la Mansart, lucarnes ----------
const lucarnes = [];
function immeuble(anneau, h, { toit = 'mansarde', fenetres: avecFenetres = true } = {}) {
  const corniche = h - 3.4;
  prisme(anneau, 0, corniche, avecFenetres ? [M.pierre, M.facade] : M.pierre);
  const bord = tronc(anneau, corniche, corniche + 0.7, -0.5, M.claire);          // corniche en saillie
  if (toit === 'gothique') { tronc(bord, corniche + 0.7, corniche + 9, Math.min(rayonDe(bord) * 0.8, 9), M.ardoiseUnie); return; }
  if (toit === 'bas') { tronc(bord, corniche + 0.7, corniche + 2.2, 3, M.ardoise); return; }
  const brisis = tronc(bord, corniche + 0.7, corniche + 3.2, 1.4, M.ardoise);     // pente raide (brisis)
  tronc(brisis, corniche + 3.2, corniche + 4.2, Math.min(3, rayonDe(brisis) * 0.5), M.ardoiseUnie); // terrasson
  // lucarnes régulières sur chaque grand côté
  for (let i = 0; i < bord.length; i++) {
    const a = bord[i], b = bord[(i + 1) % bord.length], cote = b.clone().sub(a), long = cote.length();
    if (long < 7) continue;
    const dir = cote.clone().normalize(), normale = new THREE.Vector2(-dir.y, dir.x);
    const vers = centreDe(bord).sub(a).dot(normale) > 0 ? normale : normale.negate(); // vers l'intérieur du toit
    const n = Math.floor((long - 3) / 4.2);
    for (let k = 0; k < n; k++) {
      const p = a.clone().add(dir.clone().multiplyScalar(2 + (k + 0.5) * ((long - 4) / n))).add(vers.clone().multiplyScalar(0.7));
      lucarnes.push(placement(p.x, p.y, corniche + 1.4, Math.atan2(dir.y, dir.x)));
    }
  }
}

// ---------- Grand Théâtre : péristyle de 12 colonnes et 12 statues côté place de la Comédie ----------
function grandTheatre(contour) {
  const r = anneauLocal(contour), E = encombrement(r);
  // u négatif = côté ouest, celui de la façade sur la place de la Comédie
  const a = Math.cos(E.a) < 0 ? E.a + Math.PI : E.a;
  const R = repere(E.c, a), L = E.l, P = E.p, x0 = -L / 2, porche = 7;
  prisme(rect(R, porche / 2, 0, L - porche, P), 0, 19, [M.pierre, M.facade]);
  tronc(rect(R, porche / 2, 0, L - porche, P), 19, 19.7, -0.4, M.claire);
  for (let i = 0; i < 12; i++) {
    const v = -P / 2 + 2 + (i * (P - 4)) / 11, p = R(x0 + 1.9, v);
    prisme(rect(R, x0 + 1.9, v, 1.7, 1.7), 0, 0.7, M.claire);                 // base
    cylindre(p, 0.8, 0.7, 13.4, M.claire, 14, 0.72);                           // fût, légèrement fuselé
    prisme(rect(R, x0 + 1.9, v, 2.0, 2.0), 13.4, 14.5, M.claire);              // chapiteau
    // statue des Muses et des Grâces
    prisme(rect(R, x0 + 1.9, v, 1.0, 1.0), 18.1, 18.7, M.claire);
    cylindre(p, 0.36, 18.7, 20.1, M.claire, 10, 0.3);
    boule(p, 0.3, 20.4, M.claire);
  }
  prisme(rect(R, x0 + porche / 2, 0, porche, P), 14.5, 17.1, M.pierre);       // entablement
  tronc(rect(R, x0 + porche / 2, 0, porche, P), 17.1, 17.6, -0.35, M.claire);  // corniche
  prisme(rect(R, x0 + porche / 2, 0, porche - 0.6, P - 0.6), 17.6, 18.1, M.claire); // balustrade
  tronc(rect(R, porche / 2, 0, L - porche - 0.6, P - 0.6), 19.7, 22.5, 2.6, M.ardoise);
  prisme(rect(R, L * 0.14, 0, L * 0.34, P * 0.56), 19.7, 25, [M.ardoiseUnie, M.pierre]); // cage de scène
  tronc(rect(R, L * 0.14, 0, L * 0.34, P * 0.56), 25, 27.5, 2.8, M.ardoise);
}

// ---------- pont de pierre : 17 arches surbaissées, médaillons blancs, lampadaires ----------
function pont(contour) {
  const r = anneauLocal(contour), E = encombrement(r), L = E.l, P = E.p, n = 17, pile = 4.2;
  const forme = new THREE.Shape([new THREE.Vector2(-L / 2, 0), new THREE.Vector2(L / 2, 0), new THREE.Vector2(L / 2, 9.2), new THREE.Vector2(-L / 2, 9.2)]);
  const portee = L / n;
  for (let i = 0; i < n; i++) {
    const u0 = -L / 2 + i * portee + pile / 2, u1 = -L / 2 + (i + 1) * portee - pile / 2, m = (u0 + u1) / 2;
    const trou = new THREE.Path();
    trou.moveTo(u0, 0.25); trou.lineTo(u0, 2.2); trou.quadraticCurveTo(m, 2.2 + 2 * 4.6, u1, 2.2); trou.lineTo(u1, 0.25); trou.closePath();
    forme.holes.push(trou);
  }
  const g = new THREE.ExtrudeGeometry(forme, { depth: P, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0, -P / 2); g.rotateX(Math.PI / 2); g.rotateZ(E.a); g.translate(E.c.x, E.c.y, 0);
  ajouter(g, [M.pierre, M.brique]);
  const R = repere(E.c, E.a);
  prisme(rect(R, 0, 0, L, P + 0.6), 9.2, 9.8, M.claire);                         // corniche du tablier
  // médaillons blancs au-dessus des piles, sur les deux faces ; lampadaires sur les deux trottoirs
  const disque = new THREE.CylinderGeometry(1.15, 1.15, 0.25, 20);
  const med = [], mats = [], globes = [];
  for (let i = 1; i < n; i++) for (const s of [-1, 1]) {
    const p = R(-L / 2 + i * portee, s * (P / 2 + 0.13));
    med.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y, 6.4), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), E.a), new THREE.Vector3(1, 1, 1)));
  }
  repetes(disque, M.blanc, med, false);
  for (let u = -L / 2 + 12; u < L / 2; u += 24) for (const s of [-1, 1]) {
    const p = R(u, s * (P / 2 - 0.4));
    mats.push(placement(p.x, p.y, 11.6)); globes.push(placement(p.x, p.y, 13.6));
  }
  const fut = new THREE.CylinderGeometry(0.12, 0.16, 3.6, 6); fut.rotateX(Math.PI / 2);
  repetes(fut, M.ardoiseUnie, mats);
  repetes(new THREE.SphereGeometry(0.4, 10, 8), M.lumiere, globes, false);
}

// ---------- monument aux Girondins : bassin, chevaux, colonne, Liberté brisant ses chaînes ----------
function girondins(contour) {
  const c = centreDe(anneauLocal(contour));
  cylindre(c, 16.6, 0, 1.0, M.claire, 40);
  cylindre(c, 15.8, 0, 1.05, M.eau, 40);
  for (const s of [-1, 1]) {                                                        // groupes de chevaux marins
    const p = new THREE.Vector2(c.x + s * 9, c.y);
    prisme([p.clone().add(new THREE.Vector2(-3, -1.6)), p.clone().add(new THREE.Vector2(3, -1.6)), p.clone().add(new THREE.Vector2(3, 1.6)), p.clone().add(new THREE.Vector2(-3, 1.6))], 1, 2.2, M.bronze);
    for (const d of [-1.6, 0, 1.6]) boule(new THREE.Vector2(p.x + d, p.y), 1.0, 3.0, M.bronze);
  }
  prisme([c.clone().add(new THREE.Vector2(-4.5, -4.5)), c.clone().add(new THREE.Vector2(4.5, -4.5)), c.clone().add(new THREE.Vector2(4.5, 4.5)), c.clone().add(new THREE.Vector2(-4.5, 4.5))], 0, 7, M.pierre);
  cylindre(c, 2.4, 7, 8, M.claire, 20);
  cylindre(c, 1.6, 8, 39, M.claire, 20, 1.35);
  cylindre(c, 2.5, 39, 40.4, M.claire, 20, 2.0);
  cylindre(c, 0.9, 40.4, 44.5, M.bronze, 12, 0.6);
  boule(c, 0.55, 45.1, M.bronze);
  const bras = new THREE.CylinderGeometry(0.18, 0.18, 2.6, 6); bras.rotateX(0.5); bras.translate(c.x + 0.5, c.y - 0.4, 45.6);
  ajouter(bras, M.bronze);
}

function rostrale(contour) {
  const c = centreDe(anneauLocal(contour)), sq = (d) => [c.clone().add(new THREE.Vector2(-d, -d)), c.clone().add(new THREE.Vector2(d, -d)), c.clone().add(new THREE.Vector2(d, d)), c.clone().add(new THREE.Vector2(-d, d))];
  prisme(sq(1.9), 0, 3.2, M.pierre);
  tronc(sq(1.9), 3.2, 3.6, -0.2, M.claire);
  cylindre(c, 0.95, 3.6, 18, M.claire, 16, 0.8);
  for (const h of [7, 10.5, 14]) for (const s of [-1, 1]) cone(new THREE.Vector2(c.x + s * 1.4, c.y), 0.45, h, h + 1.2, M.bronze, 4, 0);
  cylindre(c, 1.2, 18, 18.8, M.claire, 16);
  cylindre(c, 0.5, 18.8, 21, M.bronze, 10, 0.4);
  boule(c, 0.35, 21.3, M.bronze);
}

// ---------- porte Cailhau : tour, toit pointu, deux tourelles côté Garonne ----------
function cailhau(contour) {
  const r = anneauLocal(contour), E = encombrement(r);
  prisme(r, 0, 21, M.pierre);
  tronc(r, 21, 21.6, -0.3, M.claire);
  cone(E.c, Math.hypot(E.l, E.p) * 0.42, 21.6, 34, M.ardoiseUnie, 4, E.a + Math.PI / 4);
  const R = repere(E.c, E.a), est = Math.cos(E.a) > 0 ? 1 : -1;
  for (const s of [-1, 1]) {
    const p = R(est * (E.l / 2 - 0.6), s * (E.p / 2 - 0.6));
    cylindre(p, 1.9, 0, 23, M.pierre, 16);
    cylindre(p, 2.1, 23, 23.5, M.claire, 16);
    cone(p, 2.2, 23.5, 30.5, M.ardoiseUnie, 12);
  }
}

// ---------- tour Pey-Berland : clocher, flèche, pinacles, Notre-Dame d'Aquitaine dorée ----------
function peyBerland(contour) {
  const r = anneauLocal(contour), E = encombrement(r), R = repere(E.c, E.a);
  prisme(r, 0, 47, M.pierre);
  tronc(r, 47, 47.6, -0.3, M.claire);
  cone(E.c, Math.min(E.l, E.p) * 0.42, 47.6, 64, M.pierre, 8, Math.PI / 8 + E.a);
  for (const [u, v] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) cone(R(u * (E.l / 2 - 0.8), v * (E.p / 2 - 0.8)), 0.7, 47.6, 53, M.pierre, 6);
  cylindre(E.c, 0.45, 64, 67, M.or, 10, 0.3);
  boule(E.c, 0.35, 67.3, M.or);
}

// ---------- galerie des Grands Hommes : rotonde et coupole de verre ----------
function grandsHommes(contour) {
  const r = anneauLocal(contour), c = centreDe(r), ray = rayonDe(r);
  prisme(r, 0, 12.5, [M.pierre, M.facade]);
  tronc(r, 12.5, 13.2, -0.4, M.claire);
  const d = new THREE.SphereGeometry(ray * 0.8, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  d.rotateX(Math.PI / 2); d.scale(1, 1, 0.55); d.translate(c.x, c.y, 13.2);
  ajouter(d, M.verre);
  cylindre(c, ray * 0.12, 13.2 + ray * 0.8 * 0.55 - 0.3, 13.2 + ray * 0.8 * 0.55 + 1.2, M.claire, 16);
}

// ---------- bâtiments modernes, bunker, halle, serre ----------
function moderne(anneau, h, facade = M.vitrages) {
  prisme(anneau, 0, h, [M.betonClair, facade]);
  tronc(anneau, h, h + 0.9, 0.35, M.betonClair);                 // acrotère
  const c = centreDe(anneau), r = Math.max(2, rayonDe(anneau) * 0.18);
  prisme([c.clone().add(new THREE.Vector2(-r, -r)), c.clone().add(new THREE.Vector2(r, -r)), c.clone().add(new THREE.Vector2(r, r)), c.clone().add(new THREE.Vector2(-r, r))], h, h + 2.2, M.betonSombre); // édicule
}
function bunker(anneau, h) {
  prisme(anneau, 0, h, [M.betonSombre, M.alveoles]);
  tronc(anneau, h, h + 2.5, -1.2, M.betonSombre);                // dalle de toit débordante, épaisse
}
function halle(anneau, h) {
  prisme(anneau, 0, h * 0.6, [M.pierre, M.facade]);
  const haut = tronc(anneau, h * 0.6, h * 0.6 + 0.5, -0.4, M.claire);
  tronc(haut, h * 0.6 + 0.5, h + 3, Math.min(rayonDe(haut) * 0.75, 12), M.zinc); // grande toiture de zinc
}
function serre(anneau, h) {
  prisme(anneau, 0, 0.8, M.claire);
  prisme(anneau, 0.8, h, M.verre);
  tronc(anneau, h, h + 0.4, -0.2, M.blanc);
}
// la Cité du Vin : des courbes dorées qui tournent sur elles-mêmes, comme le vin dans un verre qu'on fait tourner.
// Empilement de tranches : le contour s'affine, pivote et se décale vers la Garonne en montant ; un léger renflement
// à mi-hauteur arrondit la silhouette ; une tranche sur trois est vitrée, comme les bandeaux de verre du bâtiment.
function citeDuVin(anneau, h) {
  const c = centreDe(anneau), n = 34, CORPS = 0.5; // la moitié basse : le corps arrondi ; au-dessus : la tour
  const tranche = (t) => {
    let f, dec;
    if (t <= CORPS) { const u = t / CORPS; f = (1 + 0.1 * Math.sin(Math.PI * u)) * (1 - 0.32 * u * u); dec = new THREE.Vector2(3 * u * u, 1.2 * u * u); }
    else { const u = (t - CORPS) / (1 - CORPS); f = 0.6 - 0.5 * Math.pow(u, 0.8); dec = new THREE.Vector2(3 + 16 * Math.pow(u, 0.9), 1.2 + 5 * Math.pow(u, 0.9)); } // vers la Garonne
    const tour = 0.7 * t * t, cos = Math.cos(tour), sin = Math.sin(tour);
    return anneau.map((p) => { const v = p.clone().sub(c).multiplyScalar(Math.max(f, 0.08)); return c.clone().add(dec).add(new THREE.Vector2(v.x * cos - v.y * sin, v.x * sin + v.y * cos)); });
  };
  let bas = tranche(0);
  for (let i = 0; i < n; i++) {
    const t1 = (i + 1) / n, haut = tranche(t1), z0 = (h * i) / n, z1 = h * t1, pos = [];
    for (let k = 0; k < bas.length; k++) {
      const a = bas[k], b = bas[(k + 1) % bas.length], d = haut[(k + 1) % haut.length], e = haut[k];
      pos.push(a.x, a.y, z0, b.x, b.y, z0, d.x, d.y, z1, a.x, a.y, z0, d.x, d.y, z1, e.x, e.y, z1);
    }
    // le dessus du corps (terrasse) et le sommet de la tour
    const capot = (r, z) => { for (const [x, y, w] of THREE.ShapeUtils.triangulateShape(r, [])) for (const p of [r[x], r[y], r[w]]) pos.push(p.x, p.y, z); };
    if (i === n - 1) capot(haut, z1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    ajouter(g, i % 6 === 4 ? M.verreCite : M.cite);
    bas = haut;
  }
}

// ---------- la couche MapLibre ----------
// options.exag : exagération des hauteurs (l'affiche pousse un peu plus que la carte)
export function coucheMonuments(D, { exag = EXAG } = {}) {
  for (const b of D.batis) {
    const r = anneauLocal(b.anneau);
    if (r.length < 3) continue;
    switch (b.style) {
      case 'gothique': immeuble(r, b.h, { toit: 'gothique', fenetres: false }); break;
      case 'entrepot': immeuble(r, b.h, { toit: 'bas' }); break;
      case 'moderne': moderne(r, b.h, b.id === 'hotel' ? M.vitrages : M.vitrages); break;
      case 'hangar': moderne(r, b.h); break;
      case 'bunker': bunker(r, b.h); break;
      case 'halle': halle(r, b.h); break;
      case 'serre': serre(r, b.h); break;
      case 'cite': citeDuVin(r, 55 / EXAG); break; // 55 m réels, sans exagération
      default: immeuble(r, b.h); // classique et gare
    }
  }
  const m = D.monuments;
  grandTheatre(m.grandTheatre); pont(m.pont); girondins(m.girondins); m.rostrales.forEach(rostrale);
  cailhau(m.cailhau); peyBerland(m.peyBerland); grandsHommes(m.grandsHommes);
  prisme(anneauLocal(m.miroir), 0, 0.12, M.eau).castShadow = false;
  // lucarnes : petite façade à fenêtre et toit à deux pentes
  const caisse = new THREE.BoxGeometry(1.5, 1.1, 1.9); caisse.translate(0, 0, 0.95);
  repetes(caisse, M.claire, lucarnes);
  const chapeau = new THREE.ConeGeometry(1.1, 1.0, 4); chapeau.rotateX(Math.PI / 2); chapeau.rotateZ(Math.PI / 4); chapeau.translate(0, 0, 2.4);
  repetes(chapeau, M.ardoiseUnie, lucarnes);
  groupe.scale.set(1, 1, exag);

  const scene = new THREE.Scene();
  scene.add(groupe);
  // le sol qui reçoit les ombres : invisible ailleurs, juste au-dessus de la ville plate (1 m)
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.ShadowMaterial({ color: '#2e1d0b', opacity: 0.46 }));
  sol.position.z = 1.15; sol.receiveShadow = true; sol.frustumCulled = false;
  scene.add(sol);
  // soleil de fin d'après-midi, au sud-ouest, assez bas : ombres longues vers le nord-est
  // (coordonnées de la scène : x vers l'est, y vers le nord)
  const soleil = new THREE.DirectionalLight('#fff0d4', 3.0);
  soleil.position.set(-560, -420, 330); soleil.target.position.set(0, 0, 0);
  soleil.castShadow = true;
  Object.assign(soleil.shadow.camera, { left: -950, right: 950, top: 950, bottom: -950, near: 10, far: 2500 });
  soleil.shadow.mapSize.set(4096, 4096); soleil.shadow.bias = -0.0004; soleil.shadow.normalBias = 0.4;
  scene.add(soleil, soleil.target);
  const ciel = new THREE.HemisphereLight('#fff6e6', '#b9a37c', 1.9); ciel.position.set(0, 0, 1);
  scene.add(ciel, new THREE.AmbientLight('#ffffff', 0.25));

  // repère du soleil (celui de sa caméra d'ombre), pour caler la zone d'ombre sur sa grille de pixels
  const DIRECTION_SOLEIL = new THREE.Vector3(-560, -420, 330);
  const depuisSoleil = new THREE.Matrix4().lookAt(DIRECTION_SOLEIL, new THREE.Vector3(), new THREE.Object3D().up);
  const versSoleil = depuisSoleil.clone().invert();
  const camera = new THREE.Camera();
  const placementCarte = new THREE.Matrix4().makeTranslation(MERC0.x, MERC0.y, MERC0.z).scale(new THREE.Vector3(ECHELLE, -ECHELLE, ECHELLE));
  let rendu = null, carte = null;
  return {
    id: 'monuments-3d', type: 'custom', renderingMode: '3d',
    onAdd(map, gl) {
      carte = map;
      rendu = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      rendu.autoClear = false;
      rendu.shadowMap.enabled = true; rendu.shadowMap.type = THREE.PCFSoftShadowMap;
    },
    render(gl, matrice) {
      // la zone de calcul des ombres suit la vue : nettes de près, toujours présentes de loin
      // la taille de la zone ne change que par paliers et son centre est calé sur la grille des pixels d'ombre :
      // sinon les contours des ombres « nagent » à chaque mouvement de la carte
      const r = Math.min(3200, 350 * Math.pow(2, Math.max(0, Math.ceil(16 - carte.getZoom() + 1))));
      const texel = (2 * r) / soleil.shadow.mapSize.x, brut = loc(carte.getCenter().toArray());
      const c = new THREE.Vector3(brut.x, brut.y, 0).applyMatrix4(versSoleil);   // dans le repère du soleil
      c.x = Math.round(c.x / texel) * texel; c.y = Math.round(c.y / texel) * texel;
      c.applyMatrix4(depuisSoleil);
      soleil.target.position.copy(c); soleil.position.copy(c).add(DIRECTION_SOLEIL);
      Object.assign(soleil.shadow.camera, { left: -r, right: r, top: r, bottom: -r });
      soleil.shadow.camera.updateProjectionMatrix(); soleil.target.updateMatrixWorld();
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrice).multiply(placementCarte);
      rendu.resetState();
      // la zone de dessin suit la taille réelle de la carte : three.js garde sinon celle du premier affichage,
      // et tout redimensionnement (fenêtre, rotation, barre d'adresse du téléphone qui se replie) décalait,
      // déformait ou faisait disparaître les bâtiments
      rendu.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      rendu.render(scene, camera);
    },
  };
}
