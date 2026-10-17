(function () {
  'use strict';

  var LS_KEY = 'karaoke.apiKey';
  var env = window.APP_CONFIG || {};

  function readUrlKey() {
    try {
      return new URLSearchParams(window.location.search).get('key') || '';
    } catch (e) {
      return '';
    }
  }

  // Sebagian browser TV memblokir localStorage; jangan sampai membuat aplikasi gagal start.
  function storageGet(key) {
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* diabaikan */ }
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* diabaikan */ }
  }

  var urlKey = readUrlKey();
  var stored = urlKey || storageGet(LS_KEY) || (storageGet(LS_KEY + '.disabled') ? '' : env.youtubeApiKey) || '';
  if (urlKey) {
    storageSet(LS_KEY, urlKey);
    storageRemove(LS_KEY + '.disabled');
    try {
      var cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('key');
      window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    } catch (e) { /* browser lama */ }
  }

  window.AppConfig = {
    youtubeApiKey: stored,
    searchTimeoutMs: 12000,
    invidiousInstances: env.invidiousInstances && env.invidiousInstances.length
      ? env.invidiousInstances
      : [
          'https://inv.nadeko.net',
          'https://invidious.nerdvpn.de',
          'https://yewtu.be'
        ],
    hasKey: function () {
      return !!this.youtubeApiKey;
    },
    setKey: function (key) {
      this.youtubeApiKey = (key || '').trim();
      if (this.youtubeApiKey) {
        storageSet(LS_KEY, this.youtubeApiKey);
        storageRemove(LS_KEY + '.disabled');
      } else {
        storageRemove(LS_KEY);
        storageSet(LS_KEY + '.disabled', '1');
      }
      document.dispatchEvent(new CustomEvent('appkeychange'));
    },
    clearKey: function () {
      this.setKey('');
    }
  };

  window.Utils = {
    fmtTime: function (seconds) {
      var s = Math.max(0, Math.floor(Number(seconds) || 0));
      var h = Math.floor(s / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
      return (h > 0 ? h + ':' + pad(m) : '' + m) + ':' + pad(sec);
    },
    escapeHtml: function (str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    thumbFor: function (id) {
      return 'https://i.ytimg.com/vi/' + encodeURIComponent(id) + '/mqdefault.jpg';
    },
    cleanText: function (str) {
      return String(str == null ? '' : str)
        .replace(/\s+/g, ' ')
        .trim();
    },
    debounce: function (fn, wait) {
      var t = null;
      return function () {
        var args = arguments;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(null, args); }, wait);
      };
    }
  };
})();
