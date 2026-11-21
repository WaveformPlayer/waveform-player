import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveformPlayer } from '../src/js/core.js';
import { parseDataAttributes } from '../src/js/utils.js';

/**
 * Looping: `loop` (whole track, via audio.loop), section loops (setLoop /
 * clearLoop / loopMarker) held by the progress loop, and the optional
 * `showLoop` toggle. jsdom plays nothing, so the clock is stubbed and the
 * media events a browser would fire are dispatched by hand.
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

function stubClock(audio, { duration = 100, currentTime = 0 } = {}) {
	const clock = { duration, currentTime, sets: [] };
	Object.defineProperty(audio, 'duration', { configurable: true, get: () => clock.duration });
	Object.defineProperty(audio, 'currentTime', {
		configurable: true,
		get: () => clock.currentTime,
		set: (v) => { clock.currentTime = v; clock.sets.push(v); },
	});
	return clock;
}

const loopEvents = (player) => {
	const log = [];
	player.container.addEventListener('waveformplayer:loop', (e) => log.push(e.detail));
	player.addEventListener('loop', (e) => log.push(e.type));
	return log;
};

beforeEach(() => { mounted = []; });
afterEach(() => {
	mounted.forEach((p) => { try { p.destroy(); } catch {} });
	document.body.innerHTML = '';
	WaveformPlayer.destroyAll();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('loop option', () => {
	it('defaults off: no audio.loop, no button', () => {
		const { el, player } = mount();
		expect(player.options.loop).toBe(false);
		expect(player.options.showLoop).toBe(false);
		expect(player.audio.loop).toBe(false);
		expect(el.querySelector('.waveform-loop')).toBeNull();
	});

	it('loop: true loops the whole track with the element\'s own loop (no ended per wrap)', () => {
		const onEnd = vi.fn();
		const { player } = mount({ loop: true, onEnd });
		expect(player.audio.loop).toBe(true);
		// The browser wraps by seeking to 0 instead of ending: that is a `seek`.
		const clock = stubClock(player.audio, { currentTime: 0 });
		const seeks = [];
		player.addEventListener('seek', () => seeks.push(clock.currentTime));
		player.audio.dispatchEvent(new Event('seeking'));
		player.audio.dispatchEvent(new Event('seeked'));
		expect(seeks).toEqual([0]);
		expect(onEnd).not.toHaveBeenCalled();
	});

	it('reads data-loop, data-show-loop and data-loop-label', () => {
		const host = document.createElement('div');
		Object.assign(host.dataset, { loop: 'true', showLoop: 'true', loopLabel: 'Boucle' });
		expect(parseDataAttributes(host)).toMatchObject({ loop: true, showLoop: true, loopLabel: 'Boucle' });
		const { el, player } = mount({}, (e) => Object.assign(e.dataset, { loop: 'true', showLoop: 'true', loopLabel: 'Boucle' }));
		expect(player.audio.loop).toBe(true);
		const btn = el.querySelector('.waveform-loop');
		expect(btn.getAttribute('aria-label')).toBe('Boucle');
		expect(btn.getAttribute('aria-pressed')).toBe('true');
	});
});

describe('showLoop toggle button', () => {
	it('is a real, named, focusable button that toggles whole-track looping', () => {
		const { el, player } = mount({ showLoop: true });
		const btn = el.querySelector('.waveform-loop');
		expect(btn.tagName).toBe('BUTTON');
		expect(btn.type).toBe('button');
		expect(btn.tabIndex).toBe(0);
		expect(btn.getAttribute('aria-label')).toBe('Loop');
		expect(btn.getAttribute('aria-pressed')).toBe('false');
		expect(btn.closest('[role="slider"]')).toBeNull();

		const log = loopEvents(player);
		btn.click();
		expect(btn.getAttribute('aria-pressed')).toBe('true');
		expect(player.audio.loop).toBe(true);
		expect(player.options.loop).toBe(true);
		btn.click();
		expect(btn.getAttribute('aria-pressed')).toBe('false');
		expect(player.audio.loop).toBe(false);
		expect(log).toEqual([
			{ player, url: '', loop: true, start: null, end: null }, 'loop',
			{ player, url: '', loop: false, start: null, end: null }, 'loop',
		]);
	});

	it('turns a section loop off too, and shows it as pressed', () => {
		const { el, player } = mount({ showLoop: true });
		stubClock(player.audio);
		player.setLoop(10, 20);
		const btn = el.querySelector('.waveform-loop');
		expect(btn.getAttribute('aria-pressed')).toBe('true');
		btn.click();
		expect(btn.getAttribute('aria-pressed')).toBe('false');
		expect(player._loopRange).toBeNull();
		expect(player.audio.loop).toBe(false);
	});
});

describe('section loops', () => {
	it('setLoop() moves an outside playhead to start and jumps back at end, every frame', () => {
		vi.useFakeTimers();
		const onEnd = vi.fn();
		const { player } = mount({ onEnd });
		const clock = stubClock(player.audio, { currentTime: 5 });
		const log = loopEvents(player);

		player.setLoop(10, 20);
		expect(clock.currentTime).toBe(10);
		expect(player.audio.loop).toBe(true); // the track can't end inside the loop
		expect(log[0]).toEqual({ player, url: '', loop: false, start: 10, end: 20 });

		player.audio.dispatchEvent(new Event('play'));
		clock.currentTime = 19.9;
		vi.advanceTimersByTime(20);
		expect(clock.currentTime).toBe(19.9);
		clock.currentTime = 20.01;
		vi.advanceTimersByTime(20); // next frame
		expect(clock.currentTime).toBe(10);
		expect(onEnd).not.toHaveBeenCalled();
	});

	it('is held by the native timeupdate too (background tab)', () => {
		const { player } = mount();
		const clock = stubClock(player.audio, { currentTime: 12 });
		player.setLoop(10, 20);
		clock.currentTime = 21;
		player.audio.dispatchEvent(new Event('timeupdate'));
		expect(clock.currentTime).toBe(10);
	});

	it('leaves a playhead already inside the section where it is', () => {
		const { player } = mount();
		const clock = stubClock(player.audio, { currentTime: 15 });
		player.setLoop(10, 20);
		expect(clock.sets).toEqual([]);
	});

	it('ignores invalid bounds', () => {
		const { player } = mount();
		stubClock(player.audio);
		const log = loopEvents(player);
		player.setLoop(20, 10);
		player.setLoop(5, 5);
		player.setLoop(NaN, 10);
		player.setLoop(1, 'x');
		expect(player._loopRange).toBeFalsy();
		expect(log).toEqual([]);
	});

	it('sends the element\'s wrap at the track end to the section start, but not the player\'s own seeks', () => {
		const { player } = mount();
		const clock = stubClock(player.audio, { currentTime: 70 });
		player.setLoop(60, Infinity); // to the end of the track
		expect(player._loopRange).toEqual({ start: 60, end: 100 });

		clock.currentTime = 0; // the element wrapped (audio.loop)
		player.audio.dispatchEvent(new Event('seeking'));
		expect(clock.currentTime).toBe(60);

		player.seekTo(30); // the listener asked for this one
		player.audio.dispatchEvent(new Event('seeking'));
		expect(clock.currentTime).toBe(30);
	});

	it('clearLoop() ends the section and restores the track-loop setting', () => {
		const { player } = mount({ loop: true });
		stubClock(player.audio, { currentTime: 15 });
		player.setLoop(10, 20);
		const log = loopEvents(player);
		player.clearLoop();
		expect(player._loopRange).toBeNull();
		expect(player.audio.loop).toBe(true);
		expect(log[0]).toEqual({ player, url: '', loop: true, start: null, end: null });
		player.clearLoop(); // nothing to clear: no event
		expect(log).toHaveLength(2);
	});

	it('loopMarker() loops to the next marker in time, or to the end', () => {
		const markers = [{ time: 60, label: 'Outro' }, { time: 0, label: 'Intro' }, { time: 30, label: 'Drop' }];
		const { player } = mount({ markers });
		stubClock(player.audio, { currentTime: 0 });
		player.loopMarker(2);
		expect(player._loopRange).toEqual({ start: 30, end: 60 });
		player.loopMarker(1);
		expect(player._loopRange).toEqual({ start: 0, end: 30 });
		player.loopMarker(0);
		expect(player._loopRange).toEqual({ start: 60, end: 100 });
		player.loopMarker(9);
		expect(player._loopRange).toEqual({ start: 60, end: 100 });
	});

	it('is per track: loadTrack() clears it', async () => {
		const { player } = mount({ url: 'a.mp3', waveform: [0.5], preload: 'none' });
		stubClock(player.audio, { currentTime: 15 });
		player.setLoop(10, 20);
		await player.loadTrack('b.mp3', 'B', null, { waveform: [0.5], preload: 'none', autoplay: false });
		expect(player._loopRange).toBeNull();
		expect(player.audio.loop).toBe(false);
	});
});

describe('external mode', () => {
	it('ignores loop, renders no toggle, and the loop methods do nothing', () => {
		const { el, player } = mount({ audioMode: 'external', loop: true, showLoop: true, markers: [{ time: 10, label: 'A' }] });
		player.setProgress(0, 100);
		const log = loopEvents(player);
		expect(el.querySelector('.waveform-loop')).toBeNull();
		expect(player.toggleLoop()).toBe(false);
		player.setLoop(10, 20);
		player.loopMarker(0);
		player.clearLoop();
		expect(player._loopRange).toBeFalsy();
		expect(log).toEqual([]);
		expect(() => player.setProgress(100, 100)).not.toThrow();
	});
});
