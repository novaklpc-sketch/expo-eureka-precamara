/* Capítulo 01 · texto ↔ gráfico do limite pobre.
 * Ida: o passo mais próximo do centro da tela acende (trilho vermelho) e leva o cursor λ até o seu valor em
 * 600 ms, ease-out; o λ do cartão conta junto e, na chegada, o gráfico marca os pontos com um anel.
 * Volta: ponteiro ou teclado sobre o gráfico realçam o cartão cujo intervalo de λ contém o cursor.
 * Movimento reduzido: sem contagem nem anel; só a troca de estado.
 */
import { initLeanChart, leanTable } from './chart.js';

const DUR = 600, easeOut = t => 1 - Math.pow(1 - t, 4);
const fmt = l => l.toFixed(2).replace('.', ',');

export function initLean(section, { reduced = false } = {}) {
  const host = section.querySelector('#lean-chart'), table = section.querySelector('#lean-table');
  if (!host) return null;
  const steps = [...section.querySelectorAll('.lstep')];
  const lambdas = steps.map(s => +s.dataset.lambda);
  const labels = steps.map(s => s.querySelector('.lstep-l'));
  const original = labels.map(l => l.textContent);
  /* volta: o cartão cujo intervalo de λ contém o cursor do ponteiro/teclado */
  const near = l => {
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
  const go = i => {
    if (i === active) return;
    if (active >= 0) labels[active].textContent = original[active];
    active = i; to = lambdas[i];
    steps.forEach((s, k) => s.classList.toggle('is-on', k === i));
    if (reduced) { from = to; chart.setLambda(to); return; }
    from = +host.dataset.lambda || from; t0 = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) go(steps.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(s => io.observe(s));
  return { go };
}
