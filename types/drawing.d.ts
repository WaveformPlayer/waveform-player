/**
 * @module drawing
 * @description Core waveform drawing styles optimized for visual distinction at all sizes
 */
/**
 * Draw standard bars waveform - classic vertical bars anchored to the baseline.
 * Peaks are resampled to fit the available bar slots, drawn at 90% of canvas
 * height, then the progress portion is repainted in `progressColor` via a
 * left-anchored clip rect.
 * @param ctx - Canvas 2D context to draw into.
 * @param canvas - Canvas element (provides device-pixel dimensions).
 * @param peaks - Normalised waveform peak values (0-1).
 * @param progress - Playback progress (0-1) that drives the colour overlay.
 * @param options - Drawing options: `barWidth`, `barSpacing`, `barRadius`,
 *   `color`, `progressColor` (colour strings or gradient stop arrays).
 * @returns
 */
export declare function drawBars(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void;
/**
 * Draw mirror/SoundCloud style waveform - symmetrical bars about the centre line.
 * Each peak is drawn twice (45% of height up and down) with the upper cap rounded
 * on top and the lower cap rounded on the bottom; the progress portion is then
 * repainted in `progressColor` through a left-anchored clip rect.
 * @param ctx - Canvas 2D context to draw into.
 * @param canvas - Canvas element (provides device-pixel dimensions).
 * @param peaks - Normalised waveform peak values (0-1).
 * @param progress - Playback progress (0-1) that drives the colour overlay.
 * @param options - Drawing options: `barWidth`, `barSpacing`, `barRadius`,
 *   `color`, `progressColor`.
 * @returns
 */
export declare function drawMirror(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void;
/**
 * Draw line/oscilloscope style waveform - smooth flowing wave with glow.
 * Renders a faint oscilloscope grid (centre line + 10 vertical divisions), the
 * full waveform as a bezier-smoothed curve, then the played portion on top with
 * a coloured shadow glow. Peaks are modulated by a sine term so the line undulates
 * rather than reading as static bars.
 * @param ctx - Canvas 2D context to draw into.
 * @param canvas - Canvas element (provides device-pixel dimensions).
 * @param peaks - Normalised waveform peak values (0-1).
 * @param progress - Playback progress (0-1); the glowing curve is only drawn when > 0.
 * @param options - Drawing options: `color` (base wave), `progressColor` (played wave).
 * @returns
 */
export declare function drawLine(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void;
/**
 * Draw blocks/LED meter style waveform - segmented blocks growing from the centre.
 * Each bar's height is quantised into fixed-size blocks separated by gaps, drawn
 * symmetrically up and down from the centre line (the shared centre block is not
 * duplicated downward). Per-bar colour is chosen by comparing the bar's x against
 * the played width — there is no clip overlay here.
 * @param ctx - Canvas 2D context to draw into.
 * @param canvas - Canvas element (provides device-pixel dimensions).
 * @param peaks - Normalised waveform peak values (0-1).
 * @param progress - Playback progress (0-1) used to pick each bar's colour.
 * @param options - Drawing options: `barWidth` (default 3), `barSpacing` (default 1),
 *   `color`, `progressColor`.
 * @returns
 */
export declare function drawBlocks(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void;
/**
 * Draw dots style waveform - pairs of circular points mirrored about the centre.
 * For each sample a dot is drawn above and below the centre line at half the peak
 * height; dot radius scales with bar width but is floored at 1.5 device pixels.
 * Per-dot colour is chosen by comparing x against the played width (no clip overlay).
 * @param ctx - Canvas 2D context to draw into.
 * @param canvas - Canvas element (provides device-pixel dimensions).
 * @param peaks - Normalised waveform peak values (0-1).
 * @param progress - Playback progress (0-1) used to pick each dot's colour.
 * @param options - Drawing options: `barWidth` (default 2), `barSpacing` (default 3),
 *   `color`, `progressColor`.
 * @returns
 */
export declare function drawDots(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void;
/**
 * Draw seekbar style - a simple rounded progress bar with no waveform.
 * Renders a pill-shaped background track, a clean pill-shaped filled portion
 * (clamped to at least one full pill width so it never collapses), and a
 * draggable circular handle/thumb at the playhead (clamped so it never clips
 * at the track ends).
 * The `peaks` argument is accepted for signature parity but is unused by this style.
 * @param ctx - Canvas 2D context to draw into.
 * @param canvas - Canvas element (provides device-pixel dimensions).
 * @param peaks - Ignored; present to match the shared draw-function signature.
 * @param progress - Playback progress (0-1); the fill and handle are only drawn when > 0.
 * @param options - Drawing options: `color` (track), `progressColor` (fill/glow/accent).
 * @returns
 */
export declare function drawSeekbar(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void;
/**
 * Map of style names to their drawing functions.
 * Six visually distinct styles including a simple seekbar; keys are matched
 * against `options.waveformStyle` by {@link draw}.
 * @type {Object.<string, function(CanvasRenderingContext2D, HTMLCanvasElement, number[], number, Object): void>}
 */
export declare const DRAWING_STYLES: {
    bars: typeof drawBars;
    mirror: typeof drawMirror;
    line: typeof drawLine;
    blocks: typeof drawBlocks;
    dots: typeof drawDots;
    seekbar: typeof drawSeekbar;
};
/**
 * Main drawing entry point that delegates to the style named by
 * `options.waveformStyle`, falling back to {@link drawBars} for unknown styles.
 * @param ctx - Canvas context
 * @param canvas - Canvas element
 * @param peaks - Waveform peak data (0-1)
 * @param progress - Progress (0-1)
 * @param options - Drawing options, including `waveformStyle` plus the
 *   per-style fields (`barWidth`, `barSpacing`, `barRadius`, `color`, `progressColor`).
 * @returns
 */
export declare function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void;
