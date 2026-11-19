'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Availability } from '@/components/BookCard.js';
import { api } from '@/lib/client.js';

const SUGGESTIONS = [
  'I want to learn machine learning',
  'Something like Dune',
  'Books about space and the universe',
  'How can I build better habits?',
  'Available books about Indian history',
];

export default function AssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: 'Hi! Tell me what you feel like reading - a topic, a mood, or a book you enjoyed - and I will find matching books from our library.',
      books: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text) {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: message }]);
    try {
      const r = await api('/api/assistant', { method: 'POST', body: { message } });
      setMessages((m) => [...m, { role: 'bot', text: r.reply, books: r.books }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', text: 'Sorry, something went wrong: ' + e.message, books: [] }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>AI book assistant</h1>
      <p className="muted">
        Ask in your own words. The assistant searches book meanings (vector search) and, when you are logged in, also
        uses your reading history.
      </p>
      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>

      <div className="chat">
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
            {m.books && m.books.length > 0 && (
              <div className="mini-list">
                {m.books.map((b) => (
                  <div className="mini" key={b.book_id}>
                    <div>
                      <Link href={`/books/${b.book_id}`}>
                        <strong>{b.title}</strong>
                      </Link>
                      <div className="muted small">
                        {b.authors} - {b.why}
                      </div>
                    </div>
                    <Availability book={b} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="bubble bot muted">Thinking...</div>}
        <div ref={endRef} />
      </div>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. a fantasy adventure with dragons" maxLength={500} aria-label="Your question" />
        <button className="btn shrink" disabled={busy || !input.trim()} type="submit">
          Ask
        </button>
      </form>
    </>
  );
}
