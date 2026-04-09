export async function callMcpTool<T>(
  toolName: string,
  input: unknown,
  invoke: (tool: string, payload: unknown) => Promise<T>,
): Promise<T> {
  return invoke(toolName, input)
}
