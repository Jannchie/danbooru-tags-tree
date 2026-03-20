import { createApp } from 'vue'

import App from './App.vue'
import './assets/main.css'
import { initializeTheme } from './composables/useTheme'
import { router } from './router'

initializeTheme()

createApp(App).use(router).mount('#app')
