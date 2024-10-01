/**
  @param {ReturnType<typeof import("./AudioSystem.js").AudioSystem>} audioSystem
  @param {HTMLCanvasElement} canvas
*/
export const AudioVisualizer = (audioSystem, canvas) => {
  const analyser = new AnalyserNode(audioSystem.audioContext);
  audioSystem.output.connect(analyser);

  analyser.fftSize = 2 ** 15;
  analyser.maxDecibels = -0.0;
  analyser.minDecibels = -120.0;
  // analyser.smoothingTimeConstant = 0.8;

  const minFrequency = 29;
  const maxFrequency = 16000;
  const logMaxFrequency = Math.log(maxFrequency);

  const binCount = Math.floor(analyser.frequencyBinCount * (maxFrequency / (audioSystem.audioContext.sampleRate / 2)));

  const frequencyData = new Uint8Array(binCount);
  const timeData = new Float32Array(binCount);

  canvas.width = canvas.getBoundingClientRect().width * window.devicePixelRatio;
  canvas.height = canvas.getBoundingClientRect().height * window.devicePixelRatio;

  const drawer = canvas.getContext("2d");
  drawer.lineWidth = 2 * window.devicePixelRatio;
  drawer.strokeStyle = "black";

  const areas = [
    { start: minFrequency, end: 60 },
    { start: 60, end: 250 },
    { start: 250, end: 2000 },
    { start: 2000, end: 6000 },
    { start: 6000, end: maxFrequency },
  ];

  const draw = () => {
    analyser.getByteFrequencyData(frequencyData);
    analyser.getFloatTimeDomainData(timeData);

    const { width, height } = canvas;
    drawer.clearRect(0, 0, width, height);

    // Areas
    for (let index = 0; index < areas.length; index++) {
      const { start, end } = areas[index];
      const highness = index / areas.length;
      const relativeStart = Math.max(0, Math.log(start - minFrequency) / logMaxFrequency);
      const relativeEnd = Math.log(end - minFrequency) / logMaxFrequency;
      drawer.fillStyle = `color(display-p3 ${1.0 - 0.764 * highness} ${0.618 - highness * 0.236} ${0.618 + 0.382 * highness} )`;
      drawer.fillRect(relativeStart * width, 0, relativeEnd * width - relativeStart * width, height);
    }

    // Frequency graph
    drawer.fillStyle = "black";

    for (let i = 0; i < binCount; i++) {
      const volume = frequencyData[i] / 256.0;
      const barHeight = volume * height;

      // const barScale = Math.log(i) / logBinCount;
      // const nextBarScale = Math.log(i + 1) / logBinCount;
      const barScale = Math.log((i / binCount) * maxFrequency - minFrequency) / logMaxFrequency;
      const nextBarScale = Math.log(((i + 1) / binCount) * maxFrequency - minFrequency) / logMaxFrequency;
      const barOffset = width * barScale;
      const barWidth = nextBarScale * width - barOffset;

      drawer.fillRect(barOffset, height - barHeight, barWidth, barHeight);
    }

    // Oscilloscope
    const timeSlice = (width / binCount) * 4.0;
    let timeX = 0;
    drawer.beginPath();

    for (let i = 0; i < binCount; i++) {
      const v = timeData[i];
      const y = v * height + height / 2 - height / 3;

      if (i === 0) {
        drawer.moveTo(timeX * 2.0, y);
      } else {
        drawer.lineTo(timeX * 2.0, y);
      }

      timeX += timeSlice;
      if (timeX >= width) break;
    }

    drawer.stroke();
    drawer.closePath();
  };

  return draw;
};
