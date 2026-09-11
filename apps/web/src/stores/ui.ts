import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const snackbar = ref({ show: false, message: '', color: 'success', timeout: 4500 });
  function notify(message: string, color = 'success', timeout = 4500): void { snackbar.value = { show: true, message, color, timeout }; }
  return { snackbar, notify };
});
