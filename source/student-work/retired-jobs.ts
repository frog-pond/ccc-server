import {DISCUSSION_URL, UNAVAILABLE_TITLE} from '../ccc-lib/deprecated.ts'

/// A notice in place of St. Olaf's student job listings, shaped for the job
/// screens older builds ship. Nothing here fetches, so the Node server and the
/// Cloudflare Worker share it.

export const RETIRED_JOBS_TEXT =
	"Student job listings can't be loaded in this version. Tap for details."

/// Fills the list's grouping heading and row subtitle, which have no message to
/// carry but cannot be blank.
const JOBS_HEADING = 'Student work'

export function deprecatedJobs(text: string, now = new Date()) {
	return [
		{
			comments: '',
			contactEmail: '',
			contactName: '',
			contactPhone: '',
			description: text,
			goodForIncomingStudents: false,
			hoursPerWeek: '',
			howToApply: '',
			id: 0,
			lastModified: now.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric',
			}),
			links: [DISCUSSION_URL],
			office: JOBS_HEADING,
			openPositions: '',
			skills: '',
			timeline: '',
			timeOfHours: '',
			title: UNAVAILABLE_TITLE,
			type: JOBS_HEADING,
			url: DISCUSSION_URL,
			year: '',
		},
	]
}
