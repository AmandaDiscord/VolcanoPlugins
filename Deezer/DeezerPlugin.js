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

import htmlParse from "node-html-parser";

const usableRegex = /^https:\/\/www\.deezer\.com\/\w+\/(track|album|artist)\/(\d+)$/;
const scriptSliceAfter = "window.__DZR_APP_STATE__ = ".length;

/** @implements {PluginInterface} */
class DeezerPlugin {
	constructor() {
		this.source = "deezer";
		this.searchShort = "dz";
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
		const html = await fetch(isResourceSearch ? `https://www.deezer.com/search/${encodeURIComponent(resource)}` : resource).then(d => d.text());
		const data = DeezerPlugin.parse(html);
		if (data.QUERY) return { entries: data.TRACK.data.map(DeezerPlugin.trackToResource) };
		else if (data.DATA.__TYPE__ === "song") return { entries: [DeezerPlugin.trackToResource(data.DATA)] };
		else if (data.DATA.__TYPE__ === "album") {
			const value = { entries: data.SONGS.data.map(DeezerPlugin.trackToResource) };
			value.plData = { name: data.DATA.ALB_TITLE };
			return value;
		} else if (data.DATA.__TYPE__ === "artist") return { entries: data.TOP.data.map(DeezerPlugin.trackToResource) };
		else throw new Error("UNKNOWN_OR_UNSUPPORTED_DEEZER_RESOURCE");
	}

	/** @param {import("@lavalink/encoding").TrackInfo} info */
	async streamHandler(info) {
		if (!info.uri) throw new Error("NO_URI");
		const html = await fetch(info.uri).then(d => d.text());
		const data = DeezerPlugin.parse(html);
		const chosen = data.DATA.MEDIA.find(i => i.TYPE !== "preview") || data.DATA.MEDIA[0];
		// @ts-ignore
		return fetch(chosen.HREF, { redirect: "follow" }).then(d => ({ stream: Readable.fromWeb(d.body) }));
	}

	/** @param {string} html */
	static parse(html) {
		/** @type {HTMLElement} */
		// @ts-ignore
		const parser = htmlParse.default(html);
		const body = parser.getElementsByTagName("body")[0];
		const dzrApp = body.querySelector("div[id=\"dzr-app\"]");
		const naboo = dzrApp?.querySelector("div[id=\"naboo_content\"]")
		const script = ([...(naboo?.querySelectorAll("script")?.values() || [])]).slice(-1)[0];
		const json = script?.innerText.slice(scriptSliceAfter);
		const data = json ? JSON.parse(json) : {};
		if (!data.DATA && !data.QUERY) throw new Error("CANNOT_EXTRACT_DEEZER_INFO");
		return data;
	}

	static trackToResource(track) {
		return {
			title: track.SNG_TITLE,
			author: track.ART_NAME,
			identifier: track.SNG_ID,
			uri: `https://www.deezer.com/us/track/${track.SNG_ID}`,
			length: Math.round(Number(track.DURATION) * 1000),
			isStream: false
		};
	}
}

export default DeezerPlugin;
