// Noms gravés sur la carte (quartiers, Garonne) : ils font partie du papier et non de l'interface.
// Chaque nom est dessiné une fois dans une image (lettres d'imprimeur posées à la main, un peu irrégulières,
// creusées : reflet clair d'un côté, ombre de l'autre, encre usée par endroits), puis plaqué sur un ruban
// couché à plat sur la carte, en mètres réels : il grandit quand on zoome, s'incline et tourne avec elle.
// Le ruban suit un tracé, droit pour les quartiers, le cours du fleuve pour la Garonne.

import * as THREE from '../vendor/three.module.min.js';
import { loc } from './monuments3d.js';

// [texte, tracé (lon, lat) dans le sens de lecture, taille du corps en mètres, style]
const DROIT = (p, angle = 0, long = 3000) => {   // tracé droit centré sur p, angle en degrés depuis l'est
  const a = (angle * Math.PI) / 180, dx = (Math.cos(a) * long) / 2 / 78900, dy = (Math.sin(a) * long) / 2 / 111130;
  return [[p[0] - dx, p[1] - dy], [p[0] + dx, p[1] + dy]];
};
const NOMS = [
  // la Garonne suit son axe (calculé sur les données d'eau) : du pont de pierre vers les Chartrons, puis vers Bacalan
  ['La Garonne', [[-0.55813, 44.835], [-0.55966, 44.836], [-0.56103, 44.837], [-0.56232, 44.838], [-0.56337, 44.839], [-0.56433, 44.84],
    [-0.56537, 44.841], [-0.56616, 44.842], [-0.56682, 44.843], [-0.56732, 44.844], [-0.56767, 44.845], [-0.56792, 44.846], [-0.56789, 44.847],
    [-0.56763, 44.848], [-0.56729, 44.849], [-0.56651, 44.85], [-0.56559, 44.851], [-0.56434, 44.852]], 118, 'eau'],
  ['La Garonne', [[-0.5628, 44.853], [-0.56094, 44.854], [-0.55893, 44.855], [-0.55683, 44.856], [-0.55455, 44.857], [-0.55235, 44.858],
    [-0.55031, 44.859], [-0.54849, 44.86], [-0.54701, 44.861]], 105, 'eau'],
  ['Saint-Pierre', DROIT([-0.5718, 44.8398], 4), 58],
  ['Triangle d’or', DROIT([-0.5785, 44.8452], -6), 54],
  ['Quinconces', DROIT([-0.5726, 44.8447], 0), 46],
  ['La Bastide', DROIT([-0.5560, 44.8418], 8), 64],
  ['Chartrons', DROIT([-0.5712, 44.8512], 12), 60],
  ['Saint-Michel', DROIT([-0.5672, 44.8338], -4), 60],
  ['Bassins à flot', DROIT([-0.5555, 44.8668], -8), 62],
  ['Mériadeck', DROIT([-0.5838, 44.8380], 2), 52],
  ['Belcier', DROIT([-0.5525, 44.8262], 10), 58],
  ['Bacalan', DROIT([-0.5548, 44.8722], -4), 60],
];
const STYLES = {
  quartier: { police: '400 {t}px "IM Fell English SC"', espace: 0.3, encre: '#4d453a', opacite: 0.34, majuscules: true },
  eau: { police: 'italic 400 {t}px "IM Fell English"', espace: 0.22, encre: '#1f4458', opacite: 0.38, majuscules: false },
};
const Z = 1.3;                 // juste au-dessus de la ville plate (1 m) et du sol des ombres (1,15 m)
const T = 132;                 // corps des lettres dans l'image, en pixels
const LARGEUR_MAX = 3072;

let graine = 11;
const hasard = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };

// l'image du nom : lettre par lettre, posées à la main
function image(texte, st) {
  const txt = st.majuscules ? texte.toUpperCase() : texte;
  const cv = document.createElement('canvas'), x = cv.getContext('2d');
  let t = T;
  const police = () => st.police.replace('{t}', t);
  const mesure = () => { x.font = police(); return [...txt].reduce((s, c) => s + x.measureText(c).width + st.espace * t, -st.espace * t); };
  let w = mesure();
  if (w + t > LARGEUR_MAX) { t = Math.floor((t * (LARGEUR_MAX - t)) / w); w = mesure(); }
  const marge = Math.round(t * 0.5);
  cv.width = Math.ceil(w + 2 * marge); cv.height = Math.ceil(t * 1.7);
  x.font = police(); x.textBaseline = 'alphabetic';
  const base = cv.height * 0.68, creux = Math.max(1.5, t * 0.022);
  const lettres = [];
  let cx = marge;
  for (const c of txt) {
    const l = x.measureText(c).width;
    lettres.push({ c, x: cx + l / 2, r: (hasard() - 0.5) * 0.05, dy: (hasard() - 0.5) * t * 0.05, k: 1 + (hasard() - 0.5) * 0.06 });
    cx += l + st.espace * t;
  }
  const passe = (couleur, ox, oy) => {
    x.fillStyle = couleur;
    for (const L of lettres) {
      x.save(); x.translate(L.x + ox, base + L.dy + oy); x.rotate(L.r); x.scale(L.k, L.k);
      x.textAlign = 'center'; x.fillText(L.c, 0, 0); x.restore();
    }
  };
  passe('rgba(255, 252, 244, 0.95)', creux, creux);          // reflet sur le bord bas du creux
  passe('rgba(20, 16, 12, 0.9)', -creux * 0.6, -creux * 0.6); // ombre sur le bord haut
  passe(st.encre, 0, 0);                                      // le fond du creux
  // encre usée : quelques manques, comme une plaque qui a beaucoup servi
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < (cv.width * cv.height) / 900; i++) {
    x.globalAlpha = 0.25 + hasard() * 0.5;
    x.beginPath(); x.arc(hasard() * cv.width, hasard() * cv.height, 0.6 + hasard() * t * 0.025, 0, 2 * Math.PI); x.fill();
  }
  return { cv, t };
}

// le ruban : bande de la hauteur de l'image, centrée sur le milieu du tracé, qui en suit les courbes
function ruban(texte, trace, corps, style = 'quartier', aniso = 8) {
  const st = STYLES[style];
  const { cv, t } = image(texte, st);
  const parPixel = corps / t;                                  // mètres par pixel de l'image
  const L = cv.width * parPixel, H = cv.height * parPixel;
  const pts = trace.map((p) => { const v = loc(p); return new THREE.Vector3(v.x, v.y, 0); });
  const courbe = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const total = courbe.getLength();
  const debut = Math.max(0, (total - L) / 2), n = Math.max(2, Math.ceil(L / 12));
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const s = Math.min(total, debut + (i / n) * Math.min(L, total));
    const u = s / total;
    const p = courbe.getPointAt(u), d = courbe.getTangentAt(u);
    const nx = -d.y, ny = d.x;                                 // à gauche du sens de lecture : le haut des lettres
    const haut = 0.68 * H, bas = H - haut;                     // la ligne de base des lettres suit le tracé
    pos.push(p.x - nx * bas, p.y - ny * bas, Z, p.x + nx * haut, p.y + ny * haut, Z);
    uv.push(i / n, 0, i / n, 1);
    if (i) { const a = 2 * (i - 1); idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = aniso;
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: st.opacite, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = -1;                                         // sous les ombres portées des monuments
  m.frustumCulled = false;
  return m;
}

export async function graver() {
  await Promise.all([document.fonts.load(`400 ${T}px "IM Fell English SC"`), document.fonts.load(`italic 400 ${T}px "IM Fell English"`)]);
  const groupe = new THREE.Group();
  for (const [texte, trace, corps, style] of NOMS) groupe.add(ruban(texte, trace, corps, style));
  return groupe;
}
