(function () {
  'use strict';

  var currentToken = 0;
  var lineEls = [];
  var lineTimes = [];
  var plainMode = false;
  var lastActive = -1;
  var offsetSeconds = 0;

  function setStatus(text, isError) {
    var el = document.getElementById('lyrics-status');
    if (!el) { return; }
    el.textContent = text || '';
    el.style.color = isError ? 'var(--danger)' : '';
  }

  function setBody(html) {
    var body = document.getElementById('lyrics-body');
    if (body) { body.innerHTML = html; }
    lineEls = [];
    lineTimes = [];
    lastActive = -1;
  }

  function fetchJson(url) {
    return fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (res) {
        if (res.status === 404) { return null; }
        if (!res.ok) { return null; }
        return res.json();
      })
      .catch(function () { return null; });
  }

  function stripDecorations(text) {
    return Utils.cleanText(text)
      .replace(/[\(\[]\s*(official|official video|official music video|mv|m\/v|audio|lyric[s]?|lirik|karaoke|hd|4k|full album|live|cover|remastered|versi|version)[^\)\]]*[\)\]]/gi, ' ')
      .replace(/【[^】]*】/g, ' ')
      .replace(/[|•]+/g, ' - ')
      .replace(/\s{2,}/g, ' ')
      .replace(/[-–—\s]+$/, '')
      .trim();
  }

  function cleanChannel(author) {
    return Utils.cleanText(author)
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
      .replace(/\s*Official.*$/i, '')
      .trim();
  }

  function buildGuesses(video) {
    var cleaned = stripDecorations(video.title);
    var parts = cleaned.split(/\s+[-–—]\s+/).filter(function (p) { return p.length > 1; });
    var track = '';
    var artist = '';
    if (parts.length >= 2) {
      artist = parts[0];
      track = parts.slice(1).join(' - ');
    } else {
      track = cleaned;
      artist = cleanChannel(video.author || '');
    }
    track = track.replace(/\s*[-–—]\s*$/, '').trim();
    if (!artist || artist.length > 60) { artist = ''; }
    return { track: track, artist: artist, raw: cleaned };
  }

  function parseLrc(text) {
    var offset = 0;
    var lines = [];
    var offsetMatch = /\[offset:\s*(-?\d+)\s*\]/i.exec(text || '');
    if (offsetMatch) { offset = parseInt(offsetMatch[1], 10) / 1000; }

    (text || '').split(/\r?\n/).forEach(function (raw) {
      var re = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
      var times = [];
      var match;
      var consumed = 0;
      while ((match = re.exec(raw)) !== null) {
        var minutes = parseInt(match[1], 10);
        var seconds = parseInt(match[2], 10);
        var frac = 0;
        if (match[3]) {
          frac = parseInt((match[3] + '000').slice(0, 3), 10) / 1000;
        }
        times.push(minutes * 60 + seconds + frac);
        consumed = re.lastIndex;
      }
      var content = raw.slice(consumed).trim();
      times.forEach(function (t) {
        lines.push({ time: t, text: content });
      });
    });

    lines.sort(function (a, b) { return a.time - b.time; });
    lines = lines.filter(function (l) { return l.text !== ''; });
    return { lines: lines, offset: offset };
  }

  function renderSynced(parsed) {
    setOffset(parsed.offset);
    var body = document.getElementById('lyrics-body');
    if (!body) { return; }
    if (!parsed.lines.length) {
      setBody('<p class="muted">Lirik ditemukan tetapi tanpa penanda waktu.</p>');
      return;
    }
    body.innerHTML = parsed.lines.map(function (line, i) {
      return '<p class="line" data-index="' + i + '">' + Utils.escapeHtml(line.text) + '</p>';
    }).join('');
    lineEls = Array.prototype.slice.call(body.querySelectorAll('.line'));
    lineTimes = parsed.lines.map(function (l) { return l.time; });
    lastActive = -1;
  }

  function setOffset(value) { offsetSeconds = value || 0; }

  function renderPlain(text) {
    plainMode = true;
    var lines = (text || '').split(/\r?\n/);
    var body = document.getElementById('lyrics-body');
    if (!body) { return; }
    body.innerHTML = lines.map(function (line) {
      return '<p class="line is-plain">' + (line.trim() ? Utils.escapeHtml(line) : '&nbsp;') + '</p>';
    }).join('');
    lineEls = [];
    lineTimes = [];
  }

  function pickBest(records, videoDuration) {
    var usable = (records || []).filter(function (r) { return r && !r.instrumental; });
    if (!usable.length) { return null; }
    var synced = usable.filter(function (r) { return !!r.syncedLyrics; });
    var sorted = function (list) {
      return list.slice().sort(function (a, b) {
        if (!videoDuration) { return 0; }
        return Math.abs((a.duration || 0) - videoDuration) - Math.abs((b.duration || 0) - videoDuration);
      });
    };
    if (synced.length) { return { record: sorted(synced)[0], synced: true }; }
    var plain = usable.filter(function (r) { return !!r.plainLyrics; });
    if (plain.length) { return { record: sorted(plain)[0], synced: false }; }
    return null;
  }

  function lookup(video) {
    var base = AppConfig.lrclibBase + '/api';
    var guesses = buildGuesses(video);
    var duration = Math.round(video.duration || 0);
    var jobs = [];

    if (guesses.track) {
      var q = 'track_name=' + encodeURIComponent(guesses.track);
      if (guesses.artist) { q += '&artist_name=' + encodeURIComponent(guesses.artist); }
      if (duration) { q += '&duration=' + duration; }
      jobs.push(base + '/get?' + q);
      jobs.push(base + '/get?track_name=' + encodeURIComponent(guesses.track) +
        (guesses.artist ? '&artist_name=' + encodeURIComponent(guesses.artist) : ''));
      jobs.push(base + '/search?track_name=' + encodeURIComponent(guesses.track) +
        (guesses.artist ? '&artist_name=' + encodeURIComponent(guesses.artist) : ''));
    }
    if (guesses.raw) {
      jobs.push(base + '/search?q=' + encodeURIComponent(guesses.raw));
    }

    var records = [];

    function step(i) {
      if (i >= jobs.length) { return Promise.resolve(records); }
      return fetchJson(jobs[i]).then(function (data) {
        if (Array.isArray(data)) {
          records = records.concat(data);
        } else if (data && typeof data === 'object') {
          records.push(data);
        }
        var best = pickBest(records, duration);
        if (best && best.synced) { return records; }
        return step(i + 1);
      });
    }
    return step(0);
  }

  function load(video) {
    if (!video || !video.id) { return; }
    var token = ++currentToken;
    plainMode = false;
    offsetSeconds = 0;
    setStatus('Mencari lirik...');
    setBody('<p class="muted">Mencari lirik untuk "' + Utils.escapeHtml(video.title) + '"...</p>');

    lookup(video).then(function (records) {
      if (token !== currentToken) { return; }
      var best = pickBest(records, Math.round(video.duration || 0));
      if (!best) {
        var anyInstrumental = (records || []).some(function (r) { return r && r.instrumental; });
        if (anyInstrumental) {
          setBody('<p class="muted">Lagu ini terdeteksi instrumental (tanpa lirik).</p>');
          setStatus('');
        } else {
          setBody('<p class="muted">Lirik belum tersedia untuk lagu ini.</p>');
          setStatus('tidak ditemukan');
        }
        return;
      }
      if (best.synced) {
        renderSynced(parseLrc(best.record.syncedLyrics));
        setStatus('sinkron');
      } else {
        renderPlain(best.record.plainLyrics);
        setStatus('tanpa sinkron');
      }
    });
  }

  function activeIndexAt(time) {
    var target = time - offsetSeconds;
    var lo = 0;
    var hi = lineTimes.length - 1;
    var found = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (lineTimes[mid] <= target) { found = mid; lo = mid + 1; }
      else { hi = mid - 1; }
    }
    return found;
  }

  function setTime(time) {
    if (plainMode || !lineEls.length) { return; }
    var index = activeIndexAt(time);
    if (index === lastActive) { return; }
    if (lastActive >= 0 && lineEls[lastActive]) {
      lineEls[lastActive].classList.remove('is-active');
    }
    lastActive = index;
    if (index >= 0 && lineEls[index]) {
      lineEls[index].classList.add('is-active');
      lineEls[index].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  window.Lyrics = {
    load: load,
    setTime: setTime
  };
})();
