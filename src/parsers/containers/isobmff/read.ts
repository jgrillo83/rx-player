/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getBoxContent } from "./get_box";

/**
 * Returns TRAF Box from the whole ISOBMFF File.
 * Returns null if not found.
 * @param {Uint8Array} buffer
 * @returns {Uint8Array|null}
 */
function getTRAF(buffer : Uint8Array) : Uint8Array|null {
  const moof = getBoxContent(buffer, 0x6D6F6F66 /* moof */);
  if (moof === null) {
    return null;
  }
  return getBoxContent(moof, 0x74726166 /* traf */);
}

/**
 * Returns MDAT Box from the whole ISOBMFF File.
 * Returns null if not found.
 * @param {Uint8Array} buffer
 * @returns {Uint8Array|null}
 */
function getMDAT(buf : Uint8Array) : Uint8Array|null {
  return getBoxContent(buf, 0x6D646174 /* "mdat" */);
}

/**
 * Returns MDIA Box from the whole ISOBMFF File.
 * Returns null if not found.
 * @param {Uint8Array} buffer
 * @returns {Uint8Array|null}
 */
function getMDIA(buf : Uint8Array) : Uint8Array|null {
  const moov = getBoxContent(buf, 0x6D6F6F76 /* moov */);
  if (moov === null) {
    return null;
  }

  const trak = getBoxContent(moov, 0x7472616B /* "trak" */);
  if (trak === null) {
    return null;
  }

  return getBoxContent(trak, 0x6D646961 /* "mdia" */);
}

/**
 * @param {Uint8Array} buffer
 * @returns {Uint8Array|null}
 */
function setTrackIdInTkhdTo1(buf : Uint8Array) : void {
  const moov = getBoxContent(buf, 0x6D6F6F76 /* moov */);
  if (moov === null) {
    console.error("REPLACING TK_ID: NO MOOV FOUND");
    return ;
  }

  const mvhd = getBoxContent(moov, 0x6D766864 /* mvhd */);
  if (mvhd === null) {
    console.error("REPLACING TK_ID: NO MVHD FOUND");
    return ;
  }

  const mvex = getBoxContent(moov, 0x6D766578 /* mvex */);
  if (mvex === null) {
    console.error("REPLACING TK_ID: NO MVEX FOUND");
    return ;
  }

  const trex = getBoxContent(mvex, 0x74726578 /* trex */);
  if (trex === null) {
    console.error("REPLACING TK_ID: NO TREX FOUND");
    return ;
  }
  if (trex[0] > 0) {
    console.error("REPLACING TK_ID: INVALID TKHD VERSION:", trex[0]);
    return ;
  }
  trex[4] = 0;
  trex[4 + 1] = 0;
  trex[4 + 2] = 0;
  trex[4 + 3] = 1;

  const trak = getBoxContent(moov, 0x7472616B /* "trak" */);
  if (trak === null) {
    console.error("REPLACING TK_ID: NO TRAK FOUND");
    return ;
  }

  const tkhd = getBoxContent(trak, 0x746B6864 /* "tkhd" */);
  if (tkhd === null) {
    console.error("REPLACING TK_ID: NO TKHD FOUND");
    return ;
  }
  if (tkhd[0] > 1) {
    console.error("REPLACING TK_ID: INVALID TKHD VERSION:", tkhd[0]);
    return ;
  } else if (tkhd[0] === 1) {
    debugger;
    tkhd[4 + 8 + 8] = 0;
    tkhd[4 + 8 + 8 + 1] = 0;
    tkhd[4 + 8 + 8 + 2] = 0;
    tkhd[4 + 8 + 8 + 3] = 1;
  } else if (tkhd[0] === 0) {
    debugger;
    tkhd[4 + 4 + 4] = 0;
    tkhd[4 + 4 + 4 + 1] = 0;
    tkhd[4 + 4 + 4 + 2] = 0;
    tkhd[4 + 4 + 4 + 3] = 1;
  }
}

/**
 * @param {Uint8Array} buffer
 * @returns {Uint8Array|null}
 */
function setTrackIdInTfhdTo1(buf : Uint8Array) : void {
  const moof = getBoxContent(buf, 0x6D6F6F66 /* moof */);
  if (moof === null) {
    console.error("REPLACING TK_ID: NO moof FOUND");
    return ;
  }

  const traf = getBoxContent(moof, 0x74726166 /* traf */);
  if (traf === null) {
    console.error("REPLACING TK_ID: NO traf FOUND");
    return ;
  }

  const tfhd = getBoxContent(traf, 0x74666864 /* "tfhd" */);
  if (tfhd === null) {
    console.error("REPLACING TK_ID: NO tfhd FOUND");
    return ;
  }
  if (tfhd[0] > 0) {
    console.error("REPLACING TK_ID: INVALID tfhd VERSION:", tfhd[0]);
    return ;
  }
  debugger;
  tfhd[4] = 0;
  tfhd[4 + 1] = 0;
  tfhd[4 + 2] = 0;
  tfhd[4 + 3] = 1;
}

export {
  getTRAF,
  getMDAT,
  getMDIA,
  setTrackIdInTkhdTo1,
  setTrackIdInTfhdTo1,
};
