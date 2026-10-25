/// Secrets are set on the worker, not in wrangler.jsonc, so `wrangler types`
/// does not know them.
interface Env {
	/** the key the Google calendar routes read the Calendar API with */
	GOOGLE_CALENDAR_API_KEY?: string
	/** "off" keeps the archives from walking back through their feeds' history on their own, for the tests, which step them by hand */
	ARCHIVE_BACKFILL?: string
	/** the client secret of the Sentry internal integration, which signs its webhooks */
	SENTRY_CLIENT_SECRET?: string
	/** the Telegram bot that posts Sentry's webhooks, from BotFather */
	TELEGRAM_BOT_TOKEN?: string
	/** the Telegram group they are posted to, such as -1001234567890 */
	TELEGRAM_CHAT_ID?: string
	/** the topic in that group (its message_thread_id); without it, the group's General topic */
	TELEGRAM_TOPIC_ID?: string
}
