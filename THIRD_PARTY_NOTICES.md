# 第三方声明 / Third-party notices

本文件说明项目随代码或构建产物分发的第三方组件、来源和许可证。后面的许可证原文保持原样，以便复核；如果你只是使用工具，可先阅读 [README](./README.md) 和 [使用指南](./Docs/使用指南.md)。

This project includes selected, adapted code from [Compress Pro](https://github.com/Scorpio3310/compress-pro), commit `9671add`, copyright (c) 2026 Nik Klemenc. Compress Pro is licensed under the MIT License.

The adapted areas are the browser-side font format detection, raw SFNT/WOFF handling patterns, HarfBuzz subsetter integration, WOFF2 loading/recovery practices, and the package export patches in `patches/`. The original full Compress Pro application and its image, PDF, archive, audio, video, OCR, 3D, and Cloudflare functionality are not shipped in this project.

## Included runtime dependencies

| Component                                      | Version                      | License | Purpose                                       |
| ---------------------------------------------- | ---------------------------- | ------- | --------------------------------------------- |
| Compress Pro selected source                   | `9671add`                    | MIT     | Source patterns and adapted font runtime code |
| `harfbuzzjs`                                   | 1.4.0                        | MIT     | JavaScript package wrapper                    |
| HarfBuzz subset WASM                           | bundled by `harfbuzzjs`      | Old MIT | OpenType glyph subsetting                     |
| HarfBuzz CFF subset WASM                       | 14.2.0 (`b0ffab42`)          | Old MIT | CFF/PostScript OpenType glyph subsetting      |
| `fonteditor-core`                              | 2.6.3                        | MIT     | WOFF2 wrapper                                 |
| Google WOFF2                                   | bundled by `fonteditor-core` | MIT     | WOFF2 encoding and decoding                   |
| Brotli                                         | bundled by Google WOFF2      | MIT     | WOFF2 compression                             |
| `fflate`                                       | ^0.8.3                       | MIT     | WOFF 1.0 zlib handling and ZIP download       |
| `table-of-general-standard-chinese-characters` | 0.0.0                        | MIT     | Bundled 《通用规范汉字表（2013）》字表数据    |

The `harfbuzzjs` and `fonteditor-core` package export patches are retained from Compress Pro because the upstream packages do not expose the required WASM/submodule paths. The `fonteditor-core` patch also releases the Emscripten WOFF2 instance after failure, avoiding a retained failed heap.

## HarfBuzz CFF subset WASM

`static/wasm/harfbuzz-subset-cff-14.2.0.wasm` is compiled from the official HarfBuzz `14.2.0` annotated tag, source commit `b0ffab42d473eb380ad0fcf42730e0f1868cbc97`, using `emscripten/emsdk@sha256:af45409f3199d88db4b1b03af0098532c8fb33a375ac257463eeb0a622870d06`. Its SHA-256 is `2076f08b419d126af04e15ad79cffddb462aa4c5ab330d3fafb887dfe37dd96f`.

The repeatable build command is `./scripts/build-harfbuzz-cff-wasm.sh`. The module intentionally exports only the HarfBuzz subset C ABI used by this application. It has no application file system or network capability; the small WASI import surface is provided as no-op functions by the browser Worker.

```text
HarfBuzz is licensed under the so-called "Old MIT" license.

Copyright © 2010-2022 Google, Inc.
Copyright © 2015-2020 Ebrahim Byagowi
Copyright © 2019,2020 Facebook, Inc.
Copyright © 2012,2015 Mozilla Foundation
Copyright © 2011 Codethink Limited
Copyright © 2008,2010 Nokia Corporation and/or its subsidiary(-ies)
Copyright © 2009 Keith Stribley
Copyright © 2011 Martin Hosken and SIL International
Copyright © 2007 Chris Wilson
Copyright © 2005,2006,2020,2021,2022,2023 Behdad Esfahbod
Copyright © 2004,2007,2008,2009,2010,2013,2021,2022,2023 Red Hat, Inc.
Copyright © 1998-2005 David Turner and Werner Lemberg
Copyright © 2016 Igalia S.L.
Copyright © 2022 Matthias Clasen
Copyright © 2018,2021 Khaled Hosny
Copyright © 2018,2019,2020 Adobe, Inc
Copyright © 2013-2015 Alexei Podtelezhnikov

Permission is hereby granted, without written agreement and without
license or royalty fees, to use, copy, modify, and distribute this
software and its documentation for any purpose, provided that the
above copyright notice and the following two paragraphs appear in
all copies of this software.

IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE TO ANY PARTY FOR
DIRECT, INDIRECT, SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES
ARISING OUT OF THE USE OF THIS SOFTWARE AND ITS DOCUMENTATION, EVEN
IF THE COPYRIGHT HOLDER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH
DAMAGE.

THE COPYRIGHT HOLDER SPECIFICALLY DISCLAIMS ANY WARRANTIES, INCLUDING,
BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE. THE SOFTWARE PROVIDED HEREUNDER IS
ON AN "AS IS" BASIS, AND THE COPYRIGHT HOLDER HAS NO OBLIGATION TO
PROVIDE MAINTENANCE, SUPPORT, UPDATES, ENHANCEMENTS, OR MODIFICATIONS.
```

## MIT notice for Compress Pro

```text
MIT License

Copyright (c) 2026 Nik Klemenc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

This project intentionally does not perform authorization checks for supplied fonts. Please confirm that a font and its subset may be used and redistributed for your intended purpose.

The simplified-Chinese preset uses the package's first-tier set: the 3,500 common characters in the 2013 《通用规范汉字表》. It is a character coverage preset, not a statement that every font contains every listed glyph.
