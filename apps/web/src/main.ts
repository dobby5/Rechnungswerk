import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createVuetify } from 'vuetify';
import App from './App.vue';
import router from './router';
import './styles.css';

const vuetify = createVuetify({
  theme: {
    defaultTheme: localStorage.getItem('theme') === 'dark' ? 'rechnungswerkDark' : 'rechnungswerkLight',
    themes: {
      rechnungswerkLight: { dark: false, colors: { primary: '#3157D5', secondary: '#6D5BD0', accent: '#12A594', background: '#F6F7FB', surface: '#FFFFFF', error: '#C9364B', warning: '#D98400', success: '#158765', info: '#2D75C7' } },
      rechnungswerkDark: { dark: true, colors: { primary: '#8EA5FF', secondary: '#B6A9FF', accent: '#52D3C3', background: '#10131B', surface: '#191E2B', error: '#FF8798', warning: '#FFC061', success: '#58D3A9', info: '#7AB8FF' } },
    },
  },
  defaults: {
    VBtn: { rounded: 'lg', elevation: 0 },
    VCard: { rounded: 'xl', elevation: 0 },
    VTextField: { variant: 'outlined', density: 'comfortable', color: 'primary' },
    VSelect: { variant: 'outlined', density: 'comfortable', color: 'primary' },
    VAutocomplete: { variant: 'outlined', density: 'comfortable', color: 'primary' },
  },
});

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app');
