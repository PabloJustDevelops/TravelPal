# Integración de ramas remotas — 2026-10-14

Esta integración registra en el historial de `main` los heads remotos existentes al 2026-10-14. La base es `origin/main` en `4f8728171a3acd3859732dc5142d91a93a7f988d`.

Se conserva como árbol final el contenido actual de `main`. La auditoría previa encontró que estas ramas son snapshots antiguos, cambios ya sustituidos por PRs posteriores o ramas cuyo contenido está ya en `main`; importar sus árboles volvería a introducir versiones anteriores de dependencias y código. Para conservar sus commits como ancestros sin reemplazar el árbol actual se crean merges con estrategia `ours`. Esto registra la relación histórica, no vuelve a aplicar sus cambios de archivos.

| Rama remota | Head auditado | Disposición |
|---|---|---|
| `origin/chore/diag-build` | `523b5bb2510e9972ab62e53de4a4c0751a42b6e0` | Diagnóstico de build antiguo; supersedido. |
| `origin/codex/atlas-design` | `0e59fc5794c4aff437f63d5737cde4247ec8511e` | Diseño anterior; integrado/supersedido por trabajo posterior. |
| `origin/codex/atlas-redesign` | `4ffb33d0209fe736e2c255f4cdf624f6ca684c40` | Snapshot de rediseño anterior; cambios posteriores prevalecen. |
| `origin/codex/auth-brand-a11y` | `c0ef4bd65c5a62eedd41a90626a8a2b7963a714f` | Head de PR #94; árbol idéntico a `main`. |
| `origin/codex/ci-qa-refresh` | `24cf74a716b2b142132f6d08628f27fec2935b5d` | CI/QA sustituido por cambios posteriores. |
| `origin/codex/pnpm-accessibility` | `108ae0aaf7a06fc505cdf4e618d43529ad6e0a40` | Migración y accesibilidad ya integradas mediante PR posterior. |
| `origin/codex/pnpm-accessibility-design` | `d82a2e5d18444f30ecc135735c453e61a1225715` | Snapshot sustituido por cambios posteriores. |
| `origin/feature/auth-routes-refactor` | `6476144c621db9c4ea30019db0e45e2cbee9b5ea` | Snapshot antiguo; contiene dependencias y rutas obsoletas. |
| `origin/feature/commits-grupos` | `6476144c621db9c4ea30019db0e45e2cbee9b5ea` | Mismo head que `feature/auth-routes-refactor`. |
| `origin/master` | `5e28835cf6b6a94d6abe345e2622fb74b51d5cc8` | Base antigua; importarla revertiría cambios actuales. |
| `origin/refactor/38-etapa3-tasks` | `09efa513a93c6b17cd1a909b0929a5789cfbeef5` | Snapshot de refactor antiguo; reemplazado por evolución posterior. |
| `origin/refactor/38-etapa3-trips` | `053ece57d17343c795ae79027b0b9639904ac556` | Snapshot de refactor antiguo; reemplazado por evolución posterior. |
| `origin/refactor/38-etapa4-sdk-hardening` | `e8c54f5c73657da07cddbcb1255d31c8533e91cd` | Snapshot de refactor antiguo; reemplazado por evolución posterior. |
| `origin/refactor/38-etapa5-cierre` | `9c90776e4aa08a280a3146c5445778adc22b22ff` | Snapshot de refactor antiguo; reemplazado por evolución posterior. |
| `origin/refactor/38-unificar-camino-de-datos` | `022d12d89fbd5cd0d0f008d7c7ac17c9584c2a45` | Snapshot de refactor antiguo; reemplazado por evolución posterior. |
| `origin/test/e2e-flujos-core` | `897540a5e242978baac1e925f03033ad889d0bff` | Cobertura E2E anterior; evolución posterior prevalece. |
| `origin/vercel/react-server-components-cve-vu-j5w6nm` | `ea6b17aaf8c71e890c1a4cd66af06612bbca89ec` | Mitigación antigua para stack ya actualizado; no reintroducir stack anterior. |

`origin/main` es la rama base y no requiere merge consigo misma. Hay 18 refs remotas contando `main` (sin contar el puntero simbólico `origin/HEAD`); esta integración incorpora los otros 17 heads.
