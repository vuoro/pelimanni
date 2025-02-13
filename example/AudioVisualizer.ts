import { AudioSystem } from "./AudioSystem.js";
import { Magic } from "./magic.js";

const canvas = document.getElementById("visualizer")?.querySelector("canvas") as HTMLCanvasElement;

const resizeObserver = new ResizeObserver(() => {
  canvas.width = canvas.getBoundingClientRect().width * window.devicePixelRatio;
  canvas.height = canvas.getBoundingClientRect().height * window.devicePixelRatio;
});
resizeObserver.observe(canvas);

export const AudioVisualizer = new Magic(() => {
  const audioSystem = AudioSystem.get();
  const analyser = new AnalyserNode(audioSystem.audioContext);
  audioSystem.output.connect(analyser);

  analyser.fftSize = 2 ** 15;
  analyser.maxDecibels = -0.0;
  analyser.minDecibels = -100.0;
  // analyser.smoothingTimeConstant = 0.8;

  const minFrequency = 440 / 2 ** 4;
  const maxFrequency = 14080;
  const logMaxFrequency = Math.log(maxFrequency);

  const binCount = Math.floor(
    analyser.frequencyBinCount * (maxFrequency / (audioSystem.audioContext.sampleRate / 2)),
  );

  const frequencyData = new Uint8Array(binCount);
  const timeData = new Float32Array(binCount);

  const drawer = canvas.getContext("2d") as CanvasRenderingContext2D;
  drawer.strokeStyle = "black";

  const areas = [
    { start: minFrequency, end: 440 / 2 ** 3 },
    { start: 440 / 2 ** 3, end: 440 / 2 },
    { start: 440 / 2, end: 440 * 2 ** 2 },
    { start: 440 * 2 ** 2, end: 440 * 2 ** 4 },
    { start: 440 * 2 ** 4, end: maxFrequency },
  ];

  const draw = () => {
    analyser.getByteFrequencyData(frequencyData);
    analyser.getFloatTimeDomainData(timeData);

    const { width, height } = canvas;
    drawer.lineWidth = window.devicePixelRatio;
    drawer.clearRect(0, 0, width, height);

    // Areas
    for (let index = 0; index < areas.length; index++) {
      const { start, end } = areas[index];
      const highness = index / (areas.length - 1);
      const relativeStart = Math.max(0, Math.log(start - minFrequency) / logMaxFrequency);
      const relativeEnd = Math.log(end - minFrequency) / logMaxFrequency;
      const brightness = (0.5 + 0.5 * highness) * 255;
      drawer.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
      drawer.fillRect(
        relativeStart * width,
        0,
        relativeEnd * width - relativeStart * width,
        height,
      );
      drawer.strokeRect(
        relativeStart * width,
        0,
        relativeEnd * width - relativeStart * width,
        height,
      );
    }

    // Frequency graph
    drawer.fillStyle = "black";

    for (let i = 0; i < binCount; i++) {
      const volume = frequencyData[i] / 256.0;
      const barHeight = volume * height;

      // const barScale = Math.log(i) / logBinCount;
      // const nextBarScale = Math.log(i + 1) / logBinCount;
      const barScale = Math.log((i / binCount) * maxFrequency - minFrequency) / logMaxFrequency;
      const nextBarScale =
        Math.log(((i + 1) / binCount) * maxFrequency - minFrequency) / logMaxFrequency;
      const barOffset = width * barScale;
      const barWidth = nextBarScale * width - barOffset;

      drawer.fillRect(barOffset, height - barHeight, barWidth, barHeight);
    }

    // Oscilloscope
    const timeSlice = width / binCount;
    let timeX = 0;
    drawer.beginPath();

    for (let i = 0; i < binCount; i++) {
      const v = timeData[i];
      const y = v * (height / 4) + height / 8;

      if (i === 0) {
        drawer.moveTo(timeX, y);
      } else {
        drawer.lineTo(timeX, y);
      }

      timeX += timeSlice;
    }

    drawer.stroke();
    drawer.closePath();
  };

  return draw;
});
