export type MoroccoPhone = {
  local: string;
  e164: string;
};

export function normalizeMoroccoPhone(input: string): MoroccoPhone | null {
  const raw = String(input ?? '').replace(/[^\d]/g, '');
  if (!raw) return null;

  let local = raw;
  if (local.startsWith('212') && local.length === 12) {
    local = local.slice(3);
  } else if (local.startsWith('0') && local.length === 10) {
    local = local.slice(1);
  }

  if (!/^\d{9}$/.test(local)) return null;
  return {
    local,
    e164: `+212${local}`,
  };
}

export function phoneToSyntheticEmail(e164Phone: string): string {
  const digits = e164Phone.replace(/[^\d]/g, '');
  return `phone_${digits}@veetaa.local`;
}
