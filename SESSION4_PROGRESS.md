# Session 4 Progress

## Goal

Operational hardening for real event-day use:

- protect teacher and scan routes
- enforce operator/device guardrails
- improve recovery under unstable network conditions

## Scope In Progress

- review current auth coverage and scan flow
- add route protection for teacher and scan endpoints
- add local retry path for failed scan submissions

## Completed

- `/teacher/*` 와 `/api/scan/*` 에도 Basic Auth를 적용했다.
- 관리자 전용 계정과 교사용 계정을 분리했다.
- 스캔 요청에 `capturedAt` 을 포함해, 네트워크 복구 후 재전송해도 원래 스캔 시각 기준으로 판정되게 했다.
- 교사 화면에 로컬 재전송 큐와 수동 재전송 버튼을 추가했다.
- 운영자 이메일과 허용 기기 ID 조합을 서버에서 검증하도록 강화했다.

## Current Defaults

```env
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="oyes1234"
TEACHER_USERNAME="teacher"
TEACHER_PASSWORD="oyes-teacher"
```

## Validation

- `npm run db:seed`
- `npm run lint`
