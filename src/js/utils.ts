/**
 * @module utils
 * @description Utility functions for WaveformPlayer
 */

/**
 * Default number of peak windows extracted per track. Shared by the runtime
 * peak extraction and `DEFAULT_OPTIONS.samples` so they can't silently drift,
 * and matched to @arraypress/waveform-gen's offline default (1800) for parity.
 * @type {number}
 */
export const DEFAULT_SAMPLES = 1800;

/**
 * Whether we're running in a browser (vs. SSR / Node), where `window` and
 * `document` are available.
 *
 * Lives here rather than in an entry point because both entry points need it —
 * `index.js` to gate its import-time scan, `entry.js` to guard `autoInit` and
 * the `window` attach — and a local copy in each is exactly the kind of
 * duplicate that drifts (see the `detectColorScheme` note in `entry.js`).
 * Deliberately *not* added to the public `WaveformPlayer.utils` bag: it's an
 * internal guard, not part of the consumer contract.
 *
 * @returns 
 */
export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Largest value in an array, via a loop — NOT `Math.max(...arr)`, whose
 * argument spread throws `RangeError: Maximum call stack size exceeded` for
 * very large arrays (~1e5+ entries). Returns `-Infinity` for an empty array,
 * matching `Math.max()`.
 * @param values - Numbers to scan.
 * @returns The maximum value (`-Infinity` if empty).
 */
export function maxOf(values: number[]): number {
    let max = -Infinity;
    for (let i = 0; i < values.length; i++) {
        if (values[i] > max) max = values[i];
    }
    return max;
}

/**
 * Escape a string for safe interpolation into HTML, preventing injection when
 * building markup with template strings. `null`/`undefined` become `''`.
 * @param str - Value to escape.
 * @returns HTML-escaped string.
 */
export function escapeHtml(str: any): string {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Format a CSS length option (`buttonSize`, `buttonRadius`) for interpolation
 * into an inline `style` attribute. A number is treated as px; a string (e.g.
 * `'4rem'`) is used verbatim.
 *
 * The result is HTML-escaped: these values reach the markup from author-supplied
 * `data-*` attributes, so an unescaped quote would otherwise close the `style`
 * attribute and let arbitrary markup in.
 *
 * @param value - Length option value.
 * @returns Escaped CSS length, e.g. `36px` or `4rem`.
 */
export function formatCssLength(value: number | string): string {
    return escapeHtml(typeof value === 'number' ? `${value}px` : value);
}

/**
 * Whether a URL is safe to navigate to (assign to `location.href`): allows only
 * `http`/`https` and relative URLs, rejecting `javascript:`, `data:`, `blob:`,
 * `vbscript:` and other script-bearing schemes.
 * @param url - Candidate URL.
 * @returns True if the URL uses a safe scheme.
 */
export function isSafeHref(url: string): boolean {
    if (typeof url !== 'string' || url === '') return false;
    try {
        // Resolve relative URLs against a dummy http base; only the scheme matters.
        const u = new URL(url, 'http://localhost/');
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

/**
 * Clamp a number to an inclusive range.
 * @param value - Value to constrain.
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns `value` constrained to `[min, max]`.
 */
export function clamp(value: number, min: number = 0, max: number = 1): number {
    return Math.max(min, Math.min(value, max));
}

/**
 * Coerce a value to a finite number, clamped into an optional range.
 *
 * Options reach the player from three untyped directions — `data-*` attributes,
 * framework wrappers that forward strings, and hand-written JS — so a value that
 * *should* be a number routinely isn't. Anything non-numeric (`NaN`,
 * `Infinity`, `null`, `''`, objects, arrays) returns `fallback` rather than
 * poisoning arithmetic downstream: a `NaN` height silently sizes the canvas to
 * zero, which looks like a broken player rather than a bad option.
 *
 * Numeric strings are accepted (`'64'` → `64`) but non-numeric ones are not
 * (`'64px'` → `fallback`); the `data-*` layer has already run `parseInt`/
 * `parseFloat` by the time values arrive here.
 *
 * @param value - Candidate value.
 * @param fallback - Returned when `value` isn't a finite number.
 * @param opts - Bounds.
 * @param [opts.min=-Infinity] - Lower bound (clamped, not rejected).
 * @param [opts.max=Infinity] - Upper bound (clamped, not rejected).
 * @param [opts.integer=false] - Round the result to a whole number.
 * @returns The finite, clamped number, or `fallback`.
 */
export function toFiniteNumber(value: any, fallback: any = null, opts: Record<string, any> = {}): number | any {
    const {min = -Infinity, max = Infinity, integer = false} = opts;
    const n = typeof value === 'number'
        ? value
        : (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);

    if (!Number.isFinite(n)) return fallback;

    const bounded = clamp(n, min, max);
    return integer ? Math.round(bounded) : bounded;
}

/**
 * Coerce a value to an array, accepting either a real array or a JSON string
 * that parses to one (`'[1,2]'`). Anything else — including valid JSON that
 * isn't an array, like `'2'` or `'{"a":1}'` — returns `fallback`.
 *
 * This is the guard `JSON.parse` alone doesn't give you: parsing only validates
 * *syntax*, so well-formed non-array JSON sails through and detonates at the
 * first `.map()`/`.forEach()` call site.
 *
 * @param value - Candidate value.
 * @param fallback - Returned when `value` isn't (or doesn't parse to) an array.
 * @returns The array, or `fallback`.
 */
export function toArray(value: any, fallback: any = null): any[] | any {
    if (Array.isArray(value)) return value;

    if (typeof value === 'string' && value.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) { /* fall through to the fallback */ }
    }

    return fallback;
}

/**
 * Coerce a value to an array of finite numbers.
 *
 * Accepts a real array, a JSON array string (`'[0.5,1,2]'`), or a plain
 * delimited list (`'0.5, 1, 2'`) — the last of which is what an author naturally
 * types into a `data-*` attribute. Members that aren't finite numbers, or that
 * fall outside `[min, max]`, are **dropped** rather than clamped, so a
 * mistyped entry can't quietly masquerade as a supported one. An empty result
 * returns `fallback`.
 *
 * @param value - Candidate value.
 * @param opts - Bounds and fallback.
 * @param [opts.min=-Infinity] - Lowest acceptable member.
 * @param [opts.max=Infinity] - Highest acceptable member.
 * @param [opts.fallback=null] - Returned when nothing usable survives.
 * @returns Numbers within range, or `fallback`.
 */
export function toNumberArray(value: any, opts: Record<string, any> = {}): number[] | any {
    const {min = -Infinity, max = Infinity, fallback = null} = opts;

    let list = toArray(value);
    if (!list && typeof value === 'string' && value.trim() !== '') {
        list = value.split(/[,\s]+/);
    }
    if (!list) return fallback;

    const numbers = list
        .map((v: unknown) => toFiniteNumber(v))
        .filter((n: number | null) => n !== null && n >= min && n <= max);

    return numbers.length ? numbers : fallback;
}

/**
 * Prefix that marks a compact peaks string (format version 1). Shared with
 * `@arraypress/waveform-gen`, which writes the same format.
 */
export const COMPACT_PEAKS_PREFIX = 'wp1:';

/**
 * Encode peaks as a compact string: `"wp1:"` + base64url (RFC 4648 §5, no
 * padding) of one unsigned byte per peak, `round(peak × 255)`.
 *
 * Peaks are the 0..1 magnitudes the player draws (what `extractPeaks` and
 * `@arraypress/waveform-gen` produce — every style, mirror included, draws
 * from magnitudes), so each is clamped to 0..1 first; a non-numeric one
 * encodes as 0. 1800 peaks become 2404 characters, against roughly 9KB as a
 * JSON array of two-decimal numbers.
 *
 * @param peaks - Peak magnitudes, 0..1.
 * @returns The compact string.
 */
export function encodeCompactPeaks(peaks: readonly number[]): string {
    // A loop, not String.fromCharCode(...bytes): spreading a long array
    // overflows the call stack (see maxOf).
    let bytes = '';
    for (let i = 0; i < peaks.length; i++) {
        const p = Number(peaks[i]);
        bytes += String.fromCharCode(Math.round(clamp(Number.isFinite(p) ? p : 0) * 255));
    }
    return COMPACT_PEAKS_PREFIX + btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a {@link encodeCompactPeaks} string back to 0..1 peaks (each within
 * 1/510 of the value encoded). Never throws: anything that isn't a
 * well-formed `wp1:` string — another prefix, a character outside the
 * base64url alphabet, an impossible length — decodes to `[]`, which the
 * player treats like any other unusable peaks.
 *
 * @param s - The compact string.
 * @returns The peaks, or `[]` when `s` is malformed.
 */
export function decodeCompactPeaks(s: string): number[] {
    const body = typeof s === 'string' && s.trim().startsWith(COMPACT_PEAKS_PREFIX)
        ? s.trim().slice(COMPACT_PEAKS_PREFIX.length)
        : null;
    // A length of 4n+1 can't come from whole bytes.
    if (body === null || !/^[\w-]*$/.test(body) || body.length % 4 === 1) return [];
    try {
        const bytes = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
        const peaks: number[] = [];
        for (let i = 0; i < bytes.length; i++) peaks.push(bytes.charCodeAt(i) / 255);
        return peaks;
    } catch (e) {
        return [];
    }
}

/**
 * Coerce supplied peaks — an array, a JSON array string, a delimited list or a
 * compact `wp1:` string — to numbers, or `[]` when nothing usable is there.
 *
 * @param value - Candidate peaks.
 * @returns The peaks (possibly empty).
 */
export function toPeaks(value: any): number[] {
    return typeof value === 'string' && value.trim().startsWith(COMPACT_PEAKS_PREFIX)
        ? decodeCompactPeaks(value)
        : toNumberArray(value, {fallback: []});
}

/**
 * Return `value` when it is one of `allowed`, else `fallback`. Used for the
 * option surface's closed vocabularies (`layout`, `preload`, `audioMode`, …) so
 * an unrecognised value resolves to the documented default instead of reaching
 * a class name, a DOM property, or a lookup that silently misses.
 *
 * @param value - Candidate value.
 * @param allowed - Permitted values.
 * @param fallback - Returned when `value` isn't permitted.
 * @returns `value` if allowed, else `fallback`.
 */
export function toEnum(value: any, allowed: any[], fallback: any = null): any {
    return allowed.includes(value) ? value : fallback;
}

/**
 * Coerce a value to a boolean, treating the strings `'false'` and `'0'` as
 * false. Plain `Boolean()` would make both truthy, and both arrive routinely
 * from attribute-shaped sources (a `data-*` value, or a framework wrapper that
 * stringifies props before forwarding them).
 *
 * @param value - Candidate value.
 * @returns The coerced boolean.
 */
export function toBool(value: any): boolean {
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        return v !== '' && v !== 'false' && v !== '0';
    }
    return !!value;
}

/**
 * Read a boolean `data-*` flag. Returns `undefined` when the attribute is
 * absent (preserving the sparse-options contract) and otherwise compares the
 * raw value against the literal string `'true'`.
 * @param value - Raw `dataset` value.
 * @returns `true`/`false` when present, else `undefined`.
 */
export function parseBoolAttr(value: string | undefined): boolean | undefined {
    return value === undefined ? undefined : value === 'true';
}

/**
 * A colour data-attribute may be a CSS colour string OR a JSON array of
 * gradient stops (e.g. '["#fafafa","#71717a"]'). Parse the array form;
 * otherwise pass the string straight through.
 * @param value
 * @returns 
 */
function parseColorValue(value: string): string | string[] {
    if (typeof value === 'string' && value.trim().startsWith('[')) {
        try { return JSON.parse(value); } catch (e) { /* fall through to string */ }
    }
    return value;
}

/**
 * Read every recognised `data-*` attribute off a host element and translate it
 * into a plain options object suitable for `mergeOptions`.
 *
 * Only attributes that are actually present are copied, so the returned object
 * is sparse and never overrides defaults with `undefined`. Numeric attributes
 * are coerced with `parseInt`/`parseFloat`, boolean flags are compared against
 * the literal string `'true'`, and list-valued attributes (`markers`,
 * `playbackRates`) are parsed defensively — anything that isn't a list is
 * warned about and skipped rather than thrown or passed on.
 *
 * This layer only reads and shapes; it does not police values. Ranges and
 * vocabularies are enforced by `normalizeOptions` on the merged result, so the
 * constructor path gets the same guarantees as the `data-*` path.
 *
 * Several attributes are shorthand aliases of a canonical long form: `data-src`
 * → `url`, `data-style` → `waveformStyle`. When both are present the canonical
 * long form is applied last and therefore wins.
 * Colour attributes that accept gradients (`waveformColor`, `progressColor`)
 * are passed through {@link parseColorValue} so a JSON stop array is expanded.
 *
 * @param element - Host element whose `dataset` is inspected.
 * @returns Sparse options object containing only the attributes found.
 */
export function parseDataAttributes(element: HTMLElement): Record<string, any> {
    const options: Record<string, any> = {};

    // Set a boolean option only when its `data-*` attribute is present, so the
    // returned object stays sparse and never overrides a default with a value
    // the author didn't set. (`dataKey` differs from `optKey` only for showBPM.)
    const setBool = (optKey: string, dataKey: string = optKey) => {
        const v = parseBoolAttr(element.dataset[dataKey]);
        if (v !== undefined) options[optKey] = v;
    };

    // Read a present (non-empty) numeric attribute as an int (or float).
    const setNum = (optKey: string, dataKey: string = optKey, float: boolean = false) => {
        const raw = element.dataset[dataKey];
        if (raw) options[optKey] = float ? parseFloat(raw) : parseInt(raw, 10);
    };

    // Read a CSS length attribute: a bare number is px (data-button-size="64"),
    // a unit string (e.g. "4rem") is kept verbatim for the stylesheet to resolve.
    const setLength = (optKey: string, dataKey: string = optKey) => {
        const raw = element.dataset[dataKey];
        if (!raw) return;
        options[optKey] = /^\d+(\.\d+)?$/.test(raw.trim()) ? parseFloat(raw) : raw;
    };

    // Parse a JSON-array attribute defensively — warn and skip anything that
    // isn't an array. Checking the SHAPE (not just that JSON.parse succeeded)
    // is what stops well-formed non-array JSON like `2` or `{"a":1}` reaching a
    // consumer that will call .map()/.forEach() on it.
    const setJsonArray = (optKey: string, dataKey: string = optKey) => {
        const raw = element.dataset[dataKey];
        if (!raw) return;
        const parsed = toArray(raw);
        if (parsed) options[optKey] = parsed;
        else console.warn(`[WaveformPlayer] Invalid ${dataKey} attribute, expected a JSON array:`, raw);
    };

    // Core attributes. `data-src` is a shorthand alias for `data-url`;
    // the canonical long form wins if both are set.
    if (element.dataset.src) options.url = element.dataset.src;
    if (element.dataset.url) options.url = element.dataset.url;
    setNum('height');
    setNum('samples');
    setNum('duration', 'duration', true);
    if (element.dataset.preload) {
        options.preload = element.dataset.preload;
    }
    if (element.dataset.crossOrigin) {
        options.crossOrigin = element.dataset.crossOrigin;
    }
    if (element.dataset.audioMode) options.audioMode = element.dataset.audioMode;
    setBool('lazy');

    // Waveform style attributes. `data-style` is a shorthand alias for
    // `data-waveform-style`; the canonical long form wins if both are set.
    if (element.dataset.style) options.waveformStyle = element.dataset.style;
    if (element.dataset.waveformStyle) options.waveformStyle = element.dataset.waveformStyle;
    if (element.dataset.waveformGradient) options.waveformGradient = element.dataset.waveformGradient;
    setNum('barWidth');
    setNum('barSpacing');
    setNum('barRadius');
    if (element.dataset.buttonAlign) options.buttonAlign = element.dataset.buttonAlign;
    if (element.dataset.layout) options.layout = element.dataset.layout;
    if (element.dataset.buttonStyle) options.buttonStyle = element.dataset.buttonStyle;
    setLength('buttonSize');
    setLength('buttonRadius');

    // Color preset
    if (element.dataset.colorPreset) options.colorPreset = element.dataset.colorPreset;

    // Individual color customization
    if (element.dataset.waveformColor) options.waveformColor = parseColorValue(element.dataset.waveformColor);
    if (element.dataset.progressColor) options.progressColor = parseColorValue(element.dataset.progressColor);

    // Feature flags
    setBool('autoplay');
    setBool('showControls');
    setBool('showInfo');
    setBool('showTime');
    setBool('showHoverTime');
    setBool('seekHandle');
    setBool('showBPM', 'showBpm');
    setNum('bpm');
    setBool('singlePlay');
    setBool('playOnSeek');

    // Content and metadata
    if (element.dataset.title) options.title = element.dataset.title;
    if (element.dataset.artist) options.artist = element.dataset.artist;
    if (element.dataset.album) options.album = element.dataset.album;
    if (element.dataset.artwork) options.artwork = element.dataset.artwork;
    if (element.dataset.artworkPosition) options.artworkPosition = element.dataset.artworkPosition;

    // Waveform data
    if (element.dataset.waveform) options.waveform = element.dataset.waveform;

    // Markers
    setJsonArray('markers');

    // Playback controls
    setNum('playbackRate', 'playbackRate', true);
    setBool('showPlaybackSpeed');
    // Rates accept a JSON array (`[0.5,1,2]`) or the bare list an author is
    // more likely to type (`0.5, 1, 2`). Range is enforced later, against the
    // same bounds setPlaybackRate() clamps to.
    if (element.dataset.playbackRates) {
        const rates = toNumberArray(element.dataset.playbackRates);
        if (rates) options.playbackRates = rates;
        else console.warn('[WaveformPlayer] Invalid playbackRates attribute:', element.dataset.playbackRates);
    }

    // Media Session API
    setBool('enableMediaSession');

    // Markers visibility
    setBool('showMarkers');

    // Accessibility
    setBool('accessibleSeek');
    if (element.dataset.seekLabel) options.seekLabel = element.dataset.seekLabel;
    if (element.dataset.seekValueText) options.seekValueText = element.dataset.seekValueText;
    if (element.dataset.errorText) options.errorText = element.dataset.errorText;

    // Localizable UI strings (screen-reader / lock-screen facing)
    if (element.dataset.playPauseLabel) options.playPauseLabel = element.dataset.playPauseLabel;
    if (element.dataset.speedLabel) options.speedLabel = element.dataset.speedLabel;
    if (element.dataset.artworkAlt) options.artworkAlt = element.dataset.artworkAlt;
    if (element.dataset.unknownTrackText) options.unknownTrackText = element.dataset.unknownTrackText;

    // Custom icons (raw SVG markup)
    if (element.dataset.playIcon) options.playIcon = element.dataset.playIcon;
    if (element.dataset.pauseIcon) options.pauseIcon = element.dataset.pauseIcon;

    return options;
}

/**
 * Interpolate a printf-style seek value-text template.
 *
 * Substitutes positional (`%1$s`, `%2$s`) and sequential (`%s`) placeholders so
 * a localized template resolves the same way `sprintf` would — including
 * templates that reorder the arguments for a given language. Placeholders with
 * no matching argument are left intact.
 * @param template - Value-text template, e.g. `'%1$s of %2$s'`.
 * @param args  - Replacement values, in order (current, duration).
 * @returns The interpolated value text.
 */
export function formatSeekValueText(template: string, ...args: string[]): string {
    let sequentialIndex = 0;
    return template.replace(/%(?:(\d+)\$)?s/g, (match, position) => {
        const index = position ? Number(position) - 1 : sequentialIndex++;
        return args[index] ?? match;
    });
}

/**
 * Format a duration as a clock string.
 *
 * Renders `M:SS` for durations under an hour and `H:MM:SS` for longer ones,
 * zero-padding the minutes and seconds. Falsy, non-numeric, non-finite, or
 * negative inputs are treated as zero and return `'0:00'`.
 *
 * `Infinity` matters here, and an `isNaN` check does not catch it: a streamed or
 * unseekable source reports `audio.duration === Infinity`, and `Infinity % 3600`
 * is `NaN`, so the old guard rendered a literal `'Infinity:NaN:NaN'` into the UI.
 * @param seconds - Time in seconds.
 * @returns Formatted time, e.g. `'3:07'` or `'1:02:09'`.
 */
export function formatTime(seconds: number): string {
    const total = Number(seconds);
    if (!total || !Number.isFinite(total) || total < 0) return '0:00';

    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Monotonic per-process counter appended to every generated id to guarantee
 * uniqueness even when two ids hash from the same URL.
 * @type {number}
 * @private
 */
let idCounter = 0;

/**
 * Generate a unique, DOM-safe ID from a URL.
 *
 * Uses a DJB2 hash of the FULL url (not a 10-char prefix) plus a process
 * counter, so same-host tracks don't collide in the instances map and
 * non-Latin1 / Unicode URLs don't throw (the old btoa() approach did both).
 * @param url - Audio URL
 * @returns Unique element-id-safe string
 */
export function generateId(url: string): string {
    const str = url || 'audio';
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return `wp_${(hash >>> 0).toString(36)}_${(idCounter++).toString(36)}`;
}

/**
 * Derive a human-readable title from an audio URL's filename.
 *
 * Takes the last path segment, drops the extension, replaces `-`/`_`
 * separators with spaces, and title-cases the first letter of each word.
 * Returns `'Audio'` for an empty or missing URL.
 * @param url - Audio URL.
 * @returns Extracted, prettified title.
 * @example
 * extractTitleFromUrl('https://cdn.example.com/my-cool_track.mp3'); // 'My Cool Track'
 */
export function extractTitleFromUrl(url: string): string {
    if (!url) return 'Audio';

    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    const name = filename.split('.')[0];

    // Clean up common separators
    return name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Parse a CSS `rgb()`/`rgba()` colour into numeric channels.
 *
 * Handles both serializations a browser can hand back from `getComputedStyle`:
 * the legacy comma form (`rgb(34, 34, 34)`, `rgba(34, 34, 34, 0.5)`) and the
 * modern space/slash form (`rgb(34 34 34 / 50%)`). Anything else — the
 * `transparent` keyword, a wide-gamut `color(srgb …)`, an empty string — is
 * reported as `null` so callers treat it as *unknown* rather than as a colour.
 *
 * @param color - CSS colour string.
 * @returns Channels 0–255
 *   with alpha 0–1, or `null` when the string isn't an rgb()/rgba() colour.
 */
export function parseColor(color: string): {r: number, g: number, b: number, a: number} | null {
    if (typeof color !== 'string') return null;

    const m = color.match(/rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?))?/i);
    if (!m) return null;

    const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;

    let a = m[4] === undefined ? 1 : Number(m[4]);
    if (!Number.isFinite(a)) return null;
    if (m[5] === '%') a /= 100;

    return {r, g, b, a: clamp(a, 0, 1)};
}

/**
 * Perceived brightness (0–255) of a CSS colour, via the luminance formula.
 *
 * A fully transparent colour returns `null`, not `0`. That distinction matters:
 * `rgba(0, 0, 0, 0)` is the computed background of *every* element the page
 * never paints, so scoring it as pure black made auto-theme detection classify
 * unpainted (i.e. white) pages as dark — see issue #21. Transparent means "this
 * tells you nothing", which is a different answer from "this is black".
 *
 * @param color - CSS colour string, e.g. `"rgb(34, 34, 34)"`.
 * @returns Brightness 0–255, or `null` if it can't be parsed or
 *   is fully transparent.
 */
export function perceivedBrightness(color: string): number | null {
    const c = parseColor(color);
    if (!c || c.a <= 0) return null;
    return (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
}

/**
 * Shallow-merge option objects into a new object, last source winning.
 *
 * Keys whose value is `null` or `undefined` are skipped, so a later source can
 * leave an earlier value untouched by passing a nullish entry rather than
 * clobbering it. The inputs are never mutated.
 * @param sources - Option objects merged left-to-right.
 * @returns A fresh object containing the merged, defined keys.
 */
export function mergeOptions(...sources: Record<string, any>[]): Record<string, any> {
    const result: Record<string, any> = {};

    for (const source of sources) {
        for (const key in source) {
            if (source[key] !== null && source[key] !== undefined) {
                result[key] = source[key];
            }
        }
    }

    return result;
}

/**
 * Wrap a function so it only runs once calls stop arriving for `wait` ms.
 *
 * Each invocation resets the pending timer, so rapid bursts collapse into a
 * single trailing-edge call that receives the most recent arguments. The
 * wrapper itself returns nothing.
 * @param func - Function to debounce.
 * @param wait - Idle period in milliseconds before `func` fires.
 * @returns Debounced wrapper forwarding its arguments to `func`.
 */
export function debounce(func: (...args: any[]) => any, wait: number): (...args: any[]) => any {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Resize a waveform amplitude array to a target number of bars.
 *
 * Returns the original array unchanged when lengths already match, and an empty
 * array when either side is empty. When upsampling (target larger than source)
 * it linearly interpolates between neighbouring samples for a smooth result.
 * When downsampling it splits the source into evenly sized buckets and keeps
 * the peak (maximum) of each so transients survive the reduction; an empty
 * bucket falls back to its nearest-neighbour sample.
 * @param data - Original amplitude samples.
 * @param targetLength - Desired number of output bars.
 * @returns Resampled amplitude array of length `targetLength`.
 */
export function resampleData(data: number[], targetLength: number): number[] {
    if (data.length === targetLength) return data;
    if (data.length === 0 || targetLength === 0) return [];

    const result = [];

    // If upsampling (target is larger than source)
    if (targetLength > data.length) {
        const ratio = (data.length - 1) / (targetLength - 1);

        for (let i = 0; i < targetLength; i++) {
            const index = i * ratio;
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            const fraction = index - lower;

            // Linear interpolation between samples
            if (upper >= data.length) {
                result.push(data[data.length - 1]);
            } else if (lower === upper) {
                result.push(data[lower]);
            } else {
                const value = data[lower] * (1 - fraction) + data[upper] * fraction;
                result.push(value);
            }
        }
    } else {
        // Downsampling (target is smaller than source)
        const bucketSize = data.length / targetLength;

        for (let i = 0; i < targetLength; i++) {
            const start = Math.floor(i * bucketSize);
            const end = Math.floor((i + 1) * bucketSize);

            // Find the maximum value in this bucket
            let max = 0;
            let count = 0;

            for (let j = start; j <= end && j < data.length; j++) {
                if (data[j] > max) {
                    max = data[j];
                }
                count++;
            }

            // If no samples were found in this bucket, use nearest neighbor
            if (count === 0) {
                const nearestIndex = Math.min(Math.round(i * bucketSize), data.length - 1);
                max = data[nearestIndex];
            }

            result.push(max);
        }
    }

    return result;
}

/**
 * Whether a time falls inside a `TimeRanges` (e.g. `audio.seekable`), with a
 * little slack for float rounding at the edges.
 *
 * @param ranges - The ranges.
 * @param time - Seconds.
 * @returns 
 */
export function inTimeRanges(ranges: Pick<TimeRanges, 'length'|'start'|'end'>, time: number): boolean {
    for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) - 0.05 <= time && time <= ranges.end(i) + 0.05) return true;
    }
    return false;
}

/**
 * Whether one range of a `TimeRanges` (e.g. `audio.buffered`) spans the whole
 * track: the file is fully downloaded, and so in the browser's HTTP cache.
 *
 * @param ranges - The ranges.
 * @param duration - Track length in seconds.
 * @returns 
 */
export function coversDuration(ranges: Pick<TimeRanges, 'length'|'start'|'end'>, duration: number): boolean {
    if (!Number.isFinite(duration) || duration <= 0) return false;
    for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) <= 0.05 && ranges.end(i) >= duration - 0.1) return true;
    }
    return false;
}

