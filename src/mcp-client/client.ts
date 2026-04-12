import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export type McpServerConfig = {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
}

function extractToolContent(result: unknown): unknown {
  if (!result || typeof result !== 'object') {
    return result
  }

  const record = result as Record<string, unknown>
  const content = record.content
  if (!Array.isArray(content)) {
    return result
  }

  const textParts = content
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      if (row.type === 'text' && typeof row.text === 'string') return [row.text]
      return []
    })
    .join('\n')

  if (!textParts.trim()) {
    return result
  }

  try {
    return JSON.parse(textParts)
  } catch {
    return textParts
  }
}

export async function invokeMcpStdioTool(
  server: McpServerConfig,
  toolName: string,
  input: unknown,
): Promise<unknown> {
  const transport = new StdioClientTransport({
    command: server.command,
    args: server.args ?? [],
    cwd: server.cwd,
    env: server.env,
    stderr: 'pipe',
  })

  const client = new Client(
    {
      name: 'xiaoyibao-digest',
      version: '5.0.0-next.0',
    },
    {
      capabilities: {},
    },
  )

  const stderrChunks: string[] = []
  const stderr = transport.stderr as {
    setEncoding?: (encoding: string) => void
    on?: (event: string, listener: (chunk: string) => void) => void
  } | null
  if (stderr?.setEncoding && stderr?.on) {
    stderr.setEncoding('utf8')
    stderr.on('data', (chunk: string) => {
      stderrChunks.push(chunk)
    })
  }

  try {
    await client.connect(transport)
    const result = await client.callTool({
      name: toolName,
      arguments: (input ?? {}) as Record<string, unknown>,
    })
    return extractToolContent(result)
  } catch (error) {
    const details = stderrChunks.join('').trim()
    const suffix = details ? ` | stderr: ${details}` : ''
    throw new Error(`${error instanceof Error ? error.message : String(error)}${suffix}`)
  } finally {
    await transport.close().catch(() => undefined)
  }
}

export async function callMcpTool<T>(
  toolName: string,
  input: unknown,
  invoke: (tool: string, payload: unknown) => Promise<T>,
): Promise<T> {
  return await invoke(toolName, input)
}
