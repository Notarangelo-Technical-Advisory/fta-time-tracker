import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TimeEntryService } from '../../services/time-entry.service';
import { InvoiceService } from '../../services/invoice.service';
import { CustomerService } from '../../services/customer.service';
import { ProjectService } from '../../services/project.service';
import { TimeEntry } from '../../models/time-entry.model';
import { Invoice } from '../../models/invoice.model';
import { Customer } from '../../models/customer.model';
import { Project } from '../../models/project.model';

@Component({
    selector: 'app-dashboard',
    imports: [CommonModule, RouterLink],
    template: `
    <div class="page-container">
      <div class="page-header">
        <h1>Dashboard</h1>
      </div>

      <div class="loading-state" *ngIf="loading">
        <div class="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>

      <div *ngIf="!loading">
        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="summary-card">
            <span class="card-label">Unbilled Hours</span>
            <span class="card-value warning">{{ unbilledHours }}</span>
            <button class="preview-invoice-btn" *ngIf="unbilledHours > 0" (click)="openInvoicePreview()">Preview Invoice</button>
          </div>
          <div class="summary-card">
            <span class="card-label">Outstanding Invoices</span>
            <span class="card-value danger">\${{ outstandingTotal.toFixed(2) }}</span>
          </div>
          <div class="summary-card">
            <span class="card-label">This Month Revenue</span>
            <span class="card-value success">\${{ monthlyRevenue.toFixed(2) }}</span>
          </div>
          <div class="summary-card">
            <span class="card-label">Active Customers</span>
            <span class="card-value primary">{{ activeCustomerCount }}</span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="section">
          <h2>Quick Actions</h2>
          <div class="quick-actions">
            <a routerLink="/time-entries/new" class="action-card">
              <span class="action-icon">+</span>
              <span class="action-label">Log Time</span>
            </a>
            <a routerLink="/invoices/generate" class="action-card">
              <span class="action-icon">$</span>
              <span class="action-label">Generate Invoice</span>
            </a>
            <a routerLink="/customers/new" class="action-card">
              <span class="action-icon">&#64;</span>
              <span class="action-label">Add Customer</span>
            </a>
            <a routerLink="/projects/new" class="action-card">
              <span class="action-icon">#</span>
              <span class="action-label">New Project</span>
            </a>
          </div>
        </div>

        <!-- Recent Time Entries -->
        <div class="section">
          <div class="section-header">
            <h2>Recent Time Entries</h2>
            <a routerLink="/time-entries" class="view-all">View All</a>
          </div>
          <table class="data-table" *ngIf="recentEntries.length > 0">
            <thead>
              <tr>
                <th>Date</th>
                <th>Hours</th>
                <th>Customer</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of recentEntries">
                <td class="date-cell">{{ formatDate(entry.date) }}</td>
                <td class="hours-cell">{{ entry.durationHours }}</td>
                <td>{{ getCustomerName(entry.customerId) }}</td>
                <td class="desc-cell">{{ entry.description || '—' }}</td>
                <td>
                  <span class="status-badge" [ngClass]="entry.status">{{ entry.status | titlecase }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="empty-hint" *ngIf="recentEntries.length === 0">
            <p>No time entries yet. <a routerLink="/time-entries/new">Log your first entry</a></p>
          </div>
        </div>

        <!-- Recent Invoices -->
        <div class="section">
          <div class="section-header">
            <h2>Recent Invoices</h2>
            <a routerLink="/invoices" class="view-all">View All</a>
          </div>
          <table class="data-table" *ngIf="recentInvoices.length > 0">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let invoice of recentInvoices">
                <td class="invoice-number">
                  <a [routerLink]="['/invoices', invoice.id]">{{ invoice.invoiceNumber }}</a>
                </td>
                <td>{{ invoice.customerName }}</td>
                <td class="amount-cell">\${{ invoice.total.toFixed(2) }}</td>
                <td>
                  <span class="status-badge" [ngClass]="invoice.status">{{ invoice.status | titlecase }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="empty-hint" *ngIf="recentInvoices.length === 0">
            <p>No invoices yet. <a routerLink="/invoices/generate">Generate your first invoice</a></p>
          </div>
        </div>
      </div>
    </div>

    <!-- Invoice Preview Modal -->
    <div class="modal-backdrop" *ngIf="showInvoicePreview" (click)="closeInvoicePreview()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Invoice Preview</h2>
          <button class="modal-close" (click)="closeInvoicePreview()">&#x2715;</button>
        </div>
        <div class="modal-body">
          <p class="modal-subtitle">Projected invoice for all unbilled time entries, grouped by customer.</p>

          <div *ngFor="let group of invoicePreviewGroups" class="preview-customer">
            <div class="preview-customer-header">
              <span class="preview-customer-name">{{ group.customerName }}</span>
              <span class="preview-customer-total">\${{ group.total.toFixed(2) }}</span>
            </div>
            <table class="preview-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Hours</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let line of group.lineItems">
                  <td>{{ line.projectName }}</td>
                  <td>{{ line.hours }}</td>
                  <td>\${{ line.rate }}/hr</td>
                  <td class="amount-cell">\${{ line.amount.toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
            <div class="preview-customer-action">
              <a [routerLink]="['/invoices/generate']" class="btn-generate" (click)="closeInvoicePreview()">Generate Invoice for {{ group.customerName }}</a>
            </div>
          </div>

          <div class="preview-grand-total">
            <span>Total Unbilled Value</span>
            <span>\${{ invoicePreviewGrandTotal.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .page-container {
      max-width: $container-lg;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: $spacing-xl;

      h1 {
        font-size: $font-size-3xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0;
      }
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: $spacing-base;
      margin-bottom: $spacing-2xl;

      @media (max-width: $breakpoint-tablet) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: $breakpoint-mobile) {
        grid-template-columns: 1fr;
      }
    }

    .summary-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;
      display: flex;
      flex-direction: column;
      gap: $spacing-sm;

      .card-label {
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        color: $color-text-muted;
      }

      .card-value {
        font-size: $font-size-2xl;
        font-weight: $font-weight-bold;

        &.warning { color: $color-warning; }
        &.primary { color: $color-primary; }
        &.danger { color: $color-danger; }
        &.success { color: $color-success; }
      }
    }

    .section {
      margin-bottom: $spacing-2xl;

      h2 {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0 0 $spacing-base 0;
      }
    }

    .section-header {
      @include flex-between;
      margin-bottom: $spacing-base;

      h2 { margin: 0; }

      .view-all {
        color: $color-secondary;
        text-decoration: none;
        font-weight: $font-weight-semibold;
        font-size: $font-size-sm;

        &:hover { text-decoration: underline; }
      }
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: $spacing-base;

      @media (max-width: $breakpoint-tablet) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .action-card {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      padding: $spacing-xl;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: $spacing-sm;
      text-decoration: none;
      transition: $transition-all;
      border: $border-width-thin solid transparent;

      &:hover {
        border-color: $color-primary;
        transform: translateY(-2px);
        box-shadow: $shadow-lg;
      }

      .action-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: $color-primary-light;
        color: $color-primary;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
      }

      .action-label {
        font-weight: $font-weight-semibold;
        color: $color-text-primary;
        font-size: $font-size-sm;
      }
    }

    .data-table {
      width: 100%;
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      overflow: hidden;
      border-collapse: collapse;

      th, td {
        padding: $spacing-md $spacing-base;
        text-align: left;
        border-bottom: $border-width-thin solid $color-border;
      }

      th {
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
        font-size: $font-size-sm;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        background: $color-gray-50;
      }

      tbody tr {
        transition: $transition-background;
        &:hover { background: $color-bg-hover; }
        &:last-child td { border-bottom: none; }
      }
    }

    .date-cell { font-weight: $font-weight-semibold; white-space: nowrap; }
    .hours-cell { font-weight: $font-weight-bold; color: $color-primary; }
    .desc-cell {
      max-width: 250px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .invoice-number {
      font-family: monospace;
      font-weight: $font-weight-semibold;
      a { color: $color-primary; text-decoration: none; &:hover { text-decoration: underline; } }
    }
    .amount-cell { font-weight: $font-weight-bold; }

    .status-badge {
      @include badge-base;

      &.unbilled { background: $color-warning-light; color: $color-warning-text; }
      &.billed { background: $color-primary-light; color: $color-primary; }
      &.paid { background: $color-success-light; color: $color-success-text; }
      &.draft { background: $color-gray-100; color: $color-text-muted; }
      &.sent { background: $color-primary-light; color: $color-primary; }
      &.overdue { background: $color-danger-light; color: $color-danger-text; }
    }

    .empty-hint {
      padding: $spacing-xl;
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $card-shadow;
      text-align: center;

      p { color: $color-text-muted; margin: 0; }
      a { color: $color-secondary; text-decoration: none; &:hover { text-decoration: underline; } }
    }

    .preview-invoice-btn {
      margin-top: $spacing-sm;
      padding: $spacing-xs $spacing-sm;
      font-size: $font-size-xs;
      font-weight: $font-weight-semibold;
      color: $color-warning-text;
      background: $color-warning-light;
      border: $border-width-thin solid $color-warning;
      border-radius: $border-radius-sm;
      cursor: pointer;
      transition: $transition-all;
      align-self: flex-start;

      &:hover { background: $color-warning; color: $color-white; }
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: $spacing-base;
    }

    .modal {
      background: $color-white;
      border-radius: $card-border-radius;
      box-shadow: $shadow-lg;
      width: 100%;
      max-width: 640px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      @include flex-between;
      padding: $spacing-xl;
      border-bottom: $border-width-thin solid $color-border;

      h2 {
        font-size: $font-size-xl;
        font-weight: $font-weight-bold;
        color: $color-text-primary;
        margin: 0;
      }

      .modal-close {
        background: none;
        border: none;
        font-size: $font-size-lg;
        cursor: pointer;
        color: $color-text-muted;
        padding: $spacing-xs;
        line-height: 1;
        &:hover { color: $color-text-primary; }
      }
    }

    .modal-body {
      padding: $spacing-xl;
      overflow-y: auto;
    }

    .modal-subtitle {
      color: $color-text-muted;
      margin: 0 0 $spacing-xl 0;
      font-size: $font-size-sm;
    }

    .preview-customer {
      margin-bottom: $spacing-xl;
      border: $border-width-thin solid $color-border;
      border-radius: $border-radius-base;
      overflow: hidden;

      &:last-of-type { margin-bottom: 0; }
    }

    .preview-customer-header {
      @include flex-between;
      padding: $spacing-base $spacing-base $spacing-sm;
      background: $color-gray-50;

      .preview-customer-name {
        font-weight: $font-weight-bold;
        color: $color-text-primary;
      }

      .preview-customer-total {
        font-weight: $font-weight-bold;
        color: $color-primary;
        font-size: $font-size-lg;
      }
    }

    .preview-table {
      width: 100%;
      border-collapse: collapse;

      th, td {
        padding: $spacing-sm $spacing-base;
        text-align: left;
        border-bottom: $border-width-thin solid $color-border;
        font-size: $font-size-sm;
      }

      th {
        font-weight: $font-weight-semibold;
        color: $color-text-secondary;
        text-transform: uppercase;
        letter-spacing: $letter-spacing-wide;
        font-size: $font-size-xs;
        background: $color-gray-50;
      }

      tbody tr:last-child td { border-bottom: none; }
    }

    .preview-customer-action {
      padding: $spacing-base;
      display: flex;
      justify-content: flex-end;
      border-top: $border-width-thin solid $color-border-light;

      .btn-generate {
        @include button-primary;
        text-decoration: none;
        font-size: $font-size-sm;
      }
    }

    .preview-grand-total {
      @include flex-between;
      margin-top: $spacing-xl;
      padding: $spacing-base;
      background: $color-primary-light;
      border-radius: $border-radius-base;
      font-weight: $font-weight-bold;
      color: $color-primary;
      font-size: $font-size-lg;
    }

    .loading-state {
      text-align: center;
      padding: $spacing-3xl;

      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }

    @include tablet {
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .quick-actions { grid-template-columns: repeat(2, 1fr); }
      .data-table { font-size: $font-size-sm; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private timeEntryService = inject(TimeEntryService);
  private invoiceService = inject(InvoiceService);
  private customerService = inject(CustomerService);
  private projectService = inject(ProjectService);

  loading = true;
  recentEntries: TimeEntry[] = [];
  recentInvoices: Invoice[] = [];
  private customerMap = new Map<string, Customer>();
  private projectMap = new Map<string, Project>();
  private allUnbilledEntries: TimeEntry[] = [];

  unbilledHours = 0;
  outstandingTotal = 0;
  monthlyRevenue = 0;
  activeCustomerCount = 0;

  showInvoicePreview = false;
  invoicePreviewGroups: { customerName: string; customerId: string; total: number; lineItems: { projectName: string; hours: number; rate: number; amount: number }[] }[] = [];
  invoicePreviewGrandTotal = 0;

  ngOnInit(): void {
    this.customerService.getActiveCustomers().subscribe(customers => {
      this.activeCustomerCount = customers.length;
      customers.forEach(c => this.customerMap.set(c.id, c));
    });

    this.projectService.getProjects().subscribe(projects => {
      projects.forEach(p => this.projectMap.set(p.id, p));
    });

    this.timeEntryService.getTimeEntries().subscribe(entries => {
      this.recentEntries = entries.slice(0, 5);
      this.allUnbilledEntries = entries.filter(e => e.status === 'unbilled');
      this.unbilledHours = Math.round(
        this.allUnbilledEntries.reduce((sum, e) => sum + e.durationHours, 0) * 100
      ) / 100;
      this.loading = false;
    });

    this.invoiceService.getInvoices().subscribe(invoices => {
      this.recentInvoices = invoices.slice(0, 5);
      this.outstandingTotal = invoices
        .filter(i => i.status === 'sent' || i.status === 'overdue')
        .reduce((sum, i) => sum + i.total, 0);

      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      this.monthlyRevenue = invoices
        .filter(i => i.status === 'paid' && i.issueDate >= monthStart)
        .reduce((sum, i) => sum + i.total, 0);
    });
  }

  openInvoicePreview(): void {
    // Group unbilled entries by customer
    const byCustomer = new Map<string, TimeEntry[]>();
    for (const entry of this.allUnbilledEntries) {
      const list = byCustomer.get(entry.customerId) || [];
      list.push(entry);
      byCustomer.set(entry.customerId, list);
    }

    this.invoicePreviewGroups = [];
    this.invoicePreviewGrandTotal = 0;

    byCustomer.forEach((entries, customerId) => {
      const customer = this.customerMap.get(customerId);
      const customerName = customer?.companyName || customerId;

      // Group by project within customer
      const byProject = new Map<string, number>();
      for (const entry of entries) {
        byProject.set(entry.projectId, (byProject.get(entry.projectId) || 0) + entry.durationHours);
      }

      const lineItems: { projectName: string; hours: number; rate: number; amount: number }[] = [];
      let total = 0;

      byProject.forEach((hours, projectId) => {
        const project = this.projectMap.get(projectId);
        const rate = project?.hourlyRate || customer?.hourlyRate || 0;
        const roundedHours = Math.round(hours * 100) / 100;
        const amount = Math.round(roundedHours * rate * 100) / 100;
        total += amount;
        lineItems.push({ projectName: project?.projectName || projectId, hours: roundedHours, rate, amount });
      });

      total = Math.round(total * 100) / 100;
      this.invoicePreviewGrandTotal += total;
      this.invoicePreviewGroups.push({ customerName, customerId, total, lineItems });
    });

    this.invoicePreviewGrandTotal = Math.round(this.invoicePreviewGrandTotal * 100) / 100;
    this.showInvoicePreview = true;
  }

  closeInvoicePreview(): void {
    this.showInvoicePreview = false;
  }

  getCustomerName(customerId: string): string {
    return this.customerMap.get(customerId)?.companyName || customerId;
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }
}
