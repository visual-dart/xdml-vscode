import { WriterOptions } from "xmlbuilder";
import { Parser, Builder } from "../packages/xml2js";
import { CustomWriter } from "./custom-writer";

type FormatterRecover = [RegExp, (matched: string, ...args: any[]) => string];

export interface IFormatOptions {
  indent?: "whitespace" | "tab";
  indentSize?: 1 | 2 | 4;
  lineWidth?: number;
}

const PARSER = new Parser({ strict: true });
const DEFAULT_FMT_OPTS: IFormatOptions = {
  indent: "whitespace",
  indentSize: 2,
  lineWidth: 120
};
const DEFAULT_OPTIONS: WriterOptions = {
  pretty: true,
  indent: "  ",
  newline: "\n",
  width: 120
};

async function parseString(parser: any, text: string) {
  return new Promise((resolve, reject) => {
    parser.parseString(text, (error: any, result: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

export async function formatXml(text: string, options: IFormatOptions = {}) {
  try {
    const formatters = createFormatterRules();
    const recovers = createRecoverRules();
    const ast = await parseString(PARSER, replaceAll(text, formatters));
    const builder = new Builder({ renderOpts: readOptions(options) });
    return replaceAll(builder.buildObject(ast), recovers);
  } catch (error) {
    throw error;
  }
}

function createFormatterRules(): Array<FormatterRecover> {
  const rules: FormatterRecover[] = [];
  // 编码非法格式内容
  rules.push([
    /"([^"]*([&]+)[^"]*)"/g,
    (_, matched) => `"@[${escape(matched)}]"`
  ]);
  // 编码非法格式内容
  rules.push([
    /'([^']*([&]+)[^']*)'/g,
    (_, matched) => `"@[${escape(matched)}]"`
  ]);
  return rules;
}

function createRecoverRules(): Array<FormatterRecover> {
  const rules: FormatterRecover[] = [];
  // 恢复非法字符编码内容
  rules.push([/"@\[([^\r\n&]*)\]"/g, (_, matched) => `"${unescape(matched)}"`]);
  // 格式化单行插值表达式
  rules.push([
    /("|>)\s*({{\s*([^{}"\r\n]*?)\s*}})\s*("|<)/g,
    (_, s0, __, s2, s3) => `${s0}{{ ${s2} }}${s3}`
  ]);
  return rules;
}

function replaceAll(value: string, recovers: FormatterRecover[]) {
  recovers.forEach(([r, f]) => (value = value.replace(r, f)));
  return value;
}

function readOptions(options: IFormatOptions): WriterOptions {
  const o = { ...DEFAULT_FMT_OPTS, ...options };
  let p = "";
  if (o.indent === "whitespace") {
    p = " ";
  } else {
    p = "\t";
  }
  let idt = "";
  for (let i = 0; i < o.indentSize!; i++) {
    idt += p;
  }
  return {
    ...DEFAULT_OPTIONS,
    indent: idt,
    width: o.lineWidth!,
    writer: new CustomWriter({ splitAttrMoreThan: 3 })
  };
}
