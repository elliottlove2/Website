/*!
 * <pin-spin-cat>: a cat in a hall of mirrors
 *
 * An interactive picture of the two double covers
 *
 *        Pin(2) ──2:1──▶ O(2)            Spin(2) ──2:1──▶ SO(2)
 *
 * built from the single fact that makes them work: a mirror is a line, but the
 * vector that names it (its unit normal u) carries a sign the mirror cannot
 * see. Multiply the normals and keep the sign, and you get Pin. Keep an even
 * number of them, and you get Spin.
 *
 * Usage
 *   <script src="pin-spin-cat.js" defer></script>
 *   <pin-spin-cat></pin-spin-cat>
 *
 * Attributes (all optional)
 *   modes      tabs to show, comma-separated: "mirrors,spin,kaleido" (default: all)
 *   mode       the tab that opens first
 *   mirrors    starting mirror normals in degrees, e.g. "90,150" ("none" for none)
 *   k          kaleidoscope order, 2 to 8 (mirrors at 180°/k)
 *   autoplay   start the spin animation when the widget scrolls into view
 *   cat-src    URL of your own cat picture (pick an asymmetric one!)
 *   theme      "light", "dark" or "auto" (default: follow the reader's system)
 *
 * Styling: override any --psc-* custom property on the element.
 * Console: customElements.get("pin-spin-cat").algebra is the Clifford algebra.
 * No dependencies. MIT licence.
 */
(() => {
  "use strict";

  // ─── 1. The Clifford algebra of the plane ─────────────────────────────────
  //
  // A multivector is  s + x e₁ + y e₂ + b e₁₂,  multiplied by the rules
  //
  //       e₁² = e₂² = 1,      e₁e₂ = −e₂e₁ = e₁₂,      so  e₁₂² = −1.
  //
  // Products of unit vectors form Pin(2); products of an even number, Spin(2).

  const mv = (s = 0, x = 0, y = 0, b = 0) => ({ s, x, y, b });
  const ONE = mv(1);
  const unit = (angle) => mv(0, Math.cos(angle), Math.sin(angle));

  const mul = (p, q) =>
    mv(
      p.s * q.s + p.x * q.x + p.y * q.y - p.b * q.b,
      p.s * q.x + p.x * q.s - p.y * q.b + p.b * q.y,
      p.s * q.y + p.y * q.s + p.x * q.b - p.b * q.x,
      p.s * q.b + p.b * q.s + p.x * q.y - p.y * q.x,
    );
  const neg = (p) => mv(-p.s, -p.x, -p.y, -p.b);
  const reverse = (p) => mv(p.s, p.x, p.y, -p.b); // e₁₂ read backwards is e₂e₁ = −e₁₂
  const isOdd = (p) => p.x * p.x + p.y * p.y > p.s * p.s + p.b * p.b;

  // A Pin element moves vectors by the twisted adjoint action  v ↦ ±g v g⁻¹,
  // with − for odd g. For one unit vector u that is  −u v u:  the reflection
  // across the line perpendicular to u. (For unit g, the inverse is the reverse.)
  function act(g, [vx, vy]) {
    const w = mul(mul(g, mv(0, vx, vy)), reverse(g));
    return isOdd(g) ? [-w.x, -w.y] : [w.x, w.y];
  }

  // The same map as the four numbers a canvas transform wants:
  // where e₁ lands, then where e₂ lands.
  const matrixOf = (g) => [...act(g, [1, 0]), ...act(g, [0, 1])];

  // And back to geometry:
  //   even   g = cos(θ/2) − sin(θ/2) e₁₂    is the rotation by θ
  //   odd    g = n, a unit vector            is the reflection across the line ⟂ n
  function describe(g) {
    if (!isOdd(g)) {
      const half = Math.atan2(-g.b, g.s);
      return { odd: false, half, angle: 2 * half };
    }
    const normal = Math.atan2(g.y, g.x);
    return { odd: true, normal, line: normal + Math.PI / 2 };
  }

  // ─── 2. Small helpers ─────────────────────────────────────────────────────

  const TAU = 2 * Math.PI;
  const toDeg = (r) => (r * 180) / Math.PI;
  const toRad = (d) => (d * Math.PI) / 180;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mod = (v, m) => ((v % m) + m) % m;
  const wrapPi = (a) => mod(a + Math.PI, TAU) - Math.PI; // into [−π, π)
  const turn = (a) => Math.PI - mod(Math.PI - a, TAU); // into (−π, π], for reporting
  const last = (list) => list[list.length - 1];
  const ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

  const MINUS = "\u2212";
  const signed = (v, text) => (v < 0 ? MINUS : "") + text;
  const sub = (n) => String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[d]);
  const degrees = (rad) => {
    const d = Math.round(toDeg(rad));
    return signed(d, `${Math.abs(d)}°`);
  };

  // "0.50 − 0.87 e₁₂", "0.26 e₁ + 0.97 e₂", and so on.
  function formatMv(g) {
    const terms = [[g.s, ""], [g.x, "e₁"], [g.y, "e₂"], [g.b, "e₁₂"]].filter(
      ([c]) => Math.abs(c) >= 0.005,
    );
    if (!terms.length) return "0";
    return terms
      .map(([c, e], i) => {
        const body = Math.abs(c).toFixed(2) + (e && "\u2009" + e);
        return i === 0 ? signed(c, body) : (c < 0 ? ` ${MINUS} ` : " + ") + body;
      })
      .join("");
  }

  // ─── 3. The cat ───────────────────────────────────────────────────────────
  //
  // Drawn in its own y-up frame, about one unit tall, facing right. It has to
  // be chiral (no mirror symmetry) or reflections would be invisible, and a
  // sitting cat in profile with its tail curled behind is about as chiral as
  // cats get. `px` is one screen pixel in these units, for line widths.

  const CAT = { w: 1.14, h: 1.03, cx: -0.03, cy: 0.515 }; // bounding box and its centre
  const BELL = { x: 0.16, y: 0 }; // the collar bell, measured from the centre

  function drawVectorCat(ctx, px, c, collar) {
    const line = 1.5 * px;
    const shape = (build) => {
      ctx.beginPath();
      build();
    };
    const fill = (color) => {
      ctx.fillStyle = color;
      ctx.fill();
    };
    const stroke = (width, color = c.catInk) => {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    };

    ctx.save();
    ctx.translate(-CAT.cx, -CAT.cy);
    ctx.lineCap = ctx.lineJoin = "round";

    // Tail: an outlined tube, drawn first so the body tucks over its root.
    shape(() => {
      ctx.moveTo(-0.2, 0.05);
      ctx.bezierCurveTo(-0.46, 0, -0.62, 0.18, -0.52, 0.38);
      ctx.bezierCurveTo(-0.47, 0.48, -0.37, 0.5, -0.37, 0.42);
    });
    stroke(0.075 + 2 * line);
    stroke(0.075, c.fur);
    shape(() => {
      ctx.moveTo(-0.408, 0.469);
      ctx.quadraticCurveTo(-0.37, 0.485, -0.37, 0.42);
    });
    stroke(0.075, c.furDark);

    // Body, stripes, haunch, front leg, paws.
    shape(() => {
      ctx.moveTo(-0.25, 0.03);
      ctx.bezierCurveTo(-0.33, 0.22, -0.26, 0.5, -0.02, 0.585);
      ctx.bezierCurveTo(0.08, 0.62, 0.2, 0.58, 0.235, 0.44);
      ctx.bezierCurveTo(0.26, 0.32, 0.25, 0.15, 0.22, 0.03);
      ctx.closePath();
    });
    fill(c.fur);
    stroke(line);
    shape(() => {
      for (const [x0, y0, qx, qy, x1, y1] of [
        [-0.285, 0.2, -0.2, 0.23, -0.15, 0.18],
        [-0.26, 0.36, -0.16, 0.39, -0.11, 0.33],
        [-0.16, 0.5, -0.08, 0.51, -0.05, 0.46],
      ]) {
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(qx, qy, x1, y1);
      }
    });
    stroke(0.03, c.furDark);
    shape(() => ctx.ellipse(-0.07, 0.16, 0.16, 0.13, 0, 0.15 * Math.PI, 0.95 * Math.PI));
    stroke(line);
    shape(() => {
      ctx.moveTo(0.1, 0.045);
      ctx.quadraticCurveTo(0.085, 0.2, 0.115, 0.34);
    });
    stroke(line);
    for (const [x, y] of [[-0.02, 0.03], [0.165, 0.03]]) {
      shape(() => ctx.ellipse(x, y, 0.075, 0.032, 0, 0, TAU));
      fill(c.fur);
      stroke(line);
    }

    // Head: far ear, head, near ear.
    shape(() => {
      ctx.moveTo(0.06, 0.85);
      ctx.lineTo(0.095, 1.005);
      ctx.lineTo(0.17, 0.893);
      ctx.closePath();
    });
    fill(c.furDark);
    stroke(line);
    shape(() => {
      ctx.moveTo(0.02, 0.66);
      ctx.bezierCurveTo(0, 0.8, 0.08, 0.895, 0.19, 0.895);
      ctx.bezierCurveTo(0.29, 0.895, 0.35, 0.83, 0.365, 0.74);
      ctx.bezierCurveTo(0.395, 0.72, 0.4, 0.68, 0.375, 0.665);
      ctx.bezierCurveTo(0.35, 0.58, 0.24, 0.535, 0.14, 0.55);
      ctx.bezierCurveTo(0.07, 0.56, 0.03, 0.6, 0.02, 0.66);
      ctx.closePath();
    });
    fill(c.fur);
    stroke(line);
    shape(() => {
      ctx.moveTo(0.215, 0.885);
      ctx.lineTo(0.3, 1.03);
      ctx.lineTo(0.335, 0.835);
      ctx.closePath();
    });
    fill(c.fur);
    stroke(line);
    shape(() => {
      ctx.moveTo(0.238, 0.878);
      ctx.lineTo(0.296, 0.982);
      ctx.lineTo(0.318, 0.848);
      ctx.closePath();
    });
    fill(c.pink);
    shape(() => {
      ctx.moveTo(0.15, 0.885);
      ctx.lineTo(0.155, 0.82);
      ctx.moveTo(0.195, 0.893);
      ctx.lineTo(0.192, 0.83);
    });
    stroke(0.022, c.furDark);

    // Face.
    shape(() => ctx.ellipse(0.265, 0.76, 0.026, 0.034, 0, 0, TAU));
    fill(c.catInk);
    shape(() => ctx.arc(0.273, 0.772, 0.009, 0, TAU));
    fill("#fff");
    shape(() => {
      ctx.moveTo(0.36, 0.697);
      ctx.lineTo(0.388, 0.706);
      ctx.lineTo(0.383, 0.68);
      ctx.closePath();
    });
    fill(c.pink);
    shape(() => {
      ctx.moveTo(0.372, 0.668);
      ctx.quadraticCurveTo(0.355, 0.64, 0.33, 0.655);
    });
    stroke(line * 0.8);
    shape(() => {
      for (const [x0, y0, x1, y1] of [
        [0.33, 0.66, 0.53, 0.7],
        [0.335, 0.65, 0.54, 0.64],
        [0.33, 0.64, 0.51, 0.585],
      ]) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
    });
    stroke(line * 0.6);

    // Collar and bell. The collar's colour says whether this cat is an even
    // (rotated) or an odd (reflected) image of the original.
    shape(() => {
      ctx.moveTo(0, 0.595);
      ctx.quadraticCurveTo(0.1, 0.535, 0.205, 0.525);
    });
    stroke(0.042, collar);
    shape(() => ctx.arc(0.13, 0.515, 0.03, 0, TAU));
    fill(c.bell);
    stroke(line * 0.8);

    ctx.restore();
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Your own cat picture, fitted into the same box. The frame takes over the
  // collar's job of showing even versus odd.
  function drawPhotoCat(ctx, img, px, collar) {
    const s = Math.min(CAT.w / img.naturalWidth, CAT.h / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.save();
    ctx.scale(1, -1); // images are y-down, this frame is y-up
    roundedRect(ctx, -w / 2, -h / 2, w, h, 0.06);
    ctx.save();
    ctx.clip();
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.lineWidth = 3 * px;
    ctx.strokeStyle = collar;
    ctx.stroke();
    ctx.restore();
  }

  // ─── 4. Settings, looks and markup ────────────────────────────────────────

  const FILL = 0.92; // stage radius, as a fraction of half the canvas
  const CAT_SIZE = 0.27; // cat height, in stage radii
  const ARROW = 0.36; // length of a mirror's normal arrow
  const BALL = 0.075; // the ball of yarn at the hinge
  const HOME = { x: 0.52 * Math.cos(0.35), y: 0.52 * Math.sin(0.35) }; // where the cat sits
  const MAX_MIRRORS = 5;
  const SPIN_MAX = 1440; // four full turns, in degrees
  const SPIN_SPEED = 90; // degrees per second
  const FLIP_MS = 320;
  const PULSE_MS = 650;

  const MODES = {
    mirrors: {
      tab: "Mirrors",
      sub: "Pin(2) → O(2)",
      hint:
        "The light grey cat is the starting point. " +
        "Drag an arrow to turn its mirror. Tap an arrow to flip its normal: same mirror, " +
        "same cat, opposite sign in the upper diagram. Drag any cat to move it.",
    },
    spin: {
      tab: "Spin",
      sub: "the 720° trick",
      hint:
        "The light grey cat is the starting point. " +
        "Drag the cat around the ball of yarn, or press play. " +
        "The second mirror always sits at half the angle.",
    },
    kaleido: {
      tab: "Kaleidoscope",
      sub: "two signs per cat",
      hint:
        "Two mirrors at 180°/k, as in a real kaleidoscope. Drag the cat, " +
        "and point at any cat to light up its two sign choices.",
    },
  };

  // Fixed, trusted definitions for the labels used by each view.
  const SYMBOLS = {
    common: [
      ["O(2)", "Rotations and reflections in 2 dimensions"],
      ["SO(2)", "Just the rotations, which are composed of an even number of reflections"],
      ["Pin(2)", "The combined mirror steps, keeping track of the signs of the arrows"],
      ["Spin(2)", "The even / rotation part of Pin(2)"],
    ],
    mirrors: [],
    spin: [],
    kaleido: [],
  };
  const SYMBOL_KEYS = Object.fromEntries(
    Object.keys(MODES).map((mode) => [
      mode,
      [...SYMBOLS.common, ...SYMBOLS[mode]]
        .map(([symbol, meaning]) => `<div><dt>${symbol}</dt><dd>${meaning}</dd></div>`)
        .join(""),
    ]),
  );

  const LIGHT = `
    --psc-paper: #f6f8fa;  --psc-stage: #e9eef2;  --psc-ink: #1b2533;  --psc-muted: #5d6978;
    --psc-line: rgba(27, 37, 51, 0.16);  --psc-faint: rgba(27, 37, 51, 0.07);
    --psc-glass: #6f9cc0;  --psc-arrow: #2e4a6c;  --psc-even: #1b8478;  --psc-odd: #c0437c;
    --psc-yarn: #5b6bd6;   --psc-fur: #ee9f4f;    --psc-fur-dark: #c2692a;
    --psc-cat-ink: #43291a; --psc-pink: #f2a2a4;  --psc-bell: #e8b830;`;

  const DARK = `
    --psc-paper: #151a21;  --psc-stage: #1c232c;  --psc-ink: #e7ecf1;  --psc-muted: #9aa6b4;
    --psc-line: rgba(231, 236, 241, 0.16);  --psc-faint: rgba(231, 236, 241, 0.07);
    --psc-glass: #8db8da;  --psc-arrow: #b9cce3;  --psc-even: #3cc2b2;  --psc-odd: #f071ac;
    --psc-yarn: #8d9bff;   --psc-cat-ink: #2a1a10;`;

  const STYLE = `
    :host {
      ${LIGHT}
      --psc-radius: 18px;
      --psc-math-font: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua",
        "STIX Two Text", Georgia, serif;
      display: block;
      color: var(--psc-ink);
      line-height: 1.5;
    }
    :host([theme="dark"]) { ${DARK} }
    @media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { ${DARK} } }

    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    :focus-visible { outline: 2px solid var(--psc-glass); outline-offset: 2px; }

    .psc {
      display: grid; gap: 12px; padding: clamp(10px, 2.4vw, 16px);
      background: var(--psc-paper); border: 1px solid var(--psc-line);
      border-radius: var(--psc-radius);
    }
    .tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .tab {
      font: inherit; font-size: 0.88em; padding: 6px 13px; cursor: pointer;
      color: var(--psc-ink); background: transparent;
      border: 1px solid var(--psc-line); border-radius: 999px;
    }
    .tab small { margin-left: 7px; font-size: 0.9em; color: var(--psc-muted); }
    .tab[aria-selected="true"] { background: var(--psc-ink); border-color: var(--psc-ink); color: var(--psc-paper); }
    .tab[aria-selected="true"] small { color: inherit; opacity: 0.72; }

    .body { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
    .wide .body { grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); align-items: start; }
    .stage-wrap { width: 100%; max-width: 560px; justify-self: center; }
    .wide .stage-wrap { max-width: none; }
    canvas { display: block; width: 100%; }
    .stage {
      aspect-ratio: 1 / 1; height: auto; background: var(--psc-stage);
      border-radius: 14px; touch-action: pan-y pinch-zoom;
    }
    .side { display: grid; gap: 10px; align-content: start; min-width: 0; }
    .groups { background: var(--psc-stage); border-radius: 12px; }

    .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.8em; color: var(--psc-muted); }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .legend em { font-family: var(--psc-math-font); }
    .sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .sw.even { background: var(--psc-even); }
    .sw.odd { background: var(--psc-odd); }
    .sw.dot { background: var(--psc-muted); }
    .sw.ring { border: 2px solid var(--psc-muted); }

    .readout { font-size: 0.94em; min-height: 7.5em; }
    .readout p { margin: 0 0 0.5em; }
    .readout .eq { font-family: var(--psc-math-font); font-size: 1.06em; }
    .readout i { font-family: var(--psc-math-font); }
    .readout b { font-weight: 600; }
    .aside { color: var(--psc-muted); font-size: 0.93em; }
    .hint { margin: 0; font-size: 0.84em; color: var(--psc-muted); }

    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .btn {
      font: inherit; font-size: 0.88em; line-height: 1.2; padding: 7px 12px; cursor: pointer;
      color: var(--psc-ink); background: var(--psc-paper);
      border: 1px solid var(--psc-line); border-radius: 10px;
      transition: border-color 0.15s;
    }
    .btn:hover:not(:disabled) { border-color: var(--psc-muted); }
    .btn:disabled { opacity: 0.45; cursor: default; }
    .btn.primary { min-width: 5.4em; color: var(--psc-paper); background: var(--psc-ink); border-color: var(--psc-ink); }
    .btn.quiet { border-color: transparent; color: var(--psc-muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      font-family: var(--psc-math-font); font-size: 0.95em; padding: 5px 11px; cursor: pointer;
      color: var(--psc-ink); border: 1.5px solid var(--psc-arrow); border-radius: 999px;
      background: transparent;
      background: color-mix(in srgb, var(--psc-arrow) 10%, transparent);
    }
    .chip span { margin-left: 6px; font-variant-numeric: tabular-nums; color: var(--psc-muted); }
    .check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.88em; color: var(--psc-muted); cursor: pointer; }
    .check input { accent-color: var(--psc-even); }
    input[type="range"] { flex: 1 1 200px; min-width: 150px; accent-color: var(--psc-even); }
    output { min-width: 6.5em; font-family: var(--psc-math-font); font-variant-numeric: tabular-nums; }
    .presets { display: inline-flex; gap: 6px; }
    .lab { font-size: 0.88em; color: var(--psc-muted); }
    .symbol-key {
      border-top: 1px solid var(--psc-line); padding-top: 10px;
      font-size: max(14px, 0.9em); line-height: 1.5;
    }
    .symbol-key summary { cursor: pointer; font-weight: 600; padding: 3px 0; }
    .symbol-key dl { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px 24px; margin: 16px 0 2px; }
    .wide .symbol-key dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .symbol-key dl > div { min-width: 0; }
    .symbol-key dt { font-weight: 600; }
    .symbol-key dd { margin: 3px 0 0; color: var(--psc-muted); }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `;

  const TEMPLATE = `
    <div class="psc" part="container">
      <div class="tabs" role="tablist" aria-label="Views"></div>
      <div class="body">
        <div class="stage-wrap"><canvas class="stage" role="img"></canvas></div>
        <div class="side">
          <canvas class="groups" aria-hidden="true"></canvas>
          <div class="legend" aria-hidden="true">
            <span><i class="sw even"></i>even</span>
            <span><i class="sw odd"></i>odd</span>
            <span><i class="sw dot"></i><em>g</em></span>
            <span><i class="sw ring"></i><em>−g</em></span>
            <span>curves: two choices, one move</span>
          </div>
          <div class="readout"></div>
        </div>
      </div>
      <p class="hint"></p>
      <div class="controls" data-for="mirrors">
        <div class="chips" title="Press to flip a normal; arrow keys turn the mirror"></div>
        <button class="btn" data-act="add">Add mirror</button>
        <button class="btn" data-act="remove">Remove mirror</button>
        <label class="check"><input type="checkbox" data-act="steps" checked> Show each bounce</label>
        <button class="btn quiet" data-act="reset">Reset</button>
      </div>
      <div class="controls" data-for="spin" hidden>
        <button class="btn primary" data-act="play" aria-pressed="false">Play</button>
        <input type="range" min="0" max="${SPIN_MAX}" step="1" value="0" data-act="theta"
          aria-label="Rotation angle θ in degrees">
        <output data-out="theta"></output>
        <span class="presets">
          <button class="btn" data-go="0">0°</button>
          <button class="btn" data-go="360">360°</button>
          <button class="btn" data-go="720">720°</button>
        </span>
      </div>
      <div class="controls" data-for="kaleido" hidden>
        <span class="lab">Mirror angle</span>
        <input type="range" min="2" max="8" step="1" value="4" data-act="k" aria-label="Kaleidoscope order k">
        <output data-out="k"></output>
      </div>
      <details class="symbol-key">
        <summary>What the symbols mean</summary>
        <dl></dl>
      </details>
      <div class="sr" aria-live="polite"></div>
    </div>`;

  // ─── 5. The element ───────────────────────────────────────────────────────

  class PinSpinCat extends HTMLElement {
    static observedAttributes = ["theme", "cat-src"];
    static algebra = { mv, unit, mul, neg, reverse, act, matrixOf, describe };

    #el = {}; // handles into the shadow DOM
    #colors = null; // palette, read from the --psc-* properties
    #modes = Object.keys(MODES);
    #mode = "mirrors";

    #initial = []; // mirror normals to reset to
    #mirrors = []; // { angle, flipAt }; angle is the direction of the unit normal
    #cat = { ...HOME }; // the real cat in the mirrors view
    #kcat = null; // the real cat in the kaleidoscope, re-centred when k changes
    #k = 4;
    #steps = true;

    #theta = 0; // spin view: the total turn in degrees, still counting past 360
    #playing = false;
    #dir = 1;
    #tween = null;
    #autoplay = false;
    #touched = false; // once the reader takes over, autoplay stands down

    #hover = null; // kaleidoscope: the cat that is lit up
    #drag = null;
    #pulses = [];
    #hits = []; // every cat drawn this frame, for hit-testing
    #img = null;

    #dpr = 1;
    #S = 0; // stage size, CSS px
    #W = 0; // group panel size
    #H = 0;
    #raf = 0;
    #last = 0;
    #visible = true;
    #html = "";
    #observers = [];

    // ── lifecycle ──

    connectedCallback() {
      if (!this.shadowRoot) this.#build();
      this.#configure();
      const resize = new ResizeObserver(() => this.#resize());
      const view = new IntersectionObserver(([entry]) => {
        this.#visible = entry.isIntersecting;
        if (this.#visible) this.#maybeAutoplay();
        this.#invalidate();
      });
      // Blogs with a dark-mode switch usually flip a class on <html>: re-read colours then.
      const page = new MutationObserver(() => this.#restyle());
      const scheme = matchMedia("(prefers-color-scheme: dark)");
      const onScheme = () => this.#restyle();
      resize.observe(this);
      view.observe(this);
      page.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      });
      scheme.addEventListener("change", onScheme);
      this.#observers = [
        resize,
        view,
        page,
        { disconnect: () => scheme.removeEventListener("change", onScheme) },
      ];
      this.#resize();
    }

    disconnectedCallback() {
      for (const o of this.#observers) o.disconnect();
      this.#observers = [];
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
    }

    attributeChangedCallback(name, _old, value) {
      if (name === "theme") this.#restyle();
      if (name === "cat-src") this.#loadImage(value);
    }

    #build() {
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${STYLE}</style>${TEMPLATE}`;
      const $ = (selector) => root.querySelector(selector);
      this.#el = {
        root: $(".psc"),
        tabs: $(".tabs"),
        wrap: $(".stage-wrap"),
        stage: $(".stage"),
        side: $(".side"),
        groups: $(".groups"),
        readout: $(".readout"),
        hint: $(".hint"),
        symbols: $(".symbol-key dl"),
        chips: $(".chips"),
        add: $('[data-act="add"]'),
        remove: $('[data-act="remove"]'),
        steps: $('[data-act="steps"]'),
        play: $('[data-act="play"]'),
        theta: $('[data-act="theta"]'),
        thetaOut: $('[data-out="theta"]'),
        k: $('[data-act="k"]'),
        kOut: $('[data-out="k"]'),
        live: $(".sr"),
        panels: [...root.querySelectorAll(".controls")],
      };
      this.#wire(root);
    }

    #wire(root) {
      const { tabs, stage, chips, steps, theta, k } = this.#el;

      tabs.addEventListener("click", (e) => {
        const tab = e.target.closest("[data-mode]");
        if (tab) this.#setMode(tab.dataset.mode);
      });
      tabs.addEventListener("keydown", (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        const next = this.#modes[mod(this.#modes.indexOf(this.#mode) + step, this.#modes.length)];
        this.#setMode(next);
        tabs.querySelector(`[data-mode="${next}"]`)?.focus();
      });

      root.addEventListener("click", (e) => {
        const act = e.target.closest("[data-act]")?.dataset.act;
        const go = e.target.closest("[data-go]")?.dataset.go;
        if (go !== undefined) this.#spinTo(Number(go));
        if (act === "add") this.#addMirror();
        if (act === "remove") this.#removeMirror();
        if (act === "reset") this.#reset();
        if (act === "play") {
          this.#touched = true;
          this.#setPlaying(!this.#playing);
        }
      });

      chips.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-i]");
        if (chip) this.#flip(Number(chip.dataset.i));
      });
      chips.addEventListener("keydown", (e) => {
        const chip = e.target.closest("[data-i]");
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (!chip || !step) return;
        e.preventDefault();
        const m = this.#mirrors[Number(chip.dataset.i)];
        m.angle = mod(m.angle + toRad(step * (e.shiftKey ? 15 : 5)), TAU);
        this.#invalidate();
      });

      steps.addEventListener("change", () => {
        this.#steps = steps.checked;
        this.#invalidate();
      });
      theta.addEventListener("input", () => {
        this.#touched = true;
        this.#tween = null;
        this.#setPlaying(false);
        this.#theta = Number(theta.value);
        this.#invalidate();
      });
      k.addEventListener("input", () => {
        this.#k = Number(k.value);
        this.#kcat = null;
        this.#hover = null;
        this.#announce(`Mirrors at ${+(180 / this.#k).toFixed(1)} degrees: ${2 * this.#k} cats, ${4 * this.#k} lifts.`);
        this.#invalidate();
      });

      stage.addEventListener("pointerdown", (e) => this.#onDown(e));
      stage.addEventListener("pointermove", (e) => this.#onMove(e));
      stage.addEventListener("pointerup", (e) => this.#onUp(e));
      stage.addEventListener("pointercancel", () => (this.#drag = null));
      stage.addEventListener("pointerleave", () => {
        if (this.#drag || !this.#hover || matchMedia("(hover: none)").matches) return;
        this.#hover = null;
        this.#invalidate();
      });
      // On touch screens, claim the gesture only when it starts on something
      // draggable, so readers can still scroll the page past the widget.
      stage.addEventListener(
        "touchstart",
        (e) => {
          const t = e.touches[0];
          if (t && this.#grabbable(this.#toWorld(t))) e.preventDefault();
        },
        { passive: false },
      );
    }

    #configure() {
      const listed = (this.getAttribute("modes") || "").split(",").map((m) => m.trim());
      const modes = listed.filter((m) => m in MODES);
      this.#modes = modes.length ? modes : Object.keys(MODES);
      const normals = (this.getAttribute("mirrors") || "90,150").split(",").map(Number);
      this.#initial = normals.filter(Number.isFinite).slice(0, MAX_MIRRORS).map(toRad);
      this.#mirrors = this.#initial.map((angle) => ({ angle, flipAt: -Infinity }));
      this.#k = clamp(Math.round(Number(this.getAttribute("k")) || 4), 2, 8);
      this.#autoplay = this.hasAttribute("autoplay");
      this.#cat = { ...HOME };
      this.#kcat = null;
      this.#theta = 0;
      this.#touched = false;
      this.#el.tabs.hidden = this.#modes.length < 2;
      this.#el.tabs.innerHTML = this.#modes
        .map(
          (m) =>
            `<button class="tab" role="tab" data-mode="${m}" aria-selected="false">` +
            `${MODES[m].tab}<small>${MODES[m].sub}</small></button>`,
        )
        .join("");
      const start = this.getAttribute("mode");
      this.#setMode(this.#modes.includes(start) ? start : this.#modes[0], true);
    }

    // ── what the reader can do ──

    #setMode(mode, quiet = false) {
      this.#mode = mode;
      this.#drag = this.#hover = this.#tween = null;
      for (const tab of this.#el.tabs.children) {
        tab.setAttribute("aria-selected", String(tab.dataset.mode === mode));
      }
      for (const panel of this.#el.panels) panel.hidden = panel.dataset.for !== mode;
      this.#el.hint.textContent = MODES[mode].hint;
      this.#el.symbols.innerHTML = SYMBOL_KEYS[mode];
      if (mode === "spin") this.#maybeAutoplay();
      else this.#setPlaying(false);
      if (!quiet) this.#announce(`${MODES[mode].tab} view.`);
      this.#invalidate();
    }

    #maybeAutoplay() {
      const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (this.#autoplay && !this.#touched && !calm && this.#mode === "spin" && !this.#playing) {
        this.#setPlaying(true);
      }
    }

    #setPlaying(on) {
      this.#playing = on;
      if (on) this.#tween = null;
      this.#el.play.textContent = on ? "Pause" : "Play";
      this.#el.play.setAttribute("aria-pressed", String(on));
      this.#invalidate();
    }

    #spinTo(target) {
      this.#touched = true;
      this.#setPlaying(false);
      const from = this.#theta;
      const span = Math.abs(target - from);
      if (span < 1 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        this.#theta = target;
      } else {
        this.#tween = { from, to: target, t0: performance.now(), dur: clamp(span * 2.2, 400, 2600) };
      }
      this.#invalidate();
    }

    #addMirror() {
      if (this.#mirrors.length >= MAX_MIRRORS) return;
      const previous = this.#mirrors.length ? last(this.#mirrors).angle : toRad(50);
      this.#mirrors.push({ angle: mod(previous + toRad(40), TAU), flipAt: -Infinity });
      this.#announce(`Added mirror ${this.#mirrors.length}.`);
      this.#invalidate();
    }

    #removeMirror() {
      if (!this.#mirrors.length) return;
      this.#mirrors.pop();
      this.#announce(`${this.#mirrors.length} mirrors left.`);
      this.#invalidate();
    }

    #reset() {
      this.#mirrors = this.#initial.map((angle) => ({ angle, flipAt: -Infinity }));
      this.#cat = { ...HOME };
      this.#steps = this.#el.steps.checked = true;
      this.#announce("Reset.");
      this.#invalidate();
    }

    // Same mirror, opposite normal. The cat cannot tell; Pin(2) can.
    #flip(i) {
      const m = this.#mirrors[i];
      if (!m) return;
      m.angle = mod(m.angle + Math.PI, TAU);
      m.flipAt = performance.now();
      const d = describe(last(this.#products()));
      this.#pulses.push({ t0: m.flipAt, odd: d.odd, angle: d.odd ? d.normal : d.half });
      this.#announce(`Flipped the normal of mirror ${i + 1}: the cat did not move, but g became −g.`);
      this.#invalidate();
    }

    // ── the algebra behind each view ──

    // [1, u₁, u₂u₁, u₃u₂u₁, …]: the Pin element after each bounce.
    #products() {
      const out = [ONE];
      for (const m of this.#mirrors) out.push(mul(unit(m.angle), last(out)));
      return out;
    }

    // Two mirrors with normals u (fixed) and w (at half the spin angle): g = wu.
    #rotor() {
      const u = Math.PI / 2;
      return mul(unit(u + toRad(this.#theta) / 2), unit(u));
    }

    // Mirrors at 180°/k generate 2k cats; their lifts are the 4k products of u and w.
    #lifts() {
      const u = unit(Math.PI / 2);
      const w = unit(Math.PI / 2 + Math.PI / this.#k);
      const turn = mul(w, u);
      const even = [ONE];
      while (even.length < 2 * this.#k) even.push(mul(turn, last(even)));
      return { even, odd: even.map((g) => mul(g, u)) };
    }

    #source() {
      if (this.#mode !== "kaleido") return this.#cat;
      if (!this.#kcat) {
        const a = Math.PI / (2 * this.#k); // the middle of the wedge between the mirrors
        this.#kcat = { x: 0.64 * Math.cos(a), y: 0.64 * Math.sin(a) };
      }
      return this.#kcat;
    }

    #kaleidoSize() {
      const chord = 2 * 0.64 * Math.sin(Math.PI / (2 * this.#k));
      return Math.min(CAT_SIZE, (0.8 * chord) / CAT.w);
    }

    // ── pointer ──

    #toWorld(e) {
      const r = this.#el.stage.getBoundingClientRect();
      const R = (r.width / 2) * FILL;
      return {
        x: (e.clientX - r.left - r.width / 2) / R,
        y: (r.height / 2 - (e.clientY - r.top)) / R,
        R,
      };
    }

    #handleAt(p) {
      if (this.#mode !== "mirrors") return -1;
      for (let i = this.#mirrors.length - 1; i >= 0; i--) {
        const a = this.#mirrors[i].angle;
        const dist = Math.hypot(p.x - ARROW * Math.cos(a), p.y - ARROW * Math.sin(a));
        if (dist * p.R < 20) return i;
      }
      return -1;
    }

    #catAt(p) {
      for (let i = this.#hits.length - 1; i >= 0; i--) {
        const hit = this.#hits[i];
        if (Math.hypot(p.x - hit.x, p.y - hit.y) < hit.r) return hit;
      }
      return null;
    }

    #grabbable(p) {
      return this.#handleAt(p) >= 0 || this.#catAt(p) !== null;
    }

    #onDown(e) {
      if (e.button > 0) return;
      const p = this.#toWorld(e);
      const i = this.#handleAt(p);
      let drag;
      if (i >= 0) {
        drag = { kind: "mirror", i };
      } else {
        const hit = this.#catAt(p);
        if (!hit) {
          if (this.#hover) {
            this.#hover = null;
            this.#invalidate();
          }
          return;
        }
        if (this.#mode === "spin") {
          this.#touched = true;
          this.#tween = null;
          this.#setPlaying(false);
          drag = { kind: "spin", prev: Math.atan2(p.y, p.x) };
        } else {
          // Whichever image was grabbed, move the real cat so that image follows the
          // pointer: real = Mᵀ · pointer (M is orthogonal), plus the grab offset.
          const [a, b, c, d] = hit.M;
          const src = this.#source();
          drag = {
            kind: "cat",
            M: hit.M,
            meta: hit.meta,
            dx: src.x - (a * p.x + b * p.y),
            dy: src.y - (c * p.x + d * p.y),
          };
        }
      }
      this.#drag = Object.assign(drag, { x0: e.clientX, y0: e.clientY, moved: false });
      this.#el.stage.setPointerCapture(e.pointerId);
      this.#el.stage.style.cursor = "grabbing";
      e.preventDefault();
    }

    #onMove(e) {
      const p = this.#toWorld(e);
      const drag = this.#drag;
      if (!drag) return this.#onHover(p);
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
        drag.moved = true;
      }
      if (drag.kind === "mirror") {
        let a = Math.atan2(p.y, p.x);
        const snap = Math.round(a / toRad(15)) * toRad(15); // gently magnetic at 15°
        if (Math.abs(a - snap) < toRad(3)) a = snap;
        this.#mirrors[drag.i].angle = mod(a, TAU);
      } else if (drag.kind === "spin") {
        const a = Math.atan2(p.y, p.x);
        this.#theta = clamp(this.#theta + toDeg(wrapPi(a - drag.prev)), 0, SPIN_MAX);
        drag.prev = a;
      } else {
        const [a, b, c, d] = drag.M;
        let x = a * p.x + b * p.y + drag.dx;
        let y = c * p.x + d * p.y + drag.dy;
        const r = Math.hypot(x, y);
        if (r > 0.8) [x, y] = [(x * 0.8) / r, (y * 0.8) / r];
        Object.assign(this.#source(), { x, y });
      }
      this.#invalidate();
    }

    #onHover(p) {
      const onHandle = this.#handleAt(p) >= 0;
      const hit = onHandle ? null : this.#catAt(p);
      this.#el.stage.style.cursor = onHandle || hit ? "grab" : "";
      if (this.#mode !== "kaleido") return;
      const h = hit ? hit.meta : null;
      if (h?.kind !== this.#hover?.kind || h?.j !== this.#hover?.j) {
        this.#hover = h;
        this.#invalidate();
      }
    }

    #onUp() {
      const drag = this.#drag;
      if (!drag) return;
      this.#drag = null;
      this.#el.stage.style.cursor = "";
      if (drag.moved) return;
      if (drag.kind === "mirror") this.#flip(drag.i);
      if (drag.kind === "cat" && this.#mode === "kaleido") {
        this.#hover = drag.meta; // a tap lights up a cat on touch screens
        this.#invalidate();
      }
    }

    // ── the frame loop: draw only when something changed or is moving ──

    #invalidate() {
      if (!this.#raf && this.#visible && this.#el.root && this.isConnected) {
        this.#raf = requestAnimationFrame(this.#frame);
      }
    }

    #frame = (now) => {
      this.#raf = 0;
      const dt = this.#last ? Math.min(0.05, (now - this.#last) / 1000) : 0;
      let busy = this.#advanceSpin(dt, now);
      busy = this.#mirrors.some((m) => now - m.flipAt < FLIP_MS) || busy;
      this.#pulses = this.#pulses.filter((p) => now - p.t0 < PULSE_MS);
      busy = this.#pulses.length > 0 || busy;
      this.#draw(now);
      this.#last = busy ? now : 0;
      if (busy) this.#invalidate();
    };

    #advanceSpin(dt, now) {
      if (this.#tween) {
        const { from, to, t0, dur } = this.#tween;
        const t = clamp((now - t0) / dur, 0, 1);
        this.#theta = from + (to - from) * ease(t);
        if (t >= 1) this.#tween = null;
        return true;
      }
      if (!this.#playing || this.#mode !== "spin") return false;
      this.#theta += this.#dir * SPIN_SPEED * dt; // wind four turns, then unwind
      if (this.#theta >= SPIN_MAX) [this.#theta, this.#dir] = [SPIN_MAX, -1];
      else if (this.#theta <= 0) [this.#theta, this.#dir] = [0, 1];
      return true;
    }

    // ── colours, sizes, pictures, announcements ──

    #restyle() {
      this.#colors = null;
      this.#invalidate();
    }

    #palette() {
      if (this.#colors) return this.#colors;
      const cs = getComputedStyle(this.#el.root);
      const v = (name) => cs.getPropertyValue(`--psc-${name}`).trim();
      return (this.#colors = {
        paper: v("paper"),
        stage: v("stage"),
        ink: v("ink"),
        muted: v("muted"),
        line: v("line"),
        faint: v("faint"),
        glass: v("glass"),
        arrow: v("arrow"),
        even: v("even"),
        odd: v("odd"),
        yarn: v("yarn"),
        fur: v("fur"),
        furDark: v("fur-dark"),
        catInk: v("cat-ink"),
        pink: v("pink"),
        bell: v("bell"),
        mathFont: v("math-font") || "Georgia, serif",
        uiFont: cs.fontFamily || "system-ui, sans-serif",
      });
    }

    #resize() {
      const { root, wrap, side, stage, groups } = this.#el;
      if (!root) return;
      root.classList.toggle("wide", root.clientWidth >= 720);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const S = Math.floor(wrap.clientWidth);
      const W = Math.floor(side.clientWidth);
      const H = Math.round(Math.min(W * 0.8, 380));
      if (S === this.#S && W === this.#W && H === this.#H && dpr === this.#dpr) return;
      [this.#S, this.#W, this.#H, this.#dpr] = [S, W, H, dpr];
      stage.width = stage.height = Math.round(S * dpr);
      groups.width = Math.round(W * dpr);
      groups.height = Math.round(H * dpr);
      groups.style.height = `${H}px`;
      this.#invalidate();
    }

    #loadImage(src) {
      if (!src) {
        this.#img = null;
        this.#invalidate();
        return;
      }
      const img = new Image();
      img.onload = () => {
        if (this.getAttribute("cat-src") !== src) return;
        this.#img = img;
        this.#invalidate();
      };
      img.onerror = () => console.warn(`<pin-spin-cat>: could not load cat-src "${src}"`);
      img.src = src;
    }

    #announce(text) {
      if (this.#el.live) this.#el.live.textContent = text;
    }

    // ── drawing ──

    #draw(now) {
      if (!this.#S) return;
      this.#syncControls();
      this.#drawStage(now);
      this.#drawGroups(now);
      this.#drawReadout();
    }

    #syncControls() {
      const { add, remove, theta, thetaOut, k, kOut, chips } = this.#el;
      const t = Math.round(this.#theta);
      if (theta.value !== String(t)) theta.value = String(t);
      thetaOut.textContent = `θ = ${t}°`;
      if (k.value !== String(this.#k)) k.value = String(this.#k);
      kOut.textContent = `180°/${this.#k} = ${+(180 / this.#k).toFixed(1)}°`;
      add.disabled = this.#mirrors.length >= MAX_MIRRORS;
      remove.disabled = this.#mirrors.length === 0;

      if (chips.children.length !== this.#mirrors.length) {
        chips.innerHTML = this.#mirrors
          .map((_, i) => `<button class="chip" data-i="${i}"><i>u${sub(i + 1)}</i><span></span></button>`)
          .join("");
      }
      this.#mirrors.forEach((m, i) => {
        const chip = chips.children[i];
        const deg = String(Math.round(toDeg(m.angle)) % 360);
        if (chip.dataset.deg === deg) return;
        chip.dataset.deg = deg;
        chip.lastChild.textContent = `${deg}°`;
        chip.setAttribute(
          "aria-label",
          `Mirror ${i + 1}, normal at ${deg} degrees. Press to flip the normal; arrow keys turn the mirror.`,
        );
      });
    }

    #drawStage(now) {
      const { stage } = this.#el;
      const col = this.#palette();
      const dpr = this.#dpr;
      const S = this.#S;
      const R = (S / 2) * FILL;
      const c = S / 2;
      const ctx = stage.getContext("2d");
      // A little kit shared by the stage painters. World units are stage radii, y up.
      const kit = {
        ctx,
        col,
        R,
        now,
        px: (x, y) => [c + R * x, c - R * y],
        world: () => ctx.setTransform(dpr * R, 0, 0, -dpr * R, dpr * c, dpr * c),
      };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, S, S);
      this.#hits = [];
      this.#drawGrid(kit);
      if (this.#mode === "mirrors") this.#stageMirrors(kit);
      else if (this.#mode === "spin") this.#stageSpin(kit);
      else this.#stageKaleido(kit);
    }

    #drawGrid({ ctx, col, px, R }) {
      const [cx, cy] = px(0, 0);
      ctx.save();
      ctx.strokeStyle = col.faint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const f of [1 / 3, 2 / 3, 1]) {
        ctx.moveTo(cx + R * f, cy);
        ctx.arc(cx, cy, R * f, 0, TAU);
      }
      for (let i = 0; i < 12; i++) {
        const a = (i * TAU) / 12;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + R * Math.cos(a), cy - R * Math.sin(a));
      }
      ctx.stroke();
      ctx.restore();
    }

    // A mirror is the line perpendicular to its normal; `ray` draws only half of
    // it, the way a real hinged mirror stands on the page.
    #drawMirror({ ctx, col, px }, normal, ray = false) {
      const d = normal - Math.PI / 2;
      const L = 1.04;
      const [x0, y0] = ray ? px(0, 0) : px(-L * Math.cos(d), -L * Math.sin(d));
      const [x1, y1] = px(L * Math.cos(d), L * Math.sin(d));
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = col.glass;
      for (const [width, alpha] of [[9, 0.22], [1.6, 1]]) {
        ctx.globalAlpha = alpha;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // The unit normal as an arrow from the hinge. During a flip, `scale` runs
    // from −1 to 1: the arrow shrinks through zero and regrows the other way,
    // while the mirror line itself never moves.
    #drawNormal({ ctx, col, px }, angle, label, { scale = 1, grab = true } = {}) {
      const len = ARROW * scale;
      const [x0, y0] = px(0, 0);
      const [x1, y1] = px(len * Math.cos(angle), len * Math.sin(angle));
      const dir = Math.atan2(y1 - y0, x1 - x0);
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle = col.arrow;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (Math.hypot(x1 - x0, y1 - y0) > 12) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (const s of [-0.42, 0.42]) ctx.lineTo(x1 - 12 * Math.cos(dir + s), y1 - 12 * Math.sin(dir + s));
        ctx.closePath();
        ctx.fill();
        if (grab) {
          ctx.globalAlpha = 0.14;
          ctx.beginPath();
          ctx.arc(x1, y1, 16, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        const [lx, ly] = [x1 + 24 * Math.cos(dir), y1 + 24 * Math.sin(dir)];
        ctx.font = `italic 600 16px ${col.mathFont}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const w = ctx.measureText(label).width + 10;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = col.stage;
        roundedRect(ctx, lx - w / 2, ly - 11, w, 22, 11);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = col.arrow;
        ctx.fillText(label, lx, ly);
      }
      ctx.restore();
    }

    // One cat: the real cat's pose `at`/`rot`/`size`, then the O(2) matrix M on top.
    #drawCat(kit, { M = [1, 0, 0, 1], at, rot = 0, size = CAT_SIZE, alpha = 1, collar, glow, meta, hit = true }) {
      const { ctx, R, col } = kit;
      ctx.save();
      kit.world();
      ctx.transform(M[0], M[1], M[2], M[3], 0, 0);
      ctx.translate(at.x, at.y);
      ctx.rotate(rot);
      ctx.scale(size, size);
      ctx.globalAlpha = alpha;
      if (glow) {
        ctx.save();
        ctx.globalAlpha = 0.2 * alpha;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 0.68, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      const px = 1 / (R * size);
      if (this.#img) drawPhotoCat(ctx, this.#img, px, collar);
      else drawVectorCat(ctx, px, col, collar);
      ctx.restore();
      if (hit) {
        const [a, b, c, d] = M;
        this.#hits.push({ M, meta, x: a * at.x + c * at.y, y: b * at.x + d * at.y, r: size * 0.6 });
      }
    }

    #drawHinge({ ctx, col, px }) {
      const [x, y] = px(0, 0);
      ctx.fillStyle = col.ink;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, TAU);
      ctx.fill();
    }

    // A numbered badge under the image after bounce i.
    #drawBadge({ ctx, col, px, R }, g, i) {
      const [a, b, c, d] = matrixOf(g);
      const { x, y } = this.#cat;
      const [sx, sy] = px(a * x + c * y, b * x + d * y);
      const by = sy + R * CAT_SIZE * 0.66;
      ctx.save();
      ctx.fillStyle = col.paper;
      ctx.strokeStyle = col.muted;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, by, 9, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = col.ink;
      ctx.font = `600 11px ${col.uiFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i), sx, by + 0.5);
      ctx.restore();
    }

    #stageMirrors(kit) {
      const { col, now } = kit;
      const gs = this.#products();
      const n = this.#mirrors.length;
      const parity = (i) => (i % 2 ? col.odd : col.even);
      for (const m of this.#mirrors) this.#drawMirror(kit, m.angle);
      if (n) this.#drawCat(kit, { at: this.#cat, alpha: 0.2, collar: col.even, meta: { step: 0 } });
      if (this.#steps) {
        for (let i = 1; i < n; i++) {
          this.#drawCat(kit, { M: matrixOf(gs[i]), at: this.#cat, alpha: 0.38, collar: parity(i), meta: { step: i } });
        }
      }
      this.#drawCat(kit, { M: matrixOf(gs[n]), at: this.#cat, collar: parity(n), meta: { step: n } });
      if (this.#steps) for (let i = 1; i < n; i++) this.#drawBadge(kit, gs[i], i);
      this.#mirrors.forEach((m, i) => {
        const t = clamp((now - m.flipAt) / FLIP_MS, 0, 1);
        this.#drawNormal(kit, m.angle, `u${sub(i + 1)}`, { scale: -Math.cos(Math.PI * t) });
      });
      this.#drawHinge(kit);
    }

    #stageSpin(kit) {
      const { ctx, col, px, R } = kit;
      const th = toRad(this.#theta);
      const u = Math.PI / 2;
      const w = u + th / 2;
      this.#drawMirror(kit, u);
      this.#drawMirror(kit, w);

      // The mirror angle θ/2, marked between the two normals.
      const span = mod(th / 2, TAU);
      if (span > 0.02) {
        const [cx, cy] = px(0, 0);
        const [lx, ly] = px(0.27 * Math.cos(u + span / 2), 0.27 * Math.sin(u + span / 2));
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle = col.muted;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.2, -u, -(u + span), true);
        ctx.stroke();
        ctx.font = `italic 14px ${col.mathFont}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const w = ctx.measureText("θ/2").width + 10;
        ctx.fillStyle = col.stage;
        roundedRect(ctx, lx - w / 2, ly - 10, w, 20, 10);
        ctx.fill();
        ctx.fillStyle = col.muted;
        ctx.fillText("θ/2", lx, ly);
        ctx.restore();
      }

      this.#drawYarn(kit, th);
      this.#drawCat(kit, { at: HOME, alpha: 0.16, collar: col.even, hit: false });
      this.#drawCat(kit, { M: matrixOf(this.#rotor()), at: HOME, collar: col.even, meta: { spin: true } });
      this.#drawBall(kit);
      this.#drawNormal(kit, u, "u", { grab: false });
      this.#drawNormal(kit, w, "w", { grab: false });
    }

    // The yarn runs from the ball at the hinge to the collar bell, spiralling
    // once for every full turn. It remembers every turn; the sign of g only
    // remembers whether the count is even or odd.
    #drawYarn({ ctx, col, px }, th) {
      const bell = this.#img ? { x: 0, y: 0 } : BELL;
      const bx = HOME.x + CAT_SIZE * bell.x;
      const by = HOME.y + CAT_SIZE * bell.y;
      const r0 = BALL * 0.85;
      const r1 = Math.hypot(bx, by);
      const a0 = Math.atan2(by, bx);
      const n = Math.max(32, Math.ceil(Math.abs(th) / 0.05));
      ctx.save();
      ctx.strokeStyle = col.yarn;
      ctx.lineWidth = 2.2;
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const r = r0 + (r1 - r0) * t;
        const a = a0 + th * t;
        const [x, y] = px(r * Math.cos(a), r * Math.sin(a));
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    #drawBall({ ctx, col, px, R }) {
      const [cx, cy] = px(0, 0);
      const r = BALL * R;
      ctx.save();
      ctx.fillStyle = col.yarn;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.2;
      for (const [tilt, squash] of [[0.2, 0.7], [1.1, 0.55], [2.3, 0.8]]) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * squash, r * 0.92, tilt, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    #stageKaleido(kit) {
      const { ctx, col, px, R } = kit;
      const k = this.#k;
      const wedge = Math.PI / k;
      const [cx, cy] = px(0, 0);
      const reach = R * 1.04;
      const src = this.#source();

      // The wedge between the real mirrors, and dashed lines where their images fall.
      ctx.save();
      ctx.fillStyle = ctx.strokeStyle = col.glass;
      ctx.globalAlpha = 0.1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, reach, 0, -wedge, true);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      for (let j = 0; j < k; j++) {
        const [dx, dy] = [reach * Math.cos(j * wedge), reach * Math.sin(j * wedge)];
        ctx.moveTo(cx - dx, cy + dy);
        ctx.lineTo(cx + dx, cy - dy);
      }
      ctx.stroke();
      ctx.restore();
      this.#drawMirror(kit, Math.PI / 2, true);
      this.#drawMirror(kit, Math.PI / 2 + wedge, true);

      // 2k cats, one for each element of the dihedral group, all posed from the real one.
      const lifts = this.#lifts();
      const size = this.#kaleidoSize();
      const rot = Math.atan2(src.y, src.x) - Math.PI / 2; // the cat stands facing outward
      for (const kind of ["even", "odd"]) {
        for (let j = 0; j < k; j++) {
          const lit = this.#hover?.kind === kind && this.#hover?.j === j;
          const real = kind === "even" && j === 0;
          this.#drawCat(kit, {
            M: matrixOf(lifts[kind][j]),
            at: src,
            rot,
            size,
            collar: col[kind],
            glow: lit ? col[kind] : real ? col.glass : null,
            meta: { kind, j },
          });
        }
      }
      this.#drawHinge(kit);
    }

    // The group panel: Pin(2) upstairs, O(2) downstairs, even on the left, odd on
    // the right. Every g has a partner −g on the opposite side of its circle, and
    // both land on the same point below, because the map doubles angles.
    #drawGroups(now) {
      const col = this.#palette();
      const W = this.#W;
      const H = this.#H;
      const ctx = this.#el.groups.getContext("2d");
      ctx.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const top = 26;
      const half = (H - top) / 2;
      const r = Math.min(W * 0.15, half * 0.34);
      const X = [W * 0.42, W * 0.79];
      const Y = [top + half * 0.5, top + half * 1.5];
      const at = (c, row, a, out = 0) => [X[c] + (r + out) * Math.cos(a), Y[row] - (r + out) * Math.sin(a)];
      const ui = (size, weight = 400) => `${weight} ${size}px ${col.uiFont}`;
      const math = (size) => `italic ${size}px ${col.mathFont}`;
      const text = (s, x, y, font, color = col.muted, align = "center") => {
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = align;
        ctx.textBaseline = "middle";
        ctx.fillText(s, x, y);
      };

      // The frame.
      text("even", X[0], 13, ui(11, 600), col.even);
      text("odd", X[1], 13, ui(11, 600), col.odd);
      text("Pin(2)", 12, Y[0] - 8, ui(14, 600), col.ink, "left");
      text("signs kept", 12, Y[0] + 10, ui(11), col.muted, "left");
      text("O(2)", 12, Y[1] - 8, ui(14, 600), col.ink, "left");
      text("cat moves", 12, Y[1] + 10, ui(11), col.muted, "left");
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = ctx.fillStyle = col.line;
      for (const x of X) {
        for (const y of Y) {
          ctx.beginPath();
          ctx.arc(x, y, r, 0, TAU);
          ctx.stroke();
        }
        const y0 = Y[0] + r + 8;
        const y1 = Y[1] - r - 8;
        if (y1 - y0 < 14) continue;
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1 - 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y1 + 1);
        ctx.lineTo(x - 4, y1 - 6);
        ctx.lineTo(x + 4, y1 - 6);
        ctx.fill();
      }
      for (const x of X) text("2 : 1", x + 8, (Y[0] + Y[1]) / 2, ui(11), col.muted, "left");
      text("Spin(2)", X[0], Y[0] - 6, math(13), col.ink);
      text("unit vectors", X[1], Y[0] - 6, math(12));
      text("SO(2)", X[0], Y[1] - 6, math(13), col.ink);
      text("reflections", X[1], Y[1] - 6, math(12));
      text("1", X[0] + r - 10, Y[0] + 7, math(11));
      text(`${MINUS}1`, X[0] - r + 13, Y[0] + 7, math(11));
      text("e₁", X[1] + r - 11, Y[0] + 7, math(11));
      text(`${MINUS}e₁`, X[1] - r + 15, Y[0] + 7, math(11));
      text("id", X[0] + r - 11, Y[1] + 7, math(11));

      const dot = (c, row, a, color, size = 5.5, ring = false) => {
        const [x, y] = at(c, row, a);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, TAU);
        if (ring) {
          ctx.fillStyle = col.stage;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = color;
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
      };
      const link = (c, a, color, alpha) => {
        const [x0, y0] = at(c, 0, a);
        const [x1, y1] = at(c, 1, 2 * a);
        const my = (y0 + y1) / 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0, my, x1, my, x1, y1);
        ctx.stroke();
        ctx.restore();
      };
      // One Pin element: g (filled) and −g (ring) upstairs, curves to their shared image.
      const plot = (g, size = 5.5, alpha = 0.45) => {
        const d = describe(g);
        const c = d.odd ? 1 : 0;
        const color = d.odd ? col.odd : col.even;
        const a = d.odd ? d.normal : d.half;
        link(c, a, color, alpha);
        link(c, a + Math.PI, color, alpha);
        dot(c, 0, a + Math.PI, color, size, true);
        dot(c, 0, a, color, size);
        dot(c, 1, 2 * a, color, size);
      };
      // A spiral just outside a circle, one loop further out per full turn.
      const trail = (c, row, total, color) => {
        const n = Math.max(2, Math.ceil(Math.abs(total) / 0.04));
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = (total * i) / n;
          const [x, y] = at(c, row, a, 6 + (2.4 * a) / TAU);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      };

      if (this.#mode === "mirrors") {
        plot(last(this.#products()));
        for (const p of this.#pulses) {
          const t = clamp((now - p.t0) / PULSE_MS, 0, 1);
          const [x, y] = at(p.odd ? 1 : 0, 0, p.angle);
          ctx.save();
          ctx.globalAlpha = 1 - t;
          ctx.lineWidth = 2;
          ctx.strokeStyle = p.odd ? col.odd : col.even;
          ctx.beginPath();
          ctx.arc(x, y, 6 + 18 * t, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      } else if (this.#mode === "spin") {
        const th = toRad(this.#theta);
        trail(0, 0, th / 2, col.even); // Spin(2) goes round at half speed...
        trail(0, 1, th, col.even); // ...while SO(2) and the yarn count every turn
        plot(this.#rotor());
      } else {
        const lifts = this.#lifts();
        for (const [c, kind] of [[0, "even"], [1, "odd"]]) {
          lifts[kind].forEach((g, j) => {
            const d = describe(g);
            const a = c ? d.normal : d.half;
            dot(c, 0, a, col[kind], 3.5);
            if (j < this.#k) dot(c, 1, 2 * a, col[kind], 3.5);
          });
        }
        if (this.#hover) plot(lifts[this.#hover.kind][this.#hover.j], 6.5, 0.8);
      }
    }

    // ── words ──

    #drawReadout() {
      const read = { mirrors: this.#readMirrors, spin: this.#readSpin, kaleido: this.#readKaleido };
      const html = read[this.#mode].call(this);
      if (html === this.#html) return;
      this.#html = html;
      this.#el.readout.innerHTML = html;
      this.#el.stage.setAttribute("aria-label", this.#el.readout.textContent.replace(/\s+/g, " ").trim());
    }

    #readMirrors() {
      const g = last(this.#products());
      const n = this.#mirrors.length;
      const d = describe(g);
      const word = this.#mirrors.map((_, i) => `u${sub(i + 1)}`).reverse().join("");
      const bounces = `${n} reflection${n === 1 ? "" : "s"}`;
      const what =
        n === 0
          ? "No mirrors yet, so the cat is untouched."
          : d.odd
            ? `${bounces} (an odd number) make a <b>reflection</b> across the line at ` +
              `${degrees(mod(d.line, Math.PI))}. This <i>g</i> is in Pin(2) but not in Spin(2).`
            : `${bounces} (an even number) make a <b>rotation</b> by ${degrees(turn(d.angle))}. ` +
              `This <i>g</i> lies in Spin(2).`;
      return (
        `<p class="eq"><i>g</i> = ${n ? `${word} = ${formatMv(g)}` : "1"}</p>` +
        `<p>${what}</p>` +
        `<p class="aside">${MINUS}<i>g</i> = ${formatMv(neg(g))} draws exactly the same cat. ` +
        `Flip any normal to swap the two.</p>`
      );
    }

    #readSpin() {
      const t = Math.round(this.#theta);
      const turns = this.#theta / 360;
      const n = Math.round(turns);
      const home = Math.abs(this.#theta - 360 * n) < 2.5;
      let note;
      if (home && n === 0) note = "Nothing has turned yet, so <i>g</i> = 1.";
      else if (home && n % 2) {
        note =
          `The cat is home after ${360 * n}°, but <i>g</i> = ${MINUS}1: the second mirror lies ` +
          `on the first with its normal reversed.`;
      } else if (home) note = `Home again, and now <i>g</i> = +1. Spin needs 720° where SO(2) needs 360°.`;
      else {
        note =
          "The mirror angle is half the turn, so <i>g</i> takes 720° to come home. The yarn counts " +
          "every turn; the sign of <i>g</i> only remembers whether the count is even or odd.";
      }
      return (
        `<p class="eq"><i>θ</i> = ${t}°, so the cat is turned by ${mod(t, 360)}°</p>` +
        `<p class="eq"><i>g</i> = cos(<i>θ</i>/2) ${MINUS} sin(<i>θ</i>/2) e₁₂ = ${formatMv(this.#rotor())}</p>` +
        `<p class="aside">Yarn wound: ${turns.toFixed(2)} turns.</p>` +
        `<p>${note}</p>`
      );
    }

    #readKaleido() {
      const k = this.#k;
      let focus = `<p class="aside">Point at a cat (or tap it) to light up its two sign choices above.</p>`;
      if (this.#hover) {
        const g = this.#lifts()[this.#hover.kind][this.#hover.j];
        const d = describe(g);
        const what = d.odd
          ? `the reflection across the line at ${degrees(mod(d.line, Math.PI))}`
          : Math.abs(turn(d.angle)) < 1e-6
            ? "no change from the starting cat"
            : `the rotation by ${degrees(turn(d.angle))}`;
        focus = `<p>This cat shows ${what}. Its two sign choices are ±(${formatMv(g)}).</p>`;
      }
      return (
        `<p>Mirrors at 180°/${k} = ${+(180 / k).toFixed(1)}° make <b>${2 * k} cats</b>: ` +
        `the rotations and reflections these mirrors produce.</p>` +
        `<p>The upper circles show <b>${4 * k} sign choices</b> in Pin(2). Every cat move has two, ` +
        `<i>g</i> and ${MINUS}<i>g</i>.</p>` +
        focus
      );
    }
  }

  if (!customElements.get("pin-spin-cat")) customElements.define("pin-spin-cat", PinSpinCat);
})();
