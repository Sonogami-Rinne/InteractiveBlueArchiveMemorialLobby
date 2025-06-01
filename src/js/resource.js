const base64Loader = {
    "Airi_home.skel": () => import('@skel/Airi_home.skel?binary'),
    'Airi_home.atlas': () => import('@atlas/Airi_home.atlas?raw'),
    'Airi_home.png': () => import('@png/Airi_home.png?binary'),
    'Airi_home2.png': () => import('@png/Airi_home2.png?binary'),
    'Akane_home.skel': () => import('@skel/Akane_home.skel?binary'),
    'Akane_home.atlas': () => import('@atlas/Akane_home.atlas?raw'),
    'Akane_home.png': () => import('@png/Akane_home.png?binary'),
    'akari_bg.skel': () => import('@skel/akari_bg.skel?binary'),
    'akari_home.skel': () => import('@skel/akari_home.skel?binary'),
    'akari_scene.skel': () => import('@skel/akari_scene.skel?binary'),
    'akari_bg.atlas': () => import('@atlas/akari_bg.atlas?raw'),
    'akari_home.atlas': () => import('@atlas/akari_home.atlas?raw'),
    'akari_scene.atlas': () => import('@atlas/akari_scene.atlas?raw'),
    'akari_bg.png': () => import('@png/akari_bg.png?binary'),
    'akari_home.png': () => import('@png/akari_home.png?binary'),
    'akari_scene.png': () => import('@png/akari_scene.png?binary'),

}
export default base64Loader;