declare module "xmlbuilder/lib/XMLStringWriter" {
  import {
    XMLWriter,
    XMLNode,
    WriterOptions,
    XMLAttribute,
    XMLDeclaration,
    XMLDocType,
    XMLText,
    XMLDTDAttList,
    XMLDTDElement,
    XMLDTDEntity,
    XMLDTDNotation
  } from "xmlbuilder";

  class XMLStringWriter implements XMLWriter {
    document(doc: XMLDocument, options: WriterOptions): string;
    indent(node: XMLNode, options: WriterOptions, level: number): string;
    endline(node: XMLNode, options: WriterOptions, level: number): string;
    attribute(
      node: XMLAttribute,
      options: WriterOptions,
      level: number
    ): string;
    cdata(node: XMLNode, options: WriterOptions, level: number): string;
    comment(node: XMLNode, options: WriterOptions, level: number): string;
    declaration(
      node: XMLDeclaration,
      options: WriterOptions,
      level: number
    ): string;
    docType(node: XMLDocType, options: WriterOptions, level: number): string;
    element(node: XMLNode, options: WriterOptions, level: number): string;
    writeChildNode(
      node: XMLNode,
      options: WriterOptions,
      level: number
    ): string;
    processingInstruction(
      node: XMLNode,
      options: WriterOptions,
      level: number
    ): string;
    raw(node: XMLText, options: WriterOptions, level: number): string;
    text(node: XMLNode, options: WriterOptions, level: number): string;
    dtdAttList(
      node: XMLDTDAttList,
      options: WriterOptions,
      level: number
    ): string;
    dtdElement(
      node: XMLDTDElement,
      options: WriterOptions,
      level: number
    ): string;
    dtdEntity(
      node: XMLDTDEntity,
      options: WriterOptions,
      level: number
    ): string;
    dtdNotation(
      node: XMLDTDNotation,
      options: WriterOptions,
      level: number
    ): string;
    openNode(node: XMLNode, options: WriterOptions, level: number): void;
    closeNode(node: XMLNode, options: WriterOptions, level: number): void;
    openAttribute(
      node: XMLAttribute,
      options: WriterOptions,
      level: number
    ): void;
    closeAttribute(
      node: XMLAttribute,
      options: WriterOptions,
      level: number
    ): void;
  }

  export = XMLStringWriter;
}
