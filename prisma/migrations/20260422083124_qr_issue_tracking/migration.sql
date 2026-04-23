-- AlterTable
ALTER TABLE "Student"
ADD COLUMN "qrVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "qrIssuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "QrIssueLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "qrVersion" INTEGER NOT NULL,
    "reason" TEXT,
    "operatorId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrIssueLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QrIssueLog_qrToken_key" ON "QrIssueLog"("qrToken");

-- AddForeignKey
ALTER TABLE "QrIssueLog" ADD CONSTRAINT "QrIssueLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrIssueLog" ADD CONSTRAINT "QrIssueLog_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
