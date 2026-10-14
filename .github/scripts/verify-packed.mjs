// Generated file: checks the packed tarball before publish (verify_command). Do not edit by hand.
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join, posix, relative, resolve, sep } from "path";
import { exec, spawnSync } from "child_process";
import { promisify } from "util";
import { createRequire } from "module";
promisify(exec);
const DEFAULT_OUTPUT_DIR = "dist";
const CONFIG_RE = /^(vite\.config|tsconfig).*\.(ts|js|mjs|cjs|json)$/;
const OUT_DIR_RE = /["']?outDir["']?\s*:\s*["']([^"']+)["']/g;
function discoverOutputDirs(repoPath) {
	const dirs = new Set([DEFAULT_OUTPUT_DIR]);
	let entries;
	try {
		entries = readdirSync(repoPath);
	} catch {
		return [...dirs];
	}
	for (const file of entries.filter((f) => CONFIG_RE.test(f))) {
		let src;
		try {
			src = readFileSync(join(repoPath, file), "utf8");
		} catch {
			continue;
		}
		for (const m of src.matchAll(OUT_DIR_RE)) {
			const top = m[1].replace(/^\.\//, "").replace(/^\.\.\//, "").split("/")[0];
			if (top && top !== ".." && top !== ".") dirs.add(top);
		}
	}
	return [...dirs].sort();
}
function srcReachesTarball(pkgPath, manifest) {
	if (!Array.isArray(manifest.files)) return true;
	const reach = new Set(["src", ...discoverOutputDirs(pkgPath)]);
	return manifest.files.some((f) => reach.has(String(f).replace(/^\.\//, "").split("/")[0]));
}
const SRC_OFF_SURFACE = "src 가 게시 표면 밖이다(files)";
function publishRewritesSrcToDist(pkgPath) {
	const wfDir = join(pkgPath, ".github", "workflows");
	if (!existsSync(wfDir)) return null;
	let files;
	try {
		files = readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f));
	} catch {
		return null;
	}
	let sawPublishPath = false;
	let allRewrite = true;
	for (const f of files) {
		let text;
		try {
			text = readFileSync(join(wfDir, f), "utf-8");
		} catch {
			continue;
		}
		if (!(/npm publish/.test(text) || /shared\/\.github\/workflows\/publish/.test(text))) continue;
		const wd = text.match(/working-directory:\s*(\S+)/);
		if (wd && !/^\.?\/?$/.test(wd[1])) continue;
		sawPublishPath = true;
		if (!(/iyulab\/shared\/\.github\/workflows\/publish/.test(text) || /rewrite-exports-src-to-dist/.test(text))) allRewrite = false;
	}
	if (!sawPublishPath) return null;
	return allRewrite;
}
const REGISTERS = /@customElement\s*\(|customElements\s*\.\s*define\s*\(/;
const REGISTERS_TAG = /(?:@customElement|customElements\s*\.\s*define)\s*\(\s*['"`]([a-z][\w-]*-[\w-]*)['"`]/g;
function distRegistersTag(text, tag) {
	const lit = "\\s*['\"`]" + tag.replace(/-/g, "\\-") + "['\"`]";
	if (new RegExp("(?<![.\\w$])[\\w$]+\\s*\\(" + lit).test(text)) return true;
	return new RegExp("customElements\\s*\\.\\s*define\\s*\\(" + lit).test(text);
}
function entryPoints(pkg) {
	const out = new Set();
	const visit = (v) => {
		if (typeof v === "string") {
			if (/\.js$/.test(v) && !v.includes("*")) out.add(v.replace(/^\.\//, ""));
		} else if (v && typeof v === "object") for (const x of Object.values(v)) visit(x);
	};
	visit(pkg.exports);
	return [...out];
}
const RELATIVE_IMPORT = /(?:import|export)\s+(?:[\s\S]*?\sfrom\s*)?['"](\.[^'"]*)['"]/g;
function resolveModule(abs) {
	const cands = [abs];
	if (/\.js$/.test(abs)) cands.push(abs.replace(/\.js$/, ".ts"), abs.replace(/\.js$/, ".tsx"));
	else if (!/\.[a-z]+$/i.test(abs)) cands.push(abs + ".ts", abs + ".tsx", abs + ".js");
	cands.push(join(abs, "index.ts"), join(abs, "index.tsx"), join(abs, "index.js"));
	for (const c of cands) try {
		if (statSync(c).isFile()) return c;
	} catch {}
	return null;
}
function reachesRegistration(pkgPath, entryRel, isRegistering) {
	const start = resolveModule(join(pkgPath, entryRel));
	if (!start) return null;
	const seen = new Set();
	const stack = [start];
	while (stack.length) {
		const f = stack.pop();
		if (seen.has(f)) continue;
		seen.add(f);
		const text = read(f);
		if (isRegistering(text)) return true;
		for (const m of text.matchAll(RELATIVE_IMPORT)) {
			const next = resolveModule(join(dirname(f), m[1]));
			if (next && !seen.has(next)) stack.push(next);
		}
	}
	return false;
}
function sourceTags(srcDir) {
	const tags = new Set();
	for (const f of walk(srcDir, (n) => /\.tsx?$/.test(n) && !/\.d\.ts$/.test(n))) for (const m of read(f).matchAll(REGISTERS_TAG)) tags.add(m[1]);
	return [...tags].sort();
}
const BARE_RELATIVE_IMPORT = /(?:^|[;\n])\s*import\s*['"](\.[^'"]+)['"]/g;
function sideEffectOnlyModules(srcFiles, isElementModule) {
	const out = new Set();
	for (const f of srcFiles) for (const m of read(f).matchAll(BARE_RELATIVE_IMPORT)) {
		const target = resolveModule(join(dirname(f), m[1]));
		if (!target || !/\.tsx?$/.test(target)) continue;
		if (isElementModule(target)) continue;
		out.add(target);
	}
	return [...out];
}
function globToRegExp(glob) {
	const s = String(glob).replace(/^\.\//, "");
	let out = "";
	for (let i = 0; i < s.length; i++) {
		const c = s[i];
		if (c === "*") {
			if (s[i + 1] === "*") {
				out += ".*";
				i++;
				if (s[i + 1] === "/") i++;
			} else out += "[^/]*";
		} else if (c === "?") out += "[^/]";
		else if (".+^${}()|[]\\".includes(c)) out += "\\" + c;
		else out += c;
	}
	return new RegExp("^" + out + "$");
}
function walk(dir, test, out = []) {
	if (!existsSync(dir)) return out;
	let entries;
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const e of entries) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walk(p, test, out);
		else if (test(e.name)) out.push(p);
	}
	return out;
}
const rel = (base, p) => relative(base, p).split(/[\\/]/).join(posix.sep);
const read = (f) => {
	try {
		return readFileSync(f, "utf-8");
	} catch {
		return "";
	}
};
function checkSideEffectsCoverage(pkgPath) {
	const manifestPath = join(pkgPath, "package.json");
	if (!existsSync(manifestPath)) return {
		status: "skip",
		detail: "package.json 없음"
	};
	let pkg;
	try {
		pkg = JSON.parse(readFileSync(manifestPath, "utf-8"));
	} catch {
		return {
			status: "skip",
			detail: "package.json 파스 불가"
		};
	}
	if (pkg.private) return {
		status: "skip",
		detail: "private"
	};
	if (!srcReachesTarball(pkgPath, pkg)) return {
		status: "skip",
		detail: SRC_OFF_SURFACE
	};
	if (!Array.isArray(pkg.sideEffects)) return {
		status: "skip",
		detail: "sideEffects 배열 아님 — false·미선언은 매니페스트 계약 R7 이 판정한다"
	};
	const srcDir = join(pkgPath, "src");
	if (!existsSync(srcDir)) return {
		status: "skip",
		detail: "src 없음"
	};
	const srcFiles = walk(srcDir, (n) => /\.tsx?$/.test(n) && !/\.d\.ts$/.test(n));
	const registering = [];
	const tags = new Set();
	for (const f of srcFiles) {
		const text = read(f);
		if (!REGISTERS.test(text)) continue;
		registering.push(f);
		for (const m of text.matchAll(REGISTERS_TAG)) tags.add(m[1]);
	}
	if (registering.length === 0) return {
		status: "skip",
		detail: "등록 모듈 없음"
	};
	const patterns = pkg.sideEffects.map(globToRegExp);
	const covers = (p) => patterns.some((re) => re.test(p));
	const srcRels = registering.map((f) => rel(pkgPath, f));
	const uncoveredSrc = srcRels.filter((p) => !covers(p));
	const distDir = join(pkgPath, "dist");
	const hasDist = existsSync(distDir);
	const tagList = [...tags];
	const distRegistering = hasDist ? walk(distDir, (n) => /\.js$/.test(n)).filter((f) => {
		const text = read(f);
		return tagList.some((t) => distRegistersTag(text, t));
	}).map((f) => rel(pkgPath, f)) : [];
	const uncoveredDist = distRegistering.filter((p) => !covers(p));
	const rewrites = publishRewritesSrcToDist(pkgPath) === true;
	const stripExt = (p) => p.replace(/\.(ts|tsx|js)$/, "");
	const srcRegSet = new Set(srcRels.map(stripExt));
	const distRegSet = new Set(distRegistering.map(stripExt));
	const targets = new Set();
	for (const e of entryPoints(pkg)) {
		targets.add(e);
		if (rewrites && e.startsWith("src/")) targets.add(e.replace(/^src\//, "dist/"));
	}
	const uncoveredEntries = [];
	for (const e of targets) {
		const isDist = e.startsWith("dist/");
		if (isDist && !hasDist) continue;
		const abs = resolveModule(join(pkgPath, e));
		if (!abs) continue;
		const actual = rel(pkgPath, abs);
		if (covers(actual)) continue;
		if ((isDist ? distRegSet : srcRegSet).has(stripExt(actual))) continue;
		if (reachesRegistration(pkgPath, e, isDist ? (text) => tagList.some((t) => distRegistersTag(text, t)) : (text) => REGISTERS.test(text)) === true) uncoveredEntries.push(actual);
	}
	uncoveredEntries.sort();
	const registeringSet = new Set(registering);
	const sideOnly = sideEffectOnlyModules(srcFiles, (f) => registeringSet.has(f)).map((f) => rel(pkgPath, f));
	const toDist = (p) => p.replace(/^src\//, "dist/").replace(/\.tsx?$/, ".js");
	const mirrored = hasDist && srcRels.some((p) => existsSync(join(pkgPath, toDist(p))));
	const uncoveredSideOnly = sideOnly.filter((p) => !covers(p) || mirrored && !covers(toDist(p)));
	const missingSideOnly = mirrored ? sideOnly.filter((p) => !existsSync(join(pkgPath, toDist(p)))).map(toDist) : [];
	uncoveredSideOnly.sort();
	missingSideOnly.sort();
	const fail = uncoveredSrc.length || uncoveredDist.length || uncoveredEntries.length || uncoveredSideOnly.length || missingSideOnly.length;
	if (!hasDist && !fail) return {
		status: "skip",
		detail: "dist 없음(미빌드) — src 축만 통과",
		uncoveredSrc,
		uncoveredDist: [],
		uncoveredEntries: [],
		uncoveredSideOnly: [],
		missingSideOnly: [],
		counted: {
			src: srcRels.length,
			dist: 0,
			tags: tags.size,
			sideOnly: sideOnly.length
		}
	};
	return {
		status: fail ? "fail" : "ok",
		uncoveredSrc,
		uncoveredDist,
		uncoveredEntries,
		uncoveredSideOnly,
		missingSideOnly,
		counted: {
			src: srcRels.length,
			dist: distRegistering.length,
			tags: tags.size,
			sideOnly: sideOnly.length
		}
	};
}
function compileEntryDeclarations(pkgRoot, { depsRoots = [pkgRoot] } = {}) {
	const manifest = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8"));
	const entries = declarationExportKeys(manifest.exports ?? {});
	const empty = {
		entries: [],
		errors: [],
		foreign: []
	};
	if (!entries.length) return {
		status: "skip",
		detail: "types 를 가진 exports 엔트리가 없다",
		...empty
	};
	const published = distManifest(manifest);
	const missing = entries.map((k) => published.exports[k].types).filter((t) => !existsSync(join(pkgRoot, t)));
	if (missing.length) return {
		status: "skip",
		detail: `선언 파일이 없다(미빌드): ${missing.join(", ")}`,
		...empty
	};
	const tsc = findTsc(depsRoots);
	if (!tsc) return {
		status: "skip",
		detail: "TypeScript 를 찾지 못했다",
		...empty
	};
	const work = mkdtempSync(join(tmpdir(), "dts-compile-"));
	try {
		const self = join(work, "node_modules", ...manifest.name.split("/"));
		mkdirSync(self, { recursive: true });
		writeFileSync(join(self, "package.json"), JSON.stringify(published));
		for (const e of readdirSync(pkgRoot, { withFileTypes: true })) {
			if (e.name === "package.json" || e.name === "node_modules" || e.name.startsWith(".")) continue;
			if (e.isDirectory()) symlinkSync(resolve(pkgRoot, e.name), join(self, e.name), "junction");
			else copyFileSync(join(pkgRoot, e.name), join(self, e.name));
		}
		linkDependencies(depsRoots, join(work, "node_modules"), manifest.name);
		const specifiers = entries.map((k) => k === "." ? manifest.name : `${manifest.name}/${k.replace(/^\.\//, "")}`);
		writeFileSync(join(work, "entries.ts"), specifiers.map((s, i) => `import type * as e${i} from '${s}';\nexport type { e${i} };\n`).join(""));
		writeFileSync(join(work, "tsconfig.json"), JSON.stringify({
			compilerOptions: {
				target: "ES2022",
				module: "ESNext",
				moduleResolution: "Bundler",
				strict: true,
				skipLibCheck: false,
				noEmit: true,
				jsx: "react-jsx",
				lib: [
					"ES2022",
					"DOM",
					"DOM.Iterable"
				],
				types: [],
				preserveSymlinks: true
			},
			files: ["entries.ts"]
		}));
		const run = spawnSync(process.execPath, [
			tsc,
			"-p",
			work
		], {
			encoding: "utf-8",
			cwd: work
		});
		const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
		const ownRoots = [resolve(pkgRoot), self];
		const ownFile = (file) => {
			const base = ownRoots.find((r) => file.startsWith(r + sep) && !file.startsWith(join(r, "node_modules") + sep));
			return base ? relative(base, file).split(sep).join("/") : null;
		};
		const errors = [];
		const foreign = [];
		const unresolved = new Set();
		for (const line of out.split(/\r?\n/)) {
			const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+: .*)$/);
			if (!m) continue;
			const file = resolve(work, m[1]);
			const own = ownFile(file);
			if (!own) foreign.push(`${relative(work, file).split(sep).join("/")}(${m[2]},${m[3]}): ${m[4]}`);
			else if (/^TS2307:/.test(m[4]) && !ownSpecifier(m[4].match(/'([^']+)'/)?.[1] ?? "", manifest.name)) unresolved.add(m[4].match(/'([^']+)'/)?.[1] ?? m[4]);
			else errors.push(`${own}(${m[2]},${m[3]}): ${m[4]}`);
		}
		if (run.status !== 0 && !errors.length && !foreign.length && !unresolved.size) return {
			status: "skip",
			detail: `tsc 가 오류 위치 없이 끝났다: ${out.trim().split(/\r?\n/)[0] ?? ""}`,
			entries: specifiers,
			errors,
			foreign
		};
		if (!errors.length && unresolved.size) return {
			status: "skip",
			detail: `의존 타입을 풀지 못했다: ${[...unresolved].join(", ")}`,
			entries: specifiers,
			errors,
			foreign
		};
		return {
			status: errors.length ? "fail" : "ok",
			entries: specifiers,
			errors,
			foreign
		};
	} finally {
		rmSync(work, {
			recursive: true,
			force: true
		});
	}
}
function ownSpecifier(spec, name) {
	return /^\.{1,2}(\/|$)/.test(spec) || spec.startsWith("/") || spec === name || spec.startsWith(`${name}/`);
}
function declarationExportKeys(exportsMap) {
	return Object.entries(exportsMap).filter(([k, v]) => !k.includes("*") && v && typeof v === "object" && typeof v.types === "string").map(([k]) => k);
}
function distManifest(manifest) {
	const rewrite = (v) => typeof v === "string" ? v.replace(/^\.\/src\//, "./dist/") : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x)])) : v;
	return {
		name: manifest.name,
		version: manifest.version,
		type: manifest.type,
		exports: rewrite(manifest.exports)
	};
}
function findTsc(roots) {
	for (const root of roots) try {
		const pkg = createRequire(join(resolve(root), "package.json")).resolve("typescript/package.json");
		const bin = join(dirname(pkg), "bin", "tsc");
		if (existsSync(bin)) return bin;
	} catch {}
	return null;
}
function linkDependencies(roots, target, selfName) {
	for (const root of roots) {
		const nm = join(resolve(root), "node_modules");
		if (!existsSync(nm)) continue;
		for (const e of readdirSync(nm)) {
			if (e.startsWith(".")) continue;
			const names = e.startsWith("@") ? readdirSync(join(nm, e)).map((c) => `${e}/${c}`) : [e];
			for (const name of names) {
				if (name === selfName) continue;
				const dest = join(target, ...name.split("/"));
				if (existsSync(dest)) continue;
				mkdirSync(dirname(dest), { recursive: true });
				symlinkSync(join(nm, ...name.split("/")), dest, "junction");
			}
		}
	}
}
function missingExportTargets(root, exportsField) {
	const targets = [];
	const collect = (v) => {
		if (typeof v === "string") targets.push(v);
		else if (v && typeof v === "object") Object.values(v).forEach(collect);
	};
	collect(exportsField);
	return [...new Set(targets)].filter((t) => {
		const rel = t.replace(/^\.\//, "");
		const star = rel.indexOf("*");
		const probe = star === -1 ? rel : rel.slice(0, rel.lastIndexOf("/", star) + 1) || ".";
		return !existsSync(join(root, probe));
	});
}
function inspectAssembled(root, source, { depsRoots } = {}) {
	const r = inspectAssembledParts(root, source);
	if (!depsRoots) return r;
	const d = compileEntryDeclarations(root, { depsRoots });
	return {
		...r,
		status: r.status === "fail" || d.status === "fail" ? "fail" : r.status,
		declarationStatus: d.status,
		declarationDetail: d.detail,
		declarationErrors: d.errors
	};
}
function inspectAssembledParts(root, source) {
	const publishedManifest = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
	if (!srcReachesTarball(root, publishedManifest)) {
		const missingExports = missingExportTargets(root, publishedManifest.exports);
		return {
			status: missingExports.length ? "fail" : "ok",
			source: "tarball(exports 축)",
			missingExports,
			missingTags: [],
			uncoveredSrc: [],
			uncoveredDist: [],
			uncoveredEntries: [],
			uncoveredSideOnly: [],
			missingSideOnly: []
		};
	}
	const coverage = checkSideEffectsCoverage(root);
	const distFiles = [];
	const walk = (d) => {
		if (!existsSync(d)) return;
		for (const e of readdirSync(d)) {
			const p = join(d, e);
			if (statSync(p).isDirectory()) walk(p);
			else if (p.endsWith(".js")) distFiles.push(readFileSync(p, "utf-8"));
		}
	};
	walk(join(root, "dist"));
	const missingTags = sourceTags(join(root, "src")).filter((t) => !distFiles.some((txt) => distRegistersTag(txt, t)));
	return {
		status: coverage.status === "fail" || missingTags.length > 0 ? "fail" : "ok",
		source,
		coverageStatus: coverage.status,
		coverageDetail: coverage.detail,
		missingTags,
		uncoveredSrc: coverage.uncoveredSrc ?? [],
		uncoveredDist: coverage.uncoveredDist ?? [],
		uncoveredEntries: coverage.uncoveredEntries ?? [],
		uncoveredSideOnly: coverage.uncoveredSideOnly ?? [],
		missingSideOnly: coverage.missingSideOnly ?? []
	};
}
function verifyPacked(repoRoot, packedDir) {
	if (!existsSync(join(packedDir, "package.json"))) return {
		status: "fail",
		detail: `no package.json in ${packedDir}`
	};
	const work = mkdtempSync(join(tmpdir(), "verify-packed-"));
	try {
		const root = join(work, "package");
		cpSync(packedDir, root, { recursive: true });
		const src = join(repoRoot, "src");
		if (existsSync(src)) cpSync(src, join(root, "src"), { recursive: true });
		return inspectAssembled(root, "checkout", { depsRoots: [repoRoot] });
	} finally {
		rmSync(work, {
			recursive: true,
			force: true
		});
	}
}
function formatVerifyResult(r) {
	const lines = [];
	if (r.detail) lines.push(r.detail);
	const list = (label, xs) => {
		if (xs?.length) lines.push(`${label}: ${xs.join(", ")}`);
	};
	list("exports targets missing from the tarball", r.missingExports);
	list("tags registered in src but not in dist", r.missingTags);
	list("src side-effect modules not covered by sideEffects", r.uncoveredSrc);
	list("dist side-effect modules not covered by sideEffects", r.uncoveredDist);
	list("entry points not covered by sideEffects", r.uncoveredEntries);
	list("side-effect-only modules not covered", r.uncoveredSideOnly);
	list("side-effect-only modules missing from dist", r.missingSideOnly);
	list("entry declarations that do not compile on their own (skipLibCheck: false)", r.declarationErrors);
	if (r.declarationStatus === "skip" && r.declarationDetail) lines.push(`declarations: not checked — ${r.declarationDetail}`);
	if (r.coverageStatus && r.coverageStatus !== "ok" && r.coverageDetail) lines.push(`sideEffects: ${r.coverageDetail}`);
	return lines;
}
const packedDir = process.env.PACKED_DIR;
if (!packedDir) {
	console.error("verify-packed: PACKED_DIR is not set (run from the publish workflow after the pack step)");
	process.exit(1);
}
const r = verifyPacked(process.cwd(), packedDir);
for (const line of formatVerifyResult(r)) console.log(line);
if (r.status === "fail") {
	console.error("verify-packed: the packed tarball would ship broken (see the lines above) — publish stopped");
	process.exit(1);
}
console.log(`verify-packed: ok (${r.source})`);
export {};
