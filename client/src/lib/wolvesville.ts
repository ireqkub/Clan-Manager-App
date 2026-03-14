const API_BASE = 'https://api.wolvesville.com';
const TOKEN_KEY = 'wolvesville_bot_token';
const CLAN_ID_KEY = 'wolvesville_selected_clan_id';
const CLAN_NAME_KEY = 'wolvesville_selected_clan_name';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(CLAN_ID_KEY);
  sessionStorage.removeItem(CLAN_NAME_KEY);
}
export function isAuthenticated(): boolean {
  return !!getToken();
}
export function getSelectedClanId(): string | null {
  return sessionStorage.getItem(CLAN_ID_KEY);
}
export function getSelectedClanName(): string | null {
  return sessionStorage.getItem(CLAN_NAME_KEY);
}
export function setSelectedClan(id: string, name: string) {
  sessionStorage.setItem(CLAN_ID_KEY, id);
  sessionStorage.setItem(CLAN_NAME_KEY, name);
}

function getHeaders(): Record<string, string> {
  return { Authorization: `Bot ${getToken()}`, 'Content-Type': 'application/json' };
}

async function apiCall(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) { clearToken(); window.location.href = '/'; throw new Error('Unauthorized'); }
  return res;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/items/redeemApiHat`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    });
    return res.status === 204;
  } catch { return false; }
}

// ── Clans ─────────────────────────────────────────────────────────────────
export interface Clan {
  id: string; name: string; description?: string;
  memberCount?: number; tag?: string; xp?: number;
}
export async function getAuthorizedClans(): Promise<Clan[]> {
  const res = await apiCall('/clans/authorized');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Members ───────────────────────────────────────────────────────────────
export interface Member {
  playerId: string; username: string; level: number;
  flair: string | null; participateInClanQuests: boolean;
  status?: string; lastOnline?: string; creationTime?: string;
  isCoLeader?: boolean; xp?: number;
}
export async function getClanMembers(clanId: string): Promise<Member[]> {
  const res = await apiCall(`/clans/${clanId}/members`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function updateMemberFlair(clanId: string, memberId: string, flair: string): Promise<void> {
  const res = await apiCall(`/clans/${clanId}/members/${memberId}/flair`, {
    method: 'PUT', body: JSON.stringify({ flair }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
export async function updateMemberQuestParticipation(clanId: string, memberId: string, participate: boolean): Promise<void> {
  const res = await apiCall(`/clans/${clanId}/members/${memberId}/participateInQuests`, {
    method: 'PUT', body: JSON.stringify({ participateInQuests: participate }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Ledger ────────────────────────────────────────────────────────────────
export interface LedgerEntry {
  id?: string; type: string;
  gold?: number; gems?: number;
  playerId?: string; playerUsername?: string;
  clanQuestId?: string; creationTime: string;
}
export async function getClanLedger(clanId: string): Promise<LedgerEntry[]> {
  const res = await apiCall(`/clans/${clanId}/ledger`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Logs ──────────────────────────────────────────────────────────────────
export interface LogEntry {
  id?: string; action: string;
  playerId?: string; playerUsername?: string;
  playerBotId?: string; playerBotOwnerUsername?: string;
  targetPlayerId?: string; targetPlayerUsername?: string;
  creationTime: string;
}
export async function getClanLogs(clanId: string): Promise<LogEntry[]> {
  const res = await apiCall(`/clans/${clanId}/logs`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Quests ────────────────────────────────────────────────────────────────
export interface QuestReward { type: string; amount: number; avatarItemId?: string; displayType?: string; }
export interface QuestInfo {
  id: string; rewards: QuestReward[];
  promoImageUrl?: string; promoImagePrimaryColor?: string;
  purchasableWithGems: boolean;
}
export interface QuestParticipant { playerId: string; username: string; xp: number; }
export interface ClanQuest {
  quest: QuestInfo; xp: number; xpPerReward: number; tier: number;
  tierStartTime: string; tierEndTime: string;
  tierFinished: boolean; claimedTime: boolean;
  participants: QuestParticipant[];
}
export interface QuestVotes {
  votes: Record<string, string[]>;
  shuffleVotes: string[];
}

export async function getQuestHistory(clanId: string): Promise<ClanQuest[]> {
  const res = await apiCall(`/clans/${clanId}/quests/history`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function getActiveQuest(clanId: string): Promise<ClanQuest | null> {
  const res = await apiCall(`/clans/${clanId}/quests/active`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.code === 404) return null;
  return data;
}
export async function getAvailableQuests(clanId: string): Promise<QuestInfo[]> {
  const res = await apiCall(`/clans/${clanId}/quests/available`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
export async function getQuestVotes(clanId: string): Promise<QuestVotes> {
  const res = await apiCall(`/clans/${clanId}/quests/votes`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Flair Utilities ───────────────────────────────────────────────────────
export interface FlairData {
  coins: number; gems: number;
  hasGoldEmoji: boolean; hasGemEmoji: boolean;
  hasOptoutEmoji: boolean; hasWarningEmoji: boolean; hasTrophyEmoji: boolean;
  raw: string;
}
export function parseFlair(flairString: string | null | undefined): FlairData {
  const raw = flairString || '';
  if (!raw) return { coins: 0, gems: 0, hasGoldEmoji: false, hasGemEmoji: false, hasOptoutEmoji: false, hasWarningEmoji: false, hasTrophyEmoji: false, raw };
  const coinMatch = raw.match(/(\d+)©/);
  const gemMatch = raw.match(/(\d+)G/);
  return {
    coins: coinMatch ? parseInt(coinMatch[1]) : 0,
    gems: gemMatch ? parseInt(gemMatch[1]) : 0,
    hasGoldEmoji: raw.includes('📙'),
    hasGemEmoji: raw.includes('📘'),
    hasOptoutEmoji: raw.includes('📕'),
    hasWarningEmoji: raw.includes('⚠️'),
    hasTrophyEmoji: raw.includes('🏆'),
    raw,
  };
}

export interface BuildFlairOpts {
  retainZeroCoins?: boolean;
  retainZeroGems?: boolean;
}
export function buildFlairString(coins: number, gems: number, emoji: string = '', opts?: BuildFlairOpts): string {
  const parts: string[] = [];
  if (coins > 0 || opts?.retainZeroCoins) parts.push(`${coins}©`);
  if (gems > 0 || opts?.retainZeroGems) parts.push(`${gems}G`);
  if (emoji) parts.push(emoji);
  return parts.join(' ').trim();
}

export function removeEmojisFromFlair(flair: string | null | undefined): string {
  if (!flair) return '';
  return flair.replace(/📙|📘|📕|⚠️|🏆/g, '').replace(/\s+/g, ' ').trim();
}

// ── Date Utilities ────────────────────────────────────────────────────────
export function formatDateTimeGMT7(utcDateStr: string): string {
  try {
    return new Date(utcDateStr).toLocaleString('en-US', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch { return utcDateStr; }
}
export function toLocalDatetimeInputValue(utcDateStr: string): string {
  const gmt7 = new Date(new Date(utcDateStr).getTime() + 7 * 60 * 60 * 1000);
  return gmt7.toISOString().slice(0, 16);
}
export function fromLocalDatetimeInputToUTC(localStr: string): Date {
  return new Date(new Date(localStr).getTime() - 7 * 60 * 60 * 1000);
}
export function nowAsLocalDatetimeInput(): string {
  return toLocalDatetimeInputValue(new Date().toISOString());
}
