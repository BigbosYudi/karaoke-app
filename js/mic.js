(function () {
  'use strict';

  var ctx = null;
  var stream = null;
  var source = null;
  var dryGain = null;
  var delay = null;
  var feedback = null;
  var wetGain = null;
  var running = false;
  var starting = false;
  var generation = 0;

  function isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext && !!(window.AudioContext || window.webkitAudioContext);
  }

  function setButton(text) {
    var btn = document.getElementById('btn-mic');
    if (btn) { btn.textContent = text; }
  }

  function echoAmount() {
    var range = document.getElementById('echo-range');
    var value = range ? Number(range.value) : 35;
    return Math.max(0, Math.min(100, value)) / 100;
  }

  function applyEcho() {
    var amount = echoAmount();
    if (!ctx) { return; }
    var now = ctx.currentTime;
    if (delay) { delay.delayTime.setTargetAtTime(0.08 + amount * 0.16, now, 0.05); }
    if (feedback) { feedback.gain.setTargetAtTime(Math.min(0.6, amount * 0.62), now, 0.05); }
    if (wetGain) { wetGain.gain.setTargetAtTime(amount * 0.9, now, 0.05); }
  }

  function start() {
    if (starting || running) { return Promise.resolve(false); }
    if (!isSupported()) {
      if (window.App && App.toast) {
        App.toast('Browser TV ini tidak mengizinkan akses mikrofon.');
      }
      return Promise.resolve(false);
    }
    var attempt = ++generation;
    starting = true;
    setButton('Mic: menyalakan...');
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    }).then(function (mediaStream) {
      if (attempt !== generation || document.hidden) {
        mediaStream.getTracks().forEach(function (t) { t.stop(); });
        if (attempt === generation) { starting = false; setButton('Mic: mati'); }
        return false;
      }
      stream = mediaStream;
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      source = ctx.createMediaStreamSource(stream);

      dryGain = ctx.createGain();
      dryGain.gain.value = 0.85;

      delay = ctx.createDelay(1.0);
      feedback = ctx.createGain();
      wetGain = ctx.createGain();

      source.connect(dryGain).connect(ctx.destination);
      source.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wetGain).connect(ctx.destination);

      applyEcho();
      return Promise.resolve(ctx.resume ? ctx.resume() : undefined).then(function () {
        if (attempt !== generation) { return false; }
        starting = false;
        running = true;
        setButton('Mic: hidup');
        if (window.App && App.toast) {
          App.toast('Mikrofon aktif. Gunakan headset agar tidak terjadi umpan balik.');
        }
        return true;
      });
    }).catch(function (err) {
      if (attempt !== generation) { return false; }
      starting = false;
      running = false;
      // Jangan tinggalkan track mikrofon tetap terbuka bila rangkaian audio gagal dibuat.
      try { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); } } catch (e) { /* diabaikan */ }
      try { if (ctx) { ctx.close(); } } catch (e) { /* diabaikan */ }
      stream = null;
      ctx = null;
      source = null;
      dryGain = null;
      delay = null;
      feedback = null;
      wetGain = null;
      setButton('Mic: mati');
      if (window.App && App.toast) {
        App.toast('Gagal mengakses mikrofon: ' + (err && err.name ? err.name : 'error'));
      }
      return false;
    });
  }

  function stop() {
    generation += 1;
    try {
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); }
      if (ctx) { ctx.close(); }
    } catch (e) { /* diabaikan */ }
    ctx = null;
    stream = null;
    source = null;
    dryGain = null;
    delay = null;
    feedback = null;
    wetGain = null;
    running = false;
    starting = false;
    setButton('Mic: mati');
  }

  function toggle() {
    if (starting) { return Promise.resolve(false); }
    if (running) { stop(); return Promise.resolve(false); }
    return start();
  }

  function describeSupport() {
    var note = document.getElementById('help-mic-note');
    if (!note) { return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      note.textContent = 'Browser TV Anda melaporkan tidak mendukung akses mikrofon. Fitur ini akan nonaktif; gunakan mixer/mikrofon eksternal bila perlu.';
      return;
    }
    if (!window.isSecureContext) {
      note.textContent = 'Mikrofon hanya aktif pada alamat https atau localhost. Halaman ini dibuka tanpa konteks aman.';
      return;
    }
    note.textContent = 'Browser TV Anda mendukung akses mikrofon.';
  }

  window.Mic = {
    init: function () {
      var btn = document.getElementById('btn-mic');
      if (btn) {
        btn.addEventListener('click', function () { toggle(); });
        if (!isSupported()) {
          btn.disabled = true;
          btn.textContent = 'Mic: tidak didukung';
        }
      }
      var range = document.getElementById('echo-range');
      if (range) { range.addEventListener('input', applyEcho); }
      describeSupport();
    },
    toggle: toggle,
    stop: stop,
    isRunning: function () { return running; }
  };
})();
