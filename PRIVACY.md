# Privacy Policy

Subtitle Vocab Companion 是一个个人学习用途的浏览器扩展。

## 数据处理原则

本扩展不会收集、出售、共享或上传用户数据。扩展保存的词条只存放在用户自己的浏览器本地存储中。

## 本扩展保存哪些数据

当用户主动保存词条时，扩展可能会在本地保存以下信息：

- 选中的英文单词或短语；
- 附近的英文字幕上下文；
- 附近的中文字幕上下文；
- 可捕获到的 Language Reactor 词典解释；
- 当前 Netflix 或 YouTube 页面 URL；
- 视频播放时间点；
- 保存时间。

这些数据用于在扩展弹窗中展示、搜索、复制和导出。

## 数据存储位置

数据存储在浏览器提供的 `chrome.storage.local` 中，也就是用户设备上的本地浏览器存储。

## 网络请求

本扩展自身不会向外部服务器发送网络请求，也不会上传字幕、词条或词典解释。

## 第三方服务

本扩展运行在 Netflix 和 YouTube 页面上，并可配合 Language Reactor 使用。Netflix、YouTube 和 Language Reactor 是独立第三方服务，它们各自的数据处理方式不受本扩展控制。

本扩展不会读取 YouTube 或其他网站的原生字幕系统；只有用户正在查看的 Language Reactor 字幕、翻译和词典面板内容会被用于保存词条。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `storage` | 在本地保存词条和设置。 |
| `contextMenus` | 提供右键保存入口。 |
| `commands` | 提供快捷键保存入口。 |
| `*://www.netflix.com/*` | 只在 Netflix 页面读取用户正在查看的字幕和 Language Reactor 词典面板内容。 |
| `*://www.youtube.com/*` | 只在 YouTube 页面读取用户正在查看的 Language Reactor 字幕和词典面板内容；不读取 YouTube 原生字幕系统。 |

## 删除数据

用户可以在扩展弹窗中点击“清空”删除保存的词条。用户也可以通过浏览器扩展管理页面移除扩展，或清理浏览器站点/扩展数据。

## 联系与反馈

如需反馈问题，请在本仓库提交 GitHub Issue。
