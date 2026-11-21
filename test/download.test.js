import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WaveformPlayer } from '../src/js/core.js';
import { parseDataAttributes, fileNameFromUrl } from '../src/js/utils.js';

/**
 * The `showDownload` link: an <a href download> for `downloadUrl` (default the
 * track url), named `downloadName` (default the url's file name), following
 * the track through loadTrack().
 */

let mounted = [];
function mount(options = {}, setup) {
	const el = document.createElement('div');
	setup?.(el);
	document.body.appendChild(el);
	const player = new WaveformPlayer(el, { preload: 'none', waveform: [0.5], ...options });
	mounted.push(player);
	return { el, player };
}
const link = (el) => el.querySelector('.waveform-download');

beforeEach(() => { mounted = []; });
afterEach(() => {
	mounted.forEach((p) => { try { p.destroy(); } catch {} });
	document.body.innerHTML = '';
	WaveformPlayer.destroyAll();
});

describe('download options', () => {
	it('default off: no link', () => {
		const { el, player } = mount({ url: '/a.mp3' });
		expect(player.options.showDownload).toBe(false);
		expect(link(el)).toBeNull();
	});

	it('set: a real, named <a href download> for the track', () => {
		const { el } = mount({ url: '/audio/My%20Track.mp3?v=2', showDownload: true });
		const a = link(el);
		expect(a.tagName).toBe('A');
		expect(a.getAttribute('href')).toBe('/audio/My%20Track.mp3?v=2');
		expect(a.getAttribute('download')).toBe('My Track.mp3');
		expect(a.getAttribute('aria-label')).toBe('Download');
		expect(a.hidden).toBe(false);
		expect(a.tabIndex).toBe(0); // an <a> with href is in the tab order and opens on Enter
		expect(a.closest('[role="slider"]')).toBeNull();
	});

	it('downloadUrl, downloadName and downloadLabel override', () => {
		const { el } = mount({ url: '/preview.mp3', showDownload: true, downloadUrl: '/full.wav', downloadName: 'Song (full).wav', downloadLabel: 'Télécharger' });
		const a = link(el);
		expect(a.getAttribute('href')).toBe('/full.wav');
		expect(a.getAttribute('download')).toBe('Song (full).wav');
		expect(a.getAttribute('aria-label')).toBe('Télécharger');
	});

	it('reads the data-* attributes', () => {
		const attrs = { url: '/a.mp3', showDownload: 'true', downloadUrl: '/b.wav', downloadName: 'b.wav', downloadLabel: 'Get' };
		const host = document.createElement('div');
		Object.assign(host.dataset, attrs);
		expect(parseDataAttributes(host)).toMatchObject({ showDownload: true, downloadUrl: '/b.wav', downloadName: 'b.wav', downloadLabel: 'Get' });
		const { el } = mount({}, (e) => Object.assign(e.dataset, attrs));
		expect(link(el).getAttribute('href')).toBe('/b.wav');
		expect(link(el).getAttribute('aria-label')).toBe('Get');
	});

	it('is hidden (no href) without a URL, or with an unsafe one', () => {
		const { el: none } = mount({ showDownload: true });
		expect(link(none).hidden).toBe(true);
		expect(link(none).hasAttribute('href')).toBe(false);

		const { el: bad } = mount({ url: '/a.mp3', showDownload: true, downloadUrl: 'javascript:alert(1)' });
		expect(link(bad).hidden).toBe(true);
		expect(link(bad).hasAttribute('href')).toBe(false);
	});

	it('the stylesheet lets `hidden` win over the control display', () => {
		const css = readFileSync(resolve(process.cwd(), 'src/css/waveform-player.css'), 'utf8');
		expect(css).toMatch(/\.waveform-ctrl\[hidden\]\s*\{\s*display:\s*none;/);
	});
});

describe('per track', () => {
	it('follows loadTrack(), resetting downloadUrl/downloadName unless supplied', async () => {
		const { el, player } = mount({ url: '/a.mp3', showDownload: true, downloadUrl: '/a-full.wav', downloadName: 'A.wav' });
		await player.loadTrack('/b.mp3', 'B', null, { waveform: [0.5], autoplay: false });
		expect(player.options.downloadUrl ?? null).toBeNull();
		expect(link(el).getAttribute('href')).toBe('/b.mp3');
		expect(link(el).getAttribute('download')).toBe('b.mp3');

		await player.loadTrack('/c.mp3', 'C', null, { waveform: [0.5], autoplay: false, downloadUrl: '/c.flac', downloadName: 'C.flac' });
		expect(link(el).getAttribute('href')).toBe('/c.flac');
		expect(link(el).getAttribute('download')).toBe('C.flac');
	});

	it('follows a plain load() of another url', async () => {
		const { el, player } = mount({ url: '/a.mp3', showDownload: true });
		await player.load('/d.mp3');
		expect(link(el).getAttribute('href')).toBe('/d.mp3');
	});
});

describe('external mode', () => {
	it('works the same: the link is just a link', () => {
		const { el, player } = mount({ audioMode: 'external', url: '/x.mp3', showDownload: true });
		expect(link(el).getAttribute('href')).toBe('/x.mp3');
		expect(() => player.setProgress(5, 10)).not.toThrow();
	});
});

describe('fileNameFromUrl', () => {
	it('takes the decoded last path segment', () => {
		expect(fileNameFromUrl('https://cdn.example.com/a/b/Track%201.mp3?x=1#t=2')).toBe('Track 1.mp3');
		expect(fileNameFromUrl('/dir/')).toBe('');
		expect(fileNameFromUrl('/bad%E0%A4%A.mp3')).toBe('bad%E0%A4%A.mp3');
	});
});
