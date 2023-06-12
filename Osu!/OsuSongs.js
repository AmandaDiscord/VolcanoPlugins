import { Plugin } from 'volcano-sdk';
import YTMusic from 'ytmusic-api';
import * as dl from 'play-dl';
import htmlParse from 'node-html-parser';

const MAX_URI_TRIES = 10;

class OsuSongsPlugin extends Plugin {
	source = 'osu-songs';
	searchShorts = ['os'];

	ytMusicApi = new YTMusic.default();

	async initialize() {
		await this.ytMusicApi.initialize();
	}
	/**
	 * @param {string} resource
	 * @param {string} [searchShort]
	 */
	canBeUsed(resource, searchShort) {
		return resource.startsWith('https://osu.ppy.sh/beatmapsets/');
	}

	/**
	 * @param {import("volcano-sdk/types").TrackInfo[]} uris
	 */
	async loadUris(uris) {
		return await Promise.allSettled(
			uris.map((a) => {
				return (async () => {
					const results = await this.ytMusicApi.searchSongs(
						`${a.title} by ${a.author}`.trim()
					);

					a.uri = `https://youtube.com/watch?v=${results[0]?.videoId ?? ''}`;
					a.length = (results[0]?.duration ?? 0) * 1000;
					a.name = results[0]?.name ?? a.name;
					a.author =
						results[0]?.artists
							.reduce((t, a) => {
								return t + ` ${a.name}`;
							}, '')
							.trim() ?? a.artist;
					return a;
				})();
			})
		).then((a) =>
			a.filter((b) => b.status === 'fulfilled').map((c) => c.value)
		);
	}

	/**
	 * @param {string} resource
	 * @param {string} [searchShort]
	 */
	async infoHandler(resource, searchShort) {
		/** @type {import("volcano-sdk/types").TrackInfo[]} */
		const tracks = [];

		const html = await fetch(resource).then((r) => r.text());
		/** @type {HTMLElement} */
		// @ts-ignore
		const parser = htmlParse.default(html);
		const targetElement = parser.querySelector('meta[name="description"]');
		if (!targetElement) {
			throw new Error('URL not supported or peppy has made his move.');
		}

		const content = (targetElement.getAttribute('content') ?? '').slice(18);

		if (!content) {
			throw new Error('URL not supported or peppy has made his move.');
		}

		const targetIndex = content.indexOf(' - ');
		const artist = content.slice(0, targetIndex);
		const title = content.slice(targetIndex + 3);

		tracks.push({
			uri: '',
			title: title,
			author: artist,
			length: 0,
			identifier: resource,
			isStream: false,
		});

		const loaded = await this.loadUris(tracks);

		return { entries: loaded };
	}

	async streamHandler(info, usingFFMPEG) {
		if (!info.uri) throw new Error('NO_URI');
		if (!usingFFMPEG) {
			const stream = await dl.stream(info.uri);
			return { stream: stream.stream, type: stream.type };
		} else {
			const i = await dl.video_info(info.uri);
			const selected = i.format[i.format.length - 1];
			const response = await Util.connect(selected.url);
			return { stream: response };
		}
	}
}

export default OsuSongsPlugin;
