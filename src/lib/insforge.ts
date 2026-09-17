import { createBrowserClient } from "@insforge/sdk/ssr";
import { publicEnv } from "@/lib/public-env";

const insforgeUrl = publicEnv.NEXT_PUBLIC_INSFORGE_URL;
const insforgeAnonKey = publicEnv.NEXT_PUBLIC_INSFORGE_ANON_KEY;

let insforgeClientInstance: ReturnType<typeof createBrowserClient> | null =
  null;

// Cliente InsForge para operaciones en navegador (patrón singleton).
// El acceso a datos va por `client.database.from(...)`.
export const createInsforgeClient = () => {
  if (!insforgeClientInstance) {
    insforgeClientInstance = createBrowserClient({
      baseUrl: insforgeUrl,
      anonKey: insforgeAnonKey,
    });
  }
  return insforgeClientInstance;
};

// TypeScript interfaces for our data models
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  airline?: string;
  flight_number?: string;
  confirmation_number?: string;
  status: "planned" | "confirmed" | "completed" | "cancelled";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  trip_id?: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  description?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  trip_id?: string;
  title: string;
  content: string;
  tags: string[];
  category?: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  trip_id?: string;
  title: string;
  message: string;
  alert_date: string;
  is_read: boolean;
  type: "reminder" | "warning" | "info";
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  trip_id: string;
  entry_date: string;
  content: string;
  rating?: number;
  created_at: string;
  updated_at: string;
}

export interface JournalPhoto {
  id: string;
  user_id: string;
  trip_id: string;
  url: string;
  key: string;
  created_at: string;
  updated_at: string;
}

// Fila del diario ya resuelta para pintar. El bucket es privado, asi que la
// columna `url` no autoriza la lectura: la imagen se pide firmada a partir de
// `key` y queda a `null` la foto cuya firma fallo.
export interface JournalPhotoRow extends JournalPhoto {
  signedUrl: string | null;
}

// Bucket de Storage para las fotos del diario. Es privado: lo que autoriza la
// lectura de un objeto no es la `url` que devuelve el upload, sino su `key`,
// que se firma al vuelo para pintar la foto y se usa tal cual para borrarla.
export const JOURNAL_PHOTOS_BUCKET = "journal-photos";

// Vida de las URLs firmadas de las fotos del diario, en segundos.
export const JOURNAL_PHOTOS_SIGNED_URL_TTL = 3600;

export interface Booking {
  id: string;
  user_id: string;
  trip_id?: string;
  type: "flight" | "hotel" | "car" | "activity" | "restaurant" | "other";
  title: string;
  description?: string;
  confirmation_number?: string;
  airline?: string;
  flight_number?: string;
  origin?: string;
  destination?: string;
  status: "confirmed" | "pending" | "cancelled";
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  documents?: string[];
  created_at: string;
  updated_at: string;
}

export interface ItineraryActivity {
  id: string;
  user_id: string;
  trip_id?: string;
  date: string;
  title: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  address?: string;
  category?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  completed: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// Extended interfaces with relations
export interface NoteWithTrip extends Note {
  trip?: {
    title: string;
  };
}

export interface ExpenseWithTrip extends Expense {
  trip?: {
    title: string;
  };
  notes?: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed";
  priority: "low" | "medium" | "high";
  due_date?: string;
  created_at: string;
  updated_at: string;
}
