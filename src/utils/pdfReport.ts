import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  AnalyticsSummary,
  ElderlyProfile,
  Medication,
  MedicationLog,
  UserProfile,
} from '../types';

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

export interface ReportPeriodOption {
  value: string; // 'YYYY-MM' or 'last_30_days'
  label: string;
}

export interface MedicationBreakdownRow {
  medicationId: string;
  name: string;
  dosage: string;
  scheduleSummary: string;
  prescribedBy: string;
  taken: number;
  missed: number;
  skipped: number;
  total: number;
  adherencePct: number | null;
}

export interface MonthlyAdherenceReportData {
  periodValue: string;
  periodLabel: string;
  dateRangeLabel: string;
  generatedAtLabel: string;
  totalLogged: number;
  taken: number;
  missed: number;
  skipped: number;
  adherencePct: number;
  medicationRows: MedicationBreakdownRow[];
  attentionFlags: string[];
  missedOrSkippedLogs: MedicationLog[];
  periodLogs: MedicationLog[];
}

export interface MonthlyPdfExportParams {
  profile: ElderlyProfile;
  logs: MedicationLog[];
  medications?: Medication[];
  analytics?: AnalyticsSummary | null;
  preparedBy?: UserProfile | null;
  periodValue: string;
}

const FOOD_LABEL: Record<string, string> = {
  before_food: 'Before food',
  after_food: 'After food',
  with_food: 'With food',
  anytime: 'Anytime',
};

const FREQUENCY_LABEL: Record<string, string> = {
  daily: 'Once daily',
  twice_daily: 'Twice daily',
  three_times_daily: '3x daily',
  weekly: 'Weekly',
  as_needed: 'As needed',
};

function formatMonthLabel(ym: string): string {
  const [yStr, mStr] = ym.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) return ym;
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getCurrentYearMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getRolling30Cutoff(): { cutoffStr: string; todayStr: string } {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 29);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { cutoffStr: fmt(cutoff), todayStr: fmt(now) };
}

export function getAvailableReportPeriods(logs: MedicationLog[]): ReportPeriodOption[] {
  const currentYm = getCurrentYearMonth();
  const monthSet = new Set<string>([currentYm]);

  for (const log of logs) {
    if (log.scheduledDate && log.scheduledDate.length >= 7) {
      monthSet.add(log.scheduledDate.slice(0, 7));
    }
  }

  const sortedMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

  const options: ReportPeriodOption[] = sortedMonths.map((ym) => ({
    value: ym,
    label: formatMonthLabel(ym),
  }));

  // Insert Last 30 Days right after the current month for easy physician sharing across month boundaries
  options.splice(1, 0, {
    value: 'last_30_days',
    label: 'Last 30 Days (Rolling)',
  });

  return options;
}

export function buildMonthlyAdherenceReportData({
  logs,
  medications = [],
  analytics,
  periodValue,
}: {
  logs: MedicationLog[];
  medications?: Medication[];
  analytics?: AnalyticsSummary | null;
  periodValue: string;
}): MonthlyAdherenceReportData {
  const isRolling = periodValue === 'last_30_days';
  const { cutoffStr, todayStr } = getRolling30Cutoff();

  const periodLogs = logs
    .filter((l) =>
      isRolling
        ? l.scheduledDate >= cutoffStr && l.scheduledDate <= todayStr
        : l.scheduledDate.startsWith(periodValue),
    )
    .sort((a, b) => {
      const cmpDate = b.scheduledDate.localeCompare(a.scheduledDate);
      if (cmpDate !== 0) return cmpDate;
      return b.scheduledTime.localeCompare(a.scheduledTime);
    });

  const taken = periodLogs.filter((l) => l.status === 'taken').length;
  const missed = periodLogs.filter((l) => l.status === 'missed').length;
  const skipped = periodLogs.filter((l) => l.status === 'skipped').length;
  const totalLogged = taken + missed + skipped;
  const adherencePct = totalLogged > 0 ? Math.round((taken / totalLogged) * 100) : 0;

  // Build per-medication breakdown combining active medications and any medications appearing in period logs
  const medById = new Map<string, Medication>();
  for (const med of medications) {
    medById.set(med.id, med);
  }

  const statsMap = new Map<
    string,
    {
      name: string;
      dosage: string;
      taken: number;
      missed: number;
      skipped: number;
    }
  >();

  for (const med of medications.filter((m) => m.isActive)) {
    statsMap.set(med.id, {
      name: med.name,
      dosage: med.dosage,
      taken: 0,
      missed: 0,
      skipped: 0,
    });
  }

  for (const log of periodLogs) {
    const existing = statsMap.get(log.medicationId) || {
      name: log.medicationName,
      dosage: log.dosage,
      taken: 0,
      missed: 0,
      skipped: 0,
    };
    if (log.status === 'taken') existing.taken += 1;
    else if (log.status === 'missed') existing.missed += 1;
    else if (log.status === 'skipped') existing.skipped += 1;
    statsMap.set(log.medicationId, existing);
  }

  const medicationRows: MedicationBreakdownRow[] = Array.from(statsMap.entries())
    .map(([medicationId, st]) => {
      const med = medById.get(medicationId);
      const total = st.taken + st.missed + st.skipped;
      const freqText = med ? FREQUENCY_LABEL[med.frequency] || med.frequency : 'Scheduled';
      const foodText = med ? FOOD_LABEL[med.foodInstruction] || med.foodInstruction : '';
      const timingsText = med && med.timings.length > 0 ? med.timings.join(', ') : '';
      const scheduleParts = [freqText, timingsText, foodText].filter(Boolean);

      return {
        medicationId,
        name: st.name,
        dosage: st.dosage,
        scheduleSummary: scheduleParts.join(' · ') || 'Per prescription',
        prescribedBy: med?.prescribedBy || 'Primary Care',
        taken: st.taken,
        missed: st.missed,
        skipped: st.skipped,
        total,
        adherencePct: total > 0 ? Math.round((st.taken / total) * 100) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const attentionFlags: string[] = [];
  if (analytics?.smartCareAlerts?.length) {
    for (const alert of analytics.smartCareAlerts) {
      attentionFlags.push(alert.message);
    }
  }
  for (const row of medicationRows) {
    if (
      row.adherencePct !== null &&
      row.adherencePct < 85 &&
      !attentionFlags.some((msg) => msg.toLowerCase().includes(row.name.toLowerCase()))
    ) {
      attentionFlags.push(
        `${row.name} (${row.dosage}) adherence is ${row.adherencePct}% (${row.missed} missed, ${row.skipped} skipped in this period).`,
      );
    }
  }

  const missedOrSkippedLogs = periodLogs.filter(
    (l) => l.status === 'missed' || l.status === 'skipped',
  );

  const periodLabel = isRolling ? 'Last 30 Days (Rolling)' : formatMonthLabel(periodValue);
  const dateRangeLabel = isRolling
    ? `${cutoffStr} to ${todayStr}`
    : `${periodValue} (${periodLogs.length > 0 ? `${periodLogs[periodLogs.length - 1].scheduledDate} to ${periodLogs[0].scheduledDate}` : 'Calendar Month'})`;

  const generatedAtLabel = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return {
    periodValue,
    periodLabel,
    dateRangeLabel,
    generatedAtLabel,
    totalLogged,
    taken,
    missed,
    skipped,
    adherencePct,
    medicationRows,
    attentionFlags,
    missedOrSkippedLogs,
    periodLogs,
  };
}

export function createMonthlyAdherencePdf(params: MonthlyPdfExportParams): {
  doc: jsPDF;
  fileName: string;
  reportData: MonthlyAdherenceReportData;
} {
  const { profile, logs, medications = [], analytics, preparedBy, periodValue } = params;
  const reportData = buildMonthlyAdherenceReportData({
    logs,
    medications,
    analytics,
    periodValue,
  });

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  }) as JsPdfWithAutoTable;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const ensureSpace = (neededHeight: number, currentY: number): number => {
    if (currentY + neededHeight > pageHeight - 52) {
      doc.addPage();
      return 44;
    }
    return currentY;
  };

  // 1. Clinical Header Banner
  doc.setFillColor(3, 105, 161); // #0369A1 (WellAge Sky-700)
  doc.rect(0, 0, pageWidth, 82, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('WellAge', margin, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(224, 242, 254);
  doc.text('Smarter Care. Healthier Aging.', margin, 48);
  doc.text('Physician-Shareable Medication Adherence Summary', margin, 62);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('MONTHLY ADHERENCE REPORT', pageWidth - margin, 32, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Period: ${reportData.periodLabel}`, pageWidth - margin, 48, { align: 'right' });
  doc.text(`Generated: ${reportData.generatedAtLabel}`, pageWidth - margin, 62, {
    align: 'right',
  });

  let y = 100;

  // 2. Patient & Primary Care Summary Box
  const allergiesText = profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None reported';
  const conditionsText =
    profile.primaryConditions.length > 0 ? profile.primaryConditions.join(', ') : 'None listed';
  const preparedByText = preparedBy
    ? `${preparedBy.name} (${preparedBy.role})`
    : profile.fullName;

  const leftColWidth = contentWidth * 0.5 - 12;
  const rightColWidth = contentWidth * 0.5 - 12;

  const allergyLines = doc.splitTextToSize(`Allergies: ${allergiesText}`, leftColWidth);
  const conditionLines = doc.splitTextToSize(`Conditions: ${conditionsText}`, leftColWidth);
  const physicianLines = doc.splitTextToSize(
    `Primary Physician: ${profile.physicianName || 'Not specified'}`,
    rightColWidth,
  );

  const leftHeight = 44 + (allergyLines.length + conditionLines.length) * 12;
  const rightHeight = 56 + physicianLines.length * 12;
  const patientBoxHeight = Math.max(88, leftHeight, rightHeight);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, patientBoxHeight, 6, 6, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Patient: ${profile.fullName}`, margin + 12, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Age: ${profile.age} yrs   ·   Blood Group: ${profile.bloodGroup}`, margin + 12, y + 34);

  let ly = y + 48;
  doc.text(allergyLines, margin + 12, ly);
  ly += allergyLines.length * 12 + 2;
  doc.text(conditionLines, margin + 12, ly);

  const rx = margin + contentWidth * 0.5 + 4;
  let ry = y + 18;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(physicianLines, rx, ry);
  ry += physicianLines.length * 12 + 4;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Physician Phone: ${profile.physicianPhone || 'Not listed'}`, rx, ry);
  ry += 14;
  doc.text(`Date Range: ${reportData.dateRangeLabel}`, rx, ry);
  ry += 14;
  doc.text(`Prepared By: ${preparedByText}`, rx, ry);

  y += patientBoxHeight + 16;

  // 3. Executive KPI Cards
  const kpis = [
    {
      label: 'MONTHLY ADHERENCE',
      value: reportData.totalLogged > 0 ? `${reportData.adherencePct}%` : 'N/A',
      color: [3, 105, 161] as [number, number, number],
    },
    {
      label: 'DOSES TAKEN',
      value: String(reportData.taken),
      color: [4, 120, 87] as [number, number, number],
    },
    {
      label: 'DOSES MISSED',
      value: String(reportData.missed),
      color: [190, 18, 60] as [number, number, number],
    },
    {
      label: 'DOSES SKIPPED',
      value: String(reportData.skipped),
      color: [180, 83, 9] as [number, number, number],
    },
    {
      label: 'TOTAL LOGGED',
      value: String(reportData.totalLogged),
      color: [15, 23, 42] as [number, number, number],
    },
  ];

  const gap = 8;
  const cardWidth = (contentWidth - gap * (kpis.length - 1)) / kpis.length;
  const cardHeight = 52;

  kpis.forEach((kpi, idx) => {
    const cx = margin + idx * (cardWidth + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(cx, y, cardWidth, cardHeight, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cx + 10, y + 16);

    doc.setFontSize(16);
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, cx + 10, y + 39);
  });

  y += cardHeight + 16;

  // 4. Clinical Attention Flags (if any)
  if (reportData.attentionFlags.length > 0) {
    const wrappedFlags = reportData.attentionFlags.flatMap((flag) =>
      doc.splitTextToSize(`• ${flag}`, contentWidth - 24),
    );
    const alertHeight = 28 + wrappedFlags.length * 12;
    y = ensureSpace(alertHeight + 12, y);

    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(254, 205, 211);
    doc.roundedRect(margin, y, contentWidth, alertHeight, 5, 5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(159, 18, 57);
    doc.text('Clinical Attention & Adherence Notes', margin + 12, y + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.8);
    doc.setTextColor(136, 19, 55);
    doc.text(wrappedFlags, margin + 12, y + 30);

    y += alertHeight + 16;
  }

  // 5. Medication Regimen & Per-Medication Adherence Summary
  y = ensureSpace(70, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Medication Regimen & Period Adherence Breakdown', margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Medication', 'Dosage', 'Schedule & Food', 'Prescribed By', 'Taken / Total', 'Adherence']],
    body:
      reportData.medicationRows.length > 0
        ? reportData.medicationRows.map((row) => [
            row.name,
            row.dosage,
            row.scheduleSummary,
            row.prescribedBy,
            `${row.taken} / ${row.total}`,
            row.adherencePct !== null ? `${row.adherencePct}%` : 'No logs',
          ])
        : [['No medications recorded for this profile.', '', '', '', '', '']],
    theme: 'grid',
    styles: {
      fontSize: 8.5,
      cellPadding: 5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 88 },
      1: { cellWidth: 74 },
      2: { cellWidth: 130 },
      3: { cellWidth: 108 },
      4: { halign: 'center', cellWidth: 66 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 66 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const text = String(data.cell.raw || '');
        const pct = parseInt(text, 10);
        if (!Number.isNaN(pct)) {
          if (pct >= 90) data.cell.styles.textColor = [4, 120, 87];
          else if (pct >= 75) data.cell.styles.textColor = [180, 83, 9];
          else data.cell.styles.textColor = [190, 18, 60];
        }
      }
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y + 40) + 18;

  // 6. Missed & Skipped Doses Highlight (when present)
  if (reportData.missedOrSkippedLogs.length > 0) {
    y = ensureSpace(70, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Missed & Skipped Doses (${reportData.missedOrSkippedLogs.length})`,
      margin,
      y,
    );
    y += 8;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Date', 'Time', 'Medication', 'Status', 'Caregiver / Patient Note']],
      body: reportData.missedOrSkippedLogs.map((l) => [
        l.scheduledDate,
        l.scheduledTime,
        `${l.medicationName} (${l.dosage})`,
        l.status.toUpperCase(),
        l.notes || '—',
      ]),
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        cellPadding: 5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.5,
      },
      headStyles: {
        fillColor: [254, 242, 242],
        textColor: [159, 18, 57],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 68 },
        1: { cellWidth: 46 },
        2: { cellWidth: 136 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 64 },
        4: { cellWidth: 218 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = String(data.cell.raw || '');
          if (val === 'MISSED') data.cell.styles.textColor = [190, 18, 60];
          else if (val === 'SKIPPED') data.cell.styles.textColor = [180, 83, 9];
        }
      },
    });

    y = (doc.lastAutoTable?.finalY ?? y + 40) + 18;
  }

  // 7. Complete Period Dose Log
  y = ensureSpace(70, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Complete Dose Log (${reportData.periodLogs.length} entries)`, margin, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 48 },
    head: [['Date', 'Time', 'Medication', 'Dosage', 'Status', 'Recorded By', 'Notes']],
    body:
      reportData.periodLogs.length > 0
        ? reportData.periodLogs.map((l) => [
            l.scheduledDate,
            l.scheduledTime,
            l.medicationName,
            l.dosage,
            l.status.toUpperCase(),
            l.recordedByName,
            l.notes || '—',
          ])
        : [['—', '—', 'No dose logs recorded in this period.', '—', '—', '—', '—']],
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 4.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [3, 105, 161],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 62 },
      1: { cellWidth: 42 },
      2: { fontStyle: 'bold', cellWidth: 88 },
      3: { cellWidth: 68 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 54 },
      5: { cellWidth: 84 },
      6: { cellWidth: 134 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw || '');
        if (val === 'TAKEN') data.cell.styles.textColor = [4, 120, 87];
        else if (val === 'MISSED') data.cell.styles.textColor = [190, 18, 60];
        else if (val === 'SKIPPED') data.cell.styles.textColor = [180, 83, 9];
      }
    },
  });

  // 8. Footer across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `WellAge · Medication Adherence Report for ${profile.fullName} · Share with Primary Care Physician`,
      margin,
      pageHeight - 22,
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 22, {
      align: 'right',
    });
  }

  const slugName = profile.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const fileName = `${slugName}_monthly_adherence_${periodValue}.pdf`;

  return { doc, fileName, reportData };
}

export function exportMonthlyAdherencePdf(params: MonthlyPdfExportParams): {
  fileName: string;
  reportData: MonthlyAdherenceReportData;
} {
  const { doc, fileName, reportData } = createMonthlyAdherencePdf(params);
  doc.save(fileName);
  return { fileName, reportData };
}
