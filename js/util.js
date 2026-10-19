/* Funções compartilhadas (app.js, cad.js, chart.js): curvas de aceleração e limite de intervalo. */
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/* faixa da tela que acende os passos dos capítulos 01 e 02. No celular a figura fixa ocupa a metade de cima,
 * então o passo acende mais embaixo (68–74 % da altura) e o texto aberto fica legível abaixo da figura (medido em 19/10/2026) */
export const faixaPassos = () => matchMedia('(max-width:820px)').matches ? '-68% 0px -26% 0px' : '-45% 0px -45% 0px';
