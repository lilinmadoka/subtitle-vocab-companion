# Chrome Web Store 发布检查清单

这个文件用于记录正式发布到 Chrome Web Store 前需要准备的事项。当前仓库已经可以通过“开发者模式 / 加载已解压的扩展程序”使用；商店发布还需要补齐素材和审核信息。

## 1. 代码与打包

- [ ] 确认 `manifest.json` 在 ZIP 根目录。
- [ ] 确认版本号已经递增。
- [ ] 确认只请求必要权限。
- [ ] 确认扩展没有不必要的网络请求。
- [ ] 运行 `node scripts/verify-extension.js`，确认权限、文档、存储 key、导出文件名和原生字幕边界一致。
- [ ] 按 [`docs/manual-verification.md`](./docs/manual-verification.md) 完成 Netflix / YouTube + Language Reactor 手动验收。
- [ ] 在全新浏览器配置中测试安装。

正确打包方式示例：

```bash
zip -r subtitle-vocab-companion-v0.2.0.zip manifest.json background.js content.js popup.html popup.js popup.css README.md PRIVACY.md LICENSE LICENSE.txt
```

不要把外层文件夹直接压进 ZIP。上传 Chrome Web Store 的 ZIP 打开后，第一层应该能直接看到 `manifest.json`。

## 2. 必备素材

- [ ] 128x128 扩展图标。
- [ ] 16x16 / 48x48 图标，建议同时提供。
- [ ] 至少 1 张商店截图。
- [ ] 简短描述。
- [ ] 详细描述。

## 3. 商店文案建议

### 单一用途

帮助用户在 Netflix / YouTube + Language Reactor 学习场景下保存英文字幕单词、字幕上下文和词典解释，并导出到 Anki 进行个人复习。

### 权限解释

- `storage`：在本地保存词条和设置。
- `contextMenus`：提供右键保存入口。
- `commands`：提供快捷键保存入口。
- `*://www.netflix.com/*`：只在 Netflix 页面读取用户可见的字幕和 Language Reactor 词典面板内容。
- `*://www.youtube.com/*`：只在 YouTube 页面读取用户可见的 Language Reactor 字幕和词典面板内容；不读取 YouTube 原生字幕系统。

### 隐私说明

扩展不会上传用户数据。保存的词条只保存在用户设备上的浏览器本地存储中。

## 4. 审核风险点

- 名称和描述不要让人误以为这是 Netflix、YouTube 或 Language Reactor 官方插件。
- 不要声称可以绕过网站限制。
- 不要鼓励批量复制、分发字幕或影视内容。
- 截图中如包含影视画面或字幕，注意版权和个人用途说明。

## 5. 建议发布方式

第一次发布建议选择 **Unlisted**。这样通过审核后，知道链接的人可以安装，但插件不会公开出现在搜索结果里。等稳定后再考虑 Public。
