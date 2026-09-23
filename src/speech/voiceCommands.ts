import type { SpeechCommand, SpeechLanguageCode } from './types';

const commands: Partial<Record<SpeechLanguageCode, SpeechCommand[]>> = {
  en: [
    { intent: 'go_home', phrases: ['go back', 'back', 'take me back', 'go home'] },
    { intent: 'start_whos_who', phrases: ["open who's who", "play who's who", "start who's who"] },
    { intent: 'start_recipe', phrases: ['open recipe', 'play recipe', 'start recipe'] },
    { intent: 'start_days_plan', phrases: ["open day's plan", 'open daily plan', "start day's plan"] },
    { intent: 'start_skills', phrases: ['open learn together', 'start learn together'] },
  ],
  hi: [
    { intent: 'go_home', phrases: ['वापस जाएं', 'पीछे जाएं', 'वापस', 'घर जाएं'] },
    { intent: 'start_whos_who', phrases: ["who's who खोलें", "who's who शुरू करें", "who's who चलाओ"] },
    { intent: 'start_recipe', phrases: ['recipe खोलें', 'recipe शुरू करें', 'रेसिपी खोलो'] },
    { intent: 'start_days_plan', phrases: ["day's plan खोलें", 'आज की योजना खोलें', 'डेली प्लान खोलो'] },
    { intent: 'start_skills', phrases: ['learn together खोलें', 'साथ में सीखें खोलें'] },
  ],
  as: [
    { intent: 'start_whos_who', phrases: ["who's who খোলক", "who's who আৰম্ভ কৰক"] },
    { intent: 'start_recipe', phrases: ['recipe খোলক', 'recipe আৰম্ভ কৰক'] },
    { intent: 'start_days_plan', phrases: ["day's plan খোলক", 'আজিৰ পৰিকল্পনা খোলক'] },
    { intent: 'start_skills', phrases: ['learn together খোলক'] },
  ],
  bn: [
    { intent: 'go_home', phrases: ['ফিরে যান', 'পিছনে যান', 'ফিরে চলুন', 'বাড়ি যান'] },
    { intent: 'start_whos_who', phrases: ["who's who খুলুন", "who's who শুরু করুন"] },
    { intent: 'start_recipe', phrases: ['recipe খুলুন', 'recipe শুরু করুন'] },
    { intent: 'start_days_plan', phrases: ["day's plan খুলুন", 'আজকের পরিকল্পনা খুলুন'] },
    { intent: 'start_skills', phrases: ['learn together খুলুন'] },
  ],
};

export function voiceCommandsFor(languageCode: SpeechLanguageCode): SpeechCommand[] {
  return commands[languageCode] ?? [];
}
