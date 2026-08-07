-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('PROVEN', 'SHAKY', 'UNTESTED');

-- CreateEnum
CREATE TYPE "ExerciseLanguage" AS ENUM ('APEX', 'SQL', 'TYPESCRIPT', 'JAVASCRIPT', 'PYTHON', 'OTHER');

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT,
    "skillId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "language" "ExerciseLanguage" NOT NULL DEFAULT 'OTHER',
    "starterFiles" JSONB NOT NULL,
    "solutionFiles" JSONB,
    "hints" JSONB NOT NULL,
    "testSpec" JSONB NOT NULL,
    "differenceNotes" TEXT,
    "lessonTimecode" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "files" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "testResults" JSONB NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "solutionRevealed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "status" "SkillStatus" NOT NULL DEFAULT 'UNTESTED',
    "provenCount" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastProvenAt" TIMESTAMP(3),
    "everUsedHints" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecallQuestion" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "sourceLessonId" TEXT,
    "sourceTimecode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecallQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecallItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "intervalDays" INTEGER NOT NULL DEFAULT 2,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastResult" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecallItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Skill_courseId_order_idx" ON "Skill"("courseId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE INDEX "Exercise_skillId_order_idx" ON "Exercise"("skillId", "order");

-- CreateIndex
CREATE INDEX "Submission_userId_exerciseId_idx" ON "Submission"("userId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillState_userId_skillId_key" ON "SkillState"("userId", "skillId");

-- CreateIndex
CREATE INDEX "RecallQuestion_skillId_idx" ON "RecallQuestion"("skillId");

-- CreateIndex
CREATE INDEX "RecallItem_userId_dueAt_idx" ON "RecallItem"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecallItem_userId_skillId_key" ON "RecallItem"("userId", "skillId");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillState" ADD CONSTRAINT "SkillState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillState" ADD CONSTRAINT "SkillState_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallQuestion" ADD CONSTRAINT "RecallQuestion_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallItem" ADD CONSTRAINT "RecallItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallItem" ADD CONSTRAINT "RecallItem_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
