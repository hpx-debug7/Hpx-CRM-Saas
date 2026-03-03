import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '@/lib/env';

export interface StoredDocumentMeta {
    id: string;
    caseId: string;
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: string;
    storageType: 'disk';
    environment: string;
}

export interface DocumentDeletionAuditEntry {
    caseId: string;
    actionType: 'DOCUMENT_DELETED';
    documentId: string;
    documentName: string;
    deletedByUserId: string;
    deletedByUserName: string;
    timestamp: string;
    metadata: {
        documentType?: string;
        fileSize?: number;
        fileDeleteFailed?: boolean;
    };
}

const UPLOAD_ROOT = path.join(process.cwd(), 'data', 'uploads');
const MANIFEST_PATH = path.join(UPLOAD_ROOT, 'manifest.json');
const DELETION_AUDIT_PATH = path.join(UPLOAD_ROOT, 'documentDeletionAudit.json');

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function ensureUploadRoot() {
    await fs.mkdir(UPLOAD_ROOT, { recursive: true });
}

async function readManifest(): Promise<Record<string, StoredDocumentMeta>> {
    await ensureUploadRoot();
    try {
        const data = await fs.readFile(MANIFEST_PATH, 'utf8');
        const parsed = JSON.parse(data);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

async function writeManifest(manifest: Record<string, StoredDocumentMeta>) {
    await ensureUploadRoot();
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest), 'utf8');
}

async function readDeletionAuditLog(): Promise<DocumentDeletionAuditEntry[]> {
    await ensureUploadRoot();
    try {
        const data = await fs.readFile(DELETION_AUDIT_PATH, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function appendDeletionAuditEntry(entry: DocumentDeletionAuditEntry) {
    const logs = await readDeletionAuditLog();
    logs.push(entry);
    await fs.writeFile(DELETION_AUDIT_PATH, JSON.stringify(logs), 'utf8');
}

export async function saveUploadedDocument(file: File, caseId: string): Promise<StoredDocumentMeta> {
    await ensureUploadRoot();

    const docId = crypto.randomUUID();
    const uploadedAt = new Date().toISOString();
    const safeCaseId = sanitizeFileName(caseId || 'unknown-case');
    const safeName = sanitizeFileName(file.name || `document-${Date.now()}`);
    const storedFileName = `${Date.now()}_${safeName}`;
    const caseDir = path.join(UPLOAD_ROOT, safeCaseId);
    await fs.mkdir(caseDir, { recursive: true });
    const absolutePath = path.join(caseDir, storedFileName);
    const relativePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');

    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(absolutePath, bytes);

    const meta: StoredDocumentMeta = {
        id: docId,
        caseId: safeCaseId,
        fileName: file.name,
        filePath: relativePath,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        uploadedAt,
        storageType: 'disk',
        environment: env.NODE_ENV
    };

    const manifest = await readManifest();
    manifest[docId] = meta;
    await writeManifest(manifest);

    return meta;
}

export async function getStoredDocumentById(id: string): Promise<StoredDocumentMeta | null> {
    const manifest = await readManifest();
    return manifest[id] || null;
}

export async function deleteStoredDocument(
    id: string,
    actor: { userId: string; userName: string; documentType?: string }
): Promise<{ deleted: boolean; fileDeleted: boolean; meta: StoredDocumentMeta | null; auditEntry?: DocumentDeletionAuditEntry }> {
    const manifest = await readManifest();
    const meta = manifest[id] || null;
    if (!meta) {
        return { deleted: false, fileDeleted: false, meta: null };
    }

    // Remove "DB record" (manifest entry) first; if this fails, do not log success.
    delete manifest[id];
    await writeManifest(manifest);

    const absolutePath = path.join(process.cwd(), meta.filePath);
    let fileDeleted = true;
    try {
        await fs.unlink(absolutePath);
    } catch {
        fileDeleted = false;
    }

    const auditEntry: DocumentDeletionAuditEntry = {
        caseId: meta.caseId,
        actionType: 'DOCUMENT_DELETED',
        documentId: id,
        documentName: meta.fileName,
        deletedByUserId: actor.userId,
        deletedByUserName: actor.userName,
        timestamp: new Date().toISOString(),
        metadata: {
            documentType: actor.documentType,
            fileSize: meta.fileSize,
            fileDeleteFailed: !fileDeleted
        }
    };

    await appendDeletionAuditEntry(auditEntry);

    return { deleted: true, fileDeleted, meta, auditEntry };
}
