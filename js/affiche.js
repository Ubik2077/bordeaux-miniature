// Affiche A5 : la vue 3D du centre (même dessin que la carte) découpée en île sur une carte de papier,
// les monuments nommés par des lignes de rappel, le QR code vers la carte.

import { habiller } from './fond-carte.js';

const URL_SITE = 'https://ubik2077.github.io/bordeaux-miniature/';
const $ = (id) => document.getElementById(id);
const charger = (u) => fetch(u).then((r) => r.json());
const [fond, batis, { hotel }] = await Promise.all(['data/carte/fond.json', 'data/carte/batis.json', 'data/lieux.json'].map(charger));

// ---------- QR code et textes ----------
const qr = qrcode(0, 'M');
qr.addData(URL_SITE); qr.make();
$('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
$('url').textContent = URL_SITE.replace('https://', '').replace(/\/$/, '');
$('hotel').textContent = hotel.nom;

// tirage pseudo-aléatoire reproductible : la même affiche à chaque impression
let graine = 7;
const hasard = () => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };

// ---------- la carte de papier en fond : lignes de niveau et quadrillage très pâles ----------
{
  const s = [];
  for (let x = 0; x <= 148; x += 12) s.push(`<line x1="${x}" y1="0" x2="${x}" y2="210" stroke="#d9cdb4" stroke-width=".12"/>`);
  for (let y = 0; y <= 210; y += 12) s.push(`<line x1="0" y1="${y}" x2="148" y2="${y}" stroke="#d9cdb4" stroke-width=".12"/>`);
  for (let k = 0; k < 16; k++) {
    const y0 = 20 + k * 12 + hasard() * 6, pts = [];
    for (let x = -5; x <= 153; x += 8) pts.push(`${x},${(y0 + 5 * Math.sin(x / 17 + k) + 3 * Math.sin(x / 7 + k * 2)).toFixed(1)}`);
    s.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="#cbbd9f" stroke-width=".18"/>`);
  }
  // un fleuve imaginaire au loin et une rose des vents discrète
  s.push('<path d="M150 40 C 120 60, 128 95, 100 120 S 70 170, 90 212" fill="none" stroke="#b9d3dd" stroke-width="3" opacity=".55"/>');
  s.push('<g transform="translate(18 34)" opacity=".5"><circle r="7" fill="none" stroke="#8a7a60" stroke-width=".2"/><path d="M0 -9 L1.4 0 L0 1.4 L-1.4 0 Z" fill="#8a7a60"/><path d="M0 9 L1.4 0 L0 -1.4 L-1.4 0 Z" fill="none" stroke="#8a7a60" stroke-width=".2"/><text y="-10.5" text-anchor="middle" font-size="2.6" font-family="Cormorant Garamond" fill="#8a7a60">N</text></g>');
  $('fond').innerHTML = s.join('');
}

// ---------- l'île : forme découpée, épaisseur, bord de papier déchiré ----------
const L = 1180, H = 900;                              // taille de rendu de la vue 3D (pixels), nette à l'impression
const MM = 96 / 25.4, K = (138 * MM) / L;             // l'île fait 138 mm de large sur l'affiche
const EPAIS = 30, OMBRE = 46;                          // épaisseur de la tranche et décalage de l'ombre (pixels de rendu)
$('scene').style.height = `${(H + OMBRE + 10) * K}px`;
function contour(rx, ry, dent) {
  const pts = [];
  for (let i = 0; i < 140; i++) {
    const a = (i / 140) * 2 * Math.PI;
    const r = 1 + 0.055 * Math.sin(3 * a + 1.3) + 0.035 * Math.sin(5 * a + 0.4) + 0.02 * Math.sin(9 * a + 2) + (hasard() - 0.5) * dent;
    pts.push(`${(50 + rx * r * Math.cos(a)).toFixed(2)}% ${(50 + ry * r * Math.sin(a)).toFixed(2)}%`);
  }
  return `polygon(${pts.join(', ')})`;
}
const forme = contour(47, 46, 0.012), bord = contour(48.4, 47.6, 0.05);
const placer = (el, dy, clip) => Object.assign(el.style, { width: `${L}px`, height: `${H}px`, transform: `translate(${5 * MM}px, ${dy * K}px) scale(${K})`, clipPath: clip });
placer($('ile-ombre'), OMBRE, forme);
placer($('ile-tranche'), EPAIS, forme);
const papier = document.createElement('div');
papier.className = 'ile-tranche'; papier.style.background = '#fbf8f0';
$('scene').insertBefore(papier, $('ile'));
placer(papier, EPAIS * 0.45, bord);                     // le bord de papier déchiré, entre la tranche et la ville
placer($('ile'), 0, forme);
Object.assign($('rappels').style, { width: `${L}px`, height: `${H}px`, transform: `translate(${5 * MM}px, 0) scale(${K})` });
$('rappels').setAttribute('viewBox', `0 0 ${L} ${H}`);

// ---------- la vue 3D, puis figée en image ----------
const map = new maplibregl.Map({
  container: 'carte',
  style: { version: 8, sources: {}, layers: [{ id: 'mer', type: 'background', paint: { 'background-color': '#86b8cf' } }] },
  center: [-0.5706, 44.8414], zoom: 16.15, pitch: 58, bearing: -24,
  interactive: false, attributionControl: false, preserveDrawingBuffer: true, fadeDuration: 0,
});
const MONUMENTS = [
  ['GRAND THÉÂTRE', [-0.57348, 44.8426]],
  ['PLACE DE LA BOURSE', [-0.57045, 44.84135]],
  ['MIROIR D’EAU', [-0.56916, 44.84177]],
  ['PONT DE PIERRE', [-0.5642, 44.8380]],
  ['PORTE CAILHAU', [-0.5685, 44.83876]],
  ['TOUR PEY-BERLAND', [-0.57662, 44.83761]],
  ['MONUMENT AUX GIRONDINS', [-0.57487, 44.8454]],
  ['GALERIE DES GRANDS HOMMES', [-0.57759, 44.84309]],
];
map.on('load', () => {
  habiller(map, fond, batis, { exag: 2.3 }); // monuments un peu plus hauts que sur la carte, pour qu'ils se dressent
  map.once('idle', () => setTimeout(() => {
    const points = MONUMENTS.map(([nom, p]) => ({ nom, ...map.project(p) }));
    const img = new Image();
    img.src = map.getCanvas().toDataURL('image/png');
    img.alt = 'Le centre de Bordeaux en maquette';
    img.onload = () => { $('carte').replaceWith(img); map.remove(); rappels(points); $('attente').hidden = true; document.body.dataset.pret = '1'; };
  }, 1800)); // le temps que les ombres de la 3D soient calculées
});

// ---------- lignes de rappel : le nom au-dessus du monument, un trait fin jusqu'à lui ----------
function rappels(points) {
  const poses = [], s = [];
  for (const p of points.sort((a, b) => a.y - b.y)) {
    if (p.x < 40 || p.x > L - 40 || p.y < 40 || p.y > H - 20) continue;
    let y = p.y - 120;
    const l = p.nom.length * 11 + 24;
    while (poses.some((q) => Math.abs(q.y - y) < 34 && Math.abs(q.x - p.x) < (q.l + l) / 2)) y -= 36;
    y = Math.max(26, y);
    const x = Math.min(Math.max(p.x, l / 2 + 6), L - l / 2 - 6);
    poses.push({ x, y, l });
    s.push(`<line x1="${p.x}" y1="${p.y}" x2="${x}" y2="${y + 10}" stroke="#2f2a24" stroke-width="1.6"/>`,
      `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#fff" stroke="#2f2a24" stroke-width="2"/>`,
      `<rect x="${x - l / 2}" y="${y - 17}" width="${l}" height="26" rx="2" fill="rgba(250,246,236,.92)" stroke="#cdbb97" stroke-width="1.2"/>`,
      `<text x="${x}" y="${y + 2}" text-anchor="middle" font-family="Inter, sans-serif" font-weight="600" font-size="15" letter-spacing="1.6" fill="#2f2a24">${p.nom}</text>`);
  }
  $('rappels').innerHTML = s.join('');
}
