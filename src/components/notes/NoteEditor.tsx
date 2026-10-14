'use client'

import { useId, useState } from 'react'
import { Note } from '@/lib/insforge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { selectClassName, textareaClassName } from '@/components/ui/fieldStyles'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  EyeIcon,
  PencilIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface NoteEditorProps {
  note?: Note
  tripId?: string
  trips?: {id: string, title: string}[]
  onSave: (noteData: Partial<Note>) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function NoteEditor({ note, tripId, trips = [], onSave, onCancel, loading = false }: NoteEditorProps) {
  const formId = useId()
  const [formData, setFormData] = useState({
    title: note?.title || '',
    content: note?.content || '',
    category: note?.category || 'general' as const,
    trip_id: note?.trip_id || tripId || '',
  })
  const [isPreview, setIsPreview] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('El título y el contenido son requeridos')
      return
    }

    try {
      await onSave(formData)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar la nota'
      setError(errorMessage)
    }
  }

  const renderMarkdownPreview = (content: string) => {
    // Simple markdown rendering for preview
    return content
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-3">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-surface-strong px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br>')
      .replace(/^(.*)$/gm, '<p class="mb-4">$1</p>')
  }

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'itinerary', label: 'Itinerario' },
    { value: 'accommodation', label: 'Alojamiento' },
    { value: 'transport', label: 'Transporte' },
    { value: 'restaurant', label: 'Restaurante' },
    { value: 'activity', label: 'Actividad' },
    { value: 'shopping', label: 'Compras' },
    { value: 'emergency', label: 'Emergencia' },
    { value: 'contact', label: 'Contacto' },
  ]

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {note ? 'Editar Nota' : 'Nueva Nota'}
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsPreview(!isPreview)}
            >
              {isPreview ? (
                <>
                  <PencilIcon className="h-4 w-4 mr-2" />
                  Editar
                </>
              ) : (
                <>
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Vista Previa
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              aria-label="Cerrar editor de nota"
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {!isPreview ? (
            <>
              {/* Title */}
              <Input
                label="Título *"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Título de la nota"
                required
              />

              {/* Category */}
              <fieldset className="space-y-2">
                <legend className="block text-sm font-medium text-ink">
                  Categoría *
                </legend>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {categories.map((category) => (
                    <label
                      key={category.value}
                      className={`relative flex flex-col items-center p-2 border rounded-lg cursor-pointer transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2 ${
                        formData.category === category.value
                          ? 'border-accent bg-accent-soft text-ink'
                          : 'border-line hover:border-accent text-ink'
                      }`}
                    >
                      <input
                        type="radio"
                        name="category"
                        value={category.value}
                        checked={formData.category === category.value}
                        onChange={handleInputChange}
                        className="sr-only"
                      />
                      <CategoryIcon
                        category={category.value}
                        className="h-5 w-5 mb-1 text-muted"
                      />
                      <span className="text-xs text-center font-medium">
                        {category.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Trip Selector (Optional) */}
              {trips.length > 0 && (
                  <div className="space-y-2">
                      <label htmlFor={`${formId}-trip`} className="block text-sm font-medium text-ink">
                          Asociar a Viaje (Opcional)
                      </label>
                      <select
                          id={`${formId}-trip`}
                          name="trip_id"
                          value={formData.trip_id}
                          onChange={handleInputChange}
                          className={selectClassName}
                      >
                          <option value="">Sin viaje asociado</option>
                          {trips.map(trip => (
                              <option key={trip.id} value={trip.id}>{trip.title}</option>
                          ))}
                      </select>
                  </div>
              )}

              {/* Content */}
              <div className="space-y-2">
                <label htmlFor={`${formId}-content`} className="block text-sm font-medium text-ink">
                  Contenido *
                </label>
                <textarea
                  id={`${formId}-content`}
                  aria-describedby={`${formId}-content-help`}
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  rows={12}
                  className={cn(textareaClassName, 'font-mono')}
                  placeholder="Escribe tu nota aquí... Puedes usar Markdown:

# Título Principal
## Subtítulo
**Texto en negrita**
*Texto en cursiva*
`código`

- Lista item 1
- Lista item 2"
                  data-testid="note-content-textarea"
                  required
                />
                <p id={`${formId}-content-help`} className="text-xs text-muted">
                  Puedes usar Markdown para formatear tu texto. Usa la vista previa para ver cómo se verá.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Preview */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <CategoryIcon
                    category={formData.category}
                    className="h-6 w-6"
                  />
                  <h1 className="text-2xl font-bold">{formData.title || 'Sin título'}</h1>
                </div>
                
                <div className="border border-line rounded-lg p-4 bg-paper min-h-[300px]">
                  {formData.content ? (
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: renderMarkdownPreview(formData.content) 
                      }}
                    />
                  ) : (
                    <p className="text-muted italic">Sin contenido para mostrar</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6">
            <Button
              type="submit"
              loading={loading}
              className="flex-1 sm:flex-none"
            >
              {note ? 'Actualizar Nota' : 'Guardar Nota'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}