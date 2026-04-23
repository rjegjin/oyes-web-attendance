# [Session 8] Vercel 배포 완료 및 인증/환경 변수 오류 해결 (Deployment Complete)

**작성 일시**: 2026년 4월 23일 (목) 오전 10:15 (KST)
**작업 디렉터리**: `/home/rjegj/projects/oyes-web-attendance`

## 1. 현재 진척 및 상태 (Status)
- **Vercel 프로덕션 배포 완수**: 모든 빌드 에러를 해결하고 `npx vercel deploy --prod` 명령어를 통해 운영 서버에 배포 완료.
- **운영 URL**: [https://oyes-web-attendance.vercel.app](https://oyes-web-attendance.vercel.app)
- **Git 상태**: 모든 변경 사항을 로컬 리포지토리(`main` 브랜치)에 커밋 완료. (현재 원격 저장소 리모트가 없으므로 로컬 커밋 상태 유지)

## 2. 주요 해결 사항 (Resolved Issues)

### 2.1 Prisma Vercel 빌드 타입 에러 해결
- **문제**: Vercel 빌드 중 `@prisma/client`에서 `FinalStatus`, `ActionType` 등의 Enum을 불러오지 못하는 현상과 트랜잭션 콜백(`tx`)이 암시적 `any`로 추론되는 에러 발생.
- **해결**:
  - `package.json`에 `"postinstall": "prisma generate"` 구문을 추가하여 Vercel에서 패키지 설치 직후 스키마 타입이 생성되도록 보장함.
  - `@prisma/client`에 의존하던 Enum 타입들을 `src/lib/attendance.ts` 파일의 리터럴 타입(const + type)으로 재정의 및 교체함.
  - `prisma.$transaction` 내부 `tx` 매개변수에 `Prisma.TransactionClient` 타입을 명시하여 엄격한 TS 검증 통과.

### 2.2 Vercel 서버 시간대(Timezone) 불일치 문제 해결
- **문제**: 로컬 테스트 환경과 달리, 배포된 서버(Vercel)는 UTC를 기준으로 동작하여 `new Date()` 기반의 00:00~23:59 필터링 시 KST 기준 오늘 생성된 행사("오예스 아침 운동")를 제대로 불러오지 못함. (오늘 행사 없음 오류 발생)
- **해결**: `src/lib/attendance.ts`의 `getTodayEvent` 함수 로직을 날짜 필터링 대신 "가장 최근에 생성된 활성화(isActive: true)된 이벤트"를 역순(`desc`)으로 1개 가져오도록 수정하여 시간대 종속성 제거.

### 2.3 환경 변수 및 Basic Auth 인증 오류 해결
- **문제**: 교사 및 관리자 메뉴 접근 시 로그인 정보를 입력해도 계속 튕기거나 무한 루프에 빠지는 이슈 발생. 원인은 Vercel 서버 쪽에 등록된 인증용 환경 변수(`ADMIN_USERNAME`, `ADMIN_PASSWORD` 등)가 비어있거나 잘못 암호화되어 있었음.
- **해결**:
  - `vercel env rm` 명령어로 기존의 꼬여있는 프로덕션 환경 변수를 모두 강제 삭제함.
  - `echo` 파이프와 `vercel env add` 명령어를 조합해 Vercel Production 환경에 정확한 평문(plain-text)으로 환경변수 값들을 올바르게 주입함.
  - 이후 Vercel 프로덕션으로 다시 배포하여 모든 접근 제어 및 로그인 정상 통과(`200 OK`) 확인 완료.

## 3. 관리자 인수인계 및 운영 준비 (Next Steps)
현재 서버는 즉시 실사용이 가능한 완벽한 상태입니다. 운영자는 아래 단계만 수행하면 됩니다.

1. **학생 명단 업로드**: `/admin/students`에 접속하여 학생 명단(CSV) 업로드.
2. **QR 코드 인쇄**: 명단 업로드 후 `/admin/qr` 페이지에서 학생별 QR 다운로드 및 인쇄.
3. **스캔 운영 시작**: 교사용 기기에서 `/teacher/check-in` 또는 `/teacher/check-out`에 접속, 학생들의 QR을 스캔하며 출결 확인.

> **관리자 로그인 정보**
> - 아이디: `admin` / 비밀번호: `oyes1234`
>
> **교사 스캔 화면 로그인 정보**
> - 아이디: `teacher` / 비밀번호: `oyes-teacher`