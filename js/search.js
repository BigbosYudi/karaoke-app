(function () {
  'use strict';

  var playingHandlers = [];
  var requestSeq = 0;
  var lastQuery = '';
  var karaokeMode = true;

  function setStatus(text, isError) {
    var el = document.getElementById('search-status');
    if (!el) { return; }
    el.textContent = text;
    el.style.color = isError ? 'var(--danger)' : '';
  }

  function fetchWithTimeout(url, ms) {
    var limit = ms || (AppConfig.searchTimeoutMs || 12000);
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    var options = controller ? { signal: controller.signal } : {};
    var timer = null;
    var timeout = new Promise(function (resolve, reject) {
      timer = setTimeout(function () {
        if (controller) { try { controller.abort(); } catch (e) { /* diabaikan */ } }
        reject(new Error('koneksi terlalu lama'));
      }, limit);
    });
    return Promise.race([fetch(url, options), timeout]).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function parseIsoDuration(value) {
    var m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value || '');
    if (!m) { return 0; }
    var d = parseInt(m[1] || '0', 10);
    var h = parseInt(m[2] || '0', 10);
    var min = parseInt(m[3] || '0', 10);
    var s = parseInt(m[4] || '0', 10);
    return d * 86400 + h * 3600 + min * 60 + s;
  }

  function normalise(entry) {
    return {
      id: entry.id,
      title: entry.title,
      author: entry.author || '',
      duration: entry.duration || 0,
      thumb: entry.thumb || Utils.thumbFor(entry.id)
    };
  }

  function viaDataApi(query) {
    var key = AppConfig.youtubeApiKey;
    var searchUrl = 'https://www.googleapis.com/youtube/v3/search'
      + '?part=snippet&type=video&maxResults=25&safeSearch=none&q='
      + encodeURIComponent(query) + '&key=' + encodeURIComponent(key);

    return fetchWithTimeout(searchUrl).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok || data.error) {
          var reason = data.error && data.error.errors && data.error.errors[0]
            ? data.error.errors[0].reason : 'error';
          var err = new Error(data.error && data.error.message ? data.error.message : 'Pencarian gagal');
          err.reason = reason;
          throw err;
        }
        var ids = (data.items || [])
          .map(function (item) { return item.id && item.id.videoId; })
          .filter(Boolean);

        if (!ids.length) { return []; }

        var detailUrl = 'https://www.googleapis.com/youtube/v3/videos'
          + '?part=contentDetails&id=' + ids.join(',')
          + '&key=' + encodeURIComponent(key);

        return fetchWithTimeout(detailUrl).then(function (r2) { return r2.json(); }).then(function (d2) {
          var durations = {};
          (d2.items || []).forEach(function (v) {
            durations[v.id] = parseIsoDuration(v.contentDetails && v.contentDetails.duration);
          });
          return (data.items || []).map(function (item) {
            var sn = item.snippet || {};
            var id = item.id && item.id.videoId;
            var thumbs = sn.thumbnails || {};
            var thumb = (thumbs.medium || thumbs.default || thumbs.high || {}).url;
            return normalise({
              id: id,
              title: Utils.cleanText(sn.title),
              author: Utils.cleanText(sn.channelTitle),
              duration: durations[id] || 0,
              thumb: thumb || Utils.thumbFor(id)
            });
          }).filter(function (v) { return !!v.id; });
        });
      });
    });
  }

  function viaInvidious(query) {
    var instances = AppConfig.invidiousInstances.slice();
    var attempt = function (i) {
      if (i >= instances.length) {
        return Promise.reject(new Error('Semua server Invidious tidak merespons.'));
      }
      var base = instances[i].replace(/\/$/, '');
      var url = base + '/api/v1/search?q=' + encodeURIComponent(query) + '&type=video';
      return fetchWithTimeout(url).then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      }).then(function (data) {
        if (!Array.isArray(data)) { throw new Error('Format tidak dikenal'); }
        return data.map(function (item) {
          var thumbs = item.videoThumbnails || [];
          var picked = thumbs.find(function (t) { return t.quality === 'medium'; }) || thumbs[0] || {};
          return normalise({
            id: item.videoId,
            title: Utils.cleanText(item.title),
            author: Utils.cleanText(item.author),
            duration: item.lengthSeconds || 0,
            thumb: picked.url || Utils.thumbFor(item.videoId)
          });
        }).filter(function (v) { return !!v.id; });
      }).catch(function () {
        return attempt(i + 1);
      });
    };
    return attempt(0);
  }

  function renderResults(results) {
    var list = document.getElementById('search-results');
    if (!list) { return; }
    if (!results.length) {
      list.innerHTML = '';
      return;
    }
    list.innerHTML = results.map(function (v) {
      return '' +
        '<li class="card">' +
          '<img src="' + Utils.escapeHtml(v.thumb) + '" alt="" loading="lazy">' +
          '<div class="card-info">' +
            '<p class="card-title">' + Utils.escapeHtml(v.title) + '</p>' +
            '<p class="card-sub">' + Utils.escapeHtml(v.author) +
              (v.duration ? ' &middot; ' + Utils.fmtTime(v.duration) : '') + '</p>' +
          '</div>' +
          '<div class="card-actions">' +
            '<button class="btn primary" data-act="add" data-id="' + Utils.escapeHtml(v.id) + '">Tambah</button>' +
            '<button class="btn" data-act="play" data-id="' + Utils.escapeHtml(v.id) + '">Putar</button>' +
          '</div>' +
        '</li>';
    }).join('');
  }

  var cache = {};

  function handleResultsClick(event) {
    var btn = event.target.closest('button[data-act]');
    if (!btn) { return; }
    var video = cache[btn.getAttribute('data-id')];
    if (!video) { return; }
    if (btn.getAttribute('data-act') === 'add') {
      Queue.add(video);
      if (window.App && App.toast) { App.toast('Ditambahkan ke antrean: ' + video.title); }
    } else {
      playingHandlers.forEach(function (fn) { fn(video); });
    }
  }

  var Search = {
    init: function () {
      var form = document.getElementById('search-form');
      var list = document.getElementById('search-results');
      var modeButton = document.getElementById('btn-karaoke-mode');
      if (modeButton) {
        modeButton.addEventListener('click', function () {
          karaokeMode = !karaokeMode;
          modeButton.setAttribute('aria-pressed', String(karaokeMode));
          modeButton.textContent = karaokeMode ? 'Mode Karaoke: aktif' : 'Mode Karaoke: mati';
          var note = document.getElementById('search-mode-note');
          if (note) {
            note.textContent = karaokeMode
              ? 'Kata “karaoke” otomatis ditambahkan di depan pencarian.'
              : 'Pencarian biasa, sesuai kata yang Anda ketik.';
          }
        });
      }
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var input = document.getElementById('search-input');
          Search.run(input ? input.value : '');
        });
      }
      if (list) { list.addEventListener('click', handleResultsClick); }
    },
    run: function (query) {
      var q = Utils.cleanText(query);
      if (!q) {
        setStatus('Masukkan kata kunci terlebih dahulu.', true);
        return Promise.resolve([]);
      }
      if (karaokeMode) {
        // Pindahkan kata yang sudah ada ke depan, tanpa menggandakannya.
        q = Utils.cleanText(q.replace(/\bkaraoke\b/gi, ' '));
        q = 'karaoke' + (q ? ' ' + q : '');
      }
      var token = ++requestSeq;
      lastQuery = q;
      setStatus('Mencari "' + q + '"...');
      renderResults([]);

      var usedApi = AppConfig.hasKey();
      var task = usedApi
        ? viaDataApi(q).catch(function (err) {
            var quota = err.reason === 'quotaExceeded' || err.reason === 'dailyLimitExceeded';
            if (token === requestSeq) {
              setStatus(quota
                ? 'Kuota API harian habis. Beralih ke server cadangan...'
                : 'API YouTube gagal (' + err.message + '). Beralih ke server cadangan...', true);
            }
            usedApi = false;
            return viaInvidious(q);
          })
        : viaInvidious(q);

      return task.then(function (results) {
        if (token !== requestSeq) { return results; }
        cache = {};
        results.forEach(function (v) { cache[v.id] = v; });
        renderResults(results);
        var source = usedApi ? 'YouTube API' : 'server cadangan (tanpa key)';
        setStatus(results.length
          ? results.length + ' hasil dari ' + source + '.'
          : 'Tidak ada hasil untuk "' + q + '".');
        return results;
      }).catch(function (err) {
        if (token !== requestSeq) { return []; }
        renderResults([]);
        setStatus('Pencarian gagal: ' + err.message + '. Periksa koneksi internet TV.', true);
        return [];
      });
    },
    onRequestPlay: function (fn) { playingHandlers.push(fn); },
    lastQuery: function () { return lastQuery; }
  };

  window.Search = Search;
})();
