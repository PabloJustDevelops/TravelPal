import { chromium } from '@playwright/test';
import fs from 'node:fs';
(async () => {
 const browser = await chromium.launch({headless:true});
 const dir = 'docs/qa/audits/2026-10-20-landing-motion'; fs.mkdirSync(dir, {recursive:true});
 const phase = process.argv[2] || 'after';
 const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
 for(const width of [1440,390]) for(const theme of ['light','dark']) {
  const page = await browser.newPage({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  await page.route('https://example.invalid/**', route => route.fulfill({json:{}}));
  await page.goto(baseURL, {waitUntil:'networkidle'});
  await page.addStyleTag({content:'nextjs-portal { display: none !important; }'});
  for (const section of await page.locator('section,footer').all()) {await section.scrollIntoViewIfNeeded();}
  await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))); await document.fonts.ready; window.scrollTo(0,0);});
  await page.screenshot({path:`${dir}/${phase}-${width}-${theme}.png`,fullPage:true});
  await page.locator('footer').screenshot({path:`${dir}/${phase}-footer-${width}-${theme}.png`});
  if(phase==='before') {
   await page.goto(`${baseURL}/signin`,{waitUntil:'networkidle'});
   await page.addStyleTag({content:'nextjs-portal { display: none !important; }'});
   await page.screenshot({path:`${dir}/signin-${width}-${theme}.png`,fullPage:true});
  }
  console.log(`${phase} ${width} ${theme}: captured`);
  await page.close();
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
