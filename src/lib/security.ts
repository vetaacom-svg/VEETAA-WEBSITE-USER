const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;
const TAG_CHARS_REGEX = /[<>`]/g;

export function sanitizePlainText(input: string, maxLength = 500): string {
  const normalized = String(input ?? '')
    .normalize('NFKC')
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(TAG_CHARS_REGEX, '')
    .trimStart();

  return normalized.slice(0, maxLength);
}

export function sanitizeSearchInput(input: string, maxLength = 120): string {
  const cleaned = sanitizePlainText(input, maxLength);
  return cleaned.replace(/\s{2,}/g, ' ');
}

export function sanitizeEmailInput(input: string): string {
  return sanitizePlainText(input, 254).toLowerCase().trim();
}

export function sanitizePhoneInput(input: string): string {
  const compact = sanitizePlainText(input, 24);
  return compact.replace(/[^\d+\s()-]/g, '');
}
