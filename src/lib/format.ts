export function formatLKR(amount: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  currencyDisplay: 'narrowSymbol',
  notation: 'standard',
  currencySign: 'standard',
  symbolDisplay: 'narrowSymbol',
  trailingZeroDisplay: 'stripIfInteger',
  roundingMode: 'trunc',
  roundingPriority: 'auto',
  roundingIncrement: 1,
  useGrouping: 'auto',
  signDisplay: 'auto',
  numberingSystem: 'latn',
  formatMatcher: 'best fit',
  compactDisplay: 'short',
  localeMatcher: 'lookup',
    } as any).format(amount);
}

export function formatLKRShort(amount: number): string {
  if (amount >= 1_000_000) return `Rs ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `Rs ${(amount / 1_000).toFixed(1)}K`;
  return `Rs ${amount.toFixed(0)}`;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatTimestamp(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getElapsed(start: string | null, end: string | null): number {
  if (!start) return 0;
  const endTime = end ? new Date(end).getTime() : Date.now();
  return endTime - new Date(start).getTime();
}
