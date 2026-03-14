import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, RefreshCw, Trophy, Users, Clock, Star, Gem, Coins, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  isAuthenticated, getSelectedClanId, getSelectedClanName, getClanMembers,
  getActiveQuest, getAvailableQuests, getQuestVotes,
  formatDateTimeGMT7,
  type Member, type ClanQuest, type QuestInfo, type QuestVotes,
} from '@/lib/wolvesville';
import { NavHeader } from '@/components/NavHeader';
import { Button } from '@/components/ui/button';

export default function QuestActivePage() {
  const [, navigate] = useLocation();
  const clanId = getSelectedClanId() || '';
  const clanName = getSelectedClanName() || 'Unknown Clan';

  useEffect(() => { if (!isAuthenticated() || !clanId) navigate('/'); }, [navigate, clanId]);

  // ── Active Quest ──────────────────────────────────────────────────────────
  const { data: activeQuest, isLoading: activeLoading, refetch: refetchActive, isFetching: activeFetching } = useQuery<ClanQuest | null>({
    queryKey: ['active-quest', clanId],
    queryFn: () => getActiveQuest(clanId),
    enabled: !!clanId,
    retry: 1,
  });

  // ── Members (for vote name lookup) ───────────────────────────────────────
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['clan-members', clanId],
    queryFn: () => getClanMembers(clanId),
    enabled: !!clanId,
    retry: 1,
  });

  // ── Available Quests + Votes (only when no active quest) ─────────────────
  const { data: availableQuests = [], isLoading: availableLoading } = useQuery<QuestInfo[]>({
    queryKey: ['available-quests', clanId],
    queryFn: () => getAvailableQuests(clanId),
    enabled: !!clanId && !activeLoading && !activeQuest,
    retry: 1,
  });
  const { data: votes, isLoading: votesLoading } = useQuery<QuestVotes>({
    queryKey: ['quest-votes', clanId],
    queryFn: () => getQuestVotes(clanId),
    enabled: !!clanId && !activeLoading && !activeQuest,
    retry: 1,
  });

  function getMemberName(playerId: string): string {
    return members.find((m) => m.playerId === playerId)?.username || playerId.slice(0, 8) + '...';
  }

  const showAvailable = !activeLoading && !activeQuest;
  const isLoadingFallback = showAvailable && (availableLoading || votesLoading);

  return (
    <div className="min-h-screen bg-background">
      <NavHeader current="quest-active" />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quest Active</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{clanName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchActive()} disabled={activeFetching} data-testid="button-refresh-quest">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${activeFetching ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>

        {/* ── Loading active quest ── */}
        {activeLoading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Checking for active quest...</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i=><Skeleton key={i} className="h-20"/>)}
            </div>
          </div>
        )}

        {/* ── Active Quest ── */}
        {!activeLoading && activeQuest && (
          <>
            {/* Hero Card */}
            <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
              <div
                className="h-48 bg-cover bg-center relative"
                style={{ backgroundImage: activeQuest.quest.promoImageUrl ? `url(${activeQuest.quest.promoImageUrl})` : undefined, backgroundColor: activeQuest.quest.promoImagePrimaryColor || '#334155' }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className={`text-sm px-3 py-1 ${activeQuest.quest.purchasableWithGems ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-white'}`}>
                      {activeQuest.quest.purchasableWithGems ? <><Gem className="h-3.5 w-3.5 mr-1"/>Gem Quest</> : <><Coins className="h-3.5 w-3.5 mr-1"/>Gold Quest</>}
                    </Badge>
                    <Badge className="bg-white/20 text-white text-sm px-3 py-1 backdrop-blur-sm">
                      <Trophy className="h-3.5 w-3.5 mr-1"/>Tier {activeQuest.tier}
                    </Badge>
                    <Badge className={`text-sm px-3 py-1 ${activeQuest.tierFinished ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                      {activeQuest.tierFinished ? <><Check className="h-3.5 w-3.5 mr-1"/>Finished</> : <><Clock className="h-3.5 w-3.5 mr-1"/>In Progress</>}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                <StatBox label="Total XP" value={activeQuest.xp.toLocaleString()} />
                <StatBox label="XP per Reward" value={activeQuest.xpPerReward.toLocaleString()} />
                <StatBox label="Participants" value={activeQuest.participants.length} />
                <StatBox label="Claimed" value={activeQuest.claimedTime ? <><Check className="h-4 w-4 text-green-500 inline mr-1"/>Yes</> : <><X className="h-4 w-4 text-muted-foreground inline mr-1"/>No</>} />
                <div className="col-span-2 sm:col-span-2 md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3.5 w-3.5"/>Start Time (GMT+7)</p>
                  <p className="text-sm font-semibold">{formatDateTimeGMT7(activeQuest.tierStartTime)}</p>
                </div>
                <div className="col-span-2 sm:col-span-1 md:col-span-2">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3.5 w-3.5"/>End Time (GMT+7)</p>
                  <p className="text-sm font-semibold">{formatDateTimeGMT7(activeQuest.tierEndTime)}</p>
                </div>
                <div className="col-span-2 sm:col-span-3 md:col-span-4">
                  <p className="text-xs text-muted-foreground mb-1">Quest ID</p>
                  <p className="text-xs font-mono text-muted-foreground">{activeQuest.quest.id}</p>
                </div>
              </div>
            </div>

            {/* Participants Table */}
            <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
              <div className="bg-primary px-5 py-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary-foreground"/>
                <span className="font-semibold text-primary-foreground">Participants — sorted by XP</span>
                <span className="text-primary-foreground/70 text-sm">({activeQuest.participants.length})</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>XP Contributed</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...activeQuest.participants]
                      .sort((a, b) => b.xp - a.xp)
                      .map((p, i) => (
                        <TableRow key={p.playerId} className="border-border" data-testid={`row-participant-${p.playerId}`}>
                          <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            {p.username}
                            {i === 0 && <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-0 text-xs">🏆 Top</Badge>}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{p.xp.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-muted rounded-full h-1.5 max-w-[100px]">
                                <div
                                  className="bg-primary h-1.5 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, activeQuest.xpPerReward > 0 ? (p.xp / activeQuest.xpPerReward) * 100 : 0)}%` }}
                                />
                              </div>
                              {activeQuest.xpPerReward > 0 && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {Math.floor(p.xp / activeQuest.xpPerReward)} reward{Math.floor(p.xp / activeQuest.xpPerReward) !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}

        {/* ── No Active Quest → Show Available + Votes ── */}
        {showAvailable && (
          <>
            <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-primary flex-shrink-0"/>
              <span>No active quest at the moment. Showing available quests to vote on.</span>
            </div>

            {isLoadingFallback && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin"/>Loading available quests...
              </div>
            )}

            {!isLoadingFallback && availableQuests.length === 0 && (
              <div className="text-center py-16">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3"/>
                <p className="text-lg font-semibold">No Quests Available</p>
                <p className="text-sm text-muted-foreground mt-1">Check back later.</p>
              </div>
            )}

            {!isLoadingFallback && availableQuests.length > 0 && (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Available Quests</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {availableQuests.slice(0, 5).map((quest) => {
                      const questVoters = votes?.votes[quest.id] || [];
                      return (
                        <div
                          key={quest.id}
                          className="bg-card rounded-xl border border-card-border shadow-sm overflow-hidden hover:border-primary transition-colors"
                          data-testid={`card-quest-${quest.id}`}
                        >
                          {/* Landscape promo image */}
                          <div
                            className="h-28 bg-cover bg-center"
                            style={{ backgroundImage: quest.promoImageUrl ? `url(${quest.promoImageUrl})` : undefined, backgroundColor: quest.promoImagePrimaryColor || '#334155' }}
                          />
                          <div className="p-3 space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Badge className={`text-xs ${quest.purchasableWithGems ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200'}`}>
                                {quest.purchasableWithGems ? '💎 Gem' : '🪙 Gold'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{quest.rewards.length} rewards</span>
                            </div>

                            {/* Votes */}
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Votes: <span className="font-semibold text-foreground">{questVoters.length}</span>
                              </p>
                              {questVoters.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {questVoters.slice(0, 5).map((pid) => (
                                    <span key={pid} className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5">
                                      {getMemberName(pid)}
                                    </span>
                                  ))}
                                  {questVoters.length > 5 && (
                                    <span className="text-xs text-muted-foreground">+{questVoters.length - 5}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground font-mono truncate">{quest.id.slice(0, 16)}...</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shuffle Votes */}
                {votes && votes.shuffleVotes.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-muted-foreground"/>
                      Shuffle Votes ({votes.shuffleVotes.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {votes.shuffleVotes.map((pid) => (
                        <span key={pid} className="text-xs bg-muted text-muted-foreground rounded px-2 py-1">
                          {getMemberName(pid)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold text-foreground flex items-center gap-1">{value}</p>
    </div>
  );
}
