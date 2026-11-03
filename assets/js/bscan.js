// Synthetic ultrasonic ToFD B-scan for the hero.
// Horizontal axis: probe position along the weld. Vertical axis: time of flight.
// Everything is computed here from a simple pitch-catch model; there are no image assets.
(function () {
  "use strict";

  const frame = document.querySelector(".scan-frame");
  if (!frame) return;
  const base = frame.querySelector(".scan-base");
  const probe = frame.querySelector(".scan-probe");
  const bctx = base.getContext("2d");
  const pctx = probe.getContext("2d");
  if (!bctx || !pctx) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- physical model (mm, µs, MHz) --------------------------------------
  const C = 5.9;        // longitudinal velocity in steel
  const S = 40;         // half the probe separation
  const THICK = 25;     // plate thickness
  const FREQ = 5;       // probe centre frequency
  const SIGMA = 0.12;   // pulse envelope width
  const LENGTH = 300;   // scanned length of weld
  const T_START = 12.9;
  const T_END = 16.75;

  const tof = (dx, depth) => (2 * Math.sqrt(dx * dx + S * S + depth * depth)) / C;
  const T_LATERAL = tof(0, 0);
  const T_BACKWALL = tof(0, THICK);

  // Flaws: extent along the weld and the depths of their two tips.
  const FLAWS = [
    { x0: 62, x1: 112, top: 9.5, bottom: 14.5 },   // buried crack
    { x0: 168, x1: 168, top: 18.6, bottom: 19.4 }, // pore
    { x0: 214, x1: 250, top: 6.5, bottom: 9.5 },   // lack of fusion near the cap
  ];

  // Seeded RNG so every visitor sees the same weld.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(529585);
  const GRAINS = Array.from({ length: 150 }, () => ({
    x: rand() * LENGTH,
    depth: 1.5 + rand() * (THICK - 3),
    amp: (rand() - 0.5) * 0.24,
  }));

  // Coupling wobble: arrival times drift slightly as the probes move.
  const wobble = (x) =>
    0.028 * Math.sin(x / 19) + 0.017 * Math.sin(x / 6.3 + 1.7) + 0.008 * Math.sin(x / 2.1);

  function addPulse(col, dt, tArr, amp) {
    const n = col.length;
    const j0 = Math.max(0, Math.floor((tArr - 4 * SIGMA - T_START) / dt));
    const j1 = Math.min(n - 1, Math.ceil((tArr + 4 * SIGMA - T_START) / dt));
    const k = 1 / (2 * SIGMA * SIGMA);
    const w = 2 * Math.PI * FREQ;
    for (let j = j0; j <= j1; j++) {
      const tau = T_START + j * dt - tArr;
      col[j] += amp * Math.exp(-tau * tau * k) * Math.sin(w * tau);
    }
  }

  // One A-scan at position x (mm), sampled into n time bins.
  function ascan(x, n) {
    const col = new Float32Array(n);
    const dt = (T_END - T_START) / n;
    const w = wobble(x);
    let shadow = 0;

    for (const f of FLAWS) {
      const dx = x < f.x0 ? f.x0 - x : x > f.x1 ? x - f.x1 : 0;
      const beam = Math.exp(-((dx / 12) ** 2));
      if (beam < 0.01) continue;
      // Upper tip is phase-inverted relative to the lateral wave; lower tip is not.
      addPulse(col, dt, tof(dx, f.top) + w, -0.75 * beam);
      addPulse(col, dt, tof(dx, f.bottom) + w, 0.6 * beam);
      shadow = Math.max(shadow, beam * Math.min(1, (f.x1 - f.x0 + 4) / 30));
    }

    addPulse(col, dt, T_LATERAL + w, 0.9);
    addPulse(col, dt, T_BACKWALL + w, -1.15 * (1 - 0.5 * shadow));

    for (const g of GRAINS) {
      const dx = x - g.x;
      if (dx > 32 || dx < -32) continue;
      addPulse(col, dt, tof(dx, g.depth) + w, g.amp * Math.exp(-((dx / 13) ** 2)));
    }
    return col;
  }

  // ---- rendering ------------------------------------------------------------
  let W = 0, H = 0, dpr = 1, img = null, sweeping = false, probeX = null;

  function hash(i, j) {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = frame.getBoundingClientRect();
    W = Math.max(2, Math.round(r.width * dpr));
    H = Math.max(2, Math.round(r.height * dpr));
    base.width = probe.width = W;
    base.height = probe.height = H;
  }

  function compute() {
    img = bctx.createImageData(W, H);
    const d = img.data;
    for (let i = 0; i < W; i++) {
      const col = ascan((i / (W - 1)) * LENGTH, H);
      for (let j = 0; j < H; j++) {
        let v = col[j] + (hash(i, j) - 0.5) * 0.07;
        v = v > 1 ? 1 : v < -1 ? -1 : v;
        const g = 128 + 118 * v;
        const k = (j * W + i) * 4;
        d[k] = g - 3;
        d[k + 1] = g;
        d[k + 2] = g + 4;
        d[k + 3] = 255;
      }
    }
  }

  function paint(upTo) {
    if (upTo >= W) bctx.putImageData(img, 0, 0);
    else bctx.putImageData(img, 0, 0, 0, 0, Math.max(1, upTo), H);
  }

  function drawProbe(px) {
    pctx.clearRect(0, 0, W, H);
    if (px == null) return;
    px = Math.max(0, Math.min(W - 1, px));
    const col = ascan((px / (W - 1)) * LENGTH, H);
    const amp = Math.min(34 * dpr, W * 0.07);

    pctx.lineJoin = "round";
    pctx.strokeStyle = "rgba(255,255,255,0.35)";
    pctx.lineWidth = dpr;
    pctx.beginPath();
    pctx.moveTo(px + 0.5, 0);
    pctx.lineTo(px + 0.5, H);
    pctx.stroke();

    const trace = () => {
      pctx.beginPath();
      for (let j = 0; j < H; j++) {
        const x = px + col[j] * amp;
        if (j === 0) pctx.moveTo(x, j); else pctx.lineTo(x, j);
      }
      pctx.stroke();
    };
    pctx.strokeStyle = "rgba(10,14,16,0.55)";
    pctx.lineWidth = 3.5 * dpr;
    trace();
    pctx.strokeStyle = getComputedStyle(frame).getPropertyValue("--trace").trim() || "#fde725";
    pctx.lineWidth = 1.5 * dpr;
    trace();
  }

  function sweep() {
    sweeping = true;
    const t0 = performance.now();
    const dur = 1500;
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - (1 - p) * (1 - p);
      const x = Math.round(e * W);
      paint(x);
      pctx.clearRect(0, 0, W, H);
      if (p < 1) {
        pctx.fillStyle = "rgba(253,231,37,0.85)";
        pctx.fillRect(x, 0, Math.max(1, dpr), H);
        requestAnimationFrame(step);
      } else {
        sweeping = false;
        if (probeX != null) drawProbe(probeX);
      }
    }
    requestAnimationFrame(step);
  }

  function build(animate) {
    resize();
    compute();
    if (animate && !reduceMotion) sweep();
    else { paint(W); drawProbe(probeX); }
  }

  // ---- interaction ------------------------------------------------------------
  frame.addEventListener("pointermove", (e) => {
    const r = frame.getBoundingClientRect();
    probeX = Math.round((e.clientX - r.left) * dpr);
    if (!sweeping) drawProbe(probeX);
  });
  frame.addEventListener("pointerleave", () => {
    probeX = null;
    if (!sweeping) drawProbe(null);
  });
  frame.addEventListener("focus", () => {
    if (probeX == null) probeX = Math.round(W * (87 / LENGTH)); // centre of the crack
    if (!sweeping) drawProbe(probeX);
  });
  frame.addEventListener("blur", () => {
    probeX = null;
    if (!sweeping) drawProbe(null);
  });
  frame.addEventListener("keydown", (e) => {
    if (probeX == null) return;
    const step = Math.round(W / 60);
    if (e.key === "ArrowLeft") probeX -= step;
    else if (e.key === "ArrowRight") probeX += step;
    else if (e.key === "Home") probeX = 0;
    else if (e.key === "End") probeX = W - 1;
    else return;
    e.preventDefault();
    probeX = Math.max(0, Math.min(W - 1, probeX));
    if (!sweeping) drawProbe(probeX);
  });

  let lastWidth = 0;
  const ro = new ResizeObserver((entries) => {
    const w = Math.round(entries[0].contentRect.width);
    if (w === lastWidth) return;
    const first = lastWidth === 0;
    lastWidth = w;
    build(first);
  });
  ro.observe(frame);
})();
