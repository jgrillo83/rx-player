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

import {
  BehaviorSubject,
  concat as observableConcat,
  EMPTY,
  merge as observableMerge,
  Observable,
  of as observableOf,
  ReplaySubject,
} from "rxjs";
import {
  catchError,
  ignoreElements,
  map,
  mapTo,
  mergeMap,
  startWith,
  switchMap,
  take,
} from "rxjs/operators";
import { formatError } from "../../../errors";
import log from "../../../log";
import Manifest, {
  Adaptation,
  Period,
} from "../../../manifest";
import objectAssign from "../../../utils/object_assign";
import { getLeftSizeOfRange } from "../../../utils/ranges";
import WeakMapMemory from "../../../utils/weak_map_memory";
import ABRManager from "../../abr";
import { IStalledStatus } from "../../api";
import { SegmentFetcherCreator } from "../../fetchers";
import SourceBuffersStore, {
  IBufferType,
  IOverlaySourceBufferOptions,
  ITextTrackSourceBufferOptions,
  QueuedSourceBuffer,
} from "../../source_buffers";
import AdaptationStream, {
  IAdaptationStreamOptions,
} from "../adaptation";
import EVENTS from "../events_generators";
import {
  IAdaptationStreamEvent,
  IPeriodStreamEvent,
  IStreamWarningEvent,
} from "../types";
import createEmptyStream from "./create_empty_adaptation_stream";
import getAdaptationSwitchStrategy from "./get_adaptation_switch_strategy";

export interface IPeriodStreamClockTick {
  currentTime : number; // the current position we are in the video in s
  duration : number; // duration of the HTMLMediaElement
  isPaused: boolean; // If true, the player is on pause
  liveGap? : number; // gap between the current position and the edge of a
                     // live content. Not set for non-live contents
  readyState : number; // readyState of the HTMLMediaElement
  speed : number; // playback rate at which the content plays
  stalled : IStalledStatus|null; // if set, the player is currently stalled
  wantedTimeOffset : number; // offset in s to add to currentTime to obtain the
                             // position we actually want to download from
}

export interface IPeriodStreamArguments {
  abrManager : ABRManager;
  bufferType : IBufferType;
  clock$ : Observable<IPeriodStreamClockTick>;
  content : { manifest : Manifest;
              period : Period; };
  garbageCollectors : WeakMapMemory<QueuedSourceBuffer<unknown>, Observable<never>>;
  segmentFetcherCreator : SegmentFetcherCreator<any>;
  sourceBuffersStore : SourceBuffersStore;
  options: IPeriodStreamOptions;
  wantedBufferAhead$ : BehaviorSubject<number>;
}

/** Options tweaking the behavior of the PeriodStream. */
export type IPeriodStreamOptions = IAdaptationStreamOptions &
                                   { overlayOptions? : IOverlaySourceBufferOptions;
                                     textTrackOptions? : ITextTrackSourceBufferOptions; };

/**
 * Create single PeriodStream Observable:
 *   - Lazily create (or reuse) a SourceBuffer for the given type.
 *   - Create a Stream linked to an Adaptation each time it changes, to
 *     download and append the corresponding Segments in the SourceBuffer.
 *   - Announce when the Stream is full or is awaiting new Segments through
 *     events
 * @param {Object} args
 * @returns {Observable}
 */
export default function PeriodStream({
  abrManager,
  bufferType,
  clock$,
  content,
  garbageCollectors,
  segmentFetcherCreator,
  sourceBuffersStore,
  options,
  wantedBufferAhead$,
} : IPeriodStreamArguments) : Observable<IPeriodStreamEvent> {
  const { period } = content;

  // Emits the chosen Adaptation for the current type.
  // `null` when no Adaptation is chosen (e.g. no subtitles)
  const adaptation$ = new ReplaySubject<Adaptation|null>(1);
  return adaptation$.pipe(
    switchMap((adaptation) => {
      if (adaptation === null) {
        log.info(`Stream: Set no ${bufferType} Adaptation`, period);
        const sourceBufferStatus = sourceBuffersStore.getStatus(bufferType);
        let cleanBuffer$ : Observable<unknown>;

        if (sourceBufferStatus.type === "initialized") {
          log.info(`Stream: Clearing previous ${bufferType} SourceBuffer`);
          if (SourceBuffersStore.isNative(bufferType)) {
            return clock$.pipe(map((tick) => {
              return EVENTS.needsMediaSourceReload(period, tick);
            }));
          }
          cleanBuffer$ = sourceBufferStatus.value
            .removeBuffer(period.start,
                          period.end == null ? Infinity :
                                               period.end);
        } else {
          if (sourceBufferStatus.type === "uninitialized") {
            sourceBuffersStore.disableSourceBuffer(bufferType);
          }
          cleanBuffer$ = observableOf(null);
        }

        return observableConcat<IPeriodStreamEvent>(
          cleanBuffer$.pipe(mapTo(EVENTS.adaptationChange(bufferType, null, period))),
          createEmptyStream(clock$, wantedBufferAhead$, bufferType, { period })
        );
      }

      if (SourceBuffersStore.isNative(bufferType) &&
          sourceBuffersStore.getStatus(bufferType).type === "disabled")
      {
        return clock$.pipe(map((tick) => {
          return EVENTS.needsMediaSourceReload(period, tick);
        }));
      }

      log.info(`Stream: Updating ${bufferType} adaptation`, adaptation, period);

      const newStream$ = clock$.pipe(
        take(1),
        mergeMap((tick) => {
          const qSourceBuffer = createOrReuseQueuedSourceBuffer(sourceBuffersStore,
                                                                bufferType,
                                                                adaptation,
                                                                options);
          const strategy = getAdaptationSwitchStrategy(qSourceBuffer,
                                                       period,
                                                       adaptation,
                                                       tick);
          if (strategy.type === "needs-reload") {
            return observableOf(EVENTS.needsMediaSourceReload(period, tick));
          }

          const cleanBuffer$ = strategy.type === "clean-buffer" ?
            observableConcat(...strategy.value.map(({ start, end }) =>
                               qSourceBuffer.removeBuffer(start, end))
                            ).pipe(ignoreElements()) :
            EMPTY;

          const bufferGarbageCollector$ = garbageCollectors.get(qSourceBuffer);
          const adaptationStream$ = createAdaptationStream(adaptation, qSourceBuffer);

          return sourceBuffersStore.waitForUsableSourceBuffers().pipe(mergeMap(() => {
            return observableConcat(cleanBuffer$,
                                    observableMerge(adaptationStream$,
                                                    bufferGarbageCollector$));
          }));
        }));

      return observableConcat<IPeriodStreamEvent>(
        observableOf(EVENTS.adaptationChange(bufferType, adaptation, period)),
        newStream$
      );
    }),
    startWith(EVENTS.periodStreamReady(bufferType, period, adaptation$))
  );

  /**
   * @param {Object} adaptation
   * @param {Object} qSourceBuffer
   * @returns {Observable}
   */
  function createAdaptationStream<T>(
    adaptation : Adaptation,
    qSourceBuffer : QueuedSourceBuffer<T>
  ) : Observable<IAdaptationStreamEvent<T>|IStreamWarningEvent> {
    const { manifest } = content;
    const adaptationStreamClock$ = clock$.pipe(map(tick => {
      const buffered = qSourceBuffer.getBufferedRanges();
      return objectAssign({},
                          tick,
                          { bufferGap: getLeftSizeOfRange(buffered,
                                                          tick.currentTime) });
    }));
    return AdaptationStream({ abrManager,
                              clock$: adaptationStreamClock$,
                              content: { manifest, period, adaptation },
                              options,
                              queuedSourceBuffer: qSourceBuffer,
                              segmentFetcherCreator,
                              wantedBufferAhead$ })
    .pipe(catchError((error : unknown) => {
      // Stream linked to a non-native SourceBuffer should not impact the
      // stability of the player. ie: if a text buffer sends an error, we want
      // to continue playing without any subtitles
      if (!SourceBuffersStore.isNative(bufferType)) {
        log.error(`Stream: ${bufferType} Stream crashed. Aborting it.`, error);
        sourceBuffersStore.disposeSourceBuffer(bufferType);

        const formattedError = formatError(error, {
          defaultCode: "NONE",
          defaultReason: "Unknown `AdaptationStream` error",
        });
        return observableConcat<IAdaptationStreamEvent<T>|IStreamWarningEvent>(
          observableOf(EVENTS.warning(formattedError)),
          createEmptyStream(clock$, wantedBufferAhead$, bufferType, { period })
        );
      }
      log.error(`Stream: ${bufferType} Stream crashed. Stopping playback.`, error);
      throw error;
    }));
  }
}

/**
 * @param {string} bufferType
 * @param {Object} adaptation
 * @returns {Object}
 */
function createOrReuseQueuedSourceBuffer<T>(
  sourceBuffersStore : SourceBuffersStore,
  bufferType : IBufferType,
  adaptation : Adaptation,
  options: {
    overlayOptions? : IOverlaySourceBufferOptions;
    textTrackOptions? : ITextTrackSourceBufferOptions;
  }
) : QueuedSourceBuffer<T> {
  const sourceBufferStatus = sourceBuffersStore.getStatus(bufferType);
  if (sourceBufferStatus.type === "initialized") {
    log.info("Stream: Reusing a previous SourceBuffer for the type", bufferType);
    return sourceBufferStatus.value;
  }
  const codec = getFirstDeclaredMimeType(adaptation);
  const sbOptions = (() => {
      if (bufferType === "text") {
        return options.textTrackOptions;
      }
      if (bufferType === "overlay") {
        return options.overlayOptions;
      }
    })();
  return sourceBuffersStore.createSourceBuffer(bufferType, codec, sbOptions);
}

/**
 * Get mime-type string of the first representation declared in the given
 * adaptation.
 * @param {Adaptation} adaptation
 * @returns {string}
 */
function getFirstDeclaredMimeType(adaptation : Adaptation) : string {
  const { representations } = adaptation;
  if (representations[0] == null) {
    return "";
  }
  return representations[0].getMimeTypeString();
}