# Sentry to Telegram

`POST /sentry/telegram` (`src/sentry-telegram.ts`) takes a Sentry internal
integration's webhooks and posts them to a Telegram group's topic as a bot.

## Telegram

1. Message **@BotFather**, send `/newbot`, and keep the **bot token**.
2. Add the bot to the group. The group needs Topics turned on, and the bot must
   be allowed to post in the topic. It only sends, so Telegram's "no access to
   messages" for the bot (privacy mode) does not matter.
3. Get the chat and topic ids from a link to any message in the topic:
   `https://t.me/c/1234567890/<topic>/<message>` is chat `-1001234567890`
   (`-100` and the first number) and topic `<topic>`. A link with only two
   numbers is from the General topic, which has no topic id: leave
   `TELEGRAM_TOPIC_ID` unset.

## Worker secrets

| Name | Value |
|---|---|
| `SENTRY_CLIENT_SECRET` | the integration's Client Secret (below) |
| `TELEGRAM_BOT_TOKEN` | from BotFather |
| `TELEGRAM_CHAT_ID` | e.g. `-1001234567890` |
| `TELEGRAM_TOPIC_ID` | the topic's `message_thread_id`; optional |

These are runtime variables and secrets, not build ones. Cloudflare keeps them
**per environment**: production, a Preview's base settings and each branch
Preview's own settings are separate, and a branch Preview does not get
production's. Set them where the URL Sentry calls is served from.

```sh
npx wrangler secret put SENTRY_CLIENT_SECRET   # and the others
```

## Sentry

1. Settings, Developer Settings, Create New Integration, **Internal Integration**.
2. **Webhook URL**: `https://ccc-server.frog-pond-d8f.workers.dev/sentry/telegram`
   (or a branch Preview's host, to test).
3. Turn on **Alert Rule Action**, so alert rules can send to it.
4. Permissions: Issue & Event, Read.
5. Webhooks: Issues (created, resolved, assigned...). Errors only if every
   error event is wanted; that is noisy.
6. Save, and copy the **Client Secret** straight away: Sentry shows it only
   briefly, and rotating it is the only way to see a new one. Rotate it, then
   update `SENTRY_CLIENT_SECRET` in every environment that uses it.
7. Add the integration as an action on the alert rules to forward.

## What is posted

`issue` (created, resolved, assigned, archived, unresolved), `event_alert` (an
alert rule fired), `error` and `metric_alert`. `installation` and `comment`
are answered with a 204 and not posted.

## Debugging

POST an empty body to the route from a terminal and read the status:

```sh
curl -i -X POST -d '{}' https://<host>/sentry/telegram
```

- **503**: the body's `missing` lists the secrets (names only) that
  environment lacks.
- **401**: the secrets are set, but `SENTRY_CLIENT_SECRET` is not the
  integration's current Client Secret.
- **405**: the host does not have this route (not deployed there yet).
- **502**: Telegram refused the message, such as the bot not being in the group
  or a wrong chat or topic id. The Worker's logs have Telegram's reason.
- **204**: posted.

Call Telegram on its own to rule out the bot:

```sh
curl -s "https://api.telegram.org/bot<TOKEN>/sendMessage" \
  -d chat_id=<chat id> -d message_thread_id=<topic id> -d text=test
```

Telegram takes the bot token in the request path, so it appears in the
Worker's traces of that fetch.
