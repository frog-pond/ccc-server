#!/usr/bin/env node
/**
 * Script to validate JSON responses against Zod schemas
 * Usage: node dist/scripts/validate-schema.js <schema-path> <json-data>
 *
 * Example:
 *   echo '{"title": "test"}' | node dist/scripts/validate-schema.js feeds/types FeedItemSchema
 */

import {readFileSync} from 'fs'
import {z} from 'zod'

// Schema registry - maps endpoint patterns to their schemas
const SCHEMA_REGISTRY: Record<string, {module: string; schema: string; isArray?: boolean}> = {
	'/v1/news/named/stolaf': {module: 'feeds/types', schema: 'FeedItemSchema', isArray: true},
	'/v1/news/named/mess': {module: 'feeds/types', schema: 'FeedItemSchema', isArray: true},
	'/v1/news/named/krlx': {module: 'feeds/types', schema: 'FeedItemSchema', isArray: true},
	'/v1/news/named/oleville': {module: 'feeds/types', schema: 'FeedItemSchema', isArray: true},
}

async function main() {
	const endpoint = process.argv[2]
	const jsonInput = process.argv[3] ?? readFileSync(0, 'utf-8') // Read from stdin if not provided

	if (!endpoint) {
		console.error('Usage: validate-schema <endpoint> [json-data]')
		console.error('If json-data is not provided, reads from stdin')
		process.exit(1)
	}

	const schemaInfo = SCHEMA_REGISTRY[endpoint]
	if (!schemaInfo) {
		console.error(`No schema registered for endpoint: ${endpoint}`)
		console.error(`Registered endpoints: ${Object.keys(SCHEMA_REGISTRY).join(', ')}`)
		process.exit(1)
	}

	try {
		// Dynamically import the schema module
		const modulePath = `../source/${schemaInfo.module}.js`
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const module = await import(modulePath)

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
		let schema = module[schemaInfo.schema]
		if (!schema) {
			console.error(`Schema ${schemaInfo.schema} not found in module ${schemaInfo.module}`)
			process.exit(1)
		}

		// Wrap in array if needed
		if (schemaInfo.isArray) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			schema = z.array(schema)
		}

		// Parse the JSON input
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const data = JSON.parse(jsonInput)

		// Validate against schema
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		schema.parse(data)

		console.log('✓ Validation successful')
		process.exit(0)
	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error('✗ Schema validation failed:')
			console.error(JSON.stringify(error.errors, null, 2))
		} else if (error instanceof SyntaxError) {
			console.error('✗ Invalid JSON input')
		} else {
			console.error('✗ Validation error:', error)
		}
		process.exit(1)
	}
}

void main()
