import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { AiChatMessage, ElderlyProfile } from '../types';
import { WellAgeAiChat } from './WellAgeAiChat';

interface AiAssistantViewProps {
  profile: ElderlyProfile;
  messages: AiChatMessage[];
  loadingHistory: boolean;
  onMessagesChange: React.Dispatch<React.SetStateAction<AiChatMessage[]>>;
}

export function AiAssistantView({
  profile,
  messages,
  loadingHistory,
  onMessagesChange,
}: AiAssistantViewProps) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          WellAge AI — Your Caring Healthcare Companion
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Schedule guidance, appointment lookup, weekly adherence summaries, and voice-friendly
          routine support for {profile.fullName}.
        </p>
      </div>

      {/* Prominent Medical Safety Notice */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5 flex items-start gap-3 text-sm text-violet-950">
        <ShieldAlert className="w-5 h-5 text-violet-700 shrink-0 mt-0.5" />
        <p>
          <strong>Medical Safety Notice:</strong> WellAge AI provides general healthcare
          routine information only—not professional medical advice. It never diagnoses
          diseases, prescribes medications, recommends dosage changes, or advises taking extra
          doses after a missed dose. If you experience serious or urgent symptoms, please seek
          immediate emergency medical help.
        </p>
      </div>

      <WellAgeAiChat
        profile={profile}
        messages={messages}
        loadingHistory={loadingHistory}
        onMessagesChange={onMessagesChange}
        variant="fullscreen"
      />
    </div>
  );
}
