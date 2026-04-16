import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList, Legend
} from 'recharts';
import {
  Upload, FileText, Database, Trash2, Save, Download,
  Activity, Users, TrendingUp, AlertTriangle, CheckCircle, Server,
  BarChart3, UserCheck, FileJson, Sun, Moon, ChevronLeft, ChevronRight, Calendar, Stethoscope, FileSpreadsheet, FileWarning, X, Scissors, Search,
  Settings, Plus, Pencil, Check, Building2, ClipboardList, LogOut, ShieldCheck, User, Lock, Eye, EyeOff, HardDrive
} from 'lucide-react';
import {
  normalizeId, parseDateFromLine, TIPOS_SERVICIOS_DEFAULT, CUPS_TIPO_MAP,
  edadDetallada, grupoEtarioDesdeFN
} from './utils/logic';
import {
  ServiceTypeMeta, RipsRecord, UserRecord, MaestroCupItem,
  ProcessingStats, ChartDataPoint, RankingCupsItem, RankingPatientItem, DuplicateItem,
  Prestador, CustomCupsEntry, Acta, ActaServicio, AppUser
} from './types';
import { StorageService } from './services/storageService';
import { CloudStorage } from './services/supabaseClient';
import ActaModal from './components/ActaModal';
import ReportesTab from './components/ReportesTab';

const MESES_NOMBRES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const DEFAULT_USERS: AppUser[] = [
  { id: '1', username: 'admin', password: 'admin123', nombre: 'Administrador', role: 'admin' },
  { id: '2', username: 'general', password: 'general123', nombre: 'Usuario General', role: 'general', permissions: ['dashboard','carga','prestadores','actas'] },
];

const ALL_PERMISSIONS = [
  { key: 'dashboard',     label: 'Dashboard',              desc: 'Ver estadísticas y gráficas generales',    icon: '📊' },
  { key: 'carga',         label: 'Carga de Datos',         desc: 'Subir y procesar archivos RIPS',           icon: '📂' },
  { key: 'prestadores',   label: 'Gestión de Prestadores', desc: 'Crear, editar y consultar prestadores',    icon: '🏥' },
  { key: 'actas',         label: 'Actas de Evaluación',    desc: 'Generar y gestionar actas',                icon: '📋' },
  { key: 'reportes',      label: 'Reportes',               desc: 'Ver y exportar reportes en Excel y PDF',   icon: '📈' },
  { key: 'mantenimiento', label: 'Mantenimiento',          desc: 'CUPS personalizados y tipos de servicio',  icon: '⚙️' },
  { key: 'usuarios',      label: 'Gestión de Usuarios',    desc: 'Crear y editar usuarios del sistema',      icon: '👥' },
];

function LoginScreen({ users, onLogin, theme }: { users: AppUser[]; onLogin: (u: AppUser) => void; theme: 'light'|'dark' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find(u => u.username === username.trim() && u.password === password);
    if (u) { onLogin(u); }
    else { setError('Usuario o contraseña incorrectos.'); }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-100'}`}>
      <div className={`w-full max-w-sm rounded-2xl shadow-2xl border p-8 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col items-center mb-8">
          {/* Logo */}
          <div className="mb-5 relative">
            <div className="absolute inset-0 rounded-3xl blur-xl opacity-60" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4)' }} />
            <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#0891b2)' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Bar chart bars */}
                <rect x="4"  y="30" width="7" height="14" rx="2.5" fill="white" fillOpacity="0.45"/>
                <rect x="14" y="22" width="7" height="22" rx="2.5" fill="white" fillOpacity="0.65"/>
                <rect x="24" y="14" width="7" height="30" rx="2.5" fill="white" fillOpacity="0.85"/>
                <rect x="34" y="6"  width="7" height="38" rx="2.5" fill="white"/>
                {/* Trend line */}
                <polyline points="7,28 17,20 27,12 37,4" stroke="white" strokeWidth="2" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                {/* Check badge */}
                <circle cx="38" cy="10" r="9" fill="#10b981"/>
                <polyline points="34,10 37,13 43,7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
          </div>
          <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Evaluación Cápita</h1>
          <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Inicia sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wide mb-1.5 block ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Usuario</label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="nombre de usuario" autoFocus autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className={`text-xs font-semibold uppercase tracking-wide mb-1.5 block ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Contraseña</label>
            <div className="relative">
              <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type={showPw ? 'text' : 'password'}
                className={`w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 ${theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="contraseña" autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <button type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-all shadow-md shadow-indigo-500/20 active:scale-[0.98]">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  // Evita guardar en Supabase durante la carga inicial
  const cloudInitialized = React.useRef(false);

  // --- State ---
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  const [scale, setScale] = useState<number>(1);
  const [metas, setMetas] = useState<ServiceTypeMeta[]>(() => {
    try {
      const saved = localStorage.getItem('rips_dashboard_metas');
      if (saved) {
        const parsed: ServiceTypeMeta[] = JSON.parse(saved);
        if (parsed.length > 0) {
          // Keep ALL saved types (including custom ones), add any missing defaults
          const savedMap = new Map(parsed.map(m => [m.type, m]));
          const defaultEntries = TIPOS_SERVICIOS_DEFAULT.map(t => savedMap.get(t) ?? { type: t, monthlyGoal: 0, active: true });
          const customEntries = parsed.filter(m => !TIPOS_SERVICIOS_DEFAULT.includes(m.type));
          return [...defaultEntries, ...customEntries];
        }
      }
    } catch { /* ignore */ }
    return TIPOS_SERVICIOS_DEFAULT.map(t => ({ type: t, monthlyGoal: 0, active: true }));
  });
  
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
  const [jsonFileNames, setJsonFileNames] = useState<string[]>([]);

  // Tab Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'mantenimiento' | 'actas' | 'reportes'>('dashboard');
  const [maintTab, setMaintTab] = useState<'prestadores' | 'cups' | 'servicios' | 'usuarios' | 'monitor'>('prestadores');

  // Mantenimiento – Prestadores  (lazy init from localStorage — avoids save-before-load race)
  const [prestadores, setPrestadores] = useState<Prestador[]>(() => {
    try { const s = localStorage.getItem('prestadores'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showPrestForm, setShowPrestForm] = useState(false);
  const [editPrest, setEditPrest] = useState<Prestador | null>(null);
  const [prestForm, setPrestForm] = useState<Omit<Prestador, 'id'>>({
    nombre: '', nit: '', departamento: '', municipio: '', contrato: '', vigencia: '', regimen: 'SUBSIDIADO', repLegalIPS: '',
    metas: []
  });

  // Mantenimiento – Custom CUPS
  const [customCupsList, setCustomCupsList] = useState<CustomCupsEntry[]>([]);
  const [editingCups, setEditingCups] = useState<string | null>(null); // cups code being edited
  const [editCupsEntry, setEditCupsEntry] = useState<CustomCupsEntry>({ cups: '', nombre: '', tipo: '' });
  const [newCupsEntry, setNewCupsEntry] = useState<CustomCupsEntry>({ cups: '', nombre: '', tipo: '' });

  // Mantenimiento – Servicios
  const [newTipoInput, setNewTipoInput] = useState('');

  // Actas  (lazy init from localStorage)
  const [actas, setActas] = useState<Acta[]>(() => {
    try { const s = localStorage.getItem('actas'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showActaModal, setShowActaModal] = useState(false);  // floating modal (from dashboard)
  const [editingActa, setEditingActa] = useState<Acta | null>(null);
  const [inlineActa, setInlineActa] = useState<Acta | null>(null); // inline editor in Actas tab
  const [selectedDashPrestador, setSelectedDashPrestador] = useState<string | null>(null);
  const [searchPrestador, setSearchPrestador] = useState('');
  const [filterContrato, setFilterContrato] = useState('');
  const [filterRegimen, setFilterRegimen] = useState('');
  const [prestSearch, setPrestSearch] = useState('');
  const [showPrestDropdown, setShowPrestDropdown] = useState(false);

  // Monitor de recursos
  const [monitorStats, setMonitorStats] = useState<{
    heapUsed: number; heapTotal: number; heapLimit: number;
    lsUsed: number; lsKeys: { key: string; size: number }[];
    storageQuota: number; storageUsage: number;
    uptime: number;
  } | null>(null);

  // Firmas y funcionarios globales (persistidos en localStorage)
  const [funcionarios, setFuncionarios] = useState<string[]>(() => {
    try { const s = localStorage.getItem('funcionarios'); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [firmasGlobales, setFirmasGlobales] = useState<{ repLegalEPSI: string; coordinador: string; lugarActa: string }>(() => {
    try { const s = localStorage.getItem('firmasGlobales'); return s ? JSON.parse(s) : { repLegalEPSI: '', coordinador: '', lugarActa: '' }; } catch { return { repLegalEPSI: '', coordinador: '', lugarActa: '' }; }
  });

  // Auth State
  const [users, setUsers] = useState<AppUser[]>(() => {
    try { const s = localStorage.getItem('appUsers'); return s ? JSON.parse(s) : DEFAULT_USERS; } catch { return DEFAULT_USERS; }
  });
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try { const s = sessionStorage.getItem('currentUser'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  // User form state (for admin user management)
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState<{ username: string; password: string; nombre: string; role: 'admin' | 'general'; permissions: string[] }>({ username: '', password: '', nombre: '', role: 'general', permissions: ['dashboard','carga','prestadores','actas'] });

  // Prestador detectado en RIPS
  const [detectedPrestadorId, setDetectedPrestadorId] = useState<string | null>(null);

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
            // Keep ALL saved types (including custom), add missing defaults
            const savedMap = new Map(config.metas.map((m: ServiceTypeMeta) => [m.type, m]));
            const defaultEntries = TIPOS_SERVICIOS_DEFAULT.map(t =>
              savedMap.get(t) ?? { type: t, monthlyGoal: 0, active: true }
            );
            const customEntries = config.metas.filter((m: ServiceTypeMeta) => !TIPOS_SERVICIOS_DEFAULT.includes(m.type));
            setMetas([...defaultEntries, ...customEntries]);
          }
          if (config.scale) setScale(config.scale);
        }

        // Load Custom CUPS
        const savedCustomCups = localStorage.getItem('customCups');
        if (savedCustomCups) setCustomCupsList(JSON.parse(savedCustomCups));

        // Siempre sincronizar desde Supabase (fuente de verdad)
        const cloudKeys = ['prestadores', 'actas', 'appUsers', 'funcionarios', 'firmasGlobales', 'customCups'];
        const cloudData = await CloudStorage.getAll(cloudKeys);
        if (cloudData['prestadores']?.length > 0) { setPrestadores(cloudData['prestadores']); localStorage.setItem('prestadores', JSON.stringify(cloudData['prestadores'])); }
        if (cloudData['actas']?.length > 0) { setActas(cloudData['actas']); localStorage.setItem('actas', JSON.stringify(cloudData['actas'])); }
        if (cloudData['appUsers']?.length > 0) { setUsers(cloudData['appUsers']); localStorage.setItem('appUsers', JSON.stringify(cloudData['appUsers'])); }
        if (cloudData['funcionarios']?.length > 0) { setFuncionarios(cloudData['funcionarios']); localStorage.setItem('funcionarios', JSON.stringify(cloudData['funcionarios'])); }
        if (cloudData['firmasGlobales'] && Object.keys(cloudData['firmasGlobales']).length > 0) { setFirmasGlobales(cloudData['firmasGlobales']); localStorage.setItem('firmasGlobales', JSON.stringify(cloudData['firmasGlobales'])); }
        if (cloudData['customCups']?.length > 0) { setCustomCupsList(cloudData['customCups']); localStorage.setItem('customCups', JSON.stringify(cloudData['customCups'])); }

        // A partir de aquí, los cambios de estado sí se guardan en Supabase
        cloudInitialized.current = true;

        // Note: prestadores and actas are loaded via lazy useState initializers above

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

  // Auto-actualizar scale según meses detectados en los RIPS cargados
  useEffect(() => {
    const monthSet = new Set<string>();
    registros.forEach(r => {
      if (r.fecha && /^\d{4}-\d{2}/.test(r.fecha)) monthSet.add(r.fecha.substring(0, 7));
    });
    const n = monthSet.size;
    if (n > 0) setScale(n);
  }, [registros]);

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

  // Auto-load acta template when switching to Actas tab
  useEffect(() => {
    if (activeTab !== 'actas') return;
    if (inlineActa) return;
    if (actas.length > 0) {
      setInlineActa({ ...actas[actas.length - 1] });
    } else {
      setInlineActa(makeBlankActa());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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

  // Monitor de recursos — actualiza cada segundo cuando la pestaña está activa
  useEffect(() => {
    const startTime = Date.now();
    const collect = async () => {
      const mem = (performance as any).memory;
      const lsKeys = Object.keys(localStorage).map(k => {
        const val = localStorage.getItem(k) || '';
        return { key: k, size: new Blob([val]).size };
      }).sort((a, b) => b.size - a.size);
      const lsUsed = lsKeys.reduce((s, k) => s + k.size, 0);
      let storageQuota = 0, storageUsage = 0;
      try {
        const est = await navigator.storage.estimate();
        storageQuota = est.quota || 0;
        storageUsage = est.usage || 0;
      } catch {}
      setMonitorStats({
        heapUsed: mem?.usedJSHeapSize || 0,
        heapTotal: mem?.totalJSHeapSize || 0,
        heapLimit: mem?.jsHeapSizeLimit || 0,
        lsUsed, lsKeys,
        storageQuota, storageUsage,
        uptime: Math.floor((Date.now() - startTime) / 1000),
      });
    };
    collect();
    const id = setInterval(collect, 1000);
    return () => clearInterval(id);
  }, []);

  // Save prestadores
  useEffect(() => {
    localStorage.setItem('prestadores', JSON.stringify(prestadores));
    if (cloudInitialized.current) CloudStorage.set('prestadores', prestadores);
  }, [prestadores]);

  // Save users
  useEffect(() => {
    localStorage.setItem('appUsers', JSON.stringify(users));
    if (cloudInitialized.current) CloudStorage.set('appUsers', users);
  }, [users]);

  // Save funcionarios y firmas globales
  useEffect(() => {
    localStorage.setItem('funcionarios', JSON.stringify(funcionarios));
    if (cloudInitialized.current) CloudStorage.set('funcionarios', funcionarios);
  }, [funcionarios]);
  useEffect(() => {
    localStorage.setItem('firmasGlobales', JSON.stringify(firmasGlobales));
    if (cloudInitialized.current) CloudStorage.set('firmasGlobales', firmasGlobales);
  }, [firmasGlobales]);

  // Save custom CUPS
  useEffect(() => {
    localStorage.setItem('customCups', JSON.stringify(customCupsList));
    if (cloudInitialized.current) CloudStorage.set('customCups', customCupsList);
  }, [customCupsList]);

  // Save actas
  useEffect(() => {
    localStorage.setItem('actas', JSON.stringify(actas));
    if (cloudInitialized.current) CloudStorage.set('actas', actas);
  }, [actas]);

  // --- Handlers ---

  const handleClearData = async () => {
    if (confirm('¿Estás seguro de eliminar todos los datos? Esta acción no se puede deshacer.')) {
      setRegistros([]);
      setUsuariosMap(new Map());
      setDetectedPrestadorId(null);
      setRipsFileNames([]);
      setJsonFileNames([]);
      // Reset file inputs
      const ripsInput = document.getElementById('file-rips') as HTMLInputElement;
      const jsonInput = document.getElementById('file-json') as HTMLInputElement;
      if (ripsInput) ripsInput.value = '';
      if (jsonInput) jsonInput.value = '';
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

    const TIPOS_SIN_DUPLICADOS_CLEAN = new Set(['MEDICAMENTOS', 'HOSP BAJA COMPLEJIDAD', 'URGENCIAS BC']);
    const seen = new Set<string>();
    let removedCount = 0;

    const newRegistros = registros.filter(r => {
      // Medicamentos, hospitalización y urgencias no se limpian por duplicados
      if (TIPOS_SIN_DUPLICADOS_CLEAN.has(r.tipo)) return true;
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


  // --- Mantenimiento Handlers ---

  const handleSavePrestador = () => {
    if (!prestForm.nombre.trim() || !prestForm.nit.trim()) {
      setMessage({ type: 'error', text: 'Nombre y NIT son obligatorios.' });
      return;
    }
    if (editPrest) {
      setPrestadores(prev => prev.map(p => p.id === editPrest.id ? { ...prestForm, id: editPrest.id } : p));
    } else {
      setPrestadores(prev => [...prev, { ...prestForm, id: Date.now().toString() }]);
    }
    setShowPrestForm(false);
    setEditPrest(null);
    setPrestForm({ nombre: '', nit: '', departamento: '', municipio: '', contrato: '', vigencia: '', regimen: 'SUBSIDIADO', metas: metas.map(m => ({ ...m })) });
    setMessage({ type: 'success', text: editPrest ? 'Prestador actualizado.' : 'Prestador creado.' });
  };

  const handleDeletePrestador = (id: string) => {
    if (confirm('¿Eliminar este prestador?')) {
      setPrestadores(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleLoadPrestadorMetas = (p: Prestador) => {
    const savedMap = new Map((p.metas || []).map(m => [m.type, m]));
    // Keep all global types, also include custom types from prestador not in globals
    const globalTypes = new Set(metas.map(m => m.type));
    const merged = metas.map(m => savedMap.get(m.type) ?? { type: m.type, monthlyGoal: 0, active: true });
    const extraFromPrestador = (p.metas || []).filter(m => !globalTypes.has(m.type));
    setMetas([...merged, ...extraFromPrestador]);
    setDetectedPrestadorId(p.id);
    setMessage({ type: 'success', text: `Metas de "${p.nombre}" cargadas.` });
  };

  const handleExportConfig = () => {
    const config = { prestadores, customCups: customCupsList };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config_evaluacion_rips.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (Array.isArray(data.prestadores)) setPrestadores(data.prestadores);
        if (Array.isArray(data.customCups)) setCustomCupsList(data.customCups);
        setMessage({ type: 'success', text: 'Configuración importada correctamente.' });
      } catch {
        setMessage({ type: 'error', text: 'Error al importar el archivo JSON.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddCustomCups = () => {
    const code = newCupsEntry.cups.toUpperCase().trim();
    if (!code || !newCupsEntry.tipo) {
      setMessage({ type: 'error', text: 'Código CUPS y Tipo de Servicio son obligatorios.' });
      return;
    }
    setCustomCupsList(prev => {
      const existing = prev.findIndex(e => e.cups === code);
      const entry: CustomCupsEntry = { ...newCupsEntry, cups: code };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = entry;
        return updated;
      }
      return [...prev, entry];
    });
    setNewCupsEntry({ cups: '', nombre: '', tipo: '' });
  };

  const handleDeleteCustomCups = (cups: string) => {
    setCustomCupsList(prev => prev.filter(e => e.cups !== cups));
  };

  const handleAddTipoServicio = () => {
    const t = newTipoInput.trim().toUpperCase();
    if (!t) return;
    if (metas.some(m => m.type === t)) {
      setMessage({ type: 'error', text: `El tipo "${t}" ya existe.` });
      return;
    }
    setMetas(prev => [...prev, { type: t, monthlyGoal: 0, active: true }]);
    setNewTipoInput('');
  };

  const handleDeleteTipoServicio = (tipo: string) => {
    if (TIPOS_SERVICIOS_DEFAULT.includes(tipo)) {
      setMessage({ type: 'error', text: 'Los tipos predeterminados no se pueden eliminar.' });
      return;
    }
    if (confirm(`¿Eliminar el tipo de servicio "${tipo}"?`)) {
      setMetas(prev => prev.filter(m => m.type !== tipo));
    }
  };

  // --- Period Detection ---
  const { periodosDetectados, periodoTexto } = useMemo(() => {
    const monthSet = new Set<string>();
    registros.forEach(r => {
      if (r.fecha && /^\d{4}-\d{2}/.test(r.fecha)) {
        monthSet.add(r.fecha.substring(0, 7));
      }
    });
    const sorted = Array.from(monthSet).sort();
    const periodoTexto = sorted.map(ym => {
      const [year, month] = ym.split('-');
      return `${MESES_NOMBRES_ES[parseInt(month, 10) - 1]} ${year}`;
    }).join(', ');
    return { periodosDetectados: sorted, periodoTexto };
  }, [registros]);

  // --- Acta Handlers ---
  const handleGenerarActa = (p: Prestador) => {
    const prestadorActas = actas.filter(a => a.prestadorId === p.id);
    const numero = `${p.contrato}-${prestadorActas.length + 1}`;
    const servicios: ActaServicio[] = p.metas
      .filter(m => m.monthlyGoal > 0 || m.active)
      .map(m => {
        const ejecutado = metas.find(x => x.type === m.type) ?
          (chartData.find(c => c.name === m.type)?.ejecutado || 0) : 0;
        return {
          tipo: m.type,
          programado: m.monthlyGoal * scale,
          ejecutado
        };
      });
    const today = new Date().toISOString().split('T')[0];
    const newActa: Acta = {
      id: Date.now().toString(),
      numero,
      prestadorId: p.id,
      empresa: p.nombre,
      nit: p.nit,
      lugar: firmasGlobales.lugarActa || p.municipio,
      municipio: p.municipio,
      departamento: p.departamento,
      contrato: p.contrato,
      regimen: p.regimen || 'SUBSIDIADO',
      periodoEvaluado: periodoTexto,
      vigencia: p.vigencia || new Date().getFullYear().toString(),
      coordinador: firmasGlobales.coordinador,
      funcionario: funcionarios[0] || '',
      fechaActa: today,
      puntosTratar: 'Revisión y confrontación de resultados del seguimiento a las actividades de recuperación de la salud y atención primaria, reportadas según Anexo No. 12 por la Coordinación de Baja Complejidad',
      objetivo: 'Verificar la ejecución de la efectiva prestación de los servicios, cumplimiento de metas reflejadas en los RIPS cargados y facturas radicadas por parte de los prestadores de la red de atención primaria bajo la modalidad de cápita, según los anexos 11, 13, 14 y 17.',
      desarrolloYConclusiones: 'Se realiza la evaluación de la ejecución de las actividades contenidas en las rutas de atención en salud correspondientes al período evaluado. En donde se evidencia lo relacionado en la gráfica 1.',
      desarrolloConclusionesPost: 'Se verifica la ejecución de las actividades de atención primaria, correspondientes a la vigencia antes mencionada, se aclara que se debe cumplir con mínimo el 100% de las actividades programadas para los servicios Asistenciales, a continuación, se relaciona en la tabla 2. el resultado obtenido:',
      servicios,
      observaciones: '',
      repLegalIPS: p.repLegalIPS || '',
      repLegalEPS: firmasGlobales.repLegalEPSI,
      createdAt: today
    };
    setInlineActa(newActa);
    setActiveTab('actas');
  };

  const handleSaveActa = () => {
    if (!editingActa) return;
    setActas(prev => {
      const idx = prev.findIndex(a => a.id === editingActa.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = editingActa;
        return updated;
      }
      return [...prev, editingActa];
    });
    setShowActaModal(false);
    setEditingActa(null);
    setMessage({ type: 'success', text: `Acta ${editingActa.numero} guardada.` });
  };

  const handleDeleteActa = (id: string) => {
    if (confirm('¿Eliminar esta acta?')) {
      setActas(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleEditActa = (acta: Acta) => {
    setInlineActa({ ...acta });
    setActiveTab('actas');
  };

  const makeBlankActa = (): Acta => {
    const today = new Date().toISOString().split('T')[0];
    return {
      id: Date.now().toString(),
      numero: '',
      prestadorId: '',
      empresa: '',
      nit: '',
      lugar: firmasGlobales.lugarActa || '',
      municipio: '',
      departamento: '',
      contrato: '',
      regimen: 'SUBSIDIADO',
      periodoEvaluado: periodoTexto,
      vigencia: '',
      coordinador: firmasGlobales.coordinador,
      funcionario: funcionarios[0] || '',
      fechaActa: today,
      puntosTratar: 'Revisión y confrontación de resultados del seguimiento a las actividades de recuperación de la salud y atención primaria, reportadas según Anexo No. 12 por la Coordinación de Baja Complejidad',
      objetivo: 'Verificar la ejecución de la efectiva prestación de los servicios, cumplimiento de metas reflejadas en los RIPS cargados y facturas radicadas por parte de los prestadores de la red de atención primaria bajo la modalidad de cápita, según los anexos 11, 13, 14 y 17.',
      desarrolloYConclusiones: 'Se realiza la evaluación de la ejecución de las actividades contenidas en las rutas de atención en salud correspondientes al período evaluado. En donde se evidencia lo relacionado en la gráfica 1.',
      desarrolloConclusionesPost: 'Se verifica la ejecución de las actividades de atención primaria, correspondientes a la vigencia antes mencionada, se aclara que se debe cumplir con mínimo el 100% de las actividades programadas para los servicios Asistenciales, a continuación, se relaciona en la tabla 2. el resultado obtenido:',
      servicios: metas.filter(m => m.active).map(m => ({
        tipo: m.type,
        programado: m.monthlyGoal * scale,
        ejecutado: chartData.find(c => c.name === m.type)?.ejecutado || 0
      })),
      observaciones: '',
      repLegalIPS: '',
      repLegalEPS: firmasGlobales.repLegalEPSI,
      createdAt: today
    };
  };

  const handleSaveInlineActa = () => {
    if (!inlineActa) return;
    // Auto-generate numero if empty, using contract + sequence
    let actaToSave = inlineActa;
    if (!actaToSave.numero.trim()) {
      const contrato = actaToSave.contrato || (detectedPrestadorId ? prestadores.find(p => p.id === detectedPrestadorId)?.contrato : '') || 'ACTA';
      const existing = actas.filter(a => a.id !== actaToSave.id && a.contrato === actaToSave.contrato);
      actaToSave = { ...actaToSave, numero: `${contrato}-${existing.length + 1}` };
      setInlineActa(actaToSave);
    }
    setActas(prev => {
      const idx = prev.findIndex(a => a.id === actaToSave.id);
      const next = idx >= 0
        ? prev.map((a, i) => i === idx ? actaToSave : a)
        : [...prev, actaToSave];
      localStorage.setItem('actas', JSON.stringify(next));
      return next;
    });
    setMessage({ type: 'success', text: `Acta ${actaToSave.numero} guardada.` });
  };

  // --- Auth Handlers ---
  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  const handleSaveUser = () => {
    const { username, password, nombre, role, permissions } = userForm;
    if (!username.trim() || !password.trim() || !nombre.trim()) return;
    const effectivePerms = role === 'admin' ? undefined : permissions;
    if (editUser) {
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, username: username.trim(), password, nombre: nombre.trim(), role, permissions: effectivePerms } : u));
      if (currentUser?.id === editUser.id) {
        const updated = { ...currentUser, username: username.trim(), password, nombre: nombre.trim(), role, permissions: effectivePerms };
        setCurrentUser(updated);
        sessionStorage.setItem('currentUser', JSON.stringify(updated));
      }
    } else {
      if (users.some(u => u.username === username.trim())) {
        setMessage({ type: 'error', text: 'Ya existe un usuario con ese nombre.' });
        return;
      }
      setUsers(prev => [...prev, { id: Date.now().toString(), username: username.trim(), password, nombre: nombre.trim(), role, permissions: effectivePerms }]);
    }
    setShowUserForm(false);
    setEditUser(null);
    setUserForm({ username: '', password: '', nombre: '', role: 'general', permissions: ['dashboard','carga','prestadores','actas'] });
    setMessage({ type: 'success', text: editUser ? 'Usuario actualizado.' : 'Usuario creado.' });
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser?.id) { setMessage({ type: 'error', text: 'No puedes eliminar tu propio usuario.' }); return; }
    if (confirm('¿Eliminar este usuario?')) setUsers(prev => prev.filter(u => u.id !== id));
  };

  // --- Handlers para funcionarios y firmas globales ---
  const handleAddFuncionario = (nombre: string) => {
    const trimmed = nombre.trim();
    if (!trimmed || funcionarios.includes(trimmed)) return;
    setFuncionarios(prev => [...prev, trimmed]);
  };
  const handleRemoveFuncionario = (nombre: string) => {
    setFuncionarios(prev => prev.filter(f => f !== nombre));
  };
  const handleSaveFirmaGlobal = (key: 'repLegalEPSI' | 'coordinador' | 'lugarActa', val: string) => {
    setFirmasGlobales(prev => ({ ...prev, [key]: val }));
  };

  const processFiles = async (ripsFiles: FileList | null, cupsFile: File | null, jsonFiles: FileList | null) => {
    const hasTxt  = ripsFiles && ripsFiles.length > 0;
    const hasJson = jsonFiles && jsonFiles.length > 0;
    if (!hasTxt && !hasJson) {
      setMessage({ type: 'error', text: 'Seleccione archivos RIPS (.txt) o RIPS JSON (.json).' });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      // 1. Build optional name/tipo lookup from uploaded Maestro CUPS file
      const cupsFileMap = new Map<string, MaestroCupItem>();
      if (cupsFile) {
        const cupsBuffer = await cupsFile.arrayBuffer();
        const wb = read(cupsBuffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = utils.sheet_to_json(ws, { defval: "" });
        rows.forEach(x => {
          const c = String(x["CUPS VIGENTE"] || "").trim().toUpperCase();
          if (c) {
            cupsFileMap.set(c, {
              cups: c,
              tipo: String(x["Tipo Ser"] || "").trim(),
              nombre: String(x["NOMBRE CUPS"] || "").trim()
            });
          }
        });
        setMaestro(cupsFileMap);
      }

      // Build lookup from customCupsList state
      const customMap = new Map<string, MaestroCupItem>();
      customCupsList.forEach(e => customMap.set(e.cups, { cups: e.cups, tipo: e.tipo, nombre: e.nombre }));

      // Priority: CUPS_TIPO_MAP (hardcoded) > customMap > cupsFileMap
      const getTipo = (cups: string): string =>
        CUPS_TIPO_MAP[cups] || customMap.get(cups)?.tipo || cupsFileMap.get(cups)?.tipo || "";

      const getNombre = (cups: string): string =>
        customMap.get(cups)?.nombre || cupsFileMap.get(cups)?.nombre || "";

      const isKnown = (cups: string): boolean =>
        !!CUPS_TIPO_MAP[cups] || customMap.has(cups) || cupsFileMap.has(cups);

      // 2. Process RIPS
      const newRegistros: RipsRecord[] = [];
      const newUsuariosMap = new Map<string, UserRecord>(usuariosMap);

      const getSectionFromFilename = (name: string) => {
        const n = name.toUpperCase().replace(/\.[^.]+$/, ''); // quitar extensión
        // Nombres que empiezan con tipo: US*, AM*, AC*, AP*, AT*
        if (n.startsWith("US")) return "USUARIOS";
        if (n.startsWith("AM")) return "MEDICAMENTOS";
        if (n.startsWith("AC") || n.startsWith("AP") || n.startsWith("AT")) return "SERVICIOS";
        // Nombres tipo NIT+letra+seq: 601T01, 890201C01, 601P02, etc.
        // La letra entre dígitos indica el tipo RIPS
        const m = n.match(/^\d+([A-Z])\d+$/);
        if (m) {
          const t = m[1];
          if (t === 'U') return "USUARIOS";
          if (t === 'M') return "MEDICAMENTOS";
          if (t === 'C' || t === 'P' || t === 'T' || t === 'A') return "SERVICIOS";
        }
        return "";
      };

      for (let i = 0; i < ripsFiles.length; i++) {
        const file = ripsFiles[i];
        const txt = await file.text();
        const lines = txt.split(/\r?\n/);

        let section = getSectionFromFilename(file.name);

        // Detectar si es archivo AT por nombre: 601T01, AT, AT01, etc.
        const nameUp = file.name.toUpperCase().replace(/\.[^.]+$/, '');
        const isAtFile = nameUp.startsWith('AT') || /^\d+T\d+$/.test(nameUp);

        // inAtSection: true cuando dentro del archivo hay sección "OTROS SERVICIOS"
        let inAtSection = isAtFile;

        for (const raw of lines) {
          const l = raw.trim();
          if (!l) continue;

          const upperLine = l.toUpperCase();

          if (upperLine.includes("USUARIOS") && (upperLine.includes("*") || upperLine.includes("°") || upperLine.includes("-"))) {
            section = "USUARIOS"; inAtSection = false; continue;
          }
          if (upperLine.includes("MEDICAMENTOS")) {
            section = "MEDICAMENTOS"; inAtSection = false; continue;
          }
          if (upperLine.includes("OTROS SERVICIOS")) {
            section = "SERVICIOS"; inAtSection = true; continue;
          }
          if (upperLine.includes("CONSULTAS") || upperLine.includes("PROCEDIMIENTOS")) {
            section = "SERVICIOS"; inAtSection = false; continue;
          }

          let parts: string[] = [];
          if (l.includes('\t') && l.split('\t').length >= 3) {
            // TAB-separado (formato AT/Otros Servicios y algunos RIPS)
            parts = l.split('\t').map(x => x.trim());
          } else if (l.includes(',') && (l.match(/,/g) || []).length >= 3) {
            parts = l.split(',').map(x => x.trim().replace(/[|]$/, ''));
          } else if (l.includes('|')) {
            parts = l.split('|').map(x => x.trim());
          } else {
            continue;
          }

          if (parts.length < 2) continue;

          if (section !== "USUARIOS") {
            const hasDate = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(l);
            const hasSex = /\b(M|F)\b/i.test(l);
            if (hasDate && hasSex) section = "USUARIOS";
          }

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
            newUsuariosMap.set(id, { id, sexo: sexo || prev.sexo, fnac: fnac || prev.fnac, nombre: nombre || prev.nombre });
            continue;
          }

          // MEDICAMENTOS section: extract patient id + quantity (numDosis field)
          if (section === "MEDICAMENTOS") {
            const mP2 = l.match(/\b(?:CC|TI|RC|CE|PA|PE|CN|MS)-?\d{4,15}\b|\b\d{6,15}\b/);
            const pacMed = mP2 ? normalizeId(mP2[0]) : "SIN_ID";
            if (pacMed === "SIN_ID" || pacMed.length < 3) continue;
            // Try to find numDosis: last numeric field with value > 0
            const nums = parts.filter(p => /^\d+$/.test(p) && parseInt(p, 10) > 0).map(p => parseInt(p, 10));
            const cantidad = nums.length > 0 ? nums[nums.length - 1] : 1;
            const fecha = parseDateFromLine(l);
            for (let q = 0; q < cantidad; q++) {
              newRegistros.push({ cups: 'MEDICAM', paciente: pacMed, tipo: 'MEDICAMENTOS', nombre: 'Medicamento', fecha });
            }
            continue;
          }

          // ── Sección AT (Otros Servicios): archivo AT o header "OTROS SERVICIOS" dentro ──
          if (inAtSection) {
            if (parts.length < 4) continue;
            // Saltar cabeceras
            if (/^bill|^productid|^tipo|^clientid/i.test(parts[0])) continue;
            // Buscar el código AT: primer campo que sea dígito+alfanumérico de 6 chars (ej. 601T01)
            let cupsAt = '';
            let cupsIdx = -1;
            for (let pi = 0; pi < parts.length; pi++) {
              const v = parts[pi].trim().toUpperCase();
              if (/^[0-9][0-9A-Z]{5}$/.test(v)) { cupsAt = v; cupsIdx = pi; break; }
            }
            if (!cupsAt) continue;
            // Nombre del servicio: columna siguiente al código
            const nombreAt = (cupsIdx >= 0 && parts[cupsIdx + 1])
              ? parts[cupsIdx + 1].trim() : 'OTROS SERVICIOS';
            // Cantidad: buscar columna numérica >0 después del nombre
            let cantidad = 1;
            for (let pi = cupsIdx + 2; pi < parts.length; pi++) {
              const v = parseInt(parts[pi], 10);
              if (!isNaN(v) && v > 0 && v < 1000) { cantidad = v; break; }
            }
            // Paciente: número largo (6-15 dígitos) que no sea el NIT/clientid (>11 dígitos usualmente NIT)
            const pacAt = normalizeId(
              parts.find(p => /^\d{6,15}$/.test(p.trim()) && p.trim().length >= 6 && p.trim().length <= 12) || ''
            ) || 'SIN_ID';
            if (pacAt === 'SIN_ID' || pacAt.length < 3) continue;
            const tipoAt = getTipo(cupsAt) || 'OTROS SERVICIOS';
            const fechaAt = parseDateFromLine(l);
            for (let q = 0; q < cantidad; q++) {
              newRegistros.push({ cups: cupsAt, paciente: pacAt, tipo: tipoAt, nombre: isKnown(cupsAt) ? getNombre(cupsAt) : nombreAt, fecha: fechaAt });
            }
            continue;
          }

          // ── Archivos normales (AC, AP, CT, etc.) ────────────────────────────
          // Match numeric (890201) or alphanumeric (601T01, 5DS002, 130B01) CUPS codes
          const mC = l.match(/\b([0-9][0-9A-Za-z]{5})\b/);
          if (!mC) continue;
          const cups = mC[1].toUpperCase();

          if (!isKnown(cups)) continue;

          const tipo = getTipo(cups);
          if (!tipo) continue;

          const mP = l.match(/\b(?:CC|TI|RC|CE|PA|PE|CN|MS)-?\d{4,15}\b|\b\d{6,15}\b/);
          const pacienteRaw = mP ? mP[0] : "SIN_ID";
          const paciente = normalizeId(pacienteRaw) || "SIN_ID";
          const fecha = parseDateFromLine(l);

          newRegistros.push({ cups, paciente, tipo, nombre: getNombre(cups), fecha });
        }
      }

      // Try to detect prestador from TXT file names (often contain NIT or contract)
      if (hasTxt && !detectedPrestadorId) {
        for (let i = 0; i < ripsFiles!.length; i++) {
          const name = ripsFiles![i].name.toUpperCase();
          const found = prestadores.find(p => {
            const nitClean = p.nit.replace(/[^0-9]/g, '').slice(0, 9);
            const contratoClean = p.contrato.toUpperCase().replace(/[^A-Z0-9]/g, '');
            return (nitClean && name.includes(nitClean)) || (contratoClean && name.includes(contratoClean));
          });
          if (found) { setDetectedPrestadorId(found.id); break; }
        }
      }

      // 3. Process JSON RIPS files
      if (hasJson) {
        for (let i = 0; i < jsonFiles!.length; i++) {
          const file = jsonFiles![i];
          try {
            const text = await file.text();
            const data = JSON.parse(text);
            // Support single object or array of objects
            const docs: any[] = Array.isArray(data) ? data : [data];

            // Try to detect prestador from JSON entity fields
            const normalizeNit = (v: string) => String(v || '').replace(/[^0-9]/g, '').slice(0, 9);
            for (const doc of docs) {
              if (!detectedPrestadorId) {
                const nitDoc = normalizeNit(String(doc.numDocumentoIdObligado || doc.nit || doc.nitPrestador || ''));
                const contratoDoc = String(doc.numContrato || doc.contrato || '').trim().toLowerCase();
                const found = prestadores.find(p => {
                  const nitP = normalizeNit(p.nit);
                  const contratoP = p.contrato.trim().toLowerCase();
                  return (nitDoc && nitP && nitDoc === nitP) || (contratoDoc && contratoP && contratoDoc === contratoP);
                });
                if (found) setDetectedPrestadorId(found.id);
              }
            }

            for (const doc of docs) {
              const usuariosArr: any[] = doc.usuarios || [];

              for (const usuario of usuariosArr) {
                const tipoDoc = String(usuario.tipoDocumentoIdentificacion || '');
                const numDoc  = String(usuario.numDocumentoIdentificacion  || '');
                const id = normalizeId(`${tipoDoc}-${numDoc}`) || normalizeId(numDoc);
                if (!id || id.length < 3) continue;

                const fnac = String(usuario.fechaNacimiento || '').split('T')[0];
                const sexo = (usuario.codSexo || '').toUpperCase();
                const prev = newUsuariosMap.get(id) || { id, sexo: '', fnac: '', nombre: '' };
                newUsuariosMap.set(id, { id, sexo: sexo || prev.sexo, fnac: fnac || prev.fnac, nombre: prev.nombre });

                const servicios = usuario.servicios || {};

                const addSrv = (cupsCode: string, fechaRaw: string) => {
                  const cups = cupsCode.trim().toUpperCase();
                  if (!cups) return;
                  if (!isKnown(cups)) return;
                  const tipo = getTipo(cups);
                  if (!tipo) return;
                  const fecha = String(fechaRaw || '').split(' ')[0].split('T')[0];
                  newRegistros.push({ cups, paciente: id, tipo, nombre: getNombre(cups), fecha });
                };

                for (const s of servicios.procedimientos  || []) addSrv(String(s.codProcedimiento  || ''), String(s.fechaInicioAtencion || ''));
                for (const s of servicios.consultas        || []) addSrv(String(s.codConsulta        || s.codProcedimiento || ''), String(s.fechaInicioAtencion || s.fechaConsulta || ''));
                for (const s of servicios.urgencias        || []) addSrv(String(s.codProcedimiento   || s.codConsulta      || ''), String(s.fechaInicioAtencion || ''));
                for (const s of servicios.otrosServicios   || []) addSrv(String(s.codOtroServicio    || s.codProcedimiento || ''), String(s.fechaInicioAtencion || ''));
                for (const s of servicios.hospitalizacion  || []) addSrv(String(s.codProcedimiento   || ''),                       String(s.fechaInicioAtencion || s.fechaIngreso  || ''));
                // Medicamentos: sum by cantidad (each unit = 1 record)
                for (const s of servicios.medicamentos || []) {
                  const fecha = String(s.fechaDispensacion || s.fechaInicioAtencion || '').split('T')[0];
                  const nombre = String(s.nomGenerico || s.nombre || s.codMedicamento || 'Medicamento');
                  const cantidad = Math.max(1, parseInt(String(s.cantidad || s.numDosis || 1), 10) || 1);
                  for (let q = 0; q < cantidad; q++) {
                    newRegistros.push({ cups: 'MEDICAM', paciente: id, tipo: 'MEDICAMENTOS', nombre, fecha });
                  }
                }
              }
            }
          } catch {
            setMessage({ type: 'error', text: `Error leyendo JSON: ${file.name}` });
          }
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
    // Solo aplica para Consultas y Procedimientos. Se excluyen Medicamentos, Hospitalización y Urgencias.
    const TIPOS_SIN_DUPLICADOS = new Set(['MEDICAMENTOS', 'HOSP BAJA COMPLEJIDAD', 'URGENCIAS BC']);
    const duplicateMap = new Map<string, { count: number, record: RipsRecord }>();

    filteredRegistros.forEach(r => {
      // 1. Detect Duplicates (excluir medicamentos, hospitalización y urgencias)
      if (!TIPOS_SIN_DUPLICADOS.has(r.tipo)) {
        const dupKey = `${r.paciente}|${r.cups}|${r.fecha}`;
        const currDup = duplicateMap.get(dupKey);
        if (currDup) {
          currDup.count++;
        } else {
          duplicateMap.set(dupKey, { count: 1, record: r });
        }
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
        const ejecutadoRips = typeCount[m.type] || 0;
        const ejecutado = ejecutadoRips + (m.renuencias || 0);
        const totalMeta = m.monthlyGoal * scale;
        let pct = totalMeta > 0 ? Math.round((ejecutado / totalMeta) * 100) : 0;
        const capPct = pct > 100 ? 100 : pct;

        const color = "#10b981";

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
  const formatXAxis = (tickItem: string) => tickItem || '';
  
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

  if (!currentUser) return (
    <LoginScreen
      users={users}
      onLogin={u => { setCurrentUser(u); sessionStorage.setItem('currentUser', JSON.stringify(u)); }}
      theme={theme}
    />
  );

  const isAdmin = currentUser.role === 'admin';
  const hasPerm = (key: string) => isAdmin || (currentUser.permissions ?? []).includes(key);

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
              {periodoTexto && (
                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {periodoTexto}
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
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <User className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">{currentUser.nombre}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isAdmin ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                {isAdmin ? 'Admin' : 'General'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-all border border-slate-200 dark:border-slate-700 shadow-sm"
              title="Cerrar sesión"
            >
              <LogOut className="h-5 w-5" />
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
          </div>
        </div>
        {/* Tab Navigation */}
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-slate-200/60 dark:border-slate-800/60">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <BarChart3 className="h-4 w-4" /> Dashboard
          </button>
          {(hasPerm('mantenimiento') || hasPerm('usuarios') || hasPerm('prestadores')) && (
          <button
            onClick={() => setActiveTab('mantenimiento')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'mantenimiento' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Settings className="h-4 w-4" /> Mantenimiento
          </button>
          )}
          {hasPerm('actas') && (
          <button
            onClick={() => setActiveTab('actas')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'actas' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <ClipboardList className="h-4 w-4" /> Actas
            {actas.length > 0 && (
              <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{actas.length}</span>
            )}
          </button>
          )}
          {hasPerm('reportes') && (
          <button
            onClick={() => setActiveTab('reportes')}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-all ${activeTab === 'reportes' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <FileText className="h-4 w-4" /> Reportes
          </button>
          )}
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

        {activeTab === 'dashboard' && (<>

        {/* --- Prestador Detectado Banner --- */}
        {(() => {
          const dp = detectedPrestadorId ? prestadores.find(p => p.id === detectedPrestadorId) : null;
          if (!dp) return null;
          return (
            <div className="glass-panel rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-l-4 border-indigo-500 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                  <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">Prestador detectado en RIPS</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{dp.nombre}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 ml-1">
                  {dp.nit && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">NIT: {dp.nit}</span>}
                  {dp.contrato && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">📋 {dp.contrato}</span>}
                  {dp.municipio && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">📍 {[dp.departamento, dp.municipio].filter(Boolean).join(', ')}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleLoadPrestadorMetas(dp)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-all shadow-sm"
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Cargar Metas
                </button>
                <button
                  onClick={() => { handleGenerarActa(dp); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-all shadow-sm"
                >
                  <ClipboardList className="h-3.5 w-3.5" /> Generar Acta
                </button>
                <button
                  onClick={() => setDetectedPrestadorId(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* --- Top Control Panel --- */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── Prestadores Panel ── */}
          <section className="glass-panel rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-500 dark:text-indigo-400" /> Prestadores
              </h2>
              {prestadores.length > 0 && (
                <button
                  onClick={() => { setActiveTab('mantenimiento'); setMaintTab('prestadores'); }}
                  className="text-xs text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-200 transition-colors"
                >
                  Gestionar →
                </button>
              )}
            </div>

            {prestadores.length > 0 && (
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por contrato o nombre..."
                  value={searchPrestador}
                  onChange={e => setSearchPrestador(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            )}

            {prestadores.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <Building2 className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No hay prestadores configurados</p>
                <button
                  onClick={() => { setActiveTab('mantenimiento'); setMaintTab('prestadores'); }}
                  className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  + Agregar prestador
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto custom-scroll pr-1">
                {prestadores.filter(p => {
                  if (!searchPrestador.trim()) return true;
                  const q = searchPrestador.toLowerCase();
                  return p.nombre.toLowerCase().includes(q) || p.contrato.toLowerCase().includes(q);
                }).map(p => {
                  const pActas = actas.filter(a => a.prestadorId === p.id);
                  const isSelected = selectedDashPrestador === p.id;
                  return (
                    <div key={p.id}
                      className={`rounded-xl border transition-all cursor-pointer ${isSelected
                        ? 'border-indigo-500/60 bg-indigo-50/60 dark:bg-indigo-500/10'
                        : 'border-slate-200 dark:border-slate-700/60 hover:border-indigo-300 dark:hover:border-indigo-500/40 bg-slate-50/50 dark:bg-slate-800/30'}`}
                      onClick={() => setSelectedDashPrestador(isSelected ? null : p.id)}
                    >
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div>
                          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{p.nombre}</div>
                          <div className="flex gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-mono">NIT: {p.nit}</span>
                            {p.contrato && <span className="text-[10px] text-slate-400">📋 {p.contrato}</span>}
                            {p.regimen && (
                              <span className={`text-[10px] font-bold ${p.regimen === 'CONTRIBUTIVO' ? 'text-orange-500' : 'text-emerald-500'}`}>
                                {p.regimen}
                              </span>
                            )}
                            {p.municipio && <span className="text-[10px] text-slate-400">📍 {p.municipio}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pActas.length > 0 ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {pActas.length} acta{pActas.length !== 1 ? 's' : ''}
                          </span>
                          <span className={`text-slate-400 text-xs transition-transform ${isSelected ? 'rotate-180' : ''}`}>▾</span>
                        </div>
                      </div>

                      {/* Expanded: actas history + actions */}
                      {isSelected && (
                        <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 space-y-2">
                          {pActas.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">Sin actas generadas aún.</p>
                          ) : (
                            <div className="space-y-1">
                              {pActas.map(a => {
                                const totalProg = a.servicios.reduce((s, x) => s + x.programado, 0);
                                const totalEjec = a.servicios.reduce((s, x) => s + x.ejecutado, 0);
                                const cumpl = totalProg > 0 ? Math.min(Math.round((totalEjec / totalProg) * 100), 100) : 0;
                                const color = cumpl >= 100 ? '#16a34a' : cumpl >= 80 ? '#ca8a04' : '#dc2626';
                                return (
                                  <div key={a.id} className="flex items-center justify-between bg-white dark:bg-slate-900/60 rounded-lg px-2.5 py-1.5 border border-slate-100 dark:border-slate-800">
                                    <div>
                                      <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">{a.numero}</span>
                                      <span className="text-[10px] text-slate-400 ml-2">{a.periodoEvaluado}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold" style={{ color }}>{cumpl}%</span>
                                      <button
                                        onClick={e => { e.stopPropagation(); setInlineActa({ ...a }); setActiveTab('actas'); }}
                                        className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 rounded transition-colors"
                                      >
                                        Ver
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={e => { e.stopPropagation(); handleGenerarActa(p); }}
                              className="flex-1 text-xs py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
                            >
                              + Nueva Acta
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                const rFiles = (form.elements.namedItem('rips') as HTMLInputElement)?.files || null;
                const cFile  = (form.elements.namedItem('cups') as HTMLInputElement)?.files?.[0] || null;
                const jFiles = (form.elements.namedItem('json') as HTMLInputElement)?.files || null;
                processFiles(rFiles, cFile, jFiles);
              }}
            >
              {/* Prestador autocomplete */}
              {prestadores.length > 0 && (() => {
                const selectedPrest = detectedPrestadorId ? prestadores.find(x => x.id === detectedPrestadorId) : null;
                const q = prestSearch.toLowerCase();
                const filtered = prestadores.filter(p =>
                  !q || p.contrato.toLowerCase().includes(q) ||
                  p.nombre.toLowerCase().includes(q) ||
                  (p.regimen || 'SUBSIDIADO').toLowerCase().includes(q)
                );
                return (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Prestador</label>
                    {selectedPrest ? (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-600">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{selectedPrest.nombre}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{selectedPrest.contrato} — {selectedPrest.regimen || 'SUBSIDIADO'}</p>
                        </div>
                        <button type="button" onClick={() => { setDetectedPrestadorId(null); setPrestSearch(''); }}
                          className="shrink-0 text-slate-400 hover:text-red-500 transition-colors text-lg leading-none font-bold">×</button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Buscar por contrato, nombre o régimen..."
                          value={prestSearch}
                          onChange={e => { setPrestSearch(e.target.value); setShowPrestDropdown(true); }}
                          onFocus={() => setShowPrestDropdown(true)}
                          onBlur={() => setTimeout(() => setShowPrestDropdown(false), 150)}
                          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {showPrestDropdown && filtered.length > 0 && (
                          <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-56 overflow-y-auto custom-scroll">
                            {filtered.map(p => (
                              <li key={p.id}
                                onMouseDown={() => { handleLoadPrestadorMetas(p); setPrestSearch(''); setShowPrestDropdown(false); }}
                                className="px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.nombre}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{p.contrato} — {p.regimen || 'SUBSIDIADO'}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                        {showPrestDropdown && prestSearch && filtered.length === 0 && (
                          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-3 py-3 text-sm text-slate-400 text-center">
                            Sin resultados
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* TXT Drop Zone */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Archivos RIPS (.txt)
                  </label>
                  <div className="relative group">
                    <input name="rips" type="file" multiple accept=".txt" className="hidden" id="file-rips" onChange={(e) => { const files = Array.from(e.target.files || []) as File[]; setRipsFileNames(files.map(f => f.name)); }} />
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

                {/* JSON Drop Zone */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    RIPS JSON (.json)
                  </label>
                  <div className="relative group">
                    <input name="json" type="file" multiple accept=".json" className="hidden" id="file-json" onChange={(e) => { const files = Array.from(e.target.files || []) as File[]; setJsonFileNames(files.map(f => f.name)); }} />
                    <label
                      htmlFor="file-json"
                      className={`flex flex-col items-center justify-center w-full h-24 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${jsonFileNames.length > 0 ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/5' : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-transparent hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]'}`}
                    >
                      {jsonFileNames.length > 0 ? (
                        <>
                          <CheckCircle className="h-6 w-6 text-emerald-500 mb-1" />
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center">{jsonFileNames.length} archivo{jsonFileNames.length > 1 ? 's' : ''} listo{jsonFileNames.length > 1 ? 's' : ''}</span>
                        </>
                      ) : (
                        <>
                          <FileJson className="h-8 w-8 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors mb-2" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-300">Seleccionar JSON</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

              </div>

              <div className="grid grid-cols-2 gap-3 mt-auto">
                <div className="col-span-2 flex gap-2">
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Upload className="h-4 w-4" /> Procesar Data</>
                    )}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleClearData}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 hover:border-red-200 dark:hover:border-red-500/30 rounded-xl text-sm font-medium transition-all shadow-sm"
                      title="Limpiar datos"
                    >
                      <Trash2 className="h-4 w-4" /> Limpiar
                    </button>
                  )}
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

                {isAdmin && duplicatesList.length > 0 && (
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
                {registros.length > 0 && (
                  <div className="col-span-2 flex flex-col gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const p = detectedPrestadorId ? prestadores.find(x => x.id === detectedPrestadorId) : null;
                        if (p) handleGenerarActa(p);
                        else setMessage({ type: 'error', text: 'Selecciona un prestador arriba primero.' });
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-md shadow-indigo-500/20"
                    >
                      <ClipboardList className="h-4 w-4" /> Generar Acta
                    </button>
                  </div>
                )}
              </div>
            </form>
          </section>
        </div>

        {/* --- Renuencias y Búsquedas Fallidas (Admin only) --- */}
        {isAdmin && metas.some(m => m.active) && (
          <section className="glass-panel rounded-2xl p-5 shadow-xl animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileWarning className="h-5 w-5 text-amber-500" />
                Renuencias y Búsquedas Fallidas
              </h2>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">Se suman al ejecutado</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {metas.filter(m => m.active).map((m, idx) => {
                const ripsCount = chartData.find(c => c.name === m.type)?.ejecutado ?? 0;
                const ren = m.renuencias || 0;
                const total = ripsCount;
                return (
                  <div key={idx} className="flex flex-col gap-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-tight line-clamp-2">{m.type}</span>
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono text-slate-700 dark:text-slate-300">{(ripsCount - ren).toLocaleString()}</span>
                      <span>RIPS</span>
                      {ren > 0 && <span className="text-amber-500 font-bold">+{ren.toLocaleString()}</span>}
                    </div>
                    <input
                      type="number" min="0"
                      value={ren}
                      onChange={e => setMetas(prev => prev.map(x => x.type === m.type ? { ...x, renuencias: Math.max(0, Number(e.target.value)) } : x))}
                      className="w-full bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-lg px-2 py-1 text-center text-sm font-bold text-amber-600 dark:text-amber-400 focus:ring-2 focus:ring-amber-500/30 outline-none"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-center text-slate-400">Total: <strong className="text-slate-700 dark:text-slate-200">{total.toLocaleString()}</strong></span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
                Carga archivos RIPS (.txt)
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-500 rounded-full"></div> Producción (Cantidad)
                </h3>
                {scale > 1 && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                    Meta × {scale} {scale === 12 ? 'meses (anual)' : `meses`}
                  </span>
                )}
              </div>
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
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 160 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke={chartColors.text}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={150}
                      tickFormatter={formatXAxis}
                    />
                    <YAxis domain={[0, 100]} stroke={chartColors.text} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: chartColors.tooltipBg, borderColor: chartColors.tooltipBorder, borderRadius: '8px', color: chartColors.tooltipText }}
                      cursor={{fill: chartColors.grid, opacity: 0.5}}
                      formatter={(val: number) => `${val}%`}
                    />
                    <Legend verticalAlign="top" height={36} payload={[
                      { value: '%', type: 'rect', color: '#10b981' }
                    ]}/>
                    <ReferenceLine y={80} stroke="#eab308" strokeDasharray="3 3" />
                    <ReferenceLine y={100} stroke="#10b981" strokeDasharray="3 3" />
                    <Bar dataKey="cumplimiento" name="%" radius={[4, 4, 0, 0]} minPointSize={3}>
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

        </>)}

        {/* ===== MANTENIMIENTO TAB ===== */}
        {activeTab === 'mantenimiento' && (
          <div className="space-y-6 animate-in fade-in duration-300">

            {/* Sub-tabs */}
            <div className="flex flex-wrap gap-2">
              {([
                { key: 'prestadores', label: 'Prestadores',         icon: <Building2 className="h-4 w-4" />,   show: hasPerm('prestadores') },
                { key: 'cups',        label: 'CUPS Personalizados', icon: <FileJson className="h-4 w-4" />,    show: hasPerm('mantenimiento') },
                { key: 'servicios',   label: 'Tipos de Servicio',   icon: <Stethoscope className="h-4 w-4" />, show: hasPerm('mantenimiento') },
                { key: 'usuarios',    label: 'Usuarios',            icon: <Users className="h-4 w-4" />,       show: hasPerm('usuarios') },
                { key: 'monitor',     label: 'Monitor',             icon: <Activity className="h-4 w-4" />,    show: isAdmin },
              ] as { key: 'prestadores'|'cups'|'servicios'|'usuarios'|'monitor', label: string, icon: React.ReactNode, show: boolean }[])
              .filter(t => t.show)
              .map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setMaintTab(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm ${
                    maintTab === key
                      ? 'bg-indigo-600 text-white shadow-indigo-500/20'
                      : 'glass-panel text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* --- PRESTADORES --- */}
            {maintTab === 'prestadores' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-500" /> Prestadores de Servicio
                  </h2>
                  <div className="flex gap-2 flex-wrap">
                    <label className="flex items-center gap-2 px-3 py-2 glass-panel text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700">
                      <input type="file" accept=".json" className="hidden" onChange={handleImportConfig} />
                      <Upload className="h-4 w-4" /> Importar JSON
                    </label>
                    <button
                      onClick={handleExportConfig}
                      disabled={prestadores.length === 0}
                      className="flex items-center gap-2 px-3 py-2 glass-panel text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                    >
                      <Download className="h-4 w-4" /> Exportar JSON
                    </button>
                    <button
                      onClick={() => {
                        setPrestForm({ nombre: '', nit: '', departamento: '', municipio: '', contrato: '', vigencia: '', regimen: 'SUBSIDIADO', metas: metas.map(m => ({ ...m })) });
                        setEditPrest(null);
                        setShowPrestForm(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-indigo-500/20"
                    >
                      <Plus className="h-4 w-4" /> Nuevo Prestador
                    </button>
                  </div>
                </div>

                {prestadores.length === 0 ? (
                  <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4 border-2 border-dashed border-slate-300 dark:border-slate-700">
                    <Building2 className="h-12 w-12 text-slate-400 dark:text-slate-600" />
                    <div>
                      <p className="font-bold text-slate-600 dark:text-slate-300">No hay prestadores registrados</p>
                      <p className="text-sm text-slate-400 mt-1">Crea el primero o importa desde un archivo JSON</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {prestadores.map(p => (
                      <div key={p.id} className="glass-panel rounded-2xl p-5 shadow-lg flex flex-col gap-3 group hover:shadow-xl transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-slate-800 dark:text-white leading-tight">{p.nombre}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">NIT: {p.nit}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleGenerarActa(p)}
                              className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                              title="Generar Acta"
                            >
                              <ClipboardList className="h-4 w-4" />
                            </button>
                            {isAdmin && (<>
                              <button
                                onClick={() => { setEditPrest(p); const savedMetasMap = new Map((p.metas||[]).map((m: ServiceTypeMeta) => [m.type, m])); const mergedMetas = metas.map(m => savedMetasMap.get(m.type) ?? { ...m, monthlyGoal: 0 }); setPrestForm({ nombre: p.nombre, nit: p.nit, departamento: p.departamento, municipio: p.municipio, contrato: p.contrato, vigencia: p.vigencia || '', regimen: p.regimen || 'SUBSIDIADO', repLegalIPS: p.repLegalIPS || '', metas: mergedMetas }); setShowPrestForm(true); }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeletePrestador(p.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                          {(p.departamento || p.municipio) && (
                            <span>📍 {[p.departamento, p.municipio].filter(Boolean).join(', ')}</span>
                          )}
                          {p.contrato && <span>📋 Contrato: {p.contrato}</span>}
                          {p.regimen && (
                            <span className={`inline-flex items-center gap-1 font-semibold ${p.regimen === 'CONTRIBUTIVO' ? 'text-orange-500 dark:text-orange-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              🏥 {p.regimen}
                            </span>
                          )}
                          <span className="text-slate-400 dark:text-slate-500">
                            {p.metas.filter(m => m.monthlyGoal > 0).length} servicios con meta
                          </span>
                        </div>
                        {/* Actas for this prestador */}
                        {actas.filter(a => a.prestadorId === p.id).length > 0 && (
                          <div className="pt-2 space-y-1">
                            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Actas</p>
                            {actas.filter(a => a.prestadorId === p.id).map(acta => (
                              <div key={acta.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2 py-1 text-xs">
                                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-medium">{acta.numero}</span>
                                <span className="text-slate-400 text-[10px] truncate mx-2">{acta.periodoEvaluado}</span>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button onClick={() => handleEditActa(acta)} className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Ver/Editar">
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button onClick={() => handleDeleteActa(acta.id)} className="p-1 hover:text-red-500 transition-colors" title="Eliminar">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                          <button
                            onClick={() => handleLoadPrestadorMetas(p)}
                            className="flex-1 py-2 px-3 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium transition-all border border-indigo-200 dark:border-indigo-500/20"
                          >
                            Cargar Metas
                          </button>
                          <button
                            onClick={() => handleGenerarActa(p)}
                            className="flex items-center gap-1.5 py-2 px-3 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium transition-all border border-emerald-200 dark:border-emerald-500/20"
                          >
                            <ClipboardList className="h-4 w-4" /> Acta
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- CUPS PERSONALIZADOS --- */}
            {maintTab === 'cups' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <FileJson className="h-5 w-5 text-blue-500" /> CUPS Personalizados
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Agrega o sobrescribe códigos CUPS (numéricos o alfanuméricos). Prioridad: <span className="font-semibold text-slate-600 dark:text-slate-300">Mapa predeterminado &gt; estos &gt; Maestro CUPS.</span>
                </p>

                <div className="glass-panel rounded-2xl p-5 shadow-lg">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Agregar / Actualizar Código</h3>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Código CUPS</label>
                      <input
                        type="text"
                        placeholder="ej. 601T01"
                        value={newCupsEntry.cups}
                        onChange={e => setNewCupsEntry(prev => ({ ...prev, cups: e.target.value.toUpperCase() }))}
                        className="w-36 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                      <label className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Nombre del Procedimiento</label>
                      <input
                        type="text"
                        placeholder="Nombre descriptivo (opcional)"
                        value={newCupsEntry.nombre}
                        onChange={e => setNewCupsEntry(prev => ({ ...prev, nombre: e.target.value }))}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Tipo de Servicio</label>
                      <select
                        value={newCupsEntry.tipo}
                        onChange={e => setNewCupsEntry(prev => ({ ...prev, tipo: e.target.value }))}
                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/30 outline-none min-w-[200px]"
                      >
                        <option value="">— Seleccionar tipo —</option>
                        {metas.map(m => <option key={m.type} value={m.type}>{m.type}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={handleAddCustomCups}
                      disabled={!newCupsEntry.cups || !newCupsEntry.tipo}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-md shadow-blue-500/20"
                    >
                      <Plus className="h-4 w-4" /> Agregar
                    </button>
                  </div>
                </div>

                {customCupsList.length > 0 ? (
                  <div className="glass-panel rounded-2xl overflow-hidden shadow-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100/80 dark:bg-slate-950/60 text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                        <tr>
                          <th className="px-4 py-3 text-left">Código</th>
                          <th className="px-4 py-3 text-left">Nombre</th>
                          <th className="px-4 py-3 text-left">Tipo Servicio</th>
                          <th className="px-4 py-3 text-center w-24">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {customCupsList.map(e => editingCups === e.cups ? (
                          <tr key={e.cups} className="bg-blue-50 dark:bg-blue-500/10">
                            <td className="px-4 py-2 font-mono text-blue-600 dark:text-blue-400 font-medium">{e.cups}</td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={editCupsEntry.nombre}
                                onChange={ev => setEditCupsEntry(prev => ({ ...prev, nombre: ev.target.value }))}
                                className="w-full bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={editCupsEntry.tipo}
                                onChange={ev => setEditCupsEntry(prev => ({ ...prev, tipo: ev.target.value }))}
                                className="bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 w-full"
                              >
                                <option value="">— Seleccionar —</option>
                                {metas.map(m => <option key={m.type} value={m.type}>{m.type}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => {
                                    setCustomCupsList(prev => prev.map(x => x.cups === e.cups ? { ...editCupsEntry, cups: e.cups } : x));
                                    setEditingCups(null);
                                  }}
                                  disabled={!editCupsEntry.tipo}
                                  className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors disabled:opacity-40"
                                  title="Guardar"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button onClick={() => setEditingCups(null)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Cancelar">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={e.cups} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3 font-mono text-blue-600 dark:text-blue-400 font-medium">{e.cups}</td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{e.nombre || <span className="text-slate-400 italic text-xs">Sin nombre</span>}</td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{e.tipo}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => { setEditingCups(e.cups); setEditCupsEntry({ ...e }); }}
                                  className="text-blue-500 hover:text-blue-700 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteCustomCups(e.cups)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Eliminar">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700">
                    No hay códigos CUPS personalizados. El procesamiento usa el mapa predeterminado integrado.
                  </div>
                )}
              </div>
            )}

            {/* --- TIPOS DE SERVICIO --- */}
            {maintTab === 'servicios' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-purple-500" /> Tipos de Servicio
                </h2>

                {/* ── Metas y Periodo ── */}
                <div className="glass-panel rounded-2xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-500" /> Metas y Periodo
                    </h3>
                    <select
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                      className="appearance-none bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm pl-3 pr-8 py-1.5 focus:ring-2 focus:ring-purple-500/50 outline-none cursor-pointer"
                    >
                      <option value="1">Mensual (x1)</option>
                      <option value="2">Bimestral (x2)</option>
                      <option value="3">Trimestral (x3)</option>
                      <option value="6">Semestral (x6)</option>
                      <option value="12">Anual (x12)</option>
                    </select>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto pr-1 custom-scroll">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100/80 dark:bg-slate-900/40 sticky top-0">
                        <tr>
                          <th className="px-3 py-2">On</th>
                          <th className="px-3 py-2">Servicio</th>
                          <th className="px-3 py-2 text-right">Meta Mes</th>
                          <th className="px-3 py-2 text-right">Progreso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                        {metas.map((m, idx) => (
                          <tr key={idx} className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={m.active}
                                onChange={(e) => { const nm = [...metas]; nm[idx].active = e.target.checked; setMetas(nm); }}
                                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500/30 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300 text-xs font-medium">{m.type}</td>
                            <td className="px-3 py-2.5 text-right">
                              <input
                                type="number"
                                value={m.monthlyGoal}
                                onChange={(e) => { const nm = [...metas]; nm[idx].monthlyGoal = Number(e.target.value); setMetas(nm); }}
                                className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-right text-xs font-mono text-emerald-600 dark:text-emerald-400 focus:ring-1 focus:ring-purple-500 outline-none"
                              />
                            </td>
                            <td className="px-3 py-2.5 min-w-[90px]">
                              {(() => {
                                const d = chartData.find(c => c.name === m.type);
                                if (!d || d.meta === 0) return <span className="text-[10px] text-slate-400">—</span>;
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 min-w-[36px]">
                                      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${d.cumplimiento}%`, backgroundColor: d.color }} />
                                    </div>
                                    <span className="text-[10px] font-mono font-bold" style={{ color: d.color }}>{d.cumplimiento}%</span>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl p-5 shadow-lg">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Agregar Tipo</h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Nombre del tipo de servicio"
                      value={newTipoInput}
                      onChange={e => setNewTipoInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddTipoServicio(); }}
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500/30 outline-none"
                    />
                    <button
                      onClick={handleAddTipoServicio}
                      disabled={!newTipoInput.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-md shadow-purple-500/20"
                    >
                      <Plus className="h-4 w-4" /> Agregar
                    </button>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl overflow-hidden shadow-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100/80 dark:bg-slate-950/60 text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left w-10">#</th>
                        <th className="px-4 py-3 text-left">Tipo de Servicio</th>
                        <th className="px-4 py-3 text-right">Meta Mensual</th>
                        {isAdmin && <th className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">Renuencias y Búsquedas Fallidas</th>}
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-center w-16">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {metas.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                            {m.type}
                            {TIPOS_SERVICIOS_DEFAULT.includes(m.type) && (
                              <span className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">base</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{m.monthlyGoal || '—'}</td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number" min="0"
                                value={m.renuencias || 0}
                                onChange={e => setMetas(prev => prev.map((x, i) => i === idx ? { ...x, renuencias: Number(e.target.value) } : x))}
                                className="w-24 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 rounded-md px-2 py-1 text-right text-xs font-mono text-amber-600 dark:text-amber-400 focus:ring-1 focus:ring-amber-500 outline-none"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.active ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                              {m.active ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!TIPOS_SERVICIOS_DEFAULT.includes(m.type) && (
                              <button onClick={() => handleDeleteTipoServicio(m.type)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- USUARIOS (Admin only) --- */}
            {maintTab === 'usuarios' && isAdmin && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-500" /> Gestión de Usuarios
                  </h2>
                  <button
                    onClick={() => { setUserForm({ username: '', password: '', nombre: '', role: 'general', permissions: ['dashboard','carga','prestadores','actas'] }); setEditUser(null); setShowUserForm(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-indigo-500/20"
                  >
                    <Plus className="h-4 w-4" /> Nuevo Usuario
                  </button>
                </div>

                <div className="glass-panel rounded-2xl overflow-hidden shadow-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100/80 dark:bg-slate-950/60 text-xs uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                      <tr>
                        <th className="px-4 py-3 text-left">Nombre</th>
                        <th className="px-4 py-3 text-left">Usuario</th>
                        <th className="px-4 py-3 text-center">Rol</th>
                        <th className="px-4 py-3 text-center w-24">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                            {u.nombre}
                            {u.id === currentUser?.id && (
                              <span className="ml-2 text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold">Tú</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{u.username}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                              {u.role === 'admin' ? 'Admin' : 'General'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => { setEditUser(u); setUserForm({ username: u.username, password: u.password, nombre: u.nombre, role: u.role, permissions: u.permissions ?? ['dashboard','carga','prestadores','actas'] }); setShowUserForm(true); }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors"
                                title="Editar"
                              ><Pencil className="h-4 w-4" /></button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-500 hover:text-red-500 transition-colors"
                                title="Eliminar"
                              ><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {/* --- User Form Modal --- */}
      {showUserForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                {editUser ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h2>
              <button onClick={() => { setShowUserForm(false); setEditUser(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Nombre Completo</label>
                <input
                  type="text" value={userForm.nombre}
                  onChange={e => setUserForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Juan Pérez"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Nombre de Usuario</label>
                <input
                  type="text" value={userForm.username}
                  onChange={e => setUserForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="juanperez"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Contraseña</label>
                <input
                  type="text" value={userForm.password}
                  onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="contraseña"
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none font-mono"
                />
              </div>
              {/* Rol base */}
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-2">Tipo de Acceso</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'general', label: 'General',        desc: 'Permisos personalizados', icon: '👤', color: 'indigo' },
                    { value: 'admin',   label: 'Administrador',  desc: 'Acceso completo',          icon: '🛡️', color: 'violet' },
                  ] as { value: 'admin'|'general'; label: string; desc: string; icon: string; color: string }[]).map(opt => {
                    const selected = userForm.role === opt.value;
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setUserForm(p => ({ ...p, role: opt.value }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${selected ? (opt.color === 'violet' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20') : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-slate-50 dark:bg-slate-900'}`}>
                        <div className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? (opt.color === 'violet' ? 'border-violet-500' : 'border-indigo-500') : 'border-slate-300 dark:border-slate-600'}`}>
                          {selected && <div className={`w-2 h-2 rounded-full ${opt.color === 'violet' ? 'bg-violet-500' : 'bg-indigo-500'}`} />}
                        </div>
                        <span>{opt.icon}</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{opt.label}</p>
                          <p className="text-[10px] text-slate-400">{opt.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permisos granulares — solo para rol General */}
              {userForm.role === 'general' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Permisos</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setUserForm(p => ({ ...p, permissions: ALL_PERMISSIONS.map(x => x.key) }))}
                        className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium">Todos</button>
                      <span className="text-slate-300">|</span>
                      <button type="button" onClick={() => setUserForm(p => ({ ...p, permissions: [] }))}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-medium">Ninguno</button>
                    </div>
                  </div>
                  <div className="space-y-1.5 border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50">
                    {ALL_PERMISSIONS.map(perm => {
                      const checked = userForm.permissions.includes(perm.key);
                      return (
                        <label key={perm.key}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${checked ? 'bg-white dark:bg-slate-800 shadow-sm' : 'hover:bg-white/60 dark:hover:bg-slate-800/40'}`}>
                          <div
                            onClick={() => setUserForm(p => ({
                              ...p,
                              permissions: checked ? p.permissions.filter(k => k !== perm.key) : [...p.permissions, perm.key]
                            }))}
                            className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'}`}>
                            {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-base leading-none">{perm.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{perm.label}</p>
                            <p className="text-xs text-slate-400 truncate">{perm.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {userForm.role === 'admin' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                  <ShieldCheck className="h-4 w-4 text-violet-500 shrink-0" />
                  <p className="text-xs text-violet-700 dark:text-violet-300">Acceso completo a todas las funciones del sistema</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
              <button
                onClick={() => { setShowUserForm(false); setEditUser(null); }}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >Cancelar</button>
              <button
                onClick={handleSaveUser}
                disabled={!userForm.username.trim() || !userForm.password.trim() || !userForm.nombre.trim()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
              >{editUser ? 'Actualizar' : 'Crear'} Usuario</button>
            </div>
          </div>
        </div>
      )}

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
            {/* --- MONITOR (Admin only) --- */}
            {maintTab === 'monitor' && isAdmin && (() => {
              const fmt = (b: number) => b >= 1048576 ? `${(b/1048576).toFixed(2)} MB` : b >= 1024 ? `${(b/1024).toFixed(1)} KB` : `${b} B`;
              const pct = (used: number, total: number) => total > 0 ? Math.min(100, Math.round(used/total*100)) : 0;
              const s = monitorStats;
              const heapPct    = s ? pct(s.heapUsed, s.heapLimit) : 0;
              const lsPct      = s ? pct(s.lsUsed, 5242880) : 0;   // localStorage ~5 MB limit
              const stPct      = s ? pct(s.storageUsage, s.storageQuota) : 0;
              const upFmt = (sec: number) => { const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),ss=sec%60; return `${h}h ${m}m ${ss}s`; };
              const barColor = (p: number) => p < 60 ? 'bg-emerald-500' : p < 85 ? 'bg-amber-500' : 'bg-red-500';

              return (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Monitor de Recursos</h2>
                    <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> EN VIVO
                    </span>
                    {s && <span className="ml-auto text-xs text-slate-400">Activo: {upFmt(s.uptime)}</span>}
                  </div>

                  {!s ? (
                    <p className="text-sm text-slate-400">Cargando métricas...</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                      {/* Memoria JS Heap */}
                      <div className="glass-panel rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <Server className="h-4 w-4 text-indigo-500" /> Memoria JavaScript
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Usada: <span className="font-bold text-slate-700 dark:text-slate-200">{fmt(s.heapUsed)}</span></span>
                            <span>{heapPct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor(heapPct)}`} style={{ width: `${heapPct}%` }} />
                          </div>
                          <div className="text-xs text-slate-400">Total asignada: {fmt(s.heapTotal)} / Límite: {fmt(s.heapLimit)}</div>
                        </div>
                      </div>

                      {/* localStorage */}
                      <div className="glass-panel rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <Database className="h-4 w-4 text-blue-500" /> LocalStorage
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Usado: <span className="font-bold text-slate-700 dark:text-slate-200">{fmt(s.lsUsed)}</span></span>
                            <span>{lsPct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor(lsPct)}`} style={{ width: `${lsPct}%` }} />
                          </div>
                          <div className="text-xs text-slate-400">Límite navegador: ~5 MB</div>
                        </div>
                        <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto custom-scroll">
                          {s.lsKeys.map(k => (
                            <div key={k.key} className="flex justify-between text-xs">
                              <span className="text-slate-500 truncate max-w-[70%]">{k.key}</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300 shrink-0">{fmt(k.size)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Origin Storage (IndexedDB + Cache + SW) */}
                      <div className="glass-panel rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <HardDrive className="h-4 w-4 text-purple-500" /> Almacenamiento Origen
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Usado: <span className="font-bold text-slate-700 dark:text-slate-200">{fmt(s.storageUsage)}</span></span>
                            <span>{stPct}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor(stPct)}`} style={{ width: `${stPct}%` }} />
                          </div>
                          <div className="text-xs text-slate-400">Cuota total: {fmt(s.storageQuota)}</div>
                        </div>
                        <p className="text-xs text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">Incluye: localStorage, IndexedDB, Cache API</p>
                      </div>

                      {/* Registros */}
                      <div className="glass-panel rounded-2xl p-5 space-y-3 md:col-span-2 xl:col-span-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <ClipboardList className="h-4 w-4 text-emerald-500" /> Registros en App
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: 'Prestadores', val: prestadores.length, color: 'text-indigo-500' },
                            { label: 'Actas',       val: actas.length,       color: 'text-blue-500' },
                            { label: 'Usuarios',    val: users.length,       color: 'text-purple-500' },
                            { label: 'CUPS custom', val: customCupsList.length, color: 'text-emerald-500' },
                          ].map(item => (
                            <div key={item.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 text-center">
                              <p className={`text-2xl font-bold ${item.color}`}>{item.val}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })()}

        </div>
      )}
        {/* ===== ACTAS TAB ===== */}
        {activeTab === 'actas' && (
          <div className="space-y-4 animate-in fade-in duration-300">

            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-indigo-500" /> Actas de Evaluación
                </h2>
                {/* Acta selector (when multiple saved) */}
                {actas.length > 1 && !inlineActa && (
                  <div className="flex gap-1 flex-wrap">
                    {actas.map((a, i) => (
                      <button key={a.id} onClick={() => setInlineActa({ ...a })}
                        className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors border border-slate-200 dark:border-slate-700">
                        {a.numero}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                {inlineActa && (
                  <button onClick={() => setInlineActa(null)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Volver a lista
                  </button>
                )}
                {prestadores.length > 0 && (
                  <button
                    onClick={() => {
                      const p = detectedPrestadorId ? prestadores.find(x => x.id === detectedPrestadorId) : null;
                      if (p) handleGenerarActa(p);
                      else setMessage({ type: 'error', text: 'Selecciona un prestador en el Dashboard primero.' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-indigo-500/20 whitespace-nowrap">
                    <Plus className="h-4 w-4" /> Nueva Acta
                  </button>
                )}
                {prestadores.length === 0 && (
                  <button onClick={() => { setActiveTab('mantenimiento'); setMaintTab('prestadores'); }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                    <Building2 className="h-4 w-4" /> Configurar Prestadores
                  </button>
                )}
              </div>
            </div>

            {/* ── Inline editor: always show a template ── */}
            {inlineActa ? (
              <ActaModal
                inline
                acta={inlineActa}
                onChange={a => setInlineActa(a)}
                onSave={handleSaveInlineActa}
                onClose={() => setInlineActa(null)}
                funcionarios={funcionarios}
                onAddFuncionario={handleAddFuncionario}
                onRemoveFuncionario={handleRemoveFuncionario}
                firmasGlobales={firmasGlobales}
                onSaveFirmaGlobal={handleSaveFirmaGlobal}
              />
            ) : (
              <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-5 border-2 border-dashed border-slate-300 dark:border-slate-700">
                <ClipboardList className="h-14 w-14 text-slate-300 dark:text-slate-700" />
                <div>
                  <p className="font-bold text-slate-600 dark:text-slate-300 text-lg">Actas de Evaluación</p>
                  <p className="text-sm text-slate-400 mt-1">Genera una nueva acta o carga una ya guardada</p>
                </div>
                <div className="flex gap-3 flex-wrap justify-center">
                  <button
                    onClick={() => setInlineActa(makeBlankActa())}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-all shadow-md shadow-indigo-500/20"
                  >
                    <Plus className="h-4 w-4" /> Abrir plantilla en blanco
                  </button>
                  {actas.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-center">
                      {actas.map(a => (
                        <button key={a.id} onClick={() => setInlineActa({ ...a })}
                          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-mono font-medium transition-all border border-slate-200 dark:border-slate-700">
                          {a.numero || 'Acta sin número'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!inlineActa && actas.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {actas.map(a => {
                  const totalProg = a.servicios.reduce((s, x) => s + x.programado, 0);
                  const totalEjec = a.servicios.reduce((s, x) => s + x.ejecutado, 0);
                  const cumpl = totalProg > 0 ? Math.min(Math.round((totalEjec / totalProg) * 100), 100) : 0;
                  const color = cumpl >= 100 ? '#10b981' : cumpl >= 80 ? '#eab308' : '#ef4444';
                  return (
                    <button key={a.id} onClick={() => setInlineActa({ ...a })}
                      className="glass-panel rounded-2xl p-5 text-left shadow-lg hover:shadow-xl transition-all group hover:-translate-y-0.5 w-full">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{a.numero}</p>
                          <p className="font-semibold text-slate-800 dark:text-white text-sm leading-tight mt-0.5">{a.empresa}</p>
                        </div>
                        <span className="text-2xl font-bold" style={{ color }}>{cumpl}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-3">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${cumpl}%`, backgroundColor: color }} />
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {a.periodoEvaluado && <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{a.periodoEvaluado}</span>}
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{a.fechaActa}</span>
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{a.servicios.length} servicios</span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline">
                          Ver / Editar acta →
                        </span>
                        <button onClick={e => { e.stopPropagation(); handleDeleteActa(a.id); }}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {/* --- Acta Modal --- */}
      {showActaModal && editingActa && (
        <ActaModal
          acta={editingActa}
          onChange={setEditingActa}
          onSave={handleSaveActa}
          onClose={() => { setShowActaModal(false); setEditingActa(null); }}
          funcionarios={funcionarios}
          onAddFuncionario={handleAddFuncionario}
          onRemoveFuncionario={handleRemoveFuncionario}
          firmasGlobales={firmasGlobales}
          onSaveFirmaGlobal={handleSaveFirmaGlobal}
        />
      )}

      {/* --- Prestador Form Modal --- */}
      {showPrestForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <Building2 className="h-5 w-5 text-indigo-500" />
                {editPrest ? 'Editar Prestador' : 'Nuevo Prestador'}
              </h2>
              <button onClick={() => { setShowPrestForm(false); setEditPrest(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([
                  { key: 'nombre',       label: 'Nombre del Prestador',       placeholder: 'Hospital San José...',       full: true },
                  { key: 'nit',          label: 'NIT',                         placeholder: '900123456-1',                full: false },
                  { key: 'departamento', label: 'Departamento',                placeholder: 'Cesar',                      full: false },
                  { key: 'municipio',    label: 'Municipio',                   placeholder: 'Valledupar',                 full: false },
                  { key: 'contrato',     label: 'N° de Contrato',              placeholder: '20570-093-AS',               full: false },
                  { key: 'vigencia',     label: 'Vigencia del Contrato',       placeholder: '01/01/2025 - 31/12/2025',    full: false },
                  { key: 'repLegalIPS',  label: 'Representante Legal IPS',     placeholder: 'Nombre completo',            full: true },
                ] as {key: keyof Omit<Prestador,'id'|'metas'>, label: string, placeholder: string, full: boolean}[]).map(({ key, label, placeholder, full }) => (
                  <div key={key} className={full ? 'sm:col-span-2' : ''}>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={prestForm[key] as string}
                      onChange={e => setPrestForm(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Régimen</label>
                  <select
                    value={prestForm.regimen || 'SUBSIDIADO'}
                    onChange={e => setPrestForm(prev => ({ ...prev, regimen: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 outline-none transition-all"
                  >
                    <option value="SUBSIDIADO">SUBSIDIADO</option>
                    <option value="CONTRIBUTIVO">CONTRIBUTIVO</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" /> Metas Mensuales por Servicio
                </h3>
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100/80 dark:bg-slate-950/60 text-xs uppercase text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-2 text-left">Servicio</th>
                        <th className="px-4 py-2 text-center w-40">Estado</th>
                        <th className="px-4 py-2 text-right w-32">Meta Mensual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {prestForm.metas.map((m, idx) => (
                        <tr key={idx} className={`transition-colors ${m.active ? 'hover:bg-slate-50 dark:hover:bg-slate-800/30' : 'bg-slate-50/60 dark:bg-slate-950/40 opacity-60'}`}>
                          <td className="px-4 py-2 text-slate-700 dark:text-slate-300 text-xs">{m.type}</td>
                          <td className="px-4 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const newMetas = [...prestForm.metas];
                                newMetas[idx] = { ...newMetas[idx], active: !newMetas[idx].active };
                                setPrestForm(prev => ({ ...prev, metas: newMetas }));
                              }}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                                m.active
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-200'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {m.active ? '✓ CONTRATADO' : '✗ NO CONTRATADO'}
                            </button>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {m.active ? (
                              <input
                                type="number"
                                min="0"
                                value={m.monthlyGoal}
                                onChange={e => {
                                  const newMetas = [...prestForm.metas];
                                  newMetas[idx] = { ...newMetas[idx], monthlyGoal: Number(e.target.value) };
                                  setPrestForm(prev => ({ ...prev, metas: newMetas }));
                                }}
                                className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 text-right text-xs font-mono text-emerald-600 dark:text-emerald-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                              />
                            ) : (
                              <span className="text-xs text-slate-400 italic">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
              <button
                onClick={() => { setShowPrestForm(false); setEditPrest(null); }}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePrestador}
                disabled={!prestForm.nombre.trim() || !prestForm.nit.trim()}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50"
              >
                {editPrest ? 'Actualizar' : 'Guardar'} Prestador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== REPORTES TAB ===== */}
      {activeTab === 'reportes' && (
        <div className="animate-in fade-in duration-300">
          <ReportesTab actas={actas} prestadores={prestadores} />
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