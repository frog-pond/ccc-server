import {expect, test} from 'vitest'
import wranglerConfig from '../../wrangler.jsonc?raw'

type Bindings = {
	observability?: {logs?: {enabled?: boolean; invocation_logs?: boolean; persist?: boolean}}
	durable_objects?: {bindings?: {name: string; class_name: string}[]}
}

// the file has line comments and trailing commas, which JSON.parse refuses
const config = JSON.parse(
	wranglerConfig.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1'),
) as Bindings & {
	previews: Bindings
}

// A Preview does not inherit production's bindings. Without its own copy, the
// deployed preview has no env.SOURCE and every read of it fails, which no test
// run against the top-level config can see.
test('a Preview has the same Durable Object bindings as production', () => {
	expect(config.durable_objects?.bindings).toEqual([
		{name: 'SOURCE', class_name: 'SourceDO'},
		{name: 'STUDENT_WORK', class_name: 'StudentWorkDO'},
	])
	expect(config.previews.durable_objects?.bindings).toEqual(config.durable_objects?.bindings)
})

// Previews do not inherit observability either, so a Preview would otherwise
// run without logs, which is the one place we most want them.
test('production and Previews both persist logs, including invocation logs', () => {
	const logs = {enabled: true, head_sampling_rate: 1, invocation_logs: true, persist: true}
	expect(config.observability?.logs).toEqual(logs)
	expect(config.previews.observability?.logs).toEqual(logs)
	expect(config.previews.observability).toEqual(config.observability)
})
