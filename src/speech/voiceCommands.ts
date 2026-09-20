import type { SpeechCommand, SpeechLanguageCode } from './types';

const commands: Partial<Record<SpeechLanguageCode, SpeechCommand[]>> = {
  as: [
    { intent: 'start_whos_who', phrases: ["who's who খোলক", "who's who আৰম্ভ কৰক"] },
    { intent: 'start_recipe', phrases: ['recipe খোলক', 'recipe আৰম্ভ কৰক'] },
    { intent: 'start_days_plan', phrases: ["day's plan খোলক", 'আজিৰ পৰিকল্পনা খোলক'] },
    { intent: 'start_skills', phrases: ['learn together খোলক'] },
  ],
  bn: [
    { intent: 'start_whos_who', phrases: ["who's who খুলুন", "who's who শুরু করুন"] },
    { intent: 'start_recipe', phrases: ['recipe খুলুন', 'recipe শুরু করুন'] },
    { intent: 'start_days_plan', phrases: ["day's plan খুলুন", 'আজকের পরিকল্পনা খুলুন'] },
    { intent: 'start_skills', phrases: ['learn together খুলুন'] },
  ],
};

export function voiceCommandsFor(languageCode: SpeechLanguageCode): SpeechCommand[] {
  return commands[languageCode] ?? [];
}
