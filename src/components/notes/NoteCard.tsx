'use client'

import { Note } from '@/lib/insforge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import {
  CalendarIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import Button from '@/components/ui/Button'
import CategoryIcon from '@/components/ui/CategoryIcon'

interface NoteWithTrip extends Note {
  trip?: {
    title: string
  }
}

interface NoteCardProps {
  note: Note | NoteWithTrip
  showTripTitle?: boolean
  onEdit?: (note: Note) => void
}

export default function NoteCard({ note, showTripTitle = false, onEdit }: NoteCardProps) {
  const getCategoryName = (category: Note['category']) => {
    switch (category) {
      case 'itinerary':
        return 'Itinerario'
      case 'accommodation':
        return 'Alojamiento'
      case 'transport':
        return 'Transporte'
      case 'restaurant':
        return 'Restaurante'
      case 'activity':
        return 'Actividad'
      case 'shopping':
        return 'Compras'
      case 'emergency':
        return 'Emergencia'
      case 'contact':
        return 'Contacto'
      default:
        return 'General'
    }
  }

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  return (
    <Card className="relative h-full">
      <CardHeader className="border-b-0 pb-0">
        <div className="flex items-start justify-between">
          <CardTitle headingLevel={2} className="min-w-0 text-lg flex items-center gap-2">
            <CategoryIcon
              category={note.category}
              className="h-5 w-5 text-muted"
            />
            <span className="break-words">{note.title}</span>
          </CardTitle>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(note)}
              aria-label={`Editar nota ${note.title}`}
              className="h-11 w-11 shrink-0 p-0"
            >
              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
        {showTripTitle && (note as NoteWithTrip).trip && (
          <div className="text-sm text-muted mt-1">
            {(note as NoteWithTrip).trip?.title}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-muted">{getCategoryName(note.category)}</p>

        {/* Content Preview */}
        <div className="prose prose-sm max-w-none">
          <div className="text-ink text-sm leading-relaxed">
            {truncateContent(note.content)}
          </div>
        </div>

        {/* Date */}
        <div className="flex items-center space-x-2 text-muted text-sm pt-2 border-t border-line">
          <CalendarIcon className="h-4 w-4" />
          <span>Actualizado {formatDate(note.updated_at)}</span>
        </div>
      </CardContent>
    </Card>
  )
}