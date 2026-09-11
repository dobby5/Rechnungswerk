<template>
  <div>
    <div class="d-flex align-center ga-3 mb-6"><v-btn icon="mdi-arrow-left" variant="text" :to="`/invoices/${route.params.id}/edit`" aria-label="Zurück zur Rechnung" /><div><div class="eyebrow mb-1">Änderungshistorie</div><h1 class="page-heading">Versionsverlauf</h1></div></div>
    <v-alert type="info" variant="tonal" class="mb-5" icon="mdi-shield-check-outline">Snapshots sind unveränderlich. Eine Wiederherstellung erzeugt immer eine neue Version.</v-alert>
    <v-row>
      <v-col cols="12" lg="5">
        <v-card class="surface-card pa-4"><v-skeleton-loader v-if="loading" type="list-item-two-line@5" /><v-timeline v-else-if="versions.length" side="end" density="compact" truncate-line="both">
          <v-timeline-item v-for="version in versions" :key="version.id" :dot-color="version.versionNumber === currentVersion ? 'primary' : 'grey'" size="small">
            <v-card variant="outlined" class="pa-4" :color="selected.includes(version.versionNumber) ? 'primary' : undefined" @click="toggleSelected(version.versionNumber)">
              <div class="d-flex justify-space-between align-center"><strong>Version {{ version.versionNumber }}</strong><v-chip v-if="version.versionNumber === currentVersion" size="x-small" color="primary">Aktuell</v-chip></div>
              <div class="text-body-2 mt-2">{{ version.changeReason || 'Ohne Änderungsgrund' }}</div><div class="text-caption muted mt-2"><v-icon icon="mdi-account-outline" size="14" /> {{ version.changedBy.name }} · {{ dateTime(version.createdAt) }}</div>
              <div class="d-flex ga-2 mt-3"><v-btn size="small" variant="tonal" @click.stop="inspect(version)">Anzeigen</v-btn><v-btn v-if="version.versionNumber !== currentVersion" size="small" variant="text" @click.stop="openRestore(version)">Wiederherstellen</v-btn></div>
            </v-card>
          </v-timeline-item>
        </v-timeline><div v-else class="pa-8 text-center muted">Keine Versionen vorhanden.</div></v-card>
      </v-col>
      <v-col cols="12" lg="7">
        <v-card class="surface-card pa-5 pa-sm-6">
          <div class="d-flex flex-wrap align-center ga-3 mb-5"><div><h2 class="text-h6 font-weight-bold">Vergleich</h2><div class="text-body-2 muted">Wähle zwei Versionen in der Timeline.</div></div><v-spacer /><v-btn :disabled="selected.length !== 2" :loading="comparing" color="primary" variant="tonal" @click="compare">Versionen vergleichen</v-btn></div>
          <div v-if="comparison"><div class="d-flex align-center ga-2 mb-4"><v-chip>V{{ comparison.from.versionNumber }}</v-chip><v-icon icon="mdi-arrow-right" /><v-chip color="primary">V{{ comparison.to.versionNumber }}</v-chip></div><v-table density="comfortable"><thead><tr><th>Feld</th><th>Vorher</th><th>Nachher</th></tr></thead><tbody><tr v-for="change in comparison.changes" :key="change.field"><td class="font-weight-bold">{{ fieldLabel(change.field) }}</td><td class="diff-before">{{ compact(change.before) }}</td><td class="diff-after">{{ compact(change.after) }}</td></tr></tbody></v-table><div v-if="!comparison.changes.length" class="text-center muted py-8">Keine fachlichen Unterschiede.</div></div>
          <div v-else-if="viewing" class="snapshot"><div class="d-flex justify-space-between mb-5"><strong>Snapshot Version {{ viewing.versionNumber }}</strong><v-chip size="small">{{ viewing.snapshot.invoice.status }}</v-chip></div><v-row dense><v-col v-for="field in snapshotFields" :key="field.key" cols="12" sm="6"><div class="text-caption muted">{{ field.label }}</div><div class="font-weight-medium mb-3">{{ compact(viewing.snapshot.invoice[field.key]) }}</div></v-col></v-row><h3 class="text-subtitle-1 font-weight-bold mt-4 mb-2">Positionen</h3><v-list density="compact"><v-list-item v-for="item in viewing.snapshot.items" :key="String(item.position)" :title="`${item.position}. ${item.description}`" :subtitle="`${item.quantity} ${item.unit} · ${money(String(item.grossMinor), String(viewing.snapshot.invoice.currency))}`" /></v-list></div>
          <div v-else class="text-center py-12"><div class="empty-art"><v-icon icon="mdi-compare" size="34" /></div><h3>Version auswählen</h3><p class="muted mt-2">Zeige einen Snapshot an oder vergleiche zwei Stände.</p></div>
        </v-card>
      </v-col>
    </v-row>
    <v-dialog v-model="restoreDialog" max-width="520"><v-card class="pa-6"><h2 class="text-h6 font-weight-bold">Version {{ restoring?.versionNumber }} wiederherstellen</h2><p class="muted mt-2 mb-5">Der alte Snapshot wird Grundlage einer neuen Version. Bestehende Versionen bleiben erhalten.</p><v-textarea v-model="restoreReason" label="Begründung" rows="3" autofocus /><div class="d-flex justify-end ga-3"><v-btn variant="text" @click="restoreDialog = false">Abbrechen</v-btn><v-btn color="primary" :disabled="restoreReason.trim().length < 3" :loading="restoringNow" @click="restore">Als neue Version übernehmen</v-btn></div></v-card></v-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, apiMessage } from '../api/client';
import { useUiStore } from '../stores/ui';
interface Version { id: string; versionNumber: number; changeReason: string | null; createdAt: string; changedBy: { name: string }; snapshot: { invoice: Record<string, unknown>; items: Array<Record<string, unknown>> } }
const route = useRoute(); const router = useRouter(); const ui = useUiStore(); const versions = ref<Version[]>([]); const loading = ref(true); const selected = ref<number[]>([]); const viewing = ref<Version | null>(null); const comparison = ref<{from:Version;to:Version;changes:Array<{field:string;before:unknown;after:unknown}>}|null>(null); const comparing = ref(false); const currentVersion = ref(0); const restoreDialog = ref(false); const restoring = ref<Version|null>(null); const restoreReason = ref(''); const restoringNow = ref(false);
const snapshotFields = [{key:'invoiceNumber',label:'Rechnungsnummer'},{key:'invoiceDate',label:'Rechnungsdatum'},{key:'dueDate',label:'Zahlungsziel'},{key:'customerSnapshot',label:'Kunde'},{key:'netMinor',label:'Netto (Minor Units)'},{key:'grossMinor',label:'Brutto (Minor Units)'}];
async function load(): Promise<void> { loading.value = true; try { versions.value = (await api.get(`/invoices/${route.params.id}/versions`)).data; currentVersion.value = Math.max(...versions.value.map((item)=>item.versionNumber),0); viewing.value = versions.value[0] ?? null; } catch(e){ui.notify(apiMessage(e),'error');} finally{loading.value=false;} }
function toggleSelected(value:number):void{ selected.value = selected.value.includes(value) ? selected.value.filter((item)=>item!==value) : [...selected.value.slice(-1),value]; }
function inspect(version:Version):void{ viewing.value=version; comparison.value=null; }
async function compare():Promise<void>{ if(selected.value.length!==2)return; comparing.value=true; try{ const [from,to]=[...selected.value].sort((a,b)=>a-b); comparison.value=(await api.get(`/invoices/${route.params.id}/versions/compare`,{params:{from,to}})).data; viewing.value=null;}catch(e){ui.notify(apiMessage(e),'error');}finally{comparing.value=false;} }
function openRestore(version:Version):void{restoring.value=version;restoreReason.value='';restoreDialog.value=true;}
async function restore():Promise<void>{if(!restoring.value)return;restoringNow.value=true;try{await api.post(`/invoices/${route.params.id}/versions/${restoring.value.versionNumber}/restore`,{reason:restoreReason.value,expectedVersion:currentVersion.value});ui.notify('Snapshot als neue Version wiederhergestellt.');restoreDialog.value=false;await router.push(`/invoices/${route.params.id}/edit`);}catch(e){ui.notify(apiMessage(e),'error');}finally{restoringNow.value=false;}}
function dateTime(value:string):string{return new Intl.DateTimeFormat('de-DE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));} function money(value:string,currency:string):string{return new Intl.NumberFormat('de-DE',{style:'currency',currency}).format(Number(value)/100);} function compact(value:unknown):string{if(value==null)return '–';if(typeof value==='object')return JSON.stringify(value).slice(0,180);return String(value);} function fieldLabel(value:string):string{return ({invoiceDate:'Rechnungsdatum',dueDate:'Zahlungsziel',status:'Status',customerSnapshot:'Kunde',companySnapshot:'Absender',items:'Positionen',netMinor:'Netto',taxMinor:'Steuer',grossMinor:'Brutto'} as Record<string,string>)[value]??value;}
onMounted(load);
</script>
<style scoped>.diff-before{background:rgba(var(--v-theme-error),.07)}.diff-after{background:rgba(var(--v-theme-success),.07)}.snapshot{overflow-wrap:anywhere}</style>
