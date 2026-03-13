import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Application } from "@shared/schema";
import { insertApplicationSchema, STATUS_OPTIONS } from "@shared/schema";
import { STATUS_CLASS, needsFollowUp, daysSince } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Download, Search, ExternalLink, Pencil, Trash2, AlertTriangle, MapPin,
  CalendarDays, FileText, ChevronDown
} from "lucide-react";

const formSchema = insertApplicationSchema.extend({
  company: z.string().min(1, "L'entreprise est requise"),
  position: z.string().min(1, "Le poste est requis"),
  appliedDate: z.string().min(1, "La date est requise"),
});
type FormValues = z.infer<typeof formSchema>;

const today = () => new Date().toISOString().split("T")[0];

const defaultValues: Partial<FormValues> = {
  company: "",
  position: "",
  location: "",
  contractType: "",
  salary: "",
  offerUrl: "",
  contactName: "",
  contactEmail: "",
  status: "En attente",
  appliedDate: today(),
  notes: "",
};

export default function Applications() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: apps, isLoading } = useQuery<Application[]>({ queryKey: ["/api/applications"] });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest("POST", "/api/applications", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setDialogOpen(false);
      form.reset(defaultValues);
      toast({ title: "Candidature ajoutée" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FormValues> }) =>
      apiRequest("PATCH", `/api/applications/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setDialogOpen(false);
      setEditApp(null);
      form.reset(defaultValues);
      toast({ title: "Candidature mise à jour" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/applications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      setDeleteId(null);
      toast({ title: "Candidature supprimée", variant: "destructive" });
    },
  });

  // Quick status update
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/applications/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    },
  });

  function openNew() {
    setEditApp(null);
    form.reset({ ...defaultValues, appliedDate: today() });
    setDialogOpen(true);
  }

  function openEdit(a: Application) {
    setEditApp(a);
    form.reset({
      company: a.company,
      position: a.position,
      location: a.location ?? "",
      contractType: a.contractType ?? "",
      salary: a.salary ?? "",
      offerUrl: a.offerUrl ?? "",
      contactName: a.contactName ?? "",
      contactEmail: a.contactEmail ?? "",
      status: a.status,
      appliedDate: a.appliedDate,
      notes: a.notes ?? "",
    });
    setDialogOpen(true);
  }

  function onSubmit(values: FormValues) {
    if (editApp) {
      updateMutation.mutate({ id: editApp.id, data: values });
    } else {
      createMutation.mutate(values);
    }
  }

  function handleExportCSV() {
    fetch("/api/applications/export/csv")
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "candidatures.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const filtered = (apps ?? []).filter((a) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      a.company.toLowerCase().includes(q) ||
      a.position.toLowerCase().includes(q) ||
      (a.location ?? "").toLowerCase().includes(q);
    const matchesStatus = filterStatus === "all" || a.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes candidatures</h1>
          <p className="text-sm text-muted-foreground">
            {apps?.length ?? 0} candidature{(apps?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-1.5" />
            Exporter CSV
          </Button>
          <Button size="sm" onClick={openNew} data-testid="button-new-application">
            <Plus className="h-4 w-4 mr-1.5" />
            Nouvelle candidature
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            data-testid="input-search"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44" data-testid="select-filter-status">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {apps?.length === 0
              ? "Aucune candidature pour l'instant. Commencez par en ajouter une !"
              : "Aucun résultat pour ces filtres."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((a) => {
            const followup = needsFollowUp(a);
            const days = daysSince(a.appliedDate);
            return (
              <Card
                key={a.id}
                data-testid={`card-application-${a.id}`}
                className={`hover-elevate transition-all ${followup ? "border-amber-500/40" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-semibold text-sm text-foreground truncate">{a.company}</h3>
                            {followup && (
                              <span title="Relance recommandée">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{a.position}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {a.location && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3" />{a.location}
                              </span>
                            )}
                            {a.contractType && (
                              <span className="text-xs text-muted-foreground">{a.contractType}</span>
                            )}
                            {a.salary && (
                              <span className="text-xs text-muted-foreground">{a.salary}</span>
                            )}
                          </div>
                        </div>
                        {/* Right column */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASS[a.status as keyof typeof STATUS_CLASS] ?? ""}`}
                          >
                            {a.status}
                          </span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarDays className="w-3 h-3" />
                            {new Date(a.appliedDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                            <span className="ml-1">({days}j)</span>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {a.notes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-1 italic">
                          {a.notes}
                        </p>
                      )}

                      {/* Actions row */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {/* Quick status change */}
                        <Select
                          value={a.status}
                          onValueChange={(val) => statusMutation.mutate({ id: a.id, status: val })}
                        >
                          <SelectTrigger
                            className="h-7 text-xs w-36"
                            data-testid={`select-status-${a.id}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {a.offerUrl && (
                          <a
                            href={a.offerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            data-testid={`link-offer-${a.id}`}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Offre
                          </a>
                        )}

                        <div className="flex gap-1 ml-auto">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(a)}
                            className="h-7 w-7"
                            data-testid={`button-edit-${a.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(a.id)}
                            className="h-7 w-7 text-destructive"
                            data-testid={`button-delete-${a.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditApp(null); form.reset(defaultValues); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editApp ? "Modifier la candidature" : "Nouvelle candidature"}</DialogTitle>
            <DialogDescription>
              {editApp ? "Modifiez les informations de cette candidature." : "Renseignez les informations de votre nouvelle candidature."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entreprise *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex : Capgemini" {...field} data-testid="input-company" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Poste *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex : Ingénieur d'Affaires" {...field} data-testid="input-position" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Localisation</FormLabel>
                      <FormControl>
                        <Input placeholder="Paris, Bordeaux..." {...field} data-testid="input-location" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contractType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de contrat</FormLabel>
                      <FormControl>
                        <Input placeholder="CDI, CDD, Freelance..." {...field} data-testid="input-contract" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="salary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salaire</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex : 45-55k€" {...field} data-testid="input-salary" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="appliedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de candidature *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-applied-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="input-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="offerUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lien de l'offre</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} data-testid="input-offer-url" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact</FormLabel>
                      <FormControl>
                        <Input placeholder="Prénom Nom" {...field} data-testid="input-contact-name" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email contact</FormLabel>
                      <FormControl>
                        <Input placeholder="rh@entreprise.com" {...field} data-testid="input-contact-email" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Détails sur le poste, infos recruteur, résultats entretien..."
                        rows={3}
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setDialogOpen(false); setEditApp(null); form.reset(defaultValues); }}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-application"
                >
                  {editApp ? "Enregistrer" : "Ajouter"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette candidature ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
