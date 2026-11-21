/**
 * @module index
 * @description Default public entry point for the WaveformPlayer library.
 *
 * The full runtime surface from `./entry.js` — the {@link WaveformPlayer} class
 * (default and named), the `WaveformPlayer.init` hook, the `WaveformPlayer.utils`
 * helpers and the `window` global — *plus* the one thing that entry point
 * deliberately omits: a scan of the DOM for declarative `[data-waveform-player]`
 * markup, auto-instantiating a player for each match. Loading this module is
 * enough to make any markup-driven players on the page come alive once the DOM
 * is ready.
 *
 * Two opt-outs, for two different kinds of consumer:
 *
 * - A page that controls its own `<html>` sets `data-waveform-autoinit="false"`
 *   (see {@link autoInitDisabled}).
 * - A bundled consumer that controls no markup at all imports
 *   `@arraypress/waveform-player/no-autoinit` instead, and never loads this
 *   module.
 */
import WaveformPlayer from './entry.js';
/**
 * The {@link WaveformPlayer} class.
 * @type {typeof WaveformPlayer}
 */
export default WaveformPlayer;
export { WaveformPlayer };
export type { WaveformStyle, ColorPreset, AudioMode, AudioPreload, AudioCrossOrigin, ButtonAlign, WaveformMarker, WaveformPeaks, WaveformTimeUpdateHandler, WaveformPlayerHandler, WaveformErrorHandler, WaveformPlayerOptions, WaveformLifecycleEventDetail, WaveformEndedEventDetail, WaveformTimeUpdateEventDetail, WaveformErrorEventDetail, WaveformSeekEventDetail, WaveformRateChangeEventDetail, WaveformVolumeChangeEventDetail, WaveformTrackDetail, WaveformRequestEventDetail, WaveformRequestSeekEventDetail, WaveformPlayerEventMap, WaveformPlayerInstanceEventMap, WaveformPlayerUtils, } from './types.js';
//# sourceMappingURL=index.d.ts.map