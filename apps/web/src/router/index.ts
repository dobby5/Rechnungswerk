import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AppShell from '../layouts/AppShell.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { public: true } },
    { path: '/', component: AppShell, children: [
      { path: '', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
      { path: 'invoices', name: 'invoices', component: () => import('../views/InvoicesView.vue') },
      { path: 'invoices/new', name: 'invoice-new', component: () => import('../views/InvoiceEditorView.vue') },
      { path: 'invoices/:id/edit', name: 'invoice-edit', component: () => import('../views/InvoiceEditorView.vue') },
      { path: 'invoices/:id/versions', name: 'invoice-versions', component: () => import('../views/VersionsView.vue') },
      { path: 'customers', name: 'customers', component: () => import('../views/CustomersView.vue') },
      { path: 'trash', name: 'trash', component: () => import('../views/TrashView.vue') },
      { path: 'settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
      { path: 'admin/users', name: 'users', component: () => import('../views/UsersView.vue'), meta: { admin: true } },
      { path: 'admin/audit', name: 'audit', component: () => import('../views/AuditView.vue'), meta: { admin: true } },
    ] },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();
  if (!to.meta.public && !auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } };
  if (to.name === 'login' && auth.isAuthenticated) return { name: 'dashboard' };
  if (to.meta.admin && !auth.isAdmin) return { name: 'dashboard' };
  return true;
});

export default router;
