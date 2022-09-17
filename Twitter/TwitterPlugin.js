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
 * @property {(logger: Logger, utils: any) => unknown} [setVariables]
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

import { isMainThread } from "worker_threads";

import { TwitterScraper } from "@tcortega/twitter-scraper";


const usableRegex = /^https:\/\/twitter.com\/([^/]+)\/status\/(\d+)/;
const twitterCoRegex = /https:\/\/t.co\/\w+/

/** @implements {PluginInterface} */
class TwitterPlugin {
	constructor() {
		this.source = "twitter";
	}

	setVariables(_, utils) {
		this.utils = utils;
	}

	async initialize() {
		if (isMainThread) this.twitter = await TwitterScraper.create();
	}

	/**
 * @param {string} resource
 */
	canBeUsed(resource) {
		return !!resource.match(usableRegex);
	}

	/**
	 * @param {string} resource
	 */
	async infoHandler(resource) {
		if (!this.twitter) throw new Error("UNINITALIZED");
		const match = resource.match(usableRegex);
		if (!match) throw new Error("URL_NOT_TWITTER_STATUS");
		const data = await this.twitter.getTweetMeta(resource);
		if (!data.isVideo || !data.media_url) throw new Error("TWITTER_STATUS_NOT_VIDEO");
		const mp4 = data.media_url.find(i => i.content_type === "video/mp4");
		if (!mp4) throw new Error("No mp4 URLs from link");
		return { entries: [{ title: data.description?.replace(twitterCoRegex, "").trim() || "No tweet description", author: match[1], identifier: match[1], uri: mp4.url, length: 0, isStream: false }] };
	}

	/** @param {import("@lavalink/encoding").TrackInfo} info */
	async streamHandler(info) {
		if (!info.uri) throw new Error("NO_URI");
		return this.utils.connect(info.uri);
	}
}

export default TwitterPlugin;
