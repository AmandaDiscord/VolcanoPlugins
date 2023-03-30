import { Transform, Readable } from "stream";

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

	/**
	 * @param {import("@lavalink/encoding").TrackInfo} info
	 */
	async streamHandler(info) {
		const data = await fetch(info.identifier).then(d => d.arrayBuffer());
		if (!data) throw new Error("There was no body for that midi file");
		const stream = new Readable;
		stream._read = this.utils.noop;
		// Sample rate is necessary which is what djs voice uses otherwise weird timescale
		// The timescale is still a bit weird regardless, about twice as fast as it should be if the rate was 48000
		// Multiplying by 2 fixes the issue which is hilarious
		const wav = synth.midiToWav(data, { sampleRate: 48000 * 2 })?.toBuffer() ?? null
		stream.push(wav);
		if (wav !== null) stream.push(null);
		return { stream, type: "raw" };
	}
}

// This thing technically worked but produced really weird results
// class AsyncCallbackStream extends Transform {
//	/**
//	 * @param {ReadableStream<Uint8Array>} stream
//	 * @param {import("stream").TransformOptions} [opts]
//	 */
//	constructor(stream, opts) {
//		super(opts);
//		this.stream = stream;
//		this.start();
//	}

//	async start() {
//		// @ts-expect-error
//		for await (const buffer of this.stream) {
//			/** @type {Buffer} */
//			const buf = buffer;
//			this.write(buf);
//		}
//	}

//	/**
//	 * @param {Buffer} chunk
//	 * @param {BufferEncoding} encoding
//	 * @param {import("stream").TransformCallback} callback
//	 */
//	_transform(chunk, encoding, callback) {
//		const processed = synth.midiToWav(chunk);
//		const buf = processed.toBuffer();
//		this.push(buf);
//		callback();
//	}
//}


export default MidiPlugin;
