# Font Subsetter

> 在浏览器里把字体裁剪成只包含所需字符的更小文件。

Font Subsetter 是一个无需上传字体的开源工具。选择一份字体，粘贴项目实际会出现的文字，或选择字符预设，即可在本地生成更小的 WOFF2、WOFF、TTF 或 OTF 文件。

字体文件和输入文本只在当前浏览器内存中处理：没有登录、上传接口、数据库、对象存储或服务端字体任务。刷新或关闭页面后，数据会消失。

## 适合什么场景

- 为网页、H5、活动页或小游戏缩小字体文件，减少首次加载体积；
- 为固定文案、关卡文本或语言包制作对应的字体子集；
- 在不把授权字体交给第三方服务的前提下完成裁剪；
- 需要同时产出 WebFont（WOFF2 / WOFF）和项目资源格式（TTF / OTF）。

## 三步开始

1. 选择 `.ttf`、`.otf`、`.woff` 或 `.woff2` 字体文件。
2. 粘贴实际会显示的文字，选择字符预设，或填写 Unicode 范围。
3. 选择输出格式，点击“生成字体子集”，检查缺字提示后下载结果。

更完整的操作说明、预设内容和缺字处理见 [使用指南](./Docs/使用指南.md)。

## 能力概览

| 项目     | 说明                                                                        |
| -------- | --------------------------------------------------------------------------- |
| 输入     | TTF、OTF、WOFF、WOFF2（不支持 TTC 字体集合）                                |
| 输出     | 默认 WOFF2；可选 WOFF、TTF、OTF；多格式会打包为 ZIP                         |
| 字符来源 | 粘贴文字、UTF-8 TXT、Unicode 范围和内置预设可组合使用                       |
| 中文预设 | 《通用规范汉字表（2013）》3,500 / 6,500 / 8,105 字                          |
| 处理方式 | 浏览器 Web Worker + WASM；可取消，不发送字体或文本                          |
| CFF OTF  | 支持静态 CFF/PostScript OTF，输出时保留 CFF 轮廓；不进行有损 CFF → TTF 转换 |

## 文档导航

- [使用指南](./Docs/使用指南.md)：如何选择字符、理解缺字和选择输出格式。
- [部署指南](./Docs/部署指南.md)：GitHub Pages、Docker 和回退方式。
- [CFF OTF 子集支持实施计划](./Docs/CFF_OTF_子集支持实施计划.md)：CFF 处理链路与维护决策。
- [贡献指南](./CONTRIBUTING.md)：本地开发、测试与提交约定。
- [安全策略](./SECURITY.md)：如何私下报告安全问题。
- [第三方声明](./THIRD_PARTY_NOTICES.md)：运行时依赖、来源和许可证。

## 本地开发

需要 Node.js 22+ 和 pnpm 11+。

```bash
pnpm install
pnpm dev
```

提交前建议运行：

```bash
pnpm lint
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

浏览器端到端测试使用仓库内可再分发的 Sansation Regular（SIL Open Font License 1.1）夹具。若需要用自己的已获准再分发字体验收，可设置：

```bash
E2E_FONT_FIXTURE=/absolute/path/to/font.ttf pnpm test:e2e
CFF_FONT_FIXTURE=/absolute/path/to/cff-font.otf pnpm test:e2e
```

不要将未获准再分发的字体或其子集提交到仓库。

## 兼容性与边界

| 场景                                         | 当前状态                                      |
| -------------------------------------------- | --------------------------------------------- |
| TTF、TrueType 轮廓 OTF、WOFF、WOFF2          | 已在 Chromium 进行真实处理和回灌验证          |
| 静态 CFF/PostScript OTF                      | 已在 Chromium 验证，可输出 OTF / WOFF / WOFF2 |
| Chrome / Edge                                | 目标支持；Chromium 自动化回归已覆盖           |
| Safari                                       | 需要在目标版本和目标字体上自行复验            |
| CFF2、可变字体、彩色字体、Emoji、非 BMP 字形 | 不承诺；请先用真实字体和文本验证              |

单个字体文件上限为 100 MB。大型 CJK 字体的耗时和内存占用会因设备而异；发布前应始终使用真实文案和动态内容做一次完整裁剪与渲染检查。

## 许可证

项目以 [MIT License](./LICENSE) 发布。使用字体前，请自行确认该字体及其子集的授权范围；工具不会替你判断字体授权。

发布说明见 [CHANGELOG.md](./CHANGELOG.md)，参与项目时请遵守 [行为准则](./CODE_OF_CONDUCT.md)。
