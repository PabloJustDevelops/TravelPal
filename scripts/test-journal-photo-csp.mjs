import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
const baseURL = process.argv[2] ?? 'http://127.0.0.1:8791'
// Both endpoints are intercepted: this fixture never uses a real account or S3 credentials.
const backend = process.argv[3] ?? 'https://sjdq7zsn.eu-central.insforge.app'
const storage = 'https://insforge-storage.s3.us-east-2.amazonaws.com'
const userId = '11111111-1111-4111-8111-111111111111'
const tripId = '22222222-2222-4222-8222-222222222222'
const user = { id: userId, email: 'csp-fixture@example.test', profile: { name: 'CSP fixture' } }
const accessToken = `e30.${Buffer.from(JSON.stringify({sub: userId, exp: 4102444800})).toString('base64url')}.fixture`
const photo = await readFile(new URL('../e2e/fixtures/e2e-photo.png', import.meta.url))
const trip = {id:tripId,user_id:userId,title:'CSP photo fixture',origin:'Bilbao',destination:'San Sebastián',departure_date:new Date(Date.now()-86400000).toISOString(),status:'completed',created_at:'2026-10-01T09:00:00Z'}
let key = '', photos = [], uploads = 0, signatures = 0
const requests = [], violations = [], networkErrors = [], consoleErrors = []
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  await page.exposeFunction('recordCsp', value => violations.push(value))
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.recordCsp({directive:event.effectiveDirective,blocked:event.blockedURI})))
  page.on('console', message => {if(message.type()==='error')consoleErrors.push(message.text())})
  page.on('requestfailed', request => networkErrors.push({url:request.url().split('?')[0],error:request.failure()?.errorText}))
  await page.route('**/*', async route => {
    const request=route.request(), url=new URL(request.url())
    if(url.origin===storage){
      if(request.method()==='POST') { uploads++; requests.push({method:'POST',origin:storage,status:204,contentType:request.headers()['content-type']?.split(';')[0]}); await route.fulfill({status:204,contentType:request.headers()['content-type']?.split(';')[0]}); }
      else await route.fulfill({contentType:'image/png',body:photo})
      return
    }
    if(url.origin!==backend){if(url.origin===new URL(baseURL).origin)await route.continue();else await route.abort();return}
    const path=url.pathname, method=request.method()
    requests.push({method,path:path.replace(/\/objects\/.*/, '/objects/<key>'),origin:url.origin,status:200})
    let body=[]
    if(path==='/api/auth/refresh') body={accessToken,user}
    else if(path.endsWith('/profiles')) body={id:userId,full_name:'CSP fixture'}
    else if(path.endsWith('/trips')) body=trip
    else if(path.endsWith('/upload-strategy')) {key=request.postDataJSON().filename;body={method:'presigned',uploadUrl:storage,fields:{key},key,confirmRequired:true,confirmUrl:'/api/storage/buckets/journal-photos/confirm-upload'}}
    else if(path.endsWith('/confirm-upload')) body={key,url:`${backend}/api/storage/buckets/journal-photos/objects/${encodeURIComponent(key)}`}
    else if(path.includes('/download-strategy/objects/')) {signatures++;body={method:'presigned',url:`${storage}/fixture/photo.png`,expiresAt:'2099-01-01T00:00:00Z'}}
    else if(path.endsWith('/journal_photos')) {
      if(method==='POST'){photos=request.postDataJSON().map(row=>({...row,id:'33333333-3333-4333-8333-333333333333',created_at:new Date().toISOString()}));body=photos}
      else body=photos
    }
    else if(!/\/(journal_entries|alerts|notifications|itinerary_activities|bookings|expenses|budgets|notes|tasks)$/.test(path)) throw new Error(`Unhandled fixture endpoint: ${method} ${path}`)
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(`${baseURL}/trip?id=${tripId}`)
  await page.getByText('Todavia no hay fotos del viaje').waitFor()
  const chooser=page.waitForEvent('filechooser')
  await page.getByRole('button',{name:'Anadir foto'}).click()
  await (await chooser).setFiles({name:'e2e-photo.png',mimeType:'image/png',buffer:photo})
  let failure, imageDecoded = false
  try{
    const image=page.getByRole('img',{name:'Foto del diario',exact:true})
    await image.waitFor({state:'visible',timeout:10000})
    await image.evaluate(img=>img.decode())
    imageDecoded = true
  }catch(error){failure=error.message.split('\n').slice(0,4).join('\n')}
  console.log(JSON.stringify({networkMode:'mocked',imageDecoded,requests,uploads,signatures,photoVisible:await page.getByRole('img',{name:'Foto del diario',exact:true}).count(),violations,networkErrors,consoleErrors,failure},null,2))
  if(failure||violations.length||uploads!==1||signatures!==1)process.exitCode=1
} finally {await browser.close()}
