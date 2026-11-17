// Horaires des lieux et badge « ouvert maintenant ».
// Le cœur (lecture du format OpenStreetMap « opening_hours » simplifié) vient de js/hours.js de
// « Bordeaux à la carte ». Ajouts propres à Canelé Quest, décrits dans data/lieux.json :
//   periodes   : horaires par saison (du/au en MM-JJ, bornes incluses, passage d'année possible),
//                ou réservés aux vacances scolaires (vacances: true) ; la première qui convient l'emporte
//   feries     : 'off' = fermé les jours fériés (sauf les MM-JJ de « sauf »), 'certains' = à vérifier
//   exceptions : { 'MM-JJ' ou 'AAAA-MM-JJ' : 'HH:MM-HH:MM' | 'off' }
//   fermetures : jours ou plages fermés ('MM-JJ' ou ['AAAA-MM-JJ', 'AAAA-MM-JJ'])
//   indicatif  : horaires approximatifs (rues commerçantes…) → pas de badge ouvert/fermé
// Toutes les heures sont celles de Bordeaux, quel que soit le fuseau du téléphone.

const JOURS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const BIENTOT_MIN = 45;

// ---------- lecture d'une règle opening_hours (sous-ensemble utile ici) ----------
const cache = new Map();
export function lire(oh) {
  if (cache.has(oh)) return cache.get(oh);
  let semaine;
  if (/^\s*24\/7\s*$/.test(oh)) semaine = JOURS.map(() => [[0, 1440]]);
  else if (/^\s*off\s*$/.test(oh)) semaine = JOURS.map(() => []);
  else {
    semaine = JOURS.map(() => []);
    for (const regle of oh.split(/\s*;\s*/).filter(Boolean)) {
      const m = regle.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)\s+(.+)$/);
      const jours = m ? lireJours(m[1]) : [0, 1, 2, 3, 4, 5, 6];
      const reste = (m ? m[2] : regle).trim();
      const iv = /^off$/.test(reste) ? [] : lirePlages(reste);
      for (const j of jours) semaine[j] = iv.slice();
    }
  }
  cache.set(oh, semaine);
  return semaine;
}

function lireJours(s) {
  const out = new Set();
  for (const tok of s.split(',').filter(Boolean)) {
    const [a, b] = tok.split('-').map((j) => JOURS.indexOf(j));
    if (b == null) { out.add(a); continue; }
    for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
  }
  return [...out];
}

const enMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
function lirePlages(s) {
  return s.split(/\s*,\s*/).map((p) => {
    const [a, b] = p.split('-').map(enMin);
    return [a, b <= a ? b + 1440 : b];
  });
}

// ---------- calendrier ----------
let VACANCES = [];
export const chargerVacances = (v) => { VACANCES = v.periodes; };

const ici = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
// date et minute du jour à Bordeaux
export function maintenant(d = new Date()) {
  const p = Object.fromEntries(ici.formatToParts(d).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
const jourSuivant = (iso, n = 1) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const jourSemaine = (iso) => (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7;

function paques(an) { // algorithme de Meeus
  const a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${an}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}
export function ferie(iso) {
  const an = +iso.slice(0, 4), md = iso.slice(5);
  if (['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].includes(md)) return true;
  const p = paques(an);
  return [1, 39, 50].some((n) => jourSuivant(p, n) === iso); // lundi de Pâques, Ascension, lundi de Pentecôte
}
const enVacances = (iso) => VACANCES.some(([a, b]) => iso >= a && iso <= b);
const dansPlage = (md, du, au) => (du <= au ? md >= du && md <= au : md >= du || md <= au);

// ---------- horaires d'un lieu pour une date ----------
export function periode(h, iso) {
  const md = iso.slice(5);
  return h.periodes.find((p) => (!p.vacances || enVacances(iso)) && (!p.du || dansPlage(md, p.du, p.au)));
}

export function plagesDuJour(h, iso) {
  const md = iso.slice(5);
  const ex = h.exceptions?.[iso] ?? h.exceptions?.[md];
  if (ex) return { plages: ex === 'off' ? [] : lirePlages(ex) };
  for (const f of h.fermetures || []) {
    if (Array.isArray(f) ? iso >= f[0] && iso <= f[1] : f === md) return { plages: [], raison: 'fermeture' };
  }
  const p = periode(h, iso);
  if (!p) return { plages: [], raison: 'inconnu' };
  if (ferie(iso) && h.feries === 'off' && !(h.sauf || []).includes(md)) return { plages: [], raison: 'ferie' };
  return { plages: lire(p.oh)[jourSemaine(iso)], raison: p.raison, doute: ferie(iso) && h.feries === 'certains' };
}

// ---------- statut à un instant ----------
// etat : ouvert | bientot | ferme | pause | libre | indicatif
export function statut(h, d = new Date()) {
  if (h.indicatif) return { etat: 'indicatif' };
  const { iso, min } = maintenant(d);
  const auj = plagesDuJour(h, iso);
  if (auj.raison === 'pause-hiver') return { etat: 'pause', reprise: repriseApres(h, iso) };
  if (h.periodes.length === 1 && h.periodes[0].oh.trim() === '24/7') return { etat: 'libre' };
  const veille = plagesDuJour(h, jourSuivant(iso, -1)).plages;
  const encours = auj.plages.find(([a, b]) => min >= a && min < b) || veille.find(([, b]) => b > 1440 && min < b - 1440);
  if (encours) {
    const fin = encours[1] > 1440 && min < encours[0] ? encours[1] - 1440 : encours[1];
    return { etat: fin - min <= BIENTOT_MIN ? 'bientot' : 'ouvert', jusqua: fin % 1440, doute: auj.doute || h.variable };
  }
  // prochaine ouverture dans les 14 jours
  for (let k = 0; k < 14; k++) {
    const jour = jourSuivant(iso, k);
    const p = plagesDuJour(h, jour).plages.filter(([a]) => k > 0 || a > min).sort((x, y) => x[0] - y[0])[0];
    if (p) return { etat: 'ferme', dans: k, jour: jourSemaine(jour), a: p[0], raison: auj.raison, doute: h.variable };
  }
  return { etat: 'ferme', raison: auj.raison };
}

function repriseApres(h, iso) {
  for (let k = 1; k < 200; k++) {
    const jour = jourSuivant(iso, k);
    if (periode(h, jour)?.raison !== 'pause-hiver') return jour;
  }
  return null;
}

// ---------- affichage ----------
// Semaine de la période en cours, jours identiques regroupés : [{ jours: [0, 2, 3…], plages: [[a, b]…] }]
export function semaine(h, d = new Date()) {
  const { iso } = maintenant(d);
  const p = periode(h, iso);
  if (!p) return null;
  const s = lire(p.oh), groupes = [];
  s.forEach((plages, j) => {
    const cle = JSON.stringify(plages);
    const g = groupes.find((x) => x.cle === cle);
    g ? g.jours.push(j) : groupes.push({ cle, jours: [j], plages });
  });
  return { groupes, periode: p };
}
