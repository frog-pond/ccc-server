/// The arguments `mise run dev` starts wrangler with. `PAGES_ORIGIN_OVERRIDE`
/// becomes a var the Worker reads (the Mac data editor sets it), and
/// `CCC_PERSIST_TO` moves wrangler's local state out of the checkout, which
/// the data editor's copy of ccc cannot write to.
export function wranglerArgs(port: number, env: NodeJS.ProcessEnv): string[] {
	let args = ['dev', '-c', 'wrangler.jsonc', '--ip', '::', '--port', String(port)]
	let origin = env['PAGES_ORIGIN_OVERRIDE']
	if (origin) args.push('--var', `PAGES_ORIGIN_OVERRIDE:${origin}`)
	let persistTo = env['CCC_PERSIST_TO']
	if (persistTo) args.push('--persist-to', persistTo)
	return args
}
