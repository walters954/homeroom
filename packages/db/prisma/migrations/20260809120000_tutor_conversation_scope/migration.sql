-- AlterTable
ALTER TABLE "TutorConversation" ADD COLUMN     "scopeKey" TEXT;

-- CreateIndex
CREATE INDEX "TutorConversation_userId_scopeKey_updatedAt_idx" ON "TutorConversation"("userId", "scopeKey", "updatedAt");
