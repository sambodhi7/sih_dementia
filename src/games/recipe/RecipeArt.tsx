import Svg, { Circle, Ellipse, G, Path, Rect, Line } from 'react-native-svg';
import { theme } from '../../theme';
import type { Ingredient, RecipeId } from './model';
const c = theme.colors;

export function IngredientArt({ ingredient }: { ingredient: Ingredient }) {
  return <Svg width="100%" height={86} viewBox="0 0 160 100" accessible={false}>
    {ingredient === 'noodles' ? <G fill="none" stroke={c.amber} strokeWidth={5} strokeLinecap="round">{[0, 1, 2, 3, 4].map(i => <Path key={i} d={`M${35+i*19} 22 C${10+i*19} 40 ${65+i*12} 53 ${35+i*19} 77`} />)}</G>
    : ingredient === 'water' || ingredient === 'broth' ? <G stroke={c.leaf} strokeWidth={4}><Path d="M44 15 H105 L100 80 Q74 94 49 80 Z" fill={c.white}/><Path d="M105 25 C146 17 144 65 104 62" fill="none"/><Path d="M48 47 Q75 54 102 47 L99 78 Q75 90 52 78 Z" fill={ingredient === 'broth' ? c.amberSoft : c.leafSoft}/></G>
    : ingredient === 'flour' || ingredient === 'sesame' || ingredient === 'jaggery' ? <G><Path d="M22 56 Q80 110 138 56 Z" fill={c.leafSoft} stroke={c.leaf} strokeWidth={4}/><Ellipse cx={80} cy={55} rx={58} ry={20} fill={c.white} stroke={c.leaf} strokeWidth={3}/>{ingredient === 'flour' ? <Path d="M35 56 Q80 -9 125 56 Z" fill={c.surface} stroke={c.border} strokeWidth={2}/> : ingredient === 'jaggery' ? <G fill={c.amber} stroke={c.ink} strokeWidth={2}><Rect x={51} y={31} width={28} height={28} rx={5}/><Rect x={82} y={25} width={30} height={31} rx={4}/></G> : Array.from({length: 22}, (_,i) => <Ellipse key={i} cx={45+(i%7)*11} cy={40+Math.floor(i/7)*8} rx={3} ry={2} fill={c.ink}/>)}</G>
    : ingredient === 'bamboo' ? <G fill={c.amberSoft} stroke={c.amber} strokeWidth={3}>{[0,1,2].map(i => <G key={i} transform={`translate(${35+i*32}, 0)`}><Path d="M0 76 L4 29 L15 12 L23 30 L28 76 Z"/><Path d="M3 44 H25 M2 60 H26"/></G>)}</G>
    : ingredient === 'papaya' ? <G><Path d="M35 70 Q15 20 75 15 Q126 13 130 63 Q124 97 80 89 Z" fill={c.leafSoft} stroke={c.leaf} strokeWidth={5}/><Ellipse cx={82} cy={51} rx={20} ry={28} fill={c.white}/>{[0,1,2,3,4,5].map(i=><Circle key={i} cx={76+i%2*12} cy={33+Math.floor(i/2)*15} r={3} fill={c.ink}/>)}</G>
    : <G><Path d="M32 35 L110 55 L40 83 Z" fill={c.amberSoft} stroke={c.amber} strokeWidth={4}/><Path d="M34 39 L18 17 M36 38 L40 12" stroke={c.leaf} strokeWidth={7}/><Circle cx={111} cy={36} r={25} fill={c.leafSoft} stroke={c.leaf} strokeWidth={4}/><Path d="M91 37 Q111 16 130 38 M100 18 L115 57" fill="none" stroke={c.leaf} strokeWidth={3}/></G>}
  </Svg>;
}

export function RecipeArt({ recipe, ingredients, spread = false, rolled = false, served = false, progress = 0, stirring = false }: { recipe: RecipeId; ingredients: Ingredient[]; spread?: boolean; rolled?: boolean; served?: boolean; progress?: number; stirring?: boolean }) {
  return <Svg width="100%" height="100%" viewBox="0 0 360 270" accessible={false}>
    <Ellipse cx={180} cy={238} rx={145} ry={13} fill={c.border} opacity={0.35}/>
    {recipe === 'til_pitha' ? <G>
      <Circle cx={176} cy={139} r={104} fill={served ? c.white : c.ink} stroke={c.leaf} strokeWidth={5}/>
      {!served && <Path d="M278 126 H344 V151 H278" fill={c.ink}/>}
      {ingredients.includes('flour') && !rolled && <Ellipse cx={176} cy={139} rx={spread ? 84 : 42+progress*42} ry={spread ? 77 : 26+progress*51} fill={c.surface} stroke={c.border} strokeWidth={2}/>}
      {!rolled && ingredients.includes('jaggery') && <Path d="M127 140 H225" stroke={c.amber} strokeWidth={17} strokeLinecap="round"/>}
      {!rolled && ingredients.includes('sesame') && Array.from({length: 24}, (_,i) => <Ellipse key={i} cx={132+(i%8)*13} cy={130+Math.floor(i/8)*8} rx={3} ry={2} fill={c.ink}/>)}
      {rolled && <G transform="rotate(-18 180 140)"><Rect x={93} y={115} width={171} height={48} rx={22} fill={c.surface} stroke={c.amber} strokeWidth={3}/><Ellipse cx={248} cy={139} rx={15} ry={22} fill={c.amberSoft} stroke={c.amber} strokeWidth={3}/><Ellipse cx={250} cy={139} rx={7} ry={12} fill={c.ink}/><Path d="M110 129 H218" stroke={c.white} strokeWidth={5} strokeLinecap="round"/></G>}
    </G> : <G>
      {!served && <G fill="none" stroke={c.leaf} strokeWidth={10}><Path d="M62 129 C17 116 21 176 71 168"/><Path d="M294 129 C339 116 335 176 287 168"/></G>}
      <Path d={served ? 'M55 131 Q70 240 180 239 Q290 240 305 131 Z' : 'M65 126 L80 213 Q180 255 280 213 L295 126 Z'} fill={served ? c.white : c.leafSoft} stroke={c.leaf} strokeWidth={5}/>
      <Ellipse cx={180} cy={130} rx={120} ry={43} fill={ingredients.includes('broth') || ingredients.includes('water') ? c.amberSoft : c.surface} stroke={c.leaf} strokeWidth={5}/>
      {ingredients.filter(i => !['water','broth','noodles'].includes(i)).map((item,index) => <G key={item} transform={`translate(${105+index*75} 118)`}>{item === 'bamboo' ? <G fill={c.surface} stroke={c.amber} strokeWidth={2}><Rect width={15} height={30} rx={3} transform="rotate(-30)"/><Rect x={22} y={-13} width={15} height={30} rx={3}/></G> : <G><Path d="M0 0 L35 12 L5 21 Z" fill={c.amber}/><Ellipse cx={37} cy={-8} rx={22} ry={12} fill={c.leaf}/></G>}</G>)}
      {ingredients.includes('noodles') && <G fill="none" stroke={c.amber} strokeWidth={4} strokeLinecap="round">{[0,1,2,3].map(i=><Path key={i} d={`M105 ${109+i*12} Q140 ${95+i*12} 174 ${111+i*12} T258 ${111+i*12}`}/>)}</G>}
      {stirring && <G transform={`rotate(${progress*90-45} 180 140)`}><Ellipse cx={180} cy={144} rx={18} ry={10} fill={c.amber}/><Line x1={180} y1={140} x2={236} y2={47} stroke={c.amber} strokeWidth={12} strokeLinecap="round"/></G>}
    </G>}
  </Svg>;
}
