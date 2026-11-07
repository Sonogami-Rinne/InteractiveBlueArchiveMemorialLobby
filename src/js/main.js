
import { createApp } from 'vue'
import '/js/pixi.js?url';
import App from '@/App.vue'
// await import('/js/pixi.js?url').then(async () =>{
//     import('@/App.vue').then((data) => data.default).then((data) => {
//         createApp(data.App.provide('language', 'jp')).mount('#app');
//     })
// })



createApp(App).provide('language', 'jp').mount('#app')
