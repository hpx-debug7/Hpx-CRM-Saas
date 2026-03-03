'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import {
    CaseDocument,
    DocumentStatus,
    DocumentContextType
} from '../types/processTypes';

// ============================================================================
// CONSTANTS
// ============================================================================

const DOCUMENTS_STORAGE_KEY = 'caseDocuments';

function toStorageDocument(doc: CaseDocument): CaseDocument {
    const { fileData: _fileData, ...rest } = doc;
    return rest;
}

function persistDocumentsSafely(documents: CaseDocument[]) {
    const docsForStorage = documents.map(toStorageDocument);
    const sortedByNewest = [...docsForStorage].sort((a, b) =>
        new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
    );

    for (let keepCount = sortedByNewest.length; keepCount >= 0; keepCount = Math.floor(keepCount * 0.8) - 1) {
        const slice = sortedByNewest.slice(0, Math.max(keepCount, 0));
        try {
            localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(slice));
            return;
        } catch (error) {
            const isQuotaError = error instanceof DOMException && error.name === 'QuotaExceededError';
            if (!isQuotaError) {
                throw error;
            }
            if (keepCount <= 0) {
                localStorage.removeItem(DOCUMENTS_STORAGE_KEY);
                return;
            }
        }
    }
}

// Generate UUID
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================================================
// CONTEXT
// ============================================================================

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
    const [documents, setDocuments] = useState<CaseDocument[]>([]);
    const [isHydrated, setIsHydrated] = useState(false);
    const lastPersistedValueRef = useRef<string>('');

    // Load documents from localStorage
    useEffect(() => {
        try {
            const storedDocs = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
            if (storedDocs) {
                const parsed = JSON.parse(storedDocs);
                if (Array.isArray(parsed)) {
                    // Keep parsed docs in memory for compatibility; persistence strips fileData.
                    setDocuments(parsed as CaseDocument[]);
                } else {
                    setDocuments([]);
                }
                lastPersistedValueRef.current = JSON.stringify(
                    (Array.isArray(parsed) ? parsed : []).map((doc) => toStorageDocument(doc as CaseDocument))
                );
            }
        } catch (error) {
            console.error('Error loading documents:', error);
        } finally {
            setIsHydrated(true);
        }
    }, []);

    // Persist documents to localStorage
    useEffect(() => {
        if (!isHydrated) return;

        const timeoutId = setTimeout(() => {
            try {
                const docsForStorage = documents.map(toStorageDocument);
                const serialized = JSON.stringify(docsForStorage);
                if (serialized === lastPersistedValueRef.current) return;
                persistDocumentsSafely(documents);
                lastPersistedValueRef.current = JSON.stringify(docsForStorage);
            } catch (error) {
                console.error('Error saving documents:', error);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [documents, isHydrated]);

    // ============================================================================
    // DOCUMENT OPERATIONS
    // ============================================================================

    const addDocument = useCallback((
        doc: Omit<CaseDocument, 'documentId' | 'uploadedAt'>
            & Partial<Pick<CaseDocument, 'documentId' | 'uploadedAt'>>
    ): { success: boolean; message: string } => {
        const newDoc: CaseDocument = {
            ...doc,
            documentId: doc.documentId || generateUUID(),
            uploadedAt: doc.uploadedAt || new Date().toISOString()
        };

        setDocuments(prev => [...prev, newDoc]);
        return { success: true, message: 'Document added successfully' };
    }, []);

    const updateDocument = useCallback((documentId: string, updates: Partial<CaseDocument>): { success: boolean; message: string } => {
        const docIndex = documents.findIndex(d => d.documentId === documentId);
        if (docIndex === -1) {
            return { success: false, message: 'Document not found' };
        }

        setDocuments(prev => prev.map(d =>
            d.documentId === documentId ? { ...d, ...updates } : d
        ));

        return { success: true, message: 'Document updated successfully' };
    }, [documents]);

    const deleteDocument = useCallback((documentId: string): { success: boolean; message: string } => {
        const doc = documents.find(d => d.documentId === documentId);
        if (!doc) {
            return { success: false, message: 'Document not found' };
        }

        setDocuments(prev => prev.filter(d => d.documentId !== documentId));
        return { success: true, message: 'Document deleted successfully' };
    }, [documents]);

    // ============================================================================
    // STATUS OPERATIONS
    // ============================================================================

    const verifyDocument = useCallback((documentId: string, userId: string): { success: boolean; message: string } => {
        const doc = documents.find(d => d.documentId === documentId);
        if (!doc) {
            return { success: false, message: 'Document not found' };
        }

        if (doc.status !== 'RECEIVED') {
            return { success: false, message: 'Only received documents can be verified' };
        }

        setDocuments(prev => prev.map(d =>
            d.documentId === documentId
                ? {
                    ...d,
                    status: 'VERIFIED' as DocumentStatus,
                    verifiedAt: new Date().toISOString(),
                    verifiedBy: userId,
                    rejectionReason: undefined
                }
                : d
        ));

        return { success: true, message: 'Document verified successfully' };
    }, [documents]);

    const rejectDocument = useCallback((documentId: string, userId: string, reason: string): { success: boolean; message: string } => {
        const doc = documents.find(d => d.documentId === documentId);
        if (!doc) {
            return { success: false, message: 'Document not found' };
        }

        if (doc.status !== 'RECEIVED') {
            return { success: false, message: 'Only received documents can be rejected' };
        }

        setDocuments(prev => prev.map(d =>
            d.documentId === documentId
                ? {
                    ...d,
                    status: 'REJECTED' as DocumentStatus,
                    verifiedAt: new Date().toISOString(),
                    verifiedBy: userId,
                    rejectionReason: reason
                }
                : d
        ));

        return { success: true, message: 'Document rejected' };
    }, [documents]);

    // ============================================================================
    // QUERIES
    // ============================================================================

    const getDocumentsByCaseId = useCallback((caseId: string): CaseDocument[] => {
        return documents.filter(d => d.caseId === caseId);
    }, [documents]);

    const getDocumentsByStatus = useCallback((caseId: string, status: DocumentStatus): CaseDocument[] => {
        return documents.filter(d => d.caseId === caseId && d.status === status);
    }, [documents]);

    // ============================================================================
    // CONTEXT VALUE
    // ============================================================================

    const contextValue: DocumentContextType = useMemo(() => ({
        documents,
        addDocument,
        updateDocument,
        deleteDocument,
        verifyDocument,
        rejectDocument,
        getDocumentsByCaseId,
        getDocumentsByStatus
    }), [documents, addDocument, updateDocument, deleteDocument, verifyDocument, rejectDocument, getDocumentsByCaseId, getDocumentsByStatus]);

    return (
        <DocumentContext.Provider value={contextValue}>
            {children}
        </DocumentContext.Provider>
    );
}

export function useDocuments() {
    const ctx = useContext(DocumentContext);
    if (!ctx) throw new Error('useDocuments must be used inside DocumentProvider');
    return ctx;
}
