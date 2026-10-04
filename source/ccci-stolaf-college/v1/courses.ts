import {ONE_HOUR} from '../../ccc-lib/constants.ts'
import type {Context} from '../../ccc-server/context.ts'

/// Where course-data-tools publishes the nightly course catalog: a SQLite file
/// of every term from five years back.
const CATALOG_URL = 'https://stolaf.dev/course-data/catalog-recent.db'

/// A temporary redirect, so the app has an address on this server to ask for
/// the catalog and the file can be proxied from here later without an app
/// release. The app downloads it conditionally, by ETag; the redirect passes
/// that header on to the file's host, which answers it, so nothing about the
/// download changes.
///
/// A 302, not a 301, and cached for an hour at most: a client that remembered this
/// as permanent would never notice when the redirect is replaced by the file.
export function catalog(ctx: Context) {
	ctx.cacheControl(ONE_HOUR)
	ctx.redirect(CATALOG_URL)
}
