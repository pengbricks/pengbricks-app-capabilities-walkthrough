import { Badge } from '@databricks/appkit-ui/react';
import type { EvidenceState } from '../data/srpDemos.ts';

export function SrpStatus({ label, state }: { label: string; state: EvidenceState }) {
  return (
    <Badge variant={state === 'Ready' || state === 'Located' ? 'secondary' : 'outline'}>
      {label}: {state}
    </Badge>
  );
}
