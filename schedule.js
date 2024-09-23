import { createInstance, createInstrument, destroyInstance, playInstance } from "./instruments.js";
import { midiToFrequency } from "./notes.js";

const defaultOptions = { playAhead: 0.2, numberToFrequency: midiToFrequency };

/**
 * @typedef {typeof import("./instrumentPresets.js").genericInstrument} Instrument
 * @typedef {object} PlayableOptions
 * @property {number=} velocity - how strongly the note is played (does not affect volume)
 * @property {number=} volume - how loud the note is
 * @property {number=} vibrato - amount of vibrato
 * @property {number=} vibratoFrequency - frequency of vibrato
 * @property {number=} transpose - added to the note's midi number
 * @property {number=} root - used with `midiToJustFrequency`
 * @property {boolean=} alternate - sequentially pick just one entry, instead of subdividing time
 * @property {boolean=} chord - play all entries at the same time, instead of subdividing time
 * @typedef {(PlayableOptions | number | undefined | Playable)[]} Playable
 * @typedef {(instrument: ReturnType<typeof createInstance>) => void} ConnectInstance
 * @param {([Instrument, Playable])[]} tracks
 * @param {number} cycle
 * @param {AudioContext} audioContext
 * @param {ConnectInstance} connectInstance
 */
export const scheduleMusic = (tracks, cycle, audioContext, connectInstance, options = defaultOptions) => {
  const playAhead = options.playAhead ?? defaultOptions.playAhead;
  const numberToFrequency = options.numberToFrequency ?? defaultOptions.numberToFrequency;

  const { currentTime } = audioContext;
  if (audioContext.state !== "running") return;

  /** @type {Schedule} */
  const schedule =
    schedules.get(audioContext) || schedules.set(audioContext, createSchedule(audioContext)).get(audioContext);

  schedule.connectInstance = connectInstance;
  schedule.numberToFrequency = numberToFrequency;

  // TODO: use baseLatency to better align sounds with visuals?

  // Skip to current time if needed
  if (schedule.scheduledUpTo < currentTime) {
    schedule.scheduledUpTo += currentTime + playAhead - schedule.scheduledUpTo;
  }

  const scheduleAheadBy = document.hidden ? 1.0 + playAhead : playAhead;

  if (schedule.scheduledUpTo < currentTime + scheduleAheadBy) {
    const from = schedule.scheduledUpTo;
    const to = currentTime + scheduleAheadBy;
    schedule.scheduledUpTo = to;

    const cycleEndsAt = (Math.floor(from / cycle) + 1.0) * cycle;
    const cyclesToCheck = to > cycleEndsAt ? 2 : 1;

    // Start scheduling the tracks
    for (const [preset, sequence] of tracks) {
      if (!preset) continue;

      let checkedCycles = 0;

      // Get or create the instrument
      const instrument =
        schedule.instruments.get(preset) || schedule.instruments.set(preset, createInstrument(preset)).get(preset);

      // Schedule the cycles within reach, and keep going if a note is pending
      while (checkedCycles < cyclesToCheck || schedule.pendingNote.pending) {
        const cycleStartedAt = (Math.floor(from / cycle) + checkedCycles) * cycle;
        const period = cycleStartedAt / cycle;

        schedulePart(schedule, instrument, sequence, cycleStartedAt, cycle, period, from, to);

        checkedCycles++;
        if (checkedCycles > 64)
          throw new Error(
            "scheduleMusic tried to loop way too many times: either the cycle is too short or the tracks are messed up",
          );
      }
    }

    // Destroy inactive instrument instances, and remove instruments with no instances remaining
    for (const [preset, instrument] of schedule.instruments) {
      for (const instance of instrument.instances) {
        if (schedule.scheduledUpTo - instance.willPlayUntil > cycle * 2.0) {
          destroyInstance(instance, instrument);
        }
      }

      if (instrument.instances.size === 0) schedule.instruments.delete(preset);
    }
  }
};

const schedules = new WeakMap();

/**
  @param {AudioContext} audioContext
*/
const createSchedule = (audioContext) =>
  Object.seal({
    scheduledUpTo: 0.0,
    instruments: new Map(),
    audioContext,
    /** @type {ConnectInstance} */
    connectInstance: () => {
      throw new Error("Missing `connectInstance` parameter in `scheduleMusic`");
    },
    numberToFrequency: midiToFrequency,
    pendingNote: Object.seal({
      pending: false,
      instrument: null,
      note: 0,
      root: 0,
      at: 0,
      duration: 0,
      velocity: undefined,
      volume: undefined,
      vibrato: undefined,
      vibratoFrequency: undefined,
    }),
  });

/**
 * @typedef {ReturnType<typeof createSchedule>} Schedule
 * @param {Schedule} schedule
 * @param {Instrument} instrument
 * @param {Playable | number | undefined} playable
 * @param {number} velocityFromParent
 * @param {number} volumeFromParent
 * @param {number} vibratoFromParent
 * @param {number} vibratoFrequencyFromParent
 * @param {number} transposeFromParent
 * @param {number} rootFromParent
 */
const schedulePart = (
  schedule,
  instrument,
  playable,
  at = 0.0,
  duration = 0.0,
  period = 0.0,
  from = 0.0,
  to = 0.0,
  velocityFromParent = undefined,
  volumeFromParent = undefined,
  vibratoFromParent = undefined,
  vibratoFrequencyFromParent = undefined,
  transposeFromParent = undefined,
  rootFromParent = undefined,
) => {
  if (at > to && !schedule.pendingNote.pending) return;

  if (typeof playable === "number") {
    if (at < from) return;

    // End pending note, if there is one
    if (schedule.pendingNote.pending) playPendingNote(schedule);

    // Start a new note if it's within reach
    if (at > to) return;

    const note = playable + (transposeFromParent ?? 0);
    const root = rootFromParent || 0;
    const velocity = velocityFromParent;
    const volume = volumeFromParent;
    const vibrato = vibratoFromParent;
    const vibratoFrequency = vibratoFrequencyFromParent;

    schedule.pendingNote.instrument = instrument;
    schedule.pendingNote.note = note;
    schedule.pendingNote.root = root;
    schedule.pendingNote.at = at;
    schedule.pendingNote.duration = duration;
    schedule.pendingNote.velocity = velocity;
    schedule.pendingNote.volume = volume;
    schedule.pendingNote.vibrato = vibrato;
    schedule.pendingNote.vibratoFrequency = vibratoFrequency;

    schedule.pendingNote.pending = true;
    return schedule;
  }

  // Skip nulls, but also make them end pending notes
  if (playable === null) {
    if (schedule.pendingNote.pending) playPendingNote(schedule);
    return;
  }

  // If extender, extend pending note
  if (playable === undefined) {
    if (schedule.pendingNote.pending) schedule.pendingNote.duration += duration;
    return;
  }

  // Skip unknowns
  if (!Array.isArray(playable)) return;

  // Merge options
  let amountOfOptions = 0;
  let alternate = false;
  let chord = false;

  let velocity = velocityFromParent;
  let volume = volumeFromParent;
  let vibrato = vibratoFromParent;
  let vibratoFrequency = vibratoFrequencyFromParent;
  let transpose = transposeFromParent;
  let root = rootFromParent;

  for (let index = 0; index < playable.length; index++) {
    const child = playable[index];

    if (child && typeof child === "object" && !Array.isArray(child) && !ArrayBuffer.isView(child)) {
      velocity = child.velocity ?? velocity;
      volume = child.volume ?? volume;
      vibrato = child.vibrato ?? vibrato;
      vibratoFrequency = child.vibratoFrequency ?? vibratoFrequency;
      transpose = child.transpose ?? transpose;
      root = child.root ?? root;

      alternate = alternate || child.alternate;
      chord = chord || child.chord;

      amountOfOptions++;
    }
  }

  const length = playable.length - amountOfOptions;

  // Alternators pick 1 playable, based on the current period
  if (alternate) {
    const index = Math.round(period) % length;
    const child = playable[index];
    const childPeriod = (period - index) / length;

    return schedulePart(
      schedule,
      instrument,
      // FIXME: recursive types…
      child,
      at,
      duration,
      childPeriod,
      from,
      to,
      velocity,
      volume,
      vibrato,
      vibratoFrequency,
      transpose,
      root,
    );
  }

  // Chord play all playables on top of each other
  if (chord) {
    for (let index = 0; index < length; index++) {
      const child = playable[index];

      schedulePart(
        schedule,
        instrument,
        child,
        at,
        duration,
        period,
        from,
        to,
        velocity,
        volume,
        vibrato,
        vibratoFrequency,
        transpose,
        root,
      );
    }

    return;
  }

  // Normal sequences subdivide time
  const childDuration = duration / length;

  for (let index = 0; index < length; index++) {
    const child = playable[index];
    const childAt = at + index * childDuration;

    schedulePart(
      schedule,
      instrument,
      child,
      childAt,
      childDuration,
      period,
      from,
      to,
      velocity,
      volume,
      vibrato,
      vibratoFrequency,
      transpose,
      root,
    );
  }
};

/**
 @param {Schedule} schedule
 */
const playPendingNote = ({ connectInstance, numberToFrequency, pendingNote, audioContext }) => {
  const { instrument, note, root, at, duration, velocity, volume, vibrato, vibratoFrequency } = pendingNote;
  pendingNote.pending = false;

  // Find a free instance
  let instance = null;

  for (const potentialInstance of instrument.instances) {
    if (potentialInstance.willPlayUntil <= at) {
      instance = potentialInstance;
      break;
    }
  }

  // If one wasn't found, create it
  if (!instance) {
    instance = createInstance(instrument, audioContext);
    connectInstance(instance);
  }

  // Play the note
  playInstance(
    instance,
    numberToFrequency(note, undefined, root),
    at,
    duration,
    velocity,
    volume,
    vibrato,
    vibratoFrequency,
  );
};
