import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'
import type {Context} from './context.ts'

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let cachedVersion: string | null = null

async function getVersion(): Promise<string> {
	if (cachedVersion) {
		return cachedVersion
	}

	// Try methods in order of preference:
	// 1. APP_VERSION environment variable (set during deployment)
	// 2. VERSION file in project root (can be created during deployment)
	// 3. Git describe (if running in a git repository with tags)
	// 4. Fallback to "unknown"

	// Method 1: Environment variable
	if (process.env['APP_VERSION']) {
		cachedVersion = process.env['APP_VERSION']
		return cachedVersion
	}

	// Method 2: VERSION file
	try {
		const versionFilePath = join(__dirname, '..', '..', 'VERSION')
		const versionFromFile = await readFile(versionFilePath, 'utf-8')
		cachedVersion = versionFromFile.trim()
		return cachedVersion
	} catch {
		// VERSION file doesn't exist, continue to next method
	}

	// Method 3: Git describe
	try {
		const {stdout} = await execFileAsync('git', ['describe', '--tags', '--always'])
		cachedVersion = stdout.trim().replace(/^v/, '') // Remove leading 'v' if present
		return cachedVersion
	} catch {
		// Git describe failed, use unknown
	}

	// Method 4: Fallback
	cachedVersion = 'unknown'
	return cachedVersion
}

export async function health(ctx: Context): Promise<void> {
	const version = await getVersion()
	ctx.body = {
		version,
		status: 'ok',
	}
}
