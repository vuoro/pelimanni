export function midiToFrequency(midiNumber = 0, tuning = 440.0) {
  return tuning * 2.0 ** ((midiNumber - 69) / 12);
}

export function midiToFrequency10(midiNumber = 0, tuning = 440.0) {
  return tuning * 2.0 ** ((midiNumber / 10 - 69) / 12);
}

export function frequencyToMidi(frequency = 440.0, tuning = 440.0) {
  return 69 + Math.round((12 * Math.log(frequency / tuning)) / Math.LN2);
}

export function frequencyToMidi10(frequency = 440.0, tuning = 440.0) {
  return 10 * 69 + Math.round((10 * 12 * Math.log(frequency / tuning)) / Math.LN2);
}
