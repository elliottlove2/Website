/*!
 * <bloch-sphere>: SU(2) → SO(3), the 3D sequel to <pin-spin-cat>
 *
 * An interactive picture of the double cover
 *
 *        Pin(3) ──2:1──▶ O(3)        Spin(3) = SU(2) ──2:1──▶ SO(3)
 *
 * on the Bloch sphere. A qubit state ψ is a spinor; its arrow r = ⟨ψ|σ|ψ⟩ is
 * quadratic in ψ, so every angle doubles on the way from states to arrows,
 * and U and −U turn the arrow the same way. The same algebra as the first
 * post, with one more generator: e₁, e₂, e₃ and the rule eᵢeⱼ + eⱼeᵢ = 2δᵢⱼ.
 *
 * Usage
 *   <script src="bloch-sphere.js" defer></script>
 *   <bloch-sphere></bloch-sphere>
 *
 * Views (tabs)
 *   state      State → arrow   amplitudes and relative phase in radians
 *   rotate     Rotate          U = exp(−iθ/2 n̂·σ) against R(θ, n̂); 2π vs 4π
 *   drive      Drive           H = (ħ/2)(Ω σx′ + δ σz): precession, cone, P₁(t), solver
 *   pulses     Three pulses    R(θ, n̂) from pulses about xy-plane axes
 *   mirrors3d  Mirrors         Pin(3) → O(3): two reflections make a rotation
 *
 * Controls and readouts use radians. For compatibility, the theta, phi,
 * angle and drive-phase HTML attributes retain their original degree units.
 * Attributes (all optional)
 *   modes        tabs to show, comma-separated: "state,rotate" (default: all)
 *   mode         the tab that opens first
 *   theme        "light", "dark" or "auto" (default: follow the reader's system)
 *   autoplay     start the view's animation when the widget scrolls into view
 *   theta, phi   state: starting polar and azimuthal angle, degrees
 *   measure      state: show the measurement axis m̂
 *   axis         rotate, pulses: "x", "y", "z", "-z" or "nx,ny,nz"
 *   angle        rotate, pulses: rotation angle θ, degrees
 *   omega, delta drive: Ω and δ, radians per unit time
 *   drive-phase  drive: φ_d, degrees
 *   mirrors      mirrors3d: number of mirrors, 1 to 3
 *
 * Styling: override any --bs-* custom property on the element.
 * Console: customElements.get("bloch-sphere").algebra is the math below, and
 *          customElements.get("bloch-sphere").selfTest() checks it.
 *          Append ?bloch-test to the page URL to run the checks on load.
 * No dependencies. MIT licence.
 */
(() => {
  "use strict";

  const TAU = 2 * Math.PI;
  const DEG = Math.PI / 180;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const mod = (v, m) => ((v % m) + m) % m;

  // ─── 1. The Clifford algebra of space: Cl(3), quaternions and SU(2) ────────
  //
  // The first post built Cl(2) from e₁, e₂ with eᵢeᵢ = 1 and e₁e₂ = −e₂e₁.
  // Add a third generator e₃ with the same two rules and you get Cl(3):
  //
  //   eᵢeⱼ + eⱼeᵢ = 2δᵢⱼ
  //
  // Eight basis elements: 1; e₁, e₂, e₃; e₂e₃, e₃e₁, e₁e₂; e₁e₂e₃.
  //
  // The Pauli matrices obey exactly the same rule, σᵢσⱼ + σⱼσᵢ = 2δᵢⱼ I,
  // so eᵢ ↦ σᵢ is a matrix representation of Cl(3). Everything in this
  // section is done in Cl(3); toSU2() is the bridge to 2×2 matrices and to
  // the spinors (qubit states) they act on.

  // 1a. Real 3-vectors, as plain [x, y, z] arrays.

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const norm = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => {
    const n = norm(a);
    return n > 0 ? [a[0] / n, a[1] / n, a[2] / n] : [0, 0, 1];
  };

  // Spherical angles with θ the polar angle from +z, φ the azimuth from +x.
  const sph = (theta, phi) => [
    Math.sin(theta) * Math.cos(phi),
    Math.sin(theta) * Math.sin(phi),
    Math.cos(theta),
  ];
  const angles = (v) => {
    const u = unit(v);
    return { theta: Math.acos(clamp(u[2], -1, 1)), phi: Math.atan2(u[1], u[0]) };
  };

  // Any unit vector perpendicular to n (used for flags, planes and arcs).
  const perp = (n) => {
    const u = unit(n);
    const t = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    return unit(sub(t, scale(u, dot(t, u))));
  };

  // 1b. Multivectors.
  //
  // A multivector is a plain array of 8 reals:
  //
  //   [ s,  v₁, v₂, v₃,  b₂₃, b₃₁, b₁₂,  t ]
  //     1   e₁  e₂  e₃   e₂e₃ e₃e₁ e₁e₂  e₁e₂e₃
  //
  // The bivectors are listed cyclically (e₂e₃, e₃e₁, e₁e₂) so that the
  // bivector dual to a vector n is  I n = n₁e₂e₃ + n₂e₃e₁ + n₃e₁e₂,
  // where I = e₁e₂e₃ is the unit trivector (I² = −1, and I commutes with
  // everything in Cl(3)).

  const mv = (s = 0, v = [0, 0, 0], b = [0, 0, 0], t = 0) =>
    [s, v[0], v[1], v[2], b[0], b[1], b[2], t];
  const vec = (v) => mv(0, v);
  const vecPart = (A) => [A[1], A[2], A[3]];
  const ONE = mv(1);
  const I3 = mv(0, [0, 0, 0], [0, 0, 0], 1);

  // The multiplication table follows from the two rules alone.
  // Label a basis blade by a bitmask (bit k ↔ e_{k+1}). The product of two
  // blades is the XOR of their masks (repeated eᵢ square to 1), times
  // (−1)^(number of swaps needed to sort the generators into order).
  const MASK = [0, 1, 2, 4, 6, 5, 3, 7]; // 1 e₁ e₂ e₃ e₂e₃ e₃e₁ e₁e₂ e₁e₂e₃
  const ORIENT = [1, 1, 1, 1, 1, -1, 1, 1]; // e₃e₁ = −(e₁e₃), the sorted blade
  const SLOT = [];
  MASK.forEach((m, i) => { SLOT[m] = i; });
  const swaps = (a, b) => {
    let n = 0;
    for (a >>= 1; a; a >>= 1) for (let x = a & b; x; x >>= 1) n += x & 1;
    return n;
  };
  const TABLE = new Int8Array(128); // [slot, sign] for each pair of blades
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const k = SLOT[MASK[i] ^ MASK[j]];
      const sign = ORIENT[i] * ORIENT[j] * ORIENT[k] * (swaps(MASK[i], MASK[j]) & 1 ? -1 : 1);
      TABLE[2 * (8 * i + j)] = k;
      TABLE[2 * (8 * i + j) + 1] = sign;
    }
  }

  // The geometric product.
  function mul(A, B) {
    const out = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 8; i++) {
      if (A[i] === 0) continue;
      for (let j = 0; j < 8; j++) {
        if (B[j] === 0) continue;
        const k = 2 * (8 * i + j);
        out[TABLE[k]] += TABLE[k + 1] * A[i] * B[j];
      }
    }
    return out;
  }

  // Reverse (write every product backwards): flips bivectors and trivectors.
  const rev = (A) => [A[0], A[1], A[2], A[3], -A[4], -A[5], -A[6], -A[7]];
  // Grade involution (every vector v → −v): flips the odd grades.
  const involute = (A) => [A[0], -A[1], -A[2], -A[3], A[4], A[5], A[6], -A[7]];
  const isOdd = (A) =>
    A[1] * A[1] + A[2] * A[2] + A[3] * A[3] + A[7] * A[7] >
    A[0] * A[0] + A[4] * A[4] + A[5] * A[5] + A[6] * A[6];

  // How a versor g (a product of unit vectors) acts on a vector x:
  //
  //   x ↦ ĝ x g̃      (ĝ = involute(g), g̃ = rev(g))
  //
  // For a single unit vector u this is  x ↦ −u x u : the reflection in the
  // plane with normal u. Components along u flip, the rest commute past u
  // twice and survive. For an even g it is the rotor sandwich  x ↦ g x g̃.
  // The sign of g never matters here, which is the double cover in one line.
  const act = (g, x) => vecPart(mul(mul(involute(g), vec(x)), rev(g)));
  const reflect = (u, x) => act(vec(unit(u)), x);

  // A versor from mirror normals, listed in the order they are applied:
  // first u₁, then u₂, … gives g = u_k ⋯ u₂ u₁ (later factors on the left).
  // Two mirrors, u then w, give the rotor w u = w·u + w∧u.
  const versor = (normals) => normals.reduce((g, u) => mul(vec(unit(u)), g), ONE);

  // Rotors. The right-handed rotation by θ about the unit axis n̂ is
  //
  //   R(θ, n̂) = exp(−(θ/2) I n̂) = cos(θ/2) − sin(θ/2) I n̂.
  //
  // Check with n̂ = e₃, so I n̂ = e₁e₂ and, to first order in θ,
  //   R e₁ R̃ = e₁ + (θ/2)(e₁ e₁e₂ − e₁e₂ e₁) = e₁ + θ e₂ :  +x turns toward +y.
  // The half angle is there because R appears twice in the sandwich.
  const rotor = (angle, n) => {
    const u = unit(n);
    const s = Math.sin(angle / 2);
    return mv(Math.cos(angle / 2), [0, 0, 0], [-s * u[0], -s * u[1], -s * u[2]]);
  };

  // Angle ∈ [0, 2π] and axis of an even (rotor) multivector. Uses
  // R = cos(θ/2) − sin(θ/2) I n̂, so sin(θ/2) n̂ = −(b₂₃, b₃₁, b₁₂).
  const rotorAngleAxis = (R) => {
    const v = [-R[4], -R[5], -R[6]];
    const s = norm(v);
    return { angle: 2 * Math.atan2(s, R[0]), axis: s > 1e-15 ? scale(v, 1 / s) : [0, 0, 1] };
  };

  // Unit quaternions are the rotors. With the usual q v q* convention,
  //   i ↔ −e₂e₃,  j ↔ −e₃e₁,  k ↔ −e₁e₂
  // (check: i² = (e₂e₃)² = −1 and i j = e₂e₃ e₃e₁ = e₂e₁ = −e₁e₂ ↔ k).
  // So R(θ, n̂) is the quaternion cos(θ/2) + sin(θ/2)(n₁ i + n₂ j + n₃ k).
  const quat = (R) => [R[0], -R[4], -R[5], -R[6]]; // [w, x, y, z]

  // The 3×3 matrix of a versor's action (columns are the images of eᵢ).
  // Rows-of-rows layout: M[i][j].
  const o3 = (g) => {
    const c = [act(g, [1, 0, 0]), act(g, [0, 1, 0]), act(g, [0, 0, 1])];
    return [0, 1, 2].map((i) => [c[0][i], c[1][i], c[2][i]]);
  };

  // 1c. Complex numbers as [re, im], and 2×2 complex matrices as a flat
  //     [a, b, c, d] for the matrix  ( a  b )
  //                                  ( c  d ).

  const cx = (re, im = 0) => [re, im];
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cconj = (a) => [a[0], -a[1]];
  const cscale = (a, s) => [a[0] * s, a[1] * s];
  const cabs2 = (a) => a[0] * a[0] + a[1] * a[1];
  const carg = (a) => Math.atan2(a[1], a[0]);
  const cexpi = (phi) => [Math.cos(phi), Math.sin(phi)];

  const m2 = (a, b, c, d) => [a, b, c, d];
  const m2add = (A, B) => A.map((z, k) => cadd(z, B[k]));
  const m2scale = (A, z) => A.map((w) => cmul(w, z));
  const m2mul = (A, B) => [
    cadd(cmul(A[0], B[0]), cmul(A[1], B[2])),
    cadd(cmul(A[0], B[1]), cmul(A[1], B[3])),
    cadd(cmul(A[2], B[0]), cmul(A[3], B[2])),
    cadd(cmul(A[2], B[1]), cmul(A[3], B[3])),
  ];
  const m2dag = (A) => [cconj(A[0]), cconj(A[2]), cconj(A[1]), cconj(A[3])];
  const m2trace = (A) => cadd(A[0], A[3]);
  const m2apply = (A, psi) => [
    cadd(cmul(A[0], psi[0]), cmul(A[1], psi[1])),
    cadd(cmul(A[2], psi[0]), cmul(A[3], psi[1])),
  ];
  const m2dist = (A, B) => Math.max(...A.map((z, k) => Math.hypot(z[0] - B[k][0], z[1] - B[k][1])));

  const I2 = m2(cx(1), cx(0), cx(0), cx(1));
  const SX = m2(cx(0), cx(1), cx(1), cx(0));
  const SY = m2(cx(0), cx(0, -1), cx(0, 1), cx(0));
  const SZ = m2(cx(1), cx(0), cx(0), cx(-1));
  const SIGMA = [SX, SY, SZ];
  const sigmaDot = (v) => m2add(m2add(m2scale(SX, cx(v[0])), m2scale(SY, cx(v[1]))), m2scale(SZ, cx(v[2])));

  // toSU2: the representation eᵢ ↦ σᵢ, extended multiplicatively.
  //   e₂e₃ ↦ σ_y σ_z = iσ_x
  //   e₃e₁ ↦ σ_z σ_x = iσ_y
  //   e₁e₂ ↦ σ_x σ_y = iσ_z
  //   e₁e₂e₃ ↦ σ_x σ_y σ_z = i I
  // So the bivector I n̂ maps to i n̂·σ, and the rotor becomes
  //   R(θ, n̂) ↦ cos(θ/2) I − i sin(θ/2) n̂·σ = exp(−iθ/2 n̂·σ),
  // the physicist's rotation operator. On all of Cl(3) this map is an
  // algebra isomorphism onto the 2×2 complex matrices; the unit rotors
  // (the even part, Spin(3)) land exactly on SU(2).
  const iI = cx(0, 1);
  const BASIS2 = [I2, SX, SY, SZ, m2scale(SX, iI), m2scale(SY, iI), m2scale(SZ, iI), m2scale(I2, iI)];
  const toSU2 = (A) => {
    let M = m2(cx(0), cx(0), cx(0), cx(0));
    for (let k = 0; k < 8; k++) if (A[k] !== 0) M = m2add(M, m2scale(BASIS2[k], cx(A[k])));
    return M;
  };

  // 1d. Qubits.
  //
  // |ψ⟩ = α|0⟩ + β|1⟩ is stored as [α, β]. Standard form:
  //   α = cos(θ/2),  β = e^{iφ} sin(θ/2).
  const ket = (theta, phi) => [cx(Math.cos(theta / 2)), cscale(cexpi(phi), Math.sin(theta / 2))];
  const withPhase = (psi, chi) => psi.map((z) => cmul(cexpi(chi), z));

  // The Bloch vector rᵢ = ⟨ψ|σᵢ|ψ⟩:
  //   r_x = 2 Re(ᾱβ),  r_y = 2 Im(ᾱβ),  r_z = |α|² − |β|².
  // Quadratic in ψ, so for the standard form the half angles double:
  //   2 cos(θ/2) sin(θ/2) = sin θ,   cos²(θ/2) − sin²(θ/2) = cos θ,
  // giving r = (sin θ cos φ, sin θ sin φ, cos θ). A common phase e^{iχ}
  // cancels in ᾱβ and in |α|², so the arrow cannot see it.
  const bloch = (psi) => {
    const ab = cmul(cconj(psi[0]), psi[1]);
    return [2 * ab[0], 2 * ab[1], cabs2(psi[0]) - cabs2(psi[1])];
  };
  const expect = (psi, M) => {
    const Mpsi = m2apply(M, psi);
    return cmul(cconj(psi[0]), Mpsi[0])[0] + cmul(cconj(psi[1]), Mpsi[1])[0];
  };

  // The rotation operator R(θ, n̂) = exp(−iθ/2 n̂·σ), computed from the rotor.
  // Because (n̂·σ)² = I, the exponential series splits into cos and sin.
  const su2 = (angle, n) => toSU2(rotor(angle, n));

  // Ad: SU(2) → SO(3),  R_ij = ½ Tr(σᵢ U σⱼ U†), i.e. U(v·σ)U† = (Rv)·σ.
  // U and −U give the same R: the kernel is {±I}.
  const ad = (U) => {
    const Ud = m2dag(U);
    return [0, 1, 2].map((i) =>
      [0, 1, 2].map((j) => 0.5 * m2trace(m2mul(SIGMA[i], m2mul(U, m2mul(SIGMA[j], Ud))))[0]));
  };

  // Rodrigues' formula, the right-handed SO(3) rotation, written directly
  // and independently of the algebra above (the tests compare the two):
  //   R r = r∥ + cos θ r⊥ + sin θ (n̂ × r).
  const rodrigues = (angle, n, r) => {
    const u = unit(n);
    const par = scale(u, dot(u, r));
    const rp = sub(r, par);
    return add(add(par, scale(rp, Math.cos(angle))), scale(cross(u, r), Math.sin(angle)));
  };
  const rot3 = (angle, n) => {
    const c = [rodrigues(angle, n, [1, 0, 0]), rodrigues(angle, n, [0, 1, 0]), rodrigues(angle, n, [0, 0, 1])];
    return [0, 1, 2].map((i) => [c[0][i], c[1][i], c[2][i]]);
  };
  const mat3vec = (M, v) => M.map((row) => dot(row, v));

  // 1e. Dynamics.
  //
  // H = (ħ/2) a·σ generates exp(−iHt/ħ) = exp(−i(|a|t/2) â·σ) = R(|a|t, â),
  // so the Bloch vector obeys dr/dt = a × r: precession about â at rate |a|.
  // This is the closed form; nothing is integrated, so nothing drifts.
  const evolve = (a, t) => {
    const w = norm(a);
    return w * Math.abs(t) > 0 ? rotor(w * t, a) : ONE;
  };

  // The rotating-frame drive H = (ħ/2)(Ω σ_x′ + δ σ_z), where x′ is the
  // in-plane axis at drive phase φ_d:  a = (Ω cos φ_d, Ω sin φ_d, δ).
  const driveVector = (omega, delta, phase) => [omega * Math.cos(phase), omega * Math.sin(phase), delta];
  // Generalised Rabi frequency √(Ω² + δ²).
  const rabi = (omega, delta) => Math.hypot(omega, delta);
  // Angle between â and +z, the cone's half-angle for a start at |0⟩:
  // arctan(Ω/δ), taken in (0, π) so negative δ tilts past the equator.
  const coneAngle = (omega, delta) => Math.atan2(omega, delta);
  // P₁(t) from |0⟩: r_z(t) = cos(Ω_R t) + (1 − cos Ω_R t) â_z², so
  //   P₁ = (1 − r_z)/2 = (Ω²/Ω_R²) sin²(Ω_R t / 2),  maximum Ω²/(Ω² + δ²).
  const rabiP1 = (omega, delta, t) => {
    const W2 = omega * omega + delta * delta;
    if (!(W2 > 0)) return 0;
    const s = Math.sin(Math.sqrt(W2) * t / 2);
    return (omega * omega / W2) * s * s;
  };
  const maxP1 = (omega, delta) => {
    const W2 = omega * omega + delta * delta;
    return W2 > 0 ? omega * omega / W2 : 0;
  };

  // The inverse problem: which (φ_d, δ, T) at fixed Ω realises R(θ, n̂)?
  // Need â = n̂ and |a|T = θ. With n_ρ = √(n_x² + n_y²):
  //   φ_d = atan2(n_y, n_x),   δ = Ω n_z / n_ρ,   T = θ n_ρ / Ω,
  // equivalently Ω T = θ n_ρ and δ T = θ n_z. Then |a| = Ω / n_ρ and
  // |a|T = θ exactly, so U(T) = R(θ, n̂) with global phase exactly +1
  // (H is traceless, and no extra 2π sneaks in). As n_ρ → 0 the required
  // δ/Ω diverges: a z-rotation cannot be reached with the drive on.
  const solveDrive = (angle, n, omega) => {
    const u = unit(n);
    const nr = Math.hypot(u[0], u[1]);
    if (angle === 0) return { ok: true, phase: 0, delta: 0, T: 0, nr };
    if (!(omega > 0)) return { ok: false, reason: "omega", nr };
    if (nr < 1e-9) return { ok: false, reason: "axial", nr };
    return { ok: true, phase: Math.atan2(u[1], u[0]), delta: omega * u[2] / nr, T: angle * nr / omega, nr };
  };

  // 1f. Composite pulses: tilt, turn, untilt.
  //
  // Conjugation moves axes:  W R(θ, m̂) W† = R(θ, R_W m̂).
  // With x̂′ = (n_x, n_y, 0)/n_ρ and ŷ′ = ẑ × x̂′, the in-plane axis
  // m̂ = n_ρ x̂′ + n_z ŷ′ is carried to n̂ by W = R(π/2, x̂′)
  // (a quarter turn about x̂′ sends ŷ′ to x̂′ × ŷ′ = ẑ). Hence
  //   R(θ, n̂) = R(π/2, x̂′) · R(θ, m̂) · R(−π/2, x̂′),
  // read right to left: R(−π/2, x̂′) is applied first. All three axes lie in
  // the xy-plane. If n̂ = ±ẑ, x̂′ is undefined and any in-plane choice works.
  const pulseFrame = (n) => {
    const u = unit(n);
    const nr = Math.hypot(u[0], u[1]);
    const xp = nr > 1e-12 ? [u[0] / nr, u[1] / nr, 0] : [1, 0, 0];
    const yp = cross([0, 0, 1], xp);
    return { xp, yp, m: add(scale(xp, nr), scale(yp, u[2])), nr };
  };
  const threePulses = (angle, n) => {
    const f = pulseFrame(n);
    return [
      { angle: -Math.PI / 2, axis: f.xp },
      { angle, axis: f.m },
      { angle: Math.PI / 2, axis: f.xp },
    ];
  };
  // Compose rotors in time order: later pulses multiply on the left.
  const compose = (pulses) => pulses.reduce((R, p) => mul(rotor(p.angle, p.axis), R), ONE);

  // 1g. Density matrices.
  //   ρ = ½(I + r·σ),  rᵢ = Tr(ρσᵢ),  Tr ρ² = ½(1 + |r|²).
  // Pure states have |r| = 1; mixed states sit inside the ball. ρ → UρU†
  // rotates r and never changes |r|.
  const rho = (r) => m2scale(m2add(I2, sigmaDot(r)), cx(0.5));
  const blochOfRho = (R) => SIGMA.map((S) => m2trace(m2mul(R, S))[0]);
  const purity = (R) => m2trace(m2mul(R, R))[0];

  const algebra = {
    // vectors
    dot, cross, add, sub, scale, norm, unit, sph, angles, perp,
    // Cl(3)
    mv, vec, vecPart, ONE, I3, mul, rev, involute, isOdd, act, reflect, versor,
    rotor, rotorAngleAxis, quat, o3,
    // complex and SU(2)
    cx, cadd, csub, cmul, cconj, cscale, cabs2, carg, cexpi,
    m2, m2add, m2scale, m2mul, m2dag, m2trace, m2apply, m2dist,
    I2, SX, SY, SZ, SIGMA, sigmaDot, toSU2,
    // qubits
    ket, withPhase, bloch, expect, su2, ad, rodrigues, rot3, mat3vec,
    // dynamics and pulses
    evolve, driveVector, rabi, coneAngle, rabiP1, maxP1, solveDrive,
    pulseFrame, threePulses, compose,
    // density matrices
    rho, blochOfRho, purity,
  };

  // ─── 2. Self-test ──────────────────────────────────────────────────────────
  //
  // customElements.get("bloch-sphere").selfTest() checks every identity the
  // widget relies on, with seeded random inputs so failures are repeatable.

  const mulberry32 = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  function selfTest({ cases = 1000, seed = 20260929, tol = 1e-9, log = true } = {}) {
    const rnd = mulberry32(seed);
    const rUnit = () => {
      const z = 2 * rnd() - 1, p = TAU * rnd(), s = Math.sqrt(1 - z * z);
      return [s * Math.cos(p), s * Math.sin(p), z];
    };
    const rAngle = () => 4 * Math.PI * rnd();
    const rState = () => {
      // a random normalised spinor with a random global phase
      const v = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
      const n = Math.hypot(...v);
      return [cx(v[0] / n, v[1] / n), cx(v[2] / n, v[3] / n)];
    };
    const vdist = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
    const mdist3 = (A, B) => Math.max(...A.map((row, i) => vdist(row, B[i])));
    const mvdist = (A, B) => Math.max(...A.map((a, k) => Math.abs(a - B[k])));

    const rows = [];
    const check = (name, fn) => {
      let err = 0, n = 0;
      try {
        for (let k = 0; k < cases; k++) { err = Math.max(err, fn(k)); n++; }
      } catch (e) {
        err = NaN;
        if (log) console.error(name, e);
      }
      rows.push({ test: name, cases: n, "max error": err, pass: err <= tol });
    };

    check("Pauli: σᵢσⱼ + σⱼσᵢ = 2δᵢⱼI; e₂e₃ ↦ iσx, e₃e₁ ↦ iσy, e₁e₂ ↦ iσz", (k) => {
      let e = 0;
      if (k === 0) {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
          const ac = m2add(m2mul(SIGMA[i], SIGMA[j]), m2mul(SIGMA[j], SIGMA[i]));
          e = Math.max(e, m2dist(ac, m2scale(I2, cx(i === j ? 2 : 0))));
        }
        e = Math.max(e,
          m2dist(toSU2(mv(0, [0, 0, 0], [1, 0, 0])), m2scale(SX, cx(0, 1))),
          m2dist(toSU2(mv(0, [0, 0, 0], [0, 1, 0])), m2scale(SY, cx(0, 1))),
          m2dist(toSU2(mv(0, [0, 0, 0], [0, 0, 1])), m2scale(SZ, cx(0, 1))),
          m2dist(toSU2(I3), m2scale(I2, cx(0, 1))));
      }
      // toSU2 is an algebra homomorphism on random multivectors
      const A = Array.from({ length: 8 }, () => rnd() - 0.5);
      const B = Array.from({ length: 8 }, () => rnd() - 0.5);
      return Math.max(e, m2dist(toSU2(mul(A, B)), m2mul(toSU2(A), toSU2(B))));
    });

    check("Bloch(cos(θ/2)|0⟩ + e^{iφ}sin(θ/2)|1⟩) = (sinθcosφ, sinθsinφ, cosθ), |r| = 1", () => {
      const th = Math.PI * rnd(), ph = TAU * rnd();
      const psi = ket(th, ph);
      const r = bloch(psi);
      const byDef = SIGMA.map((S) => expect(psi, S)); // rᵢ = ⟨ψ|σᵢ|ψ⟩
      return Math.max(vdist(r, sph(th, ph)), vdist(r, byDef), Math.abs(norm(r) - 1));
    });

    check("Bloch(R(θ,n̂)ψ) = Rodrigues(θ,n̂)·Bloch(ψ); n̂ = ẑ, π/2: +x → +y", (k) => {
      let e = 0;
      if (k === 0) {
        const plus = ket(Math.PI / 2, 0); // Bloch vector +x
        e = vdist(bloch(m2apply(su2(Math.PI / 2, [0, 0, 1]), plus)), [0, 1, 0]);
        e = Math.max(e, vdist(rodrigues(Math.PI / 2, [0, 0, 1], [1, 0, 0]), [0, 1, 0]));
        e = Math.max(e, vdist(act(rotor(Math.PI / 2, [0, 0, 1]), [1, 0, 0]), [0, 1, 0]));
      }
      const n = rUnit(), th = rAngle(), psi = rState();
      const lhs = bloch(m2apply(su2(th, n), psi));
      const rhs = rodrigues(th, n, bloch(psi));
      const viaRotor = act(rotor(th, n), bloch(psi));
      return Math.max(e, vdist(lhs, rhs), vdist(viaRotor, rhs));
    });

    check("U†σᵢU = Rᵢⱼσⱼ, and Ad(U) = Rodrigues matrix", () => {
      const n = rUnit(), th = rAngle();
      const U = su2(th, n), R = rot3(th, n);
      let e = mdist3(ad(U), R);
      for (let i = 0; i < 3; i++) {
        const lhs = m2mul(m2dag(U), m2mul(SIGMA[i], U));
        const rhs = sigmaDot(R[i]); // Σⱼ Rᵢⱼ σⱼ
        e = Math.max(e, m2dist(lhs, rhs));
      }
      return e;
    });

    check("R(2π,n̂) = −I, R(4π,n̂) = I, Ad(−U) = Ad(U), e^{iχ}ψ has the same r", () => {
      const n = rUnit(), th = rAngle(), psi = rState(), chi = TAU * rnd();
      const U = su2(th, n);
      return Math.max(
        m2dist(su2(TAU, n), m2scale(I2, cx(-1))),
        m2dist(su2(2 * TAU, n), I2),
        mdist3(ad(m2scale(U, cx(-1))), ad(U)),
        vdist(bloch(withPhase(psi, chi)), bloch(psi)));
    });

    // Global phase of the solved drive: exactly +1 (compared with no phase freedom).
    check("Drive: δ = Ωn_z/n_ρ, T = θn_ρ/Ω gives U(T) = R(θ,n̂), phase +1", () => {
      let n = rUnit();
      while (Math.hypot(n[0], n[1]) < 1e-3) n = rUnit();
      const th = rAngle(), omega = 0.1 + 3 * rnd();
      const s = solveDrive(th, n, omega);
      const a = driveVector(omega, s.delta, s.phase);
      return Math.max(
        m2dist(toSU2(evolve(a, s.T)), su2(th, n)),
        Math.abs(omega * s.T - th * s.nr), Math.abs(s.delta * s.T - th * n[2]));
    });

    check("Three pulses: R(π/2,x̂′)R(θ,m̂)R(−π/2,x̂′) = R(θ,n̂) exactly", (k) => {
      const n = k === 0 ? [0, 0, 1] : k === 1 ? [0, 0, -1] : rUnit();
      const th = rAngle();
      const p = threePulses(th, n);
      let e = m2dist(toSU2(compose(p)), su2(th, n));
      // and as a product of SU(2) matrices, right to left
      const M = m2mul(su2(p[2].angle, p[2].axis), m2mul(su2(p[1].angle, p[1].axis), su2(p[0].angle, p[0].axis)));
      e = Math.max(e, m2dist(M, su2(th, n)));
      // every pulse axis lies in the xy-plane
      for (const q of p) e = Math.max(e, Math.abs(q.axis[2]));
      return e;
    });

    check("max P₁ over a period = Ω²/(Ω² + δ²)", () => {
      const omega = 3 * rnd(), delta = 6 * (rnd() - 0.5), phase = TAU * rnd();
      const a = driveVector(omega, delta, phase), W = rabi(omega, delta);
      const P1at = (t) => (1 - act(evolve(a, t), [0, 0, 1])[2]) / 2;
      const target = maxP1(omega, delta);
      let e = Math.abs(P1at(Math.PI / W) - target); // the peak is at half a period
      const t = TAU / W * rnd();
      e = Math.max(e, Math.abs(P1at(t) - rabiP1(omega, delta, t)));
      for (let j = 0; j <= 16; j++) e = Math.max(e, P1at(TAU / W * j / 16) - target, 0);
      return e;
    });

    check("Mirrors: reflect in u then w = rotation 2∠(u,w) about u × w; Cl(3) ↔ SU(2)", () => {
      const u = rUnit(), w = rUnit(), x = rUnit();
      const alpha = Math.acos(clamp(dot(u, w), -1, 1));
      const axis = unit(cross(u, w));
      const g = versor([u, w]); // = w u
      let e = mvdist(g, mul(vec(w), vec(u)));
      e = Math.max(e, vdist(act(g, x), rodrigues(2 * alpha, axis, x)));
      e = Math.max(e, vdist(reflect(w, reflect(u, x)), act(g, x)));
      e = Math.max(e, m2dist(toSU2(g), m2mul(sigmaDot(w), sigmaDot(u))));
      e = Math.max(e, m2dist(toSU2(g), su2(2 * alpha, axis)));
      // one mirror: −(u·σ)(x·σ)(u·σ) = (reflected x)·σ
      const Su = sigmaDot(u);
      e = Math.max(e, m2dist(m2scale(m2mul(Su, m2mul(sigmaDot(x), Su)), cx(-1)), sigmaDot(reflect(u, x))));
      // flipping one normal negates the spin element, not the rotation
      const g2 = versor([scale(u, -1), w]);
      e = Math.max(e, mvdist(g2, g.map((c) => -c)), vdist(act(g2, x), act(g, x)));
      return e;
    });

    check("Density matrices: Tr ρ² = ½(1 + |r|²), Tr(ρσᵢ) = rᵢ, UρU† rotates r", () => {
      const r = scale(rUnit(), Math.cbrt(rnd()));
      const R = rho(r);
      const n = rUnit(), th = rAngle(), U = su2(th, n);
      const R2 = m2mul(U, m2mul(R, m2dag(U)));
      return Math.max(
        Math.abs(purity(R) - 0.5 * (1 + dot(r, r))),
        vdist(blochOfRho(R), r),
        vdist(blochOfRho(R2), rodrigues(th, n, r)));
    });

    const pass = rows.every((r) => r.pass);
    if (log) {
      console.table(rows);
      console.log(`%c<bloch-sphere> selfTest: ${pass ? "all passed" : "FAILED"} (${rows.length} tests × ${cases} cases, tol ${tol})`,
        `color:${pass ? "#178f86" : "#c73d6e"};font-weight:bold`);
    }
    return { pass, rows };
  }

  // ─── 3. Settings, looks and markup ─────────────────────────────────────────
  //
  // Same palette and colour code as <pin-spin-cat>:
  //   even (teal)  even elements: rotations, Spin(3) = SU(2), SO(3)
  //   odd  (pink)  odd elements: reflections, the odd half of Pin(3)
  // A filled dot is g, a ring of the same colour is −g. Override any colour
  // with --bs-<name> on the element.

  const LIGHT = `
    --bs-paper: #f6f8fa;  --bs-stage: #e9eef2;  --bs-ink: #1b2533;  --bs-muted: #5d6978;
    --bs-line: rgba(27, 37, 51, 0.16);  --bs-faint: rgba(27, 37, 51, 0.07);
    --bs-glass: #6f9cc0;  --bs-arrow: #2e4a6c;  --bs-even: #1b8478;  --bs-odd: #c0437c;`;

  const DARK = `
    --bs-paper: #151a21;  --bs-stage: #1c232c;  --bs-ink: #e7ecf1;  --bs-muted: #9aa6b4;
    --bs-line: rgba(231, 236, 241, 0.16);  --bs-faint: rgba(231, 236, 241, 0.07);
    --bs-glass: #8db8da;  --bs-arrow: #b9cce3;  --bs-even: #3cc2b2;  --bs-odd: #f071ac;`;

  // Fallbacks if a custom property comes back empty (e.g. an override that
  // points at an undefined variable).
  const DEFAULTS = {
    paper: "#f6f8fa", stage: "#e9eef2", ink: "#1b2533", muted: "#5d6978",
    line: "rgba(27, 37, 51, 0.16)", faint: "rgba(27, 37, 51, 0.07)",
    glass: "#6f9cc0", arrow: "#2e4a6c", even: "#1b8478", odd: "#c0437c",
  };

  const CAT_PALETTE = {
    fur: "#ee9f4f", furDark: "#c2692a", catInk: "#43291a", pink: "#f2a2a4", bell: "#e8b830",
  };

  const MATH_FONT = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", "STIX Two Text", Georgia, serif';

  // Numbers with a real minus sign (U+2212), and no "−0.000".
  const MINUS = "\u2212";
  const fmt = (x, d = 3) => {
    if (!Number.isFinite(x)) return x > 0 ? "∞" : x < 0 ? `${MINUS}∞` : "—";
    const s = Math.abs(x).toFixed(d);
    return x < 0 && Number(s) !== 0 ? MINUS + s : s;
  };
  const fmtSigned = (x, d = 3) => (x < 0 && Number(Math.abs(x).toFixed(d)) !== 0 ? ` ${MINUS} ` : " + ") + Math.abs(x).toFixed(d);
  const fmtDeg = (rad, d = 0) => `${fmt(rad / DEG, d)}°`;
  const fmtRad = (rad, d = 3) => {
    if (Math.abs(rad) < 1e-9) return "0 rad";
    for (const denominator of [1, 2, 3, 4, 6, 8, 12]) {
      const numerator = Math.round(rad * denominator / Math.PI);
      if (numerator && Math.abs(rad - numerator * Math.PI / denominator) < 1e-9) {
        const sign = numerator < 0 ? MINUS : "";
        const multiple = Math.abs(numerator) === 1 ? "" : Math.abs(numerator);
        return `${sign}${multiple}π${denominator === 1 ? "" : `/${denominator}`} rad`;
      }
    }
    return `${fmt(rad, d)} rad`;
  };
  const fmtSci = (x) => {
    if (x === 0) return "0";
    const [m, e] = x.toExponential(1).split("e");
    return `${m.replace("-", MINUS)}×10<sup>${e.replace("+", "").replace("-", MINUS)}</sup>`;
  };
  const fmtC = (z, d = 3) => {
    const re = Math.abs(z[0]) < 0.5 * 10 ** -d ? 0 : z[0];
    const im = Math.abs(z[1]) < 0.5 * 10 ** -d ? 0 : z[1];
    if (im === 0) return fmt(re, d);
    if (re === 0) return `${fmt(im, d)}i`;
    return `${fmt(re, d)}${fmtSigned(im, d)}i`;
  };
  const wrap360 = (deg) => ((deg % 360) + 360) % 360;

  // HTML snippets for the readouts.
  const sig = (k) => `σ<sub>${k}</sub>`;
  const matHTML = (rows) =>
    `<table class="mat" role="presentation">${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
  const mat2HTML = (M, d = 3) => matHTML([[fmtC(M[0], d), fmtC(M[1], d)], [fmtC(M[2], d), fmtC(M[3], d)]]);
  const mat3HTML = (M, d = 3) => matHTML(M.map((r) => r.map((x) => fmt(x, d))));
  const vecHTML = (v, d = 3) => `(${v.map((x) => fmt(x, d)).join(", ")})`;

  const STYLE = `
    :host {
      ${LIGHT}
      --bs-radius: 18px;
      --bs-math-font: ${MATH_FONT};
      display: block;
      color: var(--bs-ink);
      line-height: 1.5;
    }
    :host([theme="dark"]) { ${DARK} }
    @media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { ${DARK} } }

    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    :focus-visible { outline: 2px solid var(--bs-glass); outline-offset: 2px; }

    .bs {
      position: relative;
      display: grid; gap: 12px; padding: clamp(10px, 2.4vw, 16px);
      background: var(--bs-paper); border: 1px solid var(--bs-line);
      border-radius: var(--bs-radius);
    }
    .tabs { display: flex; flex-wrap: wrap; gap: 6px; }
    .tab {
      font: inherit; font-size: 0.88em; padding: 6px 13px; cursor: pointer;
      color: var(--bs-ink); background: transparent;
      border: 1px solid var(--bs-line); border-radius: 999px;
    }
    .tab small { margin-left: 7px; font-size: 0.9em; color: var(--bs-muted); }
    .tab[aria-selected="true"] { background: var(--bs-ink); border-color: var(--bs-ink); color: var(--bs-paper); }
    .tab[aria-selected="true"] small { color: inherit; opacity: 0.72; }

    .body { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
    .wide .body { grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); align-items: start; }
    .stage-wrap { position: relative; width: 100%; max-width: 560px; justify-self: center; }
    .wide .stage-wrap { max-width: none; }
    canvas { display: block; width: 100%; }
    .stage {
      aspect-ratio: 1 / 1; height: auto; background: var(--bs-stage);
      border-radius: 14px; touch-action: pan-y pinch-zoom;
    }
    .stage:focus { outline: none; }
    .stage:focus-visible { outline: 2px solid var(--bs-glass); outline-offset: 2px; }
    .view { position: absolute; top: 6px; right: 6px; font-size: 0.78em; padding: 4px 9px; }
    .camera-presets { display: flex; align-items: center; gap: 6px; padding-top: 8px; }
    .camera-presets .lab { margin-right: 2px; }
    .camera-presets .btn { min-width: 34px; min-height: 34px; padding: 6px 9px; }
    @media (pointer: coarse) { .camera-presets .btn { min-width: 44px; min-height: 44px; } }
    .side { display: grid; gap: 10px; align-content: start; min-width: 0; }
    .panel { background: var(--bs-stage); border-radius: 12px; }

    .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.8em; color: var(--bs-muted); }
    .legend > span { display: inline-flex; align-items: center; gap: 6px; }
    .legend em { font-family: var(--bs-math-font); }
    .sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
    .sw.bar { width: 14px; height: 3px; border-radius: 2px; }
    .sw.ring { background: transparent !important; border: 2px solid; }

    .readout { font-size: 0.94em; min-height: 7.5em; overflow-x: auto; }
    .readout p, .solve-out p { margin: 0 0 0.45em; font-family: var(--bs-math-font); font-size: 1.04em; }
    .readout p.aside, .solve-out p.aside { font-family: inherit; font-size: 0.93em; }
    .readout i { font-family: var(--bs-math-font); }
    .readout b { font-weight: 600; }
    .aside, .lbl { color: var(--bs-muted); }
    .even { color: var(--bs-even); }
    .odd { color: var(--bs-odd); }
    .note {
      margin: 0.5em 0; padding: 6px 10px;
      border-left: 3px solid var(--bs-even); background: var(--bs-faint);
      border-radius: 0 8px 8px 0;
    }
    .note.odd { border-left-color: var(--bs-odd); color: inherit; }
    .mat-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 4px 0 8px; font-family: var(--bs-math-font); }
    .mat {
      display: inline-table; border-collapse: separate; border-spacing: 8px 1px;
      border-left: 1.5px solid var(--bs-ink); border-right: 1.5px solid var(--bs-ink); border-radius: 5px;
      font-variant-numeric: tabular-nums; font-size: 0.9em;
    }
    .mat td { text-align: right; white-space: nowrap; }
    .hint { margin: 0; font-size: 0.84em; color: var(--bs-muted); }

    .mode-controls { display: grid; gap: 8px; }
    .controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
    .btn {
      font: inherit; font-size: 0.88em; line-height: 1.2; padding: 7px 12px; cursor: pointer;
      color: var(--bs-ink); background: var(--bs-paper);
      border: 1px solid var(--bs-line); border-radius: 10px;
      transition: border-color 0.15s;
    }
    .btn:hover:not(:disabled) { border-color: var(--bs-muted); }
    .btn:disabled { opacity: 0.45; cursor: default; }
    .btn.primary { min-width: 5.4em; color: var(--bs-paper); background: var(--bs-ink); border-color: var(--bs-ink); }
    .btn.quiet { border-color: transparent; color: var(--bs-muted); background: transparent; }
    .btn[aria-pressed="true"] { border-color: var(--bs-ink); box-shadow: inset 0 0 0 1px var(--bs-ink); }
    .btn .m { font-family: var(--bs-math-font); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      font-family: var(--bs-math-font); font-size: 0.95em; padding: 5px 11px; cursor: pointer;
      color: var(--bs-ink); border: 1.5px solid var(--bs-arrow); border-radius: 999px;
      background: transparent;
      background: color-mix(in srgb, var(--bs-arrow) 10%, transparent);
    }
    .chip span { margin-left: 6px; font-variant-numeric: tabular-nums; color: var(--bs-muted); font-size: 0.9em; }
    .check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.88em; color: var(--bs-muted); cursor: pointer; }
    .check input { accent-color: var(--bs-even); }
    .check .m { font-family: var(--bs-math-font); }
    .slider { display: flex; align-items: center; gap: 8px; flex: 1 1 250px; min-width: 0; }
    .slider > span { font-family: var(--bs-math-font); font-style: italic; min-width: 1.4em; }
    input[type="range"] { flex: 1 1 120px; min-width: 100px; accent-color: var(--bs-even); }
    output { min-width: 4.2em; font-family: var(--bs-math-font); font-variant-numeric: tabular-nums; }
    .lab { font-size: 0.88em; color: var(--bs-muted); }

    details.sub { border-top: 1px solid var(--bs-line); padding-top: 8px; }
    details.sub > summary { cursor: pointer; font-weight: 600; font-size: 0.9em; padding: 2px 0; }
    details.sub[open] > summary { margin-bottom: 8px; }
    details.sub > .controls, details.sub > .solve-out { margin-bottom: 8px; }
    .solve-out { font-size: 0.94em; }
    .axis-fields { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; max-width: 440px; margin-bottom: 6px; }
    .axis-values { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; flex: 1 1 210px; min-width: 0; }
    .axis-values label { display: grid; gap: 3px; font-size: 0.88em; color: var(--bs-muted); }
    .axis-values input {
      box-sizing: border-box; width: 100%; min-width: 0; padding: 6px 7px;
      font: inherit; font-size: 16px; color: var(--bs-ink); background: var(--bs-paper);
      border: 1px solid var(--bs-line); border-radius: 7px;
    }
    .axis-values input[aria-invalid="true"] { border-color: var(--bs-odd); }
    .axis-error { margin: 6px 0 0; color: var(--bs-odd); font-size: 0.84em; }
    .axis-error:empty { display: none; }

    .symbol-key {
      border-top: 1px solid var(--bs-line); padding-top: 10px;
      font-size: max(14px, 0.9em); line-height: 1.5;
    }
    .symbol-key summary { cursor: pointer; font-weight: 600; padding: 3px 0; }
    .symbol-key dl { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px 24px; margin: 16px 0 2px; }
    .wide .symbol-key dl { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .symbol-key dl > div { min-width: 0; }
    .symbol-key dt { font-weight: 600; font-family: var(--bs-math-font); }
    .symbol-key dd { margin: 3px 0 0; color: var(--bs-muted); }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  `;

  const TEMPLATE = `
    <div class="bs" part="container">
      <div class="tabs" role="tablist" aria-label="Views"></div>
      <div class="body">
        <div class="stage-wrap">
          <canvas class="stage" tabindex="0" role="img" aria-describedby="bs-keys"></canvas>
          <button class="btn quiet view" type="button" title="Reset the view (double-click the diagram, or press V)">Reset view</button>
          <div class="camera-presets" role="group" aria-label="Camera presets" hidden></div>
        </div>
        <div class="side">
          <canvas class="panel" role="img"></canvas>
          <div class="legend" aria-hidden="true"></div>
          <div class="readout"></div>
        </div>
      </div>
      <p class="hint"></p>
      <div class="mode-panels"></div>
      <details class="symbol-key">
        <summary>What the symbols mean</summary>
        <dl></dl>
      </details>
      <p class="sr" id="bs-keys">Drag the diagram to turn the view. With the diagram focused, arrow keys move the highlighted handle
        (Shift for bigger steps), Enter picks the next handle, F flips a mirror normal, Alt with arrow keys turns the view,
        and V resets it.</p>
      <div class="sr" aria-live="polite"></div>
    </div>`;

  // ─── 4. Camera, projection and drawing ─────────────────────────────────────
  //
  // Orthographic camera with yaw (about +z) and pitch (elevation). The
  // camera looks from direction d toward the origin; screen axes are
  //   right = (−sin yaw, cos yaw, 0)
  //   up    = (−sin pitch cos yaw, −sin pitch sin yaw, cos pitch)
  //   d     = (cos pitch cos yaw, cos pitch sin yaw, sin pitch) = right × up
  // A world point p lands at (p·right, p·up) and its depth is p·d
  // (positive = toward the viewer). Picking inverts this: a screen point
  // inside the disc is the sphere point with depth ±√(1 − x² − y²).

  const VIEW = { yaw: 24 * DEG, pitch: 17 * DEG };
  const CAMERA_PRESETS = [
    { ...VIEW, label: "Perspective" },
    { yaw: 0, pitch: 0, label: "Front" },
    { yaw: 90 * DEG, pitch: 0, label: "Side" },
    { yaw: VIEW.yaw, pitch: 75 * DEG, label: "Above" },
  ];
  const RADIUS = 0.39; // one world unit as a fraction of the stage's short side

  // Wireframe: equator, four meridians, two latitudes. Precomputed once.
  const WIRE_N = 96;
  const WIRE = (() => {
    const out = [];
    const circle = (fn) => {
      const a = new Float64Array(3 * (WIRE_N + 1));
      for (let i = 0; i <= WIRE_N; i++) {
        const p = fn((TAU * i) / WIRE_N);
        a[3 * i] = p[0]; a[3 * i + 1] = p[1]; a[3 * i + 2] = p[2];
      }
      out.push(a);
    };
    circle((t) => [Math.cos(t), Math.sin(t), 0]);
    for (const ph of [0, 45, 90, 135]) {
      const c = Math.cos(ph * DEG), s = Math.sin(ph * DEG);
      circle((t) => [Math.sin(t) * c, Math.sin(t) * s, Math.cos(t)]);
    }
    for (const z of [0.5, -0.5]) {
      const s = Math.sqrt(1 - z * z);
      circle((t) => [s * Math.cos(t), s * Math.sin(t), z]);
    }
    return out;
  })();

  // Scratch space for curves built each frame (no per-frame allocation).
  const CURVE_MAX = 257;
  const SCRATCH = new Float64Array(3 * CURVE_MAX);

  // Fill SCRATCH with c + cos t e1 + sin t e2 for t from t0 to t1; return count.
  const fillRing = (c, e1, e2, t0, t1, n = 96) => {
    n = Math.max(2, Math.min(CURVE_MAX, n));
    for (let i = 0; i < n; i++) {
      const t = t0 + ((t1 - t0) * i) / (n - 1);
      const ct = Math.cos(t), st = Math.sin(t);
      SCRATCH[3 * i] = c[0] + ct * e1[0] + st * e2[0];
      SCRATCH[3 * i + 1] = c[1] + ct * e1[1] + st * e2[1];
      SCRATCH[3 * i + 2] = c[2] + ct * e1[2] + st * e2[2];
    }
    return n;
  };
  // The circle traced by r under rotations about n (the cone's rim), from
  // angle t0 to t1, scaled by k. Rodrigues with the angle as parameter.
  const fillOrbit = (n, r, t0, t1, k = 1, count = 96) => {
    const u = unit(n);
    const c = scale(u, dot(u, r) * k);
    const e1 = scale(sub(r, scale(u, dot(u, r))), k);
    const e2 = scale(cross(u, r), k);
    return fillRing(c, e1, e2, t0, t1, count);
  };
  // An arc of radius rho from direction a toward direction b.
  const fillArc = (a, b, rho, frac = 1, count = 40) => {
    const ua = unit(a);
    let e = sub(b, scale(ua, dot(ua, b)));
    if (norm(e) < 1e-9) e = perp(ua);
    const ang = Math.acos(clamp(dot(ua, unit(b)), -1, 1)) * frac;
    return { n: fillRing([0, 0, 0], scale(ua, rho), scale(unit(e), rho), 0, ang, count), ang, e: unit(e) };
  };

  function arrowPath(g, x0, y0, x1, y1, width, headScale = 1) {
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy);
    if (L < 2.5) return false;
    const ux = dx / L, uy = dy / L;
    const hl = Math.min(13 * headScale, 0.45 * L), hw = hl * 0.52;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1 - ux * hl * 0.7, y1 - uy * hl * 0.7);
    g.stroke();
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x1 - ux * hl - uy * hw, y1 - uy * hl + ux * hw);
    g.lineTo(x1 - ux * hl + uy * hw, y1 - uy * hl - ux * hw);
    g.closePath();
    g.fill();
    return true;
  }

  class Renderer {
    constructor() {
      this.g = null;
      this.w = 1; this.h = 1; this.cx = 0; this.cy = 0; this.R = 1;
      this.rt = new Float64Array(3); this.up = new Float64Array(3); this.d = new Float64Array(3);
      this.X = 0; this.Y = 0; this.Z = 0;
      this.items = []; this.n = 0;
      this.pool = []; this.np = 0;
      this.rgb = {};
      this.dark = false;
      this.math = MATH_FONT;
      this.ui = "system-ui, sans-serif";
      this.wireProj = WIRE.map((c) => new Float32Array(c.length));
    }

    view(w, h, yaw, pitch) {
      this.w = w; this.h = h;
      this.R = RADIUS * Math.min(w, h);
      this.cx = w / 2; this.cy = h / 2;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      this.rt[0] = -sy; this.rt[1] = cy; this.rt[2] = 0;
      this.up[0] = -sp * cy; this.up[1] = -sp * sy; this.up[2] = cp;
      this.d[0] = cp * cy; this.d[1] = cp * sy; this.d[2] = sp;
    }

    // Project a world point: sets this.X, this.Y (CSS px) and this.Z (depth).
    p(x, y, z) {
      const r = this.rt, u = this.up, d = this.d;
      this.X = this.cx + this.R * (x * r[0] + y * r[1] + z * r[2]);
      this.Y = this.cy - this.R * (x * u[0] + y * u[1] + z * u[2]);
      this.Z = x * d[0] + y * d[1] + z * d[2];
    }
    pv(v, s = 1) { this.p(v[0] * s, v[1] * s, v[2] * s); }
    depth(v) { return v[0] * this.d[0] + v[1] * this.d[1] + v[2] * this.d[2]; }
    fade(z) { return z >= 0 ? 1 : 0.4 + 0.6 * Math.max(0, 1 + z); }
    // A palette colour at opacity a, times the colour's own alpha (--bs-line
    // and --bs-faint are translucent in the default palette).
    col(key, a = 1) {
      const c = this.rgb[key] || [128, 128, 128, 1];
      return `rgba(${c[0]},${c[1]},${c[2]},${+(a * c[3]).toFixed(3)})`;
    }

    // Screen → unit vector on the sphere, on the hemisphere facing (+1) or
    // away from (−1) the viewer. Outside the disc, clamp to the limb.
    pick(x, y, hemi = 1) {
      let a = (x - this.cx) / this.R, b = (this.cy - y) / this.R;
      const q = a * a + b * b;
      let c = 0;
      if (q > 1) { const s = 1 / Math.sqrt(q); a *= s; b *= s; } else c = hemi * Math.sqrt(1 - q);
      const r = this.rt, u = this.up, d = this.d;
      return unit([
        a * r[0] + b * u[0] + c * d[0],
        a * r[1] + b * u[1] + c * d[1],
        a * r[2] + b * u[2] + c * d[2],
      ]);
    }
    insideDisc(x, y, pad = 1) {
      return Math.hypot(x - this.cx, y - this.cy) <= this.R * pad;
    }

    // ── Painter's queue: everything is pushed with a depth, then drawn back to front.
    begin(g) { this.g = g; this.n = 0; this.np = 0; }
    push(depth, fn) {
      let it = this.items[this.n];
      if (!it) it = this.items[this.n] = { d: 0, fn: null };
      it.d = depth; it.fn = fn;
      this.n++;
    }
    flush() {
      const a = this.items, n = this.n;
      for (let i = 1; i < n; i++) { // insertion sort: n is small, no allocation
        const it = a[i];
        let j = i - 1;
        while (j >= 0 && a[j].d > it.d) { a[j + 1] = a[j]; j--; }
        a[j + 1] = it;
      }
      const g = this.g;
      for (let i = 0; i < n; i++) {
        g.save();
        a[i].fn(g);
        g.restore();
        a[i].fn = null;
      }
      this.n = 0;
    }
    buf() {
      let b = this.pool[this.np];
      if (!b) b = this.pool[this.np] = new Float32Array(3 * CURVE_MAX);
      this.np++;
      return b;
    }

    // ── Primitives (each queues itself) ──

    // A polyline through `count` world points in src, split into runs by
    // hemisphere. Back runs are faded and (optionally) dashed.
    curve(src, count, key, { width = 1.5, alpha = 1, dashBack = true, dash = null, backAlpha = 0.45 } = {}) {
      if (count < 2) return;
      const b = this.buf();
      for (let i = 0; i < count; i++) {
        this.p(src[3 * i], src[3 * i + 1], src[3 * i + 2]);
        b[3 * i] = this.X; b[3 * i + 1] = this.Y; b[3 * i + 2] = this.Z;
      }
      let start = 0;
      const emit = (i0, i1) => {
        let zs = 0;
        for (let i = i0; i <= i1; i++) zs += b[3 * i + 2];
        const z = zs / (i1 - i0 + 1);
        const back = z < 0;
        const a = alpha * (back ? backAlpha : 1);
        const style = this.col(key, a);
        this.push(z, (g) => {
          g.strokeStyle = style;
          g.lineWidth = width;
          g.lineJoin = "round";
          g.lineCap = "round";
          if (dash) g.setLineDash(dash);
          else if (back && dashBack) g.setLineDash([3, 4]);
          g.beginPath();
          g.moveTo(b[3 * i0], b[3 * i0 + 1]);
          for (let i = i0 + 1; i <= i1; i++) g.lineTo(b[3 * i], b[3 * i + 1]);
          g.stroke();
        });
      };
      for (let i = 1; i < count; i++) {
        if ((b[3 * i + 2] >= 0) !== (b[3 * start + 2] >= 0)) {
          emit(start, i);
          start = i;
        }
      }
      emit(start, count - 1);
    }

    // A filled polygon through world points (e.g. a cone's base, a mirror).
    fill(src, count, key, alpha, depth) {
      if (count < 3) return;
      const b = this.buf();
      for (let i = 0; i < count; i++) {
        this.p(src[3 * i], src[3 * i + 1], src[3 * i + 2]);
        b[3 * i] = this.X; b[3 * i + 1] = this.Y;
      }
      const style = this.col(key, alpha);
      this.push(depth, (g) => {
        g.fillStyle = style;
        g.beginPath();
        g.moveTo(b[0], b[1]);
        for (let i = 1; i < count; i++) g.lineTo(b[3 * i], b[3 * i + 1]);
        g.closePath();
        g.fill();
      });
    }

    arrow(from, to, key, { width = 2.6, alpha = 1, head = 1, dash = null, zBias = 0 } = {}) {
      this.pv(from); const x0 = this.X, y0 = this.Y, z0 = this.Z;
      this.pv(to); const x1 = this.X, y1 = this.Y, z1 = this.Z;
      const z = (z0 + z1) / 2;
      const style = this.col(key, alpha * this.fade(z1));
      this.push(z + zBias, (g) => {
        g.strokeStyle = style; g.fillStyle = style; g.lineCap = "round";
        if (dash) g.setLineDash(dash);
        if (!arrowPath(g, x0, y0, x1, y1, width, head)) {
          // pointing straight at (⊙) or away from (⊗) the viewer
          g.lineWidth = 1.5;
          g.beginPath(); g.arc(x1, y1, 5, 0, TAU); g.stroke();
          if (z1 >= z0) { g.beginPath(); g.arc(x1, y1, 1.8, 0, TAU); g.fill(); }
          else { g.beginPath(); g.moveTo(x1 - 3, y1 - 3); g.lineTo(x1 + 3, y1 + 3); g.moveTo(x1 + 3, y1 - 3); g.lineTo(x1 - 3, y1 + 3); g.stroke(); }
        }
      });
    }

    line(a, b, key, { width = 1.2, alpha = 1, dash = null, dashBack = true } = {}) {
      this.pv(a); const x0 = this.X, y0 = this.Y, z0 = this.Z;
      this.pv(b); const x1 = this.X, y1 = this.Y, z1 = this.Z;
      const z = (z0 + z1) / 2;
      const style = this.col(key, alpha * this.fade(z));
      this.push(z, (g) => {
        g.strokeStyle = style; g.lineWidth = width; g.lineCap = "round";
        if (dash) g.setLineDash(dash); else if (dashBack && z < 0) g.setLineDash([3, 4]);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      });
    }

    // A line through the origin along ±n, as two halves so the back one sorts behind.
    axis(n, len, key, opts = {}) {
      this.line([0, 0, 0], scale(n, len), key, opts);
      this.line([0, 0, 0], scale(n, -len), key, { ...opts, dash: [3, 4] });
    }

    dot(v, key, rad = 3.5, { alpha = 1, ring = false, width = 1.6, zBias = 0.001 } = {}) {
      this.pv(v);
      const x = this.X, y = this.Y, z = this.Z;
      const style = this.col(key, alpha * this.fade(z));
      this.push(z + zBias, (g) => {
        g.beginPath(); g.arc(x, y, rad, 0, TAU);
        if (ring) { g.strokeStyle = style; g.lineWidth = width; g.stroke(); }
        else { g.fillStyle = style; g.fill(); }
      });
    }

    // A draggable handle: a filled dot with a halo, and a focus ring if active.
    handle(v, key, active = false) {
      this.pv(v);
      const x = this.X, y = this.Y, z = this.Z;
      const a = this.fade(z);
      const fillS = this.col(key, a), halo = this.col(key, 0.18 * a), paper = this.col("paper", a);
      const ring = this.col("glass", 1);
      this.push(z + 0.02, (g) => {
        g.fillStyle = halo;
        g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill();
        g.fillStyle = fillS; g.strokeStyle = paper; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x, y, 5.5, 0, TAU); g.fill(); g.stroke();
        if (active) {
          g.strokeStyle = ring; g.lineWidth = 2; g.setLineDash([3, 3]);
          g.beginPath(); g.arc(x, y, 14, 0, TAU); g.stroke();
        }
      });
    }

    text(v, str, key, { size = 13, alpha = 1, align = "center", italic = false, zBias = 0.03, dx = 0, dy = 0, halo = true } = {}) {
      this.pv(v);
      const x = this.X + dx, y = this.Y + dy, z = this.Z;
      const style = this.col(key, alpha * this.fade(z));
      const bg = this.col("stage", 0.8 * this.fade(z));
      const font = `${italic ? "italic " : ""}${size}px ${this.math}`;
      this.push(z + zBias, (g) => {
        g.font = font; g.textAlign = align; g.textBaseline = "middle";
        if (halo) { g.strokeStyle = bg; g.lineWidth = 3; g.lineJoin = "round"; g.strokeText(str, x, y); }
        g.fillStyle = style; g.fillText(str, x, y);
      });
    }

    // A chiral marker on an arrow: a pennant on side f and a small fin on
    // side g, near the tip p. Under a reflection the fin swaps sides
    // relative to the pennant, so handedness is visible.
    flag(p, f, gdir, key, { alpha = 1, len = 1 } = {}) {
      const P = (s, a, b) => {
        this.p(p[0] * s * len + f[0] * a + gdir[0] * b,
          p[1] * s * len + f[1] * a + gdir[1] * b,
          p[2] * s * len + f[2] * a + gdir[2] * b);
        return [this.X, this.Y];
      };
      const A = P(0.97, 0, 0), B = P(0.7, 0, 0), C = P(0.86, 0.26, 0);
      const D = P(0.7, 0, 0), E = P(0.6, 0, 0), F = P(0.68, 0, 0.13);
      this.pv(p, 0.8);
      const z = this.Z;
      // which face of the pennant faces us (its normal is ±g)?
      const front = this.depth(gdir) >= 0;
      const fa = alpha * this.fade(z);
      const fillS = this.col(key, fa * (front ? 0.85 : 0.4));
      const edge = this.col(key, fa);
      const fin = this.col("ink", fa * 0.8);
      this.push(z + 0.01, (g) => {
        g.lineJoin = "round";
        g.fillStyle = fillS; g.strokeStyle = edge; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(C[0], C[1]); g.lineTo(B[0], B[1]); g.closePath();
        g.fill(); g.stroke();
        g.fillStyle = fin; g.strokeStyle = fin;
        g.beginPath(); g.moveTo(D[0], D[1]); g.lineTo(F[0], F[1]); g.lineTo(E[0], E[1]); g.closePath();
        g.fill(); g.stroke();
      });
    }

    // A cat centered at a unit position p, with local up f and left gdir.
    // Project the transformed world frame itself: a reflection must
    // reflect the cat, and orbiting the camera must reveal its foreshortening.
    cat(p, f, gdir, key, { alpha = 1 } = {}) {
      const drawCat = customElements.get("pin-spin-cat")?.drawVectorCat;
      if (!drawCat) {
        // Keep this standalone element usable without the optional cat widget.
        this.flag(p, f, gdir, key, { alpha });
        return;
      }
      this.pv(p);
      const x = this.X, y = this.Y, z = this.Z;
      const size = Math.min(48, 0.34 * this.R);
      const right = scale(gdir, -1);
      const xx = size * dot(right, this.rt), xy = -size * dot(right, this.up);
      const yx = size * dot(f, this.rt), yy = -size * dot(f, this.up);
      const opacity = alpha * this.fade(z);
      const palette = this.dark ? { ...CAT_PALETTE, catInk: "#2a1a10" } : CAT_PALETTE;
      const collar = this.col(key);
      this.push(z + 0.01, (g) => {
        g.globalAlpha = opacity;
        g.transform(xx, xy, yx, yy, x, y);
        drawCat(g, 1 / size, palette, collar);
      });
    }

    // A rectangular patch of the infinite mirror plane through the origin.
    // Its frame is fixed in world space, and n and −n use identical corners.
    plane(n, key, alpha = 0.14, tangent = null) {
      let u = unit(n);
      const major = Math.abs(u[0]) >= Math.abs(u[1]) && Math.abs(u[0]) >= Math.abs(u[2]) ? 0 :
        Math.abs(u[1]) >= Math.abs(u[2]) ? 1 : 2;
      if (u[major] < 0) u = scale(u, -1);
      // Transport the previous tangent when a handle moves, avoiding a
      // sudden in-plane turn when the fallback reference axis changes.
      const t = tangent && sub(tangent, scale(u, dot(tangent, u)));
      const a = t && norm(t) > 1e-6 ? unit(t) : perp(u), b = cross(u, a);
      // Every corner is within 1.18 units of the origin, leaving room even
      // when a corner points toward a stage edge on a small screen.
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
        .map(([s, t]) => add(scale(a, 0.9 * s), scale(b, 0.75 * t)));
      const depths = corners.map((p) => this.depth(p));

      // Split at the camera's zero-depth plane for the painter's queue.
      // Only the outer edges are stroked, so the split adds no visible seam.
      const faceOn = depths.every((z) => Math.abs(z) < 1e-10);
      for (const side of faceOn ? [1] : [-1, 1]) {
        const polygon = faceOn ? corners.slice() : [];
        for (let i = 0; !faceOn && i < 4; i++) {
          const j = (i + 1) % 4;
          const da = side * depths[i], db = side * depths[j];
          if (da >= 0) polygon.push(corners[i]);
          if ((da >= 0) !== (db >= 0)) {
            polygon.push(add(corners[i], scale(sub(corners[j], corners[i]), da / (da - db))));
          }
        }
        let z = 0;
        polygon.forEach((p, i) => {
          SCRATCH[3 * i] = p[0]; SCRATCH[3 * i + 1] = p[1]; SCRATCH[3 * i + 2] = p[2];
          z += this.depth(p);
        });
        if (polygon.length >= 3) this.fill(SCRATCH, polygon.length, key, alpha, z / polygon.length - 0.001);
      }
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const edge = { width: 1.2, alpha: 0.8, dashBack: false };
        if ((depths[i] >= 0) !== (depths[j] >= 0)) {
          const middle = add(corners[i], scale(sub(corners[j], corners[i]), depths[i] / (depths[i] - depths[j])));
          this.line(corners[i], middle, key, edge);
          this.line(middle, corners[j], key, edge);
        } else this.line(corners[i], corners[j], key, edge);
      }
      return a;
    }

    // The shaded ball and wireframe belong only to the Bloch-state views.
    sphereBackground(g) {
      const { cx, cy, R } = this;
      const grad = g.createRadialGradient(cx - 0.38 * R, cy - 0.42 * R, 0.05 * R, cx, cy, R);
      const hi = this.dark ? "ink" : "paper";
      grad.addColorStop(0, this.col(hi, this.dark ? 0.1 : 0.95));
      grad.addColorStop(0.7, this.col(hi, this.dark ? 0.03 : 0.35));
      grad.addColorStop(1, this.col("muted", 0.14));
      g.fillStyle = grad;
      g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      g.strokeStyle = this.col("muted", 0.5); g.lineWidth = 1.2;
      g.stroke();

      // project the wireframe
      WIRE.forEach((c, k) => {
        const b = this.wireProj[k];
        for (let i = 0; i < c.length; i += 3) {
          this.p(c[i], c[i + 1], c[i + 2]);
          b[i] = this.X; b[i + 1] = this.Y; b[i + 2] = this.Z;
        }
      });
      const runs = (back) => {
        this.wireProj.forEach((b, k) => {
          g.lineWidth = k === 0 ? 1.2 : 0.8;
          g.beginPath();
          let pen = false;
          for (let i = 0; i < b.length; i += 3) {
            const on = back ? b[i + 2] < 0 : b[i + 2] >= 0;
            if (on) { if (pen) g.lineTo(b[i], b[i + 1]); else g.moveTo(b[i], b[i + 1]); pen = true; }
            else pen = false;
          }
          g.stroke();
        });
      };
      g.setLineDash([2, 4]);
      g.strokeStyle = this.col("muted", 0.22);
      runs(true);
      g.setLineDash([]);
      g.strokeStyle = this.col("muted", 0.4);
      runs(false);
    }

    // ── Background: axes, plus the sphere in the Bloch-state views. Drawn
    // offscreen and reused until the mode, camera, size or palette changes.
    background(g, sphere) {
      if (sphere) this.sphereBackground(g);
      // axes: back halves dashed
      g.lineWidth = 0.9;
      for (let k = 0; k < 3; k++) {
        const e = [0, 0, 0];
        for (const s of [1, -1]) {
          e[k] = s;
          this.p(0, 0, 0); const x0 = this.X, y0 = this.Y;
          this.pv(e); const x1 = this.X, y1 = this.Y, z1 = this.Z;
          g.strokeStyle = this.col("muted", z1 >= 0 ? 0.45 : 0.3);
          g.setLineDash(z1 >= 0 ? [] : [2, 4]);
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        }
      }
      g.setLineDash([]);
    }

    // Pole and axis labels, drawn on top of everything.
    labels(g, kets) {
      const L = kets ? KET_LABELS : AXIS_LABELS;
      g.textAlign = "center"; g.textBaseline = "middle";
      for (const [x, y, z, s, it] of L) {
        this.p(x, y, z);
        const a = this.fade(this.Z) * (this.Z >= 0 ? 0.95 : 0.6);
        g.font = `${it ? "italic " : ""}${kets ? 14 : 13}px ${this.math}`;
        g.fillStyle = this.col("ink", a);
        g.fillText(s, this.X, this.Y);
      }
    }
  }

  const KET_LABELS = [
    [0, 0, 1.17, "|0⟩"], [0, 0, -1.17, "|1⟩"],
    [1.2, 0, 0, "|+⟩"], [-1.2, 0, 0, "|−⟩"],
    [0, 1.2, 0, "|+i⟩"], [0, -1.2, 0, "|−i⟩"],
    [0.1, 0, 1.04, "z", true], [0.9, 0.13, 0, "x", true], [-0.05, 1.06, 0.06, "y", true],
  ];
  const AXIS_LABELS = [
    [1.12, 0, 0, "x", true], [0, 1.12, 0, "y", true], [0, 0, 1.12, "z", true],
  ];

  // ─── 5. Side-panel drawings ────────────────────────────────────────────────

  const uiFont = (R, size, weight = 400) => `${weight} ${size}px ${R.ui}`;
  const mathFont = (R, size, italic = false) => `${italic ? "italic " : ""}${size}px ${R.math}`;

  // A phasor dial: the complex amplitude z drawn as an arrow in the unit disc.
  function dial(g, R, x, y, rad, z, name, { key = "arrow", ghost = null, ref = null, refName = "", caption = true, radians = true } = {}) {
    g.save();
    g.strokeStyle = R.col("line", 1); g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, rad, 0, TAU); g.stroke();
    g.strokeStyle = R.col("line", 0.6);
    g.beginPath(); g.moveTo(x - rad - 4, y); g.lineTo(x + rad + 4, y); g.moveTo(x, y - rad - 4); g.lineTo(x, y + rad + 4); g.stroke();
    g.fillStyle = R.col("muted", 0.9); g.font = mathFont(R, 10);
    g.textAlign = "left"; g.textBaseline = "middle";
    g.fillText("1", x + rad + 3, y + 8);
    g.textAlign = "center";
    g.fillText("i", x + 7, y - rad - 3);

    if (ghost) {
      g.strokeStyle = R.col("muted", 0.55); g.fillStyle = R.col("muted", 0.55); g.setLineDash([3, 3]);
      arrowPath(g, x, y, x + ghost[0] * rad, y - ghost[1] * rad, 1.4, 0.7);
      g.setLineDash([]);
    }
    const m = Math.hypot(z[0], z[1]);
    if (ref !== null && m > 0.05) {
      // a reference direction and the angle from it to arg z
      g.strokeStyle = R.col("muted", 0.6); g.setLineDash([2, 3]); g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ref) * rad, y - Math.sin(ref) * rad); g.stroke();
      g.setLineDash([]);
      let d = carg(z) - ref;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 2 * DEG && refName) {
        const ar = rad * 0.38;
        g.strokeStyle = R.col(key === "odd" ? "odd" : "arrow", 0.8);
        g.beginPath(); g.arc(x, y, ar, -ref, -(ref + d), d > 0); g.stroke();
        const mid = ref + d / 2;
        g.fillStyle = R.col("ink", 0.9); g.font = mathFont(R, 12, true);
        g.fillText(refName, x + Math.cos(mid) * (ar + 10), y - Math.sin(mid) * (ar + 10));
      }
    }
    g.strokeStyle = R.col(key); g.fillStyle = R.col(key); g.lineCap = "round";
    if (!arrowPath(g, x, y, x + z[0] * rad, y - z[1] * rad, 2.4, 0.85)) {
      g.beginPath(); g.arc(x, y, 2.5, 0, TAU); g.fill();
    }
    g.fillStyle = R.col("ink"); g.font = mathFont(R, 15, true); g.textAlign = "left";
    g.fillText(name, x - rad - 2, y - rad + 2);
    if (caption) {
      g.font = mathFont(R, 11.5); g.fillStyle = R.col("muted"); g.textAlign = "center";
      const phase = m > 1e-6 ? (radians ? fmtRad(wrap360(carg(z) / DEG) * DEG, 2) : fmtDeg(wrap360(carg(z) / DEG) * DEG)) : "—";
      g.fillText(`|${name}| = ${fmt(m, 2)},  arg ${phase}`, x, y + rad + 15);
    }
    g.restore();
  }

  // The 2 : 1 picture, drawn the way <pin-spin-cat> draws it: a circle of
  // group elements upstairs over its image downstairs. The element g is a
  // filled dot, −g a ring of the same colour on the opposite side, and two
  // curves carry both to the same point below, because the map doubles
  // angles. In 3D the circles are one-parameter slices (a great circle of
  // SU(2) ≅ S³ over a circle of rotations about one axis).
  function groupPanel(g, R, x0, y0, w, h, o) {
    const key = o.key || "even";
    const top = 6;
    const half = (h - top) / 2;
    const r = Math.max(14, Math.min(w * 0.16, half * 0.34));
    const X = x0 + Math.max(w * 0.62, 150 + r);
    const Y = [y0 + top + half * 0.5, y0 + top + half * 1.5];
    const at = (row, a, out = 0) => [X + (r + out) * Math.cos(a), Y[row] - (r + out) * Math.sin(a)];
    const text = (str, x, y, font, color = R.col("muted"), align = "center") => {
      g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = "middle";
      g.fillText(str, x, y);
    };
    g.save();

    // the frame
    for (const [row, title, s1, s2] of [[0, o.upTitle, o.upSub, o.upSub2], [1, o.downTitle, o.downSub, o.downSub2]]) {
      text(title, x0 + 12, Y[row] - 8, uiFont(R, 14, 600), R.col("ink"), "left");
      if (s1) text(s1, x0 + 12, Y[row] + 10, uiFont(R, 11), R.col("muted"), "left");
      if (s2) text(s2, x0 + 12, Y[row] + 25, uiFont(R, 11), R.col("muted"), "left");
    }
    g.lineWidth = 1.25;
    g.strokeStyle = g.fillStyle = R.col("line");
    for (const y of Y) { g.beginPath(); g.arc(X, y, r, 0, TAU); g.stroke(); }
    const ya = Y[0] + r + 8, yb = Y[1] - r - 8;
    if (yb - ya >= 14) {
      g.strokeStyle = g.fillStyle = R.col("muted", 0.6);
      g.beginPath(); g.moveTo(X, ya); g.lineTo(X, yb - 4); g.stroke();
      g.beginPath(); g.moveTo(X, yb + 1); g.lineTo(X - 4, yb - 6); g.lineTo(X + 4, yb - 6); g.fill();
      text("2 : 1", X + 8, (Y[0] + Y[1]) / 2 - (o.mapName ? 7 : 0), uiFont(R, 11), R.col("muted"), "left");
      if (o.mapName) text(o.mapName, X + 8, (Y[0] + Y[1]) / 2 + 8, mathFont(R, 11, true), R.col("muted"), "left");
    }
    if (o.upInner) text(o.upInner, X, Y[0] - 6, mathFont(R, 13, true), R.col("ink"));
    if (o.downInner) text(o.downInner, X, Y[1] - 6, mathFont(R, 13, true), R.col("ink"));
    for (const [row, marks] of [[0, o.upMarks || []], [1, o.downMarks || []]]) {
      for (const [a, str] of marks) {
        const inset = 11 + 2.2 * Math.max(0, str.length - 1);
        text(str, X + (r - inset) * Math.cos(a), Y[row] - (r - 11) * Math.sin(a) + 7, mathFont(R, 11, true));
      }
    }

    // trails: a spiral just outside a circle, one loop further out per full turn
    const trail = (row, total) => {
      if (!total || Math.abs(total) < 1e-3) return;
      const n = Math.max(2, Math.ceil(Math.abs(total) / 0.04));
      g.save();
      g.strokeStyle = R.col(key, 0.55); g.lineWidth = 2; g.lineCap = "round";
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = (total * i) / n;
        const [x, y] = at(row, a, 6 + (2.4 * Math.abs(a)) / TAU);
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
      g.restore();
    };
    trail(0, o.upTrail);
    trail(1, o.downTrail);

    // g, −g and their shared image
    const link = (a, alpha) => {
      const [xa, ya2] = at(0, a);
      const [xb, yb2] = at(1, o.down);
      const my = (ya2 + yb2) / 2;
      g.save();
      g.globalAlpha = alpha; g.strokeStyle = R.col(key); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(xa, ya2); g.bezierCurveTo(xa, my, xb, my, xb, yb2); g.stroke();
      g.restore();
    };
    const dot = (row, a, ring = false, size = 5.5) => {
      const [x, y] = at(row, a);
      g.beginPath(); g.arc(x, y, size, 0, TAU);
      if (ring) { g.fillStyle = R.col("stage"); g.fill(); g.lineWidth = 2; g.strokeStyle = R.col(key); g.stroke(); }
      else { g.fillStyle = R.col(key); g.fill(); }
    };
    link(o.up, 0.45);
    link(o.up + Math.PI, 0.45);
    dot(0, o.up + Math.PI, true);
    dot(0, o.up);
    dot(1, o.down);
    if (o.upName) { const [x, y] = at(0, o.up, 16); text(o.upName, x, y, mathFont(R, 12, true), R.col(key)); }
    if (o.antiName) { const [x, y] = at(0, o.up + Math.PI, 16); text(o.antiName, x, y, mathFont(R, 12, true), R.col(key)); }
    if (o.pulse) {
      // a ring that swells and fades where g just jumped to
      const [x, y] = at(0, o.up);
      g.globalAlpha = 1 - o.pulse; g.lineWidth = 2; g.strokeStyle = R.col(key);
      g.beginPath(); g.arc(x, y, 6 + 18 * o.pulse, 0, TAU); g.stroke();
    }
    g.restore();
  }

  // ─── 6. Modes: shared scaffolding ──────────────────────────────────────────

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  class Tween {
    constructor() { this.on = false; this.from = []; this.to = []; this.t = 0; this.dur = 1; }
    go(from, to, dur) { this.from = from.slice(); this.to = to.slice(); this.t = 0; this.dur = Math.max(0.05, dur); this.on = true; }
    step(dt) {
      this.t = Math.min(1, this.t + dt / this.dur);
      const e = ease(this.t);
      if (this.t >= 1) this.on = false;
      return this.from.map((f, k) => f + (this.to[k] - f) * e);
    }
  }

  const sliderHTML = (name, label, min, max, step, value, aria) =>
    `<label class="slider"><span>${label}</span><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${aria}"><output name="${name}-out"></output></label>`;
  const btnHTML = (act, text, cls = "", aria = "") =>
    `<button type="button" class="btn ${cls}" data-act="${act}"${aria ? ` aria-label="${aria}"` : ""}>${text}</button>`;
  const checkHTML = (name, text) => `<label class="check"><input type="checkbox" name="${name}"> ${text}</label>`;
  const axisEditorHTML = () => `
    <details class="sub custom-axis">
      <summary>Custom axis</summary>
      <form class="axis-editor" aria-label="Custom axis" novalidate>
        <div class="axis-fields">
          <div class="axis-values">
            ${["x", "y", "z"].map((c) => `<label>${c}<input type="number" name="axis-${c}" data-axis-component="${c}" step="any" required aria-label="Custom axis ${c}"></label>`).join("")}
          </div>
          <button class="btn" type="submit">Apply</button>
        </div>
        <p class="hint">Direction only; normalized to unit length.</p>
        <p class="axis-error" role="status" aria-live="polite"></p>
      </form>
    </details>`;

  // Scale before measuring length so finite extremes do not overflow or underflow.
  const normalizedAxis = (v) => {
    if (v.length !== 3 || !v.every(Number.isFinite)) return null;
    const largest = Math.max(...v.map(Math.abs));
    if (largest === 0) return null;
    const scaled = v.map((x) => x / largest);
    const length = Math.hypot(...scaled);
    return scaled.map((x) => x / length);
  };

  // Parse an axis attribute: "x", "-z", or "nx,ny,nz".
  const parseAxis = (s) => {
    if (!s) return null;
    const t = s.trim().toLowerCase().replace("−", "-");
    const named = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], "-x": [-1, 0, 0], "-y": [0, -1, 0], "-z": [0, 0, -1] };
    if (named[t]) return named[t];
    const v = t.split(/[\s,]+/).map(Number);
    return normalizedAxis(v);
  };
  const numAttr = (s, fallback) => {
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : fallback;
  };

  // The "north" tangent at r, used to orient cats and flags.
  const northOf = (r) => {
    const t = sub([0, 0, 1], scale(r, r[2]));
    return norm(t) > 1e-6 ? unit(t) : [1, 0, 0];
  };

  // Angle of an even element along a chosen reference axis, for the group
  // panels: R = cos a − sin a I n̂_ref  ⇒  a = atan2(sin-part · n̂_ref, s).
  // The reference is kept continuous from frame to frame, so R → −R shows
  // up as a jump of π (to the antipode) rather than as a relabelled axis.
  function trackAngle(R, state) {
    const v = [-R[4], -R[5], -R[6]];
    if (norm(v) > 1e-9) {
      const ax = unit(v);
      state.ref = state.ref && dot(ax, state.ref) < 0 ? scale(ax, -1) : ax;
    }
    const ref = state.ref || [0, 0, 1];
    return Math.atan2(dot(v, ref), R[0]);
  }

  const BLADE = ["", "e₁", "e₂", "e₃", "e₂e₃", "e₃e₁", "e₁e₂", "e₁e₂e₃"];
  const mvHTML = (A, d = 3) => {
    const parts = [];
    A.forEach((c, k) => {
      if (Math.abs(c) < 0.5 * 10 ** -d) return;
      parts.push([c, BLADE[k]]);
    });
    if (!parts.length) return "0";
    return parts.map(([c, b], i) => (i === 0 ? fmt(c, d) : fmtSigned(c, d)) + (b ? ` ${b}` : "")).join("");
  };

  class Mode {
    constructor(api) { this.api = api; this.el = null; this.axisEditorAxis = null; }
    mount(el) {
      this.el = el;
      this.axisEditorAxis = null;
      el.innerHTML = this.controls();
      el.addEventListener("input", (e) => {
        if (e.target.matches("[data-axis-component]")) this.axisError("");
        else if (e.target.name) this.onInput(e.target);
        this.api.draw();
      });
      el.addEventListener("submit", (e) => {
        if (!e.target.matches(".axis-editor")) return;
        e.preventDefault();
        const fields = [...e.target.querySelectorAll("[data-axis-component]")];
        if (fields.some((field) => !field.value.trim() || !Number.isFinite(field.valueAsNumber))) {
          this.axisError("Enter finite numbers for x, y and z.");
          return;
        }
        const axis = normalizedAxis(fields.map((field) => field.valueAsNumber));
        if (!axis) { this.axisError("Use at least one nonzero component."); return; }
        this.applyCustomAxis(axis);
        this.api.announce("Custom axis applied and normalized.");
        this.api.draw();
      });
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act]");
        if (b && !b.disabled) { this.onAction(b.dataset.act, b); this.api.draw(); }
      });
      this.sync();
    }
    $(name) { return this.el ? this.el.querySelector(`[name="${name}"]`) : null; }
    q(sel) { return this.el ? this.el.querySelector(sel) : null; }
    axisError(message) {
      const form = this.q(".axis-editor");
      if (!form) return;
      form.querySelector(".axis-error").textContent = message;
      for (const field of form.querySelectorAll("[data-axis-component]")) {
        if (message) field.setAttribute("aria-invalid", "true");
        else field.removeAttribute("aria-invalid");
      }
    }
    syncAxisControls(axis, presets, force = false) {
      const form = this.q(".axis-editor");
      if (!form) return;
      // Animation and unrelated controls must leave an unfinished draft alone.
      if (force || !this.axisEditorAxis || axis.some((x, i) => x !== this.axisEditorAxis[i])) {
        [...form.querySelectorAll("[data-axis-component]")].forEach((field, i) => { field.value = String(Number(axis[i].toPrecision(6))); });
        this.axisEditorAxis = axis.slice();
        this.axisError("");
      }
      for (const [key, [preset]] of Object.entries(presets)) {
        const button = this.q(`[data-act="${key}"]`);
        // Match at the precision shown in the numeric fields.
        if (button) button.setAttribute("aria-pressed", String(Math.hypot(...axis.map((x, i) => x - preset[i])) < 1e-6));
      }
    }
    applyCustomAxis() {}
    setOut(name, value, text) {
      const s = this.$(name), o = this.$(`${name}-out`);
      // don't fight the user's thumb while they drag this slider
      if (s && value !== null && this.api.root.activeElement !== s) s.value = value;
      if (s && text.endsWith(" rad")) s.setAttribute("aria-valuetext", text.replace(/ rad$/, " radians"));
      if (o) o.textContent = text;
    }
    controls() { return ""; }
    sync() {}
    onInput() {}
    onAction() {}
    handles() { return []; }
    step() { return false; }
    play() {}
    pause() {}
    panelAspect() { return 0.6; }
    legend() { return []; }
    glossary() { return []; }
    hint() { return ""; }
    describe() { return ""; }
    readout() { return ""; }
    applyAttrs() {}
    get kets() { return true; }
    get sphere() { return true; }
  }

  // ─── 6a. State → arrow ─────────────────────────────────────────────────────
  //
  // The arrow r is computed from ψ with the quadratic formulas of §1d.
  // Choose the usual representative with a real, nonnegative α; the only
  // phase shown here is the relative phase φ of β.

  const STATE_PRESETS = {
    k0: [0, null, "|0⟩"], k1: [180, null, "|1⟩"],
    kp: [90, 0, "|+⟩"], km: [90, 180, "|−⟩"],
    kpi: [90, 90, "|+i⟩"], kmi: [90, 270, "|−i⟩"],
  };

  class StateMode extends Mode {
    static id = "state";
    static label = "State → arrow";
    static sub = "quadratic in ψ";

    constructor(api) {
      super(api);
      this.theta = 60 * DEG;
      this.phi = 70 * DEG;
      this.measure = false;
      this.m = sph(50 * DEG, -40 * DEG);
      this.tw = new Tween();
    }

    applyAttrs(get) {
      this.theta = clamp(numAttr(get("theta"), 60), 0, 180) * DEG;
      this.phi = numAttr(get("phi"), 70) * DEG;
      this.measure = get("measure") !== null;
      this.sync();
    }

    psi() { return ket(this.theta, this.phi); }
    r() { return bloch(this.psi()); }
    displayPhi() {
      // Keep the slider's 2π endpoint visible; preset tweens may take a
      // shortest path outside the slider's interval.
      if (this.phi >= 0 && this.phi <= TAU) return this.phi;
      return ((this.phi % TAU) + TAU) % TAU;
    }

    controls() {
      return `
        <div class="controls">
          ${sliderHTML("theta", "θ", 0, Math.PI, "any", 60 * DEG, "Polar angle theta, radians")}
          ${sliderHTML("phi", "φ", 0, TAU, "any", 70 * DEG, "Relative phase phi, radians")}
        </div>
        <div class="controls">
          ${checkHTML("measure", `Measure along <span class="m">m̂</span>`)}
        </div>
        <div class="controls" role="group" aria-label="Preset states">
          ${Object.entries(STATE_PRESETS).map(([k, p]) => btnHTML(k, `<span class="m">${p[2]}</span>`, "", `Go to ${p[2]}`)).join("")}
        </div>`;
    }

    sync() {
      for (const [name, value] of [["theta", this.theta], ["phi", this.displayPhi()]]) {
        const text = fmtRad(value);
        this.setOut(name, value, text);
        this.$(name)?.setAttribute("aria-valuetext", text.replace(" rad", " radians"));
      }
      const c = this.$("measure");
      if (c) c.checked = this.measure;
    }

    onInput(t) {
      this.tw.on = false;
      if (t.name === "theta") this.theta = clamp(Number(t.value), 0, Math.PI);
      else if (t.name === "phi") this.phi = clamp(Number(t.value), 0, TAU);
      else if (t.name === "measure") this.measure = t.checked;
      this.sync();
      if (t.name === "theta" || t.name === "phi") this.api.announceSoon(this.describe());
    }

    onAction(act) {
      const p = STATE_PRESETS[act];
      if (!p) return;
      const th = p[0] * DEG;
      let ph = p[1] === null ? this.phi : p[1] * DEG;
      ph = this.phi + Math.atan2(Math.sin(ph - this.phi), Math.cos(ph - this.phi)); // shortest way round
      if (this.api.reduced()) { this.theta = th; this.phi = ph; this.sync(); }
      else {
        const d = Math.max(Math.abs(th - this.theta), Math.abs(ph - this.phi));
        this.tw.go([this.theta, this.phi], [th, ph], 0.25 + 0.35 * d);
        this.api.draw();
      }
      this.api.announce(`State ${p[2]}.`);
    }

    pause() { this.tw.on = false; this.sync(); }

    step(dt) {
      if (!this.tw.on) return false;
      [this.theta, this.phi] = this.tw.step(dt);
      this.sync();
      return this.tw.on;
    }

    handles() {
      const hs = [{
        id: "r", label: "state arrow", key: "even",
        get: () => this.r(),
        set: (v) => {
          this.tw.on = false;
          const a = angles(v);
          this.theta = a.theta;
          if (Math.sin(a.theta) > 1e-3) this.phi = a.phi < 0 ? a.phi + TAU : a.phi;
          this.sync();
        },
      }];
      if (this.measure) hs.push({ id: "m", label: "measurement axis m̂", key: "arrow", get: () => this.m, set: (v) => { this.m = v; } });
      return hs;
    }

    drawStage(R, active) {
      const r = this.r();
      const th = this.theta;
      const phw = ((this.phi % TAU) + TAU) % TAU;
      const e = [Math.cos(this.phi), Math.sin(this.phi), 0];

      // where the arrow's shadow falls on the equator, and the azimuth φ
      const rp = [r[0], r[1], 0];
      if (Math.hypot(r[0], r[1]) > 0.03) {
        R.line(r, rp, "muted", { dash: [2, 3], alpha: 0.8 });
        R.line([0, 0, 0], rp, "muted", { dash: [2, 3], alpha: 0.7 });
        if (phw > 2 * DEG) {
          const n = fillRing([0, 0, 0], [0.26, 0, 0], [0, 0.26, 0], 0, phw, 40);
          R.curve(SCRATCH, n, "muted", { width: 1.2, dashBack: false });
          R.text(sph(Math.PI / 2, phw / 2).map((x) => x * 0.36), "φ", "ink", { italic: true, size: 13 });
        }
      }
      // θ on the sphere, and the Hilbert-space angle θ/2 beside it
      if (th > 2 * DEG) {
        let n = fillRing([0, 0, 0], [0, 0, 0.34], scale(e, 0.34), 0, th, 48);
        R.curve(SCRATCH, n, "even", { width: 1.8, dashBack: false });
        R.text(add(scale([0, 0, 1], Math.cos(th / 2) * 0.45), scale(e, Math.sin(th / 2) * 0.45)), "θ", "even", { italic: true, size: 14 });
        n = fillRing([0, 0, 0], [0, 0, 0.19], scale(e, 0.19), 0, th / 2, 32);
        R.curve(SCRATCH, n, "muted", { width: 1.4, alpha: 0.9, dashBack: false });
        if (th > 25 * DEG) R.text(add(scale([0, 0, 1], Math.cos(th / 4) * 0.13), scale(e, Math.sin(th / 4) * 0.13)), "θ/2", "muted", { size: 11 });
      }
      // the orthogonal state sits at the antipode
      R.dot(scale(r, -1), "muted", 3.2, { ring: true });
      R.text(scale(r, -1.14), "|ψ⊥⟩", "muted", { size: 12 });

      if (this.measure) {
        const m = this.m;
        R.axis(m, 1, "arrow", { dash: [5, 4], alpha: 0.7 });
        const proj = scale(m, dot(m, r));
        R.line(r, proj, "muted", { dash: [2, 3], alpha: 0.7 });
        R.dot(proj, "even", 3.4);
        const a = fillArc(m, r, 0.5, 1, 36);
        if (a.ang > 2 * DEG) {
          R.curve(SCRATCH, a.n, "arrow", { width: 1.3, dashBack: false });
          R.text(add(scale(m, Math.cos(a.ang / 2) * 0.6), scale(a.e, Math.sin(a.ang / 2) * 0.6)), "γ", "ink", { italic: true });
        }
        R.handle(m, "arrow", active === "m");
        R.text(scale(m, 1.14), "m̂", "ink", { italic: true, size: 14 });
      }

      // Use the polar tangent explicitly so the cat's frame stays continuous
      // as θ reaches either pole (where a generic north tangent is ambiguous).
      const f = [-Math.cos(th) * Math.cos(this.phi), -Math.cos(th) * Math.sin(this.phi), Math.sin(th)];
      R.arrow([0, 0, 0], r, "even", { width: 1.8 });
      R.cat(r, f, cross(r, f), "even");
      if (active === "r") R.handle(r, "even", true);
    }

    panelAspect() { return 0.56; }

    drawPanel(g, R, w, h) {
      const psi = this.psi();
      const compact = w < 340;
      const rad = Math.min(w * (compact ? 0.16 : 0.17), h * (compact ? 0.26 : 0.3));
      const y = h * (compact ? 0.39 : 0.47);
      dial(g, R, w * 0.27, y, rad, psi[0], "α", { radians: true, caption: !compact });
      dial(g, R, w * 0.73, y, rad, psi[1], "β", { ref: 0, refName: "φ", radians: true, caption: !compact });
      g.font = mathFont(R, compact ? 12 : 11.5); g.fillStyle = R.col("muted"); g.textAlign = "center";
      if (compact) {
        for (const [index, name, x] of [[0, "α", w * 0.27], [1, "β", w * 0.73]]) {
          const z = psi[index], magnitude = Math.hypot(z[0], z[1]);
          const phase = magnitude > 1e-6 ? fmtRad(((carg(z) % TAU) + TAU) % TAU, 2) : "—";
          g.fillText(`|${name}| = ${fmt(magnitude, 2)}`, x, y + rad + 15);
          g.fillText(`arg ${phase}`, x, y + rad + 30);
        }
      } else {
        g.fillText("the arrow sees only |α|, |β| and the angle φ between them", w / 2, h - 10);
      }
    }

    legend() {
      return [["even", "Bloch vector <em>r</em> and <em>θ</em>"], ["muted", "<em>θ</em>/2, the angle between state vectors", "bar"], ["arrow", "amplitudes <em>α</em>, <em>β</em>"]];
    }
    hint() {
      return "Drag the cat at the arrow tip, or use the sliders. Angles are in radians: θ runs from 0 to π, and φ from 0 to 2π. The polar angle θ sets the amplitudes' magnitudes; their relative phase φ sets the direction around the equator.";
    }
    glossary() {
      return [
        ["|ψ⟩ = α|0⟩ + β|1⟩", "the qubit state; α, β are complex amplitudes"],
        ["θ, φ", "angles in radians: polar angle from |0⟩ (north) and azimuth from +x"],
        ["r", "Bloch vector, rᵢ = ⟨ψ|σᵢ|ψ⟩"],
        [`${sig("x")}, ${sig("y")}, ${sig("z")}`, "Pauli matrices"],
        ["ᾱ", "complex conjugate of α"],
        ["|ψ⊥⟩", "the state orthogonal to |ψ⟩, at the antipode"],
        ["m̂, γ", "measurement axis and its angle to r"],
      ];
    }
    describe() {
      const r = this.r();
      return `State arrow at θ ${fmtRad(this.theta)}, φ ${fmtRad(this.displayPhi())}; r = (${r.map((x) => fmt(x, 2)).join(", ")}).`;
    }
    readout() {
      const psi = this.psi(), r = bloch(psi);
      const ab = cmul(cconj(psi[0]), psi[1]);
      let s = `
        <p>|ψ⟩ = cos(θ/2)|0⟩ + e<sup>iφ</sup> sin(θ/2)|1⟩</p>
        <p><span class="lbl">α =</span> ${fmtC(psi[0])}, <span class="lbl">β =</span> ${fmtC(psi[1])}</p>
        <p>⟨${sig("x")}⟩ = 2 Re(ᾱβ) = <span class="even">${fmt(2 * ab[0])}</span></p>
        <p>⟨${sig("y")}⟩ = 2 Im(ᾱβ) = <span class="even">${fmt(2 * ab[1])}</span></p>
        <p>⟨${sig("z")}⟩ = |α|² ${MINUS} |β|² = <span class="even">${fmt(r[2])}</span></p>
        <p class="aside">Between |0⟩ and |ψ⟩: <b>θ/2 = ${fmtRad(this.theta / 2)}</b> in state space,
          <span class="even">θ = ${fmtRad(this.theta)}</span> on the sphere. Orthogonal states (π/2) are antipodal (π).</p>`;
      if (this.measure) {
        const md = dot(this.m, r);
        const gam = Math.acos(clamp(md, -1, 1));
        s += `<p>|⟨m̂|ψ⟩|² = (1 + m̂·r)/2 = cos²(γ/2) = <span class="even">${fmt((1 + md) / 2)}</span>
          <span class="lbl">(γ = ${fmtRad(gam)})</span></p>`;
      }
      return s;
    }
  }

  // ─── 6b. Rotate: U vs R ────────────────────────────────────────────────────
  //
  // One rotor drives everything: the cat and its frame move by act(rotor),
  // the matrix is toSU2(rotor), and the phasors are toSU2(rotor) ψ₀.

  const ROT_AXES = {
    ax: [[1, 0, 0], "x̂"], ay: [[0, 1, 0], "ŷ"], az: [[0, 0, 1], "ẑ"],
    at: [sph(50 * DEG, 80 * DEG), "tilted"],
  };

  class RotateMode extends Mode {
    static id = "rotate";
    static label = "Rotate";
    static sub = "U vs R";

    get kets() { return false; }
    get sphere() { return false; }

    constructor(api) {
      super(api);
      this.n = [0, 0, 1];
      this.angle = 0;
      this.psi0 = ket(50 * DEG, -20 * DEG);
      this.r0 = bloch(this.psi0);
      this.f0 = northOf(this.r0);
      this.g0 = cross(this.r0, this.f0);
      this.playing = false;
      this.speed = 80 * DEG;
      this.tw = new Tween();
      this.opView = false;
    }

    applyAttrs(get) {
      this.n = parseAxis(get("axis")) || this.n;
      this.angle = clamp(numAttr(get("angle"), 0), 0, 720) * DEG;
      this.sync();
    }

    rotor() { return rotor(this.angle, this.n); }

    controls() {
      return `
        <div class="controls">
          ${sliderHTML("angle", "θ", 0, 2 * TAU, "any", 0, "Rotation angle theta, radians")}
        </div>
        <div class="controls">
          ${btnHTML("play", "Play", "primary")}
          ${btnHTML("p0", "0")}${btnHTML("p360", "2π")}${btnHTML("p720", "4π")}
          ${checkHTML("op", "Operator view")}
        </div>
        <div class="controls" role="group" aria-label="Rotation axis presets">
          <span class="lab">axis</span>
          ${Object.entries(ROT_AXES).map(([k, a]) => btnHTML(k, `<span class="m">${a[1]}</span>`, "", `Axis ${a[1]}`)).join("")}
        </div>
        ${axisEditorHTML()}`;
    }

    sync() {
      this.setOut("angle", this.angle, fmtRad(this.angle));
      const b = this.q('[data-act="play"]');
      if (b) b.textContent = this.playing ? "Pause" : "Play";
      const c = this.$("op");
      if (c) c.checked = this.opView;
      this.syncAxisControls(this.n, ROT_AXES);
    }

    applyCustomAxis(axis) {
      this.pause();
      this.n = axis;
      this.syncAxisControls(this.n, ROT_AXES, true);
      this.sync();
    }

    onInput(t) {
      if (t.name === "angle") {
        this.playing = false; this.tw.on = false;
        const before = this.angle;
        this.angle = Number(t.value);
        this.noteCrossing(before, this.angle);
      } else if (t.name === "op") this.opView = t.checked;
      this.sync();
    }

    goTo(target) {
      this.playing = false;
      if (this.api.reduced()) {
        const before = this.angle;
        this.angle = target;
        this.noteCrossing(before, target, true);
      } else {
        this.tw.go([this.angle], [target], 0.3 + 0.12 * Math.abs(target - this.angle));
      }
    }

    onAction(act) {
      if (act === "play") this.playing ? this.pause() : this.play();
      else if (act === "p0") this.goTo(0);
      else if (act === "p360") this.goTo(TAU);
      else if (act === "p720") this.goTo(2 * TAU);
      else if (ROT_AXES[act]) {
        this.n = ROT_AXES[act][0].slice();
        this.syncAxisControls(this.n, ROT_AXES, true);
        this.api.announce(`Axis ${ROT_AXES[act][1]}.`);
      }
      this.sync();
    }

    play() {
      this.tw.on = false;
      if (this.api.reduced()) {
        // jump between the special angles instead of animating
        const next = this.angle < TAU - 1e-6 ? TAU : this.angle < 2 * TAU - 1e-6 ? 2 * TAU : 0;
        this.goTo(next);
        return;
      }
      if (this.angle >= 2 * TAU - 1e-6) this.angle = 0;
      this.playing = true;
      this.sync();
      this.api.draw();
    }
    pause() { this.playing = false; this.tw.on = false; this.sync(); }

    noteCrossing(a, b, always = false) {
      const say = (x) => {
        if (Math.abs(x - TAU) < 1e-9) this.api.announce(`2π radians: the cat is home, but U = ${MINUS}I and the state is ${MINUS}ψ.`);
        else if (Math.abs(x - 2 * TAU) < 1e-9) this.api.announce("4π radians: home again, and now U = +I.");
        else if (x === 0) this.api.announce("0 radians: U = +I.");
      };
      if (always) { say(b); return; }
      for (const x of [TAU, 2 * TAU]) if ((a < x && b >= x) || (a > x && b <= x)) say(x);
    }

    step(dt) {
      if (this.tw.on) {
        const before = this.angle;
        [this.angle] = this.tw.step(dt);
        if (!this.tw.on) this.noteCrossing(before, this.angle, true);
        this.sync();
        return this.tw.on;
      }
      if (!this.playing) return false;
      const before = this.angle;
      this.angle = Math.min(2 * TAU, this.angle + this.speed * dt);
      // Announce the first full turn so the sign flip can be noticed.
      this.noteCrossing(before, this.angle);
      if (this.angle >= 2 * TAU) this.playing = false;
      this.sync();
      return this.playing;
    }

    handles() {
      return [{ id: "n", label: "rotation axis n̂", key: "arrow", get: () => this.n, set: (v) => {
        this.n = v;
        this.syncAxisControls(this.n, ROT_AXES, true);
      } }];
    }

    drawStage(R, active) {
      const Rt = this.rotor();
      const r = act(Rt, this.r0), f = act(Rt, this.f0), gg = act(Rt, this.g0);
      const n = this.n;

      R.arrow([0, 0, 0], n, "arrow", { width: 1.8, head: 0.8 });
      R.line([0, 0, 0], scale(n, -1), "arrow", { dash: [3, 4], alpha: 0.7 });
      R.handle(n, "arrow", active === "n");
      R.text(scale(n, 1.14), "n̂", "ink", { italic: true, size: 15, dx: 14 });

      // the cone: its rim, a faint base, and the trail swept so far
      let c = fillOrbit(n, this.r0, 0, TAU, 1, 96);
      R.fill(SCRATCH, c, "even", 0.06, R.depth(scale(n, dot(n, this.r0))) - 0.01);
      R.curve(SCRATCH, c, "even", { width: 1, alpha: 0.45 });
      if (this.angle > 1e-3) {
        c = fillOrbit(n, this.r0, 0, Math.min(this.angle, TAU), 1, Math.max(4, Math.ceil(96 * Math.min(this.angle, TAU) / TAU)));
        R.curve(SCRATCH, c, "even", { width: 2.4 });
      }

      R.cat(this.r0, this.f0, this.g0, "even", { alpha: 0.3 });
      R.cat(r, f, gg, "even");
    }

    panelAspect() { return 1.12; }

    drawPanel(g, R, w, h) {
      const gh = h * 0.62;
      const a = this.angle;
      groupPanel(g, R, 0, 0, w, gh, {
        key: "even", up: a / 2, down: a, upTrail: a / 2, downTrail: a,
        upTitle: "SU(2)", upSub: "signs kept", upSub2: "dot at s/2",
        downTitle: "SO(3)", downSub: "cat moves", downSub2: "dot at s",
        upInner: "U", downInner: "R", mapName: "Ad",
        upMarks: [[0, "I"], [Math.PI, `${MINUS}I`]], downMarks: [[0, "I"]],
        upName: "U", antiName: `${MINUS}U`,
      });
      const U = toSU2(this.rotor());
      const psi = m2apply(U, this.psi0);
      const rad = Math.min(w * 0.14, (h - gh) * 0.23);
      const y = gh + (h - gh) * 0.43;
      g.strokeStyle = R.col("line"); g.lineWidth = 1;
      g.beginPath(); g.moveTo(12, gh); g.lineTo(w - 12, gh); g.stroke();
      g.font = uiFont(R, 11); g.fillStyle = R.col("muted"); g.textAlign = "left"; g.textBaseline = "middle";
      g.fillText("amplitudes of Uψ₀ (dashed: ψ₀)", 12, gh + 12);
      for (const [i, name, x] of [[0, "α", w * 0.27], [1, "β", w * 0.73]]) {
        dial(g, R, x, y, rad, psi[i], name, { ghost: this.psi0[i], caption: false });
        const magnitude = Math.sqrt(cabs2(psi[i]));
        const phase = magnitude > 1e-6 ? fmtRad(((carg(psi[i]) % TAU) + TAU) % TAU, 2) : "—";
        g.font = mathFont(R, 11.5); g.fillStyle = R.col("muted"); g.textAlign = "center";
        g.fillText(`|${name}| = ${fmt(magnitude, 2)}`, x, y + rad + 15);
        g.fillText(`arg ${phase}`, x, y + rad + 29);
      }
    }

    legend() {
      return [["even", "the cat’s collar"], ["even", "<em>U</em>"], ["even", `<em>${MINUS}U</em>`, "ring"], ["arrow", "axis <em>n̂</em>, amplitudes of <em>U</em>ψ₀"]];
    }
    hint() {
      return "Drag the axis handle, set θ, or press Play. The cat moves and turns in space, so it can appear edge-on. " +
        "It comes home at 2π radians, but U = −I there and both phasors point backwards (dashed: the start). Only at 4π is U = +I again.";
    }
    glossary() {
      return [
        ["n̂, θ", "rotation axis and angle in radians"],
        ["U = R(θ, n̂)", "exp(−iθ/2 n̂·σ) = cos(θ/2) I − i sin(θ/2) n̂·σ, in SU(2)"],
        ["R(θ, n̂)", "the 3×3 rotation of the cat’s position and orientation, in SO(3)"],
        ["I", "identity matrix"],
        ["U†", "conjugate transpose of U"],
        ["Ad", "the 2 : 1 map SU(2) → SO(3), U ↦ R with U(v·σ)U† = (Rv)·σ"],
        ["r∥, r⊥", "parts of the cat’s unit position vector r along and across n̂"],
        ["α, β", "amplitudes of the rotated state Uψ₀"],
      ];
    }
    describe() {
      const r = act(this.rotor(), this.r0);
      return `Rotation by ${fmtRad(this.angle)} about n̂ = (${this.n.map((x) => fmt(x, 2)).join(", ")}); cat at (${r.map((x) => fmt(x, 2)).join(", ")}).`;
    }
    readout() {
      const Rt = this.rotor(), U = toSU2(Rt), M = o3(Rt);
      const near = (x) => Math.abs(this.angle - x) < 1e-9;
      let note;
      if (near(0)) note = `<div class="note">U = +I: nothing has turned yet.</div>`;
      else if (near(TAU)) note = `<div class="note">Home again: the cat’s position and orientation are back, but U = ${MINUS}I and the state is ${MINUS}ψ₀.</div>`;
      else if (near(2 * TAU)) note = `<div class="note">Home again, and now U = +I.</div>`;
      else if (near(Math.PI)) note = `<div class="note">Half turn: U = ${MINUS}i n̂·σ.</div>`;
      else if (near(3 * Math.PI)) note = `<div class="note">One and a half turns: U = +i n̂·σ, the negative of the half-turn operator.</div>`;
      else note = "";
      let s = `
        <div class="mat-row">U = cos(θ/2) I ${MINUS} i sin(θ/2) n̂·σ = ${mat2HTML(U)}</div>
        <div class="mat-row">R(θ, n̂) = ${mat3HTML(M)}</div>
        <p class="aside">n̂ = ${vecHTML(this.n, 2)}, θ = ${fmtRad(this.angle)}, θ/2 = ${fmtRad(this.angle / 2)}</p>
        ${note}`;
      if (this.opView) {
        // U†σᵢU = Σⱼ Rᵢⱼ σⱼ, row i of R
        const row = (i) => {
          const r = M[i];
          return `${fmt(r[0], 2)} ${sig("x")}${fmtSigned(r[1], 2)} ${sig("y")}${fmtSigned(r[2], 2)} ${sig("z")}`;
        };
        s += `
          <p>For n̂ = ẑ: U†${sig("x")}U = cos θ ${sig("x")} ${MINUS} sin θ ${sig("y")}</p>
          <p class="aside">Each U carries θ/2; the sandwich U†·U uses two of them, so the angle doubles.</p>
          <p>Here, U†${sig("i")}U = R<sub>ij</sub>${sig("j")}:</p>
          <p>U†${sig("x")}U = ${row(0)}</p>
          <p>U†${sig("y")}U = ${row(1)}</p>
          <p>U†${sig("z")}U = ${row(2)}</p>
          <p class="aside">Rodrigues: R r = r∥ + cos θ r⊥ + sin θ (n̂ × r)</p>`;
      }
      return s;
    }
  }

  // ─── 6c. Drive: Ω, δ and the cone ──────────────────────────────────────────
  //
  // Everything is closed form: r(t) = act(evolve(a, t), ẑ) with
  // a = (Ω cos φ_d, Ω sin φ_d, δ). Moving a slider keeps t and recomputes the
  // whole path from |0⟩, so the arrow and the plot always agree with
  //   P₁(t) = (Ω²/Ω_R²) sin²(Ω_R t / 2).

  const ZHAT = [0, 0, 1];
  const DRIVE_T_MAX = 30;

  // A "nice" tick spacing near x: 1, 2 or 5 times a power of ten.
  const niceStep = (x) => {
    const p = 10 ** Math.floor(Math.log10(x));
    const m = x / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  };

  class DriveMode extends Mode {
    static id = "drive";
    static label = "Drive";
    static sub = "Ω, δ and the cone";

    constructor(api) {
      super(api);
      this.omega = 1;
      this.delta = 0.5;
      this.phase = 0;
      this.t = 0;
      this.playing = false;
      this.rate = 1.2; // time units per second of animation
      this.solveOpen = false;
      this.target = { angle: 90 * DEG, n: sph(60 * DEG, 110 * DEG) };
      this.targetAzimuth = 110 * DEG;
      this.run = null; // { T, rate } while a solved pulse is running
      this.landed = null; // errors after it lands
      this.lastSolve = "";
      // An upright world frame keeps the starting cat readable; the drive
      // rotates this frame rigidly along with its unit position.
      this.f0 = [0, 0, 1];
      this.g0 = [0, -1, 0];
    }

    applyAttrs(get) {
      this.omega = clamp(numAttr(get("omega"), 1), 0, 3);
      this.delta = clamp(numAttr(get("delta"), 0.5), -3, 3);
      this.phase = numAttr(get("drive-phase"), 0) * DEG;
      this.sync();
    }

    a() { return driveVector(this.omega, this.delta, this.phase); }
    r() { return act(evolve(this.a(), this.t), ZHAT); }
    solution() { return solveDrive(this.target.angle, this.target.n, this.omega); }

    controls() {
      return `
        <div class="controls">
          ${sliderHTML("omega", "Ω", 0, 3, 0.01, 1, "Rabi frequency Omega")}
          ${sliderHTML("delta", "δ", -3, 3, 0.01, 0.5, "Detuning delta")}
        </div>
        <div class="controls">
          ${sliderHTML("phase", "φ<sub>d</sub>", 0, TAU, "any", 0, "Drive phase, radians")}
          ${sliderHTML("t", "t", 0, DRIVE_T_MAX, 0.01, 0, "Time")}
        </div>
        <div class="controls">
          ${btnHTML("play", "Play", "primary")}
          ${btnHTML("reset", "Reset", "", "Reset time to zero")}
          ${btnHTML("res", `<span class="m">δ = 0</span>`, "", "Set detuning to zero (resonance)")}
        </div>
        <details class="sub">
          <summary>Solve: which pulse makes R(θ, n̂)?</summary>
          <div class="controls">
            ${sliderHTML("sangle", "θ", 0, TAU, "any", Math.PI / 2, "Target rotation angle, radians")}
          </div>
          <div class="controls">
            ${sliderHTML("spolar", "θ<sub>n</sub>", 0, Math.PI, "any", Math.PI / 3, "Target axis polar angle, radians")}
            ${sliderHTML("sazim", "φ<sub>n</sub>", 0, TAU, "any", 110 * DEG, "Target axis azimuth, radians")}
          </div>
          <div class="solve-out"></div>
          <div class="controls">${btnHTML("run", "Run pulse", "primary", "Run the solved pulse for time T")}</div>
        </details>`;
    }

    mount(el) {
      super.mount(el);
      const d = this.q("details");
      // "toggle" does not bubble, so it gets its own listener
      d.addEventListener("toggle", () => {
        this.solveOpen = d.open;
        this.sync();
        this.api.draw();
      });
    }

    sync() {
      const reduced = this.api.reduced();
      this.setOut("omega", this.omega, fmt(this.omega, 2));
      this.setOut("delta", clamp(this.delta, -3, 3), fmt(this.delta, 2));
      const phase = this.phase >= 0 && this.phase <= TAU ? this.phase : ((this.phase % TAU) + TAU) % TAU;
      this.setOut("phase", phase, fmtRad(phase));
      this.setOut("t", Math.min(this.t, DRIVE_T_MAX), fmt(this.t, 2));
      const b = this.q('[data-act="play"]');
      if (b) b.textContent = reduced ? "Jump ½ period" : this.playing ? "Pause" : "Play";
      const { angle, n } = this.target;
      const a = angles(n);
      this.setOut("sangle", angle, fmtRad(angle));
      this.setOut("spolar", a.theta, fmtRad(a.theta));
      this.setOut("sazim", this.targetAzimuth, fmtRad(this.targetAzimuth));
      const html = this.solveHTML();
      const out = this.q(".solve-out");
      if (out && html !== this.lastSolve) { out.innerHTML = html; this.lastSolve = html; }
      const run = this.q('[data-act="run"]');
      if (run) run.disabled = !this.solution().ok || !!this.run;
    }

    solveHTML() {
      const sol = this.solution();
      const n = unit(this.target.n);
      if (this.target.angle === 0) return `<p>θ = 0: no pulse is needed (T = 0).</p>`;
      if (!sol.ok && sol.reason === "omega") {
        return `<p>Ω = 0: the drive is off, so â = ±ẑ whatever the target. Turn Ω up to solve.</p>`;
      }
      if (!sol.ok) {
        return `<p>n̂ is along ${n[2] > 0 ? "+" : MINUS}z, so n<sub>ρ</sub> = 0 and δ = Ω n<sub>z</sub>/n<sub>ρ</sub> would be infinite.
          With the drive on, â always leans off the z-axis. A z-rotation needs Ω = 0 and detuning alone for a time θ/|δ|,
          or the three-pulse trick.</p>`;
      }
      const big = Math.abs(sol.delta) > 3;
      let s = `
        <p>φ<sub>d</sub> = atan2(n<sub>y</sub>, n<sub>x</sub>) = ${fmtRad(((sol.phase % TAU) + TAU) % TAU)}</p>
        <p>δ = Ω n<sub>z</sub>/n<sub>ρ</sub> = ${fmt(sol.delta)}${big ? ` <span class="lbl">(beyond the slider; the run uses the exact value)</span>` : ""}</p>
        <p>T = θ n<sub>ρ</sub>/Ω = ${fmt(sol.T)}</p>
        <p class="aside">n<sub>ρ</sub> = ${fmt(sol.nr)}, so Ω T = θ n<sub>ρ</sub> = ${fmtRad(this.omega * sol.T)} and δ T = θ n<sub>z</sub> = ${fmtRad(sol.delta * sol.T)}</p>`;
      if (sol.nr < 0.15) s += `<p class="aside">Close to the pole: δ/Ω = n<sub>z</sub>/n<sub>ρ</sub> = ${fmt(n[2] / sol.nr, 1)}, and it diverges as n<sub>ρ</sub> → 0.</p>`;
      if (this.landed) {
        const L = this.landed;
        s += `<p class="aside even">Landed at t = T. ‖U(T) ${MINUS} R(θ, n̂)‖ = ${fmtSci(L.uerr)},
          |r(T) ${MINUS} R(θ, n̂)|0⟩| = ${fmtSci(L.rerr)}; ½ Tr(U(T)†R) = ${fmtC(L.tr)}: equal as matrices, global phase +1.</p>`;
      }
      return s;
    }

    changed() { this.run = null; this.landed = null; }

    onInput(t) {
      const v = Number(t.value);
      if (t.name === "omega") this.omega = v;
      else if (t.name === "delta") this.delta = v;
      else if (t.name === "phase") this.phase = v;
      else if (t.name === "t") { this.t = v; this.playing = false; }
      else if (t.name === "sangle") this.target.angle = v;
      else if (t.name === "spolar" || t.name === "sazim") {
        const a = angles(this.target.n);
        if (t.name === "sazim") this.targetAzimuth = v;
        this.target.n = sph(t.name === "spolar" ? v : a.theta, this.targetAzimuth);
      } else return;
      this.changed();
      this.sync();
      this.api.announceSoon(t.name.startsWith("s") ? this.solveSummary() : this.describe());
    }

    solveSummary() {
      const sol = this.solution();
      if (!sol.ok) return sol.reason === "omega" ? "Drive off: no solution." : "Target axis on the z-axis: no drive solution.";
      return `Target ${fmtRad(this.target.angle)}: drive phase ${fmtRad(((sol.phase % TAU) + TAU) % TAU)}, δ ${fmt(sol.delta, 2)}, T ${fmt(sol.T, 2)}.`;
    }

    onAction(act) {
      if (act === "play") { this.playing ? this.pause() : this.play(); }
      else if (act === "reset") { this.t = 0; this.playing = false; this.changed(); this.api.announce("Back to |0⟩ at t = 0."); }
      else if (act === "res") { this.delta = 0; this.changed(); this.api.announce(`On resonance: δ = 0, the axis lies in the equator and P₁ can reach 1.`); }
      else if (act === "run") this.startRun();
      this.sync();
    }

    play() {
      this.run = null;
      const W = rabi(this.omega, this.delta);
      if (this.api.reduced()) {
        // jump half a Rabi period instead of animating
        if (W > 0) this.t += Math.PI / W;
        this.landed = null;
        const r = this.r();
        this.api.announce(`t = ${fmt(this.t, 2)}, P₁ = ${fmt((1 - r[2]) / 2, 3)}.`);
        this.sync();
        return;
      }
      this.playing = true;
      this.landed = null;
      this.sync();
      this.api.draw();
    }
    pause() { this.playing = false; this.run = null; this.sync(); }

    startRun() {
      const sol = this.solution();
      if (!sol.ok) return;
      this.phase = sol.phase;
      this.delta = sol.delta;
      this.t = 0;
      this.playing = false;
      this.landed = null;
      if (this.api.reduced() || sol.T === 0) {
        this.t = sol.T;
        this.finishRun();
        return;
      }
      const dur = clamp(1 + 1.5 * this.target.angle / Math.PI, 1, 4);
      this.run = { T: sol.T, rate: sol.T / dur };
      this.api.announce(`Running the pulse: φ_d ${fmtRad(((sol.phase % TAU) + TAU) % TAU)}, δ ${fmt(sol.delta, 3)}, for T = ${fmt(sol.T, 3)}.`);
      this.api.draw();
    }

    finishRun() {
      const { angle, n } = this.target;
      const U = toSU2(evolve(this.a(), this.t)), W = su2(angle, n);
      const tr = cscale(m2trace(m2mul(m2dag(U), W)), 0.5);
      const rerr = norm(sub(this.r(), act(rotor(angle, n), ZHAT)));
      this.landed = { T: this.t, uerr: m2dist(U, W), rerr, tr };
      this.run = null;
      this.sync();
      this.api.announce(`Landed on R(θ, n̂)|0⟩. Matrix error ${this.landed.uerr.toExponential(1)}; global phase +1.`);
    }

    step(dt) {
      if (this.run) {
        this.t = Math.min(this.run.T, this.t + this.run.rate * dt);
        if (this.t >= this.run.T) { this.t = this.run.T; this.finishRun(); }
        this.sync();
        return !!this.run;
      }
      if (!this.playing) return false;
      this.t += this.rate * dt;
      this.sync();
      return true;
    }

    handles() {
      if (!this.solveOpen) return [];
      return [{
        id: "n", label: "target axis n̂", key: "arrow",
        get: () => this.target.n,
        set: (v) => {
          this.target.n = v;
          if (Math.hypot(v[0], v[1]) > 1e-10) this.targetAzimuth = ((Math.atan2(v[1], v[0]) % TAU) + TAU) % TAU;
          this.changed(); this.sync();
        },
      }];
    }

    drawStage(R, active) {
      const a = this.a(), W = norm(a);
      const ah = W > 0 ? scale(a, 1 / W) : ZHAT;
      const xp = [Math.cos(this.phase), Math.sin(this.phase), 0];

      // the in-plane drive axis x′
      R.line(scale(xp, -1), xp, "muted", { dash: [4, 4], alpha: 0.8 });
      R.text(scale(xp, 0.72), "x′", "muted", { italic: true, size: 14, dy: -11 });

      // the precession axis â and its tilt ϑ from +z
      if (W > 0) {
        R.arrow([0, 0, 0], ah, "arrow", { width: 2, head: 0.85 });
        R.line([0, 0, 0], scale(ah, -1), "arrow", { dash: [3, 4], alpha: 0.55 });
        R.text(scale(ah, 1.15), "â", "ink", { italic: true, size: 15 });
        const arc = fillArc(ZHAT, ah, 0.3, 1, 32);
        if (arc.ang > 3 * DEG) {
          R.curve(SCRATCH, arc.n, "arrow", { width: 1.2, dashBack: false, alpha: 0.8 });
          R.text(add(scale(ZHAT, Math.cos(arc.ang / 2) * 0.41), scale(arc.e, Math.sin(arc.ang / 2) * 0.41)), "ϑ", "ink", { italic: true, size: 13 });
        }

        // the cone: rim, faint base, and the part swept so far
        let c = fillOrbit(ah, ZHAT, 0, TAU, 1, 96);
        R.fill(SCRATCH, c, "even", 0.06, R.depth(scale(ah, ah[2])) - 0.01);
        R.curve(SCRATCH, c, "even", { width: 1, alpha: 0.45 });
        const sw = Math.min(W * this.t, TAU);
        if (sw > 1e-3) {
          c = fillOrbit(ah, ZHAT, 0, sw, 1, Math.max(4, Math.ceil((96 * sw) / TAU)));
          R.curve(SCRATCH, c, "even", { width: 2.4 });
        }
      }
      R.dot(ZHAT, "even", 3.4, { ring: true });

      // the homework target
      if (this.solveOpen) {
        const { angle, n } = this.target;
        const targetRotation = rotor(angle, n);
        const goal = act(targetRotation, ZHAT);
        R.line([0, 0, 0], n, "arrow", { dash: [5, 4], alpha: 0.85, width: 1.4 });
        R.handle(n, "arrow", active === "n");
        R.text(scale(n, 1.15), "n̂", "ink", { italic: true, size: 14 });
        if (angle > 1e-3) {
          const c = fillOrbit(n, ZHAT, 0, angle, 1, Math.max(4, Math.ceil((64 * angle) / Math.PI)));
          R.curve(SCRATCH, c, "muted", { width: 1.2, dash: [2, 3], alpha: 0.9 });
        }
        R.arrow([0, 0, 0], goal, "muted", { width: 1.6, dash: [4, 3], alpha: 0.7 });
        R.cat(goal, act(targetRotation, this.f0), act(targetRotation, this.g0), "muted", { alpha: 0.55 });
        R.text(scale(goal, 1.17), "target", "muted", { size: 11 });
      }

      const evolution = evolve(a, this.t), r = act(evolution, ZHAT);
      R.arrow([0, 0, 0], r, "even", { width: 2.2, head: 0.85 });
      R.cat(r, act(evolution, this.f0), act(evolution, this.g0), "even");
    }

    panelAspect() { return 0.62; }

    drawPanel(g, R, w, h) {
      const L = 34, Rm = 14, T0 = 28, B = 26;
      const pw = w - L - Rm, ph = h - T0 - B;
      const W = rabi(this.omega, this.delta);
      const win = clamp(W > 0 ? (4 * Math.PI) / W : 30, 4, 30); // about two Rabi periods
      const ts = Math.max(0, this.t - 0.65 * win), te = ts + win;
      const X = (t) => L + ((t - ts) / win) * pw;
      const Y = (p) => T0 + (1 - p) * ph;

      g.save();
      g.font = mathFont(R, 13); g.fillStyle = R.col("ink"); g.textAlign = "left"; g.textBaseline = "middle";
      g.fillText(`P₁(t) = (1 ${MINUS} r`, L, 13);
      { const w0 = g.measureText(`P₁(t) = (1 ${MINUS} r`).width; g.font = mathFont(R, 10); g.fillText("z", L + w0 + 0.5, 17); const w1 = g.measureText("z").width; g.font = mathFont(R, 13); g.fillText(")/2", L + w0 + w1 + 1.5, 13); }

      // grid
      g.strokeStyle = R.col("line", 0.8); g.lineWidth = 1;
      g.font = mathFont(R, 10.5); g.fillStyle = R.col("muted"); g.textAlign = "right";
      for (const p of [0, 0.5, 1]) {
        g.beginPath(); g.moveTo(L, Y(p)); g.lineTo(L + pw, Y(p)); g.stroke();
        g.fillText(p === 0.5 ? "0.5" : String(p), L - 6, Y(p));
      }
      const st = niceStep(win / 5);
      g.textAlign = "center"; g.textBaseline = "top";
      for (let k = Math.ceil(ts / st) * st; k <= te + 1e-9; k += st) {
        const x = X(k);
        g.beginPath(); g.moveTo(x, Y(0)); g.lineTo(x, Y(0) + 4); g.stroke();
        g.fillText(fmt(k, st < 1 ? 1 : 0), x, Y(0) + 6);
      }
      g.textAlign = "right"; g.fillText("t", L + pw, Y(0) + 6 + 11);

      // the ceiling Ω²/(Ω² + δ²)
      const m = maxP1(this.omega, this.delta);
      g.strokeStyle = R.col("ink", 0.7); g.setLineDash([5, 4]); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(L, Y(m)); g.lineTo(L + pw, Y(m)); g.stroke();
      g.setLineDash([]);
      g.font = mathFont(R, 11.5); g.fillStyle = R.col("ink"); g.textAlign = "right";
      g.textBaseline = m > 0.8 ? "top" : "bottom";
      g.fillText(`max = Ω²/(Ω² + δ²) = ${fmt(m, 3)}`, L + pw - 2, Y(m) + (m > 0.8 ? 3 : -3));

      // the pulse length T, if a solved pulse ran or is running
      const T = this.run ? this.run.T : this.landed ? this.landed.T : null;
      if (T !== null && T >= ts && T <= te) {
        g.strokeStyle = R.col("arrow", 0.8); g.setLineDash([2, 3]);
        g.beginPath(); g.moveTo(X(T), Y(1)); g.lineTo(X(T), Y(0)); g.stroke(); g.setLineDash([]);
        g.fillStyle = R.col("arrow"); g.textAlign = "left"; g.textBaseline = "top"; g.font = mathFont(R, 12, true);
        g.fillText("T", X(T) + 4, Y(1) + 3);
      }

      // P₁(t): past solid, future faint
      const N = 160;
      const curve = (t0, t1, alpha, width) => {
        if (t1 <= t0) return;
        g.strokeStyle = R.col("even", alpha); g.lineWidth = width; g.lineJoin = "round";
        g.beginPath();
        for (let i = 0; i <= N; i++) {
          const t = t0 + ((t1 - t0) * i) / N;
          const y = Y(rabiP1(this.omega, this.delta, t));
          if (i) g.lineTo(X(t), y); else g.moveTo(X(t), y);
        }
        g.stroke();
      };
      curve(this.t, te, 0.3, 1.5);
      curve(ts, this.t, 1, 2.2);
      const p1 = rabiP1(this.omega, this.delta, this.t);
      g.fillStyle = R.col("even");
      g.beginPath(); g.arc(X(this.t), Y(p1), 4, 0, TAU); g.fill();
      g.restore();
    }

    legend() {
      const l = [["even", "cat, Bloch vector, cone, <em>P</em>₁(<em>t</em>)"], ["arrow", "precession axis <em>â</em>"], ["muted", "drive axis <em>x′</em>", "bar"]];
      if (this.solveOpen) l.push(["muted", "target, and its path", "ring"]);
      return l;
    }
    hint() {
      return "Ω tilts the axis â toward x′, δ tilts it toward z. The cat and its state vector start at |0⟩ and rotate about â (dr/dt = a × r) around a cone; " +
        "with detuning the cone misses |1⟩, so the inversion is never complete. Open Solve for the inverse problem.";
    }
    glossary() {
      return [
        ["Ω", "Rabi frequency in radians per unit time: the drive strength, the in-plane part of a"],
        ["δ", "detuning in radians per unit time between drive and qubit: the z part of a"],
        ["φ<sub>d</sub>, x′", "drive phase in radians and the in-plane drive axis (cos φ<sub>d</sub>, sin φ<sub>d</sub>, 0)"],
        ["a, â", "precession vector (Ω cos φ<sub>d</sub>, Ω sin φ<sub>d</sub>, δ) and its direction; H = (ħ/2) a·σ"],
        ["Ω<sub>R</sub>", "generalised Rabi frequency |a| = √(Ω² + δ²)"],
        ["ϑ", "cone half-angle in radians: from +z to â, arctan(Ω/δ)"],
        ["P₁", "population of |1⟩, (1 − r<sub>z</sub>)/2"],
        ["θ, n̂", "target rotation angle in radians and axis (Solve)"],
        ["θ<sub>n</sub>, φ<sub>n</sub>", "polar angle and azimuth of n̂, in radians"],
        ["n<sub>ρ</sub>, n<sub>z</sub>", "in-plane and z parts of n̂, n<sub>ρ</sub> = √(n<sub>x</sub>² + n<sub>y</sub>²)"],
        ["T", "pulse duration"],
        ["‖A − B‖", "largest entry of the difference, in absolute value"],
      ];
    }
    describe() {
      const r = this.r();
      const phase = this.phase >= 0 && this.phase <= TAU ? this.phase : ((this.phase % TAU) + TAU) % TAU;
      return `Drive with Ω ${fmt(this.omega, 2)}, δ ${fmt(this.delta, 2)}, phase ${fmtRad(phase)}; t ${fmt(this.t, 2)}, P₁ ${fmt((1 - r[2]) / 2, 2)}.`;
    }
    panelLabel() {
      return `Plot of P₁ against time. Now ${fmt(rabiP1(this.omega, this.delta, this.t), 2)}; the maximum is ${fmt(maxP1(this.omega, this.delta), 2)}.`;
    }
    readout() {
      const a = this.a(), W = rabi(this.omega, this.delta), r = this.r();
      const m = maxP1(this.omega, this.delta);
      let note;
      if (W === 0) note = `<div class="note">H = 0: nothing moves.</div>`;
      else if (this.omega === 0) note = `<div class="note">Ω = 0: â = ${this.delta > 0 ? "+" : MINUS}ẑ. |0⟩ sits on the axis and only picks up a phase; the arrow never moves.</div>`;
      else if (Math.abs(this.delta) < 5e-3) note = `<div class="note">On resonance: â lies in the equator, the cone opens into a great circle, and P₁ reaches 1 at t = π/Ω (a π pulse).</div>`;
      else note = `<div class="note">Detuned: δ tilts â toward ${this.delta > 0 ? "+" : MINUS}z, the circle misses |1⟩, and P₁ never exceeds ${fmt(m, 3)}.</div>`;
      return `
        <p>H = (ħ/2)(Ω ${sig("x′")} + δ ${sig("z")}) = (ħ/2) a·σ</p>
        <p>a = (Ω cos φ<sub>d</sub>, Ω sin φ<sub>d</sub>, δ) = ${vecHTML(a, 2)}</p>
        <p>Ω<sub>R</sub> = √(Ω² + δ²) = <span class="even">${fmt(W)}</span></p>
        <p>cone half-angle ϑ = arctan(Ω/δ) = <span class="even">${fmtRad(coneAngle(this.omega, this.delta))}</span></p>
        <p>max P₁ = Ω²/(Ω² + δ²) = ${fmt(m)}</p>
        <p>t = ${fmt(this.t, 2)}: P₁ = (1 ${MINUS} r<sub>z</sub>)/2 = <span class="even">${fmt((1 - r[2]) / 2)}</span></p>
        ${note}`;
    }
  }

  // ─── 6d. Three pulses: tilt, turn, untilt ──────────────────────────────────
  //
  // Progress s runs from 0 to 3; pulse k occupies [k, k + 1]. The rotor at
  // progress s is the time-ordered product of the finished pulses and the
  // running fraction of the current one (later pulses on the left).

  const PULSE_AXES = {
    az: [[0, 0, 1], "ẑ"], ax: [[1, 0, 0], "x̂"], at: [sph(50 * DEG, 75 * DEG), "tilted"],
  };

  class PulsesMode extends Mode {
    static id = "pulses";
    static label = "Three pulses";
    static sub = "tilt, turn, untilt";

    constructor(api) {
      super(api);
      this.n = sph(50 * DEG, 75 * DEG);
      this.angle = 120 * DEG;
      this.s = 0;
      this.goal = null;
      this.playing = false;
      this.compare = false;
      this.speed = 100 * DEG; // per second, within a pulse
      this.r0 = [0, 0, 1];
      // Keep the starting cat upright in world space, then carry its whole
      // frame through the same pulse rotations as its unit position.
      this.f0 = [0, 0, 1];
      this.g0 = [0, -1, 0];
    }

    applyAttrs(get) {
      this.n = parseAxis(get("axis")) || this.n;
      this.angle = clamp(numAttr(get("angle"), 120), 0, 360) * DEG;
      this.sync();
    }

    pulses() { return threePulses(this.angle, this.n); }
    rotorAt(s) {
      const P = this.pulses();
      let Rt = ONE;
      for (let k = 0; k < 3; k++) {
        const f = clamp(s - k, 0, 1);
        if (f <= 0) break;
        Rt = mul(rotor(f * P[k].angle, P[k].axis), Rt);
      }
      return Rt;
    }
    stage() { return this.s >= 3 ? 3 : Math.floor(this.s); } // 0, 1, 2 while running; 3 at the end

    controls() {
      return `
        <div class="controls">
          ${sliderHTML("angle", "θ", 0, TAU, "any", 2 * Math.PI / 3, "Target rotation angle theta, radians")}
        </div>
        <div class="controls">
          ${btnHTML("back", "Back", "", "Back one pulse")}
          ${btnHTML("step", "Step", "primary", "Run the next pulse")}
          ${btnHTML("play", "Play")}
          ${btnHTML("reset", "Reset")}
          ${checkHTML("compare", `compare with direct <span class="m">R(θ, n̂)</span>`)}
        </div>
        <div class="controls" role="group" aria-label="Target axis presets">
          <span class="lab">axis</span>
          ${Object.entries(PULSE_AXES).map(([k, a]) => btnHTML(k, `<span class="m">${a[1]}</span>`, "", `Target axis ${a[1]}`)).join("")}
        </div>
        ${axisEditorHTML()}`;
    }

    sync() {
      this.setOut("angle", this.angle, fmtRad(this.angle));
      const b = this.q('[data-act="play"]');
      if (b) b.textContent = this.playing ? "Pause" : "Play";
      const st = this.q('[data-act="step"]'), bk = this.q('[data-act="back"]');
      if (st) st.disabled = this.s >= 3;
      if (bk) bk.disabled = this.s <= 0;
      const c = this.$("compare");
      if (c) c.checked = this.compare;
      this.syncAxisControls(this.n, PULSE_AXES);
    }

    applyCustomAxis(axis) {
      this.pause();
      this.n = axis;
      this.syncAxisControls(this.n, PULSE_AXES, true);
      this.sync();
    }

    onInput(t) {
      if (t.name === "angle") this.angle = Number(t.value);
      else if (t.name === "compare") this.compare = t.checked;
      this.sync();
      if (t.name === "angle") this.api.announceSoon(`Target angle ${fmtRad(this.angle)}.`);
    }

    say(k) {
      const msg = [
        "Start: the cat and its state vector at |0⟩.",
        "Pulse 1 done: the tilt R(−π/2, x̂′) has carried n̂ down to m̂ in the equator.",
        "Pulse 2 done: the turn by θ about the in-plane axis m̂.",
        "Pulse 3 done: the untilt carries m̂ back to n̂. The product equals R(θ, n̂) exactly, sign included.",
      ][k];
      this.api.announce(msg.replace(/-/g, MINUS));
    }

    onAction(act) {
      if (act === "step") {
        if (this.s >= 3) return;
        const next = Math.min(3, Math.floor(this.s + 1e-9) + 1);
        this.playing = false;
        if (this.api.reduced()) { this.s = next; this.goal = null; this.say(next); }
        else this.goal = next;
      } else if (act === "back") {
        this.playing = false; this.goal = null;
        this.s = Math.max(0, Math.ceil(this.s - 1e-9) - 1);
        this.say(this.s);
      } else if (act === "play") {
        this.playing ? this.pause() : this.play();
      } else if (act === "reset") {
        this.playing = false; this.goal = null; this.s = 0;
        this.say(0);
      } else if (PULSE_AXES[act]) {
        this.n = PULSE_AXES[act][0].slice();
        this.syncAxisControls(this.n, PULSE_AXES, true);
        this.api.announce(`Target axis ${PULSE_AXES[act][1]}.`);
      }
      this.sync();
    }

    play() {
      this.goal = null;
      if (this.s >= 3) this.s = 0;
      if (this.api.reduced()) {
        // jump one pulse per press instead of animating
        this.s = Math.min(3, Math.floor(this.s + 1e-9) + 1);
        this.say(this.s);
        this.sync();
        return;
      }
      this.playing = true;
      this.sync();
      this.api.draw();
    }
    pause() { this.playing = false; this.goal = null; this.sync(); }

    step(dt) {
      if (!this.playing && this.goal === null) return false;
      const goal = this.playing ? 3 : this.goal;
      const P = this.pulses();
      let s = this.s, left = dt;
      while (left > 0 && s < goal - 1e-12) {
        const k = Math.min(2, Math.floor(s + 1e-12));
        const dur = Math.max(0.3, Math.abs(P[k].angle) / this.speed);
        const end = Math.min(goal, k + 1);
        const need = (end - s) * dur;
        if (left >= need) { s = end; left -= need; this.say(end); }
        else { s += left / dur; left = 0; }
      }
      this.s = s;
      let on = true;
      if (s >= goal - 1e-12) { this.s = goal; this.playing = false; this.goal = null; on = false; }
      this.sync();
      return on;
    }

    handles() {
      return [{ id: "n", label: "target axis n̂", key: "arrow", get: () => this.n, set: (v) => {
        this.n = v;
        this.syncAxisControls(this.n, PULSE_AXES, true);
      } }];
    }

    drawStage(R, active) {
      const P = this.pulses(), F = pulseFrame(this.n), n = unit(this.n);
      const s = this.s, k = this.stage();
      const Rt = this.rotorAt(s);

      // the in-plane frame x̂′, ŷ′; x̂′ is emphasised while it is the pulse axis
      const onX = s > 0 && s < 3 && k !== 1;
      R.line(scale(F.xp, -1), F.xp, onX ? "ink" : "muted", { dash: onX ? null : [4, 4], width: onX ? 2 : 1.2, alpha: onX ? 0.8 : 0.8 });
      R.text(scale(F.xp, 1.15), "x̂′", onX ? "ink" : "muted", { italic: true, size: 14 });
      R.line([0, 0, 0], F.yp, "muted", { dash: [2, 4], alpha: 0.55 });
      R.text(scale(F.yp, 1.13), "ŷ′", "muted", { italic: true, size: 12, alpha: 0.85 });

      // target axis n̂
      R.arrow([0, 0, 0], n, "arrow", { width: 1.8, head: 0.8 });
      R.handle(n, "arrow", active === "n");
      R.text(scale(n, 1.15), "n̂", "ink", { italic: true, size: 15 });

      // m̂ in the equator, and the quarter circle that x̂′-pulses carry n̂ along
      let c = fillOrbit(F.xp, n, 0, -Math.PI / 2, 1, 32);
      R.curve(SCRATCH, c, "arrow", { width: 1, dash: [1.5, 3.5], alpha: 0.75 });
      R.dot(F.m, "arrow", 3.2, { ring: true });
      R.text(scale(F.m, 1.15), "m̂", "ink", { italic: true, size: 14 });

      // the carried axis: n̂ → m̂ in pulse 1, m̂ in pulse 2, m̂ → n̂ in pulse 3
      if (s > 0 && s < 3) {
        let ca;
        if (s <= 1) ca = act(rotor(-s * Math.PI / 2, F.xp), n);
        else if (s <= 2) ca = F.m;
        else ca = act(rotor((s - 2) * Math.PI / 2, F.xp), F.m);
        R.arrow([0, 0, 0], ca, "arrow", { width: 2.6, dash: [5, 3], head: 0.9 });
      }

      // direct rotation for comparison: its path and where it ends
      if (this.compare) {
        const Rd = rotor(this.angle, n);
        if (this.angle > 1e-3) {
          c = fillOrbit(n, this.r0, 0, this.angle, 1, Math.max(4, Math.ceil((64 * this.angle) / Math.PI)));
          R.curve(SCRATCH, c, "muted", { width: 1.3, dash: [2, 3] });
        }
        const rd = act(Rd, this.r0);
        R.arrow([0, 0, 0], rd, "muted", { width: 1.8, dash: [4, 3], alpha: 0.7 });
        R.cat(rd, act(Rd, this.f0), act(Rd, this.g0), "muted", { alpha: 0.55 });
      }

      // the state's path, pulse by pulse
      for (let j = 0; j < 3; j++) {
        const f = clamp(s - j, 0, 1);
        if (f <= 0) break;
        const rj = act(this.rotorAt(j), this.r0);
        const sweep = f * P[j].angle;
        if (Math.abs(sweep) < 1e-4) continue;
        c = fillOrbit(P[j].axis, rj, 0, sweep, 1, Math.max(4, Math.ceil((48 * Math.abs(sweep)) / Math.PI)));
        R.curve(SCRATCH, c, "even", { width: 2.2 });
      }

      if (s > 0) {
        R.arrow([0, 0, 0], this.r0, "even", { width: 1.6, alpha: 0.28 });
        R.cat(this.r0, this.f0, this.g0, "even", { alpha: 0.28 });
      }
      const r = act(Rt, this.r0);
      R.arrow([0, 0, 0], r, "even", { width: 2.2, head: 0.85 });
      R.cat(r, act(Rt, this.f0), act(Rt, this.g0), "even");
    }

    panelAspect() { return 0.66; }

    drawPanel(g, R, w, h) {
      const P = this.pulses(), F = pulseFrame(this.n);
      const s = this.s, k = this.stage();
      const L = 16, Rr = 16, gap = 10;
      const len = P.map((p) => Math.abs(p.angle));
      const total = len[0] + len[1] + len[2];
      const avail = w - L - Rr - 2 * gap;
      const bw = len.map((x) => Math.max(2, (x / total) * avail));
      const xs = [L, L + bw[0] + gap, L + bw[0] + bw[1] + 2 * gap];
      const by = h * 0.22, bh = h * 0.2;

      g.save();
      g.textBaseline = "middle";
      g.font = uiFont(R, 12); g.fillStyle = R.col("muted"); g.textAlign = "left";
      g.fillText("pulse sequence, in time order →", L, 14);

      const phases = [F.xp, F.m, F.xp].map((ax, j) => {
        let ph = Math.atan2(ax[1], ax[0]);
        if (P[j].angle < 0) ph += Math.PI; // R(−π/2, x̂′) is a +π/2 pulse at phase φ′ + π.
        return ((ph % TAU) + TAU) % TAU;
      });
      const top = ["−π/2", `θ = ${fmtRad(this.angle, 2)}`, "+π/2"];
      const axn = ["x̂′", "m̂", "x̂′"];
      for (let j = 0; j < 3; j++) {
        const x = xs[j], f = clamp(s - j, 0, 1);
        g.fillStyle = R.col("line", 0.35);
        g.fillRect(x, by, bw[j], bh);
        if (f > 0) { g.fillStyle = R.col("even", 0.85); g.fillRect(x, by, bw[j] * f, bh); }
        g.strokeStyle = R.col(k === j ? "ink" : "line"); g.lineWidth = k === j ? 1.6 : 1;
        g.strokeRect(x + 0.5, by + 0.5, bw[j] - 1, bh - 1);
        const mid = x + bw[j] / 2;
        g.textAlign = "center";
        g.font = mathFont(R, 13); g.fillStyle = R.col("ink");
        g.fillText(top[j].replace("-", MINUS), mid, by - 10);
        g.font = mathFont(R, 13, true);
        g.fillText(axn[j], mid, by + bh + 13);
        g.font = mathFont(R, 11); g.fillStyle = R.col("muted");
        g.fillText(`phase ${fmtRad(phases[j], 2)}`, mid, by + bh + 29);
      }
      // time cursor
      let tx = L;
      if (s > 0) {
        const j = Math.min(2, Math.floor(s - 1e-12));
        tx = xs[j] + bw[j] * clamp(s - j, 0, 1);
      }
      g.strokeStyle = R.col("ink"); g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(tx, by - 3); g.lineTo(tx, by + bh + 3); g.stroke();

      // the same product written as operators, right to left
      const parts = ["R(π/2, x̂′)", " · ", "R(θ, m̂)", " · ", `R(${MINUS}π/2, x̂′)`];
      const pulseOf = [2, -1, 1, -1, 0];
      g.font = mathFont(R, 13.5);
      const head = "U = ";
      const widths = parts.map((p) => g.measureText(p).width);
      const full = g.measureText(head).width + widths.reduce((a, b) => a + b, 0);
      const fy = h * 0.75;
      let x = Math.max(L, (w - full) / 2);
      g.textAlign = "left"; g.fillStyle = R.col("ink");
      g.fillText(head, x, fy); x += g.measureText(head).width;
      const order = ["3rd", "", "2nd", "", "1st"];
      parts.forEach((p, i) => {
        const on = pulseOf[i] >= 0 && pulseOf[i] === k;
        g.font = mathFont(R, 13.5);
        g.fillStyle = R.col(on ? "even" : "ink");
        g.fillText(p, x, fy);
        if (order[i]) {
          g.font = uiFont(R, 10.5); g.fillStyle = R.col(on ? "even" : "muted"); g.textAlign = "center";
          g.fillText(order[i], x + widths[i] / 2, fy + 15);
          g.textAlign = "left";
        }
        x += widths[i];
      });
      g.font = mathFont(R, 12); g.textAlign = "center";
      if (k === 3) { g.fillStyle = R.col("even"); g.fillText("= R(θ, n̂) exactly, overall sign +1", w / 2, h - 11); }
      else { g.fillStyle = R.col("muted"); g.fillText(w < 340 ? "Rightmost operator acts first." : "operators act right to left: the rightmost is applied first", w / 2, h - 11); }
      g.restore();
    }

    legend() {
      const l = [["even", "the state: cat, vector, path"], ["arrow", "target axis <em>n̂</em>; dashed: the axis being carried"]];
      if (this.compare) l.push(["muted", "direct <em>R</em>(<em>θ</em>, <em>n̂</em>), for comparison", "ring"]);
      return l;
    }
    hint() {
      return "Step through three pulses, all about axes in the xy-plane: tilt, turn about m̂, untilt. Conjugating a rotation moves its axis, " +
        "W R(θ, m̂) W† = R(θ, R<sub>W</sub> m̂), so the middle axis m̂ is carried up to n̂. Drag n̂ to change the target.";
    }
    glossary() {
      return [
        ["n̂, θ", "target axis and angle in radians: the goal is R(θ, n̂)"],
        ["x̂′", "(n<sub>x</sub>, n<sub>y</sub>, 0)/n<sub>ρ</sub>, the in-plane direction under n̂"],
        ["ŷ′", "ẑ × x̂′, in the xy-plane, π/2 ahead of x̂′"],
        ["m̂", "n<sub>ρ</sub> x̂′ + n<sub>z</sub> ŷ′: n̂ tilted down into the xy-plane"],
        ["W", "R(π/2, x̂′), which carries m̂ to n̂; R<sub>W</sub> is its 3×3 rotation"],
        ["phase", "the drive phase of each pulse in radians (direction of its axis in the xy-plane)"],
        ["U", "the SU(2) product of the pulses so far"],
        ["Tr", "trace; ½ Tr(U†R) = +1 means U = R, sign included"],
        ["‖A − B‖", "largest entry of the difference, in absolute value"],
      ];
    }
    describe() {
      const k = this.stage();
      const where = k === 3 ? "all three pulses done" : this.s === 0 ? "at the start" : `pulse ${k + 1} of 3 running`;
      const r = act(this.rotorAt(this.s), this.r0);
      return `Three pulses toward R(${fmtRad(this.angle)}, n̂), n̂ = (${this.n.map((x) => fmt(x, 2)).join(", ")}); ${where}; cat at (${r.map((x) => fmt(x, 2)).join(", ")}).`;
    }
    panelLabel() { return "Timeline of the three pulses, with the operator product written right to left."; }
    readout() {
      const F = pulseFrame(this.n), n = unit(this.n), k = this.stage();
      const U = toSU2(this.rotorAt(this.s)), Rd = su2(this.angle, n);
      const notes = [
        `Ready. In time order: R(${MINUS}π/2, x̂′) first. Written as a product, operators act right to left.`,
        `Pulse 1, tilt: R(${MINUS}π/2, x̂′) turns everything a quarter turn about x̂′. The target axis n̂ rides along (dashed) and lands on m̂ in the equator.`,
        "Pulse 2, turn: θ about the in-plane axis m̂. This is the rotation we want, about the tilted axis.",
        `Pulse 3, untilt: R(π/2, x̂′) carries m̂ back up to n̂, and the rotation with it: W R(θ, m̂) W† = R(θ, R<sub>W</sub> m̂) = R(θ, n̂).`,
      ];
      let s = `
        <p class="aside">n̂ = ${vecHTML(n, 2)}, n<sub>ρ</sub> = ${fmt(F.nr)}, n<sub>z</sub> = ${fmt(n[2])}</p>
        <p>x̂′ = (n<sub>x</sub>, n<sub>y</sub>, 0)/n<sub>ρ</sub> = ${vecHTML(F.xp, 2)}</p>
        <p>m̂ = n<sub>ρ</sub> x̂′ + n<sub>z</sub> ŷ′ = ${vecHTML(F.m, 2)}</p>
        <p>R(θ, n̂) = R(π/2, x̂′) · R(θ, m̂) · R(${MINUS}π/2, x̂′)</p>`;
      if (k === 3) {
        const tr = cscale(m2trace(m2mul(m2dag(U), Rd)), 0.5);
        s += `<div class="note">Done. U₃U₂U₁ = R(θ, n̂) as matrices: ‖U₃U₂U₁ ${MINUS} R(θ, n̂)‖ = ${fmtSci(m2dist(U, Rd))} and
          ½ Tr(U†R) = ${fmtC(tr)}, so the overall sign matches too, not just the arrow.</div>`;
      } else {
        const done = Number.isInteger(this.s) && this.goal === null && !this.playing;
        s += `<div class="note">${notes[this.s === 0 ? 0 : done ? this.s : k + 1]}</div>`;
      }
      s += `<div class="mat-row">U ${k === 3 ? "" : "so far "}= ${mat2HTML(U)}</div>`;
      if (this.compare || k === 3) s += `<div class="mat-row">R(θ, n̂) = ${mat2HTML(Rd)}</div>`;
      if (F.nr < 1e-9) {
        s += `<p class="aside">n̂ = ${n[2] > 0 ? "+" : MINUS}ẑ: x̂′ is undefined, so x̂′ = x̂ is used and m̂ = ${n[2] > 0 ? "+" : MINUS}ŷ.
          A steady drive cannot make this rotation (δ/Ω = n<sub>z</sub>/n<sub>ρ</sub> → ∞), but three xy-plane pulses can.</p>`;
      } else if (F.nr < 0.2) {
        s += `<p class="aside">Near the pole a steady drive would need δ/Ω = n<sub>z</sub>/n<sub>ρ</sub> = ${fmt(n[2] / F.nr, 1)}; the pulses don't care.</p>`;
      }
      return s;
    }
  }

  // ─── 6e. Mirrors: Pin(3) → O(3) ────────────────────────────────────────────
  //
  // The first post's mirrors, one dimension up. A mirror is now a plane, still
  // named by a unit normal whose sign it cannot see. A cat's unit position
  // and tangent frame are moved by the versor g = … w u, the product of the
  // normals in the order the mirrors act.

  const MIRROR_START = [[0, 1, 0], unit([1, 1, 0]), [0, 0, 1]];
  const MIRROR_NAMES = ["u", "w", "v"];
  const FLIP_MS = 320;
  const PULSE_MS = 650;

  const det3 = (M) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const quatHTML = (q) => `${fmt(q[0])}${fmtSigned(q[1])} i${fmtSigned(q[2])} j${fmtSigned(q[3])} k`;

  class MirrorsMode extends Mode {
    static id = "mirrors3d";
    static label = "Mirrors";
    static sub = "Pin(3) → O(3)";

    constructor(api) {
      super(api);
      this.count = this.startCount = 1;
      this.normals = MIRROR_START.map((v) => v.slice());
      this.planeTangents = [];
      this.flipAt = [-Infinity, -Infinity, -Infinity];
      this.pulseAt = -Infinity;
      this.steps = true;
      this.r0 = unit([1, -0.6, 0.3]);
      this.f0 = northOf(this.r0);
      this.g0 = cross(this.r0, this.f0);
      this.track = {};
      this.chipText = "";
    }

    get kets() { return false; }
    get sphere() { return false; }

    applyAttrs(get) {
      this.count = this.startCount = clamp(Math.round(numAttr(get("mirrors"), 1)), 1, 3);
      this.sync();
    }

    // g after the first n mirrors, and its name: "u", "w u", "v w u".
    spin(n = this.count) { return versor(this.normals.slice(0, n)); }
    word(n = this.count) { return MIRROR_NAMES.slice(0, n).reverse().join(" "); }

    controls() {
      return `
        <div class="controls">
          <div class="chips" role="group" aria-label="Mirror normals"></div>
          ${btnHTML("add", "+ Add second mirror", "primary")}
          ${btnHTML("remove", "Remove mirror", "quiet")}
          <label class="check"><input type="checkbox" name="steps" checked> Show each bounce</label>
          ${btnHTML("reset", "Reset", "quiet")}
        </div>`;
    }

    mount(el) {
      super.mount(el);
      // Arrow keys on a chip turn its mirror, as in <pin-spin-cat>.
      el.addEventListener("keydown", (e) => {
        const chip = e.target.closest(".chip");
        const dir = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
        if (!chip || !dir) return;
        e.preventDefault();
        const k = Number(chip.dataset.i);
        const a = angles(this.normals[k]);
        const step = (e.shiftKey ? 15 : 5) * DEG;
        this.normals[k] = sph(clamp(a.theta + dir[0] * step, 0, Math.PI), a.phi + dir[1] * step);
        this.sync();
        this.api.announceSoon(this.describe());
        this.api.draw();
      });
    }

    sync() {
      const chips = this.q(".chips");
      if (chips) {
        if (chips.children.length !== this.count) {
          chips.innerHTML = MIRROR_NAMES.slice(0, this.count)
            .map((nm, i) => `<button type="button" class="chip" data-act="f${i}" data-i="${i}"><i>${nm}</i><span></span></button>`)
            .join("");
          this.chipText = "";
        }
        const text = this.normals.slice(0, this.count).map((n) => {
          const a = angles(n);
          return [fmtRad(a.theta, 2), fmtRad(((a.phi % TAU) + TAU) % TAU, 2)];
        });
        const key = JSON.stringify(text);
        if (key !== this.chipText) {
          this.chipText = key;
          text.forEach(([t, p], i) => {
            const chip = chips.children[i];
            chip.lastChild.textContent = `${t.replace(" rad", "")}, ${p}`;
            chip.setAttribute("aria-label",
              `Normal ${MIRROR_NAMES[i]}: polar ${t}, azimuth ${p}. Press to flip the normal; arrow keys turn the mirror.`);
          });
        }
      }
      const add = this.q('[data-act="add"]'), rem = this.q('[data-act="remove"]');
      if (add) {
        add.disabled = this.count >= 3;
        add.textContent = this.count === 1 ? "+ Add second mirror" : this.count === 2 ? "+ Add third mirror" : "3 mirrors (maximum)";
      }
      if (rem) rem.disabled = this.count <= 1;
      const s = this.$("steps");
      if (s) s.checked = this.steps;
    }

    onInput(t) {
      if (t.name === "steps") this.steps = t.checked;
    }

    onAction(act) {
      if (act === "add" && this.count < 3) {
        this.count++;
        this.api.announce(`Added mirror ${MIRROR_NAMES[this.count - 1]}. ${this.describe()}`);
      } else if (act === "remove" && this.count > 1) {
        this.count--;
        this.api.announce(`${this.count} mirror${this.count > 1 ? "s" : ""} left. ${this.describe()}`);
      } else if (act === "reset") {
        this.count = this.startCount;
        this.normals = MIRROR_START.map((v) => v.slice());
        this.planeTangents = [];
        this.pause();
        this.steps = true;
        this.track = {};
        this.api.announce("Reset.");
      } else if (/^f\d$/.test(act)) this.flip(Number(act[1]));
      this.sync();
    }

    // Same mirror, opposite normal. The cat cannot tell; Pin(3) can.
    flip(k) {
      if (k >= this.count) return;
      this.normals[k] = scale(this.normals[k], -1);
      this.flipAt[k] = this.pulseAt = this.api.reduced() ? -Infinity : performance.now();
      this.sync();
      this.api.announce(`Flipped the normal ${MIRROR_NAMES[k]}: the mirror and the image did not move, but g became ${MINUS}g.`);
      this.api.draw();
    }

    pause() {
      this.flipAt.fill(-Infinity);
      this.pulseAt = -Infinity;
    }

    step() {
      const now = performance.now();
      return this.flipAt.some((t) => now - t < FLIP_MS) || now - this.pulseAt < PULSE_MS;
    }

    handles() {
      return this.normals.slice(0, this.count).map((_, k) => ({
        id: `n${k}`, label: `normal ${MIRROR_NAMES[k]}`, key: "arrow",
        get: () => this.normals[k],
        set: (v) => { this.normals[k] = v; this.sync(); },
        flip: () => this.flip(k),
      }));
    }

    drawStage(R, active) {
      const now = performance.now();
      const N = this.normals, c = this.count;
      const parity = (j) => (j % 2 ? "odd" : "even");

      for (let k = 0; k < c; k++) this.planeTangents[k] = R.plane(N[k], "glass", 0.16, this.planeTangents[k]);

      // the line where the first two mirrors meet, and the angle between their normals
      if (c >= 2) {
        const x = cross(N[0], N[1]);
        if (norm(x) > 1e-6) {
          const ax = unit(x);
          R.axis(ax, 1.12, "even", { dash: [6, 4], width: 1.3, alpha: c === 2 ? 0.85 : 0.35 });
          if (c === 2) R.text(scale(ax, 1.24), "u × w", "even", { size: 12, italic: true });
        }
        const arc = fillArc(N[0], N[1], 0.3, 1, 32);
        if (arc.ang > 3 * DEG) {
          R.curve(SCRATCH, arc.n, "muted", { width: 1.2, dashBack: false });
          R.text(add(scale(unit(N[0]), Math.cos(arc.ang / 2) * 0.41), scale(arc.e, Math.sin(arc.ang / 2) * 0.41)), "α", "muted", { italic: true, size: 13 });
        }
      }
      // two mirrors: the path of the rotation by 2α about u × w
      if (c === 2) {
        const { angle, axis } = rotorAngleAxis(this.spin());
        if (angle > 1e-3) {
          const n = fillOrbit(axis, this.r0, 0, angle, 1, Math.max(4, Math.ceil((64 * angle) / Math.PI)));
          R.curve(SCRATCH, n, "even", { width: 1.3, dash: [2, 3], alpha: 0.8 });
        }
      }

      // The starting cat, each bounce, and the final image. Position vectors
      // are invisible; only the mirror normals are drawn as arrows.
      R.cat(this.r0, this.f0, this.g0, "even", { alpha: 0.28 });
      if (this.steps) {
        for (let j = 1; j < c; j++) {
          const gj = this.spin(j), rj = act(gj, this.r0);
          R.cat(rj, act(gj, this.f0), act(gj, this.g0), parity(j), { alpha: 0.5 });
          R.text(scale(rj, 1.13), String(j), "muted", { size: 11 });
        }
      }
      const G = this.spin(), rG = act(G, this.r0);
      R.cat(rG, act(G, this.f0), act(G, this.g0), parity(c));

      // the normals: during a flip the arrow shrinks through zero and regrows
      // the other way, while the mirror itself never moves
      for (let k = 0; k < c; k++) {
        const t = clamp((now - this.flipAt[k]) / FLIP_MS, 0, 1);
        const s = -Math.cos(Math.PI * t);
        R.arrow([0, 0, 0], scale(N[k], s), "arrow", { width: 2.2, head: 0.85 });
        if (t >= 1) {
          R.handle(N[k], "arrow", active === `n${k}`);
          R.text(scale(N[k], 1.15), MIRROR_NAMES[k], "arrow", { italic: true, size: 16 });
        }
      }
    }

    panelAspect() { return 0.8; }

    drawPanel(g, R, w, h) {
      const G = this.spin(), odd = this.count % 2 === 1;
      // For odd g, R′ = −g e₁e₂e₃ is even and g = R′ e₁e₂e₃, so g can sit on a
      // circle too: the odd circle is the even one times e₁e₂e₃.
      const Rp = odd ? mul(G, I3).map((x) => -x) : G;
      const a = trackAngle(Rp, this.track);
      const t = (performance.now() - this.pulseAt) / PULSE_MS;
      groupPanel(g, R, 0, 0, w, h, {
        key: odd ? "odd" : "even", up: a, down: 2 * a,
        upTitle: "Pin(3)", upSub: "signs kept", upSub2: odd ? "odd half" : "even half",
        downTitle: "O(3)", downSub: "cat moves", downSub2: odd ? `det ${MINUS}1` : "det +1",
        upInner: odd ? "" : "Spin(3)", downInner: odd ? "" : "SO(3)",
        upMarks: odd ? [[0, "I"], [Math.PI, `${MINUS}I`]] : [[0, "1"], [Math.PI, `${MINUS}1`]],
        downMarks: [[0, odd ? `${MINUS}id` : "id"]],
        upName: "g", antiName: `${MINUS}g`,
        pulse: t >= 0 && t < 1 ? t : 0,
      });
    }

    legend() {
      const k = this.count % 2 ? "odd" : "even";
      return [
        ["glass", "mirror", "bar"], ["arrow", "normal"],
        ["even", "even collar"], ["odd", "odd collar"],
        [k, "<em>g</em>"], [k, `<em>${MINUS}g</em>`, "ring"],
      ];
    }
    hint() {
      return (this.count === 1 ? "One mirror reflects the cat. Add a second mirror to make a rotation. " : "") +
        "The light cat is the starting point; every cat stays one unit from the origin. Each rectangle marks a mirror plane through the origin. " +
        "Drag the tip of a normal to turn its mirror. Tap a tip (or press its chip) " +
        "to flip the normal: same mirror, same image, opposite sign in the upper diagram. Two mirrors, u then w, make the " +
        "rotation by twice their angle about the line u × w where they meet. Cats turn with the transformation and can appear edge-on.";
    }
    glossary() {
      return [
        ["O(3)", "Rotations and reflections in 3 dimensions"],
        ["SO(3)", "Just the rotations, which are composed of an even number of reflections"],
        ["Pin(3)", "The combined mirror steps, keeping track of the signs of the normals"],
        ["Spin(3)", "The even / rotation part of Pin(3); the same group as SU(2)"],
        ["u, w, v", "unit normals of the mirrors, applied in that order"],
        [`${MINUS}u x u`, "the reflection of x in the plane with normal u"],
        ["w u", "the geometric product w·u + w∧u: a rotor, the rotation by 2α about u × w"],
        ["α", "the angle between the normals u and w"],
        ["e₁e₂e₃", "the unit trivector, which squares to −1 and acts on vectors as x ↦ −x"],
        ["ĝ, g̃", "g with every vector negated, and g written backwards; g acts as x ↦ ĝ x g̃"],
        ["R′", "for odd g, the rotor −g e₁e₂e₃; then g acts as x ↦ −R′ x R̃′"],
        ["i, j, k", "quaternion units: i ↔ −e₂e₃, j ↔ −e₃e₁, k ↔ −e₁e₂"],
        [`toSU2`, `e<sub>i</sub> ↦ σ<sub>i</sub>: the same element as a 2×2 matrix, w u ↦ (w·σ)(u·σ)`],
      ];
    }
    describe() {
      const c = this.count;
      if (c === 2) {
        const al = Math.acos(clamp(dot(this.normals[0], this.normals[1]), -1, 1));
        return `Two mirrors at ${fmtRad(al)} between their normals: a rotation by ${fmtRad(2 * al)} about u × w.`;
      }
      return c === 1 ? "One mirror: a reflection, determinant −1." : "Three mirrors: odd again, a rotation followed by x ↦ −x, determinant −1.";
    }
    panelLabel() {
      return `The Pin(3) element g and −g upstairs, both landing on the same O(3) element downstairs. ${this.count % 2 ? "Odd" : "Even"}.`;
    }
    readout() {
      const G = this.spin(), c = this.count, N = this.normals;
      const M = o3(G);
      let s = `<p>g = ${this.word()} = ${mvHTML(G)}</p>`;
      if (c === 1) {
        s += `<p class="aside">One mirror: x ↦ ${MINUS}u x u = x ${MINUS} 2(u·x)u, the reflection in the plane ⟂ u.
          An odd element: in Pin(3) but not in Spin(3). Its action on space reverses handedness.</p>`;
      } else if (c === 2) {
        const al = Math.acos(clamp(dot(N[0], N[1]), -1, 1));
        const x = cross(N[0], N[1]);
        s += `
          <p>∠(u, w) = α = ${fmtRad(al)}, so the rotation is by <b>2α = ${fmtRad(2 * al)}</b></p>
          <p>about u × w = ${norm(x) > 1e-9 ? vecHTML(unit(x), 2) : "(the mirrors coincide)"}</p>
          <p>w u = w·u + w∧u = cos α ${MINUS} sin α I n̂</p>
          <p>quaternion: ${quatHTML(quat(G))}</p>
          <div class="mat-row">(w·σ)(u·σ) = ${mat2HTML(toSU2(G))}</div>
          <p class="aside">Two reflections (an even number) make a <b>rotation</b>: the cat’s position and orientation turn together. This g lies in Spin(3) = SU(2).</p>`;
      } else {
        const Rp = mul(G, I3).map((x) => -x);
        const { angle, axis } = rotorAngleAxis(Rp);
        s += `
          <p>R′ = ${MINUS}g e₁e₂e₃ = ${mvHTML(Rp)}</p>
          <p class="aside">Three reflections (odd again) make x ↦ ${MINUS}R′ x R̃′: the rotation by ${fmtRad(angle)} about ${vecHTML(axis, 2)},
            then x ↦ ${MINUS}x. A rotoreflection, with determinant ${MINUS}1.</p>`;
      }
      s += `<div class="mat-row">x ↦ ${c % 2 ? "ĝ x g̃" : "g x g̃"} = ${mat3HTML(M, 2)} <span class="lbl">det = ${fmt(det3(M), 0).replace(/^(\d)/, "+$1")}</span></div>`;
      s += `<p class="aside">${MINUS}g = ${mvHTML(G.map((x) => -x))} draws exactly the same cat. Flip any normal to swap the two.</p>`;
      return s;
    }
  }

  // ─── 7. The element ────────────────────────────────────────────────────────

  const MODES = [StateMode, RotateMode, DriveMode, PulsesMode, MirrorsMode];
  const MODE_BY_ID = Object.fromEntries(MODES.map((M) => [M.id, M]));
  const MODE_ATTRS = ["theta", "phi", "measure", "axis", "angle", "omega", "delta", "drive-phase", "mirrors"];
  const KEYS_ROW = [
    "Keys",
    "With the diagram focused: arrow keys move the highlighted handle (Shift: π/12 rad steps), Enter picks the next handle, " +
      "F flips a mirror normal, Alt + arrow keys turn the view, V resets it.",
  ];
  const WIDE = 720; // px of container width for the side-by-side layout

  // Any CSS colour → [r, g, b, a], by painting one pixel. Works for every
  // colour syntax the browser knows (hex, rgb(), hsl(), oklch(), color-mix()).
  let probe = null;
  function parseColor(css, fallback) {
    if (!probe) {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      probe = c.getContext("2d", { willReadFrequently: true });
    }
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = fallback;
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  }
  const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

  class BlochSphere extends HTMLElement {
    static observedAttributes = ["theme", "modes", "mode", "autoplay", ...MODE_ATTRS];
    static algebra = algebra;
    static selfTest(options) { return selfTest(options); }

    #el = {}; // handles into the shadow DOM
    #colors = null; // palette, read from the --bs-* properties
    #api = null; // what the modes may call
    #modes = []; // mode instances, in tab order
    #mode = null;
    #ready = false;

    #R = new Renderer();
    #bg = null; // offscreen canvas: axes, plus the sphere in Bloch-state views
    #bgDirty = true;
    #yaw = VIEW.yaw;
    #pitch = VIEW.pitch;
    #viewTween = new Tween();

    #drag = null;
    #active = null; // id of the highlighted handle
    #keyboard = false; // show the handle highlight only for keyboard users
    #kbPhi = 0;
    #autoplay = false;
    #touched = false; // once the reader takes over, autoplay stands down

    #dpr = 1;
    #S = 0; // stage size, CSS px
    #W = 0; // side panel size
    #H = 0;
    #raf = 0;
    #last = 0;
    #readAt = 0;
    #visible = false;
    #strings = {};
    #observers = [];
    #soon = 0;

    // ── lifecycle ──

    connectedCallback() {
      if (!this.shadowRoot) this.#build();
      if (!this.#ready) this.#configure();
      const resize = new ResizeObserver(() => this.#resize());
      const view = new IntersectionObserver(([entry]) => {
        this.#visible = entry.isIntersecting;
        if (this.#visible) {
          this.#maybeAutoplay();
          this.#invalidate();
        } else this.pause();
      });
      // Blogs with a dark-mode switch usually flip a class on <html>: re-read colours then.
      const page = new MutationObserver(() => this.#restyle());
      const scheme = matchMedia("(prefers-color-scheme: dark)");
      const calm = matchMedia("(prefers-reduced-motion: reduce)");
      const onScheme = () => this.#restyle();
      const onCalm = () => {
        if (calm.matches) this.pause();
        this.#mode?.sync();
        this.#invalidate();
      };
      const onVisibility = () => {
        if (document.hidden) this.pause();
        else this.#invalidate();
      };
      resize.observe(this);
      view.observe(this);
      page.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme"],
      });
      scheme.addEventListener("change", onScheme);
      calm.addEventListener("change", onCalm);
      document.addEventListener("visibilitychange", onVisibility);
      this.#observers = [
        resize,
        view,
        page,
        { disconnect: () => scheme.removeEventListener("change", onScheme) },
        { disconnect: () => calm.removeEventListener("change", onCalm) },
        { disconnect: () => document.removeEventListener("visibilitychange", onVisibility) },
      ];
      this.#resize();
    }

    disconnectedCallback() {
      for (const o of this.#observers) o.disconnect();
      this.#observers = [];
      this.#visible = false;
      this.pause();
    }

    // Hosts may pause a demo when an enclosing disclosure closes.
    pause() {
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
      this.#last = 0;
      clearTimeout(this.#soon);
      this.#mode?.pause();
      this.#viewTween.on = false;
      this.#drag = null;
      if (this.#el.stage) this.#el.stage.style.cursor = "";
      this.#invalidate();
    }

    attributeChangedCallback(name, old, value) {
      if (!this.#ready || old === value) return;
      if (name === "theme") this.#restyle();
      else if (name === "modes") this.#configure();
      else if (name === "mode") this.#setMode(value);
      else if (name === "autoplay") { this.#autoplay = value !== null; this.#maybeAutoplay(); }
      else {
        const get = (n) => this.getAttribute(n);
        for (const m of this.#modes) m.applyAttrs(get);
        this.#invalidate();
      }
    }

    #build() {
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${STYLE}</style>${TEMPLATE}`;
      const $ = (selector) => root.querySelector(selector);
      this.#el = {
        root: $(".bs"),
        tabs: $(".tabs"),
        wrap: $(".stage-wrap"),
        stage: $(".stage"),
        view: $(".view"),
        cameras: $(".camera-presets"),
        side: $(".side"),
        panel: $(".panel"),
        legend: $(".legend"),
        readout: $(".readout"),
        hint: $(".hint"),
        panels: $(".mode-panels"),
        symbols: $(".symbol-key dl"),
        live: $('[aria-live]'),
      };
      this.#bg = document.createElement("canvas");
      this.#el.cameras.innerHTML = `<span class="lab">View</span>` + CAMERA_PRESETS.map((view, i) =>
        `<button type="button" class="btn" data-camera="${i}" aria-label="Camera preset ${i + 1}: ${view.label}" title="${view.label}" aria-pressed="false">${i + 1}</button>`
      ).join("");
      this.#api = {
        draw: () => this.#invalidate(),
        announce: (t) => this.#announce(t),
        announceSoon: (t) => this.#announceSoon(t),
        reduced: () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        root,
      };
      this.#wire(root);
    }

    #wire(root) {
      const { tabs, stage, view, panels, cameras } = this.#el;

      cameras.addEventListener("click", (e) => {
        const button = e.target.closest("[data-camera]");
        if (!button) return;
        const i = Number(button.dataset.camera);
        this.#touched = true;
        this.#moveView(CAMERA_PRESETS[i], `Camera preset ${i + 1}: ${CAMERA_PRESETS[i].label}.`);
      });

      tabs.addEventListener("click", (e) => {
        const tab = e.target.closest("[data-mode]");
        if (tab) this.#setMode(tab.dataset.mode);
      });
      tabs.addEventListener("keydown", (e) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        const ids = this.#modes.map((m) => m.constructor.id);
        const next = ids[mod(ids.indexOf(this.#mode.constructor.id) + step, ids.length)];
        this.#setMode(next);
        tabs.querySelector(`[data-mode="${next}"]`)?.focus();
      });

      // any use of the controls counts as the reader taking over
      panels.addEventListener("input", () => { this.#touched = true; });
      panels.addEventListener("click", () => { this.#touched = true; });

      stage.addEventListener("pointerdown", (e) => this.#onDown(e));
      stage.addEventListener("pointermove", (e) => this.#onMove(e));
      stage.addEventListener("pointerup", (e) => this.#onUp(e));
      stage.addEventListener("pointercancel", () => this.#endDrag());
      stage.addEventListener("dblclick", () => this.#resetView());
      stage.addEventListener("keydown", (e) => this.#onKey(e));
      stage.addEventListener("blur", () => { this.#keyboard = false; this.#invalidate(); });
      view.addEventListener("click", () => this.#resetView());
      // On touch screens, claim gestures in the mode's diagram or on a handle.
      // Leave a margin available for scrolling the page past the widget.
      stage.addEventListener(
        "touchstart",
        (e) => {
          const t = e.touches[0];
          if (!t || e.touches.length > 1) return;
          const [x, y] = this.#local(t);
          if (this.#hit(x, y, true) || this.#insideOrbit(x, y)) e.preventDefault();
        },
        { passive: false },
      );
    }

    #configure() {
      const listed = (this.getAttribute("modes") || "").split(",").map((m) => m.trim());
      let ids = [...new Set(listed.filter((m) => m in MODE_BY_ID))];
      if (!ids.length) ids = MODES.map((M) => M.id);
      for (const m of this.#modes) m.pause();
      this.#el.panels.innerHTML = "";
      const get = (n) => this.getAttribute(n);
      this.#modes = ids.map((id) => {
        const m = new MODE_BY_ID[id](this.#api);
        const box = document.createElement("div");
        box.className = "mode-controls";
        box.dataset.for = id;
        box.hidden = true;
        this.#el.panels.append(box);
        m.mount(box);
        m.box = box;
        m.applyAttrs(get);
        return m;
      });
      this.#el.tabs.hidden = ids.length < 2;
      this.#el.tabs.innerHTML = this.#modes
        .map(({ constructor: M }) =>
          `<button class="tab" role="tab" data-mode="${M.id}" aria-selected="false">${M.label}<small>${M.sub}</small></button>`)
        .join("");
      this.#autoplay = this.hasAttribute("autoplay");
      this.#touched = false;
      this.#mode = null;
      this.#ready = true;
      const start = this.getAttribute("mode");
      this.#setMode(ids.includes(start) ? start : ids[0], true);
    }

    // ── what the reader can do ──

    #setMode(id, quiet = false) {
      const m = this.#modes.find((x) => x.constructor.id === id);
      if (!m || m === this.#mode) return;
      this.#mode?.pause();
      this.#mode = m;
      this.#bgDirty = true;
      this.#drag = null;
      this.#el.cameras.hidden = id !== "mirrors3d";
      for (const tab of this.#el.tabs.children) tab.setAttribute("aria-selected", String(tab.dataset.mode === id));
      for (const box of this.#el.panels.children) box.hidden = box.dataset.for !== id;
      const hs = m.handles();
      this.#active = hs.length ? hs[0].id : null;
      this.#strings = {};
      this.#H = 0; // the side panel's aspect differs between modes
      this.#resize();
      this.#maybeAutoplay();
      if (!quiet) this.#announce(`${m.constructor.label} view.`);
      this.#invalidate();
    }

    #maybeAutoplay() {
      const m = this.#mode;
      if (!m || !this.#autoplay || this.#touched || !this.#visible || document.hidden || this.#api.reduced() || m.playing) return;
      m.play();
    }

    #resetView() {
      this.#moveView(VIEW, "View reset.");
    }

    #moveView(view, announcement) {
      const turn = Math.atan2(Math.sin(view.yaw - this.#yaw), Math.cos(view.yaw - this.#yaw));
      const to = [this.#yaw + turn, view.pitch];
      this.#viewTween.on = false;
      this.#drag = null;
      if (this.#api.reduced()) {
        [this.#yaw, this.#pitch] = to;
        this.#bgDirty = true;
      } else this.#viewTween.go([this.#yaw, this.#pitch], to, 0.45);
      this.#announce(announcement);
      this.#invalidate();
    }

    #cameraSelection() {
      if (this.#el.cameras.hidden) return;
      for (const button of this.#el.cameras.querySelectorAll("[data-camera]")) {
        const view = CAMERA_PRESETS[Number(button.dataset.camera)];
        const yawError = Math.atan2(Math.sin(view.yaw - this.#yaw), Math.cos(view.yaw - this.#yaw));
        const selected = String(Math.abs(yawError) < 1e-6 && Math.abs(view.pitch - this.#pitch) < 1e-6);
        if (button.getAttribute("aria-pressed") !== selected) button.setAttribute("aria-pressed", selected);
      }
    }

    // ── pointer and keys ──

    #local(e) {
      const r = this.#el.stage.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    #insideOrbit(x, y) {
      const R = this.#R;
      if (this.#mode?.sphere) return R.insideDisc(x, y, 1.05);
      const margin = 0.04 * Math.min(R.w, R.h);
      return x >= margin && x <= R.w - margin && y >= margin && y <= R.h - margin;
    }

    // The handle under (x, y): front-facing handles win, then the nearest.
    #hit(x, y, touch = false) {
      if (!this.#mode) return null;
      const R = this.#R;
      const reach = touch ? 24 : 15;
      let best = null;
      for (const h of this.#mode.handles()) {
        R.pv(h.get());
        const d = Math.hypot(R.X - x, R.Y - y);
        if (d > reach) continue;
        const front = R.Z >= 0;
        if (!best || (front && !best.front) || (front === best.front && d < best.d)) best = { h, d, front, z: R.Z };
      }
      return best;
    }

    #onDown(e) {
      if (e.button > 0) return;
      const [x, y] = this.#local(e);
      const touch = e.pointerType !== "mouse";
      this.#touched = true;
      this.#keyboard = false;
      const hit = this.#hit(x, y, touch);
      if (hit) {
        this.#active = hit.h.id;
        this.#drag = { kind: "handle", h: hit.h, hemi: hit.front ? 1 : -1 };
      } else if (!touch || this.#insideOrbit(x, y)) {
        this.#viewTween.on = false;
        this.#drag = { kind: "orbit", yaw: this.#yaw, pitch: this.#pitch };
      } else return;
      Object.assign(this.#drag, { x0: x, y0: y, t0: performance.now(), moved: false, id: e.pointerId });
      this.#el.stage.setPointerCapture(e.pointerId);
      this.#el.stage.style.cursor = "grabbing";
      this.#el.stage.focus({ preventScroll: true });
      this.#invalidate();
    }

    #onMove(e) {
      const [x, y] = this.#local(e);
      const drag = this.#drag;
      if (!drag) {
        if (e.pointerType === "mouse") this.#el.stage.style.cursor = this.#hit(x, y) ? "pointer" : "grab";
        return;
      }
      if (e.pointerId !== drag.id) return;
      if (!drag.moved) {
        if (Math.hypot(x - drag.x0, y - drag.y0) < 5) return;
        drag.moved = true;
      }
      const R = this.#R;
      if (drag.kind === "handle") {
        if (!R.insideDisc(x, y)) drag.hemi = 1; // over the rim: carry on over the front
        drag.h.set(R.pick(x, y, drag.hemi));
      } else {
        this.#yaw = drag.yaw - (x - drag.x0) / R.R;
        this.#pitch = clamp(drag.pitch + (y - drag.y0) / R.R, -85 * DEG, 85 * DEG);
        this.#bgDirty = true;
      }
      this.#invalidate();
    }

    #onUp(e) {
      const drag = this.#drag;
      if (!drag || e.pointerId !== drag.id) return;
      this.#endDrag();
      if (drag.kind !== "handle") return;
      if (!drag.moved && performance.now() - drag.t0 < 400 && drag.h.flip) drag.h.flip();
      else if (drag.moved) this.#announceSoon(this.#mode.describe());
    }

    #endDrag() {
      this.#drag = null;
      this.#el.stage.style.cursor = "";
      this.#invalidate();
    }

    #onKey(e) {
      const m = this.#mode;
      if (!m) return;
      const hs = m.handles();
      const k = e.key;
      if (k === "v" || k === "V" || k === "0") {
        e.preventDefault();
        this.#resetView();
        return;
      }
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k];
      if (dir) {
        e.preventDefault();
        this.#touched = true;
        this.#keyboard = true;
        const step = (e.shiftKey ? 15 : 3) * DEG;
        const h = hs.find((x) => x.id === this.#active) || hs[0];
        if (e.altKey || !h) {
          this.#viewTween.on = false;
          this.#yaw -= dir[0] * step;
          this.#pitch = clamp(this.#pitch + dir[1] * step, -85 * DEG, 85 * DEG);
          this.#bgDirty = true;
        } else {
          this.#active = h.id;
          const a = angles(h.get());
          if (Math.sin(a.theta) > 1e-6) this.#kbPhi = a.phi;
          const th = clamp(a.theta + dir[1] * step, 0, Math.PI);
          this.#kbPhi += dir[0] * step;
          h.set(sph(th, this.#kbPhi));
          const angleText = `polar ${fmtRad(th)}, azimuth ${fmtRad(wrap360(this.#kbPhi / DEG) * DEG)}`;
          this.#announceSoon(`${h.label}: ${angleText}. ${m.describe()}`);
        }
        this.#invalidate();
        return;
      }
      if ((k === "Enter" || k === " ") && hs.length) {
        e.preventDefault();
        this.#keyboard = true;
        const i = hs.findIndex((x) => x.id === this.#active);
        const h = hs[(i + 1) % hs.length];
        this.#active = h.id;
        this.#announce(`Handle: ${h.label}.`);
        this.#invalidate();
        return;
      }
      if (k === "f" || k === "F") {
        const h = hs.find((x) => x.id === this.#active);
        if (h?.flip) {
          e.preventDefault();
          this.#touched = true;
          h.flip();
        }
      }
    }

    // ── the frame loop: draw only when something changed or is moving ──

    #invalidate() {
      if (!this.#raf && this.#visible && !document.hidden && this.#el.root && this.isConnected) {
        this.#raf = requestAnimationFrame(this.#frame);
      }
    }

    #frame = (now) => {
      this.#raf = 0;
      if (!this.#visible || document.hidden || !this.isConnected) return;
      const dt = this.#last ? Math.min(0.05, (now - this.#last) / 1000) : 1 / 60;
      let busy = this.#mode ? !!this.#mode.step(dt) : false;
      if (this.#viewTween.on) {
        [this.#yaw, this.#pitch] = this.#viewTween.step(dt);
        this.#bgDirty = true;
        busy = true;
      }
      this.#draw(now, busy);
      this.#last = busy ? now : 0;
      if (busy) this.#invalidate();
    };

    // ── colours, sizes, announcements ──

    #restyle() {
      this.#colors = null;
      this.#bgDirty = true;
      this.#invalidate();
    }

    #palette() {
      if (this.#colors) return this.#colors;
      const cs = getComputedStyle(this.#el.root);
      const rgb = {};
      for (const [name, fallback] of Object.entries(DEFAULTS)) {
        rgb[name] = parseColor(cs.getPropertyValue(`--bs-${name}`).trim() || fallback, fallback);
      }
      const R = this.#R;
      R.rgb = rgb;
      R.dark = luma(rgb.ink) > luma(rgb.paper);
      R.math = cs.getPropertyValue("--bs-math-font").trim() || MATH_FONT;
      R.ui = cs.fontFamily || "system-ui, sans-serif";
      return (this.#colors = rgb);
    }

    #resize() {
      const { root, wrap, side, stage, panel } = this.#el;
      if (!root || !this.#mode) return;
      root.classList.toggle("wide", root.clientWidth >= WIDE);
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const S = Math.floor(wrap.clientWidth);
      const W = Math.floor(side.clientWidth);
      const H = Math.round(W * this.#mode.panelAspect());
      if (S === this.#S && W === this.#W && H === this.#H && dpr === this.#dpr) return;
      [this.#S, this.#W, this.#H, this.#dpr] = [S, W, H, dpr];
      stage.width = stage.height = this.#bg.width = this.#bg.height = Math.round(S * dpr);
      panel.width = Math.round(W * dpr);
      panel.height = Math.round(H * dpr);
      panel.style.height = `${H}px`;
      this.#bgDirty = true;
      this.#invalidate();
    }

    #announce(text) {
      clearTimeout(this.#soon);
      const live = this.#el.live;
      if (!live) return;
      // clear first, so the same message twice in a row is still read out
      live.textContent = "";
      this.#soon = setTimeout(() => { live.textContent = text; }, 50);
    }

    // For slider drags: wait until the reader pauses, then say where things are.
    #announceSoon(text) {
      clearTimeout(this.#soon);
      this.#soon = setTimeout(() => { if (this.#el.live) this.#el.live.textContent = text; }, 450);
    }

    // ── drawing ──

    #draw(now, busy) {
      const m = this.#mode;
      if (!this.#S || !m) return;
      this.#palette();
      const R = this.#R, S = this.#S, dpr = this.#dpr;
      R.view(S, S, this.#yaw, this.#pitch);
      this.#cameraSelection();

      if (this.#bgDirty) {
        const b = this.#bg.getContext("2d");
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.clearRect(0, 0, this.#bg.width, this.#bg.height);
        b.setTransform(dpr, 0, 0, dpr, 0, 0);
        R.background(b, m.sphere);
        this.#bgDirty = false;
      }
      const g = this.#el.stage.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.#el.stage.width, this.#el.stage.height);
      g.drawImage(this.#bg, 0, 0);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const focused = this.shadowRoot.activeElement === this.#el.stage;
      const active = this.#drag?.kind === "handle" ? this.#drag.h.id : this.#keyboard && focused ? this.#active : null;
      R.begin(g);
      m.drawStage(R, active);
      R.flush();
      R.labels(g, m.kets);

      if (this.#W && this.#H) {
        const p = this.#el.panel.getContext("2d");
        p.setTransform(1, 0, 0, 1, 0, 0);
        p.clearRect(0, 0, this.#el.panel.width, this.#el.panel.height);
        p.setTransform(dpr, 0, 0, dpr, 0, 0);
        m.drawPanel(p, R, this.#W, this.#H);
      }
      // words: at most every 80 ms while animating, always on the last frame
      if (!busy || now - this.#readAt > 80) {
        this.#readAt = now;
        this.#words();
      }
    }

    #words() {
      const m = this.#mode, el = this.#el;
      const set = (key, value, apply) => {
        if (this.#strings[key] === value) return;
        this.#strings[key] = value;
        apply(value);
      };
      set("readout", m.readout(), (v) => { el.readout.innerHTML = v; });
      set("hint", m.hint(), (v) => { el.hint.innerHTML = v; });
      set("legend", m.legend().map(([key, text, shape = "dot"]) => {
        const style = shape === "ring" ? `border-color: var(--bs-${key})` : `background: var(--bs-${key})`;
        return `<span><i class="sw ${shape === "dot" ? "" : shape}" style="${style}"></i><span>${text}</span></span>`;
      }).join(""), (v) => { el.legend.innerHTML = v; });
      set("symbols", [...m.glossary(), KEYS_ROW].map(([s, meaning]) => `<div><dt>${s}</dt><dd>${meaning}</dd></div>`).join(""),
        (v) => { el.symbols.innerHTML = v; });
      set("label", `${m.sphere ? "Bloch sphere" : "Three-dimensional space"}. ${m.describe()}`, (v) => el.stage.setAttribute("aria-label", v));
      set("panel", m.panelLabel ? m.panelLabel() : "", (v) => el.panel.setAttribute("aria-label", v));
    }
  }

  if (!customElements.get("bloch-sphere")) customElements.define("bloch-sphere", BlochSphere);

  // Append ?bloch-test to the page URL to run the checks on load.
  if (/[?&]bloch-test(?:[=&]|$)/.test(location.search)) selfTest();
})();
