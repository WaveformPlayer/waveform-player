/**
 * @module types
 * The public option, event and marker types of WaveformPlayer. Moved here from
 * the hand-written index.d.ts so the source uses the same definitions the
 * published types are generated from.
 */
import type { WaveformPlayer } from './core.js';
/**
 * Visual style of the waveform.
 *
 * - `bars`    — vertical bars from the baseline up
 * - `mirror`  — symmetrical bars mirrored around the centre line (default)
 * - `line`    — connected line graph
 * - `blocks`  — chunky square blocks
 * - `dots`    — dotted plot
 * - `seekbar` — minimal seek bar with no peak detail
 */
export type WaveformStyle = 'bars' | 'mirror' | 'line' | 'blocks' | 'dots' | 'seekbar';
/** Forced colour scheme. `null` (default) auto-detects from the page theme and `prefers-color-scheme`. */
export type ColorPreset = 'dark' | 'light' | null;
/**
 * How the player handles audio.
 *
 * - `self`     — the player owns an `<audio>` element and plays the URL itself (default).
 * - `external` — visualisation-only; `play()`/`pause()`/seek dispatch
 *   `waveformplayer:request-*` events for an external controller, which drives
 *   the visualisation back via {@link WaveformPlayer.setPlayingState} / {@link WaveformPlayer.setProgress}.
 */
export type AudioMode = 'self' | 'external';
/** Browser preload hint for the underlying `<audio>` element. */
export type AudioPreload = 'auto' | 'metadata' | 'none';
/**
 * CORS mode for the underlying `<audio>` element. Left unset by default so the
 * player behaves like a plain `<audio>` and never forces a CORS request. Set
 * `'anonymous'` / `'use-credentials'` only if you specifically need it — doing
 * so breaks playback of media hosted on origins that don't send
 * `Access-Control-Allow-Origin` (e.g. default-config S3/CDN).
 */
export type AudioCrossOrigin = 'anonymous' | 'use-credentials';
/** Vertical alignment of the play button relative to the waveform. */
export type ButtonAlign = 'auto' | 'top' | 'center' | 'bottom';
/** A clickable chapter marker rendered on top of the waveform. */
export interface WaveformMarker {
    /** Time in seconds at which the marker appears. */
    time: number;
    /** Short label shown as a tooltip / accessible name. */
    label: string;
    /** Optional override colour (any CSS colour string). */
    color?: string;
}
/**
 * Pre-computed waveform peaks, OR a pointer to them.
 *
 * - `number[]`            — inline array of peak amplitudes (0..1)
 * - `string` (`wp1:…`)    — compact peaks: `"wp1:"` + base64url (no padding) of one
 *   byte per peak, `round(peak × 255)`; see {@link WaveformPlayerUtils.encodeCompactPeaks}.
 *   About a quarter of the size of a JSON array. A malformed one is unusable
 *   peaks, never an error.
 * - `string` (.json URL)  — JSON file URL the library will `fetch()`; its `peaks`
 *   (or the whole file) may be an array or a compact string
 * - `string` (JSON array) — inline JSON string the library will parse
 * - `null` / omitted      — the library decodes the audio with the Web Audio API at load time
 */
export type WaveformPeaks = number[] | string | null;
/** `onTimeUpdate` fires with the same `(currentTime, duration, player)` order in both audio modes. */
export type WaveformTimeUpdateHandler = (currentTime: number, duration: number, player: WaveformPlayer) => void;
/** Lifecycle callback receiving the player instance. */
export type WaveformPlayerHandler = (player: WaveformPlayer) => void;
/** Error callback receiving the thrown error and the player instance. */
export type WaveformErrorHandler = (error: unknown, player: WaveformPlayer) => void;
/**
 * Construction options for {@link WaveformPlayer}. Every field is optional; the
 * library fills in defaults. The same keys can be supplied as `data-*`
 * attributes on the host element for the zero-build drop-in.
 */
export interface WaveformPlayerOptions {
    /** Audio file URL. */
    url?: string;
    /** Shorthand alias for {@link url} (`data-src`). The canonical name wins if both are set. */
    src?: string;
    /** Waveform height in pixels. @default 64 */
    height?: number;
    /** Source peak resolution for live decode (ignored when `waveform` peaks are
     *  supplied); resampled to fit the visible bars. @default 1800 */
    samples?: number;
    /** `<audio>` preload hint. @default 'metadata' */
    preload?: AudioPreload;
    /**
     * The track's length in seconds (`data-duration`), known before the audio
     * says so. Until the audio's metadata arrives — which with `preload: 'none'`
     * is only once playback starts — the time readout shows it as the total,
     * markers are placed against it, and the hover time, the accessible seek
     * slider and the Media Session scrubber use it. A seek in that window (a
     * click or key on the waveform, a marker, {@link WaveformPlayer.seekTo} /
     * {@link WaveformPlayer.seekToPercent}) moves the playhead at once and is
     * applied to the audio as soon as it can seek. The real `audio.duration`
     * replaces it once known.
     *
     * In `audioMode: 'external'` it stands in the same way until the
     * controller's first {@link WaveformPlayer.setProgress} supplies the real
     * duration; seeks are requested as a percentage of it.
     *
     * Must be a number greater than 0; anything else is ignored with a warning.
     * Per-track: `loadTrack()` resets it unless the call supplies one.
     * @default null
     */
    duration?: number | null;
    /**
     * `<audio>` CORS mode. Unset by default so the player behaves like a plain
     * `<audio>` and never forces a CORS request (which breaks playback of media
     * on origins without `Access-Control-Allow-Origin`). Set only if you need it.
     * @default null
     */
    crossOrigin?: AudioCrossOrigin | null;
    /** Whether the player owns its `<audio>` or delegates to an external controller. @default 'self' */
    audioMode?: AudioMode;
    /** Pre-computed peaks (array, .json URL, or JSON string). Skips Web Audio decoding when provided. */
    waveform?: WaveformPeaks;
    /** Visual style. @default 'mirror' */
    waveformStyle?: WaveformStyle;
    /** Shorthand alias for {@link waveformStyle} (`data-style`). The canonical name wins if both are set. */
    style?: WaveformStyle;
    /** Bar width in pixels (style-dependent default). */
    barWidth?: number;
    /** Gap between bars in pixels (style-dependent default). */
    barSpacing?: number;
    /** Rounded bar-cap radius in pixels (bars/mirror). `0` = square. @default 1 */
    barRadius?: number;
    /** Gradient axis when waveformColor/progressColor is an array of stops. @default 'vertical' */
    waveformGradient?: 'vertical' | 'horizontal' | 'diagonal';
    /** Force a colour preset, or `null` to auto-detect. @default null */
    colorPreset?: ColorPreset;
    /**
     * Unplayed waveform colour (each `null` = use the preset). Pass an array of
     * CSS colour stops for a vertical gradient, e.g. `['#fafafa', '#71717a']`.
     */
    waveformColor?: string | string[] | null;
    /** Played-through colour. Also accepts an array of stops for a gradient. */
    progressColor?: string | string[] | null;
    /** Initial playback rate. @default 1 */
    playbackRate?: number;
    /** Show the playback-speed control. @default false */
    showPlaybackSpeed?: boolean;
    /**
     * Selectable playback rates. Entries outside 0.25–4 (the range browsers keep
     * audible, and the range `setPlaybackRate` clamps to) are dropped.
     * @default [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
     */
    playbackRates?: number[];
    /** Play-button alignment. @default 'auto' */
    buttonAlign?: ButtonAlign;
    /**
     * Player layout. `'preview'` centers the title under the waveform and trims
     * the meta row (time/speed/BPM) — ideal for sample-pack previews.
     * @default 'default'
     */
    layout?: 'default' | 'preview';
    /**
     * Play/pause button style. `'minimal'` renders a bare glyph with no circle —
     * the look sample-pack and beat stores use in preview grids.
     * @default 'circle'
     */
    buttonStyle?: 'circle' | 'minimal';
    /**
     * Play/pause button size. A number is treated as px; a string (e.g. `'4rem'`)
     * is used verbatim. Sets the `--wfp-btn-size` CSS variable, scaling both the
     * `circle` and `minimal` styles — box and glyph — proportionally.
     * @default null
     */
    buttonSize?: number | string | null;
    /**
     * Play/pause button corner radius. A number is treated as px; a string (e.g.
     * `'8px'`) is used verbatim. Set `0` for a square button. Sets the
     * `--wfp-btn-radius` CSS variable, shaping the `circle` style's box — the
     * bare `minimal` glyph has no box to round.
     * @default null
     */
    buttonRadius?: number | string | null;
    /** Show transport controls. @default true */
    showControls?: boolean;
    /**
     * Where the `artwork` image renders. `'info'` places it in the info row
     * beside the title (requires `showInfo`); `'button'` makes the cover the
     * play/pause button, which still works when the info row is hidden. Only one
     * placement ever renders, so the cover cannot appear twice.
     *
     * `'button'` needs no other options: it drops the button's ring and uses
     * cover-sized defaults (64px, 8px rounding) rather than the transport
     * button's 36px circle. Set `buttonSize` / `buttonRadius` to override.
     * @default 'info'
     */
    artworkPosition?: 'info' | 'button';
    /** Show the info (title/artist) block. @default true */
    showInfo?: boolean;
    /** Show current/total time. @default true */
    showTime?: boolean;
    /** Show a time tooltip on hover. @default false */
    showHoverTime?: boolean;
    /** Show a draggable circle handle + hover brightness on the seekbar style (hover/drag); the bar enables it. Drag-to-scrub works regardless. @default false */
    seekHandle?: boolean;
    /** Show detected BPM. @default false */
    showBPM?: boolean;
    /**
     * Known BPM shown in the badge (with `showBPM`); wins over auto-detection
     * and over a peaks sidecar's `bpm`. Per-track: `loadTrack()` resets it
     * unless the call supplies one.
     */
    bpm?: number | null;
    /** Begin playback on load. @default false */
    autoplay?: boolean;
    /** Pause every other player instance when this one plays. @default true */
    singlePlay?: boolean;
    /** Start playing when the user seeks. @default true */
    playOnSeek?: boolean;
    /** Register system Media Session controls (self mode only). @default true */
    enableMediaSession?: boolean;
    /** Chapter markers. @default [] */
    markers?: WaveformMarker[];
    /** Render markers. @default true */
    showMarkers?: boolean;
    /** Expose the waveform as a keyboard-operable ARIA slider. @default true */
    accessibleSeek?: boolean;
    /** Accessible name for the seek slider (falls back to the title, then `'Seek'`). @default null */
    seekLabel?: string | null;
    /**
     * Template for the seek slider's spoken `aria-valuetext`. `%1$s` is the
     * current time and `%2$s` the total duration (both formatted `M:SS`);
     * sequential `%s` and reordered positional args are also supported. Lets
     * consumers localize the connective text without reformatting the times.
     * Falls back to `'%1$s of %2$s'`.
     * @default null
     */
    seekValueText?: string | null;
    /** Accessible label (`aria-label`) for the play/pause button. Localize for non-English UIs. @default 'Play/Pause' */
    playPauseLabel?: string;
    /**
     * Accessible label for the playback-speed control. Localize for non-English UIs.
     * The menu's `aria-label` is this text; the button's is the visible rate
     * followed by it (`'1.5x Playback speed'`), kept in step with rate changes,
     * so the name always contains what the button shows (WCAG 2.5.3).
     * @default 'Playback speed'
     */
    speedLabel?: string;
    title?: string | null;
    artist?: string | null;
    artwork?: string | null;
    /** Media Session (lock-screen) album. Per-track: `loadTrack()` resets it unless the call supplies one. */
    album?: string;
    /** Alt text for the artwork image. Localize for non-English UIs. @default 'Album artwork' */
    artworkAlt?: string;
    /** Media Session (lock-screen) title fallback used when no track `title` is set. Localize for non-English UIs. @default 'Unknown Track' */
    unknownTrackText?: string;
    /** Message shown when audio fails to load. @default 'Unable to load audio' */
    errorText?: string;
    playIcon?: string;
    pauseIcon?: string;
    onLoad?: WaveformPlayerHandler | null;
    onPlay?: WaveformPlayerHandler | null;
    onPause?: WaveformPlayerHandler | null;
    onEnd?: WaveformPlayerHandler | null;
    onError?: WaveformErrorHandler | null;
    onTimeUpdate?: WaveformTimeUpdateHandler | null;
    /** Called when the Media Session "next track" control is used. Registering it shows the lock-screen skip-forward button. */
    onNextTrack?: WaveformPlayerHandler | null;
    /** Called when the Media Session "previous track" control is used. */
    onPreviousTrack?: WaveformPlayerHandler | null;
}
/** `detail` of `waveformplayer:play | pause | ready | destroy`. */
export interface WaveformLifecycleEventDetail {
    player: WaveformPlayer;
    url: string;
}
/** `detail` of `waveformplayer:ended` — lifecycle plus the final time. */
export interface WaveformEndedEventDetail extends WaveformLifecycleEventDetail {
    currentTime: number;
    duration: number;
}
/** `detail` of `waveformplayer:timeupdate`. */
export interface WaveformTimeUpdateEventDetail {
    player: WaveformPlayer;
    currentTime: number;
    duration: number;
    /** Progress as a 0..1 fraction. */
    progress: number;
    url: string;
}
/** Track metadata carried by the external-mode `request-*` events. */
export interface WaveformTrackDetail {
    url: string;
    title: string | null;
    artist: string | null;
    artwork: string | null;
    /** Chapter markers for the track (forwarded so controllers don't re-fetch). */
    markers?: WaveformMarker[];
    /** Pre-computed peaks for the track, if any. */
    waveform?: WaveformPeaks;
    id: string;
    player: WaveformPlayer;
}
/** `detail` of `waveformplayer:request-play | request-pause`. */
export type WaveformRequestEventDetail = WaveformTrackDetail;
/** `detail` of `waveformplayer:request-seek` — adds the requested position. */
export interface WaveformRequestSeekEventDetail extends WaveformTrackDetail {
    /** Requested position as a 0..1 fraction of total duration. */
    percent: number;
}
/** Map of every custom event the player dispatches on its container (bubbling). */
export interface WaveformPlayerEventMap {
    'waveformplayer:ready': CustomEvent<WaveformLifecycleEventDetail>;
    'waveformplayer:play': CustomEvent<WaveformLifecycleEventDetail>;
    'waveformplayer:pause': CustomEvent<WaveformLifecycleEventDetail>;
    'waveformplayer:destroy': CustomEvent<WaveformLifecycleEventDetail>;
    'waveformplayer:ended': CustomEvent<WaveformEndedEventDetail>;
    'waveformplayer:timeupdate': CustomEvent<WaveformTimeUpdateEventDetail>;
    'waveformplayer:request-play': CustomEvent<WaveformRequestEventDetail>;
    'waveformplayer:request-pause': CustomEvent<WaveformRequestEventDetail>;
    'waveformplayer:request-seek': CustomEvent<WaveformRequestSeekEventDetail>;
}
/** The helpers exposed as `WaveformPlayer.utils`. */
export interface WaveformPlayerUtils {
    formatTime(seconds: number): string;
    extractTitleFromUrl(url: string): string;
    escapeHtml(str: unknown): string;
    isSafeHref(url: string): boolean;
    parseDataAttributes(element: HTMLElement): Partial<WaveformPlayerOptions>;
    extractPeaks(buffer: Pick<AudioBuffer, 'length' | 'numberOfChannels' | 'getChannelData'>, samples?: number): number[];
    detectColorScheme(element?: Element): 'dark' | 'light';
    /**
     * Encode 0..1 peaks as a compact `wp1:` string (one byte per peak, values
     * clamped to 0..1, base64url without padding) — accepted anywhere peaks
     * are. 1800 peaks encode to 2404 characters.
     */
    encodeCompactPeaks(peaks: readonly number[]): string;
    /** Decode a `wp1:` string to 0..1 peaks; malformed input returns `[]`, never throws. */
    decodeCompactPeaks(s: string): number[];
}
//# sourceMappingURL=types.d.ts.map