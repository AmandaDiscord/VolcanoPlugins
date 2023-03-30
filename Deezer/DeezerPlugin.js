import { Plugin } from "volcano-sdk";

import htmlParse from "node-html-parser";

const usableRegex = /^https:\/\/www\.deezer\.com\/\w+\/(track|album|artist)\/(\d+)$/;
const scriptSliceAfter = "window.__DZR_APP_STATE__ = ".length;

class DeezerPlugin extends Plugin {
	source = "deezer";
	searchShorts = ["dz"];

	/**
	 * @param {string} resource
	 * @param {string} [searchShort]
	 */
	canBeUsed(resource, searchShort) {
		return (searchShort && this.searchShorts.includes(searchShort)) || !!resource.match(usableRegex);
	}

	/**
	 * @param {string} resource
	 * @param {string} [searchShort]
	 */
	async infoHandler(resource, searchShort) {
		const html = await fetch(searchShort ? `https://www.deezer.com/search/${encodeURIComponent(resource)}` : resource).then(d => d.text());
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

	async streamHandler(info) {
		if (!info.uri) throw new Error("NO_URI");
		const html = await fetch(info.uri).then(d => d.text());
		const data = DeezerPlugin.parse(html);
		const chosen = data.DATA.MEDIA.find(i => i.TYPE !== "preview") || data.DATA.MEDIA[0];
		return { stream: await this.utils.connect(chosen.HREF) };
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
