/** Mimics the result of Object.keys(...) */
export type keysOf<o> = o extends readonly unknown[]
	? number extends o['length']
		? `${number}`
		: keyof o & `${number}`
	: {[K in keyof o]: K extends string ? K : K extends number ? `${K}` : never}[keyof o]

export const keysOf = <o extends object>(o: o) => Object.keys(o) as keysOf<o>[]
