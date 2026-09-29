// Injected before any page script: routes every AudioContext's output through
// an analyser so the test can measure what is actually being played.
(() => {
  const meters = [];
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) {
      const ctx = dest.context;
      if (!ctx.__meter) {
        const an = ctx.createAnalyser();
        an.fftSize = 2048;
        orig.call(an, dest);
        ctx.__meter = an;
        meters.push(an);
      }
      return orig.call(this, ctx.__meter, ...rest);
    }
    return orig.call(this, dest, ...rest);
  };
  window.__audioLevel = () => meters.map(an => {
    const d = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(d);
    let sum = 0, peak = 0;
    for (const v of d) { sum += v * v; peak = Math.max(peak, Math.abs(v)); }
    const rms = Math.sqrt(sum / d.length);
    return { state: an.context.state, rmsDb: rms > 0 ? +(20 * Math.log10(rms)).toFixed(1) : -120, peak: +peak.toFixed(3) };
  });
})();
