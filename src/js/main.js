
import { createApp } from 'vue'
import App from '@/App.vue'

let language = 'en';
const preferLanguage = navigator.language.toLowerCase();
if (preferLanguage.includes('tw') || preferLanguage.includes('hk')) language = 'cht';
else if (preferLanguage.includes('zh')) language = 'chs';
else if (preferLanguage.includes('ko')) language = 'kr';
else if (preferLanguage.includes('ja')) language = 'jp';


createApp(App).provide('language', language).mount('#app')
