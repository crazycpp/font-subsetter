import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bundledFixture = fileURLToPath(
  new URL("../fixtures/fonts/Sansation-Regular.ttf", import.meta.url),
);
const fixture = resolve(process.env.E2E_FONT_FIXTURE ?? bundledFixture);
const hasFixture = Boolean(fixture && existsSync(fixture));
const cffFixture = process.env.CFF_FONT_FIXTURE
  ? resolve(process.env.CFF_FONT_FIXTURE)
  : null;
const hasCffFixture = Boolean(cffFixture && existsSync(cffFixture));

function sfntTableTags(bytes: Buffer): string[] {
  const tableCount = bytes.readUInt16BE(4);
  return Array.from({ length: tableCount }, (_, index) =>
    bytes.subarray(12 + index * 16, 16 + index * 16).toString("ascii"),
  );
}

async function expectFontFaceLoad(
  page: Page,
  path: string,
  family: string,
): Promise<void> {
  const loaded = await page.evaluate(
    async ({ bytes, familyName }) => {
      const face = new FontFace(familyName, new Uint8Array(bytes));
      await face.load();
      document.fonts.add(face);
      return document.fonts.check(`16px "${familyName}"`);
    },
    { bytes: Array.from(readFileSync(path)), familyName: family },
  );
  expect(loaded).toBe(true);
}

test("renders an accessible three-step workspace without horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Font Subsetter");
  await expect(
    page.getByRole("heading", { name: "选择字体、指定字符、生成子集" }),
  ).toBeVisible();
  await expect(page.getByLabel("需要保留的文字")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "生成字体子集" }),
  ).toBeDisabled();

  const viewport = page.viewportSize();
  if ((viewport?.width ?? 0) >= 1024) {
    const generateButton = page.getByRole("button", {
      name: "生成字体子集",
    });
    const bounds = await generateButton.boundingBox();
    expect(bounds).not.toBeNull();
    expect(
      (bounds?.y ?? Number.POSITIVE_INFINITY) + (bounds?.height ?? 0),
    ).toBeLessThanOrEqual(viewport!.height);
  }

  expect(
    await page
      .locator("html")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test("handles a font locally and emits all requested formats", async ({
  page,
}) => {
  test.skip(!hasFixture, "The bundled OFL font fixture is missing.");
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method()))
      mutations.push(`${request.method()} ${request.url()}`);
  });
  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(fixture!);
  await page.getByLabel("需要保留的文字").fill("Font 子集 2026");
  await page.getByRole("checkbox", { name: /WOFF 兼容/ }).check();
  await page.getByRole("checkbox", { name: /^TTF/ }).check();
  await page.getByRole("checkbox", { name: /^OTF/ }).check();
  await page.getByRole("button", { name: "生成字体子集" }).click();
  await expect(
    page.getByRole("heading", { name: "字体子集已生成" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("请求字符", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "下载 WOFF2" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "下载 WOFF", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "下载 TTF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下载 OTF" })).toBeVisible();
  expect(mutations).toEqual([]);
});

test("accepts locally generated WOFF2, WOFF, and OTF as follow-up inputs", async ({
  page,
}) => {
  test.skip(!hasFixture, "The bundled OFL font fixture is missing.");
  type InputFixture =
    string | { name: string; mimeType: string; buffer: Buffer };
  const generate = async (
    input: InputFixture,
    alsoWoff = false,
    includeDesktopFormats = false,
  ): Promise<void> => {
    await page.goto("/");
    await page.locator('input[type="file"]').first().setInputFiles(input);
    await page.getByLabel("需要保留的文字").fill("Subset 2026");
    if (alsoWoff)
      await page.getByRole("checkbox", { name: /WOFF 兼容/ }).check();
    if (includeDesktopFormats) {
      await page.getByRole("checkbox", { name: /^TTF/ }).check();
      await page.getByRole("checkbox", { name: /^OTF/ }).check();
    }
    await page.getByRole("button", { name: "生成字体子集" }).click();
    await expect(
      page.getByRole("heading", { name: "字体子集已生成" }),
    ).toBeVisible({ timeout: 30_000 });
  };

  await generate(fixture!, true, true);
  const woff2Download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 WOFF2" }).click();
  const woff2Path = await (await woff2Download).path();
  const woffDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 WOFF", exact: true }).click();
  const woffPath = await (await woffDownload).path();
  const ttfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 TTF" }).click();
  const ttfPath = await (await ttfDownload).path();
  const otfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 OTF" }).click();
  const otfPath = await (await otfDownload).path();
  expect(woff2Path).not.toBeNull();
  expect(woffPath).not.toBeNull();
  expect(ttfPath).not.toBeNull();
  expect(otfPath).not.toBeNull();
  expect(readFileSync(ttfPath!).subarray(0, 4)).toEqual(
    Buffer.from([0, 1, 0, 0]),
  );
  expect(readFileSync(otfPath!).subarray(0, 4)).toEqual(
    Buffer.from([0, 1, 0, 0]),
  );

  await generate({
    name: "roundtrip.woff2",
    mimeType: "font/woff2",
    buffer: readFileSync(woff2Path!),
  });
  await expect(page.locator(".metrics small").first()).toHaveText("WOFF2");
  await generate({
    name: "roundtrip.woff",
    mimeType: "font/woff",
    buffer: readFileSync(woffPath!),
  });
  await expect(page.locator(".metrics small").first()).toHaveText("WOFF");
  await generate({
    name: "roundtrip.otf",
    mimeType: "font/otf",
    buffer: readFileSync(otfPath!),
  });
  await expect(page.locator(".metrics small").first()).toHaveText("TTF");
});

test("subsets a CFF OTF locally without converting its outlines", async ({
  page,
}) => {
  test.skip(!hasCffFixture, "Set CFF_FONT_FIXTURE to a local CFF OTF fixture.");
  test.setTimeout(60_000);
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH"].includes(request.method()))
      mutations.push(`${request.method()} ${request.url()}`);
  });

  await page.goto("/");
  await page.locator('input[type="file"]').first().setInputFiles(cffFixture!);
  await page
    .getByLabel("需要保留的文字")
    .fill("字体裁剪测试，Font Subset 2026！");
  await page.getByRole("checkbox", { name: /WOFF 兼容/ }).check();
  await expect(page.getByRole("checkbox", { name: /^TTF/ })).toBeDisabled();
  await expect(
    page.getByText("OTF（CFF/PostScript 轮廓）", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /^OTF/ }).check();
  await page.getByRole("button", { name: "生成字体子集" }).click();
  await expect(
    page.getByRole("heading", { name: "字体子集已生成" }),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "下载 WOFF2" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "下载 WOFF", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "下载 OTF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "下载 TTF" })).toHaveCount(0);
  await expect(page.locator(".result-notes")).toContainText(
    "CFF/PostScript 轮廓已保留",
  );

  const woff2Download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 WOFF2" }).click();
  const woff2Path = await (await woff2Download).path();
  const woffDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 WOFF", exact: true }).click();
  const woffPath = await (await woffDownload).path();
  const otfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 OTF" }).click();
  const otfPath = await (await otfDownload).path();
  expect(woff2Path).not.toBeNull();
  expect(woffPath).not.toBeNull();
  expect(otfPath).not.toBeNull();
  expect(readFileSync(woff2Path!).subarray(0, 4)).toEqual(Buffer.from("wOF2"));
  expect(readFileSync(woffPath!).subarray(0, 4)).toEqual(Buffer.from("wOFF"));
  const output = readFileSync(otfPath!);
  expect(output.subarray(0, 4)).toEqual(Buffer.from("OTTO"));
  expect(sfntTableTags(output)).toContain("CFF ");
  await expectFontFaceLoad(page, woff2Path!, "CffSubsetWoff2");
  await expectFontFaceLoad(page, woffPath!, "CffSubsetWoff");
  await expectFontFaceLoad(page, otfPath!, "CffSubsetOtf");

  for (const [name, mimeType, path, expectedFormat] of [
    ["roundtrip-cff.woff2", "font/woff2", woff2Path, "WOFF2"],
    ["roundtrip-cff.woff", "font/woff", woffPath, "WOFF"],
  ] as const) {
    await page.goto("/");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name,
        mimeType,
        buffer: readFileSync(path!),
      });
    await page.getByLabel("需要保留的文字").fill("CFF 回读 2026");
    await page.getByRole("checkbox", { name: /^TTF/ }).check();
    await page.getByRole("checkbox", { name: /^OTF/ }).check();
    await page.getByRole("button", { name: "生成字体子集" }).click();
    await expect(
      page.getByRole("heading", { name: "字体子集已生成" }),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".metrics small").first()).toHaveText(
      expectedFormat,
    );
    await expect(page.getByRole("button", { name: "下载 TTF" })).toHaveCount(0);
    await expect(page.locator(".result-notes")).toContainText(
      "已忽略 TTF 输出",
    );
    const roundtripOtfDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载 OTF" }).click();
    const roundtripOtfPath = await (await roundtripOtfDownload).path();
    expect(roundtripOtfPath).not.toBeNull();
    const roundtripOtf = readFileSync(roundtripOtfPath!);
    expect(roundtripOtf.subarray(0, 4)).toEqual(Buffer.from("OTTO"));
    expect(sfntTableTags(roundtripOtf)).toContain("CFF ");
  }
  expect(mutations).toEqual([]);
});
