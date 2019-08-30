import { Builder } from "./builder";
import { parseString, Parser } from "./parser";
import { DEFAULTS, Options } from "./defaults";
import processors = require("./processors");

export class ValidationError extends Error {
  constructor(public message: any) {
    super();
  }
}

export {
  processors,
  parseString,
  Parser,
  Builder,
  Options,
  DEFAULTS as defaults
};
