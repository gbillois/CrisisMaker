// Minimal MP4 (ISO BMFF) muxer for WebCodecs output (from the CWP Video Maker): one H.264 video track and
// one AAC or Opus audio track, samples interleaved in ~1 s chunks, moov first
// ("fast start") so the file plays while it downloads. With uncompressed PCM
// audio (browsers without an AAC encoder, e.g. Safari) it writes a QuickTime
// .mov instead, the layout ffmpeg uses for pcm_s16le, which Apple devices play.
(function () {
  'use strict';
  const VDB = (window.VDB = window.VDB || {});

  const MOVIE_TIMESCALE = 1000;
  const VIDEO_TIMESCALE = 90000;

  function concat(parts) {
    let length = 0;
    for (const part of parts) length += part.length;
    const out = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  }

  const u8 = v => new Uint8Array([v & 0xff]);
  const u16 = v => new Uint8Array([(v >> 8) & 0xff, v & 0xff]);
  const u24 = v => new Uint8Array([(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const u32 = v => new Uint8Array([(v >>> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const i32 = v => u32(v >>> 0);
  const str = s => new Uint8Array([...s].map(c => c.charCodeAt(0)));
  const zeros = n => new Uint8Array(n);
  const bytes = view => (view instanceof Uint8Array ? view : ArrayBuffer.isView(view)
    ? new Uint8Array(view.buffer, view.byteOffset, view.byteLength) : new Uint8Array(view));

  function box(type, ...payload) {
    const body = concat(payload);
    return concat([u32(body.length + 8), str(type), body]);
  }
  function fullBox(type, version, flags, ...payload) {
    return box(type, u8(version), u24(flags), ...payload);
  }
  const MATRIX = concat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);

  function mvhd(duration, nextTrack) {
    return fullBox('mvhd', 0, 0, u32(0), u32(0), u32(MOVIE_TIMESCALE), u32(duration), u32(0x00010000), u16(0x0100),
      zeros(10), MATRIX, zeros(24), u32(nextTrack));
  }

  function tkhd(track) {
    const audio = track.kind === 'audio';
    return fullBox('tkhd', 0, 3, u32(0), u32(0), u32(track.id), u32(0), u32(track.movieDuration), zeros(8),
      u16(0), u16(audio ? 1 : 0), u16(audio ? 0x0100 : 0), u16(0), MATRIX,
      u32(audio ? 0 : track.width << 16), u32(audio ? 0 : track.height << 16));
  }

  function mdhd(track) {
    return fullBox('mdhd', 0, 0, u32(0), u32(0), u32(track.timescale), u32(track.duration), u16(0x55c4), u16(0));
  }

  function hdlr(track, mov) {
    const video = track.kind === 'video';
    return fullBox('hdlr', 0, 0, mov ? str('mhlr') : u32(0), str(video ? 'vide' : 'soun'), zeros(12), str(video ? 'VideoHandler' : 'SoundHandler'), u8(0));
  }

  function descriptor(tag, payload) {
    return concat([u8(tag), u8(payload.length), payload]);
  }

  function sampleEntry(track) {
    if (track.kind === 'video') {
      const visual = [zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(track.width), u16(track.height),
        u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xffff)];
      if (track.codec === 'vp9') {
        // vp09.00.40.08: profile 0, level 4.0, 8-bit 4:2:0, BT.709.
        return box('vp09', ...visual, fullBox('vpcC', 1, 0, u8(0), u8(40), u8((8 << 4) | (1 << 1)), u8(1), u8(1), u8(1), u16(0)));
      }
      return box('avc1', ...visual, box('avcC', track.description));
    }
    const head = [zeros(6), u16(1), zeros(8), u16(track.channels), u16(16), u16(0), u16(0), u32(track.sampleRate << 16)];
    // QuickTime sound description v0: 16-bit little-endian PCM.
    if (track.codec === 'pcm') return box('sowt', ...head);
    if (track.codec === 'opus') {
      return box('Opus', ...head, box('dOps', u8(0), u8(track.channels), u16(track.preSkip), u32(track.sampleRate), u16(0), u8(0)));
    }
    const asc = track.description;
    const decoderSpecific = descriptor(0x05, asc);
    const decoderConfig = descriptor(0x04, concat([u8(0x40), u8(0x15), u24(0), u32(track.bitrate), u32(track.bitrate), decoderSpecific]));
    const sl = descriptor(0x06, u8(0x02));
    const es = descriptor(0x03, concat([u16(1), u8(0), decoderConfig, sl]));
    return box('mp4a', ...head, fullBox('esds', 0, 0, es));
  }

  function stbl(track, chunkOffsets) {
    if (track.codec === 'pcm') {
      // One sample per PCM frame (4 bytes for 16-bit stereo); chunks are the blocks.
      const frames = track.samples.reduce((sum, block) => sum + block.frames, 0);
      const stsc = [];
      track.chunks.forEach((chunk, i) => {
        const count = track.samples[chunk.first].frames;
        const last = stsc[stsc.length - 1];
        if (!last || last.count !== count) stsc.push({ first: i + 1, count });
      });
      return box('stbl',
        fullBox('stsd', 0, 0, u32(1), sampleEntry(track)),
        fullBox('stts', 0, 0, u32(1), u32(frames), u32(1)),
        fullBox('stsc', 0, 0, u32(stsc.length), ...stsc.map(e => concat([u32(e.first), u32(e.count), u32(1)]))),
        fullBox('stsz', 0, 0, u32(track.channels * 2), u32(frames)),
        fullBox('stco', 0, 0, u32(chunkOffsets.length), ...chunkOffsets.map(u32)));
    }
    const samples = track.samples;
    // stts: run-length of durations
    const stts = [];
    for (const sample of samples) {
      const last = stts[stts.length - 1];
      if (last && last.delta === sample.duration) last.count++;
      else stts.push({ count: 1, delta: sample.duration });
    }
    const parts = [
      fullBox('stsd', 0, 0, u32(1), sampleEntry(track)),
      fullBox('stts', 0, 0, u32(stts.length), ...stts.map(e => concat([u32(e.count), u32(e.delta)]))),
    ];
    if (track.kind === 'video') {
      const sync = samples.map((s, i) => (s.key ? i + 1 : 0)).filter(Boolean);
      parts.push(fullBox('stss', 0, 0, u32(sync.length), ...sync.map(u32)));
      if (samples.some(s => s.offset !== 0)) {
        parts.push(fullBox('ctts', 1, 0, u32(samples.length), ...samples.map(s => concat([u32(1), i32(s.offset)]))));
      }
    }
    // stsc: runs of chunks with the same sample count
    const stsc = [];
    track.chunks.forEach((chunk, i) => {
      const last = stsc[stsc.length - 1];
      if (!last || last.count !== chunk.count) stsc.push({ first: i + 1, count: chunk.count });
    });
    parts.push(fullBox('stsc', 0, 0, u32(stsc.length), ...stsc.map(e => concat([u32(e.first), u32(e.count), u32(1)]))));
    parts.push(fullBox('stsz', 0, 0, u32(0), u32(samples.length), ...samples.map(s => u32(s.data.length))));
    parts.push(fullBox('stco', 0, 0, u32(chunkOffsets.length), ...chunkOffsets.map(u32)));
    return box('stbl', ...parts);
  }

  function trak(track, chunkOffsets, mov) {
    const media = track.kind === 'video' ? fullBox('vmhd', 0, 1, zeros(8)) : fullBox('smhd', 0, 0, zeros(4));
    const dinf = box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1)));
    return box('trak', tkhd(track), box('mdia', mdhd(track), hdlr(track, mov), box('minf', media, dinf, stbl(track, chunkOffsets))));
  }

  /**
   * video: { codec: 'avc'|'vp9', width, height, description (avcC), samples: [{ data, timestamp (µs), duration (µs), key }] }
   * audio: { codec: 'aac'|'opus'|'pcm', sampleRate, channels, bitrate, description, preSkip, samples: [{ data, timestamp, duration }] }
   *   (pcm: samples are ~1 s blocks { data: 16-bit little-endian interleaved, frames, timestamp })
   * Returns a Blob (video/mp4, or video/quicktime with PCM audio).
   */
  VDB.muxMp4 = function (video, audio) {
    const tracks = [];
    // Video: sample times in 90 kHz, decode order = encode order.
    const vSamples = video.samples.map(s => ({ data: bytes(s.data), key: s.key, pts: Math.round(s.timestamp * VIDEO_TIMESCALE / 1e6) }));
    const sortedPts = vSamples.map(s => s.pts).sort((a, b) => a - b);
    const frameTicks = Math.round((video.samples[0] && video.samples[0].duration ? video.samples[0].duration : 1e6 / 30) * VIDEO_TIMESCALE / 1e6);
    vSamples.forEach((s, i) => {
      s.dts = sortedPts[i];
      s.offset = s.pts - s.dts;
      s.duration = i + 1 < vSamples.length ? sortedPts[i + 1] - sortedPts[i] : frameTicks;
    });
    const vDuration = vSamples.reduce((sum, s) => sum + s.duration, 0);
    tracks.push({
      kind: 'video', id: 1, timescale: VIDEO_TIMESCALE, width: video.width, height: video.height, codec: video.codec || 'avc',
      description: video.description ? bytes(video.description) : null, samples: vSamples, duration: vDuration,
      movieDuration: Math.round(vDuration * MOVIE_TIMESCALE / VIDEO_TIMESCALE), time: s => s.dts / VIDEO_TIMESCALE,
    });
    const mov = !!(audio && audio.codec === 'pcm');
    if (mov && audio.samples.length) {
      const blocks = audio.samples.map(block => ({ data: bytes(block.data), frames: block.frames, t: block.timestamp / 1e6 }));
      const frames = blocks.reduce((sum, block) => sum + block.frames, 0);
      tracks.push({
        kind: 'audio', id: 2, timescale: audio.sampleRate, codec: 'pcm', sampleRate: audio.sampleRate, channels: audio.channels,
        samples: blocks, duration: frames, onePerChunk: true,
        movieDuration: Math.round(frames * MOVIE_TIMESCALE / audio.sampleRate), time: s => s.t,
      });
    } else if (audio && audio.samples.length) {
      const aSamples = audio.samples.map((s, i) => {
        const next = audio.samples[i + 1];
        const us = next ? next.timestamp - s.timestamp : (s.duration || 1024 * 1e6 / audio.sampleRate);
        return { data: bytes(s.data), key: true, offset: 0, duration: Math.max(1, Math.round(us * audio.sampleRate / 1e6)), t: s.timestamp / 1e6 };
      });
      const aDuration = aSamples.reduce((sum, s) => sum + s.duration, 0);
      tracks.push({
        kind: 'audio', id: 2, timescale: audio.sampleRate, codec: audio.codec, sampleRate: audio.sampleRate,
        channels: audio.channels, bitrate: audio.bitrate || 128000, preSkip: audio.preSkip || 312,
        description: audio.description ? bytes(audio.description) : null, samples: aSamples, duration: aDuration,
        movieDuration: Math.round(aDuration * MOVIE_TIMESCALE / audio.sampleRate), time: s => s.t,
      });
      if (audio.codec === 'aac' && !tracks[1].description) {
        // AudioSpecificConfig: AAC-LC, sampling index, channel configuration.
        const index = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000].indexOf(audio.sampleRate);
        const asc = (2 << 11) | ((index < 0 ? 3 : index) << 7) | (audio.channels << 3);
        tracks[1].description = u16(asc);
      }
    }

    // Interleave: ~1 s chunks, taken in time order across tracks.
    const cursors = tracks.map(() => 0);
    const order = [];
    tracks.forEach(track => { track.chunks = []; });
    for (;;) {
      let pick = -1;
      let pickTime = Infinity;
      tracks.forEach((track, i) => {
        if (cursors[i] < track.samples.length) {
          const time = track.time(track.samples[cursors[i]]);
          if (time < pickTime) { pickTime = time; pick = i; }
        }
      });
      if (pick < 0) break;
      const track = tracks[pick];
      const first = cursors[pick];
      let last = first;
      const limit = track.time(track.samples[first]) + 1;
      if (track.onePerChunk) last = first + 1;
      else while (last < track.samples.length && track.time(track.samples[last]) < limit) last++;
      const chunk = { track: pick, first, count: last - first, size: 0 };
      for (let i = first; i < last; i++) chunk.size += track.samples[i].data.length;
      track.chunks.push(chunk);
      order.push(chunk);
      cursors[pick] = last;
    }

    const ftyp = mov
      ? box('ftyp', str('qt  '), u32(0x20050300), str('qt  '))
      : box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str(tracks[0].codec === 'vp9' ? 'vp09' : 'avc1'), str('mp41'));
    const movieDuration = Math.max(...tracks.map(t => t.movieDuration));
    const buildMoov = offsets => box('moov', mvhd(movieDuration, tracks.length + 1),
      ...tracks.map((track, i) => trak(track, offsets[i], mov)));
    const placeholder = buildMoov(tracks.map(track => track.chunks.map(() => 0)));
    const mdatStart = ftyp.length + placeholder.length + 8;
    const offsets = tracks.map(() => []);
    let cursor = mdatStart;
    for (const chunk of order) {
      offsets[chunk.track].push(cursor);
      cursor += chunk.size;
    }
    const moov = buildMoov(offsets);
    const mdatSize = cursor - mdatStart + 8;
    const parts = [ftyp, moov, concat([u32(mdatSize), str('mdat')])];
    for (const chunk of order) {
      const track = tracks[chunk.track];
      for (let i = chunk.first; i < chunk.first + chunk.count; i++) parts.push(track.samples[i].data);
    }
    return new Blob(parts, { type: mov ? 'video/quicktime' : 'video/mp4' });
  };
})();
