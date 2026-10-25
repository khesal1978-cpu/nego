import type { TouchAction } from './touchControlLayout';

// Compact silhouettes stay readable over the court at phone HUD sizes.
export function TouchControlIcon({ action }: { action: Exclude<TouchAction, 'move'> }) {
  return <svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true" focusable="false">
    {action === 'fire' && <>
      <path d="m12 25 12-12 7 7-12 12c-1.1 1.1-2.9 1.1-4 0l-3-3c-1.1-1.1-1.1-2.9 0-4Zm14-14 1.8-1.8c2.1-2.1 6.3-3.2 8.2-2.2 1 1.9-.1 6.1-2.2 8.2L32 17Z" />
      <path d="m8 32-3 3m4-15-5 1m15 12-1 5M21 8l-1-4m14 18 4 1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m16 23 6-6" fill="none" stroke="var(--icon-cutout)" strokeWidth="2" strokeLinecap="round" />
    </>}
    {action === 'jump' && <>
      <circle cx="17" cy="10" r="4" />
      <path d="M13 16c1.4-2 4.5-2.5 6.5-1l5 3.3 2.2-5.6a2 2 0 0 1 3.7 1.5l-2.9 7.3c-.7 1.7-2.4 2.1-3.7 1.3l-3-1.8-.9 5.2 4.6 4.5c.9.9.7 2.4-.3 3.2l-5 3.5a2 2 0 0 1-2.3-3.3l3-2.1-4.8-4.2-3.6 5.5a2.2 2.2 0 0 1-3.7.1l-4.2-6.1a2 2 0 0 1 3.3-2.3l2.5 3.7 3.2-7.5-4.1.7a2 2 0 0 1-2.3-2.8l2.8-5.2a2 2 0 0 1 3.5 1.9l-1 1.9Z" />
      <path d="M34 13V4m-3 3 3-3 3 3M7 37h6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </>}
    {action === 'throw' && <>
      <path d="M17 18c4-4 10.5-4 14.5 0s4 10.5 0 14.5-10.5 4-14.5 0-4-10.5 0-14.5Z" />
      <path d="m26 15 3-5 5 3-3 5ZM30 9c0-3 2-4 5-3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m35 3 1 1m1 4 1 1M12 15 6 13m5 10H3m8 7-5 2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 21c-2 2-2.5 4-1.5 6" fill="none" stroke="var(--icon-cutout)" strokeWidth="2.5" strokeLinecap="round" />
    </>}
    {action === 'dodge' && <>
      <circle cx="26" cy="12" r="4" />
      <path d="M20 17c1-1.5 3-2.1 4.8-1.4l5.5 2.3 4-2a2 2 0 0 1 1.8 3.6l-5 2.5c-.7.3-1.5.4-2.2.1l-3.4-1.4-3.7 5.2 6.2 1.2c1.2.2 2 1.3 1.8 2.5l-1 6a2 2 0 0 1-4-.7l.6-3.9-7.6-.8-5.6 5.2a2 2 0 0 1-2.8-3l5.8-5.4 3.2-7.2-3.9 1.1a2 2 0 1 1-1.1-3.8Z" />
      <path d="M4 11h11M2 17h7M5 25h5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>}
    {action === 'spike' && <>
      <circle cx="17" cy="14" r="3.7" />
      <path d="m12 20 4-2c1.8-.9 3.3-.5 4.5.6l3 2.4 3.1-5.6a2 2 0 0 1 3.5 2l-4.3 7.2c-.6 1.1-2 1.4-3 .7l-2.9-1.9-1 5.2 5.3 5a2 2 0 0 1-2.8 3l-5.6-5-3.1 5.4a2 2 0 0 1-3.5-2l3.3-7.6-.3-3.4-4 3.2a2 2 0 0 1-2.5-3.1Z" />
      <circle cx="29" cy="7" r="4.5" />
      <path d="m27 4 1 3 4 1" fill="none" stroke="var(--icon-cutout)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="m35 12 2 3M20 6l-3-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </>}
    {action === 'dive' && <>
      <circle cx="25" cy="16" r="4" />
      <path d="m14 18 6.5 1c1.6.2 2.7 1.4 3.4 2.8l10.7-1.9a2 2 0 0 1 .8 3.9l-13 2.5c-.8.2-1.5 0-2.1-.5l-5.3-3-5.3 3a2 2 0 0 1-2.7-.8l-3.4-5.6A2 2 0 0 1 8 17.3l2.3 3.7 3.7-3Zm.2 6.5 5 2.8-6.3 4.8c-.8.6-1.9.6-2.6-.2l-4-4a2 2 0 0 1 2.8-2.8l2.7 2.6Z" />
      <path d="M3 11h12M2 35h26m4 0h4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </>}
    {action === 'lift' && <>
      <circle cx="20" cy="8" r="4.5" />
      <path d="M5 33V23c0-1.5 2-2 2.8-.7l3.6 5.5 1.1-9.5c.2-1.6 2.5-1.8 2.8-.1l1.4 8c.4 3-.5 5.1-2.8 7.8L13 36H6Zm30 0V23c0-1.5-2-2-2.8-.7l-3.6 5.5-1.1-9.5c-.2-1.6-2.5-1.8-2.8-.1l-1.4 8c-.4 3 .5 5.1 2.8 7.8L27 36h7Z" />
      <path d="m18 5 1 3 4 1" fill="none" stroke="var(--icon-cutout)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 26v-9m-3 3 3-3 3 3M9 10l2 2m20-2-2 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>}
    {action === 'super' && <>
      <path d="m23 3-15 20h10l-1 14 15-21H22Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 8 5 5m27 27 3 3M4 16H2m36 8h-2" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </>}
  </svg>;
}
