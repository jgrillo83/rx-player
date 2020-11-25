function be4toi(bytes, offset) {
  return ((bytes[offset + 0] * 0x1000000) +
          (bytes[offset + 1] * 0x0010000) +
          (bytes[offset + 2] * 0x0000100) +
          (bytes[offset + 3]));
}
function be8toi(bytes, offset) {
  return (((bytes[offset + 0] * 0x1000000) +
           (bytes[offset + 1] * 0x0010000) +
           (bytes[offset + 2] * 0x0000100) +
           (bytes[offset + 3])
          ) * 0x100000000 +
         (bytes[offset + 4] * 0x1000000) +
         (bytes[offset + 5] * 0x0010000) +
         (bytes[offset + 6] * 0x0000100) +
         (bytes[offset + 7]));
}
window.toto = 50;
function getBoxOffsets(buf, boxName) {
  const len = buf.length;
  let boxBaseOffset = 0;
  let name;
  let lastBoxSize = 0;
  let lastOffset;
  while (boxBaseOffset + 8 <= len) {
    lastOffset = boxBaseOffset;
    lastBoxSize = be4toi(buf, lastOffset);
    lastOffset += 4;

    name = be4toi(buf, lastOffset);
    lastOffset += 4;

    if (lastBoxSize === 0) {
      lastBoxSize = len - boxBaseOffset;
    } else if (lastBoxSize === 1) {
      if (lastOffset + 8 > len) {
        return null;
      }
      lastBoxSize = be8toi(buf, lastOffset);
      lastOffset += 8;
    }

    if (lastBoxSize < 0) {
      throw new Error("ISOBMFF: Size out of range");
    }
    if (name === boxName) {
      if (boxName  === 0x75756964 /* === "uuid" */) {
        lastOffset += 16; // Skip uuid name
      }
      return [boxBaseOffset, lastOffset, boxBaseOffset + lastBoxSize];
    } else {
      boxBaseOffset += lastBoxSize;
    }
  }
  return null;
}
function getBoxContent(buf, boxName) {
  const offsets = getBoxOffsets(buf, boxName);
  return offsets !== null ? buf.subarray(offsets[1], offsets[2]) :
                            null;
}
const oldAppendBuffer = SourceBuffer.prototype.appendBuffer;
SourceBuffer.prototype.appendBuffer = function(data) {
  const buf = data instanceof Uint8Array ? data :
                                           new Uint8Array(data);
  const moof = getBoxContent(buf, 0x6D6F6F66 /* moof */);
  if (moof === null) {
    console.error("REPLACING TK_ID: NO moof FOUND");
    return oldAppendBuffer.apply(this, [buf]);
  }

  const traf = getBoxContent(moof, 0x74726166 /* traf */);
  if (traf === null) {
    console.error("REPLACING TK_ID: NO traf FOUND");
    return oldAppendBuffer.apply(this, [buf]);
  }

  const tfhd = getBoxContent(traf, 0x74666864 /* "tfhd" */);
  if (tfhd === null) {
    console.error("REPLACING TK_ID: NO tfhd FOUND");
    return oldAppendBuffer.apply(this, [buf]);
  }
  if (tfhd[0] > 0) {
    console.error("REPLACING TK_ID: INVALID tfhd VERSION:", tfhd[0]);
    return oldAppendBuffer.apply(this, [buf]);
  }
  const oldTrackId = tfhd[4 + 3];
  if (oldTrackId !== 2 && oldTrackId !== 3) {
    return oldAppendBuffer.apply(this, [buf]);
  }
  if (typeof window.SWITCH_TO_TRACK_ID === "number") {
    tfhd[4] = 0;
    tfhd[4 + 1] = 0;
    tfhd[4 + 2] = 0;
    tfhd[4 + 3] = window.SWITCH_TO_TRACK_ID;
  }
  console.error("!!!! old", oldTrackId);
  console.error("!!!! new", tfhd[4 + 3]);
  return oldAppendBuffer.apply(this, [buf]);
}
