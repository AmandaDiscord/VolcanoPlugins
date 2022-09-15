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

const usableRegex = /^https:\/\/www\.newgrounds.com\/audio\/listen\/(\d+)$/;

/** @implements {PluginInterface} */
class NewgroundsPlugin {
	constructor() {
		this.source = "newgrounds";
		this.searchShort = "ng";
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
			const html = await fetch(`https://www.newgrounds.com/search/conduct/audio?suitables=etm&c=3&terms=${encodeURIComponent(resource)}`).then(res => res.text());
			/** @type {HTMLElement} */
			// @ts-ignore
			const parser = htmlParse.default(html);
			const h = parser.childNodes[1];
			/** @type {Array<HTMLElement>} */
			// @ts-ignore
			const arr = [...h.childNodes.values()];
			const resultsContainer = arr.find(i => i.id?.startsWith("search_results_container_"));
			if (!resultsContainer) throw new Error("CANNOT_EXTRACT_NEWGROUNDS_INFO");
			const itemList = resultsContainer.querySelector("ul[class=\"itemlist spaced\"]");
			if (!itemList) throw new Error("CANNOT_EXTRACT_NEWGROUNDS_INFO");
			/** @type {Array<HTMLElement>} */
			// @ts-ignore
			const childNodes = [...itemList.childNodes.values()];
			/** @type {Array<string>} */
			const ids = [];
			for (const node of childNodes) {
				if (node.id !== "") continue;
				const url = node.querySelector("a[class=\"item-audiosubmission \"]")?.getAttribute("href");
				if (!url) continue;
				const match = url.match(usableRegex);
				if (!match) continue;
				ids.push(match[1]);
			}
			const results = await Promise.all(ids.map(async id => {
				const data = await fetch(`https://www.newgrounds.com/audio/load/${id}/3`, { headers: { "X-Requested-With": "XMLHttpRequest" } }).then(d => d.json());
				return {
					title: data.title,
					author: data.author,
					identifier: id,
					uri: data.sources[0].src,
					length: Math.round(data.duration * 1000),
					isStream: false
				};
			}));
			return { entries: results };
		}
		const match = resource.match(usableRegex);
		if (!match) throw new Error("CANNOT_EXTRACT_NEWGROUNDS_INFO");
		const data = await fetch(`https://www.newgrounds.com/audio/load/${match[1]}/3`, { headers: { "X-Requested-With": "XMLHttpRequest" } }).then(d => d.json());
		return { entries: [{ title: data.title, author: data.author, identifier: match[1], uri: data.sources[0].src, length: Math.round(data.duration * 1000), isStream: false }] };
	}

	/** @param {import("@lavalink/encoding").TrackInfo} info */
	async streamHandler(info) {
		if (!info.uri) throw new Error("NO_URI");
		// @ts-ignore
		return fetch(info.uri, { redirect: "follow" }).then(d => ({ stream: Readable.fromWeb(d.body) }));
	}
}

export default NewgroundsPlugin;
