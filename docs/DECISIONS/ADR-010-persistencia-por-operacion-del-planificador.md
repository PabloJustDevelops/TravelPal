# ADR-010: El planificador persiste por operación, sin botón de guardado

## Contexto

El botón «Guardar Itinerario» del planificador prometía guardar y no guardaba: su `onSave`
terminaba en un `logger.debug` con un TODO de comentario. El triaje del [#60] midió el alcance real:
**no existía ningún `insert` en `itinerary_activities` en toda la app**. La tabla solo se leía, se
movía (arrastre de fecha en el calendario) y se borraba; para un usuario nuevo las actividades no
podían nacer. El alta existió como código en `insforge-functions.ts`, nunca se cableó a la UI y se
retiró con el rework (commit `bf2b32f`), así que la superficie del itinerario quedó a medias.

El triaje dejó la salida como decisión de producto, con tres vías: **persistir el itinerario
completo** con el botón, **retirar la superficie**, o una **vía intermedia**. La primera arrastra
cuatro problemas que el propio triaje enumeró:

- **Notas de día sin columna**: se editaban y se pintaban, pero no hay tabla ni columna donde
  vivan; `getTripItinerary` las forzaba a `""`. Guardar el itinerario entero las perdería en
  silencio o exigiría migración.
- **Dos vocabularios de id**: el planificador inventaba ids (`activity_<ts>_<rand>`) mientras las
  filas de la base tienen uuid; guardar todo sin distinguirlos manda ids sintéticos como uuid.
- **Estado local desincronizado**: `useState(itinerary)` con un efecto que solo rellenaba si estaba
  vacío; con «guardar todo», eso resucita filas borradas desde el calendario y se salta recargas.
- **Round-trip con pérdidas**: el mapeo no lee `address` ni `order_index` y el modal no recoge
  dirección (columnas muertas del esquema).

## Decisión

Se adopta la **vía intermedia: persistencia por operación**. Cada alta, edición y borrado del
planificador escribe su fila en `itinerary_activities` en el momento, y el botón «Guardar
Itinerario» desaparece con su promesa. No se persiste «el itinerario completo» de golpe.

1. **Una escritura por operación**, con el patrón que la propia página ya usaba para el borrado y
   el arrastre del calendario: `withQueryTimeout` (techo de 15 s, [#56]) + `assertRowsAffected`
   (cero filas es fallo tipado, [#53]) + `refetch`. El alta usa `insert([{ ... }])` (el SDK toma
   array), `.select()` y rellena `user_id`, `trip_id`, `date`, `title`, `description`, `start_time`,
   `end_time`, `location`, `category`, `cost`, `currency`, `notes`, `completed` y `order_index`.
2. **El padre ejecuta el SDK; el planificador no.** Los callbacks `onCreateActivity`,
   `onUpdateActivity` y `onDeleteActivity` son `Promise<void>`: la página hace la consulta y lanza
   el error; el planificador gestiona el estado de guardado por operación y traduce el fallo con
   los helpers existentes (`queryErrorKind`, `CONNECTION_TIMEOUT_MESSAGE`, `getErrorMessage`).
   Nada de `Promise<void>` sueltos ni errores tragados. Se mantiene el camino único del [ADR-009]:
   el SDK directo, sin endpoints nuevos.
3. **Un solo vocabulario de id.** Se elimina la generación sintética: `id` es siempre el uuid de la
   fila persistida. Editar y borrar mandan ese uuid; el alta no manda id (lo genera la base y llega
   por el `refetch`).
4. **La fuente de verdad es el servidor.** El planificador deja de guardar copia local de las
   actividades (`currentItinerary` desaparece) y pinta el `itinerary` que recibe. Su estado local
   queda para la UI efímera: día seleccionado, modal abierto y formulario. Así una recarga se
   refleja y una fila borrada desde el calendario no resucita.
5. **El día se identifica en ISO.** `generateTripDays` usaba `formatDate` (fecha localizada en
   español) como clave de día, mientras el esquema (`date date`) y el mapeo de la página usan
   `yyyy-MM-dd`; sin corregirlo ni la carga casaba ni el `insert` de `date` era válido. Las claves
   pasan a `yyyy-MM-dd` y se parsean en local con `parseISO`.
6. **Las notas de día salen de la UI.** No tienen columna ni tabla y este ADR **no crea migración**:
   se retira el área de texto del planificador para no prometer lo que no se guarda.

## Consecuencias

- **`itinerary_activities` deja de ser una tabla sin escritor**: se cierra el tercer caso que la
  [auditoría de utilidad y rework](../audits/auditoria-utilidad-y-rework.md) había anotado (tras
  `alerts` y `reminders`/`calendar_events`).
- **Se pierde el flujo «reviso el borrador y luego guardo»**: cada operación es inmediata. Es el
  precio de la vía elegida y la razón de elegirla: menos superficie y ninguna promesa en falso.
- **Se pierden las notas de día en la UI** hasta que se decida si merecen tabla propia. No se
  pierden datos: hoy no se persistían.
- **`address` y `order_index` siguen sin superficie en el modal** (no los recoge). `order_index` se
  rellena al dar de alta con la posición del día; `address` queda como columna sin escritor.
- **La divisa por defecto del modal pasa de `USD` a `EUR`**, que es el defecto del esquema, para no
  guardar una moneda distinta a la declarada.

## Estado

Aprobado

[#53]: https://github.com/PabloJustDevelops/TravelPal/issues/53
[#56]: https://github.com/PabloJustDevelops/TravelPal/issues/56
[#60]: https://github.com/PabloJustDevelops/TravelPal/issues/60
