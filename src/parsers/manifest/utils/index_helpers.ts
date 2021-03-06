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

// Generic way to representat segments in an index of segments
export interface IIndexSegment { start: number; // start time
                                 duration: number; // duration
                                 repeatCount: number; // repeat counter
                                 range?: [number, number]; } // possible
                                                             // byte-range

/**
 * Calculate the number of times a timeline element repeats based on the next
 * element.
 * @param {Object} element
 * @param {Object} nextElement
 * @param {number} maxPosition
 * @returns {Number}
 */
export function calculateRepeat(
  element : IIndexSegment,
  nextElement? : IIndexSegment|null,
  maxPosition? : number
) : number {
  const { repeatCount } = element;

  if (repeatCount >= 0) {
    return repeatCount;
  }

  // A negative value of the @r attribute of the S element indicates
  // that the duration indicated in @d attribute repeats until the
  // start of the next S element, the end of the Period or until the
  // next MPD update.
  let segmentEnd : number;
  if (nextElement != null) {
    segmentEnd = nextElement.start;
  } else if (maxPosition != null) {
    segmentEnd = maxPosition;
  } else {
    segmentEnd = Number.MAX_VALUE;
  }
  return Math.ceil((segmentEnd - element.start) / element.duration) - 1;
}

/**
 * Returns end of the segment given, in index time.
 * @param {Object} segment
 * @param {Object|null} [nextSegment]
 * @param {number} maxPosition
 * @returns {Number}
 */
export function getIndexSegmentEnd(
  segment : IIndexSegment,
  nextSegment : IIndexSegment|null,
  maxPosition? : number
) : number {
  const { start, duration } = segment;
  if (duration <= 0) {
    return start;
  }

  const repeat = calculateRepeat(segment, nextSegment, maxPosition);
  return start + (repeat + 1) * duration;
}

/**
 * Convert from `presentationTime`, the time of the segment at the moment it
 * is decoded to `mediaTime`, the original time the segments point at.
 * @param {number} time
 * @param {Object} indexOptions
 * @returns {number}
 */
export function toIndexTime(
  time : number,
  indexOptions : { timescale : number; indexTimeOffset : number }
) : number {
  return time * indexOptions.timescale + indexOptions.indexTimeOffset;
}

/**
 * Convert from `mediaTime`, the original time the segments point at to
 * `presentationTime`, the time of the segment at the moment it is decoded.
 * @param {number} time
 * @param {Object} indexOptions
 * @returns {number}
 */
export function fromIndexTime(
  time : number,
  indexOptions : { timescale : number; indexTimeOffset : number }
) : number {
  return (time - indexOptions.indexTimeOffset) / indexOptions.timescale;
}

/**
 * @param {Number} start
 * @param {Number} duration
 * @param {Number} timescale
 * @returns {Object} - Object with two properties:
 *   - up {Number}: timescaled timestamp of the beginning time
 *   - to {Number}: timescaled timestamp of the end time (start time + duration)
 */
export function getTimescaledRange(
  start: number,
  duration: number,
  timescale : number
) : [number, number] {
  return [ start * timescale,
           (start + duration) * timescale ];
}
