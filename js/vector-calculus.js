/* Vector-calculus probes adapted from the supplied gauge demos. */
(() => {
  'use strict';

  const TAU = 2 * Math.PI;
  const COLORS = { out: '#E24B4A', in: '#378ADD', ccw: '#D85A30', neutral: '#888780' };
  const toX = x => 340 + x * 100;
  const toY = y => 200 - y * 100;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const formatted = value => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
  let instance = 0;

  const styles = `
    :host {
      display: block;
      min-width: 0;
      color: #26241f;
      font-family: inherit;
      font-size: 15px;
      line-height: 1.5;
      color-scheme: light;
      --surface: #faf9f5;
      --panel: #f1efe8;
      --ink: #26241f;
      --secondary: #5f5e5a;
      --muted: #888780;
      --accent: #378ADD;
    }
    *, *::before, *::after { box-sizing: border-box; }
    .demo { padding: 16px; background: var(--surface); border: 1px solid #dcd7cb; border-radius: 8px; }
    .title { font: inherit; font-size: 18px; font-weight: 700; margin: 0 0 8px; }
    .instructions { color: var(--secondary); font-size: 13px; margin: 0 0 12px; }
    .controls { display: flex; flex-wrap: wrap; gap: 7px; margin: 0 0 12px; }
    button {
      appearance: none; font: inherit; font-size: 13px; line-height: 1.35;
      padding: 7px 10px; border: 1px solid #bcb7ab; border-radius: 5px;
      color: var(--ink); background: #fffefa; cursor: pointer; min-height: 34px;
    }
    button:hover { background: var(--panel); }
    button[aria-pressed="true"] { background: #E6F1FB; color: #185FA5; border-color: var(--accent); }
    button:focus-visible, input:focus-visible, svg:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
    .board { display: block; width: 100%; height: auto; aspect-ratio: 17 / 10; touch-action: none; cursor: crosshair; border-radius: 4px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 8px; margin-top: 12px; }
    .metric { margin: 0; min-width: 0; padding: 10px 12px; background: var(--panel); border-radius: 5px; }
    .metric dt { color: var(--secondary); font-size: 12px; line-height: 1.35; }
    .metric dd { font-size: 23px; font-weight: 700; line-height: 1.35; margin: 4px 0 0; font-variant-numeric: tabular-nums; }
    .metric small { display: block; font-size: 11px; margin-top: 2px; }
    .message { font-size: 13px; color: var(--secondary); margin: 10px 0 0; }
    .radius { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0 0; }
    .radius label { font-size: 13px; color: var(--secondary); }
    .radius input { min-width: 90px; flex: 1; accent-color: var(--accent); margin: 0; }
    .radius output { min-width: 35px; font-size: 13px; font-variant-numeric: tabular-nums; }
    .transport { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0 0; }
    .transport span { font-size: 12px; color: var(--secondary); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 400px) {
      .demo { padding: 11px; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric { padding: 9px; }
      .metric:last-child { grid-column: 1 / -1; }
      button { padding: 7px 9px; }
    }
  `;

  const divergenceFields = {
    charge: { label: 'Smooth radial source', field: (x, y) => { const d = x * x + y * y + 0.16; return [x / d, y / d]; }, local: (x, y) => 0.32 / (x * x + y * y + 0.16) ** 2 },
    magnet: { label: 'Bar magnet', field: (x, y) => { const d = x * x + y * y + 0.25; return [x * y / (d * d), (d - 2 * x * x) / (2 * d * d)]; }, local: () => 0 },
    uniform: { label: 'Uniform field', field: () => [1, 0], local: () => 0 },
    expand: { label: 'Expanding field', field: (x, y) => [0.6 * x, 0.6 * y], local: () => 1.2 }
  };
  const curlFields = {
    rot: { label: 'Rotation', field: (x, y) => [-0.6 * y, 0.6 * x], local: () => 1.2 },
    shear: { label: 'Shear', field: (x, y) => [0.8 * y, 0], local: () => -0.8 },
    rad: { label: 'Radial', field: (x, y) => [0.6 * x, 0.6 * y], local: () => 0 },
    wire: { label: 'Smooth current field', field: (x, y) => { const d = x * x + y * y + 0.16; return [-y / d, x / d]; }, local: (x, y) => 0.32 / (x * x + y * y + 0.16) ** 2 }
  };

  class VectorProbe extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._id = `vector-probe-${++instance}`;
      this._radius = 0.45;
      this._x = 1.2;
      this._y = 0.6;
      this._suspended = false;
      this._intersecting = true;
      this._frame = null;
      this._lastTime = null;
      this._angle = 0;
      this._omega = 0;
      this._motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this._playing = !this._motionQuery.matches;
      this._onVisibility = () => this._syncAnimation();
      this._onDetails = () => this._syncAnimation();
      this._onMotion = event => {
        if (event.matches) this._playing = false;
        this._updateTransport();
        this._syncAnimation();
      };
      this._tick = time => {
        this._frame = null;
        if (!this._canAnimate()) { this._lastTime = null; return; }
        if (this._lastTime !== null) this._angle = (this._angle + this._omega * Math.min(0.05, (time - this._lastTime) / 1000)) % 360;
        this._lastTime = time;
        this._drawRotor();
        this._frame = requestAnimationFrame(this._tick);
      };
    }

    connectedCallback() {
      if (!this._initialized) this._initialize();
      document.addEventListener('visibilitychange', this._onVisibility);
      this._motionQuery.addEventListener('change', this._onMotion);
      this._details = [];
      for (let parent = this.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') {
          this._details.push(parent);
          parent.addEventListener('toggle', this._onDetails);
        }
      }
      if ('IntersectionObserver' in window) {
        this._observer = new IntersectionObserver(entries => {
          this._intersecting = entries[0].isIntersecting;
          this._syncAnimation();
        });
        this._observer.observe(this);
      }
      this._syncAnimation();
    }

    disconnectedCallback() {
      document.removeEventListener('visibilitychange', this._onVisibility);
      this._motionQuery.removeEventListener('change', this._onMotion);
      this._details?.forEach(details => details.removeEventListener('toggle', this._onDetails));
      this._observer?.disconnect();
      this._stopAnimation();
    }

    pause() { this._suspended = true; this._stopAnimation(); }
    resume() { this._suspended = false; this._syncAnimation(); }

    _initialize() {
      this._initialized = true;
      const isCurl = this._isCurl;
      this._fields = isCurl ? curlFields : divergenceFields;
      this._fieldKey = isCurl ? 'rot' : 'charge';
      this.dataset.field = this._fieldKey;
      // Keep the supplied demos' element IDs for editor integration and inspection.
      this._ids = {
        field: 'sv', probe: 'pr', 'field-arrows': 'fld',
        'field-origin': isCurl ? 'wr' : 'mag', boundary: isCurl ? 'arrs' : 'dots',
        integral: isCurl ? 'ci' : 'fl', average: isCurl ? 'av' : 'dv',
        local: isCurl ? 'pd' : 'local-div', radius: 'rs', 'radius-value': 'rv',
        rotor: 'sp', 'spoke-a': 's1', 'spoke-b': 's2'
      };
      if (isCurl) { this._x = 0.9; this._y = 0.5; }
      const metric = (id, label, detail) => `<dl class="metric"><dt>${label}${detail ? `<small>${detail}</small>` : ''}</dt><dd id="${id}">0.00</dd></dl>`;
      this.shadowRoot.innerHTML = `
        <style>${styles}</style>
        <section class="demo" aria-labelledby="title">
          <h4 id="title" class="title">${isCurl ? 'Curl demonstration' : 'Divergence demonstration'}</h4>
          <p class="instructions" id="instructions">Move the circle with mouse or arrow keys</p>
          <div class="controls" role="group" aria-label="Choose a vector field">
            ${Object.entries(this._fields).map(([key, entry]) => `<button type="button" data-field="${key}" data-f="${key}" aria-pressed="${key === this._fieldKey}">${entry.label}</button>`).join('')}
          </div>
          <svg class="board" id="field" viewBox="0 0 680 400" preserveAspectRatio="xMidYMid meet" role="img" tabindex="0" aria-label="${isCurl ? 'Vector field with a movable circulation loop and rotation indicator' : 'Vector field with a movable circular flux probe'}" aria-describedby="instructions">
            <defs><marker id="${this._id}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
            <g id="field-origin"></g><g id="field-arrows"></g>
            <circle id="probe" r="45" ${isCurl ? 'fill="none" stroke="#5f5e5a" stroke-width="1.5" stroke-dasharray="4 4"' : 'stroke-width="2" fill-opacity="0.14"'}/>
            ${isCurl ? '<g id="rotor" stroke="#26241f" stroke-width="2.5" stroke-linecap="round"><line id="spoke-a"/><line id="spoke-b"/></g><circle id="hub" r="4" fill="#26241f"/>' : ''}
            <g id="boundary"></g>
          </svg>
          ${isCurl ? '<div class="radius"><label for="radius">Loop radius</label><input id="radius" type="range" min="0.2" max="1.6" step="0.05" value="0.45"><output id="radius-value" for="radius">0.45</output></div><div class="transport"><button type="button" id="play">Pause animation</button><span>Illustrative rotation indicator</span></div>' : ''}
          <div class="metrics" aria-label="Probe measurements">
            ${metric('integral', isCurl ? 'Circulation around loop' : 'Net outward flux', isCurl ? 'Counterclockwise is positive' : 'Outward is positive')}
            ${metric('average', isCurl ? 'Average curl over disk' : 'Average divergence over disk', isCurl ? 'Circulation per area' : 'Flux per area')}
            ${metric('local', isCurl ? 'Curl at the center' : 'Divergence at the center', isCurl ? '∂Fᵧ/∂x − ∂Fₓ/∂y' : '∂Fₓ/∂x + ∂Fᵧ/∂y')}
          </div>
          <p id="message" class="message"></p>
          <span id="announcement" class="sr-only" role="status" aria-live="polite"></span>
        </section>`;
      Object.entries(this._ids).forEach(([id, original]) => {
        const element = this.shadowRoot.getElementById(id);
        if (element) element.id = original;
      });
      this.shadowRoot.querySelectorAll('[for]').forEach(element => {
        element.setAttribute('for', this._ids[element.getAttribute('for')] || element.getAttribute('for'));
      });
      this._svg = this._get('field');
      this.shadowRoot.querySelectorAll('[data-field]').forEach(button => {
        button.addEventListener('click', () => {
          this._fieldKey = button.dataset.field;
          this.dataset.field = this._fieldKey;
          this.shadowRoot.querySelectorAll('[data-field]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
          this._drawField();
          this._updateProbe();
        });
      });
      this._svg.addEventListener('pointerdown', event => {
        this._activePointer = event.pointerId;
        this._svg.focus({ preventScroll: true });
        try { this._svg.setPointerCapture(event.pointerId); } catch (_) { /* Pointer can end before capture. */ }
        this._movePointer(event);
      });
      this._svg.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse' || event.pointerId === this._activePointer) this._movePointer(event);
      });
      const release = () => { this._activePointer = null; };
      this._svg.addEventListener('pointerup', release);
      this._svg.addEventListener('pointercancel', release);
      this._svg.addEventListener('lostpointercapture', release);
      this._svg.addEventListener('keydown', event => {
        const vectors = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        if (!vectors[event.key]) return;
        event.preventDefault();
        const [dx, dy] = vectors[event.key], step = event.shiftKey ? 0.25 : 0.1;
        this._x += dx * step; this._y += dy * step;
        this._constrainProbe(); this._updateProbe();
        this._get('announcement').textContent = `Center ${formatted(this._x)}, ${formatted(this._y)}. Average ${isCurl ? 'curl' : 'divergence'} ${formatted(this._average)}; at the center ${formatted(this._local)}.`;
      });
      if (isCurl) {
        this._get('radius').addEventListener('input', event => {
          this._radius = Number(event.target.value);
          this._constrainProbe(); this._updateProbe();
        });
        this._get('play').addEventListener('click', () => {
          this._playing = !this._playing;
          this._updateTransport(); this._syncAnimation();
        });
        this._updateTransport();
      }
      this._drawField(); this._updateProbe();
    }

    _get(id) { return this.shadowRoot.getElementById(this._ids?.[id] || id); }

    _constrainProbe() {
      // Keep the whole measurement disk visible, including at the largest radius.
      this._x = clamp(this._x, -3.32 + this._radius, 3.32 - this._radius);
      this._y = clamp(this._y, -1.92 + this._radius, 1.92 - this._radius);
    }

    _movePointer(event) {
      const matrix = this._svg.getScreenCTM();
      if (!matrix) return;
      let point = this._svg.createSVGPoint();
      point.x = event.clientX; point.y = event.clientY;
      try { point = point.matrixTransform(matrix.inverse()); } catch (_) { return; }
      this._x = (point.x - 340) / 100; this._y = (200 - point.y) / 100;
      this._constrainProbe(); this._updateProbe();
    }

    _drawField() {
      const field = this._fields[this._fieldKey].field;
      const marker = `url(#${this._id}-arrow)`;
      let arrows = '';
      for (let i = -8; i <= 8; i++) for (let j = -4; j <= 4; j++) {
        const x = i * 0.4, y = j * 0.4, [fx, fy] = field(x, y), magnitude = Math.hypot(fx, fy);
        if (magnitude < 1e-6) continue;
        const length = 8 + 24 * Math.tanh(1.5 * magnitude), dx = fx / magnitude * length / 2, dy = -fy / magnitude * length / 2;
        arrows += `<line x1="${(toX(x) - dx).toFixed(1)}" y1="${(toY(y) - dy).toFixed(1)}" x2="${(toX(x) + dx).toFixed(1)}" y2="${(toY(y) + dy).toFixed(1)}" stroke="#5f5e5a" stroke-width="1.2" opacity="${this._isCurl ? '0.5' : '0.6'}" marker-end="${marker}"/>`;
      }
      this._get('field-arrows').innerHTML = arrows;
      this._get('field-origin').innerHTML = this._fieldKey === 'magnet'
        ? '<rect x="322" y="150" width="36" height="50" fill="#E24B4A" fill-opacity="0.35"/><rect x="322" y="200" width="36" height="50" fill="#378ADD" fill-opacity="0.35"/>'
        : this._fieldKey === 'wire'
          ? '<circle cx="340" cy="200" r="22" fill="none" stroke="#888780" stroke-width="1.5" stroke-dasharray="3 3"/><circle cx="340" cy="200" r="4" fill="#888780"/>' : '';
    }

    _updateProbe() {
      const isCurl = this._isCurl;
      const entry = this._fields[this._fieldKey];
      const count = isCurl ? 48 : 36, radius = this._radius;
      const marker = `url(#${this._id}-arrow)`;
      let integral = 0, boundary = '';
      for (let k = 0; k < count; k++) {
        const theta = TAU * k / count, cosine = Math.cos(theta), sine = Math.sin(theta);
        const x = this._x + radius * cosine, y = this._y + radius * sine, [fx, fy] = entry.field(x, y);
        const projection = isCurl ? -fx * sine + fy * cosine : fx * cosine + fy * sine;
        integral += projection * TAU * radius / count;
        if (k % (isCurl ? 4 : 3) !== 0) continue;
        if (isCurl && Math.abs(projection) > 0.02) {
          const sign = projection > 0 ? 1 : -1, length = Math.min(30, 8 + 30 * Math.abs(projection));
          const dx = -sign * sine * length / 2, dy = -sign * cosine * length / 2;
          boundary += `<line x1="${(toX(x) - dx).toFixed(1)}" y1="${(toY(y) - dy).toFixed(1)}" x2="${(toX(x) + dx).toFixed(1)}" y2="${(toY(y) + dy).toFixed(1)}" stroke="${sign > 0 ? COLORS.ccw : COLORS.in}" stroke-width="2.5" marker-end="${marker}"/>`;
        } else {
          const color = isCurl ? COLORS.neutral : projection > 0.02 ? COLORS.out : projection < -0.02 ? COLORS.in : COLORS.neutral;
          boundary += `<circle cx="${toX(x).toFixed(1)}" cy="${toY(y).toFixed(1)}" r="${isCurl ? '2.5' : '4.5'}" fill="${color}"/>`;
        }
      }
      const average = integral / (Math.PI * radius * radius);
      this._average = average; this._local = entry.local(this._x, this._y);
      this._get('boundary').innerHTML = boundary;
      const probe = this._get('probe');
      probe.setAttribute('cx', toX(this._x)); probe.setAttribute('cy', toY(this._y)); probe.setAttribute('r', radius * 100);
      if (!isCurl) {
        const color = average > 0.05 ? COLORS.out : average < -0.05 ? COLORS.in : COLORS.neutral;
        probe.setAttribute('stroke', color); probe.setAttribute('fill', color);
      }
      this._get('integral').textContent = formatted(integral);
      this._get('average').textContent = formatted(average);
      this._get('local').textContent = formatted(this._local);
      if (isCurl) {
        this._omega = clamp(average * 0.5 * 180 / Math.PI * 2.5, -240, 240);
        this._get('radius-value').value = radius.toFixed(2);
        this._get('radius').setAttribute('aria-valuetext', radius.toFixed(2));
        const x = toX(this._x), y = toY(this._y), r = radius * 100;
        const a = this._get('spoke-a'), b = this._get('spoke-b');
        a.setAttribute('x1', x - r); a.setAttribute('x2', x + r); a.setAttribute('y1', y); a.setAttribute('y2', y);
        b.setAttribute('x1', x); b.setAttribute('x2', x); b.setAttribute('y1', y - r); b.setAttribute('y2', y + r);
        this._get('hub').setAttribute('cx', x); this._get('hub').setAttribute('cy', y);
        const status = Math.abs(average) < 0.005 ? 'Average curl is approximately zero.' : average > 0 ? 'Positive average curl: counterclockwise, pointing out of the screen.' : 'Negative average curl: clockwise, pointing into the screen.';
        this._get('message').textContent = `${status} Orange arrows show counterclockwise contributions; blue arrows show clockwise contributions.`;
        this._drawRotor(); this._syncAnimation();
      } else {
        const status = Math.abs(average) < 0.005 ? 'Inward and outward flux balance.' : average > 0 ? 'More field leaves than enters: positive average divergence.' : 'More field enters than leaves: negative average divergence.';
        this._get('message').textContent = `${status} Red dots show outward flow; blue dots show inward flow.`;
      }
    }

    _drawRotor() { this._get('rotor')?.setAttribute('transform', `rotate(${-this._angle} ${toX(this._x)} ${toY(this._y)})`); }
    _updateTransport() {
      const button = this._get('play');
      if (!button) return;
      button.textContent = this._playing ? 'Pause animation' : 'Play animation';
      button.setAttribute('aria-pressed', String(this._playing));
    }
    _canAnimate() {
      return this._isCurl && this.isConnected && this._initialized && this._playing && !this._suspended && this._intersecting && document.visibilityState !== 'hidden' && (this._details || []).every(details => details.open) && Math.abs(this._omega) > 1e-6;
    }
    _syncAnimation() {
      if (this._canAnimate()) {
        if (this._frame === null) this._frame = requestAnimationFrame(this._tick);
      } else this._stopAnimation();
    }
    _stopAnimation() {
      if (this._frame !== null) cancelAnimationFrame(this._frame);
      this._frame = null; this._lastTime = null;
    }
  }

  class DivergenceProbe extends VectorProbe { get _isCurl() { return false; } }
  class CurlPaddleWheel extends VectorProbe { get _isCurl() { return true; } }
  if (!customElements.get('divergence-probe')) customElements.define('divergence-probe', DivergenceProbe);
  if (!customElements.get('curl-paddle-wheel')) customElements.define('curl-paddle-wheel', CurlPaddleWheel);
})();
