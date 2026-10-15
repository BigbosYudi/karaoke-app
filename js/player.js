(function () {
  'use strict';

  var player = null;
  var ready = false;
  var creating = false;
  var loadedVideoId = '';
  var apiLoading = false;
  var apiQueue = [];
  var pendingVideo = null;
  var pollTimer = null;
  var timeHandlers = [];
  var stateHandlers = [];

  function ensureApi(callback) {
    if (window.YT && window.YT.Player) { callback(); return; }
    apiQueue.push(callback);
    if (apiLoading) { return; }
    apiLoading = true;

    var previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof previous === 'function') { previous(); }
      apiQueue.forEach(function (fn) { fn(); });
      apiQueue = [];
    };

    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = function () {
      apiQueue = [];
      apiLoading = false;
      if (window.App && App.toast) {
        App.toast('Gagal memuat pemutar YouTube. Periksa koneksi internet TV.');
      }
    };
    document.head.appendChild(tag);
  }

  function hidePlaceholder() {
    var el = document.getElementById('player-placeholder');
    if (el) { el.classList.add('is-hidden'); }
  }

  function showPlaceholder() {
    var el = document.getElementById('player-placeholder');
    if (el) { el.classList.remove('is-hidden'); }
  }

  function mediaOrigin() {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      return window.location.origin;
    }
    return '';
  }

  function createPlayer(video) {
    var host = document.getElementById('player');
    var box = document.createElement('div');
    box.id = 'yt-player-frame';
    host.innerHTML = '';
    host.appendChild(box);
    loadedVideoId = video.id;

    var vars = {
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      controls: 1,
      iv_load_policy: 3,
      fs: 1,
      autoplay: 1,
      videoId: video.id
    };
    var origin = mediaOrigin();
    if (origin) { vars.origin = origin; }

    player = new window.YT.Player(box, {
      videoId: video.id,
      host: 'https://www.youtube-nocookie.com',
      playerVars: vars,
      events: {
        onReady: function () {
          ready = true;
          hidePlaceholder();
          var target = pendingVideo;
          if (target && target.id && target.id !== loadedVideoId) {
            loadedVideoId = target.id;
            try { player.loadVideoById(target.id); } catch (e) { /* diabaikan */ }
          } else {
            try { player.playVideo(); } catch (e) { /* diabaikan */ }
          }
          startPolling();
        },
        onStateChange: function (event) {
          if (event.data === window.YT.PlayerState.ENDED) {
            stateHandlers.forEach(function (fn) { fn('ended'); });
          } else if (event.data === window.YT.PlayerState.PLAYING) {
            hidePlaceholder();
            stateHandlers.forEach(function (fn) { fn('playing'); });
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            stateHandlers.forEach(function (fn) { fn('paused'); });
          } else if (event.data === window.YT.PlayerState.BUFFERING) {
            stateHandlers.forEach(function (fn) { fn('buffering'); });
          }
        },
        onError: function (event) {
          stateHandlers.forEach(function (fn) { fn('error', event && event.data); });
        }
      }
    });
  }

  function startPolling() {
    if (pollTimer || !timeHandlers.length) { return; }
    pollTimer = setInterval(function () {
      if (!player || !ready) { return; }
      var t = 0;
      try { t = player.getCurrentTime() || 0; } catch (e) { t = 0; }
      timeHandlers.forEach(function (fn) { fn(t); });
    }, 250);
  }

  function load(video) {
    if (!video || !video.id) { return; }
    hidePlaceholder();
    pendingVideo = video;

    if (player) {
      if (!ready) { return; }
      if (video.id === loadedVideoId) {
        try { player.playVideo(); } catch (e) { /* diabaikan */ }
        startPolling();
        return;
      }
      loadedVideoId = video.id;
      try { player.loadVideoById(video.id); } catch (e) { /* diabaikan */ }
      startPolling();
      return;
    }

    if (creating) { return; }
    creating = true;
    ensureApi(function () {
      creating = false;
      if (player) { return; }
      createPlayer(pendingVideo || video);
    });
  }

  function isPlaying() {
    if (!player || !ready) { return false; }
    try { return player.getPlayerState() === window.YT.PlayerState.PLAYING; } catch (e) { return false; }
  }

  function toggle() {
    if (!player || !ready) { return; }
    try {
      if (isPlaying()) { player.pauseVideo(); } else { player.playVideo(); }
    } catch (e) { /* diabaikan */ }
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function toggleFullscreen() {
    var stage = document.getElementById('stage');
    if (!stage) { return; }
    if (fullscreenElement()) {
      if (document.exitFullscreen) { document.exitFullscreen(); }
      else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
      return;
    }
    if (stage.requestFullscreen) { stage.requestFullscreen(); }
    else if (stage.webkitRequestFullscreen) { stage.webkitRequestFullscreen(); }
  }

  function updateFullscreenLabel() {
    var btn = document.getElementById('btn-fullscreen');
    if (btn) {
      btn.textContent = fullscreenElement() ? 'Keluar Layar Penuh' : 'Layar Penuh';
    }
  }

  function updateToggleLabel() {
    var btn = document.getElementById('btn-toggle-play');
    if (btn) {
      btn.textContent = isPlaying() ? 'Jeda' : 'Putar';
    }
  }

  var Player = {
    load: load,
    toggle: toggle,
    isPlaying: isPlaying,
    toggleFullscreen: toggleFullscreen,
    onTime: function (fn) {
      timeHandlers.push(fn);
      if (ready) { startPolling(); }
    },
    onState: function (fn) { stateHandlers.push(fn); },
    init: function () {
      var toggleBtn = document.getElementById('btn-toggle-play');
      if (toggleBtn) { toggleBtn.addEventListener('click', toggle); }

      var fsBtn = document.getElementById('btn-fullscreen');
      if (fsBtn) { fsBtn.addEventListener('click', toggleFullscreen); }

      document.addEventListener('fullscreenchange', updateFullscreenLabel);
      document.addEventListener('webkitfullscreenchange', updateFullscreenLabel);

      if (!mediaOrigin()) {
        showPlaceholder();
        var ph = document.getElementById('player-placeholder');
        if (ph) {
          ph.innerHTML = '<p>Pemutar YouTube memerlukan alamat http/https.</p>' +
            '<p class="muted">Jalankan aplikasi lewat server lokal, bukan file://</p>';
        }
      }
      updateFullscreenLabel();
      updateToggleLabel();
    },
    updateToggleLabel: updateToggleLabel
  };

  window.Player = Player;
})();
