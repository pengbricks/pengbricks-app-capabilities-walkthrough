import {
  BadgeCheck,
  BarChart3,
  Coins,
  Gauge,
  Lock,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react';

// Icons for business-value outcomes, chosen from each outcome's wording. Every rule lists icons in
// order of preference, so two cost outcomes on one guide get Coins and Receipt rather than Coins twice.
const RULES: [RegExp, LucideIcon[]][] = [
  [/\b(cost|spend|bill|budget|chargeback|price|pay|dbu|finance|invoice)/i, [Coins, Receipt, BarChart3]],
  [/\b(secur|risk|complian|audit|privacy|pii|mask|least privilege|permission|govern)/i, [ShieldCheck, Lock]],
  [/\b(secret|credential|token|password|identity|access)/i, [Lock, ShieldCheck]],
  [/\b(fast|faster|speed|minutes|hours|days|sooner|latency|fresh|wait|before)/i, [Timer, Gauge]],
  [/\b(team|analyst|user|business|people|self-serve|self-service|share|collaborat|owner)/i, [Users]],
  [/\b(reliab|recover|rollback|roll back|retry|rerun|incident|failure|outage)/i, [RefreshCw]],
  [/\b(quality|trust|accura|correct|consisten|reproduc|test)/i, [BadgeCheck]],
];
const FALLBACK: LucideIcon[] = [Gauge, BadgeCheck, BarChart3, Users, Timer, ShieldCheck];

function candidates(text: string): LucideIcon[] {
  return RULES.filter(([pattern]) => pattern.test(text)).flatMap(([, icons]) => icons);
}

/** One icon per outcome, preferring a match on the title, then the body, and never repeating within a set. */
export function valueIcons(outcomes: { title: string; body: string }[]): LucideIcon[] {
  const used = new Set<LucideIcon>();
  return outcomes.map((outcome) => {
    const options = [...candidates(outcome.title), ...candidates(outcome.body), ...FALLBACK];
    const icon = options.find((option) => !used.has(option)) ?? options[0];
    used.add(icon);
    return icon;
  });
}
