<template>
  <main class="login-page">
    <section class="login-story d-none d-md-flex">
      <div class="brand text-white"><div class="brand-mark"><v-icon icon="mdi-receipt-text-check-outline" /></div><div><strong>Rechnungswerk</strong><small class="text-white opacity-70">Finance workspace</small></div></div>
      <div class="story-copy">
        <div class="eyebrow text-white opacity-80">Ordnung, die sich gut anfühlt</div>
        <h1>Rechnungen sicher erstellen.<br />Änderungen lückenlos verstehen.</h1>
        <p>Ein ruhiger Arbeitsbereich für Faktura, Archiv und Zusammenarbeit – vom Smartphone bis zum großen Bildschirm.</p>
      </div>
      <div class="security-note"><v-icon icon="mdi-shield-check-outline" /><span>Versioniert · Rollenbasiert · Revisionsnah</span></div>
    </section>
    <section class="login-form-wrap">
      <v-card class="login-card pa-6 pa-sm-10" rounded="xl">
        <div class="brand d-md-none mb-10"><div class="brand-mark"><v-icon icon="mdi-receipt-text-check-outline" /></div><div><strong>Rechnungswerk</strong><small>Finance workspace</small></div></div>
        <div class="eyebrow mb-3">Willkommen zurück</div>
        <h2 class="text-h4 font-weight-bold mb-2">Anmelden</h2>
        <p class="muted mb-8">Weiter zu Rechnungen, Kunden und Auswertungen.</p>
        <v-alert v-if="error" type="error" variant="tonal" class="mb-5" closable @click:close="error = ''">{{ error }}</v-alert>
        <v-form @submit.prevent="submit">
          <v-text-field v-model.trim="email" label="E-Mail-Adresse" type="email" autocomplete="username" prepend-inner-icon="mdi-email-outline" :disabled="loading" required />
          <v-text-field v-model="password" label="Passwort" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" prepend-inner-icon="mdi-lock-outline" :append-inner-icon="showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'" :disabled="loading" required @click:append-inner="showPassword = !showPassword" />
          <v-btn type="submit" color="primary" size="large" block class="mt-3" :loading="loading">Sicher anmelden</v-btn>
        </v-form>
        <div class="text-caption muted text-center mt-6"><v-icon icon="mdi-lock" size="14" /> Zugangsdaten werden verschlüsselt übertragen.</div>
      </v-card>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiMessage } from '../api/client';
import { useAuthStore } from '../stores/auth';

const email = ref(''); const password = ref(''); const showPassword = ref(false); const loading = ref(false); const error = ref('');
const auth = useAuthStore(); const router = useRouter(); const route = useRoute();
async function submit(): Promise<void> {
  if (!email.value || !password.value) { error.value = 'Bitte E-Mail-Adresse und Passwort eingeben.'; return; }
  loading.value = true; error.value = '';
  try { await auth.login(email.value, password.value); await router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/'); }
  catch (reason) { error.value = apiMessage(reason); }
  finally { loading.value = false; }
}
</script>

<style scoped>
.login-page { min-height: 100dvh; display: grid; grid-template-columns: minmax(420px, 1.05fr) minmax(420px, .95fr); background: rgb(var(--v-theme-background)); }
.login-story { padding: clamp(36px, 6vw, 88px); flex-direction: column; justify-content: space-between; color: white; background: radial-gradient(circle at 15% 15%, rgba(255,255,255,.18), transparent 28%), linear-gradient(145deg, #243f9f 0%, #3157d5 45%, #6753c7 100%); }
.story-copy { max-width: 680px; }.story-copy h1 { font-size: clamp(2.6rem, 5vw, 4.8rem); line-height: .99; letter-spacing: -.055em; margin: 18px 0 26px; }.story-copy p { max-width: 570px; font-size: 1.13rem; line-height: 1.7; opacity: .8; }
.security-note { display: flex; gap: 10px; align-items: center; opacity: .75; }.login-form-wrap { display: grid; place-items: center; padding: 24px; }.login-card { width: min(470px, 100%); background: rgb(var(--v-theme-surface)); box-shadow: 0 30px 80px rgba(24,32,51,.12) !important; }
@media (max-width: 959px) { .login-page { grid-template-columns: 1fr; }.login-form-wrap { min-height: 100dvh; padding: 16px; } }
</style>
