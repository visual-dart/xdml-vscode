// @ts-ignore
import xmlfmt = require("../packages/xml2js");

const ESCAPE_DOUBLE = /"([^"]*([&]+)[^"]*)"/g;
const ESCAPE_SINGLE = /'([^']*([&]+)[^']*)'/g;

const DESCAPE = /"@\[([^&]*)\]"/g;

const PARSER = new xmlfmt.Parser(<any>{ strict: true, parseComments: true });
const BUILDER = new xmlfmt.Builder({});

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
  var formalText = text;
  formalText = text
    .replace(ESCAPE_DOUBLE, (_, matched) => {
      return `"@[${escape(matched)}]"`;
    })
    .replace(ESCAPE_SINGLE, (_, matched) => {
      return `"@[${escape(matched)}]"`;
    });
  const ast = await parseString(PARSER, formalText);
  return (BUILDER.buildObject(ast) as string).replace(
    DESCAPE,
    (_, matched) => `"${unescape(matched)}"`
  );
}
