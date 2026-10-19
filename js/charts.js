/* Gráficos da T08, desenhados em SVG (escaláveis, sem imagem).
 * E5 · CoV da IMEP × λ. Vela = pontos medidos com o motor original (os autores, 2026; js/dados-vela.js), até λ 1,4;
 *      pré-câmara ativa = curvas qualitativas ancoradas nos limites de Zhu et al. (2022): 1,94 (líquido) e 2,12 (vaporizado).
 * E6 · pressão no cilindro + fração queimada × ângulo, medidas com a vela em λ = 1,4 (média de 200 ciclos) e ensaio
 *      arrastado a 2500 rpm; marcos = médias ciclo a ciclo (centelha do mapa da gestão). Dados em js/dados-vela.js. */
import { el } from './chart.js';
import { VELA } from './dados-vela.js';
const W = 'rgba(255,255,255,', MONO = 'var(--f-mono)', SANS = 'var(--f-sans)';
const txt = (g, x, y, s, o = {}) => g.append(el('text', { x, y, fill: o.c || W + '.8)', 'font-size': o.s || 13, 'font-family': o.f || SANS, 'text-anchor': o.a || 'middle', 'font-weight': o.w || 400 }, s));
const br = v => String(v).replace('.', ',').replace('-', '−');
// telas estreitas (celular): desenho próprio, com letras legíveis; redesenha se a largura cruzar o limite
const ESTREITO = 560;
const alt = host => host.dataset.alt ?? (host.dataset.alt = host.querySelector('img')?.alt || '');
function acompanha(host, desenha) {
  let estreito = null;
  const vez = () => { const e = host.clientWidth > 0 && host.clientWidth < ESTREITO; if (e === estreito) return; estreito = e; const [svg, w, h] = desenha(e); host.style.aspectRatio = `${w}/${h}`; host.replaceChildren(svg); };
  vez(); new ResizeObserver(vez).observe(host);
}

export function drawE5(host) {
  if (host) acompanha(host, e => desenhaE5(alt(host), e));
}

function desenhaE5(rotulo, e) {
  const w = e ? 340 : 1200, h = e ? 478 : 300, svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': rotulo });
  const tx = e ? 2 : 8, fs = e ? 12.5 : 13.5, lh = e ? 17.5 : 19;
  txt(svg, tx, e ? 14 : 34, 'VELA MEDIDA · PRÉ-CÂMARA ESPERADA', { a: 'start', f: MONO, s: e ? 10.5 : 12, c: '#FF5A4F' });
  txt(svg, tx, e ? 40 : 64, 'Até onde a mistura pode empobrecer', { a: 'start', s: e ? 16.5 : 20, w: 600, c: '#fff' });
  (e ? ['Pontos: CoV da IMEP medido com a vela', 'original. A varredura parou em λ = 1,4, pela', 'fase da combustão e pela detonação, ainda', 'abaixo de 5 %. Curvas da pré-câmara ativa:', 'limites de Zhu et al. (2022), líquido', '(λ = 1,94) e vaporizado (2,12); os dados deste', 'motor entram quando os ensaios terminarem.']
     : ['Pontos: CoV da IMEP medido com a vela original. A', 'varredura parou em λ = 1,4, pela fase da combustão e', 'pela detonação, ainda abaixo de 5 %. Curvas da pré-', 'câmara ativa: limites de Zhu et al. (2022), líquido', '(λ = 1,94) e vaporizado (2,12); os dados deste motor', 'entram quando os ensaios terminarem.'])
    .forEach((l, i) => txt(svg, tx, (e ? 66 : 96) + i * lh, l, { a: 'start', s: fs, c: W + '.68)' }));
  txt(svg, tx, e ? 194 : 226, 'Fontes: os autores, 2026 (vela, medido); Zhu et al. (2022).', { a: 'start', s: e ? 10.5 : 11.5, c: W + '.42)' });
  const P = e ? { l: 34, r: w - 6, t: 226, b: 382 } : { l: 470, r: w - 20, t: 24, b: h - 40 }, L0 = .9, L1 = 2.3, Y1 = 10;
  const ft = e ? 10.5 : 12;
  const X = l => P.l + (l - L0) / (L1 - L0) * (P.r - P.l), Y = v => P.b - Math.min(v, Y1) / Y1 * (P.b - P.t);
  for (let l = 1; l <= 2.21; l += .2) { svg.append(el('line', { x1: X(l), x2: X(l), y1: P.t, y2: P.b, stroke: W + '.07)' })); txt(svg, X(l), P.b + (e ? 17 : 20), br(l.toFixed(1)), { f: MONO, s: ft, c: W + '.5)' }); }
  txt(svg, P.r, P.b + (e ? 17 : 20), 'λ', { f: MONO, s: ft, a: 'end', c: W + '.5)' });
  svg.append(el('line', { x1: P.l, x2: P.r, y1: P.b, y2: P.b, stroke: W + '.3)' }));
  if (e) txt(svg, P.l - 4, P.t - 8, 'CoV IMEP (%)', { f: MONO, s: ft, a: 'start', c: W + '.5)' });
  else txt(svg, P.l - 10, P.t + 10, 'CoV IMEP (%)', { f: MONO, s: 12, a: 'end', c: W + '.5)' });
  svg.append(el('line', { x1: P.l, x2: P.r, y1: Y(5), y2: Y(5), stroke: '#FF5A4F', 'stroke-dasharray': '5 5' }));
  txt(svg, P.l - (e ? 5 : 10), Y(5) + 4, '5 %', { f: MONO, s: ft, a: 'end', c: '#FF5A4F' });
  const k = (5 - (1 + .45 * (1.94 - .9))) / (1.94 - 1.7) ** 2.4, ativa = l => 1 + .45 * (l - .9) + k * Math.max(0, l - 1.7) ** 2.4;
  /* combustível vaporizado: mesma forma, cruza 5 % em 2,12 (curva tracejada, mais clara) */
  const kv = (5 - (1 + .45 * (2.12 - .9))) / (2.12 - 1.85) ** 2.4, vapor = l => 1 + .45 * (l - .9) + kv * Math.max(0, l - 1.85) ** 2.4;
  const LV = VELA.cov.lam[VELA.cov.lam.length - 1];
  svg.append(el('rect', { x: X(LV), y: P.t, width: X(1.94) - X(LV), height: P.b - P.t, fill: 'rgba(223,37,49,.10)' }));
  svg.append(el('rect', { x: X(1.94), y: P.t, width: X(2.12) - X(1.94), height: P.b - P.t, fill: 'rgba(223,37,49,.04)' }));
  txt(svg, (X(LV) + X(1.94)) / 2, P.t + 16, e ? 'EXTENSÃO' : 'EXTENSÃO ESPERADA', { f: MONO, s: e ? 10 : 11, c: 'rgba(255,90,79,.9)' });
  const path = f => { let d = ''; for (let l = L0; l <= L1; l += .005) { const v = f(l); d += (d ? 'L' : 'M') + X(l).toFixed(1) + ' ' + Y(v).toFixed(1); if (v > Y1) break; } return d; };
  /* vela: pontos medidos, ligados por linha fina */
  svg.append(el('path', { d: VELA.cov.lam.map((l, i) => (i ? 'L' : 'M') + X(l).toFixed(1) + ' ' + Y(VELA.cov.cov[i]).toFixed(1)).join(''), fill: 'none', stroke: W + '.8)', 'stroke-width': 1.6 }));
  VELA.cov.lam.forEach((l, i) => svg.append(el('circle', { cx: X(l), cy: Y(VELA.cov.cov[i]), r: 4.5, fill: '#050505', stroke: '#fff', 'stroke-width': 1.8 })));
  svg.append(el('line', { x1: X(LV), x2: X(LV), y1: P.t + 24, y2: P.b, stroke: W + '.55)', 'stroke-dasharray': '2 4' }));
  svg.append(el('path', { d: path(vapor), fill: 'none', stroke: 'rgba(255,90,79,.6)', 'stroke-width': 1.8, 'stroke-dasharray': '6 5' }));
  svg.append(el('path', { d: path(ativa), fill: 'none', stroke: '#FF3B3B', 'stroke-width': 2.6 }));
  const marcas = [[1.94, 'ativa, líquido · λ = 1,94', '#FF5A4F', -8, 0], [2.12, 'vaporizado · 2,12', 'rgba(255,90,79,.75)', 8, 1]];
  marcas.forEach(([l, , c, , oco]) => svg.append(el('circle', { cx: X(l), cy: Y(5), r: e ? 4.5 : 5, fill: oco ? 'none' : c, stroke: c, 'stroke-width': 1.6 })));
  if (!e) {
    txt(svg, X(LV) - 8, Y(5) - 11, 'vela, medido · λ = 1,4', { s: 13, w: 500, c: '#fff', a: 'end' });
    marcas.forEach(([l, r, c, dx]) => txt(svg, X(l) + dx, Y(5) - 11, r, { s: 13, w: 500, c, a: dx < 0 ? 'end' : 'start' }));
    return [svg, w, h];
  }
  /* celular: legenda embaixo, no lugar dos rótulos sobre as curvas */
  [['vela, medido · λ 1,0 a 1,4', '#fff', 'ponto'], ['ativa, líquido · λ = 1,94', '#FF3B3B', ''], ['ativa, vaporizado · λ = 2,12', 'rgba(255,90,79,.75)', '6 5']]
    .forEach(([r, c, d], i) => {
      const y = P.b + 44 + i * 18;
      if (d === 'ponto') svg.append(el('circle', { cx: tx + 12, cy: y - 4, r: 4, fill: '#050505', stroke: c, 'stroke-width': 1.6 }));
      else svg.append(el('line', { x1: tx, x2: tx + 24, y1: y - 4, y2: y - 4, stroke: c, 'stroke-width': 2.2, 'stroke-dasharray': d }));
      txt(svg, tx + 34, y, r, { a: 'start', s: 12, c: W + '.8)' });
    });
  return [svg, w, h];
}

export function drawE6(host) {
  if (host) acompanha(host, e => desenhaE6(alt(host), e));
}

function desenhaE6(rotulo, e) {
  const D = VELA.e6, M = D.marcos;
  const w = e ? 340 : 1200, h = e ? 470 : 780, svg = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': rotulo });
  const P = e ? { l: 36, r: w - 40, t: 58, b: 290 } : { l: 100, r: w - 110, t: 120, b: h - 160 };
  const ft = e ? 10.5 : 14, passo = e ? 30 : 15;
  const X = th => P.l + (th + 60) / 150 * (P.r - P.l), Yp = v => P.b - v / 50 * (P.b - P.t), Ym = v => P.b - v / 100 * (P.b - P.t);
  for (let th = -60; th <= 90; th += passo) { svg.append(el('line', { x1: X(th), x2: X(th), y1: P.t, y2: P.b, stroke: W + '.08)' })); txt(svg, X(th), P.b + (e ? 16 : 26), br(th), { f: MONO, s: ft }); }
  for (let v = 0; v <= 50; v += 10) { svg.append(el('line', { x1: P.l, x2: P.r, y1: Yp(v), y2: Yp(v), stroke: W + '.08)' })); txt(svg, P.l - (e ? 6 : 14), Yp(v) + (e ? 4 : 5), v, { f: MONO, s: ft, a: 'end' }); txt(svg, P.r + (e ? 6 : 14), Yp(v) + (e ? 4 : 5), v * 2, { f: MONO, s: ft, a: 'start', c: '#FF7A6F' }); }
  svg.append(el('rect', { x: P.l, y: P.t, width: P.r - P.l, height: P.b - P.t, fill: 'none', stroke: W + '.3)' }));
  svg.append(el('rect', { x: X(M.centelha), y: P.t, width: X(M.ca10) - X(M.centelha), height: P.b - P.t, fill: 'rgba(120,180,140,.07)' }));
  svg.append(el('rect', { x: X(M.ca10), y: P.t, width: X(M.ca90) - X(M.ca10), height: P.b - P.t, fill: 'rgba(223,37,49,.08)' }));
  txt(svg, (P.l + P.r) / 2, P.b + (e ? 38 : 56), 'Ângulo do virabrequim (° em relação ao PMS)', { s: e ? 11.5 : 16 });
  svg.append(el('text', { x: 0, y: 0, fill: W + '.8)', 'font-size': e ? 11 : 16, 'text-anchor': 'middle', 'font-family': SANS, transform: `translate(${e ? 9 : P.l - 62},${(P.t + P.b) / 2}) rotate(-90)` }, 'Pressão no cilindro (bar)'));
  svg.append(el('text', { x: 0, y: 0, fill: '#FF7A6F', 'font-size': e ? 11 : 16, 'text-anchor': 'middle', 'font-family': SANS, transform: `translate(${e ? w - 6 : P.r + 66},${(P.t + P.b) / 2}) rotate(90)` }, 'Fração queimada (%)'));
  const vl = (th, c, d) => svg.append(el('line', { x1: X(th), x2: X(th), y1: P.t, y2: P.b, stroke: c, 'stroke-dasharray': d, 'stroke-width': 1.2 }));
  vl(0, W + '.4)', '2 4'); vl(M.centelha, W + '.7)', '6 4'); [M.ca10, M.ca50, M.ca90].forEach(t => vl(t, 'rgba(255,90,79,.6)', '4 4'));
  txt(svg, X(0) + (e ? 4 : 6), P.b - (e ? 6 : 8), 'PMS', { f: MONO, s: e ? 9.5 : 12, a: 'start', c: W + '.55)' });
  /* marcos no eixo de cima: médias ciclo a ciclo de λ = 1,4 */
  const sg = v => (v > 0 ? '+' : '') + br(v.toFixed(1));
  [[M.centelha, 'centelha', sg(M.centelha) + '°'], [M.ca10, 'CA10', sg(M.ca10) + '°'], [M.ca50, 'CA50', sg(M.ca50) + '°'], [M.ca90, 'CA90', sg(M.ca90) + '°']]
    .forEach(([t, a, b], i) => { const c = i ? '#FF5A4F' : W + '.8)'; txt(svg, X(t), P.t - (e ? 26 : 34), a, { s: e ? 10.5 : 13, c }); txt(svg, X(t), P.t - (e ? 11 : 16), b, { f: MONO, s: e ? 9.5 : 12, c }); });
  const path = (ys, Y) => D.theta.map((t, k) => (k ? 'L' : 'M') + X(t).toFixed(1) + ' ' + Y(ys[k]).toFixed(1)).join('');
  svg.append(el('path', { d: path(D.pArr, Yp), fill: 'none', stroke: W + '.75)', 'stroke-width': e ? 1.5 : 2, 'stroke-dasharray': e ? '5 4' : '8 6' }));
  svg.append(el('path', { d: path(D.p, Yp), fill: 'none', stroke: '#fff', 'stroke-width': e ? 2 : 3 }));
  svg.append(el('path', { d: path(D.mfb.map(v => v * 100), Ym), fill: 'none', stroke: '#FF3B3B', 'stroke-width': e ? 2 : 3 }));
  /* no celular, a pressão máxima vai para baixo da legenda (sobre o gráfico, cruzaria os marcos) */
  if (e) txt(svg, 4, P.b + 70 + 5 * 18 + 4, `λ = 1,4 · Pmáx ${br(M.pmax.toFixed(1))} bar a ${sg(M.apmax)}°`, { f: MONO, s: 10.5, a: 'start', c: W + '.8)' });
  else txt(svg, X(66), P.t + 62, `λ = 1,4 · Pmáx ${br(M.pmax.toFixed(1))} bar a ${sg(M.apmax)}°`, { f: MONO, s: 13, c: W + '.8)' });
  /* legenda fora das curvas, embaixo */
  [['Pressão com combustão (vela, λ = 1,4)', '#fff', ''], ['Pressão arrastada (2500 rpm)', W + '.75)', '8 6'], ['Fração mássica queimada (%)', '#FF3B3B', ''], ['desenvolvimento inicial (centelha a 10 %)', 'rgba(120,180,140,.5)', 'band'], ['queima rápida (10–90 %)', 'rgba(223,37,49,.45)', 'band']]
    .forEach(([t, c, d], i) => {
      /* no celular, uma coluna embaixo do eixo */
      const x = e ? 4 : 60 + (i % 3) * 380, y = e ? P.b + 70 + i * 18 : h - 22 + (i < 3 ? -26 : 0), lw = e ? 24 : 32;
      if (d === 'band') svg.append(el('rect', { x, y: y - (e ? 9 : 11), width: lw, height: e ? 8 : 10, fill: c }));
      else svg.append(el('line', { x1: x, x2: x + lw, y1: y - (e ? 4 : 5), y2: y - (e ? 4 : 5), stroke: c, 'stroke-width': e ? 2.2 : 3, 'stroke-dasharray': e && d ? '5 4' : d }));
      txt(svg, x + lw + 10, y, t, { a: 'start', s: e ? 12 : 13.5 });
    });
  return [svg, w, h];
}
