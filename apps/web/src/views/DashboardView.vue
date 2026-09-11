<template>
  <div>
    <div class="d-flex flex-wrap align-end justify-space-between ga-4 mb-7">
      <div><div class="eyebrow mb-2">{{ today }}</div><h1 class="page-heading">Finanzen auf einen Blick</h1><p class="muted mt-2">Aktuelle Zahlen und die nächsten wichtigen Schritte.</p></div>
      <v-btn to="/invoices/new" color="primary" size="large" prepend-icon="mdi-plus">Neue Rechnung</v-btn>
    </div>
    <v-row v-if="loading"><v-col v-for="n in 4" :key="n" cols="12" sm="6" xl="3"><v-skeleton-loader type="article" class="surface-card rounded-xl" /></v-col></v-row>
    <v-row v-else>
      <v-col v-for="metric in metrics" :key="metric.label" cols="12" sm="6" xl="3">
        <v-card class="surface-card pa-5 h-100"><div class="d-flex justify-space-between align-start"><div><div class="muted text-body-2">{{ metric.label }}</div><div class="metric-value mt-2 amount">{{ metric.value }}</div><div class="text-caption mt-2" :class="metric.hintColor">{{ metric.hint }}</div></div><div class="metric-icon" :style="{ color: metric.color, background: `${metric.color}18` }"><v-icon :icon="metric.icon" /></div></div></v-card>
      </v-col>
    </v-row>
    <v-row class="mt-3">
      <v-col cols="12" lg="8">
        <v-card class="surface-card pa-5 pa-sm-6 h-100"><div class="d-flex justify-space-between align-center mb-5"><div><h2 class="text-h6 font-weight-bold">Zuletzt bearbeitet</h2><div class="muted text-body-2">Direkt dort weitermachen, wo du aufgehört hast.</div></div><v-btn to="/invoices" variant="text" color="primary" append-icon="mdi-arrow-right">Alle</v-btn></div>
          <v-list v-if="dashboard.recent.length" lines="two" class="bg-transparent pa-0">
            <v-list-item v-for="invoice in dashboard.recent" :key="invoice.id" :to="`/invoices/${invoice.id}/edit`" rounded="lg" class="px-2 mb-1">
              <template #prepend><v-avatar color="primary" variant="tonal"><v-icon icon="mdi-receipt-text-outline" /></v-avatar></template>
              <v-list-item-title class="font-weight-bold">{{ invoice.invoiceNumber }}</v-list-item-title>
              <v-list-item-subtitle>{{ customerName(invoice) }} · {{ date(invoice.updatedAt) }}</v-list-item-subtitle>
              <template #append><div class="text-right"><div class="font-weight-bold amount">{{ money(invoice.grossMinor, invoice.currency) }}</div><v-chip size="x-small" variant="tonal" :color="statusColor(invoice.status)">{{ statusLabel(invoice.status) }}</v-chip></div></template>
            </v-list-item>
          </v-list>
          <div v-else class="text-center py-10"><div class="empty-art"><v-icon icon="mdi-receipt-text-plus-outline" size="34" /></div><h3>Noch keine Rechnungen</h3><p class="muted mt-2 mb-5">Mit der ersten Rechnung füllt sich deine Übersicht.</p><v-btn to="/invoices/new" color="primary">Jetzt erstellen</v-btn></div>
        </v-card>
      </v-col>
      <v-col cols="12" lg="4"><v-card class="surface-card pa-6 h-100 action-card"><div class="eyebrow">Fokus</div><h2 class="text-h5 font-weight-bold mt-3">{{ overdueHeadline }}</h2><p class="muted mt-3">Offene und überfällige Rechnungen sind im Archiv sofort filterbar.</p><v-btn to="/invoices?status=SENT" color="primary" variant="tonal" block class="mt-6">Offene Rechnungen prüfen</v-btn><v-divider class="my-6" /><div class="d-flex align-center ga-3"><div class="metric-icon"><v-icon icon="mdi-shield-check-outline" color="success" /></div><div><div class="font-weight-bold">Lückenlos versioniert</div><div class="text-caption muted">Jede relevante Änderung bleibt sichtbar.</div></div></div></v-card></v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { InvoiceStatus, invoiceStatusLabels } from '@rechnungswerk/shared';
import { api, apiMessage } from '../api/client';
import { useUiStore } from '../stores/ui';

interface InvoiceSummary { id: string; invoiceNumber: string; status: InvoiceStatus; currency: string; grossMinor: string; updatedAt: string; customerSnapshot: Record<string, unknown> }
interface Dashboard { metrics: Record<string, string>; recent: InvoiceSummary[] }
const dashboard = reactive<Dashboard>({ metrics: {}, recent: [] }); const loading = ref(true); const ui = useUiStore();
const today = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
const metrics = computed(() => [
  { label: 'Rechnungen im Monat', value: dashboard.metrics.monthCount ?? '0', hint: 'Aktueller Monat', hintColor: 'text-primary', icon: 'mdi-calendar-month-outline', color: '#3157D5' },
  { label: 'Offene Rechnungen', value: dashboard.metrics.openCount ?? '0', hint: money(dashboard.metrics.overdueMinor ?? '0', 'EUR') + ' überfällig', hintColor: 'text-warning', icon: 'mdi-clock-outline', color: '#D98400' },
  { label: 'Bezahlte Rechnungen', value: dashboard.metrics.paidCount ?? '0', hint: 'Erfolgreich abgeschlossen', hintColor: 'text-success', icon: 'mdi-check-circle-outline', color: '#158765' },
  { label: 'Umsatz im Jahr', value: money(dashboard.metrics.revenueMinor ?? '0', 'EUR'), hint: 'Basierend auf bezahlten Rechnungen', hintColor: 'muted', icon: 'mdi-chart-line', color: '#6D5BD0' },
]);
const overdueHeadline = computed(() => Number(dashboard.metrics.overdueCount ?? 0) ? `${dashboard.metrics.overdueCount} ${Number(dashboard.metrics.overdueCount) === 1 ? 'Rechnung braucht' : 'Rechnungen brauchen'} Aufmerksamkeit` : 'Alles im grünen Bereich');
function money(minor: string, currency: string): string { return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number(minor) / 100); }
function date(value: string): string { return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(value)); }
function customerName(invoice: InvoiceSummary): string { return String(invoice.customerSnapshot.name ?? 'Ohne Kundenname'); }
function statusLabel(status: InvoiceStatus): string { return invoiceStatusLabels[status]; }
function statusColor(status: InvoiceStatus): string { return ({ DRAFT: 'grey', FINALIZED: 'primary', SENT: 'warning', PAID: 'success', CANCELLED: 'error' } as Record<string,string>)[status] ?? 'grey'; }
onMounted(async () => { try { Object.assign(dashboard, (await api.get<Dashboard>('/dashboard')).data); } catch (error) { ui.notify(apiMessage(error), 'error'); } finally { loading.value = false; } });
</script>
