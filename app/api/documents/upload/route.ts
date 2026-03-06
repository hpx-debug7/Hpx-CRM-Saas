import { logger } from '@/lib/server/logger';
import { NextResponse } from 'next/server';
import { saveUploadedDocument } from '../../../lib/server/documentStorage';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg'
]);

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const caseId = String(formData.get('caseId') || '').trim();

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        if (!caseId) {
            return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
        }
        if (!ALLOWED_MIME_TYPES.has(file.type)) {
            return NextResponse.json({ error: 'Only PDF and JPG/PNG files are allowed' }, { status: 400 });
        }

        const meta = await saveUploadedDocument(file, caseId);

        return NextResponse.json({
            id: meta.id,
            fileName: meta.fileName,
            filePath: meta.filePath,
            fileUrl: `/api/documents/${meta.id}/preview`,
            mimeType: meta.mimeType,
            fileSize: meta.fileSize,
            storageType: meta.storageType,
            environment: meta.environment,
            uploadedAt: meta.uploadedAt
        });
    } catch (error) {
        logger.error('Document upload failed:', error);
        return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
    }
}

