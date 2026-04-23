# OYES Web Attendance

오예스 아침 운동 행사용 QR 출결 웹 시스템입니다. 로컬과 배포 모두 `Next.js + Prisma(PostgreSQL)` 기준으로 맞춰 두었습니다.

## 로컬 실행

```bash
npm install
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 대시보드가 보입니다.

## 주요 화면

- `/` 대시보드
- `/teacher/check-in` 체크인 스캔
- `/teacher/check-out` 체크아웃 스캔
- `/admin/manual` 수동 처리
- `/admin/qr` 학생 QR 인쇄

## 인증

관리자 화면, 교사 스캔 화면, 주요 운영 API는 Basic Auth로 보호합니다.

`.env` 또는 `.env.example` 기준으로 다음 값을 조정합니다.

```env
DATABASE_URL="postgresql://oyes:oyes@localhost:55432/oyes_attendance?schema=public"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="oyes1234"
TEACHER_USERNAME="teacher"
TEACHER_PASSWORD="oyes-teacher"
QR_TOKEN_SECRET="학교별비밀값"
```

- 관리자 계정: `/admin`, `/api/manual`, `/api/students`, `/api/export`
- 교사 또는 관리자 계정: `/teacher`, `/api/scan`

## 학생 명단 소스

기본 명단은 학교의 `학급 명단 CSV` 또는 교무실/NEIS에서 내보낸 엑셀을 CSV로 저장한 파일을 업로드해서 받습니다.
`/admin/students`에서 템플릿을 내려받고, 같은 형식으로 붙여넣기 또는 파일 업로드를 하면 됩니다.

명단 업로드 규칙:
- 필수 헤더: `학번`, `이름`, `학년`, `반`
- 선택 헤더: `사진URL`
- 중복 학번, 빈 필수값, 잘못된 학년/반 값은 자동으로 건너뜁니다.
- 업로드 후 `생성`, `갱신`, `재활성화`, `건너뜀` 요약이 관리자 화면에 표시됩니다.

## QR 발급 정책

- 학생 QR은 `QR_TOKEN_SECRET + 학번 + qrVersion`을 해시해서 생성합니다.
- 초기 발급은 `qrVersion = 1`입니다.
- `/admin/qr`에서 재발급하면 `qrVersion`이 증가하고 기존 QR은 즉시 무효가 됩니다.
- 발급 시각, 버전, 처리자는 `QrIssueLog`에 기록됩니다.

## 배포 구조

- 앱: Next.js를 실행할 수 있는 호스팅
- DB: 관리형 PostgreSQL
- 이미지/QR: 정적 생성 또는 스토리지
- 현장 단말: 교사용 휴대폰/태블릿

## 현재 구현 상태

- QR 토큰 기반 학생 식별
- 체크인/체크아웃 시간창 검증
- 실시간 대시보드
- 학생 QR 인쇄 페이지
- 수동 예외 처리
- 관리자/교사 Basic Auth 보호
- 운영자-기기 조합 검증
- 오프라인/서버 오류 시 로컬 재전송 큐

## 현장 운영 안정화

- 체크인 화면은 `teacher1@school.local / gate-a-01`
- 체크아웃 화면은 `teacher2@school.local / gate-b-01`
- 서버는 허용되지 않은 운영자-기기 조합을 거부합니다.
- 브라우저가 오프라인이거나 서버 오류가 나면 스캔 요청을 `localStorage` 큐에 저장합니다.
- 연결이 복구되면 교사 화면에서 `대기 스캔 재전송`으로 누락 건을 다시 보낼 수 있습니다.
- 재전송 시에는 원래 스캔 시각(`capturedAt`)을 같이 보내 시간창 판정이 틀어지지 않게 처리합니다.

## 참고

기존 진행 문서는 [`oyes-web-attendance_20260422_144518.md`](./oyes-web-attendance_20260422_144518.md) 에 정리해 두었습니다.
실무자용 운영 안내는 [`OPERATOR_GUIDE.md`](./OPERATOR_GUIDE.md) 를 참고하면 됩니다.
배포와 운영 절차는 [`DEPLOYMENT_RUNBOOK.md`](./DEPLOYMENT_RUNBOOK.md) 를 참고하면 됩니다.
