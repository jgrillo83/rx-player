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
import config from "../../../config";
import arrayFind from "../../../utils/array_find";
import idGenerator from "../../../utils/id_generator";
import resolveURL, { normalizeBaseURL, } from "../../../utils/resolve_url";
import checkManifestIDs from "../utils/check_manifest_ids";
import getClockOffset from "./get_clock_offset";
import getHTTPUTCTimingURL from "./get_http_utc-timing_url";
import getLastTimeReference from "./get_last_time_reference";
import getTimeLimits from "./get_time_limits";
import { createMPDIntermediateRepresentation, } from "./node_parsers/MPD";
import { createPeriodIntermediateRepresentation, } from "./node_parsers/Period";
import parseAvailabilityStartTime from "./parse_availability_start_time";
import parseDuration from "./parse_duration";
import parsePeriods from "./parse_periods";
var generateManifestID = idGenerator();
/**
 * @param {Element} root - The MPD root.
 * @param {Object} args
 * @returns {Object}
 */
export default function parseMPD(root, args) {
    // Transform whole MPD into a parsed JS object representation
    var mpdIR = createMPDIntermediateRepresentation(root);
    return loadExternalRessourcesAndParse(mpdIR, args);
}
/**
 * Checks if xlinks needs to be loaded before actually parsing the manifest.
 * @param {Object} mpdIR
 * @param {Object} args
 * @returns {Object}
 */
function loadExternalRessourcesAndParse(mpdIR, args) {
    var xlinksToLoad = [];
    for (var i = 0; i < mpdIR.children.periods.length; i++) {
        var _a = mpdIR.children.periods[i].attributes, xlinkHref = _a.xlinkHref, xlinkActuate = _a.xlinkActuate;
        if (xlinkHref != null && xlinkActuate === "onLoad") {
            xlinksToLoad.push({ index: i, ressource: xlinkHref });
        }
    }
    if (xlinksToLoad.length === 0) {
        return parseCompleteIntermediateRepresentation(mpdIR, args);
    }
    return {
        type: "needs-ressources",
        value: {
            ressources: xlinksToLoad.map(function (_a) {
                var ressource = _a.ressource;
                return ressource;
            }),
            continue: function continueParsingMPD(loadedRessources) {
                var _a;
                if (loadedRessources.length !== xlinksToLoad.length) {
                    throw new Error("DASH parser: wrong number of loaded ressources.");
                }
                // Note: It is important to go from the last index to the first index in
                // the resulting array, as we will potentially add elements to the array
                for (var i = loadedRessources.length - 1; i >= 0; i--) {
                    var index = xlinksToLoad[i].index;
                    var xlinkData = loadedRessources[i];
                    var wrappedData = "<root>" + xlinkData + "</root>";
                    var dataAsXML = new DOMParser().parseFromString(wrappedData, "text/xml");
                    if (!dataAsXML || dataAsXML.children.length === 0) {
                        throw new Error("DASH parser: Invalid external ressources");
                    }
                    var periods = dataAsXML.children[0].children;
                    var periodsIR = [];
                    for (var j = 0; j < periods.length; j++) {
                        if (periods[j].nodeType === Node.ELEMENT_NODE) {
                            periodsIR.push(createPeriodIntermediateRepresentation(periods[j]));
                        }
                    }
                    // replace original "xlinked" periods by the real deal
                    (_a = mpdIR.children.periods).splice.apply(_a, [index, 1].concat(periodsIR));
                }
                return loadExternalRessourcesAndParse(mpdIR, args);
            },
        },
    };
}
/**
 * Parse the MPD intermediate representation into a regular Manifest.
 * @param {Object} mpdIR
 * @param {Object} args
 * @returns {Object}
 */
function parseCompleteIntermediateRepresentation(mpdIR, args) {
    var rootChildren = mpdIR.children, rootAttributes = mpdIR.attributes;
    var baseURL = resolveURL(normalizeBaseURL(args.url), rootChildren.baseURL);
    var availabilityStartTime = parseAvailabilityStartTime(rootAttributes, args.referenceDateTime);
    var isDynamic = rootAttributes.type === "dynamic";
    var parsedPeriods = parsePeriods(rootChildren.periods, { availabilityStartTime: availabilityStartTime,
        duration: rootAttributes.duration,
        isDynamic: isDynamic,
        baseURL: baseURL });
    var duration = parseDuration(rootAttributes, parsedPeriods);
    var directTiming = arrayFind(rootChildren.utcTimings, function (utcTiming) {
        return utcTiming.schemeIdUri === "urn:mpeg:dash:utc:direct:2014" &&
            utcTiming.value != null;
    });
    // second condition not needed but TS did not help there, even with a `is`
    var clockOffsetFromDirectUTCTiming = directTiming != null &&
        directTiming.value != null ? getClockOffset(directTiming.value) :
        undefined;
    var parsedMPD = {
        availabilityStartTime: availabilityStartTime,
        baseURL: baseURL,
        duration: duration,
        id: rootAttributes.id != null ? rootAttributes.id :
            "gen-dash-manifest-" + generateManifestID(),
        periods: parsedPeriods,
        transportType: "dash",
        isLive: isDynamic,
        uris: [args.url].concat(rootChildren.locations),
        suggestedPresentationDelay: rootAttributes.suggestedPresentationDelay != null ?
            rootAttributes.suggestedPresentationDelay :
            config.DEFAULT_SUGGESTED_PRESENTATION_DELAY.DASH,
        clockOffset: clockOffsetFromDirectUTCTiming != null &&
            !isNaN(clockOffsetFromDirectUTCTiming) ?
            clockOffsetFromDirectUTCTiming :
            undefined,
    };
    // -- add optional fields --
    if (rootAttributes.minimumUpdatePeriod != null
        && rootAttributes.minimumUpdatePeriod > 0) {
        parsedMPD.lifetime = rootAttributes.minimumUpdatePeriod;
    }
    checkManifestIDs(parsedMPD);
    if (parsedMPD.isLive) {
        var lastTimeReference_1 = getLastTimeReference(parsedMPD);
        if (clockOffsetFromDirectUTCTiming == null &&
            lastTimeReference_1 == null &&
            args.loadExternalClock) {
            var UTCTimingHTTPURL = getHTTPUTCTimingURL(mpdIR);
            if (UTCTimingHTTPURL != null && UTCTimingHTTPURL.length > 0) {
                return {
                    type: "needs-ressources",
                    value: {
                        ressources: [UTCTimingHTTPURL],
                        continue: function continueParsingMPD(loadedRessources) {
                            if (loadedRessources.length !== 1) {
                                throw new Error("DASH parser: wrong number of loaded ressources.");
                            }
                            parsedMPD.clockOffset = getClockOffset(loadedRessources[0]);
                            var timeLimits = getTimeLimits(parsedMPD, lastTimeReference_1, rootAttributes.timeShiftBufferDepth);
                            parsedMPD.minimumTime = timeLimits[0];
                            parsedMPD.maximumTime = timeLimits[1];
                            return { type: "done", value: parsedMPD };
                        },
                    },
                };
            }
        }
        var _a = getTimeLimits(parsedMPD, lastTimeReference_1, rootAttributes.timeShiftBufferDepth), minTime = _a[0], maxTime = _a[1];
        parsedMPD.minimumTime = minTime;
        parsedMPD.maximumTime = maxTime;
    }
    return { type: "done", value: parsedMPD };
}