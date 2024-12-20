export const getNoise = (
  shaper = (/** @type {number} */ value, /** @type {number} */ index, /** @type {Float32Array} */ _array) =>
    value / Math.max(1.0, Math.sqrt(index)),
) => {
  const imag = new Float32Array(4096);
  const real = new Float32Array(4096);

  for (let index = 1; index < imag.length; index++) {
    imag[index] = shaper(Math.random() * 2.0 - 1.0, index, imag);
    real[index] = imag[index] * (Math.random() * 2.0 - 1.0);
  }

  return {
    real,
    imag,
  };
};
