/*!
 * harmonic-oscillators.js — damped and driven oscillators, as a spring–mass system and as an RLC circuit.
 *   <damping-cases>    four springs (undamped, underdamped, critically damped, overdamped) released together
 *   <spring-mass-lab>  one spring–mass system: damping, forcing, energy, roots, phase space, resonance
 *   <lc-circuit-lab>   the same equation as an LC circuit (with optional resistor and AC source)
 * Every curve is the exact solution from the auxiliary equation, not a numerical integration.
 * Plain JavaScript web components, no dependencies. KaTeX (already on the site) typesets the
 * formulas and is loaded on demand when a page lacks it. Colours follow the site's --psc-* variables.
 */
(() => {
'use strict';
if (!window.customElements || customElements.get('spring-mass-lab')) return;

/* ------------------------------------------------------------------
 * KaTeX (loaded on demand, shared with the page)
 * ------------------------------------------------------------------ */

const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.css';
const KATEX_CSS_SRI = 'sha384-lPx0C4zIUZLpveABMwOFcFeGZwsvKBJfhJ85FN1PYOV7xApBcFMhcAEMVKF8loOI';
const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.js';
const KATEX_JS_SRI = 'sha384-19KE2cFb3U+RUWmyhBz7aLOGDG8WrRC6hE3oY/HTZZlAAVWYTdmvLC//+TIV3zUx';

const MINUS = '−';
const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const reducedMotion = () => reducedMotionQuery.matches;

let katexPromise = null;

function ensureDocumentKatexCss() {
  // @font-face rules only work from the document, so the page needs the KaTeX stylesheet too.
  if (document.getElementById('katex-inline-css')) return;
  for (const link of document.querySelectorAll('link[rel~="stylesheet"]')) {
    if (/katex(\.min)?\.css/.test(link.getAttribute('href') || '')) return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = KATEX_CSS;
  link.integrity = KATEX_CSS_SRI;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  if (katexPromise) return katexPromise;
  ensureDocumentKatexCss();
  katexPromise = new Promise(resolve => {
    let settled = false;
    const finish = () => { if (!settled && window.katex) { settled = true; resolve(window.katex); } };
    const fail = () => { if (!settled) { settled = true; resolve(null); } };
    const existing = [...document.scripts].find(s => /katex(\.min)?\.js(\?|#|$)/.test(s.src) && !/contrib|auto-render/.test(s.src));
    if (existing) existing.addEventListener('load', finish);
    else {
      const script = document.createElement('script');
      script.src = KATEX_JS;
      script.integrity = KATEX_JS_SRI;
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.addEventListener('load', finish);
      script.addEventListener('error', fail);
      document.head.appendChild(script);
    }
    let tries = 0;
    const timer = setInterval(() => {
      if (window.katex) { clearInterval(timer); finish(); }
      else if (++tries > 200) { clearInterval(timer); fail(); }
    }, 60);
  });
  return katexPromise;
}

/** KaTeX stylesheet for a shadow root: an inline copy if the page provides one, else the CDN link. */
function katexStyleNode() {
  const inline = document.getElementById('katex-inline-css');
  if (inline) {
    const style = document.createElement('style');
    style.textContent = inline.textContent.replace(/@font-face\s*\{[^}]*\}/g, '');
    return style;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = KATEX_CSS;
  link.integrity = KATEX_CSS_SRI;
  link.crossOrigin = 'anonymous';
  return link;
}

function texFallback(tex) {
  let out = tex
    .replace(/\\(begin|end)\{[a-z]*\}/g, '')
    .replace(/\\\\/g, ';  ')
    .replace(/&/g, '');
  for (let i = 0; i < 4; i++) {
    out = out.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    out = out.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
    out = out.replace(/\\underbrace\{([^{}]*)\}_\{[^{}]*\}/g, '$1');
  }
  const words = [
    ['\\gamma', 'γ'], ['\\omega', 'ω'], ['\\alpha', 'α'], ['\\beta', 'β'], ['\\Delta', 'Δ'], ['\\pm', '±'],
    ['\\cos', 'cos'], ['\\sin', 'sin'], ['\\cdot', '·'], ['\\left', ''], ['\\right', ''], ['\\Longrightarrow', '⇒'],
    ['\\quad', '  '], ['\\qquad', '   '], ['\\text', ''], ['\\mathrm', ''], ['\\approx', '≈'], ['\\to', '→'],
    ['\\lt', '<'], ['\\gt', '>'], ['\\le', '≤'], ['\\ge', '≥'], ['\\ne', '≠'], ['\\,', ' '], ['\\;', ' '], ['\\!', ''],
  ];
  for (const [from, to] of words) out = out.split(from).join(to);
  return out.replace(/\^\{?2\}?/g, '²').replace(/[{}]/g, '').replace(/\\/g, '').replace(/\s+/g, ' ').trim();
}

const KATEX_OPTIONS = { throwOnError: false, strict: 'ignore' };

/** Typeset `tex` into `el`. Works before KaTeX arrives and upgrades itself afterwards. */
function texTo(el, tex, display = false) {
  if (el.__tex === tex && el.__texDone && el.__texDisplay === display) return;
  el.__tex = tex;
  el.__texDisplay = display;
  if (window.katex) {
    try {
      window.katex.render(tex, el, { ...KATEX_OPTIONS, displayMode: display });
      el.__texDone = true;
      return;
    } catch (err) { /* fall through */ }
  }
  el.textContent = texFallback(tex);
  el.__texDone = false;
  if (!window.katex) loadKatex().then(k => { if (k && el.__tex === tex && !el.__texDone) texTo(el, tex, display); });
}

/** Render a short trusted string with $…$ math and simple tags. */
function richTo(el, text) {
  if (el.__rich === text) return;
  el.__rich = text;
  el.textContent = '';
  const parts = text.split('$');
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    if (i % 2) {
      const span = document.createElement('span');
      span.className = 'tex';
      texTo(span, part);
      const punct = (parts[i + 1] || '').match(/^[.,;:!?)]+/);
      if (punct) {
        const glue = document.createElement('span');
        glue.style.whiteSpace = 'nowrap';
        glue.append(span, punct[0]);
        el.appendChild(glue);
        parts[i + 1] = parts[i + 1].slice(punct[0].length);
      } else el.appendChild(span);
    } else {
      const tpl = document.createElement('template');
      tpl.innerHTML = part;
      el.appendChild(tpl.content);
    }
  }
}

function plainText(text) {
  return text.split('$').map((part, i) => (i % 2 ? texFallback(part) : part.replace(/<[^>]+>/g, ''))).join('').replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------
 * DOM and SVG helpers
 * ------------------------------------------------------------------ */

const SVGNS = 'http://www.w3.org/2000/svg';
let uidCounter = 0;
const uid = prefix => `${prefix}-${++uidCounter}`;

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'tex') { el.classList.add('tex'); texTo(el, value); }
      else if (key === 'rich') richTo(el, value);
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

function s(tag, attrs, parent) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [key, value] of Object.entries(attrs)) if (value != null) el.setAttribute(key, value);
  if (parent) parent.appendChild(el);
  return el;
}

function attr(el, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) el.removeAttribute(key);
    else el.setAttribute(key, value);
  }
}

/** Short formula in SVG text: letters italic (KaTeX_Math), the rest upright; a_b subscripts, raised ′ primes. */
function mathText(el, str) {
  el.textContent = '';
  const re = /_(\d+|[A-Za-z])|([A-Za-zαβγωΔ]+)|(′+)|([^A-Za-zαβγωΔ_′]+)/g;
  let m;
  let offset = 0; // current baseline shift, undone by the next piece
  while ((m = re.exec(str))) {
    const t = document.createElementNS(SVGNS, 'tspan');
    let target = 0;
    if (m[1] != null) {
      t.setAttribute('class', /[A-Za-z]/.test(m[1]) ? 'mi' : 'mn');
      t.setAttribute('font-size', '72%');
      target = 3;
    } else if (m[3] != null) {
      t.setAttribute('class', 'mn');
      t.setAttribute('font-size', '78%');
      target = -5;
    } else {
      const word = m[2];
      t.setAttribute('class', word && !/^(cos|sin|heat|max)$/.test(word) && word !== 'Δ' ? 'mi' : 'mn');
    }
    if (target !== offset) t.setAttribute('dy', String(target - offset));
    offset = target;
    t.textContent = m[0].replace(/^_/, '');
    el.appendChild(t);
  }
}

const ICONS = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M2.6 1.9v3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function iconButton(icon, label, attrs = {}) {
  const btn = h('button', { type: 'button', ...attrs });
  btn.innerHTML = ICONS[icon] + (label ? `<span>${label}</span>` : '');
  return btn;
}

/* ------------------------------------------------------------------
 * Numbers
 * ------------------------------------------------------------------ */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Exact small fraction p/q (q = 2, 3, 4) for v, or null. */
function smallFraction(v) {
  for (const q of [2, 3, 4]) {
    const p = Math.round(v * q);
    if (Math.abs(v * q - p) < 1e-7 && p % q !== 0) return [p, q];
  }
  return null;
}

/** Number for a displayed formula: ½, ⅓, ¾ as fractions, otherwise rounded decimals. */
function nf(v, places = 2) {
  const fr = smallFraction(v);
  if (fr) return `${fr[0] < 0 ? '-' : ''}\\tfrac{${Math.abs(fr[0])}}{${fr[1]}}`;
  return n(v, places);
}

/** Rounded number for TeX: trims trailing zeros, never prints -0. */
function n(v, places = 2) {
  if (!Number.isFinite(v)) return v > 0 ? '\\infty' : '-\\infty';
  let str = v.toFixed(places);
  if (str.includes('.')) str = str.replace(/0+$/, '').replace(/\.$/, '');
  if (/^-0$/.test(str)) str = '0';
  return str;
}
/** Same, as plain text with a true minus sign. */
const nt = (v, places = 2) => n(v, places).replace('-', MINUS);

const isOne = v => Math.abs(Math.abs(v) - 1) < 5e-4;
const isZero = (v, places = 2) => Number(Math.abs(v).toFixed(places)) === 0;

/** Sum of terms c·body as TeX, dropping zero terms and unit coefficients. */
function sumTex(terms, places = 2) {
  let out = '';
  for (const { c, body } of terms) {
    if (!Number.isFinite(c) || isZero(c, places)) continue;
    const mag = Math.abs(c);
    const coef = body && isOne(mag) ? '' : nf(mag, places);
    const piece = coef + (coef && body ? '\\,' : '') + body;
    if (!out) out = (c < 0 ? '-' : '') + piece;
    else out += (c < 0 ? ' - ' : ' + ') + piece;
  }
  return out || '0';
}
const rateTex = r => (isOne(r) ? (r > 0 ? 't' : '-t') : `${n(r)}t`);
const expTex = r => (isZero(r) ? '' : `e^{${rateTex(r)}}`);
const angTex = w => (isOne(w) ? 't' : `${n(w)}t`);

function niceStep(span, target) {
  const raw = span / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag;
}

/* ------------------------------------------------------------------
 * The model: a y'' + b y' + c y = F0 cos(w t), y(0) = y0, y'(0) = v0
 * Exact solution = homogeneous part (auxiliary equation) + steady state.
 * ------------------------------------------------------------------ */

function solveOscillator({ a, b, c, F0 = 0, w = 1, y0 = 1, v0 = 0, ts = 0 }) {
  // initial conditions are given at time ts; the forcing is F0 cos(w t) in absolute time
  const sol = { a, b, c, F0, w, y0, v0, ts, w0: Math.sqrt(c / a) };
  b = b < 1e-9 ? 0 : b;
  sol.b = b;

  // Steady state (undetermined coefficients).
  let yp = () => 0;
  let vp = () => 0;
  sol.steady = null;
  if (F0 !== 0) {
    const det = c - a * w * w;
    if (b === 0 && Math.abs(det) <= 1e-6 * c) {
      const K = F0 / (2 * a * w);
      yp = t => K * t * Math.sin(w * t);
      vp = t => K * (Math.sin(w * t) + w * t * Math.cos(w * t));
      sol.steady = { resonance: true, K };
    } else {
      const D = det * det + (b * w) ** 2;
      const A = (F0 * det) / D;
      const B = (F0 * b * w) / D;
      yp = t => A * Math.cos(w * t) + B * Math.sin(w * t);
      vp = t => w * (B * Math.cos(w * t) - A * Math.sin(w * t));
      sol.steady = { A, B, amp: F0 / Math.sqrt(D), delta: Math.atan2(b * w, det) };
    }
  }

  // Homogeneous part with the leftover initial conditions (in local time tau = t - ts).
  const Y = y0 - yp(ts);
  const V = v0 - vp(ts);
  const disc = b * b - 4 * a * c;
  sol.disc = disc;
  const tol = 1e-9 * Math.max(b * b, 4 * a * c);
  let yh;
  let vh;
  if (Math.abs(disc) <= tol) {
    const r = -b / (2 * a);
    const C1 = Y;
    const C2 = V - r * Y;
    yh = t => (C1 + C2 * t) * Math.exp(r * t);
    vh = t => (C2 + r * (C1 + C2 * t)) * Math.exp(r * t);
    Object.assign(sol, { kind: 'critical', r, C1, C2, roots: [{ re: r, im: 0 }, { re: r, im: 0 }] });
  } else if (disc > 0) {
    const sq = Math.sqrt(disc);
    const r1 = (-b + sq) / (2 * a);
    const r2 = (-b - sq) / (2 * a);
    const C1 = (V - r2 * Y) / (r1 - r2);
    const C2 = (r1 * Y - V) / (r1 - r2);
    yh = t => C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
    vh = t => r1 * C1 * Math.exp(r1 * t) + r2 * C2 * Math.exp(r2 * t);
    Object.assign(sol, { kind: 'over', r1, r2, C1, C2, roots: [{ re: r1, im: 0 }, { re: r2, im: 0 }] });
  } else {
    const al = -b / (2 * a);
    const be = Math.sqrt(-disc) / (2 * a);
    const C1 = Y;
    const C2 = (V - al * Y) / be;
    yh = t => Math.exp(al * t) * (C1 * Math.cos(be * t) + C2 * Math.sin(be * t));
    vh = t => Math.exp(al * t) * ((al * C1 + be * C2) * Math.cos(be * t) + (al * C2 - be * C1) * Math.sin(be * t));
    Object.assign(sol, {
      kind: b === 0 ? 'undamped' : 'under', alpha: al, beta: be, C1, C2,
      amp: Math.hypot(C1, C2), roots: [{ re: al, im: be }, { re: al, im: -be }],
    });
  }
  sol.yh = t => yh(t - ts);
  sol.yp = yp;
  sol.y = t => yh(t - ts) + yp(t);
  sol.v = t => vh(t - ts) + vp(t);
  sol.force = t => F0 * Math.cos(w * t);
  sol.E0 = 0.5 * a * v0 * v0 + 0.5 * c * y0 * y0;
  sol.kinetic = t => 0.5 * a * sol.v(t) ** 2;
  sol.potential = t => 0.5 * c * sol.y(t) ** 2;
  // Unforced: whatever is missing from E0 went into heat, exactly (dE/dt = -b y'^2).
  sol.heat = t => (F0 === 0 ? Math.max(0, sol.E0 - sol.kinetic(t) - sol.potential(t)) : 0);
  return sol;
}

const CASE_NAMES = {
  undamped: 'Undamped',
  under: 'Underdamped',
  critical: 'Critically damped',
  over: 'Overdamped',
};

/** Homogeneous part of the solution as TeX. */
function homogeneousTex(sol) {
  if (sol.kind === 'critical') {
    const inner = sumTex([{ c: sol.C1, body: '' }, { c: sol.C2, body: 't' }]);
    if (inner === '0') return '0';
    const single = !/[+-]/.test(inner.slice(1));
    return `${single ? inner : `\\left(${inner}\\right)`}${expTex(sol.r)}`;
  }
  if (sol.kind === 'over') {
    return sumTex([{ c: sol.C1, body: expTex(sol.r1) }, { c: sol.C2, body: expTex(sol.r2) }]);
  }
  const inner = sumTex([{ c: sol.C1, body: `\\cos ${angTex(sol.beta)}` }, { c: sol.C2, body: `\\sin ${angTex(sol.beta)}` }]);
  if (sol.kind === 'undamped' || inner === '0') return inner;
  return `${expTex(sol.alpha)}\\left(${inner}\\right)`;
}

/** Steady-state part as TeX. */
function steadyTex(sol) {
  if (!sol.steady) return '';
  if (sol.steady.resonance) return `${isOne(sol.steady.K) ? '' : nf(sol.steady.K)}\\,t\\sin ${angTex(sol.w)}`;
  return sumTex([{ c: sol.steady.A, body: `\\cos ${angTex(sol.w)}` }, { c: sol.steady.B, body: `\\sin ${angTex(sol.w)}` }]);
}

function rootsTex(sol) {
  if (sol.kind === 'critical') return `r = ${nf(sol.r)}, \\ ${nf(sol.r)}`;
  if (sol.kind === 'over') return `r = ${nf(sol.r1)}, \\ ${nf(sol.r2)}`;
  if (sol.kind === 'undamped') return `r = \\pm ${isOne(sol.beta) ? '' : nf(sol.beta)}\\,i`;
  return `r = ${nf(sol.alpha)} \\pm ${isOne(sol.beta) ? '' : nf(sol.beta)}\\,i`;
}

/* ------------------------------------------------------------------
 * Typed equations: "a y'' + b y' + c y = 0" or "... = F0 cos(w t)"
 * ------------------------------------------------------------------ */

const NUM = '(?:\\d+\\.?\\d*|\\.\\d+)';

function readNumber(str) {
  if (!str) return 1;
  const inner = str.replace(/^\((.*)\)$/, '$1');
  const [p, q] = inner.split('/');
  const v = q == null ? Number(p) : Number(p) / Number(q);
  return Number.isFinite(v) ? v : NaN;
}

/** Parse an equation in one variable. Returns { a, b, c, F0, w } or { error }. */
function parseOde(text, letter) {
  let str = String(text ?? '')
    .replace(/[−–—]/g, '-')
    .replace(/[·×∙]/g, '*')
    .replace(/″/g, "''")
    .replace(/[′’‘`´]/g, "'")
    .replace(/\s+/g, '')
    .toLowerCase();
  if (!str) return { error: 'Type an equation.' };
  const v = letter.toLowerCase();
  str = str.replace(new RegExp(`${v}('{0,2})\\(t\\)`, 'g'), `${v}$1`);
  const sides = str.split('=');
  if (sides.length !== 2 || !sides[0] || !sides[1]) return { error: 'Write it as one equation with a single = sign.' };
  const [lhs, rhs] = sides;

  // left side: terms in v, v', v''
  const terms = [];
  let cur = '';
  for (let i = 0; i < lhs.length; i++) {
    const ch = lhs[i];
    if ((ch === '+' || ch === '-') && cur && !/[*/(]$/.test(cur)) { terms.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) terms.push(cur);
  const coef = [0, 0, 0];
  const termRe = new RegExp(`^([+-]?)(\\(?${NUM}(?:\\/${NUM})?\\)?)?\\*?${v}('*)(?:\\/(${NUM}))?$`);
  for (const term of terms) {
    const m = term.match(termRe);
    if (!m) {
      if (new RegExp(`^[+-]?${NUM}$`).test(term)) return { error: `The left side should only have ${letter}'', ${letter}' and ${letter} terms.` };
      if (/[a-z]/.test(term.replace(/cos|sin/g, '')) && !term.includes(v)) return { error: `Use the variable ${letter}: ${letter}'', ${letter}' and ${letter}.` };
      if (/cos|sin/.test(term)) return { error: 'Put the forcing on the right-hand side.' };
      return { error: `I could not read "${term}". Try something like ${letter}'' + 2${letter}' + 5${letter} = 0.` };
    }
    const order = m[3].length;
    if (order > 2) return { error: 'Only second-order equations: use up to two primes.' };
    let val = readNumber(m[2]);
    if (m[4]) val /= Number(m[4]);
    if (!Number.isFinite(val)) return { error: `I could not read "${term}".` };
    coef[order] += (m[1] === '-' ? -1 : 1) * val;
  }

  // right side: 0, or F0 cos(w t)
  let F0 = 0;
  let w = null;
  if (!/^[+]?0*\.?0*$/.test(rhs)) {
    if (/sin/.test(rhs)) return { error: 'Write the forcing with cosine, like 2cos(3t).' };
    const fm = rhs.match(new RegExp(`^([+-]?)(\\(?${NUM}(?:\\/${NUM})?\\)?)?\\*?cos\\(?(${NUM})?\\*?t\\)?$`));
    if (!fm) return { error: 'The right-hand side should be 0 or a forcing like 2cos(3t).' };
    if (fm[1] === '-') return { error: 'Write the forcing amplitude as a positive number, like 2cos(3t).' };
    F0 = readNumber(fm[2]);
    w = fm[3] ? Number(fm[3]) : 1;
  }
  return { a: coef[2], b: coef[1], c: coef[0], F0, w };
}

/** Plain-text equation for the input box. */
function odeText(letter, a, b, c, F0, w) {
  const num = x => {
    let str = (Math.round(x * 1000) / 1000).toString();
    if (str === '1') str = '';
    return str;
  };
  const parts = [`${num(a)}${letter}''`];
  if (b > 5e-4) parts.push(`${num(b)}${letter}'`);
  parts.push(`${num(c)}${letter}`);
  const rhs = F0 ? `${num(F0)}cos(${num(w)}t)` : '0';
  return `${parts.join(' + ')} = ${rhs}`;
}

/* ------------------------------------------------------------------
 * Styles (shadow DOM). Colours follow the site's --psc-* variables.
 * Colour language, shared by every figure:
 *   rust  = position x / charge q, and the potential (capacitor) energy it stores
 *   blue  = velocity x' / current i, and the kinetic (inductor) energy it carries
 *   plum  = damping / resistance, and the energy it turns into heat
 *   sage  = the external force F(t) / source voltage V(t)
 * ------------------------------------------------------------------ */

const STYLE = `
:host {
  --_ink: var(--psc-ink, #3e3b39);
  --_muted: var(--psc-muted, #6d6058);
  --_paper: var(--psc-paper, #f4f1ea);
  --_stage: var(--psc-stage, #ece7dd);
  --_line: var(--psc-line, rgba(62, 59, 57, 0.16));
  --_faint: var(--psc-faint, rgba(62, 59, 57, 0.07));
  --_radius: var(--psc-radius, 8px);
  --_sheet: var(--osc-sheet, #fdfcf9);
  --_card: var(--osc-card, #fbf9f5);
  --_blue: var(--osc-blue, #2f6187);
  --_rust: var(--osc-rust, #b5562b);
  --_sage: var(--osc-sage, #4a7a56);
  --_plum: var(--osc-plum, #7a5a8c);
  --_serif: Georgia, 'Times New Roman', serif;
  display: block;
  color: var(--_ink);
  font-family: var(--font-body, 'Lato', 'Helvetica Neue', Arial, sans-serif);
  font-size: 15px;
  line-height: 1.45;
  container-type: inline-size;
  -webkit-tap-highlight-color: transparent;
}
:host([hidden]) { display: none; }
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
.katex .katex-mathml { position: absolute; clip: rect(1px, 1px, 1px, 1px); padding: 0; border: 0; height: 1px; width: 1px; overflow: hidden; }
.katex { font-size: 1.08em; }
.sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

.osc {
  position: relative;
  background: var(--_paper);
  border: 1px solid var(--_line);
  border-radius: var(--_radius);
  padding: 18px 20px 20px;
}

/* ---------- chips, buttons, switches ---------- */
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
.bar .spacer { flex: 1 1 0; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; gap: 7px;
  min-height: 34px; padding: 0 13px;
  border: 1px solid rgba(62, 59, 57, 0.2); border-radius: 999px;
  background: #fffdf8; color: var(--_ink);
  font: inherit; font-size: 13.5px; font-weight: 700; letter-spacing: .01em; cursor: pointer; white-space: nowrap;
  transition: background-color .15s, border-color .15s, color .15s;
}
.chip:hover { border-color: rgba(62, 59, 57, 0.42); }
.chip[aria-checked="true"] { background: var(--_ink); border-color: var(--_ink); color: #faf7f1; }
.chip .sign { font-weight: 400; opacity: .72; }
.chip .sign .katex { font-size: .98em; }

button, input { font: inherit; color: inherit; }
button:focus-visible, input:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--text-secondary, #5d4037);
  outline-offset: 2px;
}
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 36px; padding: 0 15px;
  border: 1px solid rgba(62, 59, 57, 0.22); border-radius: 999px;
  background: #fffdf9; color: var(--_ink);
  font-size: 14px; font-weight: 700; letter-spacing: .01em;
  cursor: pointer; white-space: nowrap;
  transition: background-color .15s, border-color .15s;
}
.btn svg { width: 14px; height: 14px; flex: none; }
.btn:hover { background: #f6f1e8; border-color: rgba(62, 59, 57, 0.36); }
.btn.primary { background: var(--_ink); border-color: var(--_ink); color: #faf7f1; min-width: 96px; }
.btn.primary:hover { background: #2d2a28; }

.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 10px; }
.controls .spacer { flex: 1 1 8px; }
.clock { font-size: 13px; color: var(--_muted); font-variant-numeric: tabular-nums; min-width: 6.5em; }
.clock .tex .katex { font-size: 1.02em; }

.switch { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--_ink); cursor: pointer; user-select: none; }
.switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.switch .track { position: relative; flex: none; width: 30px; height: 17px; border-radius: 999px; background: rgba(62, 59, 57, 0.2); transition: background-color .18s; }
.switch .track::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .18); transition: transform .18s;
}
.switch input:checked + .track { background: var(--switch-on, var(--_ink)); }
.switch input:checked + .track::after { transform: translateX(13px); }
.switch input:focus-visible + .track { outline: 2px solid var(--text-secondary, #5d4037); outline-offset: 2px; }
.switch .label .katex { font-size: 1.04em; }

.seg { display: inline-flex; border: 1px solid rgba(62, 59, 57, 0.22); border-radius: 999px; overflow: hidden; background: #fffdf9; }
.seg button { border: 0; background: transparent; padding: 4px 10px; font-size: 12px; font-weight: 700; color: var(--_muted); cursor: pointer; white-space: nowrap; }
.seg button[aria-pressed="true"] { background: var(--_ink); color: #faf7f1; }

/* ---------- equation line ---------- */
.problem {
  margin-top: 14px; padding: 10px 14px;
  background: var(--_card); border: 1px solid var(--_line); border-radius: 6px;
  overflow-x: auto; overflow-y: hidden;
}
.problem .row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 22px; }
.problem .row.sol { margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(62, 59, 57, .2); flex-wrap: nowrap; }
.problem .word { flex: none; font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--_muted); }
.problem .sol-tex { white-space: nowrap; }
.problem .sol-tex .katex { font-size: 1.14em; }
.eq-field { flex: 1 1 260px; min-width: 0; max-width: 460px; display: block; }
.eq-input {
  display: block; width: 100%; height: 42px; padding: 0 13px;
  border: 1px solid rgba(62, 59, 57, 0.3); border-radius: 6px; background: #fff;
  font: 19px/1 Georgia, 'Times New Roman', serif; color: var(--_ink); letter-spacing: .02em;
  transition: border-color .15s, box-shadow .15s, background-color .15s;
}
.eq-input::placeholder { color: rgba(62, 59, 57, .35); }
.eq-input:focus { outline: none; border-color: var(--_ink); box-shadow: 0 0 0 3px rgba(62, 59, 57, .1); }
.eq-input.invalid { border-color: #b3261e; background: #fdf4f3; }
.eq-input.invalid:focus { box-shadow: 0 0 0 3px rgba(179, 38, 30, .12); }
.eq-msg { margin-top: 7px; font-size: 13px; line-height: 1.4; color: #a1271f; }
.mini.draggable { cursor: ew-resize; touch-action: none; }
.w-dot { fill: var(--_sage); stroke: var(--_sheet); stroke-width: 2; }
.w-halo { fill: var(--_sage); fill-opacity: .14; stroke: var(--_sage); stroke-opacity: .45; stroke-width: 1; }
.amp-now { stroke: var(--_rust); stroke-width: 3; stroke-linecap: round; }
.problem .eq { white-space: nowrap; }
.problem .eq .katex { font-size: 1.18em; }
.problem .ic { white-space: nowrap; color: var(--_muted); }
.problem .ic .katex { font-size: 1.04em; }

/* ---------- main layout ---------- */
.layout { margin-top: 14px; }
.figure { min-width: 0; }
.fig { display: block; width: 100%; overflow: visible; user-select: none; -webkit-user-select: none; touch-action: pan-y pinch-zoom; }
.fig text { pointer-events: none; }

.caption { min-height: 3.1em; margin-top: 10px; padding: 0 2px; font: 15.5px/1.55 var(--_serif); color: var(--_ink); }
.caption .katex { font-size: 1.03em; }
.legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 4px; font-size: 12.5px; color: var(--_muted); }
.legend > span { display: inline-flex; align-items: center; gap: 6px; }
.legend .katex { font-size: 1.02em; }
.sw { display: inline-block; width: 14px; height: 10px; border-radius: 2px; }
.sw.line { height: 0; border-top: 2.5px solid currentColor; border-radius: 2px; }
.sw.dash { height: 0; border-top: 2px dashed currentColor; }
.sw.hatch { background: repeating-linear-gradient(135deg, rgba(122, 90, 140, .55) 0 2px, transparent 2px 5px); border: 1px solid rgba(122, 90, 140, .45); }
.c-rust { color: var(--_rust); } .c-blue { color: var(--_blue); } .c-plum { color: var(--_plum); } .c-sage { color: var(--_sage); } .c-ink { color: var(--_ink); }
.bg-rust { background: var(--_rust); opacity: .62; } .bg-blue { background: var(--_blue); opacity: .55; }

/* ---------- sliders ---------- */
.sliders { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 26px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--_line); }
.slider { display: grid; grid-template-columns: 92px minmax(0, 1fr) 58px; align-items: center; gap: 10px; min-height: 40px; }
.slider .name { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; color: var(--_muted); white-space: nowrap; }
.slider .name .tex { color: var(--_ink); font-size: 15px; }
.slider .val { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.slider .val small { font-weight: 400; color: var(--_muted); font-size: 11px; margin-left: 2px; }
.track-wrap { position: relative; padding-bottom: 6px; }
.notch-label {
  position: absolute; top: 25px; transform: translateX(-50%);
  font-size: 11px; letter-spacing: .02em; font-weight: 700; color: var(--_muted);
  white-space: nowrap; pointer-events: none;
}
input[type=range] { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 26px; margin: 0; background: transparent; cursor: pointer; }
input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--track, rgba(62, 59, 57, .2)); }
input[type=range]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--track, rgba(62, 59, 57, .2)); }
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%;
  background: #fffdf9; border: 2px solid var(--thumb, var(--_ink)); box-shadow: 0 1px 3px rgba(0, 0, 0, .16);
}
input[type=range]::-moz-range-thumb { width: 12px; height: 12px; border-radius: 50%; background: #fffdf9; border: 2px solid var(--thumb, var(--_ink)); }
input[type=range]:focus-visible { outline: none; }
input[type=range]:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--text-secondary, #5d4037); outline-offset: 2px; }

/* ---------- optional mathematical views ---------- */
.analysis-details { margin-top: 22px; border-top: 1px solid var(--_line); }
.analysis-details > summary { padding: 14px 2px; color: var(--_muted); font-size: 14px; font-weight: 700; cursor: pointer; }
.analysis-details > summary:hover { color: var(--_ink); }
.analysis-details > summary:focus-visible { outline: 2px solid var(--text-secondary, #5d4037); outline-offset: 2px; }
.analysis-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: 14px; align-items: start; }
.analysis-grid .head { flex-wrap: wrap; }
.analysis-grid .seg { display: flex; flex-wrap: wrap; width: 100%; border-radius: 6px; }
.analysis-grid .seg button { flex: 1 1 auto; min-height: 38px; padding: 8px 10px; }
.analysis-grid .mini { max-width: 380px; margin-inline: auto; }
.analysis-grid .card { padding: 14px 16px; }

.card { background: var(--_card); border: 1px solid var(--_line); border-radius: 6px; padding: 12px 14px 13px; min-width: 0; }
.kicker { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--_muted); }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.math { overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
.math + .math { margin-top: 4px; }
.math .katex { font-size: 1.06em; }
.math.big .katex { font-size: 1.14em; }
.case-tag { display: inline-block; margin-top: 8px; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; background: rgba(62, 59, 57, .08); }
.mini { display: block; width: 100%; height: auto; overflow: visible; }
.mini-note { margin-top: 4px; font: 13.5px/1.45 var(--_serif); color: var(--_muted); }
.mini-note .katex { font-size: 1em; }
.note { font: 13.5px/1.5 var(--_serif); color: var(--_muted); margin-top: 6px; }

/* ---------- SVG ---------- */
.sheet { fill: var(--_sheet); stroke: var(--_line); stroke-width: 1; }
.grid { fill: none; stroke: rgba(62, 59, 57, 0.06); stroke-width: 1; }
.axis { fill: none; stroke: rgba(62, 59, 57, 0.4); stroke-width: 1; }
.eqline { stroke: rgba(62, 59, 57, 0.3); stroke-width: 1; stroke-dasharray: 5 5; }
.tick { font: 11px var(--font-body, 'Lato', sans-serif); fill: var(--_muted); font-variant-numeric: tabular-nums; }
.axis-name { font-size: 15px; fill: var(--_ink); }
.panel-title { font: 700 10.5px var(--font-body, 'Lato', sans-serif); letter-spacing: .1em; text-transform: uppercase; fill: var(--_muted); }
.lbl { font: 12px var(--font-body, 'Lato', sans-serif); fill: var(--_ink); }
.lbl.small { font-size: 10.5px; }
.lbl.muted { fill: var(--_muted); }
.lbl.bold { font-weight: 700; }
.lbl.rust { fill: var(--_rust); } .lbl.blue { fill: var(--_blue); } .lbl.plum { fill: var(--_plum); } .lbl.sage { fill: var(--_sage); }
.lbl.m { font-size: 14px; }
.mi { font-family: KaTeX_Math, 'Times New Roman', serif; font-style: italic; }
.mn { font-family: KaTeX_Main, 'Times New Roman', serif; font-style: normal; }

.trace { fill: none; stroke: var(--_rust); stroke-width: 2.6; stroke-linejoin: round; stroke-linecap: round; }
.future { fill: none; stroke: var(--_rust); stroke-width: 1.5; stroke-dasharray: 1.5 4.5; stroke-linecap: round; opacity: .7; }
.envelope { fill: none; stroke: var(--_plum); stroke-width: 1.3; stroke-dasharray: 7 5; opacity: .75; }
.drive-curve { fill: none; stroke: var(--_sage); stroke-width: 1.6; opacity: .7; }
.pen-halo { fill: var(--_rust); fill-opacity: .16; }
.pen { fill: var(--_rust); stroke: var(--_sheet); stroke-width: 2; }
.connector { stroke: rgba(62, 59, 57, 0.38); stroke-width: 1; stroke-dasharray: 3 3; }
.cursor { stroke: rgba(62, 59, 57, 0.3); stroke-width: 1; }
.e0 { stroke: var(--_ink); stroke-width: 1.2; stroke-dasharray: 6 4; opacity: .55; }
.a-pot { fill: var(--_rust); fill-opacity: .5; }
.a-kin { fill: var(--_blue); fill-opacity: .45; }
.edge-pot { fill: none; stroke: var(--_rust); stroke-width: 1.3; }
.edge-kin { fill: none; stroke: var(--_blue); stroke-width: 1.3; }
.bar-pot { fill: var(--_rust); fill-opacity: .62; }
.bar-kin { fill: var(--_blue); fill-opacity: .55; }
.bar-base { stroke: rgba(62, 59, 57, .45); stroke-width: 1; }

/* mechanism */
.ceiling { fill: #e6dfd3; stroke: rgba(62, 59, 57, .55); stroke-width: 1; }
.hatch-line { stroke: rgba(62, 59, 57, .38); stroke-width: 1; }
.coil-back { fill: none; stroke-width: 1.4; stroke-linecap: round; opacity: .42; }
.coil-front { fill: none; stroke-width: 2.1; stroke-linecap: round; }
.lead { stroke-width: 2; stroke-linecap: round; }
.tube { fill: none; stroke: rgba(62, 59, 57, .3); stroke-width: 1.2; }
.tube-glass { fill: rgba(255, 255, 255, .5); }
.fluid { fill: var(--_plum); }
.block { stroke: var(--_ink); stroke-width: 1.4; }
.block-label { font-size: 15px; fill: var(--_ink); }
.mass { cursor: grab; outline: none; }
.mass:focus-visible .block { stroke: var(--text-secondary, #5d4037); stroke-width: 2.4; stroke-dasharray: 4 2; }
.mass.dragging { cursor: grabbing; }
.force { stroke-width: 2.4; stroke-linecap: round; }
.force-head { stroke: none; }
.streak { stroke: var(--_plum); stroke-width: 1.2; stroke-linecap: round; fill: none; }

/* circuit */
.wire { fill: none; stroke: var(--_ink); stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.plate { stroke: var(--_ink); stroke-width: 3.6; stroke-linecap: round; }
.efield { stroke: var(--_rust); stroke-width: 1.4; }
.bfield { fill: none; stroke: var(--_blue); stroke-width: 1.3; }
.charge-dot { fill: var(--_blue); }
.sign-glyph { font: 700 13px var(--font-body, 'Lato', sans-serif); text-anchor: middle; }
.source { fill: var(--_sheet); stroke: var(--_sage); stroke-width: 2; }
.source-wave { fill: none; stroke: var(--_sage); stroke-width: 1.8; stroke-linecap: round; }
.resistor { fill: none; stroke: var(--_ink); stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; }
.i-arrow { fill: none; stroke: var(--_blue); stroke-width: 2.2; stroke-linecap: round; }
.i-head { fill: var(--_blue); }

/* roots / phase / response */
.locus { fill: none; stroke: rgba(62, 59, 57, .18); stroke-width: 5; stroke-linecap: round; }
.circle-w0 { fill: none; stroke: rgba(62, 59, 57, .45); stroke-width: 1; stroke-dasharray: 4 4; }
.decay-half { fill: var(--_sage); fill-opacity: .05; }
.root { fill: var(--_ink); stroke: var(--_sheet); stroke-width: 2; }
.root-ring { fill: none; stroke: var(--_ink); stroke-width: 1.2; opacity: .35; }
.proj { stroke: rgba(62, 59, 57, .45); stroke-width: 1; stroke-dasharray: 2 3; }
.level { fill: none; stroke: rgba(62, 59, 57, .12); stroke-width: 1; }
.level.e0 { stroke: rgba(62, 59, 57, .38); stroke-dasharray: 5 4; opacity: 1; }
.phase-path { fill: none; stroke: var(--_ink); stroke-width: 1.8; stroke-linejoin: round; opacity: .8; }
.gain { fill: none; stroke: var(--_ink); stroke-width: 2; }
.gain-fill { fill: rgba(62, 59, 57, .05); }
.w-marker { stroke: var(--_sage); stroke-width: 1.5; }

@container (max-width: 640px) {
  .analysis-grid { grid-template-columns: minmax(0, 1fr); }
}
@container (max-width: 560px) {
  .osc { padding: 14px 12px 14px; }
  .sliders { grid-template-columns: minmax(0, 1fr); }
  .slider { grid-template-columns: 84px minmax(0, 1fr) 56px; }
  .chip { min-height: 32px; padding: 0 11px; font-size: 13px; }
  .chip .sign { display: none; }
  .caption { font-size: 15px; }
  .problem .row.sol { flex-wrap: wrap; }
  .problem .sol-tex { display: block; max-width: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 2px; }
  .problem .eq .katex, .problem .sol-tex .katex { font-size: 1.04em; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
`;

/* ------------------------------------------------------------------
 * Base element: shadow root, styles, KaTeX, resize, visibility and the animation clock
 * ------------------------------------------------------------------ */

class OscElement extends HTMLElement {
  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this._built = false;
    this._layoutQueued = false;
    this.playing = false;
    this.visible = false;
    this.userPaused = reducedMotion();
    this.speed = 1;
    this.t = 0;
    this._tick = this._tick.bind(this);
  }

  connectedCallback() {
    if (!this._built) {
      this._built = true;
      const style = document.createElement('style');
      style.textContent = STYLE;
      this.live = h('div', { class: 'sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
      this.root.append(katexStyleNode(), style);
      this.build();
      this.root.append(this.live);
    }
    loadKatex().then(() => this.retypeset?.());
    this._resize = new ResizeObserver(() => this.queueLayout());
    this._resize.observe(this);
    this._io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        this.visible = entry.isIntersecting;
        if (this.visible && !this.userPaused) this.play();
        else if (!this.visible) this.stop();
      }
    }, { threshold: 0.12 });
    this._io.observe(this);
    this._onHidden = () => {
      if (document.hidden) this.stop();
      else if (this.visible && !this.userPaused) this.play();
    };
    document.addEventListener('visibilitychange', this._onHidden);
    this.queueLayout();
  }

  disconnectedCallback() {
    this.stop();
    this._resize?.disconnect();
    this._io?.disconnect();
    document.removeEventListener('visibilitychange', this._onHidden);
  }

  queueLayout() {
    if (this._layoutQueued) return;
    this._layoutQueued = true;
    requestAnimationFrame(() => {
      this._layoutQueued = false;
      if (!this.isConnected) return;
      this.layout();
      this.render();
    });
  }

  announce(text) {
    this.live.textContent = '';
    requestAnimationFrame(() => { this.live.textContent = text; });
  }

  play() {
    if (this.playing || document.hidden || this.closest('details:not([open])')) return;
    this.playing = true;
    this._last = null;
    this._raf = requestAnimationFrame(this._tick);
    this.syncPlay();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this._raf);
    this.syncPlay();
  }

  /** Public: the blog calls this when a demo closes. */
  pause() { this.stop(); }

  resume() {
    this.queueLayout();
    if (this.visible && !this.userPaused) this.play();
  }

  togglePlay() {
    if (this.playing) { this.userPaused = true; this.stop(); }
    else { this.userPaused = false; this.play(); }
  }

  /** Start over from t = 0 and keep playing unless the reader paused. */
  restart() {
    this.t = 0;
    this.onRestart?.();
    this.render();
    if (!this.userPaused && this.visible) this.play();
  }

  _tick(now) {
    if (!this.playing) return;
    const dt = this._last == null ? 0 : Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.advance(dt * this.speed);
    this.render();
    this._raf = requestAnimationFrame(this._tick);
  }

  advance(dt) { this.t += dt; }

  syncPlay() {
    if (!this.playBtn) return;
    this.playBtn.innerHTML = ICONS[this.playing ? 'pause' : 'play'] + `<span>${this.playing ? 'Pause' : 'Play'}</span>`;
  }

  /* ---------- shared controls ---------- */

  makeChips(items, onPick, label) {
    const wrap = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': label });
    const buttons = items.map((item, i) => {
      const btn = h('button', { type: 'button', class: 'chip', role: 'radio', 'aria-checked': 'false', tabindex: '-1' });
      btn.append(h('span', { text: item.label }));
      if (item.sign) btn.append(h('span', { class: 'sign', 'aria-hidden': 'true', tex: item.sign }));
      btn.addEventListener('click', () => onPick(i));
      btn.addEventListener('keydown', event => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        if (!(event.key in keys)) return;
        event.preventDefault();
        const j = (i + keys[event.key] + items.length) % items.length;
        onPick(j);
        buttons[j].focus();
      });
      wrap.append(btn);
      return btn;
    });
    wrap.select = i => buttons.forEach((b, j) => {
      b.setAttribute('aria-checked', String(i === j));
      b.tabIndex = i === j || (i < 0 && j === 0) ? 0 : -1;
    });
    return wrap;
  }

  makeSwitch(label, checked, onChange, color) {
    const input = h('input', { type: 'checkbox' });
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    const el = h('label', { class: 'switch' }, input, h('span', { class: 'track', 'aria-hidden': 'true' }), h('span', { class: 'label' }));
    if (color) el.style.setProperty('--switch-on', color);
    richTo(el.querySelector('.label'), label);
    el.input = input;
    return el;
  }

  makeSeg(options, onPick, label) {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    const buttons = options.map(opt => {
      const b = h('button', { type: 'button', 'aria-pressed': 'false', text: opt.label });
      b.addEventListener('click', () => onPick(opt.value));
      wrap.append(b);
      return b;
    });
    wrap.select = value => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === value)));
    return wrap;
  }

  /** Slider with a TeX symbol, a word, a value readout and an optional marked point on the track. */
  makeSlider(def, value, onInput) {
    const input = h('input', { type: 'range', min: def.min, max: def.max, step: def.step, value, 'aria-label': def.aria || def.word });
    const val = h('span', { class: 'val' });
    const notch = h('span', { class: 'notch-label', hidden: true });
    const wrapTrack = h('div', { class: 'track-wrap' }, input, notch);
    const el = h('label', { class: 'slider' },
      h('span', { class: 'name' }, h('span', { tex: def.tex }), h('span', { text: def.word })),
      wrapTrack, val);
    const show = v => {
      val.innerHTML = `${nt(v, def.places ?? 2)}<small>${def.unit || ''}</small>`;
      input.setAttribute('aria-valuetext', `${nt(v, def.places ?? 2)} ${def.unitWord || def.unit || ''}`);
    };
    input.addEventListener('input', () => {
      let v = Number(input.value);
      if (def.snap) {
        const target = def.snap();
        if (target != null && Math.abs(v - target) <= (def.max - def.min) * 0.012) { v = target; }
      }
      show(v);
      onInput(v);
    });
    show(value);
    el.input = input;
    el.set = v => { input.value = String(v); show(v); };
    /** Mark a point on the track: frac in [0, 1] (null hides it). */
    el.setNotch = (frac, label, left = 'rgba(62,59,57,.2)', right = 'rgba(62,59,57,.2)') => {
      if (frac == null || frac < 0 || frac > 1) {
        input.style.removeProperty('--track');
        notch.hidden = true;
        return;
      }
      const at = `calc(8px + (100% - 16px) * ${frac.toFixed(4)})`;
      input.style.setProperty('--track',
        `linear-gradient(to right, ${left} 0, ${left} calc(${at} - 1.5px), var(--_ink) calc(${at} - 1.5px), var(--_ink) calc(${at} + 1.5px), ${right} calc(${at} + 1.5px), ${right} 100%)`);
      notch.hidden = false;
      notch.style.left = at;
      notch.textContent = label;
    };
    return el;
  }

  makeControls() {
    this.playBtn = iconButton('play', 'Play', { class: 'btn primary' });
    this.playBtn.addEventListener('click', () => this.togglePlay());
    const restartBtn = iconButton('reset', 'Restart', { class: 'btn' });
    restartBtn.addEventListener('click', () => this.restart());
    this.speedSeg = this.makeSeg([
      { label: '½×', value: 0.5 }, { label: '1×', value: 1 }, { label: '2×', value: 2 },
    ], v => { this.speed = v; this.speedSeg.select(v); }, 'Playback speed');
    this.speedSeg.select(this.speed);
    this.clock = h('span', { class: 'clock', 'aria-hidden': 'true' });
    this.syncPlay();
    return h('div', { class: 'controls' }, this.playBtn, restartBtn, this.speedSeg, h('span', { class: 'spacer' }), this.clock);
  }

  setClock(t) {
    const text = `t = ${t.toFixed(1)} s`;
    if (this.clock.__text !== text) { this.clock.__text = text; this.clock.textContent = text; }
  }
}

/* ------------------------------------------------------------------
 * Drawing helpers
 * ------------------------------------------------------------------ */

const fx = v => (Math.round(v * 10) / 10).toString();

function pathFrom(pts) {
  if (!pts.length) return '';
  let d = `M${fx(pts[0][0])} ${fx(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += `L${fx(pts[i][0])} ${fx(pts[i][1])}`;
  return d;
}

/**
 * A helix seen slightly from above: back strokes (behind the axis) and front strokes.
 * Axis vertical through x = cx, from yTop to yBot, `turns` full turns.
 */
function helixPaths(cx, yTop, yBot, R, turns, lead = 6) {
  const y0 = yTop + lead;
  const y1 = yBot - lead;
  const tilt = R * 0.34;
  const steps = Math.ceil(turns * 28);
  let back = '';
  let front = '';
  let prevFront = null;
  let prevPt = null;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const th = u * turns * 2 * Math.PI;
    const x = cx + R * Math.sin(th);
    // nearer points (cos θ < 0) sit lower on screen: a helix seen from slightly above
    const y = y0 + (y1 - y0) * u + tilt * (1 - Math.cos(th));
    const isFront = Math.cos(th) <= 0;
    const pt = `${fx(x)} ${fx(y)}`;
    if (isFront !== prevFront) {
      // a new stroke starts at the previous point so the coil has no gaps
      const start = prevPt ? `M${prevPt}L${pt}` : `M${pt}`;
      if (isFront) front += start;
      else back += start;
    } else if (isFront) front += `L${pt}`;
    else back += `L${pt}`;
    prevFront = isFront;
    prevPt = pt;
  }
  const leads = `M${fx(cx)} ${fx(yTop)}L${fx(cx)} ${fx(y0)}M${fx(cx)} ${fx(y1)}L${fx(cx)} ${fx(yBot)}`;
  return { back, front, leads };
}

/** Straight arrow from (x, y0) to (x, y1) as a line plus a head triangle. */
function arrowParts(x, y0, y1, head = 6) {
  const dir = y1 < y0 ? -1 : 1;
  const len = Math.abs(y1 - y0);
  if (len < 3) return { line: '', head: '' };
  const hl = Math.min(head, len * 0.6);
  const yb = y1 - dir * hl;
  return {
    line: `M${fx(x)} ${fx(y0)}L${fx(x)} ${fx(yb)}`,
    head: `M${fx(x - hl * 0.62)} ${fx(yb)}L${fx(x)} ${fx(y1)}L${fx(x + hl * 0.62)} ${fx(yb)}Z`,
  };
}

/** Pool of <text> ticks that are moved and relabelled instead of recreated. */
function tickPool(parent, cls = 'tick') {
  const items = [];
  return list => {
    while (items.length < list.length) items.push(s('text', { class: cls }, parent));
    items.forEach((el, i) => {
      const t = list[i];
      if (!t) { el.setAttribute('display', 'none'); return; }
      el.removeAttribute('display');
      el.setAttribute('x', fx(t.x));
      el.setAttribute('y', fx(t.y));
      el.setAttribute('text-anchor', t.anchor || 'middle');
      if (el.__t !== t.text) { el.__t = t.text; el.textContent = t.text; }
    });
  };
}

function linePool(parent, cls) {
  const items = [];
  return list => {
    while (items.length < list.length) items.push(s('line', { class: cls }, parent));
    items.forEach((el, i) => {
      const l = list[i];
      if (!l) { el.setAttribute('display', 'none'); return; }
      el.removeAttribute('display');
      attr(el, { x1: fx(l[0]), y1: fx(l[1]), x2: fx(l[2]), y2: fx(l[3]) });
    });
  };
}

const INK = [62, 59, 57];
const RUST = [181, 86, 43];
const mix = (c1, c2, f) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * f)).join(',')})`;

/** Radial-gradient glow (0 opacity at the rim). */
function glowGradient(defs, id, color) {
  const g = s('radialGradient', { id, cx: '50%', cy: '50%', r: '50%' }, defs);
  s('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.55 }, g);
  s('stop', { offset: '55%', 'stop-color': color, 'stop-opacity': 0.22 }, g);
  s('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }, g);
  return `url(#${id})`;
}

function hatchPattern(defs, id) {
  const p = s('pattern', { id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  s('rect', { width: 6, height: 6, fill: 'rgba(122, 90, 140, 0.12)' }, p);
  s('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'rgba(122, 90, 140, 0.55)', 'stroke-width': 2 }, p);
  return `url(#${id})`;
}

/* ------------------------------------------------------------------
 * Shared lab: one oscillator with a typed equation, sliders, the exact solution,
 * a time graph, an energy graph and small pictures (roots, phase space, resonance).
 * Subclasses supply `sys` (symbols, sliders, examples) and draw the mechanism.
 *
 * The motion is stored as segments of exact solutions. Most changes restart at t = 0;
 * changing the forcing (F0 or omega) continues from the current position and velocity,
 * so you can sweep the driving frequency through resonance and watch the amplitude respond.
 * ------------------------------------------------------------------ */

const CASE_KEYS = ['undamped', 'under', 'critical', 'over'];

class OscLab extends OscElement {
  build() {
    const sys = this.sys;
    this.p = Object.fromEntries(Object.entries(sys.params).map(([key, def]) => [key, def.value]));
    Object.assign(this.p, sys.examples[sys.startExample]);
    this.forced = false;
    this.showForces = false;
    this.tab = 'roots';
    this.yRange = 1;
    this.eRange = 1;
    this.segs = [];

    const wrap = h('div', { class: 'osc' });

    this.chips = this.makeChips(CASE_KEYS.map(k => ({ label: CASE_NAMES[k], sign: sys.caseSign[k] })),
      i => this.pickExample(CASE_KEYS[i]), 'Examples');
    this.forceSwitch = this.makeSwitch(sys.forcingSwitch, false, on => this.setForced(on), 'var(--_sage)');
    const bar = h('div', { class: 'bar' }, this.chips, h('span', { class: 'spacer' }), this.forceSwitch);

    // the equation you can type
    this.eqInput = h('input', {
      type: 'text', class: 'eq-input', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off',
      'aria-label': `Equation in ${sys.yName}`, placeholder: sys.placeholder,
    });
    this.eqMsg = h('div', { class: 'eq-msg', role: 'status', hidden: true });
    this.icEl = h('span', { class: 'ic tex' });
    this.solEl = h('span', { class: 'sol-tex tex' });
    this.wireInput();
    const problem = h('div', { class: 'problem' },
      h('div', { class: 'row' }, h('label', { class: 'eq-field' }, this.eqInput), this.icEl),
      this.eqMsg,
      h('div', { class: 'row sol' }, this.solEl));

    this.svg = s('svg', { class: 'fig', role: 'img', 'aria-label': sys.figureLabel });
    this.buildFigure();

    const toggles = [];
    if (sys.hasForces) {
      this.forcesSwitch = this.makeSwitch('Forces', false, on => { this.showForces = on; this.render(); });
      toggles.push(this.forcesSwitch);
    }
    const controls = this.makeControls();
    controls.insertBefore(h('span', { class: 'toggles' }, ...toggles), controls.querySelector('.spacer'));

    this.sliderBox = h('div', { class: 'sliders' });
    this.sliders = {};
    for (const [key, def] of Object.entries(sys.params)) {
      const live = key === 'F0' || key === 'w';
      const slider = this.makeSlider({ ...def, snap: def.snap ? () => def.snap(this.p) : null }, this.p[key],
        v => (live ? this.setForcing(key, v) : this.setParam(key, v)));
      if (def.forcing) slider.hidden = true;
      this.sliders[key] = slider;
      this.sliderBox.append(slider);
    }
    const figure = h('div', { class: 'figure' }, this.svg, controls, this.sliderBox);

    // small maths cards
    this.auxNum = h('div', { class: 'math big' });
    this.discEl = h('div', { class: 'math' });
    this.rootsEl = h('div', { class: 'math' });
    const auxCard = h('div', { class: 'card' },
      h('div', { class: 'head' }, h('span', { class: 'kicker', text: 'Auxiliary equation' })),
      this.auxNum, this.discEl, this.rootsEl);

    this.tabSeg = this.makeSeg([
      { label: 'Roots', value: 'roots' }, { label: 'Phase space', value: 'phase' }, { label: 'Resonance', value: 'response' },
    ], v => this.setTab(v), 'Picture');
    this.mini = s('svg', { class: 'mini', viewBox: '0 0 268 184', role: 'img' });
    this.buildMini();
    const picCard = h('div', { class: 'card' }, h('div', { class: 'head' }, this.tabSeg), this.mini);

    const analysis = h('details', { class: 'analysis-details' },
      h('summary', { text: 'Roots, phase space & resonance' }),
      h('div', { class: 'analysis-grid' }, auxCard, picCard));
    analysis.addEventListener('toggle', () => {
      if (analysis.open) this.renderMini();
    });
    wrap.append(bar, problem, h('div', { class: 'layout' }, figure), analysis);
    this.root.append(wrap);

    for (const [key, slider] of Object.entries(this.sliders)) slider.set(this.p[key]);
    this.setTab('roots');
    this.resolve();
  }

  /* ---------- typed equation ---------- */

  wireInput() {
    const input = this.eqInput;
    let timer = null;
    const commit = showErrors => {
      clearTimeout(timer);
      const res = this.readEquation(input.value);
      if (res.error) {
        input.classList.add('invalid');
        if (showErrors) { this.eqMsg.textContent = res.error; this.eqMsg.hidden = false; }
        return;
      }
      input.classList.remove('invalid');
      this.eqMsg.hidden = true;
      this.applyEquation(res);
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => commit(true), 700);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); commit(true); }
      if (event.key === 'Escape') { input.value = this.equationText(); input.classList.remove('invalid'); this.eqMsg.hidden = true; }
    });
    input.addEventListener('blur', () => {
      clearTimeout(timer);
      const res = this.readEquation(input.value);
      if (!res.error) { this.applyEquation(res); input.value = this.equationText(); }
      else commit(true);
    });
  }

  /** Parse and check that the coefficients describe a real system we can animate. */
  readEquation(text) {
    const sys = this.sys;
    let res = parseOde(text, sys.yName);
    if (res.error && sys.yName !== 'y' && /y/i.test(text) && !new RegExp(sys.yName, 'i').test(text)) res = parseOde(text, 'y');
    if (res.error) return res;
    const r = sys.ranges;
    const fmt = v => nt(v, 2);
    if (!(res.a > 0)) return { error: sys.words.aPositive };
    if (res.b < 0) return { error: sys.words.bNonnegative };
    if (!(res.c > 0)) return { error: sys.words.cPositive };
    if (res.a < r.a[0] || res.a > r.a[1]) return { error: `Keep the ${sys.yName}'' coefficient between ${fmt(r.a[0])} and ${fmt(r.a[1])} so the animation stays watchable.` };
    if (res.b > r.b[1]) return { error: `Keep the ${sys.yName}' coefficient at most ${fmt(r.b[1])}.` };
    if (res.c < r.c[0] || res.c > r.c[1]) return { error: `Keep the ${sys.yName} coefficient between ${fmt(r.c[0])} and ${fmt(r.c[1])}.` };
    if (res.F0 > r.F0[1]) return { error: `Keep the forcing amplitude at most ${fmt(r.F0[1])}.` };
    if (res.F0 && (res.w < r.w[0] || res.w > r.w[1])) return { error: `Keep the driving frequency between ${fmt(r.w[0])} and ${fmt(r.w[1])}.` };
    return res;
  }

  applyEquation(res) {
    const same = Object.entries(this.sys.fromCoef(res)).every(([k, v]) => Math.abs(this.p[k] - v) < 1e-9)
      && this.forced === !!res.F0 && (!res.F0 || (Math.abs(this.p.F0 - res.F0) < 1e-9 && Math.abs(this.p.w - res.w) < 1e-9));
    if (same) return;
    Object.assign(this.p, this.sys.fromCoef(res));
    if (res.F0) { this.p.F0 = res.F0; this.p.w = res.w; }
    for (const [key, slider] of Object.entries(this.sliders)) slider.set(this.p[key]);
    this.setForced(!!res.F0, true);
    this.userPaused = false;
    this.resolve();
    this.restart();
  }

  equationText() {
    const { a, b, c } = this.coef();
    return odeText(this.sys.yName, a, b, c, this.forced ? this.p.F0 : 0, this.p.w);
  }

  syncInput() {
    if (this.root.activeElement === this.eqInput) return;
    this.eqInput.value = this.equationText();
    this.eqInput.classList.remove('invalid');
    this.eqMsg.hidden = true;
  }

  /* ---------- state changes ---------- */

  coef() { return this.sys.coef(this.p); }

  pickExample(kind) {
    Object.assign(this.p, this.sys.examples[kind], { y0: 1, v0: 0 });
    for (const [key, slider] of Object.entries(this.sliders)) slider.set(this.p[key]);
    this.userPaused = false;
    this.resolve();
    this.restart();
    this.announce(`${CASE_NAMES[this.sol.kind]}.`);
  }

  setParam(key, v) {
    this.p[key] = v;
    this.resolve();
    this.restart();
  }

  setForced(on, quiet = false) {
    this.forced = on;
    this.forceSwitch.input.checked = on;
    for (const [key, def] of Object.entries(this.sys.params)) if (def.forcing) this.sliders[key].hidden = !on;
    if (on && this.tab !== 'response') this.setTab('response');
    if (!on && this.tab === 'response') this.setTab('roots');
    if (quiet) return;
    this.resolve();
    this.restart();
  }

  /** Change F0 or omega without restarting: a new piece of solution starts from the current state. */
  setForcing(key, v) {
    this.p[key] = v;
    if (key === 'w') this.sliders.w.set(v);
    if (!this.forced) { this.renderMini(); return; }
    const t = this.t;
    const cur = this.segAt(t);
    const y0 = cur.y(t);
    const v0 = cur.v(t);
    const { a, b, c } = this.coef();
    const sol = solveOscillator({ a, b, c, F0: this.p.F0, w: this.p.w, y0, v0, ts: t });
    const last = this.segs[this.segs.length - 1];
    if (t - last.ts < 1e-6) this.segs[this.segs.length - 1] = sol;
    else this.segs.push(sol);
    this.sol = sol;
    this.updateMath();
    this.updateNotches();
    this.syncInput();
    this.renderMini();
    this.render();
  }

  setTab(tab) {
    this.tab = tab;
    this.tabSeg.select(tab);
    for (const [key, g] of Object.entries(this.miniG)) g.style.display = key === tab ? '' : 'none';
    const label = { roots: 'Roots of the auxiliary equation in the complex plane', phase: 'Phase space with curves of constant energy', response: 'Steady-state amplitude against driving frequency; drag to change the driving frequency' }[tab];
    this.mini.setAttribute('aria-label', label);
    this.mini.classList.toggle('draggable', tab === 'response');
    this.renderMini();
  }

  onRestart() {
    if (this.segs.length !== 1 || this.segs[0].ts !== 0) this.resolve();
    else this.fitRanges();
  }

  /** Fresh solution from t = 0 with the current parameters. */
  resolve() {
    const { a, b, c } = this.coef();
    this.sol = solveOscillator({ a, b, c, F0: this.forced ? this.p.F0 : 0, w: this.p.w, y0: this.p.y0, v0: this.p.v0 });
    this.segs = [this.sol];
    this.Tw = clamp(Math.round((10 * Math.PI) / this.sol.w0), 8, 24);
    this.fitRanges();
    this.updateMath();
    this.updateNotches();
    this.syncInput();
    this.renderMini();
    this.render();
  }

  segAt(t) {
    const segs = this.segs;
    for (let i = segs.length - 1; i > 0; i--) if (t >= segs[i].ts) return segs[i];
    return segs[0];
  }

  /** Choose display ranges from the first window. During play they only ever grow. */
  fitRanges() {
    const sol = this.sol;
    let maxAbs = 0;
    let maxE = sol.F0 === 0 ? sol.E0 : 0;
    for (let i = 0; i <= 400; i++) {
      const t = sol.ts + (i / 400) * this.Tw;
      maxAbs = Math.max(maxAbs, Math.abs(sol.y(t)));
      if (sol.F0 !== 0) maxE = Math.max(maxE, sol.kinetic(t) + sol.potential(t));
    }
    this.yRange = Math.max(this.minYRange ?? 0.5, maxAbs);
    this.eRange = Math.max(maxE, 1e-9);
  }

  updateNotches() {
    const sys = this.sys;
    const dk = sys.dampKey;
    const dd = sys.params[dk];
    const { a, c } = this.coef();
    const crit = 2 * Math.sqrt(a * c);
    this.sliders[dk].setNotch((crit - dd.min) / (dd.max - dd.min), 'critical', 'rgba(47,97,135,.28)', 'rgba(122,90,140,.32)');
    const wd = sys.params.w;
    this.sliders.w.setNotch((this.sol.w0 - wd.min) / (wd.max - wd.min), 'ω₀');
  }

  updateMath() {
    const sys = this.sys;
    const sol = this.sol;
    const p = this.p;
    texTo(this.icEl, sys.icTex(p));
    const { a, b, c } = this.coef();
    texTo(this.auxNum, `${sumTex([{ c: a, body: 'r^2' }, { c: b, body: 'r' }, { c, body: '' }])} = 0`);
    texTo(this.discEl, `b^2 - 4ac ${relTex(sol)}`);
    texTo(this.rootsEl, rootsTex(sol));
    this.chips.select(CASE_KEYS.indexOf(sol.kind));

    const Y = sys.yName;
    let tex;
    if (!sol.steady) tex = `${Y}(t) = ${homogeneousTex(sol)}`;
    else {
      const yc = sol.ts > 0 ? `${Y}_c(t)` : homogeneousTex(sol);
      const cLabel = sol.b === 0 ? '\\text{complementary}' : '\\text{complementary} \\,\\to\\, 0';
      tex = `${Y}(t) = \\underbrace{${yc}}_{${cLabel}} + \\underbrace{${steadyTex(sol)}}_{\\text{particular}}`;
    }
    texTo(this.solEl, tex);
    this.svg.setAttribute('aria-label', `${sys.figureLabel}. ${CASE_NAMES[sol.kind]}.`);
  }

  /* ---------- figure ---------- */

  buildFigure() {
    const svg = this.svg;
    const defs = s('defs', null, svg);
    this.fills = {
      hatch: hatchPattern(defs, uid('hatch')),
      kin: glowGradient(defs, uid('kin'), '#2f6187'),
      pot: glowGradient(defs, uid('pot'), '#b5562b'),
      heat: glowGradient(defs, uid('heat'), '#7a5a8c'),
    };
    const clipId = uid('clip');
    this.clipRect = s('rect', null, s('clipPath', { id: clipId }, defs));
    this.defs = defs;

    // time graph
    const gX = s('g', null, svg);
    this.xSheet = s('rect', { class: 'sheet', rx: 4 }, gX);
    this.gridPool = linePool(s('g', null, gX), 'grid');
    this.eqLine = s('path', { class: 'eqline' }, svg);
    this.xTicks = tickPool(s('g', null, gX));
    this.tTicks = tickPool(s('g', null, gX));
    const plot = s('g', { 'clip-path': `url(#${clipId})` }, gX);
    this.envUp = s('path', { class: 'envelope' }, plot);
    this.envDn = s('path', { class: 'envelope' }, plot);
    this.driveCurve = s('path', { class: 'drive-curve' }, plot);
    this.futurePath = s('path', { class: 'future' }, plot);
    this.tracePath = s('path', { class: 'trace' }, plot);
    this.xName = s('text', { class: 'axis-name' }, gX);
    mathText(this.xName, `${this.sys.yPlain}`);
    this.tName = s('text', { class: 'axis-name', 'text-anchor': 'end' }, gX);
    mathText(this.tName, 't');

    // energy graph
    const gE = s('g', null, svg);
    this.eSheet = s('rect', { class: 'sheet', rx: 4 }, gE);
    this.eGridPool = linePool(s('g', null, gE), 'grid');
    this.eTitle = s('text', { class: 'panel-title', 'text-anchor': 'end' }, gE);
    this.eTitle.textContent = 'Energy';
    this.aPot = s('path', { class: 'a-pot' }, gE);
    this.aKin = s('path', { class: 'a-kin' }, gE);
    this.aHeat = s('path', { fill: this.fills.hatch }, gE);
    this.edgePot = s('path', { class: 'edge-pot' }, gE);
    this.edgeKin = s('path', { class: 'edge-kin' }, gE);
    this.e0Line = s('line', { class: 'e0' }, gE);
    this.eCursor = s('line', { class: 'cursor' }, gE);

    // energy bars under the mechanism
    const gB = s('g', null, svg);
    this.gBars = gB;
    this.barKin = s('rect', { class: 'bar-kin', rx: 2 }, gB);
    this.barPot = s('rect', { class: 'bar-pot', rx: 2 }, gB);
    this.barHeat = s('rect', { fill: this.fills.hatch, rx: 2 }, gB);
    this.barBase = s('line', { class: 'bar-base' }, gB);
    this.barE0 = s('line', { class: 'e0' }, gB);
    this.barLabels = this.sys.barLabels.map(text => {
      const t = s('text', { class: 'tick', 'text-anchor': 'middle' }, gB);
      t.textContent = text;
      return t;
    });

    // mechanism
    this.gMech = s('g', null, svg);
    this.buildMech(this.gMech, defs);

    this.connector = s('line', { class: 'connector' }, svg);
    this.penHalo = s('circle', { class: 'pen-halo', r: 9 }, svg);
    this.pen = s('circle', { class: 'pen', r: 4.6 }, svg);
  }

  computeGeom(W) {
    const narrow = W < 520;
    const m = this.mechGeom(W, narrow);
    const g = { W, narrow, mw: m.mw, stackH: m.stackH || 0 };
    g.gl = (g.stackH ? 0 : g.mw) + 36;
    g.gr = W - 6;
    g.top = g.stackH ? g.stackH + 20 : 46;
    g.hx = clamp(Math.round(W * 0.4), 210, 280);
    g.yc = g.top + g.hx / 2;
    g.eTop = g.top + g.hx + 34;
    g.he = narrow ? 92 : 108;
    g.eBot = g.eTop + g.he;
    g.H = g.eBot + 26;
    g.bars = m.bars !== false;
    g.barBase = m.barBase ?? g.eBot;
    g.barH = m.barH ?? g.he;
    g.barX0 = m.barX0 ?? 0;
    g.barX1 = m.barX1 ?? g.mw;
    return g;
  }

  layout() {
    const W = Math.max(280, Math.round(this.svg.getBoundingClientRect().width) || 640);
    const g = this.geom = this.computeGeom(W);
    attr(this.svg, { viewBox: `0 0 ${W} ${g.H}`, height: g.H });
    const pw = g.gr - g.gl;
    attr(this.clipRect, { x: g.gl, y: g.top - 3, width: pw, height: g.hx + 6 });
    attr(this.xSheet, { x: g.gl, y: g.top, width: pw, height: g.hx });
    attr(this.eSheet, { x: g.gl, y: g.eTop, width: pw, height: g.he });
    attr(this.eqLine, { d: g.stackH ? `M${g.gl} ${g.yc}L${g.gr} ${g.yc}` : `M4 ${g.yc}L${g.gl - 30} ${g.yc}M${g.gl} ${g.yc}L${g.gr} ${g.yc}` });
    attr(this.xName, { x: g.gl + 9, y: g.top + 18 });
    attr(this.tName, { x: g.gr - 8, y: g.top + g.hx - 8 });
    attr(this.eTitle, { x: g.gr - 9, y: g.eTop + 15 });

    this.gBars.style.display = g.bars ? '' : 'none';
    if (g.bars) {
      const bw = g.narrow ? 17 : 20;
      const gap = g.narrow ? 9 : 12;
      const total = 3 * bw + 2 * gap;
      const x0 = Math.max(g.barX0 + 6, g.barX0 + (g.barX1 - g.barX0 - total) / 2);
      g.barX = [0, 1, 2].map(i => x0 + i * (bw + gap));
      g.barW = bw;
      attr(this.barBase, { x1: x0 - 4, x2: x0 + total + 4, y1: g.barBase, y2: g.barBase });
      this.barLabels.forEach((t, i) => attr(t, { x: g.barX[i] + bw / 2, y: g.barBase + 14 }));
    }
    this.layoutMech(g);
  }

  /* ---------- per-frame drawing ---------- */

  render() {
    const g = this.geom;
    const sol = this.sol;
    if (!g || !sol) return;
    const Tw = this.Tw;
    const t = this.t;
    const t0 = Math.max(0, t - 0.75 * Tw);
    const t1 = t0 + Tw;
    const N = 320;
    const dtS = Tw / N;
    // forget pieces of solution that have scrolled out of view
    while (this.segs.length > 1 && this.segs[1].ts <= t0) this.segs.shift();
    const Y = tt => this.segAt(tt).y(tt);
    const V = tt => this.segAt(tt).v(tt);

    // samples aligned to absolute time so the curve does not shimmer as it scrolls
    const past = [];
    const future = [];
    let maxAbs = 0;
    let maxE = 0;
    for (let k = Math.ceil(t0 / dtS); k * dtS <= t1 + 1e-9; k++) {
      const tt = k * dtS;
      if (tt < t) {
        past.push(tt);
        const y = Y(tt);
        maxAbs = Math.max(maxAbs, Math.abs(y));
        if (sol.F0 !== 0) maxE = Math.max(maxE, 0.5 * sol.a * V(tt) ** 2 + 0.5 * sol.c * y * y);
      } else {
        future.push(tt);
        maxAbs = Math.max(maxAbs, Math.abs(sol.y(tt)));
      }
    }
    past.push(t);
    future.unshift(t);
    // ranges only grow while the clock runs, so decay always looks like decay
    if (maxAbs > this.yRange) this.yRange += (maxAbs - this.yRange) * (this.playing ? 0.12 : 1);
    if (maxE > this.eRange) this.eRange += (maxE - this.eRange) * (this.playing ? 0.12 : 1);

    const sc = this.sc = ((g.hx / 2) * 0.86) / this.yRange;
    const pw = g.gr - g.gl;
    const tx = tt => g.gl + ((tt - t0) / Tw) * pw;
    const lim = v => clamp(v, g.top - 40, g.top + g.hx + 40);
    const yy = v => lim(g.yc - v * sc);
    const eh = g.he * 0.84;
    const ey = v => g.eBot - (v / this.eRange) * eh;

    // grid and ticks
    const yStep = niceStep(this.yRange, 2);
    const yTicks = [];
    const grid = [];
    for (let v = -Math.floor((this.yRange * 1.12) / yStep) * yStep; v <= this.yRange * 1.12 + 1e-9; v += yStep) {
      const y = g.yc - v * sc;
      if (y < g.top + 6 || y > g.top + g.hx - 6) continue;
      yTicks.push({ x: g.gl - 6, y: y + 4, text: nt(v, 2), anchor: 'end' });
      if (Math.abs(v) > 1e-9) grid.push([g.gl, y, g.gr, y]);
    }
    const tStep = niceStep(Tw, g.narrow ? 4 : 6);
    const tTicks = [];
    const eGrid = [];
    for (let v = Math.ceil(t0 / tStep) * tStep; v <= t1 + 1e-9; v += tStep) {
      const x = tx(v);
      if (x < g.gl + 4 || x > g.gr - 4) continue;
      tTicks.push({ x, y: g.top + g.hx + 15, text: nt(v, 1) });
      grid.push([x, g.top, x, g.top + g.hx]);
      eGrid.push([x, g.eTop, x, g.eBot]);
    }
    this.gridPool(grid);
    this.eGridPool(eGrid);
    this.xTicks(yTicks);
    this.tTicks(tTicks);

    // time graph
    attr(this.tracePath, { d: pathFrom(past.map(tt => [tx(tt), yy(Y(tt))])) });
    attr(this.futurePath, { d: pathFrom(future.map(tt => [tx(tt), yy(sol.y(tt))])) });
    const all = past.concat(future.slice(1));
    if (sol.kind === 'under' && !sol.steady) {
      attr(this.envUp, { d: pathFrom(all.map(tt => [tx(tt), yy(sol.amp * Math.exp(sol.alpha * tt))])) });
      attr(this.envDn, { d: pathFrom(all.map(tt => [tx(tt), yy(-sol.amp * Math.exp(sol.alpha * tt))])) });
    } else {
      attr(this.envUp, { d: '' });
      attr(this.envDn, { d: '' });
    }
    attr(this.driveCurve, {
      d: this.forced ? pathFrom(all.map(tt => { const sg = tt <= t ? this.segAt(tt) : sol; return [tx(tt), yy(sg.force(tt) / sol.c)]; })) : '',
    });

    const y = sol.y(t);
    const v = sol.v(t);
    const px = tx(t);
    const py = yy(y);
    attr(this.pen, { cx: fx(px), cy: fx(py) });
    attr(this.penHalo, { cx: fx(px), cy: fx(py) });

    // energy graph (past only)
    const KE = sol.kinetic(t);
    const PE = sol.potential(t);
    const heat = sol.heat(t);
    const showHeat = !sol.steady && sol.b > 0;
    const pe = past.map(tt => 0.5 * sol.c * Y(tt) ** 2);
    const ke = past.map(tt => 0.5 * sol.a * V(tt) ** 2);
    const xs = past.map(tx);
    const potPts = xs.map((x, i) => [x, ey(pe[i])]);
    const kinPts = xs.map((x, i) => [x, ey(pe[i] + ke[i])]);
    const baseBack = `L${fx(xs[xs.length - 1])} ${fx(g.eBot)}L${fx(xs[0])} ${fx(g.eBot)}Z`;
    const backAlong = pts => pts.slice().reverse().map(q => `${fx(q[0])} ${fx(q[1])}`).join('L');
    attr(this.aPot, { d: pathFrom(potPts) + baseBack });
    attr(this.aKin, { d: `${pathFrom(kinPts)}L${backAlong(potPts)}Z` });
    attr(this.edgePot, { d: pathFrom(potPts) });
    attr(this.edgeKin, { d: pathFrom(kinPts) });
    if (showHeat) {
      const e0y = ey(sol.E0);
      attr(this.aHeat, { d: `M${fx(xs[0])} ${fx(e0y)}L${fx(xs[xs.length - 1])} ${fx(e0y)}L${backAlong(kinPts)}Z` });
    } else attr(this.aHeat, { d: '' });
    if (!sol.steady && sol.E0 > 0) {
      const e0y = ey(sol.E0);
      attr(this.e0Line, { x1: g.gl, x2: g.gr, y1: e0y, y2: e0y, display: null });
    } else attr(this.e0Line, { display: 'none' });
    attr(this.eCursor, { x1: px, x2: px, y1: g.eTop, y2: g.eBot });

    // bars
    if (g.bars) {
      const by = val => g.barBase - (val / this.eRange) * g.barH * 0.84;
      const vals = [KE, PE, showHeat ? heat : 0];
      [this.barKin, this.barPot, this.barHeat].forEach((rect, i) => {
        const hgt = Math.max(0, g.barBase - by(vals[i]));
        attr(rect, { x: g.barX[i], width: g.barW, y: fx(g.barBase - hgt), height: fx(hgt) });
      });
      this.barHeat.style.display = showHeat ? '' : 'none';
      this.barLabels[2].style.display = showHeat ? '' : 'none';
      if (!sol.steady && sol.E0 > 0) {
        const e0y = by(sol.E0);
        attr(this.barE0, { x1: g.barX[0] - 4, x2: g.barX[2] + g.barW + 4, y1: e0y, y2: e0y, display: null });
      } else attr(this.barE0, { display: 'none' });
    }

    const st = { t, y, v, KE, PE, heat, power: sol.b * v * v, F: this.forced ? sol.force(t) : 0, yPix: py, sc };
    this.renderMech(st);
    if (this.connectorX != null) attr(this.connector, { x1: fx(this.connectorX), y1: fx(py), x2: fx(px - 6), y2: fx(py), display: null });
    else attr(this.connector, { display: 'none' });

    if (this.tab === 'phase') this.renderPhase();
    else if (this.tab === 'response' && this.forced) this.renderResponseLive(y);
    this.setClock(t);
  }

  /* ---------- small pictures: roots, phase space, resonance ---------- */

  buildMini() {
    const svg = this.mini;
    const W = 268;
    const H = 184;
    this.miniG = { roots: s('g', null, svg), phase: s('g', null, svg), response: s('g', null, svg) };

    const R = this.miniG.roots;
    const r = this.rt = {};
    r.half = s('rect', { class: 'decay-half' }, R);
    r.locusArc = s('path', { class: 'locus' }, R);
    r.locusLine = s('line', { class: 'locus' }, R);
    r.circle = s('circle', { class: 'circle-w0' }, R);
    r.axRe = s('line', { class: 'axis' }, R);
    r.axIm = s('line', { class: 'axis' }, R);
    r.reLbl = s('text', { class: 'lbl small muted', 'text-anchor': 'end' }, R);
    r.reLbl.textContent = 'Re';
    r.imLbl = s('text', { class: 'lbl small muted' }, R);
    r.imLbl.textContent = 'Im';
    r.w0Lbl = s('text', { class: 'lbl small', 'text-anchor': 'middle' }, R);
    mathText(r.w0Lbl, '−ω_0');
    r.projA = s('line', { class: 'proj' }, R);
    r.projB = s('line', { class: 'proj' }, R);
    r.aLbl = s('text', { class: 'lbl', 'text-anchor': 'middle' }, R);
    r.bLbl = s('text', { class: 'lbl' }, R);
    r.rings = [s('circle', { class: 'root-ring', r: 9 }, R), s('circle', { class: 'root-ring', r: 9 }, R)];
    r.dots = [s('circle', { class: 'root', r: 5.2 }, R), s('circle', { class: 'root', r: 5.2 }, R)];
    r.dotLbls = [s('text', { class: 'lbl', 'text-anchor': 'middle' }, R), s('text', { class: 'lbl', 'text-anchor': 'middle' }, R)];
    r.W = W;
    r.H = H;

    const P = this.miniG.phase;
    const ph = this.ph = {};
    ph.levels = [0, 1, 2, 3].map(() => s('circle', { class: 'level' }, P));
    ph.e0 = s('circle', { class: 'level e0' }, P);
    ph.axX = s('line', { class: 'axis' }, P);
    ph.axV = s('line', { class: 'axis' }, P);
    ph.xLbl = s('text', { class: 'axis-name', 'text-anchor': 'end' }, P);
    ph.vLbl = s('text', { class: 'axis-name' }, P);
    mathText(ph.xLbl, this.sys.yPlain);
    mathText(ph.vLbl, this.sys.vPlain);
    ph.path = s('path', { class: 'phase-path' }, P);
    ph.halo = s('circle', { class: 'pen-halo', r: 8 }, P);
    ph.dot = s('circle', { class: 'pen', r: 4.4 }, P);

    const Q = this.miniG.response;
    const rs = this.rs = {};
    rs.hit = s('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' }, Q);
    rs.fill = s('path', { class: 'gain-fill' }, Q);
    rs.axX = s('line', { class: 'axis' }, Q);
    rs.axY = s('line', { class: 'axis' }, Q);
    rs.w0 = s('line', { class: 'proj' }, Q);
    rs.curve = s('path', { class: 'gain' }, Q);
    rs.liveAmp = s('line', { class: 'amp-now' }, Q);
    rs.drive = s('line', { class: 'w-marker' }, Q);
    rs.handleHalo = s('circle', { r: 11, class: 'w-halo' }, Q);
    rs.driveDot = s('circle', { r: 5.5, class: 'w-dot' }, Q);
    rs.ticks = tickPool(Q);
    rs.wLbl = s('text', { class: 'axis-name', 'text-anchor': 'end' }, Q);
    mathText(rs.wLbl, 'ω');
    rs.yLbl = s('text', { class: 'lbl small muted' }, Q);
    rs.yLbl.textContent = 'amplitude';
    rs.aLbl = s('text', { class: 'lbl small bold sage' }, Q);
    this.wireResponseDrag(Q);
  }

  /** Drag across the resonance picture to set the driving frequency (turns forcing on). */
  wireResponseDrag(group) {
    const toW = clientX => {
      const rect = this.mini.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 268;
      const g = this.respGeom;
      return clamp(Math.round(((x - g.x0) / (g.x1 - g.x0)) * g.wMax * 100) / 100, this.sys.params.w.min, Math.min(this.sys.params.w.max, g.wMax));
    };
    group.addEventListener('pointerdown', event => {
      if (!this.respGeom) return;
      event.preventDefault();
      group.setPointerCapture?.(event.pointerId);
      if (!this.forced) { this.setForced(true); this.userPaused = false; this.play(); }
      const move = ev => this.setForcing('w', toW(ev.clientX));
      const up = () => {
        group.removeEventListener('pointermove', move);
        group.removeEventListener('pointerup', up);
        group.removeEventListener('pointercancel', up);
      };
      group.addEventListener('pointermove', move);
      group.addEventListener('pointerup', up);
      group.addEventListener('pointercancel', up);
      move(event);
    });
  }

  renderMini() {
    if (!this.sol || !this.miniG) return;
    if (this.tab === 'roots') this.renderRoots();
    else if (this.tab === 'phase') this.renderPhase();
    else this.renderResponse();
  }

  renderRoots() {
    const r = this.rt;
    const sol = this.sol;
    const { W, H } = r;
    const ox = Math.round(W * 0.72);
    const oy = H / 2;
    const w0 = sol.w0;
    const minRe = Math.min(...sol.roots.map(z => z.re));
    const Rl = Math.max(1.3 * w0, 1.1 * Math.abs(minRe));
    const sg = Math.min((ox - 12) / Rl, (oy - 18) / (1.2 * w0));
    const rad = w0 * sg;
    attr(r.half, { x: 0, y: 0, width: ox, height: H });
    attr(r.locusArc, { d: `M${ox} ${fx(oy - rad)}A${fx(rad)} ${fx(rad)} 0 0 0 ${fx(ox - rad)} ${oy}A${fx(rad)} ${fx(rad)} 0 0 0 ${ox} ${fx(oy + rad)}` });
    attr(r.locusLine, { x1: fx(ox - rad), y1: oy, x2: 4, y2: oy });
    attr(r.circle, { cx: ox, cy: oy, r: fx(rad) });
    attr(r.axRe, { x1: 2, x2: W - 2, y1: oy, y2: oy });
    attr(r.axIm, { x1: ox, x2: ox, y1: 2, y2: H - 2 });
    attr(r.reLbl, { x: W - 4, y: oy - 6 });
    attr(r.imLbl, { x: ox + 6, y: 12 });

    const pts = sol.roots.map(z => [ox + z.re * sg, oy - z.im * sg]);
    pts.forEach((q, i) => {
      attr(r.dots[i], { cx: fx(q[0]), cy: fx(q[1]) });
      attr(r.rings[i], { cx: fx(q[0]), cy: fx(q[1]) });
    });
    const complex = sol.kind === 'under' || sol.kind === 'undamped';
    r.rings[1].style.display = sol.kind === 'critical' ? 'none' : '';
    r.dots[1].style.display = sol.kind === 'critical' ? 'none' : '';
    if (complex) {
      const [x, y] = pts[0];
      attr(r.projA, { x1: fx(x), y1: fx(y), x2: fx(x), y2: oy, display: sol.kind === 'under' ? null : 'none' });
      attr(r.projB, { x1: fx(x), y1: fx(y), x2: ox, y2: fx(y), display: null });
      attr(r.aLbl, { x: fx(x), y: oy + 15, display: sol.kind === 'under' ? null : 'none' });
      mathText(r.aLbl, 'α');
      attr(r.bLbl, { x: ox + 6, y: fx(y + 4), display: null });
      mathText(r.bLbl, sol.kind === 'undamped' ? 'ω_0' : 'β');
      attr(r.dotLbls[0], { display: 'none' });
      attr(r.dotLbls[1], { display: 'none' });
      attr(r.w0Lbl, { x: fx(ox - rad - 12), y: oy + 16, display: sol.kind === 'under' && Math.abs(x - (ox - rad)) < 26 ? 'none' : null });
    } else {
      attr(r.projA, { display: 'none' });
      attr(r.projB, { display: 'none' });
      attr(r.aLbl, { display: 'none' });
      attr(r.bLbl, { display: 'none' });
      if (sol.kind === 'critical') {
        attr(r.dotLbls[0], { x: fx(pts[0][0]), y: oy - 14, display: null });
        r.dotLbls[0].textContent = '×2';
        attr(r.dotLbls[1], { display: 'none' });
        attr(r.w0Lbl, { x: fx(ox - rad - 10), y: oy + 22, display: null });
      } else {
        const close = Math.abs(pts[0][0] - pts[1][0]) < 24;
        attr(r.dotLbls[0], { x: fx(pts[0][0]), y: oy - 14, display: null });
        attr(r.dotLbls[1], { x: fx(pts[1][0]), y: close ? oy + 22 : oy - 14, display: null });
        mathText(r.dotLbls[0], 'r_1');
        mathText(r.dotLbls[1], 'r_2');
        attr(r.w0Lbl, { display: 'none' });
      }
    }
  }

  renderPhase() {
    const ph = this.ph;
    const sol = this.sol;
    const W = 268;
    const H = 184;
    const cx = W / 2;
    const cy = H / 2;
    const Rmax = Math.sqrt((2 * this.eRange) / sol.c) || 1;
    const sg = (H / 2 - 12) / (Rmax * 1.04);
    [0.25, 0.5, 0.75, 1].forEach((f, i) => attr(ph.levels[i], { cx, cy, r: fx(Math.sqrt(f) * Rmax * sg) }));
    if (!sol.steady && sol.E0 > 0) attr(ph.e0, { cx, cy, r: fx(Math.sqrt((2 * sol.E0) / sol.c) * sg), display: null });
    else attr(ph.e0, { display: 'none' });
    attr(ph.axX, { x1: 10, x2: W - 10, y1: cy, y2: cy });
    attr(ph.axV, { x1: cx, x2: cx, y1: 4, y2: H - 4 });
    attr(ph.xLbl, { x: W - 8, y: cy - 7 });
    attr(ph.vLbl, { x: cx + 7, y: 15 });
    const t = this.t;
    const span = Math.min(t, this.Tw * 1.5, t - (this.segs[0]?.ts ?? 0));
    const pts = [];
    const steps = 260;
    for (let i = 0; i <= steps; i++) {
      const tt = t - span + (span * i) / steps;
      const sg2 = this.segAt(tt);
      pts.push([cx + sg2.y(tt) * sg, cy - (sg2.v(tt) / sol.w0) * sg]);
    }
    attr(ph.path, { d: pathFrom(pts) });
    const last = pts[pts.length - 1];
    attr(ph.dot, { cx: fx(last[0]), cy: fx(last[1]) });
    attr(ph.halo, { cx: fx(last[0]), cy: fx(last[1]) });
  }

  renderResponse() {
    const rs = this.rs;
    const sol = this.sol;
    const W = 268;
    const H = 184;
    const x0 = 14;
    const x1 = W - 10;
    const yb = H - 26;
    const yt = 18;
    const { a, b, c, w0 } = sol;
    const F0 = this.p.F0;
    // fixed frequency range, so dragging never rescales the picture under the pointer
    const wMax = Math.min(this.sys.params.w.max, Math.max(3 * w0, 4));
    const amp = w => F0 / Math.sqrt((c - a * w * w) ** 2 + (b * w) ** 2);
    const CAP = (8 * F0) / c;
    let aMax = F0 / c;
    const pts = [];
    for (let i = 0; i <= 300; i++) {
      const w = (i / 300) * wMax;
      const av = Math.min(CAP, amp(w));
      aMax = Math.max(aMax, av);
      pts.push([w, av]);
    }
    const yTop = aMax * 1.12 || 1;
    const X = w => x0 + (w / wMax) * (x1 - x0);
    const Yp = av => yb - (Math.min(av, CAP) / yTop) * (yb - yt);
    this.respGeom = { x0, x1, wMax, X, Yp, amp, yTop };
    const d = pathFrom(pts.map(([w, av]) => [X(w), Yp(av)]));
    attr(rs.curve, { d });
    attr(rs.fill, { d: `${d}L${fx(X(wMax))} ${yb}L${x0} ${yb}Z` });
    attr(rs.axX, { x1: x0, x2: x1, y1: yb, y2: yb });
    attr(rs.axY, { x1: x0, x2: x0, y1: yt - 10, y2: yb });
    attr(rs.w0, { x1: fx(X(w0)), x2: fx(X(w0)), y1: yt - 8, y2: yb });
    attr(rs.wLbl, { x: x1, y: yb - 6 });
    attr(rs.yLbl, { x: x0 + 5, y: yt - 6 });
    const ticks = [{ x: x0, y: yb + 14, text: '0' }];
    for (let k = 1; k <= Math.floor(wMax / w0 + 1e-9); k++) ticks.push({ x: X(k * w0), y: yb + 14, text: k === 1 ? 'ω₀' : `${k}ω₀` });
    rs.ticks(ticks);
    const on = this.forced;
    const w = clamp(this.p.w, 0, wMax);
    const gx = X(w);
    const gy = Yp(amp(w));
    attr(rs.drive, { x1: fx(gx), x2: fx(gx), y1: yt - 8, y2: yb, opacity: on ? 1 : 0.35 });
    attr(rs.driveDot, { cx: fx(gx), cy: fx(gy), opacity: on ? 1 : 0.45 });
    attr(rs.handleHalo, { cx: fx(gx), cy: fx(gy), opacity: on ? 1 : 0.45 });
    const big = amp(w) > CAP;
    const right = gx > W - 70;
    attr(rs.aLbl, { x: fx(right ? gx - 12 : gx + 12), y: fx(clamp(gy - 10, yt + 4, yb - 6)), 'text-anchor': right ? 'end' : 'start', display: on ? null : 'none' });
    attr(rs.liveAmp, { display: on ? null : 'none' });
    const label = big ? (sol.b === 0 ? 'A → ∞' : `A ≈ ${nt(amp(w), 1)}`) : `A = ${nt(amp(w), 2)}`;
    if (rs.aLbl.textContent !== label) rs.aLbl.textContent = label;
  }

  /** The amplitude the mass actually has right now, against the steady-state prediction. */
  renderResponseLive(y) {
    const rg = this.respGeom;
    if (!rg) return;
    // recent peak of |y| over the last driving period, as a short sage tick on the current omega line
    const sol = this.sol;
    const T = (2 * Math.PI) / Math.max(sol.w, 0.1);
    let peak = Math.abs(y);
    for (let k = 1; k <= 24; k++) {
      const tt = this.t - (T * k) / 24;
      if (tt < (this.segs[0]?.ts ?? 0)) break;
      peak = Math.max(peak, Math.abs(this.segAt(tt).y(tt)));
    }
    const gx = rg.X(clamp(this.p.w, 0, rg.wMax));
    const py = rg.Yp(Math.min(peak, rg.yTop));
    attr(this.rs.liveAmp, { x1: fx(gx - 9), x2: fx(gx + 9), y1: fx(py), y2: fx(py) });
  }
}

/* ------------------------------------------------------------------
 * <spring-mass-lab> and <lc-circuit-lab>: the two physical systems
 * ------------------------------------------------------------------ */

function relTex(sol) {
  if (sol.kind === 'critical') return '= 0';
  const d = sol.disc;
  return `= ${n(d, Math.abs(d) < 0.1 ? 3 : 2)} ${d < 0 ? '<' : '>'} 0`;
}

/* Slider and typed-equation limits shared by both systems (y'' coefficient a, y' coefficient b, y coefficient c). */
const RANGES = { a: [0.25, 5], b: [0, 20], c: [0.5, 25], F0: [0, 5], w: [0.1, 8] };

const SPRING_SYS = {
  yName: 'x',
  yPlain: 'x',
  vPlain: 'x′',
  dampKey: 'g',
  hasForces: true,
  figureLabel: 'Mass on a spring in a viscous fluid, next to graphs of its position and energy',
  forcingSwitch: 'Forcing $F_0 \\cos \\omega t$',
  placeholder: "x'' + 2x' + 5x = 0",
  caseSign: { undamped: '\\gamma = 0', under: '\\Delta < 0', critical: '\\Delta = 0', over: '\\Delta > 0' },
  // clean examples: roots ±2i, −1 ± 2i, −2 (double), −1 and −3
  examples: {
    undamped: { m: 1, g: 0, k: 4 },
    under: { m: 1, g: 2, k: 5 },
    critical: { m: 1, g: 4, k: 4 },
    over: { m: 1, g: 4, k: 3 },
  },
  startExample: 'under',
  params: {
    m: { tex: 'm', word: 'mass', min: 0.25, max: 5, step: 0.05, value: 1, unit: 'kg', unitWord: 'kilograms' },
    k: { tex: 'k', word: 'spring', min: 0.5, max: 25, step: 0.05, value: 5, unit: 'N/m', unitWord: 'newtons per metre' },
    g: { tex: '\\gamma', word: 'damping', min: 0, max: 20, step: 0.05, value: 2, unit: 'kg/s', unitWord: 'kilograms per second', snap: p => 2 * Math.sqrt(p.m * p.k) },
    w: { tex: '\\omega', word: 'drive', min: 0.1, max: 8, step: 0.01, value: 1.5, unit: 'rad/s', unitWord: 'radians per second', forcing: true, snap: p => Math.sqrt(p.k / p.m) },
    F0: { tex: 'F_0', word: 'force', min: 0, max: 5, step: 0.05, value: 1, unit: 'N', unitWord: 'newtons', forcing: true },
    y0: { tex: 'x(0)', word: 'start', min: -1.5, max: 1.5, step: 0.05, value: 1, unit: 'm', unitWord: 'metres' },
    v0: { tex: "x'(0)", word: 'kick', min: -5, max: 5, step: 0.05, value: 0, unit: 'm/s', unitWord: 'metres per second' },
  },
  ranges: RANGES,
  coef: p => ({ a: p.m, b: p.g, c: p.k }),
  fromCoef: ({ a, b, c }) => ({ m: a, g: b, k: c }),
  words: {
    aPositive: "The mass (the x'' coefficient) has to be positive.",
    bNonnegative: "Damping (the x' coefficient) can't be negative: it would add energy instead of removing it.",
    cPositive: 'The spring constant (the x coefficient) has to be positive.',
  },
  icTex: p => `x(0) = ${n(p.y0)}, \\ \\ x'(0) = ${n(p.v0)}`,
  barLabels: ['KE', 'PE', 'heat'],
  forceLabels: ['−kx', '−γx′', 'F'],
};

const CIRCUIT_SYS = {
  yName: 'q',
  yPlain: 'q',
  vPlain: 'I',
  dampKey: 'R',
  hasForces: false,
  figureLabel: 'Circuit with an inductor, capacitor and resistor, next to graphs of the charge and energy',
  forcingSwitch: 'Source $V_0 \\cos \\omega t$',
  placeholder: "q'' + 2q' + 5q = 0",
  caseSign: { undamped: 'R = 0', under: '\\Delta < 0', critical: '\\Delta = 0', over: '\\Delta > 0' },
  examples: {
    undamped: { L: 1, R: 0, C: 1 / 4 },
    under: { L: 1, R: 2, C: 1 / 5 },
    critical: { L: 1, R: 4, C: 1 / 4 },
    over: { L: 1, R: 4, C: 1 / 3 },
  },
  startExample: 'undamped',
  params: {
    L: { tex: 'L', word: 'inductance', min: 0.25, max: 5, step: 0.05, value: 1, unit: 'H', unitWord: 'henries' },
    C: { tex: 'C', word: 'capacitance', min: 0.04, max: 2, step: 0.01, value: 0.25, unit: 'F', unitWord: 'farads' },
    R: { tex: 'R', word: 'resistance', min: 0, max: 20, step: 0.05, value: 0, unit: 'Ω', unitWord: 'ohms', snap: p => 2 * Math.sqrt(p.L / p.C) },
    w: { tex: '\\omega', word: 'drive', min: 0.1, max: 8, step: 0.01, value: 1.5, unit: 'rad/s', unitWord: 'radians per second', forcing: true, snap: p => 1 / Math.sqrt(p.L * p.C) },
    F0: { tex: 'V_0', word: 'voltage', min: 0, max: 5, step: 0.05, value: 1, unit: 'V', unitWord: 'volts', forcing: true },
    y0: { tex: 'q(0)', word: 'charge', min: -1.5, max: 1.5, step: 0.05, value: 1, unit: 'C', unitWord: 'coulombs' },
    v0: { tex: 'I(0)', word: 'current', min: -5, max: 5, step: 0.05, value: 0, unit: 'A', unitWord: 'amperes' },
  },
  ranges: RANGES,
  coef: p => ({ a: p.L, b: p.R, c: 1 / p.C }),
  fromCoef: ({ a, b, c }) => ({ L: a, R: b, C: 1 / c }),
  words: {
    aPositive: "The inductance L (the q'' coefficient) has to be positive.",
    bNonnegative: "Resistance R (the q' coefficient) can't be negative.",
    cPositive: 'The q coefficient is 1/C, so it has to be positive.',
  },
  icTex: p => `q(0) = ${n(p.y0)}, \\ \\ I(0) = ${n(p.v0)}`,
  barLabels: ['in L', 'in C', 'heat'],
};

/** Glass tube outline with rounded bottom corners. */
function tubePath(left, right, top, bottom, r, closed) {
  const d = `M${fx(left)} ${fx(top)}L${fx(left)} ${fx(bottom - r)}Q${fx(left)} ${fx(bottom)} ${fx(left + r)} ${fx(bottom)}L${fx(right - r)} ${fx(bottom)}Q${fx(right)} ${fx(bottom)} ${fx(right)} ${fx(bottom - r)}L${fx(right)} ${fx(top)}`;
  return closed ? `${d}Z` : d;
}

class SpringMassLab extends OscLab {
  get sys() { return SPRING_SYS; }

  mechGeom(W, narrow) { return { mw: narrow ? 100 : 126 }; }

  fitRanges() {
    super.fitRanges();
    // never smaller than the start slider, so dragging the mass maps one-to-one
    this.yRange = Math.max(this.yRange, 1.5);
  }

  buildMech(gm, defs) {
    const M = this.m = {};
    const blockId = uid('block');
    const lg = s('linearGradient', { id: blockId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    s('stop', { offset: '0%', 'stop-color': '#fffdf8' }, lg);
    s('stop', { offset: '100%', 'stop-color': '#e6ddcf' }, lg);
    M.glass = s('path', { class: 'tube-glass' }, gm);
    M.fluid = s('path', { class: 'fluid' }, gm);
    M.surface = s('line', { stroke: '#7a5a8c', 'stroke-width': 1 }, gm);
    M.heatGlow = s('ellipse', { fill: this.fills.heat }, gm);
    M.tube = s('path', { class: 'tube' }, gm);
    M.gammaLbl = s('text', { class: 'lbl small muted', 'text-anchor': 'middle' }, gm);
    M.ceiling = s('rect', { class: 'ceiling' }, gm);
    M.hatch = linePool(s('g', null, gm), 'hatch-line');
    M.streakG = s('g', null, gm);
    M.streaks = linePool(M.streakG, 'streak');
    M.back = s('path', { class: 'coil-back' }, gm);
    M.lead = s('path', { class: 'lead', fill: 'none' }, gm);
    M.front = s('path', { class: 'coil-front' }, gm);
    M.massG = s('g', { class: 'mass', tabindex: 0, role: 'slider', 'aria-label': 'Mass: drag it up or down, or use the arrow keys, to choose where it starts' }, gm);
    M.glow = s('circle', { fill: this.fills.kin }, M.massG);
    M.block = s('rect', { class: 'block', rx: 4, fill: `url(#${blockId})` }, M.massG);
    M.label = s('text', { class: 'block-label', 'text-anchor': 'middle' }, M.massG);
    mathText(M.label, 'm');
    M.forces = [['var(--_rust)', 'rust'], ['var(--_plum)', 'plum'], ['var(--_sage)', 'sage']].map(([color, cls], i) => {
      const fg = s('g', null, gm);
      const label = s('text', { class: `lbl small ${cls}`, 'text-anchor': 'middle' }, fg);
      mathText(label, this.sys.forceLabels[i]);
      return { line: s('path', { class: 'force', style: `stroke:${color}` }, fg), head: s('path', { class: 'force-head', style: `fill:${color}` }, fg), label };
    });
    this.wireDrag(M.massG);
  }

  wireDrag(el) {
    el.addEventListener('pointerdown', event => {
      event.preventDefault();
      const id = event.pointerId;
      el.setPointerCapture?.(id);
      el.classList.add('dragging');
      this.stop();
      const move = ev => this.dragTo(ev.clientY);
      const up = () => {
        el.releasePointerCapture?.(id);
        el.classList.remove('dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        this.userPaused = false;
        this.restart();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      this.dragTo(event.clientY);
    });
    el.addEventListener('keydown', event => {
      const d = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 }[event.key];
      if (d == null) return;
      event.preventDefault();
      this.setStart(this.p.y0 + d);
      this.restart();
    });
  }

  dragTo(clientY) {
    const rect = this.svg.getBoundingClientRect();
    const y = (clientY - rect.top) * (this.geom.H / rect.height);
    this.setStart((this.geom.yc - y) / this.sc);
  }

  setStart(val) {
    val = clamp(Math.round(val * 20) / 20, -1.5, 1.5);
    this.p.y0 = val;
    this.p.v0 = 0;
    this.sliders.y0.set(val);
    this.sliders.v0.set(0);
    this.t = 0;
    this.resolve();
    this.m.massG.setAttribute('aria-valuetext', `starts at x = ${nt(val)}`);
  }

  layoutMech(g) {
    const M = this.m;
    const cx = M.cx = g.mw / 2 + 2;
    const tw = M.tw = g.narrow ? 60 : 70;
    const ceilY = 6;
    const ceilH = 10;
    M.ceilBot = ceilY + ceilH;
    const cw = tw + 22;
    attr(M.ceiling, { x: fx(cx - cw / 2), y: ceilY, width: cw, height: ceilH });
    const hatch = [];
    for (let x = cx - cw / 2 + 2; x + ceilH - 2 <= cx + cw / 2; x += 7) hatch.push([x, M.ceilBot - 1, x + ceilH - 2, ceilY + 1]);
    M.hatch(hatch);
    const left = cx - tw / 2;
    const right = cx + tw / 2;
    const bottom = g.top + g.hx + 6;
    const fluidTop = M.ceilBot + 18;
    attr(M.glass, { d: tubePath(left, right, M.ceilBot, bottom, 12, true) });
    attr(M.fluid, { d: tubePath(left, right, fluidTop, bottom, 12, true) });
    attr(M.surface, { x1: left, x2: right, y1: fluidTop, y2: fluidTop });
    attr(M.tube, { d: tubePath(left, right, M.ceilBot, bottom, 12, false) });
    attr(M.gammaLbl, { x: fx(cx), y: bottom + 16 });
    M.gammaLbl.__v = null;
  }

  renderMech(st) {
    const M = this.m;
    const g = this.geom;
    const sol = this.sol;
    const bw = clamp(34 * Math.cbrt(this.p.m), 24, M.tw - 14);
    const bh = Math.round(bw * 0.74);
    const yc = st.yPix;
    const top = yc - bh / 2;

    // the spring reddens as it stores potential energy
    const R = clamp(bw * 0.3, 7, 11);
    const hp = helixPaths(M.cx, M.ceilBot, top, R, 9, 6);
    const pf = clamp(st.PE / this.eRange, 0, 1);
    const col = mix(INK, RUST, Math.min(1, pf * 1.25));
    attr(M.back, { d: hp.back, stroke: col });
    attr(M.front, { d: hp.front, stroke: col, 'stroke-width': fx(1.8 + 1.5 * pf) });
    attr(M.lead, { d: hp.leads, stroke: col });

    // the block glows blue as it carries kinetic energy
    attr(M.block, { x: fx(M.cx - bw / 2), y: fx(top), width: fx(bw), height: bh });
    attr(M.label, { x: fx(M.cx), y: fx(yc + 5) });
    const kf = clamp(st.KE / this.eRange, 0, 1);
    attr(M.glow, { cx: fx(M.cx), cy: fx(yc), r: fx(bw * 1.15), opacity: kf.toFixed(3) });

    // fluid: thicker with more damping, warmer while it is absorbing energy
    const zeta = sol.b / (2 * Math.sqrt(sol.a * sol.c));
    const visc = clamp(zeta / 2.2, 0, 1);
    const fluidOpacity = sol.b > 0 ? 0.06 + 0.24 * Math.sqrt(visc) : 0;
    attr(M.fluid, { opacity: fluidOpacity.toFixed(3) });
    attr(M.surface, { opacity: sol.b > 0 ? (0.25 + 0.5 * Math.sqrt(visc)).toFixed(3) : 0 });
    const hf = sol.b > 0 ? clamp(st.power / (sol.w0 * this.eRange), 0, 1) : 0;
    attr(M.heatGlow, { cx: fx(M.cx), cy: fx(yc), rx: fx(M.tw * 0.62), ry: fx(bh * 2), opacity: hf.toFixed(3) });
    const gl = `γ = ${nt(sol.b)}`;
    if (M.gammaLbl.__v !== gl) { M.gammaLbl.__v = gl; mathText(M.gammaLbl, gl); }

    // wake in the fluid beside the block, trailing the motion
    const vs = clamp(Math.abs(st.v) / (sol.w0 * this.yRange), 0, 1);
    if (sol.b > 0 && vs > 0.06) {
      const dir = st.v > 0 ? 1 : -1;
      const len = vs * bh * 1.5;
      const lines = [];
      for (const side of [-1, 1]) {
        for (const off of [5, 10]) {
          const x = M.cx + side * (bw / 2 + off);
          const y0 = yc + dir * (off === 5 ? 0 : bh * 0.25);
          lines.push([x, y0, x, y0 + dir * len * (off === 5 ? 1 : 0.6)]);
        }
      }
      M.streaks(lines);
      M.streakG.setAttribute('opacity', (0.25 + 0.6 * visc).toFixed(3));
    } else M.streaks([]);

    // forces, drawn to the same scale as the displacement (force / k)
    const forces = this.showForces ? [-sol.c * st.y, -sol.b * st.v, sol.steady ? st.F : 0] : [0, 0, 0];
    const xs = [M.cx - bw / 2 - 7, M.cx + bw / 2 + 7, M.cx + M.tw / 2 + 9];
    forces.forEach((F, i) => {
      const L = clamp((F / sol.c) * this.sc, -g.hx * 0.46, g.hx * 0.46);
      const ap = arrowParts(xs[i], yc, yc - L, 7);
      attr(M.forces[i].line, { d: ap.line });
      attr(M.forces[i].head, { d: ap.head });
      const show = Math.abs(L) > 10;
      attr(M.forces[i].label, { x: fx(xs[i]), y: fx(yc - L + (L > 0 ? -5 : 13)), display: show ? null : 'none' });
    });

    this.connectorX = M.cx + bw / 2 + 2;
  }
}

class LcCircuitLab extends OscLab {
  get sys() { return CIRCUIT_SYS; }

  mechGeom(W) {
    if (W >= 660) return { mw: Math.round(clamp(W * 0.44, 320, 420)) };
    if (W < 460) return { mw: 0, stackH: 272, boxW: W, bars: false };
    const stackH = 272;
    const boxW = Math.min(330, Math.round(W * 0.64));
    return { mw: 0, stackH, boxW, bars: true, barBase: stackH - 40, barH: stackH - 78, barX0: boxW, barX1: W - 4 };
  }

  fitRanges() {
    super.fitRanges();
    this.yRange = Math.max(this.yRange, 1.5);
  }

  buildMech(gm) {
    const C = this.cm = {};
    C.eGlow = s('ellipse', { fill: this.fills.pot }, gm);
    C.bGlow = s('ellipse', { fill: this.fills.kin }, gm);
    C.rGlow = s('ellipse', { fill: this.fills.heat }, gm);
    C.lobeG = s('g', null, gm);
    C.lobes = [];
    for (let k = 0; k < 6; k++) C.lobes.push({ path: s('path', { class: 'bfield' }, C.lobeG), head: s('path', { class: 'i-head' }, C.lobeG) });
    C.core = { line: s('path', { class: 'bfield' }, C.lobeG), head: s('path', { class: 'i-head' }, C.lobeG) };
    C.wire = s('path', { class: 'wire' }, gm);
    C.rBypass = s('path', { class: 'wire' }, gm);
    C.resistor = s('path', { class: 'resistor' }, gm);
    C.vBypass = s('path', { class: 'wire' }, gm);
    C.source = s('circle', { class: 'source' }, gm);
    C.sourceWave = s('path', { class: 'source-wave' }, gm);
    C.coilBack = s('path', { class: 'coil-back', stroke: '#3e3b39' }, gm);
    C.coilFront = s('path', { class: 'coil-front', stroke: '#3e3b39' }, gm);
    C.coilLead = s('path', { class: 'lead', stroke: '#3e3b39', fill: 'none' }, gm);
    C.eG = s('g', null, gm);
    C.eLines = [0, 1, 2, 3].map(() => ({ line: s('path', { class: 'efield' }, C.eG), head: s('path', { style: 'fill: var(--_rust)' }, C.eG) }));
    C.plates = [s('line', { class: 'plate' }, gm), s('line', { class: 'plate' }, gm)];
    C.glyphs = [];
    for (let k = 0; k < 8; k++) C.glyphs.push(s('text', { class: 'sign-glyph', style: 'fill: var(--_rust)' }, gm));
    C.dotsG = s('g', null, gm);
    C.dots = [];
    C.iArc = s('path', { class: 'i-arrow' }, gm);
    C.iHead = s('path', { class: 'i-head' }, gm);
    C.iLbl = s('text', { class: 'lbl m', 'text-anchor': 'middle' }, gm);
    mathText(C.iLbl, 'I');
    C.labels = ['C', 'L', 'R', 'V(t)'].map(t => {
      const el = s('text', { class: 'lbl m' }, gm);
      mathText(el, t);
      return el;
    });
  }

  layoutMech(g) {
    const C = this.cm;
    let box;
    if (g.stackH) box = { x: 0, y: 2, w: this.mechGeom(g.W).boxW, h: g.stackH - 12 };
    else box = { x: 2, y: 4, w: g.mw - 8, h: g.top + g.hx - 2 };
    const xL = box.x + 58;
    const xR = box.x + box.w - 58;
    const yT = box.y + 30;
    const yB = box.y + box.h - 42;
    const ym = (yT + yB) / 2;
    const xm = (xL + xR) / 2;
    const gap = 11;
    const pw = 24;
    const ch = Math.min(52, (yB - yT) * 0.23);
    const rl = Math.min(28, (xR - xL) * 0.24);
    Object.assign(C, { xL, xR, yT, yB, ym, xm, gap, pw, ch, rl });

    attr(C.wire, {
      d: `M${xL} ${ym - gap}L${xL} ${yT}L${fx(xm - rl)} ${yT}M${fx(xm + rl)} ${yT}L${xR} ${yT}L${xR} ${fx(ym - ch)}` +
         `M${xR} ${fx(ym + ch)}L${xR} ${yB}L${fx(xm + 15)} ${yB}M${fx(xm - 15)} ${yB}L${xL} ${yB}L${xL} ${ym + gap}`,
    });
    attr(C.rBypass, { d: `M${fx(xm - rl)} ${yT}L${fx(xm + rl)} ${yT}` });
    let zig = `M${fx(xm - rl)} ${yT}L${fx(xm - rl + 4)} ${yT}`;
    const peaks = 6;
    const span = 2 * rl - 8;
    for (let k = 0; k < peaks; k++) zig += `L${fx(xm - rl + 4 + (span * (k + 0.5)) / peaks)} ${yT + (k % 2 ? 8 : -8)}`;
    zig += `L${fx(xm + rl - 4)} ${yT}L${fx(xm + rl)} ${yT}`;
    attr(C.resistor, { d: zig });
    attr(C.vBypass, { d: `M${fx(xm - 15)} ${yB}L${fx(xm + 15)} ${yB}` });
    attr(C.source, { cx: fx(xm), cy: yB, r: 15 });
    let wave = '';
    for (let k = 0; k <= 20; k++) {
      const x = xm - 9 + (18 * k) / 20;
      const y = yB - 5 * Math.sin((2 * Math.PI * k) / 20);
      wave += `${k ? 'L' : 'M'}${fx(x)} ${fx(y)}`;
    }
    attr(C.sourceWave, { d: wave });

    const hp = helixPaths(xR, ym - ch, ym + ch, 12, 6, 3);
    attr(C.coilBack, { d: hp.back });
    attr(C.coilFront, { d: hp.front });
    attr(C.coilLead, { d: hp.leads });

    attr(C.plates[0], { x1: xL - pw, x2: xL + pw, y1: ym - gap, y2: ym - gap });
    attr(C.plates[1], { x1: xL - pw, x2: xL + pw, y1: ym + gap, y2: ym + gap });

    attr(C.eGlow, { cx: xL, cy: ym, rx: 54, ry: 42 });
    attr(C.bGlow, { cx: xR, cy: ym, rx: 46, ry: fx(ch + 40) });
    attr(C.rGlow, { cx: fx(xm), cy: yT, rx: fx(rl + 20), ry: 22 });

    C.lobeGeom = [];
    for (let k = 0; k < 3; k++) {
      const rx = 6 + 6 * k;
      const ry = ch + 10 + 11 * k;
      for (const side of [1, -1]) {
        const cx = xR + side * (rx + 3);
        C.lobeGeom.push({ cx, rx, ry, outer: cx + side * rx });
      }
    }
    C.lobeGeom.forEach((L, k) => attr(C.lobes[k].path, { d: `M${fx(L.cx - L.rx)} ${fx(ym)}A${L.rx} ${fx(L.ry)} 0 1 0 ${fx(L.cx + L.rx)} ${fx(ym)}A${L.rx} ${fx(L.ry)} 0 1 0 ${fx(L.cx - L.rx)} ${fx(ym)}` }));

    // the loop that charge travels, from the bottom plate round to the top plate
    const P = [[xL, ym + gap], [xL, yB], [xR, yB], [xR, yT], [xL, yT], [xL, ym - gap]];
    const segs = [];
    let total = 0;
    for (let k = 1; k < P.length; k++) {
      const len = Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
      segs.push({ a: P[k - 1], b: P[k], s0: total, len });
      total += len;
    }
    C.segs = segs;
    C.loopLen = total;
    const count = Math.round(total / 17);
    C.spacing = total / count;
    while (C.dots.length < count) C.dots.push(s('circle', { class: 'charge-dot', r: 2.7 }, C.dotsG));
    C.dots.forEach((d, k) => { d.style.display = k < count ? '' : 'none'; });
    C.dotCount = count;

    const [lc, ll, lr, lv] = C.labels;
    attr(lc, { x: xL - pw - 9, y: ym + 5, 'text-anchor': 'end' });
    attr(ll, { x: xR + 48, y: ym + 5, 'text-anchor': 'middle' });
    attr(lr, { x: fx(xm), y: yT - 14, 'text-anchor': 'middle' });
    attr(lv, { x: fx(xm), y: yB + 33, 'text-anchor': 'middle' });
    attr(C.iLbl, { x: fx(xm - 4), y: ym + 5 });
  }

  pointAt(sArc) {
    const C = this.cm;
    let s0 = ((sArc % C.loopLen) + C.loopLen) % C.loopLen;
    for (const seg of C.segs) {
      if (s0 <= seg.len) {
        const f = s0 / seg.len;
        return [seg.a[0] + (seg.b[0] - seg.a[0]) * f, seg.a[1] + (seg.b[1] - seg.a[1]) * f];
      }
      s0 -= seg.len;
    }
    return C.segs[C.segs.length - 1].b;
  }

  renderMech(st) {
    const C = this.cm;
    const sol = this.sol;
    const q = st.y;
    const i = st.v;
    const qn = clamp(Math.abs(q) / this.yRange, 0, 1);
    const iRange = sol.w0 * this.yRange;
    const inn = clamp(Math.abs(i) / iRange, 0, 1);
    const { xL, xR, ym, gap, xm } = C;

    // energy glows: electric (capacitor), magnetic (inductor), heat (resistor)
    attr(C.eGlow, { opacity: clamp(st.PE / this.eRange, 0, 1).toFixed(3) });
    attr(C.bGlow, { opacity: clamp(st.KE / this.eRange, 0, 1).toFixed(3) });
    const hf = sol.b > 0 ? clamp(st.power / (sol.w0 * this.eRange), 0, 1) : 0;
    attr(C.rGlow, { opacity: hf.toFixed(3) });

    const hasR = sol.b > 0;
    C.resistor.style.display = hasR ? '' : 'none';
    C.rBypass.style.display = hasR ? 'none' : '';
    C.labels[2].style.display = hasR ? '' : 'none';
    const hasV = !!sol.steady;
    C.source.style.display = hasV ? '' : 'none';
    C.sourceWave.style.display = hasV ? '' : 'none';
    C.vBypass.style.display = hasV ? 'none' : '';
    C.labels[3].style.display = hasV ? '' : 'none';

    // electric field between the plates, from + to −
    const down = q >= 0;
    C.eLines.forEach((e, k) => {
      const x = xL - 13.5 + 9 * k;
      const ya = down ? ym - gap + 3 : ym + gap - 3;
      const yb = down ? ym + gap - 3 : ym - gap + 3;
      const ap = arrowParts(x, ya, yb, 5);
      attr(e.line, { d: ap.line });
      attr(e.head, { d: ap.head });
    });
    C.eG.setAttribute('opacity', (qn * 0.95).toFixed(3));

    // charge on the plates: glyphs fill in as |q| grows
    for (let k = 0; k < 4; k++) {
      const op = clamp(4 * qn - k, 0, 1).toFixed(3);
      const x = xL - 15 + 10 * k;
      const top = C.glyphs[k];
      const bot = C.glyphs[4 + k];
      attr(top, { x: fx(x), y: fx(ym - gap - 6), opacity: op });
      attr(bot, { x: fx(x), y: fx(ym + gap + 15), opacity: op });
      const tTxt = down ? '+' : MINUS;
      const bTxt = down ? MINUS : '+';
      if (top.textContent !== tTxt) top.textContent = tTxt;
      if (bot.textContent !== bTxt) bot.textContent = bTxt;
    }

    // magnetic field of the coil: up through the core when i > 0, back down outside
    C.lobeG.setAttribute('opacity', (inn * 0.9).toFixed(3));
    const dir = i >= 0 ? 1 : -1;
    C.lobeGeom.forEach((L, k) => {
      const ap = arrowParts(L.outer, ym - dir * 5, ym + dir * 5, 6);
      attr(C.lobes[k].head, { d: ap.head });
    });
    const coreAp = arrowParts(xR, ym + dir * 18, ym - dir * 18, 7);
    attr(C.core.line, { d: coreAp.line });
    attr(C.core.head, { d: coreAp.head });

    // charges around the loop: displacement along the wire is proportional to q
    const kappa = 46 / this.yRange;
    for (let k = 0; k < C.dotCount; k++) {
      const [x, y] = this.pointAt(k * C.spacing + kappa * q);
      attr(C.dots[k], { cx: fx(x), cy: fx(y) });
    }

    // current arrow in the middle of the loop (counterclockwise on screen when i > 0)
    if (inn > 0.03) {
      const r = 22;
      const cxA = xm - 4;
      const span = inn * 1.6 * Math.PI;
      const sgn = i > 0 ? -1 : 1;
      const a0 = Math.PI - sgn * span / 2;
      const pts = [];
      for (let k = 0; k <= 30; k++) {
        const a = a0 + (sgn * span * k) / 30;
        pts.push([cxA + r * Math.cos(a), ym + r * Math.sin(a)]);
      }
      const a1 = a0 + sgn * span;
      const tx = -Math.sin(a1) * sgn;
      const ty = Math.cos(a1) * sgn;
      const [ex, ey] = pts[pts.length - 1];
      const hl = 7;
      const bx = ex - tx * hl;
      const by = ey - ty * hl;
      attr(C.iArc, { d: pathFrom(pts.slice(0, -2)), display: null });
      attr(C.iHead, { d: `M${fx(bx - ty * 4)} ${fx(by + tx * 4)}L${fx(ex + tx * 2)} ${fx(ey + ty * 2)}L${fx(bx + ty * 4)} ${fx(by - tx * 4)}Z`, display: null });
      C.iLbl.style.opacity = '1';
    } else {
      attr(C.iArc, { display: 'none' });
      attr(C.iHead, { display: 'none' });
      C.iLbl.style.opacity = '0.35';
    }
    this.connectorX = null;
  }
}

/* ------------------------------------------------------------------
 * <damping-cases>: four springs, identical except for the damping,
 * released together, in order of damping: none, under, critical, over.
 * ------------------------------------------------------------------ */

const RACE = [
  { key: 'undamped', name: 'Undamped', short: 'None', zeta: 0, cls: 'rust', hex: '#b5562b', sign: 'Δ < 0' },
  { key: 'under', name: 'Underdamped', short: 'Under', zeta: 0.15, cls: 'blue', hex: '#2f6187', sign: 'Δ < 0' },
  { key: 'critical', name: 'Critical', short: 'Critical', zeta: 1, cls: 'sage', hex: '#4a7a56', sign: 'Δ = 0' },
  { key: 'over', name: 'Overdamped', short: 'Over', zeta: 2.5, cls: 'plum', hex: '#7a5a8c', sign: 'Δ > 0' },
];

class DampingCases extends OscElement {
  build() {
    this.m = 1;
    this.k = 4;
    this.x0 = 1;
    this.forced = false;
    this.F0 = 2;
    this.w = 1.2;
    this.Tw = 16;
    this.yRange = 1.5;

    const wrap = h('div', { class: 'osc' });
    this.forceSwitch = this.makeSwitch('Forcing $F_0 \\cos \\omega t$', false, on => {
      this.forced = on;
      this.sliders.forEach(sl => { sl.hidden = !on; });
      this.sliderBox.hidden = !on;
      this.resolve();
      this.restart();
    }, 'var(--_sage)');
    this.eqLabel = h('span', { class: 'eq tex' });
    this.icLabel = h('span', { class: 'ic tex' });
    const bar = h('div', { class: 'bar' },
      h('div', { class: 'problem', style: 'margin:0' }, h('div', { class: 'row' }, this.eqLabel, this.icLabel)),
      h('span', { class: 'spacer' }), this.forceSwitch);

    this.svg = s('svg', { class: 'fig', role: 'img', 'aria-label': 'Four springs with different damping released from the same height, and their positions over time' });
    this.buildFigure();
    const controls = this.makeControls();
    this.sliders = [
      this.makeSlider({ tex: 'F_0', word: 'force', min: 0, max: 5, step: 0.05, unit: 'N' }, this.F0, v => { this.F0 = v; this.resolve(); this.restart(); }),
      this.makeSlider({ tex: '\\omega', word: 'drive', min: 0.1, max: 6, step: 0.01, unit: 'rad/s', snap: () => 2 }, this.w, v => { this.w = v; this.resolve(); this.restart(); }),
    ];
    this.sliders.forEach(sl => { sl.hidden = true; });
    this.sliders[1].setNotch((2 - 0.1) / 5.9, 'ω₀');
    const sliderBox = this.sliderBox = h('div', { class: 'sliders', hidden: true }, ...this.sliders);
    wrap.append(bar, h('div', { style: 'margin-top: 12px' }, this.svg), controls, sliderBox);
    this.root.append(wrap);
    this.resolve();
  }

  resolve() {
    const crit = 2 * Math.sqrt(this.m * this.k);
    this.sols = RACE.map(c => solveOscillator({ a: this.m, b: c.zeta * crit, c: this.k, F0: this.forced ? this.F0 : 0, w: this.w, y0: this.x0, v0: 0 }));
    // time each one stays within 2% of the start for good
    this.settle = this.sols.map(sol => {
      if (this.forced || Math.abs(this.x0) < 1e-6 || sol.b === 0) return null;
      const tol = 0.02 * Math.abs(this.x0);
      let last = 0;
      for (let t = 0; t <= 60; t += 0.01) if (Math.abs(sol.y(t)) > tol) last = t;
      return last;
    });
    this.fitRange();
    texTo(this.eqLabel, `m\\,x'' + \\gamma\\,x' + k\\,x = ${this.forced ? `${n(this.F0)}\\cos ${angTex(this.w)}` : '0'}`);
    texTo(this.icLabel, `m = 1, \\ k = 4, \\ x(0) = ${n(this.x0)}, \\ x'(0) = 0`);
    this.render();
  }

  fitRange() {
    let maxAbs = 1.25;
    for (const sol of this.sols) for (let i = 0; i <= 300; i++) maxAbs = Math.max(maxAbs, Math.abs(sol.y((i / 300) * this.Tw)));
    this.yRange = maxAbs;
  }

  onRestart() { this.fitRange(); this._finished = false; }

  play() {
    if (this._finished) return;
    super.play();
  }

  togglePlay() {
    if (!this.playing && this._finished) {
      this.userPaused = false;
      this.restart();
      return;
    }
    super.togglePlay();
  }

  syncPlay() {
    if (!this.playBtn) return;
    if (!this.playing && this._finished) this.playBtn.innerHTML = `${ICONS.reset}<span>Replay</span>`;
    else super.syncPlay();
  }

  advance(dt) {
    this.t += dt;
    // stop once every spring is at rest and the whole race is on screen
    if (!this.forced && !this._finished && this.t >= this.Tw) {
      this.t = this.Tw;
      this._finished = true;
      requestAnimationFrame(() => this.stop());
    }
  }

  buildFigure() {
    const svg = this.svg;
    const defs = s('defs', null, svg);
    const blockId = uid('block');
    const lg = s('linearGradient', { id: blockId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    s('stop', { offset: '0%', 'stop-color': '#fffdf8' }, lg);
    s('stop', { offset: '100%', 'stop-color': '#e6ddcf' }, lg);
    const clipId = uid('clip');
    this.clipRect = s('rect', null, s('clipPath', { id: clipId }, defs));

    this.sheet = s('rect', { class: 'sheet', rx: 4 }, svg);
    this.gridPool = linePool(s('g', null, svg), 'grid');
    this.eqLine = s('path', { class: 'eqline' }, svg);
    this.eqLine2 = s('line', { class: 'eqline' }, svg);
    this.yTicks = tickPool(s('g', null, svg));
    this.tTicks = tickPool(s('g', null, svg));
    const plot = s('g', { 'clip-path': `url(#${clipId})` }, svg);
    this.flagLines = RACE.map(c => s('line', { style: `stroke:${c.hex}; stroke-width: 1.2; stroke-dasharray: 3 3; opacity: .8` }, plot));
    this.futures = RACE.map(c => s('path', { class: 'future', style: `stroke:${c.hex}` }, plot));
    this.traces = RACE.map(c => s('path', { class: 'trace', style: `stroke:${c.hex}` }, plot));
    this.flagDots = RACE.map(c => s('circle', { r: 4, style: `fill:${c.hex}; stroke: #fdfcf9; stroke-width: 1.5` }, plot));
    this.flagLbls = RACE.map(c => s('text', { class: `lbl small bold ${c.cls}` }, svg));
    this.pens = RACE.map(c => s('circle', { class: 'pen', r: 4.4, style: `fill:${c.hex}` }, svg));
    this.xName = s('text', { class: 'axis-name' }, svg);
    mathText(this.xName, 'x');
    this.tName = s('text', { class: 'axis-name', 'text-anchor': 'end' }, svg);
    mathText(this.tName, 't');

    this.cols = RACE.map(c => {
      const g = s('g', { class: 'mass', 'aria-hidden': 'true' }, svg);
      const col = { c, g };
      col.glass = s('path', { class: 'tube-glass' }, g);
      col.fluid = s('path', { class: 'fluid' }, g);
      col.tube = s('path', { class: 'tube' }, g);
      col.ceiling = s('rect', { class: 'ceiling' }, g);
      col.hatch = linePool(s('g', null, g), 'hatch-line');
      col.back = s('path', { class: 'coil-back', stroke: '#3e3b39' }, g);
      col.lead = s('path', { class: 'lead', stroke: '#3e3b39', fill: 'none' }, g);
      col.front = s('path', { class: 'coil-front', stroke: '#3e3b39' }, g);
      col.block = s('rect', { class: 'block', rx: 4, fill: `url(#${blockId})`, style: `stroke:${c.hex}; stroke-width: 2` }, g);
      col.tint = s('rect', { rx: 4, style: `fill:${c.hex}; opacity: .16; pointer-events: none` }, g);
      col.name = s('text', { class: `lbl bold ${c.cls}`, 'text-anchor': 'middle' }, svg);
      col.sign = s('text', { class: 'lbl', 'text-anchor': 'middle' }, svg);
      col.gamma = s('text', { class: 'lbl small muted', 'text-anchor': 'middle' }, svg);
      this.wireDrag(g);
      return col;
    });
  }

  wireDrag(el) {
    el.addEventListener('pointerdown', event => {
      event.preventDefault();
      const id = event.pointerId;
      el.setPointerCapture?.(id);
      el.classList.add('dragging');
      this.stop();
      const move = ev => this.dragTo(ev.clientY);
      const up = () => {
        el.releasePointerCapture?.(id);
        el.classList.remove('dragging');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        this.userPaused = false;
        this.restart();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      this.dragTo(event.clientY);
    });
  }

  dragTo(clientY) {
    const rect = this.svg.getBoundingClientRect();
    const y = (clientY - rect.top) * (this.geom.H / rect.height);
    this.x0 = clamp(Math.round(((this.geom.ycM - y) / this.sc) * 20) / 20, -1.25, 1.25);
    this.t = 0;
    this.resolve();
  }

  layout() {
    const W = Math.max(280, Math.round(this.svg.getBoundingClientRect().width) || 640);
    const g = this.geom = { W };
    g.stacked = W < 560;
    if (!g.stacked) {
      g.col = W >= 860 ? 90 : 74;
      g.mz = g.col * 4;
      g.gl = g.mz + 40;
      g.top = 46;
      g.hx = clamp(Math.round(W * 0.42), 250, 300);
      g.ycM = g.ycG = g.top + g.hx / 2;
      g.mTop = g.top;
      g.labelY = g.top + g.hx + 28;
      g.gTop = g.top;
      g.H = g.top + g.hx + 72;
      g.tickY = g.top + g.hx + 15;
    } else {
      g.col = (W - 8) / 4;
      g.mz = W;
      g.top = 46;
      g.hxM = 210;
      g.ycM = g.top + g.hxM / 2;
      g.labelY = g.top + g.hxM + 28;
      g.gTop = g.labelY + 60;
      g.gl = 36;
      g.hx = 230;
      g.ycG = g.gTop + g.hx / 2;
      g.H = g.gTop + g.hx + 24;
      g.tickY = g.gTop + g.hx + 15;
    }
    g.gr = W - 6;
    attr(this.svg, { viewBox: `0 0 ${W} ${g.H}`, height: g.H });
    const pw = g.gr - g.gl;
    attr(this.clipRect, { x: g.gl, y: g.gTop - 3, width: pw, height: g.hx + 6 });
    attr(this.sheet, { x: g.gl, y: g.gTop, width: pw, height: g.hx });
    attr(this.eqLine, { d: g.stacked ? `M4 ${g.ycM}L${W - 4} ${g.ycM}` : `M4 ${g.ycM}L${g.gl - 30} ${g.ycM}M${g.gl} ${g.ycM}L${g.gr} ${g.ycM}` });
    attr(this.eqLine2, { x1: g.gl, x2: g.gr, y1: g.ycG, y2: g.ycG, display: g.stacked ? null : 'none' });
    attr(this.xName, { x: g.gl + 9, y: g.gTop + 18 });
    attr(this.tName, { x: g.gr - 8, y: g.gTop + g.hx - 8 });

    const tubeBottom = (g.stacked ? g.top + g.hxM : g.top + g.hx) + 6;
    this.cols.forEach((col, i) => {
      const cx = col.cx = 4 + g.col * (i + 0.5);
      const tw = col.tw = Math.min(56, g.col - 16);
      const cw = tw + 16;
      const ceilY = 6;
      const ceilH = 9;
      col.ceilBot = ceilY + ceilH;
      attr(col.ceiling, { x: fx(cx - cw / 2), y: ceilY, width: cw, height: ceilH });
      const hatch = [];
      for (let x = cx - cw / 2 + 2; x + ceilH - 2 <= cx + cw / 2; x += 7) hatch.push([x, col.ceilBot - 1, x + ceilH - 2, ceilY + 1]);
      col.hatch(hatch);
      attr(col.glass, { d: tubePath(cx - tw / 2, cx + tw / 2, col.ceilBot, tubeBottom, 10, true) });
      attr(col.fluid, { d: tubePath(cx - tw / 2, cx + tw / 2, col.ceilBot + 16, tubeBottom, 10, true), opacity: col.c.zeta > 0 ? (0.06 + 0.24 * Math.sqrt(clamp(col.c.zeta / 2.2, 0, 1))).toFixed(3) : 0 });
      attr(col.tube, { d: tubePath(cx - tw / 2, cx + tw / 2, col.ceilBot, tubeBottom, 10, false) });
      attr(col.name, { x: fx(cx), y: g.labelY });
      col.name.textContent = g.col < 86 ? col.c.short : col.c.name;
      attr(col.sign, { x: fx(cx), y: g.labelY + 17 });
      mathText(col.sign, col.c.sign);
      attr(col.gamma, { x: fx(cx), y: g.labelY + 33 });
      mathText(col.gamma, `γ = ${nt(col.c.zeta * 4)}`);
    });
  }

  render() {
    const g = this.geom;
    if (!g || !this.sols) return;
    const Tw = this.Tw;
    const t = this.t;
    // unforced: the whole race fits in one window; forced: scroll like a chart recorder
    const t0 = Math.max(0, this.forced ? t - 0.75 * Tw : t - Tw);
    const t1 = t0 + Tw;
    const N = 300;
    const dtS = Tw / N;
    const past = [];
    const future = [];
    let maxAbs = 0;
    for (let k = Math.ceil(t0 / dtS); k * dtS <= t1 + 1e-9; k++) {
      const tt = k * dtS;
      if (tt < t) past.push(tt);
      else future.push(tt);
      for (const sol of this.sols) maxAbs = Math.max(maxAbs, Math.abs(sol.y(tt)));
    }
    past.push(t);
    future.unshift(t);
    if (maxAbs > this.yRange) this.yRange += (maxAbs - this.yRange) * (this.playing ? 0.12 : 1);
    const hxM = g.stacked ? g.hxM : g.hx;
    const sc = this.sc = ((Math.min(hxM, g.hx) / 2) * 0.86) / this.yRange;
    const pw = g.gr - g.gl;
    const tx = tt => g.gl + ((tt - t0) / Tw) * pw;
    const yG = v => clamp(g.ycG - v * sc, g.gTop - 30, g.gTop + g.hx + 30);

    const yStep = niceStep(this.yRange, 2);
    const yTicks = [];
    const grid = [];
    for (let v = -Math.floor((this.yRange * 1.12) / yStep) * yStep; v <= this.yRange * 1.12 + 1e-9; v += yStep) {
      const y = g.ycG - v * sc;
      if (y < g.gTop + 6 || y > g.gTop + g.hx - 6) continue;
      yTicks.push({ x: g.gl - 6, y: y + 4, text: nt(v, 2), anchor: 'end' });
      if (Math.abs(v) > 1e-9) grid.push([g.gl, y, g.gr, y]);
    }
    const tStep = niceStep(Tw, g.W < 520 ? 4 : 6);
    const tTicks = [];
    for (let v = Math.ceil(t0 / tStep) * tStep; v <= t1 + 1e-9; v += tStep) {
      const x = tx(v);
      if (x < g.gl + 4 || x > g.gr - 4) continue;
      tTicks.push({ x, y: g.tickY, text: nt(v, 1) });
      grid.push([x, g.gTop, x, g.gTop + g.hx]);
    }
    this.gridPool(grid);
    this.yTicks(yTicks);
    this.tTicks(tTicks);


    let row = 0;
    this.sols.forEach((sol, i) => {
      attr(this.traces[i], { d: pathFrom(past.map(tt => [tx(tt), yG(sol.y(tt))])) });
      attr(this.futures[i], { d: pathFrom(future.map(tt => [tx(tt), yG(sol.y(tt))])) });
      const y = sol.y(t);
      attr(this.pens[i], { cx: fx(tx(t)), cy: fx(yG(y)) });

      // "at rest" flag once the curve has settled for good
      const Ts = this.settle[i];
      if (Ts != null && t >= Ts && tx(Ts) >= g.gl - 1) {
        const x = tx(Ts);
        attr(this.flagLines[i], { x1: fx(x), x2: fx(x), y1: g.gTop, y2: g.gTop + g.hx, display: null });
        attr(this.flagDots[i], { cx: fx(x), cy: fx(yG(sol.y(Ts))), display: null });
        const ly = g.gTop + 15 + 15 * row++;
        const right = x > g.gr - 90;
        attr(this.flagLbls[i], { x: fx(right ? x - 5 : x + 5), y: ly, 'text-anchor': right ? 'end' : 'start', display: null });
        const text = `at rest · ${nt(Ts, 1)} s`;
        if (this.flagLbls[i].textContent !== text) this.flagLbls[i].textContent = text;
      } else {
        attr(this.flagLines[i], { display: 'none' });
        attr(this.flagDots[i], { display: 'none' });
        attr(this.flagLbls[i], { display: 'none' });
      }

      // the spring itself
      const col = this.cols[i];
      const bw = Math.min(34, col.tw - 12);
      const bh = Math.round(bw * 0.74);
      const yc = g.ycM - y * sc;
      const top = yc - bh / 2;
      const hp = helixPaths(col.cx, col.ceilBot, top, Math.min(10, bw * 0.3), 9, 6);
      attr(col.back, { d: hp.back });
      attr(col.front, { d: hp.front });
      attr(col.lead, { d: hp.leads });
      attr(col.block, { x: fx(col.cx - bw / 2), y: fx(top), width: bw, height: bh });
      attr(col.tint, { x: fx(col.cx - bw / 2), y: fx(top), width: bw, height: bh });
    });

    this.setClock(t);
  }
}

customElements.define('damping-cases', DampingCases);
customElements.define('spring-mass-lab', SpringMassLab);
customElements.define('lc-circuit-lab', LcCircuitLab);
})();
