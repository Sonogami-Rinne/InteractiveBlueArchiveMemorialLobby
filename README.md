# 声明

这个项目的资源文件来源于游戏《碧蓝档案》。《碧蓝档案》是一款由Nexon研发,Yostar代理发行的游戏。大厅资源使用 pythonProject3 导出的 pack 目录。

#  R.I.P

由于发现用Unity的webgl可以完美复现包括粒子在内的一系列特殊效果，该项目估计不会再更新了。

# 简介

使用vite框架的基于spine-pixi-v8的离线碧蓝档案可互动记忆大厅


## 特点

可互动，目前支持摸头，眼部跟随以及对话。

## 启动

和大多数vite项目一样，使用以下指令安装相关组件

```sh
npm install
```

默认读取同级项目 `../../Python/pythonProject3/save/pack`。如果导出到其他位置，请在启动或构建前设置环境变量 `LOBBY_PACK_DIR`，值为 pack 的路径。

然后输入以下指令运行

```sh
npm run dev
```

## 打包

构建会将完整资源包复制到 `dist/pack`。通过 HTTP 提供 `dist` 目录即可运行，也可以在本机用 `npm run preview` 预览。

```sh
npm run build
```

# To-Do

目前还处于测试阶段，仍需逐个核对大厅的渲染效果。
