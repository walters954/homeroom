-- CreateTable
CREATE TABLE "SalesforceConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "instanceUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "orgType" TEXT NOT NULL,
    "isSandbox" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesforceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesforceConnection_userId_key" ON "SalesforceConnection"("userId");

-- AddForeignKey
ALTER TABLE "SalesforceConnection" ADD CONSTRAINT "SalesforceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
