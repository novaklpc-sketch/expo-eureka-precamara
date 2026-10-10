/* Funções compartilhadas (app.js, cad.js, chart.js): curvas de aceleração e limite de intervalo. */
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
