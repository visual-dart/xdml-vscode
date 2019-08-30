const hasProp = {}.hasOwnProperty;

import builder = require("xmlbuilder");
import { DEFAULTS, Options } from "./defaults";

const requiresCDATA = function(entry) {
  return (
    typeof entry === "string" &&
    (entry.indexOf("&") >= 0 ||
      entry.indexOf(">") >= 0 ||
      entry.indexOf("<") >= 0)
  );
};

const wrapCDATA = function(entry) {
  return "<![CDATA[" + escapeCDATA(entry) + "]]>";
};

const escapeCDATA = function(entry) {
  return entry.replace("]]>", "]]]]><![CDATA[>");
};

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
      if (!hasProp.call(ref, key)) {
        continue;
      }
      this.options[key] = ref[key];
    }
    for (let key in opts) {
      if (!hasProp.call(opts, key)) {
        continue;
      }
      this.options[key] = opts[key];
    }
  }

  private _render(element: builder.XMLElementOrXMLNode, obj: any) {
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

    for (let key in obj) {
      if (!hasProp.call(obj, key)) {
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

      if (key === this.commentskey) {
        for (let value of child) {
          element = element.comment(value);
        }
        continue;
      }

      if (Array.isArray(child)) {
        for (let index in child) {
          if (!hasProp.call(child, index)) {
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
    {
      let rootElement: builder.XMLElementOrXMLNode;
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
        <any>{
          headless: this.options.headless,
          allowSurrogateChars: (<any>this.options).allowSurrogateChars
        }
      );
      return this._render(rootElement, rootObj).end(this.options.renderOpts);
    }
  }
}
