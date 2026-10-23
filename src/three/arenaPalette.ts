/** Separate material palettes for the user's blue and green map references. */
const BLUE_ARENA = {
  floor: '#29AFE0', floorOuter: '#528FA0', floorLine: '#E4F1E7',
  stone: '#91A9BC', mortar: '#60778C', darkStone: '#60798D', darkMortar: '#415C74',
  trim: '#BDC8CD', trimMortar: '#85979F', deck: '#A7BBC5',
  roof: '#286E9D', banner: '#2466B0', brass: '#D6B351',
  foliage: '#78AF4F', foliageDark: '#3D8452', grass: '#75A65B', grassRim: '#526F50', timber: '#8B6C49',
  fog: '#9CDCED',
} as const;
const GREEN_ARENA = {
  floor: '#63A782', floorOuter: '#557F59', floorLine: '#E5E9CA',
  stone: '#929D88', mortar: '#606E5C', darkStone: '#697864', darkMortar: '#475C4B',
  trim: '#CFC4A1', trimMortar: '#8F9579', deck: '#B7BE9A',
  roof: '#367D6C', banner: '#285D9A', brass: '#C9A956',
  foliage: '#89B94D', foliageDark: '#3A8450', grass: '#769D54', grassRim: '#4D734A', timber: '#977343',
  fog: '#ABDCCE',
} as const;
export function arenaPalette(jungle: boolean) { return jungle ? GREEN_ARENA : BLUE_ARENA; }
