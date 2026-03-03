'use client';

import React, { useState } from 'react';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSent?: () => void;
}

export default function ComposeEmailModal({ isOpen, onClose, onSent }: ComposeEmailModalProps) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseList = (value: string) => value.split(',').map((v) => v.trim()).filter(Boolean);

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: parseList(to),
          cc: parseList(cc),
          bcc: parseList(bcc),
          subject,
          bodyText,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send');
      }
      onSent?.();
      onClose();
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBodyText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Compose Email</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {error && (
          <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <div className="space-y-3">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="To (comma separated)"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="Cc"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            value={bcc}
            onChange={(e) => setBcc(e.target.value)}
            placeholder="Bcc"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Message"
            rows={6}
            className="w-full border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded border border-gray-200">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending}
            className="px-3 py-2 text-sm rounded bg-purple-600 text-white disabled:opacity-60"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
