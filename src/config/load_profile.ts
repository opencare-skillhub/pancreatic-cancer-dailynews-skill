import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { profileSchema } from '../schema/config.js'

export async function loadProfile(profile: string, rootDir = process.cwd()) {
  const filePath = resolve(rootDir, 'config', 'profiles', `${profile}.json`)
  const raw = JSON.parse(await readFile(filePath, 'utf-8'))
  return profileSchema.parse(raw)
}
