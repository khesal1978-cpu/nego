import React, { useId } from 'react';
import { CHARACTER_OUTFITS, type CharacterConfig, type FaceId, type HeadShape, type OutfitId } from '../types/game';

interface Props { char: CharacterConfig; outfitOverride?: OutfitId; faceOverride?: FaceId; headShapeOverride?: HeadShape; size?: number }
const INK = '#041326';
const star = '0,-9 2.8,-3.2 9,-2.7 4.5,1.7 5.5,8 0,4.8 -5.5,8 -4.5,1.7 -9,-2.7 -2.8,-3.2';

/** Editable SVG portraits drawn from the user's twelve-avatar reference. */
export function CharacterPortrait({ char, outfitOverride, faceOverride, headShapeOverride, size = 86 }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const outfit = CHARACTER_OUTFITS.find(item => item.id === (outfitOverride || char.outfitId || char.defaultOutfit)) || CHARACTER_OUTFITS[0];
  const face = faceOverride || char.faceId || char.defaultFace;
  const shape = headShapeOverride || char.headShape;
  const primary = outfitOverride || char.outfitId ? outfit.primaryColor : char.primaryColor;
  const gradient = (name: string) => `url(#${uid}-${name})`;
  if (char.modelAsset) return <img src={`/characters/${char.modelAsset}-portrait.png`} width={size} height={size} alt={char.name} style={{ objectFit: 'contain' }} />;
  if (char.id === 'smokey_jester') return <svg width={size} height={size} viewBox="0 0 100 108" fill="none" role="img" aria-label={`${char.name}, spiky hair, dark jacket and smoking cigar`}>
    <defs><linearGradient id={`${uid}-skin`} x2="0" y2="1"><stop stopColor={char.skinTone} /><stop offset="1" stopColor="#A97A58" /></linearGradient><linearGradient id={`${uid}-jacket`} x2="1" y2="1"><stop stopColor="#414A52" /><stop offset="1" stopColor={primary} /></linearGradient></defs>
    <path d="M13 111 20 86 36 77H64L80 86 87 111" fill={gradient('jacket')} stroke={INK} strokeWidth="3" />
    <path d="M35 80 27 88 40 101 44 85M65 80 73 88 60 101 56 85" fill="#515C64" stroke={INK} strokeWidth="2" />
    <path d="M44 88Q50 96 57 87M52 98V111M27 102 38 104M64 104 76 101" stroke="#B99B62" strokeWidth="2" />
    <path d="M22 38 23 64 31 78 47 83 64 79 76 64 77 38 59 25 37 25Z" fill={gradient('skin')} stroke={INK} strokeWidth="3" />
    <path d="M21 46 16 28 24 28 20 16 35 23 35 7 45 16 52 2 58 17 70 7 69 24 83 17 77 33 84 35 77 49 67 34 54 28 41 30 29 37Z" fill="#20262D" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M32 28 39 21M49 24 53 14M63 29 68 24" stroke="#59636D" strokeWidth="2" />
    <path d="M29 51 43 53 40 58 31 57ZM57 53 71 50 69 57 59 58Z" fill="#D9D3C5" stroke={INK} strokeWidth="2" />
    <path d="M36 53V57M63 53V57M28 47 44 51M56 51 72 46" stroke={INK} strokeWidth="3" />
    <path d="M48 55 46 64 51 65M29 62 32 68M28 65 33 64" stroke="#85573F" strokeWidth="1.5" />
    <path d="M39 73 54 72 59 74" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    <g aria-label="Mouth cigar" transform="translate(55 72) rotate(12)"><rect width="31" height="7" rx="3.5" fill="#79472D" stroke={INK} strokeWidth="1.4" /><path d="M8 1V6M11 1V6" stroke="#C5A25C" strokeWidth="2" /><path d="M18 1 20 6M23 1 25 6" stroke="#4B2C20" strokeWidth=".8" /><path d="M28 1V6" stroke="#D36536" strokeWidth="2" /><path d="M30 2V5" stroke="#8A857B" strokeWidth="3" /></g>
    <path d="M88 72C82 65 96 64 89 55S94 43 90 37M86 70C91 65 84 59 91 52" stroke="#AAB7BA" strokeWidth="2.5" strokeLinecap="round" opacity=".65" />
  </svg>;
  const beard = face === 'viking_beard' || face === 'chef_beard';
  const crown = <g stroke={INK} strokeWidth="2.2" strokeLinejoin="round"><path d="M-12 6 -14-8 -6-2 0-13 6-2 14-8 12 6Z" fill={gradient('gold')} /><circle cy="-3" r="2.7" fill="#ee3d41" /><circle cx="-9" cy="0" r="1.4" fill="#ee3d41" /><circle cx="9" cy="0" r="1.4" fill="#ee3d41" /></g>;
  const cap = (color: string, badge: 'star' | 'crown' | 'none' = 'none') => <g><path d="M16 37Q19 8 50 9Q79 10 84 38Q50 28 16 37Z" fill={color} stroke={INK} strokeWidth="2.8" /><path d="M19 29Q25 13 42 13L28 31Z" fill="#fff" opacity=".1" /><path d="M14 39Q48 20 87 38L89 43Q48 30 12 43Z" fill={char.id === 'green_hoodie' ? '#1ce0ca' : '#2396bb'} stroke={INK} strokeWidth="2.5" />{badge === 'star' && <polygon points={star} transform="translate(50 24) scale(.65)" fill={gradient('gold')} stroke={INK} strokeWidth="2.7" />}{badge === 'crown' && <path d="M43 27 42 19 47 22 50 17 53 22 58 19 57 27Z" fill="#ffdb26" stroke={INK} strokeWidth="1.3" />}</g>;
  const headgear = (() => {
    switch (char.id) {
      case 'green_hoodie': return cap('#10505a', 'crown');
      case 'viking_beard': return <g stroke={INK} strokeWidth="2.6" strokeLinejoin="round"><path d="M24 24Q8 20 14 2Q17 15 30 17Z" fill="#fff1cc" /><path d="M76 24Q92 20 86 2Q83 15 70 17Z" fill="#fff1cc" /><path d="M20 35Q20 8 50 8Q80 8 80 35Z" fill={gradient('steel')} /><path d="M46 9H54V33H46Z" fill={gradient('gold')} /><path d="M19 31Q50 26 81 31V39Q50 33 19 39Z" fill={gradient('gold')} />{[26,38,50,62,74].map(x => <circle key={x} cx={x} cy="33" r="1.6" fill="#ffb51c" strokeWidth=".8" />)}</g>;
      case 'burger_chef': return <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round"><path d="M15 28Q15 8 50 8Q85 8 85 28Z" fill={gradient('bun')} />{[27,38,49,60,71].map((x,i) => <ellipse key={x} cx={x} cy={17+(i%2)*3} rx="1.7" ry="1" fill="#ffeabc" stroke="none" transform={`rotate(-30 ${x} 18)`} />)}<path d="M15 27Q23 22 29 27Q35 22 41 27Q49 22 55 27Q63 22 69 27Q78 22 86 27L83 34H17Z" fill="#37c629" /><path d="M17 32H83V38H17Z" fill="#4f261c" /><path d="M17 33H83L75 39 59 35 47 40 33 35 23 38Z" fill="#ffbb1c" /><path d="M18 38Q50 35 82 38L80 43H20Z" fill="#fa9e17" /></g>;
      case 'strawberry_kid': return <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round"><path d="M34 18 30 6 43 9 50 0 57 9 70 6 65 19Z" fill="#21b940" /><path d="M16 40Q15 20 50 20Q85 20 84 40Z" fill={gradient('berry')} />{[27,38,49,61,73].map((x,i) => <ellipse key={x} cx={x} cy={28+i%2*4} rx="1.4" ry="2.5" fill="#fff1ce" stroke="none" transform={`rotate(${i%2 ? 25:-25} ${x} 30)`} />)}</g>;
      case 'pineapple_king': return <g stroke={INK} strokeWidth="2.5" strokeLinejoin="round"><path d="M26 25 19 13 34 16 31 7 44 12 50 0 58 14 72 7 69 20 83 16 75 29Z" fill="#2ab64d" /><path d="M20 37Q23 23 50 21Q77 24 80 37Z" fill={gradient('gold')} /><path d="M26 35 38 23 49 34 60 23 72 35M38 34 49 24 60 34" fill="none" stroke="#b8750f" strokeWidth="1.4" /><path d="M18 38Q50 31 82 38L83 43Q50 37 17 43Z" fill="#ffc628" /></g>;
      case 'purple_shades': return <g stroke={INK} strokeWidth="2.6" strokeLinejoin="round"><path d="M22 26 24 5 40 17M78 26 76 5 60 17" fill="#9a48e8" /><path d="M27 21 28 11 36 18M73 21 72 11 64 18" fill="#ff9bd1" strokeWidth="1.4" /><path d="M16 40Q20 18 50 17Q80 18 84 40Q50 34 16 40Z" fill={gradient('purple')} /></g>;
      case 'gold_king': return <g><g transform="translate(50 19) scale(1.7)">{crown}</g><path d="M19 38Q50 32 81 38L81 44Q50 39 19 44Z" fill="#ffc324" stroke={INK} strokeWidth="2.5" /></g>;
      case 'red_cap': return <g stroke={INK} strokeWidth="2.6"><path d="M17 35Q20 10 50 10Q80 10 83 35Z" fill={gradient('red')} /><circle cx="50" cy="10" r="3.2" fill="#f4fcff" /><path d="M16 35Q50 27 84 35L85 43Q50 35 15 43Z" fill="#f4fcff" /></g>;
      case 'pirate_capt': return <g stroke={INK} strokeWidth="2.6"><path d="M12 29Q21 9 50 10Q79 9 88 29L77 38H23Z" fill={gradient('steel')} /><path d="M15 26Q50 7 85 26" fill="none" stroke="#ffc829" strokeWidth="3" /><path d="M19 40Q50 30 81 40L78 46Q50 40 22 46Z" fill="#0a263e" /><path d="M24 40Q50 34 76 40" fill="none" stroke="#ffc829" strokeWidth="2" /><circle cx="50" cy="16" r="4" fill={gradient('gold')} /></g>;
      case 'blue_sporty': return <g stroke={INK} strokeWidth="2.6"><path d="M19 32Q10 25 22 17Q25 6 37 10Q48 2 59 11Q73 4 80 21Q88 25 81 35Z" fill="#4d302d" /><path d="M20 32Q50 25 80 32V42Q50 37 20 42Z" fill="#168dff" /><path d="M50 29 55 34 50 39 45 34Z" fill={gradient('gold')} strokeWidth="1.5" /></g>;
      case 'pink_visor': return <g stroke={INK} strokeWidth="2.6"><circle cx="26" cy="18" r="11" fill={gradient('pink')} /><circle cx="74" cy="18" r="11" fill={gradient('pink')} /><g transform="translate(50 19)">{crown}</g><path d="M19 37Q50 29 81 37L80 43Q50 37 20 43Z" fill="#f06ba1" /><circle cx="23" cy="15" r="3" fill="#fff" opacity=".4" stroke="none" /><circle cx="71" cy="15" r="3" fill="#fff" opacity=".4" stroke="none" /></g>;
      case 'astro_bean': return <g stroke={INK} strokeWidth="2.6"><path d="M20 23 17 7 37 12M80 23 83 7 63 12" fill="#0d3e57" /><path d="M23 19 22 12 32 15M77 19 78 12 68 15" fill="#ffbf18" strokeWidth="1.2" />{cap('#093c57','star')}</g>;
    }
  })();
  const eyes = (x: number, wink = false) => wink ? <path d={`M${x-7} 58Q${x} 48 ${x+7} 58`} fill="none" stroke={INK} strokeWidth="3" /> : face === 'star_eyes' ? <g><circle cx={x} cy="57" r="8" fill="#ffae1d" /><polygon points={star} transform={`translate(${x} 57) scale(.68)`} fill="#fff24c" /></g> : <g><ellipse cx={x} cy="56" rx="7.2" ry="8.4" fill={INK} /><ellipse cx={x} cy="59" rx="4.8" ry="4.5" fill={gradient('eye')} /><ellipse cx={x+2} cy="52" rx="2.8" ry="2.9" fill="#fff" /><circle cx={x-2.6} cy="60" r="1.2" fill="#c6f2ff" /></g>;
  const faceWidth = shape === 'mochi' ? 61 : shape === 'bean' ? 53 : 58;
  const emblem = outfit.emblemType;
  return <svg width={size} height={size} viewBox="0 0 100 108" className="character-portrait-svg" role="img" aria-label={char.name} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <linearGradient id={`${uid}-skin`} x2=".1" y2="1"><stop stopColor="#fff1d6" /><stop offset=".7" stopColor={char.skinTone} /><stop offset="1" stopColor="#f5b88e" /></linearGradient>
      <linearGradient id={`${uid}-shirt`} x2=".2" y2="1"><stop stopColor={primary} /><stop offset="1" stopColor={primary} /></linearGradient>
      <linearGradient id={`${uid}-gold`} x2=".15" y2="1"><stop stopColor="#fff29b" /><stop offset=".35" stopColor="#ffce20" /><stop offset="1" stopColor="#ec910e" /></linearGradient>
      <linearGradient id={`${uid}-steel`} x2=".2" y2="1"><stop stopColor="#265974" /><stop offset="1" stopColor="#0b223a" /></linearGradient>
      <linearGradient id={`${uid}-bun`} x2="0" y2="1"><stop stopColor="#ffce55" /><stop offset="1" stopColor="#f88b08" /></linearGradient>
      <linearGradient id={`${uid}-berry`} x2="0" y2="1"><stop stopColor="#ff789b" /><stop offset="1" stopColor="#f02652" /></linearGradient>
      <linearGradient id={`${uid}-purple`} x2="0" y2="1"><stop stopColor="#d87bff" /><stop offset="1" stopColor="#9d3fea" /></linearGradient>
      <linearGradient id={`${uid}-red`} x2=".2" y2="1"><stop stopColor="#ff4d43" /><stop offset="1" stopColor="#ec141c" /></linearGradient>
      <radialGradient id={`${uid}-eye`}><stop stopColor="#3073a4" /><stop offset="1" stopColor="#09273d" /></radialGradient>
      <radialGradient id={`${uid}-pink`}><stop stopColor="#ff91cd" /><stop offset="1" stopColor="#ed4295" /></radialGradient>
    </defs>
    <path d="M17 102Q20 77 50 77Q80 77 83 102Q50 109 17 102Z" fill={gradient('shirt')} stroke={INK} strokeWidth="2.8" />
    <path d="M28 87 26 103M72 87 74 103" stroke={INK} strokeWidth="2" /><path d="M29 86Q40 80 60 83" stroke="#fff" strokeWidth="2" opacity=".15" />
    <path d="M23 41Q13 38 16 70L24 78M77 41Q87 38 84 70L76 78" fill="#112039" stroke={INK} strokeWidth="2" />
    <g fill={gradient('skin')} stroke={INK} strokeWidth="2.6"><ellipse cx="19" cy="61" rx="8" ry="9" /><ellipse cx="81" cy="61" rx="8" ry="9" /></g><ellipse cx="19" cy="61" rx="4" ry="5" fill="#ffa890" /><ellipse cx="81" cy="61" rx="4" ry="5" fill="#ffa890" />
    <rect x={(100-faceWidth)/2} y="31" width={faceWidth} height="51" rx={shape === 'squircle' ? 17 : shape === 'angular' ? 19 : 25} fill={gradient('skin')} stroke={INK} strokeWidth="2.8" />
    <path d="M31 45Q38 41 44 45M56 45Q63 41 70 45" stroke={INK} strokeWidth="2.5" />
    {face === 'cool_shades' ? <g stroke={INK} strokeWidth="1.2"><path d="M28 50H44Q48 50 48 55L45 64Q36 68 29 62Z" fill="#08233a" /><path d="M72 50H56Q52 50 52 55L55 64Q64 68 71 62Z" fill="#08233a" /><path d="M29 50 44 50 32 63M56 50H71L59 65" fill="#467b9e" opacity=".6" /><path d="M27 49Q37 46 47 50M53 50Q63 46 73 49M47 53Q50 51 53 53" stroke="#fff" strokeWidth="2.8" /></g> : face === 'cyber_visor' ? <g><rect x="27" y="50" width="46" height="12" rx="5" fill="#075b8a" stroke={INK} strokeWidth="2" /><path d="M32 54H68" stroke="#8bedff" strokeWidth="2" /></g> : <>{eyes(37)}{eyes(63,face === 'cheeky_wink')}</>}
    <ellipse cx="28" cy="67" rx="4.7" ry="3.5" fill="#ff8e95" opacity=".8" /><ellipse cx="72" cy="67" rx="4.7" ry="3.5" fill="#ff8e95" opacity=".8" /><path d="M49 63 50 62 51 63 50 65Z" fill="#f2b295" />
    {beard ? <g><path d="M25 66Q33 72 50 72Q67 72 75 66Q78 83 50 87Q22 83 25 66Z" fill={face === 'viking_beard' ? '#c46b09' : '#35201f'} stroke={INK} strokeWidth="2.5" /><path d="M40 70Q50 66 60 70Q56 80 50 80Q44 80 40 70Z" fill="#08152b" stroke={INK} strokeWidth="1.4" /><path d="M43 71H57L54 73H46Z" fill="#fff" /><path d="M45 77Q50 73 55 77L52 80H48Z" fill="#ff7598" /><path d="M50 67Q41 60 30 69Q35 77 50 69Q65 77 70 69Q59 60 50 67Z" fill={face === 'viking_beard' ? '#e5850a' : '#382120'} stroke={INK} strokeWidth="2" /></g> : face === 'kawaii_blush' ? <path d="M44 72Q44 79 50 74Q56 79 56 72" stroke={INK} strokeWidth="2.3" /> : face === 'shock_rally' || face === 'fierce_pro' ? <ellipse cx="50" cy="74" rx="4.6" ry="5.5" fill={INK} /> : <g><path d="M39 71Q50 68 61 71Q60 82 50 82Q40 82 39 71Z" fill={INK} stroke={INK} strokeWidth="1.6" /><path d="M42 71H58L55 74H45Z" fill="#fff" /><path d="M43 79Q50 73 57 79Q50 84 43 79Z" fill="#ff7297" /></g>}
    {face === 'goofy_smirk' && <g><path d="M56 44 66 41" stroke={INK} strokeWidth="3" /><path d="M57 58Q63 52 69 58" stroke={char.skinTone} strokeWidth="15" /><path d="M57 57Q63 51 69 57" stroke={INK} strokeWidth="2.8" /><path d="M37 70Q49 82 62 70" stroke={char.skinTone} strokeWidth="13" /><path d="M39 70Q49 78 61 69" stroke={INK} strokeWidth="2.2" /><path d="M44 73 47 74 47 76 44 75Z" fill="#fff" /></g>}
    {headgear}
    <g transform="translate(50 94)" stroke={INK} strokeWidth="1.6">
      {emblem === 'crown' ? <path d="M-8 5 -9-5 -4-1 0-7 4-1 9-5 8 5Z" fill={gradient('gold')} /> : emblem === 'bolt' ? <path d="M2-9 -6 1 0 1 -2 9 7-2 2-2Z" fill={gradient('gold')} /> : emblem === 'burger' ? <g><path d="M-8-1Q-8-9 0-9Q8-9 8-1Z" fill={gradient('bun')} /><path d="M-9 0H9V3H-9Z" fill="#3bdd2e" /><path d="M-8 4H8V7H-8Z" fill="#ffbc34" /></g> : emblem === 'berry' ? <g><path d="M-6-3Q0-6 6-3Q7 4 0 8Q-7 4-6-3Z" fill="#ff3d68" /><path d="M-5-3 0-7 5-3 0-1Z" fill="#32c445" /></g> : emblem === 'pineapple' ? <g><ellipse rx="6" ry="8" fill={gradient('gold')} /><path d="M-4-6 -6-12 0-9 2-14 4-8 7-10 4-5" fill="#28ae40" /><path d="M-4-2 4 5M-4 4 4-3" stroke="#c78812" strokeWidth=".7" /></g> : emblem === 'paw' ? <g><circle cy="1" r="6.5" fill="#a582f5" /><path d="M-6-1-5-6-1-3M6-1 5-6 1-3" fill="#a582f5" /><circle cx="-2" cy="0" r=".8" fill={INK} /><circle cx="2" cy="0" r=".8" fill={INK} /></g> : emblem === 'planet' ? <g><ellipse rx="8" ry="5" fill={gradient('gold')} transform="rotate(-25)" /><path d="M-9 3Q-3-3 9-2" stroke="#f4fbff" strokeWidth="2" /></g> : emblem === 'number' || emblem === 'skull' ? <g><circle r="7" fill="#f4fbff" /><path d="M-1-6H1L3-3 1-1 3 6H-3L-1-1-3-3Z" fill="#17243b" /></g> : <polygon points={star} fill={gradient('gold')} />}
    </g>
  </svg>;
}
