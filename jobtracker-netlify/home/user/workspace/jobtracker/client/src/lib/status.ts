import { STATUS_OPTIONS, type ApplicationStatus } from "@shared/schema";

export { STATUS_OPTIONS };

export const STATUS_CLASS: Record<ApplicationStatus, string> = {
  "En attente": "status-en-attente",
  "Relancé": "status-relance",
  "Entretien RH": "status-entretien-rh",
  "Entretien Technique": "status-entretien-tech",
  "Offre reçue": "status-offre",
  "Refusé": "status-refuse",
  "Abandonné": "status-abandonne",
};

export const STATUS_SORT_ORDER: Record<ApplicationStatus, number> = {
  "Entretien Technique": 1,
  "Entretien RH": 2,
  "Offre reçue": 3,
  "Relancé": 4,
  "En attente": 5,
  "Abandonné": 6,
  "Refusé": 7,
};

export function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function needsFollowUp(app: { status: ApplicationStatus; appliedDate: string }): boolean {
  return (
    (app.status === "En attente" || app.status === "Relancé") &&
    daysSince(app.appliedDate) >= 10
  );
}
