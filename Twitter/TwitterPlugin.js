import { TwitterScraper } from "@tcortega/twitter-scraper";

import { Plugin } from "volcano-sdk";

const usableRegex = /^https:\/\/twitter.com\/([^/]+)\/status\/(\d+)/;
const twitterCoRegex = /https:\/\/t.co\/\w+/;

class TwitterPlugin extends Plugin {
	source = "twitter";

	async initialize() {
		this.twitter = await TwitterScraper.create();
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

	async streamHandler(info) {
		if (!info.uri) throw new Error("NO_URI");
		return { stream: await this.utils.connect(info.uri) };
	}
}

export default TwitterPlugin;
