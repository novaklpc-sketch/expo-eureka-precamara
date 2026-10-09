/* atlas-v7 · modo apresentação (estande: MacBook 1512×982 e iPad 1366×1024).
 * Liga com o botão #present-toggle, a tecla P ou ?apresentar. A página anda de ato em ato:
 * cada ato ocupa a tela (present.css) e rola só por dentro, sob controle deste módulo.
 * T02/T03: → avança o passo (centraliza o passo na tela e dispara `present:step`); depois do 4º, o próximo ato.
 * Eventos: `present:step` (na seção, detail {step, act, id}), `present:act` e `present:change` (no document).
 */

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const E_OUT = 'cubic-bezier(.16,1,.3,1)', E_INOUT = 'cubic-bezier(.77,0,.175,1)';
const IDLE_MS = 90000, ENTER_MS = 900, TAP_MS = 300;
/* elementos que têm gesto próprio (arrastar, girar, ponteiro) */
const OWN = 'input[type=range], .cmp-stage, .cad, #lean-chart';
/* toque nesses não vira navegação */
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, details, dialog, [role=button], [tabindex]:not([tabindex="-1"]), .bar, .present-ui, ' + OWN;

export function initPresent({ reduced = false } = {}) {
  const root = document.documentElement;
  const acts = $$('[data-act]').sort((a, b) => +a.dataset.act - +b.dataset.act);
  const N = acts.length;
  const btn = $('#present-toggle'), ui = $('.present-ui'), countB = $('.act-count b', ui || document);
  const t00 = $('#t00');
  if (!N) return null;

  let on = false, cur = 0, busy = false, queued = null, fsByUs = false;
  const step = new Map();                      // passo atual de cada seção scrolly
  const enterTimers = new Map();
  let idleT = 0, helpT = 0;

  /* ---------- medidas ---------- */
  const topOf = el => el.getBoundingClientRect().top + scrollY;
  const isScrolly = a => a.classList.contains('scrolly');
  const stepsOf = a => $$('.lstep[data-step]', a);
  const nSteps = a => stepsOf(a).length;
  const instantScroll = y => {          // o html tem scroll-behavior:smooth; aqui o salto é seco
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto'; scrollTo(0, y); root.style.scrollBehavior = prev;
  };
  const snap = () => instantScroll(topOf(acts[cur]));
  const actAt = y => {                  // ato sob a linha y da tela
    let best = 0, dist = Infinity;
    acts.forEach((a, i) => {
      const r = a.getBoundingClientRect();
      const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  };
  const maxIn = a => a.scrollHeight - a.clientHeight;   // rolagem interna disponível
  const PAGE_MIN = 80;                                   // abaixo disso é só respiro do padding

  /* ---------- passos (T02, T03) ---------- */
  function setStep(a, n, { smooth = false, silent = false } = {}) {
    const list = stepsOf(a); if (!list.length) return;
    n = Math.max(1, Math.min(list.length, n));
    step.set(a, n);
    a.dataset.presentStep = n;
    list.forEach(li => { const me = +li.dataset.step === n; li.classList.toggle('is-pstep', me); li.classList.toggle('is-on', me); });
    if (!silent) a.dispatchEvent(new CustomEvent('present:step', { bubbles: true, detail: { step: n, act: +a.dataset.act, id: a.id } }));
    centerStep(a, n, smooth);
  }
  function centerStep(a, n, smooth) {   // leva o passo ao centro da tela, rolando o próprio ato
    const li = $(`.lstep[data-step="${n}"]`, a); if (!li) return;
    const r = li.getBoundingClientRect(), ar = a.getBoundingClientRect();
    const target = a.scrollTop + (r.top + r.height / 2) - (ar.top + a.clientHeight / 2);
    a.scrollTo({ top: Math.max(0, Math.min(maxIn(a), target)), behavior: smooth && !reduced ? 'smooth' : 'auto' });
  }

  /* ---------- contador e fio de progresso ---------- */
  let shown = countB ? countB.textContent.trim() : '01';
  function setCount(i, dir) {
    const s = String(i + 1).padStart(2, '0');
    root.style.setProperty('--present-p', ((i + 1) / N * 100).toFixed(3) + '%');
    if (!countB || s === shown) return;
    const old = shown.padStart(2, '0'); shown = s;
    if (reduced || !countB.animate) { countB.textContent = s; return; }
    countB.textContent = '';
    [...s].forEach((d, k) => {
      if (old[k] === d) { countB.append(d); return; }
      const box = document.createElement('span'), col = document.createElement('span');
      box.className = 'pc-d'; col.className = 'pc-col';
      col.innerHTML = dir >= 0 ? `<i>${old[k]}</i><i>${d}</i>` : `<i>${d}</i><i>${old[k]}</i>`;
      box.append(col); countB.append(box);
      const kf = dir >= 0 ? ['translateY(0)', 'translateY(-50%)'] : ['translateY(-50%)', 'translateY(0)'];
      col.animate(kf.map(transform => ({ transform })), { duration: 300, easing: E_OUT, fill: 'forwards' })
        .finished.then(() => { if (shown === s) countB.textContent = s; }).catch(() => {});
    });
  }

  /* ---------- troca de ato ---------- */
  const anim = (el, kf, o) => el.animate(kf, { fill: 'forwards', ...o });
  function markEntering(a) {
    clearTimeout(enterTimers.get(a));
    a.classList.remove('is-entering'); void a.offsetWidth; a.classList.add('is-entering');
    enterTimers.set(a, setTimeout(() => a.classList.remove('is-entering'), ENTER_MS));
    if (a === t00 && !reduced && t00.classList.contains('is-lit')) {   // feixe e jatos disparam de novo
      t00.classList.remove('is-lit'); void t00.offsetWidth; t00.classList.add('is-lit');
    }
  }
  function warm(i) {                    // imagens dos vizinhos começam a carregar antes de serem pedidas
    [i - 1, i + 1].forEach(k => acts[k] && $$('img[loading="lazy"]', acts[k]).forEach(img => { img.loading = 'eager'; }));
  }
  function place(a, how) {              // posição interna do ato ao chegar
    if (isScrolly(a) && nSteps(a)) setStep(a, how === 'end' ? nSteps(a) : how === 'keep' ? (step.get(a) || currentOn(a)) : 1);
    else a.scrollTop = how === 'end' ? maxIn(a) : how === 'keep' ? a.scrollTop : 0;
  }
  const currentOn = a => +($('.lstep.is-on', a)?.dataset.step || 1);
  function arrive(i, dir) {
    cur = i;
    root.dataset.presentAct = i + 1;
    setCount(i, dir); warm(i);
    document.dispatchEvent(new CustomEvent('present:act', { detail: { index: i, act: i + 1, id: acts[i].id, section: acts[i], step: step.get(acts[i]) || null } }));
  }

  async function go(i, { dir, how = 'start', instant = false } = {}) {
    if (typeof i === 'string') i = acts.findIndex(a => a.id === i.replace('#', ''));
    i = Math.max(0, Math.min(N - 1, i | 0));
    if (!on) { cur = i; return; }
    if (busy) { queued = () => go(i, { dir, how, instant }); return; }
    dir = dir ?? (i >= cur ? 1 : -1);
    const from = acts[cur], to = acts[i];
    if (i === cur && !instant) { place(to, how); return; }
    busy = true;
    setCount(i, dir);
    const prepare = () => { snap0(to); place(to, how); };
    try {
      if (instant || !from.animate) { prepare(); }
      else if (reduced) {
        const a = anim(from, [{ opacity: 1 }, { opacity: 0 }], { duration: 100, easing: 'linear' });
        await a.finished; prepare(); a.cancel();
        await anim(to, [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear' }).finished.then(x => x.cancel());
      } else {
        const a = anim(from, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-8 * dir}%)`, opacity: 0 }], { duration: 350, easing: E_INOUT });
        await a.finished; prepare(); a.cancel();
        markEntering(to);
        await anim(to, [{ transform: `translateY(${8 * dir}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 450, easing: E_OUT }).finished.then(x => x.cancel());
      }
      if (instant || reduced) markEntering(to);
    } catch { /* animação cancelada */ }
    if (!on) { busy = false; return; }  // saiu do modo no meio da troca: não mexe mais na rolagem
    arrive(i, dir);
    busy = false;
    if (Math.abs(scrollY - topOf(to)) >= 2) snap();   // outro módulo rolou a janela durante a troca
    if (queued) { const q = queued; queued = null; q(); }
  }
  function snap0(a) { instantScroll(topOf(a)); }

  function pageTo(a, d) {               // 80 % da tela por vez; um resto pequeno entra na mesma página
    const page = a.clientHeight * 0.8, max = maxIn(a);
    let y = a.scrollTop + d * page;
    if (max - y < page * 0.3) y = max;
    if (y < page * 0.3) y = 0;
    return Math.max(0, Math.min(max, y));
  }
  function next() {
    if (!on) return;
    if (busy) { queued = next; return; }
    const a = acts[cur];
    if (isScrolly(a) && nSteps(a)) {
      const n = step.get(a) || 1;
      if (n < nSteps(a)) return setStep(a, n + 1, { smooth: true });
    } else if (maxIn(a) > PAGE_MIN && a.scrollTop < maxIn(a) - 4) {   // ato mais alto que a tela: página seguinte
      return a.scrollTo({ top: pageTo(a, 1), behavior: reduced ? 'auto' : 'smooth' });
    }
    if (cur < N - 1) go(cur + 1, { dir: 1, how: 'start' });
  }
  function prev() {
    if (!on) return;
    if (busy) { queued = prev; return; }
    const a = acts[cur];
    if (isScrolly(a) && nSteps(a)) {
      const n = step.get(a) || 1;
      if (n > 1) return setStep(a, n - 1, { smooth: true });
    } else if (maxIn(a) > PAGE_MIN && a.scrollTop > 4) {
      return a.scrollTo({ top: pageTo(a, -1), behavior: reduced ? 'auto' : 'smooth' });
    }
    if (cur > 0) go(cur - 1, { dir: -1, how: 'end' });
  }

  /* ---------- entrar e sair ---------- */
  function enter({ start } = {}) {
    if (on) return;
    const i = start ?? actAt(innerHeight / 2);
    const stepWas = isScrolly(acts[i]) ? currentOn(acts[i]) : 1;
    on = true; cur = i;
    bindBlocking();
    root.setAttribute('data-present', '');
    btn && (btn.textContent = 'Sair', btn.setAttribute('aria-pressed', 'true'));
    acts.forEach(a => { a.scrollTop = 0; });
    snap();
    if (isScrolly(acts[i])) { step.set(acts[i], stepWas); place(acts[i], 'keep'); }
    shown = ''; setCount(i, 1);
    arrive(i, 1); markEntering(acts[i]);
    ui?.classList.remove('is-quiet'); clearTimeout(helpT);
    helpT = setTimeout(() => ui?.classList.add('is-quiet'), 6000);
    document.dispatchEvent(new CustomEvent('present:change', { detail: { on: true } }));
    dispatchEvent(new Event('resize'));
    requestAnimationFrame(() => requestAnimationFrame(resnap));   // fontes e imagens que chegam depois
    if (document.readyState !== 'complete') addEventListener('load', resnap, { once: true });
    armIdle();
  }
  function exit() {
    if (!on) return;
    const a = acts[cur], n = step.get(a);
    acts.forEach(x => x.getAnimations?.().forEach(an => an.cancel()));
    busy = false; queued = null; on = false;
    unbindBlocking();
    closeIndex();
    root.removeAttribute('data-present'); delete root.dataset.presentAct;
    root.style.removeProperty('--present-p');
    btn && (btn.textContent = 'Apresentar', btn.setAttribute('aria-pressed', 'false'));
    acts.forEach(x => { x.scrollTop = 0; delete x.dataset.presentStep; $$('.is-pstep', x).forEach(li => li.classList.remove('is-pstep')); });
    t00?.classList.remove('is-attract');
    clearTimeout(idleT); clearTimeout(helpT);
    if (fsEl()) { fsByUs = true; exitFs(); }
    /* volta à rolagem normal no mesmo ato (no scrolly, com o passo no centro para o observador acender o mesmo) */
    const li = n && $(`.lstep[data-step="${n}"]`, a);
    const y = li ? topOf(li) + li.offsetHeight / 2 - innerHeight / 2 : topOf(a);
    instantScroll(Math.max(0, y));
    document.dispatchEvent(new CustomEvent('present:change', { detail: { on: false } }));
    dispatchEvent(new Event('resize'));
  }
  const toggle = () => (on ? exit() : enter());

  /* ---------- tela cheia ---------- */
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const exitFs = () => { const f = document.exitFullscreen || document.webkitExitFullscreen; try { f && Promise.resolve(f.call(document)).catch(() => {}); } catch {} };
  function toggleFs() {
    if (fsEl()) { fsByUs = true; exitFs(); return; }
    const f = root.requestFullscreen || root.webkitRequestFullscreen;
    try { f && Promise.resolve(f.call(root)).catch(() => {}); } catch {}
  }
  const onFs = () => {
    if (!fsEl() && on && !fsByUs) exit();     // Esc do navegador sai da tela cheia sem avisar a página: sai do modo também
    fsByUs = false;
  };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);

  /* ---------- índice dos atos (toque duplo) ---------- */
  const actName = a => {
    const t = a.getAttribute('aria-label') || $(`#${a.getAttribute('aria-labelledby')}`)?.textContent || $('h1, h2', a)?.textContent || a.id;
    return t.replace(/\s+/g, ' ').trim().replace(/[.:]$/, '');
  };
  let dlg = null;
  function buildIndex() {
    dlg = document.createElement('dialog');
    dlg.className = 'present-index';
    dlg.setAttribute('aria-label', 'Índice dos atos');
    dlg.innerHTML = `<p class="mono pi-lab">ÍNDICE · ${N} ATOS</p><ol class="pi-grid">${acts.map((a, i) =>
      `<li><button type="button" data-i="${i}"><b class="mono">${String(i + 1).padStart(2, '0')}</b><span>${actName(a)}</span></button></li>`).join('')}</ol>
      <button type="button" class="pi-close" aria-label="Fechar o índice">×</button>`;
    dlg.addEventListener('click', e => {
      if (e.target === dlg || e.target.closest('.pi-close')) return closeIndex();
      const b = e.target.closest('[data-i]'); if (!b) return;
      closeIndex(); go(+b.dataset.i, { how: 'start' });
    });
    document.body.append(dlg);
  }
  function openIndex() {
    if (!on) return;
    if (!dlg) buildIndex();
    $$('[data-i]', dlg).forEach(b => b.toggleAttribute('aria-current', +b.dataset.i === cur));
    if (!dlg.open) dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
    $(`[data-i="${cur}"]`, dlg)?.focus();
  }
  function closeIndex() { if (dlg?.open) dlg.close ? dlg.close() : dlg.removeAttribute('open'); }

  /* ---------- tela de espera (90 s sem toque) ---------- */
  function armIdle() {
    clearTimeout(idleT);
    if (on) idleT = setTimeout(attract, IDLE_MS);
  }
  function attract() {
    if (!on) return;
    closeIndex();
    const lit = () => setTimeout(() => { if (on && cur === 0) t00?.classList.add('is-attract'); }, 2600);   // depois da entrada completa
    if (cur !== 0) go(0, { dir: -1 }).then(lit); else lit();
  }
  let pokedAt = 0;
  const poke = () => {                  // rearma no máximo uma vez por segundo: o pointermove chega às dezenas por segundo
    if (!on) return;
    if (t00?.classList.contains('is-attract')) t00.classList.remove('is-attract');
    const now = performance.now();
    if (now - pokedAt < 1000) return;
    pokedAt = now; armIdle();
  };
  ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart'].forEach(t => addEventListener(t, poke, { passive: true, capture: true }));

  /* ---------- teclado ---------- */
  addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if ($('dialog[open]')) return;                                   // lightbox ou índice: o diálogo é dono do teclado
    const t = e.target instanceof Element ? e.target : null;
    if (t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    const k = e.key;
    if (k === 'p' || k === 'P') { e.preventDefault(); toggle(); return; }
    if (!on) return;
    const arrowsOwned = t?.closest('#lean-chart, .cad, [role=slider]');
    const isArrow = /^Arrow|^(Home|End)$/.test(k);
    if (arrowsOwned && isArrow) return;
    let act = null;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Spacebar') act = next;
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') act = prev;
    else if (k === 'Home') act = () => go(0);
    else if (k === 'End') act = () => go(N - 1);
    else if (/^[1-9]$/.test(k)) act = () => go(+k - 1);
    else if (k === '0') act = () => go(9);
    else if (k === '-') act = () => go(10);
    else if (k === 'f' || k === 'F') act = toggleFs;
    else if (k === 'Escape') act = exit;
    if (!act) return;
    e.preventDefault();
    if (k === ' ' && t?.closest('button, a, summary')) t.blur();   // espaço não aciona o botão focado
    act();
  });

  /* ---------- trackpad e roda do mouse: um gesto, um passo ---------- */
  let wAcc = 0, wLockUntil = 0, wQuietT = 0, wLocked = false;
  /* wheel e touchmove são não passivos: só ficam registrados com o modo ligado (fora dele a rolagem normal não espera o JS) */
  const onWheel = e => {
    if (!on || (e.target instanceof Element && e.target.closest('.cad'))) return;
    e.preventDefault();
    const now = performance.now();
    clearTimeout(wQuietT);
    wQuietT = setTimeout(() => { wAcc = 0; if (performance.now() >= wLockUntil) wLocked = false; }, 220);
    if (wLocked) { if (now >= wLockUntil + 900) wLocked = false; else return; }   // inércia do trackpad
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    wAcc += e.deltaMode === 1 ? d * 40 : d;
    if (Math.abs(wAcc) < 40) return;
    (wAcc > 0 ? next : prev)();
    wAcc = 0; wLocked = true; wLockUntil = now + 700;
  };
  const onTouchMove = e => {
    if (on && t0 && !t0.own && e.cancelable) e.preventDefault();   // a página não rola sozinha no modo apresentação
  };
  const bindBlocking = () => { addEventListener('wheel', onWheel, { passive: false }); addEventListener('touchmove', onTouchMove, { passive: false }); };
  const unbindBlocking = () => { removeEventListener('wheel', onWheel); removeEventListener('touchmove', onTouchMove); };

  /* ---------- toque (iPad): arrastar, bordas e toque duplo ---------- */
  let t0 = null;
  addEventListener('touchstart', e => {
    if (!on) return;
    if (e.touches.length > 1) { t0 = null; return; }
    const p = e.touches[0];
    t0 = { x: p.clientX, y: p.clientY, own: e.target instanceof Element && !!e.target.closest(OWN) };
  }, { passive: true });
  addEventListener('touchend', e => {
    if (!on || !t0 || t0.own) { t0 = null; return; }
    const p = e.changedTouches[0], dx = p.clientX - t0.x, dy = p.clientY - t0.y; t0 = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
    else if (Math.abs(dy) >= 50 && Math.abs(dy) > Math.abs(dx)) (dy < 0 ? next : prev)();
  }, { passive: true });

  let lastTap = null, tapT = 0;
  document.addEventListener('click', e => {
    /* links internos (#t06 etc.) viram troca de ato */
    const a = on && e.target instanceof Element && e.target.closest('a[href^="#"]');
    if (a) {
      const id = a.getAttribute('href').slice(1), el = id && document.getElementById(id);
      const sec = el && (el.matches('[data-act]') ? el : el.closest('[data-act]'));
      if (sec) { e.preventDefault(); go(acts.indexOf(sec)); }
      return;
    }
    if (!on || e.defaultPrevented || e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
    if (String(getSelection?.() || '')) return;
    const now = performance.now(), x = e.clientX, y = e.clientY;
    if (lastTap && now - lastTap.t < TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < 40) {
      clearTimeout(tapT); lastTap = null; openIndex(); return;
    }
    lastTap = { t: now, x, y };
    const f = x / innerWidth, zone = f >= 0.8 ? 1 : f <= 0.2 ? -1 : 0;
    clearTimeout(tapT);
    if (zone) tapT = setTimeout(() => (zone > 0 ? next : prev)(), TAP_MS);   // espera: pode ser o 1º de um toque duplo
  });

  /* ---------- foco, rolagem externa e redimensionamento ---------- */
  function adopt(i) {                   // algo (foco, busca do navegador) levou a tela a outro ato
    if (i === cur) { snap(); return; }
    cur = i; snap(); arrive(i, 0);
  }
  document.addEventListener('focusin', e => {
    if (!on || busy) return;
    const sec = e.target instanceof Element && e.target.closest('[data-act]');
    const i = sec ? acts.indexOf(sec) : -1;
    if (i >= 0 && i !== cur) adopt(i);
  });
  let guardR = 0;
  addEventListener('scroll', () => {
    if (!on || busy) return;
    if (Math.abs(scrollY - topOf(acts[cur])) < 2) return;
    cancelAnimationFrame(guardR);
    guardR = requestAnimationFrame(() => { if (on && !busy) adopt(actAt(innerHeight / 2)); });
  }, { passive: true });
  let rz = 0;
  const resnap = () => {
    if (!on || busy) return;
    snap();
    const a = acts[cur];
    if (isScrolly(a) && step.get(a)) centerStep(a, step.get(a), false);
  };
  addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(resnap); });
  document.fonts?.ready.then(resnap);

  /* ---------- botão e URL ---------- */
  btn?.addEventListener('click', e => { e.preventDefault(); toggle(); if (e.detail > 0) btn.blur(); });   // clique do mouse: Enter não desliga sem querer
  if (new URLSearchParams(location.search).has('apresentar')) {
    const h = location.hash.slice(1), i = acts.findIndex(a => a.id === h);
    enter({ start: i >= 0 ? i : 0 });
  }

  return {
    enter: (o) => enter(o),
    exit,
    go: (i, o) => go(i, o),
    next, prev,
    isOn: () => on,
  };
}
