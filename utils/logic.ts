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

// Mapa personalizado CUPS → Tipo de Servicio (tiene prioridad sobre el Maestro CUPS)
const CUPS_MAP_RAW: [string, string[]][] = [
  ["CONSULTA EXTERNA Y/O MEDICINA GENERAL", [
    "890201","890301","890501","890401","890209",
    "890309","890105","890112","890114","890101"
  ]],
  ["ODONTOLOGIA GENERAL", [
    "890203","890303","890103","990203","990112","990212","890703",
    "230103","230101","230102","230203","230201","230202","232104",
    "232101","232102","232103","232200","972200","232401","232402",
    "237301","237304","237305","241101","241102","241103","243201",
    "275201","275202","997105","870114","870440","870450","870451",
    "870452","870453","870454","870455","870456","870460"
  ]],
  ["ENFERMERIA", [
    "890205","890305","890605"
  ]],
  ["LABORATORIO CLINICO B y M", [
    // Asistencial
    "901001","901003","901101","901107","901232","901235","901236",
    "901237","901304","901305","901326","902204","902207","902208",
    "902210","902211","902216","902213","902214","902220","902221",
    "903801","903802","903809","903815","903816","903818","903822",
    "903895","903876","903840","903841","903842","903843","903844",
    "903845","903886","903862","903856","903857","903868","904508",
    "906215","906219","906220","906221","906222","906223","906225",
    "906249","906915",
    "907002","907003","907005","907008","907009","907106","911015","911016",
    // Especialidades
    "901002","A32117","901102","901206","901210","901213","901217",
    "902010","902011","902045","902047","902048","902049","902121",
    "902205","902206","902217","902218","902219","902223","902224",
    "903016","903426","903427","903436","903437","903438","903439",
    "903604","903605","903612","903613",
    "903805","903806","903810","903811","903812","903817","903819",
    "903820","903821","903823","903824","903828","903829","903835",
    "903836","903846","903854","903855","903859","903860","903861",
    "903863","903864","903865","903866","903867",
    "904004","904101","904103","904104","904105","904106","904107",
    "904108","904109","904201","904202","904203","904204",
    "904902","904904","904905","904906","904911","904912","904913",
    "904914","904920","904921","904922","904924","904925",
    "906001","906002","906040","906050",
    "906127","906128","906129","906130","906131","906132",
    "906207","906208","906211","906212","906213","906214","906216",
    "906217","906224","906241","906242","906243","906244","906245",
    "906246","906247","906248","906317","906318","906406",
    "906440","906441","906442","906458","906459","906460",
    "906462","906463","906464","906465",
    "906602","906603","906604","906605","906606","906610","906611","906625",
    "906810","906812","906826","906828","906831","906833","906834",
    "906835","906836","906858",
    "906905","906906","906907","906908","906910","906911","906913","906914",
    "907001","907004","907010","907011","907101","907102",
    "911001","911002","911003","911004","911007","911008","911009",
    "911010","911017","911018","911019","911020"
  ]],
  ["IMAGENOLOGIA BASICA (Rx)", [
    "870001","870003","870004","870101","870102","870103","870104",
    "870105","870107","870108","870112","870113","870131","871010",
    "871020","871030","871040","871050","871091","871111","871112",
    "871121","871129","872002","873111","873121","873122","873204",
    "873205","873206","873210","873313","873333","873335","873340",
    "873420","873423","873310","881401","881402","881332","883312",
    "881306","881302"
  ]],
  ["GINECOLOGIA", [
    "890250","890350"
  ]],
  ["MEDICINA INTERNA", [
    "890266","890366"
  ]],
  ["TAB", [
    "601T01","601T02","601T03","602T01","602T02","603T01"
  ]],
  ["URGENCIAS BC", [
    "5DS002"
  ]],
  ["HOSP BAJA COMPLEJIDAD", [
    "130B01","129B01","130B021"
  ]],
  ["PEDIATRIA", [
    "890283","890383","890483"
  ]],
  ["PSICOLOGIA", [
    "890208","890308"
  ]],
  ["NUTRICION", [
    "890206","890306"
  ]],
];

export const CUPS_TIPO_MAP: Record<string, string> = {};
for (const [tipo, codigos] of CUPS_MAP_RAW) {
  for (const c of codigos) {
    CUPS_TIPO_MAP[c] = tipo;
  }
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
  "MEDICAMENTOS",
  "PEDIATRIA",
  "PSICOLOGIA",
  "NUTRICION"
];

export const TIPOS_ASISTENCIAL = [
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
  "MEDICAMENTOS",
];

export const TIPOS_ESPECIALIDADES = [
  "LABORATORIO CLINICO B y M",
  "PEDIATRIA",
  "GINECOLOGIA",
  "MEDICINA INTERNA",
  "NUTRICION",
  "PSICOLOGIA",
];

export const TIPOS_CAPITA_AMPLIADA = [
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
  "MEDICAMENTOS",
  "PEDIATRIA",
  "NUTRICION",
  "PSICOLOGIA",
];
