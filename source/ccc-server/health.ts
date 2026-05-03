import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'
import type {Context} from './context.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let cachedVersion: string | null = null

async function getVersion(): Promise<string> {
	if (cachedVersion) {
		return cachedVersion
	}

	const packageJsonPath = join(__dirname, '..', '..', 'package.json')
	const packageJson = await readFile(packageJsonPath, 'utf-8')
	const parsed = JSON.parse(packageJson) as {version: string}
	cachedVersion = parsed.version
	return cachedVersion
}

export async function health(ctx: Context): Promise<void> {
	const version = await getVersion()
	ctx.body = {
		version,
		status: 'ok',
	}
}
