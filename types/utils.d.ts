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
export declare const DEFAULT_SAMPLES = 1800;
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
export declare function isBrowser(): boolean;
/**
 * Largest value in an array, via a loop — NOT `Math.max(...arr)`, whose
 * argument spread throws `RangeError: Maximum call stack size exceeded` for
 * very large arrays (~1e5+ entries). Returns `-Infinity` for an empty array,
 * matching `Math.max()`.
 * @param values - Numbers to scan.
 * @returns The maximum value (`-Infinity` if empty).
 */
export declare function maxOf(values: number[]): number;
/**
 * Escape a string for safe interpolation into HTML, preventing injection when
 * building markup with template strings. `null`/`undefined` become `''`.
 * @param str - Value to escape.
 * @returns HTML-escaped string.
 */
export declare function escapeHtml(str: any): string;
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
export declare function formatCssLength(value: number | string): string;
/**
 * Whether a URL is safe to navigate to (assign to `location.href`): allows only
 * `http`/`https` and relative URLs, rejecting `javascript:`, `data:`, `blob:`,
 * `vbscript:` and other script-bearing schemes.
 * @param url - Candidate URL.
 * @returns True if the URL uses a safe scheme.
 */
export declare function isSafeHref(url: string): boolean;
/**
 * Clamp a number to an inclusive range.
 * @param value - Value to constrain.
 * @param min - Lower bound.
 * @param max - Upper bound.
 * @returns `value` constrained to `[min, max]`.
 */
export declare function clamp(value: number, min?: number, max?: number): number;
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
export declare function toFiniteNumber(value: any, fallback?: any, opts?: Record<string, any>): number | any;
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
export declare function toArray(value: any, fallback?: any): any[] | any;
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
export declare function toNumberArray(value: any, opts?: Record<string, any>): number[] | any;
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
export declare function toEnum(value: any, allowed: any[], fallback?: any): any;
/**
 * Coerce a value to a boolean, treating the strings `'false'` and `'0'` as
 * false. Plain `Boolean()` would make both truthy, and both arrive routinely
 * from attribute-shaped sources (a `data-*` value, or a framework wrapper that
 * stringifies props before forwarding them).
 *
 * @param value - Candidate value.
 * @returns The coerced boolean.
 */
export declare function toBool(value: any): boolean;
/**
 * Read a boolean `data-*` flag. Returns `undefined` when the attribute is
 * absent (preserving the sparse-options contract) and otherwise compares the
 * raw value against the literal string `'true'`.
 * @param value - Raw `dataset` value.
 * @returns `true`/`false` when present, else `undefined`.
 */
export declare function parseBoolAttr(value: string | undefined): boolean | undefined;
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
export declare function parseDataAttributes(element: HTMLElement): Record<string, any>;
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
export declare function formatSeekValueText(template: string, ...args: string[]): string;
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
export declare function formatTime(seconds: number): string;
/**
 * Generate a unique, DOM-safe ID from a URL.
 *
 * Uses a DJB2 hash of the FULL url (not a 10-char prefix) plus a process
 * counter, so same-host tracks don't collide in the instances map and
 * non-Latin1 / Unicode URLs don't throw (the old btoa() approach did both).
 * @param url - Audio URL
 * @returns Unique element-id-safe string
 */
export declare function generateId(url: string): string;
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
export declare function extractTitleFromUrl(url: string): string;
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
export declare function parseColor(color: string): {
    r: number;
    g: number;
    b: number;
    a: number;
} | null;
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
export declare function perceivedBrightness(color: string): number | null;
/**
 * Shallow-merge option objects into a new object, last source winning.
 *
 * Keys whose value is `null` or `undefined` are skipped, so a later source can
 * leave an earlier value untouched by passing a nullish entry rather than
 * clobbering it. The inputs are never mutated.
 * @param sources - Option objects merged left-to-right.
 * @returns A fresh object containing the merged, defined keys.
 */
export declare function mergeOptions(...sources: Record<string, any>[]): Record<string, any>;
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
export declare function debounce(func: (...args: any[]) => any, wait: number): (...args: any[]) => any;
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
export declare function resampleData(data: number[], targetLength: number): number[];
/**
 * Whether a time falls inside a `TimeRanges` (e.g. `audio.seekable`), with a
 * little slack for float rounding at the edges.
 *
 * @param ranges - The ranges.
 * @param time - Seconds.
 * @returns
 */
export declare function inTimeRanges(ranges: Pick<TimeRanges, 'length' | 'start' | 'end'>, time: number): boolean;
/**
 * Whether one range of a `TimeRanges` (e.g. `audio.buffered`) spans the whole
 * track: the file is fully downloaded, and so in the browser's HTTP cache.
 *
 * @param ranges - The ranges.
 * @param duration - Track length in seconds.
 * @returns
 */
export declare function coversDuration(ranges: Pick<TimeRanges, 'length' | 'start' | 'end'>, duration: number): boolean;
//# sourceMappingURL=utils.d.ts.map