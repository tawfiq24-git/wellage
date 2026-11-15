import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Maximize2,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { AiChatMessage, ElderlyProfile } from '../types';

export const WELLAGE_AI_SUGGESTED_QUESTIONS = [
  'What medicines should I take today?',
  'When is my next appointment?',
  'Did I miss any medication?',
  'Show my weekly medication report.',
  'How can I maintain a healthy daily routine?',
  'How do I add a new medicine?',
];

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface WellAgeAiChatProps {
  profile: ElderlyProfile;
  messages: AiChatMessage[];
  loadingHistory?: boolean;
  onMessagesChange: React.Dispatch<React.SetStateAction<AiChatMessage[]>>;
  variant: 'fullscreen' | 'floating';
  onExpandToFullScreen?: () => void;
  onCloseFloating?: () => void;
}

export function WellAgeAiChat({
  profile,
  messages,
  loadingHistory = false,
  onMessagesChange,
  variant,
  onExpandToFullScreen,
  onCloseFloating,
}: WellAgeAiChatProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const speechInputSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
  }, [ttsSupported]);

  function toggleVoiceInput() {
    if (!speechInputSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SpeechRecCtor) return;
    const recognition = new SpeechRecCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function toggleSpeak(msg: AiChatMessage) {
    if (!ttsSupported) return;
    if (speakingId === msg.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(msg.text);
    utterance.rate = 0.92;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(msg.id);
    window.speechSynthesis.speak(utterance);
  }

  async function handleClearConversation() {
    if (sending || clearing) return;
    setClearing(true);
    setError(null);
    if (ttsSupported) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
    try {
      const res = await api.clearAiHistory(profile.id);
      onMessagesChange([res.welcomeMessage]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to clear conversation right now.',
      );
    } finally {
      setClearing(false);
    }
  }

  async function sendMessage(textToSend: string) {
    const clean = textToSend.trim();
    if (!clean || sending) return;

    setError(null);
    const optimisticUserMsg: AiChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: clean,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, optimisticUserMsg];
    onMessagesChange(nextMessages);
    setInput('');
    setSending(true);

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-10)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await api.chatWithAi(profile.id, clean, historyPayload);

      const assistantMsg: AiChatMessage = res.assistantMessage || {
        id: `a_${Date.now()}`,
        role: 'assistant',
        text: res.reply,
        createdAt: new Date().toISOString(),
      };

      onMessagesChange((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to reach WellAge AI right now.',
      );
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  const isFloating = variant === 'floating';

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white flex flex-col overflow-hidden ${
        isFloating
          ? 'h-[560px] max-h-[80vh] shadow-xl'
          : 'h-[calc(100vh-19rem)] min-h-[540px]'
      }`}
    >
      {/* Chat Header */}
      <div className="border-b border-slate-200 bg-white px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-sky-700 text-white flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-slate-900 truncate">
              WellAge AI
            </h2>
            <p className="text-xs text-slate-500 truncate">
              Your Caring Healthcare Companion · {profile.fullName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleClearConversation}
            disabled={clearing || sending}
            title="Clear conversation"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className={isFloating ? 'hidden sm:inline' : ''}>Clear</span>
          </button>

          {isFloating && onExpandToFullScreen && (
            <button
              type="button"
              onClick={onExpandToFullScreen}
              title="Open full-screen WellAge AI"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {isFloating && onCloseFloating && (
            <button
              type="button"
              onClick={onCloseFloating}
              aria-label="Close WellAge AI chat"
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Compact Safety Notice in Floating Mode */}
      {isFloating && (
        <div className="border-b border-violet-200 bg-violet-50 px-4 py-2 text-xs text-violet-950 flex items-center gap-2 shrink-0">
          <ShieldAlert className="w-4 h-4 text-violet-700 shrink-0" />
          <span>
            General routine info only—not medical advice. For emergencies, call 911.
          </span>
        </div>
      )}

      {/* Suggested Questions */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 sm:px-5 py-2.5 flex items-center gap-2 overflow-x-auto sm:flex-wrap shrink-0">
        {WELLAGE_AI_SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={sending}
            onClick={() => sendMessage(q)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Scrollable Chat Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {loadingHistory ? (
          <div className="space-y-3">
            <div className="h-16 w-3/4 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-12 w-1/2 ml-auto rounded-2xl bg-slate-100 animate-pulse" />
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
                  isFloating ? 'text-sm' : 'text-base'
                } leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-sky-700 text-white rounded-br-sm'
                    : 'border border-slate-200 bg-slate-50 text-slate-900 rounded-bl-sm'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center justify-between gap-4 mb-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700">
                      <Bot className="w-3.5 h-3.5" />
                      WellAge AI
                    </span>
                    {ttsSupported && (
                      <button
                        type="button"
                        onClick={() => toggleSpeak(m)}
                        aria-label={
                          speakingId === m.id ? 'Stop reading aloud' : 'Read response aloud'
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-sky-700 cursor-pointer"
                      >
                        {speakingId === m.id ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5" /> Stop
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" /> Listen
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                <p className="whitespace-pre-wrap">{m.text}</p>

                {m.createdAt && (
                  <p
                    className={`mt-1.5 text-[11px] tabular-nums ${
                      m.role === 'user' ? 'text-sky-100 text-right' : 'text-slate-400'
                    }`}
                  >
                    {new Date(m.createdAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {sending && (
          <div className="flex justify-start" aria-live="polite">
            <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-sky-700 animate-bounce [animation-delay:-0.2s]" />
                <span className="h-2 w-2 rounded-full bg-sky-700 animate-bounce [animation-delay:-0.1s]" />
                <span className="h-2 w-2 rounded-full bg-sky-700 animate-bounce" />
              </span>
              <span>WellAge AI is typing...</span>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-700 hover:text-rose-900 text-xs font-semibold shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-white p-3.5 sm:p-4 flex items-center gap-2 shrink-0"
      >
        {speechInputSupported && (
          <button
            type="button"
            onClick={toggleVoiceInput}
            aria-label={listening ? 'Stop voice dictation' : 'Speak your question'}
            title={listening ? 'Stop voice dictation' : 'Speak your question'}
            className={`inline-flex items-center justify-center rounded-xl p-2.5 sm:p-3 border transition-colors cursor-pointer shrink-0 ${
              listening
                ? 'border-rose-300 bg-rose-50 text-rose-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        )}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            listening
              ? 'Listening... speak clearly'
              : 'Ask about today’s medicines, appointments, or wellness...'
          }
          className={`flex-1 min-w-0 rounded-xl border border-slate-300 px-3.5 py-2.5 sm:py-3 ${
            isFloating ? 'text-sm' : 'text-base'
          } text-slate-900 focus:border-sky-700 focus:outline-none`}
        />

        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white hover:bg-sky-800 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
          <span className={isFloating ? 'hidden sm:inline' : ''}>Send</span>
        </button>
      </form>
    </div>
  );
}
