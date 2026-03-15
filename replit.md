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
| `/` | Auth (Leader Login) | Bot token login (validates via `POST /items/redeemApiHat`) |
| `/clans` | Clan Selection | Lists authorized clans from `GET /clans/authorized` |
| `/members` | Member Management | Full management tools (see below) |
| `/quest-fee` | Quest Fee | Apply 200© fee to low-XP quest participants |
| `/quest-active` | Quest Active | Live quest view or available quest selection |

## Member Management Features (members page)

1. **Member List** — table showing username, level, flair, quest status, last online
2. **Flair Deduction Engine** — Coin mode (deduct N©, add 📙) or Gem mode (deduct NG, add 📘); skips 📙/📘/📕/🏆; retains 0© or 0G when result is zero
3. **Emoji Removal Tool** — strips 📙/📘/📕/⚠️/🏆 from all member flairs
4. **Quest Participation Sync** — 📙/📘/🏆 → true; 📕/⚠️/no emoji → false (skip if already correct)
5. **Ledger & Log Management** — date range filter (GMT+7), auto-detects latest FLAIR_EDITED; removes ⚠️ if value becomes >0 after donation update
6. **CSV Export** — members, ledger, and logs export to CSV

## Quest Fee Page

- Fetches `GET /clans/{id}/quests/history`, finds latest quest by `tierEndTime`
- **Section 1**: Table of participants with XP < 3000; "Apply Fee" deducts 200©; adds ⚠️ if balance goes negative; warns if a quest is active
- **Section 2 (TOP 1 QUEST)**: Awards 🏆 to the participant with the highest XP; removes 🏆 from previous holders; skips if top member already has 🏆; all changes show preview/confirm before API calls

## Quest Active Page

- Fetches `GET /clans/{id}/quests/active`
- If active: shows quest details (promo image, type, xp, tier, times in GMT+7), participants sorted by XP
- If 404 (no active quest): shows available quests as 5 cards with votes, plus shuffle vote section

## Flair Format

`{coins}© {gems}G {emoji}`

- `©` = coins separator
- `G` = gems separator
- 📙 = coin paid marker
- 📘 = gem paid marker
- 📕 = opt-out marker
- ⚠️ = warning / negative balance
- 🏆 = trophy / special member

## Wolvesville API

Base: `https://api.wolvesville.com`
Auth header: `Authorization: Bot <token>`

Key endpoints:
- `POST /items/redeemApiHat` — validate token (204 = valid)
- `GET /clans/authorized` — list of authorized clans
- `GET /clans/{id}/members` — clan members
- `PUT /clans/{id}/members/{memberId}/flair` — update flair
- `PUT /clans/{id}/members/{memberId}/participateInQuests` — update quest participation
- `GET /clans/{id}/ledger` — ledger entries (DONATE type used for flair updates)
- `GET /clans/{id}/logs` — action log (FLAIR_EDITED used for default start time)
- `GET /clans/{id}/quests/history` — past quests
- `GET /clans/{id}/quests/active` — current active quest (404 if none)
- `GET /clans/{id}/quests/available` — available quests to vote/buy
- `GET /clans/{id}/quests/votes` — votes per quest + shuffle votes

## Security

- **In-memory token store**: token held in a module-level JS variable (`_inMemoryToken`) — survives page navigation without sessionStorage reads, cleared on logout or tab close
- **sessionStorage backup**: token also stored in sessionStorage so it survives page refresh within the same session
- **XSS prevention**: DOMPurify (`client/src/lib/sanitize.ts`) sanitizes all flair/username strings from the API before parsing or display; React's default escaping protects text nodes
- **CSP headers**: production builds set `Content-Security-Policy` with strict `connect-src` limited to `api.wolvesville.com`; `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` always set
- **Flair parsing safety**: regex only extracts expected characters (`©`, `G`, digits, specific emojis) — injection via flair strings is structurally impossible

## Key Files

- `client/src/lib/wolvesville.ts` — API client, flair parsing utilities, auth helpers
- `client/src/components/NavHeader.tsx` — shared sticky nav with breadcrumb + logout
- `client/src/components/PendingChangesPanel.tsx` — reusable "preview changes → apply/deny" panel
- `client/src/pages/auth-page.tsx` — Leader Login page
- `client/src/pages/clans-page.tsx` — clan selection
- `client/src/pages/members-page.tsx` — main management page
- `client/src/pages/quest-fee-page.tsx` — quest fee application
- `client/src/pages/quest-active-page.tsx` — active/available quest viewer
- `client/src/components/ThemeToggle.tsx` — light/dark mode toggle
- `client/src/index.css` — CSS variables (blue/slate theme)

## Theme

- Light mode: slate-50 background, white cards, primary blue `hsl(211 100% 50%)`
- Dark mode: navy `hsl(222 47% 11%)` background, dark cards
- Theme toggled via `.dark` class on `<html>`, persisted to `localStorage`
