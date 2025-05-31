const base64Loader = {
    "Airi_home.skel": ()=>import('@skel/Airi_home.skel?binary'),
    'Airi_home.atlas': ()=>import('@atlas/Airi_home.atlas?raw'),
    'Airi_home.png': ()=>import('@png/Airi_home.png?binary'),
    'Airi_home2.png':()=>import('@png/Airi_home2.png?binary'),
    'Akane_home.skel': ()=>import('@skel/Akane_home.skel?binary'),
    'Akane_home.atlas': ()=>import('@atlas/Akane_home.atlas?raw'),
    'Akane_home.png': ()=>import('@png/Akane_home.png?binary'),
}
export default base64Loader;