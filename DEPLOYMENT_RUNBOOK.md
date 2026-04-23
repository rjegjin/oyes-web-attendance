# OYES 배포 운영 문서

이 문서는 `오예스 출결 웹 시스템`을 PostgreSQL 기반으로 배포하고 운영하기 위한 기술 운영 문서입니다.

대상 독자:

- 배포 담당자
- 학교 내부 기술 담당자
- 외주 또는 유지보수 담당 개발자

## 1. 목표 배포 구조

권장 구조:

- 웹 앱: Next.js 서버 1대
- DB: 관리형 PostgreSQL 1개
- 현장 단말: 교사용 휴대폰/태블릿/노트북

구성 원칙:

- 앱 서버와 DB를 분리한다.
- DB는 반드시 PostgreSQL을 사용한다.
- 운영 환경에서는 `prisma migrate deploy` 만 사용한다.
- 시드는 최초 구축이나 테스트 환경에서만 사용한다.

## 2. 환경 변수

필수 환경 변수:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="strong-admin-password"
TEACHER_USERNAME="teacher"
TEACHER_PASSWORD="strong-teacher-password"
TEACHER_CHECKIN_OPERATOR_EMAIL="teacher1@school.local"
TEACHER_CHECKIN_DEVICE_ID="gate-a-01"
TEACHER_CHECKOUT_OPERATOR_EMAIL="teacher2@school.local"
TEACHER_CHECKOUT_DEVICE_ID="gate-b-01"
QR_TOKEN_SECRET="school-specific-secret"
```

운영 원칙:

- `QR_TOKEN_SECRET` 은 학교마다 다르게 둔다.
- 운영 비밀번호는 기본값을 절대 그대로 쓰지 않는다.
- 교사 스캔용 운영자 이메일과 기기 ID는 실제 현장 배치와 일치시킨다.
- 배포 플랫폼의 Secret 관리 기능을 사용한다.

## 3. 로컬 PostgreSQL 실행

이 저장소는 로컬 개발용 PostgreSQL 컨테이너를 포함한다.

실행 순서:

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

보조 명령:

```bash
npm run db:logs
npm run db:down
```

기본 접속 정보:

- host: `localhost`
- port: `55432`
- db: `oyes_attendance`
- user: `oyes`

## 4. 운영 배포 절차

## 4-1. 사전 준비

배포 전 확인:

1. PostgreSQL 인스턴스 준비
2. 앱 호스팅 준비
3. 운영 환경 변수 등록
4. 도메인 또는 내부 접속 URL 확정
5. 관리자/교사 계정 비밀번호 확정
6. 체크인/체크아웃 기기별 운영자 이메일과 기기 ID 확정

## 4-2. 최초 배포

권장 순서:

1. PostgreSQL 생성
2. 앱 서버에 환경 변수 등록
3. 앱 코드 배포
4. 운영 DB에 마이그레이션 반영
5. 필요 시 초기 시드 또는 학생 명단 업로드
6. `/teacher/check-in`, `/teacher/check-out`, `/admin/students` 접근 테스트

운영 DB 반영 명령:

```bash
npm run db:deploy
```

주의:

- 운영 환경에서는 `npm run db:migrate` 대신 `npm run db:deploy` 를 사용한다.
- 운영 DB에는 `db:seed` 를 자동 실행하지 않는다.

## 4-3. 학생 데이터 반영

운영 데이터 입력은 두 가지 방식이 있다.

1. 초기 시드로 테스트 데이터 넣기
2. `/admin/students` 에서 실제 학교 CSV 업로드

실제 운영에서는 두 번째 방식을 권장한다.

이유:

- 학생 명단이 매번 달라질 수 있다.
- 관리자가 화면에서 재업로드할 수 있다.
- QR 발급 흐름과 자연스럽게 연결된다.

## 5. 운영 점검 항목

배포 직후 최소 점검:

1. `/` 대시보드 열림
2. Basic Auth 정상 동작
3. `/teacher/check-in` 접속 가능
4. `/teacher/check-out` 접속 가능
5. `/admin/students` 에서 CSV 템플릿 다운로드 가능
6. 샘플 학생 체크인/체크아웃 가능
7. `/admin/logs` 에서 로그 조회 가능

행사 전날 점검:

1. 오늘 행사 시간 설정 확인
2. 관리자 계정 로그인 확인
3. 교사 계정 로그인 확인
4. 운영 로그 다운로드 테스트
5. QR 재발급 테스트 1건

행사 당일 시작 전:

1. 현장 와이파이 상태 확인
2. 교사용 기기 접속 확인
3. 카메라 권한 허용 확인
4. 대기 재전송 큐가 0건인지 확인

## 6. 백업과 복구

기본 원칙:

- PostgreSQL 백업은 앱 서버가 아니라 DB 레벨에서 관리한다.
- 최소 하루 1회 자동 백업 정책을 둔다.
- 행사 직전과 직후에 수동 백업을 추가하면 더 안전하다.

백업 대상:

- 학생 명단
- 출결 로그
- 수동 처리 이력
- QR 발급 이력

복구 원칙:

1. DB 스냅샷 복구
2. 앱 재배포가 필요한지 확인
3. 교사 화면 로그인 점검
4. 최근 행사 로그 정상 조회 확인

## 7. 마이그레이션 운영 원칙

개발 환경:

- `npm run db:migrate`

운영 환경:

- `npm run db:deploy`

배포 전 체크:

1. 로컬 또는 스테이징에서 마이그레이션 검증
2. `npm run build` 성공 확인
3. 시드 의존 없이 앱이 뜨는지 확인

주의:

- 운영 배포 중에는 Prisma schema 변경과 데이터 정리 작업을 동시에 하지 않는다.
- 큰 데이터 구조 변경은 행사 없는 날에 한다.

## 8. 장애 대응

### 8-1. 앱은 열리는데 스캔이 실패하는 경우

점검 순서:

1. `DATABASE_URL` 확인
2. DB 접속 가능 여부 확인
3. `/admin/logs` 열리는지 확인
4. 최근 배포 직후라면 마이그레이션 누락 여부 확인

### 8-2. 교사 화면 인증이 안 되는 경우

점검 순서:

1. `TEACHER_USERNAME`, `TEACHER_PASSWORD` 확인
2. 브라우저 캐시된 인증 정보 확인
3. 관리자 계정으로도 재현되는지 확인

### 8-3. 대량 스캔 중 네트워크가 불안정한 경우

운영 원칙:

- 교사 화면의 로컬 재전송 큐를 사용한다.
- 브라우저를 닫지 않는다.
- 같은 기기에서 재전송한다.

사후 점검:

1. `대기 재전송` 건수 0 확인
2. 대시보드 수치 반영 확인
3. 운영 로그에서 누락 학생 확인

## 9. 권장 배포 파이프라인

최소 권장 흐름:

1. 로컬 개발
2. 스테이징 배포
3. 마이그레이션 검증
4. 운영 배포
5. 행사 전 체크리스트 수행

배포마다 남겨야 할 기록:

- 배포 일시
- 배포 담당자
- 적용 커밋 또는 버전
- DB 마이그레이션 적용 여부
- 롤백 필요 여부

## 10. 롤백 원칙

앱 문제일 때:

- 이전 정상 배포 버전으로 즉시 롤백

DB 문제일 때:

- 최근 백업 복구 또는 장애 원인 분석 후 수동 보정

주의:

- 이미 적용된 운영 DB 마이그레이션은 코드만 롤백해서 해결되지 않을 수 있다.
- 따라서 DB 변경이 있는 배포는 반드시 사전 백업 후 진행한다.

## 11. 문서 연결

함께 보는 문서:

- 사용자 운영 안내: [`OPERATOR_GUIDE.md`](./OPERATOR_GUIDE.md)
- 프로젝트 개요: [`README.md`](./README.md)
- 진행 기록: [`oyes-web-attendance_20260422_144518.md`](./oyes-web-attendance_20260422_144518.md)
