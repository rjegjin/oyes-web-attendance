# [Session 9] CSV 양식 변경 및 권한 체계 강화 (CSV Format \u0026 Auth Update)

**작성 일시**: 2026년 4월 23일 (목) 오전 10:35 (KST)
**작업 디렉터리**: `/home/rjegj/projects/oyes-web-attendance`

## 1. 개요 (Overview)
- 관리자 권한을 루트 경로(`/`)까지 확장하여 보안 강화.
- 학생 명단 업로드 CSV 양식을 사용자 요청에 맞춰 간소화 및 `성별` 필드 추가.
- 학번에서 학년/반 정보를 자동으로 추출하는 로직 구현.

## 2. 주요 작업 내용 (Tasks)

### 2.1 데이터 모델 변경 (Prisma Schema)
- `Student` 모델에 `gender` (String?) 필드 추가.
- `npx prisma migrate dev`를 통해 로컬 DB 반영 준비 완료.

### 2.2 CSV 업로드 로직 개선 (`src/lib/student-roster.ts`)
- **새로운 CSV 양식**: `학번, 이름, 성별, 사진URL`
- **자동 추출 로직**:
  - 5자리 학번 (예: `20301`) -> 2학년 3반 1번으로 인식.
  - 4자리 학번 (예: `2301`) -> 2학년 3반 1번으로 인식.
  - 학년(`grade`)과 반(`classNo`)을 CSV에서 직접 입력받지 않고 학번에서 자동으로 계산하여 DB에 저장.

### 2.3 권한 체계 세분화 (`src/proxy.ts`)
- **관리자 (Admin)**: 
  - 루트 경로(`/`)를 포함한 모든 페이지 접근 허용.
  - `admin` 계정으로만 대시보드 및 관리 메뉴 접근 가능.
- **교사 (Teacher)**:
  - 오직 `/teacher/*` (스캔 화면) 및 관련 스캔 API(`/api/scan/*`)만 접근 허용.
  - 루트 대시보드 및 관리자 메뉴 접근 차단.

## 3. 결과 및 확인 (Results \u0026 Verification)
- **권한 체계 반영 완료**: 
  - 루트 경로(`/`) 접속 시 이제 관리자 로그인이 필요합니다.
  - 교사(`teacher`) 계정으로 루트 접속 시 차단되는 것을 확인했습니다.
  - 교사(`teacher`) 계정으로 `/teacher/*` 경로 접속은 정상 허용됩니다.
- **CSV 명단 양식 변경 완료**: 
  - `학번, 이름, 성별, 사진URL` 4개 칼럼으로 업로드 가능.
  - 학번(`20301`, `2301` 등) 입력 시 학년과 반이 DB에 자동 계산되어 저장됩니다.
- **데이터베이스 반영 완료**: Vercel 프로덕션 DB에 `gender` 필드 추가 마이그레이션이 성공적으로 적용되었습니다.

## 4. 최종 배포 상태
- **운영 URL**: [https://oyes-web-attendance.vercel.app](https://oyes-web-attendance.vercel.app)
- **배포 완료 시각**: 2026년 4월 23일 (목) 오전 10:45 (KST)

