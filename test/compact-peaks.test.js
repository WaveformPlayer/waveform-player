import { describe, it, expect, afterEach, vi } from 'vitest';
import WaveformPlayer from '../src/js/index.js';
import { encodeCompactPeaks, decodeCompactPeaks } from '../src/js/utils.js';

/**
 * The compact `wp1:` peaks format: "wp1:" + base64url (RFC 4648 §5, no
 * padding) of one unsigned byte per peak, round(peak × 255). Accepted
 * everywhere peaks are: the `waveform` option, `data-waveform`,
 * `setWaveformData()`, `loadTrack()` options and a `.json` sidecar.
 */

// One animation frame (the player's first load() runs in one), then a task.
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
let mounted = [];
function mount(options = {}, setup) {
	const el = document.createElement('div');
	setup?.(el);
	document.body.appendChild(el);
	const player = new WaveformPlayer(el, { audioMode: 'external', ...options });
	mounted.push(player);
	return { el, player };
}

afterEach(() => {
	mounted.forEach((p) => { try { p.destroy(); } catch {} });
	mounted = [];
	document.body.innerHTML = '';
	WaveformPlayer.destroyAll();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const SAMPLE = [0, 0.25, 0.5, 0.75, 1, 0.1, 0.9];

describe('encodeCompactPeaks / decodeCompactPeaks', () => {
	it('are on WaveformPlayer.utils', () => {
		expect(WaveformPlayer.utils.encodeCompactPeaks).toBe(encodeCompactPeaks);
		expect(WaveformPlayer.utils.decodeCompactPeaks).toBe(decodeCompactPeaks);
	});

	it('round-trips within one byte step', () => {
		const decoded = decodeCompactPeaks(encodeCompactPeaks(SAMPLE));
		expect(decoded).toHaveLength(SAMPLE.length);
		decoded.forEach((p, i) => expect(Math.abs(p - SAMPLE[i])).toBeLessThanOrEqual(1 / 510));
		expect(decoded[0]).toBe(0);
		expect(decoded[4]).toBe(1);
	});

	it('is stable: a decoded string re-encodes to itself', () => {
		const s = encodeCompactPeaks(SAMPLE);
		expect(encodeCompactPeaks(decodeCompactPeaks(s))).toBe(s);
	});

	it('uses the base64url alphabet with no padding', () => {
		// 0xfb 0xff 0xbf → "+/+/" in standard base64, "-_-_" in base64url.
		expect(encodeCompactPeaks([251 / 255, 1, 191 / 255])).toBe('wp1:-_-_');
		const one = encodeCompactPeaks([1]); // one byte → 2 chars, no "=="
		expect(one).toBe('wp1:_w');
		expect(decodeCompactPeaks(one)).toEqual([1]);
	});

	it('clamps out-of-range peaks to 0..1 and encodes non-numbers as 0', () => {
		expect(decodeCompactPeaks(encodeCompactPeaks([-1, 2, -0.3, 1.0001, NaN, Infinity]))).toEqual([0, 1, 0, 1, 0, 0]);
	});

	it('encodes 1800 peaks to 2404 characters', () => {
		const peaks = Array.from({ length: 1800 }, (_, i) => (i % 100) / 100);
		const s = encodeCompactPeaks(peaks);
		expect(s).toHaveLength(2404);
		expect(s.startsWith('wp1:')).toBe(true);
		expect(decodeCompactPeaks(s)).toHaveLength(1800);
	});

	it('handles empty input both ways', () => {
		expect(encodeCompactPeaks([])).toBe('wp1:');
		expect(decodeCompactPeaks('wp1:')).toEqual([]);
	});

	it('decodes malformed input to [] instead of throwing', () => {
		for (const bad of ['', 'abc', 'wp2:AAAA', 'wp1:AA=A', 'wp1:AA+A', 'wp1:AA/A', 'wp1:A', 'wp1:AAAAA', 'wp1:A A', null, undefined, 42, ['wp1:AA']]) {
			expect(() => decodeCompactPeaks(bad), String(bad)).not.toThrow();
			expect(decodeCompactPeaks(bad), String(bad)).toEqual([]);
		}
	});

	it('tolerates surrounding whitespace (attribute values)', () => {
		expect(decodeCompactPeaks('  wp1:_w \n')).toEqual([1]);
	});
});

describe('the player accepts compact peaks', () => {
	const compact = encodeCompactPeaks(SAMPLE);
	const expectSample = (player) => {
		expect(player.waveformData).toHaveLength(SAMPLE.length);
		expect(player.waveformData[4]).toBe(1);
	};

	it('as the waveform option', async () => {
		const { player } = mount({ url: 'a.mp3', waveform: compact });
		await frame();
		expectSample(player);
	});

	it('as data-waveform', async () => {
		const { player } = mount({}, (el) => { el.dataset.url = 'a.mp3'; el.dataset.waveform = compact; });
		await frame();
		expectSample(player);
	});

	it('through setWaveformData()', () => {
		const { player } = mount();
		expect(player.setWaveformData(compact)).toBeUndefined(); // applied synchronously
		expectSample(player);
	});

	it('through loadTrack() options', async () => {
		const { player } = mount({ url: 'a.mp3', waveform: [0.5] });
		await frame();
		await player.loadTrack('b.mp3', 'B', null, { waveform: compact, autoplay: false });
		expectSample(player);
	});

	it('as a sidecar\'s peaks field, or as the whole sidecar', async () => {
		for (const body of [{ peaks: compact, bpm: 120 }, compact]) {
			vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })));
			const { player } = mount();
			expect(await player.setWaveformData('/t.json')).toBe(true);
			expectSample(player);
		}
	});

	it('treats a malformed compact string like any unusable inline peaks (empty, no throw)', async () => {
		const { player } = mount({ url: 'a.mp3', waveform: 'wp1:!!' });
		await frame();
		expect(player.waveformData).toEqual([]);
		expect(() => player.setWaveformData('wp1:A')).not.toThrow();
		expect(player.waveformData).toEqual([]);
	});

	it('falls back to decoding when a sidecar carries a malformed compact string', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ peaks: 'wp1:#' }) })));
		const { player } = mount();
		expect(await player.setWaveformData('/t.json')).toBe(false);
	});

	it('is never mistaken for a .json URL', () => {
		const fetch = vi.fn();
		vi.stubGlobal('fetch', fetch);
		const { player } = mount();
		player.setWaveformData(compact);
		expect(fetch).not.toHaveBeenCalled();
	});
});
