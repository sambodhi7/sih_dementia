import memberGames from './packs/en/member-games.json';
import memberRoutine from './packs/en/member-routine.json';
import memberSettings from './packs/en/member-settings.json';
import manifest from './packs/en/manifest.json';
import assameseGames from './packs/as/member-games.json';
import assameseRoutine from './packs/as/member-routine.json';
import assameseSettings from './packs/as/member-settings.json';
import bengaliGames from './packs/bn/member-games.json';
import bengaliRoutine from './packs/bn/member-routine.json';
import bengaliSettings from './packs/bn/member-settings.json';
import hindiGames from './packs/hi/member-games.json';
import hindiRoutine from './packs/hi/member-routine.json';
import hindiSettings from './packs/hi/member-settings.json';
import type { SpeechLanguageCode, SpeechPackManifest, SpeechPage, SpeechPageId } from './types';

const englishPages: Record<SpeechPageId, SpeechPage> = {
  'member.games': memberGames as SpeechPage,
  'member.routine': memberRoutine as SpeechPage,
  'member.settings': memberSettings as SpeechPage,
};

const pagesByLanguage: Partial<Record<SpeechLanguageCode, Record<SpeechPageId, SpeechPage>>> = {
  en: englishPages,
  as: { 'member.games': assameseGames as SpeechPage, 'member.routine': assameseRoutine as SpeechPage, 'member.settings': assameseSettings as SpeechPage },
  bn: { 'member.games': bengaliGames as SpeechPage, 'member.routine': bengaliRoutine as SpeechPage, 'member.settings': bengaliSettings as SpeechPage },
  hi: { 'member.games': hindiGames as SpeechPage, 'member.routine': hindiRoutine as SpeechPage, 'member.settings': hindiSettings as SpeechPage },
};

export const bundledEnglishManifest = manifest as SpeechPackManifest;

export function speechLanguageCodeFromAppId(languageId: string): SpeechLanguageCode | null {
  if (languageId === 'english') return 'en';
  if (languageId === 'assamese') return 'as';
  if (languageId === 'bengali') return 'bn';
  if (languageId === 'hindi') return 'hi';
  return null;
}

export function getBundledSpeechPage(languageCode: SpeechLanguageCode, pageId: SpeechPageId): SpeechPage | null {
  return pagesByLanguage[languageCode]?.[pageId] ?? null;
}

export function speechTextFor(page: SpeechPage, groupId?: string): string {
  return page.utterances
    .filter((item) => !groupId || item.groupId === groupId)
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join(' ');
}
