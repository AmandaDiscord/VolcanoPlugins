import { Plugin } from 'volcano-sdk';
import YTMusic from 'ytmusic-api';
import * as dl from 'play-dl';

const usableRegex =
	/^https:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;

const MAX_URI_TRIES = 10;

class SpotifyPlusPlugin extends Plugin {
	source = 'spotify+';
	ytMusicApi = new YTMusic.default();

	/** @type { undefined | {token: string; expire: string;}} */
	currentToken = undefined;

	async initialize() {
		await this.ytMusicApi.initialize();
	}

	/**
	 * @param {string} resource
	 * @param {string} [searchShort]
	 */
	canBeUsed(resource, searchShort) {
		return usableRegex.test(resource);
	}

	async getToken() {
		if (!this.currentToken || this.currentToken.expire < Date.now()) {
			const tokenInfo = await fetch(
				`https://open.spotify.com/get_access_token?reason=transport&productType=web_player`
			).then((a) => a.json());
			this.currentToken = {
				token: tokenInfo.accessToken,
				expire: tokenInfo.accessTokenExpirationTimestampMs,
			};
		}

		return this.currentToken;
	}

	/**
	 * @param {import("volcano-sdk/types").TrackInfo[]} uris
	 */
	async loadUris(uris) {
		return await Promise.allSettled(
			uris.map((a) => {
				return (async () => {
					const results = await this.ytMusicApi.searchSongs(
						`${a.title} by ${a.author} , OFFICIAL`.trim()
					);

					a.uri = `https://youtube.com/watch?v=${results[0]?.videoId ?? ''}`;
					a.length = (results[0]?.duration ?? 0) * 1000;

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
		const { token, expire } = await this.getToken();
		const [_, resourceType, resourceId] = resource.match(usableRegex);
		const headers = {
			Authorization: `Bearer ${token}`,
		};
		/** @type {import("volcano-sdk/types").TrackInfo[]} */
		const tracks = [];
		let plData = undefined;
		if (resourceType === 'track') {
			const response = await fetch(
				`https://api.spotify.com/v1/tracks/${resourceId}`,
				{
					headers: headers,
				}
			).then((a) => a.json());
			/** @type {import("volcano-sdk/types").TrackInfo} */
			const newTrack = {
				uri: '',
				title: response.name,
				author: response.artists.map((a) => a.name).join(', '),
				length: 0,
				identifier: resource,
				isStream: false,
			};
			tracks.push(newTrack);
		} else if (resourceType === 'album') {
			plData = {
				name: '',
				selectedTrack: 0,
			};
			const response = await fetch(
				`https://api.spotify.com/v1/albums/${resourceId}/tracks`,
				{
					headers: headers,
				}
			).then((a) => a.json());
			tracks.push(
				...response.items.map((a) => {
					const item = a;
					return {
						uri: '',
						title: item.name,
						author: item.artists.map((b) => b.name).join(', '),
						length: 0,
						identifier: item.external_urls.spotify,
						isStream: false,
					};
				})
			);
		} else if (resourceType === 'playlist') {
			plData = {
				name: '',
				selectedTrack: 0,
			};

			const response = await fetch(
				`https://api.spotify.com/v1/playlists/${resourceId}/tracks`,
				{
					headers: headers,
				}
			).then((a) => a.json());

			tracks.push(
				...response.items.map((a) => {
					const item = a.track;
					return {
						uri: '',
						title: item.name,
						author: item.artists.map((b) => b.name).join(', '),
						length: 0,
						identifier: item.external_urls.spotify,
						isStream: false,
					};
				})
			);
		}

		const loaded = await this.loadUris(tracks);

		return { entries: loaded, plData: plData };
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

export default SpotifyPlusPlugin;
