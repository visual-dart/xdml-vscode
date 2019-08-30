import { TextDocument, Position } from "vscode-languageserver";

const XDML = "https://github.com/visual-dart/xdml/wiki/xdml";

const NAMESPACE_REGEXP = /xmlns:([\w-_.]+)\s*=\s*((\"([^\"\r\n]+)\")|(\'([^\'\r\n]+)\'))(\r|\r\n)*/g;

const PRE_ENTITY_REGEXP = /(\s|\r\n|\n|<|<\/){1}([\w-_\.:]*)$/;
const NEXT_ENTITY_REGEXP = /^([\w-_\.:]*)(\s|\r\n|\n)*(=)?/;

export enum ElementType {
  DartClass,
  DartFactory,
  DartProperty,
  XDMLVirtualVariable,
  XDMLNode,
  XDMLAttr,
  NamespaceAttrDefine,
  Token
}

interface IMetaPointKV {
  k: string;
  v: string;
}

export interface IEntityElementMetaInfo {
  ns?: string;
  nsUri?: string;
  name: string;
  type: ElementType;
  metainfo: {
    pointList: IMetaPointKV[];
  };
}

function getDocumentNamespaces(doc: TextDocument): { [ns: string]: string } {
  const namespaces: any = {};
  const text = doc.getText();

  text.replace(NAMESPACE_REGEXP, (...args) => {
    const ns = args[1];
    const nsUrl = args[4] || args[7];
    namespaces[ns] = nsUrl;
    return "";
  });
  return namespaces;
}

export function getCurrentEntityInfos(
  doc: TextDocument,
  position: Position
): IEntityElementMetaInfo | null {
  const namespaces = getDocumentNamespaces(doc);

  const text = doc.getText();
  const currentIndex = doc.offsetAt(position);

  const preContent = text.substring(0, currentIndex);
  const afterContent = text.substr(currentIndex);

  const preResult = PRE_ENTITY_REGEXP.exec(preContent);
  if (!preResult) {
    return null;
  }
  const isClass = preResult[1] === "<" || preResult[1] === "</";
  const preValue = preResult[2];

  const nextResult = NEXT_ENTITY_REGEXP.exec(afterContent);
  if (!nextResult) {
    return null;
  }
  const nextValue = nextResult[1];
  const isAttr = nextResult[3] === "=";

  const entityName = `${preValue}${nextValue}`;
  const hasNs = entityName.indexOf(":") > 0;
  const ns = hasNs ? entityName.split(":")[0] : undefined;
  const name = hasNs ? entityName.split(":")[1] : entityName;
  const isFactory = name.indexOf(".") >= 0;
  const nsUri = namespaces[ns!];
  const internal = nsUri === XDML;
  const xmlns = ns === "xmlns";
  const points: IMetaPointKV[] = [];
  const eleType = isClass
    ? internal
      ? isFactory
        ? ElementType.XDMLVirtualVariable
        : ElementType.XDMLNode
      : isFactory
      ? ElementType.DartFactory
      : ElementType.DartClass
    : isAttr
    ? xmlns
      ? ElementType.NamespaceAttrDefine
      : internal
      ? ElementType.XDMLAttr
      : ElementType.DartProperty
    : ElementType.Token;

  if (!!nsUri) {
    points.push({ k: "import", v: nsUri });
  }

  if (eleType === ElementType.NamespaceAttrDefine) {
    points.push({ k: "src", v: namespaces[name] });
  }

  return {
    name,
    ns,
    nsUri,
    type: eleType,
    metainfo: {
      pointList: points
    }
  };
}
