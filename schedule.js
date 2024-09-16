let scheduledUpTo = 0.0;

/**
 *
 * @typedef {typeof import("./instrumentPresets.js").genericInstrument} Instrument
 * @typedef {{scale?: number, velocity?: number, volume?: number, vibrato?: number, transpose?: number, root?: number, alternate?: boolean, chord?: boolean}} PlayableOptions
 * @typedef {(PlayableOptions | number | Playable)[]} Playable
 * @typedef {(instrument: Instrument, playable: Playable | number, root: number, at: number, duration: number, velocity: number, volume: number, vibrato: number) => void} PlayNote
 * @param {([Instrument, Playable])[]} tracks
 * @param {number} cycle
 * @param {AudioContext} audioContext
 * @param {PlayNote} playNote
 */
export const scheduleMusic = (tracks, cycle, audioContext, playNote, safetyMargin = 0.2) => {
  const { currentTime } = audioContext;
  if (audioContext.state !== "running") return;

  // TODO: use baseLatency to better with sounds with visuals?

  // Skip to current time if needed
  if (scheduledUpTo < currentTime) {
    scheduledUpTo += currentTime + safetyMargin - scheduledUpTo;
  }

  const scheduleAheadBy = document.hidden ? 1.0 + safetyMargin : safetyMargin;

  if (scheduledUpTo < currentTime + scheduleAheadBy) {
    const from = scheduledUpTo;
    const to = currentTime + scheduleAheadBy;
    scheduledUpTo = to;

    const cycleStartedAt = Math.floor(from / cycle) * cycle;
    const cycleEndsAt = (Math.floor(from / cycle) + 1.0) * cycle;
    const period = cycleStartedAt / cycle;

    // Schedule as much of the ongoing cycle as we can reach
    for (const [instrument, sequence] of tracks) {
      schedulePart(playNote, instrument, sequence, cycleStartedAt, cycle, period, from, to);
    }

    // Also schedule the start of the next cycle, if it's within reach
    if (to > cycleEndsAt) {
      for (const [instrument, sequence] of tracks) {
        schedulePart(playNote, instrument, sequence, cycleStartedAt + cycle, cycle, period + 1.0, from, to);
      }
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
  period = 0.0,
  from = 0.0,
  to = 0.0,
  scaleFromParent = undefined,
  velocityFromParent = undefined,
  volumeFromParent = undefined,
  vibratoFromParent = undefined,
  transposeFromParent = undefined,
  rootFromParent = undefined,
) => {
  if (at > to) return;

  if (typeof playable === "number") {
    if (at < from) return;

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

      alternate = alternate || child.alternate;
      chord = chord || child.chord;

      amountOfOptions++;
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
      from,
      to,
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
        from,
        to,
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
      from,
      to,
      scale,
      velocity,
      volume,
      vibrato,
      transpose,
      root,
    );
  }
};
