# Session 7 Deployment Handoff

## 목적

다음 AI가 `오예스 출결 웹 시스템`의 Vercel 배포를 바로 이어서 처리할 수 있도록 현재 상태를 정리한다.

기준 시각:

- 2026-04-23 Asia/Seoul

작업 디렉터리:

- `/home/rjegj/projects/oyes-web-attendance`

## 현재 결론

- Vercel 프로젝트 연결 완료
- Prisma Postgres 리소스 생성 및 프로젝트 연결 완료
- Vercel 환경변수 일부 설정 완료
- 원격 PostgreSQL에 마이그레이션 적용 완료
- 원격 PostgreSQL에 운영자/오늘 행사 부트스트랩 적용 완료
- 프로덕션 배포는 아직 실패 상태

현재 실패 원인은 `@prisma/client` 에서 enum export 를 가져오는 코드가 Vercel 빌드에서 타입 오류를 일으키는 점이다.

## 이미 완료된 작업

### 1. Vercel 로그인 및 프로젝트 연결

- 로그인 확인: `rjegjin`
- Vercel 프로젝트 생성 및 링크 완료
- 로컬 링크 정보:
  - `.vercel/project.json`
  - `projectName: oyes-web-attendance`
  - `projectId: prj_NSrMEuoTGzNmJZuddWBc5hKvTrDq`
  - `orgId: team_haZsONKrkCNO83BL4Oey5hK3`

### 2. Prisma Postgres 연결

실행 완료:

```bash
npx vercel integration add prisma/prisma-postgres --plan free -m region=hnd1 --format=json
```

결과:

- 리소스명: `prisma-postgres-aureolin-lamp`
- 프로젝트 `oyes-web-attendance` 에 연결됨
- `DATABASE_URL`, `POSTGRES_URL`, `PRISMA_DATABASE_URL` 이 Vercel 환경변수로 연결됨
- 로컬에는 `.env.local` 이 생성되었음

### 3. Vercel 환경변수

설정 완료:

- `DATABASE_URL`
- `POSTGRES_URL`
- `PRISMA_DATABASE_URL`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `TEACHER_USERNAME`
- `TEACHER_PASSWORD`
- `QR_TOKEN_SECRET`

주의:

- `production`, `development` 는 성공적으로 반영됨
- `preview` 는 `git_branch_required` 메시지 때문에 일부 추가가 중간에 실패했을 가능성이 있음
- 다음 AI는 `npx vercel env list` 로 preview 누락 여부를 다시 확인해야 함

### 4. 원격 DB 적용

프로덕션 환경변수 pull:

```bash
npx vercel env pull .env.production.vercel --environment=production
```

원격 DB 반영:

```bash
set -a && source .env.production.vercel && set +a && npm run db:deploy && npm run db:bootstrap
```

상태:

- `db:deploy` 성공
- `db:bootstrap` 성공

### 5. 부트스트랩 스크립트 추가

추가 파일:

- `prisma/bootstrap.ts`

추가 스크립트:

- `package.json` -> `db:bootstrap`

부트스트랩 내용:

- `admin@school.local`
- `teacher1@school.local`
- `teacher2@school.local`
- 오늘 날짜의 `오예스 아침 운동` 이벤트
  - 체크인 `07:40 ~ 07:59`
  - 체크아웃 `08:20 ~ 08:40`

중요:

- 학생 명단은 production DB에 아직 없음
- 실제 운영 시작 전 `/admin/students` 에서 CSV 업로드 필요

## 마지막 배포 시도

마지막 실패 배포 URL:

- `https://oyes-web-attendance-94ab9xdnx-rjegjins-projects.vercel.app`

마지막 inspect URL:

- `https://vercel.com/rjegjins-projects/oyes-web-attendance/C66MfHhNJaViS6ay8ARkBmZqZbFo`

빌드 로그 확인 명령:

```bash
npx vercel inspect https://oyes-web-attendance-94ab9xdnx-rjegjins-projects.vercel.app --logs
```

## 현재 실제 배포 blocker

마지막 로그의 핵심 오류:

```text
./src/app/api/export/attendance/route.ts:2:10
Type error: Module '"@prisma/client"' has no exported member 'FinalStatus'.
```

즉, Vercel 빌드 환경에서는 `@prisma/client` enum export 사용이 계속 깨진다.

## 다음 AI가 먼저 확인할 파일

아직 enum import 를 쓰는 파일:

- `src/app/api/export/attendance/route.ts`
- `src/app/page.tsx`
- `src/lib/attendance-report.ts`
- `src/lib/attendance.ts`

검색 명령:

```bash
rg -n "import \\{[^}]*FinalStatus|import \\{[^}]*ActionType|import \\{[^}]*AdminRole" src prisma
```

## 이미 수정한 것

아래 파일은 enum import 문제를 이미 string literal 또는 명시 타입 쪽으로 일부 보정했다.

- `prisma/bootstrap.ts`
- `prisma/seed.ts`
- `src/app/admin/logs/page.tsx`
- `src/app/admin/manual/page.tsx`
- `src/components/recent-scan-feed.tsx`
- `src/app/admin/qr/page.tsx`
- `src/app/admin/students/page.tsx`
- `src/app/api/students/import/route.ts`

또한 `map` 콜백 implicit any 문제는 주요 지점에서 이미 정리했다.

## 다음 AI의 권장 작업 순서

1. 남아 있는 enum import 제거
   - `FinalStatus`, `ActionType`, `AdminRole` 을 `@prisma/client` 에서 직접 import 하지 않도록 수정
   - 가능하면 string literal union 또는 문자열 상수로 대체
2. 로컬 빌드 재검증
   - `npm run build`
3. 프로덕션 재배포
   - `npx vercel deploy --prod --yes`
4. 실패 시 build log 즉시 확인
   - `npx vercel inspect <deployment-url> --logs`
5. 배포 성공 후 preview 환경변수 누락 여부 확인
   - `npx vercel env list`
6. 배포 성공 후 실제 접속 확인
   - `/`
   - `/teacher/check-in`
   - `/teacher/check-out`
   - `/admin/students`

## 다음 AI가 그대로 써도 되는 명령

```bash
cd /home/rjegj/projects/oyes-web-attendance
rg -n "import \\{[^}]*FinalStatus|import \\{[^}]*ActionType|import \\{[^}]*AdminRole" src prisma
npm run build
npx vercel deploy --prod --yes
```

실패하면:

```bash
npx vercel inspect <배포 URL> --logs
```

## 추가 메모

- `.env.production.vercel` 파일은 로컬에 생성되어 있음
- `.env.local` 은 Vercel integration 이 생성한 개발용 DB URL을 포함
- 현재 워크트리는 매우 dirty 상태이므로 절대 광범위 revert 하지 말 것
- `dev.db` 는 이제 핵심 경로가 아니지만 파일은 남아 있음

## 실질적 운영 상태

배포만 성공하면 최소 동작은 가능하다.

다만 production DB에는 아직 실제 학생 명단이 없으므로, 배포 성공 직후 관리자 화면에서 다음 순서가 필요하다.

1. `/admin/students` 로그인
2. 실제 CSV 명단 업로드
3. `/admin/qr` 에서 QR 인쇄
4. 교사용 기기로 `/teacher/check-in`, `/teacher/check-out` 접속 확인
