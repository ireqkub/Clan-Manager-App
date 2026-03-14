import { useLocation } from 'wouter';
import { Shield, LogOut, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { clearToken, getSelectedClanId } from '@/lib/wolvesville';

type Page = 'auth' | 'clans' | 'members' | 'quest-fee' | 'quest-active';

interface NavHeaderProps {
  current: Page;
}

const navItems: { key: Page; label: string; path: string; requiresClan: boolean }[] = [
  { key: 'auth', label: 'Authentication', path: '/', requiresClan: false },
  { key: 'clans', label: 'Clan Selection', path: '/clans', requiresClan: false },
  { key: 'members', label: 'Members', path: '/members', requiresClan: true },
  { key: 'quest-fee', label: 'Quest Fee', path: '/quest-fee', requiresClan: true },
  { key: 'quest-active', label: 'Quest Active', path: '/quest-active', requiresClan: true },
];

export function NavHeader({ current }: NavHeaderProps) {
  const [, navigate] = useLocation();
  const hasClan = !!getSelectedClanId();

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  const visibleItems = navItems.filter((item) => !item.requiresClan || hasClan);

  return (
    <header className="border-b border-border bg-card sticky top-0 z-20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <Shield className="h-5 w-5 text-primary flex-shrink-0" />
          <span className="font-semibold text-foreground hidden sm:block">Wolvesville Clan Manager</span>
        </div>

        {/* Nav links — desktop */}
        <nav className="hidden lg:flex items-center gap-0.5 text-sm overflow-x-auto flex-1 justify-center">
          {visibleItems.map((item, i) => (
            <span key={item.key} className="flex items-center gap-0.5 flex-shrink-0">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              {item.key === current ? (
                <span className="px-2 py-1 text-primary font-medium">{item.label}</span>
              ) : (
                <button
                  className="px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  onClick={() => navigate(item.path)}
                  data-testid={`nav-${item.key}`}
                >
                  {item.label}
                </button>
              )}
            </span>
          ))}
        </nav>

        {/* Mobile: current page label */}
        <span className="lg:hidden text-sm text-primary font-medium flex-1 text-center truncate">
          {navItems.find((n) => n.key === current)?.label}
        </span>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <ThemeToggle />
          {current !== 'auth' && (
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground" data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
