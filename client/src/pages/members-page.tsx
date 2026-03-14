import { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  Shield, RefreshCw, LogOut, ArrowLeft, Users, Zap, Eraser,
  BookOpen, FileText, Check, X, Loader2, AlertCircle, Filter,
  Download, Info, Clock, ChevronRight,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  isAuthenticated, clearToken, getSelectedClanId, getSelectedClanName,
  getClanMembers, updateMemberFlair, updateMemberQuestParticipation,
  getClanLedger, getClanLogs, parseFlair, buildFlairString, removeEmojisFromFlair,
  formatDateTimeGMT7, toLocalDatetimeInputValue, fromLocalDatetimeInputToUTC,
  nowAsLocalDatetimeInput,
  type Member, type LedgerEntry, type LogEntry,
} from '@/lib/wolvesville';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';

type DeductionMode = 'coin' | 'gem';

interface PendingChange {
  memberId: string;
  username: string;
  oldFlair: string;
  newFlair: string;
}

export default function MembersPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const clanId = getSelectedClanId() || '';
  const clanName = getSelectedClanName() || 'Unknown Clan';

  useEffect(() => {
    if (!isAuthenticated() || !clanId) navigate('/');
  }, [navigate, clanId]);

  // ── Data Queries ──────────────────────────────────────────────────────────
  const {
    data: members = [],
    isLoading: membersLoading,
    isError: membersError,
    refetch: refetchMembers,
    isFetching: membersFetching,
  } = useQuery<Member[]>({
    queryKey: ['clan-members', clanId],
    queryFn: () => getClanMembers(clanId),
    enabled: !!clanId,
    retry: 1,
  });

  const {
    data: ledger = [],
    isLoading: ledgerLoading,
    refetch: refetchLedger,
    isFetching: ledgerFetching,
  } = useQuery<LedgerEntry[]>({
    queryKey: ['clan-ledger', clanId],
    queryFn: () => getClanLedger(clanId),
    enabled: !!clanId,
    retry: 1,
  });

  const {
    data: logs = [],
    isLoading: logsLoading,
    refetch: refetchLogs,
    isFetching: logsFetching,
  } = useQuery<LogEntry[]>({
    queryKey: ['clan-logs', clanId],
    queryFn: () => getClanLogs(clanId),
    enabled: !!clanId,
    retry: 1,
  });

  // Local members for optimistic updates
  const [localMembers, setLocalMembers] = useState<Member[]>([]);
  useEffect(() => { setLocalMembers(members); }, [members]);

  // ── Section 2: Flair Deduction Engine ────────────────────────────────────
  const [deductionMode, setDeductionMode] = useState<DeductionMode>('coin');
  const [coinAmount, setCoinAmount] = useState(600);
  const [gemAmount, setGemAmount] = useState(180);
  const [pendingFlairChanges, setPendingFlairChanges] = useState<PendingChange[]>([]);
  const [applyingFlair, setApplyingFlair] = useState(false);

  function analyzeFlairChanges() {
    const changes: PendingChange[] = [];
    localMembers.forEach((member) => {
      const f = parseFlair(member.flair);
      // Skip members that already have any emoji
      if (f.hasGoldEmoji || f.hasGemEmoji || f.hasOptoutEmoji) return;

      let newFlair = '';
      if (deductionMode === 'coin' && f.coins >= coinAmount) {
        newFlair = buildFlairString(f.coins - coinAmount, f.gems, '📙');
      } else if (deductionMode === 'gem' && f.gems >= gemAmount) {
        newFlair = buildFlairString(f.coins, f.gems - gemAmount, '📘');
      }
      if (newFlair !== '') {
        changes.push({ memberId: member.playerId, username: member.username, oldFlair: member.flair || '', newFlair });
      }
    });
    if (changes.length === 0) {
      toast({ title: 'No Qualifying Members', description: 'No members meet the criteria for flair deduction.' });
    } else {
      setPendingFlairChanges(changes);
    }
  }

  async function applyFlairChanges() {
    if (!pendingFlairChanges.length) return;
    setApplyingFlair(true);
    let success = 0; let fail = 0;
    const updated = [...localMembers];
    for (const change of pendingFlairChanges) {
      try {
        await updateMemberFlair(clanId, change.memberId, change.newFlair);
        const idx = updated.findIndex((m) => m.playerId === change.memberId);
        if (idx !== -1) updated[idx] = { ...updated[idx], flair: change.newFlair };
        success++;
      } catch { fail++; }
    }
    setLocalMembers(updated);
    setPendingFlairChanges([]);
    setApplyingFlair(false);
    toast({ title: fail === 0 ? 'Flair Updated' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
  }

  // ── Section 3: Emoji Removal ──────────────────────────────────────────────
  const [pendingEmojiRemovals, setPendingEmojiRemovals] = useState<PendingChange[]>([]);
  const [applyingEmoji, setApplyingEmoji] = useState(false);

  function analyzeEmojiRemoval() {
    const removals: PendingChange[] = [];
    localMembers.forEach((member) => {
      const f = parseFlair(member.flair);
      if (f.hasGoldEmoji || f.hasGemEmoji || f.hasOptoutEmoji) {
        removals.push({ memberId: member.playerId, username: member.username, oldFlair: member.flair || '', newFlair: removeEmojisFromFlair(member.flair) });
      }
    });
    if (removals.length === 0) {
      toast({ title: 'No Emojis Found', description: 'No members have emojis to remove.' });
    } else {
      setPendingEmojiRemovals(removals);
    }
  }

  async function applyEmojiRemoval() {
    if (!pendingEmojiRemovals.length) return;
    setApplyingEmoji(true);
    let success = 0; let fail = 0;
    const updated = [...localMembers];
    for (const change of pendingEmojiRemovals) {
      try {
        await updateMemberFlair(clanId, change.memberId, change.newFlair);
        const idx = updated.findIndex((m) => m.playerId === change.memberId);
        if (idx !== -1) updated[idx] = { ...updated[idx], flair: change.newFlair };
        success++;
      } catch { fail++; }
    }
    setLocalMembers(updated);
    setPendingEmojiRemovals([]);
    setApplyingEmoji(false);
    toast({ title: fail === 0 ? 'Emojis Removed' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
  }

  // ── Section 4: Quest Participation Sync ──────────────────────────────────
  const [syncingQuests, setSyncingQuests] = useState(false);

  async function syncAllQuests() {
    setSyncingQuests(true);
    let success = 0; let fail = 0; let skipped = 0;
    const updated = [...localMembers];
    for (const member of localMembers) {
      const f = parseFlair(member.flair);
      let target: boolean;
      if (f.hasGoldEmoji || f.hasGemEmoji) {
        target = true;
      } else {
        // 📕 or no emoji or no flair → false (only if currently true)
        target = false;
      }
      if (member.participateInClanQuests === target) { skipped++; continue; }
      try {
        await updateMemberQuestParticipation(clanId, member.playerId, target);
        const idx = updated.findIndex((m) => m.playerId === member.playerId);
        if (idx !== -1) updated[idx] = { ...updated[idx], participateInClanQuests: target };
        success++;
      } catch { fail++; }
    }
    setLocalMembers(updated);
    setSyncingQuests(false);
    toast({
      title: fail === 0 ? 'Quest Sync Complete' : 'Partial Success',
      description: success === 0 && skipped > 0 ? 'All members already in sync.' : `${success} updated, ${skipped} already in sync${fail > 0 ? `, ${fail} failed` : ''}.`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
  }

  // ── Section 5: Ledger & Log Management ───────────────────────────────────
  // Derive default start time from latest FLAIR_EDITED in logs (GMT+7 display)
  const latestFlairEdited = useMemo(() => {
    if (!logs.length) return null;
    const flairEdits = logs.filter((l) => l.action === 'FLAIR_EDITED');
    if (!flairEdits.length) return null;
    const sorted = [...flairEdits].sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());
    return sorted[0].creationTime;
  }, [logs]);

  const defaultStartRef = useRef<string | null>(null);
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');

  // Once logs load, set default start/end
  useEffect(() => {
    if (!logsLoading && defaultStartRef.current === null) {
      const end = nowAsLocalDatetimeInput();
      setEndDateTime(end);
      if (latestFlairEdited) {
        setStartDateTime(toLocalDatetimeInputValue(latestFlairEdited));
      }
      defaultStartRef.current = latestFlairEdited || '';
    }
  }, [logsLoading, latestFlairEdited]);

  const [pendingLedgerChanges, setPendingLedgerChanges] = useState<PendingChange[]>([]);
  const [applyingLedger, setApplyingLedger] = useState(false);

  function processLedgerForFlairUpdate() {
    if (!startDateTime && !endDateTime) {
      toast({ title: 'Set Time Range', description: 'Please set a start and/or end datetime first.', variant: 'destructive' });
      return;
    }
    const startUTC = startDateTime ? fromLocalDatetimeInputToUTC(startDateTime).getTime() : 0;
    const endUTC = endDateTime ? fromLocalDatetimeInputToUTC(endDateTime).getTime() : Infinity;

    // Filter DONATE entries within range
    const donations = ledger.filter((e) => {
      if (e.type !== 'DONATE') return false;
      const t = new Date(e.creationTime).getTime();
      return t >= startUTC && t <= endUTC;
    });

    if (!donations.length) {
      toast({ title: 'No Donations Found', description: 'No DONATE entries found in the selected time range.' });
      return;
    }

    // Sum donations per playerId
    const sums: Record<string, { gold: number; gems: number; username: string }> = {};
    for (const entry of donations) {
      if (!entry.playerId) continue;
      if (!sums[entry.playerId]) {
        sums[entry.playerId] = { gold: 0, gems: 0, username: entry.playerUsername || entry.playerId };
      }
      sums[entry.playerId].gold += entry.gold ?? 0;
      sums[entry.playerId].gems += entry.gems ?? 0;
    }

    // Build pending changes
    const changes: PendingChange[] = [];
    for (const [pid, sum] of Object.entries(sums)) {
      if (sum.gold === 0 && sum.gems === 0) continue;
      const member = localMembers.find((m) => m.playerId === pid);
      if (!member) continue;
      const f = parseFlair(member.flair);
      const newFlair = buildFlairString(f.coins + sum.gold, f.gems + sum.gems, f.hasGoldEmoji ? '📙' : f.hasGemEmoji ? '📘' : f.hasOptoutEmoji ? '📕' : '');
      if (newFlair !== (member.flair || '')) {
        changes.push({ memberId: pid, username: member.username, oldFlair: member.flair || '', newFlair });
      }
    }

    if (changes.length === 0) {
      toast({ title: 'No Changes', description: 'No flair updates needed from the donation data.' });
    } else {
      setPendingLedgerChanges(changes);
    }
  }

  async function applyLedgerChanges() {
    if (!pendingLedgerChanges.length) return;
    setApplyingLedger(true);
    let success = 0; let fail = 0;
    const updated = [...localMembers];
    for (const change of pendingLedgerChanges) {
      try {
        await updateMemberFlair(clanId, change.memberId, change.newFlair);
        const idx = updated.findIndex((m) => m.playerId === change.memberId);
        if (idx !== -1) updated[idx] = { ...updated[idx], flair: change.newFlair };
        success++;
      } catch { fail++; }
    }
    setLocalMembers(updated);
    setPendingLedgerChanges([]);
    setApplyingLedger(false);
    toast({ title: fail === 0 ? 'Flair Updated from Ledger' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
  }

  // ── Ledger browse filters ─────────────────────────────────────────────────
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'DONATE'>('all');
  const [logActionFilter, setLogActionFilter] = useState<'all' | 'FLAIR_EDITED' | 'quest'>('all');

  const filteredLedger = useMemo(() => {
    if (ledgerTypeFilter === 'DONATE') return ledger.filter((e) => e.type === 'DONATE');
    return ledger;
  }, [ledger, ledgerTypeFilter]);

  const filteredLogs = useMemo(() => {
    if (logActionFilter === 'FLAIR_EDITED') return logs.filter((e) => e.action === 'FLAIR_EDITED');
    if (logActionFilter === 'quest') return logs.filter((e) => e.action === 'PLAYER_QUEST_PARTICIPATION_ENABLED' || e.action === 'PLAYER_QUEST_PARTICIPATION_DISABLED');
    return logs;
  }, [logs, logActionFilter]);

  // ── CSV Export ────────────────────────────────────────────────────────────
  function downloadCsv(rows: (string | number)[][], filename: string) {
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function exportMembers() {
    downloadCsv([
      ['Username', 'Level', 'Flair', 'Quest Status', 'Coins', 'Gems', 'Emoji', 'Last Online', 'Joined'],
      ...localMembers.map((m) => {
        const f = parseFlair(m.flair);
        const emoji = f.hasGoldEmoji ? '📙' : f.hasGemEmoji ? '📘' : f.hasOptoutEmoji ? '📕' : '';
        return [m.username, m.level, m.flair || '', m.participateInClanQuests ? 'Participating' : 'Not Participating', f.coins, f.gems, emoji, m.lastOnline ? formatDateTimeGMT7(m.lastOnline) : '', m.creationTime ? formatDateTimeGMT7(m.creationTime) : ''];
      }),
    ], `${clanName}_members.csv`);
  }

  function exportLedger() {
    downloadCsv([
      ['Time (GMT+7)', 'Type', 'Player', 'Gold', 'Gems'],
      ...filteredLedger.map((e) => [formatDateTimeGMT7(e.creationTime), e.type, e.playerUsername || '', e.gold ?? 0, e.gems ?? 0]),
    ], `${clanName}_ledger.csv`);
  }

  function exportLogs() {
    downloadCsv([
      ['Time (GMT+7)', 'Action', 'Player/Bot', 'Target Player'],
      ...filteredLogs.map((e) => [formatDateTimeGMT7(e.creationTime), e.action, e.playerUsername || e.playerBotOwnerUsername || '', e.targetPlayerUsername || '']),
    ], `${clanName}_logs.csv`);
  }

  // ── Flair Display ─────────────────────────────────────────────────────────
  function FlairCell({ flair }: { flair: string | null }) {
    const f = parseFlair(flair);
    if (!flair) return <span className="text-muted-foreground text-xs italic">—</span>;
    return (
      <div className="flex items-center gap-1 flex-wrap min-w-0">
        <span className="font-mono text-xs">{flair}</span>
      </div>
    );
  }

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="font-semibold text-foreground truncate hidden sm:block">Wolvesville Clan Manager</span>
          </div>
          <nav className="hidden md:flex items-center gap-0.5 text-sm text-muted-foreground">
            <button className="px-2 py-1 rounded hover:text-foreground hover:bg-accent transition-colors" onClick={() => navigate('/')}>Authentication</button>
            <ChevronRight className="h-3.5 w-3.5" />
            <button className="px-2 py-1 rounded hover:text-foreground hover:bg-accent transition-colors" onClick={() => navigate('/clans')}>Clan Selection</button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="px-2 py-1 text-primary font-medium">Members</span>
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground" data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page title row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Member Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{clanName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchMembers()} disabled={membersFetching} data-testid="button-refresh-members">
              <RefreshCw className={`h-4 w-4 mr-1.5 ${membersFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/clans')} data-testid="button-back-to-clans">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Clans
            </Button>
          </div>
        </div>

        {/* ═══ SECTION 1: Member List ═══════════════════════════════════════ */}
        <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
          <div className="bg-primary px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary-foreground font-semibold">
              <Users className="h-4 w-4" />
              <span>Clan Members</span>
              {!membersLoading && (
                <span className="text-primary-foreground/70 text-sm font-normal">({localMembers.length})</span>
              )}
            </div>
            <Button
              variant="ghost" size="sm"
              className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={exportMembers}
              data-testid="button-export-members"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>

          {membersLoading && (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}
          {membersError && (
            <div className="p-4">
              <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>Failed to load members.</AlertDescription></Alert>
            </div>
          )}
          {!membersLoading && !membersError && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Username</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Flair</TableHead>
                    <TableHead>Quest Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Online (GMT+7)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localMembers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No members found.</TableCell></TableRow>
                  ) : localMembers.map((member) => (
                    <TableRow key={member.playerId} className="border-border" data-testid={`row-member-${member.playerId}`}>
                      <TableCell className="font-medium">{member.username}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">Lv {member.level}</Badge></TableCell>
                      <TableCell><FlairCell flair={member.flair} /></TableCell>
                      <TableCell>
                        {member.participateInClanQuests ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">Participating</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">Not Participating</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {member.lastOnline ? formatDateTimeGMT7(member.lastOnline) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* ═══ SECTION 2: Flair Deduction Engine ═══════════════════════════ */}
        <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
          <div className="bg-amber-500 dark:bg-amber-600 px-5 py-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-white" />
            <span className="font-semibold text-white">Flair Deduction Engine</span>
          </div>
          <div className="p-5 space-y-4">
            <RadioGroup
              value={deductionMode}
              onValueChange={(v) => { setDeductionMode(v as DeductionMode); setPendingFlairChanges([]); }}
              className="space-y-3"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <RadioGroupItem value="coin" id="coinMode" data-testid="radio-coin-mode" />
                <Label htmlFor="coinMode" className="flex items-center gap-2 flex-wrap cursor-pointer">
                  <span className="font-medium text-sm">Coin Mode:</span>
                  <span className="text-muted-foreground text-sm">Deduct</span>
                  <Input
                    type="number" value={coinAmount}
                    onChange={(e) => setCoinAmount(parseInt(e.target.value) || 0)}
                    onClick={() => setDeductionMode('coin')}
                    className="w-20 h-7 text-sm px-2" min={1} max={9999}
                    data-testid="input-coin-amount"
                  />
                  <span className="text-muted-foreground text-sm">© from flair, add 📙</span>
                </Label>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <RadioGroupItem value="gem" id="gemMode" data-testid="radio-gem-mode" />
                <Label htmlFor="gemMode" className="flex items-center gap-2 flex-wrap cursor-pointer">
                  <span className="font-medium text-sm">Gem Mode:</span>
                  <span className="text-muted-foreground text-sm">Deduct</span>
                  <Input
                    type="number" value={gemAmount}
                    onChange={(e) => setGemAmount(parseInt(e.target.value) || 0)}
                    onClick={() => setDeductionMode('gem')}
                    className="w-20 h-7 text-sm px-2" min={1} max={9999}
                    data-testid="input-gem-amount"
                  />
                  <span className="text-muted-foreground text-sm">G from flair, add 📘</span>
                </Label>
              </div>
            </RadioGroup>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Members already having 📙, 📘, or 📕 in their flair will be skipped.
            </p>

            <Button
              onClick={analyzeFlairChanges}
              variant="outline"
              className="border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              data-testid="button-analyze-flair"
            >
              <Filter className="h-4 w-4 mr-2" />
              Analyze &amp; Preview Changes
            </Button>

            {pendingFlairChanges.length > 0 && (
              <PendingChangesPanel
                title={`Pending Changes — ${pendingFlairChanges.length} member(s)`}
                changes={pendingFlairChanges}
                applying={applyingFlair}
                onApply={applyFlairChanges}
                onDeny={() => setPendingFlairChanges([])}
                applyLabel="Apply Changes"
                colorClass="amber"
              />
            )}
          </div>
        </div>

        {/* ═══ SECTION 3: Emoji Removal ═════════════════════════════════════ */}
        <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
          <div className="bg-destructive px-5 py-3 flex items-center gap-2">
            <Eraser className="h-4 w-4 text-destructive-foreground" />
            <span className="font-semibold text-destructive-foreground">Emoji Removal Tool</span>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Remove all emojis (📙 📘 📕) from member flairs. Only members with at least one emoji will be affected.
            </p>
            <Button
              onClick={analyzeEmojiRemoval}
              variant="outline"
              className="border-red-300 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
              data-testid="button-analyze-emoji"
            >
              <Filter className="h-4 w-4 mr-2" />
              Preview Emoji Removal
            </Button>
            {pendingEmojiRemovals.length > 0 && (
              <PendingChangesPanel
                title={`Members to be affected — ${pendingEmojiRemovals.length}`}
                changes={pendingEmojiRemovals}
                applying={applyingEmoji}
                onApply={applyEmojiRemoval}
                onDeny={() => setPendingEmojiRemovals([])}
                applyLabel="Remove All Emojis"
                colorClass="red"
              />
            )}
          </div>
        </div>

        {/* ═══ SECTION 4: Quest Participation Sync ═════════════════════════ */}
        <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
          <div className="bg-sky-500 dark:bg-sky-600 px-5 py-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-white" />
            <span className="font-semibold text-white">Quest Participation Sync</span>
          </div>
          <div className="p-5">
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground mb-2">Automatic Logic:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-base leading-none">📙</span>
                    <span className="text-muted-foreground">or</span>
                    <span className="text-base leading-none">📘</span>
                    <span className="text-muted-foreground">in flair →</span>
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">Participate: true</Badge>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-base leading-none">📕</span>
                    <span className="text-muted-foreground">in flair →</span>
                    <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 text-xs">Participate: false</Badge>
                  </li>
                  <li className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground text-xs">No emoji / empty flair → set false (only if currently true)</span>
                  </li>
                </ul>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={syncAllQuests}
                  disabled={syncingQuests}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                  data-testid="button-sync-quests"
                >
                  {syncingQuests ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Sync All to Quest</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SECTION 5: Ledger & Log Management ══════════════════════════ */}
        <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
          <div className="bg-primary px-5 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-primary-foreground font-semibold">
              <BookOpen className="h-4 w-4" />
              <span>Ledger &amp; Log Management</span>
            </div>
            <Button
              variant="ghost" size="sm"
              className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => { refetchLedger(); refetchLogs(); }}
              disabled={ledgerFetching || logsFetching}
              data-testid="button-refresh-ledger"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${(ledgerFetching || logsFetching) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="p-5 space-y-5">
            {/* Activity timestamp */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 px-4 py-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-300">Latest FLAIR_EDITED: </span>
                {logsLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : latestFlairEdited ? (
                  <span className="text-blue-700 dark:text-blue-300 font-mono text-xs">{formatDateTimeGMT7(latestFlairEdited)} (GMT+7)</span>
                ) : (
                  <span className="text-muted-foreground italic">No flair edit records found</span>
                )}
              </div>
            </div>

            {/* Time range & Update Flair */}
            <div className="rounded-lg border border-border p-4 space-y-4">
              <p className="text-sm font-medium text-foreground flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                Update Flair from Ledger Donations
              </p>
              <p className="text-xs text-muted-foreground">
                Reads <code className="bg-muted px-1 py-0.5 rounded text-xs">DONATE</code> ledger entries within the time range and increases member flair values (gold © / gems G) accordingly.
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Start Time (GMT+7)</Label>
                  <Input
                    type="datetime-local"
                    value={startDateTime}
                    onChange={(e) => setStartDateTime(e.target.value)}
                    className="h-8 text-sm w-52"
                    data-testid="input-start-datetime"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">End Time (GMT+7)</Label>
                  <Input
                    type="datetime-local"
                    value={endDateTime}
                    onChange={(e) => setEndDateTime(e.target.value)}
                    className="h-8 text-sm w-52"
                    data-testid="input-end-datetime"
                  />
                </div>
                <Button
                  onClick={processLedgerForFlairUpdate}
                  className="h-8 bg-primary hover:bg-primary/90"
                  data-testid="button-update-flair-from-ledger"
                >
                  <Zap className="h-4 w-4 mr-1.5" />
                  Update Flair
                </Button>
              </div>

              {pendingLedgerChanges.length > 0 && (
                <PendingChangesPanel
                  title={`Pending Flair Updates — ${pendingLedgerChanges.length} member(s)`}
                  changes={pendingLedgerChanges}
                  applying={applyingLedger}
                  onApply={applyLedgerChanges}
                  onDeny={() => setPendingLedgerChanges([])}
                  applyLabel="Apply All Updates"
                  colorClass="blue"
                />
              )}
            </div>

            {/* Ledger / Logs Browse Tabs */}
            <Tabs defaultValue="ledger">
              <TabsList>
                <TabsTrigger value="ledger" data-testid="tab-ledger">
                  <BookOpen className="h-4 w-4 mr-1.5" />
                  Ledger
                </TabsTrigger>
                <TabsTrigger value="logs" data-testid="tab-logs">
                  <FileText className="h-4 w-4 mr-1.5" />
                  Logs
                </TabsTrigger>
              </TabsList>

              {/* Ledger Tab */}
              <TabsContent value="ledger" className="mt-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant={ledgerTypeFilter === 'all' ? 'default' : 'outline'} onClick={() => setLedgerTypeFilter('all')} data-testid="button-filter-ledger-all">All</Button>
                    <Button size="sm" variant={ledgerTypeFilter === 'DONATE' ? 'default' : 'outline'} onClick={() => setLedgerTypeFilter('DONATE')} data-testid="button-filter-ledger-donate">Donations</Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportLedger} data-testid="button-export-ledger">
                    <Download className="h-4 w-4 mr-1.5" />Export CSV
                  </Button>
                </div>
                {ledgerLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead>Time (GMT+7)</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead>Gold</TableHead>
                          <TableHead>Gems</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLedger.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No ledger entries.</TableCell></TableRow>
                        ) : filteredLedger.slice(0, 100).map((entry, i) => (
                          <TableRow key={entry.id || i} className="border-border" data-testid={`row-ledger-${i}`}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeGMT7(entry.creationTime)}</TableCell>
                            <TableCell><Badge variant={entry.type === 'DONATE' ? 'default' : 'secondary'} className="text-xs">{entry.type}</Badge></TableCell>
                            <TableCell className="text-sm">{entry.playerUsername || '—'}</TableCell>
                            <TableCell className="text-sm font-mono text-yellow-600 dark:text-yellow-400">{entry.gold ? `${entry.gold}©` : '—'}</TableCell>
                            <TableCell className="text-sm font-mono text-blue-600 dark:text-blue-400">{entry.gems ? `${entry.gems}G` : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredLedger.length > 100 && (
                      <p className="text-center text-xs text-muted-foreground py-2">Showing first 100 of {filteredLedger.length} entries. Export CSV for all.</p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Logs Tab */}
              <TabsContent value="logs" className="mt-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant={logActionFilter === 'all' ? 'default' : 'outline'} onClick={() => setLogActionFilter('all')} data-testid="button-filter-logs-all">All</Button>
                    <Button size="sm" variant={logActionFilter === 'FLAIR_EDITED' ? 'default' : 'outline'} onClick={() => setLogActionFilter('FLAIR_EDITED')} data-testid="button-filter-logs-flair">Flair Edited</Button>
                    <Button size="sm" variant={logActionFilter === 'quest' ? 'default' : 'outline'} onClick={() => setLogActionFilter('quest')} data-testid="button-filter-logs-quest">Quest</Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportLogs} data-testid="button-export-logs">
                    <Download className="h-4 w-4 mr-1.5" />Export CSV
                  </Button>
                </div>
                {logsLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead>Time (GMT+7)</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Player / Bot</TableHead>
                          <TableHead>Target</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No log entries.</TableCell></TableRow>
                        ) : filteredLogs.slice(0, 100).map((entry, i) => (
                          <TableRow key={entry.id || i} className="border-border" data-testid={`row-log-${i}`}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeGMT7(entry.creationTime)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={entry.action === 'FLAIR_EDITED' ? 'default' : 'outline'}
                                className="text-xs whitespace-nowrap"
                              >
                                {entry.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{entry.playerUsername || entry.playerBotOwnerUsername || '—'}</TableCell>
                            <TableCell className="text-sm">{entry.targetPlayerUsername || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredLogs.length > 100 && (
                      <p className="text-center text-xs text-muted-foreground py-2">Showing first 100 of {filteredLogs.length} entries. Export CSV for all.</p>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared Pending Changes Panel ───────────────────────────────────────────
interface PendingChangesPanelProps {
  title: string;
  changes: PendingChange[];
  applying: boolean;
  onApply: () => void;
  onDeny: () => void;
  applyLabel: string;
  colorClass: 'amber' | 'red' | 'blue' | 'green';
}

const colorMap = {
  amber: {
    wrap: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20',
    title: 'text-amber-800 dark:text-amber-400',
  },
  red: {
    wrap: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20',
    title: 'text-red-800 dark:text-red-400',
  },
  blue: {
    wrap: 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20',
    title: 'text-blue-800 dark:text-blue-400',
  },
  green: {
    wrap: 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20',
    title: 'text-green-800 dark:text-green-400',
  },
};

function PendingChangesPanel({ title, changes, applying, onApply, onDeny, applyLabel, colorClass }: PendingChangesPanelProps) {
  const c = colorMap[colorClass];
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${c.wrap}`}>
      <h3 className={`text-sm font-semibold ${c.title}`}>{title}</h3>
      <div className="max-h-52 overflow-y-auto space-y-1">
        {changes.map((ch) => (
          <div key={ch.memberId} className="text-xs flex items-center gap-2 py-0.5 font-mono">
            <span className="font-sans font-medium text-foreground min-w-[110px] truncate">{ch.username}</span>
            <span className="text-muted-foreground">{ch.oldFlair || <em className="not-italic text-muted-foreground">empty</em>}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-foreground font-semibold">{ch.newFlair || <em className="not-italic text-muted-foreground">empty</em>}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={onApply}
          disabled={applying}
          className="bg-green-600 hover:bg-green-700 text-white border-0"
          data-testid="button-apply-pending"
        >
          {applying ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
          {applyLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onDeny} disabled={applying} data-testid="button-deny-pending">
          <X className="h-4 w-4 mr-1.5" />
          Deny
        </Button>
      </div>
    </div>
  );
}
