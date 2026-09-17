"use client";

import React, { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Button from "@/components/ui/Button";
import PageTitle from "@/components/ui/PageTitle";
import ErrorState from "@/components/ui/ErrorState";
import { createInsforgeClient, Task } from "@/lib/insforge";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskCalendarView } from "@/components/tasks/TaskCalendarView";
import { TaskModal } from "@/components/tasks/TaskModal";
import {
  PlusIcon,
  ViewColumnsIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { showToast } from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<"board" | "calendar">("board");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
    setLoadError(false);

    (async () => {
      try {
        const insforge = createInsforgeClient();
        const { data, error } = await insforge
          .database.from("tasks")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (!active) return;
        setTasks((data as Task[]) ?? []);
      } catch (err) {
        if (!active) return;
        logger.error("TasksPage: Error loading tasks", {
          error: getErrorMessage(err, "Error al cargar las tareas"),
        });
        setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user?.id, reloadToken]);

  const error = loadError ? "No se pudieron cargar las tareas." : null;

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
        const { error } = await insforge
          .database.from("tasks")
          .update(data)
          .eq("id", editingTask.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await insforge
          .database.from("tasks")
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
          .single();

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
      showToast({ type: "error", message: "Error al guardar la tarea" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!user) return;
    if (!confirm("¿Estás seguro de que quieres eliminar esta tarea?")) return;

    try {
      const insforge = createInsforgeClient();
      const { error } = await insforge
        .database.from("tasks")
        .delete()
        .eq("id", task.id)
        .eq("user_id", user.id);

      if (error) throw error;

      showToast({ type: "success", message: "Tarea eliminada" });
      setTasks(tasks.filter((t) => t.id !== task.id));
    } catch (err) {
      logger.error("TasksPage: Error deleting task", {
        error: getErrorMessage(err, "Error al eliminar la tarea"),
      });
      showToast({ type: "error", message: "Error al eliminar la tarea" });
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
      const { error } = await insforge
        .database.from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId)
        .eq("user_id", user.id);

      if (error) throw error;

      // No need to fetch if successful, state is already updated
    } catch (err) {
      logger.error("TasksPage: Error updating task status", {
        error: getErrorMessage(err, "Error al actualizar el estado"),
      });
      showToast({ type: "error", message: "Error al actualizar el estado" });
      setTasks(previousTasks); // Revert on error
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <ErrorState
          message={error}
          onRetry={() => refetch()}
          title="Error al cargar las tareas"
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-100px)]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <PageTitle
            title="Mis Tareas"
            subtitle="Gestiona tus pendientes y proyectos"
          />

          <div className="flex items-center gap-3">
            <div className="bg-surface rounded-lg border border-line p-1 flex">
              <button
                onClick={() => setViewMode("board")}
                className={`p-2 rounded-md transition-colors ${
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
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "calendar"
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-strong"
                }`}
                title="Vista Calendario"
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>

            <Button
              onClick={handleCreateTask}
              className="gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Nueva Tarea</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : viewMode === "board" ? (
            <TaskBoard
              tasks={tasks}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <TaskCalendarView
              tasks={tasks}
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
