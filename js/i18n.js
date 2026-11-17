// Langues : même principe que « Port de la Lune » et « Bordeaux à la carte ».
// Le français est la langue source : textes de l'interface ici, contenus (lieux, photos) dans data/*.json.
// Les autres langues sont dans js/lang/<code>.js, chargées seulement si on les choisit :
//   export default { ui: {clé: texte}, lieux: {id: {nom, description, alerte}}, photos: {id: légende} }
// La langue du téléphone est détectée au premier lancement, puis le choix est mémorisé.

export const LANGS = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', locale: 'fr-FR' },
  { code: 'en', name: 'English', flag: '🇬🇧', locale: 'en-GB' },
  { code: 'es', name: 'Español', flag: '🇪🇸', locale: 'es-ES' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', locale: 'it-IT' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', locale: 'de-DE' },
];

const FR = {
  'doc.titre': 'Bordeaux Miniature · musées, familles, shopping',
  'langue.titre': 'Changer de langue',
  'inventaire.aria': 'Catégories',
  'cats.musee': 'Musées', 'cats.famille': 'Famille', 'cats.shopping': 'Shopping', 'cats.liste': 'Liste',
  'cat.musee': 'Musée', 'cat.famille': 'Famille', 'cat.shopping': 'Shopping',
  'carte.aria': 'Carte en pixels de Bordeaux',
  'credits': 'Fond : IGN BD TOPO, © OpenStreetMap',
  'hotel': 'HÔTEL',
  'hotel.nom': 'Votre hôtel',
  'pied.defaut': 'Touchez un repère',

  'liste.titre': 'Les lieux',
  'liste.aide': "Du plus proche au plus loin de l'hôtel, à pied.",
  'liste.fermer': 'Fermer la liste',
  'liste.temps': '{p} min · tram {t}',
  'fiche.fermer': 'Fermer la fiche',

  'etat.ouvert': "Ouvert · jusqu'à {h}",
  'etat.bientot': 'Ferme bientôt · {h}',
  'etat.pause': "En pause pour l'hiver",
  'etat.libre': 'Accès libre',
  'etat.ferme': 'Fermé',
  'etat.fermeAuj': 'Fermé · ouvre à {h}',
  'etat.fermeDemain': 'Fermé · ouvre demain à {h}',
  'etat.fermeJour': 'Fermé · ouvre {j} à {h}',
  'court.ouvert': 'Ouvert', 'court.bientot': 'Bientôt fermé', 'court.ferme': 'Fermé', 'court.pause': 'Pause hiver', 'court.libre': 'Libre',

  'h.inconnus': 'Non communiqués',
  'h.libre': 'Accès libre, jour et nuit',
  'h.hiver': "Arrêté l'hiver (maintenance)",
  'h.fermeJour': 'fermé',
  'h.minuit': 'minuit',
  'h.indicatif': 'horaires indicatifs, selon les boutiques',
  'h.feries': 'fermé les jours fériés',
  'h.feriesSauf': 'fermé les jours fériés (sauf 14 juillet et 15 août)',
  'h.certains': 'fermé certains jours fériés',
  'h.vacances': 'horaires des vacances scolaires',
  'h.autresVacances': 'autres horaires pendant les vacances scolaires',
  'h.saison': 'horaires de la saison en cours',
  'h.variable': 'peuvent varier',

  'info.duree': 'Durée', 'info.horaires': 'Horaires', 'info.tram': 'Tram', 'info.pmr': 'Accès PMR', 'info.adresse': 'Adresse',
  'info.arret': '{arret} ({lignes}) · {min} min à pied',
  'pmr.oui': 'Accessible', 'pmr.non': 'Non accessible', 'pmr.inconnu': 'Non précisé',

  'trajet.titre': "Depuis l'hôtel",
  'trajet.pied': 'À pied',
  'trajet.tram': 'Tram',
  'trajet.marche': '{n} min à pied',
  'trajet.puis': 'puis',
  'trajet.aide': 'Touchez un trajet pour le voir sur la carte.',
  'trajet.fiche': 'Fiche',
  'trajet.effacer': 'Effacer le trajet',

  'btn.billetterie': 'Billetterie',
  'btn.site': 'Site officiel',
  'source.verifie': 'Horaires vérifiés le {date}',
  'source.lien': 'source',

  'geo.bouton': "Me localiser",
  'geo.ici': "Vous êtes ici",
  'geo.proche': "Le plus proche :",
  'geo.temps': "≈ {n} min à pied",
  'geo.voir': "Voir",
  'geo.loin': "Vous êtes hors de la carte : elle ne vous suit pas.",
  'geo.refus': "Localisation refusée. Vous pouvez l’autoriser dans les réglages du navigateur.",
  'geo.indispo': "Localisation indisponible pour le moment.",

  'cartes.titre': "Nos autres cartes",
  'cartes.alacarte': "Bars et restaurants",
  'cartes.lune': "Monuments historiques, en 3D",

  // âges et durées des données (« dès 7 ans », « 1 h 30 à 2 h »…)
  'age.des': 'dès {n} ans',
  'age.entre': '{a} à {b} ans',
  'age.tous': 'tout âge',
  'age.vin': 'dès 12 ans (parcours sur le vin)',
  'duree.a': 'à',
};

const CLE = 'bm.lang';
const CODES = LANGS.map((l) => l.code);
const charges = { fr: { ui: FR } };

let lang = (() => {
  // langue transmise par une autre de nos cartes (lien « ?lang=en ») : prioritaire
  const param = new URLSearchParams(location.search).get('lang');
  if (CODES.includes(param)) return param;
  try { const s = localStorage.getItem(CLE); if (CODES.includes(s)) return s; } catch { /* stockage indisponible */ }
  for (const l of navigator.languages || [navigator.language || 'fr']) {
    const c = String(l).toLowerCase().slice(0, 2);
    if (CODES.includes(c)) return c;
  }
  return 'en';
})();

export const getLang = () => lang;
export const getLocale = () => LANGS.find((l) => l.code === lang).locale;

export async function setLang(l) {
  if (!CODES.includes(l)) l = 'fr';
  if (!charges[l]) {
    try { charges[l] = (await import(`./lang/${l}.js`)).default; } catch { l = 'fr'; }
  }
  lang = l;
  try { localStorage.setItem(CLE, l); } catch { /* stockage indisponible */ }
  document.documentElement.lang = l;
}

const pack = () => charges[lang] || charges.fr;

export function t(key, vars) {
  let s = pack().ui?.[key] ?? FR[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? '');
  return s;
}

// contenus : traduction si elle existe, sinon le texte français d'origine
export const tLieu = (l, champ) => pack().lieux?.[l.id]?.[champ] ?? l[champ];
export const tPhoto = (id, fr) => pack().photos?.[id] ?? fr;

export function tAge(s) {
  if (!s || lang === 'fr') return s;
  let m;
  if ((m = s.match(/^dès (\d+) ans$/))) return t('age.des', { n: m[1] });
  if ((m = s.match(/^(\d+) à (\d+) ans$/))) return t('age.entre', { a: m[1], b: m[2] });
  if (s === 'tout âge') return t('age.tous');
  if (s.startsWith('dès 12 ans (')) return t('age.vin');
  return s;
}
export const tDuree = (s) => (s && lang !== 'fr' ? s.replace(/ à /g, ` ${t('duree.a')} `).replace(/(\d+) h (\d+)/g, '$1 h $2') : s);

// heures : « 18 h » / « 10 h 30 » en français, 18:00 ailleurs
export function heure(m) {
  m %= 1440;
  const h = Math.floor(m / 60), mn = m % 60;
  if (lang === 'fr') return mn ? `${h} h ${String(mn).padStart(2, '0')}` : `${h} h`;
  return `${h}:${String(mn).padStart(2, '0')}`;
}
export function duree(min) {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
export function km(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return (m / 1000).toLocaleString(getLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' km';
}
export const jours = (style) => [...Array(7)].map((_, i) =>
  new Intl.DateTimeFormat(getLocale(), { weekday: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))));

// éléments fixes de la page : data-i18n (texte), data-i18n-aria (étiquette accessible)
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  document.title = t('doc.titre');
}
