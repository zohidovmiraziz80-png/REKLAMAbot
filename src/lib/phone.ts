/**
 * O'zbekiston raqamini +998XXXXXXXXX ko'rinishiga keltiradi.
 * Qabul qiladi: "+998 90 123 45 67", "998901234567", "90 123 45 67", "(90) 123-45-67".
 * Noto'g'ri bo'lsa null qaytaradi.
 */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let local: string;
  if (digits.length === 12 && digits.startsWith("998")) local = digits.slice(3);
  else if (digits.length === 9) local = digits;
  else return null;
  if (!/^[1-9]\d{8}$/.test(local)) return null;
  return `+998${local}`;
}

/** +998901234567 → +998 90 123 45 67 */
export function formatUzPhone(phone: string) {
  const m = phone.match(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}
