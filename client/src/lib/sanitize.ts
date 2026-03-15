import DOMPurify from 'dompurify';

export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

export function sanitizeFlair(input: string | null | undefined): string {
  if (!input) return '';
  const safe = DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return safe.replace(/[<>"'`\\]/g, '');
}

export function sanitizeApiString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return sanitizeText(input);
}
