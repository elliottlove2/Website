/*!
 * ode-demos.js — interactive demos for Euler's method and separation of variables.
 *   <euler-method>                 Euler's method on a faint slope field
 *   <separable-ode mode="family">  Separate, integrate, and use the starting value
 *   <separable-ode mode="areas">   Why separation works: matching areas
 * Plain JavaScript web components, no dependencies. Math is typeset with the
 * KaTeX already used on the site (loaded on demand if a page lacks it).
 * Colours follow the site's --psc-* variables.
 */
(() => {
'use strict';
if (!window.customElements || customElements.get('euler-method')) return;

/* ------------------------------------------------------------------
 * Core helpers shared by every demo
 * ------------------------------------------------------------------ */

const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.css';
const KATEX_CSS_SRI = 'sha384-lPx0C4zIUZLpveABMwOFcFeGZwsvKBJfhJ85FN1PYOV7xApBcFMhcAEMVKF8loOI';
const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.js';
const KATEX_JS_SRI = 'sha384-19KE2cFb3U+RUWmyhBz7aLOGDG8WrRC6hE3oY/HTZZlAAVWYTdmvLC//+TIV3zUx';

const MINUS = '−';
const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const reducedMotion = () => reducedMotionQuery.matches;

/* ---------- KaTeX (loaded on demand, shared with the page) ---------- */

let katexPromise = null;

function ensureDocumentKatexCss() {
  // @font-face rules only take effect from the document, so the page needs the
  // KaTeX stylesheet too. The blog already links it; other pages get it here.
  const links = document.querySelectorAll('link[rel~="stylesheet"]');
  for (const link of links) if (/katex(\.min)?\.css/.test(link.getAttribute('href') || '')) return;
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
    const finish = () => {
      if (settled || !window.katex) return;
      settled = true;
      resolve(window.katex);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      resolve(null);
    };
    const existing = [...document.scripts].find(script =>
      /katex(\.min)?\.js(\?|#|$)/.test(script.src) && !/contrib|auto-render/.test(script.src));
    if (existing) {
      existing.addEventListener('load', finish);
    } else {
      const script = document.createElement('script');
      script.src = KATEX_JS;
      script.integrity = KATEX_JS_SRI;
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.addEventListener('load', finish);
      script.addEventListener('error', fail);
      document.head.appendChild(script);
    }
    // Safety net: a deferred script may already have run before we listened.
    let tries = 0;
    const timer = setInterval(() => {
      if (window.katex) { clearInterval(timer); finish(); }
      else if (++tries > 200) { clearInterval(timer); fail(); }
    }, 60);
  });
  return katexPromise;
}

const KATEX_OPTIONS = {
  throwOnError: false,
  strict: 'ignore',
  trust: context => context.command === '\\htmlClass',
};

function texFallback(tex) {
  const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', i: 'ᵢ' };
  let out = tex
    .replace(/\\htmlClass\{[^{}]*\}/g, '')
    .replace(/\\(begin|end)\{[a-z]*\}/g, '')
    .replace(/\\\\/g, ';  ')
    .replace(/&/g, '')
    .replace(/\\[dt]?frac(\d)(\d)/g, '$1/$2');
  for (let i = 0; i < 6; i++) {
    out = out.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    out = out.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  }
  out = out.replace(/_\{?([0-9i]+)\}?/g, (m, d) => [...d].map(c => SUB[c] ?? c).join(''));
  out = out.replace(/\^\{?2\}?/g, '²');
  const words = [
    ['\\displaystyle', ''], ['\\textstyle', ''], ['\\Longrightarrow', '⇒'], ['\\Rightarrow', '⇒'],
    ['\\checkmark', '✓'], ['\\approx', '≈'], ['\\mathrm', ''], ['\\infty', '∞'], ['\\Delta', 'Δ'],
    ['\\qquad', '   '], ['\\quad', '  '], ['\\cdot', '·'], ['\\right', ''], ['\\left', ''], ['\\prime', '′'],
    ['\\text', ''], ['\\int', '∫'], ['\\sin', 'sin'], ['\\cos', 'cos'], ['\\bar', ''], ['\\ln', 'ln'],
    ['\\to', '→'], ['\\ne', '≠'], ['\\le', '≤'], ['\\ge', '≥'], ['\\pi', 'π'],
    ['\\,', ' '], ['\\;', ' '], ['\\!', ''], ['\\ ', ' '],
  ];
  for (const [from, to] of words) out = out.split(from).join(to);
  return out.replace(/[{}]/g, '').replace(/\\/g, '').replace(/\s+/g, ' ').trim();
}

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
    } catch (err) {
      /* fall through to plain text */
    }
  }
  el.textContent = texFallback(tex);
  el.__texDone = false;
  if (!window.katex) {
    loadKatex().then(katex => {
      if (katex && el.__tex === tex && !el.__texDone) texTo(el, tex, display);
    });
  }
}

/* ---------- small DOM helpers ---------- */

const SVGNS = 'http://www.w3.org/2000/svg';

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'tex') { el.classList.add('tex'); texTo(el, value); }
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid);
  }
  return el;
}

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) for (const [key, value] of Object.entries(attrs)) if (value != null) el.setAttribute(key, value);
  if (parent) parent.appendChild(el);
  return el;
}

function setAttrs(el, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) el.removeAttribute(key);
    else el.setAttribute(key, value);
  }
}

const ICONS = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/></svg>',
  step: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10l7-5z" fill="currentColor"/><path d="M11.2 3h2v10h-2z" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 3v10L6 8z" fill="currentColor"/><path d="M2.8 3h2v10h-2z" fill="currentColor"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M2.6 1.9v3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  minus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M8 3.5v9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

function iconButton(icon, label, attrs = {}) {
  const btn = h('button', { type: 'button', ...attrs });
  btn.innerHTML = ICONS[icon] + (label ? `<span>${label}</span>` : '');
  return btn;
}

/** Typeset a short formula into an SVG <text>: letters italic, the rest upright, a_b subscripts. */
function mathText(el, str) {
  el.textContent = '';
  const re = /_(\d+|[A-Za-z])|([A-Za-z]+)|([^A-Za-z_]+)/g;
  let m;
  let shifted = false;
  while ((m = re.exec(str))) {
    const t = document.createElementNS(SVGNS, 'tspan');
    if (m[1] != null) {
      t.setAttribute('class', /[A-Za-z]/.test(m[1]) ? 'mi' : 'mn');
      t.setAttribute('font-size', '72%');
      t.setAttribute('dy', '4');
      t.textContent = m[1];
      shifted = true;
    } else {
      t.setAttribute('class', m[2] ? 'mi' : 'mn');
      if (shifted) { t.setAttribute('dy', '-4'); shifted = false; }
      t.textContent = m[0];
    }
    el.appendChild(t);
  }
}

/* ---------- numbers ---------- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = t => 1 - (1 - t) ** 3;

function trimZeros(str) {
  return str.includes('.') ? str.replace(/0+$/, '').replace(/\.$/, '') : str;
}

/** Plain-text decimal with a true minus sign. */
function fmt(v, places = 4) {
  if (v == null || Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : MINUS + '∞';
  const a = Math.abs(v);
  let p = places;
  if (a >= 1e5) p = 0;
  else if (a >= 1e3) p = Math.min(p, 1);
  else if (a >= 100) p = Math.min(p, 2);
  let s = v.toFixed(p);
  if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
  return s.replace('-', MINUS);
}

/** Short label: trims trailing zeros. */
function fmtShort(v, places = 3) {
  if (!Number.isFinite(v)) return fmt(v);
  let s = trimZeros(v.toFixed(places));
  if (/^-0$/.test(s)) s = '0';
  return s.replace('-', MINUS);
}

/* Exact rational numbers (BigInt), used to reproduce hand calculations exactly. */
const babs = n => (n < 0n ? -n : n);
function bgcd(a, b) {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
const bitLength = n => babs(n).toString(2).length;

class Q {
  constructor(n, d = 1n) {
    if (d === 0n) throw new RangeError('zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  static int(k) { return new Q(BigInt(k)); }
  static snap(value, denominator) { return new Q(BigInt(Math.round(value * denominator)), BigInt(denominator)); }
  static parse(text) {
    if (text == null) return null;
    const t = String(text).trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
    if (!t) return null;
    let m = t.match(/^([+-]?)(\d+)\/(\d+)$/);
    if (m) {
      const d = BigInt(m[3]);
      if (d === 0n) return null;
      return new Q((m[1] === '-' ? -1n : 1n) * BigInt(m[2]), d);
    }
    m = t.match(/^([+-]?)(\d*)(?:\.(\d*))?$/);
    if (m && (m[2] || m[3])) {
      const frac = m[3] || '';
      const n = BigInt((m[2] || '0') + frac) * (m[1] === '-' ? -1n : 1n);
      return new Q(n, 10n ** BigInt(frac.length));
    }
    return null;
  }
  add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Q(this.n * o.n, this.d * o.d); }
  div(o) { return o.n === 0n ? null : new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  powInt(k) {
    if (k === 0) return Q.int(1);
    if (k < 0) {
      if (this.n === 0n) return null;
      const e = BigInt(-k);
      return new Q(this.d ** e, this.n ** e);
    }
    const e = BigInt(k);
    return new Q(this.n ** e, this.d ** e);
  }
  sign() { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
  isZero() { return this.n === 0n; }
  equals(o) { return this.n === o.n && this.d === o.d; }
  bits() { return Math.max(bitLength(this.n), bitLength(this.d)); }
  toNumber() {
    let n = this.n;
    let d = this.d;
    const shift = Math.max(0, Math.max(bitLength(n), bitLength(d)) - 1000);
    if (shift) {
      n >>= BigInt(shift);
      d >>= BigInt(shift);
      if (d === 0n) return n >= 0n ? Infinity : -Infinity;
    }
    return Number(n) / Number(d);
  }
  /** Exact decimal string if it terminates within `maxPlaces`, else null. */
  exactDecimal(maxPlaces = 4) {
    let d = this.d;
    let twos = 0;
    let fives = 0;
    while (d % 2n === 0n) { d /= 2n; twos++; }
    while (d % 5n === 0n) { d /= 5n; fives++; }
    if (d !== 1n) return null;
    const p = Math.max(twos, fives);
    if (p > maxPlaces) return null;
    const scaled = (this.n * 10n ** BigInt(p)) / this.d;
    const neg = scaled < 0n;
    const digits = babs(scaled).toString().padStart(p + 1, '0');
    let str = p ? `${digits.slice(0, -p)}.${digits.slice(-p)}` : digits;
    if (p) str = trimZeros(str);
    return (neg && str !== '0' ? '-' : '') + str;
  }
}

/** Keep exact arithmetic only while numbers stay a readable size. */
const capQ = q => (q && q.bits() <= 1600 ? q : null);

/**
 * TeX for a number. mode 'dec' shows terminating decimals exactly (else rounds),
 * mode 'frac' prefers small fractions. Returns {tex, exact, neg}.
 */
function numTex(q, v, mode = 'dec', places = 4) {
  if (q) {
    if (mode === 'frac' && q.d <= 4096n && babs(q.n) < 10n ** 9n) {
      if (q.d === 1n) return { tex: q.n.toString(), exact: true, neg: q.n < 0n };
      const neg = q.n < 0n;
      return { tex: `${neg ? '-' : ''}\\tfrac{${babs(q.n)}}{${q.d}}`, exact: true, neg, frac: true };
    }
    const dec = q.exactDecimal(places);
    if (dec != null) return { tex: dec, exact: true, neg: dec.startsWith('-') };
    v = q.toNumber();
  }
  if (v == null || Number.isNaN(v)) return { tex: '\\text{undefined}', exact: false, neg: false, bad: true };
  if (!Number.isFinite(v)) return { tex: v > 0 ? '\\infty' : '-\\infty', exact: false, neg: v < 0, bad: true };
  const scale = 10 ** places;
  const rounded = Math.round(v * scale) / scale;
  const exactish = Math.abs(v - rounded) <= 1e-12 * Math.max(1, Math.abs(v));
  let tex = exactish ? trimZeros(rounded.toFixed(places)) : fmt(v, places).replace(MINUS, '-');
  if (/^-0(\.0*)?$/.test(tex)) tex = tex.slice(1);
  return { tex, exact: exactish, neg: tex.startsWith('-') };
}

/** Plain text for a number (table cells in decimal mode). */
function numText(q, v, places = 4) {
  if (q) {
    const dec = q.exactDecimal(places);
    if (dec != null) return dec.replace('-', MINUS);
    v = q.toNumber();
  }
  if (v != null && Number.isFinite(v)) {
    const scale = 10 ** places;
    const rounded = Math.round(v * scale) / scale;
    if (Math.abs(v - rounded) <= 1e-12 * Math.max(1, Math.abs(v))) return trimZeros(rounded.toFixed(places)).replace('-', MINUS);
  }
  return fmt(v, places);
}

/** Decimal for use inside TeX formulas (trimmed). */
function decTex(v, places = 3) {
  if (!Number.isFinite(v)) return v > 0 ? '\\infty' : '-\\infty';
  let s = trimZeros(v.toFixed(places));
  if (s === '-0') s = '0';
  return s;
}

/* ---------- a tiny expression language for y' = F(x, y) ---------- */

class ExprError extends Error {}

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: v => 1 / Math.cos(v),
  exp: Math.exp, ln: Math.log, log: Math.log, sqrt: Math.sqrt, abs: Math.abs,
  arctan: Math.atan, atan: Math.atan,
};
const FUNCTION_NAMES = ['arctan', 'sqrt', 'atan', 'sin', 'cos', 'tan', 'sec', 'exp', 'abs', 'log', 'ln', 'pi'];

function tokenize(source) {
  const src = source
    .replace(/[−–]/g, '-')
    .replace(/[·×∙⋅]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/\*\*/g, '^')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const text = src.slice(i, j);
      if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) throw new ExprError(`“${text}” is not a number.`);
      out.push({ type: 'num', text });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const word = src.slice(i, j).toLowerCase();
      let k = 0;
      while (k < word.length) {
        const name = FUNCTION_NAMES.find(n => word.startsWith(n, k));
        if (name) {
          out.push(name === 'pi' ? { type: 'const', text: 'pi' } : { type: 'func', text: name });
          k += name.length;
          continue;
        }
        const ch = word[k];
        if (ch === 'x' || ch === 'y') out.push({ type: 'var', text: ch });
        else if (ch === 'e') out.push({ type: 'const', text: 'e' });
        else throw new ExprError(`I don’t know “${word}”. Use x, y, numbers, and sin, cos, exp, ln, sqrt.`);
        k++;
      }
      i = j;
      continue;
    }
    if ('+-*/^()'.includes(c)) {
      out.push({ type: 'op', text: c });
      i++;
      continue;
    }
    throw new ExprError(`Unexpected “${c}”.`);
  }
  return out;
}

function parseExpression(source) {
  const toks = tokenize(source);
  if (!toks.length) throw new ExprError('Type a formula in x and y.');
  let p = 0;
  const peek = () => toks[p];
  const isOp = (t, c) => t && t.type === 'op' && t.text === c;
  const expect = c => {
    if (!isOp(peek(), c)) throw new ExprError(c === ')' ? 'A parenthesis is not closed.' : `Expected “${c}”.`);
    p++;
  };
  const startsAtom = t => t && (t.type !== 'op' || t.text === '(');

  function parseSum() {
    let node = parseProduct();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = toks[p++].text;
      node = { k: 'bin', op, a: node, b: parseProduct() };
    }
    return node;
  }
  function parseProduct() {
    let node = parseUnary();
    for (;;) {
      const t = peek();
      if (isOp(t, '*') || isOp(t, '/')) {
        p++;
        node = { k: 'bin', op: t.text, a: node, b: parseUnary() };
      } else if (startsAtom(t)) {
        node = { k: 'bin', op: '*', a: node, b: parsePower() };
      } else break;
    }
    return node;
  }
  function parseUnary() {
    if (isOp(peek(), '-')) { p++; return { k: 'neg', a: parseUnary() }; }
    if (isOp(peek(), '+')) { p++; return parseUnary(); }
    return parsePower();
  }
  function parsePower() {
    const base = parseAtom();
    if (isOp(peek(), '^')) {
      p++;
      return { k: 'pow', a: base, b: parseUnary() };
    }
    return base;
  }
  function parseAtom() {
    const t = toks[p++];
    if (!t) throw new ExprError('The formula ends too soon.');
    if (t.type === 'num') return { k: 'num', text: t.text, v: parseFloat(t.text) };
    if (t.type === 'var') return { k: 'var', name: t.text };
    if (t.type === 'const') return { k: 'const', name: t.text };
    if (t.type === 'func') {
      if (isOp(peek(), '(')) {
        p++;
        const arg = parseSum();
        expect(')');
        return { k: 'call', fn: t.text, a: arg };
      }
      if (!peek()) throw new ExprError(`${t.text} needs an input, like ${t.text}(x).`);
      return { k: 'call', fn: t.text, a: parsePower() };
    }
    if (isOp(t, '(')) {
      const inner = parseSum();
      expect(')');
      return inner;
    }
    throw new ExprError(`Unexpected “${t.text}”.`);
  }
  const tree = parseSum();
  if (p < toks.length) throw new ExprError(isOp(toks[p], ')') ? 'There is an extra “)”.' : `Unexpected “${toks[p].text}”.`);
  return tree;
}

function compileFloat(node) {
  switch (node.k) {
    case 'num': { const v = node.v; return () => v; }
    case 'var': return node.name === 'x' ? x => x : (x, y) => y;
    case 'const': { const v = node.name === 'pi' ? Math.PI : Math.E; return () => v; }
    case 'neg': { const a = compileFloat(node.a); return (x, y) => -a(x, y); }
    case 'pow': {
      const a = compileFloat(node.a);
      const b = compileFloat(node.b);
      return (x, y) => Math.pow(a(x, y), b(x, y));
    }
    case 'call': {
      const f = FUNCTIONS[node.fn];
      const a = compileFloat(node.a);
      return (x, y) => f(a(x, y));
    }
    case 'bin': {
      const a = compileFloat(node.a);
      const b = compileFloat(node.b);
      switch (node.op) {
        case '+': return (x, y) => a(x, y) + b(x, y);
        case '-': return (x, y) => a(x, y) - b(x, y);
        case '*': return (x, y) => a(x, y) * b(x, y);
        default: return (x, y) => a(x, y) / b(x, y);
      }
    }
    default: throw new ExprError('Unknown formula.');
  }
}

function integerExponent(node) {
  if (node.k === 'num' && Number.isInteger(node.v)) return node.v;
  if (node.k === 'neg' && node.a.k === 'num' && Number.isInteger(node.a.v)) return -node.a.v;
  return null;
}

/** Exact evaluation when the formula is rational in x and y; returns null otherwise. */
function compileExact(node) {
  switch (node.k) {
    case 'num': { const q = Q.parse(node.text); return () => q; }
    case 'var': return node.name === 'x' ? x => x : (x, y) => y;
    case 'const':
    case 'call': return null;
    case 'neg': {
      const a = compileExact(node.a);
      return a && ((x, y) => { const v = a(x, y); return v && v.neg(); });
    }
    case 'pow': {
      const k = integerExponent(node.b);
      const a = compileExact(node.a);
      if (k == null || !a || Math.abs(k) > 12) return null;
      return (x, y) => { const v = a(x, y); return v && capQ(v.powInt(k)); };
    }
    case 'bin': {
      const a = compileExact(node.a);
      const b = compileExact(node.b);
      if (!a || !b) return null;
      const op = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div' }[node.op];
      return (x, y) => {
        const u = a(x, y);
        const v = b(x, y);
        return u && v ? capQ(u[op](v)) : null;
      };
    }
    default: return null;
  }
}

/**
 * TeX for an expression tree. With `sub` = {x: numTexResult, y: numTexResult}
 * the variables are replaced by numbers (for “plug in the point” lines).
 */
function exprTex(node, sub = null) {
  const wrap = r => ({ tex: `\\left(${r.tex}\\right)`, prec: 9, lead: 'paren', neg: false });
  function go(n) {
    switch (n.k) {
      case 'num': return { tex: n.text, prec: 9, lead: 'digit', neg: false };
      case 'var': {
        if (sub) {
          const v = sub[n.name];
          return { tex: v.tex, prec: v.neg ? 2 : 9, lead: v.neg ? 'minus' : v.frac ? 'frac' : 'digit', neg: v.neg };
        }
        return { tex: n.name, prec: 9, lead: 'letter', neg: false };
      }
      case 'const': return { tex: n.name === 'pi' ? '\\pi' : 'e', prec: 9, lead: 'letter', neg: false };
      case 'neg': {
        let a = go(n.a);
        if (a.prec < 3 || a.neg) a = wrap(a);
        return { tex: `-${a.tex}`, prec: 2, lead: 'minus', neg: true };
      }
      case 'pow': {
        if (n.a.k === 'const' && n.a.name === 'e') {
          return { tex: `e^{${go(n.b).tex}}`, prec: 8, lead: 'letter', neg: false };
        }
        let a = go(n.a);
        if (a.prec < 9 || a.neg || a.lead === 'frac') a = wrap(a);
        return { tex: `${a.tex}^{${go(n.b).tex}}`, prec: 8, lead: a.lead, neg: false };
      }
      case 'call': {
        const arg = go(n.a);
        if (n.fn === 'exp') return { tex: `e^{${arg.tex}}`, prec: 8, lead: 'letter', neg: false };
        if (n.fn === 'sqrt') return { tex: `\\sqrt{${arg.tex}}`, prec: 9, lead: 'letter', neg: false };
        if (n.fn === 'abs') return { tex: `\\left|${arg.tex}\\right|`, prec: 9, lead: 'paren', neg: false };
        const name = { ln: '\\ln', log: '\\ln', atan: '\\arctan', arctan: '\\arctan' }[n.fn] || `\\${n.fn}`;
        return { tex: `${name}\\left(${arg.tex}\\right)`, prec: 7, lead: 'letter', neg: false };
      }
      case 'bin': {
        let a = go(n.a);
        let b = go(n.b);
        if (n.op === '/') return { tex: `\\frac{${a.tex}}{${b.tex}}`, prec: 9, lead: 'frac', neg: false };
        if (n.op === '+' || n.op === '-') {
          if (b.neg || (n.op === '-' && b.prec <= 1)) b = wrap(b);
          return { tex: `${a.tex} ${n.op} ${b.tex}`, prec: 1, lead: a.lead, neg: a.neg };
        }
        // multiplication
        if (a.prec < 2) a = wrap(a);
        if (b.prec < 3 || b.neg) b = wrap(b);
        const juxtapose = (b.lead === 'letter' || b.lead === 'paren') && a.lead !== 'frac';
        return { tex: juxtapose ? `${a.tex}${b.tex}` : `${a.tex} \\cdot ${b.tex}`, prec: 3, lead: a.lead, neg: a.neg };
      }
      default: return { tex: '?', prec: 9, lead: 'digit', neg: false };
    }
  }
  return go(node).tex;
}

function compileFormula(source) {
  const tree = parseExpression(source);
  const f = compileFloat(tree);
  const exact = compileExact(tree);
  return {
    source,
    tree,
    f,
    exact,
    tex: exprTex(tree),
    subTex: (xv, yv) => exprTex(tree, { x: xv, y: yv }),
    usesX: JSON.stringify(tree).includes('"name":"x"'),
    usesY: JSON.stringify(tree).includes('"name":"y"'),
  };
}

/* ---------- numerics ---------- */

/**
 * Classical RK4 from (x0, y0) toward x1. Stops early if the solution leaves
 * |y| < bound, stops being finite, or hits a vertical tangent.
 */
function rk4(F, x0, y0, x1, h, bound = 1e6) {
  const pts = [[x0, y0]];
  const span = x1 - x0;
  if (span === 0) return pts;
  const steps = Math.max(1, Math.ceil(Math.abs(span) / h));
  const dx = span / steps;
  let x = x0;
  let y = y0;
  for (let i = 0; i < steps; i++) {
    const k1 = F(x, y);
    const k2 = F(x + dx / 2, y + (dx * k1) / 2);
    const k3 = F(x + dx / 2, y + (dx * k2) / 2);
    const k4 = F(x + dx, y + dx * k3);
    const yn = y + (dx * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
    if (!Number.isFinite(yn) || Math.abs(yn) > bound || Math.abs(dx * k1) > bound * 0.25) {
      pts.escaped = true;
      break;
    }
    x = x0 + (i + 1) * dx;
    y = yn;
    pts.push([x, y]);
  }
  return pts;
}

/** Solution curve through (x0, y0) across [xa, xb]. */
function solutionThrough(F, x0, y0, xa, xb, yBound, samples = 700) {
  const h = (xb - xa) / samples;
  const left = x0 > xa ? rk4(F, x0, y0, xa, h, yBound) : [[x0, y0]];
  const right = x0 < xb ? rk4(F, x0, y0, xb, h, yBound) : [[x0, y0]];
  return left.reverse().concat(right.slice(1));
}

function secondDerivative(F, x, y) {
  const hx = 1e-4 * (1 + Math.abs(x));
  const hy = 1e-4 * (1 + Math.abs(y));
  const m = F(x, y);
  const fx = (F(x + hx, y) - F(x - hx, y)) / (2 * hx);
  const fy = (F(x, y + hy) - F(x, y - hy)) / (2 * hy);
  return fx + fy * m;
}

/* ---------- plotting ---------- */

class Frame {
  constructor() { this.set(0, 0, 1, 1, [0, 1], [0, 1]); }
  set(left, top, width, height, xDomain, yDomain) {
    this.L = left;
    this.T = top;
    this.W = Math.max(1, width);
    this.H = Math.max(1, height);
    [this.xa, this.xb] = xDomain;
    [this.ya, this.yb] = yDomain;
    this.kx = this.W / (this.xb - this.xa);
    this.ky = this.H / (this.yb - this.ya);
    return this;
  }
  get R() { return this.L + this.W; }
  get B() { return this.T + this.H; }
  X(x) { return this.L + (x - this.xa) * this.kx; }
  Y(y) { return this.T + this.H - (y - this.ya) * this.ky; }
  x(px) { return this.xa + (px - this.L) / this.kx; }
  y(py) { return this.ya + (this.T + this.H - py) / this.ky; }
  inside(px, py, pad = 0) { return px >= this.L - pad && px <= this.R + pad && py >= this.T - pad && py <= this.B + pad; }
}

function niceStep(span, target) {
  const raw = span / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
}

function niceTicks(a, b, target) {
  const step = niceStep(b - a, target);
  const out = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9 * step; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toFixed(10));
  return { values: out, step };
}

function tickLabel(v) {
  const s = trimZeros(v.toFixed(6));
  return (s === '-0' ? '0' : s).replace('-', MINUS);
}

/** SVG path data for sampled points; breaks the pen on gaps. */
function pathData(points, frame, yLimit) {
  let d = '';
  let pen = false;
  const lo = frame.ya - yLimit;
  const hi = frame.yb + yLimit;
  for (const pt of points) {
    const [x, y] = pt;
    if (!Number.isFinite(y) || y < lo || y > hi || pt.gap) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${frame.X(x).toFixed(1)},${frame.Y(y).toFixed(1)}`;
    pen = true;
  }
  return d;
}

function sampleFunction(f, xa, xb, n = 400) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n;
    pts.push([x, f(x)]);
  }
  return pts;
}

/** Faint direction field: one short segment per grid cell, equal screen length. */
function slopeFieldPath(frame, F, spacing, length) {
  const nx = Math.max(3, Math.round(frame.W / spacing));
  const ny = Math.max(3, Math.round(frame.H / spacing));
  const cw = frame.W / nx;
  const ch = frame.H / ny;
  const half = length / 2;
  let d = '';
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const px = frame.L + (i + 0.5) * cw;
      const py = frame.T + (j + 0.5) * ch;
      const m = F(frame.x(px), frame.y(py));
      let ux;
      let uy;
      if (Number.isNaN(m)) continue;
      if (!Number.isFinite(m)) { ux = 0; uy = 1; }
      else {
        const vx = frame.kx;
        const vy = -m * frame.ky;
        const n = Math.hypot(vx, vy);
        ux = vx / n;
        uy = vy / n;
      }
      d += `M${(px - ux * half).toFixed(1)},${(py - uy * half).toFixed(1)}L${(px + ux * half).toFixed(1)},${(py + uy * half).toFixed(1)}`;
    }
  }
  return d;
}

/** Segment through (px, py) in the direction of slope m with screen length len. */
function slopeSegment(frame, px, py, m, len) {
  let ux = 0;
  let uy = 1;
  if (Number.isFinite(m)) {
    const vx = frame.kx;
    const vy = -m * frame.ky;
    const n = Math.hypot(vx, vy);
    ux = vx / n;
    uy = vy / n;
  }
  const half = len / 2;
  return { x1: px - ux * half, y1: py - uy * half, x2: px + ux * half, y2: py + uy * half };
}

/** Grid, frame and tick labels for a plot. Returns the group. */
function drawAxes(group, frame, opts = {}) {
  const { xTarget = 7, yTarget = 6, xLabel = 'x', yLabel = 'y', sheet = true, labels = true, tickSide = 'left' } = opts;
  const g = svgEl('g', { class: 'axes' }, group);
  if (sheet) svgEl('rect', { class: 'sheet', x: frame.L, y: frame.T, width: frame.W, height: frame.H, rx: 3 }, g);
  const xt = niceTicks(frame.xa, frame.xb, xTarget);
  const yt = niceTicks(frame.ya, frame.yb, yTarget);
  let grid = '';
  for (const v of xt.values) grid += `M${frame.X(v).toFixed(1)},${frame.T}V${frame.B}`;
  for (const v of yt.values) grid += `M${frame.L},${frame.Y(v).toFixed(1)}H${frame.R}`;
  svgEl('path', { class: 'grid', d: grid }, g);
  let zero = '';
  if (frame.xa < 0 && frame.xb > 0) zero += `M${frame.X(0).toFixed(1)},${frame.T}V${frame.B}`;
  if (frame.ya < 0 && frame.yb > 0) zero += `M${frame.L},${frame.Y(0).toFixed(1)}H${frame.R}`;
  if (zero) svgEl('path', { class: 'zero', d: zero }, g);
  if (sheet) svgEl('rect', { class: 'sheet-edge', x: frame.L, y: frame.T, width: frame.W, height: frame.H, rx: 3 }, g);
  if (labels) {
    for (const v of xt.values) {
      if (xLabel && frame.R - frame.X(v) < 9) continue;
      const t = svgEl('text', { class: 'tick', x: frame.X(v), y: frame.B + 15, 'text-anchor': 'middle' }, g);
      t.textContent = tickLabel(v);
    }
    for (const v of yt.values) {
      if (yLabel && frame.Y(v) - frame.T < 15) continue;
      const t = tickSide === 'right'
        ? svgEl('text', { class: 'tick', x: frame.R + 6, y: frame.Y(v) + 4, 'text-anchor': 'start' }, g)
        : svgEl('text', { class: 'tick', x: frame.L - 6, y: frame.Y(v) + 4, 'text-anchor': 'end' }, g);
      t.textContent = tickLabel(v);
    }
    if (xLabel) {
      const t = svgEl('text', { class: 'var', x: frame.R - 2, y: frame.B + 28, 'text-anchor': 'end' }, g);
      mathText(t, xLabel);
    }
    if (yLabel) {
      const t = svgEl('text', { class: 'var', x: tickSide === 'right' ? frame.R + 6 : frame.L - 7, y: frame.T + 4, 'text-anchor': tickSide === 'right' ? 'start' : 'end' }, g);
      mathText(t, yLabel);
    }
  }
  return g;
}

/** A nested <svg> clips its children to the plot area without url(#id) references. */
function clipBox(parent, frame) {
  return svgEl('svg', { x: frame.L, y: frame.T, width: frame.W, height: frame.H, viewBox: `${frame.L} ${frame.T} ${frame.W} ${frame.H}`, overflow: 'hidden', class: 'clip' }, parent);
}

function localPoint(svg, event) {
  const r = svg.getBoundingClientRect();
  return { x: event.clientX - r.left, y: event.clientY - r.top };
}

/** Pointer dragging with capture; works for mouse, pen and touch. */
function draggable(target, svg, { start, move, end }) {
  let active = null;
  target.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    active = event.pointerId;
    try { target.setPointerCapture(active); } catch (err) { /* ignore */ }
    target.classList.add('dragging');
    start?.(localPoint(svg, event), event);
  });
  target.addEventListener('pointermove', event => {
    if (event.pointerId !== active) return;
    move(localPoint(svg, event), event);
  });
  const stop = event => {
    if (event.pointerId !== active) return;
    active = null;
    target.classList.remove('dragging');
    end?.(event);
  };
  target.addEventListener('pointerup', stop);
  target.addEventListener('pointercancel', stop);
  target.addEventListener('touchstart', event => event.preventDefault(), { passive: false });
}

let uidCounter = 0;
const uid = prefix => `${prefix}-${++uidCounter}`;

/* ------------------------------------------------------------------
 * Styles (shadow DOM). Colours follow the site's --psc-* variables.
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
  --_sheet: var(--ode-sheet, #fdfcf9);
  --_card: var(--ode-card, #fbf9f5);
  --_blue: var(--ode-blue, #2f6187);
  --_rust: var(--ode-rust, #b5562b);
  --_sage: var(--ode-sage, #4a7a56);
  --_plum: var(--ode-plum, #7a5a8c);
  --_field: var(--ode-field, rgba(62, 59, 57, 0.17));
  --_serif: Georgia, 'Times New Roman', serif;
  --_math: KaTeX_Math, 'Times New Roman', serif;
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
.sr {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.ode {
  position: relative;
  background: var(--_paper);
  border: 1px solid var(--_line);
  border-radius: var(--_radius);
  padding: 18px 20px 20px;
}

/* ---------- equation chips ---------- */
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 34px; padding: 0 13px;
  border: 1px solid rgba(62, 59, 57, 0.2); border-radius: 999px;
  background: #fffdf8; color: var(--_ink);
  font: inherit; font-size: 14px; cursor: pointer; white-space: nowrap;
  transition: background-color .15s, border-color .15s, color .15s;
}
.chip:hover { border-color: rgba(62, 59, 57, 0.42); }
.chip[aria-checked="true"] { background: var(--_ink); border-color: var(--_ink); color: #faf7f1; }
.chip .katex { font-size: 1.04em; }
.chip.text { font-weight: 700; font-size: 13px; letter-spacing: .02em; }

button, input { font: inherit; color: inherit; }
button:focus-visible, input:focus-visible, .handle:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--text-secondary, #5d4037);
  outline-offset: 2px;
}
.handle:focus-visible { outline: none; }
.handle:focus-visible .ring { stroke: var(--text-secondary, #5d4037); stroke-width: 2; stroke-dasharray: 3 2; }

/* ---------- buttons ---------- */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: 36px; padding: 0 15px;
  border: 1px solid rgba(62, 59, 57, 0.22); border-radius: 999px;
  background: #fffdf9; color: var(--_ink);
  font-size: 14px; font-weight: 700; letter-spacing: .01em;
  cursor: pointer; white-space: nowrap;
  transition: background-color .15s, border-color .15s, opacity .15s;
}
.btn svg { width: 14px; height: 14px; flex: none; }
.btn:hover:not(:disabled) { background: #f6f1e8; border-color: rgba(62, 59, 57, 0.36); }
.btn.primary { background: var(--_ink); border-color: var(--_ink); color: #faf7f1; }
.btn.primary:hover:not(:disabled) { background: #2d2a28; }
.btn.icon { width: 36px; padding: 0; }
.btn:disabled { opacity: .38; cursor: default; }

.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
.controls .spacer { flex: 1 1 8px; }
.toggles { display: flex; flex-wrap: wrap; gap: 6px 16px; }

.switch { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--_ink); cursor: pointer; user-select: none; }
.switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.switch .track {
  position: relative; flex: none; width: 30px; height: 17px; border-radius: 999px;
  background: rgba(62, 59, 57, 0.2); transition: background-color .18s;
}
.switch .track::after {
  content: ''; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%;
  background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .18); transition: transform .18s;
}
.switch input:checked + .track { background: var(--switch-on, var(--_sage)); }
.switch input:checked + .track::after { transform: translateX(13px); }
.switch input:focus-visible + .track { outline: 2px solid var(--text-secondary, #5d4037); outline-offset: 2px; }
.swatch { display: inline-block; width: 16px; height: 0; border-top: 2.5px solid currentColor; border-radius: 2px; vertical-align: middle; }
.swatch.dash { border-top-style: dashed; border-top-width: 2px; }

/* ---------- problem statement ---------- */
.problem {
  display: flex; flex-wrap: wrap; align-items: center; gap: 10px 26px;
  margin-top: 14px; padding: 11px 14px;
  background: var(--_card); border: 1px solid var(--_line); border-radius: 6px;
  font-size: 15px;
}
.problem .group { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.problem .word { color: var(--_muted); font-size: 13.5px; margin-right: 4px; }
.problem .eq .katex { font-size: 1.22em; }
.num {
  width: 3.4em; padding: 1px 3px 0; margin: 0 1px;
  border: 0; border-bottom: 1.5px solid rgba(62, 59, 57, 0.35); border-radius: 4px 4px 0 0;
  background: rgba(255, 255, 255, 0.7);
  font: 17px/1.25 KaTeX_Main, 'Times New Roman', serif; text-align: center; color: var(--_ink);
}
.num:hover { border-bottom-color: rgba(62, 59, 57, 0.6); }
.num:focus { outline: none; border-bottom-color: var(--_rust); background: #fff; }
.num.invalid { border-bottom-color: #b3261e; background: #fbeceb; }
.stepper { display: inline-flex; align-items: center; gap: 2px; }
.stepper button {
  width: 26px; height: 26px; padding: 0; border-radius: 50%;
  border: 1px solid rgba(62, 59, 57, 0.22); background: #fffdf9; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
}
.stepper button svg { width: 12px; height: 12px; }
.stepper button:hover:not(:disabled) { background: #f6f1e8; }
.stepper button:disabled { opacity: .35; cursor: default; }
.stepper .num { width: 2.6em; }

.custom { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 12px; }
.custom label { display: inline-flex; align-items: center; gap: 8px; }
.custom .katex { font-size: 1.2em; }
.expr {
  width: min(320px, 62vw); height: 34px; padding: 0 12px;
  border: 1px solid rgba(62, 59, 57, 0.28); border-radius: 6px; background: #fff;
  font: 15px/1 ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
}
.expr:focus { outline: none; border-color: var(--_rust); box-shadow: 0 0 0 3px rgba(181, 86, 43, .13); }
.expr.invalid { border-color: #b3261e; }
.expr-msg { font-size: 13px; color: var(--_muted); }
.expr-msg.error { color: #a1271f; }

/* ---------- main layout ---------- */
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 20px; margin-top: 16px; align-items: start; }
.figure { min-width: 0; }
.plot { display: block; width: 100%; overflow: visible; touch-action: pan-y pinch-zoom; user-select: none; -webkit-user-select: none; }
.plot text { pointer-events: none; }

.caption {
  min-height: 3.2em; margin-top: 8px; padding: 0 2px;
  font: 15.5px/1.55 var(--_serif); color: var(--_ink);
}
.caption .katex { font-size: 1.04em; }
.caption b { font-weight: 700; }

.legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 6px; font-size: 12.5px; color: var(--_muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }

/* ---------- side panel ---------- */
.side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.card { background: var(--_card); border: 1px solid var(--_line); border-radius: 6px; padding: 13px 14px; }
.kicker { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--_muted); }
.head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.calc { min-height: 112px; font-size: 15px; overflow-x: auto; overflow-y: hidden; }
.calc .katex-display { margin: 0; text-align: left; }
.calc .katex-display > .katex { text-align: left; }
.calc .note { font: 14.5px/1.5 var(--_serif); color: var(--_ink); }

.seg { display: inline-flex; border: 1px solid rgba(62, 59, 57, 0.22); border-radius: 999px; overflow: hidden; background: #fffdf9; }
.seg button { border: 0; background: transparent; padding: 3px 10px; font-size: 12px; font-weight: 700; color: var(--_muted); cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--_ink); color: #faf7f1; }

.table-wrap { max-height: 252px; overflow: auto; border-top: 1px solid var(--_line); margin: 0 -14px -13px; border-radius: 0 0 6px 6px; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; font-variant-numeric: tabular-nums; }
th {
  position: sticky; top: 0; z-index: 1; background: var(--_card);
  padding: 7px 10px 6px; text-align: right; font-weight: 400; color: var(--_muted);
  border-bottom: 1px solid var(--_line); white-space: nowrap;
}
th .katex { font-size: 1em; }
td { padding: 5px 10px; text-align: right; border-bottom: 1px solid var(--_faint); white-space: nowrap; }
th:first-child, td:first-child { text-align: center; padding-left: 12px; padding-right: 4px; color: var(--_muted); }
td .katex { font-size: 1em; }
tbody tr { cursor: pointer; transition: background-color .15s; }
tbody tr:hover td { background: rgba(62, 59, 57, 0.035); }
tbody tr.done td { color: var(--_ink); }
tbody tr.todo td { color: rgba(62, 59, 57, 0.28); }
tbody tr.current td { background: rgba(181, 86, 43, 0.085); }
tbody tr.current td:first-child { box-shadow: inset 3px 0 0 var(--_rust); }
tbody tr.final td { font-weight: 700; }

.result { font-size: 14px; grid-column: 1 / -1; }
.result-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 8px 30px; }
@container (max-width: 780px) { .result-grid { grid-template-columns: minmax(0, 1fr); } }
.result .rows { display: grid; grid-template-columns: auto 1fr; gap: 3px 14px; margin-top: 6px; align-items: baseline; }
.result .rows .k { color: var(--_muted); font-size: 13px; }
.result .rows .v .katex { font-size: 1.04em; }
.result .why { margin-top: 8px; font: 14px/1.5 var(--_serif); }
.result .hint { font: 14.5px/1.5 var(--_serif); color: var(--_muted); }

.bars { width: 100%; margin-top: 8px; font-size: 12.5px; }
.bars td, .bars th { padding: 3px 6px; border: 0; }
.bars th { position: static; background: none; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; font-weight: 700; }
.bars td.bar { width: 96px; min-width: 96px; text-align: left; padding-left: 10px; }
.bars .fill { display: block; height: 7px; border-radius: 4px; background: var(--_rust); opacity: .5; min-width: 2px; }
.bars th .katex, th .katex { text-transform: none; letter-spacing: 0; font-weight: 400; }
.bars tbody tr:hover td { background: rgba(62, 59, 57, 0.04); }
.bars tr.you td { font-weight: 700; color: var(--_ink); }
.bars tr.you .fill { opacity: 1; }
.bars tbody tr td:first-child { color: var(--_ink); }
.ratio { margin-top: 6px; font: 14px/1.5 var(--_serif); }

/* ---------- derivation steps (separation) ---------- */
.steps-list { list-style: none; margin: 0; padding: 0; counter-reset: step; }
.steps-list > li {
  counter-increment: step; position: relative;
  padding: 9px 0 10px 34px; border-bottom: 1px solid var(--_faint);
  transition: opacity .2s;
}
.steps-list > li:last-child { border-bottom: 0; }
.steps-list > li::before {
  content: counter(step); position: absolute; left: 0; top: 9px;
  width: 22px; height: 22px; border-radius: 50%;
  border: 1px solid rgba(62, 59, 57, 0.28); background: #fffdf9;
  font-size: 12px; font-weight: 700; line-height: 20px; text-align: center; color: var(--_muted);
}
.steps-list > li.live::before { border-color: var(--_sage); color: #fff; background: var(--_sage); }
.steps-list > li.muted { opacity: .35; }
.steps-list .t { font-size: 13px; font-weight: 700; letter-spacing: .01em; color: var(--_muted); margin-bottom: 3px; }
.steps-list .m { overflow-x: auto; overflow-y: hidden; padding: 1px 0; }
.steps-list .m .katex { font-size: 1.06em; }
.steps-list .w { font: 14px/1.5 var(--_serif); color: var(--_ink); margin-top: 3px; }

.callout {
  margin-top: 12px; padding: 10px 13px; border-radius: 6px;
  background: rgba(122, 90, 140, 0.075); border: 1px solid rgba(122, 90, 140, 0.22);
  font: 14.5px/1.5 var(--_serif);
}
.callout.ok { background: rgba(74, 122, 86, 0.08); border-color: rgba(74, 122, 86, 0.25); }
.callout.warn { background: rgba(181, 86, 43, 0.08); border-color: rgba(181, 86, 43, 0.25); }
.callout.note { background: var(--_card); border-color: var(--_line); }

/* ---------- matching areas ---------- */
.readout { margin-top: 14px; display: grid; gap: 10px; }
.chain { overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
.chain .katex { font-size: 1.16em; }
.live { font: 15.5px/1.55 var(--_serif); }
.live .katex { font-size: 1.03em; }
.slider-row { display: flex; align-items: center; gap: 10px; flex: 1 1 260px; min-width: 200px; }
.slider-row .katex { font-size: 1.06em; }
input[type=range] { flex: 1; min-width: 120px; accent-color: var(--_ink); height: 28px; cursor: pointer; }
.value { min-width: 4.6em; font-variant-numeric: tabular-nums; font-weight: 700; }

.ys { color: var(--_rust); }
.xs { color: var(--_blue); }
.sol { color: var(--_sage); }
.eqm { color: var(--_plum); }
.blue { color: var(--_blue); }

/* ---------- SVG ---------- */
.sheet { fill: var(--_sheet); }
.sheet-edge { fill: none; stroke: var(--_line); stroke-width: 1; }
.grid { fill: none; stroke: rgba(62, 59, 57, 0.055); stroke-width: 1; }
.zero { fill: none; stroke: rgba(62, 59, 57, 0.34); stroke-width: 1; }
.tick { font: 11.5px var(--font-body, 'Lato', sans-serif); fill: var(--_muted); font-variant-numeric: tabular-nums; }
.var { font-size: 15px; fill: var(--_ink); }
.field { fill: none; stroke: var(--_field); stroke-width: 1.15; stroke-linecap: round; }
.family { fill: none; stroke: rgba(62, 59, 57, 0.15); stroke-width: 1; }
.mi { font-family: KaTeX_Math, 'Times New Roman', serif; font-style: italic; }
.mn { font-family: KaTeX_Main, 'Times New Roman', serif; font-style: normal; }
.band { fill: var(--_sage); fill-opacity: 0.06; }
.curve { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.exact { stroke: var(--_sage); stroke-width: 2.3; transition: opacity .5s; }
.local { stroke: rgba(62, 59, 57, 0.34); stroke-width: 1.2; stroke-dasharray: 4 4; }
.local.now { stroke: rgba(62, 59, 57, 0.62); }
.euler-path { fill: none; stroke: var(--_blue); stroke-width: 2.7; stroke-linejoin: round; stroke-linecap: round; }
.pt { fill: var(--_blue); stroke: var(--_sheet); stroke-width: 1.6; }
.tangent { stroke: var(--_rust); stroke-width: 1.7; stroke-linecap: round; }
.slope-mark { stroke: var(--_rust); stroke-width: 3.2; stroke-linecap: round; }
.run { stroke: rgba(62, 59, 57, 0.55); stroke-width: 1.3; stroke-dasharray: 4 3; }
.rise { stroke: var(--_rust); stroke-width: 1.6; stroke-dasharray: 4 3; }
.lbl { font: 12.5px var(--font-body, 'Lato', sans-serif); fill: var(--_ink); }
.lbl.m { font-size: 14px; }
.lbl.rust { fill: var(--_rust); }
.lbl.blue { fill: var(--_blue); }
.lbl.sage { fill: var(--_sage); }
.lbl.plum { fill: var(--_plum); }
.lbl.muted { fill: var(--_muted); }
.lbl.bold { font-weight: 700; }
.pill { fill: rgba(253, 252, 249, 0.92); stroke: var(--_line); }
.target-line { stroke: rgba(62, 59, 57, 0.45); stroke-width: 1.1; stroke-dasharray: 2 4; }
.handle { cursor: grab; outline: none; }
.handle.dragging, .dragging .handle { cursor: grabbing; }
.handle .hit { fill: transparent; }
.handle .halo { fill: rgba(62, 59, 57, 0.08); transition: r .15s; }
.handle:hover .halo, .handle.dragging .halo { fill: rgba(62, 59, 57, 0.13); }
.handle .ring { fill: var(--_sheet); stroke: var(--_ink); stroke-width: 2; }
.handle .dot { fill: var(--_ink); }
.hover-mark { pointer-events: none; }
.equilibrium { stroke: var(--_plum); stroke-width: 1.7; stroke-dasharray: 7 5; fill: none; }
.solution { stroke: var(--_sage); stroke-width: 3; }
.branch { stroke: var(--_sage); stroke-width: 1.5; stroke-dasharray: 5 5; opacity: .6; }
.asymptote { stroke: rgba(62, 59, 57, 0.45); stroke-width: 1; stroke-dasharray: 3 4; }
.validity { stroke: var(--_sage); stroke-width: 4; stroke-linecap: round; opacity: .85; }
.ghost { stroke: rgba(62, 59, 57, 0.4); stroke-width: 1.4; fill: none; }
.area-x { fill: var(--_blue); fill-opacity: 0.2; stroke: var(--_blue); stroke-width: 1; stroke-opacity: .5; }
.area-y { fill: var(--_rust); fill-opacity: 0.2; stroke: var(--_rust); stroke-width: 1; stroke-opacity: .5; }
.area-x.neg, .area-y.neg { fill-opacity: 0.1; stroke-dasharray: 4 3; stroke-opacity: .8; }
.area-rest { fill: var(--_rust); fill-opacity: 0.06; stroke: none; }
.fx { stroke: var(--_blue); stroke-width: 2.2; }
.gy { stroke: var(--_rust); stroke-width: 2.2; }
.guide { stroke: rgba(62, 59, 57, 0.5); stroke-width: 1; stroke-dasharray: 3 3; }
.guide.x { stroke: var(--_blue); stroke-opacity: .7; }
.guide.y { stroke: var(--_rust); stroke-opacity: .7; }
.big { font: 700 15px var(--font-body, 'Lato', sans-serif); font-variant-numeric: tabular-nums; }
.panel-title { font: 700 10.5px var(--font-body, 'Lato', sans-serif); letter-spacing: .1em; text-transform: uppercase; fill: var(--_muted); }
.panel-title .title-math, .panel-title .title-math tspan { text-transform: none; letter-spacing: 0; font-size: 14px; font-weight: 400; }
.fade { transition: opacity .35s; }

/* ---------- responsive ---------- */
@container (max-width: 780px) {
  .layout { grid-template-columns: minmax(0, 1fr); }
  .side { gap: 10px; }
}
th .short { display: none; }
.th-word { display: block; font-size: 10.5px; letter-spacing: .07em; text-transform: uppercase; font-weight: 700; color: var(--_muted); opacity: .8; margin-bottom: 1px; }
@container (max-width: 520px) {
  th .long { display: none; }
  th .short { display: inline; }
  th, td { padding-left: 7px; padding-right: 7px; }
  .ode { padding: 14px 12px 14px; }
  .problem { gap: 8px 16px; padding: 10px; }
  .chip { min-height: 32px; padding: 0 11px; font-size: 13px; }
  .btn { height: 38px; padding: 0 13px; }
  .btn.icon { width: 38px; }
  .caption { font-size: 15px; }
  .table-wrap { max-height: 220px; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
`;

/* ------------------------------------------------------------------
 * Base element: shadow root, styles, KaTeX, resize + visibility handling
 * ------------------------------------------------------------------ */

/** Render a short string with $…$ math segments and <b> tags (trusted strings only). */
function richTo(el, text) {
  if (el.__rich === text) return;
  el.__rich = text;
  el.textContent = '';
  const parts = text.split('$');
  for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    if (!part) continue;
    if (i % 2) {
      const span = document.createElement('span');
      span.className = 'tex';
      texTo(span, part);
      // glue trailing punctuation to the formula so a line never starts with it
      const punct = (parts[i + 1] || '').match(/^[.,;:!?)\u2019]+/);
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

/** Plain-language version of a rich string for screen-reader announcements. */
function plainText(text) {
  return text
    .split('$')
    .map((part, i) => (i % 2 ? texFallback(part) : part.replace(/<[^>]+>/g, '')))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

class OdeElement extends HTMLElement {
  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this._layoutQueued = false;
    this._built = false;
  }

  connectedCallback() {
    if (!this._built) {
      this._built = true;
      const link = h('link', { rel: 'stylesheet', href: KATEX_CSS, integrity: KATEX_CSS_SRI, crossorigin: 'anonymous' });
      const style = document.createElement('style');
      style.textContent = STYLE;
      this.live = h('div', { class: 'sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
      this.root.append(link, style);
      this.build();
      this.root.append(this.live);
    }
    loadKatex();
    this._resize = new ResizeObserver(() => this.queueLayout());
    this._resize.observe(this);
    this._visibility = new IntersectionObserver(entries => {
      for (const entry of entries) if (!entry.isIntersecting) this.pause();
    });
    this._visibility.observe(this);
    this._onHidden = () => { if (document.hidden) this.pause(); };
    document.addEventListener('visibilitychange', this._onHidden);
    this.queueLayout();
  }

  disconnectedCallback() {
    this.pause();
    this._resize?.disconnect();
    this._visibility?.disconnect();
    document.removeEventListener('visibilitychange', this._onHidden);
  }

  queueLayout() {
    if (this._layoutQueued) return;
    this._layoutQueued = true;
    requestAnimationFrame(() => {
      this._layoutQueued = false;
      if (this.isConnected) this.layout();
    });
  }

  announce(text) {
    this.live.textContent = '';
    // A fresh text node makes screen readers re-read identical messages too.
    requestAnimationFrame(() => { this.live.textContent = text; });
  }

  /** Public: stop any playing animation (the blog calls this when a post closes). */
  pause() {}

  /** Equation chips (radio group with arrow-key navigation). */
  makeChips(items, onPick, label) {
    const wrap = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': label });
    const buttons = items.map((item, i) => {
      const btn = h('button', { type: 'button', class: `chip${item.text ? ' text' : ''}`, role: 'radio', 'aria-checked': 'false', 'aria-label': item.aria, tabindex: '-1' });
      if (item.tex) {
        const span = h('span', { class: 'tex', 'aria-hidden': 'true' });
        texTo(span, item.tex);
        btn.append(span);
      } else btn.textContent = item.text;
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
      b.tabIndex = i === j ? 0 : -1;
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
}

/* ------------------------------------------------------------------
 * <euler-method>: Euler's method on a faint slope field
 * ------------------------------------------------------------------ */

function termsTex(terms) {
  let out = '';
  for (const { c, body } of terms) {
    if (!Number.isFinite(c) || Math.abs(c) < 1e-12) continue;
    const mag = Math.abs(c);
    const coef = body && Math.abs(mag - 1) < 1e-12 ? '' : decTex(mag, 4);
    const piece = coef + body;
    if (!out) out = (c < 0 ? '-' : '') + piece;
    else out += (c < 0 ? ' - ' : ' + ') + piece;
  }
  return out || '0';
}
const expTex = arg => (arg === '1' ? 'e' : `e^{${arg}}`);
function shiftTex(x0, sign = 1) {
  if (Math.abs(x0) < 1e-12) return sign > 0 ? 'x' : '-x';
  const inner = x0 > 0 ? `x - ${decTex(x0, 4)}` : `x + ${decTex(-x0, 4)}`;
  return sign > 0 ? inner : `-(${inner})`;
}

const EULER_PRESETS = [
  {
    id: 'y', expr: 'y', aria: 'y prime equals y', x0: '0', y0: '1', xe: '1', n: 4, how: 'separable',
    win: { x: [-0.3, 1.6], y: [0, 3.4] },
    exact: (x0, y0) => ({
      f: x => y0 * Math.exp(x - x0),
      domain: [-Infinity, Infinity],
      tex: `y = ${termsTex([{ c: y0, body: expTex(shiftTex(x0)) }])}`,
      valueTex: xe => termsTex([{ c: y0, body: expTex(decTex(xe - x0, 4)) }]),
    }),
  },
  {
    id: '2-y', expr: '2 - y', aria: 'y prime equals 2 minus y', x0: '0', y0: '0', xe: '1.5', n: 3, how: 'separable',
    win: { x: [-0.3, 3.3], y: [-0.5, 3.3] },
    exact: (x0, y0) => {
      const A = 2 - y0;
      return {
        f: x => 2 - A * Math.exp(-(x - x0)),
        domain: [-Infinity, Infinity],
        tex: `y = ${termsTex([{ c: 2, body: '' }, { c: -A, body: expTex(shiftTex(x0, -1)) }])}`,
        valueTex: xe => termsTex([{ c: 2, body: '' }, { c: -A, body: expTex(`-${decTex(xe - x0, 4)}`) }]),
      };
    },
  },
  {
    id: 'x+y', expr: 'x + y', aria: 'y prime equals x plus y', x0: '0', y0: '1', xe: '1', n: 4, how: 'linear',
    win: { x: [-0.3, 1.5], y: [-0.4, 4.2] },
    exact: (x0, y0) => {
      const A = x0 + y0 + 1;
      return {
        f: x => A * Math.exp(x - x0) - x - 1,
        domain: [-Infinity, Infinity],
        tex: `y = ${termsTex([{ c: A, body: expTex(shiftTex(x0)) }, { c: -1, body: 'x' }, { c: -1, body: '' }])}`,
        valueTex: xe => termsTex([{ c: A, body: expTex(decTex(xe - x0, 4)) }, { c: -xe - 1, body: '' }]),
      };
    },
  },
  {
    id: 'x-y', expr: 'x - y', aria: 'y prime equals x minus y', x0: '0', y0: '1', xe: '1', n: 4, how: 'linear',
    win: { x: [-0.3, 2.7], y: [-0.4, 2.2] },
    exact: (x0, y0) => {
      const A = y0 - x0 + 1;
      return {
        f: x => x - 1 + A * Math.exp(-(x - x0)),
        domain: [-Infinity, Infinity],
        tex: `y = ${termsTex([{ c: 1, body: 'x' }, { c: -1, body: '' }, { c: A, body: expTex(shiftTex(x0, -1)) }])}`,
        valueTex: xe => termsTex([{ c: xe - 1, body: '' }, { c: A, body: expTex(`-${decTex(xe - x0, 4)}`) }]),
      };
    },
  },
  {
    id: 'x/y', expr: 'x/y', aria: 'y prime equals x over y', x0: '0', y0: '1', xe: '1', n: 2, how: 'separable',
    win: { x: [-0.3, 2.2], y: [-0.3, 2.6] },
    exact: (x0, y0) => {
      if (y0 === 0) return null;
      const C = y0 * y0 - x0 * x0;
      const sgn = y0 > 0 ? 1 : -1;
      let domain = [-Infinity, Infinity];
      if (C <= 1e-12) domain = x0 > 0 ? [Math.sqrt(Math.max(0, -C)), Infinity] : [-Infinity, -Math.sqrt(Math.max(0, -C))];
      const cTex = Math.abs(C) < 1e-12 ? '' : C > 0 ? ` + ${decTex(C, 4)}` : ` - ${decTex(-C, 4)}`;
      return {
        f: x => sgn * Math.sqrt(x * x + C),
        domain,
        tex: `y = ${sgn < 0 ? '-' : ''}\\sqrt{x^2${cTex}}`,
        valueTex: xe => `${sgn < 0 ? '-' : ''}\\sqrt{${decTex(xe * xe + C, 4)}}`,
      };
    },
  },
];

const CUSTOM_DEFAULT = { expr: 'x^2 + x*y', x0: '0', y0: '1', xe: '1', n: 5 };

function fitEulerWindow(F, x0, y0, xe) {
  const L = xe - x0;
  const xa = x0 - 0.16 * L - 0.04;
  const xb = xe + 0.22 * L + 0.04;
  let lo = y0;
  let hi = y0;
  for (const [, y] of rk4(F, x0, y0, xe, L / 400, 1e4)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  let y = y0;
  for (let i = 0; i < 2; i++) {
    y += (L / 2) * F(x0 + (i * L) / 2, y);
    if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y); }
  }
  let span = hi - lo;
  if (span > 60) { lo = Math.max(lo, y0 - 30); hi = Math.min(hi, y0 + 30); span = hi - lo; }
  if (span < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; span = 1; }
  return { x: [xa, xb], y: [lo - 0.16 * span, hi + 0.2 * span] };
}

class EulerMethod extends OdeElement {
  build() {
    const startId = this.getAttribute('preset');
    let presetIndex = EULER_PRESETS.findIndex(p => p.id === startId);
    if (presetIndex < 0) presetIndex = 0;
    this.s = {
      preset: presetIndex, custom: CUSTOM_DEFAULT.expr, n: 4, k: 0, anim: null, playing: false,
      mode: 'dec', exactPref: null, showLocal: false,
    };
    this.ui = {};
    const ui = this.ui;

    // ---- equation chips + custom formula
    const chipItems = EULER_PRESETS.map(p => ({ tex: `y' = ${compileFormula(p.expr).tex}`, aria: p.aria }))
      .concat([{ text: 'Your own', aria: 'Type your own equation' }]);
    ui.chips = this.makeChips(chipItems, i => this.pickPreset(i), 'Differential equation');
    ui.expr = h('input', { class: 'expr', type: 'text', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', 'aria-label': "Right-hand side F(x, y)", placeholder: 'e.g. x^2 + x*y' });
    ui.exprMsg = h('span', { class: 'expr-msg', 'aria-live': 'polite' });
    ui.custom = h('div', { class: 'custom', hidden: true },
      h('label', null, h('span', { tex: "y' =", 'aria-hidden': 'true' }), ui.expr), ui.exprMsg);
    let exprTimer = 0;
    ui.expr.addEventListener('input', () => {
      clearTimeout(exprTimer);
      exprTimer = setTimeout(() => this.applyCustom(ui.expr.value), 280);
    });

    // ---- problem statement with editable numbers
    const numInput = (label) => h('input', { class: 'num', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', 'aria-label': label });
    ui.x0 = numInput('Starting x value');
    ui.y0 = numInput('Starting y value');
    ui.xe = numInput('x value to estimate');
    ui.n = numInput('Number of steps');
    ui.n.setAttribute('inputmode', 'numeric');
    ui.eq = h('span', { class: 'group eq' });
    ui.dx = h('span', { class: 'group dx' });
    ui.minus = iconButton('minus', '', { 'aria-label': 'Fewer steps' });
    ui.plus = iconButton('plus', '', { 'aria-label': 'More steps' });
    ui.minus.addEventListener('click', () => this.setSteps(this.s.n - 1));
    ui.plus.addEventListener('click', () => this.setSteps(this.s.n + 1));
    const problem = h('div', { class: 'problem' },
      ui.eq,
      h('span', { class: 'group' }, h('span', { tex: 'y(', 'aria-hidden': 'true' }), ui.x0, h('span', { tex: ')=', 'aria-hidden': 'true' }), ui.y0),
      h('span', { class: 'group' }, h('span', { class: 'word', text: 'Estimate' }), h('span', { tex: 'y(', 'aria-hidden': 'true' }), ui.xe, h('span', { tex: ')', 'aria-hidden': 'true' })),
      h('span', { class: 'group' }, h('span', { class: 'word', text: 'Steps' }), h('span', { class: 'stepper' }, ui.minus, ui.n, ui.plus)),
      ui.dx);
    for (const key of ['x0', 'y0', 'xe']) {
      ui[key].addEventListener('change', () => this.readProblem(key));
      ui[key].addEventListener('keydown', e => { if (e.key === 'Enter') this.readProblem(key); });
    }
    ui.n.addEventListener('change', () => this.setSteps(parseInt(ui.n.value, 10)));
    ui.n.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.setSteps(parseInt(ui.n.value, 10));
      if (e.key === 'ArrowUp') { e.preventDefault(); this.setSteps(this.s.n + 1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.setSteps(this.s.n - 1); }
    });

    // ---- plot
    ui.svg = svgEl('svg', { class: 'plot', role: 'group' });
    ui.static = svgEl('g', null, ui.svg);
    ui.clipHost = svgEl('g', null, ui.svg);
    ui.over = svgEl('g', null, ui.svg);
    ui.caption = h('div', { class: 'caption' });

    ui.reset = iconButton('reset', '', { class: 'btn icon', 'aria-label': 'Reset to the start' });
    ui.back = iconButton('back', '', { class: 'btn icon', 'aria-label': 'Undo one step' });
    ui.step = iconButton('step', 'Step', { class: 'btn primary' });
    ui.play = iconButton('play', 'Play', { class: 'btn' });
    ui.reset.addEventListener('click', () => this.reset());
    ui.back.addEventListener('click', () => this.back());
    ui.step.addEventListener('click', () => this.stepOnce());
    ui.play.addEventListener('click', () => (this.s.playing ? this.stopPlaying() : this.play()));
    ui.exactSwitch = this.makeSwitch('True solution', false, v => { this.s.exactPref = v; this.draw(); this.updatePanel(); });
    ui.localSwitch = this.makeSwitch('Solution through each $P_i$', false, v => { this.s.showLocal = v; this.draw(); }, 'var(--_ink)');
    const controls = h('div', { class: 'controls' }, ui.reset, ui.back, ui.step, ui.play, h('span', { class: 'spacer' }),
      h('span', { class: 'toggles' }, ui.exactSwitch, ui.localSwitch));
    const figure = h('div', { class: 'figure' }, ui.svg, ui.caption, controls);

    // ---- side panel
    ui.status = h('span', { class: 'kicker' });
    ui.modeDec = h('button', { type: 'button', 'aria-pressed': 'true', text: '0.25' });
    ui.modeFrac = h('button', { type: 'button', 'aria-pressed': 'false' });
    texTo(ui.modeFrac, '\\tfrac14');
    ui.modeDec.setAttribute('aria-label', 'Show decimals');
    ui.modeFrac.setAttribute('aria-label', 'Show exact fractions');
    ui.modeDec.addEventListener('click', () => this.setMode('dec'));
    ui.modeFrac.addEventListener('click', () => this.setMode('frac'));
    ui.seg = h('span', { class: 'seg', role: 'group', 'aria-label': 'Number format' }, ui.modeDec, ui.modeFrac);
    ui.calc = h('div', { class: 'calc', 'aria-live': 'off' });
    ui.tbody = h('tbody');
    const head = (word, tex, title) => h('th', { title }, h('span', { class: 'th-word', text: word }), h('span', { tex }));
    const thead = h('thead', null, h('tr', null,
      head('step', 'i'), head('x', 'x_i'), head('y', 'y_i'),
      head('slope', 'm_i', 'slope used for the next step: m_i = F(x_i, y_i)'),
      head('rise', '\\Delta y_i', 'rise: Δy_i = m_i · Δx')));
    ui.tableWrap = h('div', { class: 'table-wrap' }, h('table', { 'aria-label': 'Euler steps' }, thead, ui.tbody));
    const calcCard = h('div', { class: 'card' },
      h('div', { class: 'head' }, ui.status, ui.seg), ui.calc, ui.tableWrap);
    ui.result = h('div', { class: 'card result', hidden: true });
    const side = h('div', { class: 'side' }, calcCard);

    const wrap = h('div', { class: 'ode euler' },
      h('div', { class: 'bar' }, ui.chips), ui.custom, problem,
      h('div', { class: 'layout' }, figure, side, ui.result));
    this.root.append(wrap);

    this.buildPlotLayers();
    this.pickPreset(presetIndex, true);
  }

  /* ---------- plot layers (persistent elements) ---------- */
  buildPlotLayers() {
    const ui = this.ui;
    ui.clip = svgEl('svg', { class: 'clip', overflow: 'hidden' }, ui.clipHost);
    ui.field = svgEl('path', { class: 'field' }, ui.clip);
    ui.locals = svgEl('g', null, ui.clip);
    ui.exact = svgEl('path', { class: 'curve exact', opacity: 0 }, ui.clip);
    ui.target = svgEl('line', { class: 'target-line' }, ui.clip);
    ui.guides = svgEl('g', null, ui.clip);
    ui.tangent = svgEl('line', { class: 'tangent', opacity: 0 }, ui.guides);
    ui.run = svgEl('line', { class: 'run', opacity: 0 }, ui.guides);
    ui.rise = svgEl('line', { class: 'rise', opacity: 0 }, ui.guides);
    ui.mark = svgEl('line', { class: 'slope-mark', opacity: 0 });
    ui.path = svgEl('path', { class: 'euler-path' }, ui.clip);
    ui.pts = svgEl('g', null, ui.clip);
    ui.halo = svgEl('circle', { r: 10, fill: 'var(--_blue)', opacity: 0 }, ui.clip);
    ui.ring = svgEl('circle', { r: 9, fill: 'none', stroke: 'var(--_rust)', 'stroke-width': 2, opacity: 0 }, ui.clip);
    ui.mover = svgEl('circle', { class: 'pt', r: 5, opacity: 0 }, ui.clip);
    ui.trueDot = svgEl('circle', { r: 5, fill: 'var(--_sheet)', stroke: 'var(--_sage)', 'stroke-width': 2, opacity: 0 }, ui.clip);
    ui.bracket = svgEl('path', { fill: 'none', stroke: 'var(--_rust)', 'stroke-width': 1.4, opacity: 0 }, ui.clip);
    ui.hover = svgEl('g', { class: 'hover-mark', opacity: 0 }, ui.clip);
    ui.hoverLine = svgEl('line', { class: 'slope-mark', 'stroke-width': 2.4, opacity: 0.9 }, ui.hover);
    ui.hoverDot = svgEl('circle', { r: 2.2, fill: 'var(--_rust)' }, ui.hover);

    // labels drawn above the clip so they never get cut
    ui.labels = svgEl('g', null, ui.over);
    ui.dxLabel = svgEl('text', { class: 'lbl m muted', 'text-anchor': 'middle', opacity: 0 }, ui.labels);
    ui.dyLabel = svgEl('text', { class: 'lbl m rust', opacity: 0 }, ui.labels);
    ui.pLabel = svgEl('text', { class: 'lbl m blue', opacity: 0 }, ui.labels);
    ui.trueLabel = this.pill(ui.labels, 'sage');
    ui.errLabel = this.pill(ui.labels, 'rust');
    ui.hoverLabel = this.pill(ui.labels, 'rust');

    // target (x̄) handle
    ui.targetHandle = svgEl('g', { class: 'handle target', tabindex: 0, role: 'slider', 'aria-label': 'Where to estimate y. Drag sideways or use the arrow keys.' }, ui.over);
    ui.targetHit = svgEl('rect', { class: 'hit', width: 70, height: 32, rx: 6 }, ui.targetHandle);
    ui.targetPill = svgEl('rect', { class: 'pill', height: 22, rx: 11, 'stroke-width': 1 }, ui.targetHandle);
    ui.targetText = svgEl('text', { class: 'lbl', 'text-anchor': 'middle' }, ui.targetHandle);
    ui.targetHandle.style.cursor = 'ew-resize';

    // start (P0) handle
    ui.start = svgEl('g', { class: 'handle start', tabindex: 0, role: 'slider', 'aria-label': 'Starting point. Drag it, or use the arrow keys.' }, ui.over);
    svgEl('circle', { class: 'hit', r: 22 }, ui.start);
    svgEl('circle', { class: 'halo', r: 13 }, ui.start);
    svgEl('circle', { class: 'ring', r: 6.5 }, ui.start);
    svgEl('circle', { class: 'dot', r: 2.4 }, ui.start);
    ui.p0Label = svgEl('text', { class: 'lbl m' }, ui.over);
    ui.over.appendChild(ui.mark);
    ui.mark.style.pointerEvents = 'none';

    this.wireInteractions();
  }

  pill(parent, tone) {
    const g = svgEl('g', { opacity: 0, class: 'fade' }, parent);
    const rect = svgEl('rect', { class: 'pill', height: 22, rx: 11 }, g);
    const text = svgEl('text', { class: `lbl bold ${tone}`, 'text-anchor': 'middle' }, g);
    return { g, rect, text };
  }

  setPill(p, x, y, str, opacity = 1, anchor = 'middle') {
    p.text.textContent = str;
    const w = Math.max(28, str.length * 7.1 + 16);
    let cx = x;
    if (anchor === 'start') cx = x + w / 2;
    if (anchor === 'end') cx = x - w / 2;
    if (this.frame) cx = clamp(cx, this.frame.L + w / 2 + 2, this.frame.R - w / 2 - 2);
    setAttrs(p.rect, { x: cx - w / 2, y: y - 15, width: w });
    setAttrs(p.text, { x: cx, y: y });
    p.g.setAttribute('opacity', opacity);
  }

  wireInteractions() {
    const ui = this.ui;
    draggable(ui.start, ui.svg, {
      start: () => this.pause(),
      move: pt => {
        const fr = this.frame;
        const x = clamp(fr.x(pt.x), fr.xa, fr.xb);
        const y = clamp(fr.y(pt.y), fr.ya, fr.yb);
        let x0q = Q.snap(x, 10);
        const limit = this.xe - 0.1;
        if (x0q.toNumber() > limit + 1e-9) x0q = Q.snap(limit, 10);
        this.setStart(x0q, Q.snap(y, 10));
      },
      end: () => this.announce(`Start moved to (${fmtShort(this.x0)}, ${fmtShort(this.y0)}).`),
    });
    draggable(ui.targetHandle, ui.svg, {
      start: () => this.pause(),
      move: pt => {
        const fr = this.frame;
        const x = clamp(fr.x(pt.x), this.x0 + 0.1, fr.xb);
        this.setTarget(Q.snap(x, 10));
      },
      end: () => this.announce(`Now estimating y at x = ${fmtShort(this.xe)}.`),
    });
    ui.start.addEventListener('keydown', e => {
      const d = e.shiftKey ? 0.5 : 0.1;
      const moves = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
      if (!moves[e.key]) return;
      e.preventDefault();
      this.pause();
      const [dx, dy] = moves[e.key];
      const fr = this.frame;
      const x = clamp(this.x0 + dx, fr.xa, Math.min(fr.xb, this.xe - 0.1));
      const y = clamp(this.y0 + dy, fr.ya, fr.yb);
      this.setStart(Q.snap(x, 10), Q.snap(y, 10));
      this.announce(`Start (${fmtShort(this.x0)}, ${fmtShort(this.y0)}).`);
    });
    ui.targetHandle.addEventListener('keydown', e => {
      const d = (e.shiftKey ? 0.5 : 0.1) * ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key] || 0);
      if (!d) return;
      e.preventDefault();
      this.pause();
      const x = clamp(this.xe + d, this.x0 + 0.1, this.frame.xb);
      this.setTarget(Q.snap(x, 10));
      this.announce(`Estimate y at x = ${fmtShort(this.xe)}.`);
    });
    // hover: read the slope anywhere
    ui.svg.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !this.frame) return;
      const pt = localPoint(ui.svg, e);
      if (!this.frame.inside(pt.x, pt.y) || e.target.closest?.('.handle')) { this.hideHover(); return; }
      const x = this.frame.x(pt.x);
      const y = this.frame.y(pt.y);
      const m = this.F(x, y);
      const seg = slopeSegment(this.frame, pt.x, pt.y, m, 34);
      setAttrs(ui.hoverLine, seg);
      setAttrs(ui.hoverDot, { cx: pt.x, cy: pt.y });
      ui.hover.setAttribute('opacity', 1);
      const label = Number.isFinite(m) ? `slope ${fmt(m, 2)}` : 'slope undefined';
      this.setPill(ui.hoverLabel, pt.x + 14, pt.y - 14, label, 1, 'start');
    });
    ui.svg.addEventListener('pointerleave', () => this.hideHover());
  }

  ringPoint(i) {
    const p = i == null ? null : this.pts[i];
    if (!p || !this.frame || i > this.s.k) { this.ui.ring.setAttribute('opacity', 0); return; }
    setAttrs(this.ui.ring, { cx: this.frame.X(p.x), cy: this.frame.Y(p.y), opacity: 1 });
  }

  hideHover() {
    this.ui.hover.setAttribute('opacity', 0);
    this.ui.hoverLabel.g.setAttribute('opacity', 0);
  }

  /* ---------- problem setup ---------- */
  get preset() { return this.s.preset === 'custom' ? null : EULER_PRESETS[this.s.preset]; }

  pickPreset(i, initial = false) {
    this.pause();
    const custom = i >= EULER_PRESETS.length;
    this.ui.chips.select(i);
    this.ui.custom.hidden = !custom;
    this.s.k = 0;
    this.s.exactPref = null;
    this.ui.exactSwitch.input.checked = false;
    if (custom) {
      this.s.preset = 'custom';
      this.ui.expr.value = this.s.custom;
      this.formula = compileFormula(this.s.custom);
      this.ui.exprMsg.textContent = 'Use x, y, + − * / ^, sin, cos, exp, ln, sqrt.';
      this.ui.exprMsg.classList.remove('error');
      this.loadProblem(CUSTOM_DEFAULT.x0, CUSTOM_DEFAULT.y0, CUSTOM_DEFAULT.xe, CUSTOM_DEFAULT.n);
      this.win = fitEulerWindow(this.F, this.x0, this.y0, this.xe);
    } else {
      this.s.preset = i;
      const p = EULER_PRESETS[i];
      this.formula = compileFormula(p.expr);
      this.loadProblem(p.x0, p.y0, p.xe, p.n);
      this.win = { x: [...p.win.x], y: [...p.win.y] };
    }
    texTo(this.ui.eq, `y' = ${this.formula.tex}`);
    this.recompute();
    this.layout();
    if (!initial) this.announce(`Equation y' = ${plainText('$' + this.formula.tex + '$')}. Start at (${fmtShort(this.x0)}, ${fmtShort(this.y0)}).`);
  }

  loadProblem(x0, y0, xe, n) {
    this.x0q = Q.parse(x0);
    this.y0q = Q.parse(y0);
    this.xeq = Q.parse(xe);
    this.s.n = n;
    this.syncInputs();
  }

  get F() { return this.formula.f; }
  get x0() { return this.x0q.toNumber(); }
  get y0() { return this.y0q.toNumber(); }
  get xe() { return this.xeq.toNumber(); }

  syncInputs() {
    const show = q => (q.exactDecimal(6) ?? `${q.n}/${q.d}`).replace('-', MINUS);
    const ui = this.ui;
    if (this.root.activeElement !== ui.x0) ui.x0.value = show(this.x0q);
    if (this.root.activeElement !== ui.y0) ui.y0.value = show(this.y0q);
    if (this.root.activeElement !== ui.xe) ui.xe.value = show(this.xeq);
    if (this.root.activeElement !== ui.n) ui.n.value = String(this.s.n);
    for (const key of ['x0', 'y0', 'xe', 'n']) ui[key].classList.remove('invalid');
    ui.minus.disabled = this.s.n <= 1;
    ui.plus.disabled = this.s.n >= 64;
  }

  applyCustom(source) {
    try {
      const formula = compileFormula(source);
      this.ui.expr.classList.remove('invalid');
      this.ui.exprMsg.classList.remove('error');
      this.ui.exprMsg.textContent = 'Looks good.';
      this.s.custom = source;
      this.formula = formula;
      this.pause();
      this.s.k = 0;
      texTo(this.ui.eq, `y' = ${formula.tex}`);
      this.win = fitEulerWindow(this.F, this.x0, this.y0, this.xe);
      this.recompute();
      this.layout();
    } catch (err) {
      this.ui.expr.classList.add('invalid');
      this.ui.exprMsg.classList.add('error');
      this.ui.exprMsg.textContent = err instanceof ExprError ? err.message : 'That formula did not parse.';
    }
  }

  readProblem(key) {
    const input = this.ui[key];
    const q = Q.parse(input.value);
    const vals = { x0: this.x0q, y0: this.y0q, xe: this.xeq };
    if (!q) { input.classList.add('invalid'); return; }
    vals[key] = q;
    // moving the start past the target carries the target along (same interval length)
    if (key === 'x0' && vals.xe.toNumber() <= q.toNumber()) vals.xe = q.add(this.xeq.sub(this.x0q));
    if (vals.xe.toNumber() <= vals.x0.toNumber()) {
      input.classList.add('invalid');
      this.ui.caption && richTo(this.ui.caption, 'The point to estimate must be to the right of the start: choose $\\bar{x} > x_0$.');
      return;
    }
    input.classList.remove('invalid');
    this.pause();
    this.x0q = vals.x0;
    this.y0q = vals.y0;
    this.xeq = vals.xe;
    const fr = this.win;
    const outside = this.x0 < fr.x[0] || this.xe > fr.x[1] || this.y0 < fr.y[0] || this.y0 > fr.y[1];
    if (outside || this.s.preset === 'custom') this.win = fitEulerWindow(this.F, this.x0, this.y0, this.xe);
    this.recompute();
    this.layout();
  }

  setStart(x0q, y0q) {
    if (this.x0q.equals(x0q) && this.y0q.equals(y0q)) return;
    this.x0q = x0q;
    this.y0q = y0q;
    this.recompute();
    this.draw();
    this.updatePanel();
  }

  setTarget(xeq) {
    if (this.xeq.equals(xeq)) return;
    this.xeq = xeq;
    this.recompute();
    this.draw();
    this.updatePanel();
  }

  setSteps(n) {
    if (!Number.isFinite(n)) { this.ui.n.classList.add('invalid'); return; }
    n = clamp(Math.round(n), 1, 64);
    const wasDone = this.s.k >= this.nEff && this.nEff > 0;
    this.pause();
    this.s.n = n;
    this.recompute();
    this.s.k = wasDone ? this.nEff : 0;
    this.draw();
    this.updatePanel();
  }

  setMode(mode) {
    this.s.mode = mode;
    this.ui.modeDec.setAttribute('aria-pressed', String(mode === 'dec'));
    this.ui.modeFrac.setAttribute('aria-pressed', String(mode === 'frac'));
    this.updatePanel(true);
  }

  /* ---------- numbers ---------- */
  recompute() {
    const s = this.s;
    const F = this.F;
    const FQ = this.formula.exact;
    const n = s.n;
    const Lq = this.xeq.sub(this.x0q);
    this.dxq = Lq.div(Q.int(n));
    this.dx = this.dxq.toNumber();
    const pts = [];
    let xq = this.x0q;
    let yq = this.y0q;
    let y = this.y0;
    this.brokenAt = null;
    for (let i = 0; i <= n; i++) {
      const x = xq ? xq.toNumber() : this.x0 + i * this.dx;
      if (yq) y = yq.toNumber();
      const p = { i, x, y, xq, yq };
      pts.push(p);
      if (i === n) break;
      p.m = F(x, y);
      p.mq = FQ && xq && yq ? FQ(xq, yq) : null;
      if (p.mq) p.m = p.mq.toNumber();
      if (!Number.isFinite(p.m)) { this.brokenAt = i; break; }
      p.dy = p.m * this.dx;
      p.dyq = p.mq ? capQ(p.mq.mul(this.dxq)) : null;
      const nextY = y + p.dy;
      if (!Number.isFinite(nextY) || Math.abs(nextY) > 1e12) { this.brokenAt = i; break; }
      xq = xq ? xq.add(this.dxq) : null;
      yq = yq && p.dyq ? capQ(yq.add(p.dyq)) : null;
      y = nextY;
    }
    this.pts = pts;
    this.nEff = pts.length - 1;
    s.k = Math.min(s.k, this.nEff);
    if (s.anim && s.anim.k >= this.nEff) s.anim = null;

    // the true solution
    const preset = this.preset;
    this.exactInfo = preset ? preset.exact(this.x0, this.y0) : null;
    this.trueValue = null;
    this.trueTex = null;
    this.trueNote = '';
    const xe = this.xe;
    if (this.exactInfo) {
      const [a, b] = this.exactInfo.domain;
      if (xe >= a - 1e-12 && xe <= b + 1e-12) {
        this.trueValue = this.exactInfo.f(xe);
        this.trueTex = this.exactInfo.valueTex(xe);
      } else {
        this.trueNote = `The true solution ends at $x = ${decTex(a > this.x0 ? a : b, 3)}$, where it reaches $y = 0$ and $y' = x/y$ is undefined.`;
      }
    } else if (!(preset && preset.id === 'x/y')) {
      // no formula: integrate very finely (RK4) at two resolutions; if they disagree, it blew up
      const L = xe - this.x0;
      const coarse = rk4(F, this.x0, this.y0, xe, L / 2000, 1e9);
      const fine = rk4(F, this.x0, this.y0, xe, L / 4000, 1e9);
      const a = coarse[coarse.length - 1];
      const b = fine[fine.length - 1];
      const reached = !coarse.escaped && !fine.escaped && Math.abs(a[0] - xe) < 1e-9 && Math.abs(b[0] - xe) < 1e-9;
      if (reached && Math.abs(a[1] - b[1]) <= 1e-7 * Math.max(1, Math.abs(b[1]))) this.trueValue = b[1];
      else {
        const big = 1e3 * Math.max(1, Math.abs(this.y0), Math.abs(this.win.y[0]), Math.abs(this.win.y[1]));
        let where = b[0];
        for (const [x, y] of fine) if (Math.abs(y) > big) { where = x; break; }
        this.trueNote = `The true solution blows up near $x \\approx ${decTex(where, 2)}$, so $y(${decTex(xe, 3)})$ does not exist. Euler’s method still returns a number: straight steps cannot see a blow-up coming.`;
      }
    } else {
      this.trueNote = 'This start is on $y = 0$, where $y\' = x/y$ is undefined.';
    }
  }

  /** Curvature sign along the run: +1 concave up, -1 concave down, 0 mixed. */
  concavity() {
    let up = 0;
    let down = 0;
    for (const p of this.pts.slice(0, this.nEff + 1)) {
      const c = secondDerivative(this.F, p.x, p.y);
      if (c > 1e-9) up++;
      else if (c < -1e-9) down++;
    }
    if (up && !down) return 1;
    if (down && !up) return -1;
    return 0;
  }

  eulerEstimate(n) {
    const dx = (this.xe - this.x0) / n;
    let y = this.y0;
    for (let i = 0; i < n; i++) {
      y += dx * this.F(this.x0 + i * dx, y);
      if (!Number.isFinite(y)) return NaN;
    }
    return y;
  }

  /* ---------- layout + static drawing ---------- */
  layout() {
    const ui = this.ui;
    const width = ui.svg.parentElement.clientWidth;
    if (!width) return;
    const height = Math.round(clamp(width * 0.7, 270, 470));
    const narrow = width < 460;
    const margin = { l: narrow ? 34 : 40, r: 12, t: 14, b: 34 };
    setAttrs(ui.svg, { width, height, viewBox: `0 0 ${width} ${height}` });
    this.frame = new Frame().set(margin.l, margin.t, width - margin.l - margin.r, height - margin.t - margin.b, this.win.x, this.win.y);
    const fr = this.frame;
    ui.static.textContent = '';
    drawAxes(ui.static, fr, { xTarget: narrow ? 5 : 8, yTarget: narrow ? 5 : 7 });
    setAttrs(ui.clip, { x: fr.L, y: fr.T, width: fr.W, height: fr.H, viewBox: `${fr.L} ${fr.T} ${fr.W} ${fr.H}` });
    const spacing = narrow ? 24 : 28;
    ui.field.setAttribute('d', slopeFieldPath(fr, this.F, spacing, spacing * 0.56));
    this.draw();
    this.updatePanel(true);
  }

  /* ---------- dynamic drawing ---------- */
  showingExact() {
    if (this.s.exactPref != null) return this.s.exactPref;
    return this.s.k >= this.nEff && !this.s.anim && this.nEff > 0;
  }

  draw() {
    const fr = this.frame;
    if (!fr) return;
    const ui = this.ui;
    const s = this.s;
    const pts = this.pts;
    const X = x => clamp(fr.X(x), -1e5, 1e5);
    const Y = y => clamp(fr.Y(y), -1e5, 1e5);
    const a = s.anim;
    const tA = a ? clamp(a.t / 0.3, 0, 1) : 0;
    const tB = a ? clamp((a.t - 0.3) / 0.55, 0, 1) : 0;
    const tC = a ? clamp((a.t - 0.85) / 0.15, 0, 1) : 0;
    const done = s.k >= this.nEff && !a;
    const span = fr.yb - fr.ya;

    // exact solution + local curves
    const showExact = this.showingExact();
    ui.exactSwitch.input.checked = showExact;
    const exactPts = solutionThrough(this.F, this.x0, this.y0, fr.xa, fr.xb, Math.max(1e3, Math.abs(fr.yb) * 4 + span * 4));
    ui.exact.setAttribute('d', pathData(exactPts, fr, span * 2));
    ui.exact.setAttribute('opacity', showExact ? 1 : 0);

    const curIndex = a ? a.k : s.k;
    const localCount = s.showLocal ? Math.min(curIndex, this.nEff) + 1 : 0;
    while (ui.locals.childNodes.length < localCount) svgEl('path', { class: 'curve local' }, ui.locals);
    [...ui.locals.childNodes].forEach((path, i) => {
      if (i >= localCount) { path.setAttribute('d', ''); return; }
      const p = pts[i];
      path.setAttribute('d', pathData(solutionThrough(this.F, p.x, p.y, fr.xa, fr.xb, 1e4, 360), fr, span * 2));
      path.setAttribute('class', `curve local${i === curIndex ? ' now' : ''}`);
    });

    // target line + handle
    const tx = X(this.xe);
    setAttrs(ui.target, { x1: tx, x2: tx, y1: fr.T, y2: fr.B });
    const lastPt = pts[this.nEff];
    const estText = numText(lastPt.yq, lastPt.y);
    const estExact = lastPt.yq ? lastPt.yq.exactDecimal(4) != null : false;
    const targetStr = done ? `y(${fmtShort(this.xe)}) ${estExact ? '=' : '≈'} ${estText}` : `y(${fmtShort(this.xe)}) = ?`;
    mathText(ui.targetText, targetStr);
    ui.targetText.setAttribute('class', done ? 'lbl blue' : 'lbl');
    const tw = Math.max(64, targetStr.length * 7.4 + 18);
    const tcx = clamp(tx, fr.L + tw / 2, fr.R - tw / 2);
    setAttrs(ui.targetPill, { x: tcx - tw / 2, y: fr.T + 6, width: tw });
    setAttrs(ui.targetHit, { x: tcx - tw / 2 - 4, y: fr.T + 1, width: tw + 8 });
    setAttrs(ui.targetText, { x: tcx, y: fr.T + 21 });
    ui.targetHandle.setAttribute('aria-valuetext', `x = ${fmtShort(this.xe)}`);

    // completed path (+ the moving segment)
    const coords = [];
    for (let i = 0; i <= s.k; i++) coords.push([X(pts[i].x), Y(pts[i].y)]);
    let mover = null;
    if (a && tB > 0) {
      const P = pts[a.k];
      const N = pts[a.k + 1];
      const e = easeInOut(tB);
      mover = [X(lerp(P.x, N.x, e)), Y(lerp(P.y, N.y, e))];
      coords.push(mover);
    }
    ui.path.setAttribute('d', coords.length > 1 ? `M${coords.map(c => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join('L')}` : '');

    // points P1..Pk
    const count = s.k;
    while (ui.pts.childNodes.length < count) svgEl('circle', { class: 'pt', r: 3.6 }, ui.pts);
    [...ui.pts.childNodes].forEach((c, j) => {
      const i = j + 1;
      if (i > count) { c.setAttribute('opacity', 0); return; }
      setAttrs(c, { cx: X(pts[i].x), cy: Y(pts[i].y), r: i === count && !done ? 4.6 : 3.6, opacity: 1 });
    });
    if (mover) {
      setAttrs(ui.mover, { cx: mover[0], cy: mover[1], r: 4.6 + 1.8 * Math.sin(Math.PI * tC), opacity: 1 });
    } else ui.mover.setAttribute('opacity', 0);
    const cur = pts[curIndex];
    const haloOn = (a || (!done && s.k > 0));
    setAttrs(ui.halo, { cx: X(cur.x), cy: Y(cur.y), opacity: haloOn ? 0.14 : 0 });

    // P label at the current point
    if (!done && curIndex > 0 && curIndex <= this.nEff) {
      mathText(ui.pLabel, `P_${curIndex}`);
      setAttrs(ui.pLabel, { x: X(cur.x) - 9, y: Y(cur.y) - 10, 'text-anchor': 'end', opacity: 1 });
    } else ui.pLabel.setAttribute('opacity', 0);

    // step guides: tangent, slope mark, run and rise
    const g = a ? a.k : (!done && s.k > 0 ? s.k - 1 : null);
    if (g != null && pts[g + 1]) {
      const P = pts[g];
      const N = pts[g + 1];
      const px = X(P.x);
      const py = Y(P.y);
      const nx = X(N.x);
      const ny = Y(N.y);
      const live = !!a;
      const fadeIn = live ? easeOut(tA) : 0;
      // tangent line through P, extended past the landing point
      const ext = 0.45;
      setAttrs(ui.tangent, {
        x1: X(P.x - ext * this.dx), y1: Y(P.y - ext * this.dx * P.m),
        x2: X(P.x + (1 + ext) * this.dx), y2: Y(P.y + (1 + ext) * this.dx * P.m),
        opacity: live ? 0.75 * fadeIn : 0,
      });
      const mark = slopeSegment(fr, px, py, P.m, 34);
      setAttrs(ui.mark, { ...mark, opacity: live ? fadeIn * (1 - 0.6 * tB) : 0 });
      const guideOpacity = live ? fadeIn : 0.6;
      setAttrs(ui.run, { x1: px, y1: py, x2: nx, y2: py, opacity: guideOpacity });
      setAttrs(ui.rise, { x1: nx, y1: py, x2: nx, y2: ny, opacity: guideOpacity });
      const runLen = Math.abs(nx - px);
      const riseLen = Math.abs(ny - py);
      if (runLen > 30) {
        mathText(ui.dxLabel, 'Δx');
        setAttrs(ui.dxLabel, { x: (px + nx) / 2, y: ny < py ? py + 16 : py - 7, opacity: guideOpacity });
      } else ui.dxLabel.setAttribute('opacity', 0);
      if (riseLen > 18 && runLen > 14) {
        mathText(ui.dyLabel, 'Δy');
        setAttrs(ui.dyLabel, { x: nx + 6, y: (py + ny) / 2 + 4, opacity: guideOpacity });
      } else ui.dyLabel.setAttribute('opacity', 0);
    } else {
      for (const el of [ui.tangent, ui.mark, ui.run, ui.rise, ui.dxLabel, ui.dyLabel]) el.setAttribute('opacity', 0);
    }

    // finish: the true value and the error, beside the target line
    const last = pts[this.nEff];
    const tv = this.trueValue;
    const trueOn = done && this.nEff > 0 && showExact && tv != null && Number.isFinite(tv);
    if (trueOn) {
      const lx = X(last.x);
      const ly = Y(last.y);
      const ty = Y(tv);
      setAttrs(ui.trueDot, { cx: lx, cy: ty, opacity: 1 });
      const bx = lx + 9;
      const gap = Math.abs(ty - ly);
      ui.bracket.setAttribute('d', `M${bx - 4},${ly.toFixed(1)}H${bx}V${ty.toFixed(1)}H${bx - 4}`);
      ui.bracket.setAttribute('opacity', gap > 5 ? 0.9 : 0);
      const right = fr.R - bx > 118;
      const tx0 = right ? bx + 7 : lx - 14;
      const anchor = right ? 'start' : 'end';
      let yTrue = ty + 5;
      let yErr = (ly + ty) / 2 + 5;
      if (Math.abs(yTrue - yErr) < 24) yErr = yTrue + (ly > ty ? 24 : -24);
      yTrue = clamp(yTrue, fr.T + 40, fr.B - 4);
      yErr = clamp(yErr, fr.T + 40, fr.B - 4);
      this.setPill(ui.trueLabel, tx0, yTrue, `true ${fmt(tv, 4)}`, 1, anchor);
      this.setPill(ui.errLabel, tx0, yErr, `error ${fmt(Math.abs(tv - last.y), 3)}`, gap > 5 ? 1 : 0, anchor);
    } else {
      for (const p of [ui.trueLabel, ui.errLabel]) p.g.setAttribute('opacity', 0);
      for (const el of [ui.trueDot, ui.bracket]) el.setAttribute('opacity', 0);
    }

    // start handle
    const sx = X(this.x0);
    const sy = Y(this.y0);
    ui.start.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
    ui.start.setAttribute('aria-valuetext', `(${fmtShort(this.x0)}, ${fmtShort(this.y0)})`);
    mathText(ui.p0Label, 'P_0');
    const leftRoom = sx - fr.L > 34;
    setAttrs(ui.p0Label, { x: leftRoom ? sx - 12 : sx + 12, y: sy - 11, 'text-anchor': leftRoom ? 'end' : 'start' });

    const dxText = fmtShort(this.dx, 4);
    ui.svg.setAttribute('aria-label',
      `Slope field of y' = ${plainText('$' + this.formula.tex + '$')} with Euler's method from (${fmtShort(this.x0)}, ${fmtShort(this.y0)}), ` +
      `${this.nEff} steps of size ${dxText}. ${s.k} steps taken${s.k ? `; latest point (${fmt(pts[s.k].x, 3)}, ${fmt(pts[s.k].y, 4)})` : ''}.`);
    this.updateCaption();
  }

  /* ---------- text: caption, calculations, table, result ---------- */
  nt(q, v) { return numTex(q, v, this.s.mode); }

  pointTex(i) {
    const p = this.pts[i];
    return `P_{${i}} = (${this.nt(p.xq, p.x).tex},\\ ${this.nt(p.yq, p.y).tex})`;
  }

  updateCaption() {
    const s = this.s;
    const a = s.anim;
    let text;
    if (this.brokenAt != null && s.k >= this.nEff && !a) {
      text = `The slope at $P_{${this.brokenAt}}$ is undefined (or the values blew up), so Euler’s method cannot continue.`;
    } else if (a) {
      const P = this.pts[a.k];
      const m = this.nt(P.mq, P.m);
      const dy = this.nt(P.dyq, P.dy);
      const dx = this.nt(this.dxq, this.dx);
      if (a.t < 0.3) text = `<b>Read the slope</b> at $P_{${a.k}}$: the field there has slope $m_{${a.k}} = ${m.tex}$.`;
      else if (a.t < 0.85) text = `<b>Follow it</b> for $\\Delta x = ${dx.tex}$: the height changes by $\\Delta y = m_{${a.k}}\\,\\Delta x ${dy.exact ? '=' : '\\approx'} ${dy.tex}$.`;
      else text = `<b>Land</b> at ${'$' + this.pointTex(a.k + 1) + '$'}.`;
    } else if (s.k === 0) {
      text = `Start at ${'$' + this.pointTex(0) + '$'}. Each step <b>reads the slope</b> where you are, then <b>walks straight</b> for $\\Delta x$. Drag $P_0$ or the target to change the problem.`;
    } else if (s.k < this.nEff) {
      const P = this.pts[s.k];
      const prev = this.pts[s.k - 1];
      const m = this.nt(P.mq, P.m);
      const change = Math.abs(P.m - prev.m) < 1e-12 ? 'the same' : `${m.exact ? '' : 'about '}$${m.tex}$`;
      text = `Now at ${'$' + this.pointTex(s.k) + '$'}. The slope here is ${change}, not $${this.nt(prev.mq, prev.m).tex}$: Euler reads it fresh before every step.`;
      if (Math.abs(P.m - prev.m) < 1e-12) text = `Now at ${'$' + this.pointTex(s.k) + '$'}. The slope here is still $${m.tex}$; take the next step.`;
    } else {
      const last = this.pts[this.nEff];
      const est = this.nt(last.yq, last.y);
      text = `After ${this.nEff} step${this.nEff > 1 ? 's' : ''}, Euler estimates $y(${decTex(this.xe, 4)}) ${est.exact ? '=' : '\\approx'} ${est.tex}$` +
        (this.showingExact() && this.trueValue != null ? `; the true solution (green) gives $${decTex(this.trueValue, 4)}$.` : '.') +
        ' Change the number of steps to compare.';
    }
    richTo(this.ui.caption, text);
  }

  updateButtons() {
    const s = this.s;
    const ui = this.ui;
    const done = s.k >= this.nEff;
    ui.step.disabled = done || !!s.anim || s.playing;
    ui.back.disabled = s.k === 0 && !s.anim;
    ui.reset.disabled = s.k === 0 && !s.anim;
    ui.play.innerHTML = (s.playing ? ICONS.pause : ICONS.play) + `<span>${s.playing ? 'Pause' : done ? 'Replay' : 'Play'}</span>`;
    ui.play.setAttribute('aria-label', s.playing ? 'Pause' : done ? 'Replay all steps' : 'Play all steps');
  }

  updatePanel(force = false) {
    const s = this.s;
    const ui = this.ui;
    this.updateButtons();
    const dxT = this.nt(this.dxq, this.dx);
    const x0T = this.nt(this.x0q, this.x0);
    const xeT = this.nt(this.xeq, this.xe);
    texTo(ui.dx, `\\Delta x = \\frac{${xeT.tex} - ${x0T.neg ? `(${x0T.tex})` : x0T.tex}}{${s.n}} ${dxT.exact ? '=' : '\\approx'} ${dxT.tex}`);
    this.syncInputs();

    // headline + calculation for the step being taken (or the one just taken)
    const a = s.anim;
    const showing = a ? a.k : s.k > 0 ? s.k - 1 : null;
    if (showing == null) {
      ui.status.textContent = `Ready · ${this.nEff} step${this.nEff === 1 ? '' : 's'}`;
      texTo(ui.calc, `\\begin{aligned} x_{i+1} &= x_i + \\Delta x\\\\ y_{i+1} &= y_i + F(x_i, y_i)\\,\\Delta x \\end{aligned}`, true);
    } else {
      ui.status.textContent = `Step ${showing + 1} of ${this.nEff}`;
      const i = showing;
      const P = this.pts[i];
      const N = this.pts[i + 1];
      const xi = this.nt(P.xq, P.x);
      const yi = this.nt(P.yq, P.y);
      const m = this.nt(P.mq, P.m);
      const dy = this.nt(P.dyq, P.dy);
      const xn = this.nt(N.xq, N.x);
      const yn = this.nt(N.yq, N.y);
      const rel = t => (t.exact ? '=' : '\\approx');
      const sub = this.formula.subTex(xi, yi);
      const wrapNeg = t => (t.neg ? `\\left(${t.tex}\\right)` : t.tex);
      // the slope line: plug the current point into f, on its own line when that is long
      const slopeLine = sub === m.tex
        ? `m_{${i}} &= \\textstyle F(${xi.tex},\\ ${yi.tex}) ${rel(m)} ${m.tex}\\\\`
        : `m_{${i}} &= \\textstyle F(${xi.tex},\\ ${yi.tex})\\\\ &= \\textstyle ${sub} ${rel(m)} ${m.tex}\\\\`;
      texTo(ui.calc,
        '\\begin{aligned}' +
        slopeLine +
        `\\Delta y_{${i}} &= m_{${i}}\\,\\Delta x = ${wrapNeg(m)}\\cdot ${dxT.tex} ${rel(dy)} ${dy.tex}\\\\` +
        `x_{${i + 1}} &= ${xi.tex} + ${dxT.tex} ${rel(xn)} ${xn.tex}\\\\` +
        `y_{${i + 1}} &= ${yi.tex} + ${wrapNeg(dy)} ${rel(yn)} ${yn.tex}` +
        '\\end{aligned}', true);
    }
    this.updateTable(force);
    this.updateResult();
  }

  updateTable(force) {
    const s = this.s;
    const n = this.nEff;
    const rowsWanted = n + 1;
    if (force || !this.rows || this.rows.length !== rowsWanted) {
      this.ui.tbody.textContent = '';
      this.rows = [];
      for (let i = 0; i <= n; i++) {
        const cells = [h('td', { text: String(i) }), h('td'), h('td'), h('td'), h('td')];
        const tr = h('tr', null, cells);
        tr.addEventListener('click', () => this.jumpTo(i));
        tr.addEventListener('pointerenter', () => this.ringPoint(i));
        tr.addEventListener('pointerleave', () => this.ringPoint(null));
        this.ui.tbody.append(tr);
        this.rows.push({ tr, cells });
      }
    }
    const a = s.anim;
    const current = a ? a.k : s.k;
    const setNum = (td, q, v, show) => {
      const key = show ? `${this.s.mode}|${q ? `${q.n}/${q.d}` : v}` : '';
      if (td.__key === key) return;
      td.__key = key;
      if (!show) { td.textContent = ''; return; }
      if (this.s.mode === 'frac' && q && q.d !== 1n) {
        const t = numTex(q, v, 'frac');
        if (t.frac) { texTo(td, t.tex); return; }
      }
      td.__tex = null;
      td.textContent = numText(q, v);
    };
    for (let i = 0; i <= n; i++) {
      const { tr, cells } = this.rows[i];
      const p = this.pts[i];
      const reached = i <= s.k;
      const slopeKnown = i < s.k || (a && i === a.k);
      tr.className = [reached ? 'done' : 'todo', i === current && !(i === n && reached && !a) ? 'current' : '', i === n ? 'final' : ''].join(' ');
      setNum(cells[1], p.xq, p.x, true);
      setNum(cells[2], p.yq, p.y, reached);
      if (i === n) {
        cells[3].textContent = reached ? '—' : '';
        cells[4].textContent = '';
        cells[3].__key = cells[4].__key = null;
      } else {
        setNum(cells[3], p.mq, p.m, slopeKnown);
        setNum(cells[4], p.dyq, p.dy, slopeKnown);
      }
    }
    // keep the current row in view without scrolling the page
    const wrap = this.ui.tableWrap;
    const row = this.rows[Math.min(current, n)]?.tr;
    if (row && wrap.clientHeight) {
      const top = row.offsetTop - 32;
      const bottom = row.offsetTop + row.offsetHeight;
      if (top < wrap.scrollTop) wrap.scrollTop = top;
      else if (bottom > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = bottom - wrap.clientHeight;
    }
  }

  updateResult() {
    const ui = this.ui;
    const s = this.s;
    const done = s.k >= this.nEff && !s.anim && this.nEff > 0;
    const card = ui.result;
    const key = [done, this.nEff, s.mode, this.x0, this.y0, this.xe, s.n, this.formula.source].join('|');
    if (card.__key === key) return;
    card.__key = key;
    card.hidden = !done;
    if (!done) return;
    card.textContent = '';
    const last = this.pts[this.nEff];
    const est = this.nt(last.yq, last.y);
    const left = h('div');
    const right = h('div');
    card.append(h('div', { class: 'result-grid' }, left, right));
    left.append(h('div', { class: 'kicker', text: 'Result' }));
    const rows = h('div', { class: 'rows' });
    const add = (k, rich) => {
      const v = h('span', { class: 'v' });
      richTo(v, rich);
      rows.append(h('span', { class: 'k', text: k }), v);
    };
    const xeTex = decTex(this.xe, 4);
    add('Euler', `$y(${xeTex}) ${est.exact ? '=' : '\\approx'} ${est.tex}$${s.mode === 'frac' && est.frac ? ` $\\approx ${decTex(last.y, 4)}$` : ''}`);
    const tv = this.trueValue;
    const haveTrue = tv != null && Number.isFinite(tv);
    if (haveTrue) {
      const symbolic = this.trueTex && !/^-?[\d.]+$/.test(this.trueTex) ? `${this.trueTex} \\approx ` : '';
      add('True', `$y(${xeTex}) = ${symbolic}${decTex(tv, 4)}$`);
      const err = last.y - tv;
      const pct = Math.abs(tv) > 1e-9 ? ` (${fmtShort(Math.abs(err / tv) * 100, 1)}%)` : '';
      add('Error', `$${decTex(Math.abs(err), 4)}$${pct}, ${err < 0 ? 'too low' : err > 0 ? 'too high' : 'none'}`);
    }
    left.append(rows);
    if (this.exactInfo && this.exactInfo.tex) {
      const p = h('p', { class: 'why' });
      const how = this.preset?.how === 'separable' ? ' (found by separating variables)' : this.preset?.how === 'linear' ? ' (not separable; you can check it by differentiating)' : '';
      richTo(p, `The true solution is $${this.exactInfo.tex}$${how}.`);
      left.append(p);
    }
    if (haveTrue) {
      const err = last.y - tv;
      const shape = this.concavity();
      const why = h('p', { class: 'why' });
      if (shape === 1 && err < 0) richTo(why, '<b>Why too low?</b> The solution curves are <b>concave up</b> here. A tangent line lies below a concave-up curve, so every step lands a little low.');
      else if (shape === -1 && err > 0) richTo(why, '<b>Why too high?</b> The solution curves are <b>concave down</b> here. A tangent line lies above a concave-down curve, so every step overshoots.');
      else richTo(why, 'The solution curves bend different ways along this run, so some of the step errors cancel.');
      left.append(why);
    } else {
      const p = h('p', { class: 'why' });
      richTo(p, this.trueNote || 'The true value is not available here.');
      left.append(p);
    }

    // the same problem with other step sizes
    const list = [];
    let n0 = s.n;
    while (n0 % 2 === 0 && n0 > 1 && list.length < 2) { n0 /= 2; list.unshift(n0); }
    list.push(s.n);
    let m = s.n;
    while (list.length < 6 && m * 2 <= 128) { m *= 2; list.push(m); }
    const data = list.map(k => ({ n: k, est: this.eulerEstimate(k) })).map(r => ({ ...r, err: haveTrue ? Math.abs(r.est - tv) : NaN }));
    const maxErr = Math.max(...data.map(r => (Number.isFinite(r.err) ? r.err : 0)), 1e-12);
    const tbody = h('tbody');
    for (const r of data) {
      const fill = h('span', { class: 'fill' });
      fill.style.width = `${Number.isFinite(r.err) ? Math.max(2, (100 * r.err) / maxErr) : 0}%`;
      const tr = h('tr', { class: r.n === s.n ? 'you' : '' },
        h('td', { text: String(r.n) }), h('td', { text: fmtShort((this.xe - this.x0) / r.n, 5) }),
        h('td', { text: fmt(r.est, 4) }), haveTrue && h('td', { text: fmt(r.err, 4) }), haveTrue && h('td', { class: 'bar' }, fill));
      if (r.n <= 64 && r.n !== s.n) {
        tr.style.cursor = 'pointer';
        tr.title = `Show ${r.n} steps`;
        tr.addEventListener('click', () => this.setSteps(r.n));
      }
      tbody.append(tr);
    }
    const table = h('table', { class: 'bars', 'aria-label': 'Error for different step sizes' },
      h('thead', null, h('tr', null, h('th', { tex: 'n' }), h('th', { tex: '\\Delta x' }), h('th', { text: 'estimate' }), haveTrue && h('th', { text: 'error' }), haveTrue && h('th'))), tbody);
    const ratios = [];
    for (let i = 1; i < data.length; i++) if (data[i - 1].err > 1e-12) ratios.push(data[i].err / data[i - 1].err);
    const avg = ratios.length ? ratios.reduce((u, v) => u + v, 0) / ratios.length : NaN;
    const ratio = h('p', { class: 'ratio' });
    if (haveTrue && Number.isFinite(avg)) richTo(ratio, `Halving $\\Delta x$ multiplies the error by about <b>${fmtShort(avg, 2)}</b>: the error is roughly proportional to $\\Delta x$. Click a row to compare.`);
    else if (!haveTrue) {
      const grows = data.length > 2 && data.every((r, i) => i === 0 || Math.abs(r.est) > Math.abs(data[i - 1].est) * 1.15);
      richTo(ratio, grows
        ? 'Smaller steps do not settle on an answer: the estimates keep growing. That is what chasing a blow-up looks like.'
        : 'Without a true value, compare the estimates: if they settle down as $\\Delta x$ shrinks, you can trust them.');
    }
    right.append(h('div', { class: 'kicker', text: 'Same problem, smaller steps' }), table, ratio);
  }

  /* ---------- stepping ---------- */
  stepDuration() {
    if (!this.s.playing) return 1500;
    // a whole run takes about 4–5 seconds, however many steps it has
    return clamp(4200 / this.nEff, 70, 1000);
  }

  stepOnce() {
    if (this.s.anim || this.s.k >= this.nEff) return;
    this.startStep();
  }

  startStep() {
    const s = this.s;
    if (s.k >= this.nEff) return;
    if (reducedMotion()) {
      s.k++;
      this.afterStep();
      return;
    }
    s.anim = { k: s.k, t: 0, dur: this.stepDuration() };
    let last = null;
    this.updatePanel();
    const tick = now => {
      if (!s.anim) return;
      if (last == null) last = now;
      const dt = Math.min(50, now - last);
      last = now;
      s.anim.t = Math.min(1, s.anim.t + dt / s.anim.dur);
      this.draw();
      if (s.anim.t >= 1) {
        s.anim = null;
        s.k++;
        this.afterStep();
        return;
      }
      this._raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(tick);
    this.updateButtons();
  }

  afterStep() {
    const s = this.s;
    this.draw();
    this.updatePanel();
    const p = this.pts[s.k];
    if (s.k >= this.nEff) {
      s.playing = false;
      this.updateButtons();
      this.announce(`Done. Euler estimate y(${fmtShort(this.xe)}) ≈ ${fmt(p.y, 4)}.` + (this.trueValue != null ? ` True value ${fmt(this.trueValue, 4)}.` : ''));
      this.updateResult();
      return;
    }
    if (!s.playing) this.announce(`Step ${s.k}: new point (${fmt(p.x, 4)}, ${fmt(p.y, 4)}).`);
    if (s.playing) {
      clearTimeout(this._timer);
      const gap = reducedMotion() ? 700 : clamp(this.stepDuration() * 0.22, 12, 240);
      this._timer = setTimeout(() => { if (this.s.playing) this.startStep(); }, gap);
    }
  }

  play() {
    const s = this.s;
    if (s.k >= this.nEff) { s.k = 0; s.anim = null; }
    s.playing = true;
    this.updateButtons();
    if (!s.anim) this.startStep();
  }

  /** Pause button: finish the step in progress, then stop. */
  stopPlaying() {
    this.s.playing = false;
    clearTimeout(this._timer);
    this.updateButtons();
  }

  /** External pause (scrolled away, tab hidden, post closed). */
  pause() {
    if (!this.s) return;
    this.s.playing = false;
    clearTimeout(this._timer);
    if (this.s.anim) {
      cancelAnimationFrame(this._raf);
      this.s.anim = null;
      this.draw();
      this.updatePanel();
    }
    this.updateButtons?.();
  }

  back() {
    const s = this.s;
    this.pause();
    if (s.k > 0) s.k--;
    this.draw();
    this.updatePanel();
  }

  reset() {
    this.pause();
    this.s.k = 0;
    this.draw();
    this.updatePanel();
    this.announce('Back to the start.');
  }

  jumpTo(i) {
    this.pause();
    this.s.k = clamp(i, 0, this.nEff);
    this.draw();
    this.updatePanel();
  }
}

/* ------------------------------------------------------------------
 * <separable-ode mode="family">  separate, integrate, use the start
 * <separable-ode mode="areas">   why it works: matching areas
 * ------------------------------------------------------------------ */

const P = v => (v < 0 ? `(${decTex(v, 3)})` : decTex(v, 3));
const near = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
const relTex = (v, places = 3) => (near(v, +v.toFixed(places), 1e-10) ? '=' : '\\approx');

const FAMILY_PRESETS = [
  {
    id: '2xy',
    chip: "y' = 2xy",
    aria: 'y prime equals 2 x y',
    F: (x, y) => 2 * x * y,
    start: [0, 1],
    win: { x: [-1.6, 1.6], y: [-3.2, 3.2] },
    equilibria: [0],
    constTex: 'y = 0',
    constWords: 'Write $2xy = f(x)\\,g(y)$ with $g(y) = y$. Since $g(0) = 0$, the line $y = 0$ is a solution. Note it <em>before</em> dividing by $y$.',
    sepTex: '\\frac{1}{y}\\,dy = 2x\\,dx',
    intTex: '\\ln|y| = x^2 + C',
    checkTex: "y = Ae^{x^2} \\;\\Rightarrow\\; y' = 2x\\cdot Ae^{x^2} = 2xy",
    family(add) {
      for (const A of [0.05, 0.15, 0.3, 0.6, 1, 1.6, 2.5]) for (const s of [1, -1]) add(x => s * A * Math.exp(x * x));
    },
    solve(x0, y0) {
      if (near(y0, 0)) return { kind: 'equilibrium', value: 0 };
      const C = Math.log(Math.abs(y0)) - x0 * x0;
      const lnPart = near(Math.abs(y0), 1) ? '' : `\\ln ${decTex(Math.abs(y0), 3)}`;
      const sqPart = near(x0, 0) ? '' : decTex(x0 * x0, 4);
      const sym = lnPart && sqPart ? `${lnPart} - ${sqPart}` : lnPart || (sqPart ? `-${sqPart}` : '0');
      const cTex = lnPart ? `${sym} \\approx ${decTex(C, 3)}` : sym;
      const shift = near(x0, 0) ? 'x^2' : `x^2 - ${decTex(x0 * x0, 4)}`;
      return {
        kind: 'curve',
        y: x => y0 * Math.exp(x * x - x0 * x0),
        domain: [-Infinity, Infinity],
        icTex: `\\ln|${decTex(y0, 3)}| = ${P(x0)}^2 + C \\;\\Rightarrow\\; C = ${cTex}`,
        solTex: `|y| = e^{C}e^{x^2} \\;\\Rightarrow\\; y = ${termsTex([{ c: y0, body: `e^{${shift}}` }])}`,
        words: `${y0 > 0 ? 'The start is above the axis, so take the <b>positive</b> sign.' : 'The start is below the axis, so take the <b>negative</b> sign.'} Defined for every $x$.`,
      };
    },
  },
  {
    id: 'x/y',
    chip: "y' = \\frac{x}{y}",
    aria: 'y prime equals x over y',
    F: (x, y) => x / y,
    start: [0, 2],
    win: { x: [-3, 3], y: [-3, 3] },
    equilibria: [],
    singular: 0,
    constTex: '\\text{none}',
    constWords: 'No horizontal line works: a constant $y$ would need $x/y = 0$ for every $x$. Also $y = 0$ is off-limits, because $x/y$ is undefined there.',
    sepTex: 'y\\,dy = x\\,dx',
    intTex: '\\frac{y^2}{2} = \\frac{x^2}{2} + C_1 \\;\\Rightarrow\\; y^2 - x^2 = C',
    checkTex: "y^2 - x^2 = C \\;\\Rightarrow\\; 2y\\,y' - 2x = 0 \\;\\Rightarrow\\; y' = \\frac{x}{y}",
    family(add) {
      for (const C of [-6, -3.5, -1.8, -0.6, 0, 0.6, 1.8, 3.5, 6]) for (const s of [1, -1]) add(x => s * Math.sqrt(x * x + C));
    },
    solve(x0, y0) {
      if (near(y0, 0)) return { kind: 'invalid', message: 'No solution starts on the $x$-axis: $y\' = x/y$ is undefined when $y = 0$. Move the point up or down.' };
      const C = +(y0 * y0 - x0 * x0).toFixed(6);
      const s = y0 > 0 ? 1 : -1;
      const cTex = near(C, 0) ? '' : C > 0 ? ` + ${decTex(C, 4)}` : ` - ${decTex(-C, 4)}`;
      const root = `\\sqrt{x^2${cTex}}`;
      let domain = [-Infinity, Infinity];
      let words = `${s > 0 ? 'The start has $y > 0$, so take the <b>positive</b> root.' : 'The start has $y < 0$, so take the <b>negative</b> root.'}`;
      let solTex = `y = ${s < 0 ? '-' : ''}${root}`;
      if (C > 1e-9) words += ' Since $x^2 + C > 0$, it is defined for every $x$.';
      else {
        const r = Math.sqrt(Math.max(0, -C));
        domain = x0 > 0 ? [r, Infinity] : [-Infinity, -r];
        const edge = decTex(x0 > 0 ? r : -r, 3);
        if (near(C, 0)) solTex = `y = ${s < 0 ? '-' : ''}\\sqrt{x^2} = ${s * Math.sign(x0) > 0 ? '' : '-'}x`;
        words += ` It only lives on $x ${x0 > 0 ? '>' : '<'} ${edge}$: there the curve reaches $y = 0$ with a vertical tangent, and the equation breaks down.`;
      }
      return {
        kind: 'curve',
        y: x => s * Math.sqrt(x * x + C),
        domain,
        endpoint: C <= 1e-9,
        icTex: `${P(y0)}^2 - ${P(x0)}^2 = C \\;\\Rightarrow\\; C = ${decTex(C, 4)}`,
        solTex,
        words,
      };
    },
  },
  {
    id: '-y2',
    chip: "y' = -y^2",
    aria: 'y prime equals negative y squared',
    F: (x, y) => -y * y,
    start: [0, 1],
    win: { x: [-3, 3], y: [-3, 3] },
    equilibria: [0],
    constTex: 'y = 0',
    constWords: 'Here $g(y) = y^2$, and $g(0) = 0$. So $y = 0$ is a solution, which dividing by $y^2$ would lose.',
    sepTex: '\\frac{1}{y^2}\\,dy = -\\,dx',
    intTex: '-\\frac{1}{y} = -x + C',
    checkTex: "y = \\frac{1}{x - C} \\;\\Rightarrow\\; y' = -\\frac{1}{(x - C)^2} = -y^2",
    family(add) {
      for (let C = -3.5; C <= 3.51; C += 0.5) add(x => 1 / (x - C), C);
    },
    solve(x0, y0) {
      if (near(y0, 0)) return { kind: 'equilibrium', value: 0 };
      const C = x0 - 1 / y0;
      const right = y0 > 0;
      const cLabel = decTex(C, 3);
      const denom = near(C, 0) ? 'x' : C > 0 ? `x - ${decTex(C, 3)}` : `x + ${decTex(-C, 3)}`;
      const inv = 1 / y0;
      const invExact = near(inv, +inv.toFixed(3), 1e-10);
      const invTex = invExact ? decTex(inv, 3) : `\\tfrac{1}{${decTex(y0, 3)}}`;
      let cTex;
      if (near(x0, 0)) cTex = invExact ? decTex(C, 3) : `-${invTex} \\approx ${decTex(C, 3)}`;
      else cTex = `${decTex(x0, 3)} - ${invExact && inv < 0 ? `(${invTex})` : invTex} ${relTex(C)} ${decTex(C, 3)}`;
      return {
        kind: 'curve',
        y: x => 1 / (x - C),
        domain: right ? [C, Infinity] : [-Infinity, C],
        other: { y: x => 1 / (x - C), domain: right ? [-Infinity, C] : [C, Infinity] },
        asymptote: C,
        icTex: `-\\frac{1}{${decTex(y0, 3)}} = -${P(x0)} + C \\;\\Rightarrow\\; C = ${cTex}`,
        solTex: `\\frac{1}{y} = x - C \\;\\Rightarrow\\; y = \\frac{1}{${denom}}`,
        words: `Valid only for $x ${right ? '>' : '<'} ${cLabel}$. At $x = ${cLabel}$ the solution blows up, and it cannot cross that wall.`,
        callout: `The same formula also draws the dashed piece on the other side of $x = ${cLabel}$. That piece is a <b>different</b> solution: the curve through your start never reaches it.`,
      };
    },
  },
  {
    id: '2-y',
    chip: "y' = 2 - y",
    aria: 'y prime equals 2 minus y',
    F: (x, y) => 2 - y,
    start: [0, 0],
    win: { x: [-1, 4], y: [-1.2, 5.2] },
    equilibria: [2],
    constTex: 'y = 2',
    constWords: 'Here $g(y) = 2 - y$, and $g(2) = 0$. So $y = 2$ is a solution, which dividing by $2 - y$ would lose.',
    sepTex: '\\frac{1}{2 - y}\\,dy = dx',
    intTex: '-\\ln|2 - y| = x + C',
    checkTex: "y = 2 - Ae^{-x} \\;\\Rightarrow\\; y' = Ae^{-x} = 2 - y",
    family(add) {
      for (const A of [0.15, 0.4, 0.8, 1.5, 3, 6, 12]) for (const s of [1, -1]) add(x => 2 - s * A * Math.exp(-x));
    },
    solve(x0, y0) {
      if (near(y0, 2)) return { kind: 'equilibrium', value: 2 };
      const C = -Math.log(Math.abs(2 - y0)) - x0;
      const absTex = decTex(Math.abs(2 - y0), 3);
      const lnPart = near(Math.abs(2 - y0), 1) ? '' : `-\\ln ${absTex}`;
      const xPart = near(x0, 0) ? '' : x0 > 0 ? `- ${decTex(x0, 3)}` : `+ ${decTex(-x0, 3)}`;
      let sym = lnPart && xPart ? `${lnPart} ${xPart}` : lnPart || (xPart ? xPart.replace('+ ', '').replace('- ', '-') : '0');
      if (lnPart) sym += ` \\approx ${decTex(C, 3)}`;
      return {
        kind: 'curve',
        y: x => 2 - (2 - y0) * Math.exp(-(x - x0)),
        domain: [-Infinity, Infinity],
        icTex: `-\\ln|2 - ${P(y0)}| = ${decTex(x0, 3)} + C \\;\\Rightarrow\\; C = ${sym}`,
        solTex: `|2 - y| = e^{-C}e^{-x} \\;\\Rightarrow\\; y = ${termsTex([{ c: 2, body: '' }, { c: -(2 - y0), body: expTex(shiftTex(x0, -1)) }])}`,
        words: `${y0 < 2 ? 'The start is below $y = 2$' : 'The start is above $y = 2$'}, which picks the sign. Defined for every $x$; the curve approaches $y = 2$ but never touches it.`,
      };
    },
  },
];

/* ---------- family view ---------- */
class FamilyView {
  constructor(host) {
    this.host = host;
    this.ui = {};
  }

  build() {
    const host = this.host;
    const ui = this.ui;
    ui.chips = host.makeChips(FAMILY_PRESETS.map(p => ({ tex: p.chip, aria: p.aria })), i => this.pick(i), 'Separable equation');
    ui.svg = svgEl('svg', { class: 'plot', role: 'group' });
    ui.static = svgEl('g', null, ui.svg);
    ui.clip = svgEl('svg', { class: 'clip', overflow: 'hidden' }, ui.svg);
    ui.field = svgEl('path', { class: 'field' }, ui.clip);
    ui.family = svgEl('path', { class: 'family' }, ui.clip);
    ui.equilibria = svgEl('g', null, ui.clip);
    ui.asymptote = svgEl('line', { class: 'asymptote', opacity: 0 }, ui.clip);
    ui.branch = svgEl('path', { class: 'curve branch' }, ui.clip);
    ui.ghost = svgEl('path', { class: 'ghost', opacity: 0 }, ui.clip);
    ui.solution = svgEl('path', { class: 'curve solution' }, ui.clip);
    ui.band = svgEl('rect', { class: 'band', opacity: 0 }, ui.clip);
    ui.clip.insertBefore(ui.band, ui.clip.firstChild);
    ui.tangent = svgEl('line', { class: 'slope-mark', opacity: 0.9 }, ui.clip);
    ui.endDot = svgEl('circle', { r: 4, fill: 'var(--_sheet)', stroke: 'var(--_sage)', 'stroke-width': 2, opacity: 0 }, ui.clip);
    ui.labels = svgEl('g', null, ui.svg);
    ui.handle = svgEl('g', { class: 'handle', tabindex: 0, role: 'slider', 'aria-label': 'Starting point. Drag it, click the plot, or use the arrow keys.' }, ui.svg);
    svgEl('circle', { class: 'hit', r: 22 }, ui.handle);
    svgEl('circle', { class: 'halo', r: 13 }, ui.handle);
    svgEl('circle', { class: 'ring', r: 6.5 }, ui.handle);
    svgEl('circle', { class: 'dot', r: 2.4 }, ui.handle);
    ui.handleLabel = svgEl('text', { class: 'lbl' }, ui.svg);

    ui.legend = h('div', { class: 'legend' },
      h('span', null, h('i', { class: 'swatch', style: 'color:var(--_sage)' }), 'your solution'),
      h('span', null, h('i', { class: 'swatch', style: 'color:rgba(62,59,57,.35);border-top-width:1.5px' }), 'other members of the family'),
      ui.eqLegend = h('span', null, h('i', { class: 'swatch dash', style: 'color:var(--_plum)' }), 'constant solution'));
    ui.caption = h('div', { class: 'caption' });
    const figure = h('div', { class: 'figure' }, ui.svg, ui.legend, ui.caption);

    ui.steps = h('ol', { class: 'steps-list' });
    ui.items = {};
    const item = (key, title) => {
      const li = h('li', null, h('div', { class: 't', text: title }), h('div', { class: 'm' }), h('div', { class: 'w' }));
      ui.items[key] = { li, t: li.children[0], m: li.children[1], w: li.children[2] };
      ui.steps.append(li);
    };
    item('const', 'Constant solutions first');
    item('sep', 'Separate');
    item('int', 'Integrate both sides');
    item('ic', 'Use the starting point');
    item('sol', 'Solve for y');
    item('check', 'Check');
    ui.callout = h('div', { class: 'callout', hidden: true });
    const side = h('div', { class: 'side' }, h('div', { class: 'card' }, h('div', { class: 'head' }, h('span', { class: 'kicker', text: 'Separate and solve' })), ui.steps, ui.callout));

    host.root.append(h('div', { class: 'ode family' }, h('div', { class: 'bar' }, ui.chips), h('div', { class: 'layout' }, figure, side)));
    this.wire();
    this.pick(Math.max(0, FAMILY_PRESETS.findIndex(p => p.id === host.getAttribute('preset'))), true);
  }

  wire() {
    const ui = this.ui;
    const toData = pt => {
      const fr = this.frame;
      return [Math.round(clamp(fr.x(pt.x), fr.xa, fr.xb) * 10) / 10, Math.round(clamp(fr.y(pt.y), fr.ya, fr.yb) * 10) / 10];
    };
    draggable(ui.handle, ui.svg, {
      start: () => this.hideGhost(),
      move: pt => this.setStart(...toData(pt)),
      end: () => this.host.announce(this.summary()),
    });
    ui.handle.addEventListener('keydown', e => {
      const d = e.shiftKey ? 0.5 : 0.1;
      const moves = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
      if (!moves[e.key]) return;
      e.preventDefault();
      const fr = this.frame;
      const x = clamp(Math.round((this.x0 + moves[e.key][0]) * 10) / 10, fr.xa, fr.xb);
      const y = clamp(Math.round((this.y0 + moves[e.key][1]) * 10) / 10, fr.ya, fr.yb);
      this.setStart(x, y);
      this.host.announce(this.summary());
    });
    ui.svg.addEventListener('click', e => {
      if (!this.frame || e.target.closest?.('.handle')) return;
      const pt = localPoint(ui.svg, e);
      if (!this.frame.inside(pt.x, pt.y)) return;
      this.setStart(...toData(pt));
      this.host.announce(this.summary());
    });
    ui.svg.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !this.frame || e.buttons) return;
      const pt = localPoint(ui.svg, e);
      if (!this.frame.inside(pt.x, pt.y) || e.target.closest?.('.handle')) { this.hideGhost(); return; }
      const [x, y] = toData(pt);
      const sol = this.preset.solve(x, y);
      ui.ghost.setAttribute('d', this.curvePath(sol));
      ui.ghost.setAttribute('opacity', 1);
      ui.svg.style.cursor = 'crosshair';
    });
    ui.svg.addEventListener('pointerleave', () => this.hideGhost());
  }

  hideGhost() {
    this.ui.ghost.setAttribute('opacity', 0);
  }

  get preset() { return FAMILY_PRESETS[this.index]; }

  pick(i, initial = false) {
    this.index = i;
    this.ui.chips.select(i);
    [this.x0, this.y0] = this.preset.start;
    const p = this.preset;
    const items = this.ui.items;
    texTo(items.sep.m, p.sepTex);
    texTo(items.int.m, p.intTex);
    richTo(items.int.w, 'The two constants of integration combine into one, $C$.');
    texTo(items.check.m, `${p.checkTex}\\;\\checkmark`);
    texTo(items.const.m, p.constTex);
    richTo(items.const.w, p.constWords);
    this.ui.eqLegend.hidden = !p.equilibria.length;
    this.layout();
    if (!initial) this.host.announce(`${p.aria}. ${this.summary()}`);
  }

  setStart(x, y) {
    if (near(x, this.x0) && near(y, this.y0)) return;
    this.x0 = x;
    this.y0 = y;
    this.draw();
  }

  summary() {
    const sol = this.preset.solve(this.x0, this.y0);
    const start = `Start (${fmtShort(this.x0)}, ${fmtShort(this.y0)}).`;
    if (sol.kind === 'equilibrium') return `${start} This is the constant solution y = ${sol.value}.`;
    if (sol.kind === 'invalid') return `${start} No solution passes through this point.`;
    return `${start} Solution ${plainText('$' + sol.solTex.split('\\Rightarrow').pop() + '$')}.`;
  }

  layout() {
    const ui = this.ui;
    const width = ui.svg.parentElement.clientWidth;
    if (!width) return;
    const height = Math.round(clamp(width * 0.86, 300, 560));
    const narrow = width < 460;
    const m = { l: narrow ? 30 : 36, r: 12, t: 12, b: 32 };
    setAttrs(ui.svg, { width, height, viewBox: `0 0 ${width} ${height}` });
    const p = this.preset;
    this.frame = new Frame().set(m.l, m.t, width - m.l - m.r, height - m.t - m.b, p.win.x, p.win.y);
    const fr = this.frame;
    ui.static.textContent = '';
    drawAxes(ui.static, fr, { xTarget: narrow ? 6 : 7, yTarget: narrow ? 6 : 7 });
    setAttrs(ui.clip, { x: fr.L, y: fr.T, width: fr.W, height: fr.H, viewBox: `${fr.L} ${fr.T} ${fr.W} ${fr.H}` });
    const spacing = narrow ? 24 : 27;
    ui.field.setAttribute('d', slopeFieldPath(fr, p.F, spacing, spacing * 0.54));
    ui.field.setAttribute('opacity', 0.8);
    let d = '';
    p.family((f, pole) => {
      const pts = sampleFunction(f, fr.xa, fr.xb, 500);
      if (pole != null) for (const pt of pts) if (Math.abs(pt[0] - pole) < (fr.xb - fr.xa) / 400) pt.gap = true;
      d += pathData(pts, fr, (fr.yb - fr.ya) * 1.5);
    });
    ui.family.setAttribute('d', d);
    ui.equilibria.textContent = '';
    for (const v of p.equilibria) svgEl('line', { class: 'equilibrium', x1: fr.L, x2: fr.R, y1: fr.Y(v), y2: fr.Y(v) }, ui.equilibria);
    this.draw();
  }

  /** Path for a solution restricted to its interval of validity. */
  curvePath(sol, which = 'main') {
    const fr = this.frame;
    if (!sol || sol.kind === 'invalid') return '';
    if (sol.kind === 'equilibrium') return `M${fr.L},${fr.Y(sol.value).toFixed(1)}H${fr.R}`;
    const part = which === 'main' ? sol : sol.other;
    if (!part) return '';
    const pad = (fr.xb - fr.xa) * 1e-4;
    const a = Math.max(fr.xa, part.domain[0] + pad);
    const b = Math.min(fr.xb, part.domain[1] - pad);
    if (b <= a) return '';
    const pts = sampleFunction(part.y, a, b, 600);
    if (sol.endpoint) {
      // include the exact endpoint where the curve meets y = 0
      const edge = part.domain[0] > -Infinity ? part.domain[0] : part.domain[1];
      if (edge >= fr.xa && edge <= fr.xb) {
        if (part.domain[0] > -Infinity) pts.unshift([edge, 0]);
        else pts.push([edge, 0]);
      }
    }
    return pathData(pts, fr, (fr.yb - fr.ya) * 3);
  }

  draw() {
    const fr = this.frame;
    if (!fr) return;
    const ui = this.ui;
    const p = this.preset;
    const sol = p.solve(this.x0, this.y0);
    const items = ui.items;
    const X = decTex(this.x0, 3);
    const Y = decTex(this.y0, 3);

    ui.solution.setAttribute('d', this.curvePath(sol));
    ui.branch.setAttribute('d', sol.other ? this.curvePath(sol, 'other') : '');
    [...ui.equilibria.children].forEach((line, i) => {
      const active = sol.kind === 'equilibrium' && near(sol.value, p.equilibria[i]);
      line.style.strokeWidth = active ? '3' : '';
      line.style.strokeDasharray = active ? 'none' : '';
    });

    // asymptote and interval of validity
    if (sol.asymptote != null && sol.asymptote > fr.xa && sol.asymptote < fr.xb) {
      const ax = fr.X(sol.asymptote);
      setAttrs(ui.asymptote, { x1: ax, x2: ax, y1: fr.T, y2: fr.B, opacity: 1 });
    } else ui.asymptote.setAttribute('opacity', 0);
    ui.labels.textContent = '';
    const label = (x, y, text, cls, anchor = 'start') => {
      const t = svgEl('text', { class: `lbl ${cls}`, x, y, 'text-anchor': anchor }, ui.labels);
      t.textContent = text;
      return t;
    };
    for (const v of p.equilibria) {
      const y = fr.Y(v);
      if (y > fr.T + 10 && y < fr.B - 4) label(fr.L + 6, y - 6, `y = ${fmtShort(v)}`, 'plum bold', 'start');
    }
    if (sol.kind === 'curve') {
      const a = Math.max(fr.xa, sol.domain[0]);
      const b = Math.min(fr.xb, sol.domain[1]);
      const restricted = sol.domain[0] > fr.xa || sol.domain[1] < fr.xb;
      setAttrs(ui.band, { x: fr.X(a), y: fr.T, width: Math.max(0, fr.X(b) - fr.X(a)), height: fr.H, opacity: restricted ? 1 : 0 });
      if (sol.asymptote != null && sol.asymptote > fr.xa && sol.asymptote < fr.xb) {
        const ax = fr.X(sol.asymptote);
        const right = ax < fr.R - 70;
        label(right ? ax + 5 : ax - 5, fr.B - 8, `x = ${fmtShort(sol.asymptote, 2)}`, 'muted', right ? 'start' : 'end');
      }
      if (sol.endpoint) {
        const edge = sol.domain[0] > -Infinity ? sol.domain[0] : sol.domain[1];
        setAttrs(ui.endDot, { cx: fr.X(edge), cy: fr.Y(0), opacity: edge > fr.xa && edge < fr.xb ? 1 : 0 });
      } else ui.endDot.setAttribute('opacity', 0);
      if (restricted) {
        const text = sol.domain[0] > fr.xa ? `solution lives on x > ${fmtShort(sol.domain[0], 2)}` : `solution lives on x < ${fmtShort(sol.domain[1], 2)}`;
        const mid = clamp((fr.X(a) + fr.X(b)) / 2, fr.L + 95, fr.R - 95);
        label(mid, fr.T + 16, text, 'sage bold', 'middle');
      }
    } else {
      ui.band.setAttribute('opacity', 0);
      ui.endDot.setAttribute('opacity', 0);
    }

    // slope mark at the start: the curve is tangent to the field there
    const sx = fr.X(this.x0);
    const sy = fr.Y(this.y0);
    const m = p.F(this.x0, this.y0);
    if (sol.kind !== 'invalid') setAttrs(ui.tangent, { ...slopeSegment(fr, sx, sy, m, 40), opacity: 0.9 });
    else ui.tangent.setAttribute('opacity', 0);
    ui.handle.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`);
    ui.handle.setAttribute('aria-valuetext', `(${fmtShort(this.x0)}, ${fmtShort(this.y0)})`);
    // put the coordinates where the curve is not: below-right when it rises, above-right when it falls
    const below = (Number.isFinite(m) ? m >= 0 : true) ? sy < fr.B - 30 : sy < fr.T + 30;
    const leftSide = sx > fr.R - 90;
    setAttrs(ui.handleLabel, { x: leftSide ? sx - 13 : sx + 13, y: below ? sy + 22 : sy - 13, 'text-anchor': leftSide ? 'end' : 'start' });
    ui.handleLabel.textContent = `(${fmtShort(this.x0)}, ${fmtShort(this.y0)})`;

    // derivation
    const live = key => items[key].li.classList.add('live');
    for (const it of Object.values(items)) it.li.classList.remove('live', 'muted');
    items.ic.t.textContent = `Use the start (${fmtShort(this.x0)}, ${fmtShort(this.y0)})`;
    ui.callout.hidden = true;
    ui.callout.className = 'callout';
    if (sol.kind === 'curve') {
      texTo(items.ic.m, sol.icTex);
      items.ic.w.textContent = '';
      texTo(items.sol.m, sol.solTex);
      richTo(items.sol.w, sol.words);
      texTo(items.check.m, `${p.checkTex}\\;\\checkmark`);
      live('ic');
      live('sol');
      if (sol.callout) {
        ui.callout.hidden = false;
        ui.callout.classList.add('warn');
        richTo(ui.callout, sol.callout);
      }
      richTo(ui.caption, `Drag the point, or click anywhere: each starting point picks out <b>one</b> curve from the family. Moving it changes $C$.`);
    } else if (sol.kind === 'equilibrium') {
      live('const');
      for (const key of ['sep', 'int', 'ic', 'sol', 'check']) items[key].li.classList.add('muted');
      texTo(items.ic.m, `y(${X}) = ${Y}`);
      items.ic.w.textContent = '';
      texTo(items.sol.m, `y = ${decTex(sol.value, 3)}`);
      items.sol.w.textContent = '';
      ui.callout.hidden = false;
      ui.callout.classList.add('ok');
      richTo(ui.callout, `Your start is on the constant solution $y = ${decTex(sol.value, 3)}$. Separating would divide by zero here, so step 1 is the whole answer: $y = ${decTex(sol.value, 3)}$ for every $x$.`);
      richTo(ui.caption, `This start sits on the constant solution $y = ${decTex(sol.value, 3)}$. The slope field is flat all along it.`);
    } else {
      for (const key of ['sep', 'int', 'ic', 'sol', 'check']) items[key].li.classList.add('muted');
      texTo(items.ic.m, `y(${X}) = ${Y}`);
      items.ic.w.textContent = '';
      texTo(items.sol.m, '\\text{no solution}');
      items.sol.w.textContent = '';
      ui.callout.hidden = false;
      ui.callout.classList.add('warn');
      richTo(ui.callout, sol.message);
      richTo(ui.caption, sol.message);
    }
    ui.svg.setAttribute('aria-label', `Slope field and solution family for ${p.aria}. ${this.summary()}`);
  }

  pause() {}
}

/* ---------- matching areas view ---------- */
const AREA_PRESETS = [
  {
    id: '2xy',
    chip: "y' = 2xy",
    aria: 'y prime equals 2 x y',
    F: (x, y) => 2 * x * y,
    x0: 0, y0: 1, xMax: 1.25,
    f: t => 2 * t, h: u => 1 / u,
    fLabel: '2t', hLabel: '1/u',
    A: x => x * x, B: y => Math.log(y), sol: x => Math.exp(x * x), inv: y => Math.sqrt(Math.max(0, Math.log(y))),
    win: { x: [-0.06, 1.34], y: [0, 5], f: [0, 2.8], h: [0, 1.2] },
    chain: ['\\htmlClass{ys}{\\frac{dy}{y}} = \\htmlClass{xs}{2x\\,dx}', '\\htmlClass{ys}{\\int_{1}^{y}\\frac{du}{u}} = \\htmlClass{xs}{\\int_{0}^{x}2t\\,dt}', '\\htmlClass{ys}{\\ln y} = \\htmlClass{xs}{x^2}', '\\htmlClass{sol}{y = e^{x^2}}'],
    live: (x, y, a) => `At $x = ${decTex(x, 2)}$ the blue area is $x^2 = ${decTex(a, 3)}$. The orange area must match: $\\ln y = ${decTex(a, 3)}$, so $y = e^{${decTex(a, 3)}} \\approx ${decTex(y, 3)}$.`,
    note: 'Why does $e^{x^2}$ shoot up? The blue area grows like $x^2$, while $1/u$ gets thinner as $u$ grows. To collect the same orange area, $y$ has to climb farther and farther.',
  },
  {
    id: 'x/y',
    chip: "y' = \\frac{x}{y}",
    aria: 'y prime equals x over y',
    F: (x, y) => x / y,
    x0: 0, y0: 2, xMax: 2.5,
    f: t => t, h: u => u,
    fLabel: 't', hLabel: 'u',
    A: x => (x * x) / 2, B: y => (y * y - 4) / 2, sol: x => Math.sqrt(x * x + 4), inv: y => Math.sqrt(Math.max(0, y * y - 4)),
    win: { x: [-0.1, 2.65], y: [0, 3.6], f: [0, 2.8], h: [0, 3.7] },
    chain: ['\\htmlClass{ys}{y\\,dy} = \\htmlClass{xs}{x\\,dx}', '\\htmlClass{ys}{\\int_{2}^{y}u\\,du} = \\htmlClass{xs}{\\int_{0}^{x}t\\,dt}', '\\htmlClass{ys}{\\frac{y^2 - 4}{2}} = \\htmlClass{xs}{\\frac{x^2}{2}}', '\\htmlClass{sol}{y = \\sqrt{x^2 + 4}}'],
    live: (x, y, a) => `At $x = ${decTex(x, 2)}$ the blue area is $\\tfrac{x^2}{2} = ${decTex(a, 3)}$. Match it: $\\tfrac{y^2 - 4}{2} = ${decTex(a, 3)}$, so $y \\approx ${decTex(y, 3)}$.`,
    note: 'Both integrands are straight lines, so both shaded regions are trapezoids. The start $y(0) = 2$ sets the lower limits: $0$ on the $x$ side and $2$ on the $y$ side. Try dragging in the orange panel instead.',
  },
  {
    id: '-y2',
    chip: "y' = -y^2",
    aria: 'y prime equals negative y squared',
    F: (x, y) => -y * y,
    x0: 0, y0: 1, xMax: 3,
    f: () => -1, h: u => 1 / (u * u),
    fLabel: '−1', hLabel: '1/u²',
    A: x => -x, B: y => 1 - 1 / y, sol: x => 1 / (1 + x), inv: y => 1 / y - 1,
    win: { x: [-0.1, 3.2], y: [0, 1.3], f: [-1.4, 0.45], h: [0, 9.5] },
    chain: ['\\htmlClass{ys}{\\frac{dy}{y^2}} = \\htmlClass{xs}{-\\,dx}', '\\htmlClass{ys}{\\int_{1}^{y}\\frac{du}{u^2}} = \\htmlClass{xs}{\\int_{0}^{x}(-1)\\,dt}', '\\htmlClass{ys}{1 - \\frac{1}{y}} = \\htmlClass{xs}{-x}', '\\htmlClass{sol}{y = \\frac{1}{1 + x}}'],
    live: (x, y, a) => `At $x = ${decTex(x, 2)}$ the blue area is $-x = ${decTex(a, 3)}$: negative, since $-1$ lies below the axis. The orange integral runs <em>down</em> from $1$ to $y$, so it is negative too: $y \\approx ${decTex(y, 3)}$.`,
    note: 'Both areas are negative here, so $y$ moves down. Near $u = 0$ the curve $1/u^2$ grows so fast that the area under it is infinite: $y$ can get close to $0$ but never reach it.',
  },
  {
    id: 'y2',
    chip: "y' = y^2",
    aria: 'y prime equals y squared',
    F: (x, y) => y * y,
    x0: 0, y0: 1, xMax: 0.975,
    f: () => 1, h: u => 1 / (u * u),
    fLabel: '1', hLabel: '1/u²',
    A: x => x, B: y => 1 - 1 / y, sol: x => 1 / (1 - x), inv: y => 1 - 1 / y,
    win: { x: [-0.04, 1.1], y: [0, 8.5], f: [0, 1.4], h: [0, 1.25] },
    rest: true,
    chain: ['\\htmlClass{ys}{\\frac{dy}{y^2}} = \\htmlClass{xs}{dx}', '\\htmlClass{ys}{\\int_{1}^{y}\\frac{du}{u^2}} = \\htmlClass{xs}{\\int_{0}^{x}1\\,dt}', '\\htmlClass{ys}{1 - \\frac{1}{y}} = \\htmlClass{xs}{x}', '\\htmlClass{sol}{y = \\frac{1}{1 - x}}'],
    live: (x, y, a) => `At $x = ${decTex(x, 3)}$ the blue area is $x = ${decTex(a, 3)}$, so $y = \\frac{1}{1 - x} \\approx ${decTex(y, 2)}$. Orange area still available above $y$: $\\int_y^\\infty \\frac{du}{u^2} = \\frac{1}{y} \\approx ${decTex(1 / y, 3)}$.`,
    note: 'The total area under $1/u^2$ from $1$ to $\\infty$ is only $1$: a convergent improper integral. The blue area reaches $1$ when $x = 1$, so $y$ must be infinite there. The solution <b>blows up</b> at $x = 1$.',
  },
];

class AreasView {
  constructor(host) {
    this.host = host;
    this.ui = {};
    this.playing = false;
  }

  build() {
    const host = this.host;
    const ui = this.ui;
    ui.chips = host.makeChips(AREA_PRESETS.map(p => ({ tex: p.chip, aria: p.aria })), i => this.pick(i), 'Separable equation');
    ui.svg = svgEl('svg', { class: 'plot corner', role: 'img' });
    ui.svg.setAttribute('tabindex', '-1');
    ui.svg.style.touchAction = 'pan-y pinch-zoom';
    ui.static = svgEl('g', null, ui.svg);
    ui.dyn = svgEl('g', null, ui.svg);
    ui.play = iconButton('play', 'Play', { class: 'btn primary' });
    ui.reset = iconButton('reset', '', { class: 'btn icon', 'aria-label': 'Back to the start' });
    ui.play.addEventListener('click', () => (this.playing ? this.stop() : this.play()));
    ui.reset.addEventListener('click', () => { this.stop(); this.setX(this.preset.x0); });
    ui.slider = h('input', { type: 'range', min: 0, max: 1000, step: 1, value: 0, 'aria-label': 'Move x' });
    ui.slider.addEventListener('input', () => {
      this.stop();
      const p = this.preset;
      this.setX(p.x0 + (p.xMax - p.x0) * (ui.slider.value / 1000));
    });
    ui.xValue = h('span', { class: 'value' });
    const controls = h('div', { class: 'controls' }, ui.reset, ui.play,
      h('label', { class: 'slider-row' }, h('span', { tex: 'x' }), ui.slider, ui.xValue));
    ui.chain = h('div', { class: 'chain' });
    ui.live = h('div', { class: 'live' });
    ui.note = h('div', { class: 'callout note' });
    const readout = h('div', { class: 'readout' }, ui.chain, ui.live, ui.note);
    host.root.append(h('div', { class: 'ode areas' }, h('div', { class: 'bar' }, ui.chips),
      h('div', { class: 'figure', style: 'margin-top:14px' }, ui.svg), controls, readout));
    this.wire();
    this.pick(Math.max(0, AREA_PRESETS.findIndex(p => p.id === host.getAttribute('preset'))), true);
  }

  get preset() { return AREA_PRESETS[this.index]; }

  pick(i, initial = false) {
    this.stop();
    this.index = i;
    this.ui.chips.select(i);
    const p = this.preset;
    this.x = p.x0 + (p.xMax - p.x0) * 0.62;
    texTo(this.ui.chain, p.chain.join('\\quad\\Longrightarrow\\quad'));
    richTo(this.ui.note, p.note);
    this.layout();
    if (!initial) this.host.announce(`${p.aria}.`);
  }

  wire() {
    const ui = this.ui;
    let region = null;
    const fromPoint = pt => {
      const g = this.geo;
      if (!g) return;
      if (region === 'y') {
        const p = this.preset;
        const yv = clamp(g.sol.y(pt.y), Math.min(p.y0, p.sol(p.xMax)), Math.max(p.y0, p.sol(p.xMax)));
        this.setX(p.inv(yv));
      } else this.setX(g.sol.x(pt.x));
    };
    ui.svg.addEventListener('pointerdown', e => {
      const g = this.geo;
      if (!g || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const pt = localPoint(ui.svg, e);
      if (g.sol.inside(pt.x, pt.y, 4) || g.xs.inside(pt.x, pt.y, 4)) region = 'x';
      else if (g.ys.inside(pt.x, pt.y, 4)) region = 'y';
      else return;
      e.preventDefault();
      this.stop();
      try { ui.svg.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      fromPoint(pt);
    });
    ui.svg.addEventListener('pointermove', e => {
      if (!region) {
        const g = this.geo;
        if (!g) return;
        const pt = localPoint(ui.svg, e);
        ui.svg.style.cursor = g.ys.inside(pt.x, pt.y, 4) ? 'ns-resize' : (g.sol.inside(pt.x, pt.y, 4) || g.xs.inside(pt.x, pt.y, 4)) ? 'ew-resize' : '';
        return;
      }
      fromPoint(localPoint(ui.svg, e));
    });
    const end = () => {
      if (!region) return;
      region = null;
      this.host.announce(this.summary());
    };
    ui.svg.addEventListener('pointerup', end);
    ui.svg.addEventListener('pointercancel', end);
  }

  summary() {
    const p = this.preset;
    const y = p.sol(this.x);
    return `x = ${fmt(this.x, 3)}, y = ${fmt(y, 3)}. Both areas equal ${fmt(p.A(this.x), 3)}.`;
  }

  setX(x) {
    const p = this.preset;
    this.x = clamp(x, p.x0, p.xMax);
    this.draw();
  }

  layout() {
    const ui = this.ui;
    const W = ui.svg.parentElement.clientWidth;
    if (!W) return;
    const p = this.preset;
    const narrow = W < 520;
    const mL = narrow ? 30 : 36;
    const mR = 12;
    const mT = 22;
    const gapC = narrow ? 30 : 38;
    const gapR = 30;
    const mB = 34;
    const wY = Math.round(clamp(W * 0.27, 100, 230));
    const wS = W - mL - wY - gapC - mR;
    const hS = Math.round(clamp(W * 0.42, 200, 360));
    const hX = Math.round(clamp(W * 0.19, 105, 160));
    const H = mT + hS + gapR + hX + mB;
    setAttrs(ui.svg, { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    const solX = mL + wY + gapC;
    const g = {
      sol: new Frame().set(solX, mT, wS, hS, p.win.x, p.win.y),
      xs: new Frame().set(solX, mT + hS + gapR, wS, hX, p.win.x, p.win.f),
      ys: new Frame().set(mL, mT, wY, hS, p.win.h, p.win.y),
      corner: { x: mL, y: mT + hS + gapR, w: wY, h: hX },
      narrow,
    };
    this.geo = g;
    const st = ui.static;
    st.textContent = '';

    // solution panel: faint slope field, no tick labels (they live on the side panels)
    drawAxes(st, g.sol, { labels: false, xTarget: 6, yTarget: 6 });
    const field = svgEl('path', { class: 'field', d: slopeFieldPath(g.sol, p.F, narrow ? 24 : 27, narrow ? 13 : 15) }, clipBox(st, g.sol));
    field.setAttribute('opacity', 0.9);
    const solPts = sampleFunction(p.sol, Math.max(p.win.x[0], -0.999), Math.min(p.win.x[1], p.id === 'y2' ? 0.9995 : p.win.x[1]), 500);
    svgEl('path', { class: 'curve exact', d: pathData(solPts, g.sol, 50), opacity: 1 }, clipBox(st, g.sol));

    // x-side panel
    drawAxes(st, g.xs, { xLabel: 't', yLabel: '', xTarget: narrow ? 4 : 6, yTarget: 3 });
    svgEl('path', { class: 'curve fx', d: pathData(sampleFunction(p.f, g.xs.xa, g.xs.xb, 300), g.xs, 10) }, clipBox(st, g.xs));
    // y-side panel (turned sideways: u runs up, 1/g(u) runs right)
    drawAxes(st, g.ys, { xLabel: '', yLabel: 'u', xTarget: 3, yTarget: 6 });
    const uPts = [];
    for (let i = 0; i <= 500; i++) {
      const u = g.ys.ya + ((g.ys.yb - g.ys.ya) * i) / 500;
      const v = p.h(u);
      if (Number.isFinite(v)) uPts.push([u, v]);
    }
    const hd = uPts.filter(([, v]) => v <= g.ys.xb * 3).map(([u, v], i) => `${i ? 'L' : 'M'}${g.ys.X(v).toFixed(1)},${g.ys.Y(u).toFixed(1)}`).join('');
    svgEl('path', { class: 'curve gy', d: hd }, clipBox(st, g.ys));

    // titles carry the integrands: x-side is f(t), y-side is 1/g(u)
    const title = (x, y, kicker, math, color) => {
      const t = svgEl('text', { class: 'panel-title', x, y }, st);
      t.style.fill = color;
      t.append(kicker);
      if (math) {
        const m = svgEl('tspan', { class: 'title-math', dx: 7 }, t);
        mathText(m, math);
      }
      return t;
    };
    title(g.ys.L + 1, mT - 8, 'y-side', `1/g(u) = ${p.hLabel}`, 'var(--_rust)');
    if (!narrow) title(g.sol.L + 1, mT - 8, 'solution', '', 'var(--_sage)');
    title(g.xs.L + 1, g.xs.T - 8, 'x-side', `f(t) = ${p.fLabel}`, 'var(--_blue)');
    const xl = svgEl('text', { class: 'var', x: g.sol.R - 4, y: g.sol.B + 15, 'text-anchor': 'end' }, st);
    mathText(xl, 'x');
    const yl = svgEl('text', { class: 'var', x: g.sol.L - 6, y: g.sol.T + 12, 'text-anchor': 'end' }, st);
    mathText(yl, 'y');

    // dynamic layer elements
    const dyn = ui.dyn;
    dyn.textContent = '';
    const hit = (fr, action) => {
      const r = svgEl('rect', { x: fr.L, y: fr.T, width: fr.W, height: fr.H, fill: 'transparent' }, dyn);
      r.style.touchAction = action;
      return r;
    };
    hit(g.ys, 'none');
    hit(g.sol, 'pan-y pinch-zoom');
    hit(g.xs, 'pan-y pinch-zoom');
    const clipX = clipBox(dyn, g.xs);
    const clipY = clipBox(dyn, g.ys);
    const clipS = clipBox(dyn, g.sol);
    ui.areaX = svgEl('path', { class: 'area-x' }, clipX);
    ui.areaY = svgEl('path', { class: 'area-y' }, clipY);
    ui.rest = svgEl('path', { class: 'area-rest' }, clipY);
    ui.guideV = svgEl('line', { class: 'guide x' }, dyn);
    ui.guideH = svgEl('line', { class: 'guide y' }, dyn);
    ui.limX = svgEl('line', { class: 'curve fx', 'stroke-width': 1.6 }, clipX);
    ui.limY = svgEl('line', { class: 'curve gy', 'stroke-width': 1.6 }, clipY);
    ui.start = svgEl('circle', { r: 4, fill: 'var(--_sheet)', stroke: 'var(--_sage)', 'stroke-width': 2 }, clipS);
    ui.point = svgEl('circle', { r: 6, fill: 'var(--_sage)', stroke: 'var(--_sheet)', 'stroke-width': 2 }, dyn);
    ui.offChart = svgEl('text', { class: 'lbl sage bold', 'text-anchor': 'middle', opacity: 0 }, dyn);
    ui.labelX = svgEl('text', { class: 'lbl blue bold', 'text-anchor': 'middle' }, dyn);
    ui.labelY = svgEl('text', { class: 'lbl rust bold', 'text-anchor': 'middle' }, dyn);
    ui.restLabel = svgEl('text', { class: 'lbl rust', 'text-anchor': 'middle', opacity: 0 }, dyn);
    ui.pointLabel = svgEl('text', { class: 'lbl sage bold' }, dyn);
    // the balance in the corner
    const c = g.corner;
    const cx = c.x + c.w / 2;
    ui.balance = svgEl('g', null, dyn);
    svgEl('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 6, fill: 'var(--_card)', stroke: 'var(--_line)' }, ui.balance);
    const t1 = svgEl('text', { class: 'panel-title', x: cx, y: c.y + 18, 'text-anchor': 'middle' }, ui.balance);
    t1.textContent = 'areas match';
    ui.balY = svgEl('text', { class: 'big', x: cx, y: c.y + c.h * 0.47, 'text-anchor': 'middle', fill: 'var(--_rust)' }, ui.balance);
    const eq = svgEl('text', { class: 'big', x: cx, y: c.y + c.h * 0.66, 'text-anchor': 'middle', fill: 'var(--_muted)' }, ui.balance);
    eq.textContent = '=';
    ui.balX = svgEl('text', { class: 'big', x: cx, y: c.y + c.h * 0.88, 'text-anchor': 'middle', fill: 'var(--_blue)' }, ui.balance);
    this.draw();
  }

  draw() {
    const g = this.geo;
    if (!g) return;
    const ui = this.ui;
    const p = this.preset;
    const x = this.x;
    const y = p.sol(x);
    const a = p.A(x);
    const neg = a < -1e-12;

    // x-side region between t = x0 and t = x
    const n = 120;
    let dx = `M${g.xs.X(p.x0).toFixed(1)},${g.xs.Y(0).toFixed(1)}`;
    for (let i = 0; i <= n; i++) {
      const t = p.x0 + ((x - p.x0) * i) / n;
      dx += `L${g.xs.X(t).toFixed(1)},${g.xs.Y(p.f(t)).toFixed(1)}`;
    }
    dx += `L${g.xs.X(x).toFixed(1)},${g.xs.Y(0).toFixed(1)}Z`;
    ui.areaX.setAttribute('d', dx);
    ui.areaX.setAttribute('class', `area-x${neg ? ' neg' : ''}`);
    setAttrs(ui.limX, { x1: g.xs.X(x), x2: g.xs.X(x), y1: g.xs.Y(0), y2: g.xs.Y(p.f(x)) });

    // y-side region between u = y0 and u = y (clipped at the top of the panel)
    const yTop = Math.min(y, g.ys.yb + (g.ys.yb - g.ys.ya));
    let dy = `M${g.ys.X(0).toFixed(1)},${g.ys.Y(p.y0).toFixed(1)}`;
    for (let i = 0; i <= n; i++) {
      const u = p.y0 + ((yTop - p.y0) * i) / n;
      dy += `L${g.ys.X(Math.min(p.h(u), g.ys.xb * 4)).toFixed(1)},${g.ys.Y(u).toFixed(1)}`;
    }
    dy += `L${g.ys.X(0).toFixed(1)},${g.ys.Y(yTop).toFixed(1)}Z`;
    ui.areaY.setAttribute('d', dy);
    ui.areaY.setAttribute('class', `area-y${neg ? ' neg' : ''}`);
    setAttrs(ui.limY, { x1: g.ys.X(0), x2: g.ys.X(Math.min(p.h(y), g.ys.xb * 4)), y1: g.ys.Y(y), y2: g.ys.Y(y) });

    // remaining area to infinity (blow-up story)
    if (p.rest) {
      let dr = `M${g.ys.X(0).toFixed(1)},${g.ys.Y(yTop).toFixed(1)}`;
      for (let i = 0; i <= 60; i++) {
        const u = yTop + ((g.ys.yb + 1 - yTop) * i) / 60;
        dr += `L${g.ys.X(p.h(u)).toFixed(1)},${g.ys.Y(u).toFixed(1)}`;
      }
      dr += `L${g.ys.X(0).toFixed(1)},${g.ys.Y(g.ys.yb + 1).toFixed(1)}Z`;
      ui.rest.setAttribute('d', dr);
      const ry = g.ys.Y(Math.min(g.ys.yb, yTop)) - 8;
      ui.restLabel.textContent = `left to ∞: ${fmt(1 / y, 3)}`;
      setAttrs(ui.restLabel, { x: g.ys.L + g.ys.W / 2 + 6, y: Math.max(g.ys.T + 14, ry), opacity: y < g.ys.yb - 0.4 ? 1 : 0 });
    } else {
      ui.rest.setAttribute('d', '');
      ui.restLabel.setAttribute('opacity', 0);
    }

    // point on the solution curve and the guides that tie the panels together
    const onChart = y <= g.sol.yb && y >= g.sol.ya;
    const px = g.sol.X(x);
    const py = clamp(g.sol.Y(y), g.sol.T, g.sol.B);
    setAttrs(ui.point, { cx: px, cy: py, opacity: onChart ? 1 : 0.35 });
    setAttrs(ui.start, { cx: g.sol.X(p.x0), cy: g.sol.Y(p.y0) });
    setAttrs(ui.guideV, { x1: px, x2: px, y1: py, y2: g.xs.B });
    setAttrs(ui.guideH, { x1: px, x2: g.ys.L, y1: py, y2: py });
    ui.offChart.textContent = `y ≈ ${fmt(y, 1)} ↑`;
    setAttrs(ui.offChart, { x: px, y: g.sol.T + 14, opacity: onChart ? 0 : 1 });
    ui.pointLabel.textContent = onChart ? `(${fmt(x, 2)}, ${fmt(y, 2)})` : '';
    // keep the label off the curve: a rising curve leaves below-right and above-left empty
    const rising = p.F(x, y) >= 0;
    const leftSide = px > g.sol.R - 110;
    const below = rising !== leftSide;
    setAttrs(ui.pointLabel, { x: leftSide ? px - 12 : px + 12, y: below ? py + 18 : py - 12, 'text-anchor': leftSide ? 'end' : 'start' });

    // area labels
    const signed = v => (Math.abs(v) < 5e-4 ? '0' : (v < 0 ? MINUS : '') + fmt(Math.abs(v), 3));
    const xMid = g.xs.X((p.x0 + x) / 2);
    const fMid = p.f((p.x0 + x) / 2) / 2;
    const xW = Math.abs(g.xs.X(x) - g.xs.X(p.x0));
    ui.labelX.textContent = signed(a);
    setAttrs(ui.labelX, xW > 46 ? { x: xMid, y: g.xs.Y(fMid) + 4, opacity: 1 } : { x: g.xs.X(x) + 26, y: g.xs.Y(fMid) + 4, opacity: 1 });
    const uMid = (p.y0 + Math.min(y, g.ys.yb)) / 2;
    const hMid = Math.min(p.h(uMid), g.ys.xb) / 2;
    const yH = Math.abs(g.ys.Y(Math.min(y, g.ys.yb)) - g.ys.Y(p.y0));
    ui.labelY.textContent = signed(p.B(y));
    setAttrs(ui.labelY, yH > 22 ? { x: clamp(g.ys.X(hMid), g.ys.L + 22, g.ys.R - 22), y: g.ys.Y(uMid) + 4 } : { x: clamp(g.ys.X(hMid), g.ys.L + 22, g.ys.R - 22), y: g.ys.Y(Math.min(y, g.ys.yb)) + (neg ? 16 : -8) });
    ui.balY.textContent = `${signed(p.B(y))}`;
    ui.balX.textContent = `${signed(a)}`;

    // controls + text
    ui.slider.value = String(Math.round((1000 * (x - p.x0)) / (p.xMax - p.x0)));
    ui.xValue.textContent = `= ${fmt(x, 2)}`;
    richTo(ui.live, p.live(x, y, a));
    ui.svg.setAttribute('aria-label', `Matching areas for ${p.aria}. ${this.summary()}`);
    ui.play.innerHTML = (this.playing ? ICONS.pause : ICONS.play) + `<span>${this.playing ? 'Pause' : 'Play'}</span>`;
  }

  play() {
    const p = this.preset;
    if (this.x >= p.xMax - 1e-6) this.x = p.x0;
    if (reducedMotion()) {
      this.setX(this.x + (p.xMax - p.x0) / 8);
      return;
    }
    this.playing = true;
    let last = null;
    const dur = 7000;
    const tick = now => {
      if (!this.playing) return;
      if (last == null) last = now;
      const dt = Math.min(50, now - last);
      last = now;
      this.x = Math.min(p.xMax, this.x + ((p.xMax - p.x0) * dt) / dur);
      this.draw();
      if (this.x >= p.xMax) { this.stop(); this.host.announce(this.summary()); return; }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.draw();
  }

  stop() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    if (this.geo) this.draw();
  }

  pause() { this.stop(); }
}

class SeparableOde extends OdeElement {
  build() {
    const mode = (this.getAttribute('mode') || 'family').toLowerCase();
    this.view = mode === 'areas' ? new AreasView(this) : new FamilyView(this);
    this.view.build();
  }
  layout() { this.view?.layout(); }
  pause() { this.view?.pause(); }
}

customElements.define('euler-method', EulerMethod);
if (typeof SeparableOde !== 'undefined') customElements.define('separable-ode', SeparableOde);
})();
