import { Plugin } from "volcano-sdk";

const usableRegex = /^https:\/\/music\.apple\.com\/[^/]+\/(album|artist)\/[^/]+\/(\d+)(?:\?i=(\d+))?$/;

class AppleMusicPlugin extends Plugin {
	source = "itunes";
	searchShorts = ["am"];

	/**
	 * @param {string} resource
	 * @param {string} [searchShort]
	 */
	canBeUsed(resource, searchShort) {
		return (searchShort && this.searchShorts.includes(searchShort)) || !!usableRegex.exec(resource);
	}

	/**
	 * @param {string} resource
	 * @param {string} [searchShort]
	 */
	async infoHandler(resource, searchShort) {
		if (searchShort) {
			const data = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(resource)}&country=US&entity=song&limit=10`).then(d => d.json());
			return {
				// @ts-expect-error
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

		const match = usableRegex.exec(resource);
		if (!match) throw new Error("UNKNOWN_OR_UNSUPPORTED_RESOURCE");
		const data = await fetch(`https://itunes.apple.com/lookup?id=${match[3] || match[2]}&entity=song&limit=10`).then(d => d.json());
		// @ts-expect-error
		const filtered = data.results.filter(i => i.wrapperType === "track");
		return {
			// @ts-expect-error
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

	/**
	 * @param {import("volcano-encoding").TrackInfo} info
	 */
	async streamHandler(info) {
		if (!info.uri) throw new Error("NO_URI");
		return { stream: await this.utils.connect(info.uri) };
	}
}

export default AppleMusicPlugin;
