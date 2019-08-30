const prefixMatch = new RegExp(/(?!xmlns)^.*:/);

export function normalize(str: string): string {
  return str.toLowerCase();
}

export function firstCharLowerCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function stripPrefix(str: string): string {
  return str.replace(prefixMatch, "");
}

export function parseNumbers(str: string): number | string {
  if (!isNaN(<any>str)) {
    return <any>str % 1 === 0 ? parseInt(str, 10) : parseFloat(str);
  }
  return str;
}

export function parseBooleans(str: string): boolean | string {
  if (/^(?:true|false)$/i.test(str)) {
    return str.toLowerCase() === "true";
  }
  return str;
}
