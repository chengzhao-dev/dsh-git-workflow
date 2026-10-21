// Structural types for the host tool registry. DSH passes `ctx.tools` to the
// bundle; there is no separate `@deepseek-ai/dsh-tool` package to depend on.
// Keep this local and minimal so the bundle stays installable against the
// documented host range.

export interface ToolExec {
  agent?: { session?: { header?: { cwd?: string } } }
}

export interface ToolDefinition<Args, Result> {
  name: string
  description: string
  parameters: Record<string, unknown>
  output?: {
    schema: Record<string, unknown>
    render: (args: Args, value: Result) => Array<{ type: 'text'; text: string }>
    presentationMeta?: (args: Args, value: Result) => Record<string, unknown>
  }
  execute: (args: Args, exec: ToolExec) => Promise<Result>
  presentCall?: (args: Args) => Record<string, unknown>
  presentResult?: (
    args: Args,
    result: { content: Array<{ type: 'text'; text: string }> },
  ) => Record<string, unknown>
}

export interface ToolRegistry {
  register: (definition: ToolDefinition<any, any>) => unknown
}
