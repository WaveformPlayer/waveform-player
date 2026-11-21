/**
 * @module entry
 * @description Shared runtime surface behind both public entry points.
 *
 * Everything the library exposes — the {@link WaveformPlayer} class, the
 * `WaveformPlayer.utils` helper bag, the `WaveformPlayer.init` scan hook, and
 * the `window` global for `<script>`/CDN usage — *except* the import-time
 * side effects: the document-wide scan and registering `<waveform-player>`.
 * Those are the only difference between the two published entry points, so
 * they live in `index.js` alone (this module exports
 * `defineWaveformPlayerElement()` for pages that register the tag themselves):
 *
 * - `@arraypress/waveform-player` → `index.js`: this surface, plus the scan
 *   and the tag.
 * - `@arraypress/waveform-player/no-autoinit` → this module: never scans.
 *
 * Importing this module is not *completely* free — it still attaches
 * `window.WaveformPlayer`, which `@arraypress/waveform-bar` and `-playlist`
 * depend on — but it never constructs a player. Nothing on the page changes
 * until the caller asks, via `new WaveformPlayer(el)` or
 * `WaveformPlayer.init(root)`.
 */
import { WaveformPlayer } from './core.js';
import type { WaveformPlayerEventMap } from './types.js';
declare global {
    interface Window {
        /** The script-tag global, set when the bundle loads in a browser. */
        WaveformPlayer: typeof WaveformPlayer;
    }
    interface HTMLElementEventMap extends WaveformPlayerEventMap {
    }
    interface DocumentEventMap extends WaveformPlayerEventMap {
    }
}
/**
 * The {@link WaveformPlayer} class.
 * @type {typeof WaveformPlayer}
 */
export default WaveformPlayer;
export { WaveformPlayer };
export { WaveformPlayerElement, defineWaveformPlayerElement } from './element.js';
export type { WaveformStyle, ColorPreset, AudioMode, AudioPreload, AudioCrossOrigin, ButtonAlign, WaveformMarker, WaveformPeaks, WaveformTimeUpdateHandler, WaveformPlayerHandler, WaveformErrorHandler, WaveformPlayerOptions, WaveformLifecycleEventDetail, WaveformEndedEventDetail, WaveformTimeUpdateEventDetail, WaveformErrorEventDetail, WaveformSeekEventDetail, WaveformRateChangeEventDetail, WaveformVolumeChangeEventDetail, WaveformLoopEventDetail, WaveformTrackDetail, WaveformRequestEventDetail, WaveformRequestSeekEventDetail, WaveformPlayerEventMap, WaveformPlayerInstanceEventMap, WaveformPlayerUtils, } from './types.js';
//# sourceMappingURL=entry.d.ts.map