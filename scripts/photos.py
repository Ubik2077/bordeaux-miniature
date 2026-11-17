#!/usr/bin/env python3
"""Télécharge une photo par lieu depuis Wikimedia Commons, la redimensionne et écrit data/photos.json
avec légende, auteur, licence et lien vers la page source (crédits affichés dans la fiche).
Repris de « Port de la Lune » (scripts/photos.py).

Usage : python3 scripts/photos.py          (ne retélécharge pas les images déjà présentes)
Dépend de Pillow (pip install pillow).
"""
import io, json, os, re, time, urllib.parse, urllib.request
from html import unescape
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'img', 'lieux')
UA = {'User-Agent': 'canele-quest-proto/0.1 (prototype de carte touristique)'}
API = 'https://commons.wikimedia.org/w/api.php'

# lieu → (fichier Commons, légende)
CHOIX = {
    'musee-aquitaine': ('Musée Aquitaine.JPG', "L'entrée du musée, cours Pasteur"),
    'musba': ('Beaux arts bordeaux.jpg', 'Le musée des Beaux-Arts dans le jardin de la mairie'),
    'capc': ('Entrepôt Lainé.JPG', "L'entrepôt Lainé, ancien entrepôt de denrées coloniales"),
    'madd': ('Musée des arts décoratifs de Bordeaux.jpg', "L'hôtel de Lalande, rue Bouffard"),
    'douanes': ('Le Musée des Douanes de Bordeaux - vue 2.jpg', 'Le musée, place de la Bourse'),
    'mer-marine': ('FrII.jpg', 'Une maquette de navire dans les salles du musée'),
    'bassins-lumieres': ('Bassins de Lumières Boreaux 2024 (1).jpg', 'Une exposition projetée dans la base sous-marine'),
    'cap-sciences': ('Cap Sciences à Bordeaux par Pierre Baudier.jpg', 'Cap Sciences au bord de la Garonne'),
    'cite-du-vin': ('Bordeaux - 33100 - 2026.07.04 - Le Bato - Inter-Rives Bordeaux - « La Fauvette » devant la Cité du Vin © Anthony Levrot.jpg', 'La Cité du Vin et le Bato sur la Garonne'),
    'museum': ("Muséum d'histoire naturelle de Bordeaux.jpg", 'Le Muséum, au bord du Jardin public'),
    'jardin-public': ('Bordeaux Jardin Public R02.jpg', 'La pièce d’eau et son pont'),
    'jardin-botanique': ('Jardin botanique de Bordeaux 5.jpg', 'Le jardin botanique de la Bastide'),
    'parc-angeliques': ('Bordeaux - Parc aux Angéliques - Le Puits - Bibliothèque sur la technique.jpg', 'Un kiosque du parc, sur la rive droite'),
    'miroir-eau': ('XDSC 7643-Effet-brouillard-Miroir-d-eau-quai-de-la-Gironde.jpg', 'L’effet brouillard devant la place de la Bourse'),
    'bassins-a-flot': ('Bordeaux Bassin à Flot 06.jpg', 'Les bassins à flot et leurs nouveaux quartiers'),
    'bato': ('Bordeaux - 33000 - 2026.07.03 - Le Bato - Inter-Rives Bordeaux - « La Sittelle » © Anthony Levrot.jpg', 'Le Bato devant le pont de pierre'),
    'sainte-catherine': ('Bordeaux rue Sainte-Catherine 2009.JPG', 'La rue Sainte-Catherine, piétonne'),
    'meriadeck': ('CC mériadeck.jpg', "L'entrée du centre commercial"),
    'grands-hommes': ('Marché des Grands Hommes, Bordeaux.jpg', "L'intérieur de la galerie"),
    'triangle-or': ('Bordeaux Allees Tourny.JPG', 'Les allées de Tourny et leur manège'),
    'notre-dame': ('Le Passage Notre Dame, Bordeaux, July 2014 (01).JPG', 'Le Passage Notre-Dame, antiquités et brocante'),
    'capucins': ('Marché des Capucins 2024 (4).jpg', 'Les étals du marché'),
    'darwin': ('Bordeaux-Quartier Darwin (7).jpg', "L'entrée de Darwin, dans l'ancienne caserne Niel"),
}


def api(**p):
    p['format'] = 'json'
    for i in range(8):
        time.sleep(0.8)
        try:
            req = urllib.request.Request(API + '?' + urllib.parse.urlencode(p), headers=UA)
            return json.load(urllib.request.urlopen(req, timeout=60))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(10 * (i + 1))
    raise SystemExit('Commons refuse les requêtes (429)')


def fetch(url):
    for i in range(3):
        time.sleep(1.5)
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(10 * (i + 1))
    raise RuntimeError('trop de refus (429)')


def wikidata_image(q):  # inutilisé ici, gardé pour les choix « @Q… »
    req = urllib.request.Request(f'https://www.wikidata.org/wiki/Special:EntityData/{q}.json', headers=UA)
    e = json.load(urllib.request.urlopen(req, timeout=60))['entities'][q]
    return e['claims']['P18'][0]['mainsnak']['datavalue']['value']


def texte(html):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', '', html or ''))).strip()


def nettoyer_auteur(a):
    """Remet en forme les champs « Artist » de Commons, souvent bruts."""
    if not a or re.search(r'Unknown author|Anonymous|^Auteur inconnu', a):
        return 'Auteur inconnu'
    a = a.lstrip('= ').strip()
    m = re.search(r'wiki/(?:Gebruiker|User|Utilisateur):([^/ ]+)', a)
    if m:
        return urllib.parse.unquote(m.group(1)).replace('_', ' ')
    a = re.sub(r'^Image details\s+.*?\s(\S+)\s+CC-BY.*$', r'\1', a)  # « Image details Casio … Pseudo CC-BY-3.0 »
    a = re.sub(r' from France$', ' (Flickr)', a)
    return a


def main():
    os.makedirs(IMG, exist_ok=True)
    out = {}
    for lid, (fichier, legende) in CHOIX.items():
        r = api(action='query', titles='File:' + fichier, prop='imageinfo',
                iiprop='url|extmetadata|size', iiurlwidth=1280,
                iiextmetadatafilter='Artist|Credit|LicenseShortName|ImageDescription')
        page = next(iter(r['query']['pages'].values()))
        if 'imageinfo' not in page:
            print(f'  ⚠ introuvable : {fichier}')
            continue
        ii = page['imageinfo'][0]
        md = ii['extmetadata']
        grand, petit = os.path.join(IMG, lid + '.webp'), os.path.join(IMG, lid + '-mini.webp')
        if not os.path.exists(grand):
            im = None
            for url in (ii.get('thumburl'), ii['url']):
                try:
                    im = Image.open(io.BytesIO(fetch(url)))
                    break
                except Exception as e:
                    print(f'  ⚠ {lid} : {e}')
            if im is None:
                continue
            im = im.convert('RGB')
            im.thumbnail((1000, 1000))
            im.save(grand, 'WEBP', quality=76, method=6)
            im.thumbnail((360, 360))
            im.save(petit, 'WEBP', quality=72, method=6)
        auteur = nettoyer_auteur(texte(md.get('Artist', {}).get('value')))
        out[lid] = {
            'src': f'img/lieux/{lid}.webp', 'mini': f'img/lieux/{lid}-mini.webp', 'legende': legende,
            'auteur': auteur[:120], 'licence': md.get('LicenseShortName', {}).get('value', ''),
            'source': ii['descriptionurl'],
        }
        print(f'✓ {lid:18} {auteur[:36]:36} · {out[lid]["licence"]} · {texte(md.get("ImageDescription", {}).get("value"))[:60]}')
    with open(os.path.join(ROOT, 'data', 'photos.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
