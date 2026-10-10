/// How long a client keeps a successful response before re-checking it
/// against its ETag (`src/etag.ts`), which costs a 304 when nothing changed.
export const CLIENT_MAX_AGE = 10 * 60
/// How long a client keeps a failure or a stand-in, so a bad read does not
/// outlast the upstream coming back.
export const ERROR_MAX_AGE = 60
/// How long a source's stored value is fresh in the worker, in milliseconds.
/// After that it is still answered while it is refreshed behind. Student work
/// keeps its own schedule (`src/student-work-do.ts`).
export const SOURCE_TTL = 60 * 60 * 1000
