import { TextDocument, Position } from "vscode-languageserver";

const XDML = "https://github.com/visual-dart/xdml/wiki/xdml";
const BIND = "https://github.com/visual-dart/xdml/wiki/bind";

const NAMESPACE_REGEXP = /xmlns:([\w-_.]+)\s*=\s*((\"([^\"\r\n]+)\")|(\'([^\'\r\n]+)\'))(\r|\r\n)*/g;
const PRE_ENTITY_REGEXP = /(\s|\r\n|\n|<|<\/){1}([\w-_\.:]*)$/;
const NEXT_ENTITY_REGEXP = /^([\w-_\.:]*)(\s|\r\n|\n)*(=)?/;
const PRE_INSERT_REGEXP = /="\s*{{\s*([\w_\.]*)$/;
const NEXT_INSERT_REGEXP = /^([\w_\.]*)\s*}}".*/;
const HOST_TAG_REGEXP = /<([\w:._-]+)\s*[^<>]*\s*$/;

export enum ElementType {
  DartClass,
  DartFactory,
  DartProperty,
  XDMLVirtualVariable,
  XDMLNode,
  XDMLAttr,
  XDMLPageNode,
  NamespaceAttrDefine,
  PageAttrDefine,
  VirtualVariableRef,
  InstanceFieldRef,
  ConstantRef,
  Token
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

function findNamespace(nss: { [ns: string]: string }, uri: string) {
  for (const key in nss) {
    if (nss.hasOwnProperty(key)) {
      const element = nss[key];
      if (element === uri) {
        return key;
      }
    }
  }
  return undefined;
}

export function getCurrentEntityInfos(
  doc: TextDocument,
  position: Position
): IEntityElementMetaInfo | null {
  const NS = resolveNamespaces(doc);
  const DOC = resolveDoc(doc, position, doc.getText());
  const META = tryResolveClassAndAttr(DOC);
  const HOST = resolveHostNode(META, DOC, NS);
  const needResolveRefs = !META.isAttr && !META.isClass && !!NS.bind;
  const refInfos = resolveRefs(needResolveRefs, DOC, NS);
  const tname = decideEntityFullName(refInfos, META);
  let info = readTag(NS.namespaces, tname, META.isClass, META.isAttr);
  info = resetRefEleType(refInfos, info);
  info = resolveEleHost(HOST, info);

  const points = pushPoints(info, HOST, NS);

  return {
    name: info.name,
    ns: info.ns,
    nsUri: info.nsUri,
    type: info.eleType,
    metainfo: {
      pointList: points
    }
  };
}

function pushPoints(info: IEntityInfos, HOST: IHostInfos, NS: INss) {
  const points: IMetaPointKV[] = [];
  const tokenType = parseNodeDisplay(info.eleType);
  if (info.eleType === ElementType.Token) {
    info.name = "identifier";
  } else {
    points.push({ k: tokenType, v: `${"`"}${info.name}${"`"}` });
  }
  if (HOST.hasHostTag) {
    const tp =
      HOST.hostTagType === ElementType.DartFactory
        ? "factory"
        : HOST.hostTagType === ElementType.DartClass
        ? "class"
        : "node";
    points.push({ k: tp, v: `${"`"}${HOST.hostTagName}${"`"}`, p: " - " });
  }
  // 提供import信息
  if (!!info.nsUri) {
    points.push({ k: "from", v: info.nsUri, p: " - " });
  }
  // 为xmlns提供src属性
  if (info.eleType === ElementType.NamespaceAttrDefine) {
    points.push({ k: "src", v: NS.namespaces[info.name], p: " - " });
  }
  return points;
}

function resolveEleHost(HOST: IHostInfos, info: IEntityInfos): IEntityInfos {
  // 有挂载Node
  if (HOST.hasHostTag) {
    // 挂载点是虚拟变量节点或者是结构点
    if (
      HOST.hostTagType === ElementType.XDMLNode ||
      HOST.hostTagType === ElementType.XDMLVirtualVariable
    ) {
      info.eleType = ElementType.XDMLAttr;
    }
    // 当前是飞xmlns的属性，且挂载点是Page
    if (HOST.hostTagType === ElementType.XDMLPageNode && !info.xmlns) {
      info.eleType = ElementType.PageAttrDefine;
    }
  }
  return info;
}

function decideEntityFullName(refInfos: IRefInfos, META: IMeta) {
  return refInfos.isConstantRef
    ? `${refInfos.preValue}${refInfos.nextValue}`
    : `${META.preValue}${META.nextValue}`;
}

function resetRefEleType(refInfos: IRefInfos, info: IEntityInfos) {
  if (refInfos.isVBRef) {
    info.eleType = ElementType.VirtualVariableRef;
  }
  if (refInfos.isInstanceRef) {
    info.eleType = ElementType.InstanceFieldRef;
  }
  if (refInfos.isConstantRef) {
    info.eleType = ElementType.ConstantRef;
  }
  return info;
}

function resolveHostNode(META: IMeta, DOC: IConnectContent, NS: INss) {
  let hasHostTag = false;
  let hostTagType = ElementType.Token;
  let hostTagName = "";
  // 如果是属性，尝试读取当前的挂载node
  if (META.isAttr) {
    const preTagResult = HOST_TAG_REGEXP.exec(DOC.preContent);
    if (!!preTagResult) {
      const info = readTag(
        NS.namespaces,
        (hostTagName = preTagResult[1]),
        true,
        false
      );
      hostTagType = info.eleType;
      hasHostTag = true;
    }
  }
  return { hasHostTag, hostTagType, hostTagName };
}

function tryResolveClassAndAttr(DOC: IConnectContent): IMeta {
  let isClass = false;
  let preValue = "";
  const preResult = PRE_ENTITY_REGEXP.exec(DOC.preContent);
  if (preResult) {
    isClass = preResult[1] === "<" || preResult[1] === "</";
    preValue = preResult[2];
  }
  let isAttr = false;
  let nextValue = "";
  const nextResult = NEXT_ENTITY_REGEXP.exec(DOC.afterContent);
  if (nextResult) {
    nextValue = nextResult[1];
    isAttr = nextResult[3] === "=";
  }
  return { isAttr, isClass, preValue, nextValue };
}

function resolveDoc(doc: TextDocument, position: Position, text: string) {
  const currentIndex = doc.offsetAt(position);
  const preContent = text.substring(0, currentIndex);
  const afterContent = text.substr(currentIndex);
  return { preContent, afterContent };
}

function resolveNamespaces(doc: TextDocument): INss {
  const namespaces = getDocumentNamespaces(doc);
  const bind = findNamespace(namespaces, BIND);
  const PRE_BIND_REGEXP = new RegExp(
    `(?:\w|_|"|')\\s*${bind}:([\\w_-]+)\\s*="([^"]*)$`
  );
  const NEXT_BIND_REGEXP = new RegExp(`^([\\w_\\.]*)".*`);
  const VB_REF_REGEXP = new RegExp(
    `(?:{|"|')\\s*${bind}:(v|virtual)\\s*=\\s*[\\w_\.]+$`
  );
  const INSTANCE_REF_REGEXP = new RegExp(
    `(?:{|"|')\\s*${bind}:(i|instance)\\s*=\\s*[\\w_\.]+$`
  );
  return {
    namespaces,
    bind,
    VB_REF_REGEXP,
    INSTANCE_REF_REGEXP,
    PRE_BIND_REGEXP,
    NEXT_BIND_REGEXP
  };
}

function resolveRefs(
  valid: boolean,
  DOC: IConnectContent,
  NS: INss
): IRefInfos {
  let isVBRef = false;
  let isInstanceRef = false;
  let isConstantRef = false;
  let preValue = "";
  let nextValue = "";
  if (valid) {
    isVBRef = NS.VB_REF_REGEXP.test(DOC.preContent);
    if (!isVBRef) {
      isInstanceRef = NS.INSTANCE_REF_REGEXP.test(DOC.preContent);
      if (!isInstanceRef) {
        let pairs = NS.PRE_BIND_REGEXP.exec(DOC.preContent);
        if (pairs) {
          isConstantRef = true;
          preValue = pairs[2];
          pairs = NS.NEXT_BIND_REGEXP.exec(DOC.afterContent);
          if (pairs) {
            nextValue = pairs[1];
          }
        } else {
          pairs = PRE_INSERT_REGEXP.exec(DOC.preContent);
          if (pairs) {
            isConstantRef = true;
            preValue = pairs[1];
            pairs = NEXT_INSERT_REGEXP.exec(DOC.afterContent);
            if (pairs) {
              nextValue = pairs[1];
            }
          }
        }
      }
    }
  }
  return { isVBRef, isInstanceRef, isConstantRef, preValue, nextValue };
}

function readTag(
  namespaces: { [ns: string]: string },
  entityName: string,
  isClass: boolean,
  isAttr: boolean
): IEntityInfos {
  const hasNs = entityName.indexOf(":") > 0;
  const ns = hasNs ? entityName.split(":")[0] : undefined;
  const name = hasNs ? entityName.split(":")[1] : entityName;
  const isFactory = name.indexOf(".") >= 0;
  const nsUri = namespaces[ns!];
  const internal = nsUri === XDML;
  const xmlns = ns === "xmlns";
  const isPrePageTag = internal && name === "Page";
  const eleType = isClass
    ? isPrePageTag
      ? ElementType.XDMLPageNode
      : internal
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
  return {
    hasNs,
    name,
    ns,
    isFactory,
    nsUri,
    internal,
    xmlns,
    eleType
  };
}

export function parseNodeDisplay(type: ElementType) {
  let tokenType = "";
  switch (type) {
    case ElementType.DartClass:
      tokenType = "Class";
      break;
    case ElementType.DartFactory:
      tokenType = "Factory";
      break;
    case ElementType.DartProperty:
      tokenType = "Class Field";
      break;
    case ElementType.XDMLPageNode:
      tokenType = "XDML Page Node";
      break;
    case ElementType.XDMLVirtualVariable:
      tokenType = "XDML Virtual Variable Definition";
      break;
    case ElementType.XDMLNode:
      tokenType = "XDML Syntax Node";
      break;
    case ElementType.PageAttrDefine:
      tokenType = "XDML Page Attribute";
      break;
    case ElementType.XDMLAttr:
      tokenType = "XDML Syntax Attribute";
      break;
    case ElementType.NamespaceAttrDefine:
      tokenType = "XDML Namespace Definition";
      break;
    case ElementType.VirtualVariableRef:
      tokenType = "XDML Virtual Variable Reference";
      break;
    case ElementType.InstanceFieldRef:
      tokenType = "Class Field Reference";
      break;
    case ElementType.ConstantRef:
      tokenType = "Constant Variable Reference";
      break;
    default:
      tokenType = "Token";
  }
  return tokenType;
}

//#region definitions

interface IMetaPointKV {
  k: string;
  v: string;
  p?: string;
}

interface IRefInfos {
  isVBRef: boolean;
  isInstanceRef: boolean;
  isConstantRef: boolean;
  preValue: string;
  nextValue: string;
}

interface IEntityInfos {
  hasNs: boolean;
  name: string;
  ns: string | undefined;
  isFactory: boolean;
  nsUri: string;
  internal: boolean;
  xmlns: boolean;
  eleType: ElementType;
}

interface INss {
  namespaces: { [ns: string]: string };
  bind: string | undefined;
  VB_REF_REGEXP: RegExp;
  INSTANCE_REF_REGEXP: RegExp;
  PRE_BIND_REGEXP: RegExp;
  NEXT_BIND_REGEXP: RegExp;
}

interface IMeta {
  isAttr: boolean;
  isClass: boolean;
  preValue: string;
  nextValue: string;
}

interface IConnectContent {
  preContent: string;
  afterContent: string;
}

interface IHostInfos {
  hasHostTag: boolean;
  hostTagType: ElementType;
  hostTagName: string;
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

//#endregion
