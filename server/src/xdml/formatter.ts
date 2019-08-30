import { WriterOptions } from "xmlbuilder";
import { Parser, Builder } from "../packages/xml2js";
import { CustomWriter } from "./custom-writer";

const ESCAPE_DOUBLE = /"([^"]*([&]+)[^"]*)"/g;
const ESCAPE_SINGLE = /'([^']*([&]+)[^']*)'/g;

const DESCAPE = /"@\[([^\r\n&]*)\]"/g;

const DEFAULT_OPTIONS: WriterOptions = {
  pretty: true,
  indent: "  ",
  newline: "\n",
  width: 120
};

const PARSER = new Parser({ strict: true });
const BUILDER = new Builder({
  renderOpts: {
    ...DEFAULT_OPTIONS,
    writer: new CustomWriter({ splitAttrMoreThan: 3 })
  }
});

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

export async function formatXml(text: string) {
  try {
    let formalText = text;
    formalText = text
      .replace(ESCAPE_DOUBLE, (_, matched) => {
        return `"@[${escape(matched)}]"`;
      })
      .replace(ESCAPE_SINGLE, (_, matched) => {
        return `"@[${escape(matched)}]"`;
      });
    const ast = await parseString(PARSER, formalText);
    const result = BUILDER.buildObject(ast).replace(
      DESCAPE,
      (_, matched) => `"${unescape(matched)}"`
    );
    return result;
  } catch (error) {
    throw error;
  }
}
