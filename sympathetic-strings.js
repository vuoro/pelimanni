const requiredSympatheticStringElements = 4 * 3 * 2;

/** @param {Float32Array} imag */
export const addSympatheticStringsToImag = (imag, loudness = 0.056) => {
  const newImag = new Float32Array((imag.length - 1) * requiredSympatheticStringElements * 4 + 1);

  if (newImag.length >= 1024)
    throw new Error(
      `Imag too long (${imag.length} -> ${newImag.length}) for adding sympathetic strings. Would cause aliasing.`,
    );

  for (let index = 1; index < imag.length; index++) {
    const value = imag[index];

    newImag[index * requiredSympatheticStringElements * 4] += value * loudness;
    newImag[index * requiredSympatheticStringElements * 3] += value * loudness * 0.666666;
    newImag[index * requiredSympatheticStringElements * 2] += value * loudness; // higher strings
    newImag[index * requiredSympatheticStringElements] += value; // real string
    newImag[index * requiredSympatheticStringElements * (1 / 2)] += value * loudness * 0.5; // lower strings
    newImag[index * requiredSympatheticStringElements * (1 / 3)] += value * loudness * 0.333333;
    newImag[index * requiredSympatheticStringElements * (1 / 4)] += value * loudness * 0.5;

    // console.log(
    //   index * requiredSympatheticStringElements * 4,
    //   index * requiredSympatheticStringElements * (1 / 4),
    // );
  }

  return newImag;
};

export const getSympatheticStringPitch = (pitch = 440.0) =>
  pitch / requiredSympatheticStringElements;
