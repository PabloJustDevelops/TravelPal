"use client";

import type { Task } from "@/lib/insforge";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { selectClassName } from "@/components/ui/fieldStyles";
import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useI18n } from '@/lib/i18n/LocaleProvider';

interface Props {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onStatusChange: (id: string, status: Task["status"]) => void;
}
export function TaskList({
  tasks,
  onEditTask,
  onDeleteTask,
  onStatusChange,
}: Props) {
  const { t, locale } = useI18n();
  const groups = [
    { id: "pending", label: t("taskFilterPending") },
    { id: "in_progress", label: t("inProgress") },
    { id: "completed", label: t("taskFilterCompleted") },
  ] as const;
  const priorities = { low: t("taskPriorityLow"), medium: t("taskPriorityMedium"), high: t("taskPriorityHigh") };
  return (
    <div className="border-t border-line">
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_150px_96px] gap-4 border-b border-line py-4 text-sm text-muted lg:grid">
        <span>{t("taskColumnTitle")}</span>
        <span>{t("taskColumnPriority")}</span>
        <span>{t("taskColumnDue")}</span>
        <span className="sr-only">{t("taskColumnActions")}</span>
      </div>
      {groups.map((group) => {
        const rows = tasks.filter((task) => task.status === group.id);
        return (
          <details
            key={group.id}
            open={group.id !== "completed"}
            className="border-b border-line py-4"
          >
            <summary className="min-h-11 cursor-pointer text-lg font-bold text-ink">
              <h2 className="inline">
                {group.label} · {rows.length}
              </h2>
            </summary>
            {rows.length ? (
              <ul className="divide-y divide-line">
                {rows.map((task) => (
                  <li
                    key={task.id}
                    className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_120px_150px_96px] lg:items-center lg:gap-4"
                  >
                    <div className="min-w-0">
                      <h3 className="break-words font-medium text-ink">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="mt-1 break-words text-sm text-muted">
                          {task.description}
                        </p>
                      )}
                      <select
                      aria-label={t("taskMoveAria").replace("{title}", task.title)}
                        value={task.status}
                        onChange={(event) =>
                          onStatusChange(
                            task.id,
                            event.target.value as Task["status"],
                          )
                        }
                        className={cn(
                          selectClassName,
                          "mt-3 min-h-11 w-auto max-w-full",
                        )}
                      >
                        {groups.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p
                      className={`text-sm ${task.priority === "high" ? "text-danger" : task.priority === "medium" ? "text-warning" : "text-muted"}`}
                    >
                      {priorities[task.priority] || t("taskPriorityMedium")}
                    </p>
                    <p className="text-sm text-muted">
                      {task.due_date ? (
                        <time dateTime={task.due_date}>
                          {new Date(
                            task.due_date.length === 10
                              ? `${task.due_date}T12:00:00`
                              : task.due_date,
                          ).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </time>
                      ) : (
                        t("taskNoDueDate")
                      )}
                    </p>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        className="min-h-11 min-w-11 px-2"
                        aria-label={`${t("taskEditAria")} ${task.title}`}
                        onClick={() => onEditTask(task)}
                      >
                        <PencilSquareIcon
                          className="h-5 w-5"
                          aria-hidden="true"
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-11 min-w-11 px-2 text-danger"
                        aria-label={`${t("taskDeleteAria")} ${task.title}`}
                        onClick={() => onDeleteTask(task)}
                      >
                        <TrashIcon className="h-5 w-5" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-5 text-sm text-muted">
                {t("taskNoStatusItems")}
              </p>
            )}
          </details>
        );
      })}
    </div>
  );
}
