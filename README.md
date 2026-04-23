# 🏫 오예스 출결 웹 시스템 (OYES Attendance Web)

오예스 아침 운동 및 각종 학교 행사의 실시간 출결 관리를 위한 **Next.js 기반 고성능 웹 시스템**입니다. QR 코드 스캔 방식을 통해 수동 기록의 번거로움을 없애고, 실시간 대시보드를 통해 출결 현황을 한눈에 파악할 수 있습니다.

## 🚀 주요 특징

- **실시간 QR 스캔**: 전용 앱 설치 없이 웹 브라우저 카메라를 통해 즉시 체크인/체크아웃 처리.
- **스마트 명단 관리**: 학번만으로 학년과 반을 자동 추출하여 업로드 양식 최소화.
- **강력한 권한 체계**: 관리자(전체 메뉴)와 교사(스캔 전용) 권한 분리로 보안 강화.
- **실시간 대시보드**: 행사별 참여 인원, 미참여 인원, 누락 상태를 실시간으로 시각화.
- **영구 데이터 저장**: Vercel PostgreSQL DB를 사용하여 클라우드에 안전하게 데이터 저장.

## 🛠️ 시스템 아키텍처

- **Frontend/Backend**: Next.js 16.2.4 (App Router)
- **Database**: PostgreSQL (Prisma ORM)
- **Deployment**: Vercel (Production)
- **Auth**: Basic Authentication (Security Area 분리)

## 📋 운영 가이드

### 1. 관리자 메뉴 (Admin)
- **URL**: `https://oyes-web-attendance.vercel.app/`
- **로그인**: `admin` / `oyes1234`
- **기능**:
  - 실시간 출결 현황 모니터링
  - **학생 명단 업로드**: CSV 파일을 통해 전체 학생 등록 및 업데이트.
  - **QR 코드 관리**: 학생별 QR 코드 생성 및 일괄 인쇄.
  - **예외 처리**: 스캔 누락 학생에 대한 수동 체크 처리 및 로그 조회.
  - **데이터 내보내기**: 출결 결과를 Excel(CSV)로 다운로드.

### 2. 교사 스캔 메뉴 (Teacher)
- **URL**: `/teacher/check-in` (입구용), `/teacher/check-out` (출구용)
- **로그인**: `teacher` / `oyes-teacher`
- **기능**: 브라우저 카메라를 활용한 QR 코드 출결 스캔.

---

## 📊 CSV 명단 업로드 양식

명단 업로드 시 아래 4개의 칼럼을 포함한 CSV 파일을 준비해 주세요.

| 학번 | 이름(또는 성명) | 성별 | 사진URL |
| :--- | :--- | :--- | :--- |
| 20301 | 홍길동 | 남 | (선택사항) |
| 31205 | 김민지 | 여 | (선택사항) |

- **학번 자동 분석**: `20301` 입력 시 서버가 자동으로 `2학년 3반`으로 인식합니다.
- **허용 헤더 별칭**: `이름`, `성명`, `학생명` 모두 사용할 수 있습니다.
- **데이터 유지**: 한 번 업로드하면 DB에 저장되므로 행사 때마다 올릴 필요가 없습니다.

---

## 💻 개발 및 로컬 실행

### 환경 변수 설정 (.env)
```env
DATABASE_URL="postgresql://..."
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="..."
TEACHER_USERNAME="teacher"
TEACHER_PASSWORD="..."
QR_TOKEN_SECRET="..."
```

### 실행 명령어
```bash
# 의존성 설치
npm install

# 데이터베이스 동기화 및 클라이언트 생성
npx prisma migrate dev
npx prisma generate

# 로컬 서버 실행
npm run dev
```

## 📝 작업 기록 및 히스토리
- `SESSION8_DEPLOYMENT_COMPLETE.md`: Vercel 배포 및 초기 설정 완료 기록.
- `SESSION9_CSV_AND_AUTH.md`: 권한 체계 강화 및 CSV 양식 변경 기록.
- `SESSION10_DATA_MANAGEMENT.md`: 데이터 영구 저장 및 자동 인식 로직 설명.
