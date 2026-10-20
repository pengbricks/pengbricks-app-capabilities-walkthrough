import { Star } from 'lucide-react';
import { difficulties, type Difficulty } from '../data/guides.ts';
import { cn } from '../lib/utils.ts';

// Stars only, no tier name on screen; screen readers get the rating as "n of 5".
export function DifficultyStars({ value, className }: { value: Difficulty; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`Difficulty ${value} of 5`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {difficulties.map((step) => (
        <Star
          key={step}
          aria-hidden
          className={cn('size-3.5', step <= value ? 'brand-mark fill-current' : 'text-muted-foreground/40')}
        />
      ))}
    </span>
  );
}
