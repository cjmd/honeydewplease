import { Home, ListChecks, ShoppingCart, StickyNote, Archive } from "lucide-react";
import type { ViewType } from "@/App";
import { Button } from "./ui/button";

const tabs = [
  { id: "home", label: "Home", icon: Home, color: "text-foreground" },
  { id: "todos", label: "To-dos", icon: ListChecks, color: "text-todo" },
  { id: "shopping", label: "Shopping", icon: ShoppingCart, color: "text-shopping" },
  { id: "notes", label: "Notes", icon: StickyNote, color: "text-note" },
  { id: "archive", label: "Archive", icon: Archive, color: "text-archive" },
] as const;

export function AppNavigation({ view, onChange }: { view: ViewType; onChange: (view: ViewType) => void }) {
  const index = tabs.findIndex((tab) => tab.id === view);
  return <nav aria-label="Main navigation" className="app-navigation">
    <span aria-hidden="true" className="nav-pill" style={{ transform: `translateX(${index * 100}%)` }} />
    {tabs.map(({ id, label, icon: Icon, color }) => <Button key={id} variant="ghost" aria-current={view === id ? "page" : undefined} onClick={() => onChange(id)} className={`relative h-full min-w-0 flex-col gap-1 px-0 hover:bg-transparent ${view === id ? color : "text-muted-foreground"}`}>
      <Icon className="h-5 w-5" /><span className="text-[11px] leading-none whitespace-nowrap">{label}</span>
    </Button>)}
  </nav>;
}