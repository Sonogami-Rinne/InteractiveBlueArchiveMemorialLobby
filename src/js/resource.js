const resourceLoader = {
    "Airi_home.skel": () => import('@skel/Airi_home.skel?binary'),
    'Airi_home.atlas': () => import('@atlas/Airi_home.atlas?raw'),
    'Airi_home.png': () => import('@png/Airi_home.png?binary'),
    'Airi_home2.png': () => import('@png/Airi_home2.png?binary'),


}
export default resourceLoader;