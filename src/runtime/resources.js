/* Pinned runtime dependencies are served with the game, without a CDN round trip. */
window.__resources = Object.assign({}, window.__resources, {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'assets/vendor/react-18.3.1.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'assets/vendor/react-dom-18.3.1.min.js'
});
/* Babel is not bundled: the runtime only needs it for <x-import> of JSX, which
   this game never uses. If that ever changes, the runtime fetches the pinned
   CDN copy with its integrity hash (see BABEL_URL in support.js). */
