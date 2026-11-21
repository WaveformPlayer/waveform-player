import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveformPlayer } from '../src/js/core.js';
import { parseDataAttributes } from '../src/js/utils.js';

/**
 * Volume: the `volume` option, `showVolume` (mute toggle + range input),
 * getVolume() / setMuted(), and the iOS case where scripted volume is ignored.
 * jsdom's media element honours `volume` / `muted` and fires `volumechange`
 * asynchronously, like a browser — hence the `tick()` after each change.
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
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { mounted = []; });
afterEach(() => {
	mounted.forEach((p) => { try { p.destroy(); } catch {} });
	document.body.innerHTML = '';
	WaveformPlayer.destroyAll();
	vi.restoreAllMocks();
});

describe('volume option', () => {
	it('defaults to null: the element keeps its own volume, and no controls render', () => {
		const { el, player } = mount();
		expect(player.options.volume ?? null).toBeNull();
		expect(player.options.showVolume).toBe(false);
		expect(player.audio.volume).toBe(1);
		expect(el.querySelector('.waveform-volume')).toBeNull();
	});

	it('sets the initial volume, clamped to 0..1', () => {
		expect(mount({ volume: 0.4 }).player.audio.volume).toBe(0.4);
		expect(mount({ volume: 3 }).player.audio.volume).toBe(1);
		expect(mount({ volume: -1 }).player.audio.volume).toBe(0);
	});

	it('reads data-volume, data-show-volume and the label attributes', () => {
		const attrs = { volume: '0.3', showVolume: 'true', volumeLabel: 'Lautstärke', muteLabel: 'Stumm' };
		const host = document.createElement('div');
		Object.assign(host.dataset, attrs);
		expect(parseDataAttributes(host)).toMatchObject({ volume: 0.3, showVolume: true, volumeLabel: 'Lautstärke', muteLabel: 'Stumm' });
		const { el, player } = mount({}, (e) => Object.assign(e.dataset, attrs));
		expect(player.audio.volume).toBe(0.3);
		expect(el.querySelector('.waveform-volume-slider').getAttribute('aria-label')).toBe('Lautstärke');
		expect(el.querySelector('.waveform-mute').getAttribute('aria-label')).toBe('Stumm');
	});
});

describe('getVolume() / setMuted()', () => {
	it('read the volume and mute without losing it', () => {
		const { player } = mount({ volume: 0.6 });
		expect(player.getVolume()).toBe(0.6);
		player.setMuted(true);
		expect(player.audio.muted).toBe(true);
		expect(player.getVolume()).toBe(0.6);
		player.setMuted(false);
		expect(player.audio.muted).toBe(false);
	});
});

describe('showVolume controls', () => {
	it('are a named mute <button> and a 0..1 range <input>, outside the seek slider', () => {
		const { el } = mount({ showVolume: true, volume: 0.5 });
		const mute = el.querySelector('.waveform-mute');
		const slider = el.querySelector('.waveform-volume-slider');
		expect(mute.tagName).toBe('BUTTON');
		expect(mute.type).toBe('button');
		expect(mute.getAttribute('aria-label')).toBe('Mute');
		expect(mute.getAttribute('aria-pressed')).toBe('false');
		expect(slider.tagName).toBe('INPUT');
		expect(slider.type).toBe('range');
		expect([slider.min, slider.max]).toEqual(['0', '1']);
		expect(slider.getAttribute('aria-label')).toBe('Volume');
		expect(slider.value).toBe('0.5');
		expect(slider.getAttribute('aria-valuetext')).toBe('50%');
		expect(slider.hidden).toBe(false);
		expect(el.querySelector('[role="slider"] .waveform-volume')).toBeNull();
	});

	it('the mute toggle mutes and unmutes', async () => {
		const { el, player } = mount({ showVolume: true });
		const mute = el.querySelector('.waveform-mute');
		mute.click();
		await tick();
		expect(player.audio.muted).toBe(true);
		expect(mute.getAttribute('aria-pressed')).toBe('true');
		mute.click();
		await tick();
		expect(player.audio.muted).toBe(false);
		expect(mute.getAttribute('aria-pressed')).toBe('false');
	});

	it('the slider sets the volume (keyboard included: a range input changes and fires input)', async () => {
		const { el, player } = mount({ showVolume: true });
		const slider = el.querySelector('.waveform-volume-slider');
		slider.value = '0.25';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(player.audio.volume).toBe(0.25);
		expect(slider.getAttribute('aria-valuetext')).toBe('25%');
	});

	it('turning a muted player up unmutes it', async () => {
		const { el, player } = mount({ showVolume: true });
		player.setMuted(true);
		const slider = el.querySelector('.waveform-volume-slider');
		slider.value = '0.7';
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		await tick();
		expect(player.audio.muted).toBe(false);
	});

	it('reflects setVolume(), the m key and outside changes to the audio', async () => {
		const { el, player } = mount({ showVolume: true });
		const slider = el.querySelector('.waveform-volume-slider');
		const mute = el.querySelector('.waveform-mute');
		player.setVolume(0.35);
		await tick();
		expect(slider.value).toBe('0.35');

		player.audio.volume = 0.8; // someone else's code
		await tick();
		expect(slider.value).toBe('0.8');

		el.setAttribute('tabindex', '0');
		el.focus();
		el.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
		await tick();
		expect(mute.getAttribute('aria-pressed')).toBe('true');
	});

	it('hides the slider but keeps mute where scripted volume is ignored (iOS)', async () => {
		vi.spyOn(HTMLMediaElement.prototype, 'volume', 'set').mockImplementation(() => {});
		const { el, player } = mount({ showVolume: true });
		expect(el.querySelector('.waveform-volume-slider').hidden).toBe(true);
		const mute = el.querySelector('.waveform-mute');
		expect(mute.hidden).toBe(false);
		mute.click();
		await tick();
		expect(player.audio.muted).toBe(true);
	});
});

describe('external mode', () => {
	it('renders no volume controls, ignores volume, and the methods are inert', () => {
		const { el, player } = mount({ audioMode: 'external', showVolume: true, volume: 0.2 });
		expect(el.querySelector('.waveform-volume')).toBeNull();
		expect(player.getVolume()).toBeNull();
		expect(() => { player.setMuted(true); player.setVolume(0.5); }).not.toThrow();
		expect(() => player.setProgress(10, 100)).not.toThrow();
	});
});
