# 声明

这个项目的资源文件来源于游戏《碧蓝档案》。《碧蓝档案》是一款由Nexon研发,Yostar代理发行的游戏。

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

大厅资源位于 `src/assets/`。`prefabResources.js` 按大厅名称索引各自的 `prefab/<名称>/resource.js`，后者列出场景配置和其他资源的动态导入。

然后输入以下指令运行

```sh
npm run dev
```

## 打包

Vite 根据资源索引打包引用到的文件。交付时发布整个 `dist/`，通过静态 HTTP 服务器运行。开发环境可用 `npm run preview` 预览构建产物。

```sh
npm run build
```

# To-Do

目前还处于测试阶段，仍需逐个核对大厅的渲染效果。
