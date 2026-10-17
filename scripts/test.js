// Pengujian regresi tanpa jaringan, kredensial, atau dependensi tambahan.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ROOT = path.resolve(__dirname, '..');
function run(file, context) {
  context.window = context.window || context;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  return context;
}
function storage(values = {}) {
  return { getItem: k => values[k] ?? null, setItem: (k, v) => { values[k] = v; }, removeItem: k => { delete values[k]; } };
}
function queue(localStorage = storage()) {
  const c = run('js/queue.js', { localStorage, document: { getElementById() { return null; } } });
  c.Queue.init(); return c.Queue;
}
test('Antrean tetap bekerja saat localStorage diblokir', () => {
  const q = queue({ getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } });
  q.add({ id: 'aaaaaaaaaaa', title: 'A' });
  assert.equal(q.length(), 1);
});
test('Antrean rusak dan indeks di luar rentang dipulihkan', () => {
  for (const raw of ['{', '{}', '[null,{},3]']) {
    assert.equal(queue(storage({ 'karaoke.queue': raw, 'karaoke.queueIndex': '99' })).length(), 0);
  }
  const q = queue(storage({ 'karaoke.queue': '[{"id":"aaaaaaaaaaa","title":"A"}]', 'karaoke.queueIndex': '99' }));
  assert.equal(q.currentIndex(), -1);
});
test('Menghapus lagu aktif tidak melewati penerusnya', () => {
  for (const index of [0, 1, 2]) {
    const q = queue();
    ['A', 'B', 'C'].forEach((title, i) => q.add({ id: String(i).repeat(11), title }));
    q.setCurrent(index); q.remove(index);
    assert.equal(q.nextIndex(), index < 2 ? index : -1);
  }
});
test('Memindah lagu menjaga identitas lagu aktif', () => {
  const q = queue(); q.add({ id: 'aaaaaaaaaaa', title: 'A' }); q.add({ id: 'bbbbbbbbbbb', title: 'B' });
  q.setCurrent(0); q.move(0, 1); assert.equal(q.current().title, 'A'); assert.equal(q.currentIndex(), 1);
});
test('Pemutar dapat mencoba ulang setelah kegagalan atau timeout API', () => {
  for (const timeout of [false, true]) {
    const tags = [], timers = [];
    const c = run('js/player.js', {
      document: { getElementById() { return { classList: { add() {}, remove() {} } }; }, createElement() { return {}; }, head: { appendChild(t) { tags.push(t); } } },
      setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}
    });
    c.Player.load({ id: 'aaaaaaaaaaa' });
    if (timeout) timers[0](); else tags[0].onerror();
    c.Player.load({ id: 'bbbbbbbbbbb' }); assert.equal(tags.length, 2);
  }
});
test('Server menolak file internal, traversal, URL rusak, dan metode tidak sesuai', async () => {
  let handler;
  run('scripts/serve.js', {
    __dirname, process: { argv: [] }, console: { log() {} }, Buffer,
    require(name) {
      if (name === 'http') return { createServer(fn) { handler = fn; return { listen() {} }; } };
      // Tidak membaca isi file apa pun, terutama kredensial.
      if (name === 'fs') return { realpathSync: p => p, readFile(p, cb) { cb(null, Buffer.from('asset')); } };
      return require(name);
    }
  });
  function request(url, method = 'GET') {
    let status, body;
    handler({ url, method }, { writeHead(s) { status = s; }, end(b) { body = b; } });
    return { status, body };
  }
  for (const url of ['/.env', '/.git/config', '/scripts/deploy.ps1', '/js/../../outside.js', '/js/%2e%2e/.env', '/js/a.js:secret', '/js/%00.js', '/js/..\\..\\outside.js']) {
    assert.equal(request(url).status, 403, url);
  }
  assert.equal(request('/%').status, 400);
  assert.equal(request('/', 'POST').status, 405);
  for (const url of ['/', '/index.html', '/js/app.js', '/css/style.css', '/icons/icon-192.png', '/manifest.webmanifest']) assert.equal(request(url).status, 200, url);
  assert.equal(request('/index.html', 'HEAD').body, undefined);
});
test('Hapus Key bertahan setelah muat ulang walau konfigurasi lokal berisi key', () => {
  const localStorage = storage();
  const env = () => ({ localStorage, APP_CONFIG: { youtubeApiKey: 'test-key' }, location: { search: '' }, document: { dispatchEvent() {} }, CustomEvent: function () {} });
  const c = run('js/config.js', env()); assert.equal(c.AppConfig.hasKey(), true);
  c.AppConfig.clearKey(); assert.equal(run('js/config.js', env()).AppConfig.hasKey(), false);
});
test('Fallback pencarian menampilkan sumber sebenarnya', async () => {
  const status = { style: {} }, results = {};
  const c = run('js/search.js', {
    AppConfig: { youtubeApiKey: 'test', hasKey() { return true; }, invidiousInstances: ['https://example.invalid'] },
    Utils: { cleanText: String, thumbFor: () => '', escapeHtml: String, fmtTime: String },
    document: { getElementById(id) { return id === 'search-status' ? status : results; } }, setTimeout, clearTimeout,
    fetch: async url => url.includes('googleapis') ? { ok: false, json: async () => ({ error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }) } : { ok: true, json: async () => [{ videoId: 'aaaaaaaaaaa', title: 'A' }] }
  });
  await c.Search.run('lagu'); assert.match(status.textContent, /server cadangan/);
});
test('Mode Karaoke menempatkan kata di depan tanpa duplikasi dan bisa dimatikan', async () => {
  const urls = [], mode = { setAttribute() {}, addEventListener(k, fn) { this.click = fn; } };
  const elements = { 'btn-karaoke-mode': mode, 'search-mode-note': {}, 'search-status': { style: {} }, 'search-results': { addEventListener() {} } };
  const c = run('js/search.js', {
    AppConfig: { hasKey() { return false; }, invidiousInstances: ['https://example.invalid'] },
    Utils: { cleanText: s => String(s).replace(/\s+/g, ' ').trim() },
    document: { getElementById(id) { return elements[id] || null; } }, setTimeout, clearTimeout,
    fetch: async url => { urls.push(new URL(url).searchParams.get('q')); return { ok: true, json: async () => [] }; }
  });
  c.Search.init();
  for (const input of ['Dewa Kangen', 'Dewa Kangen karaoke', 'KARAOKE Dewa Kangen', 'karaoke Dewa karaoke Kangen']) {
    await c.Search.run(input); assert.equal(urls.at(-1), 'karaoke Dewa Kangen');
  }
  const count = urls.length;
  await c.Search.run('   '); assert.equal(urls.length, count);
  await c.Search.run('karaoke'); assert.equal(urls.at(-1), 'karaoke');
  mode.click(); await c.Search.run('Dewa Kangen'); assert.equal(urls.at(-1), 'Dewa Kangen');
  mode.click(); await c.Search.run('Dewa Kangen'); assert.equal(urls.at(-1), 'karaoke Dewa Kangen');
});
test('Service worker terisolasi dan tidak menangani file rahasia', async () => {
  const handlers = {}, deleted = [];
  const c = run('sw.js', {
    URL, self: { registration: { scope: 'https://example.test/karaoke/' }, location: { origin: 'https://example.test' }, addEventListener(k, fn) { handlers[k] = fn; }, clients: { claim() {} } },
    caches: { keys: async () => ['other-app', 'karaoke-tv-other-v1', 'karaoke-tv-https%3A%2F%2Fexample.test%2Fkaraoke%2F-v1'], delete: async k => deleted.push(k) }
  });
  let done; handlers.activate({ waitUntil(p) { done = p; } }); await done;
  assert.deepEqual(deleted, [c.CACHE_PREFIX + 'v1']);
  for (const suffix of ['.env', 'js/config.local.js', 'index.html?key=secret', 'unknown.js']) {
    handlers.fetch({ request: { method: 'GET', url: 'https://example.test/karaoke/' + suffix }, respondWith() { assert.fail('Must not intercept ' + suffix); } });
  }
  for (const asset of c.ASSETS) assert.ok(fs.existsSync(path.join(ROOT, asset)), asset);
});
test('Permintaan mikrofon terlambat dihentikan setelah dibatalkan', async () => {
  let resolve, stopped = 0;
  const c = run('js/mic.js', {
    isSecureContext: true, AudioContext: function () {}, document: { hidden: false, getElementById() { return null; } },
    navigator: { mediaDevices: { getUserMedia() { return new Promise(r => { resolve = r; }); } } }
  });
  const pending = c.Mic.toggle(); c.Mic.stop(); resolve({ getTracks() { return [{ stop() { stopped++; } }]; } });
  assert.equal(await pending, false); assert.equal(stopped, 1); assert.equal(c.Mic.isRunning(), false);
});

function appHarness() {
  const elements = {}, listeners = {};
  const document = { body: { dataset: {} }, hidden: false, activeElement: null,
    getElementById(id) { return elements[id] || null; }, querySelectorAll() { return []; },
    addEventListener(k, fn) { listeners[k] = fn; }, contains(el) { return !!el; }
  };
  function element(id) {
    return elements[id] = { id, hidden: id === 'settings-modal', handlers: {}, attributes: {}, textContent: '', value: '',
      classList: { add() {}, remove() {}, toggle() {} }, querySelector() { return null; }, contains() { return false; },
      querySelectorAll() { return []; }, setAttribute(k, v) { this.attributes[k] = v; },
      removeAttribute(k) { delete this.attributes[k]; }, addEventListener(k, fn) { this.handlers[k] = fn; },
      focus() { document.activeElement = this; }
    };
  }
  ['app','settings-modal','api-key-input','btn-settings','btn-next','btn-prev','btn-play-queue','now-title','now-sub','btn-open-youtube','toast','key-status','btn-toggle-play'].forEach(element);
  const q = queue();
  let searchPlay, stateHandler, loaded = [], micStopped = 0;
  const c = run('js/app.js', { document, Queue: q,
    location: { hash: '', protocol: 'https:' }, history: { replaceState() {} }, addEventListener() {}, navigator: {},
    setTimeout() { return 1; }, clearTimeout() {},
    AppConfig: { youtubeApiKey: '' }, Utils: { fmtTime: String },
    Search: { init() {}, onRequestPlay(fn) { searchPlay = fn; } },
    Player: { init() {}, onState(fn) { stateHandler = fn; }, load(v) { loaded.push(v.id); }, isPlaying() { return false; }, updateToggleLabel() {} },
    Mic: { init() {}, stop() { micStopped++; } }, Guide: { init() {} }
  });
  c.App.init();
  return { c, q, loaded, elements, document, listeners, search(v) { searchPlay(v); }, state(s) { stateHandler(s); }, micStopped() { return micStopped; } };
}
test('Lagu dari pencarian tidak meneruskan antrean lama', () => {
  const h = appHarness();
  h.q.add({ id: 'aaaaaaaaaaa', title: 'A' }); h.q.add({ id: 'bbbbbbbbbbb', title: 'B' }); h.q.setCurrent(0);
  h.search({ id: 'ccccccccccc', title: 'C' }); h.state('ended');
  assert.deepEqual(h.loaded, ['ccccccccccc']);
});
test('Antrean melanjutkan penerus setelah lagu aktif dihapus', () => {
  const h = appHarness();
  h.q.add({ id: 'aaaaaaaaaaa', title: 'A' }); h.q.add({ id: 'bbbbbbbbbbb', title: 'B' });
  h.elements['btn-play-queue'].handlers.click(); h.q.remove(0); h.state('ended');
  assert.deepEqual(h.loaded, ['aaaaaaaaaaa', 'bbbbbbbbbbb']);
});
test('Setelan mengembalikan fokus dan halaman tersembunyi menghentikan mikrofon', () => {
  const h = appHarness(); const opener = h.elements['btn-settings']; opener.focus();
  h.c.App.openSettings(); assert.equal(h.elements['settings-modal'].hidden, false);
  h.c.App.closeSettings(); assert.equal(h.document.activeElement, opener);
  assert.equal(h.elements['app'].attributes.inert, undefined);
  h.document.hidden = true; h.listeners.visibilitychange(); assert.equal(h.micStopped(), 1);
});
