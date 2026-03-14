import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Shield, RefreshCw, Users, LogOut, AlertCircle, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  getAuthorizedClans,
  isAuthenticated,
  clearToken,
  setSelectedClan,
  type Clan,
} from '@/lib/wolvesville';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ClansPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) navigate('/');
  }, [navigate]);

  const {
    data: clans,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Clan[]>({
    queryKey: ['authorized-clans'],
    queryFn: getAuthorizedClans,
    retry: 1,
  });

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  function handleSelectClan(clan: Clan) {
    setSelectedClan(clan.id, clan.name);
    navigate('/members');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Wolvesville Clan Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
              <span
                className="hover:text-foreground cursor-pointer transition-colors px-2 py-1 rounded"
                onClick={() => navigate('/')}
                data-testid="nav-link-auth"
              >
                Authentication
              </span>
              <span className="text-primary font-medium px-2 py-1">Clan Selection</span>
            </nav>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Select Your Clan</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Choose a clan to manage its members and quests</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-clans"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-card-border p-5">
                <Skeleton className="h-5 w-1/2 mb-3" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <Alert variant="destructive" data-testid="alert-clans-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load clans: {(error as Error)?.message || 'Unknown error'}
            </AlertDescription>
          </Alert>
        )}

        {clans && clans.length === 0 && (
          <div className="text-center py-20">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold text-foreground mb-1">No Authorized Clans</h2>
            <p className="text-sm text-muted-foreground">
              Your bot token doesn't have access to any clans.
            </p>
          </div>
        )}

        {clans && clans.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clans.map((clan) => (
              <button
                key={clan.id}
                className="bg-card rounded-xl border border-card-border p-5 text-left hover:border-primary hover:shadow-md transition-all duration-200 group"
                onClick={() => handleSelectClan(clan)}
                data-testid={`card-clan-${clan.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors mt-0.5" />
                </div>
                <h3 className="font-semibold text-foreground text-base leading-tight mb-1">
                  {clan.name}
                </h3>
                {clan.tag && (
                  <p className="text-xs text-primary font-medium mb-1">[{clan.tag}]</p>
                )}
                {clan.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {clan.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {clan.memberCount != null && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {clan.memberCount} members
                    </span>
                  )}
                  {clan.xp != null && (
                    <span>{clan.xp.toLocaleString()} XP</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
