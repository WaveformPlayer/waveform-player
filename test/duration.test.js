import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveformPlayer } from '../src/js/core.js';
import { parseDataAttributes } from '../src/js/utils.js';

/**
 * The `duration` option: a known length used before the audio's metadata
 * arrives (chiefly with preload 'none', where it only arrives on play). jsdom
 * never loads media, so `audio.duration` stays NaN until a test stubs it and
 * dispatches `loadedmetadata`, which is exactly the window under test.
 */

let mounted = [];
function mount(options = {}, setup) {
	const el = document.createElement('div');
	setup?.(el);
	document.body.appendChild(el);
	const player = new WaveformPlayer(el, options);
	mounted.push(player);
	return { el, player };
}
// One animation frame (the player's first load() runs in one), then a task.
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** Give the jsdom <audio> metadata: a duration and a movable playhead. */
function arriveMetadata(audio, duration = 100) {
	const clock = { duration, currentTime: 0 };
	Object.defineProperty(audio, 'duration', { configurable: true, get: () => clock.duration });
	Object.defineProperty(audio, 'currentTime', { configurable: true, get: () => clock.currentTime, set: (v) => { clock.currentTime = v; } });
	audio.dispatchEvent(new Event('loadedmetadata'));
	return clock;
}

const PEAKS = [0.2, 0.5, 0.8, 0.5];
const lazyTrack = (extra = {}) => ({ url: 'a.mp3', preload: 'none', waveform: PEAKS, ...extra });

beforeEach(() => { mounted = []; });
afterEach(() => {
	mounted.forEach((p) => { try { p.destroy(); } catch {} });
	document.body.innerHTML = '';
	WaveformPlayer.destroyAll();
	vi.restoreAllMocks();
	delete navigator.mediaSession;
});

describe('duration option surface', () => {
	it('defaults to null, leaving the readout at 0:00 until metadata', async () => {
		const { el, player } = mount(lazyTrack());
		await frame();
		expect(player.options.duration ?? null).toBeNull(); // unset defaults read undefined, as `bpm` does
		expect(el.querySelector('.time-total').textContent).toBe('0:00');
		expect(player.getSeekDuration()).toBe(0);
	});

	it('shows a set value as the total before metadata', async () => {
		const { el, player } = mount(lazyTrack({ duration: 95 }));
		expect(el.querySelector('.time-total').textContent).toBe('1:35');
		await frame();
		expect(el.querySelector('.time-total').textContent).toBe('1:35');
		expect(player.getSeekDuration()).toBe(95);
		expect(el.querySelector('[role="slider"]').getAttribute('aria-valuemax')).toBe('95');
	});

	it('reads data-duration as a float', () => {
		const host = document.createElement('div');
		host.dataset.duration = '12.5';
		expect(parseDataAttributes(host).duration).toBe(12.5);
		const { player } = mount({ preload: 'none' }, (el) => { el.dataset.duration = '61.25'; });
		expect(player.options.duration).toBe(61.25);
	});

	it('rejects zero, negative and non-numeric values with a warning', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		for (const bad of [0, -3, 'abc', Infinity]) {
			const { player } = mount({ duration: bad, audioMode: 'external' });
			expect(player.options.duration, String(bad)).toBeNull();
		}
		expect(warn.mock.calls.filter((c) => String(c[0]).includes('Invalid duration'))).toHaveLength(4);
	});

	it('is replaced by the real duration once metadata arrives', async () => {
		const { el, player } = mount(lazyTrack({ duration: 95 }));
		await frame();
		arriveMetadata(player.audio, 100);
		expect(el.querySelector('.time-total').textContent).toBe('1:40');
		expect(player.getSeekDuration()).toBe(100);
		expect(el.querySelector('[role="slider"]').getAttribute('aria-valuemax')).toBe('100');
	});
});

describe('before metadata', () => {
	it('places markers against it', async () => {
		const { el } = mount(lazyTrack({ duration: 100, markers: [{ time: 25, label: 'Verse' }] }));
		await frame();
		const marker = el.querySelector('.waveform-marker');
		expect(marker).not.toBeNull();
		expect(marker.style.left).toBe('25%');
	});

	it('uses it for the hover time', async () => {
		const { el, player } = mount(lazyTrack({ duration: 120, showHoverTime: true }));
		await frame();
		player.canvas.getBoundingClientRect = () => ({ left: 0, width: 200, top: 0, height: 64, right: 200, bottom: 64 });
		player._updateHoverTip(100);
		expect(el.querySelector('.waveform-hover-time').textContent).toBe('1:00');
	});

	it('remembers a seekTo() and applies it once the audio can seek', async () => {
		const { el, player } = mount(lazyTrack({ duration: 100 }));
		await frame();
		player.seekTo(30);
		expect(player.progress).toBeCloseTo(0.3);
		expect(el.querySelector('.time-current').textContent).toBe('0:30');
		expect(el.querySelector('[role="slider"]').getAttribute('aria-valuenow')).toBe('30');

		const clock = arriveMetadata(player.audio, 100);
		expect(clock.currentTime).toBe(30);
		expect(player._pendingSeek).toBeNull();
	});

	it('remembers a seekToPercent(), clamped to the known duration', async () => {
		const { player } = mount(lazyTrack({ duration: 80 }));
		await frame();
		player.seekToPercent(0.5);
		player.seekToPercent(7); // clamped to 1
		const clock = arriveMetadata(player.audio, 80);
		expect(clock.currentTime).toBe(80);
	});

	it('seeks from the keyboard slider', async () => {
		const { el, player } = mount(lazyTrack({ duration: 100 }));
		await frame();
		const slider = el.querySelector('[role="slider"]');
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		expect(player._pendingSeek).toBe(10);
		const clock = arriveMetadata(player.audio, 100);
		expect(clock.currentTime).toBe(10);
	});

	it('seeks from a waveform click', async () => {
		const { player } = mount(lazyTrack({ duration: 100 }));
		await frame();
		player.canvas.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 64, right: 400, bottom: 64 });
		player.canvas.dispatchEvent(new MouseEvent('click', { clientX: 100 }));
		expect(player._pendingSeek).toBe(25);
	});

	it('keeps playOnSeek: a marker click starts playback and the seek lands on metadata', async () => {
		const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
		const { el, player } = mount(lazyTrack({ duration: 100, markers: [{ time: 40, label: 'Drop' }] }));
		await frame();
		el.querySelector('.waveform-marker').click();
		expect(play).toHaveBeenCalledTimes(1);
		const clock = arriveMetadata(player.audio, 100);
		expect(clock.currentTime).toBe(40);
	});

	it('does nothing without the option (a seek before metadata is ignored, as before)', async () => {
		const { player } = mount(lazyTrack());
		await frame();
		player.seekTo(30);
		expect(player._pendingSeek).toBeNull();
		expect(player.progress).toBe(0);
	});

	it('gives Media Session the known duration', async () => {
		const session = { metadata: null, playbackState: 'none', setActionHandler: vi.fn(), setPositionState: vi.fn() };
		Object.defineProperty(navigator, 'mediaSession', { configurable: true, value: session });
		vi.stubGlobal('MediaMetadata', class { constructor(init) { Object.assign(this, init); } });
		const { player } = mount(lazyTrack({ duration: 150 }));
		await frame();
		player.audio.dispatchEvent(new Event('play'));
		expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 150, playbackRate: 1, position: 0 });
		vi.unstubAllGlobals();
	});
});

describe('per track', () => {
	it('loadTrack() resets it unless the call supplies one', async () => {
		const { el, player } = mount(lazyTrack({ duration: 95 }));
		await frame();
		player.seekTo(20);
		await player.loadTrack('b.mp3', 'B', null, { preload: 'none', waveform: PEAKS, autoplay: false });
		expect(player.options.duration ?? null).toBeNull();
		expect(player._pendingSeek).toBeNull();
		expect(el.querySelector('.time-total').textContent).toBe('0:00');

		await player.loadTrack('c.mp3', 'C', null, { preload: 'none', waveform: PEAKS, autoplay: false, duration: 200 });
		expect(player.options.duration).toBe(200);
		expect(el.querySelector('.time-total').textContent).toBe('3:20');
	});
});

describe('external mode', () => {
	it('stands in until the controller pushes the real duration', async () => {
		const { el, player } = mount({ audioMode: 'external', url: 'a.mp3', waveform: PEAKS, duration: 60 });
		await frame();
		expect(el.querySelector('.time-total').textContent).toBe('1:00');
		const seeks = [];
		el.addEventListener('waveformplayer:request-seek', (e) => seeks.push(e.detail.percent));
		el.querySelector('[role="slider"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
		expect(seeks[0]).toBeCloseTo(10 / 60);

		player.setProgress(0, 120);
		expect(el.querySelector('.time-total').textContent).toBe('2:00');
		expect(player.getSeekDuration()).toBe(120);
	});

	it('changes nothing in external mode without it', async () => {
		const { el, player } = mount({ audioMode: 'external', url: 'a.mp3', waveform: PEAKS });
		await frame();
		expect(player.getSeekDuration()).toBe(0);
		expect(el.querySelector('.time-total').textContent).toBe('0:00');
	});
});

describe('playback started before metadata', () => {
	// The frame loop stops when it finds no duration, so a play() before the
	// metadata (preload 'none') used to leave progress on the ~4Hz native
	// timeupdate for the rest of the track. Metadata restarts it.
	for (const extra of [{}, { duration: 95 }]) {
		it(`restarts the frame loop when metadata lands (${extra.duration ? 'with' : 'without'} the duration option)`, async () => {
			const { player } = mount(lazyTrack(extra));
			await frame();
			player.isPlaying = true;
			const spy = vi.spyOn(player, 'startSmoothUpdate');
			arriveMetadata(player.audio, 100);
			expect(spy).toHaveBeenCalledTimes(1);
		});
	}

	it('does not start the loop when metadata lands while paused', async () => {
		const { player } = mount(lazyTrack());
		await frame();
		const spy = vi.spyOn(player, 'startSmoothUpdate');
		arriveMetadata(player.audio, 100);
		expect(spy).not.toHaveBeenCalled();
	});
});
