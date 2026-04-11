type YamlScalar = string | boolean | number | null
interface YamlObject {
  [key: string]: YamlValue
}
type YamlValue = YamlScalar | YamlObject | YamlValue[]

type LineToken = {
  indent: number
  content: string
}

function stripComments(line: string): string {
  let inSingle = false
  let inDouble = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === "'" && !inDouble) {
      inSingle = !inSingle
      continue
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble
      continue
    }
    if (char === '#' && !inSingle && !inDouble) {
      return line.slice(0, index).trimEnd()
    }
  }

  return line.trimEnd()
}

function tokenize(input: string): LineToken[] {
  return input
    .split(/\r?\n/)
    .map(stripComments)
    .filter((line) => line.trim().length > 0)
    .map((line) => ({
      indent: line.match(/^ */)?.[0].length ?? 0,
      content: line.trim(),
    }))
}

function parseScalar(raw: string): YamlValue {
  const value = raw.trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value)
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim()
    if (!inner) return []
    return splitInline(inner).map((item) => parseScalar(item))
  }
  return value
}

function splitInline(input: string): string[] {
  const parts: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (char === "'" && !inDouble) {
      inSingle = !inSingle
      current += char
      continue
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble
      current += char
      continue
    }
    if (char === ',' && !inSingle && !inDouble) {
      parts.push(current.trim())
      current = ''
      continue
    }
    current += char
  }

  if (current.trim()) {
    parts.push(current.trim())
  }
  return parts
}

function parseMappingEntry(content: string): { key: string; value?: string } {
  const separator = content.indexOf(':')
  if (separator === -1) {
    throw new Error(`Invalid YAML line: ${content}`)
  }

  const key = content.slice(0, separator).trim()
  const rawValue = content.slice(separator + 1).trim()
  return {
    key,
    value: rawValue.length > 0 ? rawValue : undefined,
  }
}

function looksLikeInlineMapping(content: string): boolean {
  return /^[A-Za-z0-9_.-]+\s*:/.test(content)
}

function parseBlock(tokens: LineToken[], startIndex: number, indent: number): { value: YamlValue; nextIndex: number } {
  if (startIndex >= tokens.length) {
    return { value: {}, nextIndex: startIndex }
  }

  const token = tokens[startIndex]
  if (token.indent < indent) {
    return { value: {}, nextIndex: startIndex }
  }

  if (token.content.startsWith('- ')) {
    const array: YamlValue[] = []
    let index = startIndex

    while (index < tokens.length) {
      const current = tokens[index]
      if (current.indent < indent || !current.content.startsWith('- ')) {
        break
      }

      const itemContent = current.content.slice(2).trim()
      if (!itemContent) {
        const nested = parseBlock(tokens, index + 1, current.indent + 2)
        array.push(nested.value)
        index = nested.nextIndex
        continue
      }

      if (looksLikeInlineMapping(itemContent)) {
        const { key, value } = parseMappingEntry(itemContent)
        const objectValue: YamlObject = {}
        if (value !== undefined) {
          objectValue[key] = parseScalar(value)
          const nested = parseBlock(tokens, index + 1, current.indent + 2)
          if (nested.value !== null && typeof nested.value === 'object' && !Array.isArray(nested.value) && Object.keys(nested.value).length > 0) {
            Object.assign(objectValue, nested.value)
            index = nested.nextIndex
          } else {
            index += 1
          }
        } else {
          const nested = parseBlock(tokens, index + 1, current.indent + 2)
          objectValue[key] = nested.value
          index = nested.nextIndex
        }
        array.push(objectValue)
        continue
      }

      array.push(parseScalar(itemContent))
      index += 1
    }

    return { value: array, nextIndex: index }
  }

  const objectValue: YamlObject = {}
  let index = startIndex

  while (index < tokens.length) {
    const current = tokens[index]
    if (current.indent < indent) {
      break
    }
    if (current.indent > indent) {
      throw new Error(`Invalid indentation near: ${current.content}`)
    }

    const { key, value } = parseMappingEntry(current.content)
    if (value !== undefined) {
      objectValue[key] = parseScalar(value)
      index += 1
      continue
    }

    const nested = parseBlock(tokens, index + 1, current.indent + 2)
    objectValue[key] = nested.value
    index = nested.nextIndex
  }

  return { value: objectValue, nextIndex: index }
}

export function parseSimpleYaml(input: string): YamlValue {
  const trimmed = input.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as YamlValue
  }

  const tokens = tokenize(input)
  if (tokens.length === 0) {
    return {}
  }

  return parseBlock(tokens, 0, tokens[0]!.indent).value
}
