import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Filter, Users, Trophy, ExternalLink, RefreshCw, Crown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  isAuthenticated, getSelectedClanId, getSelectedClanName,
  getClanMembers, getQuestHistory, getActiveQuest, updateMemberFlair,
  parseFlair, buildFlairString, formatDateTimeGMT7,
  type Member, type ClanQuest, type QuestParticipant,
} from '@/lib/wolvesville';
import { NavHeader } from '@/components/NavHeader';
import { PendingChangesPanel, type PendingChange } from '@/components/PendingChangesPanel';
import { useToast } from '@/hooks/use-toast';
import { sanitizeFlair } from '@/lib/sanitize';

const FEE_AMOUNT = 200;
const XP_THRESHOLD = 3000;

export default function QuestFeePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const clanId = getSelectedClanId() || '';
  const clanName = getSelectedClanName() || 'Unknown Clan';

  useEffect(() => { if (!isAuthenticated() || !clanId) navigate('/'); }, [navigate, clanId]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: members = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery<Member[]>({
    queryKey: ['clan-members', clanId], queryFn: () => getClanMembers(clanId), enabled: !!clanId, retry: 1,
  });
  const { data: history = [], isLoading: historyLoading, isError: historyError, refetch: refetchHistory, isFetching: historyFetching } = useQuery<ClanQuest[]>({
    queryKey: ['quest-history', clanId], queryFn: () => getQuestHistory(clanId), enabled: !!clanId, retry: 1,
  });
  const { data: activeQuest, isLoading: activeLoading } = useQuery<ClanQuest | null>({
    queryKey: ['active-quest', clanId], queryFn: () => getActiveQuest(clanId), enabled: !!clanId, retry: 1,
  });

  const [localMembers, setLocalMembers] = useState<Member[]>([]);
  useEffect(() => { setLocalMembers(members); }, [members]);

  // ── Latest Quest ──────────────────────────────────────────────────────────
  const latestQuest = useMemo<ClanQuest | null>(() => {
    if (!history.length) return null;
    return [...history].sort((a, b) => new Date(b.tierEndTime).getTime() - new Date(a.tierEndTime).getTime())[0];
  }, [history]);

  // Top participant by XP
  const topParticipant = useMemo<QuestParticipant | null>(() => {
    if (!latestQuest?.participants?.length) return null;
    return [...latestQuest.participants].sort((a, b) => b.xp - a.xp)[0];
  }, [latestQuest]);

  // Low-XP participants (< 3000) from the latest quest
  const lowXpParticipants = useMemo<QuestParticipant[]>(() => {
    if (!latestQuest) return [];
    return latestQuest.participants
      .filter((p) => p.xp < XP_THRESHOLD)
      .sort((a, b) => a.xp - b.xp);
  }, [latestQuest]);

  // ── Section 1: Fee Calculation ────────────────────────────────────────────
  const [pendingFeeChanges, setPendingFeeChanges] = useState<PendingChange[]>([]);
  const [applyingFee, setApplyingFee] = useState(false);

  function analyzeFeeChanges() {
    const changes: PendingChange[] = [];
    for (const participant of lowXpParticipants) {
      const member = localMembers.find((m) => m.playerId === participant.playerId);
      if (!member) continue;
      const f = parseFlair(sanitizeFlair(member.flair));
      const newCoins = f.coins - FEE_AMOUNT;
      const addWarning = newCoins < 0;
      const existingEmoji = f.hasGoldEmoji ? '📙' : f.hasGemEmoji ? '📘' : f.hasOptoutEmoji ? '📕' : f.hasTrophyEmoji ? '🏆' : f.hasWarningEmoji ? '⚠️' : '';
      const newEmoji = addWarning && !existingEmoji.includes('⚠️') ? '⚠️' : existingEmoji;
      const newFlair = buildFlairString(newCoins, f.gems, newEmoji, { retainZeroCoins: true });
      changes.push({ memberId: participant.playerId, username: participant.username, oldFlair: member.flair || '', newFlair });
    }
    if (changes.length === 0) toast({ title: 'No Members', description: 'No members to apply fee to.' });
    else setPendingFeeChanges(changes);
  }

  async function applyFeeChanges() {
    if (!pendingFeeChanges.length) return;
    setApplyingFee(true);
    let success = 0; let fail = 0;
    const updated = [...localMembers];
    for (const change of pendingFeeChanges) {
      try {
        await updateMemberFlair(clanId, change.memberId, change.newFlair);
        const idx = updated.findIndex((m) => m.playerId === change.memberId);
        if (idx !== -1) updated[idx] = { ...updated[idx], flair: change.newFlair };
        success++;
      } catch { fail++; }
    }
    setLocalMembers(updated); setPendingFeeChanges([]); setApplyingFee(false);
    toast({ title: fail === 0 ? 'Fee Applied' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
    refetchMembers();
  }

  // ── Section 2: TOP 1 QUEST ────────────────────────────────────────────────
  const [pendingTop1Changes, setPendingTop1Changes] = useState<PendingChange[]>([]);
  const [applyingTop1, setApplyingTop1] = useState(false);

  function analyzeTop1() {
    if (!topParticipant) {
      toast({ title: 'No Participants', description: 'No participants found in the latest quest.' });
      return;
    }

    const topMember = localMembers.find((m) => m.playerId === topParticipant.playerId);
    if (!topMember) {
      toast({ title: 'Member Not Found', description: `${topParticipant.username} is not in the current member list.` });
      return;
    }

    const topF = parseFlair(sanitizeFlair(topMember.flair));

    // If top member already has 🏆 → already correct, nothing to do
    if (topF.hasTrophyEmoji) {
      toast({ title: '🏆 Already Up to Date', description: `${topMember.username} already holds the trophy and still has the top XP.` });
      return;
    }

    const changes: PendingChange[] = [];

    // Remove 🏆 from everyone who currently holds it (they're no longer top)
    for (const member of localMembers) {
      if (member.playerId === topMember.playerId) continue;
      const f = parseFlair(sanitizeFlair(member.flair));
      if (!f.hasTrophyEmoji) continue;
      // Retain coins/gems but strip 🏆 — leave no emoji in its place
      const newFlair = buildFlairString(f.coins, f.gems, '', {
        retainZeroCoins: f.coins === 0 && f.raw.includes('©'),
        retainZeroGems: f.gems === 0 && f.raw.includes('G'),
      });
      changes.push({ memberId: member.playerId, username: member.username, oldFlair: member.flair || '', newFlair });
    }

    // Award 🏆 to the top member — replaces any existing emoji
    const newTopFlair = buildFlairString(topF.coins, topF.gems, '🏆', {
      retainZeroCoins: topF.coins === 0 && topF.raw.includes('©'),
      retainZeroGems: topF.gems === 0 && topF.raw.includes('G'),
    });
    changes.push({ memberId: topMember.playerId, username: topMember.username, oldFlair: topMember.flair || '', newFlair: newTopFlair });

    if (changes.length === 0) {
      toast({ title: 'No Changes', description: 'Nothing to update.' });
    } else {
      setPendingTop1Changes(changes);
    }
  }

  async function applyTop1Changes() {
    if (!pendingTop1Changes.length) return;
    setApplyingTop1(true);
    let success = 0; let fail = 0;
    const updated = [...localMembers];
    for (const change of pendingTop1Changes) {
      try {
        await updateMemberFlair(clanId, change.memberId, change.newFlair);
        const idx = updated.findIndex((m) => m.playerId === change.memberId);
        if (idx !== -1) updated[idx] = { ...updated[idx], flair: change.newFlair };
        success++;
      } catch { fail++; }
    }
    setLocalMembers(updated); setPendingTop1Changes([]); setApplyingTop1(false);
    toast({ title: fail === 0 ? '🏆 Trophy Updated' : 'Partial Success', description: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`, variant: fail > 0 ? 'destructive' : 'default' });
  }

  const isLoading = membersLoading || historyLoading || activeLoading;

  return (
    <div className="min-h-screen bg-background">
      <NavHeader current="quest-fee" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quest Fee</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{clanName} — Manage quest fees and trophy awards</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchHistory(); refetchMembers(); }} disabled={historyFetching} data-testid="button-refresh-quest-fee">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${historyFetching ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        {/* ── Active Quest Warning ── */}
        {activeLoading && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Checking quest status...</div>}
        {!activeLoading && activeQuest && (
          <Alert className="border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20" data-testid="alert-active-quest">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <AlertTitle className="text-orange-800 dark:text-orange-300">Warning: Quest is Active</AlertTitle>
            <AlertDescription className="text-orange-700 dark:text-orange-400">
              A quest is currently in progress. Please come back after it's finished.{' '}
              <button className="underline font-medium inline-flex items-center gap-1 hover:opacity-80" onClick={() => navigate('/quest-active')} data-testid="link-go-to-active-quest">
                Click here to view Active Quest <ExternalLink className="h-3.5 w-3.5"/>
              </button>
            </AlertDescription>
          </Alert>
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            <div className="bg-primary px-5 py-3"><div className="flex items-center gap-2 text-primary-foreground font-semibold"><Trophy className="h-4 w-4"/><span>Loading quest data...</span></div></div>
            <div className="p-4 space-y-2">{[1,2,3,4].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div>
          </div>
        )}

        {/* ── Error ── */}
        {historyError && !historyLoading && (
          <Alert variant="destructive"><AlertTriangle className="h-4 w-4"/><AlertDescription>Failed to load quest history.</AlertDescription></Alert>
        )}

        {/* ── Latest Quest Summary ── */}
        {!isLoading && latestQuest && (
          <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            <div className="bg-violet-600 px-5 py-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-white"/>
              <span className="font-semibold text-white">Latest Quest Reference</span>
            </div>
            <div className="p-5">
              <div className="flex flex-wrap gap-4 items-start">
                {latestQuest.quest.promoImageUrl && (
                  <img
                    src={latestQuest.quest.promoImageUrl}
                    alt="Quest promo"
                    className="w-40 h-24 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Stat label="Tier" value={latestQuest.tier} />
                  <Stat label="Total XP" value={latestQuest.xp.toLocaleString()} />
                  <Stat label="XP/Reward" value={latestQuest.xpPerReward.toLocaleString()} />
                  <Stat label="Type" value={latestQuest.quest.purchasableWithGems ? '💎 Gem Quest' : '🪙 Gold Quest'} />
                  <Stat label="Participants" value={latestQuest.participants.length} />
                  <Stat label="Status" value={latestQuest.tierFinished ? '✅ Finished' : '⏳ In Progress'} />
                  <div className="col-span-2 sm:col-span-3">
                    <p className="text-xs text-muted-foreground mb-0.5">Period (GMT+7)</p>
                    <p className="text-sm font-medium">{formatDateTimeGMT7(latestQuest.tierStartTime)} → {formatDateTimeGMT7(latestQuest.tierEndTime)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ SECTION 1: Low XP Members / Apply Fee ══ */}
        {!isLoading && latestQuest && (
          <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            <div className="bg-orange-500 dark:bg-orange-600 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Users className="h-4 w-4"/>
                <span>Section 1 — Members Below {XP_THRESHOLD.toLocaleString()} XP</span>
                <span className="text-white/70 text-sm font-normal">({lowXpParticipants.length})</span>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {lowXpParticipants.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-2"/>
                  <p className="text-muted-foreground text-sm">All participants reached {XP_THRESHOLD.toLocaleString()} XP. No fee applies!</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead>Username</TableHead>
                          <TableHead>XP Contributed</TableHead>
                          <TableHead>Current Flair</TableHead>
                          <TableHead>Current Balance (©)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowXpParticipants.map((p) => {
                          const member = localMembers.find((m) => m.playerId === p.playerId);
                          const f = parseFlair(sanitizeFlair(member?.flair));
                          const wouldGoNegative = f.coins - FEE_AMOUNT < 0;
                          return (
                            <TableRow key={p.playerId} className={`border-border ${wouldGoNegative ? 'bg-red-50/50 dark:bg-red-950/10' : ''}`} data-testid={`row-fee-${p.playerId}`}>
                              <TableCell className="font-medium">{p.username}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm">{p.xp.toLocaleString()}</span>
                                  <div className="flex-1 bg-muted rounded-full h-1.5 max-w-[80px]">
                                    <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: `${Math.min(100, (p.xp / XP_THRESHOLD) * 100)}%` }}/>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs">{member?.flair || <span className="italic text-muted-foreground font-sans">—</span>}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono text-sm ${wouldGoNegative ? 'text-red-600 dark:text-red-400' : ''}`}>{f.coins}©</span>
                                  {wouldGoNegative && <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-800 text-xs">⚠️ Would go negative</Badge>}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <Button
                    onClick={analyzeFeeChanges}
                    variant="outline"
                    className="border-orange-400 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                    data-testid="button-analyze-fee"
                  >
                    <Filter className="h-4 w-4 mr-2"/>
                    Preview Fee — Deduct {FEE_AMOUNT}© from each
                  </Button>

                  {pendingFeeChanges.length > 0 && (
                    <PendingChangesPanel
                      title={`Fee Changes — ${pendingFeeChanges.length} member(s)`}
                      changes={pendingFeeChanges}
                      applying={applyingFee}
                      onApply={applyFeeChanges}
                      onDeny={() => setPendingFeeChanges([])}
                      applyLabel="Apply Fee"
                      colorClass="orange"
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ SECTION 2: TOP 1 QUEST Trophy ══ */}
        {!isLoading && latestQuest && (
          <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
            <div className="bg-yellow-500 dark:bg-yellow-600 px-5 py-3 flex items-center gap-2">
              <Crown className="h-4 w-4 text-white"/>
              <span className="font-semibold text-white">Section 2 — TOP 1 QUEST 🏆</span>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Award the <span className="font-semibold text-foreground">🏆 trophy</span> to the member with the highest XP in the latest quest.
                The trophy replaces their current emoji. Previous trophy holders lose it.
                If the current top member already has 🏆, nothing changes.
              </p>

              {/* Top participant preview */}
              {topParticipant && (() => {
                const topMember = localMembers.find(m => m.playerId === topParticipant.playerId);
                const topF = parseFlair(sanitizeFlair(topMember?.flair));
                const alreadyHasTrophy = topF.hasTrophyEmoji;
                return (
                  <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${alreadyHasTrophy ? 'border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20' : 'border-border bg-muted/30'}`}>
                    <span className="text-2xl">🏆</span>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{topParticipant.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {topParticipant.xp.toLocaleString()} XP · Current flair: <span className="font-mono">{topMember?.flair || '—'}</span>
                      </p>
                    </div>
                    {alreadyHasTrophy
                      ? <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300 gap-1"><Check className="h-3.5 w-3.5"/>Already TOP 1</Badge>
                      : <Badge variant="outline" className="text-muted-foreground">Will receive 🏆</Badge>}
                  </div>
                );
              })()}

              {/* Current 🏆 holders */}
              {(() => {
                const currentHolders = localMembers.filter(m => {
                  const f = parseFlair(m.flair);
                  return f.hasTrophyEmoji && m.playerId !== topParticipant?.playerId;
                });
                if (!currentHolders.length) return null;
                return (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Will lose 🏆:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentHolders.map(m => (
                        <Badge key={m.playerId} variant="outline" className="text-muted-foreground">{m.username}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <Button
                onClick={analyzeTop1}
                variant="outline"
                className="border-yellow-400 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-950/20"
                data-testid="button-analyze-top1"
              >
                <Crown className="h-4 w-4 mr-2"/>
                Preview — Update TOP 1 Trophy
              </Button>

              {pendingTop1Changes.length > 0 && (
                <PendingChangesPanel
                  title={`Trophy Changes — ${pendingTop1Changes.length} member(s)`}
                  changes={pendingTop1Changes}
                  applying={applyingTop1}
                  onApply={applyTop1Changes}
                  onDeny={() => setPendingTop1Changes([])}
                  applyLabel="Apply Trophy Update"
                  colorClass="amber"
                />
              )}
            </div>
          </div>
        )}

        {/* ── No quest history ── */}
        {!isLoading && !latestQuest && !historyError && (
          <div className="text-center py-20">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3"/>
            <p className="text-lg font-semibold text-foreground">No Quest History</p>
            <p className="text-sm text-muted-foreground mt-1">This clan hasn't completed any quests yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
