'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ComposeEmailModal from './ComposeEmailModal';

interface EmailThread {
  id: string;
  subject: string | null;
  snippet: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export default function EmailHeaderInbox() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [open, setOpen] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const refresh = async () => {
    const [unreadRes, recentRes] = await Promise.all([
      fetch('/api/email/unread-count'),
      fetch('/api/email/recent?limit=5'),
    ]);

    const unreadData = await unreadRes.json();
    const recentData = await recentRes.json();
    if (unreadData.success) setUnreadCount(unreadData.data.unreadCount);
    if (recentData.success) setThreads(recentData.data || []);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SUBSCRIBE_URL;
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = () => refresh();
    ws.onerror = () => ws.close();
    return () => ws.close();
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-full text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
        title="Inbox"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-5l-2 3h-4l-2-3H4" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-100 z-20">
          <div className="p-3 border-b text-sm font-semibold text-gray-700">Recent Emails</div>
          <div className="max-h-72 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No recent emails.</div>
            ) : (
              threads.map((thread) => (
                <Link key={thread.id} href={`/email?thread=${thread.id}`} className="block px-3 py-2 hover:bg-gray-50">
                  <div className="text-sm font-medium text-gray-800 line-clamp-1">
                    {thread.subject || '(No subject)'}
                  </div>
                  <div className="text-xs text-gray-500 line-clamp-1">{thread.snippet}</div>
                </Link>
              ))
            )}
          </div>
          <div className="p-3 border-t flex gap-2">
            <button
              onClick={() => setShowCompose(true)}
              className="flex-1 text-xs px-2 py-1.5 rounded bg-purple-600 text-white"
            >
              Compose Email
            </button>
            <Link
              href="/email"
              className="flex-1 text-xs px-2 py-1.5 rounded border border-gray-200 text-center"
            >
              Open Inbox
            </Link>
          </div>
        </div>
      )}

      <ComposeEmailModal isOpen={showCompose} onClose={() => setShowCompose(false)} onSent={refresh} />
    </div>
  );
}
