import { recipes, pantry, remainingIngredients, choiceFits, nextRecipeStep } from './model';
import type { RecipeId, Ingredient } from './model';
function check(value: boolean, message: string) { if (!value) throw new Error(message); }
for (const id of Object.keys(recipes) as RecipeId[]) {
  const used: Ingredient[] = [];
  check(new Set(recipes[id].map(step => step.id)).size === recipes[id].length, `${id}: stable unique steps`);
  for (const step of recipes[id]) {
    check(Boolean(step.action) !== Boolean(step.choices), `${id}: each step offers a choice or an action`);
    for (const ingredient of step.choices ?? []) {
      check(pantry[id].includes(ingredient), `${id}: ingredient is available`);
      check(choiceFits(step, ingredient), `${id}: suggested choice is accepted`);
      used.push(ingredient);
      check(!remainingIngredients(id, used).includes(ingredient), `${id}: cannot add same ingredient twice`);
    }
  }
  check(remainingIngredients(id, used).length === 0, `${id}: all ingredients can be used`);
  check(recipes[id].at(-1)?.action === 'serve', `${id}: ends with serving`);
}
check(choiceFits(recipes.til_pitha[2], 'sesame') && choiceFits(recipes.til_pitha[2], 'jaggery'), 'both filling ingredients accepted in either order');
check(choiceFits(recipes.chakhwi[1], 'bamboo') && choiceFits(recipes.chakhwi[1], 'papaya'), 'both vegetables accepted in either order');
function permutations(values: Ingredient[]): Ingredient[][] {
  if (!values.length) return [[]];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
}
for (const id of Object.keys(recipes) as RecipeId[]) {
  for (const order of permutations(pantry[id])) {
    const used: Ingredient[] = [];
    let current = 0;
    let actions = 0;
    while (current < recipes[id].length && actions++ < 20) {
      if (recipes[id][current].choices) {
        const ingredient = order.find(value => !used.includes(value));
        check(Boolean(ingredient), `${id}: no empty ingredient dead end`);
        used.push(ingredient!);
      }
      current = nextRecipeStep(id, current, used);
    }
    check(current === recipes[id].length, `${id}: every family ingredient order reaches completion`);
  }
}
check(nextRecipeStep('til_pitha', 2, ['flour', 'sesame']) === 2, 'filling waits for both ingredients');
check(nextRecipeStep('chakhwi', 1, ['water', 'papaya']) === 1, 'vegetables wait for both ingredients');
console.log('Recipe catalogue and complete-flow checks passed');
