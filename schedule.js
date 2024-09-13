let scheduledUpTo = 0.0;

/**
 *
 * @typedef {typeof import("./instrumentPresets.js").genericInstrument} Instrument
 * @typedef {{scale?: number, velocity?: number, volume?: number, vibrato?: number, transpose?: number, root?: number, alternate?: boolean, chord?: boolean}} PlayableOptions
 * @typedef {(PlayableOptions | number | Playable)[]} Playable
 * @typedef {(instrument: Instrument, playable: Playable | number, root: number, at: number, duration: number, velocity: number, volume: number, vibrato: number) => void} PlayNote
 * @param {{ tracks: Map<Instrument, Playable>, cycle: number }} music
 * @param {AudioContext} audioContext
 * @param {PlayNote} playNote
 */
export const scheduleMusic = ({ tracks, cycle }, audioContext, playNote, playAhead = 0.04) => {
  const { currentTime, baseLatency } = audioContext;
  const safetyMargin = Math.max(0.0, playAhead - baseLatency);

  // Fast-forward to current time if needed
  if (scheduledUpTo < currentTime + safetyMargin) {
    const fastForwardBy = Math.ceil((currentTime - scheduledUpTo) / cycle) * cycle;
    scheduledUpTo += fastForwardBy;
  }

  const scheduleAheadBy = (document.hidden ? 1.0 + safetyMargin : safetyMargin) + cycle;

  // Schedule new cycles
  // TODO: could schedule multiple cycles here in one go, instead of using the while loop
  while (scheduledUpTo < currentTime + scheduleAheadBy) {
    scheduledUpTo += cycle;

    for (const [instrument, sequence] of tracks) {
      if (!instrument) continue;
      schedulePart(playNote, instrument, sequence, scheduledUpTo, cycle);
    }
  }
};

/**
  @param {PlayNote} playNote
  @param {Instrument} instrument
  @param {Playable | number} playable
  @param {number} scaleFromParent
  @param {number} velocityFromParent
  @param {number} volumeFromParent
  @param {number} vibratoFromParent
  @param {number} transposeFromParent
  @param {number} rootFromParent
*/
const schedulePart = (
  playNote,
  instrument,
  playable,
  at = 0.0,
  duration = 0.0,
  period = at / duration,
  scaleFromParent = undefined,
  velocityFromParent = undefined,
  volumeFromParent = undefined,
  vibratoFromParent = undefined,
  transposeFromParent = undefined,
  rootFromParent = undefined,
) => {
  if (typeof playable === "number") {
    return playNote(
      instrument,
      playable + (transposeFromParent ?? 0),
      rootFromParent || 0,
      at,
      duration * (scaleFromParent ?? 1.0),
      velocityFromParent,
      volumeFromParent,
      vibratoFromParent,
    );
  }

  if (!playable || !Array.isArray(playable)) return;

  let amountOfOptions = 0;
  let alternate = false;
  let chord = false;

  let scale = scaleFromParent;
  let velocity = velocityFromParent;
  let volume = volumeFromParent;
  let vibrato = vibratoFromParent;
  let transpose = transposeFromParent;
  let root = rootFromParent;

  for (let index = 0; index < playable.length; index++) {
    const child = playable[index];

    if (child && typeof child === "object" && !Array.isArray(child) && !ArrayBuffer.isView(child)) {
      scale = child.scale ?? scale;
      velocity = child.velocity ?? velocity;
      volume = child.volume ?? volume;
      vibrato = child.vibrato ?? vibrato;
      transpose = child.transpose ?? transpose;
      root = child.root ?? root;

      alternate = child.alternate || alternate;
      chord = child.chord || chord;

      amountOfOptions++;
    } else {
      break;
    }
  }

  const length = playable.length - amountOfOptions;

  if (alternate) {
    const index = Math.round(period) % length;
    const child = playable[index];
    const childPeriod = (period - index) / length;

    return schedulePart(
      playNote,
      instrument,
      // FIXME: recursive types… I don't understand.
      child,
      at,
      duration,
      childPeriod,
      scale,
      velocity,
      volume,
      vibrato,
      transpose,
      root,
    );
  }

  if (chord) {
    for (let index = 0; index < length; index++) {
      const child = playable[index];

      schedulePart(
        playNote,
        instrument,
        child,
        at,
        duration,
        period,
        scale,
        (velocity ?? 1.0) / length,
        volume,
        vibrato,
        transpose,
        root,
      );
    }

    return;
  }

  // Sequence
  const childDuration = duration / length;

  for (let index = 0; index < length; index++) {
    const child = playable[index];
    const childAt = at + index * childDuration;

    schedulePart(
      playNote,
      instrument,
      child,
      childAt,
      childDuration,
      period,
      scale,
      velocity,
      volume,
      vibrato,
      transpose,
      root,
    );
  }
};
