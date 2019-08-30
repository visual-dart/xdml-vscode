import * as path from "path";
import {
  workspace,
  ExtensionContext
  // languages,
  // TextDocument,
  // Position
} from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
  // RequestType,
  // TextDocumentPositionParams
} from "vscode-languageclient";
// import { getIndentationRules } from "./xdml/indent-rules";
// import { activateTagClosing, AutoCloseResult } from "./xdml/auto-close";

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  let serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions
    }
  };

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for xdml documents
    documentSelector: [{ scheme: "file", language: "xdml" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
      configurationSection: ["xdml", "[xdml]"]
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "xdml",
    "XDML Language Server",
    serverOptions,
    clientOptions
  );

  // languages.setLanguageConfiguration("xdml", getIndentationRules());

  // Start the client. This will also launch the server
  client.start();
  // await client.onReady();

  // const typeX: RequestType<
  //   TextDocumentPositionParams,
  //   AutoCloseResult,
  //   any,
  //   any
  // > = new RequestType("xdml/closeTag");
  // const tagProvider = (document: TextDocument, position: Position) => {
  //   const param = client.code2ProtocolConverter.asTextDocumentPositionParams(
  //     document,
  //     position
  //   );
  //   const text = client.sendRequest(typeX, param);
  //   return text;
  // };
  // context.subscriptions.push(
  //   activateTagClosing(
  //     tagProvider,
  //     { xdml: true },
  //     "xdml.completion.autoCloseTags"
  //   )
  // );
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
