const resourceLoader = {
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

    'Aru_home.skel': () => import('@skel/Aru_home.skel?binary'),
    'Aru_scene.skel': () => import('@skel/Aru_scene.skel?binary'),
    'Aru_home.atlas': () => import('@atlas/Aru_home.atlas?raw'),
    'Aru_scene.atlas': () => import('@atlas/Aru_scene.atlas?raw'),
    'Aru_scene.png': () => import('@png/Aru_scene.png?binary'),
    'Aru_home.png': () => import('@png/Aru_home.png?binary'),
    'Aru_home2.png': () => import('@png/Aru_home2.png?binary'),
    'Aru_home3.png': () => import('@png/Aru_home3.png?binary'),

    'Asuna_home.skel': () => import('@skel/Asuna_home.skel?binary'),
    'Asuna_home.atlas': () => import('@atlas/Asuna_home.atlas?raw'),
    'Asuna_home.png': () => import('@png/Asuna_home.png?binary'),
    'Asuna_home2.png': () => import('@png/Asuna_home2.png?binary'),

    'Ayane_home.skel': () => import('@skel/Ayane_home.skel?binary'),
    'Ayane_home.atlas': () => import('@atlas/Ayane_home.atlas?raw'),
    'Ayane_home.png': () => import('@png/Ayane_home.png?binary'),
    'Ayane_home2.png': () => import('@png/Ayane_home2.png?binary'),
    'Ayane_home3.png': () => import('@png/Ayane_home3.png?binary'),

    'Chinatsu_home.skel': () => import('@skel/Chinatsu_home.skel?binary'),
    'Chinatsu_home.atlas': () => import('@atlas/Chinatsu_home.atlas?raw'),
    'Chinatsu_home.png': () => import('@png/Chinatsu_home.png?binary'),
    'Chinatsu_home_2.png': () => import('@png/Chinatsu_home_2.png?binary'),

    'Chise_home.skel': () => import('@skel/Chise_home.skel?binary'),
    'Chise_home.atlas': () => import('@atlas/Chise_home.atlas?raw'),
    'Chise_home.png': () => import('@png/Chise_home.png?binary'),
    'Chise_home2.png': () => import('@png/Chise_home2.png?binary'),

    'Eimi_home.skel': () => import('@skel/Eimi_home.skel?binary'),
    'Eimi_home.atlas': () => import('@atlas/Eimi_home.atlas?raw'),
    'Eimi_home.png': () => import('@png/Eimi_home.png?binary'),
    'Eimi_home2.png': () => import('@png/Eimi_home2.png?binary'),

    'Fuuka_home.skel': () => import('@skel/Fuuka_home.skel?binary'),
    'Fuuka_Scene.skel': () => import('@skel/Fuuka_Scene.skel?binary'),
    'Fuuka_home.atlas': () => import('@atlas/Fuuka_home.atlas?raw'),
    'Fuuka_Scene.atlas': () => import('@atlas/Fuuka_Scene.atlas?raw'),
    'Fuuka_Scene.png': () => import('@png/Fuuka_Scene.png?binary'),
    'Fuuka_home.png': () => import('@png/Fuuka_home.png?binary'),
    'Fuuka_home2.png': () => import('@png/Fuuka_home2.png?binary'),

    'Hanae_home.skel': () => import('@skel/Hanae_home.skel?binary'),
    'Hanae_home.atlas': () => import('@atlas/Hanae_home.atlas?raw'),
    'Hanae_home.png': () => import('@png/Hanae_home.png?binary'),
    'Hanae_home2.png': () => import('@png/Hanae_home2.png?binary'),

    'Hare_home.skel': () => import('@skel/Hare_home.skel?binary'),
    'Hare_home.atlas': () => import('@atlas/Hare_home.atlas?raw'),
    'Hare_home.png': () => import('@png/Hare_home.png?binary'),
    'Hare_home2.png': () => import('@png/Hare_home2.png?binary'),

    'Haruka_home.skel': () => import('@skel/Haruka_home.skel?binary'),
    'Haruka_home.atlas': () => import('@atlas/Haruka_home.atlas?raw'),
    'Haruka_home.png': () => import('@png/Haruka_home.png?binary'),
    'Haruka_home2.png': () => import('@png/Haruka_home2.png?binary'),

    'Haruna_home.skel': () => import('@skel/Haruna_home.skel?binary'),
    'Haruna_home.atlas': () => import('@atlas/Haruna_home.atlas?raw'),
    'Haruna_home.png': () => import('@png/Haruna_home.png?binary'),
    'Haruna_home2.png': () => import('@png/Haruna_home2.png?binary'),

    'Hasumi_home.skel': () => import('@skel/Hasumi_home.skel?binary'),
    'Hasumi_home.atlas': () => import('@atlas/Hasumi_home.atlas?raw'),
    'Hasumi_home.png': () => import('@png/Hasumi_home.png?binary'),
    'Hasumi_home2.png': () => import('@png/Hasumi_home2.png?binary'),

    'Hibiki_home.skel': () => import('@skel/Hibiki_home.skel?binary'),
    'Hibiki_home.atlas': () => import('@atlas/Hibiki_home.atlas?raw'),
    'Hibiki_home.png': () => import('@png/Hibiki_home.png?binary'),
    'Hibiki_home2.png': () => import('@png/Hibiki_home2.png?binary'),

    'Hihumi_home.skel': () => import('@skel/Hihumi_home.skel?binary'),
    'Hihumi_home.atlas': () => import('@atlas/Hihumi_home.atlas?raw'),
    'Hihumi_home.png': () => import('@png/Hihumi_home.png?binary'),
    'Hihumi_home_2.png': () => import('@png/Hihumi_home_2.png?binary'),

    'Hina_home.skel': () => import('@skel/Hina_home.skel?binary'),
    'Hina_home.atlas': () => import('@atlas/Hina_home.atlas?raw'),
    'Hina_home.png': () => import('@png/Hina_home.png?binary'),
    'Hina_home2.png': () => import('@png/Hina_home2.png?binary'),
    'Hina_home3.png': () => import('@png/Hina_home3.png?binary'),

    'Hoshino_home.skel': () => import('@skel/Hoshino_home.skel?binary'),
    'Hoshino_home_background.skel': () => import('@skel/Hoshino_home_background.skel?binary'),
    'Hoshino_home.atlas': () => import('@atlas/Hoshino_home.atlas?raw'),
    'Hoshino_home_background.atlas': () => import('@atlas/Hoshino_home_background.atlas?raw'),
    'Hoshino_home.png': () => import('@png/Hoshino_home.png?binary'),
    'Hoshino_home_background.png': () => import('@png/Hoshino_home_background.png?binary'),
    'Hoshino_home_background2.png': () => import('@png/Hoshino_home_background2.png?binary'),

    'Iori_home.skel': () => import('@skel/Iori_home.skel?binary'),
    'Iori_home.atlas': () => import('@atlas/Iori_home.atlas?raw'),
    'Iori_home.png': () => import('@png/Iori_home.png?binary'),
    'Iori_home2.png': () => import('@png/Iori_home2.png?binary'),

    'Izumi_home.skel': () => import('@skel/Izumi_home.skel?binary'),
    'Izumi_home.atlas': () => import('@atlas/Izumi_home.atlas?raw'),
    'Izumi_home.png': () => import('@png/Izumi_home.png?binary'),
    'Izumi_home2.png': () => import('@png/Izumi_home2.png?binary'),

    'Zunko_home.skel': () => import('@skel/Zunko_home.skel?binary'),
    'Zunko_home.atlas': () => import('@atlas/Zunko_home.atlas?raw'),
    'Zunko_home.png': () => import('@png/Zunko_home.png?binary'),
    'Zunko_home2.png': () => import('@png/Zunko_home2.png?binary'),

    'Juri_home.skel': () => import('@skel/Juri_home.skel?binary'),
    'Juri_home.atlas': () => import('@atlas/juri_home.atlas?raw'),//emm,是的,并没有写错
    'Juri_home.png': () => import('@png/Juri_home.png?binary'),
    'Juri_home2.png': () => import('@png/Juri_home2.png?binary'),
    'Juri_home3.png': () => import('@png/Juri_home3.png?binary'),

    'Karin_home.skel': () => import('@skel/Karin_home.skel?binary'),
    'Karin_home.atlas': () => import('@atlas/Karin_home.atlas?raw'),
    'Karin_home.png': () => import('@png/Karin_home.png?binary'),

    'Kayoko_home.skel': () => import('@skel/Kayoko_home.skel?binary'),
    'Kayoko_home.atlas': () => import('@atlas/Kayoko_home.atlas?raw'),
    'Kayoko_home.png': () => import('@png/Kayoko_home.png?binary'),
    'Kayoko_home2.png': () => import('@png/Kayoko_home2.png?binary'),

    'Kotama_home.skel': () => import('@skel/Kotama_home.skel?binary'),
    'Kotama_home.atlas': () => import('@atlas/Kotama_home.atlas?raw'),
    'Kotama_home.png': () => import('@png/Kotama_home.png?binary'),
    'Kotama_home2.png': () => import('@png/Kotama_home2.png?binary'),

    'Kotori_home.skel': () => import('@skel/Kotori_home.skel?binary'),
    'Kotori_home.atlas': () => import('@atlas/Kotori_home.atlas?raw'),
    'Kotori_home.png': () => import('@png/Kotori_home.png?binary'),
    'Kotori_home2.png': () => import('@png/Kotori_home2.png?binary'),
}
export default resourceLoader;