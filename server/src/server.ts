import {
  createConnection,
  TextDocuments,
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams
} from "vscode-languageserver";
import { Parser } from "xml2js";

let connection = createConnection(ProposedFeatures.all);
let documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we will fall back using global settings
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  return {
    capabilities: {
      hoverProvider: true,
      textDocumentSync: documents.syncKind,
      // Tell the client that the server supports code completion
      completionProvider: {
        resolveProvider: true
      }
    }
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(_event => {
      connection.console.log("Workspace folder change event received.");
    });
  }
});

// The example settings
interface IXDMLSettings {
  validation: boolean;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: IXDMLSettings = { validation: true };
let globalSettings: IXDMLSettings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<IXDMLSettings>> = new Map();

let xmlParser = new Parser({ strict: false });

connection.onDidChangeConfiguration(change => {
  if (hasConfigurationCapability) {
    // Reset all cached document settings
    documentSettings.clear();
  } else {
    globalSettings = <IXDMLSettings>(change.settings.xdml || defaultSettings);
  }

  // Revalidate all open text documents
  documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<IXDMLSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "xdml"
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
  documentSettings.delete(e.document.uri);
});

connection.onHover(async e => {
  // console.log(e);
  var doc = documents.get(e.textDocument.uri)!;
  var position = e.position;
  var text = doc.getText();
  var currentIndex = doc.offsetAt(position);
  // console.log(text.substring(currentIndex, 10));
  const preContent = text.substring(0, currentIndex);
  const afterContent = text.substr(currentIndex);

  // console.log(currentIndex);

  const XDML = "https://github.com/visual-dart/xdml/wiki/xdml";

  const namespaces: any = {};
  const nsReg = /xmlns:([\w-_.]+)\s*=\s*((\"([^\"\r\n]+)\")|(\'([^\'\r\n]+)\'))(\r|\r\n)*/g;
  text.replace(nsReg, (...args) => {
    // console.log(args);
    const ns = args[1];
    const nsUrl = args[4] || args[7];
    namespaces[ns] = nsUrl;
    return "";
  });

  const preReg = /(\s|\r\n|\n|<|<\/){1}([\w-_\.:]*)$/;
  const preResult = preReg.exec(preContent);
  if (!preResult) {
    return { contents: [] };
  }
  // console.log(preResult);
  var isClass = preResult[1] === "<" || preResult[1] === "</";
  var preValue = preResult[2];

  const nextReg = /^([\w-_\.:]*)(\s|\r\n|\n)*(=)?/;
  const nextResult = nextReg.exec(afterContent);
  if (!nextResult) {
    return { contents: [] };
  }
  // console.log(nextResult);
  var nextValue = nextResult[1];
  var isAttr = nextResult[3] === "=";

  const entityName = `${preValue}${nextValue}`;
  const hasNs = entityName.indexOf(":") > 0;
  const ns = hasNs ? entityName.split(":")[0] : undefined;
  const name = hasNs ? entityName.split(":")[1] : entityName;
  const isFactory = name.indexOf(".") >= 0;

  let message = entityName;

  var nsUrl = namespaces[ns!];
  var internal = nsUrl === XDML;
  const tokenType = isClass
    ? internal
      ? isFactory
        ? "XDML虚拟变量声明"
        : "XDML语法结构"
      : isFactory
      ? "Dart类工厂"
      : "Dart类"
    : isAttr
    ? "属性"
    : "Token";
  message = [
    `**${tokenType}**: ${"`"}${name}${"`"}`,
    `**导入来源**: ${nsUrl || "当前页面范围内部成员"}`
  ].join("\n\n");

  return {
    contents: message
  };
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
  validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  // In this simple example we get the settings for every validate run.
  let settings = await getDocumentSettings(textDocument.uri);

  // The validator creates diagnostics for all uppercase words length 2 and more
  let text = textDocument.getText();
  // return new Promise((resolve, reject) => {
  // xmlParser.parseString(text, (error: any, result: any) => {
  //   if (error) {
  //     reject(error);
  //   } else {
  //     console.log(result);
  //   }
  // });
  // });
  // console.log(text);
  // let pattern = /\b[A-Z]{2,}\b/g;
  // let m: RegExpExecArray | null;

  // let problems = 0;
  // let diagnostics: Diagnostic[] = [];
  // while (settings.validation && (m = pattern.exec(text)) && problems < 100) {
  //   problems++;
  //   let diagnostic: Diagnostic = {
  //     severity: DiagnosticSeverity.Warning,
  //     range: {
  //       start: textDocument.positionAt(m.index),
  //       end: textDocument.positionAt(m.index + m[0].length)
  //     },
  //     message: `${m[0]} is all uppercase.`,
  //     source: "ex"
  //   };
  //   if (hasDiagnosticRelatedInformationCapability) {
  //     diagnostic.relatedInformation = [
  //       {
  //         location: {
  //           uri: textDocument.uri,
  //           range: Object.assign({}, diagnostic.range)
  //         },
  //         message: "Spelling matters"
  //       },
  //       {
  //         location: {
  //           uri: textDocument.uri,
  //           range: Object.assign({}, diagnostic.range)
  //         },
  //         message: "Particularly for names"
  //       }
  //     ];
  //   }
  //   diagnostics.push(diagnostic);
  // }

  // // Send the computed diagnostics to VSCode.
  // connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
  // Monitored files have change in VSCode
  connection.console.log("We received an file change event");
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return [
      {
        label: "TypeScript",
        kind: CompletionItemKind.Text,
        data: 1
      },
      {
        label: "JavaScript",
        kind: CompletionItemKind.Text,
        data: 2
      }
    ];
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    if (item.data === 1) {
      item.detail = "TypeScript details";
      item.documentation = "TypeScript documentation";
    } else if (item.data === 2) {
      item.detail = "JavaScript details";
      item.documentation = "JavaScript documentation";
    }
    return item;
  }
);

/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});
connection.onDidChangeTextDocument((params) => {
	// The content of a text document did change in VSCode.
	// params.uri uniquely identifies the document.
	// params.contentChanges describe the content changes to the document.
	connection.console.log(`${params.textDocument.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});
connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
