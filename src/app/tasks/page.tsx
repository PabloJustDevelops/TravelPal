"use client";

import React, { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import ErrorState from "@/components/ui/ErrorState";
import { createInsforgeClient, Task } from "@/lib/insforge";
import {
  assertRowsAffected,
  queryErrorKind,
  withQueryTimeout,
  type QueryErrorKind,
} from "@/lib/insforge-query";
import { TaskList } from "@/components/tasks/TaskList";
import Input from "@/components/ui/Input";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { TaskModal } from "@/components/tasks/TaskModal";
import {
  PlusIcon,
  ViewColumnsIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { showToast } from "@/lib/toast";
import {
  CONNECTION_TIMEOUT_MESSAGE,
  getErrorMessage,
  getLoadErrorMessage,
} from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "board" | "calendar">(
    "list",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredTasks = tasks.filter(
    (task) =>
      (!searchTerm ||
        `${task.title} ${task.description || ""}`
          .toLocaleLowerCase()
          .includes(searchTerm.toLocaleLowerCase())) &&
      (statusFilter === "all" ||
        (statusFilter === "pending"
          ? task.status !== "completed"
          : task.status === "completed")),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{
    kind: QueryErrorKind;
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const userId = user.id;
    let active = true;

    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const insforge = createInsforgeClient();
        const { data, error } = await withQueryTimeout(
          insforge.database
            .from("tasks")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          { label: "tasks" },
        );

        if (error) throw error;

        if (!active) return;
        setTasks((data as Task[]) ?? []);
      } catch (err) {
        if (!active) return;
        logger.error("TasksPage: Error loading tasks", {
          error: getErrorMessage(err, "Error al cargar las tareas"),
        });
        setLoadError({ kind: queryErrorKind(err) });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, reloadToken]);

  const error = getLoadErrorMessage(loadError, {
    timeout: "La carga de tareas ha tardado demasiado.",
    request: "No se pudieron cargar las tareas.",
  });

  const handleCreateTask = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (data: Partial<Task>) => {
    if (!user) return;

    try {
      setSaving(true);
      const insforge = createInsforgeClient();

      if (editingTask) {
        const { data: updatedRows, error } = await withQueryTimeout(
          insforge.database
            .from("tasks")
            .update(data)
            .eq("id", editingTask.id)
            .eq("user_id", user.id)
            .select(),
          { label: "tasks:update" },
        );

        if (error) throw error;
        assertRowsAffected(updatedRows, "No se pudo actualizar la tarea");
      } else {
        const { error } = await withQueryTimeout(
          insforge.database
            .from("tasks")
            .insert([
              {
                user_id: user.id,
                title: data.title,
                description: data.description,
                status: data.status || "pending",
                priority: data.priority || "medium",
                due_date: data.due_date || null,
              },
            ])
            .select()
            .single(),
          { label: "tasks:insert" },
        );

        if (error) throw error;
      }

      showToast({
        type: "success",
        message: editingTask ? "Tarea actualizada" : "Tarea creada",
      });
      setIsModalOpen(false);
      refetch(); // Reload tasks
    } catch (err) {
      logger.error("TasksPage: Error saving task", {
        error: getErrorMessage(err, "Error al guardar la tarea"),
      });
      showToast({
        type: "error",
        message:
          queryErrorKind(err) === "timeout"
            ? CONNECTION_TIMEOUT_MESSAGE
            : "Error al guardar la tarea",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!user) return;
    if (!confirm("¿Estás seguro de que quieres eliminar esta tarea?")) return;

    try {
      const insforge = createInsforgeClient();
      const { data: deletedRows, error } = await withQueryTimeout(
        insforge.database
          .from("tasks")
          .delete()
          .eq("id", task.id)
          .eq("user_id", user.id)
          .select(),
        { label: "tasks:delete" },
      );

      if (error) throw error;
      assertRowsAffected(deletedRows, "No se pudo eliminar la tarea");

      showToast({ type: "success", message: "Tarea eliminada" });
      setTasks(tasks.filter((t) => t.id !== task.id));
    } catch (err) {
      logger.error("TasksPage: Error deleting task", {
        error: getErrorMessage(err, "Error al eliminar la tarea"),
      });
      showToast({
        type: "error",
        message:
          queryErrorKind(err) === "timeout"
            ? CONNECTION_TIMEOUT_MESSAGE
            : "Error al eliminar la tarea",
      });
    }
  };

  const handleStatusChange = async (
    taskId: string,
    newStatus: Task["status"],
  ) => {
    if (!user) return;

    // Optimistic update
    const previousTasks = [...tasks];
    setTasks(
      tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    try {
      const insforge = createInsforgeClient();
      const { data: updatedRows, error } = await withQueryTimeout(
        insforge.database
          .from("tasks")
          .update({ status: newStatus })
          .eq("id", taskId)
          .eq("user_id", user.id)
          .select(),
        { label: "tasks:status" },
      );

      if (error) throw error;
      assertRowsAffected(updatedRows, "No se pudo actualizar el estado");

      // No need to fetch if successful, state is already updated
    } catch (err) {
      logger.error("TasksPage: Error updating task status", {
        error: getErrorMessage(err, "Error al actualizar el estado"),
      });
      showToast({
        type: "error",
        message:
          queryErrorKind(err) === "timeout"
            ? CONNECTION_TIMEOUT_MESSAGE
            : "Error al actualizar el estado",
      });
      setTasks(previousTasks); // Revert on error
    }
  };

  if (loading) {
    return <DashboardLayout skeleton="tasks" pending loadingView={viewMode} />;
  }

  if (error) {
    return (
      <DashboardLayout skeleton="tasks">
        <ErrorState
          message={error}
          onRetry={() => refetch()}
          title="Error al cargar las tareas"
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout skeleton="tasks">
      <div className="flex min-h-[calc(100vh-100px)] flex-col">
        {/* Header */}
        <div className="mb-6 flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between">
          <PageTitle
            title="Lo importante, antes de salir."
            subtitle="Tus pendientes, sin perder el hilo."
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-paper rounded-lg border border-line p-1 flex flex-wrap">
              <Button
                variant={viewMode === "list" ? "primary" : "ghost"}
                className="min-h-11"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              >
                Lista
              </Button>
              <button
                aria-label="Vista Tablero"
                aria-pressed={viewMode === "board"}
                onClick={() => setViewMode("board")}
                className={`min-h-11 min-w-11 p-2 rounded-md transition-colors ${
                  viewMode === "board"
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-strong"
                }`}
                title="Vista Tablero"
              >
                <ViewColumnsIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`min-h-11 min-w-11 p-2 rounded-md transition-colors ${
                  viewMode === "calendar"
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-strong"
                }`}
                title="Vista Calendario"
                aria-label="Vista Calendario"
                aria-pressed={viewMode === "calendar"}
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>

            <Button
              onClick={handleCreateTask}
              aria-label="Nueva Tarea"
              className="gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Nueva Tarea</span>
            </Button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div
            role="group"
            aria-label="Filtrar tareas por estado"
            className="flex flex-wrap gap-1"
          >
            {[
              { id: "all", label: "Todas" },
              { id: "pending", label: "Pendientes" },
              { id: "completed", label: "Completadas" },
            ].map((filter) => (
              <Button
                key={filter.id}
                variant={statusFilter === filter.id ? "primary" : "ghost"}
                aria-pressed={statusFilter === filter.id}
                className="min-h-11"
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
          <div className="w-full sm:max-w-xs">
            <Input
              aria-label="Buscar tareas"
              placeholder="Buscar tareas..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-h-11"
            />
          </div>
        </div>
        {/* Content */}
        <div className="min-w-0">
          {viewMode === "list" ? (
            <TaskList
              tasks={filteredTasks}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onStatusChange={handleStatusChange}
            />
          ) : viewMode === "board" ? (
            <>
              <h2 className="sr-only">Tablero de tareas</h2>
              <TaskBoard
                tasks={filteredTasks}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onStatusChange={handleStatusChange}
              />
            </>
          ) : (
            <TaskCalendarView
              tasks={filteredTasks}
              onTaskClick={handleEditTask}
              onDateSelect={() => {
                // Optional: open modal with pre-selected date
                handleCreateTask();
              }}
            />
          )}
        </div>
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        initialData={editingTask}
        isLoading={saving}
      />
    </DashboardLayout>
  );
}
