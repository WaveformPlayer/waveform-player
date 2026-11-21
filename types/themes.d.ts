/**
 * @module themes
 * @description Color presets and default options for WaveformPlayer
 */
import type { WaveformMarker } from './types.js';
/**
 * Detect the appropriate color scheme for the player from the surrounding page.
 *
 * Resolution order, first match wins:
 *   1. Explicit theme hints on `<html>`/`<body>` — class names
 *      (`dark`, `dark-mode`, `theme-dark`, light equivalents) and data
 *      attributes (`data-theme`, `data-color-scheme`).
 *   2. The backdrop actually visible behind the player — every background from
 *      `el` up through `<html>` ({@link collectBackdrop}), composited over the
 *      canvas ({@link detectCanvasScheme}). >128 = light, <128 = dark.
 *   3. The canvas scheme alone, for the knife-edge case where the composite
 *      lands exactly on the threshold.
 *
 * @param el - The player's container, so a player inside a themed
 *   card picks up that card. Defaults to `<body>`.
 * @returns The detected scheme, either `'dark'` or `'light'`.
 */
export declare function detectColorScheme(el?: Element): 'dark' | 'light';
/**
 * Built-in colour presets keyed by scheme name.
 *
 * Each preset is a flat map of the player's themeable colour tokens
 * (waveform, progress, button, text, background, border). They are deliberately
 * simple translucent black/white values so they sit on any host background, and
 * any individual token can be overridden per-instance via the matching
 * `*Color` option in {@link DEFAULT_OPTIONS}.
 *
 * @type {Object<string, Object<string, string>>}
 * @property {Object<string, string>} dark  Light-on-dark token set.
 * @property {Object<string, string>} light Dark-on-light token set.
 */
export declare const COLOR_PRESETS: Record<string, {
    waveformColor: string;
    progressColor: string;
}>;
/**
 * Resolve a colour preset by name, falling back to auto-detection.
 *
 * When `presetName` names a known preset it is returned as-is; otherwise
 * (null, undefined, or an unrecognised name) the scheme is auto-detected via
 * {@link detectColorScheme} and the corresponding preset is returned.
 *
 * @param presetName - Preset name (`'dark'` or `'light'`), or
 *   null/invalid to trigger auto-detection.
 * @param el - Container passed through to {@link detectColorScheme}
 *   so detection reads the backdrop behind this player, not just `<body>`.
 * @returns The matching colour token map from
 *   {@link COLOR_PRESETS}.
 */
export declare function getColorPreset(presetName: string | null, el?: Element): {
    waveformColor: string;
    progressColor: string;
};
/**
 * Default option set for a {@link WaveformPlayer} instance.
 *
 * User-supplied options are merged over this object, so every supported option
 * is enumerated here with its baseline value. `null` colour tokens mean "inherit
 * from the resolved {@link COLOR_PRESETS} preset"; `null` content/callback
 * fields mean "unset". See the grouped inline comments for per-field notes,
 * notably the `audioMode` self/external distinction and the `accessibleSeek`
 * keyboard slider.
 *
 * @type {Object}
 */
export declare const DEFAULT_OPTIONS: {
    url: string;
    height: number;
    samples: number;
    preload: string;
    duration: null;
    lazy: boolean;
    crossOrigin: null;
    audioMode: string;
    playbackRate: number;
    showPlaybackSpeed: boolean;
    playbackRates: number[];
    buttonAlign: string;
    layout: string;
    buttonStyle: string;
    buttonSize: null;
    buttonRadius: null;
    waveformStyle: string;
    barWidth: number;
    barSpacing: number;
    barRadius: number;
    waveformGradient: string;
    colorPreset: null;
    waveformColor: null;
    progressColor: null;
    autoplay: boolean;
    showControls: boolean;
    showInfo: boolean;
    showTime: boolean;
    showHoverTime: boolean;
    seekHandle: boolean;
    showBPM: boolean;
    bpm: null;
    singlePlay: boolean;
    playOnSeek: boolean;
    enableMediaSession: boolean;
    markers: never[];
    showMarkers: boolean;
    accessibleSeek: boolean;
    seekLabel: null;
    seekValueText: null;
    title: null;
    artist: null;
    artwork: null;
    artworkPosition: string;
    album: string;
    errorText: string;
    playPauseLabel: string;
    speedLabel: string;
    artworkAlt: string;
    unknownTrackText: string;
    playIcon: string;
    pauseIcon: string;
    onLoad: null;
    onPlay: null;
    onPause: null;
    onEnd: null;
    onError: null;
    onTimeUpdate: null;
    onNextTrack: null;
    onPreviousTrack: null;
};
/**
 * Per-waveform-style geometry defaults.
 *
 * Maps each supported `waveformStyle` to its natural `barWidth`/`barSpacing`
 * (in px), used to seed bar geometry when the caller has not explicitly set
 * those options so each style renders at sensible proportions.
 *
 * @type {Object<string, {barWidth: number, barSpacing: number}>}
 */
export declare const STYLE_DEFAULTS: {
    bars: {
        barWidth: number;
        barSpacing: number;
    };
    mirror: {
        barWidth: number;
        barSpacing: number;
    };
    line: {
        barWidth: number;
        barSpacing: number;
    };
    blocks: {
        barWidth: number;
        barSpacing: number;
    };
    dots: {
        barWidth: number;
        barSpacing: number;
    };
    seekbar: {
        barWidth: number;
        barSpacing: number;
    };
};
/**
 * Permitted `buttonAlign` values. `auto` resolves per waveform style at DOM
 * build time (bottom for `bars`, center otherwise).
 * @type {string[]}
 */
export declare const BUTTON_ALIGNMENTS: string[];
/**
 * Playback-rate bounds. Single source of truth for both the `setPlaybackRate()`
 * clamp and the `playbackRates` menu — an offered rate the setter would refuse
 * leaves the speed label reading one thing while the audio plays another.
 *
 * The window is deliberately wider than the default menu (0.5–2). Audiobook and
 * podcast UIs routinely want 2.5x or 3x, and there's no reason the *setter* should
 * cap what the menu merely doesn't offer by default. 0.25–4 is the conservative
 * limit: browsers keep audio audible and pitch-corrected across that range and
 * start muting it beyond, so a rate outside these bounds would play silently.
 * @type {number}
 */
export declare const PLAYBACK_RATE_MIN = 0.25;
export declare const PLAYBACK_RATE_MAX = 4;
/**
 * Normalize a marker list into renderable markers.
 *
 * Accepts an array or a JSON array string, and keeps only entries that are
 * objects with a finite, non-negative `time` — `renderMarkers()` divides by
 * duration and writes the result into `style.left`, so a non-numeric time
 * produces `left: NaN%` and silently stacks every bad marker at the left edge.
 * A missing `label` becomes `''` rather than reaching the tooltip and the
 * marker's `aria-label` as the string `"undefined"`.
 *
 * @param value - Candidate marker list.
 * @returns Renderable markers (empty when nothing survives).
 */
export declare function normalizeMarkers(value: any): WaveformMarker[];
/**
 * Normalize a merged option set in place, resolving every unusable value to its
 * {@link DEFAULT_OPTIONS} entry.
 *
 * Options arrive from three untyped directions — `data-*` attributes, framework
 * wrappers forwarding props, and hand-written JS — and the consumers downstream
 * assume shapes that none of those paths guarantee. `playbackRates.map()` and
 * `markers.forEach()` throw outright on valid-but-non-array JSON (`JSON.parse`
 * validates syntax, not shape); `NaN` geometry sizes the canvas to nothing; and
 * unrecognised enum values reach class names and DOM properties. Normalizing
 * once, on the merged object, covers both configuration paths and every wrapper
 * at a single point.
 *
 * Mutates and returns the same object, so it can be dropped in directly after
 * {@link mergeOptions}. Options left unset (`null`) are untouched — `null` is
 * the documented "inherit / auto-detect" state for colours, `bpm`, `buttonSize`
 * and the callbacks.
 *
 * @param options - Merged options object (mutated).
 * @returns The same object, normalized.
 */
export declare function normalizeOptions(options: Record<string, any>): Record<string, any>;
//# sourceMappingURL=themes.d.ts.map