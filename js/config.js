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

  var stored = readUrlKey() || localStorage.getItem(LS_KEY) || env.youtubeApiKey || '';

  window.AppConfig = {
    youtubeApiKey: stored,
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
        localStorage.setItem(LS_KEY, this.youtubeApiKey);
      } else {
        localStorage.removeItem(LS_KEY);
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
