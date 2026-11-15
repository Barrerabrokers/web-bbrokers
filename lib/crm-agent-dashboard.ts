import { resolveAgentScope } from "./crm-agent-report";

export function dashboardScope(actor: { id: string; role: string }, requested?: string | null) {
  return resolveAgentScope(actor, requested || actor.id);
}
export type DashboardContact = {
  id: string; name: string; project: string; status: string; temperature: string;
  owner: string; lastActivity: string; nextTask: string | null; nextTitle: string | null;
};
export type DashboardTask = { id: string; leadId: string; name: string; title: string; at: string; owner: string };
export type DashboardMeeting = { id: string; leadId: string | null; name: string; title: string; at: string; owner: string };
export type AgentDashboard = {
  generatedAt: string; today: string; scope: string | null;
  agents: { id: string; name: string; active: boolean }[];
  pipeline: { status: string; count: number }[];
  contacts: DashboardContact[]; tasks: DashboardTask[]; meetings: DashboardMeeting[];
  counts: { total: number; active: number; hot: number; withoutTask: number; tasksToday: number; overdue: number; meetingsToday: number; sold: number; completedMeetings: number };
};
