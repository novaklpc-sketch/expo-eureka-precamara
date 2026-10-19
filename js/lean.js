/* Capítulo 01 · texto ↔ gráfico do limite pobre.
 * Ida: o passo mais próximo do centro da tela acende (trilho vermelho) e leva o cursor λ até o seu valor em
 * 600 ms, ease-out; o λ do cartão conta junto e, na chegada, o gráfico marca os pontos com um anel.
 * Volta: ponteiro ou teclado sobre o gráfico realçam o cartão cujo intervalo de λ contém o cursor.
 * Varredura de demonstração (spec 003, etapa 3): na primeira vez em que o gráfico aparece, o marcador percorre
 * λ 1,00 → 1,50 em 1,6 s e para; qualquer toque, ponteiro ou tecla no gráfico interrompe. Ao terminar, se um passo
 * já está ativo, o marcador volta ao valor dele (600 ms). A região viva não anuncia a varredura (só o teclado anuncia).
 * Movimento reduzido: sem contagem, sem anel e sem varredura; só a troca de estado.
 */
import { initLeanChart, leanTable } from './chart.js';
import { faixaPassos } from './util.js';

const DUR = 600, SWEEP = 1600, SWEEP_TO = 1.5;
const easeOut = t => 1 - Math.pow(1 - t, 4), easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const fmt = l => l.toFixed(2).replace('.', ',');

export function initLean(section, { reduced = false } = {}) {
  const host = section.querySelector('#lean-chart'), table = section.querySelector('#lean-table');
  if (!host) return null;
  const steps = [...section.querySelectorAll('.lstep')];
  const lambdas = steps.map(s => +s.dataset.lambda);
  const labels = steps.map(s => s.querySelector('.lstep-l'));
  const original = labels.map(l => l.textContent);
  let sweeping = false, swept = reduced;
  /* volta: o cartão cujo intervalo de λ contém o cursor do ponteiro/teclado; um gesto interrompe a varredura */
  const near = l => {
    if (sweeping && l != null) endSweep();
    steps.forEach((s, i) => {
      const lo = i ? (lambdas[i - 1] + lambdas[i]) / 2 : -Infinity, hi = i < steps.length - 1 ? (lambdas[i] + lambdas[i + 1]) / 2 : Infinity;
      s.classList.toggle('is-near', l != null && l >= lo && l < hi);
    });
    chart.setDriver(l == null ? 'text' : 'pointer');
  };
  const chart = initLeanChart(host, { onPointer: near });
  if (table) table.innerHTML = leanTable();
  chart.setDriver('text');

  let from = 1, to = 1, t0 = 0, raf = 0, active = -1;
  const frame = now => {
    const t = Math.min(1, (now - t0) / DUR), l = from + (to - from) * easeOut(t);
    chart.setLambda(l);
    if (active >= 0) labels[active].textContent = original[active].replace(/\d,\d\d/, fmt(l));
    if (t < 1) raf = requestAnimationFrame(frame);
    else { raf = 0; if (active >= 0) labels[active].textContent = original[active]; chart.pulse(); }
  };
  const seguir = () => { from = +host.dataset.lambda || from; t0 = performance.now(); if (!raf) raf = requestAnimationFrame(frame); };
  const go = i => {
    if (i === active) return;
    if (active >= 0) labels[active].textContent = original[active];
    active = i; to = lambdas[i];
    steps.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.classList.toggle('is-past', k < i); });
    if (reduced) { from = to; chart.setLambda(to); return; }
    if (sweeping) return; // o passo já acende; o marcador segue para ele quando a varredura terminar
    seguir();
  };
  /* varredura de demonstração: uma vez, quando o gráfico fica visível; interrompida por qualquer gesto no gráfico */
  const endSweep = () => {
    if (!sweeping) return; sweeping = false;
    if (active >= 0 && !reduced) seguir();
  };
  const sweep = () => {
    if (swept) return; swept = true; sweeping = true;
    const s0 = performance.now(), l0 = +host.dataset.lambda || 1;
    const passo = now => {
      if (!sweeping) return;
      const t = Math.min(1, (now - s0) / SWEEP);
      chart.setLambda(l0 + (SWEEP_TO - l0) * easeInOut(t));
      if (t < 1) requestAnimationFrame(passo); else endSweep();
    };
    requestAnimationFrame(passo);
  };
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) go(steps.indexOf(e.target)); }), { rootMargin: faixaPassos() });
  steps.forEach(s => io.observe(s));
  if (!swept) new IntersectionObserver((es, o) => { if (es.some(e => e.isIntersecting)) { o.disconnect(); sweep(); } }, { threshold: .6 }).observe(host);
  return { go, sweep: endSweep };
}
