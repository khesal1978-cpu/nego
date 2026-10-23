import { build } from 'esbuild';
import fs from 'node:fs/promises';
const code = await build({ entryPoints: ['src/content/privacy.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const policy = await import('data:text/javascript;base64,' + Buffer.from(code.outputFiles[0].text).toString('base64'));
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const body = policy.PRIVACY_SECTIONS.map(section => `<section><h2>${escape(section.title)}</h2><p>${escape(section.text)}</p></section>`).join('\n');
await fs.writeFile('public/privacy.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#061d35"><meta name="description" content="How SIXZUN uses browser saves, multiplayer data and optional voice chat."><title>Privacy Policy · SIXZUN</title>
<style>*{box-sizing:border-box}body{margin:0;padding:32px 20px;background:#061d35;color:#d1e7f2;font:16px/1.75 system-ui,sans-serif}main{max-width:760px;margin:auto}a{color:#b8ed80}h1{color:#fff;font-size:clamp(28px,6vw,40px);line-height:1.2}h2{font-size:19px;color:#f3fbff;margin:28px 0 6px}p{margin:8px 0}.date{color:#8eb7cc;font-size:14px}footer{margin-top:30px;border-top:1px solid #345875;padding-top:20px}a:focus-visible{outline:2px solid #c9f496;outline-offset:4px}</style></head>
<body><main><a href="/">← Back to SIXZUN</a><h1>Privacy Policy</h1><p class="date">Updated ${escape(policy.PRIVACY_UPDATED)}</p><p>${escape(policy.PRIVACY_INTRO)}</p>${body}<footer>Created by <a href="${escape(policy.CREATOR_URL)}" target="_blank" rel="noopener noreferrer">ArsDev · YouTube</a></footer></main></body></html>\n`);
console.log('Privacy page generated from the same text as Settings.');
