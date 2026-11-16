import type { Task } from "@/App";

// Presentation only: never changes the list's filter, sorting, or task state.
export function getHouseholdOverview(tasks: Task[], members: Record<string, string>, now = Date.now()) {
  const active = tasks.filter((task) => !task.completed);
  const attention = active.filter((task) => task.isPriority || (task.dueDate !== null && new Date(task.dueDate).getTime() < now));
  const assigned = active.filter((task) => !!task.assignedTo && !!members[task.assignedTo]);
  return { active: active.length, attention: attention.length, assigned: assigned.length };
}