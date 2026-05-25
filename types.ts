export interface AppUser {
  id: string;
  username: string;
  password: string;
  nombre: string;
  role: 'admin' | 'general';
  permissions?: string[]; // granular permissions for general users
}

export interface ServiceTypeMeta {
  type: string;
  monthlyGoal: number;
  active: boolean;
  renuencias?: number;
}

export interface ProcessingStats {
  totalActivities: number;
  totalPatients: number;
  topCupsCode: string;
  topCupsName: string;
  topCupsCount: number;
  topPatientId: string;
  topPatientName: string;
  topPatientCount: number;
}

export interface RipsRecord {
  cups: string;
  paciente: string;
  tipo: string;
  nombre: string;
  fecha: string;
}

export interface UserRecord {
  id: string;
  sexo: string;
  fnac: string;
  nombre: string;
}

export interface MaestroCupItem {
  cups: string;
  tipo: string;
  nombre: string;
}

export interface ChartDataPoint {
  name: string;
  meta: number;
  ejecutado: number;
  cumplimiento: number;
  color: string;
}

export interface RankingCupsItem {
  CUPS: string;
  Nombre: string;
  TipoSer: string;
  Cantidad: number;
  PacienteTop: string;
  PacienteTop_Cant: number;
  PacienteTop_Nombre: string;
  PacienteTop_Sexo: string;
  PacienteTop_Edad: string;
  PacienteTop_GrupoEtario: string;
  PacienteTop_Fechas: string; // Nuevo campo
}

export interface RankingPatientItem {
  PacienteId: string;
  Nombre: string;
  Sexo: string;
  Edad: string;
  GrupoEtario: string;
  TotalAtenciones: number;
  ListaCUPS: string[]; // Cambio a Array para exactitud
  ListaFechas: string[]; // Cambio a Array para exactitud
}

export interface DuplicateItem {
  id: string;
  paciente: string;
  nombre_paciente: string;
  cups: string;
  nombre_cups: string;
  fecha: string;
  repeticiones: number;
}

export interface Prestador {
  id: string;
  nombre: string;
  nit: string;
  departamento: string;
  municipio: string;
  contrato: string;
  vigencia: string;
  regimen: string;
  repLegalIPS: string;
  metas: ServiceTypeMeta[];
}

export interface CustomCupsEntry {
  cups: string;
  nombre: string;
  tipo: string;
}

export interface ActaServicio {
  tipo: string;
  programado: number;
  ejecutado: number;
}

export interface Renuncia {
  id: string;
  prestadorId: string;
  nit: string;
  contrato: string;
  regimen: string;
  periodoEvaluado: string;       // "Enero 2025", "Febrero 2025", etc.
  fechaRegistro: string;         // ISO date del registro
  numeroCaso: string;            // Número interno de radicado
  documentoPaciente: string;     // Cédula / TI / RC del paciente
  nombrePaciente: string;
  tipoServicio: string;          // Tipo de servicio al que renuncia (CONSULTA MÉDICA, etc.)
  motivoRenuncia: string;        // VOLUNTARIA | NO ASISTIÓ | TRASLADO | FALLECIMIENTO | OTRO
  observaciones: string;
  estadoGestion: string;         // PENDIENTE | EN GESTIÓN | CERRADA
  responsable: string;           // Funcionario que registra
  createdAt: string;
}

export interface Acta {
  id: string;
  numero: string;
  prestadorId: string;
  empresa: string;
  nit: string;
  lugar: string;
  municipio: string;
  departamento: string;
  contrato: string;
  regimen: string;
  periodoEvaluado: string;
  vigencia: string;
  coordinador: string;
  funcionario: string;
  fechaActa: string;
  puntosTratar: string;
  objetivo: string;
  desarrolloYConclusiones: string;
  desarrolloConclusionesPost: string;
  servicios: ActaServicio[];
  observaciones: string;
  repLegalIPS: string;
  repLegalEPS: string;
  createdAt: string;
}