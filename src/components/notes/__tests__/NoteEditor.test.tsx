import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NoteEditor from "../NoteEditor";
import { Note } from "@/lib/insforge";

// Nota que sobrevivio al borrado de su viaje: `trip_id` a null (`on delete set
// null`). Sin viaje tiene que poder abrirse, editarse y reasignarse.
const orphanNote: Note = {
  id: "note-1",
  user_id: "user-1",
  trip_id: undefined,
  title: "Diario suelto",
  content: "Notas del viaje borrado",
  tags: [],
  category: "general",
  is_favorite: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const trips = [{ id: "trip-9", title: "Ruta por Escocia" }];

describe("NoteEditor con una nota sin viaje", () => {
  it("abre la nota huerfana con 'Sin viaje asociado' seleccionado", () => {
    render(
      <NoteEditor note={orphanNote} trips={trips} onSave={jest.fn()} onCancel={jest.fn()} />,
    );

    expect(screen.getByDisplayValue("Diario suelto")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Notas del viaje borrado")).toBeInTheDocument();

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
  });

  it("permite reasignar la nota huerfana a un viaje", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    render(
      <NoteEditor note={orphanNote} trips={trips} onSave={onSave} onCancel={jest.fn()} />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "trip-9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Nota" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: "trip-9" }),
    );
  });
});
