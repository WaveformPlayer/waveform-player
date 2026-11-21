/**
 * @module core
 * @description Main WaveformPlayer class
 */
import type { WaveformPeaks, WaveformPlayerInstanceEventMap, WaveformPlayerOptions, WaveformPlayerUtils } from './types.js';
/**
 * Typed listeners for the events a player dispatches on itself (see
 * {@link WaveformPlayerInstanceEventMap}). Types only: merged into the class
 * below, it emits nothing.
 */
export interface WaveformPlayer {
    addEventListener<K extends keyof WaveformPlayerInstanceEventMap>(type: K, listener: (this: WaveformPlayer, ev: WaveformPlayerInstanceEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof WaveformPlayerInstanceEventMap>(type: K, listener: (this: WaveformPlayer, ev: WaveformPlayerInstanceEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void;
}
/**
 * WaveformPlayer - Modern audio player with waveform visualization.
 *
 * An `EventTarget`: lifecycle events (`play`, `pause`, `ended`, `load`, …)
 * are dispatched on the instance as plain events, and on the container as
 * bubbling, composed `waveformplayer:*` CustomEvents carrying the details.
 * @class
 */
export declare class WaveformPlayer extends EventTarget {
    static readonly instances: Map<string, WaveformPlayer>;
    static currentlyPlaying: WaveformPlayer | null;
    /** Shared helpers, attached by entry.ts. */
    static readonly utils: WaveformPlayerUtils;
    /** Initialize every `[data-waveform-player]` in `root` (or the document). Attached by entry.ts. */
    static init: (root?: Document | Element) => void;
    readonly options: Required<WaveformPlayerOptions>;
    readonly id: string;
    readonly container: HTMLElement;
    progress: number;
    isPlaying: boolean;
    /**
     * Create a new WaveformPlayer instance.
     *
     * Resolves the container, merges options (defaults < `data-*` attributes <
     * constructor options), applies the colour preset and style-specific
     * defaults, registers the instance in the static map, and kicks off
     * {@link WaveformPlayer#init}. A `waveformplayer:ready` event is dispatched
     * ~100ms later, once initialization has settled.
     *
     * @param {string|HTMLElement} container - Container element, or a CSS
     *   selector resolved with `document.querySelector`.
     * @param {Object} [options={}] - Player options. Accepts the shorthand
     *   aliases `style` (→ `waveformStyle`) and `src` (→ `url`); the canonical
     *   names win if both are supplied.
     * @throws {Error} If the container element cannot be found.
     * @fires WaveformPlayer#waveformplayer:ready
     */
    constructor(container: string | HTMLElement, options?: WaveformPlayerOptions);
    /**
     * Load an audio source: set the title, fetch/generate the waveform peaks,
     * draw them, render markers, and initialise Media Session.
     *
     * In self mode the `<audio>` src is assigned and the method awaits
     * `loadedmetadata` before proceeding. In external mode there is no audio
     * element, so the src/metadata step is skipped and only the visualization
     * is built (duration/time come from the controller via
     * {@link WaveformPlayer#setProgress}). The title and the seek slider's
     * accessible name are written *before* the metadata wait, as are peaks
     * supplied via the `waveform` option — none of them need anything from the
     * audio element, and behind the wait they blink in on a slow origin.
     * Without inline peaks — or when a `.json` peaks sidecar can't be fetched —
     * the waveform is decoded from the audio instead; a decode failure falls
     * back to a placeholder. The `onLoad` callback fires on success.
     *
     * Every call supersedes the previous one: a load that is overtaken while
     * it awaits (metadata, a sidecar fetch, the decode) stops there without
     * touching the player, so a slow first track can't land its peaks, BPM,
     * error or loading state on the track that replaced it.
     *
     * Loading a *different* URL also resets what the previous track left
     * behind (see {@link WaveformPlayer#_resetTrack}); reloading the same URL
     * — e.g. a retry after an error — keeps the drawn waveform. Either way the
     * error state is cleared, so a retry re-enables the player.
     * @param url - Audio URL.
     * @returns Resolves once loading settles (errors are caught
     *   internally and surfaced through {@link WaveformPlayer#onError}).
     */
    load(url: string): Promise<void>;
    /**
     * Swap the player to a new track at runtime.
     *
     * Pauses any current playback, fully resets the audio element (self mode),
     * clears error/marker/progress state, merges the new metadata into
     * `this.options`, updates the artist/artwork DOM, then calls
     * {@link WaveformPlayer#load}. Auto-plays the new track unless
     * `options.autoplay === false` — and only if no later `loadTrack()` /
     * `load()` has superseded this one by the time it finishes loading.
     *
     * Per-track options the caller doesn't repeat are reset rather than
     * inherited from the previous track: `markers`, `waveform`, `bpm` and
     * `album`.
     * @param url - Audio URL.
     * @param title - Track title; keeps the existing
     *   title when null. (Deliberate: a controller that only swaps the
     *   audio keeps the label it set. Pass `''` to derive the title from the
     *   URL instead.)
     * @param artist - Track artist; pass `''` to hide
     *   the artist row, or null to keep the existing one.
     * @param options - Additional options to merge (e.g.
     *   `preload`, `artwork`, `artworkAlt`, `markers`, `bpm`, `album`,
     *   `autoplay`).
     * @returns
     */
    loadTrack(url: string, title?: string | null, artist?: string | null, options?: WaveformPlayerOptions): Promise<void>;
    /**
     * Normalise externally-supplied waveform data into `this.waveformData` and
     * redraw.
     *
     * Accepts several shapes: a `.json` URL (fetched async — a query string
     * or fragment is fine, which is what {@link WaveformPlayer.getPeaksUrl}
     * produces for a versioned audio URL), a JSON-encoded array string, a
     * comma-separated number string, a compact `wp1:` string (see
     * `WaveformPlayer.utils.encodeCompactPeaks`), or a plain number array.
     * Malformed input degrades to an empty array rather than throwing.
     *
     * A sidecar may be bare peaks (an array or a compact string) or a
     * `{peaks, markers, bpm}` object, whose `peaks` may also be compact
     * (the shape `@arraypress/waveform-gen` writes): its markers apply when the
     * track has none of its own, and its `bpm` feeds the badge when no `bpm`
     * option is set. A sidecar that fails to fetch (network error, non-2xx) or
     * carries no peaks resolves `false` and leaves the canvas as it was —
     * {@link WaveformPlayer#load} then decodes the audio instead. One that
     * resolves after a newer load has started is discarded.
     *
     * The data also becomes the current track's `waveform` option, so it
     * outlives the load already in flight: the first load() runs a frame after
     * construction (see init()) and draws `options.waveform`, which used to
     * paint over peaks set before that frame — an easy race to lose with a
     * cached or fast fetch. A later reload of the same track reuses them too.
     * {@link WaveformPlayer#loadTrack} still replaces them for a new track.
     * @param data - Peaks as an array, a JSON/CSV string, or
     *   a URL to a `.json` peaks file.
     * @returns For a `.json` URL, a promise of
     *   whether the sidecar was applied; otherwise `undefined` (applied
     *   synchronously).
     */
    setWaveformData(data: WaveformPeaks): Promise<boolean> | void;
    /**
     * Re-fit the canvas backing store to its parent's width and the configured
     * height, scaled by the device pixel ratio for crisp rendering, then
     * redraw. Guards against running after destruction. Public: the resize
     * observer doesn't reliably fire on a DOM move, so call this after
     * relocating the player.
     */
    resizeCanvas(): void;
    /**
     * Highlight the marker at `index` (toggling an `active` class) and clear
     * the rest. Pass `null` to clear all. Lets an external controller (e.g. a
     * DJ bar) reflect the current section without reaching into the player's
     * private marker DOM.
     * @param index - Marker index to activate, or `null` to clear.
     */
    setActiveMarker(index: number | null): void;
    /**
     * Re-detect the page theme and re-apply auto colours + redraw, so an
     * auto-themed player adapts to a runtime light/dark switch (not just the
     * value present on load). No-op when the player uses an explicit
     * `colorPreset` or hand-set colours. Driven by the shared theme watcher.
     * @public
     */
    refreshTheme(): void;
    /**
     * Play audio.
     *
     * In `audioMode: 'self'` (default): calls the underlying <audio>
     * element's play(). Returns the promise from HTMLMediaElement.play().
     *
     * In `audioMode: 'external'`: dispatches a cancelable
     * `waveformplayer:request-play` event with the track metadata and
     * does NOT touch any audio element. Returns `undefined`. An external
     * controller (e.g. WaveformBar) listens for this event and starts
     * playback on its own audio source, then pushes state back via
     * setPlayingState() / setProgress(). Calling preventDefault() on
     * the event lets the controller veto the play (state is unchanged).
     *
     * When `singlePlay` is enabled, any other currently-playing instance is
     * paused first.
     *
     * @return The promise from `HTMLMediaElement.play()` in
     *   self mode; `undefined` in external mode.
     * @fires WaveformPlayer#waveformplayer:request-play
     */
    play(): Promise<void> | undefined;
    /**
     * Pause audio.
     *
     * In `audioMode: 'external'`, dispatches a cancelable
     * `waveformplayer:request-pause` and does NOT touch any audio element.
     * Mirrors play(): calling preventDefault() on the event vetoes the pause
     * as far as the player is concerned — it stays `currentlyPlaying` (the
     * `singlePlay` bookkeeping). Neither event flips the play/pause visual;
     * that only changes when the controller calls setPlayingState().
     *
     * @fires WaveformPlayer#waveformplayer:request-pause
     */
    pause(): void;
    /**
     * External-mode state pump: flip the play/pause visual state without
     * touching audio. Mirrors what onPlay()/onPause() do but skips the
     * audio-element interactions. Safe to call repeatedly — idempotent.
     *
     * Only dispatches `waveformplayer:play`/`waveformplayer:pause` (and runs
     * the matching callback) on an actual transition, starting/stopping the
     * smooth-update loop accordingly.
     *
     * @param playing - True to enter the playing state, false to
     *   enter the paused state.
     * @fires WaveformPlayer#waveformplayer:play
     * @fires WaveformPlayer#waveformplayer:pause
     */
    setPlayingState(playing: boolean): void;
    /**
     * External-mode state pump: update the visualization's progress
     * from an external clock (e.g. WaveformBar's audio element's
     * timeupdate). Drives the canvas redraw + the time displays.
     *
     * Redraws the canvas, updates the current/total time displays, stores the
     * external duration for the accessible slider, dispatches
     * `waveformplayer:timeupdate`, runs `onTimeUpdate`, and synthesizes a
     * one-shot `waveformplayer:ended` (with `onEnd`) when progress reaches the
     * end. No-op for a non-positive duration, and while the user is dragging
     * the playhead (as in self mode).
     *
     * @param currentTime - Current playback position in seconds.
     * @param duration - Total track duration in seconds.
     * @fires WaveformPlayer#waveformplayer:timeupdate
     * @fires WaveformPlayer#waveformplayer:ended
     */
    setProgress(currentTime: number, duration: number): void;
    /**
     * Toggle between play and pause based on the current `isPlaying` state.
     * Works in both audio modes (in external mode it routes through the
     * request-play/pause events).
     */
    togglePlay(): void;
    /**
     * Seek the owned `<audio>` element to an absolute time, clamped to
     * `[0, duration]`, and refresh progress. Self mode only — a no-op when
     * there is no audio element or duration, or when `seconds` isn't a finite
     * number. External-mode keyboard/click seeks go through
     * {@link WaveformPlayer#seekToSeconds} instead.
     *
     * Before the audio's metadata arrives, the `duration` option (when set)
     * stands in: the playhead moves at once and the audio seeks there as soon
     * as it can.
     * @param seconds - Target time in seconds.
     */
    seekTo(seconds: number): void;
    /**
     * Seek the owned `<audio>` element to a fraction of the track, clamped to
     * `[0, 1]`, and refresh progress. Self mode only — a no-op without an audio
     * element or duration, or when `percent` isn't a finite number. Like
     * {@link WaveformPlayer#seekTo}, it works before the metadata against the
     * `duration` option.
     * @param percent - Position as a fraction from 0 to 1.
     */
    seekToPercent(percent: number): void;
    /**
     * Set the owned `<audio>` element's volume, clamped to `[0, 1]`. Self mode
     * only — a no-op in external mode where the controller owns volume.
     * @param volume - Volume from 0 (silent) to 1 (full).
     */
    setVolume(volume: number): void;
    /**
     * Set the owned `<audio>` element's playback rate (clamped to 0.25–4),
     * persist it onto `this.options.playbackRate`, and refresh the speed UI.
     * Self mode only — a no-op in external mode.
     *
     * The clamp bounds the range browsers keep audible; the default speed menu
     * offers a narrower 0.5–2, which `playbackRates` can widen up to these
     * bounds. A non-numeric rate is ignored rather than assigned, since
     * `audio.playbackRate = NaN` throws. The rate is also written to
     * `defaultPlaybackRate`, so it survives the next track load.
     * @param rate - Desired playback rate; clamped to the 0.25–4 range.
     */
    setPlaybackRate(rate: number): void;
    /**
     * Turn looping on or off — what the `showLoop` button does. Without an
     * argument it flips: off when any loop is on (whole track or section),
     * whole-track looping (the `loop` option) on otherwise. `true` turns
     * whole-track looping on; `false` turns every loop off, section included.
     * Self mode only: returns `false` and does nothing in external mode.
     * @param force - The state to set; omit to flip.
     * @returns Whether the player now loops.
     * @fires WaveformPlayer#waveformplayer:loop
     */
    toggleLoop(force?: boolean): boolean;
    /**
     * Loop a section: once the playhead reaches `end` it jumps back to
     * `start`, seamlessly — the check runs on the progress loop (every frame
     * while playing) and the seek is the ordinary one. If the playhead is
     * outside the section, it moves to `start`. An `end` past the track (or
     * `Infinity`) loops to the end of the track. While a section is set it
     * wins over whole-track looping; `ended` / `onEnd` never fire inside it.
     * Per-track: a new track clears it. Self mode only (no-op in external
     * mode); invalid bounds (`end <= start`, non-numbers) are ignored.
     * @param start - Section start, seconds.
     * @param end - Section end, seconds.
     * @fires WaveformPlayer#waveformplayer:loop
     */
    setLoop(start: number, end: number): void;
    /**
     * Stop looping a section ({@link WaveformPlayer#setLoop} /
     * {@link WaveformPlayer#loopMarker}); whole-track looping, if on, carries on.
     * @fires WaveformPlayer#waveformplayer:loop
     */
    clearLoop(): void;
    /**
     * Loop from marker `index` (its position in the `markers` option) to the
     * next marker in time, or to the end of the track if it is the last. See
     * {@link WaveformPlayer#setLoop}. Ignored for an index with no marker.
     * @param index - Marker index.
     */
    loopMarker(index: number): void;
    /**
     * Tear down the player and release all resources.
     *
     * Flags destruction (so in-flight handlers bail), dispatches
     * `waveformplayer:destroy`, stops playback and the animation loop, aborts
     * every listener registered on the instance signal, disconnects the resize
     * observer, removes the window-resize handler, drops the instance from the
     * static map and `currentlyPlaying`, resets/releases the audio element, and
     * empties the container.
     * @fires WaveformPlayer#waveformplayer:destroy
     */
    destroy(): void;
    /**
     * Get player instance by ID, element, or element ID
     * @param idOrElement - Player ID, element, or element ID
     * @returns
     */
    static getInstance(idOrElement: string | HTMLElement): WaveformPlayer | undefined;
    /**
     * Get all player instances
     * @returns
     */
    static getAllInstances(): WaveformPlayer[];
    /**
     * Destroy all player instances
     */
    static destroyAll(): void;
    /**
     * Generate waveform data from audio URL
     * @static
     * @param url - Audio URL
     * @param samples - Number of samples
     * @returns Waveform peak data
     */
    static generateWaveformData(url: string, samples?: number): Promise<number[]>;
    /**
     * Derive a peaks-JSON URL from an audio URL by swapping the
     * extension. Strict counterpart to `generateWaveformData()`:
     * `generateWaveformData` decodes the audio at runtime,
     * `getPeaksUrl` assumes you generated the peaks at build time
     * (e.g. with `@arraypress/waveform-gen`) and stored the JSON
     * alongside the audio file.
     *
     * Use the result as the `waveform` option — the player detects
     * the `.json` suffix, `fetch()`es the file, and skips the Web
     * Audio decode pass entirely. Big perf win on catalogues with
     * many tracks (saves ~1-5s decode per file on slow connections).
     *
     * Recognised extensions: mp3, wav, ogg, flac, m4a, aac.
     * Preserves query strings + URL fragments. Returns `undefined`
     * for unrecognised inputs so callers can pass through
     * unconditionally:
     *
     *     new WaveformPlayer('#el', {
     *       url: track.audioUrl,
     *       waveform: WaveformPlayer.getPeaksUrl(track.audioUrl),
     *     });
     *
     * @static
     * @param audioUrl - Audio file URL.
     * @returns Peaks JSON URL, or `undefined`
     *   when the input is empty / has no recognised audio extension.
     *
     * @example
     * WaveformPlayer.getPeaksUrl('/audio/track.mp3')
     * // '/audio/track.json'
     *
     * WaveformPlayer.getPeaksUrl('/audio/track.wav?v=2')
     * // '/audio/track.json?v=2'
     *
     * WaveformPlayer.getPeaksUrl(undefined)
     * // undefined
     */
    static getPeaksUrl(audioUrl: string | undefined | null): string | undefined;
}
//# sourceMappingURL=core.d.ts.map