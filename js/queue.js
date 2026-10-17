(function () {
  'use strict';

  var LS_ITEMS = 'karaoke.queue';
  var LS_INDEX = 'karaoke.queueIndex';

  var items = [];
  var currentIndex = -1;
  var listeners = [];
  var playHandlers = [];

  function load() {
    try {
      var raw = localStorage.getItem(LS_ITEMS);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) { items = []; }
    } catch (e) {
      items = [];
    }
    items = items.filter(function (item) {
      return item && typeof item.id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(item.id) && typeof item.title === 'string';
    });
    var idx = -1;
    try { idx = parseInt(localStorage.getItem(LS_INDEX), 10); } catch (e) { /* sesi tanpa penyimpanan */ }
    currentIndex = idx >= 0 && idx < items.length ? idx : -1;
  }

  function save() {
    try {
      localStorage.setItem(LS_ITEMS, JSON.stringify(items));
      localStorage.setItem(LS_INDEX, String(currentIndex));
    } catch (e) { /* penyimpanan penuh atau diblokir */ }
  }

  function emit() {
    save();
    listeners.forEach(function (fn) { fn(items.slice(), currentIndex); });
  }

  function render() {
    var list = document.getElementById('queue-list');
    var empty = document.getElementById('queue-empty');
    var count = document.getElementById('queue-count');
    if (!list) { return; }

    if (count) {
      count.textContent = items.length ? '(' + items.length + ' lagu)' : '';
    }
    if (empty) {
      empty.style.display = items.length ? 'none' : 'block';
    }

    list.innerHTML = items.map(function (item, i) {
      var cls = i === currentIndex ? 'queue-row is-current' : 'queue-row';
      return '' +
        '<li class="' + cls + '">' +
          '<span class="num">' + (i + 1) + '</span>' +
          '<div class="q-info">' +
            '<div class="q-title">' + Utils.escapeHtml(item.title) + '</div>' +
            '<div class="q-sub">' + Utils.escapeHtml(item.author || '') +
              (item.duration ? ' &middot; ' + Utils.fmtTime(item.duration) : '') + '</div>' +
          '</div>' +
          '<div class="q-actions">' +
            '<button class="btn" data-act="play" data-index="' + i + '">Putar</button>' +
            '<button class="btn" data-act="up" data-index="' + i + '">Naik</button>' +
            '<button class="btn" data-act="down" data-index="' + i + '">Turun</button>' +
            '<button class="btn danger" data-act="remove" data-index="' + i + '">Hapus</button>' +
          '</div>' +
        '</li>';
    }).join('');
  }

  function handleClick(event) {
    var btn = event.target.closest('button[data-act]');
    if (!btn) { return; }
    var index = parseInt(btn.getAttribute('data-index'), 10);
    var act = btn.getAttribute('data-act');

    if (act === 'play') {
      playHandlers.forEach(function (fn) { fn(index); });
      return;
    }
    var targetIndex = index;
    if (act === 'remove') { Queue.remove(index); targetIndex = Math.min(index, items.length - 1); }
    if (act === 'up') { Queue.move(index, -1); targetIndex = Math.max(0, index - 1); }
    if (act === 'down') { Queue.move(index, 1); targetIndex = Math.min(items.length - 1, index + 1); }
    var replacement = document.querySelector('#queue-list button[data-act="' + act + '"][data-index="' + targetIndex + '"]') || document.getElementById('btn-play-queue');
    if (replacement) { replacement.focus(); }
  }

  var Queue = {
    all: function () { return items.slice(); },
    length: function () { return items.length; },
    at: function (i) { return items[i] || null; },
    currentIndex: function () { return currentIndex; },
    current: function () { return items[currentIndex] || null; },
    add: function (video) {
      items.push({
        id: video.id,
        title: video.title,
        author: video.author || '',
        duration: video.duration || 0
      });
      emit();
    },
    remove: function (index) {
      if (index < 0 || index >= items.length) { return; }
      var wasCurrent = index === currentIndex;
      items.splice(index, 1);
      if (!items.length) {
        currentIndex = -1;
      } else if (index < currentIndex) {
        currentIndex -= 1;
      } else if (wasCurrent) {
        // Kursor sebelum penerus agar tombol Berikutnya tidak melewatinya.
        currentIndex = index - 1;
      }
      emit();
    },
    move: function (index, delta) {
      var target = index + delta;
      if (index < 0 || index >= items.length) { return; }
      if (target < 0 || target >= items.length) { return; }
      var tmp = items[index];
      items[index] = items[target];
      items[target] = tmp;
      if (currentIndex === index) { currentIndex = target; }
      else if (currentIndex === target) { currentIndex = index; }
      emit();
    },
    clear: function () {
      items = [];
      currentIndex = -1;
      emit();
    },
    setCurrent: function (index) {
      currentIndex = (index >= 0 && index < items.length) ? index : -1;
      emit();
    },
    nextIndex: function () {
      return (currentIndex + 1 < items.length) ? currentIndex + 1 : -1;
    },
    prevIndex: function () {
      return (currentIndex - 1 >= 0) ? currentIndex - 1 : -1;
    },
    onChange: function (fn) { listeners.push(fn); },
    onRequestPlay: function (fn) { playHandlers.push(fn); },
    render: render,
    init: function () {
      load();
      var list = document.getElementById('queue-list');
      if (list) { list.addEventListener('click', handleClick); }
      render();
      emit();
    }
  };

  window.Queue = Queue;
})();
