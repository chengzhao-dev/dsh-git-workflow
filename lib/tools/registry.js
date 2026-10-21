// Structural types for the host tool registry. DSH passes `ctx.tools` to the
// bundle; there is no separate `@deepseek-ai/dsh-tool` package to depend on.
// Keep this local and minimal so the bundle stays installable against the
// documented host range.
export {};
