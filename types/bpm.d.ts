/**
 * @module bpm
 * @description BPM detection for audio analysis
 */
/**
 * Estimate the tempo (beats per minute) of an audio buffer.
 *
 * Analyses the first (left/mono) channel by detecting onsets, measuring the
 * time between successive onsets, converting each interval to a tempo, and
 * histogramming those tempos into 3-BPM buckets (60-200 BPM) to find the most
 * common one. Octave errors are corrected by doubling very slow results and
 * halving very fast ones when a strong half/double bucket also exists, then a
 * fixed -1 BPM calibration offset is applied. Returns null when there is no
 * tempo to report — too few onsets (silence, a pad, speech), no interval in the
 * 60-200 BPM range — and when analysis throws. It used to return a 120 (or,
 * after the offset, 119) fallback there, which `showBPM` displayed as if it
 * had been measured.
 *
 * @param buffer - Decoded audio buffer to analyse; only channel 0 is read.
 * @returns Detected tempo in BPM, or null when none was detected.
 */
export declare function detectBPM(buffer: AudioBuffer): number | null;
//# sourceMappingURL=bpm.d.ts.map