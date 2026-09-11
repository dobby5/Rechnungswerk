<template>
  <div>
    <div class="d-flex flex-wrap align-end justify-space-between ga-4 mb-6">
      <div><div class="eyebrow mb-2">Archiv</div><h1 class="page-heading">Alle Rechnungen</h1><p class="muted mt-2">Suchen, filtern, exportieren und Änderungen nachvollziehen.</p></div>
      <v-btn to="/invoices/new" color="primary" size="large" prepend-icon="mdi-plus">Neue Rechnung</v-btn>
    </div>
    <v-card class="surface-card pa-4 pa-md-5 mb-5">
      <v-row dense>
        <v-col cols="12" md="5"><v-text-field v-model="filters.search" label="Rechnung, Kunde oder Referenz suchen" prepend-inner-icon="mdi-magnify" clearable hide-details @keyup.enter="applyFilters" /></v-col>
        <v-col cols="6" md="2"><v-select v-model="filters.status" :items="statuses" label="Status" clearable hide-details /></v-col>
        <v-col cols="6" md="2"><v-text-field v-model="filters.dateFrom" type="date" label="Von" hide-details /></v-col>
        <v-col cols="8" md="2"><v-text-field v-model="filters.dateTo" type="date" label="Bis" hide-details /></v-col>
        <v-col cols="4" md="1"><v-btn icon="mdi-filter-check" color="primary" block height="48" aria-label="Filter anwenden" @click="applyFilters" /></v-col>
      </v-row>
    </v-card>

    <v-slide-y-transition><v-card v-if="selected.length" color="primary" class="pa-3 px-4 mb-4 text-white"><div class="d-flex flex-wrap align-center ga-3"><strong>{{ selected.length }} ausgewählt</strong><v-spacer /><v-btn color="white" variant="flat" prepend-icon="mdi-folder-zip-outline" :loading="exporting" @click="batchExport"><span class="text-primary">Als ZIP exportieren</span></v-btn><v-btn color="white" variant="text" @click="selected = []">Auswahl aufheben</v-btn></div></v-card></v-slide-y-transition>

    <v-card class="surface-card overflow-hidden">
      <v-skeleton-loader v-if="loading" type="table-heading, table-row@6" />
      <template v-else-if="invoices.length">
        <div v-if="mdAndUp" class="invoice-table-wrap">
          <table class="invoice-table">
            <thead><tr><th><v-checkbox-btn :model-value="allSelected" aria-label="Alle Rechnungen auswählen" @update:model-value="toggleAll" /></th><th>Rechnung</th><th>Kunde</th><th>Datum / Fällig</th><th>Status</th><th class="text-right">Betrag</th><th><span class="sr-only">Aktionen</span></th></tr></thead>
            <tbody><tr v-for="invoice in invoices" :key="invoice.id">
              <td><v-checkbox-btn v-model="selected" :value="invoice.id" :aria-label="`${invoice.invoiceNumber} auswählen`" /></td>
              <td><router-link :to="`/invoices/${invoice.id}/edit`" class="invoice-link">{{ invoice.invoiceNumber }}</router-link><div class="text-caption muted">Version {{ invoice.currentVersion }}</div></td>
              <td><strong>{{ customerName(invoice) }}</strong><div v-if="invoice.reference" class="text-caption muted">Ref. {{ invoice.reference }}</div></td>
              <td>{{ date(invoice.invoiceDate) }}<div class="text-caption" :class="isOverdue(invoice) ? 'text-error font-weight-bold' : 'muted'">fällig {{ date(invoice.dueDate) }}</div></td>
              <td><v-chip size="small" variant="tonal" :color="statusColor(invoice.status)"><span class="status-dot" />{{ statusLabel(invoice.status) }}</v-chip></td>
              <td class="text-right font-weight-bold amount">{{ money(invoice.grossMinor, invoice.currency) }}</td>
              <td><invoice-menu :invoice="invoice" @reload="load" @delete="askDelete(invoice)" /></td>
            </tr></tbody>
          </table>
        </div>
        <div v-else class="pa-3">
          <v-card v-for="invoice in invoices" :key="invoice.id" class="invoice-card pa-4 mb-3" variant="outlined" :to="`/invoices/${invoice.id}/edit`">
            <div class="d-flex align-start ga-3"><v-checkbox-btn v-model="selected" :value="invoice.id" aria-label="Rechnung auswählen" @click.prevent.stop /><div class="flex-grow-1 min-width-0"><div class="d-flex justify-space-between ga-3"><div><div class="font-weight-bold">{{ invoice.invoiceNumber }}</div><div class="text-body-2 muted text-truncate">{{ customerName(invoice) }}</div></div><div class="text-right"><strong class="amount">{{ money(invoice.grossMinor, invoice.currency) }}</strong><div><v-chip size="x-small" variant="tonal" :color="statusColor(invoice.status)">{{ statusLabel(invoice.status) }}</v-chip></div></div></div><v-divider class="my-3" /><div class="d-flex justify-space-between text-caption"><span>{{ date(invoice.invoiceDate) }}</span><span :class="isOverdue(invoice) ? 'text-error font-weight-bold' : 'muted'">Fällig {{ date(invoice.dueDate) }}</span></div></div><invoice-menu :invoice="invoice" @reload="load" @delete="askDelete(invoice)" @click.stop /></div>
          </v-card>
        </div>
        <v-divider /><div class="d-flex flex-wrap align-center justify-space-between ga-3 pa-4"><span class="text-body-2 muted">{{ rangeLabel }}</span><v-pagination v-model="page" :length="meta.totalPages" :total-visible="smAndUp ? 7 : 4" density="comfortable" @update:model-value="load" /></div>
      </template>
      <div v-else class="text-center pa-10 pa-sm-16"><div class="empty-art"><v-icon icon="mdi-archive-search-outline" size="34" /></div><h2 class="text-h6 font-weight-bold">Keine passenden Rechnungen</h2><p class="muted mt-2 mb-5">Passe die Filter an oder erstelle eine neue Rechnung.</p><v-btn color="primary" variant="tonal" @click="resetFilters">Filter zurücksetzen</v-btn></div>
    </v-card>

    <v-dialog v-model="deleteDialog" max-width="460"><v-card class="pa-6"><v-avatar color="error" variant="tonal" class="mb-4"><v-icon icon="mdi-trash-can-outline" /></v-avatar><h2 class="text-h6 font-weight-bold">Rechnung verschieben?</h2><p class="muted mt-2">{{ deleting?.invoiceNumber }} wird 30 Tage im Papierkorb aufbewahrt und kann wiederhergestellt werden.</p><div class="d-flex justify-end ga-3 mt-6"><v-btn variant="text" @click="deleteDialog = false">Abbrechen</v-btn><v-btn color="error" :loading="deletingNow" @click="confirmDelete">In Papierkorb</v-btn></div></v-card></v-dialog>
    <v-snackbar v-model="undo.show" timeout="8000" color="surface" location="bottom"><span class="text-high-emphasis">Rechnung in den Papierkorb verschoben.</span><template #actions><v-btn color="primary" :loading="undo.loading" @click="undoDelete">Rückgängig</v-btn></template></v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { InvoiceStatus, invoiceStatusLabels } from '@rechnungswerk/shared';
import { api, apiMessage, download } from '../api/client';
import { useUiStore } from '../stores/ui';

interface InvoiceSummary { id: string; invoiceNumber: string; invoiceDate: string; dueDate: string; status: InvoiceStatus; currency: string; grossMinor: string; currentVersion: number; reference: string | null; customerSnapshot: Record<string, unknown> }
const ui = useUiStore(); const route = useRoute(); const router = useRouter(); const { mdAndUp, smAndUp } = useDisplay();
const invoices = ref<InvoiceSummary[]>([]); const loading = ref(true); const exporting = ref(false); const selected = ref<string[]>([]); const page = ref(1); const meta = reactive({ total: 0, totalPages: 1, pageSize: 25 });
const filters = reactive({ search: '', status: typeof route.query.status === 'string' ? route.query.status : '', dateFrom: '', dateTo: '' });
const statuses = Object.values(InvoiceStatus).map((value) => ({ title: invoiceStatusLabels[value], value }));
const deleteDialog = ref(false); const deleting = ref<InvoiceSummary | null>(null); const deletingNow = ref(false); const undo = reactive({ show: false, id: '', loading: false });
const allSelected = computed(() => invoices.value.length > 0 && invoices.value.every((invoice) => selected.value.includes(invoice.id)));
const rangeLabel = computed(() => meta.total ? `${(page.value - 1) * meta.pageSize + 1}–${Math.min(page.value * meta.pageSize, meta.total)} von ${meta.total}` : '0 Einträge');

const InvoiceMenu = defineComponent({
  name: 'InvoiceMenu', props: { invoice: { type: Object as () => InvoiceSummary, required: true } }, emits: ['reload', 'delete'],
  setup(props, { emit }) {
    const busy = ref(false);
    async function duplicate(): Promise<void> { busy.value = true; try { await api.post(`/invoices/${props.invoice.id}/duplicate`); ui.notify('Rechnung wurde dupliziert.'); emit('reload'); } catch (e) { ui.notify(apiMessage(e), 'error'); } finally { busy.value = false; } }
    async function file(format: 'pdf'|'docx'): Promise<void> { try { await download(`/invoices/${props.invoice.id}/documents/${format}`, `${props.invoice.invoiceNumber}.${format}`); } catch (e) { ui.notify(apiMessage(e), 'error'); } }
    return () => h('div', { onClick: (event: Event) => event.stopPropagation() }, [h(resolveComponent('VMenu') as never, { location: 'bottom end' }, { activator: ({ props: activatorProps }: { props: object }) => h(resolveComponent('VBtn') as never, { ...activatorProps, icon: 'mdi-dots-horizontal', variant: 'text', loading: busy.value, 'aria-label': 'Rechnungsaktionen' }), default: () => h(resolveComponent('VList') as never, { minWidth: 220 }, { default: () => [
      h(resolveComponent('VListItem') as never, { prependIcon: 'mdi-pencil-outline', title: 'Bearbeiten', to: `/invoices/${props.invoice.id}/edit` }),
      h(resolveComponent('VListItem') as never, { prependIcon: 'mdi-history', title: 'Versionen', to: `/invoices/${props.invoice.id}/versions` }),
      h(resolveComponent('VListItem') as never, { prependIcon: 'mdi-content-copy', title: 'Duplizieren', onClick: duplicate }),
      h(resolveComponent('VDivider') as never),
      h(resolveComponent('VListItem') as never, { prependIcon: 'mdi-file-pdf-box', title: 'PDF herunterladen', onClick: () => file('pdf') }),
      h(resolveComponent('VListItem') as never, { prependIcon: 'mdi-file-word-outline', title: 'Word herunterladen', onClick: () => file('docx') }),
      h(resolveComponent('VDivider') as never),
      h(resolveComponent('VListItem') as never, { prependIcon: 'mdi-trash-can-outline', title: 'Löschen', baseColor: 'error', onClick: () => emit('delete') }),
    ] }) })]);
  },
});
import { resolveComponent } from 'vue';

async function load(): Promise<void> { loading.value = true; try { const { data } = await api.get('/invoices', { params: { page: page.value, pageSize: meta.pageSize, ...filters } }); invoices.value = data.data; Object.assign(meta, data.meta); selected.value = selected.value.filter((id) => invoices.value.some((item) => item.id === id)); } catch (e) { ui.notify(apiMessage(e), 'error'); } finally { loading.value = false; } }
async function applyFilters(): Promise<void> { page.value = 1; await router.replace({ query: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }); await load(); }
async function resetFilters(): Promise<void> { Object.assign(filters, { search: '', status: '', dateFrom: '', dateTo: '' }); await applyFilters(); }
function toggleAll(value: boolean | null): void { selected.value = value ? invoices.value.map((invoice) => invoice.id) : []; }
async function batchExport(): Promise<void> { exporting.value = true; try { await download('/invoices/batch-export', 'Rechnungen.zip', 'post', { invoiceIds: selected.value, format: 'both' }); ui.notify('ZIP-Export wurde erstellt.'); } catch (e) { ui.notify(apiMessage(e), 'error'); } finally { exporting.value = false; } }
function askDelete(invoice: InvoiceSummary): void { deleting.value = invoice; deleteDialog.value = true; }
async function confirmDelete(): Promise<void> { if (!deleting.value) return; deletingNow.value = true; try { const id = deleting.value.id; await api.delete(`/invoices/${id}`); undo.id = id; undo.show = true; deleteDialog.value = false; await load(); } catch (e) { ui.notify(apiMessage(e), 'error'); } finally { deletingNow.value = false; } }
async function undoDelete(): Promise<void> { undo.loading = true; try { await api.post(`/invoices/${undo.id}/restore`); undo.show = false; ui.notify('Rechnung wiederhergestellt.'); await load(); } catch (e) { ui.notify(apiMessage(e), 'error'); } finally { undo.loading = false; } }
function money(minor: string, currency: string): string { return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(Number(minor) / 100); }
function date(value: string): string { return new Intl.DateTimeFormat('de-DE').format(new Date(`${value}T12:00:00`)); }
function customerName(invoice: InvoiceSummary): string { return String(invoice.customerSnapshot.name ?? 'Ohne Kundenname'); }
function statusLabel(status: InvoiceStatus): string { return invoiceStatusLabels[status]; }
function statusColor(status: InvoiceStatus): string { return ({ DRAFT: 'grey', FINALIZED: 'primary', SENT: 'warning', PAID: 'success', CANCELLED: 'error' } as Record<string,string>)[status] ?? 'grey'; }
function isOverdue(invoice: InvoiceSummary): boolean { return [InvoiceStatus.FINALIZED, InvoiceStatus.SENT].includes(invoice.status) && invoice.dueDate < new Date().toISOString().slice(0, 10); }
onMounted(load);
</script>

<style scoped>
.invoice-table-wrap { overflow-x: auto; }.invoice-table { width: 100%; border-collapse: collapse; min-width: 900px; }.invoice-table th { color: rgba(var(--v-theme-on-surface),.58); font-size: .72rem; text-transform: uppercase; letter-spacing: .06em; text-align: left; padding: 15px 14px; background: rgba(var(--v-theme-on-surface),.025); }.invoice-table td { padding: 15px 14px; border-top: 1px solid rgba(var(--v-border-color),.09); }.invoice-table tr:hover td { background: rgba(var(--v-theme-primary),.025); }.invoice-link { color: rgb(var(--v-theme-on-surface)); font-weight: 750; text-decoration: none; }.invoice-link:hover { color: rgb(var(--v-theme-primary)); }.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }.min-width-0 { min-width: 0; }
</style>
