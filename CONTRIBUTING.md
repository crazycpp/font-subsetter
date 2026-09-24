# 贡献指南

感谢你愿意改进 Font Subsetter。无论是修复一个边界问题、补充字体兼容性数据，还是改善文档，都欢迎提交。

## 开始之前

请使用 Node.js 22+ 和 pnpm 11+：

```bash
pnpm install
pnpm dev
```

页面默认运行在本地开发服务器中。提交前，请运行：

```bash
pnpm lint
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

`pnpm test:e2e` 会启动浏览器，验证真实字体的导入、裁剪、输出和再次导入流程。

## 字体夹具与授权

字体文件是这个项目最需要谨慎处理的资产。仓库内的 Sansation Regular 夹具采用 SIL Open Font License 1.1，并保留了许可证、来源和 SHA-256。

若要新增测试字体，请同时满足以下条件：

- 字体明确允许在本仓库再分发；
- 在夹具目录保留原始许可证、来源链接或来源说明，以及 SHA-256；
- 夹具尽量小，只覆盖测试所需的格式或字形；
- 不提交商业字体、私有字体、客户字体或由这些字体生成的子集。

本地验收可以覆盖默认字体：

```bash
E2E_FONT_FIXTURE=/absolute/path/to/font.ttf pnpm test:e2e
CFF_FONT_FIXTURE=/absolute/path/to/cff-font.otf pnpm test:e2e
```

这些本地文件不会被测试脚本复制进仓库。

## 提交 Pull Request

请让每个 Pull Request 尽量聚焦，并在说明中回答：

1. 用户会看到什么变化？
2. 如何验证该变化？
3. 是否影响字体格式、浏览器兼容性、文件大小或本地处理隐私边界？

请不要提交 `build/`、`.svelte-kit/`、测试产物、本地环境文件或私有字体资产。修改行为时，请相应增加或更新测试和文档。

## 修改 CFF WASM 时

CFF 子集引擎是可复现的构建产物，不是可随意替换的二进制文件。升级 HarfBuzz 版本或构建参数时，必须一并更新：

- `scripts/build-harfbuzz-cff-wasm.sh`；
- [第三方声明](./THIRD_PARTY_NOTICES.md)中的版本、来源、许可证和 SHA-256；
- CFF 浏览器回归测试；
- [CFF 实施计划](./Docs/CFF_OTF_子集支持实施计划.md)中的维护记录（如适用）。

并使用可再分发的字体夹具或本地授权字体，确认输出仍含正确轮廓且可被浏览器加载。
