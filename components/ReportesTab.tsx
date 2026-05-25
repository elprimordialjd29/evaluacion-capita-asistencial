import React, { useState, useMemo, useRef } from 'react';
import { utils, writeFile } from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell
} from 'recharts';
import {
  FileText, Download, Printer, TrendingUp, Building2,
  Calendar, ClipboardList, Search, ChevronUp, ChevronDown
} from 'lucide-react';
import { Acta, Prestador } from '../types';

interface Props { actas: Acta[]; prestadores: Prestador[]; }

// ── Helpers ─────────────────────────────────────────────────────────────────
const pctGlobal = (a: Acta) => {
  const tot = a.servicios.reduce((s, sv) => s + sv.programado, 0);
  const exe = a.servicios.reduce((s, sv) => s + Math.min(sv.ejecutado, sv.programado), 0);
  return tot > 0 ? Math.min(Math.round(exe / tot * 100), 100) : 0;
};
const pctSvc = (programado: number, ejecutado: number) =>
  programado > 0 ? Math.min(Math.round(Math.min(ejecutado, programado) / programado * 100), 100) : 0;

const badge = (p: number) =>
  p >= 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
  : p >= 80  ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
  : p >= 50  ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
  :            'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300';

const barColor = (p: number) =>
  p >= 100 ? '#10b981' : p >= 80 ? '#f59e0b' : p >= 50 ? '#f97316' : '#ef4444';

const ProgressBar = ({ value }: { value: number }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${value}%`, backgroundColor: barColor(value) }}
      />
    </div>
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold min-w-[46px] text-center ${badge(value)}`}>
      {value}%
    </span>
  </div>
);

const Medal = ({ pos }: { pos: number }) => {
  if (pos === 1) return <span className="text-base">🥇</span>;
  if (pos === 2) return <span className="text-base">🥈</span>;
  if (pos === 3) return <span className="text-base">🥉</span>;
  return <span className="text-xs font-bold text-slate-400">{pos}</span>;
};

// ── PDF print helper ─────────────────────────────────────────────────────────
function printArea(id: string, title: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  const styles = Array.from(document.styleSheets)
    .flatMap(s => { try { return Array.from(s.cssRules).map(r => r.cssText); } catch { return []; } })
    .join('\n');
  w.document.write(`
    <html><head><title>${title}</title>
    <style>
      ${styles}
      body { font-family: sans-serif; padding: 16px; color: #111; background: white; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th, td { border: 1px solid #9ca3af; padding: 4px 8px; }
      th { background: #e5e7eb; font-weight: 700; text-transform: uppercase; }
      .green { background: #d1fae5; color: #065f46; }
      .amber { background: #fef3c7; color: #92400e; }
      .red   { background: #fee2e2; color: #991b1b; }
      @page { size: letter landscape; margin: 12mm; }
    </style></head><body>
    <h2 style="margin:0 0 12px;font-size:14px">${title}</h2>
    ${el.innerHTML}
    </body></html>`);
  w.document.close();
  setTimeout(() => { w.print(); }, 400);
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1 max-w-[180px] truncate">{label}</p>
      <p style={{ color: barColor(val) }} className="font-bold text-sm">{val}%</p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
export default function ReportesTab({ actas, prestadores }: Props) {
  type RT = 'consolidado' | 'ranking' | 'prestador' | 'periodo';
  const [tab, setTab] = useState<RT>('consolidado');

  const [fPrest, setFPrest]     = useState('');
  const [fPeriodo, setFPeriodo] = useState('');
  const [fReg, setFReg]         = useState('');

  const [selPrest, setSelPrest]     = useState('');
  const [prestSearch, setPrestSearch] = useState('');
  const [showPS, setShowPS]         = useState(false);
  const [selPeriodo, setSelPeriodo] = useState('');

  const [sortCol, setSortCol] = useState<'pctAvg'|'actas'|'pctMin'|'pctMax'>('pctAvg');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');

  const allPeriodos = useMemo(() =>
    [...new Set(actas.map(a => a.periodoEvaluado).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    [actas]);
  const allRegimenes = useMemo(() =>
    [...new Set(actas.map(a => (a.regimen||'SUBSIDIADO').toUpperCase()))].sort(),
    [actas]);
  const allPrestadores = useMemo(() =>
    [...new Map(actas.map(a => [a.prestadorId, { id: a.prestadorId, nombre: a.empresa, contrato: a.contrato }])).values()],
    [actas]);

  // ── 1. CONSOLIDADO ────────────────────────────────────────────────────
  const consolidado = useMemo(() =>
    actas.filter(a =>
      (!fPrest || a.prestadorId === fPrest) &&
      (!fPeriodo || a.periodoEvaluado === fPeriodo) &&
      (!fReg || (a.regimen||'SUBSIDIADO').toUpperCase() === fReg)
    ).map(a => ({ ...a, pct: pctGlobal(a) }))
     .sort((a, b) => b.fechaActa.localeCompare(a.fechaActa)),
    [actas, fPrest, fPeriodo, fReg]);

  const exportConsolidadoXlsx = () => {
    const rows = consolidado.map(a => {
      const base: Record<string, string|number> = {
        'N° Acta': a.numero, 'Prestador': a.empresa, 'Contrato': a.contrato,
        'Régimen': a.regimen, 'Período': a.periodoEvaluado, 'Fecha Acta': a.fechaActa,
        '% Global': a.pct,
      };
      a.servicios.forEach(s => { base[`${s.tipo} %`] = pctSvc(s.programado, s.ejecutado); });
      return base;
    });
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Consolidado');
    writeFile(wb, 'Reporte_Consolidado_Actas.xlsx');
  };

  // ── 2. RANKING ────────────────────────────────────────────────────────
  const ranking = useMemo(() => {
    const map = new Map<string, { id:string; nombre:string; contrato:string; regimen:string; actas:number; sum:number; min:number; max:number }>();
    actas.forEach(a => {
      const p = pctGlobal(a);
      if (!map.has(a.prestadorId)) map.set(a.prestadorId, { id: a.prestadorId, nombre: a.empresa, contrato: a.contrato, regimen: a.regimen||'SUBSIDIADO', actas:0, sum:0, min:200, max:0 });
      const e = map.get(a.prestadorId)!;
      e.actas++; e.sum += p; e.min = Math.min(e.min, p); e.max = Math.max(e.max, p);
    });
    const arr = [...map.values()].map(e => ({ ...e, pctAvg: Math.round(e.sum / e.actas) }));
    arr.sort((a, b) => sortDir === 'desc' ? b[sortCol] - a[sortCol] : a[sortCol] - b[sortCol]);
    return arr;
  }, [actas, sortCol, sortDir]);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir('desc'); }
  };
  const SortIcon = ({ col }: { col: typeof sortCol }) =>
    sortCol !== col ? null : sortDir === 'desc'
      ? <ChevronDown className="h-3 w-3 inline ml-0.5" />
      : <ChevronUp className="h-3 w-3 inline ml-0.5" />;

  const exportRankingXlsx = () => {
    const rows = ranking.map((e, i) => ({
      '#': i+1, 'Prestador': e.nombre, 'Contrato': e.contrato, 'Régimen': e.regimen,
      'N° Actas': e.actas, '% Promedio': e.pctAvg, '% Mínimo': e.min, '% Máximo': e.max,
    }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Ranking');
    writeFile(wb, 'Ranking_Prestadores.xlsx');
  };

  // Nombre corto para gráfica
  const shortName = (nombre: string) => {
    const words = nombre.trim().split(/\s+/);
    if (words.length <= 2) return nombre;
    return words.slice(0, 2).join(' ');
  };

  // ── 3. POR PRESTADOR ─────────────────────────────────────────────────
  const prestActas = useMemo(() =>
    selPrest
      ? actas.filter(a => a.prestadorId === selPrest)
          .map(a => ({ ...a, pct: pctGlobal(a) }))
          .sort((a, b) => a.periodoEvaluado.localeCompare(b.periodoEvaluado))
      : [],
    [actas, selPrest]);

  const chartDataPrest = prestActas.map(a => ({ periodo: a.periodoEvaluado, pct: a.pct }));

  const allServiceTypes = useMemo(() => {
    const types = new Set<string>();
    prestActas.forEach(a => a.servicios.forEach(s => types.add(s.tipo)));
    return [...types];
  }, [prestActas]);

  const exportPrestadorXlsx = () => {
    if (!selPrest) return;
    const rows = prestActas.map(a => {
      const row: Record<string, string|number> = {
        'N° Acta': a.numero, 'Período': a.periodoEvaluado, 'Fecha Acta': a.fechaActa, '% Global': a.pct,
      };
      a.servicios.forEach(s => { row[`${s.tipo} Prog.`] = s.programado; row[`${s.tipo} Ejec.`] = Math.min(s.ejecutado, s.programado); row[`${s.tipo} %`] = pctSvc(s.programado, s.ejecutado); });
      return row;
    });
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Por Prestador');
    const nombre = prestadores.find(p => p.id === selPrest)?.nombre || selPrest;
    writeFile(wb, `Reporte_${nombre.slice(0,30).replace(/\s+/g,'_')}.xlsx`);
  };

  // ── 4. POR PERÍODO ────────────────────────────────────────────────────
  const periodoData = useMemo(() =>
    selPeriodo
      ? actas.filter(a => a.periodoEvaluado === selPeriodo)
          .map(a => ({ ...a, pct: pctGlobal(a) }))
          .sort((a, b) => b.pct - a.pct)
      : [],
    [actas, selPeriodo]);

  const exportPeriodoXlsx = () => {
    if (!selPeriodo) return;
    const rows = periodoData.map((a, i) => {
      const row: Record<string, string|number> = {
        '#': i+1, 'Prestador': a.empresa, 'Contrato': a.contrato, 'Régimen': a.regimen||'SUBSIDIADO',
        'N° Acta': a.numero, 'Fecha Acta': a.fechaActa, '% Global': a.pct,
      };
      a.servicios.forEach(s => { row[`${s.tipo} %`] = pctSvc(s.programado, s.ejecutado); });
      return row;
    });
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), selPeriodo);
    writeFile(wb, `Reporte_Periodo_${selPeriodo.replace(/\s+/g,'_')}.xlsx`);
  };

  // ── Summary stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!actas.length) return null;
    const pcts = actas.map(pctGlobal);
    const avg = Math.round(pcts.reduce((a,b) => a+b, 0) / pcts.length);
    const al100 = pcts.filter(p => p >= 100).length;
    const below80 = pcts.filter(p => p < 80).length;
    return { avg, al100, below80, total: actas.length };
  }, [actas]);

  // ── Tab buttons ────────────────────────────────────────────────────────
  const tabs: { key: RT; label: string; icon: React.ReactNode }[] = [
    { key: 'consolidado', label: 'Consolidado',    icon: <ClipboardList className="h-4 w-4" /> },
    { key: 'ranking',     label: 'Ranking',        icon: <TrendingUp className="h-4 w-4" /> },
    { key: 'prestador',   label: 'Por Prestador',  icon: <Building2 className="h-4 w-4" /> },
    { key: 'periodo',     label: 'Por Período',    icon: <Calendar className="h-4 w-4" /> },
  ];

  const inputCls = 'w-full px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const btnXls   = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors';
  const btnPdf   = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors';

  return (
    <div className="space-y-5 animate-in fade-in duration-300">

      {/* Header + KPIs */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-500" /> Reportes
        </h2>
        {stats && (
          <div className="flex gap-3 flex-wrap">
            <div className="glass-panel rounded-xl px-4 py-2 text-center min-w-[90px]">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Actas</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
            </div>
            <div className="glass-panel rounded-xl px-4 py-2 text-center min-w-[90px]">
              <p className="text-xs text-slate-500 uppercase font-semibold">% Promedio</p>
              <p className={`text-2xl font-bold ${stats.avg >= 80 ? 'text-emerald-600' : stats.avg >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{stats.avg}%</p>
            </div>
            <div className="glass-panel rounded-xl px-4 py-2 text-center min-w-[90px]">
              <p className="text-xs text-slate-500 uppercase font-semibold">Al 100%</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.al100}</p>
            </div>
            <div className="glass-panel rounded-xl px-4 py-2 text-center min-w-[90px]">
              <p className="text-xs text-slate-500 uppercase font-semibold">Bajo 80%</p>
              <p className="text-2xl font-bold text-red-600">{stats.below80}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? 'bg-indigo-600 text-white shadow-md' : 'glass-panel text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ══ 1. CONSOLIDADO ══════════════════════════════════════════════════ */}
      {tab === 'consolidado' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Prestador</label>
              <select value={fPrest} onChange={e => setFPrest(e.target.value)} className={inputCls}>
                <option value="">— Todos —</option>
                {allPrestadores.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.contrato})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Período</label>
              <select value={fPeriodo} onChange={e => setFPeriodo(e.target.value)} className={inputCls}>
                <option value="">— Todos —</option>
                {allPeriodos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Régimen</label>
              <select value={fReg} onChange={e => setFReg(e.target.value)} className={inputCls}>
                <option value="">— Todos —</option>
                {allRegimenes.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">{consolidado.length} registro{consolidado.length !== 1 ? 's' : ''}</span>
            <div className="flex gap-2">
              <button onClick={exportConsolidadoXlsx} disabled={consolidado.length === 0} className={btnXls}><Download className="h-3.5 w-3.5" /> Excel</button>
              <button onClick={() => printArea('rpt-consolidado', 'Consolidado de Actas')} disabled={consolidado.length === 0} className={btnPdf}><Printer className="h-3.5 w-3.5" /> PDF</button>
            </div>
          </div>

          {consolidado.length === 0 ? (
            <p className="text-center text-slate-400 py-10">No hay actas con los filtros seleccionados.</p>
          ) : (
            <div id="rpt-consolidado" className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500">
                    <th className="px-3 py-3 text-left">N° Acta</th>
                    <th className="px-3 py-3 text-left">Prestador</th>
                    <th className="px-3 py-3 text-left">Régimen</th>
                    <th className="px-3 py-3 text-left">Período</th>
                    <th className="px-3 py-3 text-left">Fecha</th>
                    <th className="px-3 py-3 text-left min-w-[180px]">% Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {consolidado.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{a.numero}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs leading-tight">{a.empresa}</p>
                        <p className="text-[10px] text-slate-400">{a.contrato}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${a.regimen === 'CONTRIBUTIVO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'}`}>
                          {a.regimen||'SUBSIDIADO'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 max-w-[180px]">{a.periodoEvaluado}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">{a.fechaActa}</td>
                      <td className="px-3 py-2.5 min-w-[180px]"><ProgressBar value={a.pct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ 2. RANKING ═════════════════════════════════════════════════════ */}
      {tab === 'ranking' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">{ranking.length} prestador{ranking.length !== 1 ? 'es' : ''}</span>
            <div className="flex gap-2">
              <button onClick={exportRankingXlsx} disabled={ranking.length === 0} className={btnXls}><Download className="h-3.5 w-3.5" /> Excel</button>
              <button onClick={() => printArea('rpt-ranking', 'Ranking de Prestadores')} disabled={ranking.length === 0} className={btnPdf}><Printer className="h-3.5 w-3.5" /> PDF</button>
            </div>
          </div>

          {ranking.length === 0 ? (
            <p className="text-center text-slate-400 py-10">No hay actas registradas.</p>
          ) : (
            <>
              {/* Chart */}
              <div className="glass-panel rounded-2xl p-5">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">% Promedio de Cumplimiento por Prestador</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ranking.slice(0,15).map(e => ({ ...e, nombre: shortName(e.nombre) }))}
                    margin={{ top: 20, right: 10, left: 0, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#64748b' }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="pctAvg" radius={[6,6,0,0]} isAnimationActive={false}
                      label={{ position: 'top', fontSize: 10, fontWeight: 'bold', formatter: (v: number) => `${v}%` }}>
                      {ranking.slice(0,15).map((e, i) => (
                        <Cell key={i} fill={barColor(e.pctAvg)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Leyenda */}
                <div className="flex gap-4 justify-center mt-3 flex-wrap">
                  {[['#10b981','100%'],['#f59e0b','80–99%'],['#f97316','50–79%'],['#ef4444','< 50%']].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div id="rpt-ranking" className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500">
                      <th className="px-4 py-3 text-center w-10">#</th>
                      <th className="px-4 py-3 text-left">Prestador</th>
                      <th className="px-4 py-3 text-left">Régimen</th>
                      <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => toggleSort('actas')}>
                        Actas <SortIcon col="actas"/>
                      </th>
                      <th className="px-4 py-3 text-left min-w-[200px] cursor-pointer select-none" onClick={() => toggleSort('pctAvg')}>
                        % Promedio <SortIcon col="pctAvg"/>
                      </th>
                      <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => toggleSort('pctMin')}>
                        Mínimo <SortIcon col="pctMin"/>
                      </th>
                      <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => toggleSort('pctMax')}>
                        Máximo <SortIcon col="pctMax"/>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ranking.map((e, i) => (
                      <tr key={e.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${i === 0 ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}>
                        <td className="px-4 py-3 text-center"><Medal pos={i+1} /></td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight">{e.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{e.contrato}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${e.regimen === 'CONTRIBUTIVO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'}`}>
                            {e.regimen}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-slate-600 dark:text-slate-300">{e.actas}</td>
                        <td className="px-4 py-3 min-w-[200px]"><ProgressBar value={e.pctAvg} /></td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge(e.min)}`}>{e.min}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge(e.max)}`}>{e.max}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ 3. POR PRESTADOR ═══════════════════════════════════════════════ */}
      {tab === 'prestador' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4 space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Seleccionar Prestador</label>
            {selPrest ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {prestadores.find(p => p.id === selPrest)?.nombre || actas.find(a => a.prestadorId === selPrest)?.empresa || selPrest}
                  </p>
                  <p className="text-xs text-slate-500">{prestadores.find(p => p.id === selPrest)?.contrato || actas.find(a => a.prestadorId === selPrest)?.contrato}</p>
                </div>
                <button onClick={() => { setSelPrest(''); setPrestSearch(''); }} className="text-slate-400 hover:text-red-500 text-xl font-bold leading-none">×</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input type="text" placeholder="Buscar por nombre o contrato..."
                  value={prestSearch}
                  onChange={e => { setPrestSearch(e.target.value); setShowPS(true); }}
                  onFocus={() => setShowPS(true)}
                  onBlur={() => setTimeout(() => setShowPS(false), 150)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                {showPS && allPrestadores.filter(p =>
                  !prestSearch || p.nombre.toLowerCase().includes(prestSearch.toLowerCase()) || p.contrato.toLowerCase().includes(prestSearch.toLowerCase())
                ).length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-52 overflow-y-auto custom-scroll">
                    {allPrestadores.filter(p =>
                      !prestSearch || p.nombre.toLowerCase().includes(prestSearch.toLowerCase()) || p.contrato.toLowerCase().includes(prestSearch.toLowerCase())
                    ).map(p => (
                      <li key={p.id} onMouseDown={() => { setSelPrest(p.id); setShowPS(false); setPrestSearch(''); }}
                        className="px-3 py-2 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-b border-slate-100 dark:border-slate-700 last:border-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.nombre}</p>
                        <p className="text-xs text-slate-500">{p.contrato}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {selPrest && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{prestActas.length} acta{prestActas.length !== 1 ? 's' : ''}</span>
                <div className="flex gap-2">
                  <button onClick={exportPrestadorXlsx} className={btnXls}><Download className="h-3.5 w-3.5" /> Excel</button>
                  <button onClick={() => printArea('rpt-prestador', `Cumplimiento: ${actas.find(a => a.prestadorId === selPrest)?.empresa||''}`)} className={btnPdf}><Printer className="h-3.5 w-3.5" /> PDF</button>
                </div>
              </div>

              {prestActas.length === 0 ? (
                <p className="text-center text-slate-400 py-10">No hay actas para este prestador.</p>
              ) : (
                <>
                  <div className="glass-panel rounded-2xl p-5">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">Evolución % Cumplimiento Global</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={chartDataPrest} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="periodo" tick={{ fontSize: 9, fill: '#64748b' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="pct" stroke="#6366f1" strokeWidth={2.5}
                          dot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 7 }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div id="rpt-prestador" className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500">
                          <th className="px-3 py-3 text-left">Período</th>
                          <th className="px-3 py-3 text-left">N° Acta</th>
                          <th className="px-3 py-3 text-left">Fecha</th>
                          {allServiceTypes.map(t => <th key={t} className="px-3 py-3 text-center text-[10px]">{t}</th>)}
                          <th className="px-3 py-3 text-center">% Global</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {prestActas.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-3 py-2.5 text-xs">{a.periodoEvaluado}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-indigo-600 dark:text-indigo-400">{a.numero}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-400">{a.fechaActa}</td>
                            {allServiceTypes.map(t => {
                              const sv = a.servicios.find(s => s.tipo === t);
                              const p = sv ? pctSvc(sv.programado, sv.ejecutado) : null;
                              return <td key={t} className="px-3 py-2.5 text-center">
                                {p !== null
                                  ? <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${badge(p)}`}>{p}%</span>
                                  : <span className="text-slate-300 text-xs">—</span>}
                              </td>;
                            })}
                            <td className="px-3 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge(a.pct)}`}>{a.pct}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ 4. POR PERÍODO ══════════════════════════════════════════════════ */}
      {tab === 'periodo' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Seleccionar Período</label>
            <select value={selPeriodo} onChange={e => setSelPeriodo(e.target.value)} className={inputCls}>
              <option value="">— Seleccionar período —</option>
              {allPeriodos.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {selPeriodo && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{periodoData.length} prestador{periodoData.length !== 1 ? 'es' : ''} evaluado{periodoData.length !== 1 ? 's' : ''}</span>
                <div className="flex gap-2">
                  <button onClick={exportPeriodoXlsx} disabled={periodoData.length === 0} className={btnXls}><Download className="h-3.5 w-3.5" /> Excel</button>
                  <button onClick={() => printArea('rpt-periodo', `Período: ${selPeriodo}`)} disabled={periodoData.length === 0} className={btnPdf}><Printer className="h-3.5 w-3.5" /> PDF</button>
                </div>
              </div>

              {periodoData.length === 0 ? (
                <p className="text-center text-slate-400 py-10">No hay actas para este período.</p>
              ) : (
                <>
                  <div className="glass-panel rounded-2xl p-5">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-4">% Cumplimiento — {selPeriodo}</p>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={periodoData.map(a => ({ nombre: shortName(a.empresa), pct: a.pct }))}
                        margin={{ top: 20, right: 10, left: 0, bottom: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#64748b' }} angle={-40} textAnchor="end" interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${v}%`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="pct" radius={[6,6,0,0]} isAnimationActive={false}
                          label={{ position: 'top', fontSize: 10, fontWeight: 'bold', formatter: (v: number) => `${v}%` }}>
                          {periodoData.map((entry, i) => (
                            <Cell key={i} fill={barColor(entry.pct)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 justify-center mt-3 flex-wrap">
                      {[['#10b981','100%'],['#f59e0b','80–99%'],['#f97316','50–79%'],['#ef4444','< 50%']].map(([color, label]) => (
                        <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div id="rpt-periodo" className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-xs uppercase text-slate-500">
                          <th className="px-4 py-3 text-center w-10">#</th>
                          <th className="px-4 py-3 text-left">Prestador</th>
                          <th className="px-4 py-3 text-left">Régimen</th>
                          <th className="px-4 py-3 text-left">N° Acta</th>
                          <th className="px-4 py-3 text-left">Fecha</th>
                          <th className="px-4 py-3 text-left min-w-[180px]">% Cumplimiento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {periodoData.map((a, i) => (
                          <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 text-center"><Medal pos={i+1} /></td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs leading-tight">{a.empresa}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{a.contrato}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${(a.regimen||'') === 'CONTRIBUTIVO' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'}`}>
                                {a.regimen||'SUBSIDIADO'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-indigo-600 dark:text-indigo-400">{a.numero}</td>
                            <td className="px-4 py-3 text-xs text-slate-400">{a.fechaActa}</td>
                            <td className="px-4 py-3 min-w-[180px]"><ProgressBar value={a.pct} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
