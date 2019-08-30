import builder = require("xmlbuilder");
import { DEFAULTS, Options } from "./defaults";

const CONVERT_COMMENT = "CONVERT#COMMENT#KEY";
const CONVERT_TEXT = "CONVERT#TEXT#KEY";
const CONVERT_CDATA = "CONVERT#CDATA#KEY";
const CONVERT_RAW = "CONVERT#RAW#KEY";
const CONVERT_PI = "CONVERT#PI#KEY";

const hasProp = {}.hasOwnProperty;

function requiresCDATA(entry: any) {
  return (
    typeof entry === "string" &&
    (entry.indexOf("&") >= 0 ||
      entry.indexOf(">") >= 0 ||
      entry.indexOf("<") >= 0)
  );
}

function wrapCDATA(entry: string) {
  return "<![CDATA[" + escapeCDATA(entry) + "]]>";
}

function escapeCDATA(entry: string) {
  return entry.replace("]]>", "]]]]><![CDATA[>");
}

function hasKey(target: any, key: string) {
  return hasProp.call(target, key);
}

export class Builder {
  private options!: Options;

  get attrkey() {
    return this.options.attrkey;
  }

  get charkey() {
    return this.options.charkey;
  }

  get commentskey() {
    return this.options.commentskey;
  }

  constructor(opts: Partial<Options>) {
    this.options = <any>{};
    const ref = DEFAULTS;
    for (let key in ref) {
      if (!hasKey(ref, key)) {
        continue;
      }
      this.options[key] = ref[key];
    }
    for (let key in opts) {
      if (!hasKey(opts, key)) {
        continue;
      }
      this.options[key] = opts[key];
    }
  }

  private _render(element: builder.XMLElement, obj: any) {
    if (typeof obj !== "object") {
      if (this.options.cdata && requiresCDATA(obj)) {
        return element.raw(wrapCDATA(obj));
      }
      return element.txt(obj);
    }

    // 多个root
    if (Array.isArray(obj)) {
      for (let child of obj) {
        for (let key in child) {
          const entry = child[key];
          element = this._render(element.ele(key), entry).up();
        }
      }
      return element;
    }

    const keys = Object.keys(obj);
    const commentIndex = keys.indexOf(this.commentskey);
    if (commentIndex >= 0) {
      const child = obj[this.commentskey];
      for (let value of child) {
        element.commentBefore(value.trim());
      }
    }

    const otherKeys = keys.filter(i => i !== this.commentskey);
    for (const key of otherKeys) {
      if (!hasKey(obj, key)) {
        continue;
      }
      let child = obj[key];
      if (key === this.attrkey) {
        if (typeof child === "object") {
          for (let attr in child) {
            const value = child[attr];
            element = element.att(attr, value);
          }
        }
        continue;
      }

      if (key === this.charkey) {
        if (this.options.cdata && requiresCDATA(child)) {
          element = element.raw(wrapCDATA(child));
        } else {
          element = element.txt(child);
        }
        continue;
      }

      if (Array.isArray(child)) {
        for (let index in child) {
          if (!hasKey(child, index)) {
            continue;
          }
          const entry = child[index];
          if (typeof entry === "string") {
            if (this.options.cdata && requiresCDATA(entry)) {
              element = element
                .ele(key)
                .raw(wrapCDATA(entry))
                .up();
            } else {
              element = element.ele(key, entry).up();
            }
          } else {
            element = this._render(element.ele(key), entry).up();
          }
        }
        continue;
      }

      if (typeof child === "object") {
        element = this._render(element.ele(key), child).up();
        continue;
      }

      if (
        typeof child === "string" &&
        this.options.cdata &&
        requiresCDATA(child)
      ) {
        element = element
          .ele(key)
          .raw(wrapCDATA(child))
          .up();
      } else {
        if (child === null) {
          child = "";
        }
        element = element.ele(key, child.toString()).up();
      }
    }

    return element;
  }

  buildObject(rootObj: any) {
    let rootElement: builder.XMLElement;
    let rootName: string;
    if (
      Object.keys(rootObj).length === 1 &&
      this.options.rootName === DEFAULTS.rootName
    ) {
      rootName = Object.keys(rootObj)[0];
      rootObj = rootObj[rootName];
    } else {
      rootName = this.options.rootName;
    }
    rootElement = builder.create(
      rootName,
      this.options.xmldec,
      this.options.doctype,
      {
        headless: this.options.headless,
        ignoreDecorators: false,
        stringify: {
          convertTextKey: CONVERT_TEXT,
          convertCDataKey: CONVERT_CDATA,
          convertCommentKey: CONVERT_COMMENT,
          convertRawKey: CONVERT_RAW,
          convertPIKey: CONVERT_PI
        }
      }
    );
    try {
      return this._render(rootElement, rootObj).end(this.options.renderOpts);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
