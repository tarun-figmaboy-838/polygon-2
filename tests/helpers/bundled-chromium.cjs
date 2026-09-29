// Preload for running the project's checks without Google Chrome installed:
// Playwright's bundled Chromium stands in for channel:'chrome'.
const Module = require('module');
const load = Module._load;
Module._load = function (request, parent, isMain) {
  const mod = load.apply(this, arguments);
  if ((request === 'playwright' || request === 'playwright-core') && mod.chromium && !mod.chromium.__patched) {
    const launch = mod.chromium.launch.bind(mod.chromium);
    mod.chromium.launch = (opts = {}) => { const o = Object.assign({}, opts); delete o.channel; delete o.executablePath; return launch(o); };
    mod.chromium.__patched = true;
  }
  return mod;
};
