/* Shared recording playback. The media clock owns phrase and word progress. */
(function () {
  'use strict';
  /* Every recording and sound ships twice under one name: Ogg Opus (small) and
     MP3 (plays everywhere). Catalog paths name the MP3; browsers that fully
     support Ogg Opus get the .ogg instead. */
  const ogg = (() => {
    try { return document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') === 'probably'; }
    catch (error) { return false; }
  })();
  window.polygonAudioSrc = src => ogg ? String(src).replace(/\.mp3$/i, '.ogg') : src;
  /* THE VOICE THROUGH THE LESSON'S AUDIO CONTEXT, where it is open. A media element may only
     start with sound after a tap on this page, and in Safari a tap inside the game's frame (its
     PLAY, which opens the experience) does not count, so the lesson's first line sat waiting for
     a tap of its own. The context is opened by that very tap (src/intro/opening.js forwards it to
     the lesson), so a line played through it is heard. This stands in for the element with the
     parts of it play() below uses: currentTime, duration, paused, play(), pause(), load(),
     removeAttribute() and the handlers. With no running context, or off the disk, the element
     is used as before. */
  const bytes = {};
  const fetchBytes = url => {
    if (!bytes[url]) {
      bytes[url] = fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status + ' ' + url)));
      bytes[url].catch(() => { delete bytes[url]; });
    }
    return bytes[url];
  };
  function contextVoice(ctx, url) {
    let node = null, t0 = 0, w0 = 0, at = 0, timer = 0, guard = 0, dead = false;
    const v = { duration: NaN, paused: true, preload: 'auto', onplaying: null, onpause: null, onwaiting: null,
      onstalled: null, onended: null, onerror: null, ontimeupdate: null, onseeked: null };
    /* the context's clock, with the wall clock a quarter second behind it: a context clock that
       stops (Safari can stop one) must not leave the words and the screen waiting on it */
    Object.defineProperty(v, 'currentTime', { get: () => (node && !v.paused
      ? Math.min(v.duration || Infinity, Math.max(0, ctx.currentTime - t0, (performance.now() - w0) / 1000 - 0.25)) : at), set: () => {} });
    const halt = () => { clearInterval(timer); clearTimeout(guard); if (node) { node.onended = null; try { node.stop(); } catch (e) {} } };
    const ended = () => { if (dead || v.paused) return; at = v.duration; v.paused = true; halt(); if (v.onended) v.onended(); };
    v.play = () => fetchBytes(url).then(buf => ctx.decodeAudioData(buf.slice(0))).then(b => {
      if (dead) return;
      if (ctx.state !== 'running') throw new Error('the context is not running');
      v.duration = b.duration;
      node = ctx.createBufferSource();
      node.buffer = b;
      node.connect(ctx.destination);
      t0 = ctx.currentTime + 0.02;
      w0 = performance.now() + 20;
      node.start(t0);
      v.paused = false;
      node.onended = ended;
      // and it ends on time whatever the context's clock does
      guard = setTimeout(ended, (b.duration + 0.6) * 1000);
      timer = setInterval(() => { if (!v.paused && v.ontimeupdate) v.ontimeupdate(); }, 100);
      setTimeout(() => { if (!dead && !v.paused && v.onplaying) v.onplaying(); }, 25);
    });
    v.pause = () => {
      if (!node || v.paused) return;
      at = v.currentTime; v.paused = true; halt();
      if (v.onpause) v.onpause();
    };
    v.removeAttribute = () => { dead = true; v.paused = true; halt(); };
    v.load = () => {};
    return v;
  }
  const voiceFor = (game, url) => {
    let ctx = null;
    try { ctx = game && game._ac && game._ac.state === 'running' ? game._ac : null; } catch (e) { ctx = null; }
    const via = window.PolygonRecordedVoice ? window.PolygonRecordedVoice.viaContext !== false : true;
    if (via && ctx && location.protocol !== 'file:' && typeof fetch === 'function') return contextVoice(ctx, url);
    return new Audio(url);
  };
  const numbers = ['zero','one','two','three','four','five','six','seven','eight','nine'];
  const normalize = text => text.toLowerCase().replace(/[0-9]/g, n => numbers[+n])
    .replace(/[’']/g, '').replace(/[^a-z]+/g, ' ').trim();
  window.PolygonRecordedVoice = {
    /* Through the lesson's AudioContext when it is running (voiceFor). false keeps every line on a
       media element: the checks that drive a fake one set window.POLYGON_VOICE_VIA_CONTEXT = false
       before the page loads, or this after it. */
    viaContext: window.POLYGON_VOICE_VIA_CONTEXT !== false,
    /* When each English word of `text` is said in the take, or null when the take's words are not
       the line's. `anyOrder`: the times need not rise (a take in another language says its words
       in its own order, so its English cue times do not, see cueStarts). */
    wordStarts(entry, text, anyOrder) {
      if (!Array.isArray(entry.words) || !entry.words.length) return null;
      let previous = -1;
      const spoken = [];
      for (const item of entry.words) {
        if (typeof item.word !== 'string' || !Number.isFinite(item.start) || item.start < 0 || (!anyOrder && item.start < previous)) return null;
        previous = item.start;
        normalize(item.word).split(' ').filter(Boolean).forEach(word => spoken.push({ word, start: item.start }));
      }
      if (spoken.map(item => item.word).join(' ') !== normalize(text)) return null;
      let index = 0, last = 0;
      return (text.match(/\S+/g) || []).map(token => {
        const size = normalize(token).split(' ').filter(Boolean).length;
        if (size) { last = spoken[index].start; index += size; }
        return last;
      });
    },
    /* A take in the page's language (a row of src/lesson/recordings-hi.js): for each English word of
       the line, the moment its cue fires, which is when the word that says the same thing is said
       in this take ("open" on खुली). Not in order. */
    cueStarts(entry, text) { return this.wordStarts(entry, text, true); },
    /* ...and when each word SHOWN is said: `shown` is the take's whole line or its opening words (a
       step can show less than it says, screen 27). null when its words are not the take's. */
    spokenStarts(entry, shown) {
      const said = Array.isArray(entry.spoken) ? entry.spoken : null;
      const words = String(shown || '').match(/\S+/g) || [];
      if (!said || !words.length || said.length < words.length) return null;
      const bare = w => String(w).replace(/[\s.,!?;:।…'"“”‘’—-]+/g, '');
      for (let i = 0; i < words.length; i++) {
        if (!said[i] || !Number.isFinite(said[i].start) || bare(said[i].word) !== bare(words[i])) return null;
      }
      return said.slice(0, words.length).map(w => w.start);
    },
    /* THE TAKE OF A LINE, found by its English words. In a language with a recorded voice of its
       own (?lan=hi: src/lesson/recordings-hi.js, which src/i18n/i18n.js loads with the language's
       words), that voice's take, or null where it has none: such a line is shown at a reading
       pace, never said in the English voice under the language's words. Otherwise, and with
       { english: true } (the drafted story's Help Momo scene, which stays English), the English
       take. */
    find(text, opts) {
      const own = this.voice();
      if (own && !(opts && opts.english)) return own.find(row => normalize(row.text) === normalize(text)) || null;
      return (window.POLYGON_RECORDINGS || []).find(row => normalize(row.text) === normalize(text));
    },
    /** The page's language's own takes, while that language is showing; null in English and in a
        language that speaks with the English recordings. */
    voice() {
      const I = window.PolygonI18n, all = window.POLYGON_VOICES;
      return I && I.on && all && Array.isArray(all[I.code]) ? all[I.code] : null;
    },
    play(game, text, entry, current, done, fail) {
      if (game._stopRecordedVoice) game._stopRecordedVoice();
      const audio = voiceFor(game, window.polygonAudioSrc(entry.src));
      audio.preload = 'auto';
      /* IN ANOTHER LANGUAGE (?lan=, src/i18n/i18n.js) what is shown is the line's translation, the
         whole of it on the board (narrShow). Where the language speaks with the English recording,
         the English words cue the screen and the shown words come in as the same share of the
         line as the voice has said of the English. Where it has a take of its own (entry.spoken,
         ?lan=hi), the shown words come in as that take says them, and each English cue ("open",
         "sides", "vertex") fires when the word that says it in the take is said: in the take's
         order, which is the language's, not the English order. */
      const I18N = window.PolygonI18n;
      const local = !!(I18N && I18N.on);
      const own = local && Array.isArray(entry.spoken);
      const pages = local ? [text] : game.instructionPages(text);
      const counts = pages.map(page => (page.match(/\S+/g) || []).length);
      const total = counts.reduce((a, b) => a + b, 0);
      const wordStarts = own ? null : this.wordStarts(entry, text);
      const words = text.match(/\S+/g) || [];
      const cueAt = own ? this.cueStarts(entry, text) : null;
      const cueOrder = cueAt ? words.map((w, i) => i).sort((a, b) => cueAt[a] - cueAt[b] || a - b) : null;
      let fired = 0;
      /* A step may speak only the opening of its recording. Screen 27 shows
         "Drag any vertex" and should say exactly that, but the studio take
         carries on into "Stretch it, squash it..." -- lines that belong to the
         interaction, not to the instruction on the board. Rather than re-cut
         the MP3 and lose the real voice, playback stops in the silence after
         the last spoken word, so the take is used exactly as recorded and
         simply ends where the sentence does. */
      /* (In a take of the page's language the English word after the last one shown cues the
         start of the sentence that says it, so the cut falls in the same pause.) */
      const speakWords = game.step().speakWords;
      const cutFrom = own ? cueAt : wordStarts;
      const cutAt = Number.isFinite(speakWords) && cutFrom && cutFrom.length > speakWords
        ? Math.max(0, cutFrom[speakWords] - 0.3) : null;
      let spoken = 0;
      let frame, pageIndex = -1, revealed = -1, stopped = false;
      const stop = () => {
        stopped = true; cancelAnimationFrame(frame);
        audio.onplaying = audio.onpause = audio.onwaiting = audio.onstalled = audio.onended = audio.onerror = audio.ontimeupdate = null;
        audio.pause(); audio.removeAttribute('src'); audio.load();
        if (game._stopRecordedVoice === stop) game._stopRecordedVoice = null;
      };
      game._stopRecordedVoice = stop;
      /* The teaching animations on S11 are CSS animations anchored to the
         voice. Publishing the media clock on every frame meant a React render
         per frame, each one re-resolving a held animation's delay -- which is
         what made those screens stutter. The clock is published only when the
         timeline actually jumps: it starts, pauses, stalls, seeks or ends.
         Between those the browser runs the animation itself, so it is smooth,
         and it is still anchored to the real audio position rather than a
         generic delay. */
      const clock = running => {
        if (stopped || !current() || game.step().sc !== 'S11') return;
        game.setState({ voiceElapsedMs: audio.currentTime * 1000, voiceClockRunning: !!running });
      };
      /* One English word said: the open / closed buttons it names, the boundary pulse it cues,
         Swiftee's gesture on it. `at` is when it is said in the take, seconds. */
      function cueWord(i, at, duration) {
        if (game.revealChoiceWords) game.revealChoiceWords(words[i]);
        if (game.boundaryScene && game.boundaryScene()) game.keyword(words[i], {
          wordStartMs: at * 1000, mediaTimeMs: audio.currentTime * 1000, durationMs: duration * 1000
        });
        else if (game.guide && game.guide.onWord) game.guide.onWord(words[i], game.step());
      }
      let spokenKey = null, spokenFor = null;
      const spokenStartsOf = shown => {
        if (shown !== spokenKey) { spokenKey = shown; spokenFor = this.spokenStarts(entry, shown); }
        return spokenFor;
      };
      function update() {
        if (stopped || !current()) return;
        if (cutAt !== null && audio.currentTime >= cutAt) { finish(); return; }
        const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : entry.duration;
        // Alignment timestamps are seconds relative to this MP3, including leading silence.
        // Keep the duration fallback only for recordings without validated alignment.
        const spokenCount = wordStarts ? wordStarts.filter(start => start <= audio.currentTime).length : null;
        const position = wordStarts ? Math.max(0, spokenCount - 1) : Math.min(total - 0.001, Math.max(0, audio.currentTime / duration * total));
        const audibleCount = wordStarts ? spokenCount : Math.min(total, Math.floor(position) + 1);
        if (own) {
          // the English cues, each as the take says the word that carries it
          while (fired < words.length) {
            const i = cueOrder ? cueOrder[fired] : fired;
            const at = cueAt ? cueAt[i] : duration * i / Math.max(1, words.length);
            if (at > audio.currentTime) break;
            cueWord(i, at, duration);
            fired += 1;
            if (game.step().sc === 'S8' && !game.state.reveal && normalize(words[i]) === 'polygon') game.keyword('polygon');
          }
        } else while (spoken < audibleCount) {
          cueWord(spoken, wordStarts ? wordStarts[spoken] : duration * spoken / total, duration);
          spoken += 1;
        }
        // Scrub the paused CSS pulse from the media clock, including rate changes and pauses.
        if (game.boundaryScene && game.boundaryScene() && game.syncBoundaryPulse)
          game.syncBoundaryPulse(audio.currentTime * 1000);
        let page = 0, offset = 0, count;
        if (own) {
          /* the shown words as the take says them; a board that shows a shorter line than is said
             (the classify screens: "आकृतियों को वर्गीकृत करें।" over the whole sentence) spreads its
             words over the words said, the first with the first, never ahead of the voice */
          const shown = game.state.narrShow || I18N.t(text);
          const shownWords = (shown.match(/\S+/g) || []).length;
          const starts = spokenStartsOf(shown) || Array.from({ length: shownWords },
            (w, i) => entry.spoken[Math.floor(i * entry.spoken.length / Math.max(1, shownWords))].start);
          count = starts.filter(start => start <= audio.currentTime).length;
        } else if (local) {
          const shownWords = ((game.state.narrShow || I18N.t(text)).match(/\S+/g) || []).length;
          count = audibleCount > 0 ? Math.min(shownWords, Math.ceil(audibleCount / Math.max(1, total) * shownWords)) : 0;
          if (game.step().sc === 'S8' && !game.state.reveal && words.slice(0, audibleCount).some(word => normalize(word) === 'polygon')) game.keyword('polygon');
        } else {
          while (page < pages.length - 1 && position >= offset + counts[page]) offset += counts[page++];
          count = wordStarts ? Math.max(0, Math.min(counts[page], spokenCount - offset)) : Math.min(counts[page], Math.floor(position - offset) + 1);
          if (game.step().sc === 'S8' && !game.state.reveal) {
            const visibleWords = (pages[page].match(/\S+/g) || []).slice(0, count);
            if (visibleWords.some(word => normalize(word) === 'polygon')) game.keyword('polygon');
          }
        }
        if (page !== pageIndex) {
          pageIndex = page; revealed = count;
          game.prepareNarratorReveal(pages[page]);
          game.setState({ wordReveal: 'recorded', revealedWords: count });
        } else if (revealed !== count) {
          revealed = count; game.setState({ wordReveal:'recorded', revealedWords: count });
        }
      }
      /* One ending for both the real end of the clip and an early cut. */
      function finish() {
        if (stopped || !current()) return;
        stop();
        if (game.revealChoiceWords) game.revealChoiceWords(text);
        game.setState({ wordReveal: 'complete' }, done);
      }
      function tick() { update(); if (!stopped && current() && !audio.paused) frame = requestAnimationFrame(tick); }
      audio.onplaying = () => {
        if (stopped || !current()) return;
        if (game.storyVoiceStart) game.storyVoiceStart();
        game.setState({ voiceError: '' }); clock(true); cancelAnimationFrame(frame); tick();
      };
      const waiting = () => {
        if (stopped || !current()) return;
        cancelAnimationFrame(frame); clock(false);
        if (game.guide && game.guide.onInstructionPause) game.guide.onInstructionPause();
      };
      audio.onpause = audio.onwaiting = audio.onstalled = waiting;
      audio.ontimeupdate = () => { if (!audio.paused) update(); };
      /* A seek moves the timeline discontinuously, so the anchor has to move with it. */
      audio.onseeked = () => clock(!audio.paused);
      audio.onerror = () => { if (!stopped && current()) { stop(); fail(); } };
      audio.onended = () => {
        if (stopped || !current()) return;
        update(); // Catch the last page/word if the browser throttled frame updates.
        finish();
      };
      // Reserve the first phrase before playback; nothing flashes while loading.
      game.prepareNarratorReveal(pages[0]);
      try { const promise = audio.play(); if (promise) promise.catch(() => { if (!stopped && current()) { stop(); fail(); } }); }
      catch (error) { stop(); fail(); }
    }
  };
})();
