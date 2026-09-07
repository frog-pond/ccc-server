/// The words every deprecation notice draws on, kept in one place because the
/// payloads differ by shape — events, feed items, orgs, jobs — while the thing
/// being said to the reader does not.

export const DISCUSSION_URL = 'https://github.com/frog-pond/ccc-server/discussions/564'

/// For a source that is expected back: the outage is known and being worked on.
export const UNAVAILABLE_TITLE = 'Temporarily unavailable'

/// For sources that are genuinely gone rather than relocated, so the two cases
/// stay distinguishable to whoever is reading the screen.
export const RETIRED_TITLE = 'No longer updated'
