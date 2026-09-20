import type { CookingAction, Ingredient, RecipeId } from './model';
// Content is independent of the game engine. Regional translations need family review.
export const recipeEnglish = {
  title: 'Our family kitchen', choose: 'What shall we make together?', invitation: 'You bring the memories. Let’s cook together on the screen.',
  family: 'Every family has its own way.', next: 'What goes in next?', hint: 'Help me remember', again: 'Hear again', home: 'Home',
  add: 'Add to the dish', continue: 'Continue', finish: 'Made together', thanks: 'Thank you for sharing your way of cooking.', another: 'Make another dish',
  variant: 'That’s our family’s way', gentle: 'We can try this together.', gesture: 'Move your finger across the picture, or use the large button below.',
  saved: 'Added to our dish.', saving: 'One moment…', problem: 'Your moment could not be saved. Please try again.', retry: 'Try again',
  audioProblem: 'The voice is unavailable on this device. We can read together.', symbolic: 'A screen activity to share memories, not instructions for cooking with heat.',
  names: { thukpa: 'Thukpa', til_pitha: 'Til pitha', chakhwi: 'Chakhwi' } satisfies Record<RecipeId, string>,
  descriptions: { thukpa: 'A warm bowl of vegetable noodles', til_pitha: 'Rice rolls with sesame and jaggery', chakhwi: 'A familiar Tripuri vegetable pot' } satisfies Record<RecipeId, string>,
  ingredients: { vegetables: 'Vegetables', broth: 'Broth', noodles: 'Noodles', flour: 'Rice flour', sesame: 'Sesame', jaggery: 'Jaggery', bamboo: 'Prepared bamboo shoots', papaya: 'Green papaya', water: 'Water' } satisfies Record<Ingredient, string>,
  actions: { stir: 'Stir the pot', spread: 'Spread the rice flour', roll: 'Roll the pitha', serve: 'Serve our dish' } satisfies Record<CookingAction, string>,
  cues: { vegetables: 'Let’s start with the vegetables.', broth: 'Something to make a warm soup.', noodles: 'The long strands go in now.', flour: 'What makes the rice wrapper?', filling: 'What goes inside our sweet pitha?', water: 'What shall we pour into the pot?', chakhwiVegetables: 'Choose the vegetables for our pot.' },
};
export type RecipeCopy = typeof recipeEnglish;

const recipeHindi: RecipeCopy = {
  title: 'हमारी पारिवारिक रसोई', choose: 'हम साथ में क्या बनाएँ?', invitation: 'आप यादें साझा करें। चलिए स्क्रीन पर साथ में पकाते हैं।',
  family: 'हर परिवार का अपना तरीका होता है।', next: 'अब आगे क्या डालें?', hint: 'याद करने में मदद करें', again: 'फिर सुनें', home: 'घर',
  add: 'व्यंजन में डालें', continue: 'आगे बढ़ें', finish: 'साथ मिलकर बनाया', thanks: 'अपने परिवार का तरीका साझा करने के लिए धन्यवाद।', another: 'दूसरा व्यंजन बनाएँ',
  variant: 'हमारे परिवार में ऐसे बनता है', gentle: 'हम इसे साथ में कर सकते हैं।', gesture: 'चित्र पर उँगली चलाएँ या नीचे दिए बड़े बटन का उपयोग करें।',
  saved: 'हमारे व्यंजन में जोड़ दिया गया।', saving: 'एक क्षण…', problem: 'यह पल सहेजा नहीं जा सका। फिर प्रयास करें।', retry: 'फिर प्रयास करें',
  audioProblem: 'इस डिवाइस पर आवाज़ उपलब्ध नहीं है। हम साथ में पढ़ सकते हैं।', symbolic: 'यह यादें साझा करने की स्क्रीन गतिविधि है, गर्मी में खाना पकाने के निर्देश नहीं।',
  names: { thukpa: 'Thukpa', til_pitha: 'Til pitha', chakhwi: 'Chakhwi' },
  descriptions: { thukpa: 'सब्ज़ियों और नूडल्स का गर्म कटोरा', til_pitha: 'तिल और गुड़ वाले चावल के रोल', chakhwi: 'त्रिपुरा की परिचित सब्ज़ी' },
  ingredients: { vegetables: 'सब्ज़ियाँ', broth: 'शोरबा', noodles: 'नूडल्स', flour: 'चावल का आटा', sesame: 'तिल', jaggery: 'गुड़', bamboo: 'तैयार बाँस के अंकुर', papaya: 'कच्चा पपीता', water: 'पानी' },
  actions: { stir: 'बर्तन चलाएँ', spread: 'चावल का आटा फैलाएँ', roll: 'पीठा रोल करें', serve: 'व्यंजन परोसें' },
  cues: { vegetables: 'सब्ज़ियों से शुरू करते हैं।', broth: 'गर्म सूप के लिए कुछ।', noodles: 'अब लंबे नूडल्स डालें।', flour: 'चावल की परत किससे बनती है?', filling: 'मीठे पीठा के अंदर क्या जाता है?', water: 'बर्तन में क्या डालें?', chakhwiVegetables: 'अपनी सब्ज़ी चुनें।' },
};

const recipeAssamese: RecipeCopy = {
  title: 'আমাৰ পৰিয়ালৰ পাকঘৰ', choose: 'আমি একেলগে কি বনাম?', invitation: 'আপুনি স্মৃতিবোৰ আনক। আহক স্ক্ৰিনত একেলগে ৰান্ধোঁ।',
  family: 'প্ৰতিটো পৰিয়ালৰ নিজা পদ্ধতি থাকে।', next: 'ইয়াৰ পিছত কি দিম?', hint: 'মনত পেলাবলৈ সহায় কৰক', again: 'পুনৰ শুনক', home: 'ঘৰ',
  add: 'ব্যঞ্জনত যোগ কৰক', continue: 'আগবাঢ়ক', finish: 'একেলগে বনোৱা হ’ল', thanks: 'আপোনাৰ পৰিয়ালৰ পদ্ধতি ভাগ কৰাৰ বাবে ধন্যবাদ।', another: 'আন এটা ব্যঞ্জন বনাওক',
  variant: 'আমাৰ পৰিয়ালত এনেকৈ কৰে', gentle: 'আমি একেলগে চেষ্টা কৰিব পাৰোঁ।', gesture: 'ছবিখনৰ ওপৰেৰে আঙুলি লৰাওক বা তলৰ ডাঙৰ বুটামটো ব্যৱহাৰ কৰক।',
  saved: 'আমাৰ ব্যঞ্জনত যোগ হ’ল।', saving: 'এটা মুহূৰ্ত…', problem: 'এই মুহূৰ্তটো সংৰক্ষণ নহ’ল। পুনৰ চেষ্টা কৰক।', retry: 'পুনৰ চেষ্টা কৰক',
  audioProblem: 'এই ডিভাইচত কণ্ঠ উপলব্ধ নহয়। আমি একেলগে পঢ়িব পাৰোঁ।', symbolic: 'এইটো স্মৃতি ভাগ কৰাৰ স্ক্ৰিন কাৰ্যকলাপ, জুইত ৰন্ধাৰ নিৰ্দেশ নহয়।',
  names: { thukpa: 'Thukpa', til_pitha: 'Til pitha', chakhwi: 'Chakhwi' },
  descriptions: { thukpa: 'শাক-পাচলি আৰু নুডলছৰ গৰম বাটি', til_pitha: 'তিল আৰু গুড়ৰ চাউলৰ পিঠা', chakhwi: 'ত্ৰিপুৰাৰ চিনাকি শাক-পাচলিৰ ব্যঞ্জন' },
  ingredients: { vegetables: 'শাক-পাচলি', broth: 'জোল', noodles: 'নুডলছ', flour: 'চাউলৰ গুড়ি', sesame: 'তিল', jaggery: 'গুড়', bamboo: 'প্ৰস্তুত বাঁহৰ গাজ', papaya: 'কেঁচা অমিতা', water: 'পানী' },
  actions: { stir: 'পাত্ৰটো লৰাওক', spread: 'চাউলৰ গুড়ি মেলক', roll: 'পিঠা মেৰিয়াওক', serve: 'ব্যঞ্জন পৰিৱেশন কৰক' },
  cues: { vegetables: 'শাক-পাচলিৰে আৰম্ভ কৰোঁ।', broth: 'গৰম জোলৰ বাবে কিবা এটা।', noodles: 'এতিয়া দীঘল নুডলছ দিওঁ।', flour: 'চাউলৰ আৱৰণ কিহেৰে হয়?', filling: 'মিঠা পিঠাৰ ভিতৰত কি যায়?', water: 'পাত্ৰত কি ঢালিম?', chakhwiVegetables: 'আমাৰ ব্যঞ্জনৰ বাবে শাক-পাচলি বাছক।' },
};

const recipeBengali: RecipeCopy = {
  title: 'আমাদের পারিবারিক রান্নাঘর', choose: 'আমরা একসঙ্গে কী বানাব?', invitation: 'আপনি স্মৃতিগুলো আনুন। চলুন স্ক্রিনে একসঙ্গে রান্না করি।',
  family: 'প্রতিটি পরিবারের নিজস্ব পদ্ধতি আছে।', next: 'এরপর কী দেব?', hint: 'মনে করতে সাহায্য করুন', again: 'আবার শুনুন', home: 'হোম',
  add: 'ব্যঞ্জনে যোগ করুন', continue: 'এগিয়ে যান', finish: 'একসঙ্গে বানানো হয়েছে', thanks: 'আপনার পরিবারের পদ্ধতি ভাগ করার জন্য ধন্যবাদ।', another: 'আরেকটি ব্যঞ্জন বানান',
  variant: 'আমাদের পরিবারে এভাবেই হয়', gentle: 'আমরা একসঙ্গে চেষ্টা করতে পারি।', gesture: 'ছবির ওপর আঙুল চালান অথবা নিচের বড় বোতামটি ব্যবহার করুন।',
  saved: 'আমাদের ব্যঞ্জনে যোগ হয়েছে।', saving: 'একটু অপেক্ষা করুন…', problem: 'এই মুহূর্তটি সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।', retry: 'আবার চেষ্টা করুন',
  audioProblem: 'এই ডিভাইসে কণ্ঠ পাওয়া যাচ্ছে না। আমরা একসঙ্গে পড়তে পারি।', symbolic: 'এটি স্মৃতি ভাগ করার স্ক্রিন কার্যকলাপ, আগুনে রান্নার নির্দেশ নয়।',
  names: { thukpa: 'Thukpa', til_pitha: 'Til pitha', chakhwi: 'Chakhwi' },
  descriptions: { thukpa: 'সবজি ও নুডলসের গরম বাটি', til_pitha: 'তিল ও গুড়ের চালের রোল', chakhwi: 'ত্রিপুরার পরিচিত সবজির পদ' },
  ingredients: { vegetables: 'সবজি', broth: 'ঝোল', noodles: 'নুডলস', flour: 'চালের গুঁড়া', sesame: 'তিল', jaggery: 'গুড়', bamboo: 'প্রস্তুত বাঁশের কোঁড়ল', papaya: 'কাঁচা পেঁপে', water: 'পানি' },
  actions: { stir: 'পাত্রটি নাড়ুন', spread: 'চালের গুঁড়া ছড়ান', roll: 'পিঠা রোল করুন', serve: 'ব্যঞ্জন পরিবেশন করুন' },
  cues: { vegetables: 'সবজি দিয়ে শুরু করি।', broth: 'গরম স্যুপের জন্য কিছু।', noodles: 'এবার লম্বা নুডলস দিন।', flour: 'চালের আবরণ কী দিয়ে হয়?', filling: 'মিষ্টি পিঠার ভেতরে কী যায়?', water: 'পাত্রে কী ঢালব?', chakhwiVegetables: 'আমাদের পদের জন্য সবজি বেছে নিন।' },
};

export function getRecipeCopy(language: string): RecipeCopy {
  if (language === 'hindi') return recipeHindi;
  if (language === 'assamese') return recipeAssamese;
  if (language === 'bengali') return recipeBengali;
  return recipeEnglish;
}
