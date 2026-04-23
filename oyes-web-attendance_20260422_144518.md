# oyes-web-attendance 진행 메모

**작성 기준:** 2026년 4월 22일

## 현재 상태

이 저장소는 `오예스 아침 운동`용 QR 출결 웹 시스템의 로컬 MVP가 동작하는 상태다.

핵심 흐름은 다음과 같다.

- 학생은 개인 QR 토큰을 가진다.
- 교사는 체크인/체크아웃 화면에서 QR을 스캔한다.
- 서버는 행사 시간창 안인지 확인하고 출결 로그를 기록한다.
- 관리자 화면에서 실시간 통계와 예외 처리를 확인한다.

## 구현된 기능

- `/` 대시보드
- `/teacher/check-in` 체크인 스캐너
- `/teacher/check-out` 체크아웃 스캐너
- `/admin/manual` 수동 처리
- `/admin/qr` 학생 QR 인쇄
- `/api/scan/[action]` 스캔 처리 API
- `/api/manual/[action]` 수동 처리 API
- `proxy.ts` 기반 Basic Auth 보호

## 로컬 배포 구조

- 프론트엔드와 API는 Next.js 하나로 구동한다.
- 현재 기준 DB는 PostgreSQL을 사용한다.
- 로컬 개발은 Docker Compose 기반 PostgreSQL 컨테이너를 기본 전제로 한다.
- 관리자 인증 값은 `.env`의 `ADMIN_USERNAME`, `ADMIN_PASSWORD`에서 읽는다.
- 학생 QR 토큰은 `QR_TOKEN_SECRET + 학번`을 해시한 값으로 생성한다.
- 학생 기본 명단은 `/admin/students`에서 CSV 템플릿을 받아 업로드한다.

## 데이터 모델

- `Student`
- `Event`
- `AttendanceLog`
- `AttendanceStatus`
- `AdminUser`
- `ManualAdjustment`

## 운영 포인트

- 체크인 시간과 체크아웃 시간을 엄격하게 분리한다.
- 중복 스캔은 무효 처리한다.
- 수동 처리에는 사유를 남긴다.
- QR 토큰은 이름이나 학번 대신 내부 토큰으로 관리한다.

## 로컬 실행 순서

```bash
npm install
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

## 다음 단계

- PostgreSQL 운영 검증
- 교사용 카메라 UX 세부 조정
- 백업/복구 자동화
- 배포 점검표 고도화

## 세션 1 상태

- 학생 명단 입력 경로를 `/admin/students`의 CSV 업로드로 고정했다.
- 업로드 결과에서 생성/갱신/재활성화/건너뜀 요약을 보여준다.
- QR 토큰은 `QR_TOKEN_SECRET + 학번` 해시 규칙으로 생성한다.

## 세션 2 상태

- 학생 QR에 `qrVersion`, `qrIssuedAt`을 추가했다.
- QR 재발급 API를 붙여 기존 QR이 자동 무효화되도록 했다.
- `/admin/qr`에서 필터링, 인쇄, 재발급, 최근 발급 이력 확인이 가능하다.
- QR 발급 이력은 `QrIssueLog`로 남긴다.

## 세션 3 상태

- `/admin/logs` 운영 로그 화면을 추가했다.
- 최근 스캔 피드를 체크인/체크아웃 화면에 붙였다.
- 운영 로그 CSV 다운로드 API를 추가했다.

## 세션 4 상태

- `/teacher/*`, `/api/scan/*` 까지 Basic Auth 보호 범위를 넓혔다.
- 관리자 계정과 교사용 계정을 분리했다.
- 스캔 요청에 `capturedAt` 을 포함해 네트워크 복구 후 재전송 시에도 원래 스캔 시각으로 판정한다.
- 교사 화면에 로컬 재전송 큐와 `대기 스캔 재전송` 버튼을 추가했다.
- 운영자 이메일과 기기 ID 조합을 서버에서 검증하도록 강화했다.

## 세션 5 상태

- 실무자용 운영 문서 `OPERATOR_GUIDE.md` 를 추가했다.
- 행사 전 준비, 당일 운영, 예외 처리, 마감 체크리스트를 정리했다.

## 세션 6 상태

- Prisma datasource 를 PostgreSQL 기준으로 전환했다.
- 로컬 PostgreSQL 실행용 `docker-compose.yml` 과 환경변수 템플릿을 추가했다.
- 배포/운영 런북 `DEPLOYMENT_RUNBOOK.md` 를 작성했다.
