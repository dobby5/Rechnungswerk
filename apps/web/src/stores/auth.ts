import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api, ensureCsrf } from '../api/client';

export interface AuthUser { id: string; email: string; name: string; roles: string[]; permissions: string[] }

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);
  const isAuthenticated = computed(() => Boolean(user.value));
  const isAdmin = computed(() => user.value?.roles.includes('Administrator') ?? false);

  async function initialize(): Promise<void> {
    if (initialized.value) return;
    try { user.value = (await api.get<{ user: AuthUser }>('/auth/me')).data.user; }
    catch { user.value = null; }
    finally { initialized.value = true; }
  }

  async function login(email: string, password: string): Promise<void> {
    await ensureCsrf();
    user.value = (await api.post<{ user: AuthUser }>('/auth/login', { email, password })).data.user;
    initialized.value = true;
  }

  async function logout(): Promise<void> {
    try { await api.post('/auth/logout'); } finally { user.value = null; }
  }

  return { user, initialized, isAuthenticated, isAdmin, initialize, login, logout };
});
