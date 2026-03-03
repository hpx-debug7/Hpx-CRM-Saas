'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ComposeEmailModal from './ComposeEmailModal';

interface EmailThread {
  id: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  folder: string | null;
}

interface EmailMessage {
  id: string;
  from: string | null;
  to: string | null;
  cc: string | null;
  subject: string | null;
  snippet: string | null;
  sentAt: string | null;
  isRead: boolean;
  hasAttachments: boolean;
  attachmentsMeta: string | null;
}

export default function EmailInboxClient() {
  const searchParams = useSearchParams();
  const threadParam = searchParams.get('thread');
  const [folder, setFolder] = useState('inbox');
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [showCompose, setShowCompose] = useState(false);

  const refreshThreads = async () => {
    const res = await fetch(`/api/email/inbox?folder=${folder}`);
    const data = await res.json();
    if (data.success) {
      setThreads(data.data || []);
    }
  };

  const loadThread = async (id: string) => {
    const res = await fetch(`/api/email/thread/${id}`);
    const data = await res.json();
    if (data.success) {
      setSelectedThread(data.data);
      setMessages(data.data.messages || []);
    }
  };

  useEffect(() => {
    refreshThreads();
  }, [folder]);

  useEffect(() => {
    if (threadParam) {
      loadThread(threadParam);
    }
  }, [threadParam]);

  const folders = useMemo(() => [
    { id: 'inbox', label: 'Inbox' },
    { id: 'sent', label: 'Sent' },
    { id: 'archive', label: 'Archived' },
  ], []);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <aside className="w-56 border-r bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-semibold text-gray-800">Folders</div>
          <button
            onClick={() => setShowCompose(true)}
            className="text-xs px-2 py-1 rounded bg-purple-600 text-white"
          >
            Compose
          </button>
        </div>
        <div className="space-y-1">
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolder(f.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${folder === f.id ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 grid grid-cols-[320px_1fr]">
        <div className="border-r bg-white overflow-y-auto">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => loadThread(thread.id)}
              className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${selectedThread?.id === thread.id ? 'bg-purple-50' : ''}`}
            >
              <div className="text-sm font-medium text-gray-800 line-clamp-1">
                {thread.subject || '(No subject)'}
              </div>
              <div className="text-xs text-gray-500 line-clamp-1">{thread.snippet}</div>
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto">
          {threads.length === 0 && (
            <div className="mb-6 p-4 rounded border border-dashed text-sm text-gray-600">
              <div className="font-semibold text-gray-700 mb-2">Connect an email account</div>
              <div className="flex gap-2">
                <a href="/api/oauth/google" className="px-3 py-1.5 rounded bg-purple-600 text-white text-xs">
                  Connect Gmail
                </a>
                <a href="/api/oauth/microsoft" className="px-3 py-1.5 rounded border border-gray-200 text-xs">
                  Connect Outlook
                </a>
              </div>
            </div>
          )}
          {!selectedThread && <div className="text-gray-500">Select a thread to view messages.</div>}
          {selectedThread && (
            <>
              <div className="mb-4">
                <h1 className="text-lg font-semibold text-gray-800">{selectedThread.subject || '(No subject)'}</h1>
                <div className="text-xs text-gray-500">{selectedThread.snippet}</div>
              </div>
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="border rounded p-3 bg-white shadow-sm">
                    <div className="text-xs text-gray-500">{msg.from}</div>
                    <div className="text-sm text-gray-700">{msg.snippet}</div>
                    {msg.hasAttachments && (
                      <div className="mt-2 text-xs text-gray-500">Attachments available</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <ComposeEmailModal isOpen={showCompose} onClose={() => setShowCompose(false)} onSent={refreshThreads} />
    </div>
  );
}
