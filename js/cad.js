/* Visualizador 3D da malha real do CAD da pré-câmara (revisão V4), usado em duas seções:
 *  - T03 (mode 't03'): câmera fixa, peça deitada com a ponta à direita e cortada pelo eixo; uma camada 2D
 *    (SVG) desenha a luz de cada passo (carga, injeção, centelha, jatos) sobre os pontos projetados da malha.
 *  - T06 (mode 't06'): peça em 3/4, gira sozinha até o primeiro toque; arrastar, pinça/roda e setas;
 *    modos girar / corte / frente.
 * Malha: assets/pre-camara-cad.bin, Float32 intercalado (posição + normal), triângulos sem índice, em mm.
 * A ponta (cúpula com os orifícios) é achada pela malha: é a extremidade de menor raio. A tomada da vela
 * também: é o lado do corpo com mais vértices fora do furo axial. Depois de orientar, a ponta fica em +x
 * e a tomada da vela aponta para +y.
 * Uso: const v = await createCadViewer(el, { mode:'t06', reduced, onFail }); v?.setMode('corte');
 */
import * as THREE from '../assets/vendor/three.module.js';
import { easeOut, easeInOut } from './ease.js';

const MALHA = new URL('../assets/pre-camara-cad.bin', import.meta.url).href;
// paleta das luzes (nunca azul)
const COR = { faisca: '#FFF4EC', coral: '#FF5A4F', vermelho: '#DF2531', calor: '#FF7A2F', ambar: '#FFB23F', spray: '#F4F2EE' };
const SVGNS = 'http://www.w3.org/2000/svg';
const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ── malha: leitura, centro, eixo longo em x, ponta em +x, tomada da vela em +y ──
async function carregarMalha(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error('malha');
  const data = new Float32Array(await res.arrayBuffer());
  if (!data.length || data.length % 18) throw new Error('formato da malha');
  const g = new THREE.BufferGeometry(), buf = new THREE.InterleavedBuffer(data, 6);
  g.setAttribute('position', new THREE.InterleavedBufferAttribute(buf, 3, 0));
  g.setAttribute('normal', new THREE.InterleavedBufferAttribute(buf, 3, 3));
  g.computeBoundingBox();
  const size = g.boundingBox.getSize(new THREE.Vector3()), c = g.boundingBox.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  const ax = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  if (ax === 'y') g.rotateZ(-Math.PI / 2);
  if (ax === 'z') g.rotateY(Math.PI / 2);
  const L = Math.max(size.x, size.y, size.z), half = L / 2, n = data.length / 6;
  // ponta: maior raio dentro dos 6 % finais de cada extremidade; a cúpula é a menor
  let rPos = 0, rNeg = 0, rMax = 0;
  for (let i = 0; i < n; i++) {
    const x = data[i * 6], r = Math.hypot(data[i * 6 + 1], data[i * 6 + 2]);
    if (x > half * .88) rPos = Math.max(rPos, r);
    if (x < -half * .88) rNeg = Math.max(rNeg, r);
    rMax = Math.max(rMax, r);
  }
  const pontaBruta = rPos <= rNeg ? '+x' : '-x';
  if (pontaBruta === '-x') g.rotateY(Math.PI);
  // tomada da vela: no meio da peça, os vértices entre o furo axial e a face externa se concentram
  // no lado da tomada; a média das direções dá o azimute dela
  let sy = 0, sz = 0;
  for (let i = 0; i < n; i++) {
    const y = data[i * 6 + 1], z = data[i * 6 + 2], r = Math.hypot(y, z), x = data[i * 6];
    if (r < rMax * .32 || r > rMax * .97 || x > half * .5 || x < -half * .5) continue;
    sy += y / r; sz += z / r;
  }
  g.rotateX(-Math.atan2(sz, sy));
  g.computeBoundingBox();
  // pontos de referência (mm, já orientados)
  const bb = g.boundingBox;
  const ptsTomada = { dentro: [0, 0, 0, 0], fora: [0, 0, 0, 0] };
  for (let i = 0; i < n; i++) {
    const x = data[i * 6], y = data[i * 6 + 1], z = data[i * 6 + 2], r = Math.hypot(y, z);
    if (y < r * .75 || Math.abs(x) > half * .5) continue; // cone de ±41° em torno de +y
    const k = r > rMax * .3 && r < rMax * .55 ? 'dentro' : r > rMax * .75 && r < rMax * .97 ? 'fora' : null;
    if (!k) continue;
    const p = ptsTomada[k]; p[0] += x; p[1] += y; p[2] += z; p[3]++;
  }
  const media = p => p[3] ? new THREE.Vector3(p[0] / p[3], p[1] / p[3], p[2] / p[3]) : new THREE.Vector3(0, rMax * .5, 0);
  return {
    geometry: g, L, rMax, pontaBruta,
    xMin: bb.min.x, xMax: bb.max.x,
    tomadaDentro: media(ptsTomada.dentro), tomadaFora: media(ptsTomada.fora),
  };
}

// ── material: aço polido (como tools/cad-render.html); faces de trás = face de corte vermelha escura ──
function criarMaterial(planos) {
  const m = new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: .92, roughness: .26, side: THREE.DoubleSide, clippingPlanes: planos, envMapIntensity: 1.3 });
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>',
      // pelo corte se vê o avesso das paredes: pinta com a cor do material seccionado
      '#include <opaque_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(0.15, 0.02, 0.024, 1.0);');
  };
  return m;
}

// reflexos: mapa de ambiente gerado de uma cena com faixas brancas e vermelhas (sem azul)
function criarAmbiente(renderer) {
  const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene(), lixo = [];
  env.background = new THREE.Color(0x050505);
  for (const [col, x, y, w, h] of [[0xffffff, 0, 6, 10, 1.6], [0xffffff, -5, 1, 1.2, 6], [0xff2020, -8, 0, .5, 9], [0xff2020, 8, 0, .5, 9], [0x5a5a5a, 0, -6, 14, 1.2]]) {
    const geo = new THREE.PlaneGeometry(w, h), mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    lixo.push(geo, mat);
    const a = new THREE.Mesh(geo, mat); a.position.set(x, y, -6); env.add(a);
    const b = a.clone(); b.position.z = 6; env.add(b);
  }
  const tex = pm.fromScene(env, .02).texture;
  pm.dispose(); lixo.forEach(o => o.dispose());
  return tex;
}

export async function createCadViewer(container, opts = {}) {
  const mode = opts.mode === 't03' ? 't03' : 't06', reduced = !!opts.reduced;
  const falhar = () => { try { opts.onFail && opts.onFail(); } catch (e) { /* nada */ } return null; };
  let renderer = null, malha = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    if (!renderer.getContext()) throw new Error('webgl');
  } catch (e) { renderer = null; return falhar(); }
  try { malha = await carregarMalha(opts.src || MALHA); }
  catch (e) { renderer.dispose(); renderer.forceContextLoss(); return falhar(); }

  const { geometry, L } = malha;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = mode === 't03' ? 1.15 : 1.1;
  renderer.localClippingEnabled = true;

  // plano de corte pelo eixo (x–y): remove o lado z > constante, voltado para a câmera
  const corte = new THREE.Plane(new THREE.Vector3(0, 0, -1), mode === 't03' ? 0 : L);
  const material = criarMaterial([corte]);
  const scene = new THREE.Scene(), peca = new THREE.Mesh(geometry, material);
  scene.add(peca);
  let envTex = criarAmbiente(renderer);
  scene.environment = envTex;
  scene.add(new THREE.HemisphereLight(0xe8e6e3, 0x0a0a0a, .55));
  const key = new THREE.DirectionalLight(0xffffff, 2.3); key.position.set(-L * .4, L * 2.4, L * 1.2); scene.add(key);
  // luz suave a partir da câmera: a peça não fica escura em nenhuma vista (inclusive de frente)
  const farol = new THREE.DirectionalLight(0xfff4ec, .7); scene.add(farol);
  for (const [col, pw, p] of [[0xff2a2a, 1.2, [-L * 2, L * .2, -L]], [0xff3b3b, 1.0, [L * 2, L * .1, -L * .6]], [0xffffff, .9, [L, L * .5, L * 2]]]) {
    const l = new THREE.DirectionalLight(col, pw); l.position.set(...p); scene.add(l);
  }
  // luzes internas do T03: brilho da câmara e centelha (intensidade 0 no passo 1)
  const luzCamara = new THREE.PointLight(COR.calor, 0, L * .7, 1.6);
  const luzFaisca = new THREE.PointLight(COR.faisca, 0, L * .35, 1.6);
  scene.add(luzCamara, luzFaisca);

  const camera = new THREE.PerspectiveCamera(26, 1, .5, L * 40);
  const canvas = renderer.domElement;
  canvas.classList.add('cad-canvas');
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;outline-offset:-2px';
  container.appendChild(canvas);

  // ── geometria de referência para enquadramento e para a camada 2D ──
  const xTip = malha.xMax, xBase = malha.xMin;
  const ref = {
    ponta: new THREE.Vector3(xTip, 0, 0),
    // anel dos orifícios: 1,25 mm atrás do ápice, raio 3,65 mm (medidos na malha)
    anelX: xTip - 1.25, anelR: 3.65,
    entradaFuro: new THREE.Vector3(xBase, 0, 0),
    tomadaDentro: malha.tomadaDentro, tomadaFora: malha.tomadaFora,
    raioFuro: 3.85, // furo axial ⌀7,7 mm
  };
  // ponta da vela: o eixo da tomada (fora → dentro) prolongado até a parede do furo axial
  {
    const a = ref.tomadaFora, b = ref.tomadaDentro, t = (a.y - (ref.raioFuro + .6)) / Math.max(.1, a.y - b.y);
    ref.faisca = new THREE.Vector3(lerp(a.x, b.x, t), ref.raioFuro + .6, 0);
  }
  // volume da pré-câmara: o furo entre a tomada da vela e a cúpula; o injetor fica no trecho do sextavado
  ref.camara = new THREE.Vector3((ref.faisca.x + ref.anelX) / 2, 0, 0);
  ref.camaraMeia = (ref.anelX - ref.faisca.x) / 2 + 2;
  ref.injetor = new THREE.Vector3(xBase + L * .3, 0, 0);

  // ── estado de câmera e animação ──
  const st = {
    w: 0, h: 0, visivel: false, oculto: document.hidden, perdido: false, rodando: false, raf: 0, t: 0,
    yaw: 0, pitch: 0, zoom: 1, frente: 0, vy: 0, auto: false, arrastando: false, entrou: false, modo: 'girar', passo: 1,
  };
  const T03 = { yaw: 24 * DEG, pitch: 17 * DEG };
  const T06 = { yaw: 34 * DEG, pitch: 20 * DEG };
  const tweens = [];
  function tween(obj, k, to, dur, ease = easeInOut) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj && tweens[i].k === k) tweens.splice(i, 1);
    if (reduced || dur <= 0) { obj[k] = to; return; }
    tweens.push({ obj, k, from: obj[k], to, dur, t0: performance.now(), ease });
  }
  function passoTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], p = clamp((now - tw.t0) / tw.dur, 0, 1);
      tw.obj[tw.k] = lerp(tw.from, tw.to, tw.ease(p));
      if (p >= 1) tweens.splice(i, 1);
    }
  }

  // enquadramento: distância para caber largura × altura (mm) no quadro, com o campo de visão vertical
  function distancia(largura, altura) {
    const t = Math.tan(camera.fov * DEG / 2);
    return Math.max(altura / (2 * t), largura / (2 * t * camera.aspect));
  }
  function posicionarCamera() {
    let alvo, d;
    if (mode === 't03') {
      // a peça ocupa ~64 % da largura; à direita sobra espaço para os jatos, acima e abaixo para os rótulos
      alvo = new THREE.Vector3(L * .1, 0, 0);
      d = distancia(L * 1.55, L * .78);
    } else {
      const dLado = distancia(L * 1.32, L * .72), dFrente = distancia(L * .5, L * .5);
      alvo = new THREE.Vector3(lerp(0, xTip - 4, st.frente), 0, 0);
      d = lerp(dLado, dFrente, st.frente) / st.zoom;
    }
    const cp = Math.cos(st.pitch);
    camera.position.set(alvo.x + Math.sin(st.yaw) * cp * d, Math.sin(st.pitch) * d, Math.cos(st.yaw) * cp * d);
    camera.lookAt(alvo);
    camera.updateMatrixWorld();
    farol.position.copy(camera.position).sub(alvo).add(new THREE.Vector3(0, L * .3, 0));
  }

  // ── camada 2D do T03 ──
  let ov = null, camadas = [];
  if (mode === 't03') {
    estiloOverlay();
    ov = document.createElementNS(SVGNS, 'svg');
    ov.setAttribute('class', 'cadv-ov');
    ov.setAttribute('aria-hidden', 'true');
    container.appendChild(ov);
  }

  function redimensionar() {
    const w = Math.max(1, Math.round(container.clientWidth)), h = Math.max(1, Math.round(container.clientHeight));
    if (w === st.w && h === st.h) return;
    st.w = w; st.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (mode === 't03') { posicionarCamera(); desenharOverlay(); }
    pedir();
  }

  function projetar(v) {
    const p = v.clone().project(camera);
    return { x: (p.x + 1) / 2 * st.w, y: (1 - p.y) / 2 * st.h };
  }


  function desenharOverlay() {
    if (!ov) return;
    const W = st.w, H = st.h;
    ov.setAttribute('viewBox', `0 0 ${W} ${H}`);
    ov.setAttribute('width', W); ov.setAttribute('height', H);
    const P = v => projetar(v);
    const ponta = P(ref.ponta), eixoA = P(new THREE.Vector3(xBase, 0, 0)), eixoB = P(new THREE.Vector3(xTip, 0, 0));
    // direção do eixo na tela e a perpendicular (para o leque)
    const ax = { x: eixoB.x - eixoA.x, y: eixoB.y - eixoA.y }, al = Math.hypot(ax.x, ax.y) || 1;
    const ux = ax.x / al, uy = ax.y / al, px = -uy, py = ux;
    const escala = al / L; // px por mm
    const anel = P(new THREE.Vector3(ref.anelX, 0, 0));
    const rAnel = ref.anelR * escala;
    const camara = P(ref.camara), faisca = P(ref.faisca), tomF = P(ref.tomadaFora);
    const fmt = n => n.toFixed(1);
    let defs = '', s1 = '', s2 = '', s3 = '', s4 = '';

    // brilho da câmara (passos 3 e 4) e névoa âmbar (passo 2): gradiente radial alongado no eixo
    const ang = Math.atan2(uy, ux) / DEG;
    const rx = ref.camaraMeia * escala, ry = (ref.raioFuro + 1.6) * escala;
    defs += grad('cadv-nevoa', [[0, COR.ambar, .55], [.6, COR.ambar, .18], [1, COR.ambar, 0]]);
    defs += grad('cadv-brasa', [[0, COR.faisca, .85], [.3, COR.calor, .85], [.7, COR.vermelho, .4], [1, COR.vermelho, 0]]);
    defs += grad('cadv-faisca', [[0, '#FFFFFF', 1], [.18, COR.faisca, .95], [.45, COR.calor, .55], [1, COR.calor, 0]]);
    const elipse = (id, k) => `<ellipse cx="${fmt(camara.x)}" cy="${fmt(camara.y)}" rx="${fmt(rx * k)}" ry="${fmt(ry * k)}" transform="rotate(${fmt(ang)} ${fmt(camara.x)} ${fmt(camara.y)})" fill="url(#${id})"/>`;

    // passo 1: rótulos com linhas finas brancas
    s1 = rotulos([
      { txt: 'Passagem axial: injetor auxiliar', p: P(new THREE.Vector3(xBase + L * .1, 0, 0)), lado: 'baixo' },
      { txt: 'Volume da pré-câmara', p: camara, lado: 'baixo' },
      { txt: 'Tomada lateral: vela de ignição', p: tomF, lado: 'cima' },
      { txt: 'Orifícios de passagem', p: { x: anel.x - py * rAnel * .9, y: anel.y - px * rAnel * .9 }, lado: 'cima' },
    ], W, H);

    // leque de 5 orifícios (±20° em torno do eixo), com origem na cúpula
    const leque = [-20, -10, 0, 10, 20].map((a, i) => {
      const k = (i - 2) / 2; // −1..1
      const ox = anel.x + px * rAnel * k * .95 + ux * rAnel * (1 - Math.abs(k)) * .55;
      const oy = anel.y + py * rAnel * k * .95 + uy * rAnel * (1 - Math.abs(k)) * .55;
      const c = Math.cos(a * DEG), s = Math.sin(a * DEG);
      return { ox, oy, dx: ux * c - uy * s, dy: uy * c + ux * s };
    });

    // passo 2: carga âmbar entrando pelos orifícios; névoa na câmara; spray do injetor pelo eixo
    const comp = Math.min(W - ponta.x - 8, L * .42 * escala);
    leque.forEach((j, i) => {
      const x0 = j.ox + j.dx * comp, y0 = j.oy + j.dy * comp;
      defs += `<linearGradient id="cadv-in${i}" gradientUnits="userSpaceOnUse" x1="${fmt(x0)}" y1="${fmt(y0)}" x2="${fmt(j.ox)}" y2="${fmt(j.oy)}"><stop offset="0" stop-color="${COR.ambar}" stop-opacity="0"/><stop offset=".55" stop-color="${COR.ambar}" stop-opacity=".75"/><stop offset="1" stop-color="${COR.faisca}" stop-opacity=".95"/></linearGradient>`;
      s2 += `<path class="cadv-fluxo" style="animation-delay:${(-i * .23).toFixed(2)}s" d="M${fmt(x0)} ${fmt(y0)}L${fmt(j.ox)} ${fmt(j.oy)}" stroke="url(#cadv-in${i})"/>`;
    });
    s2 += elipse('cadv-nevoa', 1.05);
    // spray: cone fino a partir do fim do furo axial, em direção à câmara
    const bocal = P(ref.injetor), alvoSpray = P(new THREE.Vector3(ref.camara.x, 0, 0));
    const meia = 9 * DEG;
    defs += `<linearGradient id="cadv-spray" gradientUnits="userSpaceOnUse" x1="${fmt(bocal.x)}" y1="${fmt(bocal.y)}" x2="${fmt(alvoSpray.x)}" y2="${fmt(alvoSpray.y)}"><stop offset="0" stop-color="${COR.spray}" stop-opacity=".95"/><stop offset=".6" stop-color="${COR.spray}" stop-opacity=".35"/><stop offset="1" stop-color="${COR.spray}" stop-opacity="0"/></linearGradient>`;
    const sl = Math.hypot(alvoSpray.x - bocal.x, alvoSpray.y - bocal.y);
    const rot = (a) => ({ x: bocal.x + (ux * Math.cos(a) - uy * Math.sin(a)) * sl, y: bocal.y + (uy * Math.cos(a) + ux * Math.sin(a)) * sl });
    const c1 = rot(-meia), c2 = rot(meia);
    s2 += `<path d="M${fmt(bocal.x)} ${fmt(bocal.y)}L${fmt(c1.x)} ${fmt(c1.y)}L${fmt(c2.x)} ${fmt(c2.y)}Z" fill="url(#cadv-spray)" opacity=".55"/>`;
    for (const a of [-6, -2, 2, 6]) {
      const e = rot(a * DEG);
      s2 += `<path class="cadv-gota" style="animation-delay:${(a * .05).toFixed(2)}s" d="M${fmt(bocal.x)} ${fmt(bocal.y)}L${fmt(e.x)} ${fmt(e.y)}" stroke="url(#cadv-spray)"/>`;
    }

    // passo 3: centelha branca na ponta da vela (fim interno da tomada) e câmara alaranjada
    const fx = faisca.x, fy = faisca.y, rf = 6.5 * escala, rr = Math.max(4, rf * .5);
    s3 += elipse('cadv-brasa', 1.1);
    s3 += `<g class="cadv-pisca"><circle cx="${fmt(fx)}" cy="${fmt(fy)}" r="${fmt(rf)}" fill="url(#cadv-faisca)"/>`
      + [25, -35, 95].map(a => `<path class="cadv-raio" d="M${fmt(fx - Math.cos(a * DEG) * rr)} ${fmt(fy - Math.sin(a * DEG) * rr)}L${fmt(fx + Math.cos(a * DEG) * rr)} ${fmt(fy + Math.sin(a * DEG) * rr)}"/>`).join('')
      + `<circle cx="${fmt(fx)}" cy="${fmt(fy)}" r="${fmt(Math.max(2, rf * .14))}" fill="#fff"/></g>`;

    // passo 4: câmara ainda acesa e cinco jatos em cunha (branco na saída → coral → laranja → some)
    s4 += elipse('cadv-brasa', 1.1);
    const cj = Math.min(W - ponta.x - 6, L * .55 * escala);
    leque.forEach((j, i) => {
      const x1 = j.ox + j.dx * cj, y1 = j.oy + j.dy * cj, nx = -j.dy, ny = j.dx;
      const w0 = Math.max(1.2, escala * .5), w1 = Math.max(4, escala * 1.7);
      defs += `<linearGradient id="cadv-jt${i}" gradientUnits="userSpaceOnUse" x1="${fmt(j.ox)}" y1="${fmt(j.oy)}" x2="${fmt(x1)}" y2="${fmt(y1)}"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".08" stop-color="${COR.faisca}"/><stop offset=".3" stop-color="${COR.coral}"/><stop offset=".65" stop-color="${COR.calor}" stop-opacity=".5"/><stop offset="1" stop-color="${COR.calor}" stop-opacity="0"/></linearGradient>`;
      const d = `M${fmt(j.ox)} ${fmt(j.oy)}L${fmt(x1)} ${fmt(y1)}`, atraso = (-i * .21).toFixed(2);
      // cunha: estreita no orifício, larga e transparente na ponta
      s4 += `<path class="cadv-cunha" d="M${fmt(j.ox + nx * w0)} ${fmt(j.oy + ny * w0)}L${fmt(x1 + nx * w1)} ${fmt(y1 + ny * w1)}L${fmt(x1 - nx * w1)} ${fmt(y1 - ny * w1)}L${fmt(j.ox - nx * w0)} ${fmt(j.oy - ny * w0)}Z" fill="url(#cadv-jt${i})"/>`;
      s4 += `<path class="cadv-jato" d="${d}" stroke="url(#cadv-jt${i})"/>`;
      s4 += `<path class="cadv-cometa" style="animation-delay:${atraso}s" d="${d}" stroke="url(#cadv-jt${i})"/>`;
      s4 += `<circle cx="${fmt(j.ox)}" cy="${fmt(j.oy)}" r="${fmt(Math.max(1.8, escala * .5))}" fill="#fff"/>`;
    });

    ov.innerHTML = `<defs>${defs}</defs>` + [s1, s2, s3, s4].map((s, i) => `<g class="cadv-passo" data-p="${i + 1}">${s}</g>`).join('');
    camadas = [...ov.querySelectorAll('.cadv-passo')];
    camadas.forEach((g, i) => g.classList.toggle('on', i + 1 === st.passo));
    ov.classList.toggle('cadv-sem-mov', reduced);
  }

  function grad(id, stops) {
    return `<radialGradient id="${id}">` + stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('') + '</radialGradient>';
  }

  // rótulos: linha fina do ponto até uma faixa acima ou abaixo da peça, sem sobreposição entre eles
  let medidor = null;
  function largura(txt) {
    medidor = medidor || document.createElement('canvas').getContext('2d');
    medidor.font = '12px Geist, "Geist Local", system-ui, sans-serif';
    return medidor.measureText(txt).width * 1.08; // folga: a Geist pode carregar depois da medida
  }
  function rotulos(lista, W, H) {
    // silhueta projetada da peça (caixa) para saber onde ficam as faixas
    let top = Infinity, bot = -Infinity;
    for (const x of [xBase, 0, xTip]) for (const y of [-malha.rMax, malha.rMax]) for (const z of [-malha.rMax, 0]) {
      const p = projetar(new THREE.Vector3(x, y, z)); top = Math.min(top, p.y); bot = Math.max(bot, p.y);
    }
    const faixas = { cima: [top - 14, top - 32, top - 50], baixo: [bot + 22, bot + 40, bot + 58] };
    // segmento × caixa (amostragem simples: os segmentos são curtos)
    const cruza = (g, c) => { for (let i = 1; i < 12; i++) { const t = i / 12, x = lerp(g.x0, g.x1, t), y = lerp(g.y0, g.y1, t); if (x > c.x0 && x < c.x1 && y > c.y0 && y < c.y1) return true; } return false; };
    // posiciona na ordem dada; conta quantos rótulos ficaram sem lugar livre
    const dispor = ordemRot => {
      const caixas = [], guias = [], res = [];
      let falhas = 0;
      for (const r of ordemRot) {
        const tw = largura(r.txt), ordem = r.lado === 'cima' ? ['cima', 'baixo'] : ['baixo', 'cima'];
        const xs = [r.p.x - tw / 2, W - 8 - tw, 8, r.p.x - tw + 10, r.p.x - 10].map(x => clamp(x, 8, Math.max(8, W - 8 - tw)));
        let ok = null;
        for (const lado of ordem) for (const y of faixas[lado]) for (const x0 of xs) {
          if (ok) break;
          const yy = clamp(y, 14, H - 6);
          const caixa = { x0: x0 - 6, x1: x0 + tw + 6, y0: yy - 13, y1: yy + 5 };
          const lx = clamp(r.p.x, x0 + 2, x0 + tw - 2), ly = lado === 'cima' ? yy + 5 : yy - 14;
          const guia = { x0: r.p.x, y0: r.p.y, x1: lx, y1: ly };
          // nem caixa sobre caixa, nem linha atravessando outro rótulo
          if (caixas.some(b => b.x0 < caixa.x1 && caixa.x0 < b.x1 && b.y0 < caixa.y1 && caixa.y0 < b.y1)) continue;
          if (caixas.some(b => cruza(guia, b)) || guias.some(g => cruza(g, caixa))) continue;
          ok = { x: x0, y: yy, caixa, guia };
        }
        if (!ok) {
          falhas++;
          const x0 = xs[0], yy = clamp(faixas[r.lado][0], 14, H - 6);
          ok = { x: x0, y: yy, caixa: null, guia: { x0: r.p.x, y0: r.p.y, x1: clamp(r.p.x, x0 + 2, x0 + tw - 2), y1: r.lado === 'cima' ? yy + 5 : yy - 14 } };
        }
        if (ok.caixa) caixas.push(ok.caixa);
        guias.push(ok.guia);
        res.push({ r, ok });
      }
      return { res, falhas };
    };
    // tenta algumas ordens (a gulosa nem sempre acha lugar em quadros estreitos) e fica com a melhor
    let melhor = null;
    for (const ordem of [[0, 1, 2, 3], [3, 2, 1, 0], [3, 0, 2, 1], [2, 3, 0, 1]]) {
      const tent = dispor(ordem.map(i => lista[i]));
      if (!melhor || tent.falhas < melhor.falhas) melhor = tent;
      if (!melhor.falhas) break;
    }
    let out = '';
    for (const { r, ok } of melhor.res) {
      const g = ok.guia;
      out += `<path class="cadv-guia" d="M${g.x0.toFixed(1)} ${g.y0.toFixed(1)}L${g.x1.toFixed(1)} ${g.y1.toFixed(1)}"/>`;
      out += `<circle class="cadv-ponto" cx="${r.p.x.toFixed(1)}" cy="${r.p.y.toFixed(1)}" r="2.4"/>`;
      out += `<text class="cadv-rot" x="${ok.x.toFixed(1)}" y="${ok.y.toFixed(1)}">${r.txt}</text>`;
    }
    return out;
  }

  // ── luzes 3D por passo (T03) ──
  const luz = { camara: 0, faisca: 0, corCamara: 0 };
  const corAmbar = new THREE.Color(COR.ambar), corCalor = new THREE.Color(COR.calor);
  function aplicarLuzes() {
    // à frente do plano de corte: ilumina por igual a parede interna do furo (sem ponto quente)
    luzCamara.position.set(ref.camara.x, 0, 7);
    luzFaisca.position.set(ref.faisca.x, ref.faisca.y, 2.5);
    luzCamara.intensity = luz.camara;
    luzCamara.color.copy(corAmbar).lerp(corCalor, luz.corCamara);
    luzFaisca.intensity = luz.faisca;
  }
  const LUZES = { 1: [0, 0, 0], 2: [220, 0, 0], 3: [950, 600, 1], 4: [1150, 0, 1] };

  // ── laço de desenho: só com a seção visível, aba visível e contexto válido ──
  const api = { frames: 0, tip: { side: '+x', raw: malha.pontaBruta, x: xTip }, landmarks: ref };
  function podeRodar() { return st.visivel && !st.oculto && !st.perdido; }
  function precisaContinuar() {
    return podeRodar() && (tweens.length > 0 || st.auto || st.arrastando || Math.abs(st.vy) > 1e-3);
  }
  function quadro(now) {
    const dt = st.t ? Math.min(.05, (now - st.t) / 1000) : 0; st.t = now;
    passoTweens(now);
    if (mode === 't06') {
      if (st.auto && !st.arrastando) st.yaw += 6 * DEG * dt;
      if (!st.arrastando && Math.abs(st.vy) > 1e-3) { st.yaw += st.vy * dt; st.vy *= Math.exp(-dt * 3.2); }
      // o corte acompanha o lado da câmera
      corte.normal.set(0, 0, Math.cos(st.yaw) >= 0 ? -1 : 1);
      corte.constant = st.corteK;
    } else aplicarLuzes();
    posicionarCamera();
    renderer.render(scene, camera);
    api.frames++;
  }
  function tick(now) {
    st.raf = 0;
    quadro(now);
    if (precisaContinuar()) st.raf = requestAnimationFrame(tick);
    else { st.rodando = false; st.t = 0; }
  }
  // pede um quadro (e mantém o laço se houver animação)
  function pedir() {
    if (!podeRodar() || st.raf) return;
    st.rodando = true; st.raf = requestAnimationFrame(tick);
  }
  function parar() { if (st.raf) cancelAnimationFrame(st.raf); st.raf = 0; st.rodando = false; st.t = 0; }
  function pausarOverlay() { if (ov) ov.classList.toggle('cadv-pausa', !podeRodar()); }

  // ── T06: controles ──
  st.corteK = L;
  const ouvintes = [];
  const on = (alvo, ev, fn, o) => { alvo.addEventListener(ev, fn, o); ouvintes.push([alvo, ev, fn, o]); };
  if (mode === 't06') {
    st.yaw = T06.yaw - 30 * DEG; st.pitch = T06.pitch;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Modelo 3D da pré-câmara. Arraste para girar; setas giram, mais e menos aproximam.');
    canvas.style.touchAction = 'pan-y';
    canvas.style.cursor = 'grab';
    const ponteiros = new Map();
    let pinca = 0, ultimo = 0;
    const tocar = () => { st.auto = false; };
    on(canvas, 'pointerdown', e => {
      ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* nada */ }
      tocar(); st.arrastando = true; st.vy = 0; ultimo = performance.now();
      if (ponteiros.size === 2) { const [a, b] = [...ponteiros.values()]; pinca = Math.hypot(a.x - b.x, a.y - b.y); }
      canvas.style.cursor = 'grabbing'; pedir();
    });
    on(canvas, 'pointermove', e => {
      const p = ponteiros.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ponteiros.size >= 2) {
        const [a, b] = [...ponteiros.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinca > 0) st.zoom = clamp(st.zoom * d / pinca, .7, 1.8);
        pinca = d; pedir(); return;
      }
      const now = performance.now(), dt = Math.max(1, now - ultimo) / 1000; ultimo = now;
      const dyaw = -dx * .009;
      st.yaw += dyaw; st.vy = lerp(st.vy, dyaw / dt, .5);
      if (e.pointerType !== 'touch') st.pitch = clamp(st.pitch + dy * .006, -1.1, 1.1);
      pedir();
    });
    const soltar = e => {
      ponteiros.delete(e.pointerId); pinca = 0;
      if (ponteiros.size) return;
      st.arrastando = false; canvas.style.cursor = 'grab';
      if (performance.now() - ultimo > 80) st.vy = 0;
      st.vy = clamp(st.vy, -6, 6); if (reduced) st.vy = 0;
      pedir();
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) on(canvas, ev, soltar);
    on(canvas, 'wheel', e => {
      const z = clamp(st.zoom * Math.exp(-e.deltaY * .0015), .7, 1.8);
      if (z === st.zoom) return; // no limite, deixa a página rolar
      e.preventDefault(); tocar(); st.zoom = z; pedir();
    }, { passive: false });
    on(canvas, 'keydown', e => {
      const k = e.key, passo = 15 * DEG;
      if (k === 'ArrowLeft') tween(st, 'yaw', st.yaw - passo, 220, easeOut);
      else if (k === 'ArrowRight') tween(st, 'yaw', st.yaw + passo, 220, easeOut);
      else if (k === 'ArrowUp') tween(st, 'pitch', clamp(st.pitch + passo * .6, -1.1, 1.1), 220, easeOut);
      else if (k === 'ArrowDown') tween(st, 'pitch', clamp(st.pitch - passo * .6, -1.1, 1.1), 220, easeOut);
      else if (k === '+' || k === '=') tween(st, 'zoom', clamp(st.zoom * 1.15, .7, 1.8), 220, easeOut);
      else if (k === '-' || k === '_') tween(st, 'zoom', clamp(st.zoom / 1.15, .7, 1.8), 220, easeOut);
      else return;
      e.preventDefault(); tocar(); pedir();
    });
  } else {
    st.yaw = T03.yaw; st.pitch = T03.pitch;
    canvas.setAttribute('aria-hidden', 'true');
  }

  // ângulo equivalente mais próximo (evita dar voltas inteiras ao voltar para uma vista)
  const perto = (de, para) => para + Math.round((de - para) / (2 * Math.PI)) * 2 * Math.PI;

  function setMode(m) {
    if (mode !== 't06' || !['girar', 'corte', 'frente'].includes(m)) return;
    st.modo = m; st.vy = 0;
    const dur = 1000;
    if (m === 'girar') {
      tween(st, 'corteK', L, dur); tween(st, 'frente', 0, dur);
      tween(st, 'yaw', perto(st.yaw, T06.yaw), dur); tween(st, 'pitch', T06.pitch, dur); tween(st, 'zoom', 1, dur);
      st.auto = !reduced;
    } else if (m === 'corte') {
      st.auto = false;
      tween(st, 'frente', 0, dur); tween(st, 'yaw', perto(st.yaw, T06.yaw), dur); tween(st, 'pitch', 24 * DEG, dur); tween(st, 'zoom', 1, dur);
      if (!reduced) st.corteK = Math.max(st.corteK, malha.rMax * 1.05);
      tween(st, 'corteK', 0, dur);
    } else {
      st.auto = false;
      tween(st, 'corteK', L, dur * .5); tween(st, 'frente', 1, dur);
      tween(st, 'yaw', perto(st.yaw, 90 * DEG), dur); tween(st, 'pitch', 6 * DEG, dur); tween(st, 'zoom', 1, dur);
    }
    pedir();
  }

  function setStep(n) {
    if (mode !== 't03') return;
    n = clamp(Math.round(+n) || 1, 1, 4);
    if (n === st.passo) return;
    st.passo = n;
    camadas.forEach((g, i) => g.classList.toggle('on', i + 1 === n));
    const [c, f, k] = LUZES[n];
    tween(luz, 'camara', c, 500); tween(luz, 'faisca', f, 500); tween(luz, 'corCamara', k, 500);
    pedir();
  }

  // entrada do T06: gira −30° → vista 3/4 em 1200 ms; depois, giro automático
  function entrar() {
    if (st.entrou || mode !== 't06') return;
    st.entrou = true;
    if (reduced) { st.yaw = T06.yaw; st.auto = false; }
    else { tween(st, 'yaw', T06.yaw, 1200, easeOut); st.timer = setTimeout(() => { if (st.modo === 'girar' && !st.arrastando && st.vy === 0) { st.auto = true; pedir(); } }, 1150); }
  }

  // ── observadores ──
  const ro = new ResizeObserver(redimensionar);
  ro.observe(container);
  const io = new IntersectionObserver(es => {
    for (const e of es) st.visivel = e.isIntersecting;
    pausarOverlay();
    if (st.visivel) { entrar(); pedir(); } else parar();
  }, { rootMargin: '80px 0px' });
  io.observe(container);
  const visib = () => { st.oculto = document.hidden; pausarOverlay(); if (podeRodar()) pedir(); else parar(); };
  on(document, 'visibilitychange', visib);
  on(canvas, 'webglcontextlost', e => { e.preventDefault(); st.perdido = true; parar(); pausarOverlay(); });
  on(canvas, 'webglcontextrestored', () => {
    st.perdido = false; envTex.dispose(); envTex = criarAmbiente(renderer); scene.environment = envTex; pausarOverlay(); pedir();
  });

  redimensionar();
  posicionarCamera();
  if (mode === 't03') { desenharOverlay(); aplicarLuzes(); }
  // a largura dos rótulos depende da Geist: redesenha quando as fontes terminarem de carregar
  if (mode === 't03' && document.fonts) document.fonts.ready.then(() => { if (ov && ov.isConnected) desenharOverlay(); });
  container.classList.add('cad-ready');

  api.setStep = setStep;
  api.setMode = setMode;
  api.dispose = () => {
    parar(); clearTimeout(st.timer); ro.disconnect(); io.disconnect(); st.visivel = false;
    for (const [a, ev, fn, o] of ouvintes) a.removeEventListener(ev, fn, o);
    geometry.dispose(); material.dispose(); envTex.dispose();
    renderer.dispose(); renderer.forceContextLoss();
    canvas.remove(); ov && ov.remove();
    container.classList.remove('cad-ready');
  };
  return api;
}

// estilos da camada 2D (uma vez por página)
function estiloOverlay() {
  if (document.getElementById('cadv-estilo')) return;
  const s = document.createElement('style');
  s.id = 'cadv-estilo';
  s.textContent = `
.cadv-ov{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;mix-blend-mode:screen}
.cadv-passo{opacity:0;transition:opacity .5s ease}
.cadv-passo.on{opacity:1}
.cadv-sem-mov .cadv-passo{transition:none}
.cadv-rot{font:400 12px/1 Geist,"Geist Local",system-ui,-apple-system,"Segoe UI",sans-serif;fill:rgba(255,255,255,.8);letter-spacing:.01em;mix-blend-mode:normal}
.cadv-guia{stroke:rgba(255,255,255,.7);stroke-width:1;fill:none}
.cadv-ponto{fill:#fff}
.cadv-fluxo{fill:none;stroke-width:2.4;stroke-linecap:round;stroke-dasharray:5 11;animation:cadv-anda 1.1s linear infinite}
.cadv-gota{fill:none;stroke-width:1;stroke-linecap:round;stroke-dasharray:2 7;animation:cadv-anda .7s linear infinite;opacity:.9}
.cadv-cunha{opacity:.42}
.cadv-raio{stroke:#fff;stroke-width:1.2;stroke-linecap:round;opacity:.9}
.cadv-jato{fill:none;stroke-width:1.8;stroke-linecap:round;opacity:.9}
.cadv-cometa{fill:none;stroke-width:3.6;stroke-linecap:round;stroke-dasharray:46 420;animation:cadv-cometa 1.15s cubic-bezier(.3,.1,.6,1) infinite}
.cadv-pisca{transform-box:fill-box;transform-origin:center;animation:cadv-pisca 1.6s ease-in-out infinite}
@keyframes cadv-anda{to{stroke-dashoffset:-32}}
@keyframes cadv-cometa{from{stroke-dashoffset:40}to{stroke-dashoffset:-400}}
@keyframes cadv-pisca{0%,100%{opacity:1;transform:scale(1)}45%{opacity:.82;transform:scale(.9)}60%{opacity:1;transform:scale(1.06)}}
.cadv-sem-mov *,.cadv-pausa *{animation-play-state:paused!important}
.cadv-sem-mov .cadv-cometa{animation:none;stroke-dasharray:none;opacity:0}
`;
  document.head.appendChild(s);
}
