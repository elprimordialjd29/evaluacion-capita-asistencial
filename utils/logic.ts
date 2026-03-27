// Ported Logic Functions from original HTML
export function diffDays(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

export function edadDetallada(fn: string): string {
  if (!fn) return "";
  const f = new Date(fn);
  if (isNaN(f.getTime())) return "";
  const h = new Date();
  const days = diffDays(f, h);
  if (days < 0) return "";
  if (days < 30) return days + " días";
  const months = Math.floor(days / 30.4375);
  if (months < 24) return months + " meses";
  // years + months remainder
  const years = Math.floor(months / 12);
  const remM = months % 12;
  return years + " años" + (remM ? (" " + remM + " meses") : "");
}

export function edadMeses(fn: string): number | null {
  if (!fn) return null;
  const f = new Date(fn);
  if (isNaN(f.getTime())) return null;
  const h = new Date();
  return (h.getFullYear() - f.getFullYear()) * 12 + (h.getMonth() - f.getMonth());
}

export function edadAnios(fn: string): number | null {
  if (!fn) return null;
  const f = new Date(fn);
  if (isNaN(f.getTime())) return null;
  const h = new Date();
  let e = h.getFullYear() - f.getFullYear();
  if (h.getMonth() < f.getMonth() || (h.getMonth() === f.getMonth() && h.getDate() < f.getDate())) e--;
  return e;
}

export function grupoEtarioDesdeFN(fn: string): string {
  if (!fn) return "";
  const m = edadMeses(fn);
  const a = edadAnios(fn);
  if (m === null || a === null) return "";
  if (m <= 60) return "PRIMERA INFANCIA (0m-5a)";
  if (a <= 11) return "INFANCIA (6-11)";
  if (a <= 17) return "ADOLESCENCIA (12-17)";
  if (a <= 28) return "JÓVENES (18-28)";
  if (a <= 59) return "ADULTEZ (29-59)";
  return "VEJEZ (60+)";
}

export function normalizeId(v: string | null | undefined): string {
  if (v === null || v === undefined) return "";
  let x = String(v).trim();
  // remove common prefixes like CC-, TI-, etc.
  x = x.replace(/^(CC|TI|RC|CE|PA|PE|CN|MS)[-\s]*/i, "");
  // keep alphanum
  x = x.replace(/[^0-9A-Za-z]/g, "");
  return x.toUpperCase();
}

export function parseDateFromLine(l: string): string {
  const m = l.match(/\b(\d{4}-\d{2}-\d{2})\b|\b(\d{2}\/\d{2}\/\d{4})\b/);
  if (!m) return "";
  return m[1] || m[2] || "";
}

export const TIPOS_SERVICIOS_DEFAULT = [
  "CONSULTA EXTERNA Y/O MEDICINA GENERAL",
  "ODONTOLOGIA GENERAL",
  "ENFERMERIA",
  "LABORATORIO CLINICO B y M",
  "IMAGENOLOGIA BASICA (Rx)",
  "GINECOLOGIA",
  "MEDICINA INTERNA",
  "TAB",
  "URGENCIAS BC",
  "HOSP BAJA COMPLEJIDAD",
  "MEDICAMENTOS"
];
