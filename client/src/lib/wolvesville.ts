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
  const token = getToken();
  return {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  };
}

async function apiCall(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = '/';
    throw new Error('Unauthorized');
  }
  return res;
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/items/redeemApiHat`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return res.status === 204;
  } catch {
    return false;
  }
}

export interface Clan {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  tag?: string;
  xp?: number;
  icon?: string;
  iconColor?: string;
}

export async function getAuthorizedClans(): Promise<Clan[]> {
  const res = await apiCall('/clans/authorized');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface Member {
  playerId: string;
  username: string;
  level: number;
  flair: string | null;
  participateInClanQuests: boolean;
  rank?: string;
  status?: string;
  joinDate?: string;
  lastOnline?: string;
  personalMessage?: string;
  xp?: number;
  isCoLeader?: boolean;
  creationTime?: string;
}

export async function getClanMembers(clanId: string): Promise<Member[]> {
  const res = await apiCall(`/clans/${clanId}/members`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function updateMemberFlair(clanId: string, memberId: string, flair: string): Promise<void> {
  const res = await apiCall(`/clans/${clanId}/members/${memberId}/flair`, {
    method: 'PUT',
    body: JSON.stringify({ flair }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function updateMemberQuestParticipation(
  clanId: string,
  memberId: string,
  participate: boolean
): Promise<void> {
  const res = await apiCall(`/clans/${clanId}/members/${memberId}/participateInQuests`, {
    method: 'PUT',
    body: JSON.stringify({ participateInQuests: participate }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export interface LedgerEntry {
  id?: string;
  type: string;
  gold?: number;
  gems?: number;
  playerId?: string;
  playerUsername?: string;
  clanQuestId?: string;
  creationTime: string;
}

export async function getClanLedger(clanId: string): Promise<LedgerEntry[]> {
  const res = await apiCall(`/clans/${clanId}/ledger`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface LogEntry {
  id?: string;
  action: string;
  playerId?: string;
  playerUsername?: string;
  playerBotId?: string;
  playerBotOwnerUsername?: string;
  targetPlayerId?: string;
  targetPlayerUsername?: string;
  creationTime: string;
  newFlair?: string;
  oldFlair?: string;
}

export async function getClanLogs(clanId: string): Promise<LogEntry[]> {
  const res = await apiCall(`/clans/${clanId}/logs`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface FlairData {
  coins: number;
  gems: number;
  hasGoldEmoji: boolean;
  hasGemEmoji: boolean;
  hasOptoutEmoji: boolean;
  raw: string;
}

export function parseFlair(flairString: string | null | undefined): FlairData {
  const raw = flairString || '';
  if (!raw) {
    return { coins: 0, gems: 0, hasGoldEmoji: false, hasGemEmoji: false, hasOptoutEmoji: false, raw };
  }
  const coinMatch = raw.match(/(\d+)©/);
  const gemMatch = raw.match(/(\d+)G/);
  return {
    coins: coinMatch ? parseInt(coinMatch[1]) : 0,
    gems: gemMatch ? parseInt(gemMatch[1]) : 0,
    hasGoldEmoji: raw.includes('📙'),
    hasGemEmoji: raw.includes('📘'),
    hasOptoutEmoji: raw.includes('📕'),
    raw,
  };
}

export function buildFlairString(coins: number, gems: number, emoji: string = ''): string {
  const parts: string[] = [];
  if (coins > 0) parts.push(`${coins}©`);
  if (gems > 0) parts.push(`${gems}G`);
  if (emoji) parts.push(emoji);
  return parts.join(' ').trim();
}

export function removeEmojisFromFlair(flair: string | null | undefined): string {
  if (!flair) return '';
  return flair.replace(/📙|📘|📕/g, '').trim();
}

export function formatDateTimeGMT7(utcDateStr: string): string {
  try {
    return new Date(utcDateStr).toLocaleString('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return utcDateStr;
  }
}

export function toLocalDatetimeInputValue(utcDateStr: string): string {
  const d = new Date(utcDateStr);
  const gmt7 = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return gmt7.toISOString().slice(0, 16);
}

export function fromLocalDatetimeInputToUTC(localStr: string): Date {
  const localMs = new Date(localStr).getTime();
  return new Date(localMs - 7 * 60 * 60 * 1000);
}

export function nowAsLocalDatetimeInput(): string {
  return toLocalDatetimeInputValue(new Date().toISOString());
}
