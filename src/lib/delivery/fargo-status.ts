/** Fargo (Tezbor) buyurtma holatlari — bit bayroqlar. Brauzerda ham ishlatiladi. */
export const FARGO_STATUS = {
  DRAFT: 1,
  EXPECTED: 2,
  NEW: 4,
  ACCEPT: 8,
  PICKUP: 16,
  EXECUTOR_DONE: 32,
  AGENT_RECEIVED: 64,
  CUSTOMER_DONE: 128,
  DONE: 256,
  CANCELLED_BY_CUSTOMER: 512,
  CANCELLED_BY_EXECUTOR: 1024,
  FAILED_DELIVERY: 65536,
  PARKED: 131072,
  RETURNED: 524288,
  COLLECTED: 2097152,
  IN_TRANSIT: 4194304,
  MISROUTED: 8388608,
  TO_BE_RETURNED: 16777216,
  OUT_FOR_RETURN: 33554432,
  FAILED_COLLECTION: 67108864,
  READY_FOR_ISSUE: 134217728,
} as const;

export const FARGO_STATUS_UZ: Record<number, string> = {
  1: "Qoralama",
  2: "Filialga topshirishingiz kutilmoqda",
  4: "Yangi — kuryer olib ketadi",
  8: "Haydovchi biriktirildi",
  16: "Kuryer yetkazmoqda",
  32: "Kuryer topshirdi",
  64: "Omborda / saralashda",
  128: "Qabul qiluvchi tasdiqladi",
  256: "Yetkazildi",
  512: "Bekor qilindi",
  1024: "Kuryer bekor qildi",
  65536: "Yetkazib bo'lmadi",
  131072: "To'xtatilgan (tekshiruv)",
  524288: "Qaytarildi",
  2097152: "Jo'natuvchidan olindi",
  4194304: "Shaharlararo yo'lda",
  8388608: "Noto'g'ri omborga ketgan — qayta yo'naltirilmoqda",
  16777216: "Qaytarishga belgilandi",
  33554432: "Qaytarilmoqda",
  67108864: "Olib ketib bo'lmadi",
  134217728: "Filialda — olib ketish mumkin",
};

/** Holatni bizning buyurtma bosqichiga moslash */
export function fargoStage(code: number): "waiting" | "moving" | "done" | "cancelled" | "other" {
  const S = FARGO_STATUS;
  if (code === S.DONE || code === S.CUSTOMER_DONE || code === S.EXECUTOR_DONE) return "done";
  if (code === S.CANCELLED_BY_CUSTOMER || code === S.CANCELLED_BY_EXECUTOR || code === S.RETURNED) return "cancelled";
  if ([S.COLLECTED, S.AGENT_RECEIVED, S.IN_TRANSIT, S.PICKUP, S.READY_FOR_ISSUE, S.MISROUTED].includes(code as never)) return "moving";
  if ([S.DRAFT, S.EXPECTED, S.NEW, S.ACCEPT].includes(code as never)) return "waiting";
  return "other";
}

/** Bekor qilish mumkin: DRAFT, EXPECTED, NEW, ACCEPT */
export const FARGO_CANCELLABLE = (code: number) => fargoStage(code) === "waiting";
