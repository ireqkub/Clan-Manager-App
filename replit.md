# Wolvesville Clan Manager

A polished React/TypeScript/Tailwind (Shadcn) SPA for managing Wolvesville game clans.

## Overview

This app calls the Wolvesville API (`https://api.wolvesville.com`) directly from the frontend using a bot token stored in `sessionStorage`. No backend database is required — the Express server just serves the Vite build.

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Shadcn UI
- **Backend**: Express (serves static assets only, no API proxy needed)
- **Routing**: Wouter
- **Data fetching**: TanStack React Query
- **State**: sessionStorage for auth token and selected clan

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Auth | Bot token login (validates via `POST /items/redeemApiHat`) |
| `/clans` | Clan Selection | Lists authorized clans from `GET /clans/authorized` |
| `/members` | Member Management | Full management tools (see below) |

## Member Management Features

1. **Member List** — table showing username, level, flair, quest status, last online, join date
2. **Flair Deduction Engine** — Coin mode (deduct N©, add 📙) or Gem mode (deduct NG, add 📘)
3. **Emoji Removal Tool** — strips 📙/📘/📕 from all member flairs
4. **Quest Participation Sync** — 📙/📘→ true, 📕→ false, no emoji→ false
5. **Ledger & Log Management** — filterable by date range (GMT+7), by type
6. **CSV Export** — members, ledger, and logs export to CSV (with BOM for Excel)

## Flair Format

`{coins}© {gems}G {emoji}`

- `©` = coins separator
- `G` = gems separator
- 📙 = coin paid marker
- 📘 = gem paid marker
- 📕 = opt-out marker

## Wolvesville API

Base: `https://api.wolvesville.com`
Auth header: `Authorization: Bot <token>`

Key endpoints:
- `POST /items/redeemApiHat` — validate token (204 = valid)
- `GET /clans/authorized` — list of authorized clans
- `GET /clans/{id}/members` — clan members
- `PUT /clans/{id}/members/{memberId}/flair` — update flair
- `PUT /clans/{id}/members/{memberId}/participateInQuests` — update quest participation
- `GET /clans/{id}/ledger` — ledger entries
- `GET /clans/{id}/log` — action log

## Key Files

- `client/src/lib/wolvesville.ts` — API client, flair parsing utilities, auth helpers
- `client/src/pages/auth-page.tsx` — login page
- `client/src/pages/clans-page.tsx` — clan selection
- `client/src/pages/members-page.tsx` — main management page
- `client/src/components/ThemeToggle.tsx` — light/dark mode toggle
- `client/src/index.css` — CSS variables (blue/slate theme)

## Theme

- Light mode: slate-50 background, white cards, primary blue `hsl(211 100% 50%)`
- Dark mode: navy `hsl(222 47% 11%)` background, dark cards
- Theme toggled via `.dark` class on `<html>`, persisted to `localStorage`
