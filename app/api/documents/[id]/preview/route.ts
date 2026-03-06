import { logger } from '@/lib/server/logger';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { getStoredDocumentById } from '../../../../lib/server/documentStorage';

export const runtime = 'nodejs';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const meta = await getStoredDocumentById(id);

        if (!meta) {
            return NextResponse.json({ error: 'File not found on server.' }, { status: 404 });
        }

        const absolutePath = path.join(process.cwd(), meta.filePath);
        const fileBuffer = await fs.readFile(absolutePath);

        return new NextResponse(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
                'Content-Type': meta.mimeType || 'application/octet-stream',
                'Content-Disposition': `inline; filename="${encodeURIComponent(meta.fileName)}"`,
                'Cache-Control': 'private, max-age=3600'
            }
        });
    } catch (error: unknown) {
        if (
            typeof error === 'object'
            && error !== null
            && 'code' in error
            && (error as { code?: string }).code === 'ENOENT'
        ) {
            return NextResponse.json({ error: 'File not found on server.' }, { status: 404 });
        }
        logger.error('Document preview failed:', error);
        return NextResponse.json({ error: 'Failed to preview document' }, { status: 500 });
    }
}
