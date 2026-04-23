import { createHash } from "crypto";

const QR_SECRET = process.env.QR_TOKEN_SECRET || "oyes-dev-qr-secret";

export function createStudentQrToken(studentNo: string, qrVersion = 1) {
  const normalized = studentNo.trim();
  const digest = createHash("sha256")
    .update(`${QR_SECRET}:${normalized}:${qrVersion}`)
    .digest("hex")
    .toUpperCase();

  return `OY-${digest.slice(0, 16)}`;
}
