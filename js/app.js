(function () {
  'use strict';

  var ORDER = ['search', 'queue', 'play', 'help'];
  var activeView = 'search';
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }

  function toast(message) {
    var el = $('toast');
    if (!el) { return; }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3500);
  }

  function updateKeyChip() {
    var chip = $('key-status');
    if (!chip) { return; }
    if (AppConfig.youtubeApiKey) {
      chip.textContent = 'Key: aktif';
      chip.classList.add('is-ok');
    } else {
      chip.textContent = 'Key: tidak ada';
      chip.classList.remove('is-ok');
    }
  }

  function showView(name) {
    if (ORDER.indexOf(name) === -1) { return; }
    activeView = name;
    ORDER.forEach(function (view) {
      var section = $('view-' + view);
      if (section) { section.classList.toggle('is-active', view === name); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.setAttribute('aria-selected', tab.getAttribute('data-view') === name ? 'true' : 'false');
    });
    if (window.location.hash !== '#' + name) {
      window.history.replaceState(null, '', '#' + name);
    }
    focusFirstInView(name);
  }

  function focusFirstInView(name) {
    var section = $('view-' + name);
    if (!section) { return; }
    var target = section.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
    var active = document.activeElement;
    if (target && (!active || !section.contains(active))) {
      target.focus();
    }
  }

  function setNowPlaying(video) {
    var title = $('now-title');
    var sub = $('now-sub');
    if (title) { title.textContent = video.title || '-'; }
    if (sub) {
      sub.textContent = (video.author ? video.author : '') +
        (video.duration ? (video.author ? ' \u00b7 ' : '') + Utils.fmtTime(video.duration) : '');
    }
    document.body.dataset.playingId = video.id || '';
  }

  function playVideo(video) {
    if (!video) { return; }
    setNowPlaying(video);
    Player.load(video);
    Lyrics.load(video);
    showView('play');
    Player.updateToggleLabel();
  }

  function playIndex(index) {
    var item = Queue.at(index);
    if (!item) {
      toast('Tidak ada lagu pada urutan itu.');
      return;
    }
    Queue.setCurrent(index);
    playVideo(item);
  }

  function playFromStart() {
    if (!Queue.length()) {
      toast('Antrean masih kosong.');
      showView('queue');
      return;
    }
    if (Queue.current() && Queue.current().id === (document.body.dataset.playingId || '')) {
      var next = Queue.nextIndex();
      playIndex(next >= 0 ? next : 0);
      return;
    }
    playIndex(0);
  }

  function openSettings() {
    var modal = $('settings-modal');
    if (!modal) { return; }
    var input = $('api-key-input');
    if (input) { input.value = AppConfig.youtubeApiKey || ''; }
    modal.hidden = false;
    if (input) { input.focus(); }
  }

  function closeSettings() {
    var modal = $('settings-modal');
    if (modal) { modal.hidden = true; }
  }

  function saveKey() {
    var input = $('api-key-input');
    var value = input ? input.value.trim() : '';
    AppConfig.setKey(value);
    toast(value ? 'API key disimpan.' : 'API key dihapus.');
    closeSettings();
  }

  function isModalOpen() {
    var modal = $('settings-modal');
    return modal && !modal.hidden;
  }

  function handleGlobalKeys(event) {
    var key = event.key;

    if (key === 'Escape') {
      if (isModalOpen()) {
        closeSettings();
        event.preventDefault();
      }
      return;
    }

    if (isModalOpen()) {
      if (key === 'Enter' && event.target && event.target.id === 'api-key-input') {
        saveKey();
        event.preventDefault();
      }
      return;
    }

    if (key === '1' || key === '2' || key === '3' || key === '4') {
      var target = document.activeElement;
      var typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!typing) {
        showView(ORDER[Number(key) - 1]);
        event.preventDefault();
        return;
      }
    }

    if ((key === 'ArrowLeft' || key === 'ArrowRight') && document.activeElement) {
      var active = document.activeElement;
      if (active.classList && active.classList.contains('tab')) {
        var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
        var idx = tabs.indexOf(active);
        var delta = key === 'ArrowRight' ? 1 : -1;
        var next = (idx + delta + tabs.length) % tabs.length;
        tabs[next].focus();
        showView(tabs[next].getAttribute('data-view'));
        event.preventDefault();
      }
    }
  }

  function bindControls() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        showView(tab.getAttribute('data-view'));
      });
    });

    var chip = $('key-status');
    if (chip) { chip.addEventListener('click', openSettings); }

    var settings = $('btn-settings');
    if (settings) { settings.addEventListener('click', openSettings); }

    var close = $('btn-close-settings');
    if (close) { close.addEventListener('click', closeSettings); }

    var save = $('btn-save-key');
    if (save) { save.addEventListener('click', saveKey); }

    var clear = $('btn-clear-key');
    if (clear) {
      clear.addEventListener('click', function () {
        AppConfig.clearKey();
        var input = $('api-key-input');
        if (input) { input.value = ''; }
        toast('API key dihapus.');
      });
    }

    var prev = $('btn-prev');
    if (prev) {
      prev.addEventListener('click', function () {
        var idx = Queue.prevIndex();
        if (idx < 0) { toast('Ini lagu pertama di antrean.'); return; }
        playIndex(idx);
      });
    }

    var next = $('btn-next');
    if (next) {
      next.addEventListener('click', function () {
        var idx = Queue.nextIndex();
        if (idx < 0) { toast('Tidak ada lagu berikutnya. Tambah lagu dulu.'); return; }
        playIndex(idx);
      });
    }

    var startQueue = $('btn-play-queue');
    if (startQueue) { startQueue.addEventListener('click', playFromStart); }

    var clearQueue = $('btn-clear-queue');
    if (clearQueue) {
      clearQueue.addEventListener('click', function () {
        if (!Queue.length()) { toast('Antrean sudah kosong.'); return; }
        if (window.confirm('Hapus semua lagu dari antrean?')) {
          Queue.clear();
          toast('Antrean dikosongkan.');
        }
      });
    }
  }

  function bindModules() {
    Search.onRequestPlay(function (video) {
      playVideo(video);
      toast('Memutar: ' + video.title);
    });

    Queue.onRequestPlay(function (index) { playIndex(index); });

    Queue.onChange(function () {
      Queue.render();
    });

    Player.onTime(function (time) { Lyrics.setTime(time); });

    Player.onState(function (state) {
      if (state === 'ended') {
        var idx = Queue.nextIndex();
        if (idx >= 0) { playIndex(idx); return; }
        toast('Antrean selesai.');
      }
      Player.updateToggleLabel();
    });

    document.addEventListener('appkeychange', function () {
      updateKeyChip();
      if (AppConfig.youtubeApiKey) {
        toast('Sumber pencarian: YouTube Data API.');
      } else {
        toast('Sumber pencarian: server cadangan tanpa key.');
      }
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) { return; }
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') { return; }
    navigator.serviceWorker.register('sw.js').catch(function () { /* diabaikan */ });
  }

  var App = {
    toast: toast,
    openSettings: openSettings,
    closeSettings: closeSettings,
    showView: showView,
    init: function () {
      Queue.init();
      Search.init();
      Player.init();
      Mic.init();
      Guide.init();
      bindControls();
      bindModules();
      updateKeyChip();
      document.addEventListener('keydown', handleGlobalKeys);
      registerServiceWorker();

      var initial = (window.location.hash || '').replace('#', '');
      showView(ORDER.indexOf(initial) !== -1 ? initial : 'search');

      window.addEventListener('hashchange', function () {
        var name = (window.location.hash || '').replace('#', '');
        if (ORDER.indexOf(name) !== -1) { showView(name); }
      });
    }
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', App.init);
})();
