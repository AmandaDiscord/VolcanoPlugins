import { Plugin } from "volcano-sdk";

import entities from "html-entities";

const usableRegex = /^https:\/\/(?:music\.)?yandex\.ru\/(?:(?:users)|(?:video))/;
const dataMatcher = /data-state="([^"]+)"/;
const dataOptions = /data-options="([^"]+)"/;
const replaceEscapedKeysRegex = /\\(?!\\\\)/g;
const replaceMetadata = /"metadataEmbedded":.+?","/;

class YandexPlugin extends Plugin {
	/**
	 * @param {import("volcano-sdk/types").Logger} logger
	 * @param {import("volcano-sdk/types").Utils} utils
	 */
	constructor(logger, utils) {
		super(logger, utils);
		this.source = "yandex";
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
		const html = await fetch(resource).then(d => d.text());
		const match = html.match(dataMatcher);
		if (!match) throw new Error("YANDEX_CANNOT_EXTRACT_INFO");
		const decoded = entities.decode(match[1]);
		const data = JSON.parse(decoded);

		return {
			entries: [{
				title: data.initialProps.current.clear_title,
				author: data.initialProps.current.clipHost,
				identifier: data.initialProps.current.filmId,
				uri: data.initialProps.current.url,
				length: data.initialProps.current.duration * 1000,
				isStream: false
			}]
		};
	}

	/** @param {import("@lavalink/encoding").TrackInfo} info */
	async streamHandler(info) {
		if (!info.uri) throw new Error("YANDEX_CANNOT_EXTRACT_INFO");
		if (info.author === "ok.ru") {
			const html = await fetch(info.uri).then(d => d.text());
			const match = html.match(dataOptions);
			if (!match) throw new Error("YANDEX_CANNOT_EXTRACT_INFO");
			const decoded = entities.decode(match[1]);
			const data = JSON.parse(decoded);
			const unescaped = data.flashvars.metadata.replace(replaceEscapedKeysRegex, "").replace(replaceMetadata, "\"");
			const metadata = JSON.parse(unescaped);
			const highest = metadata.videos.find(v => v.name === "low") || metadata.videos[0];
			return { stream: await this.utils.connect(highest.url) };
		} else throw new Error("YANDEX_UNKNOWN_PROVIDER");
	}
}

export default YandexPlugin;
