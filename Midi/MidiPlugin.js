import { Transform } from "stream";

import { Plugin } from "volcano-sdk";
import synth from "synth-js";

class MidiPlugin extends Plugin {
	source = "midi";

	/**
	 * @param {string} url
	 * @param {Record<string, string>} headers
	 */
	async postHTTPProcessUnknown(url, headers) {
		if (headers["content-type"] !== "audio/midi") return { entries: [] };
		return {
			entries: [{ // I couldn't find a way to properly get track data from midi like track list and author, although track list would break here
				title: "Unknown track",
				author: "Unknown author",
				identifier: url,
				uri: url,
				length: 0,
				isStream: true
			}]
		};
	}

	async streamHandler(info) {
		const data = await fetch(info.uri).then(d => d.body);
		if (!data) throw new Error("There was no body for that midi file");
		const stream = new AsyncCallbackStream(data)
		return { stream, type: "raw" };
	}
}

class AsyncCallbackStream extends Transform {
	/**
	 * @param {ReadableStream<Uint8Array>} stream
	 * @param {import("stream").TransformOptions} [opts]
	 */
	constructor(stream, opts) {
		super(opts);
		this.stream = stream;
		this.start();
	}

	async start() {
		// @ts-expect-error
		for await (const buffer of this.stream) {
			/** @type {Buffer} */
			const buf = buffer;
			this.write(buf);
		}
	}

	/**
	 * @param {Buffer} chunk
	 * @param {BufferEncoding} encoding
	 * @param {import("stream").TransformCallback} callback
	 */
	_transform(chunk, encoding, callback) {
		const processed = synth.midiToWav(chunk, { sampleRate: 48000 * 2 });
		const buf = processed?.toBuffer() ?? null;
		this.push(buf);
		callback();
	}
}


export default MidiPlugin;
