-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SALES_EXECUTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "passwordLastChangedAt" TIMESTAMP(3),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "stickyLeadTableHeader" BOOLEAN NOT NULL DEFAULT true,
    "rolePresetId" TEXT,
    "customPermissions" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isValid" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "customFields" TEXT DEFAULT '{}',
    "assignedToId" TEXT,
    "createdById" TEXT,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "performedById" TEXT,
    "performedByName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "beforeValue" TEXT DEFAULT '{}',
    "afterValue" TEXT DEFAULT '{}',
    "changesSummary" TEXT,
    "metadata" TEXT DEFAULT '{}',
    "previousHash" TEXT,
    "hash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_presets" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "role_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerThreadId" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "folder" TEXT,
    "leadId" TEXT,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "sentAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "attachmentsMeta" TEXT,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "isDirty" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'SYNCED',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "providerAttachmentId" TEXT,

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_webhook_state" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "lastHistoryId" TEXT,
    "lastDeltaToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_webhook_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_send_audit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "provider" TEXT NOT NULL,
    "to" TEXT,
    "subject" TEXT,
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_send_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_thread_leads" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_thread_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cc" TEXT,
    "bcc" TEXT,
    "linkedLeadId" TEXT,
    "fromAccountId" TEXT,
    "attachments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_logs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "localVersion" INTEGER NOT NULL,
    "serverVersion" INTEGER NOT NULL,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "localData" TEXT NOT NULL,
    "serverData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conflict_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_checkpoints" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "lastSyncVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSyncTime" TIMESTAMP(3),
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "users_companyId_username_key" ON "users"("companyId", "username");

-- CreateIndex
CREATE UNIQUE INDEX "users_companyId_email_key" ON "users"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_companyId_idx" ON "sessions"("companyId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "leads_companyId_idx" ON "leads"("companyId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_assignedToId_idx" ON "leads"("assignedToId");

-- CreateIndex
CREATE INDEX "leads_isDirty_idx" ON "leads"("isDirty");

-- CreateIndex
CREATE INDEX "leads_syncStatus_idx" ON "leads"("syncStatus");

-- CreateIndex
CREATE INDEX "leads_companyId_status_idx" ON "leads"("companyId", "status");

-- CreateIndex
CREATE INDEX "leads_companyId_assignedToId_idx" ON "leads"("companyId", "assignedToId");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_idx" ON "audit_logs"("companyId");

-- CreateIndex
CREATE INDEX "audit_logs_actionType_idx" ON "audit_logs"("actionType");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_performedById_idx" ON "audit_logs"("performedById");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_actionType_idx" ON "audit_logs"("companyId", "actionType");

-- CreateIndex
CREATE INDEX "audit_logs_companyId_createdAt_idx" ON "audit_logs"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "saved_views_companyId_idx" ON "saved_views"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_views_companyId_name_key" ON "saved_views"("companyId", "name");

-- CreateIndex
CREATE INDEX "role_presets_companyId_idx" ON "role_presets"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "role_presets_companyId_name_key" ON "role_presets"("companyId", "name");

-- CreateIndex
CREATE INDEX "email_accounts_companyId_idx" ON "email_accounts"("companyId");

-- CreateIndex
CREATE INDEX "email_accounts_userId_provider_idx" ON "email_accounts"("userId", "provider");

-- CreateIndex
CREATE INDEX "email_accounts_emailAddress_idx" ON "email_accounts"("emailAddress");

-- CreateIndex
CREATE INDEX "email_accounts_companyId_userId_idx" ON "email_accounts"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_userId_provider_key" ON "email_accounts"("userId", "provider");

-- CreateIndex
CREATE INDEX "email_threads_companyId_idx" ON "email_threads"("companyId");

-- CreateIndex
CREATE INDEX "email_threads_userId_provider_providerThreadId_idx" ON "email_threads"("userId", "provider", "providerThreadId");

-- CreateIndex
CREATE INDEX "email_threads_lastMessageAt_idx" ON "email_threads"("lastMessageAt");

-- CreateIndex
CREATE INDEX "email_threads_leadId_idx" ON "email_threads"("leadId");

-- CreateIndex
CREATE INDEX "email_threads_isDirty_idx" ON "email_threads"("isDirty");

-- CreateIndex
CREATE INDEX "email_threads_companyId_userId_idx" ON "email_threads"("companyId", "userId");

-- CreateIndex
CREATE INDEX "email_threads_companyId_isDirty_idx" ON "email_threads"("companyId", "isDirty");

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_userId_provider_providerThreadId_key" ON "email_threads"("userId", "provider", "providerThreadId");

-- CreateIndex
CREATE INDEX "email_messages_companyId_idx" ON "email_messages"("companyId");

-- CreateIndex
CREATE INDEX "email_messages_threadId_idx" ON "email_messages"("threadId");

-- CreateIndex
CREATE INDEX "email_messages_userId_idx" ON "email_messages"("userId");

-- CreateIndex
CREATE INDEX "email_messages_sentAt_idx" ON "email_messages"("sentAt");

-- CreateIndex
CREATE INDEX "email_messages_isDirty_idx" ON "email_messages"("isDirty");

-- CreateIndex
CREATE INDEX "email_messages_companyId_userId_idx" ON "email_messages"("companyId", "userId");

-- CreateIndex
CREATE INDEX "email_messages_companyId_isDirty_idx" ON "email_messages"("companyId", "isDirty");

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_userId_provider_providerMessageId_key" ON "email_messages"("userId", "provider", "providerMessageId");

-- CreateIndex
CREATE INDEX "email_attachments_companyId_idx" ON "email_attachments"("companyId");

-- CreateIndex
CREATE INDEX "email_attachments_messageId_idx" ON "email_attachments"("messageId");

-- CreateIndex
CREATE INDEX "email_webhook_state_userId_provider_idx" ON "email_webhook_state"("userId", "provider");

-- CreateIndex
CREATE INDEX "email_webhook_state_companyId_userId_idx" ON "email_webhook_state"("companyId", "userId");

-- CreateIndex
CREATE INDEX "email_webhook_state_companyId_idx" ON "email_webhook_state"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "email_webhook_state_userId_provider_key" ON "email_webhook_state"("userId", "provider");

-- CreateIndex
CREATE INDEX "email_send_audit_companyId_idx" ON "email_send_audit"("companyId");

-- CreateIndex
CREATE INDEX "email_send_audit_userId_idx" ON "email_send_audit"("userId");

-- CreateIndex
CREATE INDEX "email_send_audit_threadId_idx" ON "email_send_audit"("threadId");

-- CreateIndex
CREATE INDEX "email_send_audit_companyId_userId_idx" ON "email_send_audit"("companyId", "userId");

-- CreateIndex
CREATE INDEX "email_thread_leads_companyId_idx" ON "email_thread_leads"("companyId");

-- CreateIndex
CREATE INDEX "email_thread_leads_threadId_idx" ON "email_thread_leads"("threadId");

-- CreateIndex
CREATE INDEX "email_thread_leads_leadId_idx" ON "email_thread_leads"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "email_thread_leads_companyId_threadId_leadId_key" ON "email_thread_leads"("companyId", "threadId", "leadId");

-- CreateIndex
CREATE INDEX "sync_queue_companyId_idx" ON "sync_queue"("companyId");

-- CreateIndex
CREATE INDEX "sync_queue_syncedAt_idx" ON "sync_queue"("syncedAt");

-- CreateIndex
CREATE INDEX "sync_queue_operation_idx" ON "sync_queue"("operation");

-- CreateIndex
CREATE INDEX "sync_queue_priority_idx" ON "sync_queue"("priority");

-- CreateIndex
CREATE INDEX "sync_queue_entityType_idx" ON "sync_queue"("entityType");

-- CreateIndex
CREATE INDEX "sync_queue_companyId_syncedAt_idx" ON "sync_queue"("companyId", "syncedAt");

-- CreateIndex
CREATE INDEX "sync_queue_companyId_operation_idx" ON "sync_queue"("companyId", "operation");

-- CreateIndex
CREATE INDEX "email_queue_companyId_idx" ON "email_queue"("companyId");

-- CreateIndex
CREATE INDEX "email_queue_userId_idx" ON "email_queue"("userId");

-- CreateIndex
CREATE INDEX "email_queue_status_idx" ON "email_queue"("status");

-- CreateIndex
CREATE INDEX "email_queue_syncedAt_idx" ON "email_queue"("syncedAt");

-- CreateIndex
CREATE INDEX "email_queue_companyId_status_idx" ON "email_queue"("companyId", "status");

-- CreateIndex
CREATE INDEX "email_queue_companyId_userId_idx" ON "email_queue"("companyId", "userId");

-- CreateIndex
CREATE INDEX "conflict_logs_companyId_idx" ON "conflict_logs"("companyId");

-- CreateIndex
CREATE INDEX "conflict_logs_entityType_entityId_idx" ON "conflict_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "conflict_logs_resolvedAt_idx" ON "conflict_logs"("resolvedAt");

-- CreateIndex
CREATE INDEX "conflict_logs_companyId_entityType_idx" ON "conflict_logs"("companyId", "entityType");

-- CreateIndex
CREATE INDEX "sync_checkpoints_companyId_idx" ON "sync_checkpoints"("companyId");

-- CreateIndex
CREATE INDEX "sync_checkpoints_entityType_idx" ON "sync_checkpoints"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "sync_checkpoints_companyId_entityType_deviceId_key" ON "sync_checkpoints"("companyId", "entityType", "deviceId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_presets" ADD CONSTRAINT "role_presets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_webhook_state" ADD CONSTRAINT "email_webhook_state_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_webhook_state" ADD CONSTRAINT "email_webhook_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_send_audit" ADD CONSTRAINT "email_send_audit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_send_audit" ADD CONSTRAINT "email_send_audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_send_audit" ADD CONSTRAINT "email_send_audit_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_thread_leads" ADD CONSTRAINT "email_thread_leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_thread_leads" ADD CONSTRAINT "email_thread_leads_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "email_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_thread_leads" ADD CONSTRAINT "email_thread_leads_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_logs" ADD CONSTRAINT "conflict_logs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_checkpoints" ADD CONSTRAINT "sync_checkpoints_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
