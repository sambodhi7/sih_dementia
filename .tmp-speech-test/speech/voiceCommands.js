"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceCommandsFor = voiceCommandsFor;
const commands = {
    en: [
        { intent: 'go_home', phrases: ['go back', 'back', 'take me back', 'go home'] },
        { intent: 'start_whos_who', phrases: ["who's who", 'who is who', 'whose who', "open who's who", "play who's who", "start who's who"] },
        { intent: 'start_recipe', phrases: ['recipe', 'open recipe', 'play recipe', 'start recipe'] },
        { intent: 'start_days_plan', phrases: ["day's plan", 'days plan', 'daily plan', "today's plan", "open day's plan", 'open daily plan', "start day's plan"] },
        { intent: 'start_skills', phrases: ['learn together', 'open learn together', 'start learn together'] },
    ],
    hi: [
        { intent: 'go_home', phrases: ['वापस जाएं', 'पीछे जाएं', 'वापस', 'घर जाएं'] },
        { intent: 'start_whos_who', phrases: ["who's who", 'हू इज़ हू', "who's who खोलें", "who's who शुरू करें", "who's who चलाओ"] },
        { intent: 'start_recipe', phrases: ['recipe', 'रेसिपी', 'recipe खोलें', 'recipe शुरू करें', 'रेसिपी खोलो'] },
        { intent: 'start_days_plan', phrases: ["day's plan", 'डेली प्लान', "day's plan खोलें", 'आज की योजना खोलें', 'डेली प्लान खोलो'] },
        { intent: 'start_skills', phrases: ['learn together', 'साथ में सीखें', 'learn together खोलें', 'साथ में सीखें खोलें'] },
    ],
    as: [
        { intent: 'go_home', phrases: ['পিছলৈ যাওক', 'ঘৰলৈ যাওক', 'পিছলৈ', 'ঘৰলৈ'] },
        { intent: 'start_whos_who', phrases: ["who's who", "who's who খোলক", "who's who আৰম্ভ কৰক"] },
        { intent: 'start_recipe', phrases: ['recipe', 'recipe খোলক', 'recipe আৰম্ভ কৰক'] },
        { intent: 'start_days_plan', phrases: ["day's plan", "day's plan খোলক", 'আজিৰ পৰিকল্পনা খোলক'] },
        { intent: 'start_skills', phrases: ['learn together', 'learn together খোলক'] },
    ],
    bn: [
        { intent: 'go_home', phrases: ['ফিরে যান', 'পিছনে যান', 'ফিরে চলুন', 'বাড়ি যান'] },
        { intent: 'start_whos_who', phrases: ["who's who", "who's who খুলুন", "who's who শুরু করুন"] },
        { intent: 'start_recipe', phrases: ['recipe', 'রেসিপি', 'recipe খুলুন', 'recipe শুরু করুন'] },
        { intent: 'start_days_plan', phrases: ["day's plan", 'আজকের পরিকল্পনা', "day's plan খুলুন", 'আজকের পরিকল্পনা খুলুন'] },
        { intent: 'start_skills', phrases: ['learn together', 'একসাথে শিখি', 'learn together খুলুন'] },
    ],
};
function voiceCommandsFor(languageCode) {
    return commands[languageCode] ?? [];
}
