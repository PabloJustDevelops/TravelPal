import React, { useState } from 'react';
import { Task } from '@/lib/insforge';
import { TaskCard } from './TaskCard';
import { TrashIcon } from '@heroicons/react/24/outline';
import { selectClassName } from '@/components/ui/fieldStyles';

interface TaskBoardProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: Task['status']) => void;
}

const columns: { id: Task['status']; title: string; color: string; bg: string }[] = [
  { id: 'pending', title: 'Pendiente', color: 'border-line', bg: 'bg-surface-strong' },
  { id: 'in_progress', title: 'En Progreso', color: 'border-accent', bg: 'bg-accent-soft' },
  { id: 'completed', title: 'Completada', color: 'border-success', bg: 'bg-success/10' },
];

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  onEditTask,
  onDeleteTask,
  onStatusChange,
}) => {
  const [mobileStatus, setMobileStatus] = useState<Task['status']>('pending');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverTrash, setDragOverTrash] = useState(false);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setIsDragging(true);
    // Set drag image or effect if needed
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragOverTrash(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onStatusChange(taskId, status);
    }
  };

  const handleTrashDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTrash(true);
  };

  const handleTrashDragLeave = () => {
    setDragOverTrash(false);
  };

  const handleTrashDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        onDeleteTask(task);
      }
    }
    setDragOverTrash(false);
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Trash Zone - Visible only when dragging */}
      <div 
        className={`
          absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50
          transition-all duration-300 ease-in-out
          ${isDragging ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}
        `}
        onDragOver={handleTrashDragOver}
        onDragLeave={handleTrashDragLeave}
        onDrop={handleTrashDrop}
      >
        <div className={`
          flex items-center gap-3 px-8 py-4 rounded-full shadow-lg border-2
          backdrop-blur-sm transition-colors
          ${dragOverTrash 
            ? 'bg-danger/10 border-danger text-danger scale-110' 
            : 'bg-surface/90 border-danger/40 text-muted hover:border-danger hover:text-danger'
          }
        `}>
          <TrashIcon className={`w-8 h-8 ${dragOverTrash ? 'animate-bounce' : ''}`} />
          <span className="font-medium text-lg">Soltar para eliminar</span>
        </div>
      </div>

      <div className="mb-4 md:hidden">
        <label htmlFor="task-board-status" className="mb-1.5 block text-sm font-medium text-ink">
          Mostrar tareas por estado
        </label>
        <select
          id="task-board-status"
          aria-label="Mostrar tareas por estado"
          aria-controls={`task-column-${mobileStatus}`}
          value={mobileStatus}
          onChange={(event) => setMobileStatus(event.target.value as Task['status'])}
          className={`${selectClassName} min-h-11 w-full`}
        >
          {columns.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title} ({tasks.filter((task) => task.status === column.id).length})
            </option>
          ))}
        </select>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 pb-4 md:grid-cols-3 md:gap-6">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isMobileSelected = mobileStatus === col.id;
          
          return (
            <section
              key={col.id}
              id={`task-column-${col.id}`}
              aria-labelledby={`task-column-title-${col.id}`}
              className={`${isMobileSelected ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col rounded-xl border ${col.color} ${col.bg} p-4 transition-colors md:flex`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    col.id === 'pending' ? 'bg-muted' : 
                    col.id === 'in_progress' ? 'bg-accent' : 'bg-success'
                  }`} />
                  <h3 id={`task-column-title-${col.id}`} className="font-semibold text-ink">{col.title}</h3>
                </div>
                <span className="bg-surface px-2.5 py-0.5 rounded-full text-xs font-medium text-muted shadow-sm border border-line">
                  {colTasks.length}
                </span>
              </div>
              
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    onDragEnd={handleDragEnd}
                    className="cursor-move transform transition-transform active:scale-[1.02] active:rotate-1"
                  >
                    <TaskCard
                      task={task}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onStatusChange={onStatusChange}
                    />
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line/50 text-muted">
                    <span className="text-sm">Vacío</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
