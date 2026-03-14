import { logger } from '@/lib/server/logger';
import { NextResponse } from 'next/server';
import { deleteStoredDocument } from '../../../lib/server/documentStorage';
import { withApiLogging } from "@/lib/apiLogger";

export const runtime = 'nodejs';

const ALLOWED_DELETE_ROLES = new Set(['ADMIN', 'PROCESS_MANAGER', 'PROCESS_EXECUTIVE']);

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
    return withApiLogging(req, async (requestId) => {
        try {
            const { id } = await context.params;
            const body = await req.json().catch(() => ({} as { documentType?: string; caseId?: string }));

            const userId = (req.headers.get('x-user-id') || '').trim();
            const userName = (req.headers.get('x-user-name') || '').trim();
            const userRole = (req.headers.get('x-user-role') || '').trim();

            if (!userId || !userName) {
                return NextResponse.json({ error: 'Unauthorized: Missing user context' }, { status: 401 });
            }
            if (!ALLOWED_DELETE_ROLES.has(userRole)) {
                return NextResponse.json({ error: 'Forbidden: You do not have permission to delete documents' }, { status: 403 });
            }

            const deletion = await deleteStoredDocument(id, {
                userId,
                userName,
                documentType: body.documentType
            });

            if (!deletion.deleted || !deletion.meta || !deletion.auditEntry) {
                return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            }

            return NextResponse.json({
                success: true,
                documentId: id,
                caseId: deletion.meta.caseId,
                fileDeleted: deletion.fileDeleted,
                timelineEntry: {
                    caseId: deletion.auditEntry.caseId,
                    actionType: deletion.auditEntry.actionType,
                    action: `${deletion.auditEntry.deletedByUserName} deleted document: ${deletion.auditEntry.documentName}`,
                    performedBy: deletion.auditEntry.deletedByUserId,
                    performedByName: deletion.auditEntry.deletedByUserName,
                    performedAt: deletion.auditEntry.timestamp,
                    metadata: deletion.auditEntry.metadata
                }
            });
        } catch (error) {
            logger.error('Document delete failed:', error);
            return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
        }

    });
}

