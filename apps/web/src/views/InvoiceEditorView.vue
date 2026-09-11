<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-6">
      <div><div class="d-flex align-center ga-2 mb-2"><v-btn icon="mdi-arrow-left" variant="text" size="small" to="/invoices" aria-label="Zurück zum Archiv" /><span class="eyebrow">{{ isNew ? 'Neue Rechnung' : form.invoiceNumber }}</span></div><h1 class="page-heading">{{ isNew ? 'Rechnung erstellen' : 'Rechnung bearbeiten' }}</h1></div>
      <div v-if="!isNew" class="d-flex ga-2"><v-btn :to="`/invoices/${route.params.id}/versions`" variant="tonal" prepend-icon="mdi-history">Version {{ form.currentVersion }}</v-btn><v-menu><template #activator="{ props }"><v-btn v-bind="props" variant="tonal" prepend-icon="mdi-download">Export</v-btn></template><v-list><v-list-item prepend-icon="mdi-file-pdf-box" title="PDF" @click="exportFile('pdf')" /><v-list-item prepend-icon="mdi-file-word-outline" title="Word" @click="exportFile('docx')" /><v-list-item prepend-icon="mdi-folder-zip-outline" title="PDF + Word" @click="exportZip" /></v-list></v-menu></div>
    </div>
    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />
    <v-alert v-if="error" type="error" variant="tonal" closable class="mb-5" @click:close="error = ''">{{ error }}</v-alert>
    <v-row v-if="!loading">
      <v-col cols="12" lg="8">
        <v-form ref="formRef" @submit.prevent="save">
          <v-card class="surface-card pa-5 pa-sm-6 mb-5">
            <div class="d-flex align-center ga-3 mb-5"><div class="step">1</div><div><h2 class="text-h6 font-weight-bold">Kunde & Eckdaten</h2><div class="text-body-2 muted">Empfänger auswählen und Zeitraum festlegen.</div></div></div>
            <v-autocomplete v-model="form.customerId" :items="customers" item-title="displayName" item-value="id" label="Kunde" prepend-inner-icon="mdi-account-outline" :rules="[required]" :loading="customersLoading" no-data-text="Kein Kunde gefunden" clearable>
              <template #append><v-btn icon="mdi-account-plus-outline" variant="text" to="/customers" aria-label="Neuen Kunden anlegen" /></template>
            </v-autocomplete>
            <v-row dense><v-col cols="12" sm="6" md="3"><v-text-field v-model="form.invoiceDate" label="Rechnungsdatum" type="date" :rules="[required]" /></v-col><v-col cols="12" sm="6" md="3"><v-text-field v-model="form.serviceStart" label="Leistung von" type="date" :rules="[required]" /></v-col><v-col cols="12" sm="6" md="3"><v-text-field v-model="form.serviceEnd" label="Leistung bis" type="date" /></v-col><v-col cols="12" sm="6" md="3"><v-text-field v-model="form.dueDate" label="Zahlbar bis" type="date" :rules="[required]" /></v-col></v-row>
            <v-row dense><v-col cols="12" sm="8"><v-text-field v-model="form.reference" label="Referenz / Bestellnummer (optional)" prepend-inner-icon="mdi-pound" /></v-col><v-col cols="12" sm="4"><v-select v-model="form.currency" label="Währung" :items="['EUR','CHF','USD','GBP']" /></v-col></v-row>
          </v-card>

          <v-card class="surface-card pa-5 pa-sm-6 mb-5">
            <div class="d-flex align-center ga-3 mb-5"><div class="step">2</div><div><h2 class="text-h6 font-weight-bold">Positionen</h2><div class="text-body-2 muted">Beträge werden centgenau berechnet.</div></div><v-spacer /><v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="addItem">Position</v-btn></div>
            <div v-if="mdAndUp" class="items-grid header"><span>Beschreibung</span><span>Menge</span><span>Einheit</span><span>Preis netto</span><span>Rabatt %</span><span>USt.</span><span>Netto</span><span /></div>
            <div v-for="(item, index) in form.items" :key="item.key" :class="mdAndUp ? 'items-grid row' : 'mobile-item'">
              <v-textarea v-model="item.description" :label="mdAndUp ? undefined : 'Beschreibung'" rows="1" auto-grow :rules="[required]" hide-details="auto" />
              <v-text-field v-model="item.quantity" :label="mdAndUp ? undefined : 'Menge'" inputmode="decimal" :rules="[positive]" hide-details="auto" />
              <v-text-field v-model="item.unit" :label="mdAndUp ? undefined : 'Einheit'" hide-details="auto" />
              <v-text-field v-model="item.unitPrice" :label="mdAndUp ? undefined : 'Einzelpreis netto'" inputmode="decimal" prefix="€" :rules="[moneyRule]" hide-details="auto" />
              <v-text-field v-model="item.discount" :label="mdAndUp ? undefined : 'Rabatt %'" inputmode="decimal" suffix="%" hide-details="auto" />
              <v-select v-model="item.taxRate" :label="mdAndUp ? undefined : 'Steuer'" :items="taxRates" item-title="title" item-value="value" hide-details />
              <div class="font-weight-bold amount py-3 text-right">{{ moneyMinor(itemTotal(index).net) }}</div>
              <v-btn icon="mdi-delete-outline" variant="text" color="error" :disabled="form.items.length === 1" :aria-label="`Position ${index + 1} löschen`" @click="removeItem(index)" />
            </div>
          </v-card>

          <v-card class="surface-card pa-5 pa-sm-6 mb-5">
            <div class="d-flex align-center ga-3 mb-5"><div class="step">3</div><div><h2 class="text-h6 font-weight-bold">Texte & Notizen</h2><div class="text-body-2 muted">Persönliche Hinweise und interne Informationen.</div></div></div>
            <v-textarea v-model="form.introductionText" label="Einleitungstext" rows="2" auto-grow counter="5000" /><v-textarea v-model="form.closingText" label="Schlusstext" rows="2" auto-grow counter="5000" /><v-textarea v-model="form.internalNotes" label="Interne Notizen (nicht im Dokument)" rows="2" auto-grow prepend-inner-icon="mdi-lock-outline" counter="5000" />
            <v-textarea v-if="requiresReason" v-model="form.changeReason" label="Änderungsgrund (erforderlich)" rows="2" :rules="[required]" hint="Wird dauerhaft im Versionsverlauf gespeichert." persistent-hint />
          </v-card>
          <div class="sticky-actions"><v-card class="surface-card pa-3"><div class="d-flex flex-wrap justify-end ga-3"><v-btn to="/invoices" variant="text">Abbrechen</v-btn><v-btn v-if="!isNew && nextStatuses.length" variant="tonal" color="primary" :loading="statusLoading"><v-menu activator="parent"><v-list><v-list-item v-for="status in nextStatuses" :key="status" :title="`Als ${statusLabel(status)} markieren`" @click="changeStatus(status)" /></v-list></v-menu>Status ändern <v-icon end icon="mdi-chevron-down" /></v-btn><v-btn type="submit" color="primary" size="large" prepend-icon="mdi-content-save-outline" :loading="saving">{{ isNew ? 'Entwurf erstellen' : 'Neue Version speichern' }}</v-btn></div></v-card></div>
        </v-form>
      </v-col>
      <v-col cols="12" lg="4">
        <div class="summary-sticky"><v-card class="surface-card pa-6 mb-5"><div class="d-flex justify-space-between align-center mb-5"><h2 class="text-h6 font-weight-bold">Zusammenfassung</h2><v-chip v-if="!isNew" size="small" variant="tonal" :color="statusColor(form.status)">{{ statusLabel(form.status) }}</v-chip></div><div class="summary-line"><span>Netto</span><strong class="amount">{{ moneyMinor(totals.net) }}</strong></div><div class="summary-line"><span>Umsatzsteuer</span><strong class="amount">{{ moneyMinor(totals.tax) }}</strong></div><v-divider class="my-4" /><div class="summary-line total"><span>Gesamt</span><strong class="amount">{{ moneyMinor(totals.gross) }}</strong></div><div class="text-caption muted mt-4"><v-icon icon="mdi-information-outline" size="15" /> Vorschau. Das Backend berechnet beim Speichern verbindlich neu.</div></v-card>
          <v-card class="surface-card pa-5"><div class="d-flex ga-3"><div class="metric-icon"><v-icon icon="mdi-history" color="primary" /></div><div><strong>Revisionssicherer Verlauf</strong><p class="text-caption muted mt-1">Jedes Speichern erzeugt einen vollständigen Snapshot mit Benutzer und Zeitpunkt.</p></div></div></v-card></div>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { InvoiceStatus, allowedStatusTransitions, invoiceStatusLabels } from '@rechnungswerk/shared';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { useDisplay } from 'vuetify';
import { api, apiMessage, download } from '../api/client';
import { useUiStore } from '../stores/ui';

interface ItemForm { key: number; description: string; quantity: string; unit: string; unitPrice: string; discount: string; taxRate: number }
interface CustomerOption { id: string; name: string; company: string | null; displayName: string }
const route = useRoute(); const router = useRouter(); const ui = useUiStore(); const { mdAndUp } = useDisplay(); const formRef = ref<{ validate(): Promise<{ valid: boolean }> }>();
const isNew = computed(() => route.name === 'invoice-new'); const loading = ref(!isNew.value); const saving = ref(false); const statusLoading = ref(false); const error = ref(''); const dirty = ref(false); let key = 1;
const today = new Date().toISOString().slice(0, 10); const due = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
const form = reactive({ invoiceNumber: '', customerId: '', invoiceDate: today, serviceStart: today, serviceEnd: '', dueDate: due, currency: 'EUR', reference: '', introductionText: 'Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen folgende Leistungen:', closingText: 'Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer.', internalNotes: '', changeReason: '', status: InvoiceStatus.DRAFT, currentVersion: 1, items: [{ key: key++, description: '', quantity: '1', unit: 'Stk.', unitPrice: '0,00', discount: '0', taxRate: 1900 }] as ItemForm[] });
const customers = ref<CustomerOption[]>([]); const customersLoading = ref(false); const taxRates = [{ title: '0 %', value: 0 }, { title: '7 %', value: 700 }, { title: '19 %', value: 1900 }];
const requiresReason = computed(() => !isNew.value && form.status !== InvoiceStatus.DRAFT); const nextStatuses = computed(() => allowedStatusTransitions[form.status]);
const totals = computed(() => form.items.reduce((sum, _item, index) => { const value = itemTotal(index); return { net: sum.net + value.net, tax: sum.tax + value.tax, gross: sum.gross + value.gross }; }, { net: 0n, tax: 0n, gross: 0n }));
const required = (value: unknown) => Boolean(String(value ?? '').trim()) || 'Pflichtfeld';
const positive = (value: string) => decimalScaled(value, 4) > 0n || 'Muss größer als 0 sein';
const moneyRule = (value: string) => /^\d{1,14}(?:[.,]\d{1,2})?$/.test(value.trim()) || 'Gültigen Betrag eingeben';

function decimalScaled(value: string, scale: number): bigint { const normalized = value.trim().replace(',', '.'); if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0n; const [whole = '0', fraction = ''] = normalized.split('.'); return BigInt(`${whole}${fraction.slice(0, scale).padEnd(scale, '0')}`); }
function unitMinor(value: string): bigint { return decimalScaled(value, 2); }
function rounded(numerator: bigint, denominator: bigint): bigint { return (numerator + denominator / 2n) / denominator; }
function itemTotal(index: number) { const item = form.items[index]; if (!item) return { net: 0n, tax: 0n, gross: 0n }; const quantity = decimalScaled(item.quantity, 4); const discount = decimalScaled(item.discount, 2); const net = rounded(unitMinor(item.unitPrice) * quantity * (10_000n - discount), 10_000n * 10_000n); const tax = rounded(net * BigInt(item.taxRate), 10_000n); return { net, tax, gross: net + tax }; }
function moneyMinor(value: bigint): string { return new Intl.NumberFormat('de-DE', { style: 'currency', currency: form.currency }).format(Number(value) / 100); }
function addItem(): void { form.items.push({ key: key++, description: '', quantity: '1', unit: 'Stk.', unitPrice: '0,00', discount: '0', taxRate: 1900 }); dirty.value = true; }
function removeItem(index: number): void { form.items.splice(index, 1); dirty.value = true; }
function statusLabel(status: InvoiceStatus): string { return invoiceStatusLabels[status]; }
function statusColor(status: InvoiceStatus): string { return ({ DRAFT: 'grey', FINALIZED: 'primary', SENT: 'warning', PAID: 'success', CANCELLED: 'error' } as Record<string,string>)[status] ?? 'grey'; }
function payload() { return { customerId: form.customerId, invoiceNumber: form.invoiceNumber || undefined, invoiceDate: form.invoiceDate, serviceStart: form.serviceStart, serviceEnd: form.serviceEnd || undefined, dueDate: form.dueDate, currency: form.currency, reference: form.reference || undefined, introductionText: form.introductionText || undefined, closingText: form.closingText || undefined, internalNotes: form.internalNotes || undefined, expectedVersion: isNew.value ? undefined : form.currentVersion, changeReason: form.changeReason || undefined, items: form.items.map((item) => ({ description: item.description, quantity: item.quantity.replace(',', '.'), unit: item.unit, unitPriceMinor: unitMinor(item.unitPrice).toString(), discountBasisPoints: Number(decimalScaled(item.discount, 2)), taxRateBasisPoints: item.taxRate })) }; }
async function loadCustomers(): Promise<void> { customersLoading.value = true; try { const response = await api.get('/customers', { params: { pageSize: 100 } }); customers.value = response.data.data.map((customer: Omit<CustomerOption,'displayName'>) => ({ ...customer, displayName: customer.company ? `${customer.company} · ${customer.name}` : customer.name })); } finally { customersLoading.value = false; } }
async function loadInvoice(): Promise<void> { if (isNew.value) return; try { const invoice = (await api.get(`/invoices/${route.params.id}`)).data; Object.assign(form, { invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId, invoiceDate: invoice.invoiceDate, serviceStart: invoice.serviceStart, serviceEnd: invoice.serviceEnd ?? '', dueDate: invoice.dueDate, currency: invoice.currency, reference: invoice.reference ?? '', introductionText: invoice.introductionText ?? '', closingText: invoice.closingText ?? '', internalNotes: invoice.internalNotes ?? '', status: invoice.status, currentVersion: invoice.currentVersion, items: invoice.items.map((item: Record<string, unknown>) => ({ key: key++, description: String(item.description), quantity: String(item.quantity), unit: String(item.unit), unitPrice: (Number(item.unitPriceMinor) / 100).toFixed(2).replace('.', ','), discount: (Number(item.discountBasisPoints) / 100).toString().replace('.', ','), taxRate: Number(item.taxRateBasisPoints) })) }); dirty.value = false; } catch (reason) { error.value = apiMessage(reason); } finally { loading.value = false; } }
async function save(): Promise<void> { const validation = await formRef.value?.validate(); if (!validation?.valid) { error.value = 'Bitte korrigiere die markierten Felder.'; return; } saving.value = true; error.value = ''; const creating = isNew.value; try { const response = creating ? await api.post('/invoices', payload()) : await api.patch(`/invoices/${route.params.id}`, payload()); ui.notify(creating ? 'Rechnung als Entwurf erstellt.' : `Version ${response.data.currentVersion} gespeichert.`); if (creating) { await router.replace(`/invoices/${response.data.id}/edit`); await loadInvoice(); } else { form.currentVersion = response.data.currentVersion; form.changeReason = ''; dirty.value = false; } } catch (reason) { error.value = apiMessage(reason); } finally { saving.value = false; } }
async function changeStatus(status: InvoiceStatus): Promise<void> { if (dirty.value) { ui.notify('Bitte Änderungen zuerst speichern.', 'warning'); return; } statusLoading.value = true; try { const response = await api.post(`/invoices/${route.params.id}/status`, { status, expectedVersion: form.currentVersion, reason: form.changeReason || undefined }); form.status = response.data.status; form.currentVersion = response.data.currentVersion; form.changeReason = ''; dirty.value = false; ui.notify(`Status auf „${statusLabel(status)}“ gesetzt.`); } catch (reason) { error.value = apiMessage(reason); } finally { statusLoading.value = false; } }
async function exportFile(format: 'pdf'|'docx'): Promise<void> { try { await download(`/invoices/${route.params.id}/documents/${format}`, `${form.invoiceNumber}.${format}`); } catch (reason) { ui.notify(apiMessage(reason), 'error'); } }
async function exportZip(): Promise<void> { try { await download(`/invoices/${route.params.id}/export`, `${form.invoiceNumber}.zip`); } catch (reason) { ui.notify(apiMessage(reason), 'error'); } }
watch(form, () => { dirty.value = true; }, { deep: true, flush: 'sync' });
onMounted(async () => { await Promise.all([loadCustomers(), loadInvoice()]); dirty.value = false; });
onBeforeRouteLeave(() => !dirty.value || window.confirm('Ungespeicherte Änderungen verwerfen?'));
</script>

<style scoped>
.step { width: 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; flex: 0 0 auto; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary),.11); font-weight: 800; }.items-grid { display: grid; grid-template-columns: minmax(220px,2.4fr) minmax(75px,.65fr) minmax(70px,.6fr) minmax(100px,.9fr) minmax(78px,.65fr) minmax(82px,.65fr) minmax(100px,.9fr) 42px; gap: 9px; align-items: start; min-width: 950px; }.items-grid.header { color: rgba(var(--v-theme-on-surface),.58); font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; padding: 0 4px 9px; }.items-grid.row { border-top: 1px solid rgba(var(--v-border-color),.08); padding: 13px 0; }.surface-card:has(.items-grid) { overflow-x: auto; }.mobile-item { border: 1px solid rgba(var(--v-border-color),.12); border-radius: 16px; padding: 14px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }.mobile-item > :first-child { grid-column: 1/-1; }.summary-line { display: flex; justify-content: space-between; gap: 16px; margin: 13px 0; }.summary-line.total { font-size: 1.2rem; }.summary-sticky { position: sticky; top: 94px; }
</style>
