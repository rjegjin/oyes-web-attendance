import { z } from "zod";

export const scanPayloadSchema = z.object({
  token: z.string().min(1, "학생 QR 토큰 또는 학번을 입력하세요."),
  deviceId: z.string().min(1, "기기 ID가 필요합니다."),
  operatorEmail: z.string().email().optional(),
});

export const manualPayloadSchema = z.object({
  token: z.string().min(1, "학번 또는 QR 토큰을 입력하세요."),
  deviceId: z.string().min(1, "기기 ID가 필요합니다."),
  operatorEmail: z.string().email().optional(),
  reason: z.string().min(2, "예외 사유를 입력하세요."),
});
