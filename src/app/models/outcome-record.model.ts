// Cumulative outcomes per customer+project, updated each time a new status report is generated.
// Status reports store a point-in-time snapshot; this collection holds the living record.
export interface OutcomeRecord {
  id?: string;
  customerId: string;
  projectName: string;          // matches StatusReportSection.projectName
  outcomes: string[];           // "Actual: ..." | "Potential: ..." prefixed strings
  updatedAt: Date;
}
