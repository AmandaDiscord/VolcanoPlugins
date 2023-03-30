import { Plugin } from "volcano-sdk";

import nico from "niconico-dl.js";

const usableRegex = /^https?:\/\/(?:www\.|secure\.|sp\.)?nicovideo\.jp\/watch\/(?<id>(?:[a-z]{2})?[0-9]+)$/;

class NicoVideoPlugin extends Plugin {
	/**
	 * @param {import("volcano-sdk/types").Logger} logger
	 * @param {import("volcano-sdk/types").Utils} utils
	 */
	constructor(logger, utils) {
		super(logger, utils);
		this.source = "nicovideo";
	}

	/**
	 * @param {string} resource
	 */
	canBeUsed(resource) {
		return usableRegex.test(resource);
	}

	/**
	 * @param {string} resource
	 * @returns {Promise<import("volcano-sdk/types").TrackData>}
	 */
	async infoHandler(resource) {
		const instance = new nico.default(resource, "high");
		const data = await instance.getVideoInfo();

		return {
			entries: [{
				title: data.title,
				author: data.owner.nickname,
				identifier: data.id,
				uri: `https://www.nicovideo.jp/watch/${data.id}`,
				length: data.duration * 1000,
				isStream: false
			}]
		};
	}

	/** @param {import("@lavalink/encoding").TrackInfo} info */
	async streamHandler(info) {
		if (!info.uri) throw new Error("NICO_CANNOT_EXTRACT_DATA");
		const instance = new nico.default(info.uri, "high");
		const stream = await instance.download(true);

		return { stream };
	}
}

export default NicoVideoPlugin;
