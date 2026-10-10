/* atlas-v7 · orquestra a página. Cada tela tem seu bloco; módulos pesados (3D, modo apresentação) entram por import dinâmico. */
import { initLean } from './lean.js';
import { easeOut, easeInOut } from './util.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
document.documentElement.classList.remove('no-js');

/* ---------- revelação (sobe 12 px + opacidade, escalonada por grupo) ---------- */
const revealIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target, sib = $$('.rv', el.parentElement);
  el.style.setProperty('--i', Math.max(0, sib.indexOf(el)));
  el.classList.add('is-in'); revealIO.unobserve(el);
  $$('[data-count]', el).concat(el.matches('[data-count]') ? [el] : []).forEach(countUp);
}), { rootMargin: '0px 0px -8% 0px' });
$$('.rv').forEach(el => revealIO.observe(el));

/* ---------- números-totem contam uma vez (mesma casa decimal) ---------- */
function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const end = +el.dataset.count, dec = +(el.dataset.dec || 0), fmt = v => v.toFixed(dec).replace('.', ',');
  if (reduced) { el.textContent = fmt(end); return; }
  const t0 = performance.now(), dur = 850;
  const tick = now => { const t = Math.min(1, (now - t0) / dur); el.textContent = fmt(end * easeOut(t)); if (t < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}

/* ---------- barra: fundo ao rolar, fio de progresso, item do capítulo aceso ---------- */
const bar = $('#bar'), prog = $('.progress span');
const onScroll = () => {
  const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
  bar.classList.toggle('is-scrolled', y > 40);
  prog.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
};
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const navLinks = $$('.nav a'), tabLinks = $$('.tabs [data-tab]');
const navIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const sec = e.target, key = sec.dataset.nav || '';
  navLinks.forEach(a => a.classList.toggle('is-on', a.dataset.nav === key));
  const tab = ['t00', 't01'].includes(sec.id) ? 'resumo' : ['t10', 't11'].includes(sec.id) ? 'autores' : 'capitulos';
  tabLinks.forEach(t => t.classList.toggle('is-on', t.dataset.tab === tab));
}), { rootMargin: '-45% 0px -50% 0px' });
$$('.act').forEach(s => navIO.observe(s));

/* ---------- T00: feixe, impacto e jatos sobre a foto real ---------- */
const hero = $('#t00'), heroImg = $('.hero-bg img');
/* pontos na foto 02 (3840 × 2160): corpo da peça e ponta com os orifícios, em fração da imagem */
const BODY = [0.485, 0.505], TIP = [0.718, 0.60];
function placeHero() {
  const W = hero.clientWidth, H = hero.clientHeight, iw = 3840, ih = 2160;
  const s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
  const pos = getComputedStyle(heroImg).objectPosition.split(' ').map(v => parseFloat(v) / 100);
  const ox = (W - dw) * pos[0], oy = (H - dh) * pos[1];
  const map = ([fx, fy]) => [(ox + fx * dw) / W * 100, (oy + fy * dh) / H * 100];
  const [bx, by] = map(BODY), [tx, ty] = map(TIP);
  hero.style.setProperty('--beam-x', bx + '%'); hero.style.setProperty('--beam-h', (by - 4) + '%');
  hero.style.setProperty('--tip-x', tx + '%'); hero.style.setProperty('--tip-y', ty + '%');
}
const lightHero = () => { placeHero(); requestAnimationFrame(() => hero.classList.add('is-lit')); };
heroImg.complete ? lightHero() : heroImg.addEventListener('load', lightHero, { once: true });
addEventListener('resize', placeHero);
if (finePointer && !reduced) {
  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
    heroImg.style.transform = `translate3d(${-dx * 12}px,${-dy * 8}px,0) scale(1.02)`;
  });
}

/* ---------- T02: gráfico λ real (componente do atlas-v6) ---------- */
initLean($('#t02'), { reduced });

/* ---------- T03: passos ↔ figura (quadros ilustrativos; o 3D do CAD assume quando carregar) ---------- */
const t03 = $('#t03'), t03steps = $$('.lstep', t03), frames = $$('.cut-frame', t03), dots = $$('.dots i', t03);
let cad03 = null, step03 = 0;
function setStep03(n) {
  if (n === step03) return; step03 = n;
  t03steps.forEach(s => s.classList.toggle('is-on', +s.dataset.step === n));
  frames.forEach(f => f.classList.toggle('is-on', +f.dataset.step === n));
  dots.forEach((d, i) => d.classList.toggle('is-on', i === n - 1));
  cad03?.setStep(n);
}
const t03IO = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && setStep03(+e.target.dataset.step)), { rootMargin: '-45% 0px -45% 0px' });
t03steps.forEach(s => t03IO.observe(s));
setStep03(1);
/* modo apresentação: o controlador avisa o passo (a T02 segue pelo observador do lean.js) */
t03.addEventListener('present:step', e => setStep03(e.detail.step));

/* ---------- T04: comparador passiva × ativa ---------- */
const cmp = $('#cmp'), range = $('.cmp-range', cmp);
const setPos = v => cmp.style.setProperty('--pos', v + '%');
range.addEventListener('input', () => setPos(range.value));
let dragged = false;   // depois de um arraste, o deslize automático só volta quando o cursor sai do palco
if (finePointer) {
  const stage = $('.cmp-stage', cmp);
  stage.addEventListener('pointerleave', () => { dragged = false; });
  stage.addEventListener('pointermove', e => {
    if (e.buttons || dragged) return;
    const r = e.currentTarget.getBoundingClientRect(), f = (e.clientX - r.left) / r.width;
    if (f < .25) animatePos(78); else if (f > .75) animatePos(22);
  });
}
let posAnim = 0, posTarget = null;
function animatePos(to, dur = 500) {
  if (reduced) { range.value = to; setPos(to); return; }
  if (to === posTarget && (posAnim || +range.value === to)) return;   // já está indo (ou já chegou) a esse alvo: não reinicia a curva
  cancelAnimationFrame(posAnim); posTarget = to;
  const from = +range.value, t0 = performance.now();
  const tick = now => {
    const t = Math.min(1, (now - t0) / dur), v = from + (to - from) * easeInOut(t);
    range.value = v; setPos(v);
    posAnim = t < 1 ? requestAnimationFrame(tick) : 0;
  };
  posAnim = requestAnimationFrame(tick);
}
range.addEventListener('pointerdown', () => { cancelAnimationFrame(posAnim); posAnim = 0; posTarget = null; dragged = true; });
new IntersectionObserver((es, o) => es.forEach(e => {
  if (!e.isIntersecting) return; o.disconnect();
  if (!reduced) { animatePos(64, 600); setTimeout(() => animatePos(50, 600), 700); }
}), { threshold: .6 }).observe(cmp);

/* ---------- T05: paralaxe leve em camadas (o 3D completo fica para depois) ---------- */
const t05 = $('#t05');
if (!reduced) {
  const plate = $('.t05-plate', t05);
  let top05 = 0, h05 = 1;   // medidas guardadas no redimensionamento: a rolagem não lê o layout (evita reflow forçado a cada evento)
  const measure05 = () => { const r = t05.getBoundingClientRect(); top05 = r.top + scrollY; h05 = r.height; };
  measure05(); addEventListener('resize', measure05);
  new ResizeObserver(measure05).observe(document.body);   // qualquer mudança de altura acima da T05 (fontes, tabela do λ, 3D) remede
  const p05 = () => {
    const f = 1 - (top05 - scrollY + h05) / (innerHeight + h05);
    if (f < 0 || f > 1) return;
    t05.style.setProperty('--py', `${(f - .5) * -40}px`);
    t05.style.setProperty('--glow', (.45 + f * .5).toFixed(2));
  };
  addEventListener('scroll', p05, { passive: true }); p05();
  if (finePointer) t05.addEventListener('pointermove', e => {
    const r = t05.getBoundingClientRect(); plate.style.translate = `${((e.clientX - r.left) / r.width - .5) * -18}px 0`;
  });
}

/* ---------- T03 e T06: 3D do CAD (carrega quando a seção se aproxima) ---------- */
function lazyCad(el, mode, onReady, onFail = () => {}, onStart = () => {}) {
  new IntersectionObserver(async (es, o) => {
    if (!es.some(e => e.isIntersecting)) return; o.disconnect();
    onStart();
    let v = null;
    try {
      const { createCadViewer } = await import('./cad.js');
      v = await createCadViewer(el, { mode, reduced });
    } catch (err) { console.warn('3D indisponível, mantém a imagem:', err); }
    v ? onReady(v) : onFail();
  }, { rootMargin: '600px 0px' }).observe(el);
}
lazyCad($('#cad-t03'), 't03', v => { cad03 = v; v.setStep(step03 || 1); });
const segBtns = $$('[data-cad]'), seg = $('.seg'), stageCap = $('.stage-cap'), capPronto = stageCap?.textContent;
lazyCad($('#cad-t06'), 't06', v => {
  /* chegou: legenda de uso e controles liberados */
  if (stageCap) stageCap.textContent = capPronto;
  segBtns.forEach(b => { b.disabled = false; });
  segBtns.forEach(b => b.addEventListener('click', () => {
    segBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    v.setMode(b.dataset.cad);
  }));
}, () => {
  /* sem 3D: fica a foto; os controles saem e a legenda deixa de pedir para arrastar */
  seg.hidden = true;
  if (stageCap) stageCap.textContent = 'A pré-câmara usinada. O modelo 3D não está disponível neste aparelho.';
}, () => {
  /* carregando (three.js + malha, ~2,4 MB): a legenda avisa e os botões esperam */
  if (stageCap) stageCap.textContent = 'Carregando o modelo 3D…';
  segBtns.forEach(b => { b.disabled = true; });
});

/* ---------- lightbox (foto na resolução do arquivo, nunca ampliada) ---------- */
const lb = $('#lightbox'), lbImg = $('img', lb);
$$('[data-lightbox]').forEach(b => b.addEventListener('click', () => {
  lbImg.src = b.dataset.lightbox; lbImg.alt = b.dataset.alt || '';
  lb.showModal();
}));
$('.lb-close', lb).addEventListener('click', () => lb.close());
lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });

/* ---------- abas do celular e índice dos capítulos ---------- */
const toc = $('#toc'), tocBtn = $('[data-tab="capitulos"]');
tocBtn.addEventListener('click', () => { const open = toc.hidden; toc.hidden = !open; tocBtn.setAttribute('aria-expanded', String(open)); });
$$('a', toc).forEach(a => a.addEventListener('click', () => { toc.hidden = true; tocBtn.setAttribute('aria-expanded', 'false'); }));
document.addEventListener('click', e => { if (!toc.hidden && !toc.contains(e.target) && !tocBtn.contains(e.target)) { toc.hidden = true; tocBtn.setAttribute('aria-expanded', 'false'); } });

/* ---------- gráficos vivos da T08 (tendência E5 e pressão/MFB E6) ---------- */
import('./charts.js').then(m => { m.drawE5($('#chart-e5')); m.drawE6($('#chart-e6')); }).catch(() => {});

/* ---------- modo apresentação ---------- */
import('./present.js').then(m => m.initPresent({ reduced })).catch(err => console.warn('modo apresentação indisponível', err));
