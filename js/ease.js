/* Curvas de aceleração compartilhadas (app.js, cad.js). */
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
