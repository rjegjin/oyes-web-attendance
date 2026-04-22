"use client";

export function PrintButton() {
  return (
    <button className="primary-button print-hidden" onClick={() => window.print()}>
      인쇄하기
    </button>
  );
}
