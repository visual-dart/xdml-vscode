// @ts-ignore
import xmlfmt = require("../packages/xml2js");

const ESCAPE_DOUBLE = /"([^"]*([&]+)[^"]*)"/g;
const ESCAPE_SINGLE = /'([^']*([&]+)[^']*)'/g;

const DESCAPE = /"@\[([^&]*)\]"/g;

const PARSER = new xmlfmt.Parser({ strict: true });
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
    console.log("parsed.");
    console.log(ast);
    const result = BUILDER.buildObject(ast).replace(
      DESCAPE,
      (_, matched) => `"${unescape(matched)}"`
    );
    return result;
  } catch (error) {
    throw error;
  }
}
