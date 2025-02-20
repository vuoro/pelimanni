const requiredSympatheticStringElements = 4 * 3 * 2;

/** @param {Float32Array} imag */
export const addSympatheticStringsToImag = (imag, loudness = 0.021) => {
  const newImag = new Float32Array((imag.length - 1) * requiredSympatheticStringElements * 4 + 1);

  if (newImag.length >= 1024)
    throw new Error(
      `Imag too long (${imag.length} -> ${newImag.length}) for adding sympathetic strings. Would cause aliasing.`,
    );

  for (let index = 1; index < imag.length; index++) {
    const value = imag[index];
    const sympatheticValue = value ** 2.0 * loudness;

    // higher strings
    newImag[index * requiredSympatheticStringElements * 4] += sympatheticValue * 0.5;
    newImag[index * requiredSympatheticStringElements * 3] += sympatheticValue * 0.666666;
    newImag[index * requiredSympatheticStringElements * 2] += sympatheticValue;
    // real string
    newImag[index * requiredSympatheticStringElements] += value;
    // lower strings
    newImag[index * requiredSympatheticStringElements * (1 / 2)] += sympatheticValue;
    newImag[index * requiredSympatheticStringElements * (1 / 3)] += sympatheticValue * 0.666666;
    newImag[index * requiredSympatheticStringElements * (1 / 4)] += sympatheticValue * 0.5;
  }

  return newImag;
};

export const getSympatheticStringPitch = (pitch = 440.0) =>
  pitch / requiredSympatheticStringElements;
