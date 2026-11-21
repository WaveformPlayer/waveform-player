import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveformPlayer } from '../src/js/core.js';

/**
 * Standard events: the player is an EventTarget, each lifecycle moment is a
 * plain event on the instance plus a bubbling, composed `waveformplayer:*`
 * CustomEvent on the container, and the `on*` callbacks still run as before.
 * Self-mode tests dispatch the media events a browser would fire.
 */

let mounted = [];
function mount(options = {}, host = document.body) {
	const el = document.createElement('div');
	host.appendChild(el);
	const player = new WaveformPlayer(el, options);
	mounted.push(player);
	return { el, player };
}
const external = (options = {}, host) => mount({ audioMode: 'external', ...options }, host);
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function stubClock(audio, { duration = 100, currentTime = 0 } = {}) {
	const clock = { duration, currentTime };
	Object.defineProperty(audio, 'duration', { configurable: true, get: () => clock.duration });
	Object.defineProperty(audio, 'currentTime', { configurable: true, get: () => clock.currentTime, set: (v) => { clock.currentTime = v; } });
	return clock;
}

/** Record both forms of one event, in arrival order, into a shared log. */
function listen(player, name, log = []) {
	player.container.addEventListener(`waveformplayer:${name}`, (e) => log.push(['container', e]));
	player.addEventListener(name, (e) => log.push(['instance', e]));
	return log;
}

beforeEach(() => { mounted = []; });
afterEach(() => {
	mounted.forEach((p) => { try { p.destroy(); } catch {} });
	document.body.innerHTML = '';
	WaveformPlayer.destroyAll();
	WaveformPlayer.currentlyPlaying = null;
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	delete navigator.mediaSession;
});

describe('WaveformPlayer is an EventTarget', () => {
	it('extends EventTarget', () => {
		const { player } = external();
		expect(player).toBeInstanceOf(EventTarget);
		const fn = vi.fn();
		player.addEventListener('play', fn);
		player.removeEventListener('play', fn);
		player.setPlayingState(true);
		expect(fn).not.toHaveBeenCalled();
	});
});

describe('lifecycle events, both forms, callbacks unchanged', () => {
	it('play / pause (self mode): container, then instance, then the callback', () => {
		const order = [];
		const { player } = mount({ onPlay: () => order.push(['callback']), onPause: vi.fn() });
		listen(player, 'play', order);
		player.audio.dispatchEvent(new Event('play'));
		expect(order.map((e) => e[0])).toEqual(['container', 'instance', 'callback']);

		const [, container] = order[0];
		expect(container.bubbles).toBe(true);
		expect(container.composed).toBe(true);
		expect(container.detail).toEqual({ player, url: '' });
		expect(order[1][1]).toBeInstanceOf(Event);
		expect(order[1][1].target).toBe(player);

		const pauses = listen(player, 'pause');
		player.audio.dispatchEvent(new Event('pause'));
		expect(pauses.map((e) => e[0])).toEqual(['container', 'instance']);
		expect(player.options.onPause).toHaveBeenCalledTimes(1);
	});

	it('load', async () => {
		const onLoad = vi.fn();
		const { player } = external({ url: 'a.mp3', waveform: [0.5], onLoad });
		const log = listen(player, 'load');
		await frame();
		expect(log.map((e) => e[0])).toEqual(['container', 'instance']);
		expect(log[0][1].detail).toEqual({ player, url: 'a.mp3' });
		expect(onLoad).toHaveBeenCalledTimes(1);
	});

	it('error carries the error in the container detail', () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const onError = vi.fn();
		const { player } = mount({ onError });
		const log = listen(player, 'error');
		const failure = new Event('error');
		player.audio.dispatchEvent(failure);
		expect(log.map((e) => e[0])).toEqual(['container', 'instance']);
		expect(log[0][1].detail.error).toBe(failure);
		expect(onError).toHaveBeenCalledWith(failure, player);
	});

	it('ended (self mode)', () => {
		const onEnd = vi.fn();
		const { player } = mount({ onEnd });
		stubClock(player.audio, { currentTime: 100 });
		const log = listen(player, 'ended');
		player.audio.dispatchEvent(new Event('ended'));
		expect(log.map((e) => e[0])).toEqual(['container', 'instance']);
		expect(log[0][1].detail).toMatchObject({ currentTime: 100, duration: 100 });
		expect(onEnd).toHaveBeenCalledTimes(1);
	});

	it('play / pause / timeupdate / ended in external mode', () => {
		const onEnd = vi.fn();
		const { player } = external({ url: 'a.mp3', onEnd });
		const log = [];
		for (const name of ['play', 'pause', 'timeupdate', 'ended']) listen(player, name, log);
		player.setPlayingState(true);
		player.setProgress(50, 100);
		player.setProgress(100, 100);
		player.setPlayingState(false);
		const instance = log.filter((e) => e[0] === 'instance').map((e) => e[1].type);
		expect(instance).toEqual(['play', 'timeupdate', 'timeupdate', 'ended', 'pause']);
		expect(onEnd).toHaveBeenCalledTimes(1);
	});

	it('seek, ratechange and volumechange come from the audio element', () => {
		const { player } = mount({ url: 'a.mp3' });
		const clock = stubClock(player.audio);
		const log = [];
		for (const name of ['seek', 'ratechange', 'volumechange']) listen(player, name, log);

		clock.currentTime = 42;
		player.audio.dispatchEvent(new Event('seeked'));
		player.audio.playbackRate = 1.5;
		player.audio.dispatchEvent(new Event('ratechange'));
		player.audio.volume = 0.25;
		player.audio.muted = true;
		player.audio.dispatchEvent(new Event('volumechange'));

		const details = log.filter((e) => e[0] === 'container').map((e) => [e[1].type, e[1].detail]);
		expect(details).toEqual([
			['waveformplayer:seek', { player, url: 'a.mp3', currentTime: 42, duration: 100 }],
			['waveformplayer:ratechange', { player, url: 'a.mp3', playbackRate: 1.5 }],
			['waveformplayer:volumechange', { player, url: 'a.mp3', volume: 0.25, muted: true }],
		]);
		expect(log.filter((e) => e[0] === 'instance').map((e) => e[1].type)).toEqual(['seek', 'ratechange', 'volumechange']);
	});

	it('next / previous fire from the lock-screen controls, with the callbacks', () => {
		const handlers = {};
		Object.defineProperty(navigator, 'mediaSession', {
			configurable: true,
			value: { metadata: null, playbackState: 'none', setActionHandler: (a, fn) => { handlers[a] = fn; }, setPositionState: vi.fn() },
		});
		vi.stubGlobal('MediaMetadata', class { constructor(init) { Object.assign(this, init); } });
		const onNextTrack = vi.fn(), onPreviousTrack = vi.fn();
		const { player } = mount({ url: 'a.mp3', onNextTrack, onPreviousTrack });
		const log = [];
		listen(player, 'next', log);
		listen(player, 'previous', log);
		player.audio.dispatchEvent(new Event('play'));
		handlers.nexttrack();
		handlers.previoustrack();
		expect(log.map((e) => `${e[0]}:${e[1].type}`)).toEqual([
			'container:waveformplayer:next', 'instance:next',
			'container:waveformplayer:previous', 'instance:previous',
		]);
		expect(onNextTrack).toHaveBeenCalledWith(player);
		expect(onPreviousTrack).toHaveBeenCalledWith(player);
	});
});

describe('timeupdate rate', () => {
	it('the instance event keeps the media element rate, never per frame', () => {
		vi.useFakeTimers();
		const onTimeUpdate = vi.fn();
		const { player } = mount({ onTimeUpdate });
		stubClock(player.audio, { currentTime: 10 });
		const log = listen(player, 'timeupdate');

		player.audio.dispatchEvent(new Event('play'));
		vi.advanceTimersByTime(100); // several frames
		const container = log.filter((e) => e[0] === 'container').length;
		expect(container).toBeGreaterThan(1); // per-frame, as in 1.x
		expect(onTimeUpdate).toHaveBeenCalledTimes(container);
		expect(log.filter((e) => e[0] === 'instance')).toHaveLength(0);

		player.audio.dispatchEvent(new Event('timeupdate'));
		player.audio.dispatchEvent(new Event('timeupdate'));
		expect(log.filter((e) => e[0] === 'instance')).toHaveLength(2);
	});
});

describe('one listener on document', () => {
	it('hears every player', () => {
		const a = external({ url: 'a.mp3' });
		const b = external({ url: 'b.mp3' });
		const c = mount({ url: 'c.mp3' });
		const heard = [];
		const listener = (e) => heard.push([e.type, e.detail.url, e.detail.player]);
		document.addEventListener('waveformplayer:play', listener);
		document.addEventListener('waveformplayer:pause', listener);

		a.player.setPlayingState(true);
		b.player.setPlayingState(true);
		c.player.audio.dispatchEvent(new Event('play'));
		a.player.setPlayingState(false);

		document.removeEventListener('waveformplayer:play', listener);
		document.removeEventListener('waveformplayer:pause', listener);
		expect(heard).toEqual([
			['waveformplayer:play', 'a.mp3', a.player],
			['waveformplayer:play', 'b.mp3', b.player],
			['waveformplayer:play', 'c.mp3', c.player],
			['waveformplayer:pause', 'a.mp3', a.player],
		]);
	});

	it('hears a player inside a shadow root (composed), but not its request-* events', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = host.attachShadow({ mode: 'open' });
		const { player } = external({ url: 'a.mp3' }, root);
		const heard = [];
		const listener = (e) => heard.push(e.type);
		document.addEventListener('waveformplayer:play', listener);
		document.addEventListener('waveformplayer:request-play', listener);

		player.play(); // request-play: not composed, stays in the shadow root
		player.setPlayingState(true);

		document.removeEventListener('waveformplayer:play', listener);
		document.removeEventListener('waveformplayer:request-play', listener);
		expect(heard).toEqual(['waveformplayer:play']);
	});
});

describe('external-mode request events are unchanged', () => {
	it('request-seek stays cancelable, bubbling and not composed', () => {
		const { el, player } = external({ url: 'a.mp3', waveform: [0.5] });
		player.setProgress(10, 100);
		const seen = [];
		el.addEventListener('waveformplayer:request-seek', (e) => seen.push(e));
		const seeks = [];
		player.addEventListener('seek', () => seeks.push(1));
		player.seekToSeconds(50);
		expect(seen).toHaveLength(1);
		expect(seen[0]).toMatchObject({ bubbles: true, cancelable: true, composed: false });
		expect(seen[0].detail.percent).toBeCloseTo(0.5);
		expect(seeks).toHaveLength(0); // no audio of its own, so no seek event
	});
});
