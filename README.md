# Subtitle Vocab Companion

一个用于个人语言学习的 Chrome / Edge 扩展：在 Netflix / YouTube + Language Reactor 场景下，点击英文字幕中的单词，自动保存单词、英文字幕上下文、中文字幕上下文和 Language Reactor 词典解释，之后可以导出给 Anki 复习。

> 非 Netflix、YouTube 或 Language Reactor 官方插件。本项目只用于个人学习，请尊重网站、字幕和影视内容的版权与使用条款。

## 功能

- 在 Netflix / YouTube 播放页配合 Language Reactor 捕获英文字幕里的单词。
- 保存英文字幕句子、附近中文字幕，以及可捕获到的 Language Reactor 大词典解释。
- 支持点击字幕自动保存，也支持关闭自动保存后按住 `Alt` 点击字幕保存。
- 支持右键菜单保存选中的字幕词。
- 支持快捷键 `Alt + Shift + S` 保存当前字幕词。
- 数据只保存在本机浏览器的 `chrome.storage.local`。
- 支持导出：
  - Anki TSV：正面 = 单词 + 英文句；背面 = 中文句 + 词典解释。
  - 纯词表 CSV。
  - 词频 CSV。

## 安装方法：从 GitHub 手动安装

目前这个扩展还没有发布到 Chrome Web Store。可以先用开发者模式安装。

### 1. 下载项目

打开本仓库页面，点击绿色的 **Code** 按钮，然后选择 **Download ZIP**。

下载后解压。你会得到类似这样的文件夹：

```text
subtitle-vocab-companion-main/
  manifest.json
  background.js
  content.js
  popup.html
  popup.js
  popup.css
```

请确认 `manifest.json` 就在这个文件夹的第一层。

### 2. 打开浏览器扩展管理页

Chrome：

```text
chrome://extensions/
```

Edge：

```text
edge://extensions/
```

### 3. 开启开发者模式

在扩展管理页面右上角打开 **Developer mode / 开发者模式**。

### 4. 加载插件

点击 **Load unpacked / 加载已解压的扩展程序**，选择刚才解压出来的项目文件夹。

注意：请选择包含 `manifest.json` 的文件夹，不要选择 ZIP 文件本身。

## 使用方法

### 推荐使用方式

1. 安装 Language Reactor。
2. 打开 Netflix 或 YouTube 播放页。
3. 打开字幕和 Language Reactor 字幕/词典功能。
4. 刷新一次播放页，确保扩展脚本注入成功。
5. 点击英文字幕里的单词。
6. 扩展会尝试保存：
   - 单词；
   - 英文字幕句子；
   - 附近中文字幕；
   - Language Reactor 大词典解释。
7. 点击浏览器工具栏里的扩展图标，打开“字幕单词本”。
8. 在弹窗中搜索、复制、删除或导出记录。

### 自动保存开关

扩展弹窗里有一个开关：

```text
点击字幕自动保存（推荐配合 Language Reactor）
```

- 开启：点击英文字幕单词时自动保存。
- 关闭：按住 `Alt` 再点击英文字幕单词才会保存。

### 右键和快捷键

- 右键保存：选中字幕里的英文词，右键点击“保存到单词本”。
- 快捷键保存：在 Netflix 或 YouTube 播放页按 `Alt + Shift + S`。

如果快捷键和其他扩展或系统快捷键冲突，可以在浏览器扩展快捷键页面里调整。

Chrome：

```text
chrome://extensions/shortcuts
```

## 导入 Anki

弹窗中点击 **导出 Anki TSV**，会下载一个 TSV 文件。

建议在 Anki 中新建一个基础模板，至少包含两个字段：

```text
Front
Back
```

导入 TSV 时：

1. 选择导出的 `.tsv` 文件。
2. 字段分隔符选择 Tab。
3. 将第 1 列映射到 `Front`。
4. 将第 2 列映射到 `Back`。
5. 勾选允许 HTML 字段显示。不同 Anki 版本里的文字可能略有不同，含义是允许字段中的 HTML 生效。

## 数据和隐私

这个扩展不会把数据上传到服务器。保存的词条会留在你自己的浏览器本地存储中。

本项目当前使用的权限：

| 权限 | 用途 |
| --- | --- |
| `storage` | 保存单词、字幕上下文、词典解释和设置。 |
| `contextMenus` | 提供右键保存入口。 |
| `commands` | 提供快捷键保存入口。 |
| `*://www.netflix.com/*` | 只在 Netflix 页面读取用户可见的字幕和 Language Reactor 面板内容。 |
| `*://www.youtube.com/*` | 只在 YouTube 页面读取用户可见的 Language Reactor 字幕和词典面板内容；不读取 YouTube 原生字幕系统。 |

更完整的隐私说明见 [`PRIVACY.md`](./PRIVACY.md)。

## 常见问题

### 点击字幕没有保存

可以按顺序检查：

1. 是否在 Netflix 或 YouTube 播放页。
2. 是否刷新过页面。刚安装或刚更新扩展后，旧页面通常需要刷新。
3. 是否点击的是英文字幕区域。
4. 弹窗里的自动保存开关是否开启。关闭时需要按住 `Alt` 点击。
5. Language Reactor 是否已经正常显示字幕或词典面板。

### 没有保存到词典解释

扩展会等待 Language Reactor 打开大词典面板后再尝试提取解释。如果点击太快、词典面板没有打开、或者 Language Reactor 的页面结构发生变化，就可能只保存字幕，不保存解释。

### 数据存在哪里

数据保存在浏览器本地的 `chrome.storage.local` 中。清空扩展记录、移除扩展、清理浏览器数据，可能会删除这些记录。重要词表请定期导出。

### 支持哪些网站

当前版本支持 Netflix / YouTube + Language Reactor 学习场景。这里的“支持”表示扩展可以在这些网站上运行 Language Reactor 伴侣流程；不表示扩展会读取网站自己的原生字幕系统。Bilibili 仍是后续实验方向，正式支持前不会写入权限范围。

## 开发者说明

这是一个无构建步骤的 Manifest V3 扩展。修改后直接在扩展管理页点击刷新按钮即可测试。

主要文件：

```text
manifest.json     扩展配置
background.js     右键菜单、快捷键、本地存储写入
content.js        播放页注入、Language Reactor 字幕/词典内容捕获
popup.html        弹窗页面
popup.js          弹窗交互、搜索、导出
popup.css         弹窗样式
```

## 正式发布前建议

如果要发布到 Chrome Web Store，建议先完成：

- 添加 `16x16`、`48x48`、`128x128` 图标。
- 准备商店截图和宣传图。
- 用更完整的测试清单检查 Netflix / YouTube + Language Reactor 当前版本兼容性。
- 在发布页面填写清楚单一用途、权限用途和隐私说明。

可参考 [`CHROME_WEB_STORE_CHECKLIST.md`](./CHROME_WEB_STORE_CHECKLIST.md)。

## License

MIT License. See [`LICENSE`](./LICENSE).
