"use client";

import { Fragment, useEffect, useId, useState } from "react";
import type { Note } from "@/lib/insforge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  selectClassName,
  textareaClassName,
} from "@/components/ui/fieldStyles";
import {
  ArrowLeftIcon,
  EyeIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

interface NoteEditorProps {
  note?: Note;
  tripId?: string;
  trips?: { id: string; title: string }[];
  onSave: (noteData: Partial<Note>) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}
const categories = [
  { value: "general", label: "General" },
  { value: "itinerary", label: "Itinerario" },
  { value: "accommodation", label: "Alojamiento" },
  { value: "transport", label: "Transporte" },
  { value: "restaurant", label: "Restaurante" },
  { value: "activity", label: "Actividad" },
  { value: "shopping", label: "Compras" },
  { value: "emergency", label: "Emergencia" },
  { value: "contact", label: "Contacto" },
];

// React escapa el texto antes de renderizar. El contenido de una nota nunca se ejecuta como HTML.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).map((part, index) =>
    part.startsWith("**") ? (
      <strong key={index}>{part.slice(2, -2)}</strong>
    ) : part.startsWith("`") ? (
      <code key={index} className="rounded bg-surface px-1">
        {part.slice(1, -1)}
      </code>
    ) : part.startsWith("*") ? (
      <em key={index}>{part.slice(1, -1)}</em>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
function MarkdownPreview({ content }: { content: string }) {
  const blocks = content.split(/\n\s*\n/);
  return (
    <div className="space-y-4 break-words">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*[-*] /.test(line)))
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.replace(/^\s*[-*] /, ""))}</li>
              ))}
            </ul>
          );
        return (
          <div key={index} className="space-y-2">
            {lines.map((line, i) => {
              const heading = line.match(/^(#{1,3})\s+(.*)/);
              if (heading) {
                const Heading =
                  heading[1].length === 1
                    ? "h3"
                    : heading[1].length === 2
                      ? "h4"
                      : "h5";
                return (
                  <Heading key={i} className="text-lg font-bold">
                    {inline(heading[2])}
                  </Heading>
                );
              }
              return <p key={i}>{inline(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function NoteEditor({
  note,
  tripId,
  trips = [],
  onSave,
  onCancel,
  loading = false,
  onDirtyChange,
}: NoteEditorProps) {
  const formId = useId();
  const [initial, setInitial] = useState({
    title: note?.title || "",
    content: note?.content || "",
    category: note?.category || "general",
    trip_id: note?.trip_id || tripId || "",
  });
  const [formData, setFormData] = useState(initial);
  const [isPreview, setIsPreview] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(formData) !== JSON.stringify(initial);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const change = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) =>
    setFormData((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!formData.title.trim() || !formData.content.trim()) {
      setError("El título y el contenido son requeridos");
      return;
    }
    try {
      await onSave(formData);
      setInitial({ ...formData });
      onDirtyChange?.(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Error al guardar la nota",
      );
    }
  };
  return (
    <section aria-label="Editor de nota" className="min-w-0 p-5 sm:p-6">
      <h2 className="sr-only">{note?.title || "Nueva Nota"}</h2>
      <div className="mb-3 flex lg:hidden">
        <Button
          variant="ghost"
          onClick={onCancel}
          aria-label="Cerrar editor de nota"
          className="min-h-11 gap-2"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
          Volver a notas
        </Button>
      </div>
      <form onSubmit={submit} className="space-y-5">
        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            {error}
          </p>
        )}
        <Input
          aria-label="Título *"
          name="title"
          value={formData.title}
          onChange={change}
          placeholder="Título de la nota"
          required
          className="min-h-12 border-transparent px-0 text-2xl font-bold"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">
              Categoría *
            </legend>
            <select
              name="category"
              value={formData.category}
              onChange={change}
              aria-label="Categoría de la nota"
              className={`${selectClassName} min-h-11`}
            >
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </fieldset>
          {trips.length > 0 && (
            <div>
              <label
                htmlFor={`${formId}-trip`}
                className="mb-2 block text-sm font-medium text-ink"
              >
                Asociar a Viaje (Opcional)
              </label>
              <select
                id={`${formId}-trip`}
                name="trip_id"
                value={formData.trip_id}
                onChange={change}
                className={`${selectClassName} min-h-11`}
              >
                <option value="">Sin viaje asociado</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1 border-b border-line">
          <Button
            type="button"
            variant="ghost"
            className={`min-h-11 gap-2 rounded-none border-b-2 ${!isPreview ? "border-accent text-accent" : "border-transparent"}`}
            aria-pressed={!isPreview}
            onClick={() => setIsPreview(false)}
          >
            <PencilIcon className="h-4 w-4" aria-hidden="true" />
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={`min-h-11 gap-2 rounded-none border-b-2 ${isPreview ? "border-accent text-accent" : "border-transparent"}`}
            aria-pressed={isPreview}
            onClick={() => setIsPreview(true)}
          >
            <EyeIcon className="h-4 w-4" aria-hidden="true" />
            Vista Previa
          </Button>
        </div>
        {!isPreview ? (
          <div>
            <label
              htmlFor={`${formId}-content`}
              className="mb-2 block text-sm font-medium text-ink"
            >
              Contenido *
            </label>
            <textarea
              id={`${formId}-content`}
              name="content"
              value={formData.content}
              onChange={change}
              rows={15}
              aria-describedby={`${formId}-help`}
              className={`${textareaClassName} min-h-80 font-mono`}
              placeholder="Escribe tu nota aquí... Puedes usar Markdown"
              data-testid="note-content-textarea"
              required
            />
          </div>
        ) : (
          <div className="min-h-80 rounded-md border border-line p-4 text-ink">
            <h3 className="mb-4 text-xl font-bold">
              {formData.title || "Sin título"}
            </h3>
            {formData.content ? (
              <MarkdownPreview content={formData.content} />
            ) : (
              <p className="text-muted">Sin contenido para mostrar</p>
            )}
          </div>
        )}
        <p id={`${formId}-help`} className="text-xs text-muted">
          Puedes usar Markdown. Consulta la vista previa antes de guardar.
        </p>
        <div className="flex flex-wrap gap-3 border-t border-line pt-5">
          <Button type="submit" loading={loading} className="min-h-11">
            {note ? "Actualizar Nota" : "Guardar Nota"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
            className="min-h-11"
          >
            Cancelar
          </Button>
          {dirty && (
            <span role="status" className="self-center text-xs text-muted">
              Cambios sin guardar
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
