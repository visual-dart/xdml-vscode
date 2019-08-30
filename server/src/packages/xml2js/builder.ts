const hasProp = {}.hasOwnProperty;

import builder = require("xmlbuilder");
import { DEFAULTS } from "./defaults";

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

export const Builder = (function() {
  function Builder(this: any, opts) {
    var key, ref, value;
    this.options = {};
    ref = DEFAULTS["0.2"];
    for (key in ref) {
      if (!hasProp.call(ref, key)) {
        continue;
      }
      value = ref[key];
      this.options[key] = value;
    }
    for (key in opts) {
      if (!hasProp.call(opts, key)) {
        continue;
      }
      value = opts[key];
      this.options[key] = value;
    }
  }

  Builder.prototype.buildObject = function(rootObj) {
    var attrkey, charkey, commentskey, render, rootElement, rootName;
    attrkey = this.options.attrkey;
    charkey = this.options.charkey;
    commentskey = this.options.commentskey;
    if (
      Object.keys(rootObj).length === 1 &&
      this.options.rootName === DEFAULTS["0.2"].rootName
    ) {
      rootName = Object.keys(rootObj)[0];
      rootObj = rootObj[rootName];
    } else {
      rootName = this.options.rootName;
    }
    render = (function(_this) {
      return function(element, obj) {
        var attr, child, entry, i, len, index, key, value;
        if (typeof obj !== "object") {
          if (_this.options.cdata && requiresCDATA(obj)) {
            element.raw(wrapCDATA(obj));
          } else {
            element.txt(obj);
          }
        } else if (Array.isArray(obj)) {
          for (index in obj) {
            if (!hasProp.call(obj, index)) {
              continue;
            }
            child = obj[index];
            for (key in child) {
              entry = child[key];
              element = render(element.ele(key), entry).up();
            }
          }
        } else {
          for (key in obj) {
            if (!hasProp.call(obj, key)) {
              continue;
            }
            child = obj[key];
            if (key === attrkey) {
              if (typeof child === "object") {
                for (attr in child) {
                  value = child[attr];
                  element = element.att(attr, value);
                }
              }
            } else if (key === charkey) {
              if (_this.options.cdata && requiresCDATA(child)) {
                element = element.raw(wrapCDATA(child));
              } else {
                element = element.txt(child);
              }
            } else if (key === commentskey) {
              for (i = 0, len = child.length; i < len; i++) {
                value = child[i];
                element = element.comment(value);
              }
            } else if (Array.isArray(child)) {
              for (index in child) {
                if (!hasProp.call(child, index)) {
                  continue;
                }
                entry = child[index];
                if (typeof entry === "string") {
                  if (_this.options.cdata && requiresCDATA(entry)) {
                    element = element
                      .ele(key)
                      .raw(wrapCDATA(entry))
                      .up();
                  } else {
                    element = element.ele(key, entry).up();
                  }
                } else {
                  element = render(element.ele(key), entry).up();
                }
              }
            } else if (typeof child === "object") {
              element = render(element.ele(key), child).up();
            } else {
              if (
                typeof child === "string" &&
                _this.options.cdata &&
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
          }
        }
        return element;
      };
    })(this);
    rootElement = builder.create(
      rootName,
      this.options.xmldec,
      this.options.doctype,
      <any>{
        headless: this.options.headless,
        allowSurrogateChars: this.options.allowSurrogateChars
      }
    );
    return render(rootElement, rootObj).end(this.options.renderOpts);
  };

  return Builder;
})();