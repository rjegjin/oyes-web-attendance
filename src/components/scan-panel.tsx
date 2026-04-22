"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition, useRef, useEffect } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  // USB HID 스캐너를 위한 자동 포커스 유지
  useEffect(() => {
    if (!isCameraOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCameraOpen, result, isPending]);

  async function processToken(scannedToken: string) {
    if (isPending) return;

    setResult(null);
    const response = await fetch(`/api/scan/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: scannedToken,
        deviceId,
        operatorEmail,
      }),
    });

    const data = (await response.json()) as ScanResult;
    setResult(data);

    if (data.ok) {
      setToken("");
      startTransition(() => {
        router.refresh();
      });
    }
    
    // 카메라 스캔 시 입력창을 비워주고 포커스
    if (isCameraOpen) {
      // 스캔이 너무 빨리 중복으로 처리되는 것을 방지하기 위해 잠시 대기
      setTimeout(() => setIsCameraOpen(false), 2000); 
    }
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

      {isCameraOpen ? (
        <div style={{ margin: "20px 0", borderRadius: "16px", overflow: "hidden" }}>
          <Scanner
            onScan={(detected) => {
              if (detected && detected.length > 0) {
                // 첫 번째 감지된 값 사용
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
                // 약간의 지연 후 다시 포커스
                setTimeout(() => inputRef.current?.focus(), 100);
              }
            }}
            placeholder="예: OY26-3-01-AB12CD 또는 2026301"
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
