/* Gráficos da T08, desenhados em SVG (escaláveis, sem imagem).
 * E5 · tendência esperada: CoV da IMEP × λ. Vela = curva qualitativa da monografia (cruza 5 % em λ ≈ 1,52);
 *      pré-câmara ativa ancorada nos limites de Zhu et al. (2022): 1,94 (combustível líquido) e 2,12 (vaporizado).
 * E6 · pressão no cilindro + MFB × ângulo: equações de tcc-precamera/scripts/gera_curvas.py (Figura 1 da monografia).
 * Nenhum valor é medido neste trabalho. */
const NS = 'http://www.w3.org/2000/svg';
const el = (n, a = {}, t) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (t != null) e.textContent = t; return e; };
const W = 'rgba(255,255,255,', MONO = 'var(--f-mono)', SANS = 'var(--f-sans)';
const txt = (g, x, y, s, o = {}) => g.append(el('text', { x, y, fill: o.c || W + '.8)', 'font-size': o.s || 13, 'font-family': o.f || SANS, 'text-anchor': o.a || 'middle', 'font-weight': o.w || 400 }, s));
const br = v => String(v).replace('.', ',').replace('-', '−');

export function drawE5(host) {
  if (!host) return;
  const w = 1200, h = 300, svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': host.querySelector('img')?.alt || '' });
  const tx = 8;
  txt(svg, tx, 34, 'TENDÊNCIA ESPERADA PELA LITERATURA', { a: 'start', f: MONO, s: 12, c: '#FF5A4F' });
  txt(svg, tx, 64, 'Até onde a mistura pode empobrecer', { a: 'start', s: 20, w: 600, c: '#fff' });
  ['Curvas qualitativas, não medidas neste trabalho. A vela', 'segue a curva da monografia; a pré-câmara ativa, os limites', 'de Zhu et al. (2022) com combustível líquido (λ = 1,94) e', 'vaporizado (λ = 2,12). Os dados da campanha substituem', 'este gráfico quando os ensaios terminarem.']
    .forEach((l, i) => txt(svg, tx, 96 + i * 19, l, { a: 'start', s: 13.5, c: W + '.68)' }));
  txt(svg, tx, 214, 'Fontes: os autores, 2026 (curva da vela); Zhu et al. (2022).', { a: 'start', s: 11.5, c: W + '.42)' });
  const P = { l: 470, r: w - 20, t: 24, b: h - 40 }, L0 = .9, L1 = 2.3, Y1 = 10;
  const X = l => P.l + (l - L0) / (L1 - L0) * (P.r - P.l), Y = v => P.b - Math.min(v, Y1) / Y1 * (P.b - P.t);
  for (let l = 1; l <= 2.21; l += .2) { svg.append(el('line', { x1: X(l), x2: X(l), y1: P.t, y2: P.b, stroke: W + '.07)' })); txt(svg, X(l), P.b + 20, br(l.toFixed(1)), { f: MONO, s: 12, c: W + '.5)' }); }
  txt(svg, P.r, P.b + 20, 'λ', { f: MONO, s: 12, a: 'end', c: W + '.5)' });
  svg.append(el('line', { x1: P.l, x2: P.r, y1: P.b, y2: P.b, stroke: W + '.3)' }));
  txt(svg, P.l - 10, P.t + 10, 'CoV IMEP', { f: MONO, s: 12, a: 'end', c: W + '.5)' });
  svg.append(el('line', { x1: P.l, x2: P.r, y1: Y(5), y2: Y(5), stroke: '#FF5A4F', 'stroke-dasharray': '5 5' }));
  txt(svg, P.l - 10, Y(5) + 4, '5 %', { f: MONO, s: 12, a: 'end', c: '#FF5A4F' });
  const vela = l => 1 + .6 * (l - .9) + 260 * Math.max(0, l - 1.35) ** 2.4;
  const k = (5 - (1 + .45 * (1.94 - .9))) / (1.94 - 1.7) ** 2.4, ativa = l => 1 + .45 * (l - .9) + k * Math.max(0, l - 1.7) ** 2.4;
  svg.append(el('rect', { x: X(1.519), y: P.t, width: X(1.94) - X(1.519), height: P.b - P.t, fill: 'rgba(223,37,49,.10)' }));
  svg.append(el('rect', { x: X(1.94), y: P.t, width: X(2.12) - X(1.94), height: P.b - P.t, fill: 'rgba(223,37,49,.04)' }));
  txt(svg, (X(1.519) + X(1.94)) / 2, P.t + 16, 'EXTENSÃO ESPERADA', { f: MONO, s: 11, c: 'rgba(255,90,79,.9)' });
  const path = f => { let d = ''; for (let l = L0; l <= L1; l += .005) { const v = f(l); d += (d ? 'L' : 'M') + X(l).toFixed(1) + ' ' + Y(v).toFixed(1); if (v > Y1) break; } return d; };
  svg.append(el('path', { d: path(vela), fill: 'none', stroke: W + '.8)', 'stroke-width': 2.2 }));
  svg.append(el('path', { d: path(ativa), fill: 'none', stroke: '#FF3B3B', 'stroke-width': 2.6 }));
  for (const [l, r, c, dx, oco] of [[1.519, 'vela · λ ≈ 1,5', '#fff', -8, 0], [1.94, 'ativa, líquido · λ = 1,94', '#FF5A4F', -8, 0], [2.12, 'vaporizado · 2,12', 'rgba(255,90,79,.75)', 8, 1]]) {
    svg.append(el('circle', { cx: X(l), cy: Y(5), r: 5, fill: oco ? 'none' : c, stroke: c, 'stroke-width': 1.6 }));
    txt(svg, X(l) + dx, Y(5) - 11, r, { s: 13, w: 500, c, a: dx < 0 ? 'end' : 'start' });
  }
  host.replaceChildren(svg);
}

export function drawE6(host) {
  if (!host) return;
  const w = 1200, h = 780, svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': host.querySelector('img')?.alt || '' });
  const P = { l: 100, r: w - 110, t: 120, b: h - 160 };
  const X = th => P.l + (th + 60) / 150 * (P.r - P.l), Yp = v => P.b - v / 50 * (P.b - P.t), Ym = v => P.b - v / 100 * (P.b - P.t);
  const wiebe = th => { const x = Math.min(1, Math.max(0, (th + 15) / 45)); return 1 - Math.exp(-5 * x ** 3); };
  const V = th => 1 + 4 * (1 - Math.cos(th * Math.PI / 180)), pm = th => (9 / V(th)) ** 1.32, pc = th => pm(th) + 30 * wiebe(th) * (1 / V(th)) ** .9;
  const find = f => { for (let t = -60; t <= 90; t += .01) if (wiebe(t) >= f) return t; };
  const t10 = find(.1), t50 = find(.5), t90 = find(.9);
  for (let th = -60; th <= 90; th += 15) { svg.append(el('line', { x1: X(th), x2: X(th), y1: P.t, y2: P.b, stroke: W + '.08)' })); txt(svg, X(th), P.b + 26, br(th), { f: MONO, s: 14 }); }
  for (let v = 0; v <= 50; v += 10) { svg.append(el('line', { x1: P.l, x2: P.r, y1: Yp(v), y2: Yp(v), stroke: W + '.08)' })); txt(svg, P.l - 14, Yp(v) + 5, v, { f: MONO, s: 14, a: 'end' }); txt(svg, P.r + 14, Yp(v) + 5, v * 2, { f: MONO, s: 14, a: 'start', c: '#FF7A6F' }); }
  svg.append(el('rect', { x: P.l, y: P.t, width: P.r - P.l, height: P.b - P.t, fill: 'none', stroke: W + '.3)' }));
  svg.append(el('rect', { x: X(-25), y: P.t, width: X(t10) - X(-25), height: P.b - P.t, fill: 'rgba(120,180,140,.07)' }));
  svg.append(el('rect', { x: X(t10), y: P.t, width: X(t90) - X(t10), height: P.b - P.t, fill: 'rgba(223,37,49,.08)' }));
  txt(svg, (P.l + P.r) / 2, P.b + 56, 'Ângulo do virabrequim (° em relação ao PMS)', { s: 16 });
  svg.append(el('text', { x: 0, y: 0, fill: W + '.8)', 'font-size': 16, 'text-anchor': 'middle', 'font-family': SANS, transform: `translate(${P.l - 62},${(P.t + P.b) / 2}) rotate(-90)` }, 'Pressão no cilindro (bar)'));
  svg.append(el('text', { x: 0, y: 0, fill: '#FF7A6F', 'font-size': 16, 'text-anchor': 'middle', 'font-family': SANS, transform: `translate(${P.r + 66},${(P.t + P.b) / 2}) rotate(90)` }, 'MFB (%)'));
  const vl = (th, c, d) => svg.append(el('line', { x1: X(th), x2: X(th), y1: P.t, y2: P.b, stroke: c, 'stroke-dasharray': d, 'stroke-width': 1.2 }));
  vl(0, W + '.4)', '2 4'); vl(-25, W + '.7)', '6 4'); [t10, t50, t90].forEach(t => vl(t, 'rgba(255,90,79,.6)', '4 4'));
  txt(svg, X(0) + 6, P.b - 8, 'PMS', { f: MONO, s: 12, a: 'start', c: W + '.55)' });
  /* marcos no eixo de cima, como num eixo secundário */
  [[-25, 'centelha', '−25°'], [t10, 'MFB 10 %', br(t10.toFixed(1)) + '°'], [t50, 'MFB 50 %', '+' + br(t50.toFixed(1)) + '°'], [t90, 'MFB 90 %', '+' + br(t90.toFixed(1)) + '°']]
    .forEach(([t, a, b], i) => { const c = i ? '#FF5A4F' : W + '.8)'; txt(svg, X(t), P.t - 34, a, { s: 13, c }); txt(svg, X(t), P.t - 16, b, { f: MONO, s: 12, c }); });
  const path = (f, Y) => { let d = ''; for (let t = -60; t <= 90; t += .25) d += (d ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(f(t)).toFixed(1); return d; };
  svg.append(el('path', { d: path(pm, Yp), fill: 'none', stroke: W + '.75)', 'stroke-width': 2, 'stroke-dasharray': '8 6' }));
  svg.append(el('path', { d: path(pc, Yp), fill: 'none', stroke: '#fff', 'stroke-width': 3 }));
  svg.append(el('path', { d: path(t => wiebe(t) * 100, Ym), fill: 'none', stroke: '#FF3B3B', 'stroke-width': 3 }));
  [[t10, 10], [t50, 50], [t90, 90]].forEach(([t, f]) => svg.append(el('circle', { cx: X(t), cy: Ym(f), r: 6, fill: '#050505', stroke: '#FF3B3B', 'stroke-width': 2.4 })));
  /* legenda fora das curvas, embaixo */
  [['Pressão com combustão', '#fff', ''], ['Pressão motorada (sem combustão)', W + '.75)', '8 6'], ['MFB (%)', '#FF3B3B', ''], ['desenvolvimento inicial (0–10 %)', 'rgba(120,180,140,.5)', 'band'], ['queima rápida (10–90 %)', 'rgba(223,37,49,.45)', 'band']]
    .forEach(([t, c, d], i) => {
      const x = 60 + (i % 3) * 380, y = h - 22 + (i < 3 ? -26 : 0);
      if (d === 'band') svg.append(el('rect', { x, y: y - 11, width: 32, height: 10, fill: c }));
      else svg.append(el('line', { x1: x, x2: x + 32, y1: y - 5, y2: y - 5, stroke: c, 'stroke-width': 3, 'stroke-dasharray': d }));
      txt(svg, x + 42, y, t, { a: 'start', s: 13.5 });
    });
  host.replaceChildren(svg);
}
