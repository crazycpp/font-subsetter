<script lang="ts">
	import { CHARSET_PRESETS, charactersFromCodepoints, isSupportedFontFile } from '$lib/font/charset';
	import { CFF_SUBSETTING_ENABLED } from '$lib/font/cff-feature';
	import { FontSubsetCancelledError, runFontSubset } from '$lib/font/client';
	import { cssForOutputs } from '$lib/font/file-name';
	import { downloadBytes, downloadZip, fontMime } from '$lib/font/download';
	import type { FontFormat, FontSubsetResult, JobPhase } from '$lib/font/types';

	let fontFile = $state<File | null>(null);
	let text = $state('');
	let unicodeRanges = $state('');
	let selectedPresets = $state<Set<string>>(new Set(['ascii']));
	let formats = $state<FontFormat[]>(['woff2']);
	let keepHinting = $state(true);
	let sourceOutline = $state<'unknown' | 'truetype' | 'cff'>('unknown');
	let isDragging = $state(false);
	let isRunning = $state(false);
	let phase = $state<JobPhase | null>(null);
	let phaseDetail = $state('');
	let error = $state('');
	let result = $state<FontSubsetResult | null>(null);
	let controller: AbortController | null = null;

	const css = $derived(result ? cssForOutputs(result.outputs) : '');
	const canGenerate = $derived(Boolean(fontFile) && formats.length > 0 && !isRunning);

	async function setFont(file: File | undefined): Promise<void> {
		error = '';
		result = null;
		sourceOutline = 'unknown';
		if (!file) return;
		if (!isSupportedFontFile(file)) {
			error = '请选择 TTF、OTF、WOFF 或 WOFF2 字体文件。';
			fontFile = null;
			return;
		}
		if (file.size > 100 * 1024 * 1024) {
			error = '单个字体不能超过 100 MB。请改用更小的字体，或在内存更高的设备中处理。';
			fontFile = null;
			return;
		}
		fontFile = file;
		try {
			const header = await file.slice(0, 4).arrayBuffer();
			if (fontFile !== file || header.byteLength < 4) return;
			if (new DataView(header).getUint32(0) === 0x4f54544f) {
				sourceOutline = 'cff';
				if (!CFF_SUBSETTING_ENABLED) {
					error = '当前部署暂未启用 CFF/PostScript 字体裁剪。请联系管理员启用该功能后重试。';
					fontFile = null;
					sourceOutline = 'unknown';
					return;
				}
				formats = formats.filter((format) => format !== 'ttf');
			} else {
				sourceOutline = 'truetype';
			}
		} catch {
			if (fontFile === file) sourceOutline = 'unknown';
		}
	}

	function onFontChange(event: Event): void {
		void setFont((event.currentTarget as HTMLInputElement).files?.[0]);
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();
		isDragging = false;
		void setFont(event.dataTransfer?.files[0]);
	}

	async function importText(event: Event): Promise<void> {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			text += await file.text();
		} catch {
			error = '无法读取 TXT 文件。请确认文件为 UTF-8 文本后重试。';
		}
		(event.currentTarget as HTMLInputElement).value = '';
	}

	function togglePreset(id: string): void {
		const next = new Set(selectedPresets);
		next.has(id) ? next.delete(id) : next.add(id);
		selectedPresets = next;
	}

	function toggleFormat(format: FontFormat): void {
		formats = formats.includes(format) ? formats.filter((item) => item !== format) : [...formats, format];
	}

	async function generate(): Promise<void> {
		if (!fontFile || formats.length === 0) return;
		error = '';
		result = null;
		phase = 'preparing';
		phaseDetail = '正在读取本地字体文件…';
		controller = new AbortController();
		isRunning = true;
		try {
			result = await runFontSubset(
				{ font: fontFile, text, unicodeRanges, formats, keepHinting },
				selectedPresets,
				(nextPhase, detail) => {
					phase = nextPhase as JobPhase;
					phaseDetail = detail;
				},
				controller.signal
			);
			phase = null;
			phaseDetail = '';
		} catch (caught) {
			phase = null;
			phaseDetail = '';
			if (!(caught instanceof FontSubsetCancelledError)) error = caught instanceof Error ? caught.message : '字体处理失败，请重试。';
		} finally {
			isRunning = false;
			controller = null;
		}
	}

	function cancel(): void {
		controller?.abort();
	}

	async function copyCss(): Promise<void> {
		try {
			await navigator.clipboard.writeText(css);
			phaseDetail = 'CSS 已复制到剪贴板。';
		} catch {
			error = '无法自动复制 CSS；请手动选择代码复制。';
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
	}

	function compression(outputBytes: number): string {
		if (!result || result.sourceBytes === 0) return '—';
		return `${Math.max(0, (1 - outputBytes / result.sourceBytes) * 100).toFixed(1)}%`;
	}
</script>

<svelte:head>
	<title>Font Subsetter</title>
	<meta
		name="description"
		content="在浏览器本地裁剪 TTF、OTF、WOFF 或 WOFF2 字体，并生成更小的字体子集。"
	/>
</svelte:head>

<a class="skip-link" href="#workspace">跳到字体裁剪工作区</a>

<header class="site-header">
	<div class="shell header-content">
		<div>
			<p class="eyebrow">BROWSER-ONLY WEBFONT UTILITY</p>
			<h1>Font Subsetter</h1>
		</div>
		<p class="privacy-badge">本地浏览器处理 · 不上传文件</p>
	</div>
</header>

<main id="workspace" class="shell workspace" tabindex="-1">
	<section class="intro" aria-labelledby="tool-title">
		<div>
			<p class="eyebrow">一次性处理</p>
			<h2 id="tool-title">只保留真正需要的字形</h2>
			<p>选择字体、输入文字或字符范围，生成适合 Web 使用的 WOFF2 / WOFF。字体与文本始终留在当前浏览器。</p>
		</div>
	</section>

	<div class="steps" aria-label="操作步骤">
		<span><b>1</b> 选择字体</span><span><b>2</b> 指定字符</span><span><b>3</b> 生成结果</span>
	</div>

	{#if error}
		<div class="alert error" role="alert"><strong>无法继续：</strong> {error}</div>
	{/if}
	{#if isRunning || phaseDetail}
		<div class="alert progress" role="status" aria-live="polite"><strong>{phase === 'preparing' ? '准备中' : phase === 'subsetting' ? '裁剪中' : phase === 'packaging' ? '正在生成' : '提示'}</strong> {phaseDetail}</div>
	{/if}

	<div class="workbench">
		<section class="panel" aria-labelledby="font-heading">
			<div class="panel-heading"><span class="step-number">01</span><div><h2 id="font-heading">选择字体</h2><p>支持 TTF、OTF、WOFF、WOFF2，单文件不超过 100 MB。</p></div></div>
			<label
				class:dragging={isDragging}
				class="drop-zone"
				ondragover={(event) => { event.preventDefault(); isDragging = true; }}
				ondragleave={() => (isDragging = false)}
				ondrop={onDrop}
			>
				<input class="visually-hidden" type="file" accept=".ttf,.otf,.woff,.woff2,font/*" onchange={onFontChange} disabled={isRunning} />
				<span class="drop-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg></span>
				<span><strong>{fontFile ? fontFile.name : '拖入字体文件，或点击选择'}</strong><small>{fontFile ? `${formatBytes(fontFile.size)} · ${fontFile.name.split('.').pop()?.toUpperCase()}` : '文件不会离开此设备'}</small></span>
			</label>
		</section>

		<section class="panel" aria-labelledby="charset-heading">
			<div class="panel-heading"><span class="step-number">02</span><div><h2 id="charset-heading">指定字符</h2><p>输入业务文字；系统会按 Unicode 字符自动去重。</p></div></div>
			<div class="field-group">
				<label for="text">需要保留的文字</label>
				<textarea id="text" bind:value={text} placeholder="例如：你好，Font Subsetter 2026！" disabled={isRunning}></textarea>
				<div class="field-row"><span>换行和重复字符会自动处理。</span><label class="inline-upload"><input type="file" accept=".txt,text/plain" onchange={importText} disabled={isRunning} />导入 UTF-8 TXT</label></div>
			</div>
			<fieldset class="preset-group"><legend>字符预设</legend><div class="preset-list">
				{#each CHARSET_PRESETS as preset}
					<button type="button" class:active={selectedPresets.has(preset.id)} aria-pressed={selectedPresets.has(preset.id)} onclick={() => togglePreset(preset.id)} disabled={isRunning}>
						<strong>{preset.label}</strong><small>{preset.description} · v{preset.version}</small>
					</button>
				{/each}
			</div></fieldset>
			<div class="field-group">
				<label for="ranges">Unicode 范围 <span>可选</span></label>
				<input id="ranges" bind:value={unicodeRanges} placeholder="U+4E00-U+9FFF, U+3000-U+303F" disabled={isRunning} />
				<span class="help">用逗号、分号或换行分隔；支持单个码点和区间。</span>
			</div>
		</section>

		<section class="panel" aria-labelledby="output-heading">
			<div class="panel-heading"><span class="step-number">03</span><div><h2 id="output-heading">生成结果</h2><p>WOFF2 为默认输出；可按需组合 WebFont 与桌面字体并下载 ZIP。</p></div></div>
			<fieldset class="format-group"><legend>WebFont 输出</legend><div class="format-options">
				<label><input type="checkbox" checked={formats.includes('woff2')} onchange={() => toggleFormat('woff2')} disabled={isRunning} /><span><strong>WOFF2</strong><small>推荐，现代浏览器优先</small></span></label>
				<label><input type="checkbox" checked={formats.includes('woff')} onchange={() => toggleFormat('woff')} disabled={isRunning} /><span><strong>WOFF</strong><small>兼容较旧 WebFont 环境</small></span></label>
			</div></fieldset>
			<fieldset class="format-group desktop-formats"><legend>桌面字体输出</legend><div class="format-options">
				<label><input type="checkbox" checked={formats.includes('ttf')} onchange={() => toggleFormat('ttf')} disabled={isRunning || sourceOutline === 'cff'} /><span><strong>TTF</strong><small>{sourceOutline === 'cff' ? 'CFF 轮廓不能无损转换为 TTF' : 'TrueType 字形，适用于桌面安装和编辑'}</small></span></label>
				<label><input type="checkbox" checked={formats.includes('otf')} onchange={() => toggleFormat('otf')} disabled={isRunning} /><span><strong>{sourceOutline === 'cff' ? 'OTF（CFF/PostScript 轮廓）' : sourceOutline === 'truetype' ? 'OTF（TrueType 轮廓）' : 'OTF（保留源轮廓）'}</strong><small>{sourceOutline === 'cff' ? '输出 .otf，保留 CFF/PostScript 轮廓' : '输出 .otf，不会进行有损的 CFF 转换'}</small></span></label>
			</div><p class="help format-note">CFF/PostScript 静态 OTF 会保留原轮廓并可输出 OTF、WOFF、WOFF2；不提供有损的 CFF → TTF 转换。</p></fieldset>
			<details><summary>高级选项</summary><label class="hinting"><input type="checkbox" bind:checked={keepHinting} disabled={isRunning} />保留 Hinting 指令（文件可能略大）</label></details>
			<div class="action-row">
				<button class="primary" type="button" onclick={generate} disabled={!canGenerate}>{isRunning ? '处理中…' : '生成字体子集'}</button>
				{#if isRunning}<button class="secondary" type="button" onclick={cancel}>取消处理</button>{/if}
			</div>
		</section>
	</div>

	{#if result}
		<section class="results" aria-labelledby="results-heading">
			<div class="results-heading"><div><p class="eyebrow">已完成</p><h2 id="results-heading">字体子集已生成</h2></div><span class="success">本地处理完成</span></div>
			<div class="metrics" aria-label="处理结果摘要">
				<div><span>原文件</span><strong>{formatBytes(result.sourceBytes)}</strong><small>{result.sourceFormat.toUpperCase()}</small></div>
				<div><span>请求字符</span><strong>{result.requestedCodepoints.toLocaleString()}</strong><small>实际可用 {result.availableCodepoints.toLocaleString()}</small></div>
				<div><span>字形数量</span><strong>{result.glyphsBefore?.toLocaleString() ?? '—'} → {result.glyphsAfter?.toLocaleString() ?? '—'}</strong><small>裁剪前 → 裁剪后</small></div>
			</div>
			{#if result.missingCodepoints.length}
				<div class="missing"><strong>字体中缺少 {result.missingCodepoints.length} 个请求字符</strong><code>{charactersFromCodepoints(result.missingCodepoints)}</code></div>
			{/if}
			{#if result.notes.length}
				<ul class="result-notes" aria-label="输出说明">
					{#each result.notes as note}<li>{note}</li>{/each}
				</ul>
			{/if}
			<div class="output-list">
				{#each result.outputs as output}
					<div class="output-file"><div><strong>{output.fileName}</strong><span>{formatBytes(output.bytes.byteLength)} · 缩小 {compression(output.bytes.byteLength)}</span></div><button type="button" class="secondary" onclick={() => downloadBytes(output.bytes, output.fileName, fontMime(output.format))}>下载 {output.format.toUpperCase()}</button></div>
				{/each}
			</div>
			{#if result.outputs.length > 1}<button class="primary zip" type="button" onclick={() => { if (result) downloadZip(result.outputs, css, fontFile?.name ?? 'font'); }}>下载全部（ZIP）</button>{/if}
			<div class="css-output"><div><h3>@font-face CSS</h3><button type="button" class="text-button" onclick={copyCss}>复制 CSS</button></div><pre><code>{css}</code></pre></div>
		</section>
	{/if}
</main>

<footer class="site-footer"><div class="shell">字体与文本只在当前浏览器内存中处理；关闭或刷新页面后不会保留任务数据。</div></footer>
