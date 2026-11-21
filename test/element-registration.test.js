import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * Which entry point registers `<waveform-player>`. The registry can't be
 * cleared, so each case checks `customElements.define` calls on a fresh module
 * evaluation (vi.resetModules) instead of the registry's final state; the
 * first import in this file runs against an empty registry.
 */

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = '';
	delete document.documentElement.dataset.waveformAutoinit;
	delete window.WaveformPlayer;
});

const fresh = async (specifier) => {
	vi.resetModules();
	return import(specifier);
};

describe('element registration', () => {
	it('/no-autoinit does not register, but exports the definer', async () => {
		const define = vi.spyOn(customElements, 'define');
		const mod = await fresh('../src/js/entry.js');
		expect(define).not.toHaveBeenCalled();
		expect(customElements.get('waveform-player')).toBeUndefined();
		expect(mod.defineWaveformPlayerElement).toBeTypeOf('function');
		expect(mod.WaveformPlayerElement).toBeTypeOf('function');
	});

	it('the default entry does not register when the page opts out of auto-init', async () => {
		document.documentElement.dataset.waveformAutoinit = 'false';
		const define = vi.spyOn(customElements, 'define');
		await fresh('../src/js/index.js');
		expect(define).not.toHaveBeenCalled();
	});

	it('an opted-out CDN page can register the tag through WaveformPlayer.defineElement()', async () => {
		// A <script> page has no named export to reach; the global's static is the way in.
		document.documentElement.dataset.waveformAutoinit = 'false';
		const define = vi.spyOn(customElements, 'define');
		await fresh('../src/js/index.js');
		expect(define).not.toHaveBeenCalled();
		window.WaveformPlayer.defineElement('waveform-player-optout');
		expect(define).toHaveBeenCalledWith('waveform-player-optout', expect.any(Function));
	});

	it('the default entry registers <waveform-player>, which then initialises server-rendered markup', async () => {
		document.body.innerHTML = '<waveform-player src="/a.mp3" audio-mode="external"></waveform-player>';
		const define = vi.spyOn(customElements, 'define');
		const mod = await fresh('../src/js/index.js');
		expect(define).toHaveBeenCalledTimes(1);
		expect(define.mock.calls[0][0]).toBe('waveform-player');
		const el = document.querySelector('waveform-player');
		expect(el.player).toBeInstanceOf(mod.WaveformPlayer);
		expect(mod.WaveformPlayer.getAllInstances()).toEqual([el.player]);
		mod.WaveformPlayer.destroyAll();
	});

	it('the default entry leaves an existing definition alone', async () => {
		expect(customElements.get('waveform-player')).toBeTypeOf('function');
		const define = vi.spyOn(customElements, 'define');
		await fresh('../src/js/index.js');
		expect(define).not.toHaveBeenCalled();
	});

	it('the [data-waveform-player] scan does not double-initialise a <waveform-player data-waveform-player>', async () => {
		document.body.innerHTML = '<waveform-player data-waveform-player src="/a.mp3" audio-mode="external"></waveform-player>';
		const mod = await fresh('../src/js/index.js');
		// The registered element class came from an earlier module copy, so
		// its player is in that copy's registry, not this one's — as with two
		// bundled copies of the library on one page. The claim flag still
		// stops this copy's scan building a second player over it.
		expect(mod.WaveformPlayer.getAllInstances()).toHaveLength(0);
		expect(document.querySelector('waveform-player').player).toBeTruthy();
	});
});
