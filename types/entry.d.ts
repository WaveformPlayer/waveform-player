/**
 * @module entry
 * @description Shared runtime surface behind both public entry points.
 *
 * Everything the library exposes — the {@link WaveformPlayer} class, the
 * `WaveformPlayer.utils` helper bag, the `WaveformPlayer.init` scan hook, and
 * the `window` global for `<script>`/CDN usage — *except* the document-wide
 * scan that runs on import. That single side effect is the only difference
 * between the two published entry points, so it lives in `index.js` alone:
 *
 * - `@arraypress/waveform-player` → `index.js`: this surface, plus the scan.
 * - `@arraypress/waveform-player/no-autoinit` → this module: never scans.
 *
 * Importing this module is not *completely* free — it still attaches
 * `window.WaveformPlayer`, which `@arraypress/waveform-bar` and `-playlist`
 * depend on — but it never constructs a player. Nothing on the page changes
 * until the caller asks, via `new WaveformPlayer(el)` or
 * `WaveformPlayer.init(root)`.
 */
import { WaveformPlayer } from './core.js';
declare global {
    interface Window {
        /** The script-tag global, set when the bundle loads in a browser. */
        WaveformPlayer: typeof WaveformPlayer;
    }
}
/**
 * The {@link WaveformPlayer} class.
 * @type {typeof WaveformPlayer}
 */
export default WaveformPlayer;
export { WaveformPlayer };
export type { WaveformStyle, ColorPreset, AudioMode, AudioPreload, AudioCrossOrigin, ButtonAlign, WaveformMarker, WaveformPeaks, WaveformTimeUpdateHandler, WaveformPlayerHandler, WaveformErrorHandler, WaveformPlayerOptions, WaveformLifecycleEventDetail, WaveformEndedEventDetail, WaveformTimeUpdateEventDetail, WaveformTrackDetail, WaveformRequestEventDetail, WaveformRequestSeekEventDetail, WaveformPlayerEventMap, WaveformPlayerUtils, } from './types.js';
