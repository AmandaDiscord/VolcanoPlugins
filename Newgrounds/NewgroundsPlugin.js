import { Plugin } from "volcano-sdk";

import htmlParse from "node-html-parser";

const usableRegex = /^https:\/\/www\.newgrounds.com\/audio\/listen\/(\d+)$/;

class NewgroundsPlugin extends Plugin {
	/**
	 * @param {import("volcano-sdk/types").Logger} _
	 * @param {import("volcano-sdk/types").Utils} utils
	 */
	constructor(_, utils) {
		super(_, utils);
		this.source = "newgrounds";
		this.searchShorts = ["ng"];
	}

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
		if (searchShort) {
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

	async streamHandler(info) {
		if (!info.uri) throw new Error("NO_URI");
		return { stream: await this.utils.connect(info.uri) };
	}
}

export default NewgroundsPlugin;
