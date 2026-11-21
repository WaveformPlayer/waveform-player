import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveformPlayer } from '../src/js/core.js';
import { parseDataAttributes } from '../src/js/utils.js';

/**
 * `lazy`: the instance exists at once, but assigning the source, fetching
 * peaks, decoding and drawing wait for the viewport — or for anything that
 * needs the audio. jsdom has no IntersectionObserver, so a recording mock
 * stands in; `enter(el)` plays the browser's part.
 */

class MockIO {
	static instances = [];
	constructor(callback, options) {
		this.callback = callback;
		this.options = options;
		this.observed = new Set();
		this.disconnected = false;
		MockIO.instances.push(this);
	}
	observe(el) { this.observed.add(el); }
	unobserve(el) { this.observed.delete(el); }
	disconnect() { this.observed.clear(); this.disconnected = true; }
}
const enter = (el, isIntersecting = true) => {
	for (const io of MockIO.instances) {
		if (io.observed.has(el)) io.callback([{ target: el, isIntersecting }], io);
	}
};

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const PEAKS = [0.2, 0.6, 0.4];

let mounted = [];
function mount(options = {}, setup) {
	const el = document.createElement('div');
	setup?.(el);
	document.body.appendChild(el);
	const player = new WaveformPlayer(el, options);
	mounted.push(player);
	return { el, player };
}
const lazy = (extra = {}) => mount({ url: 'track-one.mp3', waveform: PEAKS, lazy: true, ...extra });

beforeEach(() => {
	mounted = [];
	MockIO.instances = [];
	vi.stubGlobal('IntersectionObserver', MockIO);
});
afterEach(() => {
	mounted.forEach((p) => { try { p.destroy(); } catch {} });
	document.body.innerHTML = '';
	WaveformPlayer.destroyAll();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('lazy option surface', () => {
	it('defaults to false: the first frame loads, no observer is made', async () => {
		const { player } = mount({ url: 'a.mp3', waveform: PEAKS });
		expect(player.options.lazy).toBe(false);
		await frame();
		expect(MockIO.instances).toHaveLength(0);
		expect(player._loadId).toBe(1);
		expect(player.audio.getAttribute('src')).toBe('a.mp3');
	});

	it('set: nothing loads until the player nears the viewport', async () => {
		const { el, player } = lazy();
		await frame();
		await frame();
		expect(player._loadId).toBe(0);
		expect(player.audio.getAttribute('src')).toBeNull();
		expect(player.waveformData).toEqual([]);

		enter(el, false); // reported, but not intersecting
		expect(player._loadId).toBe(0);

		enter(el);
		expect(player._loadId).toBe(1);
		expect(player.audio.getAttribute('src')).toBe('track-one.mp3');
		expect(player.waveformData).toEqual(PEAKS);
	});

	it('reads data-lazy', () => {
		const host = document.createElement('div');
		host.dataset.lazy = 'true';
		expect(parseDataAttributes(host).lazy).toBe(true);
		const { player } = mount({}, (el) => { el.dataset.lazy = 'true'; el.dataset.url = 'a.mp3'; });
		expect(player.options.lazy).toBe(true);
		expect(MockIO.instances).toHaveLength(1);
	});

	it('watches with a 200px margin', () => {
		lazy();
		expect(MockIO.instances[0].options).toEqual({ rootMargin: '200px' });
	});
});

describe('lazy behaviour', () => {
	it('is constructed and registered at once', () => {
		const { el, player } = lazy();
		expect(WaveformPlayer.getInstance(el)).toBe(player);
		expect(el.querySelector('canvas')).not.toBeNull();
	});

	it('shares ONE observer between every lazy player', () => {
		const a = lazy(), b = lazy(), c = lazy();
		expect(MockIO.instances).toHaveLength(1);
		const io = MockIO.instances[0];
		expect([...io.observed]).toEqual([a.el, b.el, c.el]);

		enter(b.el);
		expect(b.player._loadId).toBe(1);
		expect(a.player._loadId).toBe(0);
		expect(io.observed.has(b.el)).toBe(false);
	});

	it('drops the shared observer once nobody waits, and makes a new one later', () => {
		const a = lazy();
		const io = MockIO.instances[0];
		enter(a.el);
		expect(io.disconnected).toBe(true);
		lazy();
		expect(MockIO.instances).toHaveLength(2);
	});

	it('shows the loading state, title and known duration while waiting, at full height', () => {
		const { el } = lazy({ duration: 30, height: 80 });
		expect(el.querySelector('.waveform-title').textContent).toBe('Track One');
		expect(el.querySelector('.waveform-loading').style.display).toBe('block');
		expect(el.querySelector('[role="slider"]').getAttribute('aria-busy')).toBe('true');
		expect(el.querySelector('.time-total').textContent).toBe('0:30');
		expect(el.querySelector('.waveform-container').style.height).toBe('80px');
	});

	it('play() loads at once and plays', () => {
		const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
		const { player } = lazy({ preload: 'none' });
		player.play();
		expect(player._loadId).toBe(1);
		expect(player.audio.getAttribute('src')).toBe('track-one.mp3');
		expect(play).toHaveBeenCalledTimes(1);
		expect(MockIO.instances[0].observed.size).toBe(0);
	});

	it('the play button (togglePlay) loads at once', () => {
		vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
		const { el, player } = lazy({ preload: 'none' });
		el.querySelector('.waveform-btn').click();
		expect(player._loadId).toBe(1);
	});

	it('a seek loads at once, and with a known duration is kept for the audio', () => {
		const { player } = lazy({ preload: 'none', duration: 100 });
		player.seekTo(40);
		expect(player._loadId).toBe(1);
		expect(player._pendingSeek).toBe(40);
		expect(player.progress).toBeCloseTo(0.4);
	});

	it('loadTrack() loads the new track and ends the wait', async () => {
		const { el, player } = lazy();
		await player.loadTrack('b.mp3', 'B', null, { waveform: PEAKS, autoplay: false, preload: 'none' });
		expect(player.audio.getAttribute('src')).toBe('b.mp3');
		expect(MockIO.instances[0].observed.has(el)).toBe(false);
		enter(el); // a stale entry must not reload the first track
		expect(player.options.url).toBe('b.mp3');
		expect(player._loadId).toBe(1);
	});

	it('autoplay waits until the player loads', async () => {
		const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
		const { el } = lazy({ autoplay: true, preload: 'none' });
		await frame();
		expect(play).not.toHaveBeenCalled();
		enter(el);
		await frame();
		expect(play).toHaveBeenCalledTimes(1);
	});

	it('destroy() unobserves', () => {
		const { el, player } = lazy();
		const io = MockIO.instances[0];
		player.destroy();
		expect(io.observed.has(el)).toBe(false);
		expect(io.disconnected).toBe(true);
		expect(() => enter(el)).not.toThrow();
	});

	it('loads straight away where IntersectionObserver is missing', async () => {
		vi.stubGlobal('IntersectionObserver', undefined);
		const { player } = lazy();
		await frame();
		expect(player._loadId).toBe(1);
	});

	it('has nothing to defer without a url', () => {
		const { player } = mount({ lazy: true });
		expect(MockIO.instances).toHaveLength(0);
		expect(player.isLoading).toBe(false);
	});
});

describe('lazy in external mode', () => {
	it('defers the peaks the same way and still requests play', () => {
		const { el, player } = lazy({ audioMode: 'external' });
		expect(player.waveformData).toEqual([]);
		const requests = [];
		el.addEventListener('waveformplayer:request-play', (e) => requests.push(e));
		player.play();
		expect(requests).toHaveLength(1);
		expect(player.waveformData).toEqual(PEAKS);
	});
});
