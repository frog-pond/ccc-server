import {readdirSync, writeFileSync, rmSync, existsSync, mkdirSync} from 'fs'
import {fileURLToPath} from 'url'
import path, {join} from 'path'
import {execSync} from 'child_process'

// Shims
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const BUNDLE_PATH = join(__dirname, '../dist/bundle')
const FINAL_BUNDLE = join(__dirname, '../dist/bundle.js')
const ENTRY_FILE = join(BUNDLE_PATH, 'entry.js')

// Args
const commonFlags = ' --minify --platform=node --format=esm'
const commonDependencies =
	'--alias:lodash-es=lodash --alias:jsdom=jsdom/lib/api.js --alias:koa-router=koa-router/lib/router.js --external:turndown'
const commonArgs = [commonFlags, commonDependencies].join(' ')

const runCommand = (command) => {
	try {
		execSync(command, {stdio: 'inherit'})
	} catch (error) {
		console.error(`Error executing command: ${command}`, error)
		process.exit(1)
	}
}

// Clean the bundle directory
const cleanBundle = ({startup}) => {
	if (existsSync(BUNDLE_PATH)) {
		rmSync(BUNDLE_PATH, {recursive: true, force: true})
	}
	if (existsSync(FINAL_BUNDLE) && startup === true) {
		rmSync(FINAL_BUNDLE)
	}
	console.log('Bundle directory cleaned.')
}

// Transform the files
const transformFiles = () => {
	runCommand(`npx esbuild dist/source/**/**/*.js --bundle --outdir=dist/bundle ${commonArgs}`)
	console.log('Files transformed.')
}

// Create the entry file
const createEntryFile = () => {
	const files = readdirSync(BUNDLE_PATH, {recursive: true})
	const imports = files
		.filter((file) => file.endsWith('.js'))
		.map((file) => `import '${join('../bundle', file)}'`)
		.join('\n')

	writeFileSync(ENTRY_FILE, imports)
	console.log('entry.js has been created successfully.')
}

// Combine the bundles
const combineBundles = () => {
	runCommand(`npx esbuild dist/bundle/entry.js --bundle --outfile=dist/bundle.js ${commonArgs}`)
	console.log('Final bundle has been created successfully.')
}

const run = () => {
	cleanBundle({startup: true})
	transformFiles()
	createEntryFile()
	combineBundles()
	cleanBundle({startup: false})
}

run()
