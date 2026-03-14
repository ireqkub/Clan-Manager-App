import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ClansPage from "@/pages/clans-page";
import MembersPage from "@/pages/members-page";
import QuestFeePage from "@/pages/quest-fee-page";
import QuestActivePage from "@/pages/quest-active-page";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/clans" component={ClansPage} />
      <Route path="/members" component={MembersPage} />
      <Route path="/quest-fee" component={QuestFeePage} />
      <Route path="/quest-active" component={QuestActivePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
