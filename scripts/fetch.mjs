#!/usr/bin/env node
// Télécharge les données brutes du fond de carte (réponses mises en cache hors du projet).
// Repris de « Port de la Lune » (scripts/fetch.mjs), sur une zone plus grande au nord (bassins à flot)
// et avec les voies ferrées et le tram en plus :
//   - IGN BD TOPO (WFS Géoplateforme, Licence Ouverte) : bâtiments, routes, eau, voies ferrées
//   - OpenStreetMap (Overpass, ODbL) : parcs et pelouses, arbres, places, lignes de tram
// Usage : node scripts/fetch.mjs [--cache]

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const RAW = path.join(os.tmpdir(), 'canele-quest-raw');
export const BBOX = { s: 44.82, w: -0.595, n: 44.877, e: -0.54 };
const USE_CACHE = process.argv.includes('--cache');
const UA = 'canele-quest-proto/0.1';

async function cached(name, fn) {
  const file = path.join(RAW, name + '.json');
  if (USE_CACHE && existsSync(file)) return;
  const data = await fn();
  await writeFile(file, JSON.stringify(data));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wfs(type, props) {
  const all = [];
  const b = `${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e},urn:ogc:def:crs:EPSG::4326`;
  for (let start = 0; ; start += 5000) {
    const url =
      'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature' +
      `&TYPENAMES=BDTOPO_V3:${type}&BBOX=${b}&OUTPUTFORMAT=application/json&COUNT=5000&STARTINDEX=${start}` +
      `&SORTBY=cleabs&propertyName=${[...props, 'geometrie'].join(',')}`;
    let json;
    for (let i = 1; ; i++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        json = await res.json();
        break;
      } catch (e) {
        if (i >= 4) throw e;
        await sleep(3000 * i);
      }
    }
    all.push(...json.features);
    process.stdout.write(`\r↓ IGN ${type} : ${all.length}/${json.numberMatched}   `);
    if (json.features.length < 5000) break;
  }
  console.log();
  return { type: 'FeatureCollection', features: all };
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function overpass(body) {
  const q = `[out:json][timeout:180][bbox:${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e}];${body}`;
  for (let i = 0; i < 9; i++) {
    const url = ENDPOINTS[i % ENDPOINTS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(q),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      console.log(`↓ OSM : ${json.elements.length} éléments`);
      return json;
    } catch (e) {
      console.log(`  Overpass ${new URL(url).host} : ${e.message}, nouvel essai…`);
      await sleep(4000 * (i + 1));
    }
  }
  throw new Error('Overpass indisponible');
}

await mkdir(RAW, { recursive: true });

await cached('ign-batiment', () => wfs('batiment', ['hauteur', 'nature', 'construction_legere']));
await cached('ign-route', () =>
  wfs('troncon_de_route', ['nature', 'importance', 'largeur_de_chaussee', 'position_par_rapport_au_sol']));
await cached('ign-eau', () => wfs('surface_hydrographique', ['nature', 'persistance']));
await cached('ign-fer', () => wfs('troncon_de_voie_ferree', ['nature', 'position_par_rapport_au_sol', 'nombre_de_voies']));

await cached('osm-vert', () =>
  overpass(`(
    nwr["leisure"~"park|garden|playground|pitch"];
    nwr["landuse"~"grass|recreation_ground|cemetery|meadow"];
    nwr["natural"~"wood|scrub|sand|beach"];
    node["natural"="tree"];
    nwr["place"="square"];
    nwr["highway"="pedestrian"]["area"="yes"];
  );out geom;`));

await cached('osm-tram', () => overpass(`(way["railway"="tram"];);out geom;`));

console.log('✓ données brutes dans', RAW);
