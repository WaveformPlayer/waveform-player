/**
 * @module drawing
 * @description Core waveform drawing styles optimized for visual distinction at all sizes
 */

import {resampleData, clamp} from './utils.js';

/**
 * How many bars of `pitch` device pixels (width + spacing) fit across the
 * canvas. A zero, negative or non-numeric pitch fits none: `width / 0` is
 * `Infinity`, and resampleData() would loop until the tab ran out of memory.
 * normalizeOptions() keeps `barWidth` above zero, but options stay publicly
 * mutable, so the drawers guard the division themselves.
 * @param canvas - Canvas element (device-pixel width).
 * @param pitch - Bar width plus spacing, in device pixels.
 * @returns Bar count, 0 when the pitch is unusable.
 * @private
 */
function fitBars(canvas: HTMLCanvasElement, pitch: number): number {
    return pitch > 0 ? Math.floor(canvas.width / pitch) : 0;
}

/**
 * Resolve a fill value that may be a CSS colour string OR an array of colour
 * stops (rendered as a canvas gradient). Bundle-light gradient support: pass
 * e.g. `waveformColor: ['#fafafa', '#71717a']`. A single-element array collapses
 * to that one colour; a multi-element array is spread evenly along the axis set
 * by `options.waveformGradient`:
 *   - `'vertical'`   (default) a canvas-height gradient (colour keyed to
 *     absolute Y, so short bars occupy only the lower band).
 *   - `'horizontal'` left -> right across the whole waveform (a hue sweep).
 *   - `'diagonal'`   top-left -> bottom-right.
 * @private
 * @param ctx - Canvas context used to build the gradient.
 * @param value - A CSS colour string, or an array of colour stops.
 * @param canvas - Canvas (provides the device-pixel span).
 * @param options - Drawing options; reads `waveformGradient`.
 * @returns The original string, or a linear gradient.
 */
function makeFill(ctx: CanvasRenderingContext2D, value: string | string[], canvas: HTMLCanvasElement, options?: Record<string, any>): string | CanvasGradient {
    if (!Array.isArray(value)) return value;
    if (value.length < 2) return value[0];
    const w = canvas.width;
    const h = canvas.height;
    const dir = options && options.waveformGradient;
    const [x0, y0, x1, y1] =
        dir === 'horizontal' ? [0, 0, w, 0] :
        dir === 'diagonal'   ? [0, 0, w, h] :
                               [0, 0, 0, h];
    try {
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        value.forEach((c, i) => grad.addColorStop(i / (value.length - 1), c));
        return grad;
    } catch (e) {
        return value[0]; // a bad stop shouldn't abort the whole render
    }
}

/**
 * Fill a bar rect, optionally with rounded caps (`barRadius`). Falls back to
 * a plain fillRect where `roundRect` is unavailable (older Safari) — square
 * bars, no error. Radii are clamped to half the rect's width/height so a
 * large `barRadius` never overflows a thin or short bar.
 * @private
 * @param ctx - Canvas context (current fillStyle is used).
 * @param x - Left edge of the bar in device pixels.
 * @param y - Top edge of the bar in device pixels.
 * @param w - Bar width in device pixels.
 * @param h - Bar height in device pixels (may be negative for upward fills).
 * @param radii - Corner radius (number, or [tl, tr, br, bl]).
 * @returns 
 */
function fillBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radii: number | number[]): void {
    const any = Array.isArray(radii) ? radii.some(r => r > 0) : radii > 0;
    if (any && typeof ctx.roundRect === 'function') {
        const max = Math.min(w / 2, Math.abs(h) / 2);
        const clampR = (r: number) => clamp(r, 0, max);
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Array.isArray(radii) ? radii.map(clampR) : clampR(radii));
        ctx.fill();
    } else {
        ctx.fillRect(x, y, w, h);
    }
}

/**
 * Scale the configured `barRadius` into device pixels (scalar).
 * @private
 * @param options - Drawing options (`barRadius` in CSS pixels, defaults to 0).
 * @param dpr - Device pixel ratio multiplier.
 * @returns The bar corner radius in device pixels.
 */
function barRadiusPx(options: Record<string, any>, dpr: number): number {
    return (options.barRadius || 0) * dpr;
}

/**
 * Top-rounded corner radii for bottom-anchored bars: [tl, tr, br, bl].
 * Only the top two corners are rounded so bars sit flush on the baseline.
 * @private
 * @param options - Drawing options (supplies `barRadius`).
 * @param dpr - Device pixel ratio multiplier.
 * @returns Corner radii in device pixels as [tl, tr, br, bl].
 */
function barRadii(options: Record<string, any>, dpr: number): number[] {
    const r = barRadiusPx(options, dpr);
    return [r, r, 0, 0];
}

/**
 * Trace a horizontal rounded-capsule (stadium) path from `startX` to `endX`,
 * ready to fill. The end caps are semicircles of radius `barHeight / 2`.
 * @private
 * @param ctx - Canvas context.
 * @param startX - Left edge x (also the left cap centre).
 * @param endX - Right edge x.
 * @param centerY - Vertical centre of the capsule.
 * @param barHeight - Capsule thickness in pixels.
 * @returns 
 */
function capsulePath(ctx: CanvasRenderingContext2D, startX: number, endX: number, centerY: number, barHeight: number): void {
    const r = barHeight / 2;
    ctx.beginPath();
    ctx.moveTo(startX, centerY - r);
    ctx.lineTo(endX - r, centerY - r);
    ctx.arc(endX - r, centerY, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(startX, centerY + r);
    ctx.arc(startX, centerY, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
}

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
export function drawBars(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void {
    const dpr = window.devicePixelRatio || 1;
    const barWidth = options.barWidth * dpr;
    const barSpacing = options.barSpacing * dpr;
    const barCount = fitBars(canvas, barWidth + barSpacing);
    const resampledPeaks = resampleData(peaks, barCount);
    const height = canvas.height;
    const progressWidth = progress * canvas.width;
    const radii = barRadii(options, dpr);
    const baseFill = makeFill(ctx, options.color, canvas, options);
    const progFill = makeFill(ctx, options.progressColor, canvas, options);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all bars first
    ctx.fillStyle = baseFill;
    for (let i = 0; i < resampledPeaks.length; i++) {
        const x = i * (barWidth + barSpacing);
        if (x + barWidth > canvas.width) break;

        const peakHeight = resampledPeaks[i] * height * 0.9;
        // Draw from bottom up, not centered
        const y = height - peakHeight;

        fillBar(ctx, x, y, barWidth, peakHeight, radii);
    }

    // Progress overlay
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, progressWidth, height);
    ctx.clip();

    ctx.fillStyle = progFill;
    for (let i = 0; i < resampledPeaks.length; i++) {
        const x = i * (barWidth + barSpacing);
        if (x > progressWidth) break;

        const peakHeight = resampledPeaks[i] * height * 0.9;
        // Draw from bottom up, not centered
        const y = height - peakHeight;

        fillBar(ctx, x, y, barWidth, peakHeight, radii);
    }

    ctx.restore();
}

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
export function drawMirror(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void {
    const dpr = window.devicePixelRatio || 1;
    const barWidth = options.barWidth * dpr;
    const barSpacing = options.barSpacing * dpr;
    const barCount = fitBars(canvas, barWidth + barSpacing);
    const resampledPeaks = resampleData(peaks, barCount);
    const height = canvas.height;
    const centerY = height / 2;
    const progressWidth = progress * canvas.width;
    const r = barRadiusPx(options, dpr);
    const topRadii = [r, r, 0, 0];   // round the upper cap
    const botRadii = [0, 0, r, r];   // round the lower cap
    const baseFill = makeFill(ctx, options.color, canvas, options);
    const progFill = makeFill(ctx, options.progressColor, canvas, options);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all bars
    ctx.fillStyle = baseFill;
    for (let i = 0; i < resampledPeaks.length; i++) {
        const x = i * (barWidth + barSpacing);
        if (x + barWidth > canvas.width) break;

        const peakHeight = resampledPeaks[i] * height * 0.45;

        fillBar(ctx, x, centerY - peakHeight, barWidth, peakHeight, topRadii);
        fillBar(ctx, x, centerY, barWidth, peakHeight, botRadii);
    }

    // Progress overlay
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, progressWidth, height);
    ctx.clip();

    ctx.fillStyle = progFill;
    for (let i = 0; i < resampledPeaks.length; i++) {
        const x = i * (barWidth + barSpacing);
        if (x > progressWidth) break;

        const peakHeight = resampledPeaks[i] * height * 0.45;

        fillBar(ctx, x, centerY - peakHeight, barWidth, peakHeight, topRadii);
        fillBar(ctx, x, centerY, barWidth, peakHeight, botRadii);
    }

    ctx.restore();
}

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
export function drawLine(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void {
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const amplitude = height * 0.35;

    ctx.clearRect(0, 0, width, height);

    /**
     * Stroke a bezier-smoothed curve through the (optionally sine-modulated) peaks.
     * @private
     * @param color - Stroke colour (and shadow colour when glowing).
     * @param lineWidth - Stroke width in pixels.
     * @param endProgress - Fraction (0-1) of the peaks to draw, left to right. Default 1.
     * @param addGlow - When true, applies a coloured shadow blur for a glow effect.
     */
    const drawCurve = (color: string | string[], lineWidth: number, endProgress: number = 1, addGlow: boolean = false): void => {
        // strokeStyle accepts a gradient; shadowColor must be a solid string, so
        // collapse a stop array to its last stop for the glow.
        const stroke = makeFill(ctx, color, canvas, options);
        const solid = Array.isArray(color) ? color[color.length - 1] : color;
        if (addGlow) {
            ctx.shadowBlur = 12;
            ctx.shadowColor = solid;
        }

        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(0, centerY);

        const points = [];
        const samples = Math.floor(peaks.length * endProgress);

        // Calculate smoothed points
        for (let i = 0; i < samples; i++) {
            const x = (i / (peaks.length - 1)) * width;
            const peakValue = peaks[i];

            // Create a smooth wave motion
            const waveOffset = Math.sin(i * 0.1) * peakValue;
            const y = centerY + (waveOffset * amplitude);

            points.push({x, y});
        }

        // Draw smooth curve through points using bezier curves
        for (let i = 0; i < points.length - 1; i++) {
            const cp1x = points[i].x + (points[i + 1].x - points[i].x) * 0.5;
            const cp1y = points[i].y;
            const cp2x = points[i + 1].x - (points[i + 1].x - points[i].x) * 0.5;
            const cp2y = points[i + 1].y;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, points[i + 1].x, points[i + 1].y);
        }

        ctx.stroke();

        if (addGlow) {
            ctx.shadowBlur = 0;
        }
    };

    // Draw subtle grid for oscilloscope feel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
        const x = (width / 10) * i;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // Draw background wave
    drawCurve(options.color, 2, 1, false);

    // Draw progress with glow
    if (progress > 0) {
        drawCurve(options.progressColor, 3, progress, true);
    }
}

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
export function drawBlocks(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void {
    const dpr = window.devicePixelRatio || 1;
    const barWidth = (options.barWidth || 3) * dpr;
    const barSpacing = (options.barSpacing || 1) * dpr;
    const barCount = fitBars(canvas, barWidth + barSpacing);
    const resampledPeaks = resampleData(peaks, barCount);
    const height = canvas.height;
    const blockSize = 4 * dpr;
    const blockGap = 2 * dpr;
    const progressWidth = progress * canvas.width;
    const centerY = height / 2;
    const baseFill = makeFill(ctx, options.color, canvas, options);
    const progFill = makeFill(ctx, options.progressColor, canvas, options);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < resampledPeaks.length; i++) {
        const x = i * (barWidth + barSpacing);
        if (x + barWidth > canvas.width) break;

        const peakHeight = resampledPeaks[i] * height * 0.9;
        const blockCount = Math.floor(peakHeight / (blockSize + blockGap));

        ctx.fillStyle = x < progressWidth ? progFill : baseFill;

        // Draw blocks from center outward
        for (let j = 0; j < blockCount; j++) {
            const blockOffset = j * (blockSize + blockGap);

            // Upper blocks
            ctx.fillRect(x, centerY - blockOffset - blockSize, barWidth, blockSize);

            // Lower blocks (skip the center block)
            if (j > 0) {
                ctx.fillRect(x, centerY + blockOffset, barWidth, blockSize);
            }
        }
    }
}

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
export function drawDots(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void {
    const dpr = window.devicePixelRatio || 1;
    const barWidth = (options.barWidth || 2) * dpr;
    const barSpacing = (options.barSpacing || 3) * dpr;
    const barCount = fitBars(canvas, barWidth + barSpacing);
    const resampledPeaks = resampleData(peaks, barCount);
    const height = canvas.height;
    const dotRadius = Math.max(1.5 * dpr, barWidth / 2);
    const progressWidth = progress * canvas.width;
    const centerY = height / 2;
    const baseFill = makeFill(ctx, options.color, canvas, options);
    const progFill = makeFill(ctx, options.progressColor, canvas, options);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < resampledPeaks.length; i++) {
        const x = i * (barWidth + barSpacing) + barWidth / 2;
        if (x > canvas.width) break;

        const peakHeight = resampledPeaks[i] * height * 0.9;

        ctx.fillStyle = x < progressWidth ? progFill : baseFill;

        // Draw upper dot
        ctx.beginPath();
        ctx.arc(x, centerY - peakHeight / 2, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw lower dot
        ctx.beginPath();
        ctx.arc(x, centerY + peakHeight / 2, dotRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}

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
export function drawSeekbar(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void {
    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const barHeight = 4; // Height of the seekbar in pixels
    const borderRadius = barHeight / 2;
    const active = !!options.seekActive; // hovering or dragging the seekbar

    ctx.clearRect(0, 0, width, height);

    // Draw background track
    ctx.fillStyle = makeFill(ctx, options.color, canvas, options) || 'rgba(255, 255, 255, 0.2)';

    // Rounded background track
    capsulePath(ctx, borderRadius, width, centerY, barHeight);
    ctx.fill();

    // Draw progress — slightly dimmed at rest, full-bright on hover / drag.
    // With a monochrome palette there's no hue to swap (Spotify goes
    // white→green), so the hover cue is a brightness lift plus the handle
    // appearing. The draggable handle is a DOM element
    // (`.waveform-seek-handle`), not drawn here — so it's always a perfect
    // circle and can grow on direct hover via CSS.
    if (progress > 0) {
        const progressWidth = Math.max(borderRadius * 2, progress * width);

        // Brightness lift on hover/drag is only meaningful when the handle is
        // enabled (the bar); a standalone seekbar stays at full progress.
        ctx.save();
        ctx.globalAlpha = options.seekHandle && !active ? 0.7 : 1;
        ctx.fillStyle = makeFill(ctx, options.progressColor, canvas, options) || 'rgba(255, 255, 255, 0.9)';
        capsulePath(ctx, borderRadius, progressWidth, centerY, barHeight);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * Map of style names (and singular aliases) to their drawing functions.
 * Six visually distinct styles including a simple seekbar; keys are matched
 * against `options.waveformStyle` by {@link draw}.
 * @type {Object.<string, function(CanvasRenderingContext2D, HTMLCanvasElement, number[], number, Object): void>}
 */
export const DRAWING_STYLES = {
    'bars': drawBars,        // Classic vertical bars
    'bar': drawBars,
    'mirror': drawMirror,    // SoundCloud-style symmetrical
    'line': drawLine,        // Smooth oscilloscope wave
    'blocks': drawBlocks,    // LED meter segmented
    'block': drawBlocks,
    'dots': drawDots,        // Circular points
    'dot': drawDots,
    'seekbar': drawSeekbar   // Simple progress bar (no waveform)
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
export function draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, peaks: number[], progress: number, options: Record<string, any>): void {
    const drawFunc = DRAWING_STYLES[options.waveformStyle as keyof typeof DRAWING_STYLES] || drawBars;
    drawFunc(ctx, canvas, peaks, progress, options);
}