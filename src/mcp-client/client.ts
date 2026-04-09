export async function callMcpTool<T>(
  toolName: string,
  input: unknown,
  invoke: (tool: string, payload: unknown) => Promise<T>,
): Promise<T> {
  // 最小 stub：这里只做转发，暂未实现 timeout / retry / circuit breaker。
  return invoke(toolName, input)
}
