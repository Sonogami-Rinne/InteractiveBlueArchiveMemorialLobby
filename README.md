# 声明

这个项目的资源文件来源于游戏《碧蓝档案》。《碧蓝档案》是一款由Nexon研发,Yostar代理发行的游戏。在此文件结构中只保留了少部分相关解包文件供参考，如果你需要全部文件，请自行寻找解包工具，并且根据已有的文件结构放入相对应的地方。

#  R.I.P

由于发现用Unity的webgl可以完美复现包括粒子在内的一系列特殊效果，该分支估计不会再更新了。
因此，建立了particle分支，不过因变动过大，暂时还未

# 简介

使用vue框架的基于spine-pixi-v8的离线碧蓝档案可互动记忆大厅

![intro](https://github.com/user-attachments/assets/486c8b5f-efdc-41d4-947b-542e788c7de4)

## 特点

摸头：


![head](https://github.com/user-attachments/assets/da967e2c-47fd-41f0-aabf-1a430a54336a)

眼睛跟随：


![eye](https://github.com/user-attachments/assets/79744580-9373-44e6-b564-ee7dcde2049f)

点击对话：


![talk](https://github.com/user-attachments/assets/e96f660e-a5e7-41b3-99b3-d94d2c97964d)


## 启动

和大多数vue项目一样，使用以下指令安装相关组件

```sh
npm install
```

然后输入以下指令运行

```sh
npm run dev
```

## 打包

执行以下指令即可打包。打包之后的项目无需构建服务器，直接打开index.html即可运行。

```sh
npm run build
```

# To-Do

目前还处于测试阶段，还在逐个配置各个学生，还未实现播放列表
