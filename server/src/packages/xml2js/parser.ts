import sax = require("sax");
import events = require("events");
import processors = require("./processors");
import timers = require("timers");

import { DEFAULTS, Options } from "./defaults";
import { stripBOM } from "./bom";

interface ISaxParser extends sax.SAXParser {
  errThrown?: boolean;
  ended?: boolean;
}

const hasProp = {}.hasOwnProperty;

function isEmpty(thing: any) {
  return (
    typeof thing === "object" &&
    thing !== null &&
    Object.keys(thing).length === 0
  );
}

function processItem(
  processors: ((item: any, key: any) => any)[],
  item: any,
  key?: any
) {
  for (let i = 0, len = processors.length; i < len; i++) {
    const process = processors[i];
    item = process(item, key);
  }
  return item;
}

export class Parser extends events.EventEmitter {
  private options!: Options;
  private remaining!: string;
  private saxParser!: ISaxParser;
  private resultObject!: any;

  private stack: any[] = [];
  private comments: any[] = [];

  private get attrKey() {
    return this.options.attrkey;
  }

  private get charKey() {
    return this.options.charkey;
  }

  private get commentsKey() {
    return this.options.commentskey;
  }

  private get explicitCharkey() {
    return this.options.explicitCharkey;
  }

  constructor(opts: Partial<Options>) {
    super();
    this.options = <any>{};
    const ref = DEFAULTS;
    for (const key in ref) {
      if (!hasProp.call(ref, key)) {
        continue;
      }
      const value = ref[key];
      this.options[key] = value;
    }
    for (const key in opts) {
      if (!hasProp.call(opts, key)) {
        continue;
      }
      const value = opts[key];
      this.options[key] = value;
    }
    if (this.options.xmlns) {
      this.options.xmlnskey = this.options.attrkey + "ns";
    }
    if (this.options.normalizeTags) {
      if (!this.options.tagNameProcessors) {
        this.options.tagNameProcessors = [];
      }
      this.options.tagNameProcessors.unshift(processors.normalize);
    }
    this.reset();
  }

  processAsync() {
    try {
      if (this.remaining.length <= this.options.chunkSize) {
        const chunk = this.remaining;
        this.remaining = "";
        this.saxParser = this.saxParser.write(chunk);
        return this.saxParser.close();
      } else {
        const chunk = this.remaining.substr(0, this.options.chunkSize);
        this.remaining = this.remaining.substr(
          this.options.chunkSize,
          this.remaining.length
        );
        this.saxParser = this.saxParser.write(chunk);
        return timers.setImmediate(this.processAsync);
      }
    } catch (error1) {
      const err = error1;
      if (!this.saxParser.errThrown) {
        this.saxParser.errThrown = true;
        return this.emit(err);
      }
    }
  }

  assignOrPush(obj: any, key: string, newValue: any) {
    if (!(key in obj)) {
      if (!this.options.explicitArray) {
        return (obj[key] = newValue);
      } else {
        return (obj[key] = [newValue]);
      }
    } else {
      if (!(obj[key] instanceof Array)) {
        obj[key] = [obj[key]];
      }
      return obj[key].push(newValue);
    }
  }

  onError(error: any) {
    this.saxParser.resume();
    if (!this.saxParser.errThrown) {
      this.saxParser.errThrown = true;
      return this.emit("error", error);
    }
  }

  onEnd() {
    if (!this.saxParser.ended) {
      this.saxParser.ended = true;
      return this.emit("end", this.resultObject);
    }
  }

  onOpenTag(node: sax.Tag | sax.QualifiedTag) {
    const obj: any = {};
    obj[this.charKey] = "";
    if (!this.options.ignoreAttrs) {
      const ref = node.attributes;
      for (const key in ref) {
        if (!hasProp.call(ref, key)) {
          continue;
        }
        if (!(this.attrKey in obj) && !this.options.mergeAttrs) {
          obj[this.attrKey] = {};
        }
        const newValue = this.options.attrValueProcessors
          ? processItem(
              this.options.attrValueProcessors,
              node.attributes[key],
              key
            )
          : node.attributes[key];
        const processedKey = this.options.attrNameProcessors
          ? processItem(this.options.attrNameProcessors, key)
          : key;
        if (this.options.mergeAttrs) {
          this.assignOrPush(obj, processedKey, newValue);
        } else {
          obj[this.attrKey][processedKey] = newValue;
        }
      }
    }
    obj["#name"] = this.options.tagNameProcessors
      ? processItem(this.options.tagNameProcessors, node.name)
      : node.name;
    if (this.options.xmlns) {
      obj[this.options.xmlnskey] = {
        uri: (<any>node).uri,
        local: (<any>node).local
      };
    }
    obj[this.commentsKey] = this.comments;
    this.comments = [];
    return this.stack.push(obj);
  }

  onCloseTag() {
    let obj = this.stack.pop();
    const nodeName = obj["#name"];
    if (!this.options.explicitChildren || !this.options.preserveChildrenOrder) {
      delete obj["#name"];
    }
    let cdata: any;
    if (obj.cdata === true) {
      cdata = obj.cdata;
      delete obj.cdata;
    }
    const s = this.stack[this.stack.length - 1];
    let emptyStr: string;
    if (obj[this.charKey].match(/^\s*$/) && !cdata) {
      emptyStr = obj[this.charKey];
      delete obj[this.charKey];
    } else {
      if (this.options.trim) {
        obj[this.charKey] = obj[this.charKey].trim();
      }
      if (this.options.normalize) {
        obj[this.charKey] = obj[this.charKey].replace(/\s{2,}/g, " ").trim();
      }
      obj[this.charKey] = this.options.valueProcessors
        ? processItem(this.options.valueProcessors, obj[this.charKey], nodeName)
        : obj[this.charKey];
      if (
        Object.keys(obj).length === 1 &&
        this.charKey in obj &&
        !this.explicitCharkey
      ) {
        obj = obj[this.charKey];
      }
    }
    if (isEmpty(obj)) {
      obj = this.options.emptyTag !== "" ? this.options.emptyTag : emptyStr!;
    }
    if (this.options.validator !== null) {
      const xpath =
        "/" +
        (() => {
          const results: any[] = [];
          for (let i = 0, len = this.stack.length; i < len; i++) {
            const node = this.stack[i];
            results.push(node["#name"]);
          }
          return results;
        })()
          .concat(nodeName)
          .join("/");
      (() => {
        try {
          return (obj = this.options.validator(xpath, s && s[nodeName], obj));
        } catch (error1) {
          const err = error1;
          return this.emit("error", err);
        }
      })();
    }
    if (
      this.options.explicitChildren &&
      !this.options.mergeAttrs &&
      typeof obj === "object"
    ) {
      if (!this.options.preserveChildrenOrder) {
        const node = {};
        if (this.options.attrkey in obj) {
          node[this.options.attrkey] = obj[this.options.attrkey];
          delete obj[this.options.attrkey];
        }
        if (!this.options.charsAsChildren && this.options.charkey in obj) {
          node[this.options.charkey] = obj[this.options.charkey];
          delete obj[this.options.charkey];
        }
        if (Object.getOwnPropertyNames(obj).length > 0) {
          node[this.options.childkey] = obj;
        }
        obj = node;
      } else if (s) {
        s[this.options.childkey] = s[this.options.childkey] || [];
        const objClone = {};
        for (const key in obj) {
          if (!hasProp.call(obj, key)) {
            continue;
          }
          objClone[key] = obj[key];
        }
        s[this.options.childkey].push(objClone);
        delete obj["#name"];
        if (
          Object.keys(obj).length === 1 &&
          this.charKey in obj &&
          !this.explicitCharkey
        ) {
          obj = obj[this.charKey];
        }
      }
    }
    if (this.stack.length > 0) {
      return this.assignOrPush(s, nodeName, obj);
    } else {
      if (this.options.explicitRoot) {
        const old = obj;
        obj = {};
        obj[nodeName] = old;
      }
      this.resultObject = obj;
      this.saxParser.ended = true;
      return this.emit("end", this.resultObject);
    }
  }

  onText(text: string) {
    const s = this.stack[this.stack.length - 1];
    if (s) {
      s[this.charKey] += text;
      if (
        this.options.explicitChildren &&
        this.options.preserveChildrenOrder &&
        this.options.charsAsChildren &&
        (this.options.includeWhiteChars ||
          text.replace(/\\n/g, "").trim() !== "")
      ) {
        s[this.options.childkey] = s[this.options.childkey] || [];
        const charChild = {
          "#name": "__text__"
        };
        charChild[this.charKey] = text;
        if (this.options.normalize) {
          charChild[this.charKey] = charChild[this.charKey]
            .replace(/\s{2,}/g, " ")
            .trim();
        }
        s[this.options.childkey].push(charChild);
      }
      return s;
    }
  }

  onCDATA(text: string) {
    const s = this.onText(text);
    if (s) {
      return (s.cdata = true);
    }
  }

  onComment(text: string) {
    this.comments.push(text);
  }

  reset() {
    this.removeAllListeners();
    this.saxParser = sax.parser(this.options.strict, {
      trim: false,
      normalize: false,
      xmlns: this.options.xmlns
    });
    this.saxParser.errThrown = false;
    this.saxParser.onerror = this.onError.bind(this);
    this.saxParser.onend = this.onEnd.bind(this);
    this.saxParser.ended = false;
    this.resultObject = null;
    this.stack = [];
    this.comments = [];
    this.saxParser.onopentag = this.onOpenTag.bind(this);
    this.saxParser.onclosetag = this.onCloseTag.bind(this);
    this.saxParser.ontext = this.onText.bind(this);
    this.saxParser.oncdata = this.onCDATA.bind(this);
    this.saxParser.oncomment = this.onComment.bind(this);
  }

  parseString(str: string, cb: (error: any, result?: any) => void) {
    if (cb !== null && typeof cb === "function") {
      this.on("end", result => {
        this.reset();
        return cb(null, result);
      });
      this.on("error", err => {
        this.reset();
        return cb(err);
      });
    }
    try {
      str = str.toString();
      if (str.trim() === "") {
        this.emit("end", null);
        return true;
      }
      str = stripBOM(str);
      if (this.options.async) {
        this.remaining = str;
        timers.setImmediate(this.processAsync);
        return this.saxParser;
      }
      return this.saxParser.write(str).close();
    } catch (error1) {
      const err = error1;
      if (!(this.saxParser.errThrown || this.saxParser.ended)) {
        this.emit("error", err);
        return (this.saxParser.errThrown = true);
      } else if (this.saxParser.ended) {
        throw err;
      }
    }
  }
}

export function parseString(str: string, a: any, b: Function | null) {
  let cb: Function;
  let options: any;
  if (b !== null) {
    if (typeof b === "function") {
      cb = b;
    }
    if (typeof a === "object") {
      options = a;
    }
  } else {
    if (typeof a === "function") {
      cb = a;
    }
    options = {};
  }
  const parser = new exports.Parser(options);
  return parser.parseString(str, cb!);
}
