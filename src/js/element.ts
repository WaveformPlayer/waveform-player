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

import {WaveformPlayer} from './core.js';
import {BOOLEANS} from './themes.js';
import {parseDataAttributes} from './utils.js';
import type {WaveformPlayerOptions} from './types.js';

declare global {
    interface HTMLElementTagNameMap {
        'waveform-player': WaveformPlayerElement;
    }
}

/**
 * Every `data-*` key `parseDataAttributes` reads, as its `dataset` name. The
 * element accepts each as `data-<kebab>` and as plain `<kebab>`, except
 * `style`: unprefixed, that is the element's CSS, so the `style` alias only
 * works as `data-style` (or use `waveform-style`). `test/element.test.js`
 * fails if this list and `parseDataAttributes` drift apart.
 */
const OPTION_KEYS = [
    'src', 'url', 'height', 'samples', 'duration', 'preload', 'crossOrigin', 'audioMode', 'lazy',
    'style', 'waveformStyle', 'waveformGradient', 'barWidth', 'barSpacing', 'barRadius',
    'buttonAlign', 'layout', 'buttonStyle', 'buttonSize', 'buttonRadius', 'colorPreset',
    'waveformColor', 'progressColor', 'autoplay', 'showControls', 'showInfo', 'showTime',
    'showHoverTime', 'seekHandle', 'showBpm', 'bpm', 'singlePlay', 'playOnSeek', 'loop',
    'showLoop', 'showVolume', 'volume', 'showDownload', 'downloadUrl', 'downloadName',
    'title', 'artist', 'album', 'artwork', 'artworkPosition', 'waveform', 'markers',
    'playbackRate', 'showPlaybackSpeed', 'playbackRates', 'enableMediaSession', 'showMarkers',
    'accessibleSeek', 'seekLabel', 'seekValueText', 'errorText', 'playPauseLabel', 'speedLabel',
    'loopLabel', 'volumeLabel', 'muteLabel', 'downloadLabel', 'artworkAlt', 'unknownTrackText',
    'playIcon', 'pauseIcon',
];

/** Attributes that describe the track: changing one loads it, not a rebuild. */
const TRACK_KEYS = ['src', 'url', 'title', 'artist', 'artwork', 'waveform', 'duration'];

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const isBoolean = (key: string) => BOOLEANS.some((b) => b.toLowerCase() === key.toLowerCase());

/**
 * Read the element's options: each key from its plain attribute, else its
 * `data-` one, through the same `parseDataAttributes` the `data-*` contract
 * uses. A bare boolean attribute (`<waveform-player loop>`) means true, as
 * HTML boolean attributes do.
 * @param el - The element.
 * @returns Sparse options.
 */
function readOptions(el: HTMLElement): WaveformPlayerOptions {
    const dataset: Record<string, string> = {};
    for (const key of OPTION_KEYS) {
        const name = kebab(key);
        const plain = key === 'style' ? null : el.getAttribute(name);
        const value = plain === '' && isBoolean(key) ? 'true' : plain ?? el.getAttribute('data-' + name);
        if (value != null) dataset[key] = value;
    }
    return parseDataAttributes({dataset} as unknown as HTMLElement);
}

// Defined on any host: SSR and plain-Node imports have no HTMLElement, and
// this module must still evaluate there (the class is only ever constructed
// by a browser's customElements).
const Base = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

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
export class WaveformPlayerElement extends Base {
    /** The player inside this element, or `null` while disconnected. */
    declare player: WaveformPlayer | null;
    /** @internal A disconnection waiting to see whether the element comes back. */ declare _leaving: ReturnType<typeof setTimeout> | undefined;
    /** @internal Attribute changes batched into one load or rebuild. */ declare _pending: 'load' | 'rebuild' | undefined;

    static get observedAttributes(): string[] {
        return OPTION_KEYS.flatMap((key) => key === 'style' ? ['data-style'] : [kebab(key), 'data-' + kebab(key)]);
    }

    connectedCallback() {
        // Moved within the DOM: same player, just re-fit the canvas (a move
        // doesn't reliably trip the resize observer).
        if (this._leaving !== undefined) {
            clearTimeout(this._leaving);
            this._leaving = undefined;
            this.player?.resizeCanvas();
            return;
        }
        if (!this.player) this._build();
    }

    disconnectedCallback() {
        clearTimeout(this._leaving);
        this._leaving = setTimeout(() => {
            this._leaving = undefined;
            if (!this.isConnected) this._teardown();
        }, 0);
    }

    attributeChangedCallback(name: string, previous: string | null, value: string | null) {
        // Before connection (and during the upgrade of parsed markup) the
        // attributes are simply read by connectedCallback.
        if (!this.player || previous === value) return;
        const key = name.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        const kind = TRACK_KEYS.includes(key) ? 'load' : 'rebuild';
        if (this._pending) {
            if (kind === 'rebuild') this._pending = kind;
            return;
        }
        this._pending = kind;
        queueMicrotask(() => {
            const pending = this._pending;
            this._pending = undefined;
            if (!this.player) return;
            if (pending === 'rebuild') this._rebuild(); else this._loadTrack();
        });
    }

    /** Play — {@link WaveformPlayer.play}. */
    play(): Promise<void> | undefined {
        return this.player?.play();
    }

    /** Pause — {@link WaveformPlayer.pause}. */
    pause() {
        this.player?.pause();
    }

    /** Toggle play/pause — {@link WaveformPlayer.togglePlay}. */
    togglePlay() {
        this.player?.togglePlay();
    }

    /** @internal */
    _build() {
        // A declarative scan (`data-waveform-player` on this tag) or a script
        // may have built a player here first; the element's own wins.
        WaveformPlayer.getInstance(this)?.destroy();
        try {
            this.player = new WaveformPlayer(this, readOptions(this));
            // The scan's own claim flag (destroy() clears it): a scan by any
            // copy of the library skips this element, even one whose registry
            // can't see this player.
            this.dataset.waveformInitialized = 'true';
        } catch (error) {
            this.player = null;
            console.error('[WaveformPlayer] Failed to initialize:', error, this);
        }
    }

    /** @internal */
    _teardown() {
        this.player?.destroy();
        this.player = null;
    }

    /** @internal */
    _rebuild() {
        this._teardown();
        this._build();
    }

    /** @internal Load the track the attributes now describe, keeping the player. */
    _loadTrack() {
        const {url, title, artist, ...options} = readOptions(this);
        if (!url) {
            this._rebuild();
            return;
        }
        const player = this.player!;
        player.loadTrack(url, title || '', artist || '', {
            // Every per-track option the attributes give, so loadTrack() only
            // resets what the element doesn't set.
            ...options,
            artwork: options.artwork || null,
            autoplay: player.isPlaying,
        });
    }
}

/**
 * Register the `<waveform-player>` element (or the same element under another
 * name). The default entry point does this on import; `/no-autoinit` leaves it
 * to you. A name that is already defined is left alone.
 * @param name - Tag name; must contain a hyphen.
 * @returns The registered constructor, or `undefined` outside a browser.
 */
export function defineWaveformPlayerElement(name: string = 'waveform-player'): CustomElementConstructor | undefined {
    if (typeof customElements === 'undefined') return undefined;
    const existing = customElements.get(name);
    if (existing) return existing;
    // A constructor can only be registered once, so each name gets its own
    // subclass (all of them `instanceof WaveformPlayerElement`).
    const element = class extends WaveformPlayerElement {};
    customElements.define(name, element);
    return element;
}
