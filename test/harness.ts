import {execFileSync} from 'node:child_process'
import {mkdirSync, mkdtempSync, readFileSync} from 'node:fs'
import path from 'node:path'
import {Miniflare, type Request, type Response} from 'miniflare'

const ROOT = path.join(import.meta.dirname, '..')
const WRANGLER = path.join(ROOT, 'node_modules', '.bin', 'wrangler')

// workerd's disk sandbox rejects a bundle whose sourcemap "sources" resolve
// outside its start directory, which happens when the bundle lives in the
// OS temp dir (unrelated to this project's tree); a workdir under the repo
// keeps every path a descendant of it
const BUNDLE_DIR = path.join(ROOT, '.wrangler', 'tmp')

export const SCHOOLS = ['stolaf-college', 'carleton-college'] as const
export type School = (typeof SCHOOLS)[number]

function compatibilityDate(): string {
	let toml = readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8')
	let match = /^compatibility_date = "([\d-]+)"$/m.exec(toml)
	if (!match?.[1]) throw new Error('no compatibility_date in wrangler.toml')
	return match[1]
}

/// Bundles a Worker exactly as a deploy would, without deploying it, and
/// returns the path of the bundled module.
export function bundle(args: string[], entryName: string): string {
	mkdirSync(BUNDLE_DIR, {recursive: true})
	let outdir = mkdtempSync(path.join(BUNDLE_DIR, 'ccc-worker-'))
	execFileSync(WRANGLER, ['deploy', '--dry-run', '--outdir', outdir, ...args], {
		cwd: ROOT,
		stdio: 'pipe',
	})
	return path.join(outdir, `${entryName}.js`)
}

let schoolBundles = new Map<School, string>()

export function bundleSchool(school: School): string {
	let scriptPath = schoolBundles.get(school)
	if (!scriptPath) {
		scriptPath = bundle(['--env', school], 'index')
		schoolBundles.set(school, scriptPath)
	}
	return scriptPath
}

export async function startWorker(options: {
	scriptPath: string
	bindings: Record<string, string>
	upstream: (request: Request) => Response | Promise<Response>
}): Promise<Miniflare> {
	let mf = new Miniflare({
		modules: true,
		scriptPath: options.scriptPath,
		compatibilityDate: compatibilityDate(),
		bindings: options.bindings,
		outboundService: options.upstream,
	})
	try {
		await mf.ready
	} catch (error) {
		// a rejected mf.ready still leaves the workerd process running; without
		// this it leaks and can hang the test run on a failed startup
		await mf.dispose()
		throw error
	}
	return mf
}
