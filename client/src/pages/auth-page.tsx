import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validateToken, setToken, isAuthenticated } from '@/lib/wolvesville';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AuthPage() {
  const [, navigate] = useLocation();
  const [token, setTokenValue] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated()) navigate('/clans');
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!token.trim()) {
      setError('Please enter your bot authorization token.');
      return;
    }
    setLoading(true);
    try {
      const valid = await validateToken(token.trim());
      if (valid) {
        setToken(token.trim());
        navigate('/clans');
      } else {
        setError('Invalid bot token. Please check and try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Wolvesville Clan Manager</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-card rounded-xl border border-card-border shadow-lg p-8">
            <div className="text-center mb-6">
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Admin Login</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enter your bot authorization token</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="botToken" className="text-sm font-medium">
                  Bot Authorization Token
                </Label>
                <div className="relative">
                  <Input
                    id="botToken"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setTokenValue(e.target.value)}
                    placeholder="Enter your bot token"
                    className="pr-10"
                    data-testid="input-bot-token"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-token-visibility"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your bot token is required to access clan management features.
                </p>
              </div>

              {error && (
                <Alert variant="destructive" data-testid="alert-auth-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="button-authenticate"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  'Authenticate'
                )}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Don't have a bot token? Create one at the Wolvesville Developer Portal.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
