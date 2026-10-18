# 🤝 Guía de Contribución

> **¡Bienvenido/a! Gracias por tu interés en contribuir al proyecto App Viajes**

---

## 🚀 Primeros Pasos

### 📚 **Lectura Obligatoria**

Antes de empezar, asegúrate de leer:

- 📖 [`README.md`](../README.md) - Visión general del proyecto
- 🛠️ [`docs/TECHNICAL.md`](./TECHNICAL.md) - Configuración técnica
- 🏗️ [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) - Arquitectura del sistema

### ⚙️ **Configuración Inicial**

1. **Fork** el repositorio
2. **Clona** tu fork localmente
3. **Configura** `.env.local` (ver `TECHNICAL.md`)
4. **Instala** dependencias: `pnpm install`
5. **Verifica** que todo funciona: `pnpm run dev`

---

## 🔄 Flujo de Trabajo

### 1️⃣ **Crear una Rama**

```bash
# Desde la rama main
git checkout main
git pull origin main

# Crear nueva rama con nomenclatura correcta
git checkout -b feature/nombre-descriptivo
git checkout -b fix/descripcion-del-bug
git checkout -b chore/tarea-mantenimiento
```

### 2️⃣ **Desarrollar**

- 💻 Escribe código siguiendo las convenciones del proyecto
- 🧪 Añade tests para nuevas funcionalidades
- 📝 Actualiza documentación si es necesario
- 🔍 Ejecuta `pnpm run lint` regularmente

### 3️⃣ **Commits Semánticos**

Sigue la guía de [`docs/COMMITS.md`](./COMMITS.md):

```bash
# Ejemplos de commits correctos
git commit -m "feat(auth): añadir login con Google"
git commit -m "fix(budget): corregir cálculo de totales"
git commit -m "docs(readme): actualizar instrucciones de instalación"
```

### 4️⃣ **Pull Request**

1. **Push** tu rama: `git push origin nombre-de-tu-rama`
2. **Abre** un PR hacia `main`
3. **Completa** la plantilla del PR
4. **Solicita** review de los maintainers

---

## ✅ Estándares de Calidad

### 🔍 **Antes de Hacer Push**

| Verificación                | Comando              | Estado           |
| ---------------------------- | -------------------- | ---------------- |
| **Lint sin errores**   | `pnpm run lint`     | ✅ Debe pasar    |
| **Tests funcionando**  | `pnpm test`         | ✅ Debe pasar    |
| **Build exitoso**      | `pnpm run build`    | ✅ Debe pasar    |
| **Formato de código** | `pnpm exec eslint --fix` | 🔧 Auto-corregir |

### 📝 **Convenciones de Código**

- **TypeScript**: Usa tipos explícitos siempre que sea posible
- **Componentes**: PascalCase para nombres de componentes
- **Archivos**: kebab-case para archivos y carpetas
- **Funciones**: camelCase para funciones y variables
- **Constantes**: UPPER_SNAKE_CASE para constantes

### 🧪 **Testing**

```bash
# Ejecutar todos los tests
pnpm test

# Ejecutar tests en modo watch
pnpm run test:watch

# Ejecutar tests con coverage
pnpm run test:coverage
```

**Requisitos de testing:**

- ✅ Nuevas funcionalidades deben incluir tests
- ✅ Coverage mínimo del 80%
- ✅ Tests unitarios para lógica de negocio
- ✅ Tests de integración para componentes complejos

---

## 🏷️ Tipos de Contribuciones

### 🐛 **Reportar Bugs**

1. **Busca** si el bug ya fue reportado
2. **Crea** un nuevo issue con la etiqueta `bug`
3. **Incluye**:
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Screenshots si aplica
   - Información del entorno (OS, browser, etc.)

### ✨ **Proponer Features**

1. **Abre** un issue con la etiqueta `feature`
2. **Describe**:
   - Problema que resuelve
   - Solución propuesta
   - Alternativas consideradas
   - Mockups o wireframes si aplica

### 📚 **Mejorar Documentación**

- Usa la etiqueta `documentation`
- Mantén el tono claro y conciso
- Incluye ejemplos cuando sea útil
- Verifica que los enlaces funcionen

### 🔧 **Tareas de Mantenimiento**

- Actualización de dependencias
- Mejoras de performance
- Refactoring de código
- Configuración de herramientas

---

## 👥 Proceso de Review

### 📋 **Checklist del Autor**

Antes de solicitar review, verifica:

- [ ] 📝 Descripción clara del cambio
- [ ] 🔗 Referencia a issues relacionados
- [ ] ✅ Tests y lint en verde
- [ ] 📖 Documentación actualizada si aplica
- [ ] 🔄 Rama actualizada con `main`
- [ ] 🧪 Funcionalidad probada manualmente

### 👀 **Checklist de Revisión**

Los reviewers verificarán:

- [ ] 📏 Cumple guidelines de código
- [ ] 🔒 No rompe APIs públicas
- [ ] ⚠️ Manejo de errores adecuado
- [ ] 🏗️ Nombres y estructura consistentes
- [ ] 🚀 Performance aceptable
- [ ] 🔐 Consideraciones de seguridad

> 📖 **Detalle completo**: [`docs/PR_PROCESS.md`](./PR_PROCESS.md)

---

## 🏷️ Sistema de Etiquetas

| Etiqueta             | Descripción                            | Color       |
| -------------------- | --------------------------------------- | ----------- |
| `bug`              | 🐛 Errores y problemas                  | `#d73a4a` |
| `feature`          | ✨ Nuevas funcionalidades               | `#a2eeef` |
| `enhancement`      | 🚀 Mejoras a funcionalidades existentes | `#84b6eb` |
| `documentation`    | 📚 Mejoras en documentación            | `#0075ca` |
| `good first issue` | 👶 Ideal para nuevos contribuidores     | `#7057ff` |
| `help wanted`      | 🙋 Se necesita ayuda                    | `#008672` |
| `priority: high`   | 🔥 Alta prioridad                       | `#b60205` |
| `priority: low`    | 🔽 Baja prioridad                       | `#0e8a16` |

---

## 💬 Comunicación

### 🗣️ **Canales de Comunicación**

- **Issues**: Para discusiones técnicas y reportes
- **Pull Requests**: Para review de código
- **Discussions**: Para ideas y preguntas generales

### 📝 **Mejores Prácticas**

- 🎯 Sé específico y claro en tus mensajes
- 🤝 Mantén un tono respetuoso y constructivo
- 🔍 Busca antes de preguntar
- 📎 Incluye contexto relevante (links, screenshots, etc.)
- 🌍 Usa español neutro para mantener consistencia

---

## 🎉 Reconocimiento

### 🏆 **Contribuidores**

Todos los contribuidores son reconocidos en:

- 📄 README principal del proyecto
- 🎖️ Sección de contribuidores en GitHub
- 📊 All Contributors bot (próximamente)

### 🎁 **Beneficios**

- 🌟 Reconocimiento público de tus contribuciones
- 📈 Experiencia en proyectos reales
- 🤝 Networking con otros desarrolladores
- 📚 Aprendizaje de nuevas tecnologías

---

## ❓ ¿Necesitas Ayuda?

### 🆘 **Recursos de Apoyo**

- 🐛 **Issues**: [GitHub Issues](https://github.com/PabloJustDevelops/TravelPal/issues)
- 💬 **Pull requests**: [Pull Requests](https://github.com/PabloJustDevelops/TravelPal/pulls)
- 👤 **Mantenedor**: [@PabloJustDevelops](https://github.com/PabloJustDevelops)

### 🚀 **Para Nuevos Contribuidores**

1. Busca issues con la etiqueta `good first issue`
2. Lee toda la documentación en `docs/`
3. Configura tu entorno de desarrollo
4. ¡Haz tu primera contribución!

---

**¡Gracias por contribuir al proyecto App Viajes! 🚀✈️**

*Última actualización: Enero 2025*
