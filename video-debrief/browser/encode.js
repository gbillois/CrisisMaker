/* global VideoEncoder, AudioEncoder, AudioData, VideoFrame */
// Browser encoder for the Video Debrief: every frame is drawn by the scene
// engine, encoded with WebCodecs and muxed in the browser (browser/mp4.js).
// No server. Adapted from the CWP Video Maker export.
// Audio: AAC in an MP4 when the browser can encode it; otherwise, with H.264
// video, uncompressed PCM in a QuickTime .mov (Safari); Opus only with VP9.
(function () {
  'use strict';
  const VDB = (window.VDB = window.VDB || {});

  // H.264 plays everywhere (PowerPoint, QuickTime, LinkedIn). VP9 is the last
  // resort for browsers without an H.264 encoder (open-source Chromium builds).
  const VIDEO_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.420028', 'vp09.00.40.08'];

  function isAppleWebKit() {
    const ua = navigator.userAgent || '';
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const safari = /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg|OPR|Firefox)\//.test(ua);
    return ios || safari;
  }

  async function pickVideoConfig(width, height, fps) {
    for (const codec of VIDEO_CODECS) {
      for (const acceleration of ['prefer-hardware', 'no-preference']) {
        const config = { codec, width, height, bitrate: 8_000_000, framerate: fps, hardwareAcceleration: acceleration };
        if (codec.startsWith('avc1')) config.avc = { format: 'avc' };
        try {
          const support = await VideoEncoder.isConfigSupported(config);
          if (support.supported) return support.config;
        } catch { /* try the next one */ }
      }
    }
    return null;
  }

  async function pickAudioConfig() {
    const candidates = [
      { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000, aac: { format: 'aac' } },
      { codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 },
    ];
    for (const config of candidates) {
      try {
        const support = await AudioEncoder.isConfigSupported(config);
        if (support.supported) return support.config;
      } catch { /* next */ }
    }
    return null;
  }

  /** What this browser can produce: { ok, video, audio, reason }. */
  VDB.exportSupport = async function (width = 1920, height = 1080, fps = 24) {
    if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
      return { ok: false, reason: 'WebCodecs is not available in this browser: use a recent Chrome or Edge.' };
    }
    const video = await pickVideoConfig(width, height, fps);
    if (!video) return { ok: false, reason: 'This browser cannot encode 1080p video.' };
    let audio = await pickAudioConfig();
    if ((!audio || audio.codec === 'opus' || isAppleWebKit()) && video.codec.startsWith('avc1')) {
      audio = { codec: 'pcm', sampleRate: 48000, numberOfChannels: 2 };
    }
    return { ok: !!audio, video, audio, reason: audio ? '' : 'No audio encoder (AAC or Opus) available.' };
  };

  function copyChunk(chunk) {
    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);
    return { data, timestamp: chunk.timestamp, duration: chunk.duration || 0, key: chunk.type === 'key' };
  }

  function drain(encoder, limit) {
    if (encoder.encodeQueueSize <= limit) return Promise.resolve();
    return new Promise(resolve => {
      const check = () => (encoder.encodeQueueSize <= limit ? resolve() : setTimeout(check, 2));
      check();
    });
  }

  /** 16-bit little-endian interleaved PCM, in ~1 s blocks. */
  function pcmBlocks(mix) {
    const [left, right] = mix.channels;
    const size = mix.sampleRate;
    const blocks = [];
    for (let offset = 0; offset < left.length; offset += size) {
      const frames = Math.min(size, left.length - offset);
      const view = new DataView(new ArrayBuffer(frames * 4));
      for (let i = 0; i < frames; i++) {
        const l = Math.max(-1, Math.min(1, left[offset + i]));
        const r = Math.max(-1, Math.min(1, right[offset + i]));
        view.setInt16(i * 4, l < 0 ? l * 0x8000 : l * 0x7fff, true);
        view.setInt16(i * 4 + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
      }
      blocks.push({ data: new Uint8Array(view.buffer), frames, timestamp: Math.round(offset * 1e6 / mix.sampleRate) });
    }
    return { codec: 'pcm', sampleRate: mix.sampleRate, channels: 2, samples: blocks };
  }

  /** The AAC AudioSpecificConfig from a raw config or an esds / ES_Descriptor wrapper. */
  function audioSpecificConfig(description) {
    if (!description) return null;
    let bytes = description instanceof Uint8Array ? description
      : ArrayBuffer.isView(description) ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
        : new Uint8Array(description);
    if (bytes.length > 12 && String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === 'esds') bytes = bytes.subarray(12);
    if (bytes[0] !== 0x03 && bytes[0] !== 0x04) return bytes.length >= 2 && bytes.length <= 16 ? bytes : null;
    let i = 0;
    const readLength = () => {
      let length = 0;
      for (let k = 0; k < 4 && i < bytes.length; k++) {
        const b = bytes[i++];
        length = (length << 7) | (b & 0x7f);
        if (!(b & 0x80)) break;
      }
      return length;
    };
    while (i < bytes.length) {
      const tag = bytes[i++];
      const length = readLength();
      if (tag === 0x05) return bytes.subarray(i, i + length);
      if (tag === 0x03) {
        i += 2;
        const flags = bytes[i++];
        if (flags & 0x80) i += 2;
        if (flags & 0x40) i += 1 + bytes[i];
        if (flags & 0x20) i += 2;
      } else if (tag === 0x04) {
        i += 13;
      } else {
        i += length;
      }
    }
    return null;
  }

  /** Safari may emit AAC with ADTS headers: strip them, keep the AudioSpecificConfig. */
  function stripAdts(samples) {
    let asc = null;
    for (const sample of samples) {
      const d = sample.data;
      if (d.length > 7 && d[0] === 0xff && (d[1] & 0xf6) === 0xf0) {
        if (!asc) {
          const profile = (d[2] >> 6) + 1;
          const index = (d[2] >> 2) & 15;
          const channels = ((d[2] & 1) << 2) | (d[3] >> 6);
          asc = new Uint8Array([(profile << 3) | (index >> 1), ((index & 1) << 7) | (channels << 3)]);
        }
        sample.data = d.subarray((d[1] & 1) ? 7 : 9);
      }
    }
    return asc;
  }

  /** mix: { sampleRate, channels: [Float32Array left, Float32Array right] } */
  async function encodeAudio(mix, config, onProgress) {
    if (config.codec === 'pcm') return pcmBlocks(mix);
    const samples = [];
    let description = null;
    let failure = null;
    const encoder = new AudioEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description) description = meta.decoderConfig.description;
        samples.push(copyChunk(chunk));
      },
      error: error => { failure = error; },
    });
    encoder.configure(config);
    const [left, right] = mix.channels;
    const block = 4800;
    try {
    for (let offset = 0; offset < left.length; offset += block) {
      if (failure) throw failure;
      const frames = Math.min(block, left.length - offset);
      const data = new Float32Array(frames * 2);
      data.set(left.subarray(offset, offset + frames), 0);
      data.set(right.subarray(offset, offset + frames), frames);
      const audioData = new AudioData({
        format: 'f32-planar', sampleRate: mix.sampleRate, numberOfFrames: frames, numberOfChannels: 2,
        timestamp: Math.round(offset * 1e6 / mix.sampleRate), data,
      });
      encoder.encode(audioData);
      audioData.close();
      if (offset % (block * 50) === 0) {
        await drain(encoder, 20);
        onProgress(offset / left.length);
      }
    }
    await encoder.flush();
    } finally {
      if (encoder.state !== 'closed') encoder.close();
    }
    if (failure) throw failure;
    if (!samples.length) throw new Error('The browser encoded no audio. Try Chrome or Edge on a computer.');
    if (config.codec !== 'opus') {
      const adts = stripAdts(samples);
      description = audioSpecificConfig(description) || adts || null;
    }
    let preSkip = 312;
    if (config.codec === 'opus' && description) {
      const head = new Uint8Array(description instanceof ArrayBuffer ? description : description.buffer);
      if (head.length >= 12) preSkip = head[10] | (head[11] << 8);
    }
    return {
      codec: config.codec === 'opus' ? 'opus' : 'aac', sampleRate: config.sampleRate, channels: 2,
      bitrate: config.bitrate, description: config.codec === 'opus' ? null : description, preSkip, samples,
    };
  }

  /**
   * opts: { duration (s), fps, width, height, drawFrame: async (t) => canvas,
   *         mix: { sampleRate, channels }, onProgress(stage, ratio), isCancelled() }
   * Returns { blob, extension, videoCodec, audioCodec }.
   */
  VDB.encodeVideo = async function (opts) {
    const fps = opts.fps || 24;
    const width = opts.width || 1920, height = opts.height || 1080;
    const support = await VDB.exportSupport(width, height, fps);
    if (!support.ok) throw new Error(support.reason);
    const samples = [];
    let description = null;
    let failure = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta && meta.decoderConfig && meta.decoderConfig.description) description = meta.decoderConfig.description;
        samples.push(copyChunk(chunk));
      },
      error: error => { failure = error; },
    });
    encoder.configure(support.video);
    const total = Math.ceil(opts.duration * fps);
    const frameDuration = Math.round(1e6 / fps);
    try {
      for (let i = 0; i < total; i++) {
        if (failure) throw failure;
        if (opts.isCancelled && opts.isCancelled()) throw new Error('Production cancelled.');
        const canvas = await opts.drawFrame(i / fps);
        const frame = new VideoFrame(canvas, { timestamp: i * frameDuration, duration: frameDuration });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        await drain(encoder, 6);
        if (i % 6 === 0) opts.onProgress('frames', i / total);
      }
      await encoder.flush();
    } finally {
      // Always release the encoder (it can hold a hardware slot until garbage collection).
      if (encoder.state !== 'closed') encoder.close();
    }
    if (failure) throw failure;
    opts.onProgress('frames', 1);
    const audio = opts.mix ? await encodeAudio(opts.mix, support.audio, r => opts.onProgress('audio', r)) : null;
    opts.onProgress('mux', 0);
    const codec = support.video.codec.startsWith('vp09') ? 'vp9' : 'avc';
    const blob = VDB.muxMp4({ codec, width, height, description, samples }, audio);
    opts.onProgress('mux', 1);
    return {
      blob, extension: blob.type === 'video/quicktime' ? 'mov' : 'mp4',
      videoCodec: support.video.codec, audioCodec: audio ? audio.codec : null,
    };
  };
})();
