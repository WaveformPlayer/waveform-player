/**
 * @module element
 * @description The `<waveform-player>` custom element.
 *
 * A light-DOM wrapper: the element itself is the player's container, so the
 * stylesheet applies as it does to any `[data-waveform-player]`, server-rendered
 * markup upgrades in place, and `waveformplayer:*` events bubble from the tag.
 * Configured by attributes — every `data-*` option, with or without the `data-`
 * prefix (`src`, `waveform-style`, `duration`, …), the unprefixed form winning.
 *
 * The default entry point registers it; `/no-autoinit` only exports
 * {@link defineWaveformPlayerElement}.
 */
import { WaveformPlayer } from './core.js';
declare global {
    interface HTMLElementTagNameMap {
        'waveform-player': WaveformPlayerElement;
    }
}
declare const Base: typeof HTMLElement;
/**
 * `<waveform-player src="track.mp3" duration="187" waveform-style="bars">`.
 *
 * - `connectedCallback` builds the player into the element; `disconnectedCallback`
 *   destroys it, unless the element is put back before the current task ends
 *   (a move within the DOM keeps the player, and its playback).
 * - Changing `src`/`url`/`title`/`artist`/`artwork`/`waveform`/`duration`
 *   (either form) loads the new track, playing on if it was playing; changing
 *   any other option attribute rebuilds the player.
 * - {@link WaveformPlayerElement.player} is the instance; `play()`, `pause()` and
 *   `togglePlay()` forward to it.
 */
export declare class WaveformPlayerElement extends Base {
    /** The player inside this element, or `null` while disconnected. */
    player: WaveformPlayer | null;
    static get observedAttributes(): string[];
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, previous: string | null, value: string | null): void;
    /** Play — {@link WaveformPlayer.play}. */
    play(): Promise<void> | undefined;
    /** Pause — {@link WaveformPlayer.pause}. */
    pause(): void;
    /** Toggle play/pause — {@link WaveformPlayer.togglePlay}. */
    togglePlay(): void;
}
/**
 * Register the `<waveform-player>` element (or the same element under another
 * name). The default entry point does this on import; `/no-autoinit` leaves it
 * to you. A name that is already defined is left alone.
 * @param name - Tag name; must contain a hyphen.
 * @returns The registered constructor, or `undefined` outside a browser.
 */
export declare function defineWaveformPlayerElement(name?: string): CustomElementConstructor | undefined;
export {};
//# sourceMappingURL=element.d.ts.map