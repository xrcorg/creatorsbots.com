# Droplet deployment

This deployment runs isolated Tiffani Madison and Madison Morgan creator instances in Docker. Each creator has a separate application process and persistent data volume, so conversations, customer profiles, media, catalogs, settings, payments, orders, learned replies, and earnings cannot mix.

Caddy routes `APP_DOMAIN` to Tiffani and `MADISON_APP_DOMAIN` to Madison. The two instances share the same application code and fixed safety rules, but each uses its own Telegram bot token, webhook secret, Cloudflare Access audience, creator login list, profile, and payment settings.

## Madison setup values

Add these values to `.env.production` before starting Madison:

```dotenv
MADISON_APP_DOMAIN=madison.creatorsbots.com
MADISON_TELEGRAM_BOT_TOKEN=replace_with_madison_bot_token
MADISON_TELEGRAM_WEBHOOK_SECRET=replace_with_a_new_random_secret
MADISON_CLOUDFLARE_ACCESS_AUD=replace_with_madison_access_audience
MADISON_PORTAL_CREATOR_EMAILS=replace_with_madison_email
MADISON_CREATOR_CASHAPP=
MADISON_CREATOR_VENMO=
MADISON_CREATOR_ZELLE=
```

Create a proxied Cloudflare DNS record for `madison.creatorsbots.com`, protect that hostname with a Cloudflare Access application for the owner and Madison, then register Madison's Telegram webhook at:

```text
https://madison.creatorsbots.com/api/telegram/webhook
```

Madison starts with no copied personality, intake answers, content, media, socials, payment details, customers, conversations, orders, or earnings. Her creator portal onboarding screen is the source of truth for filling those areas.

This remains a small scale Docker deployment using local Wrangler persistence. Move creator data and media to managed production databases and object storage before scaling broadly.
