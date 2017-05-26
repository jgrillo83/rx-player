import { expect } from "chai";
import {
 BufferedRanges,
} from "../ranges.js";

const {
 getRange,
 getGap,
 getLoaded,
 getSize,
} = new BufferedRanges();

function createRange(ranges) {
  return {
    length: ranges.length,
    start(i) { return ranges[i][0]; },
    end(i)   { return ranges[i][1]; },
  };
}

describe("ranges", function() {

  describe("getRange", function() {

    xit("is null from an empty range", function() {
      expect(getRange(0, createRange([]))).to.equal(null);
    });

    xit("is null if the timestamp is negative", function() {
      expect(getRange(-10, createRange([[11, 100]]))).to.equal(null);
    });

    xit("is null if no ranges are before", function() {
      expect(getRange(10, createRange([[11, 100]]))).to.equal(null);
    });

    xit("is the range containing the timestamp", function() {
      expect(getRange( 11, createRange([[11, 100]]))).to.eql({ start: 11, end: 100 });
      expect(getRange( 12, createRange([[11, 100]]))).to.eql({ start: 11, end: 100 });
      expect(getRange( 50, createRange([[11, 100]]))).to.eql({ start: 11, end: 100 });
      expect(getRange( 99, createRange([[11, 100]]))).to.eql({ start: 11, end: 100 });
      expect(getRange(100, createRange([[11, 100]]))).to.eql({ start: 11, end: 100 });
    });

    xit("is the range before the timestamp", function() {
      expect(getRange(101, createRange([[11, 100], [200, 300]]))).to.eql({ start: 11, end: 100 });
      expect(getRange(199, createRange([[11, 100], [200, 300]]))).to.eql({ start: 11, end: 100 });
      expect(getRange(301, createRange([[11, 100], [200, 300]]))).to.eql({ start: 200, end: 300 });
    });

  });

  describe("getGap", function() {

    xit("is +Infinity if no range is associated to timestamp", function() {
      expect(getGap(10, createRange([]))).to.equal(Infinity);
      expect(getGap(10, createRange([[11, 100]]))).to.equal(Infinity);
    });

    xit("is the difference between timestamp and the end of its range", function() {
      expect(getGap( 99, createRange([[11, 100], [200, 300]]))).to.equal(1);
      expect(getGap(101, createRange([[11, 100], [200, 300]]))).to.equal(-1);
    });

  });

  describe("getLoaded", function() {

    xit("is 0 if no range is associated to timestamp", function() {
      expect(getLoaded(10, createRange([]))).to.equal(0);
      expect(getLoaded(10, createRange([[11, 100]]))).to.equal(0);
    });

    xit("is the difference between timestamp and the start of its range", function() {
      expect(getLoaded( 99, createRange([[11, 100], [200, 300]]))).to.equal(88);
      expect(getLoaded(101, createRange([[11, 100], [200, 300]]))).to.equal(90);
    });

  });

  describe("getSize", function() {

    xit("is 0 if no range is associated to timestamp", function() {
      expect(getSize(10, createRange([]))).to.equal(0);
      expect(getSize(10, createRange([[11, 100]]))).to.equal(0);
    });

    xit("is the size of the range", function() {
      expect(getSize( 99, createRange([[11, 100], [200, 300]]))).to.equal(89);
      expect(getSize(200, createRange([[11, 100], [200, 300]]))).to.equal(100);
    });
  });

});

describe("BufferedRanges", function() {

  describe("intersect", function() {

    xit("intersects when no overlapping range", function() {
      const ranges = new BufferedRanges();

      ranges.insert("1", 0, 10);
      ranges.insert("1", 20, 30);

      expect(ranges.intersect([{ start: 20, end: 30 }])).to.eql([
        { start: 20, end: 30, bitrate: "1" },
      ]);
    });

    xit("intersects when smaller overlapping range", function() {
      const ranges = new BufferedRanges();

      ranges.insert("1", 0, 10);
      ranges.insert("1", 20, 30);
      ranges.insert("2", 30, 40);

      expect(ranges.intersect([
        { start: 0, end: 10 },
        { start: 25, end: 40 },
      ])).to.eql([
        { start: 0, end: 10, bitrate: "1" },
        { start: 25, end: 30, bitrate: "1" },
        { start: 30, end: 40, bitrate: "2" },
      ]);

      expect(ranges.intersect([
        { start: 0, end: 10 },
        { start: 30, end: 40 },
      ])).to.eql([
        { start: 0, end: 10, bitrate: "1" },
        { start: 30, end: 40, bitrate: "2" },
      ]);
    });

    xit("doest nothing with same ranges", function() {
      const ranges = new BufferedRanges();

      ranges.insert("1", 0, 10);
      ranges.insert("1", 20, 30);
      ranges.insert("2", 30, 40);

      expect(ranges.intersect([{ start: 0, end: 10 }, { start: 20, end: 40 }])).to.eql([
        { start: 0, end: 10, bitrate: "1" },
        { start: 20, end: 30, bitrate: "1" },
        { start: 30, end: 40, bitrate: "2" },
      ]);
    });
  });

});
