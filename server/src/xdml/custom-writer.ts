import { WriterOptions, XMLElement, nodeType, writerState } from "xmlbuilder";
import XMLStringWriter = require("xmlbuilder/lib/XMLStringWriter");

const hasProp = {}.hasOwnProperty;

const WriterState = writerState;
const NodeType = nodeType;

export interface ICustomOptions extends WriterOptions {
  splitAttrMoreThan?: number;
}

export class CustomWriter extends XMLStringWriter {
  constructor(private opts: ICustomOptions = { splitAttrMoreThan: 1024 }) {
    super();
  }

  element(
    this: XMLStringWriter,
    node: XMLElement,
    options: ICustomOptions,
    level: number
  ) {
    const opts: ICustomOptions = {
      ...options,
      ...(<any>this).opts
    };
    level = level || 0;
    let prettySuppressed = false;
    // open tag
    this.openNode(node, opts, level);
    opts.state = WriterState.OpenTag;
    let r = this.indent(node, opts, level) + "<" + node.name;
    // attributes
    let shouldSplit = false;
    let beforeClose = "";
    if (opts.pretty && opts!.width! > 0) {
      let len = r.length;
      let ref = node.attribs;
      const attrsLen = Object.keys(ref).length;
      shouldSplit = attrsLen >= (opts.splitAttrMoreThan || 1024);
      if (shouldSplit) {
        beforeClose = opts.newline + this.indent(node, options, level);
      }
      for (const name in ref) {
        if (!hasProp.call(ref, name)) {
          continue;
        }
        const att = ref[name];
        const ratt = this.attribute(att, opts, level);
        const attLen = ratt.length;
        if (shouldSplit || len + attLen > opts!.width!) {
          const rline = this.indent(node, opts, level + 1) + ratt;
          r += this.endline(node, opts, level) + rline;
          len = rline.length;
        } else {
          const rline = " " + ratt;
          r += rline;
          len += rline.length;
        }
      }
    } else {
      const ref1 = node.attribs;
      for (const name in ref1) {
        if (!hasProp.call(ref1, name)) {
          continue;
        }
        const att = ref1[name];
        r += this.attribute(att, opts, level);
      }
    }
    const childNodeCount = node.children.length;
    const firstChildNode = childNodeCount === 0 ? null : node.children[0];
    if (
      childNodeCount === 0 ||
      node.children.every(function(e) {
        return (
          (e.type === NodeType.Text || e.type === NodeType.Raw) &&
          (<any>e).value === ""
        );
      })
    ) {
      // empty element
      if (opts.allowEmpty) {
        r += ">";
        opts.state = WriterState.CloseTag;
        r += "</" + node.name + ">" + this.endline(node, opts, level);
      } else {
        opts.state = WriterState.CloseTag;
        r += opts.spaceBeforeSlash + "/>" + this.endline(node, opts, level);
      }
    } else if (
      opts.pretty &&
      childNodeCount === 1 &&
      (firstChildNode!.type === NodeType.Text ||
        firstChildNode!.type === NodeType.Raw) &&
      (<any>firstChildNode)!.value !== null
    ) {
      // do not indent text-only nodes
      r += shouldSplit ? beforeClose + ">" : ">";
      opts.state = WriterState.InsideTag;
      (<any>opts).suppressPrettyCount++;
      prettySuppressed = true;
      r += this.writeChildNode(firstChildNode!, opts, level + 1);
      (<any>opts).suppressPrettyCount--;
      prettySuppressed = false;
      opts.state = WriterState.CloseTag;
      r += "</" + node.name + ">" + this.endline(node, opts, level);
    } else {
      // if ANY are a text node, then suppress pretty now
      if (opts.dontPrettyTextNodes) {
        const ref2 = node.children;
        for (let i = 0, len1 = ref2.length; i < len1; i++) {
          const child = ref2[i];
          if (
            (child.type === NodeType.Text || child.type === NodeType.Raw) &&
            (<any>child).value !== null
          ) {
            (<any>opts).suppressPrettyCount++;
            prettySuppressed = true;
            break;
          }
        }
      }
      // close the opening tag, after dealing with newline
      r +=
        (shouldSplit ? beforeClose + ">" : ">") +
        this.endline(node, opts, level);
      opts.state = WriterState.InsideTag;
      const ref3 = node.children;
      // inner tags
      for (let j = 0, len2 = ref3.length; j < len2; j++) {
        const child = ref3[j];
        r += this.writeChildNode(child, opts, level + 1);
      }
      // close tag
      opts.state = WriterState.CloseTag;
      r += this.indent(node, opts, level) + "</" + node.name + ">";
      if (prettySuppressed) {
        (<any>opts).suppressPrettyCount--;
      }
      r += this.endline(node, opts, level);
      opts.state = WriterState.None;
    }
    this.closeNode(node, opts, level);
    return r + (level <= 1 ? opts.newline! : "");
  }
}
