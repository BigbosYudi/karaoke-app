(function () {
  'use strict';

  function storageAvailable() {
    try { localStorage.setItem('karaoke.probe', '1'); localStorage.removeItem('karaoke.probe'); return true; } catch (e) { return false; }
  }

  function appendBookmarkHint() {
    var card = document.querySelector('#view-help .card-help');
    if (!card || card.querySelector('.bookmark-hint')) { return; }
    var p = document.createElement('p');
    p.className = 'muted bookmark-hint';
    p.innerHTML = 'Alamat halaman ini: <code>' + Utils.escapeHtml((window.location.origin + window.location.pathname)) + '</code>';
    card.appendChild(p);
  }

  function reportSupport() {
    var cards = document.querySelectorAll('#view-help .card-help');
    var target = document.getElementById('card-limits') || cards[cards.length - 1];
    if (!target || target.querySelector('.support-note')) { return; }

    var notes = [];
    notes.push('Pemutar tersemat: ' + (window.location.protocol === 'file:' ? 'perlu http/https' : 'siap'));
    notes.push('Mikrofon: ' + ((navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext) ? 'didukung' : 'tidak didukung'));
    notes.push('Layar penuh: ' + (document.fullscreenEnabled || document.webkitFullscreenEnabled ? 'didukung' : 'tidak didukung'));
    notes.push('Penyimpanan antrean: ' + (storageAvailable() ? 'aktif' : 'tidak aktif'));

    var p = document.createElement('p');
    p.className = 'muted support-note';
    p.textContent = notes.join(' \u00b7 ');
    target.appendChild(p);
  }

  function maskKey(key) {
    if (!key) { return ''; }
    if (key.length <= 12) { return key.slice(0, 3) + '...'; }
    return key.slice(0, 6) + '\u2026' + key.slice(-4);
  }

  function keySource() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('key')) { return 'dari alamat URL'; }
    } catch (e) { /* diabaikan */ }
    try {
      if (localStorage.getItem('karaoke.apiKey')) { return 'tersimpan di browser ini'; }
    } catch (e) { /* diabaikan */ }
    if (window.APP_CONFIG && window.APP_CONFIG.youtubeApiKey) { return 'dari berkas konfigurasi (.env)'; }
    return '';
  }

  function updateKeyNote() {
    var el = document.querySelector('.key-note');
    if (!el) { return; }
    var key = window.AppConfig ? AppConfig.youtubeApiKey : '';
    var src = keySource();
    if (key) {
      el.textContent = 'API key terbaca: ' + maskKey(key) + ' (' + src + ')';
      el.style.color = 'var(--ok)';
    } else {
      el.textContent = 'API key belum terbaca. Isi lewat tombol Setelan di aplikasi, atau simpan di berkas .env lalu jalankan scripts\\apply-env.ps1, kemudian muat ulang halaman ini.';
      el.style.color = 'var(--accent-2)';
    }
  }

  function appendKeyNote() {
    var cards = document.querySelectorAll('#view-help .card-help');
    var card = document.getElementById('card-key') || cards[2];
    if (!card || card.querySelector('.key-note')) { return; }
    var p = document.createElement('p');
    p.className = 'key-note';
    card.appendChild(p);
    updateKeyNote();
    document.addEventListener('appkeychange', updateKeyNote);
  }

  function browserLabel() {
    var ua = navigator.userAgent || '';
    var m = /Chrome\/(\d+)/.exec(ua) || /Chromium\/(\d+)/.exec(ua);
    if (m) { return 'Chromium ' + m[1]; }
    m = /Firefox\/(\d+)/.exec(ua);
    if (m) { return 'Firefox ' + m[1]; }
    m = /Version\/(\d+).*Safari/.exec(ua);
    if (m) { return 'Safari ' + m[1]; }
    return 'tidak terdeteksi';
  }

  function androidLabel() {
    var m = /Android\s+([\d.]+)/.exec(navigator.userAgent || '');
    return m ? 'Android ' + m[1] : 'bukan Android / tidak terbaca';
  }

  function diagnose() {
    var yes = function (v) { return v ? 'ya' : 'tidak'; };
    var rows = [];
    rows.push(['Browser', browserLabel()]);
    rows.push(['Sistem', androidLabel()]);
    rows.push(['Layar', window.screen.width + 'x' + window.screen.height + ' @' + (window.devicePixelRatio || 1) + 'x']);
    rows.push(['Alamat', window.location.protocol + '//' + window.location.host + window.location.pathname]);
    rows.push(['Konteks aman (https/localhost)', yes(!!window.isSecureContext)]);
    rows.push(['fetch + Promise', yes(typeof fetch === 'function' && typeof Promise === 'function')]);
    rows.push(['URLSearchParams', yes(typeof URLSearchParams === 'function')]);
    rows.push(['Service worker', yes('serviceWorker' in navigator)]);
    rows.push(['Layar penuh', yes(!!(document.fullscreenEnabled || document.webkitFullscreenEnabled))]);
    rows.push(['Mikrofon (getUserMedia)', yes(!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext))]);
    rows.push(['Penyimpanan antrean', yes(storageAvailable())]);
    rows.push(['Sumber pencarian', window.AppConfig && AppConfig.youtubeApiKey ? 'YouTube Data API' : 'server cadangan (tanpa key)']);
    rows.push(['Koneksi', navigator.onLine === false ? 'offline' : 'online']);
    return rows;
  }

  function appendDiagnostics() {
    var list = document.getElementById('diag-list');
    if (!list) { return; }
    list.innerHTML = diagnose().map(function (row) {
      return '<li><b>' + Utils.escapeHtml(row[0]) + ':</b> ' + Utils.escapeHtml(String(row[1])) + '</li>';
    }).join('');
  }

  window.Guide = {
    init: function () {
      var btn = document.getElementById('btn-open-settings');
      if (btn) {
        btn.addEventListener('click', function () {
          if (window.App && App.openSettings) { App.openSettings(); }
        });
      }
      appendBookmarkHint();
      appendKeyNote();
      reportSupport();
      appendDiagnostics();
      document.addEventListener('appkeychange', appendDiagnostics);
    }
  };
})();
