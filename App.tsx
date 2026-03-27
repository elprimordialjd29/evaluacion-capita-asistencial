import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList, Legend
} from 'recharts';
import { 
  Upload, FileText, Database, Trash2, Save, Download, 
  Activity, Users, TrendingUp, AlertTriangle, CheckCircle, Server,
  BarChart3, UserCheck, FileJson, Sun, Moon, ChevronLeft, ChevronRight, Calendar, Stethoscope, FileSpreadsheet, FileWarning, X, Scissors, Search
} from 'lucide-react';
import { 
  normalizeId, parseDateFromLine, TIPOS_SERVICIOS_DEFAULT, 
  edadDetallada, grupoEtarioDesdeFN 
} from './utils/logic';
import { 
  ServiceTypeMeta, RipsRecord, UserRecord, MaestroCupItem, 
  ProcessingStats, ChartDataPoint, RankingCupsItem, RankingPatientItem, DuplicateItem 
} from './types';
import { StorageService } from './services/storageService';

function App() {
  // --- State ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  const [scale, setScale] = useState<number>(1);
  const [metas, setMetas] = useState<ServiceTypeMeta[]>(
    TIPOS_SERVICIOS_DEFAULT.map(t => ({ type: t, monthlyGoal: 0, active: true }))
  );
  
  const [registros, setRegistros] = useState<RipsRecord[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<Map<string, UserRecord>>(new Map());
  const [maestro, setMaestro] = useState<Map<string, MaestroCupItem>>(new Map());
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  
  // Modal State
  const [showDuplicates, setShowDuplicates] = useState(false);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");

  // File Selection State
  const [ripsFileNames, setRipsFileNames] = useState<string[]>([]);
  const [cupsFileName, setCupsFileName] = useState<string>('');

  // Pagination State
  const [pagePat, setPagePat] = useState(1);
  const [pageCup, setPageCup] = useState(1);
  const [pageRips, setPageRips] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // --- Theme Effect ---
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // --- Persistence ---
  useEffect(() => {
    const initData = async () => {
      try {
        // Load Config
        const config = await StorageService.getConfig();
        if (config) {
          if (config.metas && config.metas.length > 0) {
            // Merge: keep saved goals, add any new default types missing from saved config
            const savedMap = new Map(config.metas.map((m: ServiceTypeMeta) => [m.type, m]));
            const merged = TIPOS_SERVICIOS_DEFAULT.map(t =>
              savedMap.get(t) ?? { type: t, monthlyGoal: 0, active: true }
            );
            setMetas(merged);
          }
          if (config.scale) setScale(config.scale);
        }

        // Load Session
        const session = await StorageService.loadSessionData();
        if (session) {
          setRegistros(session.registros);
          // Rehydrate Map
          const uMap = new Map<string, UserRecord>();
          session.usuarios.forEach(u => uMap.set(u.id, u));
          setUsuariosMap(uMap);
          setMessage({ type: 'info', text: 'Datos restaurados (Servidor/Local).' });
        }
      } catch (error) {
        console.error("Error initializing data:", error);
      }
    };
    initData();
  }, []);

  // Reset pagination when data changes
  useEffect(() => {
    setPagePat(1);
    setPageCup(1);
    setPageRips(1);
  }, [registros]);

  // Reset Rips pagination on search
  useEffect(() => {
    setPageRips(1);
  }, [searchTerm]);

  // Auto-dismiss non-error messages after 5s
  useEffect(() => {
    if (message && message.type !== 'error') {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Save config when changed
  useEffect(() => {
    const timer = setTimeout(() => {
      StorageService.saveConfig(metas, scale);
    }, 1000);
    return () => clearTimeout(timer);
  }, [metas, scale]);

  // --- Handlers ---

  const handleClearData = async () => {
    if (confirm('¿Estás seguro de eliminar todos los datos? Esta acción no se puede deshacer.')) {
      setRegistros([]);
      setUsuariosMap(new Map());
      await StorageService.clearData();
      setMessage({ type: 'success', text: 'Base de datos limpia correctamente.' });
    }
  };

  const handleSaveSession = async () => {
    if (registros.length === 0) {
      setMessage({ type: 'error', text: 'No hay datos para guardar.' });
      return;
    }
    setIsSaving(true);
    try {
      const success = await StorageService.saveSessionData(registros, Array.from(usuariosMap.values()));
      if (success) setMessage({ type: 'success', text: 'Datos sincronizados con éxito.' });
      else setMessage({ type: 'error', text: 'Error guardando datos (Revise conexión o tamaño).' });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Duplicate Management ---

  const handleRemoveDuplicate = (dupId: string) => {
    // dupId format: "paciente|cups|fecha"
    const [pat, cup, date] = dupId.split('|');
    let keptOne = false;
    let removedCount = 0;

    const newRegistros = registros.filter(r => {
      // Is this the duplicate type we are targeting?
      if (r.paciente === pat && r.cups === cup && r.fecha === date) {
        if (!keptOne) {
          keptOne = true; // Keep the first one found
          return true;
        } else {
          removedCount++; // Remove subsequent matches
          return false;
        }
      }
      return true; // Keep unrelated records
    });

    setRegistros(newRegistros);
    setMessage({ type: 'success', text: `Se eliminaron ${removedCount} copias excedentes.` });
  };

  const handleRemoveAllDuplicates = () => {
    if (!confirm("¿Está seguro de eliminar TODOS los registros duplicados? Esta acción dejará solo 1 registro único por cada combinación de Paciente+CUPS+Fecha.")) return;

    const seen = new Set<string>();
    let removedCount = 0;

    const newRegistros = registros.filter(r => {
      const key = `${r.paciente}|${r.cups}|${r.fecha}`;
      if (seen.has(key)) {
        removedCount++;
        return false;
      }
      seen.add(key);
      return true;
    });

    setRegistros(newRegistros);
    setMessage({ type: 'success', text: `Limpieza masiva completada. Se eliminaron ${removedCount} registros duplicados.` });
    setShowDuplicates(false);
  };


  const processFiles = async (ripsFiles: FileList | null, cupsFile: File | null) => {
    if (!ripsFiles || ripsFiles.length === 0 || !cupsFile) {
      setMessage({ type: 'error', text: 'Seleccione archivos RIPS (.txt) y el Maestro CUPS (.xlsx).' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // 1. Process Maestro
      const cupsMap = new Map<string, MaestroCupItem>();
      const cupsBuffer = await cupsFile.arrayBuffer();
      const wb = read(cupsBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = utils.sheet_to_json(ws, { defval: "" });
      
      rows.forEach(x => {
        const c = String(x["CUPS VIGENTE"] || "").trim();
        if (c) {
          cupsMap.set(c, {
            cups: c,
            tipo: String(x["Tipo Ser"] || "").trim(),
            nombre: String(x["NOMBRE CUPS"] || "").trim()
          });
        }
      });
      setMaestro(cupsMap);

      // 2. Process RIPS
      const newRegistros: RipsRecord[] = [];
      const newUsuariosMap = new Map<string, UserRecord>(usuariosMap); 

      // Fallback para detectar sección por nombre de archivo
      const getSectionFromFilename = (name: string) => {
        const n = name.toUpperCase();
        if (n.startsWith("US")) return "USUARIOS";
        if (n.startsWith("AC") || n.startsWith("AP") || n.startsWith("AM") || n.startsWith("AT")) return "SERVICIOS"; // Generic
        return "";
      };

      for (let i = 0; i < ripsFiles.length; i++) {
        const file = ripsFiles[i];
        const txt = await file.text();
        const lines = txt.split(/\r?\n/);
        
        let section = getSectionFromFilename(file.name);

        for (const raw of lines) {
          const l = raw.trim();
          if (!l) continue;

          const upperLine = l.toUpperCase();
          
          // --- Detección de Sección por Encabezado ---
          if (upperLine.includes("USUARIOS") && (upperLine.includes("*") || upperLine.includes("°") || upperLine.includes("-"))) {
             section = "USUARIOS";
             continue;
          }
          if (upperLine.includes("CONSULTAS") || upperLine.includes("PROCEDIMIENTOS") || upperLine.includes("MEDICAMENTOS") || upperLine.includes("OTROS SERVICIOS")) {
             section = "SERVICIOS"; 
             continue;
          }

          // --- Detección Inteligente de Separador ---
          let parts: string[] = [];
          
          if (l.includes(',') && (l.match(/,/g) || []).length >= 3) {
             parts = l.split(',').map(x => x.trim().replace(/[|]$/, '')); 
          } else if (l.includes('|')) {
             parts = l.split('|').map(x => x.trim());
          } else {
             continue;
          }

          if (parts.length < 2) continue;

          // --- Heurística de Contenido ---
          if (section !== "USUARIOS") {
            const hasDate = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(l);
            const hasSex = /\b(M|F)\b/i.test(l);
            if (hasDate && hasSex) {
              section = "USUARIOS";
            }
          }

          // --- Procesar USUARIOS ---
          if (section.includes("USUARIOS")) {
             let idCand = parts[1];
             if (!idCand || !/^\d+$/.test(idCand)) {
                idCand = parts.find(p => /^(?:CC|TI|RC|CE|PA|PE|CN|MS)?-?\d{3,20}$/i.test(p)) || "";
             }

             const id = normalizeId(idCand);
             if (!id || id.length < 3) continue;

             const sexo = (parts.find(p => /^(M|F)$/i.test(p)) || "").toUpperCase();
             const fnac = (parts.find(p => /^\d{4}-\d{2}-\d{2}$/.test(p) || /^\d{2}\/\d{2}\/\d{4}$/.test(p)) || "");
             
             const posiblesNombre = parts.filter(p => /[A-Za-zÁÉÍÓÚÑ]/.test(p) && !/^(M|F)$/i.test(p) && !/^\d+$/.test(p) && p.length > 2);
             const nombre = posiblesNombre.slice(0, 4).join(" ");

             const prev = newUsuariosMap.get(id) || { id, sexo: "", fnac: "", nombre: "" };
             newUsuariosMap.set(id, {
               id,
               sexo: sexo || prev.sexo,
               fnac: fnac || prev.fnac,
               nombre: nombre || prev.nombre
             });
             continue;
          }

          // --- Procesar SERVICIOS ---
          const mC = l.match(/\b\d{6}\b/);
          if (!mC) continue;
          const cups = mC[0];
          
          if (!cupsMap.has(cups)) continue;

          const mP = l.match(/\b(?:CC|TI|RC|CE|PA|PE|CN|MS)-?\d{4,15}\b|\b\d{6,15}\b/);
          const pacienteRaw = mP ? mP[0] : "SIN_ID";
          const paciente = normalizeId(pacienteRaw) || "SIN_ID";

          const info = cupsMap.get(cups)!;
          const fecha = parseDateFromLine(l);

          newRegistros.push({
            cups,
            paciente,
            tipo: info.tipo,
            nombre: info.nombre,
            fecha
          });
        }
      }

      setRegistros(newRegistros);
      setUsuariosMap(newUsuariosMap);
      setMessage({ type: 'success', text: `Procesado: ${newRegistros.length} registros y ${newUsuariosMap.size} pacientes.` });

    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Error en formato de archivos.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Calculations ---

  const { stats, chartData, rankingCUPS, rankingPacientes, duplicatesList } = useMemo(() => {
    // Filter active services
    const activeTypes = new Set(metas.filter(m => m.active).map(m => m.type));
    const filteredRegistros = registros.filter(r => activeTypes.has(r.tipo));

    // Stats
    const totalActivities = filteredRegistros.length;
    
    // Counts & Tracking
    const typeCount: Record<string, number> = {};
    const cupsCount: Record<string, {count: number, name: string, type: string}> = {};
    const cupsPacCount: Record<string, Record<string, number>> = {};
    const pacCount: Record<string, number> = {};
    const pacMeta: Record<string, { dates: string[], cups: string[] }> = {};
    const cupsPacDates: Record<string, Record<string, Set<string>>> = {};

    // Duplicates Tracking
    const duplicateMap = new Map<string, { count: number, record: RipsRecord }>();

    filteredRegistros.forEach(r => {
      // 1. Detect Duplicates
      const dupKey = `${r.paciente}|${r.cups}|${r.fecha}`;
      const currDup = duplicateMap.get(dupKey);
      if (currDup) {
        currDup.count++;
      } else {
        duplicateMap.set(dupKey, { count: 1, record: r });
      }

      // 2. Type Aggregation
      typeCount[r.tipo] = (typeCount[r.tipo] || 0) + 1;

      // 3. CUPS Aggregation
      if (!cupsCount[r.cups]) cupsCount[r.cups] = { count: 0, name: r.nombre, type: r.tipo };
      cupsCount[r.cups].count++;

      // 4. CUPS Patient Aggregation
      if(!cupsPacCount[r.cups]) cupsPacCount[r.cups] = {};
      cupsPacCount[r.cups][r.paciente] = (cupsPacCount[r.cups][r.paciente] || 0) + 1;

      if(!cupsPacDates[r.cups]) cupsPacDates[r.cups] = {};
      if(!cupsPacDates[r.cups][r.paciente]) cupsPacDates[r.cups][r.paciente] = new Set();
      cupsPacDates[r.cups][r.paciente].add(r.fecha);

      // 5. Patient Aggregation
      pacCount[r.paciente] = (pacCount[r.paciente] || 0) + 1;
      
      if(!pacMeta[r.paciente]) pacMeta[r.paciente] = { dates: [], cups: [] };
      pacMeta[r.paciente].dates.push(r.fecha);
      pacMeta[r.paciente].cups.push(r.cups);
    });

    // Process Duplicates List
    const duplicatesList: DuplicateItem[] = [];
    duplicateMap.forEach((val, key) => {
      if (val.count > 1) {
        const u = usuariosMap.get(val.record.paciente);
        duplicatesList.push({
          id: key,
          paciente: val.record.paciente,
          nombre_paciente: u?.nombre || "NO REGISTRADO",
          cups: val.record.cups,
          nombre_cups: val.record.nombre,
          fecha: val.record.fecha,
          repeticiones: val.count
        });
      }
    });

    // Chart Data Preparation
    const chartData: ChartDataPoint[] = metas
      .filter(m => m.active)
      .map(m => {
        const ejecutado = typeCount[m.type] || 0;
        const totalMeta = m.monthlyGoal * scale;
        let pct = totalMeta > 0 ? Math.round((ejecutado / totalMeta) * 100) : 0;
        const capPct = pct > 100 ? 100 : pct;

        let color = "#ef4444"; 
        if (capPct >= 80) color = "#eab308"; 
        if (capPct >= 100) color = "#10b981"; 

        return {
          name: m.type,
          meta: totalMeta,
          ejecutado,
          cumplimiento: capPct,
          color
        };
      });

    // Ranking CUPS
    const rankingCUPS: RankingCupsItem[] = Object.entries(cupsCount)
      .map(([code, info]) => {
        const pacs = cupsPacCount[code] || {};
        const topPacEntry = Object.entries(pacs).sort((a,b) => b[1] - a[1])[0];
        const topPid = topPacEntry ? topPacEntry[0] : "";
        const topCnt = topPacEntry ? topPacEntry[1] : 0;
        
        const user = usuariosMap.get(topPid);
        const fn = user?.fnac || "";
        const datesSet = cupsPacDates[code]?.[topPid] || new Set();
        const datesStr = Array.from(datesSet).sort().join(", ");

        return {
          CUPS: code,
          Nombre: info.name,
          TipoSer: info.type,
          Cantidad: info.count,
          PacienteTop: topPid,
          PacienteTop_Cant: topCnt,
          PacienteTop_Nombre: user?.nombre || "",
          PacienteTop_Sexo: user?.sexo || "",
          PacienteTop_Edad: edadDetallada(fn),
          PacienteTop_GrupoEtario: grupoEtarioDesdeFN(fn),
          PacienteTop_Fechas: datesStr
        };
      })
      .sort((a, b) => b.Cantidad - a.Cantidad);

    // Ranking Pacientes
    const rankingPacientes: RankingPatientItem[] = Object.entries(pacCount)
      .map(([pid, count]) => {
        const user = usuariosMap.get(pid);
        const fn = user?.fnac || "";
        const pMeta = pacMeta[pid] || { cups: [], dates: [] };
        
        return {
          PacienteId: pid,
          Nombre: user?.nombre || "NO REGISTRADO",
          Sexo: user?.sexo || "-",
          Edad: edadDetallada(fn) || "-",
          GrupoEtario: grupoEtarioDesdeFN(fn) || "-",
          TotalAtenciones: count,
          ListaCUPS: pMeta.cups,
          ListaFechas: pMeta.dates
        };
      })
      .sort((a, b) => b.TotalAtenciones - a.TotalAtenciones);

    const topCup = rankingCUPS[0];
    const topPat = rankingPacientes[0];

    const stats: ProcessingStats = {
      totalActivities,
      totalPatients: usuariosMap.size,
      topCupsCode: topCup?.CUPS || "—",
      topCupsName: topCup?.Nombre || "",
      topCupsCount: topCup?.Cantidad || 0,
      topPatientId: topPat?.PacienteId || "—",
      topPatientName: topPat?.Nombre || "",
      topPatientCount: topPat?.TotalAtenciones || 0
    };

    return { stats, chartData, rankingCUPS, rankingPacientes, duplicatesList };

  }, [registros, metas, scale, usuariosMap]);

  // --- Search Logic for Raw Rips ---
  const filteredRawRips = useMemo(() => {
    if (!searchTerm) return registros;
    const lower = searchTerm.toLowerCase();
    return registros.filter(r => 
      r.cups.toLowerCase().includes(lower) || 
      r.nombre.toLowerCase().includes(lower) || 
      r.tipo.toLowerCase().includes(lower) ||
      r.paciente.toLowerCase().includes(lower)
    );
  }, [registros, searchTerm]);

  // --- Pagination Logic ---
  const totalPagesPat = Math.ceil(rankingPacientes.length / ITEMS_PER_PAGE);
  const currentPatData = rankingPacientes.slice((pagePat - 1) * ITEMS_PER_PAGE, pagePat * ITEMS_PER_PAGE);

  const totalPagesCup = Math.ceil(rankingCUPS.length / ITEMS_PER_PAGE);
  const currentCupData = rankingCUPS.slice((pageCup - 1) * ITEMS_PER_PAGE, pageCup * ITEMS_PER_PAGE);

  const totalPagesRips = Math.ceil(filteredRawRips.length / ITEMS_PER_PAGE);
  const currentRipsData = filteredRawRips.slice((pageRips - 1) * ITEMS_PER_PAGE, pageRips * ITEMS_PER_PAGE);

  // --- Helper for Charts ---
  const formatXAxis = (tickItem: string) => {
    if (!tickItem) return '';
    return tickItem.length > 18 ? `${tickItem.substring(0, 18)}...` : tickItem;
  };
  
  // Theme helpers for charts
  const chartColors = theme === 'dark' 
    ? { text: '#94a3b8', grid: '#1e293b', tooltipBg: '#0f172a', tooltipBorder: '#334155', tooltipText: '#f1f5f9' }
    : { text: '#64748b', grid: '#e2e8f0', tooltipBg: '#ffffff', tooltipBorder: '#cbd5e1', tooltipText: '#1e293b' };


  // --- Exports ---
  const handleExportGlobal = () => {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(chartData), "Metas_vs_Ejecutado");
    utils.book_append_sheet(wb, utils.json_to_sheet(rankingCUPS), "Ranking_CUPS");
    
    const exportPat = rankingPacientes.map(p => ({
      ...p,
      ListaCUPS: p.ListaCUPS.join("\n"),
      ListaFechas: p.ListaFechas.join("\n")
    }));
    utils.book_append_sheet(wb, utils.json_to_sheet(exportPat), "Ranking_Pacientes");
    writeFile(wb, "Reporte_Global_Auditoria.xlsx");
  };

  const handleExportRankingPacientes = () => {
    const wb = utils.book_new();
    const exportPat = rankingPacientes.map(p => ({
        ...p,
        ListaCUPS: p.ListaCUPS.join("\n"), 
        ListaFechas: p.ListaFechas.join("\n")
    }));
    utils.book_append_sheet(wb, utils.json_to_sheet(exportPat), "Ranking_Pacientes");
    writeFile(wb, "Ranking_Pacientes.xlsx");
  };

  const handleExportRankingCUPS = () => {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(rankingCUPS), "Ranking_CUPS");
    writeFile(wb, "Ranking_CUPS.xlsx");
  };

  const handleExportDuplicates = () => {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(duplicatesList), "Duplicados");
    writeFile(wb, "Auditoria_Duplicados.xlsx");
  };

  const handleExportRipsOrganizados = () => {
    const wb = utils.book_new();

    const usuariosData = Array.from(usuariosMap.values()).map((u: UserRecord) => ({
      Numero_Identificacion: u.id,
      Nombre_Completo: u.nombre,
      Sexo: u.sexo,
      Fecha_Nacimiento: u.fnac,
      Edad: edadDetallada(u.fnac),
      Grupo_Etario: grupoEtarioDesdeFN(u.fnac)
    }));
    utils.book_append_sheet(wb, utils.json_to_sheet(usuariosData), "USUARIOS");

    const consultas: any[] = [];
    const procedimientos: any[] = [];
    const otros: any[] = [];

    registros.forEach(r => {
      const row = {
        Numero_Identificacion: r.paciente,
        Fecha_Servicio: r.fecha,
        Codigo_CUPS: r.cups,
        Nombre_Procedimiento: r.nombre,
        Tipo_Servicio_Maestro: r.tipo
      };

      const t = r.tipo.toUpperCase();
      if (t.includes("CONSULTA") || t.includes("MEDICINA GENERAL") || t.includes("ESPECIALIZADA") || t.includes("URGENCIA")) {
        consultas.push(row);
      } else if (t.includes("LABORATORIO") || t.includes("IMAGEN") || t.includes("ODONTOLOGIA") || t.includes("PROCEDIMIENTO") || t.includes("QUIRURGICO") || t.includes("APOYO")) {
        procedimientos.push(row);
      } else {
        otros.push(row);
      }
    });

    if(consultas.length > 0) utils.book_append_sheet(wb, utils.json_to_sheet(consultas), "CONSULTAS");
    if(procedimientos.length > 0) utils.book_append_sheet(wb, utils.json_to_sheet(procedimientos), "PROCEDIMIENTOS");
    if(otros.length > 0) utils.book_append_sheet(wb, utils.json_to_sheet(otros), "OTROS_SERVICIOS");

    writeFile(wb, "RIPS_Consolidado_Organizado.xlsx");
  };

  return (
    <div className="min-h-screen pb-20 font-sans transition-colors duration-300">
      {/* Header Glassmorphism */}
      <header className="sticky top-0 z-50 glass-panel shadow-lg dark:shadow-2xl">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
              <Activity className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              Evaluación Cápita Asistencia
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Análisis inteligente de prestación de servicios</p>
              {registros.length > 0 && (
                <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/30">
                  {registros.length.toLocaleString()} registros
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
              title={theme === 'dark' ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden md:block"></div>
            <button 
              onClick={handleSaveSession}
              disabled={isSaving}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md ${isSaving ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-wait' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-95'}`}
            >
              {isSaving ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"/> : <Server className="h-4 w-4" />}
              <span>{isSaving ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
            <button 
              onClick={handleClearData}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-500/30 rounded-lg text-sm font-medium transition-all shadow-sm hover:shadow active:scale-95"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Messages */}
        {message && (
          <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 shadow-md ${
            message.type === 'error' ? 'bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-500/20' : 
            message.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/20' :
            'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-500/20'
          }`}>
            {message.type === 'error' ? <AlertTriangle className="h-5 w-5 flex-shrink-0" /> : <CheckCircle className="h-5 w-5 flex-shrink-0" />}
            <span className="text-sm font-medium flex-1">{message.text}</span>
            <button onClick={() => setMessage(null)} className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0 ml-2">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* --- Top Control Panel --- */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          
          {/* Metas Config */}
          <section className="glass-panel rounded-2xl p-6 shadow-xl relative overflow-hidden group transition-all">
            {/* ... Metas content remains ... */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -z-10 group-hover:bg-purple-500/10 transition-colors"></div>
            
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500 dark:text-purple-400" /> Metas y Periodo
              </h2>
              <div className="relative">
                <select 
                  value={scale} 
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm pl-3 pr-8 py-1.5 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 outline-none transition-all cursor-pointer hover:border-slate-300 dark:hover:border-slate-600"
                >
                  <option value="1">Mensual (x1)</option>
                  <option value="2">Bimestral (x2)</option>
                  <option value="3">Trimestral (x3)</option>
                  <option value="6">Semestral (x6)</option>
                  <option value="12">Anual (x12)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500 dark:text-slate-400">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>
            
            <div className="max-h-[220px] overflow-y-auto pr-2 custom-scroll">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100/80 dark:bg-slate-900/40 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-3 py-2 rounded-l-lg">On</th>
                    <th className="px-3 py-2">Servicio</th>
                    <th className="px-3 py-2 text-right">Meta Mes</th>
                    <th className="px-3 py-2 text-right rounded-r-lg">Progreso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                  {metas.map((m, idx) => (
                    <tr key={idx} className="group/row hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5 text-center">
                        <input 
                          type="checkbox" 
                          checked={m.active} 
                          onChange={(e) => {
                            const nm = [...metas];
                            nm[idx].active = e.target.checked;
                            setMetas(nm);
                          }}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-500 focus:ring-offset-0 focus:ring-purple-500/30 cursor-pointer" 
                        />
                      </td>
                      <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 text-xs font-medium group-hover/row:text-slate-900 dark:group-hover/row:text-white transition-colors">{m.type}</td>
                      <td className="px-3 py-2.5 text-right">
                        <input 
                          type="number" 
                          value={m.monthlyGoal} 
                          onChange={(e) => {
                            const nm = [...metas];
                            nm[idx].monthlyGoal = Number(e.target.value);
                            setMetas(nm);
                          }}
                          className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-right text-xs font-mono text-emerald-600 dark:text-emerald-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                        />
                      </td>
                      <td className="px-3 py-2.5 min-w-[90px]">
                        {(() => {
                          const d = chartData.find(c => c.name === m.type);
                          if (!d || d.meta === 0) return <span className="text-[10px] text-slate-400 dark:text-slate-600">—</span>;
                          return (
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 min-w-[36px]">
                                <div className="h-1.5 rounded-full transition-all duration-500" style={{width: `${d.cumplimiento}%`, backgroundColor: d.color}} />
                              </div>
                              <span className="text-[10px] font-mono font-bold" style={{color: d.color}}>{d.cumplimiento}%</span>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Upload Panel */}
          <section className="glass-panel rounded-2xl p-6 shadow-xl flex flex-col relative overflow-hidden transition-all">
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-5">
              <Database className="h-5 w-5 text-blue-500 dark:text-blue-400" /> Carga de Datos
            </h2>
            
            <form 
              className="flex-1 flex flex-col gap-6 justify-between"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const rFiles = (form.elements.namedItem('rips') as HTMLInputElement).files;
                const cFile = (form.elements.namedItem('cups') as HTMLInputElement).files?.[0] || null;
                processFiles(rFiles, cFile);
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Archivos RIPS (.txt)
                  </label>
                  <div className="relative group">
                    <input name="rips" type="file" multiple accept=".txt" className="hidden" id="file-rips" onChange={(e) => { const files = Array.from(e.target.files || []); setRipsFileNames(files.map(f => f.name)); }} />
                    <label
                      htmlFor="file-rips"
                      className={`flex flex-col items-center justify-center w-full h-24 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${ripsFileNames.length > 0 ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/5' : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-transparent hover:border-blue-500 dark:hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]'}`}
                    >
                      {ripsFileNames.length > 0 ? (
                        <>
                          <CheckCircle className="h-6 w-6 text-blue-500 mb-1" />
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold text-center">{ripsFileNames.length} archivo{ripsFileNames.length > 1 ? 's' : ''} listo{ripsFileNames.length > 1 ? 's' : ''}</span>
                        </>
                      ) : (
                        <>
                          <FileText className="h-8 w-8 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors mb-2" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-300">Seleccionar TXT</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Maestro CUPS (.xlsx)
                  </label>
                  <div className="relative group">
                    <input name="cups" type="file" accept=".xlsx" className="hidden" id="file-cups" onChange={(e) => { setCupsFileName(e.target.files?.[0]?.name || ''); }} />
                    <label
                      htmlFor="file-cups"
                      className={`flex flex-col items-center justify-center w-full h-24 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${cupsFileName ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5' : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-transparent hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]'}`}
                    >
                      {cupsFileName ? (
                        <>
                          <CheckCircle className="h-6 w-6 text-emerald-500 mb-1" />
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center leading-tight truncate w-full px-2">{cupsFileName}</span>
                        </>
                      ) : (
                        <>
                          <FileJson className="h-8 w-8 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors mb-2" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-300">Seleccionar Excel</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-auto">
                <div className="col-span-2 flex flex-col gap-1">
                   <button 
                    type="submit" 
                    disabled={isProcessing}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-4 w-4" /> Procesar Data
                      </>
                    )}
                  </button>
                </div>

                 <div className="flex flex-col gap-1">
                  <button 
                    type="button"
                    onClick={handleExportRipsOrganizados}
                    disabled={registros.length === 0}
                    className="w-full py-2.5 px-4 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-500/30 hover:text-emerald-900 dark:hover:text-emerald-100 disabled:opacity-50 transition-all shadow-sm hover:shadow active:scale-95 flex justify-center items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> RIPS Excel
                  </button>
                   <span className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-medium truncate">Segmentado</span>
                </div>

                <div className="flex flex-col gap-1">
                  <button 
                    type="button"
                    onClick={handleExportGlobal}
                    disabled={registros.length === 0}
                    className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 transition-all shadow-sm hover:shadow active:scale-95 flex justify-center items-center gap-2"
                  >
                    <Download className="h-4 w-4" /> Global
                  </button>
                   <span className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-medium truncate">Ranking/KPI</span>
                </div>

                {duplicatesList.length > 0 && (
                   <div className="col-span-2 flex flex-col gap-1 mt-1">
                    <button 
                      type="button"
                      onClick={() => setShowDuplicates(true)}
                      className="w-full py-2.5 px-4 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 rounded-xl hover:bg-amber-200 dark:hover:bg-amber-500/30 hover:text-amber-900 dark:hover:text-amber-100 disabled:opacity-50 transition-all shadow-sm hover:shadow active:scale-95 flex justify-center items-center gap-2"
                    >
                      <FileWarning className="h-4 w-4" /> Auditoría Duplicados ({duplicatesList.length})
                    </button>
                  </div>
                )}
              </div>
            </form>
          </section>
        </div>

        {/* --- KPI Cards --- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <KpiCard 
            label="Actividades Totales" 
            value={stats.totalActivities.toLocaleString()} 
            icon={<Activity className="h-6 w-6 text-blue-500 dark:text-blue-400" />}
            trend="global"
            color="blue"
          />
          <KpiCard 
            label="Total Usuarios" 
            value={stats.totalPatients.toLocaleString()} 
            icon={<UserCheck className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />} 
            trend="distinct"
            color="emerald"
          />
          <KpiCard 
            label="CUPS Más Frecuente" 
            value={stats.topCupsName || stats.topCupsCode} 
            sub={`${stats.topCupsCode} • ${stats.topCupsCount} usos`}
            icon={<BarChart3 className="h-6 w-6 text-purple-500 dark:text-purple-400" />} 
            trend="top"
            color="purple"
          />
           <KpiCard 
            label="Paciente Mayor Uso" 
            value={stats.topPatientId} 
            sub={stats.topPatientName ? `${stats.topPatientCount} atenciones` : ""}
            icon={<Users className="h-6 w-6 text-orange-500 dark:text-orange-400" />} 
            trend="user"
            color="orange"
          />
        </section>

        {/* --- Empty State --- */}
        {registros.length === 0 && (
          <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-5 border-2 border-dashed border-slate-300 dark:border-slate-700/70 animate-in fade-in duration-500">
            <div className="p-4 bg-indigo-100 dark:bg-indigo-500/10 rounded-full">
              <Activity className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">Sin datos cargados</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">Sigue los pasos para comenzar el análisis de RIPS</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-1 text-sm">
              <div className="flex items-center gap-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 px-4 py-3 rounded-xl border border-blue-200 dark:border-blue-500/20">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                Configura las metas mensuales
              </div>
              <div className="flex items-center gap-2.5 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 px-4 py-3 rounded-xl border border-purple-200 dark:border-purple-500/20">
                <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                Carga archivos RIPS + Maestro CUPS
              </div>
              <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                Analiza KPIs y genera reportes
              </div>
            </div>
          </div>
        )}

        {/* --- Charts --- */}
        {registros.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="glass-panel rounded-2xl p-6 shadow-xl h-[550px]">
              <h3 className="text-slate-800 dark:text-slate-100 font-bold mb-6 text-sm flex items-center gap-2">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div> Producción (Cantidad)
              </h3>
              <div className="h-[450px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke={chartColors.text}
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={100}
                      tickFormatter={formatXAxis}
                    />
                    <YAxis stroke={chartColors.text} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '8px', color: chartColors.tooltipText, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      cursor={{fill: chartColors.grid, opacity: 0.5}}
                    />
                    <Legend verticalAlign="top" height={36}/>
                    <Bar dataKey="ejecutado" name="Ejecutado (Real)" fill="#10b981" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="ejecutado" position="top" fill={theme === 'dark' ? "#ffffff" : "#0f172a"} fontSize={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 shadow-xl h-[550px]">
              <h3 className="text-slate-800 dark:text-slate-100 font-bold mb-6 text-sm flex items-center gap-2">
                <div className="w-1 h-4 bg-emerald-500 rounded-full"></div> % Cumplimiento (Tope 100%)
              </h3>
              <div className="h-[450px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke={chartColors.text}
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={100} 
                      tickFormatter={formatXAxis}
                    />
                    <YAxis domain={[0, 100]} stroke={chartColors.text} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '8px', color: chartColors.tooltipText }}
                      cursor={{fill: chartColors.grid, opacity: 0.5}}
                      formatter={(val: number) => `${val}%`}
                    />
                    <Legend verticalAlign="top" height={36} payload={[
                      { value: 'Crítico (<80%)', type: 'rect', color: '#ef4444' },
                      { value: 'Alerta (80-99%)', type: 'rect', color: '#eab308' },
                      { value: 'Cumplido (100%)', type: 'rect', color: '#10b981' }
                    ]}/>
                    <ReferenceLine y={80} stroke="#eab308" strokeDasharray="3 3" />
                    <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" />
                    <Bar dataKey="cumplimiento" name="%" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList dataKey="cumplimiento" position="top" formatter={(val: number) => `${val}%`} fill={theme === 'dark' ? "#ffffff" : "#0f172a"} fontSize={10} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* --- Tables --- */}
        {registros.length > 0 && (
          <div className="grid grid-cols-1 2xl:grid-cols-5 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            
            {/* Ranking Pacientes (Full Width Enhanced) */}
            <div className="2xl:col-span-3 glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center flex-shrink-0">
                <h3 className="text-slate-800 dark:text-slate-100 font-bold text-base flex items-center gap-2">
                  <div className="p-1.5 bg-orange-500/10 rounded-lg">
                    <Users className="h-5 w-5 text-orange-500 dark:text-orange-400" />
                  </div>
                  Ranking de Usuarios
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">Total: {rankingPacientes.length}</span>
                  <button 
                    onClick={handleExportRankingPacientes}
                    className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-all border border-emerald-200 dark:border-emerald-500/20 shadow-sm"
                    title="Descargar Ranking Pacientes"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="overflow-auto custom-scroll flex-1">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100/90 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                    <tr>
                      <th className="p-4 font-semibold w-12 text-center">#</th>
                      <th className="p-4 font-semibold">Paciente</th>
                      <th className="p-4 font-semibold">Nombre Completo</th>
                      <th className="p-4 font-semibold text-center w-20">Sexo</th>
                      <th className="p-4 font-semibold text-center w-24">Edad</th>
                      <th className="p-4 font-semibold">Grupo Etario</th>
                      <th className="p-4 font-semibold text-right">Total</th>
                      <th className="p-4 font-semibold">Historial (CUPS y Fechas)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50 text-sm">
                    {currentPatData.map((item, i) => (
                      <tr key={i} className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors duration-150">
                        <td className="p-4 text-center text-slate-500 dark:text-slate-600 group-hover:text-slate-700 dark:group-hover:text-slate-400">{(pagePat - 1) * ITEMS_PER_PAGE + i + 1}</td>
                        <td className="p-4 font-mono text-orange-600 dark:text-orange-300 font-medium">{item.PacienteId}</td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[200px]">
                          {item.Nombre}
                        </td>
                        <td className="p-4 text-center text-slate-500 dark:text-slate-400">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.Sexo === 'F' ? 'bg-pink-100 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400' : item.Sexo === 'M' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                            {item.Sexo}
                          </span>
                        </td>
                        <td className="p-4 text-center text-slate-600 dark:text-slate-400">{item.Edad}</td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 text-xs">{item.GrupoEtario}</td>
                        <td className="p-4 text-right">
                          <span className="inline-block min-w-[30px] text-center bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                            {item.TotalAtenciones}
                          </span>
                        </td>
                        <td className="p-4">
                           <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto custom-scroll pr-2">
                             <div className="flex items-start gap-1">
                               <Stethoscope className="w-3 h-3 mt-0.5 text-blue-500 flex-shrink-0"/>
                               <span className="font-mono text-xs text-slate-600 dark:text-slate-300 break-all leading-tight">
                                 {item.ListaCUPS.map((cup, idx) => (
                                   <span key={idx}>{idx > 0 && " | "}{cup}</span>
                                 ))}
                               </span>
                             </div>
                             <div className="flex items-start gap-1">
                               <Calendar className="w-3 h-3 mt-0.5 text-emerald-500 flex-shrink-0"/>
                               <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                                  {item.ListaFechas.map((date, idx) => (
                                   <span key={idx}>{idx > 0 && " | "}{date}</span>
                                 ))}
                               </span>
                             </div>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center flex-shrink-0">
                <button 
                  onClick={() => setPagePat(p => Math.max(1, p - 1))}
                  disabled={pagePat === 1}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Página {pagePat} de {totalPagesPat}
                </span>
                <button 
                  onClick={() => setPagePat(p => Math.min(totalPagesPat, p + 1))}
                  disabled={pagePat === totalPagesPat}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Ranking CUPS */}
            <div className="2xl:col-span-2 glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[650px]">
              <div className="p-5 border-b border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center flex-shrink-0">
                 <h3 className="text-slate-800 dark:text-slate-100 font-bold text-base flex items-center gap-2">
                  <div className="p-1.5 bg-purple-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                  </div>
                  Ranking CUPS
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">Total: {rankingCUPS.length}</span>
                   <button 
                    onClick={handleExportRankingCUPS}
                    className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/20 transition-all border border-emerald-200 dark:border-emerald-500/20 shadow-sm"
                    title="Descargar Ranking CUPS"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-auto custom-scroll p-0 flex-1">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-100/90 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="p-4 w-12 text-center">#</th>
                      <th className="p-4 w-32">Código</th>
                      <th className="p-4">Nombre Procedimiento</th>
                      <th className="p-4">Tipo Servicio</th>
                      <th className="p-4 text-right">Cantidad</th>
                      <th className="p-4 text-right">Top Paciente (ID y Fechas)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                    {currentCupData.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 text-center text-slate-500 dark:text-slate-600">{(pageCup - 1) * ITEMS_PER_PAGE + i + 1}</td>
                        <td className="p-4 font-mono text-purple-600 dark:text-purple-300">{item.CUPS}</td>
                        <td className="p-4 text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={item.Nombre}>{item.Nombre}</td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 text-xs truncate max-w-[150px]" title={item.TipoSer}>{item.TipoSer}</td>
                        <td className="p-4 text-right font-bold text-slate-900 dark:text-white">{item.Cantidad}</td>
                        <td className="p-4 text-right">
                           <div className="flex flex-col items-end">
                             <div className="font-mono text-slate-700 dark:text-slate-300 font-medium">{item.PacienteTop || "-"}</div>
                             {item.PacienteTop_Cant > 0 && <div className="text-slate-500 dark:text-slate-500 text-xs mb-1">({item.PacienteTop_Cant} atenciones)</div>}
                             {item.PacienteTop_Fechas && (
                               <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono max-w-[120px] text-right leading-tight">
                                 {item.PacienteTop_Fechas}
                               </div>
                             )}
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center flex-shrink-0">
                <button 
                  onClick={() => setPageCup(p => Math.max(1, p - 1))}
                  disabled={pageCup === 1}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Página {pageCup} de {totalPagesCup}
                </span>
                <button 
                  onClick={() => setPageCup(p => Math.min(totalPagesCup, p + 1))}
                  disabled={pageCup === totalPagesCup}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

          </div>
        )}

        {/* --- Raw RIPS Detail Table --- */}
        {registros.length > 0 && (
          <div className="glass-panel rounded-2xl overflow-hidden shadow-xl flex flex-col mt-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
             <div className="p-5 border-b border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col md:flex-row justify-between items-center gap-4">
                <h3 className="text-slate-800 dark:text-slate-100 font-bold text-base flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                  </div>
                  Detalle General de RIPS Cargados
                </h3>
                
                <div className="relative w-full md:w-96">
                   <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Search className="w-4 h-4 text-slate-400" />
                   </div>
                   <input 
                      type="text"
                      placeholder="Buscar por CUPS, Nombre, Tipo Servicio..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full p-2 pl-10 text-sm text-slate-900 border border-slate-300 rounded-lg bg-slate-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:placeholder-slate-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 transition-all"
                   />
                </div>
             </div>

             <div className="overflow-x-auto custom-scroll">
               <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-100/90 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                     <tr>
                        <th className="p-4 font-semibold w-16 text-center">#</th>
                        <th className="p-4 font-semibold w-32">Fecha</th>
                        <th className="p-4 font-semibold w-32">Paciente</th>
                        <th className="p-4 font-semibold w-32">Código CUPS</th>
                        <th className="p-4 font-semibold">Nombre Procedimiento</th>
                        <th className="p-4 font-semibold">Tipo Servicio</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                     {currentRipsData.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                           <td className="p-4 text-center text-slate-400 text-xs">
                             {(pageRips - 1) * ITEMS_PER_PAGE + idx + 1}
                           </td>
                           <td className="p-4 font-mono text-slate-600 dark:text-slate-400">{r.fecha}</td>
                           <td className="p-4 font-mono font-medium text-orange-600 dark:text-orange-300">{r.paciente}</td>
                           <td className="p-4 font-mono text-purple-600 dark:text-purple-300">{r.cups}</td>
                           <td className="p-4 truncate max-w-[250px]" title={r.nombre}>{r.nombre}</td>
                           <td className="p-4 text-xs">
                              <span className={`px-2 py-1 rounded-md border font-medium ${getTipoBadgeClass(r.tipo)}`}>
                                {r.tipo}
                              </span>
                           </td>
                        </tr>
                     ))}
                     {currentRipsData.length === 0 && (
                        <tr>
                           <td colSpan={6} className="p-8 text-center text-slate-500">
                              No se encontraron registros que coincidan con la búsqueda.
                           </td>
                        </tr>
                     )}
                  </tbody>
               </table>
             </div>

             {/* Pagination for Rips Table */}
             <div className="p-3 border-t border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/30 flex justify-between items-center">
                <button 
                  onClick={() => setPageRips(p => Math.max(1, p - 1))}
                  disabled={pageRips === 1}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  Página {pageRips} de {totalPagesRips || 1}
                </span>
                <button 
                  onClick={() => setPageRips(p => Math.min(totalPagesRips, p + 1))}
                  disabled={pageRips === totalPagesRips || totalPagesRips === 0}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
             </div>
          </div>
        )}

      </main>

      {/* --- Duplicates Modal --- */}
      {showDuplicates && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <FileWarning className="text-amber-500 h-6 w-6" /> Auditoría de Duplicados
              </h2>
              <div className="flex gap-2">
                 <button 
                  onClick={handleRemoveAllDuplicates}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors mr-2"
                >
                  <Scissors className="h-4 w-4" /> Limpieza Masiva
                </button>

                 <button 
                  onClick={handleExportDuplicates}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
                >
                  <Download className="h-4 w-4" /> Excel
                </button>
                <button onClick={() => setShowDuplicates(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto custom-scroll p-0">
               <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-100/90 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                    <tr>
                       <th className="p-4">Paciente</th>
                       <th className="p-4">CUPS</th>
                       <th className="p-4">Fecha</th>
                       <th className="p-4 text-center">Repeticiones</th>
                       <th className="p-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                    {duplicatesList.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-4">
                          <div className="font-mono font-bold">{d.paciente}</div>
                          <div className="text-xs text-slate-500">{d.nombre_paciente}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-mono text-purple-600 dark:text-purple-400">{d.cups}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[250px]">{d.nombre_cups}</div>
                        </td>
                        <td className="p-4 font-mono">{d.fecha}</td>
                        <td className="p-4 text-center font-bold text-red-500">{d.repeticiones}</td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleRemoveDuplicate(d.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors text-xs font-bold"
                            title="Eliminar excedentes (dejar 1)"
                          >
                             Dejar Único
                          </button>
                        </td>
                      </tr>
                    ))}
                    {duplicatesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          <div className="flex flex-col items-center gap-2">
                            <CheckCircle className="h-8 w-8 text-emerald-500" />
                            <p>No se encontraron atenciones duplicadas exactas.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
               </table>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl">
               <p className="text-xs text-slate-500 text-center">
                 * Se consideran duplicados: Mismo Documento + Mismo Código CUPS + Misma Fecha de Servicio.
               </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTipoBadgeClass(tipo: string): string {
  const t = tipo.toUpperCase();
  if (t.includes('CONSULTA') || t.includes('MEDICINA GENERAL')) return 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20';
  if (t.includes('ODONTOLOG')) return 'bg-pink-100 dark:bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/20';
  if (t.includes('ENFERMERIA')) return 'bg-sky-100 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/20';
  if (t.includes('LABORATORIO')) return 'bg-cyan-100 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/20';
  if (t.includes('IMAGENOLOG') || t.includes('RX')) return 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20';
  if (t.includes('GINECOLOG')) return 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/20';
  if (t.includes('MEDICINA INTERNA')) return 'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-500/20';
  if (t.includes('TAB') || t.includes('TRANSPORTE')) return 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/20';
  if (t.includes('URGENCIA')) return 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/20';
  if (t.includes('HOSP') || t.includes('HOSPITALIZ')) return 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20';
  if (t.includes('MEDICAMENTO')) return 'bg-teal-100 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/20';
  return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
}

function KpiCard({ label, value, sub, icon, color, trend }: { label: string, value: string | number, sub?: string, icon: React.ReactNode, color: string, trend: string }) {
  const colorConfig: Record<string, { border: string; accent: string; iconBg: string }> = {
    blue:    { border: 'border-blue-200 dark:border-blue-500/20',       accent: 'bg-blue-500',    iconBg: 'bg-blue-100 dark:bg-blue-500/10' },
    emerald: { border: 'border-emerald-200 dark:border-emerald-500/20', accent: 'bg-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-500/10' },
    purple:  { border: 'border-purple-200 dark:border-purple-500/20',   accent: 'bg-purple-500',  iconBg: 'bg-purple-100 dark:bg-purple-500/10' },
    orange:  { border: 'border-orange-200 dark:border-orange-500/20',   accent: 'bg-orange-500',  iconBg: 'bg-orange-100 dark:bg-orange-500/10' },
  };
  const cfg = colorConfig[color] || colorConfig.blue;

  const valStr = String(value);
  const len = valStr.length;
  let textClass = "text-3xl truncate";
  if (len > 12 && len <= 25) textClass = "text-lg leading-tight line-clamp-2";
  else if (len > 25) textClass = "text-sm leading-tight line-clamp-3";

  return (
    <div className={`glass-panel rounded-2xl shadow-lg transition-all duration-300 hover:-translate-y-1 ${cfg.border} flex flex-col h-full min-h-[160px] overflow-hidden`}>
      <div className={`h-1 w-full ${cfg.accent} opacity-80`} />
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
          <div className={`p-2 rounded-lg ${cfg.iconBg} flex-shrink-0 ml-2`}>
            {icon}
          </div>
        </div>
        <div className="flex-1 flex items-center">
          <div className={`font-bold text-slate-800 dark:text-white tracking-tight w-full ${textClass}`} title={valStr}>
            {value}
          </div>
        </div>
        {sub && <div className="text-xs text-slate-500 mt-2 font-medium border-t border-slate-200 dark:border-slate-800/50 pt-2 w-full truncate">{sub}</div>}
      </div>
    </div>
  );
}

export default App;