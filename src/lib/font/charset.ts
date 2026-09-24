import standardChineseCharacters from "table-of-general-standard-chinese-characters";

const MAX_CODEPOINTS = 120_000;

export interface CharsetPreset {
  id: string;
  label: string;
  description: string;
  version: string;
  ranges?: ReadonlyArray<readonly [number, number]>;
  text?: string;
}

const GENERAL_STANDARD_CHINESE_TIER_1 =
  standardChineseCharacters.tier1.join("");
const GENERAL_STANDARD_CHINESE_TIER_1_AND_2 = [
  ...standardChineseCharacters.tier1,
  ...standardChineseCharacters.tier2,
].join("");
const GENERAL_STANDARD_CHINESE_ALL_TIERS = [
  ...standardChineseCharacters.tier1,
  ...standardChineseCharacters.tier2,
  ...standardChineseCharacters.tier3,
].join("");

export const CHARSET_PRESETS: readonly CharsetPreset[] = [
  {
    id: "ascii",
    label: "ASCII 与常用标点",
    description: "空格、英文、数字和 ASCII 标点。",
    version: "1.0.0",
    ranges: [[0x20, 0x7e]],
  },
  {
    id: "punctuation",
    label: "中文标点与常用符号",
    description: "中文全角标点、货币符号和常用排版符号。",
    version: "1.0.0",
    ranges: [
      [0x2000, 0x206f],
      [0x20a0, 0x20cf],
      [0x3000, 0x303f],
      [0xff01, 0xff65],
    ],
  },
  {
    id: "simplified-chinese-core",
    label: "简体中文常用字（3,500）",
    description: "《通用规范汉字表（2013）》一级字表；业务文本仍建议直接导入。",
    version: "2013.1.0",
    text: GENERAL_STANDARD_CHINESE_TIER_1,
  },
  {
    id: "simplified-chinese-general",
    label: "简体中文通用字（6,500）",
    description:
      "《通用规范汉字表（2013）》一、二级字表；适合大多数简体中文游戏文本。",
    version: "2013.1.0",
    text: GENERAL_STANDARD_CHINESE_TIER_1_AND_2,
  },
  {
    id: "simplified-chinese-complete",
    label: "简体中文完整规范字（8,105）",
    description:
      "《通用规范汉字表（2013）》全部三级字表；覆盖姓名、地名与专门领域用字。",
    version: "2013.1.0",
    text: GENERAL_STANDARD_CHINESE_ALL_TIERS,
  },
];

export function isSupportedFontFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return [".ttf", ".otf", ".woff", ".woff2"].some((extension) =>
    name.endsWith(extension),
  );
}

function addRange(target: Set<number>, start: number, end: number): void {
  if (start > end || start < 0 || end > 0x10ffff)
    throw new Error("Unicode 范围超出 U+0000–U+10FFFF");
  if (end - start + 1 > MAX_CODEPOINTS)
    throw new Error("单个 Unicode 范围过大，请缩小范围或改用文本输入");
  for (let codepoint = start; codepoint <= end; codepoint += 1) {
    target.add(codepoint);
    if (target.size > MAX_CODEPOINTS)
      throw new Error("字符集超过 120,000 个字符，请缩小输入");
  }
}

function parseHex(value: string): number {
  const normalized = value.trim().replace(/^U\+/i, "");
  if (!/^[\dA-F]{1,6}$/i.test(normalized))
    throw new Error(`无效的 Unicode 值：${value}`);
  return Number.parseInt(normalized, 16);
}

export function parseUnicodeRanges(value: string): number[] {
  const result = new Set<number>();
  const entries = value
    .split(/[，,;；\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const match = entry.match(
      /^\s*(U\+[\dA-F]{1,6}|[\dA-F]{1,6})\s*(?:-|–|—|\.\.)\s*(U\+[\dA-F]{1,6}|[\dA-F]{1,6})\s*$/i,
    );
    if (match) addRange(result, parseHex(match[1]), parseHex(match[2]));
    else addRange(result, parseHex(entry), parseHex(entry));
  }
  return [...result];
}

export function collectCodepoints(
  text: string,
  unicodeRanges: string,
  presetIds: Iterable<string>,
): Uint32Array {
  const result = new Set<number>([0x20]);
  for (const character of text) {
    const codepoint = character.codePointAt(0)!;
    if (codepoint >= 0x20 && codepoint !== 0x7f) result.add(codepoint);
  }
  for (const preset of CHARSET_PRESETS) {
    if (![...presetIds].includes(preset.id)) continue;
    for (const [start, end] of preset.ranges ?? [])
      addRange(result, start, end);
    for (const character of preset.text ?? "")
      result.add(character.codePointAt(0)!);
  }
  for (const codepoint of parseUnicodeRanges(unicodeRanges))
    result.add(codepoint);
  if (result.size > MAX_CODEPOINTS)
    throw new Error("字符集超过 120,000 个字符，请缩小输入");
  return Uint32Array.from([...result].sort((left, right) => left - right));
}

export function charactersFromCodepoints(
  codepoints: readonly number[],
  limit = 120,
): string {
  const visible = codepoints
    .slice(0, limit)
    .map((codepoint) => String.fromCodePoint(codepoint))
    .join("");
  return codepoints.length > limit
    ? `${visible}…（另有 ${codepoints.length - limit} 个）`
    : visible;
}
