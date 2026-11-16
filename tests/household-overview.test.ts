import { describe, expect, test } from "bun:test";
import { getHouseholdOverview } from "../src/lib/household-overview";
import type { Task } from "../src/App";

const task = (updates: Partial<Task> = {}): Task => ({ id: "one", title: "Milk", details: null, completed: false, type: "shopping", isPriority: false, tags: [], dueDate: null, order: 0, createdAt: 0, updatedAt: 0, ...updates });
describe("read-only household overview", () => {
  test("priorities and overdue items need attention, completed items do not", () => {
    expect(getHouseholdOverview([task({ isPriority: true }), task({ dueDate: "2026-11-15" }), task({ completed: true, isPriority: true }), task({ dueDate: "2026-11-18" })], {}, Date.parse("2026-11-16")).attention).toBe(2);
  });
  test("no priorities does not mean all tasks are finished", () => {
    expect(getHouseholdOverview([task()], {})).toEqual({ active: 1, attention: 0, assigned: 0 });
  });
  test("only identified assignments appear as in someone's hands", () => {
    expect(getHouseholdOverview([task({ assignedTo: "member" }), task({ assignedTo: "unknown" }), task({ assignedTo: "member", completed: true })], { member: "Alex" }).assigned).toBe(1);
  });
  test("overview never mutates task data or ordering", () => {
    const tasks = [task({ order: 4 }), task({ id: "two", order: 1 })];
    const before = JSON.stringify(tasks);
    getHouseholdOverview(tasks, {});
    expect(JSON.stringify(tasks)).toBe(before);
  });
});