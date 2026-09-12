export type RecipeId = 'thukpa' | 'til_pitha' | 'chakhwi';
export type Ingredient = 'vegetables' | 'broth' | 'noodles' | 'flour' | 'sesame' | 'jaggery' | 'bamboo' | 'papaya' | 'water';
export type CookingAction = 'stir' | 'spread' | 'roll' | 'serve';
export type RecipeStep = { id: string; choices?: Ingredient[]; action?: CookingAction };
export const recipes: Record<RecipeId, RecipeStep[]> = {
  thukpa: [{ id: 'vegetables', choices: ['vegetables'] }, { id: 'broth', choices: ['broth'] }, { id: 'noodles', choices: ['noodles'] }, { id: 'stir', action: 'stir' }, { id: 'serve', action: 'serve' }],
  til_pitha: [{ id: 'flour', choices: ['flour'] }, { id: 'spread', action: 'spread' }, { id: 'filling', choices: ['sesame', 'jaggery'] }, { id: 'roll', action: 'roll' }, { id: 'serve', action: 'serve' }],
  chakhwi: [{ id: 'water', choices: ['water'] }, { id: 'vegetables', choices: ['bamboo', 'papaya'] }, { id: 'stir', action: 'stir' }, { id: 'serve', action: 'serve' }],
};
export const pantry: Record<RecipeId, Ingredient[]> = { thukpa: ['vegetables', 'broth', 'noodles'], til_pitha: ['flour', 'sesame', 'jaggery'], chakhwi: ['water', 'bamboo', 'papaya'] };
export function remainingIngredients(recipe: RecipeId, used: Ingredient[]) { return pantry[recipe].filter(ingredient => !used.includes(ingredient)); }
export function choiceFits(step: RecipeStep, ingredient: Ingredient) { return Boolean(step.choices?.includes(ingredient)); }
export function nextRecipeStep(recipe: RecipeId, current: number, used: Ingredient[]): number {
  const step = recipes[recipe][current];
  if (!step || step.choices?.some(ingredient => !used.includes(ingredient))) return current;
  let next = current + 1;
  while (recipes[recipe][next]?.choices?.every(ingredient => used.includes(ingredient))) next++;
  return next;
}
