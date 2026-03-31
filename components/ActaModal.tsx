import React, { useState } from 'react';
import { X, Printer, FileSpreadsheet, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, ReferenceLine
} from 'recharts';
import { Acta, ActaServicio } from '../types';
import { utils, writeFile } from 'xlsx';

// ─── helpers ────────────────────────────────────────────────────────────────

export const pct = (srv: ActaServicio): number => {
  if (!srv.programado) return 0;
  return Math.min(Math.round((srv.ejecutado / srv.programado) * 100), 100);
};

const pctColor = (p: number) =>
  p >= 100 ? '#2dd4bf' : p >= 80 ? '#ca8a04' : '#dc2626';

// ─── Static boilerplate (page 2 body text from PDF) ─────────────────────────

const OBS_BULLET = '• Los servicios Asistenciales son objeto de seguimiento en términos de calidad, oportunidad, cobertura y resolutividad, no con finalidad de aplicar descuentos.';

const BOILERPLATE_P2 = `En tal sentido, se realizará el SEGUIMIENTO Y EVALUACIÒN mensual por parte de DUSAKAWI EPSI y de manera trimestral entre las Partes conjuntamente las respectivas REUNIONES DE GESTIÓN COMPARTIDA. En el evento en que, de las actividades de seguimiento y evaluación, así como de las reuniones de gestión compartida se determine el incumplimiento de una o mas metas, el prestador de servicios deberá elaborar presentar ante la EPSI dentro de los cinco (5) días hábiles siguientes a la realización de la reunión de gestión compartida un Plan de Mejoramiento que defina acciones y estrategias que le permita lograr el mayor porcentaje de cumplimiento de las metas incumplidas y las sucesivas. Dentro de los siguientes cinco (5) días hábiles siguientes al recibido del Plan de Mejoramiento, la EPSI deberá aprobar o solicitar los ajustes que considere necesario. La ejecución del Plan de Mejoramiento por parte del CONTRATISTA deberá iniciar al día siguiente de aquel en que se haya notificado su aprobación. La evaluación del Plan de mejoramiento se hará de manera sucesiva y tendrá como corte cada trimestre sucesivo hasta la finalización de la vigencia del contrato y de acuerdo a los resultados se podrá solicitar por la EPSI su ajuste.

Los resultados de la evaluación del cumplimiento de metas registrados en el Acta de Gestión Compartida que se suscribirá por cada trimestre que generen proyección de descuento en contra del prestador será registrada contablemente. Si posterior a la evaluación del Plan de Mejoramiento suscrito por el prestador y en todo caso del trimestre inmediatamente siguiente al de aquel en que se han generado proyección de descuentos el prestador de servicios no lograre subir la meta, la suba parcialmente o la cumpla en su totalidad, respectivamente se procederá a: i) materializar el valor proyectado del descuento en contra del prestador; ii) a descontar la diferencia entre el descuento inicialmente proyectado y las metas subidas en el trimestre inmediatamente siguiente al de aquel de donde proviene el registro contable de la proyección de descuentos y; iii) no aplicar y consecuentemente descargar de la contabilidad el descuento proyectado registrado contablemente. Los descuentos a que hubiere lugar se debitaran de los pagos que tenga pendiente de realizarse al prestador.

Lo anterior no impide que durante lo que reste de la vigencia del contrato el prestador pueda alcanzar el cumplimiento de las metas de los meses anteriores, siempre que sea procedente su acumulación, caso en el cual, se procederá a reconocer el valor que corresponda y se registrará contablemente como una nota crédito a favor del prestador, proporcional a las actividades realizadas y que puedan sumar a las metas que se han registrado incumplidas, considerando que la finalidad de la EPSI es lograr que en la medida de lo posible todas las actividades programadas para la población a las que se han dirigido, sean realizadas y consecuentemente recibidas por esta.`;

function LogoDusakawi({ size = 60 }: { size?: number }) {
  return (
    <img
      src="/logo-dusakawi.jpg"
      alt="DUSAKAWI EPSI"
      style={{ width: size, height: 'auto', objectFit: 'contain', display: 'block' }}
    />
  );
}

// ─── Preview (print-faithful PDF replica) ───────────────────────────────────

export function ActaPreview({ acta }: { acta: Acta }) {
  const totalProg  = acta.servicios.reduce((s, x) => s + x.programado, 0);
  const totalEjec  = acta.servicios.reduce((s, x) => s + x.ejecutado,  0);
  const totalCumpl = totalProg > 0 ? Math.min(Math.round((totalEjec / totalProg) * 100), 100) : 0;

  const chartData = acta.servicios.map(srv => ({
    tipo: srv.tipo,
    pct: pct(srv),
    fill: '#2dd4bf',
  }));

  const th = 'border border-gray-500 bg-gray-200 px-2 py-1 text-center font-bold text-[9px] uppercase';
  const td = 'border border-gray-400 px-2 py-1 text-[9px]';
  const hdr = 'border border-gray-400 px-1.5 py-1 text-[9px]';

  return (
    <div
      id="acta-preview-content"
      className="bg-white text-gray-900 mx-auto print:shadow-none"
      style={{ maxWidth: 800, fontFamily: 'Arial, sans-serif', fontSize: 10 }}
    >
      {/* ══════════════ PAGE 1 ══════════════ */}
      <div className="border-2 border-gray-700">

        {/* ── TITLE BAR: Logo | PROCESO + Título | Código/Versión ── */}
        <div className="grid border-b-2 border-gray-700" style={{ gridTemplateColumns: '72px 1fr 190px' }}>
          <div className="border-r border-gray-500 flex items-center justify-center p-1" style={{ minHeight: 58 }}>
            <LogoDusakawi size={62} />
          </div>
          <div className="flex flex-col items-center justify-center p-1.5 text-center gap-0.5">
            <div className="text-[8px] text-gray-600 uppercase tracking-wide">PROCESO: GESTIÓN DEL RIESGO EN SALUD</div>
            <div className="font-black text-[12px] uppercase leading-tight">ACTA DE EVALUACIÓN DE SERVICIOS</div>
          </div>
          <div className="border-l border-gray-500 p-1.5 text-[8px] leading-snug text-gray-700">
            <div><b>CÓDIGO:</b> DR-BC-AP-F-11</div>
            <div><b>VERSIÓN:</b> 02</div>
            <div><b>EMISIÓN:</b> 15/06/2022</div>
            <div><b>VIGENCIA:</b> 27/12/2022</div>
            <div className="mt-0.5 text-gray-500">PÁGINA 1 DE 2</div>
          </div>
        </div>

        {/* ── ID ROW 1: ACTA N° | FECHA DE EVALUACIÓN | PERIODO EVALUADO ── */}
        <div className="grid border-b border-gray-400" style={{ gridTemplateColumns: '90px 1fr 120px 1fr 110px 1fr' }}>
          <div className={hdr + ' border-l-0 bg-gray-100 font-bold'}><b>ACTA N°:</b></div>
          <div className={hdr}>{acta.numero}</div>
          <div className={hdr + ' bg-gray-100 font-bold'}><b>FECHA DE EVALUACIÓN:</b></div>
          <div className={hdr}>{acta.fechaActa}</div>
          <div className={hdr + ' bg-gray-100 font-bold'}><b>PERIODO EVALUADO:</b></div>
          <div className={hdr + ' border-r-0'}>{acta.periodoEvaluado}</div>
        </div>

        {/* ── ID ROW 2: VIGENCIA DEL CONTRATO | EMPRESA ── */}
        <div className="grid border-b border-gray-400" style={{ gridTemplateColumns: '120px 1.4fr 80px 1.6fr' }}>
          <div className={hdr + ' border-l-0 bg-gray-100 font-bold'}><b>VIGENCIA DEL CONTRATO:</b></div>
          <div className={hdr}>{acta.vigencia}</div>
          <div className={hdr + ' bg-gray-100 font-bold'}><b>EMPRESA:</b></div>
          <div className={hdr + ' border-r-0'}>{acta.empresa}</div>
        </div>

        {/* ── ID ROW 3: NIT | REGIMEN | MUNICIPIO ── */}
        <div className="grid border-b border-gray-400" style={{ gridTemplateColumns: '36px 1fr 60px 1fr 80px 1fr' }}>
          <div className={hdr + ' border-l-0 bg-gray-100 font-bold'}><b>NIT:</b></div>
          <div className={hdr}>{acta.nit}</div>
          <div className={hdr + ' bg-gray-100 font-bold'}><b>REGIMEN:</b></div>
          <div className={hdr}>{acta.regimen}</div>
          <div className={hdr + ' bg-gray-100 font-bold'}><b>MUNICIPIO:</b></div>
          <div className={hdr + ' border-r-0'}>{acta.municipio}</div>
        </div>

        {/* ── ID ROW 4: LUGAR | N° CONTRATO ── */}
        <div className="grid border-b border-gray-400" style={{ gridTemplateColumns: '42px 1.4fr 90px 1.6fr' }}>
          <div className={hdr + ' border-l-0 bg-gray-100 font-bold'}><b>LUGAR:</b></div>
          <div className={hdr}>{acta.lugar}</div>
          <div className={hdr + ' bg-gray-100 font-bold'}><b>N° CONTRATO:</b></div>
          <div className={hdr + ' border-r-0'}>{acta.contrato}</div>
        </div>

        {/* ── PUNTOS A TRATAR ── */}
        <div className="border-b border-gray-400">
          <div className="bg-gray-200 px-2 py-0.5 text-[9px] font-bold uppercase border-b border-gray-400">PUNTOS A TRATAR:</div>
          <div className="px-2 py-1.5 text-[9px]" style={{ minHeight: 36, whiteSpace: 'pre-wrap' }}>{acta.puntosTratar}</div>
        </div>

        {/* ── OBJETIVO ── */}
        <div className="border-b border-gray-400">
          <div className="bg-gray-200 px-2 py-0.5 text-[9px] font-bold uppercase border-b border-gray-400">OBJETIVO:</div>
          <div className="px-2 py-1.5 text-[9px]" style={{ minHeight: 28, whiteSpace: 'pre-wrap' }}>{acta.objetivo}</div>
        </div>

        {/* ── DESARROLLO Y CONCLUSIONES ── */}
        <div className="border-b border-gray-400">
          <div className="bg-gray-200 px-2 py-0.5 text-[9px] font-bold uppercase border-b border-gray-400">DESARROLLO Y CONCLUSIONES:</div>

          {/* Párrafo ANTES del gráfico */}
          {acta.desarrolloYConclusiones && (
            <div className="px-2 py-1.5 text-[9px]" style={{ textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
              {acta.desarrolloYConclusiones}
            </div>
          )}

          {/* Gráfica 1 */}
          {chartData.length > 0 && (
            <div className="border-t border-gray-300">
              <div className="text-center pt-1 text-[9px] font-semibold text-gray-700">Servicios Asistenciales</div>
              <div style={{ width: '100%', height: Math.max(260, chartData.length * 40 + 80) }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={200}>
                  <BarChart data={chartData} margin={{ top: 16, right: 30, left: 10, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="tipo" tick={{ fontSize: 7, fill: '#374151' }} angle={-45} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 120]} ticks={[0, 20, 40, 60, 80, 100, 120]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 8 }} />
                    <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="3 3" />
                    <Tooltip formatter={(v: number) => [`${v}%`, '% Cumplimiento']} contentStyle={{ fontSize: 10 }} />
                    <Bar dataKey="pct" radius={[3, 3, 0, 0]} minPointSize={3} isAnimationActive={false}>
                      <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v}%`} style={{ fontSize: 8, fontWeight: 'bold', fill: '#000000' }} />
                      {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Párrafo DESPUÉS del gráfico */}
          {acta.desarrolloConclusionesPost && (
            <div className="px-2 py-1.5 text-[9px] border-t border-gray-300" style={{ textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
              {acta.desarrolloConclusionesPost}
            </div>
          )}
        </div>

        {/* ── TABLA 2 – CÁLCULO TOTAL ASISTENCIAL ── */}
        <div>
          <div className="bg-gray-200 text-center font-bold text-[9px] py-0.5 border-b border-gray-400 uppercase">
            TABLA 2 – CÁLCULO TOTAL ASISTENCIAL (PROGRAMADO VS EJECUTADO)
          </div>
          {/* Summary 2-column block */}
          <table className="w-full border-collapse text-[9px] border-b border-gray-400">
            <tbody>
              <tr>
                <td className={td + ' border-l-0 font-bold w-3/4'}>TOTAL PROGRAMADO</td>
                <td className={td + ' border-r-0 text-right font-bold'}>{totalProg.toLocaleString()}</td>
              </tr>
              <tr>
                <td className={td + ' border-l-0 font-bold'}>TOTAL ACTIVIDADES EJECUTADAS SEGÚN PROGRAMADO</td>
                <td className={td + ' border-r-0 text-right font-bold'}>{totalEjec.toLocaleString()}</td>
              </tr>
              <tr>
                <td className={td + ' border-l-0 font-bold'}>PORCENTAJE DE CUMPLIMIENTO</td>
                <td className={td + ' border-r-0 text-right font-bold'} style={{ color: '#000000' }}>{totalCumpl}%</td>
              </tr>
            </tbody>
          </table>
          {/* Detail 4-column table */}
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className={th + ' border-l-0 text-left'}>PROGRAMA / TIPO DE SERVICIO</th>
                <th className={th + ' w-28'}>CANTIDAD PROGRAMADA</th>
                <th className={th + ' w-28'}>CANTIDAD EJECUTADA</th>
                <th className={th + ' border-r-0 w-24'}>% CUMPLIMIENTO</th>
              </tr>
            </thead>
            <tbody>
              {acta.servicios.map((srv, i) => {
                const p = pct(srv);
                return (
                  <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className={td + ' border-l-0'}>{srv.tipo}</td>
                    <td className={td + ' text-right'}>{srv.programado.toLocaleString()}</td>
                    <td className={td + ' text-right'}>{srv.ejecutado.toLocaleString()}</td>
                    <td className={td + ' border-r-0 text-right font-bold'} style={{ color: '#000000' }}>{p}%</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-200 font-bold">
                <td className={td + ' border-l-0 uppercase'}>TOTAL ASISTENCIAL</td>
                <td className={td + ' text-right'}>{totalProg.toLocaleString()}</td>
                <td className={td + ' text-right'}>{totalEjec.toLocaleString()}</td>
                <td className={td + ' border-r-0 text-right'} style={{ color: '#000000' }}>{totalCumpl}%</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>{/* end page 1 border */}

      {/* ══════════════ PAGE BREAK ══════════════ */}
      <div className="print-page-break" />

      {/* ══════════════ PAGE 2 ══════════════ */}
      <div className="border-2 border-gray-700 mt-6 print:mt-0">

        {/* Page 2 header */}
        <div className="grid border-b-2 border-gray-700" style={{ gridTemplateColumns: '72px 1fr 190px' }}>
          <div className="border-r border-gray-500 flex items-center justify-center p-1">
            <LogoDusakawi size={62} />
          </div>
          <div className="flex flex-col items-center justify-center p-1.5 text-center gap-0.5">
            <div className="text-[8px] text-gray-600 uppercase tracking-wide">PROCESO: GESTIÓN DEL RIESGO EN SALUD</div>
            <div className="font-black text-[12px] uppercase leading-tight">ACTA DE EVALUACIÓN DE SERVICIOS</div>
          </div>
          <div className="border-l border-gray-500 p-1.5 text-[8px] leading-snug text-gray-700">
            <div><b>CÓDIGO:</b> DR-BC-AP-F-11</div>
            <div><b>VERSIÓN:</b> 02</div>
            <div><b>EMISIÓN:</b> 15/06/2022</div>
            <div><b>VIGENCIA:</b> 27/12/2022</div>
            <div className="mt-0.5 text-gray-500">PÁGINA 2 DE 2</div>
          </div>
        </div>

        {/* ── OBSERVACIONES ── */}
        <div className="border-b border-gray-400">
          <div className="bg-gray-200 px-2 py-0.5 text-[9px] font-bold uppercase border-b border-gray-400">
            OBSERVACIONES:
          </div>
          <div className="px-3 py-2 text-[8.5px] leading-relaxed" style={{ textAlign: 'justify' }}>
            <p className="mb-2">{OBS_BULLET}</p>
            {acta.observaciones && (
              <p className="mb-2" style={{ whiteSpace: 'pre-wrap' }}>{acta.observaciones}</p>
            )}
            <p style={{ marginBottom: '6px' }}>{BOILERPLATE_P2.split('\n\n')[0]}</p>
            <p style={{ marginBottom: '6px' }}>{BOILERPLATE_P2.split('\n\n')[1]}</p>
            <p>{BOILERPLATE_P2.split('\n\n')[2]}</p>
          </div>
        </div>

        {/* ── FIRMAS 2×2 ── */}
        <div className="grid grid-cols-2">
          {/* Row 1 */}
          <div className="border-r border-gray-400 px-6 py-6 text-center">
            <div style={{ height: 36 }} />
            <div className="border-t border-gray-700 pt-1 text-[9px] font-bold">{acta.repLegalIPS || '________________________________'}</div>
            <div className="text-[8px] text-gray-600 mt-0.5 uppercase">Representante Legal IPS</div>
          </div>
          <div className="px-6 py-6 text-center">
            <div style={{ height: 36 }} />
            <div className="border-t border-gray-700 pt-1 text-[9px] font-bold">{acta.repLegalEPS || '________________________________'}</div>
            <div className="text-[8px] text-gray-600 mt-0.5 uppercase">Representante Legal EPSI</div>
          </div>
          {/* Row 2 */}
          <div className="border-t border-r border-gray-400 px-6 py-6 text-center">
            <div style={{ height: 36 }} />
            <div className="border-t border-gray-700 pt-1 text-[9px] font-bold">{acta.coordinador || '________________________________'}</div>
            <div className="text-[8px] text-gray-600 mt-0.5 uppercase">Coordinador(a) de Baja Complejidad</div>
          </div>
          <div className="border-t border-gray-400 px-6 py-6 text-center">
            <div style={{ height: 36 }} />
            <div className="border-t border-gray-700 pt-1 text-[9px] font-bold">{acta.funcionario || '________________________________'}</div>
            <div className="text-[8px] text-gray-600 mt-0.5 uppercase">Funcionario quien realiza la Evaluación</div>
          </div>
        </div>

      </div>{/* end page 2 border */}
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

interface Props {
  acta: Acta;
  onChange: (a: Acta) => void;
  onSave: () => void;
  onClose: () => void;
  inline?: boolean;
  funcionarios?: string[];
  onAddFuncionario?: (name: string) => void;
  onRemoveFuncionario?: (name: string) => void;
  firmasGlobales?: { repLegalEPSI: string; coordinador: string };
  onSaveFirmaGlobal?: (key: 'repLegalEPSI' | 'coordinador', val: string) => void;
}

export default function ActaModal({
  acta, onChange, onSave, onClose, inline = false,
  funcionarios = [], onAddFuncionario, onRemoveFuncionario,
  firmasGlobales, onSaveFirmaGlobal
}: Props) {
  const [view, setView] = useState<'form' | 'preview'>('form');
  const [nuevoFuncionario, setNuevoFuncionario] = useState('');
  const [showAddFuncionario, setShowAddFuncionario] = useState(false);

  const set = <K extends keyof Acta>(key: K, value: Acta[K]) =>
    onChange({ ...acta, [key]: value });

  const setSrv = (idx: number, key: keyof ActaServicio, value: number) => {
    const s = [...acta.servicios];
    s[idx] = { ...s[idx], [key]: value };
    onChange({ ...acta, servicios: s });
  };

  const totalProg  = acta.servicios.reduce((s, x) => s + x.programado, 0);
  const totalEjec  = acta.servicios.reduce((s, x) => s + x.ejecutado,  0);
  const totalCumpl = totalProg > 0 ? Math.min(Math.round((totalEjec / totalProg) * 100), 100) : 0;

  // ── Excel Export ──
  const handleExportExcel = () => {
    const wb = utils.book_new();
    const header: any[][] = [
      ['ACTA DE EVALUACIÓN DE SERVICIOS – BAJA COMPLEJIDAD', '', '', 'CÓDIGO: DR-BC-AP-F-11 / VERSIÓN: 02'],
      ['PROCESO: GESTIÓN DEL RIESGO EN SALUD'],
      [],
      ['ACTA N°', acta.numero, 'FECHA DE EVALUACIÓN', acta.fechaActa, 'PERÍODO EVALUADO', acta.periodoEvaluado, 'VIGENCIA DEL CONTRATO', acta.vigencia],
      ['EMPRESA', acta.empresa, 'NIT', acta.nit, 'RÉGIMEN', acta.regimen],
      ['MUNICIPIO', acta.municipio, 'LUGAR', acta.lugar, 'N° CONTRATO', acta.contrato],
      ['COORDINADOR(A) BC', acta.coordinador, 'FUNCIONARIO QUE REALIZA LA EVALUACIÓN', acta.funcionario],
      [],
      ['PUNTOS A TRATAR:'],
      [acta.puntosTratar],
      [],
      ['OBJETIVO:'],
      [acta.objetivo],
      [],
      ['DESARROLLO Y CONCLUSIONES:'],
      [acta.desarrolloYConclusiones],
      [],
      ['TABLA 1 – CÁLCULO TOTAL ASISTENCIAL (PROGRAMADO VS EJECUTADO)'],
      ['TOTAL PROGRAMADO', totalProg, 'TOTAL EJECUTADO', totalEjec, '% CUMPLIMIENTO', totalCumpl / 100],
      [],
      ['PROGRAMA / TIPO DE SERVICIO', 'CANTIDAD PROGRAMADA', 'CANTIDAD EJECUTADA', '% CUMPLIMIENTO'],
      ...acta.servicios.map(s => [s.tipo, s.programado, s.ejecutado, pct(s) / 100]),
      [],
      ['OBSERVACIONES:'],
      [acta.observaciones],
      [],
      ['REPRESENTANTE LEGAL IPS', acta.repLegalIPS, '', 'REPRESENTANTE LEGAL EPSI', acta.repLegalEPS],
      ['COORDINADOR(A) DE BAJA COMPLEJIDAD', acta.coordinador, '', 'FUNCIONARIO QUIEN REALIZA LA EVALUACIÓN', acta.funcionario],
    ];

    const ws = utils.aoa_to_sheet(header);
    ws['!cols'] = [{ wch: 48 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 18 }];

    const pctFmt = '0%';
    acta.servicios.forEach((_, i) => {
      const addr = utils.encode_cell({ r: 20 + i, c: 3 });
      if (ws[addr]) ws[addr].z = pctFmt;
    });

    utils.book_append_sheet(wb, ws, 'Acta');
    writeFile(wb, `Acta_${acta.numero.replace(/[/\\:*?"<>|]/g, '-')}.xlsx`);
  };

  const inp = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all';
  const lbl = 'text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1';
  const ta  = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all resize-none';

  const innerContent = (
    <>
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-bold text-slate-800 dark:text-white">
            Acta N° {acta.numero || '—'}
          </h2>
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
            {(['form', 'preview'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${view === v
                  ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                {v === 'form' ? 'Formulario' : 'Vista Previa'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium hover:bg-emerald-200 transition-colors border border-emerald-200 dark:border-emerald-500/30">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
          <button onClick={() => {
            setView('preview');
            setTimeout(() => {
              const portal = document.getElementById('acta-print-portal');
              const src = document.getElementById('acta-preview-content');
              if (portal && src) {
                portal.innerHTML = src.outerHTML;
                // Copy computed styles for recharts SVGs
              }
              window.print();
              setTimeout(() => { if (portal) portal.innerHTML = ''; }, 2000);
            }, 300);
          }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors border border-blue-200 dark:border-blue-500/30">
            <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
          </button>
          <button onClick={onSave}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition-all">
            Guardar
          </button>
          {!inline && (
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X className="h-5 w-5 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      <div className={inline ? 'overflow-y-auto custom-scroll' : 'flex-1 overflow-y-auto custom-scroll'}>

        {/* ══ FORM ══ */}
        {view === 'form' && (
          <div className="p-5 space-y-5">

            {/* Identification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className={lbl}>Acta N°</label>
                <input className={inp} value={acta.numero} onChange={e => set('numero', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Fecha de Evaluación</label>
                <input type="date" className={inp} value={acta.fechaActa} onChange={e => set('fechaActa', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Período Evaluado</label>
                <input className={inp} value={acta.periodoEvaluado} onChange={e => set('periodoEvaluado', e.target.value)} placeholder="OCT, NOV, DIC" />
              </div>
              <div>
                <label className={lbl}>Vigencia del Contrato</label>
                <input className={inp} value={acta.vigencia} onChange={e => set('vigencia', e.target.value)} placeholder="1/01/2025 - 31/12/2025" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2">
                <label className={lbl}>Empresa / IPS</label>
                <input className={inp} value={acta.empresa} onChange={e => set('empresa', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>NIT</label>
                <input className={inp} value={acta.nit} onChange={e => set('nit', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Régimen</label>
                <select className={inp} value={acta.regimen} onChange={e => set('regimen', e.target.value)}>
                  <option>SUBSIDIADO</option>
                  <option>CONTRIBUTIVO</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Municipio</label>
                <input className={inp} value={acta.municipio} onChange={e => set('municipio', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Lugar</label>
                <input className={inp} value={acta.lugar} onChange={e => set('lugar', e.target.value)} placeholder="Ciudad donde se realizó el acta" />
              </div>
              <div>
                <label className={lbl}>N° Contrato</label>
                <input className={inp} value={acta.contrato} onChange={e => set('contrato', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Coordinador(a) de Baja Complejidad</label>
                <div className="flex gap-1.5">
                  <input className={inp} value={acta.coordinador} onChange={e => set('coordinador', e.target.value)} placeholder="Nombre del coordinador" />
                  <button
                    type="button"
                    title="Guardar como predeterminado para todas las actas"
                    onClick={() => onSaveFirmaGlobal?.('coordinador', acta.coordinador)}
                    className="flex-shrink-0 px-2.5 py-1.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium hover:bg-indigo-200 transition-colors border border-indigo-200 dark:border-indigo-500/30"
                  >💾</button>
                </div>
                {firmasGlobales?.coordinador && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Global: <span className="font-medium text-slate-500 dark:text-slate-400">{firmasGlobales.coordinador}</span></p>
                )}
              </div>
              <div className="lg:col-span-2">
                <label className={lbl}>Funcionario que realiza la evaluación</label>
                <div className="flex gap-1.5 items-start">
                  <div className="flex-1">
                    <select
                      className={inp}
                      value={acta.funcionario}
                      onChange={e => set('funcionario', e.target.value)}
                    >
                      <option value="">— Seleccionar funcionario —</option>
                      {funcionarios.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  {acta.funcionario && funcionarios.includes(acta.funcionario) && (
                    <button
                      type="button"
                      title="Quitar este funcionario de la lista"
                      onClick={() => { onRemoveFuncionario?.(acta.funcionario); set('funcionario', ''); }}
                      className="flex-shrink-0 px-2.5 py-1.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors border border-red-200 dark:border-red-500/30"
                    >✕</button>
                  )}
                  <button
                    type="button"
                    title="Agregar nuevo funcionario a la lista"
                    onClick={() => setShowAddFuncionario(v => !v)}
                    className="flex-shrink-0 px-2.5 py-1.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium hover:bg-emerald-200 transition-colors border border-emerald-200 dark:border-emerald-500/30"
                  >+ Agregar</button>
                </div>
                {showAddFuncionario && (
                  <div className="flex gap-1.5 mt-1.5">
                    <input
                      className={inp}
                      value={nuevoFuncionario}
                      onChange={e => setNuevoFuncionario(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { onAddFuncionario?.(nuevoFuncionario); set('funcionario', nuevoFuncionario.trim()); setNuevoFuncionario(''); setShowAddFuncionario(false); }}}
                      placeholder="Nombre completo del funcionario"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { onAddFuncionario?.(nuevoFuncionario); set('funcionario', nuevoFuncionario.trim()); setNuevoFuncionario(''); setShowAddFuncionario(false); }}
                      className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors"
                    >Guardar</button>
                    <button type="button" onClick={() => { setShowAddFuncionario(false); setNuevoFuncionario(''); }} className="flex-shrink-0 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-xs hover:bg-slate-200 transition-colors">✕</button>
                  </div>
                )}
              </div>
            </div>

            {/* Puntos a tratar */}
            <div>
              <label className={lbl}>Puntos a Tratar</label>
              <textarea rows={3} className={ta} value={acta.puntosTratar}
                onChange={e => set('puntosTratar', e.target.value)} />
            </div>

            {/* Objetivo */}
            <div>
              <label className={lbl}>Objetivo</label>
              <textarea rows={2} className={ta} value={acta.objetivo}
                onChange={e => set('objetivo', e.target.value)} />
            </div>

            {/* Desarrollo y conclusiones — párrafo antes del gráfico */}
            <div>
              <label className={lbl}>Desarrollo y Conclusiones (antes del gráfico)</label>
              <textarea rows={3} className={ta} value={acta.desarrolloYConclusiones}
                onChange={e => set('desarrolloYConclusiones', e.target.value)} />
            </div>

            {/* Párrafo después del gráfico */}
            <div>
              <label className={lbl}>Párrafo después del gráfico</label>
              <textarea rows={3} className={ta} value={acta.desarrolloConclusionesPost || ''}
                onChange={e => set('desarrolloConclusionesPost', e.target.value)}
                placeholder="Se verifica la ejecución de las actividades de atención primaria..." />
            </div>

            {/* Services table */}
            <div>
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                Tabla 1 – Cálculo Total Asistencial
              </h3>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                {[
                  { label: 'Total Programado', value: totalProg.toLocaleString(), color: 'text-slate-700 dark:text-slate-200' },
                  { label: 'Total Ejecutado',  value: totalEjec.toLocaleString(), color: 'text-slate-700 dark:text-slate-200' },
                  { label: '% Cumplimiento',  value: `${totalCumpl}%`, color: `font-bold` },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center border border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                    <div className={`text-lg font-mono font-bold ${color}`} style={label === '% Cumplimiento' ? { color: totalCumpl >= 100 ? '#2dd4bf' : totalCumpl >= 80 ? '#ca8a04' : '#dc2626' } : {}}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-950/60 text-xs text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">Tipo de Servicio</th>
                      <th className="px-3 py-2 text-right w-32">Programado</th>
                      <th className="px-3 py-2 text-right w-28">Ejecutado</th>
                      <th className="px-3 py-2 text-right w-28">% Cumpl.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {acta.servicios.map((srv, idx) => {
                      const p = pct(srv);
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{srv.tipo}</td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" min="0" value={srv.programado}
                              onChange={e => setSrv(idx, 'programado', Number(e.target.value))}
                              className="w-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-right text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">
                            {srv.ejecutado.toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right font-bold" style={{ color: pctColor(p) }}>{p}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Observations */}
            <div>
              <label className={lbl}>Observaciones</label>
              <textarea rows={3} value={acta.observaciones} onChange={e => set('observaciones', e.target.value)}
                className={ta}
                placeholder="Los servicios Asistenciales son objeto de seguimiento en términos de calidad..." />
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Representante Legal IPS</label>
                <input className={inp} value={acta.repLegalIPS || ''} onChange={e => set('repLegalIPS', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Representante Legal EPSI</label>
                <div className="flex gap-1.5">
                  <input className={inp} value={acta.repLegalEPS || ''} onChange={e => set('repLegalEPS', e.target.value)} placeholder="Nombre del representante" />
                  <button
                    type="button"
                    title="Guardar como predeterminado para todas las actas"
                    onClick={() => onSaveFirmaGlobal?.('repLegalEPSI', acta.repLegalEPS || '')}
                    className="flex-shrink-0 px-2.5 py-1.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium hover:bg-indigo-200 transition-colors border border-indigo-200 dark:border-indigo-500/30"
                  >💾</button>
                </div>
                {firmasGlobales?.repLegalEPSI && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Global: <span className="font-medium text-slate-500 dark:text-slate-400">{firmasGlobales.repLegalEPSI}</span></p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ══ PREVIEW ══ */}
        {view === 'preview' && (
          <div className="p-6 bg-slate-100 dark:bg-slate-950 min-h-full">
            <ActaPreview acta={acta} />
          </div>
        )}

      </div>
    </>
  );

  if (inline) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
        {innerContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {innerContent}
      </div>
    </div>
  );
}
