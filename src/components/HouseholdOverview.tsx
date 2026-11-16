import { ArrowUpRight, ChevronDown, Settings, Users, Flag } from "lucide-react";
import type { Task } from "@/App";
import { Button } from "./ui/button";
import { getHouseholdOverview } from "@/lib/household-overview";
import logo from "@/assets/logo.svg";
import thumbsUp from "@/assets/sticker-thumbsup.svg";

type Props = {
  tasks: Task[];
  members: Record<string, string>;
  workspaceName: string | null;
  ready: boolean;
  onSettings: () => void;
};

export function HouseholdOverview({ tasks, members, workspaceName, ready, onSettings }: Props) {
  const summary = getHouseholdOverview(tasks, members);
  const names = Object.entries(members);
  return (
    <section className="household-overview w-full" aria-label="Household overview">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="" className="h-9 w-9 shrink-0" />
          <span className="text-sm font-bold text-foreground">honeydew, please.</span>
        </div>
        <Button variant="ghost" size="icon" onClick={onSettings} aria-label="Open settings" title="Settings" className="shrink-0 text-muted-foreground"><Settings /></Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-6">
        <Button variant="ghost" onClick={onSettings} title="Manage or switch workspaces" className="max-w-full justify-start px-0 hover:bg-transparent text-muted-foreground">
          <Users /><span className="truncate">{workspaceName || (ready ? "Your space" : "Your household")}</span><ChevronDown />
        </Button>
        {names.length > 0 && <div className="flex items-center -space-x-1" aria-label={names.map(([, name]) => name).join(", ")}>
          {names.slice(0, 4).map(([id, name]) => <span key={id} title={name} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-accent text-accent-foreground text-xs font-semibold">{name?.trim().slice(0, 1).toUpperCase() || "?"}</span>)}
          {names.length > 4 && <span className="pl-3 text-xs text-muted-foreground">+{names.length - 4}</span>}
        </div>}
      </div>
      <div className="flex justify-between items-center gap-4 py-5 md:py-7">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-3">A little less on your mind</p>
          <h1 className="text-3xl md:text-4xl font-semibold leading-tight text-foreground">
            {!ready ? "Room to breathe." : summary.attention ? "One thing at a time." : summary.active ? "The priorities are clear." : "Nothing on the list."}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-lg">
            {!ready ? "Your lists, together in one place." : summary.attention ? `${summary.attention} ${summary.attention === 1 ? "item needs" : "items need"} attention. The rest can take its turn.` : summary.active ? `${summary.active} ${summary.active === 1 ? "item remains" : "items remain"}, with no priority or overdue items.` : "A little space for whatever comes next."}
          </p>
        </div>
        {ready && summary.attention === 0 && <img src={thumbsUp} alt="" className="relief-sticker h-20 w-20 md:h-28 md:w-28 shrink-0" />}
      </div>
      {ready && <div className="grid grid-cols-2 border-y border-border py-3 gap-4">
        <div className="flex items-center gap-3"><Flag className="h-4 w-4 text-attention shrink-0" /><div><p className="text-sm font-medium">Needs attention <span className="text-muted-foreground ml-1">{summary.attention}</span></p><p className="text-xs text-muted-foreground mt-1">Priority & overdue</p></div></div>
        <div className="flex items-center gap-3"><ArrowUpRight className="h-4 w-4 text-shopping shrink-0" /><div><p className="text-sm font-medium">In good hands <span className="text-muted-foreground ml-1">{summary.assigned}</span></p><p className="text-xs text-muted-foreground mt-1">Assigned to your people</p></div></div>
      </div>}
    </section>
  );
}