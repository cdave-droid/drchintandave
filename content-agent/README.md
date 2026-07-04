# Content Agent Dashboard

A team of 5 AI agents that run my content: scout ideas, write hooks/scripts,
plan a calendar, analyse stats, handle DMs — shown on a clean dashboard and
reporting to Telegram.

## Layout
```
content-agent/
  CLAUDE.md          agent instructions (who I am, niche, voice, competitors)
  scripts/           node scripts (data pull, telegram sender, run-all)
  dashboard/         the dashboard (index.html + js) and data.json
  .env               my secrets — GITIGNORED, never committed
  .env.example       template for .env
  package.json       deps + npm scripts
```

## Build order (guided, one step at a time)
1. [x] Folder scaffold  ← you are here
2. [ ] Pull real Instagram data (Apify)  → `npm run pull`
3. [ ] Build the dashboard
4. [ ] Telegram bot digest  → `npm run digest`
5. [ ] Schedule it (GitHub Actions / cron)  → `npm run all`
6. [ ] Prove one full cycle

## Setup
```
cp .env.example .env   # then fill in tokens
npm install
```
