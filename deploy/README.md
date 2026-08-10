# Droplet deployment

This deployment runs the current single creator pilot in Docker with persistent local D1 and R2 development storage. Caddy provides HTTPS and password protection for the dashboard while leaving only the Telegram webhook and health check public.

It is a pilot deployment target. Creator isolation and PostgreSQL migration are required before onboarding multiple creators.
