/** A recurring service array and complete replacements for individual opening dates. */
export interface Schedule<T> {
	schedule: T[]
	exceptions: {date: string; schedule: T[]}[]
}

export type CalendarInterval =
	| {date: string; start?: undefined; end?: undefined}
	| {start: string; end: string; date?: undefined}

export interface BreakCalendar<T> {
	timezone: string
	templates?: Record<string, Schedule<T>> | undefined
	breaks: Record<
		string,
		CalendarInterval & {
			name: string
			templates?: Record<string, Schedule<T>> | undefined
			defaultSpaceSchedule?: string | Schedule<T> | undefined
		}
	>
}

/** Scheduling fields share one container before and after reference expansion. */
export interface Space<T, B = Schedule<T>> {
	[key: string]: unknown
	schedule: T[]
	exceptions?: Schedule<T>['exceptions'] | undefined
	breakSchedule?: Record<string, B> | undefined
}

/** Normalized authored JSON; strings are classified before use. */
export type AuthoredSpace<T> = Space<T, string | Schedule<T>>

/** Public output with every authored reference expanded. */
export type ResolvedSpace<T> = Space<T>
