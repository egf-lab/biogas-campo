/* Service worker da aplicação de campo.

   Três caches, cada uma com a sua regra:

   - a aplicação (index.html, bibliotecas, ícones): serve-se sempre da cache,
     que é o que a deixa abrir sem rede, e vai-se à rede por trás buscar a
     versão nova para a próxima vez que se abrir;
   - os mosaicos do mapa: cache primeiro, rede se faltar. Só os que se viram
     -- não há descarga em massa -- e com um tecto, para não encher o telemóvel;
   - as letras do Google Fonts: como a aplicação. Sem elas a página usa as do
     sistema, por isso faltarem não é grave.

   Mudar VERSION obriga a reinstalar a aplicação inteira. Para mudanças só no
   index.html não é preciso: a revalidação por trás apanha-as na abertura a
   seguir. */

const VERSION = 'v1';
const SHELL = 'campo-app-' + VERSION;
const TILES = 'campo-mosaicos-v1';
const FONTS = 'campo-letras-v1';
const MAX_TILES = 2500;

const SHELL_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'vendor/leaflet.css',
  'vendor/leaflet.js',
  'vendor/proj4.js',
  'vendor/xlsx.full.min.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL, TILES, FONTS]);
    for (const key of await caches.keys()) {
      if (key.startsWith('campo-') && !keep.has(key)) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(fromShell(event, req));
  } else if (url.hostname === 'server.arcgisonline.com') {
    event.respondWith(tile(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, req, FONTS));
  }
});

async function fromShell(event, req) {
  const cache = await caches.open(SHELL);
  // Uma navegação (abrir a aplicação, recarregar) é sempre a mesma página,
  // venha com que query string vier.
  const key = req.mode === 'navigate' ? './' : req;
  const cached = await cache.match(key, {ignoreSearch: req.mode === 'navigate'});
  const refresh = fetch(req).then(async res => {
    if (res.ok) await cache.put(key, await unredirected(res.clone()));
    return res;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return (await refresh) || new Response('Sem rede e sem cópia guardada.', {status: 503});
}

// Uma resposta que veio de um redireccionamento (o GitHub Pages manda
// /pocos-palmela para /pocos-palmela/) não pode servir uma navegação: o
// Safari e o Chrome recusam-na. Guarda-se uma cópia sem essa marca.
async function unredirected(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), {status: res.status, statusText: res.statusText, headers: res.headers});
}

async function staleWhileRevalidate(event, req, name) {
  const cache = await caches.open(name);
  const cached = await cache.match(req);
  const refresh = fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  return (await refresh) || Response.error();
}

let tilePuts = 0;

async function tile(req) {
  const cache = await caches.open(TILES);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    // Só respostas CORS completas. Uma opaca contaria vários MB na quota
    // do Chrome por cada mosaico; o servidor da Esri responde com CORS e o
    // mapa pede os mosaicos com crossOrigin, por isso não há opacas aqui.
    if (res.ok && res.type === 'cors') {
      await cache.put(req, res.clone());
      if (++tilePuts % 50 === 0) trim(cache);
    }
    return res;
  } catch (e) {
    return Response.error();
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  // keys() vem pela ordem de entrada: os primeiros são os mais antigos.
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}
