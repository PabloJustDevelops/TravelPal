import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
// Auth and storage are intercepted; no real account or data is changed.
const backend = process.argv[3] ?? 'https://sjdq7zsn.eu-central.insforge.app'
const storage = 'https://insforge-storage.s3.us-east-2.amazonaws.com'
const base = process.argv[2] ?? 'http://127.0.0.1:8791'
const userId = '11111111-1111-4111-8111-111111111111'
const user = { id: userId, email: 'csp-fixture@example.test', profile: { name: 'CSP fixture', avatar_url: 'https://tracker.example/pixel.png' } }
const accessToken = `e30.${Buffer.from(JSON.stringify({ sub:userId, exp:4102444800 })).toString('base64url')}.fixture`
let profile = { id:userId, full_name:'CSP fixture', avatar_url:user.profile.avatar_url }, saves = 0, trackerRequests = 0
const violations = [], errors = []
const photo = await readFile(new URL('../e2e/fixtures/e2e-photo.png', import.meta.url))
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width:1280, height:1100 } })
  await page.exposeFunction('recordCsp', value => violations.push(value))
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.recordCsp({directive:event.effectiveDirective,blocked:event.blockedURI})))
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request=route.request(), url=new URL(request.url())
    if (url.hostname === 'tracker.example') { trackerRequests++; await route.abort(); return }
    if (url.origin===storage) { await route.fulfill({contentType:'image/png',body:photo}); return }
    if (url.origin!==backend) { if(url.origin===base) await route.continue(); else await route.abort(); return }
    let body=[]
    if(url.pathname==='/api/auth/refresh') body={accessToken,user}
    else if(url.pathname==='/api/auth/profiles/current') {
      saves++; user.profile=request.postDataJSON().profile; body={profile:user.profile}
    } else if(url.pathname.endsWith('/profiles')) {
      if(request.method()==='POST') profile={...profile,...request.postDataJSON()}
      body=profile
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(base+'/profile')
  await page.getByRole('button',{name:'Editar Perfil'}).click()
  const input=page.getByLabel('URL del Avatar (Opcional)')
  await input.fill('https://tracker.example/pixel.png')
  await page.getByRole('button',{name:'Guardar Cambios'}).click()
  await page.getByRole('alert').filter({hasText:'Usa una URL HTTPS'}).waitFor()
  assert.equal(saves,0)
  assert.equal(await input.getAttribute('aria-invalid'),'true')
  const allowed=storage+'/avatar.png?signature=fixture'
  await input.fill(allowed)
  await page.getByRole('button',{name:'Guardar Cambios'}).click()
  await page.getByRole('button',{name:'Editar Perfil'}).waitFor()
  assert.equal(saves,1)
  assert.equal(profile.avatar_url,allowed)
  const image=page.getByRole('img',{name:'CSP fixture',exact:true}).last()
  await image.evaluate(img=>img.decode())
  await page.waitForTimeout(300)
  assert.equal(trackerRequests,0)
  assert.deepEqual(violations,[])
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({networkMode:'mocked',route:'/profile',invalidSaveBlocked:true,validSaveCount:saves,imageDecoded:true,trackerRequests,violations,pageErrors:errors},null,2))
} finally { await browser.close() }
