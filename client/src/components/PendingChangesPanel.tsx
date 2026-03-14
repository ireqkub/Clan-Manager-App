import { Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PendingChange {
  memberId: string;
  username: string;
  oldFlair: string;
  newFlair: string;
}

interface Props {
  title: string;
  changes: PendingChange[];
  applying: boolean;
  onApply: () => void;
  onDeny: () => void;
  applyLabel: string;
  colorClass: 'amber' | 'red' | 'blue' | 'green' | 'orange';
}

const colorMap = {
  amber: { wrap: 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20', title: 'text-amber-800 dark:text-amber-400' },
  red:   { wrap: 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20',         title: 'text-red-800 dark:text-red-400' },
  blue:  { wrap: 'border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20',     title: 'text-blue-800 dark:text-blue-400' },
  green: { wrap: 'border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20', title: 'text-green-800 dark:text-green-400' },
  orange:{ wrap: 'border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950/20', title: 'text-orange-800 dark:text-orange-400' },
};

export function PendingChangesPanel({ title, changes, applying, onApply, onDeny, applyLabel, colorClass }: Props) {
  const c = colorMap[colorClass];
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${c.wrap}`}>
      <h3 className={`text-sm font-semibold ${c.title}`}>{title}</h3>
      <div className="max-h-52 overflow-y-auto space-y-1 font-mono">
        {changes.map((ch) => (
          <div key={ch.memberId} className="text-xs flex items-center gap-2 py-0.5">
            <span className="font-sans font-medium text-foreground min-w-[110px] truncate">{ch.username}</span>
            <span className="text-muted-foreground truncate max-w-[120px]">{ch.oldFlair || <em className="not-italic text-muted-foreground font-sans">empty</em>}</span>
            <span className="text-muted-foreground flex-shrink-0">→</span>
            <span className="text-foreground font-semibold truncate max-w-[140px]">{ch.newFlair || <em className="not-italic text-muted-foreground font-sans">empty</em>}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onApply} disabled={applying} className="bg-green-600 hover:bg-green-700 text-white border-0" data-testid="button-apply-pending">
          {applying ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin"/> : <Check className="h-4 w-4 mr-1.5"/>}
          {applyLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onDeny} disabled={applying} data-testid="button-deny-pending">
          <X className="h-4 w-4 mr-1.5"/>Deny
        </Button>
      </div>
    </div>
  );
}
