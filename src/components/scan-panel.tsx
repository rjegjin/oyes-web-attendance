"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";

type ScanPanelProps = {
  action: "checkin" | "checkout";
  title: string;
  subtitle: string;
  deviceId: string;
  operatorEmail: string;
};

type ScanResult = {
  ok: boolean;
  code: string;
  message: string;
  finalStatus?: string;
  scannedAt?: string;
  student?: {
    name: string;
    studentNo: string;
    grade: number;
    classNo: number;
    qrToken: string;
  };
};

type ScanRequestPayload = {
  token: string;
  deviceId: string;
  operatorEmail: string;
  capturedAt: string;
};

type QueuedScan = ScanRequestPayload & {
  id: string;
  action: "checkin" | "checkout";
  queuedAt: string;
};

const PENDING_QUEUE_KEY = "oyes-pending-scans-v1";

export function ScanPanel({
  action,
  title,
  subtitle,
  deviceId,
  operatorEmail,
}: ScanPanelProps) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [queuedCount, setQueuedCount] = useState(() => readQueue().length);
  const [isRetrying, setIsRetrying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // USB HID 스캐너를 위한 자동 포커스 유지
  useEffect(() => {
    if (!isCameraOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCameraOpen, result, isPending]);

  const handleOnline = useEffectEvent(() => {
    void flushQueue();
  });

  useEffect(() => {
    function onOnline() {
      handleOnline();
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  async function submitScan(payload: ScanRequestPayload) {
    const response = await fetch(`/api/scan/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as ScanResult;
    return { response, data };
  }

  async function processToken(scannedToken: string) {
    if (isPending || isRetrying) return;

    const payload: ScanRequestPayload = {
      token: scannedToken,
      deviceId,
      operatorEmail,
      capturedAt: new Date().toISOString(),
    };

    setResult(null);

    if (!navigator.onLine) {
      enqueueScan({ ...payload, action });
      setQueuedCount(readQueue().length);
      setResult({
        ok: false,
        code: "QUEUED_OFFLINE",
        message: "오프라인 상태라 로컬 큐에 저장했습니다. 연결 복구 후 재전송하세요.",
      });
      return;
    }

    try {
      const { response, data } = await submitScan(payload);

      if (!response.ok && data.code === "SERVER_ERROR") {
        enqueueScan({ ...payload, action });
        setQueuedCount(readQueue().length);
        setResult({
          ok: false,
          code: "QUEUED_SERVER_ERROR",
          message: "서버 응답이 불안정하여 로컬 큐에 저장했습니다. 잠시 뒤 재전송하세요.",
        });
        return;
      }

      setResult(data);

      if (data.ok) {
        setToken("");
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      enqueueScan({ ...payload, action });
      setQueuedCount(readQueue().length);
      setResult({
        ok: false,
        code: "QUEUED_NETWORK_ERROR",
        message: "네트워크 오류로 로컬 큐에 저장했습니다. 연결 복구 후 재전송하세요.",
      });
    } finally {
      if (isCameraOpen) {
        setTimeout(() => setIsCameraOpen(false), 1200);
      }
    }
  }

  async function flushQueue() {
    const queuedItems = readQueue().filter((item) => item.action === action);
    if (queuedItems.length === 0) {
      return;
    }

    setIsRetrying(true);
    const remaining: QueuedScan[] = [];
    let processedCount = 0;
    let lastData: ScanResult | null = null;

    for (const item of queuedItems) {
      try {
        const { response, data } = await submitScan({
          token: item.token,
          deviceId: item.deviceId,
          operatorEmail: item.operatorEmail,
          capturedAt: item.capturedAt,
        });

        if (!response.ok && data.code === "SERVER_ERROR") {
          remaining.push(item);
          continue;
        }

        processedCount += 1;
        lastData = data;
      } catch {
        remaining.push(item);
      }
    }

    const otherActionItems = readQueue().filter((item) => item.action !== action);
    writeQueue([...otherActionItems, ...remaining]);
    setQueuedCount(readQueue().length);

    if (processedCount > 0) {
      setResult(
        lastData ?? {
          ok: true,
          code: "RETRY_COMPLETED",
          message: `${processedCount}건의 대기 스캔을 재전송했습니다.`,
        },
      );
      startTransition(() => {
        router.refresh();
      });
    } else if (remaining.length > 0) {
      setResult({
        ok: false,
        code: "RETRY_PENDING",
        message: `재전송 대기 ${remaining.length}건이 남아 있습니다.`,
      });
    }

    setIsRetrying(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token.trim().length > 0) {
      await processToken(token.trim());
    }
  }

  return (
    <section className="panel panel-tight">
      <div className="section-header">
        <div>
          <p className="eyebrow">{action === "checkin" ? "입장 스캔" : "퇴장 스캔"}</p>
          <h1>{title}</h1>
        </div>
        <div className="badge-row">
          <span className="badge">{deviceId}</span>
          <span className="badge">{operatorEmail}</span>
        </div>
      </div>

      <p className="muted">{subtitle}</p>
      <div className="badge-row" style={{ marginBottom: "16px" }}>
        <span className="badge">대기 재전송 {queuedCount}건</span>
        <button className="secondary-button" type="button" disabled={queuedCount === 0 || isRetrying} onClick={() => void flushQueue()}>
          {isRetrying ? "재전송 중..." : "대기 스캔 재전송"}
        </button>
      </div>

      {isCameraOpen ? (
        <div style={{ margin: "20px 0", borderRadius: "16px", overflow: "hidden" }}>
          <Scanner
            onScan={(detected) => {
              if (detected && detected.length > 0) {
                processToken(detected[0].rawValue);
              }
            }}
            onError={(error) => {
              console.error(error);
            }}
          />
          <button
            className="secondary-button"
            style={{ width: "100%", marginTop: "12px" }}
            onClick={() => setIsCameraOpen(false)}
          >
            카메라 닫기
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: "20px" }}>
          <button
            className="secondary-button"
            onClick={() => setIsCameraOpen(true)}
          >
            카메라로 스캔하기
          </button>
        </div>
      )}

      <form className="stack-lg" onSubmit={handleSubmit}>
        <label className="input-block">
          <span>학생 QR 토큰 또는 학번 (USB 스캐너 대기 중)</span>
          <input
            ref={inputRef}
            name="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onBlur={() => {
              if (!isCameraOpen) {
                setTimeout(() => inputRef.current?.focus(), 100);
              }
            }}
            placeholder="예: OY-1A2B3C4D5E6F7A8B 또는 2026301"
            disabled={isCameraOpen}
          />
        </label>

        <button 
          className="primary-button" 
          disabled={isPending || token.trim().length === 0 || isCameraOpen} 
          type="submit"
        >
          {isPending ? "처리 중..." : action === "checkin" ? "체크인 등록" : "체크아웃 등록"}
        </button>
      </form>

      {result ? (
        <div className={`result-card ${result.ok ? "result-success" : "result-error"}`}>
          <p className="result-label">{result.ok ? "처리 성공" : "처리 실패"}</p>
          <h2>{result.message}</h2>
          {result.student ? (
            <p>
              {result.student.name} / {result.student.grade}학년 {result.student.classNo}반 /{" "}
              {result.student.studentNo}
            </p>
          ) : null}
          {result.finalStatus ? <p>최종 상태: {result.finalStatus}</p> : null}
          {result.scannedAt ? <p>기록 시각: {result.scannedAt}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function readQueue() {
  if (typeof window === "undefined") {
    return [] as QueuedScan[];
  }

  try {
    const raw = window.localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as QueuedScan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedScan[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(items));
}

function enqueueScan(payload: ScanRequestPayload & { action?: "checkin" | "checkout" }) {
  const current = readQueue();
  const nextItem: QueuedScan = {
    id: crypto.randomUUID(),
    action: payload.action ?? "checkin",
    token: payload.token,
    deviceId: payload.deviceId,
    operatorEmail: payload.operatorEmail,
    capturedAt: payload.capturedAt,
    queuedAt: new Date().toISOString(),
  };

  writeQueue([...current, nextItem]);
}
