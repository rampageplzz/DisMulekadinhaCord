export interface ModelContext {
  registerTool(tool: {
    name: string;
    title: string;
    description: string;
    inputSchema: object;
    annotations: {readOnlyHint: boolean; untrustedContentHint: boolean};
    execute: (input: unknown) => unknown;
  }, options: {signal: AbortSignal}): void | Promise<void>;
}
declare global { interface Document { readonly modelContext?: ModelContext } }
