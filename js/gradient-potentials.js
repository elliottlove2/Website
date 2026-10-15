/* A route integral for an uphill gradient, compared with a rotating field. */
(() => {
  'use strict';

  const TAU = 2 * Math.PI;
  const SAMPLE_COUNT = 800;
  const START = [-2, 0];
  const END = [1, 0];
  const potential = (x, y) => 2 * Math.exp(-(x * x + y * y) / 2);
  const fields = {
    hill: (x, y) => { const f = potential(x, y); return [-x * f, -y * f]; },
    rotation: (x, y) => [-y, x]
  };
  const routes = {
    straight: t => [-2 + 3 * t, 0],
    upper: t => [-2 + 3 * t, 1.2 * Math.sin(Math.PI * t)],
    lower: t => [-2 + 3 * t, -1.2 * Math.sin(Math.PI * t)],
    loop: t => [-0.75 - 1.25 * Math.cos(TAU * t), -1.25 * Math.sin(TAU * t)]
  };
  const clamp = value => Math.max(0, Math.min(1, value));
  const xPixel = x => 340 + 100 * x;
  const yPixel = y => 200 - 100 * y;
  const number = value => (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3);
  let instance = 0;

  const styles = `
    :host { display: block; min-width: 0; color: #26241f; font-family: inherit; font-size: 15px; line-height: 1.5; color-scheme: light; }
    *, *::before, *::after { box-sizing: border-box; }
    .demo { padding: 16px; background: #faf9f5; border: 1px solid #dcd7cb; border-radius: 8px; }
    .title { font: inherit; font-size: 18px; font-weight: 700; margin: 0 0 8px; }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin: 0 0 9px; }
    .group-label { color: #5f5e5a; font-size: 12px; margin-right: 2px; }
    button { appearance: none; font: inherit; font-size: 13px; line-height: 1.35; padding: 7px 10px; border: 1px solid #bcb7ab; border-radius: 5px; color: #26241f; background: #fffefa; cursor: pointer; min-height: 34px; }
    button:hover { background: #f1efe8; }
    button[aria-pressed="true"] { background: #E6F1FB; color: #185FA5; border-color: #378ADD; }
    button:focus-visible, input:focus-visible, svg:focus-visible { outline: 2px solid #378ADD; outline-offset: 3px; }
    .formula { margin: 5px 0 8px; color: #5f5e5a; font-size: 12px; }
    .board { display: block; width: 100%; height: auto; aspect-ratio: 17 / 10; border-radius: 4px; }
    .board text { font-family: inherit; fill: #5f5e5a; font-size: 13px; }
    .transport { display: flex; flex-wrap: wrap; gap: 9px; align-items: center; margin: 12px 0; }
    .transport label { color: #5f5e5a; font-size: 13px; }
    .transport input { flex: 1; min-width: 80px; margin: 0; accent-color: #378ADD; }
    .transport output { min-width: 34px; font-size: 13px; font-variant-numeric: tabular-nums; text-align: right; }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .metric { margin: 0; padding: 10px 12px; min-width: 0; background: #f1efe8; border-radius: 5px; }
    .metric dt { color: #5f5e5a; font-size: 12px; line-height: 1.35; }
    .metric dd { font-size: 23px; font-weight: 700; line-height: 1.35; margin: 4px 0 0; font-variant-numeric: tabular-nums; }
    .metric small { display: block; font-size: 11px; line-height: 1.35; margin-top: 3px; color: #5f5e5a; font-weight: 400; }
    .message { font-size: 13px; color: #5f5e5a; margin: 10px 0 0; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
    @media (max-width: 440px) {
      .demo { padding: 11px; }
      button { padding: 7px 9px; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric { padding: 9px; }
      .metric:last-child { grid-column: 1 / -1; }
      .transport button { flex: 0 0 auto; }
      .transport label { flex-basis: calc(100% - 85px); }
    }
  `;

  class GradientPotentials extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._id = `gradient-potentials-${++instance}`;
      this._field = 'hill';
      this._route = 'straight';
      this._progress = 0;
      this._suspended = false;
      this._visible = false;
      this._frame = null;
      this._lastTime = null;
      this._motion = matchMedia('(prefers-reduced-motion: reduce)');
      this._playing = !this._motion.matches;
      this._onVisibility = () => this._syncAnimation();
      this._onDetails = () => this._syncAnimation();
      this._onMotion = event => {
        if (event.matches) this._playing = false;
        this._updateTransport(); this._syncAnimation();
      };
      this._tick = time => {
        this._frame = null;
        if (!this._canAnimate()) { this._lastTime = null; return; }
        if (this._lastTime !== null) this._progress = clamp(this._progress + Math.min(0.075, (time - this._lastTime) / 1000) / 7);
        this._lastTime = time;
        this._updateWalker();
        if (this._progress >= 1) {
          this._playing = false; this._lastTime = null; this._updateTransport();
        } else this._frame = requestAnimationFrame(this._tick);
      };
    }

    connectedCallback() {
      this._details = [];
      for (let parent = this.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') {
          this._details.push(parent);
          parent.addEventListener('toggle', this._onDetails);
        }
      }
      if (!this._initialized) this._initialize();
      document.addEventListener('visibilitychange', this._onVisibility);
      this._motion.addEventListener('change', this._onMotion);
      this._visible = !('IntersectionObserver' in window);
      if ('IntersectionObserver' in window) {
        this._observer = new IntersectionObserver(entries => {
          this._visible = entries[0].isIntersecting;
          this._syncAnimation();
        });
        this._observer.observe(this);
      }
      this._syncAnimation();
    }

    disconnectedCallback() {
      this._details?.forEach(details => details.removeEventListener('toggle', this._onDetails));
      document.removeEventListener('visibilitychange', this._onVisibility);
      this._motion.removeEventListener('change', this._onMotion);
      this._observer?.disconnect(); this._stopAnimation();
    }

    pause() { this._suspended = true; this._stopAnimation(); }
    resume() { this._suspended = false; this._syncAnimation(); }
    _get(id) { return this.shadowRoot.getElementById(id); }

    _initialize() {
      this._initialized = true;
      this.shadowRoot.innerHTML = `
        <style>${styles}</style>
        <section class="demo" aria-labelledby="title">
          <h4 class="title" id="title">Gradient and potentials</h4>
          <div class="controls" role="group" aria-label="Choose a vector field">
            <button type="button" data-field="hill" aria-pressed="true">Uphill gradient ∇f</button>
            <button type="button" data-field="rotation" aria-pressed="false">Rotation field</button>
          </div>
          <div class="controls" role="group" aria-label="Choose a route">
            <span class="group-label" aria-hidden="true">Route</span>
            <button type="button" data-route="straight" aria-pressed="true">Straight</button>
            <button type="button" data-route="upper" aria-pressed="false">Upper</button>
            <button type="button" data-route="lower" aria-pressed="false">Lower</button>
            <button type="button" data-route="loop" aria-pressed="false">Closed loop</button>
          </div>
          <p class="formula" id="formula"></p>
          <svg id="sv" class="board" viewBox="0 0 680 400" preserveAspectRatio="xMidYMid meet" tabindex="0" role="img" aria-label="A walker follows a route through a vector field" aria-describedby="keyboard-instructions">
            <defs><marker id="${this._id}-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
            <g id="contours"></g><g id="field-arrows"></g>
            <path id="route-path" fill="none" stroke="#D85A30" stroke-opacity="0.3" stroke-width="4" stroke-linecap="round"/>
            <path id="travelled-path" fill="none" stroke="#D85A30" stroke-width="4" stroke-linecap="round"/>
            <g id="endpoints"></g>
            <g id="walker"><circle r="9" fill="#fffefa" stroke="#D85A30" stroke-width="2.5"/><circle r="3.5" fill="#D85A30"/></g>
          </svg>
          <span class="sr-only" id="keyboard-instructions">Right or up moves forward; left or down moves backward. Home returns to the start; End goes to the endpoint.</span>
          <div class="transport">
            <button type="button" id="play" aria-pressed="false">Play</button>
            <label for="progress">Progress</label>
            <input id="progress" type="range" min="0" max="100" step="0.1" value="0">
            <output id="progress-value" for="progress">0%</output>
          </div>
          <div class="metrics" aria-label="Line integral and potential change">
            <dl class="metric"><dt>Work so far<small>∫ F · dr along the orange path</small></dt><dd id="work">0.000</dd></dl>
            <dl class="metric"><dt>Potential change so far<small id="potential-label">f(walker) − f(A)</small></dt><dd id="potential">0.000</dd></dl>
            <dl class="metric"><dt>Full route work<small id="full-work-label">From A to B</small></dt><dd id="full-work">0.000</dd></dl>
          </div>
          <p class="message" id="message"></p>
          <span class="sr-only" id="announcement" role="status" aria-live="polite"></span>
        </section>`;

      this.shadowRoot.querySelectorAll('button[data-field]').forEach(button => button.addEventListener('click', () => {
        this._field = button.dataset.field; this._progress = 0; this._renderSelection();
      }));
      this.shadowRoot.querySelectorAll('button[data-route]').forEach(button => button.addEventListener('click', () => {
        this._route = button.dataset.route; this._progress = 0; this._renderSelection();
      }));
      this._get('play').addEventListener('click', () => {
        if (!this._playing && this._progress >= 1) { this._progress = 0; this._updateWalker(); }
        this._playing = !this._playing; this._updateTransport(); this._syncAnimation();
      });
      this._get('progress').addEventListener('input', event => this._scrub(Number(event.target.value) / 100));
      this._get('progress').addEventListener('change', () => this._announce());
      this._get('sv').addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = this._progress + (event.shiftKey ? 0.1 : 0.02);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = this._progress - (event.shiftKey ? 0.1 : 0.02);
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = 1;
        else return;
        event.preventDefault(); this._scrub(next); this._announce();
      });
      this._renderSelection();
    }

    _renderSelection() {
      this.dataset.field = this._field; this.dataset.route = this._route;
      this.shadowRoot.querySelectorAll('button[data-field]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.field === this._field)));
      this.shadowRoot.querySelectorAll('button[data-route]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.route === this._route)));
      this._get('formula').textContent = this._field === 'hill'
        ? 'f(x, y) = 2 exp(−(x² + y²)/2); F = ∇f points uphill. Contours show equal height.'
        : 'F(x, y) = (−y, x); curl F = 2. This field has no global scalar potential.';
      this._drawField(); this._sampleRoute();
      this._get('route-path').setAttribute('d', this._pathTo(1));
      const isLoop = this._route === 'loop';
      const endpoint = isLoop ? START : END;
      this._get('endpoints').innerHTML = `<circle cx="${xPixel(START[0])}" cy="${yPixel(START[1])}" r="5" fill="#378ADD"/><text x="${xPixel(START[0]) - 5}" y="${yPixel(START[1]) + 24}">${isLoop ? 'A = B' : 'A'}</text>${isLoop ? '' : `<circle cx="${xPixel(endpoint[0])}" cy="${yPixel(endpoint[1])}" r="5" fill="#E24B4A"/><text x="${xPixel(endpoint[0]) + 8}" y="${yPixel(endpoint[1]) + 24}">B</text>`}`;
      this._get('potential-label').textContent = this._field === 'hill' ? 'f(walker) − f(A)' : 'No global scalar potential';
      this._get('full-work-label').textContent = isLoop ? 'A complete counterclockwise loop' : 'From A to B';
      this._get('full-work').textContent = number(this._samples[SAMPLE_COUNT].work);
      this._get('message').textContent = this._field === 'hill'
        ? 'For F = ∇f, work equals the change in f. The three A-to-B routes give the same total; a closed loop gives zero.'
        : 'Work depends on the route. Around this closed loop, the circulation is positive even though the endpoints coincide.';
      this._lastTime = null; this._updateWalker(); this._updateTransport(); this._syncAnimation();
    }

    _sampleRoute() {
      const route = routes[this._route], field = fields[this._field];
      const [x, y] = route(0);
      this._samples = [{ x, y, work: 0 }];
      let previousField = field(x, y);
      for (let index = 1; index <= SAMPLE_COUNT; index++) {
        const [nextX, nextY] = route(index / SAMPLE_COUNT), nextField = field(nextX, nextY);
        const previous = this._samples[index - 1];
        const increment = ((previousField[0] + nextField[0]) * (nextX - previous.x) + (previousField[1] + nextField[1]) * (nextY - previous.y)) / 2;
        this._samples.push({ x: nextX, y: nextY, work: previous.work + increment });
        previousField = nextField;
      }
    }

    _drawField() {
      const isHill = this._field === 'hill';
      let contours = '';
      if (isHill) {
        for (const level of [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]) {
          const radius = Math.sqrt(-2 * Math.log(level / 2)) * 100;
          contours += `<circle cx="340" cy="200" r="${radius.toFixed(2)}" fill="#E24B4A" fill-opacity="0.025" stroke="#E24B4A" stroke-opacity="0.24" stroke-width="1"/>`;
        }
        contours += '<circle cx="340" cy="200" r="2.5" fill="#E24B4A"/><text x="347" y="190">peak</text>';
      }
      this._get('contours').innerHTML = contours;
      let arrows = '';
      for (let i = -8; i <= 8; i++) for (let j = -4; j <= 4; j++) {
        const x = i * 0.4, y = j * 0.4, [fx, fy] = fields[this._field](x, y), magnitude = Math.hypot(fx, fy);
        if (magnitude < 1e-6) continue;
        const length = 7 + 23 * Math.tanh(magnitude), dx = fx / magnitude * length / 2, dy = -fy / magnitude * length / 2;
        arrows += `<line x1="${(xPixel(x) - dx).toFixed(1)}" y1="${(yPixel(y) - dy).toFixed(1)}" x2="${(xPixel(x) + dx).toFixed(1)}" y2="${(yPixel(y) + dy).toFixed(1)}" stroke="${isHill ? '#378ADD' : '#5f5e5a'}" opacity="0.55" stroke-width="1.2" marker-end="url(#${this._id}-arrow)"/>`;
      }
      this._get('field-arrows').innerHTML = arrows;
      this._get('sv').setAttribute('aria-label', isHill ? 'Contours of a hill with uphill gradient arrows and a walker on the selected route' : 'Counterclockwise vector field with a walker on the selected route');
    }

    _pathTo(progress) {
      const route = routes[this._route], count = Math.max(1, Math.ceil(progress * 100));
      let path = '';
      for (let i = 0; i <= count; i++) {
        const [x, y] = route(progress * i / count);
        path += `${i ? 'L' : 'M'}${xPixel(x).toFixed(2)},${yPixel(y).toFixed(2)}`;
      }
      return path;
    }

    _updateWalker() {
      if (!this._initialized || !this._samples) return;
      const t = this._progress, index = Math.min(SAMPLE_COUNT, Math.floor(t * SAMPLE_COUNT));
      const previous = this._samples[index], [x, y] = routes[this._route](t);
      const field = fields[this._field], atPrevious = field(previous.x, previous.y), atWalker = field(x, y);
      const work = previous.work + ((atPrevious[0] + atWalker[0]) * (x - previous.x) + (atPrevious[1] + atWalker[1]) * (y - previous.y)) / 2;
      this._work = work;
      this.dataset.progress = t.toFixed(4); this.dataset.work = work.toFixed(8);
      this._get('walker').setAttribute('transform', `translate(${xPixel(x).toFixed(3)} ${yPixel(y).toFixed(3)})`);
      this._get('travelled-path').setAttribute('d', this._pathTo(t));
      this._get('work').textContent = number(work);
      this._get('potential').textContent = this._field === 'hill' ? number(potential(x, y) - potential(...START)) : '—';
      this._get('progress').value = (t * 100).toFixed(1);
      this._get('progress').setAttribute('aria-valuetext', `${Math.round(t * 100)} percent; work ${number(work)}`);
      this._get('progress-value').value = `${Math.round(t * 100)}%`;
    }

    _scrub(progress) {
      this._playing = false; this._progress = clamp(progress);
      this._stopAnimation(); this._updateWalker(); this._updateTransport();
    }
    _announce() {
      this._get('announcement').textContent = `${Math.round(this._progress * 100)} percent complete. Work ${number(this._work)}.${this._field === 'hill' ? ` Potential change ${this._get('potential').textContent}.` : ' No global scalar potential.'}`;
    }
    _updateTransport() {
      if (!this._initialized) return;
      this._get('play').textContent = this._playing ? 'Pause' : this._progress >= 1 ? 'Replay' : 'Play';
      this._get('play').setAttribute('aria-pressed', String(this._playing));
      this.dataset.playing = String(this._playing);
    }
    _canAnimate() {
      return this._initialized && this.isConnected && this._playing && !this._suspended && this._visible && document.visibilityState !== 'hidden' && this.getClientRects().length > 0 && (this._details || []).every(details => details.open) && this._progress < 1;
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

  if (!customElements.get('gradient-potentials')) customElements.define('gradient-potentials', GradientPotentials);
})();
