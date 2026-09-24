# 浏览器测试字体夹具

这里仅收录明确允许本仓库再分发的字体夹具。新增夹具时，请保留原始许可证、来源信息和文件 SHA-256；可接受的许可证例如 SIL Open Font License 1.1、MIT 或 Apache-2.0。

`Sansation-Regular.ttf` 来自 Google Fonts 的 Sansation Regular，固定于源码提交 `296bb4790d3f9bd95547c733708a3666ed35d844`，下载路径为 `ofl/sansation/Sansation-Regular.ttf`。它采用 SIL Open Font License 1.1，许可证原文保留为 `OFL.txt`。

SHA-256: `6d47039ee6665d78b143a1b264abc02017a33ffa52a4e9f6645ce357f92d4f09`

浏览器集成测试默认使用这份夹具。CI 或本地环境可用 `E2E_FONT_FIXTURE` 覆盖为另一份已确认可再分发的单字体 TTF、OTF、WOFF 或 WOFF2。夹具应包含拉丁字符；验证中文覆盖时，也应包含目标中文 code point。
