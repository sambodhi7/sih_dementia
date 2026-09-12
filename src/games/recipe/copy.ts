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
export function getRecipeCopy(_language: string): RecipeCopy { return recipeEnglish; }
