# Port de interior Atlas y mesa de acceso — 2026-10-19

Rama `design/interior-atlas`, base `7b6b577`. Origen del diseño aprobado:
`e1eec0c1aa52a9041a8383661de86f7e17f5286e`.

Las comprobaciones automáticas pasan. **La QA visual del interior queda bloqueada por la sesión**:
el entorno de marcador no permite comprobarla y no se han usado credenciales reales.
Estas capturas no acreditan la persistencia ni el funcionamiento contra el backend real.
Los informes y capturas del 16-oct que trae el port son históricos; no son evidencia de esta ejecución.

Resolución de conflictos:

- `src/app/expense-edit/page.tsx`: presentación Atlas; lectura, validación, edición, borrado, `id` de query y `Suspense` de main.
- `src/app/planning/page.tsx`: composición del diseño sobre las consultas y sesión actuales; enlaces de creación a `/create-trip` y de detalle a `/trip?id=…`.
- `src/app/trips/page.tsx`: presentación del diseño conservando la consulta SDK por usuario y manejo de errores; enlaces a `/trip?id=…`.
- `src/components/dashboard/NextTrip.tsx`: composición y microcopy del diseño; detalle en `/trip?id=…` con identificador codificado.
- `src/components/expenses/ExpenseCard.tsx`: listado del diseño conservando datos y enlace a `/expense-edit?id=…` con identificador codificado.
- `src/components/layout/DashboardLayout.tsx`: estilos Atlas; protección de sesión y navegación actual, incluida Inspiración de vuelos y `SparklesIcon`.
- `docs/design/interior-atlas-plan-2026-10-16.md`: versión de main íntegra con nota del 18-oct; el lado del diseño no contenía material adicional.

Además, el Navbar utiliza la ligadura TP mediante máscara CSS del asset vigente y `currentColor`.
La mesa pública conserva `Brand`. Los formularios siguen usando `useAuth()`; no se han añadido
imports del módulo retirado `auth-actions`. Se concretaron dos selectores del test de creación de
viaje: el campo «Destino *» comparte texto con la nueva sección «Destino y fechas».

`src/proxy.ts`, `src/lib/insforge/oauth.ts`, el validador del export, CI, ADR, `package.json` y
`pnpm-lock.yaml` no presentan diferencias frente a HEAD. No se ha borrado ningún fichero de main.
No se han realizado commit, push, PR, deploy, cambios del backend ni comandos Wrangler.

## Entorno y alcance visual

Se creó temporalmente `.env.local` con estos valores de marcador, y se eliminó al terminar:

```dotenv
NEXT_PUBLIC_INSFORGE_URL=https://example.invalid
NEXT_PUBLIC_INSFORGE_ANON_KEY=qa-placeholder
INSFORGE_API_KEY=qa-placeholder
```

Servidor ejecutado:

```text
E2E_DISABLE_DEV_INDICATORS=1 pnpm run dev --port 3010 --hostname 127.0.0.1
$ next dev --turbopack --port 3010 --hostname 127.0.0.1
▲ Next.js 16.3.8 (Turbopack)
- Local:         http://127.0.0.1:3010
- Network:       http://127.0.0.1:3010
- Environments: .env.local
✓ Ready in 320ms
```

El servidor anterior que ocupaba 3010 pertenecía al worktree descartado `auth-brand-a11y`;
se detuvo para iniciar este worktree. El servidor de esta QA también quedó detenido.

Capturas reales de Chromium con Playwright, `fullPage: true`, fuentes e imágenes cargadas,
movimiento reducido y tema guardado en `localStorage`. Viewports 1440×1000 y 390×844.
Se abrieron e inspeccionaron los ocho PNG finales: marca TP visible, formulario e ilustración
separados en escritorio; una columna sin ilustración en móvil, etiquetas y acciones legibles,
sin recortes horizontales. El registro móvil ocupa 919 px de alto y requiere desplazamiento vertical.

El dominio `example.invalid` hace fallar la comprobación inicial de sesión. Antes de las capturas
públicas se cerraron cuatro avisos mediante «Cerrar aviso» y el indicador de desarrollo mediante
«Collapse issues badge», usando los controles reales. No se ha cambiado el DOM ni simulado una sesión.
Las primeras capturas con esos avisos superpuestos fueron sustituidas por los PNG finales.

En las ocho combinaciones públicas se ejecutó envío vacío: Email y Contraseña marcaron
`aria-invalid=true`. Se comprobó el toggle de contraseña mediante foco y tecla Espacio.
Axe después de la validación devolvió cero infracciones en cada combinación; no hubo excepciones
`pageerror`. El ancho de scroll fue igual al viewport en las ocho combinaciones.
Esto no verifica login, registro, Google OAuth, envío de correos ni persistencia real.

| Captura | Dimensiones PNG |
| --- | --- |
| [signin-1440-dark.png](signin-1440-dark.png) | 1440×1062 |
| [signin-1440-light.png](signin-1440-light.png) | 1440×1062 |
| [signin-390-dark.png](signin-390-dark.png) | 390×844 |
| [signin-390-light.png](signin-390-light.png) | 390×844 |
| [signup-1440-dark.png](signup-1440-dark.png) | 1440×1088 |
| [signup-1440-light.png](signup-1440-light.png) | 1440×1088 |
| [signup-390-dark.png](signup-390-dark.png) | 390×919 |
| [signup-390-light.png](signup-390-light.png) | 390×919 |

## Bloqueo del interior

Se abrieron las ocho rutas privadas en Chromium sin sesión (viewport 1280×720).
Todas mostraron exactamente **«No se pudo comprobar tu sesión»** y el botón «Reintentar».
No se llegó a ver ninguna pantalla interior rediseñada. No se generaron PNG con nombres de esas
pantallas para representar el formulario de acceso o el error de sesión.

Las 32 combinaciones de las ocho rutas privadas a 1440/390 y claro/oscuro quedan pendientes de
captura e inspección con una sesión válida. Tampoco se verificaron operaciones contra InsForge real,
estados con datos del usuario ni concurrencia entre pestañas.

| Ruta intentada | Resultado observado |
| --- | --- |
| `/dashboard` | No se pudo comprobar tu sesión |
| `/trips` | No se pudo comprobar tu sesión |
| `/planning` | No se pudo comprobar tu sesión |
| `/tasks` | No se pudo comprobar tu sesión |
| `/expenses` | No se pudo comprobar tu sesión |
| `/notes` | No se pudo comprobar tu sesión |
| `/profile` | No se pudo comprobar tu sesión |
| `/settings` | No se pudo comprobar tu sesión |

## Verificación automática

Comandos ejecutados en este worktree. Salidas literales relevantes de las últimas ejecuciones;
los códigos de salida se recogen fuera de los bloques de salida.

`pnpm run type-check` — código 0:

```text
$ tsc --noEmit
```

`pnpm run lint` — código 0:

```text
$ eslint

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/app/notes/page.tsx
  339:29  warning  Do not use `window.location.href` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead. See: https://nextjs.org/docs/messages/no-location-assign-relative-destination  @next/next/no-location-assign-relative-destination

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/app/profile/page.tsx
  112:19  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/components/charts/TripChart.tsx
   68:61  warning  'title' is assigned a value but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              @typescript-eslint/no-unused-vars
   79:7   warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/components/charts/TripChart.tsx:79:7
  77 |   useEffect(() => {
  78 |     if (!trips || trips.length === 0) {
> 79 |       setData([])
     |       ^^^^^^^ Avoid calling setState() directly within an effect
  80 |       return
  81 |     }
  82 |  react-hooks/set-state-in-effect
  154:34  warning  'entry' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       @typescript-eslint/no-unused-vars

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/components/common/ErrorBoundary.tsx
  140:30  warning  Do not use `window.location.href` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead. See: https://nextjs.org/docs/messages/no-location-assign-relative-destination  @next/next/no-location-assign-relative-destination

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/components/layout/Navbar.tsx
   38:7   warning  Do not use `window.location.href` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead. See: https://nextjs.org/docs/messages/no-location-assign-relative-destination                       @next/next/no-location-assign-relative-destination
  110:19  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
  222:17  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/components/trips/JournalPhotos.tsx
  272:17  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/contexts/ThemeContext.tsx
  24:7  warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/contexts/ThemeContext.tsx:24:7
  22 |     const savedTheme = localStorage.getItem("theme") as Theme;
  23 |     if (savedTheme) {
> 24 |       setTheme(savedTheme);
     |       ^^^^^^^^ Avoid calling setState() directly within an effect
  25 |     }
  26 |     setMounted(true);
  27 |   }, []);                                                                                                  react-hooks/set-state-in-effect
  49:5  warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/contexts/ThemeContext.tsx:49:5
  47 |     }
  48 |
> 49 |     setResolvedTheme(targetTheme as "light" | "dark");
     |     ^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  50 |
  51 |     // Save to localStorage
  52 |     localStorage.setItem("theme", theme);                                                                                                           react-hooks/set-state-in-effect
  72:5  warning  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/pablorg/.codex/worktrees/interior-atlas/travelpal/src/contexts/ThemeContext.tsx:72:5
  70 |
  71 |     // Set initial resolved theme for system
> 72 |     setResolvedTheme(mediaQuery.matches ? "dark" : "light");
     |     ^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  73 |
  74 |     mediaQuery.addEventListener("change", handleChange);
  75 |     return () => mediaQuery.removeEventListener("change", handleChange);  react-hooks/set-state-in-effect

✖ 13 problems (0 errors, 13 warnings)
```

`pnpm exec jest --runInBand --coverage=false` — código 0:

```text
PASS src/__tests__/static-redirects.test.ts
PASS src/__tests__/test-environment.test.ts

Test Suites: 68 passed, 68 total
Tests:       485 passed, 485 total
Snapshots:   0 total
Time:        42.285 s, estimated 44 s
Ran all test suites.
```

La primera ejecución falló: 1 suite y 2 tests por el selector ambiguo de Destino.
Tras concretarlo se repitió la suite completa. Una pasada de TypeScript detectó después
la opción `exact` no admitida por Testing Library; se retiró y se repitieron type-check,
Jest completo, lint y build. Las salidas anteriores corresponden al estado final.

`pnpm run build` — código 0:

```text
$ next build
▲ Next.js 16.3.8 (Turbopack)
- Environments: .env.local
✓ Running next.config.js took 15ms
- Experiments (use with caution):
  · optimizePackageImports

  Creating an optimized production build ...
✓ Compiled successfully in 2.4s
  Running TypeScript ...
  Finished TypeScript in 10.2s ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (0/22) ...
  Generating static pages using 11 workers (5/22)
  Generating static pages using 11 workers (10/22)
  Generating static pages using 11 workers (16/22)
✓ Generating static pages using 11 workers (22/22) in 767ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /auth/callback
├ ○ /create-trip
├ ○ /dashboard
├ ○ /expense-edit
├ ○ /expenses
├ ○ /expenses/new
├ ○ /forgot-password
├ ○ /icon.svg
├ ○ /notes
├ ○ /planning
├ ○ /profile
├ ○ /reset-password
├ ○ /settings
├ ○ /signin
├ ○ /signup
├ ○ /tasks
├ ○ /travel-inspiration
├ ○ /trip
└ ○ /trips


○  (Static)  prerendered as static content

```

`pnpm run validate:static-export` — código 0:

```text
$ node scripts/validate-static-export.mjs
Validated 181 static files and 13 critical routes; no private key markers found.
```

`git diff --check` y `git diff --cached --check`: salida vacía, código 0.
La búsqueda literal de marcadores solicitada en el brief: salida vacía, código 1 (ninguna coincidencia).
`git diff --name-only --diff-filter=U`: salida vacía, código 0.
`test ! -e .env.local`: salida vacía, código 0.

Revisión independiente read-only del diff y consumidores: sin hallazgos confirmados.
Verificación del revisor con suites de planning, borradores y editor de notas, edición de viaje y lista
de tareas: 5 suites / 25 tests, código 0. No sustituye la QA bloqueada de rutas autenticadas.

## Captura reproducible

Comando ejecutado: `node /tmp/interior-atlas-capture.cjs` — código 0.
Se incluye el contenido del script temporal para poder recrearlo con el servidor anterior en ejecución.
El script se detiene si no se cumplen las comprobaciones y guarda los PNG en esta carpeta.

```javascript
const {createRequire}=require('node:module');
const req=createRequire(process.cwd()+'/package.json');
const {chromium,expect}=req('@playwright/test');
const AxeBuilder=req('@axe-core/playwright').default;
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const results={public:[],private:[]};
 for(const width of [1440,390]) for(const theme of ['light','dark']) for(const route of ['signin','signup']) {
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},colorScheme:theme,reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('theme',theme),theme);
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:3010/${route}`);
  await page.getByRole('heading',{name:route==='signin'?'Inicia sesión en tu cuenta':'Crea tu cuenta',exact:true}).waitFor();
  await page.waitForFunction(theme=>document.documentElement.classList.contains('dark') === (theme === 'dark'),theme);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>[...document.images].filter(img=>getComputedStyle(img).display!=='none' && img.getBoundingClientRect().width>0).every(img=>img.complete && img.naturalWidth>0));
  const notices=page.getByRole('button',{name:'Cerrar aviso',exact:true});
  await notices.first().waitFor({timeout:15000});
  const sessionNotices=await notices.count();
  while(await notices.count()) await notices.last().click();
  await expect(notices).toHaveCount(0);
  const issues=page.getByRole('button',{name:'Collapse issues badge',exact:true});
  if(await issues.count()) await issues.click();
  const filename=`${route}-${width}-${theme}.png`;
  await page.screenshot({path:`docs/qa/audits/2026-10-19-interior-atlas/${filename}`,fullPage:true});
  const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,theme:document.documentElement.className,brandMask:getComputedStyle(document.querySelector('header a span')).maskImage}));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:route==='signin'?'Iniciar sesión':'Crear cuenta',exact:true}).click();
  await expect(page.getByLabel('Email',{exact:true})).toHaveAttribute('aria-invalid','true');
  await expect(page.getByLabel('Contraseña',{exact:true})).toHaveAttribute('aria-invalid','true');
  const axe=await new AxeBuilder({page}).analyze();
  const toggle=page.getByRole('button',{name:'Mostrar contraseña',exact:true});
  await toggle.focus(); await page.keyboard.press('Space');
  await expect(page.getByLabel('Contraseña',{exact:true})).toHaveAttribute('type','text');
  results.public.push({filename,url:page.url(),...metrics,validation:true,passwordToggle:true,sessionNoticesDismissed:sessionNotices,axeViolations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})),pageErrors:errors});
  console.log(JSON.stringify(results.public.at(-1)));
  await context.close();
 }
 const context=await browser.newContext();const page=await context.newPage();
 for(const route of ['dashboard','trips','planning','tasks','expenses','notes','profile','settings']){
  await page.goto(`http://127.0.0.1:3010/${route}`);
  await page.getByRole('heading',{name:'No se pudo comprobar tu sesión',exact:true}).waitFor({timeout:15000});
  results.private.push({route,url:page.url(),result:await page.getByRole('heading',{name:'No se pudo comprobar tu sesión',exact:true}).innerText()});
  console.log(JSON.stringify(results.private.at(-1)));
 }
 await browser.close();fs.writeFileSync('/tmp/interior-atlas-qa-results.json',JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
```
