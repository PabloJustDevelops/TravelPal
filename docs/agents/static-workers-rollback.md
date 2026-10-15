# Rollback de Workers assets-only

El último commit anterior a la migración de autenticación y export estático es
`523d0a8`. `b86d853` ya contiene los cambios SPA y `output: 'export'`, por lo que
restaurar solo su configuración OpenNext no es un rollback funcional.

Si la rama conserva la secuencia de commits de esta migración desde `523d0a8`,
revierte el rango completo con commits nuevos, revisa el diff y publícalo en
`main` para activar el workflow OpenNext restaurado:

```sh
git switch -c codex/rollback-static-workers
git revert --no-commit 523d0a8..HEAD
git diff --check
git diff
git commit -m "Revierte la migración a Workers estáticos"
git push -u origin codex/rollback-static-workers
```

Abre un PR de esa rama a `main`; su merge activa el workflow OpenNext restaurado.
Ejecuta ese rango solo cuando contenga esta migración y no incluya trabajo ajeno.
Si la integración se hizo como un único commit squash, crea la rama desde `main`
y revierte ese commit en su lugar. No uses `git reset` ni `git push --force`.

Se probó `pnpm exec opennextjs-cloudflare build` en el estado estático con valores
públicos ficticios: Next compila, pero OpenNext falla al empaquetar porque falta
`.next/standalone/.next/server/pages-manifest.json`. Por eso el rollback debe
restaurar también auth y rutas previas a `output: 'export'`; este archivo no
afirma que OpenNext funcione en el estado estático.
