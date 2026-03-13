import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend
} from "recharts";
import type { Application } from "@shared/schema";
import { STATUS_OPTIONS, STATUS_CLASS, needsFollowUp, daysSince } from "@/lib/status";
import {
  Send, TrendingUp, Clock, AlertTriangle, CheckCircle, ArrowRight, Trophy
} from "lucide-react";

const CHART_COLORS: Record<string, string> = {
  "En attente": "#f59e0b",
  "Relancé": "#0ea5e9",
  "Entretien RH": "#a855f7",
  "Entretien Technique": "#14b8a6",
  "Offre reçue": "#22c55e",
  "Refusé": "#ef4444",
  "Abandonné": "#94a3b8",
};

export default function Dashboard() {
  const { data: apps, isLoading } = useQuery<Application[]>({ queryKey: ["/api/applications"] });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const applications = apps ?? [];

  // Stats
  const total = applications.length;
  const activeCount = applications.filter(
    (a) => !["Refusé", "Abandonné"].includes(a.status)
  ).length;
  const interviewCount = applications.filter(
    (a) => a.status === "Entretien RH" || a.status === "Entretien Technique"
  ).length;
  const offerCount = applications.filter((a) => a.status === "Offre reçue").length;
  const conversionRate = total > 0 ? Math.round((interviewCount / total) * 100) : 0;

  const toFollowUp = applications.filter(needsFollowUp);

  // Pie data by status
  const statusCounts: Record<string, number> = {};
  applications.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  });
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Bar data – last 8 weeks
  const now = new Date();
  const weekLabels: string[] = [];
  const weekCounts: number[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = new Date(now);
    start.setDate(start.getDate() - w * 7 - 6);
    const end = new Date(now);
    end.setDate(end.getDate() - w * 7);
    const label = `S${8 - w}`;
    weekLabels.push(label);
    weekCounts.push(
      applications.filter((a) => {
        const d = new Date(a.appliedDate);
        return d >= start && d <= end;
      }).length
    );
  }
  const barData = weekLabels.map((label, i) => ({ semaine: label, candidatures: weekCounts[i] }));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de votre recherche d'emploi</p>
        </div>
        <Link href="/candidatures">
          <Button data-testid="button-goto-applications" size="sm">
            Ajouter une candidature
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="kpi-total">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total envois</p>
                <p className="text-3xl font-bold text-foreground">{total}</p>
              </div>
              <Send className="w-5 h-5 text-primary mt-1 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-active">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">En cours</p>
                <p className="text-3xl font-bold text-foreground">{activeCount}</p>
              </div>
              <Clock className="w-5 h-5 text-amber-500 mt-1 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-conversion">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Taux entretiens</p>
                <p className="text-3xl font-bold text-foreground">{conversionRate}%</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-500 mt-1 shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-offers">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Offres reçues</p>
                <p className="text-3xl font-bold text-foreground">{offerCount}</p>
              </div>
              <Trophy className="w-5 h-5 text-yellow-400 mt-1 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Candidatures par semaine</CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="semaine" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v: number) => [v, "Candidatures"]}
                  />
                  <Bar dataKey="candidatures" fill="hsl(226, 71%, 50%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Répartition des statuts</CardTitle>
          </CardHeader>
          <CardContent>
            {total === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée disponible
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={CHART_COLORS[entry.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number, n: string) => [v, n]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Follow-up alerts */}
      {toFollowUp.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <CardTitle className="text-sm font-semibold">
              Relances recommandées ({toFollowUp.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {toFollowUp.map((a) => (
                <div
                  key={a.id}
                  data-testid={`followup-item-${a.id}`}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 flex-wrap"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.company}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.position}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASS[a.status as keyof typeof STATUS_CLASS]}`}>
                      {a.status}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      {daysSince(a.appliedDate)}j
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      {applications.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {applications.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  data-testid={`recent-item-${a.id}`}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-border/50 last:border-0 flex-wrap"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.company}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.position}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLASS[a.status as keyof typeof STATUS_CLASS]}`}
                    >
                      {a.status}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.appliedDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {applications.length > 5 && (
              <Link href="/candidatures">
                <Button variant="ghost" size="sm" className="mt-2 w-full text-xs">
                  Voir toutes les candidatures
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
