# Tester Army en TravelPal

## Alcance inicial

Se añade `e2e@0.19.0` y `@e2e-dev/web@0.14.0` como suite complementaria. Playwright sigue
cubriendo los flujos con datos y axe; Jest conserva unidad/componente. No se migran los tests
existentes a un runner con APIs distintas.

`e2e.config.ts` ejecuta `tests/*.e2e.ts` en Chromium a 1440×900 y 390×844. Son tres casos:
acceso a ruta protegida, opciones de login y recuperación de contraseña. Usan locators y
assertions exactos. No hay pasos `agent.*`, autenticación de IA ni llamadas al modelo.

## Ejecución

Requiere Node 22.22.3+ en la rama 22 o Node 24.8+. CI fija 22.22.3.

```bash
npm ci
npx @e2e-dev/web install chromium --with-deps
npm run test:tester
E2E_BASE_URL=https://app-viajes.prg-dev.workers.dev npm run test:tester
```

Sin `E2E_BASE_URL`, el runner inicia o reutiliza Next en localhost:3000. Next carga su entorno
habitual. En CI, las variables necesarias se pasan explícitamente al proceso de Next porque
`app.command` no hereda todo el entorno del runner. Contra una URL remota no arranca servidor.

Los informes viven en `.e2e/` (ignorado). `npm run test:tester` desactiva telemetría; CI conserva
el informe siete días. El gate corre después de Playwright y forma parte del requisito previo
al deploy. No actualizar snapshots automáticamente en CI.

## Qué permite y qué falta evaluar

- Pruebas exactas sin IA, objetivos con `agent.act`, assertions con agente, exploración y bug bash.
- Caché de acciones verificadas: `act` puede reproducirse; `assert`, `waitFor` y `extract` con
  el agente integrado siguen consultando al modelo.
- Comparación visual con baselines generados y revisados en el mismo sistema que CI (Linux).
- Suscripción de ChatGPT mediante OAuth propio (`e2e login openai`), o proveedores con API key.
  No se ha configurado ninguno, ni se usa el archivo de autenticación de Codex.

El viewport estrecho comprueba responsive en Chromium de escritorio: no prueba Safari/iOS,
interacciones táctiles ni push real. La exploración con modelos requiere proveedor y presupuesto
explícitos; no se incorpora a un gate determinista. Para explorar flujos que escriben, usar una
cuenta y datos de pruebas con limpieza, nunca datos personales del propietario.

La redacción de secretos del runner no sustituye la revisión de artefactos: vídeos y descargas
binarias pueden conservar datos visibles. Las pruebas iniciales solo navegan pantallas públicas.

## Documentación consultada

- [Índice completo](https://e2e.tester.army/docs/llms.txt)
- [Quickstart](https://e2e.tester.army/docs/quickstart)
- [Web y viewports](https://e2e.tester.army/docs/web)
- [Configuración](https://e2e.tester.army/docs/reference/config)
- [GitHub Actions](https://e2e.tester.army/docs/ci/github-actions)
- [Migración de Playwright](https://e2e.tester.army/docs/migrate/playwright)
- [Autenticación de la app](https://e2e.tester.army/docs/authentication)
- [Comparación visual](https://e2e.tester.army/docs/visual-testing)
- [Exploración](https://e2e.tester.army/docs/explore) y [bug bash](https://e2e.tester.army/docs/bug-bash)
- [Modelos](https://e2e.tester.army/docs/models) y [suscripciones](https://e2e.tester.army/docs/subscriptions)
- [Seguridad](https://e2e.tester.army/docs/security) y [telemetría](https://e2e.tester.army/docs/telemetry)
