<template>
  <v-navigation-drawer v-if="mdAndUp" permanent width="264" class="app-drawer pa-4">
    <div class="brand mb-8"><div class="brand-mark"><v-icon icon="mdi-receipt-text-check-outline" /></div><div><strong>Rechnungswerk</strong><small>Finance workspace</small></div></div>
    <v-list nav density="comfortable">
      <v-list-item v-for="item in navigation" :key="item.to" :to="item.to" :prepend-icon="item.icon" :title="item.label" rounded="lg" />
    </v-list>
    <template #append>
      <v-card color="primary" class="pa-4 mb-3 text-white" rounded="xl">
        <div class="text-caption opacity-80">Schnellstart</div><div class="text-subtitle-2 mt-1">Neue Rechnung in wenigen Schritten</div>
        <v-btn to="/invoices/new" block class="mt-3" color="white" variant="flat"><span class="text-primary">Erstellen</span></v-btn>
      </v-card>
      <v-list-item prepend-icon="mdi-cog-outline" title="Einstellungen" to="/settings" rounded="lg" />
    </template>
  </v-navigation-drawer>

  <v-app-bar flat color="background" height="74" class="px-2 px-md-6">
    <v-app-bar-title class="font-weight-bold">{{ currentTitle }}</v-app-bar-title>
    <v-spacer />
    <v-btn :icon="theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night'" variant="text" aria-label="Farbschema wechseln" @click="toggleTheme" />
    <v-menu location="bottom end">
      <template #activator="{ props }"><v-btn v-bind="props" variant="text" class="user-button ml-1"><v-avatar color="primary" size="34">{{ initials }}</v-avatar><span v-if="smAndUp" class="ml-2">{{ auth.user?.name }}</span><v-icon icon="mdi-chevron-down" /></v-btn></template>
      <v-list min-width="220"><v-list-item prepend-icon="mdi-account-outline" :title="auth.user?.email ?? ''" /><v-divider /><v-list-item prepend-icon="mdi-logout" title="Abmelden" @click="logout" /></v-list>
    </v-menu>
  </v-app-bar>

  <v-main><div class="page-wrap"><router-view /></div></v-main>

  <v-bottom-navigation v-if="!mdAndUp" grow color="primary" class="mobile-nav">
    <v-btn to="/"><v-icon>mdi-view-dashboard-outline</v-icon><span>Übersicht</span></v-btn>
    <v-btn to="/invoices"><v-icon>mdi-receipt-text-outline</v-icon><span>Rechnungen</span></v-btn>
    <v-btn to="/invoices/new" aria-label="Neue Rechnung"><v-icon color="primary" size="30">mdi-plus-circle</v-icon><span>Neu</span></v-btn>
    <v-btn to="/customers"><v-icon>mdi-account-group-outline</v-icon><span>Kunden</span></v-btn>
    <v-btn to="/trash"><v-icon>mdi-trash-can-outline</v-icon><span>Papierkorb</span></v-btn>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDisplay, useTheme } from 'vuetify';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const theme = useTheme();
const { mdAndUp, smAndUp } = useDisplay();
const base = [
  { to: '/', icon: 'mdi-view-dashboard-outline', label: 'Dashboard' },
  { to: '/invoices', icon: 'mdi-receipt-text-outline', label: 'Rechnungsarchiv' },
  { to: '/customers', icon: 'mdi-account-group-outline', label: 'Kunden' },
  { to: '/trash', icon: 'mdi-trash-can-outline', label: 'Papierkorb' },
];
const navigation = computed(() => auth.isAdmin ? [...base, { to: '/admin/users', icon: 'mdi-shield-account-outline', label: 'Benutzer' }, { to: '/admin/audit', icon: 'mdi-clipboard-text-clock-outline', label: 'Audit Log' }] : base);
const titles: Record<string, string> = { dashboard: 'Guten Tag', invoices: 'Rechnungsarchiv', 'invoice-new': 'Neue Rechnung', 'invoice-edit': 'Rechnung bearbeiten', 'invoice-versions': 'Versionsverlauf', customers: 'Kunden', trash: 'Papierkorb', settings: 'Firmeneinstellungen', users: 'Benutzerverwaltung', audit: 'Audit Log' };
const currentTitle = computed(() => titles[String(route.name)] ?? 'Rechnungswerk');
const initials = computed(() => auth.user?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? 'RW');
function toggleTheme(): void { const next = theme.global.current.value.dark ? 'rechnungswerkLight' : 'rechnungswerkDark'; theme.change(next); localStorage.setItem('theme', next === 'rechnungswerkDark' ? 'dark' : 'light'); }
async function logout(): Promise<void> { await auth.logout(); await router.push('/login'); }
</script>
