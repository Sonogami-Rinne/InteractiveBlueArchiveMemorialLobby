# 简介

这是单个文件的适配Wallpaper Engine的版本。由于所有学生放一起的话build之后的大小预计将达到3个GB左右，故有此版本。相较于main，删去了大量不必要的东西，并且由于Wallpaper Engine的特性，还原文件读取方式为普通的fetch

# 启动方法

和main分支基本一样，但由于删去了legacy插件，使得在执行

```sh

npm run build

```
之后的html双击无法正常运行，得导入到Wallpaper Engine里面才可以正常运行。

