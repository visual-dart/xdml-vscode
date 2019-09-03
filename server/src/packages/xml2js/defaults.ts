import { WriterOptions } from "xmlbuilder";

export interface Options {
  async: boolean;
  attrkey: string;
  attrNameProcessors: Array<(name: string) => any> | null;
  attrValueProcessors: Array<(value: string, name: string) => any> | null;
  charkey: string;
  charsAsChildren: boolean;
  childkey: string;
  emptyTag: any;
  explicitArray: boolean;
  explicitCharkey: boolean;
  explicitChildren: boolean;
  explicitRoot: boolean;
  ignoreAttrs: boolean;
  includeWhiteChars: boolean;
  mergeAttrs: boolean;
  normalize: boolean;
  normalizeTags: boolean;
  strict: boolean;
  tagNameProcessors: Array<(name: string) => any> | null;
  trim: boolean;
  validator: Function | null;
  valueProcessors: Array<(value: string, name: string) => any> | null;
  xmlns: boolean;
  preserveChildrenOrder: boolean;
  rootName: string;
  xmldec: {
    version: string;
    encoding: string;
    standalone: boolean;
  };
  doctype: any;
  renderOpts: Partial<WriterOptions>;
  headless: boolean;
  chunkSize: number;
  cdata: boolean;
  commentskey: string;
  xmlnskey: string;
}

export const DEFAULTS: Options = {
  explicitCharkey: false,
  trim: false,
  normalize: false,
  normalizeTags: false,
  attrkey: "$",
  charkey: "_",
  xmlnskey: "",
  commentskey: "$comments",
  explicitArray: true,
  ignoreAttrs: false,
  mergeAttrs: false,
  explicitRoot: true,
  validator: null,
  xmlns: false,
  explicitChildren: false,
  preserveChildrenOrder: false,
  childkey: "$$",
  charsAsChildren: false,
  includeWhiteChars: false,
  async: false,
  strict: true,
  attrNameProcessors: null,
  attrValueProcessors: null,
  tagNameProcessors: null,
  valueProcessors: null,
  rootName: "root",
  xmldec: {
    version: "1.0",
    encoding: "UTF-8",
    standalone: true
  },
  doctype: null,
  renderOpts: {},
  headless: false,
  chunkSize: 10000,
  emptyTag: "",
  cdata: false
};
