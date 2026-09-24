# CFF OTF 字体子集支持实施计划

> **这是一份维护与技术决策记录，不是日常使用手册。** 如果你只是想裁剪字体，请先阅读 [使用指南](./使用指南.md)；如果你正在部署站点，请阅读 [部署指南](./部署指南.md)。

> **当前结论：** 静态 CFF/PostScript OTF 已支持在浏览器本地裁剪，并可输出 OTF、WOFF、WOFF2。CFF2、可变字体和 Safari / Edge 的目标版本验收仍需按真实字体另行确认。

## 结论与决策

目标是支持 CFF/PostScript 轮廓的 OpenType 字体。要在不上传字体、保持静态 Docker 部署的前提下正确裁剪它，采用 **官方 HarfBuzz 子集库的可复现 CFF WASM 构建**。

不手写 CFF 解析、字形闭包、GSUB/GPOS 重写或 `cmap` 重建逻辑；这些均由 HarfBuzz 完成。也不把 CFF 曲线转换为 TTF 轮廓，避免损失 Hinting 和改变字体形状。

初期不采用第三方 `hb-subset-wasm` / `subset-font` 作为生产核心依赖。它们可用作 POC 对照，但长期版本、构建参数、漏洞修复和输出行为应由本项目锁定的官方 HarfBuzz 源码控制。

## 实施状态（2026-09-24）

- 已完成：用官方 HarfBuzz `14.2.0` 源码（`b0ffab42d473eb380ad0fcf42730e0f1868cbc97`）和固定的 Emscripten 镜像构建 CFF 子集 WASM；构建脚本、产物 SHA-256 和 Old MIT 许可均已入库。
- 已完成：以一份约 17 MB 的 CJK CFF OTF 做本地验收；对中英文、标点组成的样本文本裁剪后得到含 `CFF ` 表的 `OTTO` 子集。
- 已完成：浏览器 Worker 按实际 SFNT 轮廓分流；CFF1 可导入 OTF、WOFF、WOFF2 并导出 OTF、WOFF、WOFF2，始终保留 CFF 轮廓。直接导入 CFF OTF 时，UI 在处理前禁用 TTF；包装成 WOFF/WOFF2 的 CFF 则由 Worker 安全忽略 TTF 请求并说明原因。
- 已完成：桌面与移动 Chromium E2E、生产 Docker/Nginx 实测通过；验证了产物签名和 `CFF ` 表、零 POST/PUT/PATCH、WASM 的 `application/wasm` MIME、缓存头及 COOP/COEP/CSP。
- 待完成：在目标版本的 Safari 和 Edge 上做人工渲染比对。

## 范围

### 本次纳入

- CFF1 静态 OTF 的本地浏览器子集化。
- CFF OTF 输入后输出为 OTF、WOFF、WOFF2；保持 CFF 轮廓。
- 保持现有 TrueType TTF / TrueType OTF / WOFF / WOFF2 处理路径、下载、ZIP、CSS、取消与缺字统计。
- Chrome、Edge、Safari 的真实字体验收；桌面和移动 Chromium 自动化回归。
- Docker 静态 Nginx 交付，不新增上传接口、后端任务、数据库或对象存储。

### 本次不承诺

- CFF2 可变字体、COLR/SVG/Emoji 彩色字体、TTC/OTC 字体集合。
- TTF 与 CFF 之间的轮廓格式转换。
- 未明确允许再分发的字体资产或其子集提交到仓库。

## 目标架构

```text
浏览器主线程
  └─ Font Worker
       ├─ 识别 SFNT 轮廓：glyf / CFF / CFF2
       ├─ TrueType → 现有精简 HarfBuzz WASM
       └─ CFF OTF → 按需加载 CFF-enabled HarfBuzz WASM
                         └─ 标准 SFNT（仍含 CFF 表）
                              ├─ OTF：原样 SFNT 下载
                              ├─ WOFF：现有 WOFF 1 封装
                              └─ WOFF2：现有 Google WOFF2 WASM 编码
```

两个 WASM 资产并存，只有 CFF 输入才加载较大的 CFF 引擎；这避免影响现有 TTF 用户的首屏与常规处理性能。两者均走现有 Worker，不触及隐私边界。

## 实施阶段与门禁

### P0：范围与验收样本冻结（0.5 人日）

1. 记录验收字体的 SHA-256、字体名称和 CFF1 表；未获准再分发的样本不提交到仓库。
2. 选一份可再分发、体积较小的 CFF OTF 作为自动化夹具，保留原始许可证与哈希。
3. 固定 HarfBuzz 发布版本、源码 commit、Emscripten 镜像 digest 和构建参数。
4. 固定第三方组件和测试夹具的许可证清单。

**门禁：** 验收样本的文件指纹、版本与来源可复核。

### P1：CFF WASM 技术验证（2 人日）

1. 在隔离构建环境中用官方 HarfBuzz 编译完整 subset 库，确保 CFF/CFF2 subset 源码未被 `HB_NO_CFF` 等裁剪宏排除。
2. 仅导出当前 Worker 所需的 C ABI：内存管理、blob/face、unicode set、subset input、subset output。
3. 用 CFF OTF 验收字体处理一组中文、英文、标点和缺字字符；保留 Hinting 与移除 Hinting 各跑一次。
4. 验证输出：
   - SFNT flavor 仍为 `OTTO`；
   - 保留 `CFF ` 表，不能出现空轮廓；
   - 输出 `cmap` 与请求字符集一致，缺字报告正确；
   - glyph 数、文件大小、峰值 WASM 内存、耗时可记录；
   - OTF、WOFF、WOFF2 可被独立解析和浏览器加载。

**通过门槛：** 对 CFF OTF 验收字体成功生成含 CFF 表的可渲染子集；任一产物无控制台错误、无 Worker 崩溃，并可在浏览器使用 `FontFace` 加载。

**失败处理：** 在最多 2 人日内用 `hb-subset-wasm` 做同一套对照 POC。两者皆失败则停止产品化，保留“CFF 不支持”提示，不以不完整字体上线。

### P2：产品接入与兼容层（2 人日）

1. 抽取当前 Worker 中的 HarfBuzz桥接层，使 TrueType 和 CFF 只在 WASM 选择上分流，输入/输出协议不变。
2. 用 SFNT 表而非扩展名判断轮廓类型：`glyf`、`CFF `、`CFF2`。
3. CFF1 成功时开放 OTF/WOFF/WOFF2；若用户请求 TTF，给出“禁止有损 CFF→TTF 转换”的明确错误或自动移除该选项。
4. 在结果区显示实际轮廓类型和已保留的格式，避免把 CFF OTF 描述为 TTF。
5. 维持取消机制：终止 CFF Worker 后必须释放对象并可启动下一次任务。

**门禁：** 现有 TTF 和 WOFF/WOFF2 回归不退化；CFF 不再走当前“明确拒绝”分支。

### P3：自动化、性能与安全回归（3 人日）

1. 单元测试：SFNT 轮廓识别、格式路由、命名、MIME、CSS、CFF 输出表存在性。
2. 浏览器 E2E：
   - CFF OTF → OTF / WOFF / WOFF2；
   - CFF OTF 生成后再次导入；
   - 中英文、标点、缺字、Unicode 范围；
   - 取消、100 MB 限制、损坏字体和 TTC 错误。
3. 对 CFF OTF 验收字体做性能基线：桌面 Chrome 与目标低配设备各记录冷启动、处理耗时、峰值内存、输出大小。
4. 对比原始字体和子集在 Chrome / Edge / Safari 中的文字渲染；至少覆盖常用汉字、英文、数字、标点以及业务中的关键字符。
5. 保持浏览器监测：处理期间零 POST/PUT/PATCH 请求；不引入远程字体、遥测或运行时 CDN。

**门禁：** 自动化全绿；P95 内存和耗时满足 P0 约定的目标；没有轮廓丢失、浏览器加载失败或未解释的布局变化。

### P4：发布、可维护性与回退（1.5 人日）

1. 将 WASM 作为 hash 资产打入静态构建，校验 Docker/Nginx 的 `application/wasm` MIME、缓存、COOP/COEP 与 CSP。
2. 更新 README 兼容性矩阵、第三方许可、构建复现说明和故障排查文档。
3. 为 HarfBuzz 版本、源码哈希、Emscripten 版本、WASM SHA-256 建立清单；升级必须重新跑 CFF 回归。
4. 保留现有 TrueType WASM 路径。CFF 路径通过一个可关闭的构建期开关/发布标记控制；发现产物问题时只回退 CFF，不影响 TTF/WOFF2 现网能力。

## 人力与排期

| 阶段 |         预估 | 产出                        |
| ---- | -----------: | --------------------------- |
| P0   |     0.5 人日 | 样本、许可证、版本基线      |
| P1   |       2 人日 | 可证伪的 CFF WASM POC       |
| P2   |       2 人日 | Worker 与 UI 产品接入       |
| P3   |       3 人日 | 自动化、性能、跨浏览器报告  |
| P4   |     1.5 人日 | Docker 发布、文档、回退机制 |
| 合计 | **8.5 人日** | 可上线的 CFF OTF 子集能力   |

按一名熟悉 WASM/字体格式的工程师计算，包含评审和 Safari 验收建议预留 **两周日历时间**。若 P1 无法通过，最多额外增加 2 人日对照 POC；不在结果不确定时直接进入产品接入。

## 风险控制

| 风险                               | 处理方式                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| CFF 产物表存在但轮廓异常           | 将 `CFF ` 表、字符映射和浏览器 `FontFace` 加载列为硬门禁；人工抽样关键业务文字 |
| 17 MB CJK 字体的 WASM 内存峰值过高 | P1 先量化；延续 100 MB 文件限制，按测量结果设定更严格的 CFF 建议上限与错误提示 |
| 字体布局功能丢失                   | 覆盖 GSUB/GPOS、中文标点和关键业务文字；不满足则不发布                         |
| 第三方封装维护中断                 | 生产使用固定版本的官方 HarfBuzz 构建；构建脚本与哈希在仓库可复现               |
| CFF2/可变字体范围膨胀              | CFF1 静态 OTF 单独发布；CFF2 必须通过新的 POC 与验收门禁后再纳入               |

## 上线验收清单

- [x] CFF OTF → OTF、WOFF、WOFF2 均成功，且 OTF 仍有 `CFF ` 表。
- [ ] 指定字符、Unicode 范围、预设、缺字统计和取消处理正确。
- [x] TTF / WOFF / WOFF2 全量已有测试继续通过。
- [ ] Chrome 已实测加载；仍需在目标版本的 Edge、Safari 上显示关键中文文本。
- [x] 页面没有字体上传、后端请求或持久化行为。
- [x] Docker 镜像可离线运行，WASM MIME、CSP、COOP/COEP 正确。
- [x] HarfBuzz 的许可证、版本、哈希、构建与 CFF 单独回退说明完整。

## 参考

- HarfBuzz CFF subset 源码与构建：[CMakeLists](https://github.com/harfbuzz/harfbuzz/blob/main/CMakeLists.txt)、[BUILD.md](https://github.com/harfbuzz/harfbuzz/blob/main/BUILD.md)
- 对照 POC 候选：[hb-subset-wasm](https://github.com/kyosuke/hb-subset-wasm)
- 服务端备选（不采用）：[FontTools subset](https://fonttools.readthedocs.io/en/stable/subset/)
