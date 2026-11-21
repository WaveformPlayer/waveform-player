import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WaveformPlayer } from '../src/js/core.js';
import { WaveformPlayerElement, defineWaveformPlayerElement } from '../src/js/element.js';
import { parseDataAttributes } from '../src/js/utils.js';

/**
 * The `<waveform-player>` custom element: light DOM, the element is the
 * container, configured by every data-* option with or without the prefix.
 * Built with external mode where the test doesn't need audio.
 */

const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = () => new Promise((r) => queueMicrotask(r));

beforeAll(() => {
	// Registered here directly; the entry points' own registration is covered
	// in element-registration.test.js, in a clean registry.
	defineWaveformPlayerElement();
	// Stand in for the scan entry.js attaches (core.js alone doesn't).
	WaveformPlayer.init ??= (root = document) =>
		root.querySelectorAll('[data-waveform-player]').forEach((el) => {
			if (!WaveformPlayer.getInstance(el)) new WaveformPlayer(el);
		});
});

afterEach(() => {
	document.body.innerHTML = '';
	WaveformPlayer.destroyAll();
	vi.restoreAllMocks();
});

/** Parse markup into the document, as a server-rendered page would arrive. */
function render(html) {
	document.body.innerHTML = html;
	return document.body.firstElementChild;
}

describe('attributes', () => {
	it('accepts exactly the data-* keys parseDataAttributes reads, in both forms', () => {
		// Drift guard: every key the data-* parser reads must be observable on
		// the element, and the element must not claim keys the parser ignores.
		const src = readFileSync(resolve(process.cwd(), 'src/js/utils.ts'), 'utf8');
		const body = src.slice(src.indexOf('export function parseDataAttributes'));
		const fn = body.slice(0, body.indexOf('\n}\n'));
		const keys = new Set();
		for (const m of fn.matchAll(/dataset\.([a-zA-Z]+)/g)) keys.add(m[1]);
		for (const m of fn.matchAll(/set(?:Bool|Num|Length|JsonArray)\('([a-zA-Z]+)'(?:, '([a-zA-Z]+)')?/g)) keys.add(m[2] ?? m[1]);
		const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

		const observed = new Set(WaveformPlayerElement.observedAttributes);
		const expected = new Set([...keys].flatMap((k) => k === 'style' ? ['data-style'] : [kebab(k), 'data-' + kebab(k)]));
		expect([...observed].sort()).toEqual([...expected].sort());
	});

	it('builds the player into the element itself on connect', () => {
		const el = render('<waveform-player src="/a.mp3" audio-mode="external" title="Song"></waveform-player>');
		expect(el).toBeInstanceOf(WaveformPlayerElement);
		expect(el.player).toBeInstanceOf(WaveformPlayer);
		expect(el.player.container).toBe(el);
		expect(WaveformPlayer.getInstance(el)).toBe(el.player);
		expect(el.player.options).toMatchObject({ url: '/a.mp3', title: 'Song', audioMode: 'external' });
		expect(el.querySelector('.waveform-player-inner')).not.toBeNull(); // light DOM
		expect(el.shadowRoot).toBeNull();
	});

	it('takes data-* too, with the unprefixed form winning', () => {
		const el = render('<waveform-player data-src="/a.mp3" data-audio-mode="external" data-height="80" height="40" data-waveform-style="bars"></waveform-player>');
		expect(el.player.options).toMatchObject({ url: '/a.mp3', height: 40, waveformStyle: 'bars' });
	});

	it('reads a bare boolean attribute as true', () => {
		const el = render('<waveform-player src="/a.mp3" loop show-loop lazy="false" show-bpm></waveform-player>');
		expect(el.player.options).toMatchObject({ loop: true, showLoop: true, lazy: false, showBPM: true });
	});

	it('leaves the plain style attribute to CSS (data-style still aliases waveformStyle)', () => {
		const el = render('<waveform-player audio-mode="external" style="color: red" data-style="dots"></waveform-player>');
		expect(el.player.options.waveformStyle).toBe('dots');
		expect(el.style.color).toBe('red');
	});

	it('parses the new options the same way as data-* (duration, compact peaks, markers)', () => {
		const el = render(`<waveform-player audio-mode="external" src="/a.mp3" duration="90" waveform="wp1:_w" markers='[{"time":30,"label":"A"}]'></waveform-player>`);
		const host = document.createElement('div');
		Object.assign(host.dataset, { duration: '90', waveform: 'wp1:_w', markers: '[{"time":30,"label":"A"}]' });
		expect(el.player.options).toMatchObject(parseDataAttributes(host));
	});
});

describe('events', () => {
	it('bubble from the element', () => {
		const el = render('<waveform-player src="/a.mp3" audio-mode="external"></waveform-player>');
		const heard = [];
		const listener = (e) => heard.push(e.target);
		document.addEventListener('waveformplayer:play', listener);
		el.player.setPlayingState(true);
		document.removeEventListener('waveformplayer:play', listener);
		expect(heard).toEqual([el]);
	});
});

describe('lifecycle', () => {
	it('a move within the DOM keeps the player', async () => {
		const el = render('<waveform-player src="/a.mp3" audio-mode="external"></waveform-player>');
		const player = el.player;
		const destroy = vi.spyOn(player, 'destroy');
		const resize = vi.spyOn(player, 'resizeCanvas');
		const other = document.createElement('section');
		document.body.appendChild(other);
		other.appendChild(el); // disconnect + connect in one task
		await tick();
		expect(el.player).toBe(player);
		expect(destroy).not.toHaveBeenCalled();
		expect(resize).toHaveBeenCalled();
		expect(WaveformPlayer.getInstance(el)).toBe(player);
	});

	it('removal destroys the player once the task is over; re-adding builds a new one', async () => {
		const el = render('<waveform-player src="/a.mp3" audio-mode="external"></waveform-player>');
		const player = el.player;
		el.remove();
		expect(el.player).toBe(player); // not yet: it may come back this task
		await tick();
		expect(el.player).toBeNull();
		expect(WaveformPlayer.getInstance(el)).toBeUndefined();
		expect(player.isDestroying).toBe(true);

		document.body.appendChild(el);
		expect(el.player).toBeInstanceOf(WaveformPlayer);
		expect(el.player).not.toBe(player);
	});

	it('changing a track attribute loads the track in the same player', async () => {
		const el = render('<waveform-player src="/a.mp3" title="A" audio-mode="external" waveform="[0.5]"></waveform-player>');
		const player = el.player;
		const loadTrack = vi.spyOn(player, 'loadTrack');
		el.setAttribute('src', '/b.mp3');
		el.setAttribute('title', 'B');
		el.setAttribute('duration', '120');
		await flush();
		expect(el.player).toBe(player);
		expect(loadTrack).toHaveBeenCalledTimes(1); // batched
		expect(loadTrack.mock.calls[0].slice(0, 3)).toEqual(['/b.mp3', 'B', '']);
		expect(player.options).toMatchObject({ url: '/b.mp3', title: 'B', duration: 120 });

		el.setAttribute('data-artist', 'Someone');
		await flush();
		expect(loadTrack).toHaveBeenCalledTimes(2);
		expect(player.options.artist).toBe('Someone');
	});

	it('a track change keeps playing only if it was playing', async () => {
		const el = render('<waveform-player src="/a.mp3" audio-mode="external" waveform="[0.5]"></waveform-player>');
		const loadTrack = vi.spyOn(el.player, 'loadTrack');
		el.setAttribute('src', '/b.mp3');
		await flush();
		expect(loadTrack.mock.calls[0][3].autoplay).toBe(false);
		el.player.setPlayingState(true);
		el.setAttribute('src', '/c.mp3');
		await flush();
		expect(loadTrack.mock.calls[1][3].autoplay).toBe(true);
	});

	it('changing any other option attribute rebuilds the player', async () => {
		const el = render('<waveform-player src="/a.mp3" audio-mode="external" height="40"></waveform-player>');
		const first = el.player;
		el.setAttribute('height', '90');
		el.setAttribute('src', '/b.mp3'); // a rebuild covers the track change too
		await flush();
		expect(first.isDestroying).toBe(true);
		expect(el.player).not.toBe(first);
		expect(el.player.options).toMatchObject({ height: 90, url: '/b.mp3' });
		expect(WaveformPlayer.getAllInstances()).toEqual([el.player]);
	});

	it('ignores unobserved attributes and unchanged values', async () => {
		const el = render('<waveform-player src="/a.mp3" audio-mode="external" height="40"></waveform-player>');
		const first = el.player;
		el.setAttribute('class', 'mine');
		el.setAttribute('height', '40');
		await flush();
		expect(el.player).toBe(first);
		expect(el.classList.contains('mine')).toBe(true);
	});
});

describe('forwarded methods', () => {
	it('play(), pause() and togglePlay() reach the player', () => {
		const el = render('<waveform-player src="/a.mp3" audio-mode="external"></waveform-player>');
		const requests = [];
		el.addEventListener('waveformplayer:request-play', () => requests.push('play'));
		el.addEventListener('waveformplayer:request-pause', () => requests.push('pause'));
		expect(el.play()).toBeUndefined(); // external mode returns undefined, as the player does
		el.pause();
		el.togglePlay();
		expect(requests).toEqual(['play', 'pause', 'play']);
	});

	it('are harmless while disconnected', () => {
		const el = document.createElement('waveform-player');
		expect(el.player ?? null).toBeNull();
		expect(() => { el.play(); el.pause(); el.togglePlay(); }).not.toThrow();
	});
});

describe('never initialised twice', () => {
	it('the [data-waveform-player] scan skips an element that already built its player', () => {
		const el = render('<waveform-player data-waveform-player src="/a.mp3" audio-mode="external"></waveform-player>');
		WaveformPlayer.init();
		expect(WaveformPlayer.getAllInstances()).toEqual([el.player]);
	});

	it('an element upgraded after a scan replaces the scan\'s player with its own', () => {
		defineWaveformPlayerElement('late-player');
		document.body.innerHTML = '<div id="host"></div>';
		const el = document.createElement('div');
		el.innerHTML = '<late-player data-waveform-player src="/a.mp3" audio-mode="external"></late-player>';
		const late = el.firstElementChild; // not upgraded: not in the document yet
		const scanned = new WaveformPlayer(late, { audioMode: 'external' });
		document.getElementById('host').appendChild(late); // connects → its own player
		expect(scanned.isDestroying).toBe(true);
		expect(WaveformPlayer.getAllInstances()).toEqual([late.player]);
	});
});

describe('defineWaveformPlayerElement', () => {
	it('is idempotent and returns the registered constructor', () => {
		const ctor = customElements.get('waveform-player');
		expect(defineWaveformPlayerElement()).toBe(ctor);
		expect(new ctor()).toBeInstanceOf(WaveformPlayerElement);
	});

	it('registers the element under another name', () => {
		const ctor = defineWaveformPlayerElement('my-audio-player');
		expect(customElements.get('my-audio-player')).toBe(ctor);
		const el = render('<my-audio-player src="/a.mp3" audio-mode="external"></my-audio-player>');
		expect(el.player).toBeInstanceOf(WaveformPlayer);
	});
});

describe('stylesheet', () => {
	it('gives the element block display, and its height before upgrade', () => {
		const css = readFileSync(resolve(process.cwd(), 'src/css/waveform-player.css'), 'utf8');
		expect(css).toMatch(/waveform-player\s*\{\s*display:\s*block;/);
		const before = css.match(/waveform-player:not\(:defined\)\s*\{([^}]*)\}/);
		expect(before).not.toBeNull();
		// No display of its own: the plain `waveform-player` rule above matches
		// the element before upgrade too, so it is already a block.
		expect(before[1]).toMatch(/min-height:\s*var\(--wfp-element-height,\s*90px\)/);
	});
});
