"use client";

import React, { useCallback, useEffect, useState } from "react";
import slots from "@/components/ui/interiorSlots.module.css";
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
  getErrorMessage,
  getLoadErrorMessage,
} from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export function TasksPageContent({t}: Pick<ReturnType<typeof useI18n>, 't'>) {
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
    timeout: t("tasksLoadTimeout"),
    request: t("tasksRequestError"),
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
        assertRowsAffected(updatedRows, t("taskUpdateError"));
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
        title: t("noticeTitle"),
        dismissLabel: t("toastDismiss"),
        message: editingTask ? t("taskUpdated") : t("taskCreated"),
      });
      setIsModalOpen(false);
      refetch(); // Reload tasks
    } catch (err) {
      logger.error("TasksPage: Error saving task", {
        error: getErrorMessage(err, t("taskSaveError")),
      });
      showToast({
        type: "error",
        title: t("errorToastTitle"),
        dismissLabel: t("toastDismiss"),
        message:
          queryErrorKind(err) === "timeout"
            ? t("connectionTimeout")
            : t("taskSaveError"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!user) return;
    if (!confirm(t("taskDeleteConfirm"))) return;

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
      assertRowsAffected(deletedRows, t("taskDeleteError"));

      showToast({ type: "success", title: t("noticeTitle"), dismissLabel: t("toastDismiss"), message: t("taskDeleted") });
      setTasks(tasks.filter((t) => t.id !== task.id));
    } catch (err) {
      logger.error("TasksPage: Error deleting task", {
        error: getErrorMessage(err, t("taskDeleteError")),
      });
      showToast({
        type: "error",
        title: t("errorToastTitle"),
        dismissLabel: t("toastDismiss"),
        message:
          queryErrorKind(err) === "timeout"
            ? t("connectionTimeout")
            : t("taskDeleteError"),
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
      assertRowsAffected(updatedRows, t("taskUpdateError"));

      // No need to fetch if successful, state is already updated
    } catch (err) {
      logger.error("TasksPage: Error updating task status", {
        error: getErrorMessage(err, t("taskUpdateError")),
      });
      showToast({
        type: "error",
        title: t("errorToastTitle"),
        dismissLabel: t("toastDismiss"),
        message:
          queryErrorKind(err) === "timeout"
            ? t("connectionTimeout")
            : t("taskUpdateError"),
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
          title={t("tasksLoadError")}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout skeleton="tasks">
      <div className={`${slots.tasksScreen} flex flex-col`}>
        {/* Header */}
        <div data-loading-slot="title" className={`${slots.tasksTitle} mb-6 flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-between`}>
          <PageTitle
            title={t("tasksHeading")}
            subtitle={t("tasksSubtitle")}
          />

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-paper rounded-lg border border-line p-1 flex flex-wrap">
              <Button
                variant={viewMode === "list" ? "primary" : "ghost"}
                className="min-h-11"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              >
                {t("taskListView")}
              </Button>
              <button
                aria-label={t("taskBoardView")}
                aria-pressed={viewMode === "board"}
                onClick={() => setViewMode("board")}
                className={`min-h-11 min-w-11 p-2 rounded-md transition-colors ${
                  viewMode === "board"
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-strong"
                }`}
                title={t("taskBoardView")}
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
                title={t("taskCalendarView")}
                aria-label={t("taskCalendarView")}
                aria-pressed={viewMode === "calendar"}
              >
                <CalendarIcon className="w-5 h-5" />
              </button>
            </div>

            <Button
              onClick={handleCreateTask}
              aria-label={t("newTask")}
              className="gap-2"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">{t("newTask")}</span>
            </Button>
          </div>
        </div>

        <div data-loading-slot="tasksFilters" className={`${slots.tasksFilters} mb-6 flex flex-wrap items-center justify-between gap-4`}>
          <div
            role="group"
            aria-label={t("tasksFilter")}
            className="flex flex-wrap gap-1"
          >
            {[
              { id: "all", label: t("taskFilterAll") },
              { id: "pending", label: t("taskFilterPending") },
              { id: "completed", label: t("taskFilterCompleted") },
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
              aria-label={t("searchTasks")}
              placeholder={t("searchTasks") + "..."}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-h-11"
            />
          </div>
        </div>
        {/* Content */}
        <div data-loading-slot="tasksBody" role="region" aria-label={t("tasksRegion")} tabIndex={0} className={slots.tasksBody}>
          {viewMode === "list" ? (
            <TaskList
              tasks={filteredTasks}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
              onStatusChange={handleStatusChange}
            />
          ) : viewMode === "board" ? (
            <>
              <h2 className="sr-only">{t("taskBoardTitle")}</h2>
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

export default function TasksPage() {
  const i18n = useI18n()
  return <TasksPageContent {...i18n} />
}
