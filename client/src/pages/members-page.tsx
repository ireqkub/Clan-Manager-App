import { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation } from 'wouter';
import {
  RefreshCw, ArrowLeft, Users, Zap, Eraser,
  BookOpen, FileText, Check, X, Loader2, AlertCircle,
  Filter, Download, Info, Clock,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  isAuthenticated, getSelectedClanId, getSelectedClanName,
  getClanMembers, updateMemberFlair, updateMemberQuestParticipation,
  getClanLedger, getClanLogs, parseFlair, buildFlairString, removeEmojisFromFlair,
  formatDateTimeGMT7, toLocalDatetimeInputValue, fromLocalDatetimeInputToUTC, nowAsLocalDatetimeInput,
  type Member, type LedgerEntry, type LogEntry,
} from '@/lib/wolvesville';
import { NavHeader } from '@/components/NavHeader';
import { useToast } from '@/hooks/use-toast';
import { PendingChangesPanel } from '@/components/PendingChangesPanel';

type DeductionMode = 'coin' | 'gem';
export interface PendingChange { memberId: string; username: string; oldFlair: string; newFlair: string; }

export default function MembersPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const clanId = getSelectedClanId() || '';
  const clanName = getSelectedClanName() || 'Unknown Clan';

  useEffect(() => { if (!isAuthenticated() || !clanId) navigate('/'); }, [navigate, clanId]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: members = [], isLoading: membersLoading, isError: membersError, refetch: refetchMembers, isFetching: membersFetching } = useQuery<Member[]>({
    queryKey: ['clan-members', clanId], queryFn: () => getClanMembers(clanId), enabled: !!clanId, retry: 1,
  });
  const { data: ledger = [], isLoading: ledgerLoading, refetch: refetchLedger, isFetching: ledgerFetching } = useQuery<LedgerEntry[]>({
    queryKey: ['clan-ledger', clanId], queryFn: () => getClanLedger(clanId), enabled: !!clanId, retry: 1,
  });
  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs, isFetching: logsFetching } = useQuery<LogEntry[]>({
    queryKey: ['clan-logs', clanId], queryFn: () => getClanLogs(clanId), enabled: !!clanId, retry: 1,
  });

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
      // Skip members with any of these emojis
      if (f.hasGoldEmoji || f.hasGemEmoji || f.hasOptoutEmoji || f.hasTrophyEmoji) return;

      let newFlair = '';
      if (deductionMode === 'coin' && f.coins >= coinAmount) {
        const newCoins = f.coins - coinAmount;
        newFlair = buildFlairString(newCoins, f.gems, '📙', { retainZeroCoins: true });
      } else if (deductionMode === 'gem' && f.gems >= gemAmount) {
        const newGems = f.gems - gemAmount;
        newFlair = buildFlairString(f.coins, newGems, '📘', { retainZeroGems: true });
      }
      if (newFlair !== '') {
        changes.push({ memberId: member.playerId, username: member.username, oldFlair: member.flair || '', newFlair });
      }
    });
    if (changes.length === 0) {
      toast({ title: 'No Qualifying Members', description: 'No members meet the criteria. (Members with 📙 📘 📕 🏆 are skipped)' });
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
    setLocalMembers(updated); setPendingFlairChanges([]); setApplyingFlair(false);
    toast({ title: fail === 0 ? 'Flair Updated' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
  }

  // ── Section 2b: Emoji Removal ─────────────────────────────────────────────
  const [pendingEmojiRemovals, setPendingEmojiRemovals] = useState<PendingChange[]>([]);
  const [applyingEmoji, setApplyingEmoji] = useState(false);

  function analyzeEmojiRemoval() {
    const removals: PendingChange[] = [];
    localMembers.forEach((member) => {
      const f = parseFlair(member.flair);
      if (f.hasGoldEmoji || f.hasGemEmoji || f.hasOptoutEmoji || f.hasWarningEmoji || f.hasTrophyEmoji) {
        removals.push({ memberId: member.playerId, username: member.username, oldFlair: member.flair || '', newFlair: removeEmojisFromFlair(member.flair) });
      }
    });
    if (removals.length === 0) toast({ title: 'No Emojis', description: 'No members have emojis to remove.' });
    else setPendingEmojiRemovals(removals);
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
    setLocalMembers(updated); setPendingEmojiRemovals([]); setApplyingEmoji(false);
    toast({ title: fail === 0 ? 'Emojis Removed' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
  }

  // ── Section 3: Quest Sync ─────────────────────────────────────────────────
  const [pendingQuestSync, setPendingQuestSync] = useState<PendingChange[]>([]);
  const [applyingQuestSync, setApplyingQuestSync] = useState(false);

  function analyzeQuestSync() {
    const changes: PendingChange[] = [];
    for (const member of localMembers) {
      const f = parseFlair(member.flair);
      const target = (f.hasGoldEmoji || f.hasGemEmoji || f.hasTrophyEmoji) ? true : false;
      if (member.participateInClanQuests === target) continue; // already correct
      changes.push({
        memberId: member.playerId,
        username: member.username,
        oldFlair: member.participateInClanQuests ? '✅ Participating' : '⛔ Not Participating',
        newFlair: target ? '✅ Participating' : '⛔ Not Participating',
      });
    }
    if (changes.length === 0) {
      toast({ title: 'Already in Sync', description: 'All members are already set correctly based on their flair.' });
    } else {
      setPendingQuestSync(changes);
    }
  }

  async function applyQuestSync() {
    if (!pendingQuestSync.length) return;
    setApplyingQuestSync(true);
    let success = 0; let fail = 0;
    const updated = [...localMembers];
    for (const change of pendingQuestSync) {
      const f = parseFlair(localMembers.find(m => m.playerId === change.memberId)?.flair);
      const target = (f.hasGoldEmoji || f.hasGemEmoji || f.hasTrophyEmoji) ? true : false;
      try {
        await updateMemberQuestParticipation(clanId, change.memberId, target);
        const idx = updated.findIndex((m) => m.playerId === change.memberId);
        if (idx !== -1) updated[idx] = { ...updated[idx], participateInClanQuests: target };
        success++;
      } catch { fail++; }
    }
    setLocalMembers(updated); setPendingQuestSync([]); setApplyingQuestSync(false);
    toast({ title: fail === 0 ? 'Quest Sync Complete' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
  }

  // ── Section 4: Ledger & Log ───────────────────────────────────────────────
  const latestFlairEdited = useMemo(() => {
    if (!logs.length) return null;
    const edits = logs.filter((l) => l.action === 'FLAIR_EDITED');
    if (!edits.length) return null;
    return [...edits].sort((a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime())[0].creationTime;
  }, [logs]);

  const defaultsSet = useRef(false);
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');

  useEffect(() => {
    if (!logsLoading && !defaultsSet.current) {
      setEndDateTime(nowAsLocalDatetimeInput());
      if (latestFlairEdited) setStartDateTime(toLocalDatetimeInputValue(latestFlairEdited));
      defaultsSet.current = true;
    }
  }, [logsLoading, latestFlairEdited]);

  const [pendingLedgerChanges, setPendingLedgerChanges] = useState<PendingChange[]>([]);
  const [applyingLedger, setApplyingLedger] = useState(false);

  function processLedgerForFlairUpdate() {
    const startUTC = startDateTime ? fromLocalDatetimeInputToUTC(startDateTime).getTime() : 0;
    const endUTC = endDateTime ? fromLocalDatetimeInputToUTC(endDateTime).getTime() : Infinity;

    const donations = ledger.filter((e) => {
      if (e.type !== 'DONATE') return false;
      const t = new Date(e.creationTime).getTime();
      return t >= startUTC && t <= endUTC;
    });

    if (!donations.length) {
      toast({ title: 'No Donations Found', description: 'No DONATE entries in the selected range.' });
      return;
    }

    const sums: Record<string, { gold: number; gems: number; username: string }> = {};
    for (const entry of donations) {
      if (!entry.playerId) continue;
      if (!sums[entry.playerId]) sums[entry.playerId] = { gold: 0, gems: 0, username: entry.playerUsername || entry.playerId };
      sums[entry.playerId].gold += entry.gold ?? 0;
      sums[entry.playerId].gems += entry.gems ?? 0;
    }

    const changes: PendingChange[] = [];
    for (const [pid, sum] of Object.entries(sums)) {
      if (sum.gold === 0 && sum.gems === 0) continue;
      const member = localMembers.find((m) => m.playerId === pid);
      if (!member) continue;
      const f = parseFlair(member.flair);
      const newCoins = f.coins + sum.gold;
      const newGems = f.gems + sum.gems;

      // Determine emoji to carry: keep existing, but remove ⚠️ if new value > 0
      let emoji = '';
      if (f.hasGoldEmoji) emoji = '📙';
      else if (f.hasGemEmoji) emoji = '📘';
      else if (f.hasOptoutEmoji) emoji = '📕';
      else if (f.hasTrophyEmoji) emoji = '🏆';
      else if (f.hasWarningEmoji && (newCoins <= 0 && newGems <= 0)) emoji = '⚠️';
      // If ⚠️ was there but new value > 0: remove it (don't include in emoji)

      const newFlair = buildFlairString(newCoins, newGems, emoji, {
        retainZeroCoins: f.coins === 0 && sum.gold === 0,
        retainZeroGems: f.gems === 0 && sum.gems === 0,
      });
      if (newFlair !== (member.flair || '')) {
        changes.push({ memberId: pid, username: member.username, oldFlair: member.flair || '', newFlair });
      }
    }

    if (changes.length === 0) toast({ title: 'No Changes', description: 'No flair updates needed from donations.' });
    else setPendingLedgerChanges(changes);
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
    setLocalMembers(updated); setPendingLedgerChanges([]); setApplyingLedger(false);
    toast({ title: fail === 0 ? 'Flair Updated from Ledger' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
  }

  // Ledger/Log browse filters
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState<'all' | 'DONATE'>('all');
  const [logActionFilter, setLogActionFilter] = useState<'all' | 'FLAIR_EDITED' | 'quest'>('all');

  const filteredLedger = useMemo(() => ledgerTypeFilter === 'DONATE' ? ledger.filter((e) => e.type === 'DONATE') : ledger, [ledger, ledgerTypeFilter]);
  const filteredLogs = useMemo(() => {
    if (logActionFilter === 'FLAIR_EDITED') return logs.filter((e) => e.action === 'FLAIR_EDITED');
    if (logActionFilter === 'quest') return logs.filter((e) => e.action.includes('QUEST_PARTICIPATION'));
    return logs;
  }, [logs, logActionFilter]);

  // CSV export
  function downloadCsv(rows: (string | number)[][], filename: string) {
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  function exportMembers() {
    downloadCsv([['Username', 'Level', 'Flair', 'Quest Status', 'Last Online'],
      ...localMembers.map((m) => [m.username, m.level, m.flair || '', m.participateInClanQuests ? 'Participating' : 'Not Participating', m.lastOnline ? formatDateTimeGMT7(m.lastOnline) : ''])
    ], `${clanName}_members.csv`);
  }
  function exportLedger() {
    downloadCsv([['Time (GMT+7)', 'Type', 'Player', 'Gold', 'Gems', 'Comment'],
      ...filteredLedger.map((e) => [formatDateTimeGMT7(e.creationTime), e.type, e.playerUsername || '', e.gold ?? 0, e.gems ?? 0, e.comment || ''])
    ], `${clanName}_ledger.csv`);
  }
  function exportLogs() {
    downloadCsv([['Time (GMT+7)', 'Action', 'Player/Bot', 'Target'],
      ...filteredLogs.map((e) => [formatDateTimeGMT7(e.creationTime), e.action, e.playerUsername || e.playerBotOwnerUsername || '', e.targetPlayerUsername || ''])
    ], `${clanName}_logs.csv`);
  }

  return (
    <div className="min-h-screen bg-background">
      <NavHeader current="members" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Member Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{clanName}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchMembers()} disabled={membersFetching} data-testid="button-refresh-members">
              <RefreshCw className={`h-4 w-4 mr-1.5 ${membersFetching ? 'animate-spin' : ''}`} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/clans')} data-testid="button-back-to-clans">
              <ArrowLeft className="h-4 w-4 mr-1.5" />Back to Clans
            </Button>
          </div>
        </div>

        {/* ── Section 1: Member List ── */}
        <SectionCard
          header={<div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-primary-foreground font-semibold">
              <Users className="h-4 w-4" />
              <span>Clan Members</span>
              {!membersLoading && <span className="text-primary-foreground/70 text-sm font-normal">({localMembers.length})</span>}
            </div>
            <Button variant="ghost" size="sm" className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={exportMembers}>
              <Download className="h-4 w-4 mr-1.5" />Export CSV
            </Button>
          </div>}
          headerColor="bg-primary"
        >
          {membersLoading && <div className="p-4 space-y-2">{[1,2,3,4,5].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div>}
          {membersError && <div className="p-4"><Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertDescription>Failed to load members.</AlertDescription></Alert></div>}
          {!membersLoading && !membersError && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Username</TableHead><TableHead>Level</TableHead><TableHead>Flair</TableHead>
                    <TableHead>Quest Status</TableHead><TableHead className="hidden lg:table-cell">Last Online (GMT+7)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localMembers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No members found.</TableCell></TableRow>
                  ) : localMembers.map((member) => (
                    <TableRow key={member.playerId} className="border-border" data-testid={`row-member-${member.playerId}`}>
                      <TableCell className="font-medium">{member.username}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">Lv {member.level}</Badge></TableCell>
                      <TableCell className="font-mono text-xs max-w-[180px] truncate">{member.flair || <span className="text-muted-foreground italic font-sans">—</span>}</TableCell>
                      <TableCell>
                        {member.participateInClanQuests
                          ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">Participating</Badge>
                          : <Badge variant="outline" className="text-muted-foreground text-xs">Not Participating</Badge>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{member.lastOnline ? formatDateTimeGMT7(member.lastOnline) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>

        {/* ── Section 2: Flair Deduction Engine ── */}
        <SectionCard header={<><Zap className="h-4 w-4" /><span className="font-semibold">Flair Deduction Engine</span></>} headerColor="bg-amber-500 dark:bg-amber-600">
          <div className="p-5 space-y-4">
            <RadioGroup value={deductionMode} onValueChange={(v) => { setDeductionMode(v as DeductionMode); setPendingFlairChanges([]); }} className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <RadioGroupItem value="coin" id="coinMode" data-testid="radio-coin-mode" />
                <Label htmlFor="coinMode" className="flex items-center gap-2 flex-wrap cursor-pointer">
                  <span className="font-medium text-sm">Coin Mode:</span>
                  <span className="text-muted-foreground text-sm">Deduct</span>
                  <Input type="number" value={coinAmount} onChange={(e) => setCoinAmount(parseInt(e.target.value)||0)} onClick={()=>setDeductionMode('coin')} className="w-20 h-7 text-sm px-2" min={1} max={9999} data-testid="input-coin-amount"/>
                  <span className="text-muted-foreground text-sm">© from flair, add 📙</span>
                </Label>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <RadioGroupItem value="gem" id="gemMode" data-testid="radio-gem-mode" />
                <Label htmlFor="gemMode" className="flex items-center gap-2 flex-wrap cursor-pointer">
                  <span className="font-medium text-sm">Gem Mode:</span>
                  <span className="text-muted-foreground text-sm">Deduct</span>
                  <Input type="number" value={gemAmount} onChange={(e) => setGemAmount(parseInt(e.target.value)||0)} onClick={()=>setDeductionMode('gem')} className="w-20 h-7 text-sm px-2" min={1} max={9999} data-testid="input-gem-amount"/>
                  <span className="text-muted-foreground text-sm">G from flair, add 📘</span>
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Info className="h-3.5 w-3.5"/>Members with 📙 📘 📕 🏆 are skipped. Result of 0© or 0G is retained.</p>
            <Button onClick={analyzeFlairChanges} variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20" data-testid="button-analyze-flair">
              <Filter className="h-4 w-4 mr-2"/>Analyze &amp; Preview Changes
            </Button>
            {pendingFlairChanges.length > 0 && <PendingChangesPanel title={`Pending Changes — ${pendingFlairChanges.length} member(s)`} changes={pendingFlairChanges} applying={applyingFlair} onApply={applyFlairChanges} onDeny={()=>setPendingFlairChanges([])} applyLabel="Apply Changes" colorClass="amber"/>}
          </div>
        </SectionCard>

        {/* ── Section 2b: Emoji Removal ── */}
        <SectionCard header={<><Eraser className="h-4 w-4"/><span className="font-semibold">Emoji Removal Tool</span></>} headerColor="bg-destructive">
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">Remove all emojis (📙 📘 📕 ⚠️ 🏆) from member flairs.</p>
            <Button onClick={analyzeEmojiRemoval} variant="outline" className="border-red-300 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20" data-testid="button-analyze-emoji">
              <Filter className="h-4 w-4 mr-2"/>Preview Emoji Removal
            </Button>
            {pendingEmojiRemovals.length > 0 && <PendingChangesPanel title={`Members affected — ${pendingEmojiRemovals.length}`} changes={pendingEmojiRemovals} applying={applyingEmoji} onApply={applyEmojiRemoval} onDeny={()=>setPendingEmojiRemovals([])} applyLabel="Remove All Emojis" colorClass="red"/>}
          </div>
        </SectionCard>

        {/* ── Section 3: Quest Sync ── */}
        <SectionCard header={<><RefreshCw className="h-4 w-4"/><span className="font-semibold">Quest Participation Sync</span></>} headerColor="bg-sky-500 dark:bg-sky-600">
          <div className="p-5 space-y-4">
            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <p className="text-sm font-medium mb-2">Automatic Logic:</p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-1.5"><span>📙</span><span className="text-muted-foreground">or</span><span>📘</span><span className="text-muted-foreground">or</span><span>🏆</span><span className="text-muted-foreground">→</span><Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 text-xs">true</Badge></li>
                  <li className="flex items-center gap-1.5"><span>📕</span><span className="text-muted-foreground">or</span><span>⚠️</span><span className="text-muted-foreground">or no emoji →</span><Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-300 text-xs">false (if currently true)</Badge></li>
                </ul>
              </div>
              <div className="flex items-end">
                <Button onClick={analyzeQuestSync} disabled={applyingQuestSync} className="w-full bg-sky-500 hover:bg-sky-600 text-white" data-testid="button-sync-quests">
                  <Filter className="h-4 w-4 mr-2"/>Preview Sync Changes
                </Button>
              </div>
            </div>
            {pendingQuestSync.length > 0 && (
              <PendingChangesPanel
                title={`Quest Sync — ${pendingQuestSync.length} member(s) will change`}
                changes={pendingQuestSync}
                applying={applyingQuestSync}
                onApply={applyQuestSync}
                onDeny={() => setPendingQuestSync([])}
                applyLabel="Apply Sync"
                colorClass="blue"
              />
            )}
          </div>
        </SectionCard>

        {/* ── Section 4: Ledger & Log ── */}
        <SectionCard
          header={<div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-primary-foreground font-semibold"><BookOpen className="h-4 w-4"/><span>Ledger &amp; Log Management</span></div>
            <Button variant="ghost" size="sm" className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={()=>{refetchLedger();refetchLogs();}} disabled={ledgerFetching||logsFetching}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${(ledgerFetching||logsFetching)?'animate-spin':''}`}/>Refresh
            </Button>
          </div>}
          headerColor="bg-primary"
        >
          <div className="p-5 space-y-5">
            {/* Latest FLAIR_EDITED indicator */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 px-4 py-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0"/>
              <div className="text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-300">Latest FLAIR_EDITED: </span>
                {logsLoading ? <span className="text-muted-foreground">Loading...</span>
                  : latestFlairEdited ? <span className="font-mono text-xs text-blue-700 dark:text-blue-300">{formatDateTimeGMT7(latestFlairEdited)} GMT+7</span>
                  : <span className="text-muted-foreground italic">No flair edits found</span>}
              </div>
            </div>

            {/* Update Flair from Ledger */}
            <div className="rounded-lg border border-border p-4 space-y-4">
              <div>
                <p className="text-sm font-medium flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground"/>Update Flair from Ledger Donations</p>
                <p className="text-xs text-muted-foreground mt-1">Reads <code className="bg-muted px-1 py-0.5 rounded text-xs">DONATE</code> entries in the time range and adds gold/gems to member flairs. Removes ⚠️ if value becomes &gt; 0.</p>
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Start Time (GMT+7)</Label>
                  <Input type="datetime-local" value={startDateTime} onChange={(e)=>setStartDateTime(e.target.value)} className="h-8 text-sm w-52" data-testid="input-start-datetime"/>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">End Time (GMT+7)</Label>
                  <Input type="datetime-local" value={endDateTime} onChange={(e)=>setEndDateTime(e.target.value)} className="h-8 text-sm w-52" data-testid="input-end-datetime"/>
                </div>
                <Button onClick={processLedgerForFlairUpdate} className="h-8 bg-primary hover:bg-primary/90" data-testid="button-update-flair-from-ledger">
                  <Zap className="h-4 w-4 mr-1.5"/>Update Flair
                </Button>
              </div>
              {pendingLedgerChanges.length > 0 && <PendingChangesPanel title={`Pending Flair Updates — ${pendingLedgerChanges.length} member(s)`} changes={pendingLedgerChanges} applying={applyingLedger} onApply={applyLedgerChanges} onDeny={()=>setPendingLedgerChanges([])} applyLabel="Apply All Updates" colorClass="blue"/>}
            </div>

            {/* Browse Tabs */}
            <Tabs defaultValue="ledger">
              <TabsList>
                <TabsTrigger value="ledger" data-testid="tab-ledger"><BookOpen className="h-4 w-4 mr-1.5"/>Ledger</TabsTrigger>
                <TabsTrigger value="logs" data-testid="tab-logs"><FileText className="h-4 w-4 mr-1.5"/>Logs</TabsTrigger>
              </TabsList>
              <TabsContent value="ledger" className="mt-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant={ledgerTypeFilter==='all'?'default':'outline'} onClick={()=>setLedgerTypeFilter('all')}>All</Button>
                    <Button size="sm" variant={ledgerTypeFilter==='DONATE'?'default':'outline'} onClick={()=>setLedgerTypeFilter('DONATE')}>Donations</Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportLedger}><Download className="h-4 w-4 mr-1.5"/>Export CSV</Button>
                </div>
                {ledgerLoading ? <div className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div> : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader><TableRow className="border-border"><TableHead>Time (GMT+7)</TableHead><TableHead>Type</TableHead><TableHead>Player</TableHead><TableHead>Gold</TableHead><TableHead>Gems</TableHead><TableHead>Comment</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filteredLedger.length===0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No entries.</TableCell></TableRow>
                          : filteredLedger.slice(0,100).map((e,i)=>(
                            <TableRow key={e.id||i} className="border-border">
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeGMT7(e.creationTime)}</TableCell>
                              <TableCell><Badge variant={e.type==='DONATE'?'default':'secondary'} className="text-xs">{e.type}</Badge></TableCell>
                              <TableCell className="text-sm">{e.playerUsername||'—'}</TableCell>
                              <TableCell className="text-sm font-mono text-yellow-600 dark:text-yellow-400">{e.gold?`${e.gold}©`:'—'}</TableCell>
                              <TableCell className="text-sm font-mono text-blue-600 dark:text-blue-400">{e.gems?`${e.gems}G`:'—'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={e.comment||undefined}>{e.comment||'—'}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {filteredLedger.length>100 && <p className="text-center text-xs text-muted-foreground py-2">Showing 100 of {filteredLedger.length}. Export for all.</p>}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="logs" className="mt-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant={logActionFilter==='all'?'default':'outline'} onClick={()=>setLogActionFilter('all')}>All</Button>
                    <Button size="sm" variant={logActionFilter==='FLAIR_EDITED'?'default':'outline'} onClick={()=>setLogActionFilter('FLAIR_EDITED')}>Flair Edited</Button>
                    <Button size="sm" variant={logActionFilter==='quest'?'default':'outline'} onClick={()=>setLogActionFilter('quest')}>Quest</Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportLogs}><Download className="h-4 w-4 mr-1.5"/>Export CSV</Button>
                </div>
                {logsLoading ? <div className="space-y-2">{[1,2,3].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div> : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader><TableRow className="border-border"><TableHead>Time (GMT+7)</TableHead><TableHead>Action</TableHead><TableHead>Player/Bot</TableHead><TableHead>Target</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {filteredLogs.length===0 ? <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No entries.</TableCell></TableRow>
                          : filteredLogs.slice(0,100).map((e,i)=>(
                            <TableRow key={e.id||i} className="border-border">
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeGMT7(e.creationTime)}</TableCell>
                              <TableCell><Badge variant={e.action==='FLAIR_EDITED'?'default':'outline'} className="text-xs whitespace-nowrap">{e.action}</Badge></TableCell>
                              <TableCell className="text-sm">{e.playerUsername||e.playerBotOwnerUsername||'—'}</TableCell>
                              <TableCell className="text-sm">{e.targetPlayerUsername||'—'}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {filteredLogs.length>100 && <p className="text-center text-xs text-muted-foreground py-2">Showing 100 of {filteredLogs.length}. Export for all.</p>}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Shared Section Card ────────────────────────────────────────────────────
function SectionCard({ header, headerColor, children }: { header: React.ReactNode; headerColor: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
      <div className={`${headerColor} text-white px-5 py-3 flex items-center gap-2`}>{header}</div>
      {children}
    </div>
  );
}
