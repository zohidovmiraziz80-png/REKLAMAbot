/**
 * Bank SMS / bildirishnoma matnidan kirim summasini ajratib oladi.
 * Masalan:
 *   "HUMOCARD *1234: popolnenie 150000.00 UZS ... Balans: 1 250 000.00 UZS"
 *   "Пополнение ➕ 150.000,00 UZS 💳 ***1234 💰 1.234.567,89 UZS"
 *   "Kartaga o'tkazma: +150 000 so'm"
 * Qaytaradi: { amount: so'mda (butun), incoming } yoki null.
 */

const INCOMING = [
  "popolnenie", "пополнение", "zachislenie", "зачисление", "поступление", "postuplenie", "perevod na kartu", "перевод на карту",
  "kirim", "to'ldirish", "toldirish", "to‘ldirish", "tushum", "tushdi", "qabul qilindi", "o'tkazma", "otkazma", "o‘tkazma",
  "входящий", "credit", "received", "p2p", "➕",
];
const OUTGOING = [
  "spisanie", "списание", "oplata", "оплата", "pokupka", "покупка", "снятие", "snyatie", "chiqim", "yechildi", "to'lov amalga",
  "debit", "purchase", "➖", "perevod s karty", "перевод с карты", "списан", "yuborildi",
];
const BALANCE = ["balans", "баланс", "остаток", "ostatok", "qoldiq", "доступно", "dostupno", "balance", "💰"];

/** "150.000,00" / "150 000.00" / "150,000.00" / "150000" → 150000 */
export function parseMoney(raw: string): number | null {
  let s = raw.replace(/[\s  ']/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let decimalSep: "." | "," | null = null;
  if (lastDot >= 0 && lastComma >= 0) decimalSep = lastDot > lastComma ? "." : ",";
  else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    if (sep) {
      const count = s.split(sep).length - 1;
      const tail = s.length - s.lastIndexOf(sep) - 1;
      if (count === 1 && tail <= 2) decimalSep = sep;
    }
  }
  if (decimalSep) {
    const idx = s.lastIndexOf(decimalSep);
    s = s.slice(0, idx).replace(/[.,]/g, "");
  } else s = s.replace(/[.,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

const MONEY = /([+＋]?)\s*(\d{1,3}(?:[   .,']\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(uzs|sum|so['‘’`]?m|сум|сўм)?/gi;

export type ParsedPayment = { amount: number; incoming: boolean };

export function parsePaymentSms(text: string): ParsedPayment | null {
  const lower = text.toLowerCase();
  const isOut = OUTGOING.some((w) => lower.includes(w));
  const isIn = INCOMING.some((w) => lower.includes(w)) || /(^|\s)[+＋]\s*\d/.test(text);

  // Balans qatorlarini olib tashlaymiz
  const lines = text
    .split(/[\n;|]/)
    .map((l) => l.trim())
    .filter(Boolean);
  const candidates: { amount: number; score: number }[] = [];
  for (const line of lines) {
    const l = line.toLowerCase();
    let part = line;
    const bIdx = BALANCE.map((w) => l.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (bIdx !== undefined) part = line.slice(0, bIdx);
    if (!part.trim()) continue;
    // Karta raqami va sana/vaqtni chalkashtirmaslik uchun
    const cleaned = part
      .replace(/\*{1,4}\s?\d{4}/g, " ")
      .replace(/\d{4}\s?\*+\s?\d{2,4}/g, " ")
      .replace(/\d{2}[./-]\d{2}[./-]\d{2,4}/g, " ")
      .replace(/\d{1,2}:\d{2}(:\d{2})?/g, " ");
    MONEY.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MONEY.exec(cleaned))) {
      const amount = parseMoney(m[2]);
      if (!amount || amount < 100) continue;
      let score = 0;
      if (m[3]) score += 2;
      if (m[1]) score += 2;
      if (/\d[  .,]\d{3}/.test(m[2])) score += 1;
      candidates.push({ amount, score });
    }
  }
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.score === 0) return null;
  return { amount: best.amount, incoming: isIn && !isOut };
}
