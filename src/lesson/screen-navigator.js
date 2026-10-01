/* Screen navigation for review: the "Screens" jump menu and the Back / Next buttons
   at the top of the lesson, and the same "Scenes" menu over the story before it
   (src/story/story-intro.js). Learners never see them. They are on the page only with
   ?dev=1 in the address (?dev-1 is taken as the same thing); without it mount() puts
   nothing on the page and returns a no-op, and panel() returns null. */
(function () {
  'use strict';
  const dev = (() => {
    try { const q = new URLSearchParams(window.location.search); return q.get('dev') === '1' || q.has('dev-1'); }
    catch (error) { return false; }
  })();
  const STYLE = `
        :host{--button-label-size:16px;position:absolute;inset:0;z-index:10000;font:14px Nunito,sans-serif;color:#123a6b;pointer-events:none}
        #toggle,#step-navigation,#panel{pointer-events:auto}
        *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}
        button:focus-visible,input:focus-visible{outline:3px solid #31b9de;outline-offset:3px}
        #toggle{position:absolute;top:12px;left:12px;border:2px solid #fff4cb;border-radius:999px;padding:10px 16px;color:#67400e;background:linear-gradient(180deg,#ffe99d 0%,#ffc252 100%);box-shadow:inset 0 2px 0 #fff8d9,0 3px 0 #b77622,0 5px 10px #123a6b26;font-weight:750;min-height:44px;transition:filter .15s,transform .15s}
        #toggle:hover{filter:brightness(1.04)}#toggle:active{transform:translateY(2px)}
        #step-navigation{position:absolute;top:12px;right:12px;display:flex;gap:10px}
        #step-navigation button{min-width:80px;min-height:44px;padding:8px 12px;font-size:16px}
        #panel{position:absolute;top:76px;left:12px;width:330px;padding:14px;background:#f4fbff;border:2px solid #83d6f5;border-radius:18px;box-shadow:0 8px 28px #123a6b33}
        [hidden]{display:none!important}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        #close{font-size:16px;min-width:72px;height:44px;padding:0 10px;flex-shrink:0}
        input{width:100%;padding:10px;border:2px solid #a3d7ed;border-radius:10px;background:white;color:#123a6b;caret-color:#123a6b;user-select:text}
        #list{display:grid;gap:6px;max-height:440px;overflow:auto;margin-top:10px;overscroll-behavior:contain}
        #list button{flex-direction:column;text-align:center;padding:10px;min-height:44px;white-space:normal}
        #list{padding:5px 5px 9px}
        small{display:block;opacity:1;margin-top:4px;font-weight:650;line-height:1.35}#empty{padding:12px;text-align:center}
      `;

  /* One navigator: a menu that lists the items and jumps to one, and Back / Next.
     `nav` says what it navigates:
       items()   [{ label, detail }]           current()  the index on screen
       go(i)     show item i                   ready()    whether it can navigate yet
       word, title, name, list, steps, close,  its words
       search, searchLabel
     Returns { host, sync, dispose }: put host on the page, call sync() when the item
     on screen changes (the buttons and the menu follow). */
  function panel(nav) {
    const host = document.createElement('div');
    host.id = nav.id || 'polygon-screen-navigator';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<link rel="stylesheet" href="${new URL('styles/buttons.css', document.baseURI).href}"><style>${STYLE}</style>
      <button class="ice-button" id="toggle" aria-expanded="false" aria-controls="panel">${nav.word}</button>
      <nav id="step-navigation" aria-label="${nav.steps}">
        <button class="ice-button" id="back" type="button" disabled>Back</button>
        <button class="ice-button" id="next" type="button" disabled>Next</button>
      </nav>
      <section id="panel" aria-label="${nav.name}" hidden>
        <header><strong>${nav.title}</strong><button class="ice-button" id="close" aria-label="${nav.close}">Close</button></header>
        <input id="search" type="search" placeholder="${nav.search}" aria-label="${nav.searchLabel}">
        <nav id="list" aria-label="${nav.list}"></nav><div id="empty" hidden>No matching ${nav.word.toLowerCase()}</div>
      </section>`;
    const $ = id => root.getElementById(id);
    const toggle = $('toggle'), sheet = $('panel'), search = $('search'), list = $('list');
    function close() { sheet.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
    function render() {
      if (!nav.ready()) return;
      const query = search.value.trim().toLowerCase();
      list.replaceChildren();
      nav.items().forEach((item, index) => {
        if (query && !`${index + 1} ${item.label} ${item.detail}`.toLowerCase().includes(query)) return;
        const button = document.createElement('button');
        button.className = 'ice-button';
        button.textContent = `${index + 1}. ${item.label}`;
        button.setAttribute('aria-current', String(index === nav.current()));
        const description = document.createElement('small');
        description.textContent = item.detail;
        button.append(description);
        button.onclick = () => { nav.go(index); close(); };
        list.append(button);
      });
      $('empty').hidden = list.childElementCount > 0;
    }
    let last = -1;
    function sync() {
      // Nothing is asked of the content until it is ready: the lesson has no steps before boot().
      const ready = nav.ready(), k = nav.current(), n = ready ? nav.items().length : 0;
      $('back').disabled = !ready || k <= 0;
      $('next').disabled = !ready || k >= n - 1;
      if (k === last) return;
      last = k;
      toggle.textContent = `${nav.word} · ${k + 1}`;
      if (!sheet.hidden) render();
    }
    toggle.onclick = () => {
      if (!sheet.hidden) { close(); return; }
      sheet.hidden = false; toggle.setAttribute('aria-expanded', 'true'); render(); search.focus();
    };
    $('close').onclick = close;
    $('back').onclick = () => nav.go(nav.current() - 1);
    $('next').onclick = () => nav.go(nav.current() + 1);
    search.oninput = render;
    root.addEventListener('keydown', event => { if (event.key === 'Escape') close(); event.stopPropagation(); });
    return { host, sync, dispose() { host.remove(); } };
  }

  window.PolygonScreenNavigator = {
    enabled: dev,
    panel(nav) { return dev ? panel(nav) : null; },
    mount(game) {
      if (!dev) return () => {};
      let disposed = false;
      const nav = panel({
        word: 'Screens', title: 'Jump to a screen', name: 'Lesson screen navigator', list: 'Lesson screens',
        steps: 'Screen navigation', close: 'Close screen navigator', search: 'Search name or step number', searchLabel: 'Search screens',
        items: () => game.steps().map(step => ({ label: step.label, detail: step.narr })),
        current: () => game.state.k,
        ready: () => !!game.state.ready,
        go: navigate
      });
      function navigate(index) {
        if (disposed || !game.state.ready || index < 0 || index >= game.steps().length) return;
        const step = game.steps()[index];
        game.unlockAudio();
        // runStep cancels narration, timers, drawing and active drags.
        // Clear answers that normally persist between adjacent lesson phases.
        game.setState({ k: index, placed: {}, sortAt: {}, dd: [null, null, null, null],
          ddWrong: [false, false, false, false], userPts: null, dragged: false,
          drawn: step.sc === 'S1' && !['point', 'draw'].includes(step.ph), numsB: 0 }, () => {
          if (!disposed) { game.runStep(index, false); sync(); }
        });
      }
      function sync() {
        if (disposed) return;
        // The lesson renderer can replace this container between screens.
        // Reattach the existing controls so their styling and handlers persist.
        const container = game.navigationRef.current;
        if (container && nav.host.parentElement !== container) container.append(nav.host);
        nav.sync();
      }
      // The first render may not have created the navigation container yet.
      sync();
      const observer = new MutationObserver(sync);
      observer.observe(document.body, { childList:true, subtree:true });
      const timer = setInterval(sync, 300);
      return () => { disposed = true; observer.disconnect(); clearInterval(timer); nav.dispose(); };
    }
  };
})();
