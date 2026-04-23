"use client";

import Link from "next/link";
import { useState } from "react";

type ClassOption = {
  grade: number;
  classNo: number;
};

type QrFilterFormProps = {
  q: string;
  grade: string;
  classNo: string;
  classOptionsByGrade: Record<string, ClassOption[]>;
};

export function QrFilterForm({ q, grade, classNo, classOptionsByGrade }: QrFilterFormProps) {
  const [selectedGrade, setSelectedGrade] = useState(grade);
  const [selectedClassNo, setSelectedClassNo] = useState(classNo);
  const classOptions = selectedGrade ? (classOptionsByGrade[selectedGrade] ?? []) : [];
  const hasSelectedClass = classOptions.some((option) => String(option.classNo) === selectedClassNo);
  const safeSelectedClassNo = hasSelectedClass ? selectedClassNo : "";

  return (
    <form className="filter-bar" method="get">
      <label className="input-block">
        <span>검색</span>
        <input name="q" defaultValue={q} placeholder="이름 또는 학번" />
      </label>
      <label className="input-block">
        <span>학년</span>
        <select
          name="grade"
          value={selectedGrade}
          onChange={(event) => {
            setSelectedGrade(event.target.value);
            setSelectedClassNo("");
          }}
        >
          <option value="">선택</option>
          {Object.keys(classOptionsByGrade).map((option) => (
            <option key={option} value={option}>
              {option}학년
            </option>
          ))}
        </select>
      </label>
      <label className="input-block">
        <span>반</span>
        <select
          disabled={!selectedGrade}
          name="classNo"
          value={safeSelectedClassNo}
          onChange={(event) => {
            setSelectedClassNo(event.target.value);
          }}
        >
          <option value="">{selectedGrade ? "선택" : "학년 먼저 선택"}</option>
          {classOptions.map((option) => (
            <option key={`${option.grade}-${option.classNo}`} value={option.classNo}>
              {option.classNo}반
            </option>
          ))}
        </select>
      </label>
      <div className="panel-muted qr-policy-card">
        <p>재발급 정책: 분실/훼손 시 `QR 재발급` 사용</p>
        <p>토큰 정책: `QR_TOKEN_SECRET + 학번 + qrVersion` 해시</p>
        <p>감사 이력: 발급 시각, 버전, 처리자 저장</p>
        <p>
          권장 사용: <code>학년 -&gt; 반</code> 선택 후 인쇄
        </p>
      </div>
      <div className="button-row filter-actions">
        <button className="primary-button" type="submit">
          인쇄 대상 필터
        </button>
        <Link className="secondary-button" href="/admin/qr">
          전체 보기
        </Link>
      </div>
    </form>
  );
}
