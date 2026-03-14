import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  Shield, RefreshCw, LogOut, ArrowLeft, Users, Zap, Eraser,
  BookOpen, FileText, Check, X, Loader2, AlertCircle, Filter,
  Download, Info,
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
  getClanLedger, getClanLog, parseFlair, buildFlairString, removeEmojisFromFlair,
  formatDateTimeGMT7, toUTCDate,
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

  // Members data
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

  // Ledger data
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

  // Log data
  const {
    data: logs = [],
    isLoading: logsLoading,
    refetch: refetchLogs,
    isFetching: logsFetching,
  } = useQuery<LogEntry[]>({
    queryKey: ['clan-logs', clanId],
    queryFn: () => getClanLog(clanId),
    enabled: !!clanId,
    retry: 1,
  });

  // Flair Deduction Engine state
  const [deductionMode, setDeductionMode] = useState<DeductionMode>('coin');
  const [coinAmount, setCoinAmount] = useState(600);
  const [gemAmount, setGemAmount] = useState(180);
  const [pendingFlairChanges, setPendingFlairChanges] = useState<PendingChange[]>([]);
  const [applyingFlair, setApplyingFlair] = useState(false);

  // Emoji Removal state
  const [pendingEmojiRemovals, setPendingEmojiRemovals] = useState<PendingChange[]>([]);
  const [applyingEmoji, setApplyingEmoji] = useState(false);

  // Quest Sync state
  const [syncingQuests, setSyncingQuests] = useState(false);

  // Ledger/Log filter state
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'donations'>('all');
  const [logFilter, setLogFilter] = useState<'all' | 'flair' | 'quest'>('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Local members state (for optimistic updates)
  const [localMembers, setLocalMembers] = useState<Member[]>([]);
  useEffect(() => {
    setLocalMembers(members);
  }, [members]);

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  // ─── Flair Deduction Engine ────────────────────────────────────────────────
  function analyzeFlairChanges() {
    const changes: PendingChange[] = [];
    localMembers.forEach((member) => {
      const flair = parseFlair(member.flair);
      if (flair.hasGoldEmoji || flair.hasGemEmoji || flair.hasOptoutEmoji) return;

      let newFlair = '';
      if (deductionMode === 'coin' && flair.coins >= coinAmount) {
        newFlair = buildFlairString(flair.coins - coinAmount, flair.gems, '📙');
      } else if (deductionMode === 'gem' && flair.gems >= gemAmount) {
        newFlair = buildFlairString(flair.coins, flair.gems - gemAmount, '📘');
      }

      if (newFlair !== '') {
        changes.push({
          memberId: member.playerId,
          username: member.username,
          oldFlair: member.flair || '',
          newFlair,
        });
      }
    });

    if (changes.length === 0) {
      toast({ title: 'No Changes', description: 'No members qualify for flair deduction.' });
    } else {
      setPendingFlairChanges(changes);
    }
  }

  async function applyFlairChanges() {
    if (!pendingFlairChanges.length) return;
    setApplyingFlair(true);
    let success = 0;
    let fail = 0;
    const updated = [...localMembers];
    for (const change of pendingFlairChanges) {
      try {
        await updateMemberFlair(clanId, change.memberId, change.newFlair);
        const idx = updated.findIndex((m) => m.playerId === change.memberId);
        if (idx !== -1) updated[idx] = { ...updated[idx], flair: change.newFlair };
        success++;
      } catch {
        fail++;
      }
    }
    setLocalMembers(updated);
    setPendingFlairChanges([]);
    setApplyingFlair(false);
    toast({
      title: fail === 0 ? 'Flair Updated' : 'Partial Success',
      description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
  }

  // ─── Emoji Removal ────────────────────────────────────────────────────────
  function analyzeEmojiRemoval() {
    const removals: PendingChange[] = [];
    localMembers.forEach((member) => {
      const flair = parseFlair(member.flair);
      if (flair.hasGoldEmoji || flair.hasGemEmoji || flair.hasOptoutEmoji) {
        const newFlair = removeEmojisFromFlair(member.flair);
        removals.push({
          memberId: member.playerId,
          username: member.username,
          oldFlair: member.flair || '',
          newFlair,
        });
      }
    });

    if (removals.length === 0) {
      toast({ title: 'No Emojis', description: 'No members have emojis to remove.' });
    } else {
      setPendingEmojiRemovals(removals);
    }
  }

  async function applyEmojiRemoval() {
    if (!pendingEmojiRemovals.length) return;
    setApplyingEmoji(true);
    let success = 0;
    let fail = 0;
    const updated = [...localMembers];
    for (const change of pendingEmojiRemovals) {
      try {
        await updateMemberFlair(clanId, change.memberId, change.newFlair);
        const idx = updated.findIndex((m) => m.playerId === change.memberId);
        if (idx !== -1) updated[idx] = { ...updated[idx], flair: change.newFlair };
        success++;
      } catch {
        fail++;
      }
    }
    setLocalMembers(updated);
    setPendingEmojiRemovals([]);
    setApplyingEmoji(false);
    toast({
      title: fail === 0 ? 'Emojis Removed' : 'Partial Success',
      description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
  }

  // ─── Quest Sync ──────────────────────────────────────────────────────────
  async function syncAllQuests() {
    setSyncingQuests(true);
    let success = 0;
    let fail = 0;
    const updated = [...localMembers];

    for (const member of localMembers) {
      const flair = parseFlair(member.flair);
      let target: boolean;

      if (flair.hasGoldEmoji || flair.hasGemEmoji) {
        target = true;
      } else if (flair.hasOptoutEmoji) {
        target = false;
      } else {
        target = false;
      }

      if (member.participateInClanQuests !== target) {
        try {
          await updateMemberQuestParticipation(clanId, member.playerId, target);
          const idx = updated.findIndex((m) => m.playerId === member.playerId);
          if (idx !== -1) updated[idx] = { ...updated[idx], participateInClanQuests: target };
          success++;
        } catch {
          fail++;
        }
      }
    }

    setLocalMembers(updated);
    setSyncingQuests(false);
    toast({
      title: fail === 0 ? 'Quest Sync Complete' : 'Partial Success',
      description: success === 0 ? 'All members already in sync.' : `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
  }

  // ─── Ledger Filtering ────────────────────────────────────────────────────
  const filteredLedger = useCallback(() => {
    let entries = [...ledger];
    if (ledgerFilter === 'donations') {
      entries = entries.filter((e) =>
        (e.type || '').toLowerCase().includes('donat') ||
        (e.type || '').toLowerCase().includes('gold') ||
        (e.type || '').toLowerCase().includes('coin') ||
        (e.type || '').toLowerCase().includes('gem')
      );
    }
    if (startDateFilter) {
      const start = toUTCDate(startDateFilter).getTime();
      entries = entries.filter((e) => new Date(e.creationTime).getTime() >= start);
    }
    if (endDateFilter) {
      const end = toUTCDate(endDateFilter + 'T23:59:59').getTime();
      entries = entries.filter((e) => new Date(e.creationTime).getTime() <= end);
    }
    return entries;
  }, [ledger, ledgerFilter, startDateFilter, endDateFilter]);

  // ─── Log Filtering ────────────────────────────────────────────────────────
  const filteredLogs = useCallback(() => {
    let entries = [...logs];
    if (logFilter === 'flair') {
      entries = entries.filter((e) => (e.type || '').toLowerCase().includes('flair'));
    } else if (logFilter === 'quest') {
      entries = entries.filter((e) => (e.type || '').toLowerCase().includes('quest'));
    }
    if (startDateFilter) {
      const start = toUTCDate(startDateFilter).getTime();
      entries = entries.filter((e) => new Date(e.creationTime).getTime() >= start);
    }
    if (endDateFilter) {
      const end = toUTCDate(endDateFilter + 'T23:59:59').getTime();
      entries = entries.filter((e) => new Date(e.creationTime).getTime() <= end);
    }
    return entries;
  }, [logs, logFilter, startDateFilter, endDateFilter]);

  // ─── Export ──────────────────────────────────────────────────────────────
  function exportMembers() {
    const rows = [
      ['Username', 'Level', 'Flair', 'Quest Status', 'Coins', 'Gems', 'Emoji', 'Join Date', 'Last Online'],
      ...localMembers.map((m) => {
        const f = parseFlair(m.flair);
        const emoji = f.hasGoldEmoji ? '📙' : f.hasGemEmoji ? '📘' : f.hasOptoutEmoji ? '📕' : '';
        return [
          m.username, m.level,
          m.flair || '',
          m.participateInClanQuests ? 'Participating' : 'Not Participating',
          f.coins, f.gems, emoji,
          m.joinDate ? formatDateTimeGMT7(m.joinDate) : '',
          m.lastOnline ? formatDateTimeGMT7(m.lastOnline) : '',
        ];
      }),
    ];
    downloadCsv(rows, `${clanName}_members.csv`);
  }

  function exportLedger() {
    const entries = filteredLedger();
    const rows = [
      ['Time (GMT+7)', 'Type', 'Player', 'Amount', 'Coins', 'Gems', 'Message'],
      ...entries.map((e) => [
        formatDateTimeGMT7(e.creationTime),
        e.type || '',
        e.username || e.senderUsername || '',
        e.amount ?? '',
        e.coins ?? '',
        e.gems ?? '',
        e.message || e.description || '',
      ]),
    ];
    downloadCsv(rows, `${clanName}_ledger.csv`);
  }

  function exportLogs() {
    const entries = filteredLogs();
    const rows = [
      ['Time (GMT+7)', 'Type', 'Player', 'Target', 'Old Flair', 'New Flair', 'Message'],
      ...entries.map((e) => [
        formatDateTimeGMT7(e.creationTime),
        e.type || '',
        e.username || '',
        e.targetUsername || '',
        e.oldFlair || '',
        e.newFlair || '',
        e.message || '',
      ]),
    ];
    downloadCsv(rows, `${clanName}_logs.csv`);
  }

  function downloadCsv(rows: (string | number)[][], filename: string) {
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Flair badge helper ──────────────────────────────────────────────────
  function FlairBadge({ flair }: { flair: string | null }) {
    const f = parseFlair(flair);
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className="font-mono text-xs text-foreground">{flair || <span className="text-muted-foreground italic">none</span>}</span>
        {f.hasGoldEmoji && <span title="Coin Paid" className="text-sm">📙</span>}
        {f.hasGemEmoji && <span title="Gem Paid" className="text-sm">📘</span>}
        {f.hasOptoutEmoji && <span title="Opted Out" className="text-sm">📕</span>}
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Wolvesville Clan Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
              <span className="hover:text-foreground cursor-pointer px-2 py-1 rounded transition-colors" onClick={() => navigate('/')}>Authentication</span>
              <span className="hover:text-foreground cursor-pointer px-2 py-1 rounded transition-colors" onClick={() => navigate('/clans')}>Clan Selection</span>
              <span className="text-primary font-medium px-2 py-1">Members</span>
            </nav>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground" data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Member Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{clanName}</p>
          </div>
          <div className="flex items-center gap-2">
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

        {/* ── Section 1: Member List ── */}
        <section className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
          <div className="bg-primary px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary-foreground font-semibold">
              <Users className="h-4 w-4" />
              Clan Members
              {!membersLoading && <span className="text-primary-foreground/70 text-sm font-normal">({localMembers.length})</span>}
            </div>
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={exportMembers} data-testid="button-export-members">
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>

          {membersLoading && (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {membersError && (
            <div className="p-5">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Failed to load members. Check your connection.</AlertDescription>
              </Alert>
            </div>
          )}

          {!membersLoading && !membersError && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Flair</TableHead>
                    <TableHead>Quest Status</TableHead>
                    <TableHead className="hidden md:table-cell">Last Online</TableHead>
                    <TableHead className="hidden lg:table-cell">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No members found.</TableCell>
                    </TableRow>
                  ) : localMembers.map((member) => (
                    <TableRow key={member.playerId} data-testid={`row-member-${member.playerId}`}>
                      <TableCell className="font-medium">{member.username}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">Lv {member.level}</Badge>
                      </TableCell>
                      <TableCell><FlairBadge flair={member.flair} /></TableCell>
                      <TableCell>
                        {member.participateInClanQuests ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">Participating</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">Not Participating</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {member.lastOnline ? formatDateTimeGMT7(member.lastOnline) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {member.joinDate ? formatDateTimeGMT7(member.joinDate) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* ── Section 2: Flair Deduction Engine ── */}
        <section className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
          <div className="bg-amber-500 px-5 py-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-white" />
            <span className="font-semibold text-white">Flair Deduction Engine</span>
          </div>
          <div className="p-5 space-y-4">
            <RadioGroup value={deductionMode} onValueChange={(v) => { setDeductionMode(v as DeductionMode); setPendingFlairChanges([]); }} className="space-y-3">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="coin" id="coinMode" data-testid="radio-coin-mode" />
                <Label htmlFor="coinMode" className="flex items-center gap-2 cursor-pointer">
                  <span className="font-medium">Coin Mode:</span>
                  <span className="text-muted-foreground text-sm">Deduct</span>
                  <Input
                    type="number"
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(parseInt(e.target.value) || 0)}
                    className="w-20 h-7 text-sm px-2"
                    min={1} max={9999}
                    data-testid="input-coin-amount"
                    onClick={(e) => { e.preventDefault(); setDeductionMode('coin'); }}
                  />
                  <span className="text-muted-foreground text-sm">© and add 📙</span>
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="gem" id="gemMode" data-testid="radio-gem-mode" />
                <Label htmlFor="gemMode" className="flex items-center gap-2 cursor-pointer">
                  <span className="font-medium">Gem Mode:</span>
                  <span className="text-muted-foreground text-sm">Deduct</span>
                  <Input
                    type="number"
                    value={gemAmount}
                    onChange={(e) => setGemAmount(parseInt(e.target.value) || 0)}
                    className="w-20 h-7 text-sm px-2"
                    min={1} max={9999}
                    data-testid="input-gem-amount"
                    onClick={(e) => { e.preventDefault(); setDeductionMode('gem'); }}
                  />
                  <span className="text-muted-foreground text-sm">G and add 📘</span>
                </Label>
              </div>
            </RadioGroup>

            <Button onClick={analyzeFlairChanges} variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20" data-testid="button-analyze-flair">
              <Filter className="h-4 w-4 mr-2" />
              Analyze & Preview Changes
            </Button>

            {pendingFlairChanges.length > 0 && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                  Pending Changes ({pendingFlairChanges.length} members)
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {pendingFlairChanges.map((c) => (
                    <div key={c.memberId} className="text-sm flex items-center gap-2 py-1">
                      <span className="font-medium min-w-[120px]">{c.username}:</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.oldFlair || 'empty'}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-xs text-foreground">{c.newFlair}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={applyFlairChanges} disabled={applyingFlair} className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-apply-flair-changes">
                    {applyingFlair ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                    Apply Changes
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingFlairChanges([])} disabled={applyingFlair} data-testid="button-deny-flair-changes">
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 3: Emoji Removal ── */}
        <section className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
          <div className="bg-destructive px-5 py-3 flex items-center gap-2">
            <Eraser className="h-4 w-4 text-destructive-foreground" />
            <span className="font-semibold text-destructive-foreground">Emoji Removal Tool</span>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">Remove ALL emojis (📙 📘 📕) from member flairs.</p>
            <Button onClick={analyzeEmojiRemoval} variant="outline" className="border-red-300 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20" data-testid="button-analyze-emoji">
              <Filter className="h-4 w-4 mr-2" />
              Preview Emoji Removal
            </Button>

            {pendingEmojiRemovals.length > 0 && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">
                  Members to be affected ({pendingEmojiRemovals.length})
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {pendingEmojiRemovals.map((c) => (
                    <div key={c.memberId} className="text-sm flex items-center gap-2 py-1">
                      <span className="font-medium min-w-[120px]">{c.username}:</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.oldFlair}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-mono text-xs text-foreground">{c.newFlair || 'empty'}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={applyEmojiRemoval} disabled={applyingEmoji} className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-apply-emoji-removal">
                    {applyingEmoji ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
                    Remove All Emojis
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingEmojiRemovals([])} disabled={applyingEmoji} data-testid="button-cancel-emoji-removal">
                    <X className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 4: Quest Participation Sync ── */}
        <section className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
          <div className="bg-sky-500 px-5 py-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-white" />
            <span className="font-semibold text-white">Quest Participation Sync</span>
          </div>
          <div className="p-5">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Automatically sync quest participation based on flair status:</p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-base">📙</span><span>or</span><span className="text-base">📘</span>
                    <span className="text-muted-foreground">in flair →</span>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">Participate: true</Badge>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-base">📕</span>
                    <span className="text-muted-foreground">in flair →</span>
                    <Badge variant="destructive" className="text-xs">Participate: false</Badge>
                  </li>
                  <li className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">No emoji → turn off if currently on</span>
                  </li>
                </ul>
              </div>
              <div className="flex items-end">
                <Button onClick={syncAllQuests} disabled={syncingQuests} className="w-full bg-sky-500 hover:bg-sky-600 text-white" data-testid="button-sync-quests">
                  {syncingQuests ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Sync All to Quest</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 5: Ledger & Log Management ── */}
        <section className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden">
          <div className="bg-primary px-5 py-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-primary-foreground font-semibold">
              <BookOpen className="h-4 w-4" />
              Ledger & Log Management
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/10"
                onClick={() => { refetchLedger(); refetchLogs(); }}
                disabled={ledgerFetching || logsFetching}
                data-testid="button-refresh-data">
                <RefreshCw className={`h-4 w-4 mr-1.5 ${(ledgerFetching || logsFetching) ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Date Filter */}
            <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Start Date (GMT+7)</Label>
                <Input type="date" value={startDateFilter} onChange={(e) => setStartDateFilter(e.target.value)} className="h-8 text-sm w-40" data-testid="input-start-date" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">End Date (GMT+7)</Label>
                <Input type="date" value={endDateFilter} onChange={(e) => setEndDateFilter(e.target.value)} className="h-8 text-sm w-40" data-testid="input-end-date" />
              </div>
              {(startDateFilter || endDateFilter) && (
                <Button variant="outline" size="sm" onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }} data-testid="button-clear-date-filter">
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear Filter
                </Button>
              )}
            </div>

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
                    <Button size="sm" variant={ledgerFilter === 'all' ? 'default' : 'outline'} onClick={() => setLedgerFilter('all')} data-testid="button-filter-ledger-all">All</Button>
                    <Button size="sm" variant={ledgerFilter === 'donations' ? 'default' : 'outline'} onClick={() => setLedgerFilter('donations')} data-testid="button-filter-ledger-donations">Donations</Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportLedger} data-testid="button-export-ledger">
                    <Download className="h-4 w-4 mr-1.5" />
                    Export CSV
                  </Button>
                </div>

                {ledgerLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time (GMT+7)</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLedger().length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No ledger entries found.</TableCell></TableRow>
                        ) : filteredLedger().slice(0, 100).map((entry, i) => (
                          <TableRow key={entry.id || i} data-testid={`row-ledger-${i}`}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeGMT7(entry.creationTime)}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{entry.type}</Badge></TableCell>
                            <TableCell className="text-sm">{entry.username || entry.senderUsername || '—'}</TableCell>
                            <TableCell className="text-sm font-mono">
                              {entry.coins != null && <span className="text-yellow-600 dark:text-yellow-400">{entry.coins}©</span>}
                              {entry.gems != null && <span className="text-blue-600 dark:text-blue-400 ml-1">{entry.gems}G</span>}
                              {entry.amount != null && !entry.coins && !entry.gems && entry.amount}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{entry.message || entry.description || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredLedger().length > 100 && (
                      <div className="text-center text-xs text-muted-foreground py-2">Showing first 100 of {filteredLedger().length} entries. Export CSV for full data.</div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Logs Tab */}
              <TabsContent value="logs" className="mt-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex gap-2">
                    <Button size="sm" variant={logFilter === 'all' ? 'default' : 'outline'} onClick={() => setLogFilter('all')} data-testid="button-filter-logs-all">All</Button>
                    <Button size="sm" variant={logFilter === 'flair' ? 'default' : 'outline'} onClick={() => setLogFilter('flair')} data-testid="button-filter-logs-flair">Flair</Button>
                    <Button size="sm" variant={logFilter === 'quest' ? 'default' : 'outline'} onClick={() => setLogFilter('quest')} data-testid="button-filter-logs-quest">Quest</Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportLogs} data-testid="button-export-logs">
                    <Download className="h-4 w-4 mr-1.5" />
                    Export CSV
                  </Button>
                </div>

                {logsLoading ? (
                  <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time (GMT+7)</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead>Target</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs().length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No log entries found.</TableCell></TableRow>
                        ) : filteredLogs().slice(0, 100).map((entry, i) => (
                          <TableRow key={entry.id || i} data-testid={`row-log-${i}`}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTimeGMT7(entry.creationTime)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{entry.type}</Badge></TableCell>
                            <TableCell className="text-sm">{entry.username || '—'}</TableCell>
                            <TableCell className="text-sm">{entry.targetUsername || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-xs">
                              {entry.oldFlair && entry.newFlair ? (
                                <span className="font-mono">{entry.oldFlair} → {entry.newFlair}</span>
                              ) : entry.message || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredLogs().length > 100 && (
                      <div className="text-center text-xs text-muted-foreground py-2">Showing first 100 of {filteredLogs().length} entries. Export CSV for full data.</div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>
    </div>
  );
}
