/* eslint-disable no-unreachable */
import entities from "html-entities";

import { Plugin } from "volcano-sdk";

const usableRegex = /^https:\/\/vk.com\/(?:(?:music\/playlist\/)|(?:audio-))\d+_\d+/;
const extractRegex = /data-audio="(.+?(?=(?:]" )|(?:]">))])/g;
const extractPlaylistNameRegex = /audioPlaylist__title">([^<]+)<\/div>/;
const isPlaylistRegex = /\/music\/playlist/;

const baseHTTPRequestHeaders = {
	DNT: "1",
	Pragma: "no-cache",
	"Sec-Fetch-Dest": "document",
	"Sec-Fetch-Mode": "navigate",
	"Sec-Fetch-Site": "same-site",
	"Sec-Fetch-User": "?1",
	"Upgrade-Insecure-Requests": "1",
	"User-Agent": `Mozilla/5.0 (Server; NodeJS ${process.version.replace("v", "")}; rv:1.0) Magma/1.0 (KHTML, like Gecko) Volcano/1.0`
};

/**
 * [0 content_id part 2, 1 content_id part 1, 2 ?, 3 track name, 4 performer/artist, 5 duration, 6 ?, 7 ?, 8 ?, 9 ?, 10 ?, 11 ?, 12 ?, 13 hash, 14 ?, 15 properties, 16 ?, 17 other props, 18 ?, 19 ID props, 20 hash2, 21 ?, 22 ?, 23 ?, 24 hash 3, 25 ?, 26 track ID, 27 ?]
 * @typedef {[number, number, string, string, string, number, number, number, string, number, number, string, string, string, string, { duration: number; content_id: string; puid22: number; _SITEID: number; vk_id: number; ver: number; }, string, [{ id: string; name: string }], string, [number, number, string], string, number, number, boolean, string, boolean, string, boolean]} VKItem
 */

class VKPlugin extends Plugin {
	/**
	 * @param {import("volcano-sdk/types").Logger} _
	 * @param {import("volcano-sdk/types").Utils} utils
	 */
	constructor(_, utils) {
		super(_, utils);
		this.source = "vkontakte";
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
		const playlist = isPlaylistRegex.test(resource);
		if (!playlist) throw new Error("VK_CAN_ONLY_EXTRACT_PLAYLISTS");
		const response = await fetch(resource, { headers: baseHTTPRequestHeaders });
		const data = await response.text();
		console.log(response.headers);
		const matches = data.matchAll(extractRegex);
		/** @type {Array<VKItem>} */
		const results = [];
		for (const match of matches) {
			const decoded = entities.decode(match[1]);
			const parsed = JSON.parse(decoded);
			results.push(parsed);
		}
		/** @type {import("volcano-sdk/types").TrackData} */
		const rt = {
			entries: results.map(d => VKPlugin.parseItem(d, resource))
		};
		const match = data.match(extractPlaylistNameRegex);
		if (match) rt.plData = { name: entities.decode(match[1]).trim(), selectedTrack: 0 };
		return rt;
	}

	/**
	 * @param {VKItem} item
	 * @param {string} [playlistLink]
	 * @returns {import("volcano-sdk/types").TrackInfo}
	 */
	static parseItem(item, playlistLink) {
		return {
			title: entities.decode(item[3]),
			author: entities.decode(item[4]),
			identifier: item[26] ? `https://vk.com/audio${item[26]}` : playlistLink ? playlistLink : "https://vk.com", // These tracks wouldn't have valid links in the web client anyways
			uri: `https://vk.com/audio${item[26]}`,
			length: item[5] * 1000,
			isStream: false
		};
	}
}

export default VKPlugin;
