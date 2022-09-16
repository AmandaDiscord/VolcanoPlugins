/**
 * @typedef {Object} TrackInfo
 * @property {string} title
 * @property {string} author
 * @property {string} identifier
 * @property {string} uri
 * @property {number} length
 * @property {boolean} isStream
 */

/**
 * @typedef {Object} Logger
 * @property {(message: any, worker?: string) => void} info
 * @property {(message: any, worker?: string) => void} error
 * @property {(message: any, worker?: string) => void} warn
 */

/**
 * @typedef {Object} PluginInterface
 *
 * @property {(logger: Logger) => unknown} [setVariables]
 * @property {() => unknown} [initialize]
 * @property {(filters: Array<string>, options: Record<any, any>) => unknown} [mutateFilters]
 * @property {(url: URL, req: import("http").IncomingMessage, res: import("http").ServerResponse) => unknown} [routeHandler]
 * @property {(packet: Record<any, any>, socket: import("ws").WebSocket) => unknown} [onWSMessage]
 * @property {string} [source]
 * @property {string} [searchShort]
 * @property {(resource: string, isResourceSearch: boolean) => boolean} [canBeUsed]
 * @property {(resource: string, isResourceSearch: boolean) => { entries: Array<TrackInfo>, plData?: { name: string; selectedTrack?: number; } } | Promise<{ entries: Array<TrackInfo>, plData?: { name: string; selectedTrack?: number; } }>} [infoHandler]
 * @property {(info: import("@lavalink/encoding").TrackInfo, usingFFMPEG: boolean) => { type?: import("@discordjs/voice").StreamType; stream: import("stream").Readable } | Promise<{ type?: import("@discordjs/voice").StreamType; stream: import("stream").Readable }>} [streamHandler]
 */

import { Readable } from "stream";


const usableRegex = /^https:\/\/music\.apple\.com\/[^/]+\/(album|artist)\/[^/]+\/(\d+)(?:\?i=(\d+))?$/;

/** @implements {PluginInterface} */
class AppleMusicPlugin {
	constructor() {
		this.source = "itunes";
		this.searchShort = "am";
	}

	/**
	 * @param {string} resource
	 * @param {boolean} isResourceSearch
	 */
	canBeUsed(resource, isResourceSearch) {
		return isResourceSearch || !!resource.match(usableRegex);
	}

	/**
	 * @param {string} resource
	 * @param {boolean} isResourceSearch
	 */
	async infoHandler(resource, isResourceSearch) {
		if (isResourceSearch) {
			const data = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(resource)}&country=US&entity=song&limit=10`).then(d => d.json());
			return {
				entries: data.results.map(i => ({
					title: i.trackName,
					author: i.artistName,
					identifier: String(i.trackId),
					uri: i.previewUrl,
					length: i.trackTimeMillis,
					isStream: false
				}))
			};
		}

		const match = resource.match(usableRegex);
		if (!match) throw new Error("UNKNOWN_OR_UNSUPPORTED_RESOURCE");
		const data = await fetch(`https://itunes.apple.com/lookup?id=${match[3] || match[2]}&entity=song&limit=10`).then(d => d.json());
		console.log(data);
		const filtered = data.results.filter(i => i.wrapperType === "track");
		return {
			entries: filtered.map(i => ({
				title: i.trackName,
				author: i.artistName,
				identifier: String(i.trackId),
				uri: i.previewUrl,
				length: i.trackTimeMillis,
				isStream: false
			}))
		};
	}

	/** @param {import("@lavalink/encoding").TrackInfo} info */
	async streamHandler(info) {
		if (!info.uri) throw new Error("NO_URI");
		// @ts-ignore
		return fetch(info.uri, { redirect: "follow" }).then(d => ({ stream: Readable.fromWeb(d.body) }));
	}
}

export default AppleMusicPlugin;
