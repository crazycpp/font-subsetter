# 更新记录

本文件记录面向使用者和维护者的重要变化。

## 未发布

- 将项目名称统一为 Font Subsetter。
- 补充使用指南、部署指南、贡献指南与安全报告说明。
- 支持 GitHub Pages 自动部署，并适配仓库子路径和 CFF WASM 资源路径。

## 0.2.0

- 支持保留 CFF/PostScript 轮廓的静态 OTF 字体裁剪。
- CFF 输入可输出 OTF、WOFF 和 WOFF2；不执行有损的 CFF → TTF 转换。
- 增加简体中文 3,500、6,500 和 8,105 字预设。
- 增加可复现的 HarfBuzz CFF WASM 构建说明和第三方声明。
- 增加静态 Docker 部署和可关闭 CFF 路径的构建期开关。

## 0.1.0

- 提供仅在浏览器本地运行的 TrueType 字体裁剪基础流程。
