import { Builder } from "./builder";
import { parseString, Parser } from "./parser";
import { DEFAULTS } from "./defaults";
import processors = require("./processors");

export class ValidationError extends Error {
  constructor(public message: any) {
    super();
  }
}

export { processors, parseString, Parser, Builder, DEFAULTS as defaults };
