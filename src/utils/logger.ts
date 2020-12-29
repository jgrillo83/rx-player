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

import noop from "./noop";

export type ILoggerLevel = "NONE" |
                           "ERROR" |
                           "WARNING" |
                           "INFO" |
                           "DEBUG";

type IConsoleFn = (...args : unknown[]) => void;

const DEFAULT_LOG_LEVEL : ILoggerLevel = "NONE";

/**
 * Logger implementation.
 * @class Logger
 */
export default class Logger {
  public error : IConsoleFn;
  public warn : IConsoleFn;
  public info : IConsoleFn;
  public debug : IConsoleFn;
  private _currentLevel : ILoggerLevel;
  private readonly _levels : Record<ILoggerLevel, number>;

  constructor() {
    this.error = noop;
    this.warn = noop;
    this.info = noop;
    this.debug = noop;
    this._levels = { NONE: 0,
                     ERROR: 1,
                     WARNING: 2,
                     INFO: 3,
                     DEBUG: 4 };
    this._currentLevel = DEFAULT_LOG_LEVEL;
  }

  /**
   * @param {string} levelStr
   */
  public setLevel(levelStr : string) : void {
    let level : number;
    const foundLevel = this._levels[levelStr as ILoggerLevel];
    if (typeof foundLevel === "number") {
      level = foundLevel;
      this._currentLevel = levelStr as ILoggerLevel;
    } else { // not found
      level = 0;
      this._currentLevel = "NONE";
    }

    /* eslint-disable no-invalid-this */
    /* eslint-disable no-console */
    this.error = (level >= this._levels.ERROR) ?
      (...args) => callLogFunction(console, "error", args) :
      noop;
    this.warn = (level >= this._levels.WARNING) ?
      (...args) => callLogFunction(console, "warn", args) :
      noop;
    this.info = (level >= this._levels.INFO) ?
      (...args) => callLogFunction(console, "info", args) :
      noop;
    this.debug = (level >= this._levels.DEBUG) ?
      (...args) => callLogFunction(console, "log", args) :
      noop;
    /* eslint-enable no-console */
    /* eslint-enable no-invalid-this */
  }

  /**
   * @returns {string}
   */
  public getLevel() : ILoggerLevel {
    return this._currentLevel;
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

function callLogFunction(
  consl : Console,
  method : "error" | "warn" | "info" | "log",
  args : unknown[]
) : void {
  if ((window as any).MEDIA_SOURCE !== undefined) {
    consl[method](performance.now(),
                  ...args,
                  (window as any).MEDIA_SOURCE.sourceBuffers.length,
                  (window as any).MEDIA_SOURCE.activeSourceBuffers.length);
  } else {
    consl[method](performance.now(), ...args);
  }
}
