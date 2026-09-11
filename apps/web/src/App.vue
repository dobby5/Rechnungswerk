<template>
  <v-app>
    <router-view />
    <v-snackbar v-model="ui.snackbar.show" :color="ui.snackbar.color" :timeout="ui.snackbar.timeout" location="top right">
      {{ ui.snackbar.message }}
      <template #actions><v-btn icon="mdi-close" variant="text" aria-label="Meldung schließen" @click="ui.snackbar.show = false" /></template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { useUiStore } from './stores/ui';
const ui = useUiStore();
</script>
