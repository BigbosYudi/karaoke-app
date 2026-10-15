(function () {
  'use strict';

  function appendBookmarkHint() {
    var card = document.querySelector('#view-help .card-help');
    if (!card || card.querySelector('.bookmark-hint')) { return; }
    var p = document.createElement('p');
    p.className = 'muted bookmark-hint';
    p.innerHTML = 'Alamat halaman ini: <code>' + Utils.escapeHtml(window.location.href) + '</code>';
    card.appendChild(p);
  }

  function reportSupport() {
    var card = document.querySelectorAll('#view-help .card-help');
    var target = card[card.length - 1];
    if (!target || target.querySelector('.support-note')) { return; }

    var notes = [];
    notes.push('Pemutar tersemat: ' + (window.location.protocol === 'file:' ? 'perlu http/https' : 'siap'));
    notes.push('Mikrofon: ' + ((navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext) ? 'didukung' : 'tidak didukung'));
    notes.push('Layar penuh: ' + (document.fullscreenEnabled || document.webkitFullscreenEnabled ? 'didukung' : 'tidak didukung'));
    notes.push('Penyimpanan antrean: ' + (typeof localStorage !== 'undefined' ? 'aktif' : 'tidak aktif'));

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
    var card = cards[2];
    if (!card || card.querySelector('.key-note')) { return; }
    var p = document.createElement('p');
    p.className = 'key-note';
    card.appendChild(p);
    updateKeyNote();
    document.addEventListener('appkeychange', updateKeyNote);
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
    }
  };
})();
