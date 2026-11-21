/**
 * @module audio
 * @description Audio processing for WaveformPlayer
 */
/**
 * Extract peaks from a decoded audio buffer for waveform visualization.
 *
 * Divides the buffer into `samples` equal-width windows and, within each
 * window, finds the largest absolute amplitude by inspecting every frame (so
 * transients are never missed and the shape is stable across sample counts —
 * matching WaveformGen's offline output). Across multiple channels the
 * per-window peaks are merged by taking the loudest channel, then the whole
 * array is normalized so the maximum peak becomes 1 (a silent buffer is
 * returned unscaled).
 *
 * @param buffer - Decoded audio buffer to analyse.
 * @param samples - Number of peak windows (output array length). Default 1800.
 * @returns Array of `samples` normalized peak values in the 0-1 range.
 */
export declare function extractPeaks(buffer: AudioBuffer, samples?: number): number[];
/**
 * Generate waveform data by fetching and decoding an audio file at a URL.
 *
 * Fetches the URL, decodes it through a short-lived AudioContext, runs
 * {@link extractPeaks} followed by {@link normalizePeaks}, and optionally
 * detects the track's BPM. The AudioContext is created lazily and always
 * closed in the `finally` block so failed decodes never leak one (browsers
 * hard-cap the number of live contexts). Errors are logged and re-thrown so
 * callers can fall back to a placeholder waveform.
 *
 * @param url - Audio file URL to fetch and decode.
 * @param samples - Number of peak windows to extract. Default 1800.
 * @param shouldDetectBPM - Whether to run BPM detection on the decoded buffer.
 * @returns Resolves with the normalized peaks and the detected BPM (`null` when
 *   detection is disabled or fails).
 * @throws Re-throws any fetch/decode error after logging it.
 */
export declare function generateWaveform(url: string, samples?: number, shouldDetectBPM?: boolean): Promise<{
    peaks: number[];
    bpm: number | null;
}>;
/**
 * Generate a synthetic placeholder waveform for use before (or instead of)
 * real peak data is available.
 *
 * Each bar combines a random base height (0.3-0.8) with a slow sinusoidal
 * variation across the array, clamped to the 0.1-1 range so the result always
 * looks like a plausible waveform rather than pure noise.
 *
 * @param samples - Number of bars (output array length). Default 1800.
 * @returns Array of `samples` pseudo-random peak values in the 0.1-1 range.
 */
export declare function generatePlaceholderWaveform(samples?: number): number[];
