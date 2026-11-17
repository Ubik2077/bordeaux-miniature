// Affiche A5 : QR code vers la carte et nom de l'hôtel sous l'illustration.

const URL_SITE = 'https://ubik2077.github.io/bordeaux-miniature/';
const $ = (id) => document.getElementById(id);

const qr = qrcode(0, 'M');
qr.addData(URL_SITE); qr.make();
$('qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
$('url').textContent = URL_SITE.replace('https://', '').replace(/\/$/, '');

const { hotel } = await fetch('data/lieux.json').then((r) => r.json());
$('hotel').textContent = hotel.nom;
document.body.dataset.pret = '1';
