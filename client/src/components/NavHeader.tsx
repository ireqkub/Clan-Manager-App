import { useState } from 'react';
import { useLocation } from 'wouter';
import { Shield, LogOut, Menu, X, Users, Coins, Sword, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { clearToken, getSelectedClanId } from '@/lib/wolvesville';

type Page = 'auth' | 'clans' | 'members' | 'quest-fee' | 'quest-active';

interface NavHeaderProps {
  current: Page;
}

const navItems: { key: Page; label: string; path: string; icon: React.ReactNode; requiresClan: boolean }[] = [
  { key: 'auth',         label: 'Login',        path: '/',            icon: <Shield className="h-4 w-4" />,  requiresClan: false },
  { key: 'clans',        label: 'Clans',         path: '/clans',       icon: <Home className="h-4 w-4" />,    requiresClan: false },
  { key: 'members',      label: 'Members',       path: '/members',     icon: <Users className="h-4 w-4" />,   requiresClan: true  },
  { key: 'quest-fee',    label: 'Quest Fee',     path: '/quest-fee',   icon: <Coins className="h-4 w-4" />,   requiresClan: true  },
  { key: 'quest-active', label: 'Quest Active',  path: '/quest-active',icon: <Sword className="h-4 w-4" />,  requiresClan: true  },
];

export function NavHeader({ current }: NavHeaderProps) {
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasClan = !!getSelectedClanId();

  function handleLogout() {
    clearToken();
    navigate('/');
    setMobileOpen(false);
  }

  function goTo(path: string) {
    navigate(path);
    setMobileOpen(false);
  }

  const visibleItems = navItems.filter((item) => !item.requiresClan || hasClan);

  return (
    <>
      <header className="border-b border-border bg-card sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground hidden md:block whitespace-nowrap">Wolvesville Clan Manager</span>
          </div>

          {/* Desktop tab nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center" aria-label="Main navigation">
            {visibleItems.map((item) => {
              const isActive = item.key === current;
              return (
                <button
                  key={item.key}
                  onClick={() => goTo(item.path)}
                  data-testid={`nav-${item.key}`}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'}
                  `}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <ThemeToggle />
            {current !== 'auth' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hidden lg:flex"
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            )}
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-10 top-14" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40" />
          <div
            className="absolute left-0 right-0 top-0 bg-card border-b border-border shadow-lg p-3 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {visibleItems.map((item) => {
              const isActive = item.key === current;
              return (
                <button
                  key={item.key}
                  onClick={() => goTo(item.path)}
                  data-testid={`nav-mobile-${item.key}`}
                  className={`
                    w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'}
                  `}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
            {current !== 'auth' && (
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors mt-1 border-t border-border pt-3"
                data-testid="button-mobile-logout"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
