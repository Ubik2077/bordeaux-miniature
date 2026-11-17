// Fiche d'un lieu, façon boîte de dialogue de jeu : photo créditée, badges, description, infos pratiques.

import { statut, semaine } from './horaires.js';
import { t, tLieu, tPhoto, tAge, tDuree, heure, duree, km, jours, getLocale } from './i18n.js';

const $ = (id) => document.getElementById(id);
export const echap = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const plage = ([a, b]) => `${heure(a)}–${b % 1440 === 0 ? t('h.minuit') : heure(b)}`;

function joursTexte(js) {
  // regroupe les jours consécutifs : lun., mer.–dim.
  const noms = jours('short'), out = [];
  for (let i = 0; i < js.length; i++) {
    let j = i;
    while (j + 1 < js.length && js[j + 1] === js[j] + 1) j++;
    out.push(j - i >= 2 ? `${noms[js[i]]}–${noms[js[j]]}` : js.slice(i, j + 1).map((k) => noms[k]).join(', '));
    i = j;
  }
  return out.join(', ');
}

export function badgeStatut(h, d = new Date()) {
  const s = statut(h, d);
  switch (s.etat) {
    case 'ouvert': return { cls: 'ouvert', court: 'ouvert', txt: t('etat.ouvert', { h: heure(s.jusqua) }), doute: s.doute };
    case 'bientot': return { cls: 'bientot', court: 'bientot', txt: t('etat.bientot', { h: heure(s.jusqua) }), doute: s.doute };
    case 'pause': return { cls: 'pause', court: 'pause', txt: t('etat.pause') };
    case 'libre': return { cls: 'ouvert', court: 'libre', txt: t('etat.libre') };
    case 'indicatif': return null;
    default: {
      if (s.a == null) return { cls: 'ferme', court: 'ferme', txt: t('etat.ferme') };
      const h = heure(s.a);
      const txt = s.dans === 0 ? t('etat.fermeAuj', { h }) : s.dans === 1 ? t('etat.fermeDemain', { h }) : t('etat.fermeJour', { j: jours('long')[s.jour], h });
      return { cls: 'ferme', court: 'ferme', txt, doute: s.doute };
    }
  }
}

function horairesHtml(h) {
  const s = semaine(h);
  if (!s) return t('h.inconnus');
  if (s.periode.oh.trim() === '24/7') return t('h.libre');
  if (s.periode.raison === 'pause-hiver') return t('h.hiver');
  const lignes = s.groupes
    .sort((a, b) => a.jours[0] - b.jours[0])
    .map((g) => `<span class="jours">${joursTexte(g.jours)}</span> ${g.plages.length ? g.plages.map(plage).join(', ') : t('h.fermeJour')}`);
  const notes = [];
  if (h.indicatif) notes.push(t('h.indicatif'));
  if (h.feries === 'off') notes.push(t(h.sauf?.length ? 'h.feriesSauf' : 'h.feries'));
  if (h.feries === 'certains') notes.push(t('h.certains'));
  if (s.periode.vacances) notes.push(t('h.vacances'));
  else if (h.periodes.some((p) => p.vacances)) notes.push(t('h.autresVacances'));
  else if (s.periode.du) notes.push(t('h.saison'));
  if (h.variable) notes.push(t('h.variable'));
  return lignes.join('<br>') + (notes.length ? `<small>${notes.join(' · ')}</small>` : '');
}

export const puce = (leg) => `<span class="ligne-tram" style="background:${leg.couleur}">${leg.ligne}</span>`;

function trajetsHtml(tr) {
  if (!tr) return '';
  const tm = tr.tram;
  const tram = tm ? `<button class="trajet" data-mode="tram">
      <span class="mode">${t('trajet.tram')} ${tm.legs.map(puce).join(' ')}</span><b>${duree(tm.min)}</b>
      <small>${t('trajet.marche', { n: tm.avant.min })}, ${tm.legs.map((g) => `${g.de} → ${g.a}`).join(`, ${t('trajet.puis')} `)}, ${t('trajet.marche', { n: tm.apres.min })}</small>
    </button>` : '';
  return `<div class="trajets"><h3>${t('trajet.titre')}</h3>
    <button class="trajet" data-mode="pied"><span class="mode">${t('trajet.pied')}</span><b>${duree(tr.pied.min)}</b><small>${km(tr.pied.m)}</small></button>
    ${tram}<p class="aide">${t('trajet.aide')}</p></div>`;
}

let photoAffichee = null;

export function afficherFiche(l, { photo, verifie, trajet, onTrajet, garderDefilement = false }) {
  const b = badgeStatut(l.horaires);
  const pastilles = [
    ...l.categories.map((c) => `<span class="pastille cat-${c}">${t('cat.' + c)}</span>`),
    b ? `<span class="pastille etat-${b.cls}">${echap(b.txt)}${b.doute ? ' ?' : ''}</span>` : '',
    l.age ? `<span class="pastille age">${echap(tAge(l.age))}</span>` : '',
  ].join('');
  const date = new Date(verifie + 'T12:00:00Z').toLocaleDateString(getLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const a = trajet?.arret;
  const infos = [
    [t('info.duree'), tDuree(l.duree)],
    [t('info.horaires'), horairesHtml(l.horaires), true],
    [t('info.tram'), a && t('info.arret', { arret: a.nom, lignes: a.lignes.join(', '), min: a.min })],
    [t('info.pmr'), t(l.pmr === true ? 'pmr.oui' : l.pmr === false ? 'pmr.non' : 'pmr.inconnu')],
    [t('info.adresse'), l.adresse],
  ].filter(([, v]) => v);

  // la photo n'est rechargée que si le lieu change (pas au changement de langue)
  if (photoAffichee !== l.id) {
    photoAffichee = l.id;
    $('fiche-photo').innerHTML = photo ? `<img src="${photo.mini}" data-grand="${photo.src}" alt=""><figcaption></figcaption>` : '';
    const img = $('fiche-photo').querySelector('img');
    if (img) { const g = new Image(); g.onload = () => { img.src = g.src; }; g.src = img.dataset.grand; }
  }
  if (photo) {
    const legende = tPhoto(l.id, photo.legende);
    $('fiche-photo').querySelector('img').alt = legende;
    $('fiche-photo').querySelector('figcaption').innerHTML =
      `${echap(legende)} · ${echap(photo.auteur)} · ${echap(photo.licence)} · <a href="${photo.source}" target="_blank" rel="noopener">Wikimedia Commons ↗</a>`;
  }

  const defilement = $('fiche').scrollTop;
  const alerte = tLieu(l, 'alerte');
  $('fiche-corps').innerHTML = `
    <h2 id="fiche-titre">${echap(tLieu(l, 'nom'))}</h2>
    <div class="pastilles">${pastilles}</div>
    <p class="description">${echap(tLieu(l, 'description'))}</p>
    ${alerte ? `<p class="alerte">${echap(alerte)}</p>` : ''}
    ${trajetsHtml(trajet)}
    <dl class="infos">${infos.map(([k, v, html]) => `<dt>${k}</dt><dd>${html ? v : echap(v)}</dd>`).join('')}</dl>
    <div class="boutons">
      ${l.lien ? `<a class="btn" href="${l.lien}" target="_blank" rel="noopener">${t(l.categories.includes('musee') ? 'btn.billetterie' : 'btn.site')}</a>` : ''}
      <a class="btn sec" href="https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lon}&travelmode=transit" target="_blank" rel="noopener">Google Maps</a>
    </div>
    <p class="source">${t('source.verifie', { date })}${l.source ? ` · <a href="${l.source}" target="_blank" rel="noopener">${t('source.lien')} ↗</a>` : ''}</p>
    <span class="suite" aria-hidden="true">▼</span>`;
  for (const btn of $('fiche-corps').querySelectorAll('[data-mode]')) btn.addEventListener('click', () => onTrajet?.(btn.dataset.mode));
  $('fiche').hidden = false;
  if (garderDefilement) $('fiche').scrollTop = defilement;
  else { $('fiche').scrollTop = 0; $('fiche-fermer').focus({ preventScroll: true }); }
}

export function fermerFiche() { $('fiche').hidden = true; }
