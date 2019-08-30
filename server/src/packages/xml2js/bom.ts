export function stripBOM(str: any) {
  if (str[0] === "\uFEFF") {
    return str.substring(1);
  } else {
    return str;
  }
}
