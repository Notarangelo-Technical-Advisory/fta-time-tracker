export interface StatusReportSection {
  projectName: string;
  activities: string[];   // 3-5 past-tense activity bullets
  outcomes: string[];     // 2-3 bullets prefixed with "Actual:" or "Potential:"
}

export interface StatusReport {
  id: string;
  reportNumber: string;        // e.g. RPT-2026-001
  customerId: string;
  customerName: string;
  periodStart: string;         // YYYY-MM-DD — derived from earliest selected entry date
  periodEnd: string;           // YYYY-MM-DD — derived from latest selected entry date
  timeEntryIds: string[];
  sections: StatusReportSection[];
  status: 'draft' | 'sent';
  createdAt: Date;
  updatedAt: Date;
}
