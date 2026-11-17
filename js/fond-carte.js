// Dessin de la carte de papier et de ses maquettes 3D, partagé par la carte (js/carte.js) et l'affiche (js/affiche.js).

import { deplier, points } from './compact.js';
import { coucheMonuments } from './monuments3d.js';

export const COUL = { musee: '#8c2342', famille: '#4f8a46', shopping: '#d9772f', repere: '#5f6b7d', hotel: '#2f6f9a' };

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


// ajoute à une carte MapLibre chargée (style vide) le papier, l'eau, les rues, la ville à plat, les arbres, les halos des lieux
// et la couche des maquettes 3D
export function habiller(map, fond, batis, options = {}) {
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
  map.addLayer(coucheMonuments(batis, options));

}
