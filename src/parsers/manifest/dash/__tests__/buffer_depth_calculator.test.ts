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

import BufferDepthCalculator from "../buffer_depth_calculator";

describe("DASH parsers - BufferDepthCalculator", () => {
  /* tslint:disable max-line-length */
  it("should return undefined through `getFirstAvailablePosition` if the live edge was never set for a dynamic content with a timeShiftBufferDepth", () => {
  /* tslint:enable max-line-length */
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: true,
      timeShiftBufferDepth: 5,
    });
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(undefined);
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(undefined);
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(undefined);
  });

  /* tslint:disable max-line-length */
  it("should return 0 through `getFirstAvailablePosition` if the live edge was never set for a static content", () => {
  /* tslint:enable max-line-length */
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: false,
      timeShiftBufferDepth: 5,
    });
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(0);
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(0);
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(0);
  });

  /* tslint:disable max-line-length */
  it("should return 0 through `getFirstAvailablePosition` if the live edge was never set for a dynamic content with no timeShiftBufferDepth", () => {
  /* tslint:enable max-line-length */
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: false,
    });
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(0);
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(0);
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(0);
  });

  /* tslint:disable max-line-length */
  it("should return `false` through `lastPositionIsKnown` if `setLastPositionOffset` was never called", () => {
  /* tslint:enable max-line-length */
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: true,
      timeShiftBufferDepth: 5,
    });
    expect(bufferDepthCalculator.lastPositionIsKnown()).toEqual(false);
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(undefined);
    expect(bufferDepthCalculator.lastPositionIsKnown()).toEqual(false);
  });

  /* tslint:disable max-line-length */
  it("should return `true` through `lastPositionIsKnown` if `setLastPositionOffset` was called for a dynamic content", () => {
  /* tslint:enable max-line-length */
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: true,
      timeShiftBufferDepth: 5,
    });
    bufferDepthCalculator.setLastPositionOffset(1000);
    expect(bufferDepthCalculator.lastPositionIsKnown()).toEqual(true);
  });

  /* tslint:disable max-line-length */
  it("should return `true` through `lastPositionIsKnown` if `setLastPositionOffset` was called for a non dynamic content", () => {
  /* tslint:enable max-line-length */
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: false,
      timeShiftBufferDepth: 5,
    });
    bufferDepthCalculator.setLastPositionOffset(1000);
    expect(bufferDepthCalculator.lastPositionIsKnown()).toEqual(true);
  });

  /* tslint:disable max-line-length */
  it("should return how much time has elapsed through `getFirstAvailablePosition` since the live edge was set for a dynamic content", () => {
  /* tslint:enable max-line-length */
    let date = 5000;
    const performanceSpy = jest.spyOn(performance, "now")
      .mockImplementation(jest.fn(() => date));
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: true,
      timeShiftBufferDepth: 5,
    });
    bufferDepthCalculator.setLastPositionOffset(1000);
    date = 25000;
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(1010);
    date = 35000;
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(1020);
    performanceSpy.mockRestore();
  });

  /* tslint:disable max-line-length */
  it("should return 0 even when a last position has been set for a static content", () => {
  /* tslint:enable max-line-length */
    let date = 5000;
    const performanceSpy = jest.spyOn(performance, "now")
      .mockImplementation(jest.fn(() => date));
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: false,
      timeShiftBufferDepth: 5,
    });
    bufferDepthCalculator.setLastPositionOffset(1000);
    date = 25000;
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(0);
    date = 35000;
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(0);
    performanceSpy.mockRestore();
  });

  /* tslint:disable max-line-length */
  it("should authorize and handle multiple `setLastPositionOffset` calls for live contents", () => {
  /* tslint:enable max-line-length */
    let date = 5000;
    const performanceSpy = jest.spyOn(performance, "now")
      .mockImplementation(jest.fn(() => date));
    const bufferDepthCalculator = new BufferDepthCalculator({
      availabilityStartTime: 10,
      isDynamic: true,
      timeShiftBufferDepth: 5,
    });
    bufferDepthCalculator.setLastPositionOffset(1000);
    date = 50000;
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(1035);
    bufferDepthCalculator.setLastPositionOffset(0);
    date = 55000;
    expect(bufferDepthCalculator.getFirstAvailablePosition()).toEqual(40);
    performanceSpy.mockRestore();
  });
});
