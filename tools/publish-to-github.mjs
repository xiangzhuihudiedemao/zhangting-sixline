#!/usr/bin/env node
/**
 * 把项目源码发布到 GitHub（不依赖 git / gh）。
 *
 * 用法：
 *   node tools/publish-to-github.mjs owner/repo --dry-run
 *   GITHUB_TOKEN=ghp_xxx node tools/publish-to-github.mjs owner/repo
 *   GITHUB_TOKEN=ghp_xxx node tools/publish-to-github.mjs owner/repo --release
 *
 * 说明：
 * - 不会上传 .toolchain / build / keystore / keystore.properties / local.properties / *.apk
 * - --release 会把 dist 里的 APK 作为 Release 附件上传
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const args = process.argv.slice(2);
const repoSlug = args.find((a) => /^[^/]+\/[^/]+$/.test(a) && !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const withRelease = args.includes('--release');
const tokenFile = path.join(root, '.secrets', 'github-token');
const token = process.env.GITHUB_TOKEN || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '');

if (!repoSlug) {
  console.error('用法: node tools/publish-to-github.mjs owner/repo [--dry-run] [--release]');
  process.exit(1);
}
if (!dryRun && !token) {
  console.error('缺少 GITHUB_TOKEN（或 .secrets/github-token 文件）');
  process.exit(1);
}

const SKIP_DIRS = new Set(['.git', '.gradle', 'build', '.toolchain', 'keystore', 'node_modules', '.idea', '.secrets']);

function collect(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      if (relPath === 'dist') {
        for (const f of fs.readdirSync(path.join(dir, entry.name))) {
          if (f.endsWith('.txt')) out.push(`dist/${f}`);
        }
        continue;
      }
      out.push(...collect(path.join(dir, entry.name), relPath));
    } else {
      if (entry.name === 'local.properties' || entry.name === 'keystore.properties') continue;
      if (entry.name.endsWith('.apk') || entry.name.endsWith('.jks') || entry.name.endsWith('.keystore')) continue;
      out.push(relPath);
    }
  }
  return out;
}

async function api(method, endpoint, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'zhangting-sixline-publisher',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} -> ${res.status}: ${text.slice(0, 600)}`);
  }
  return data;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// GitHub 对 .github/workflows/ 下的文件额外要求 token 具备 workflow 权限，
// 没有该权限时接口返回 404，可用 --no-workflows 先跳过。
let files = collect(root).sort();
if (args.includes('--no-workflows')) {
  files = files.filter((f) => !f.startsWith('.github/workflows/'));
}
const totalBytes = files.reduce((sum, f) => sum + fs.statSync(path.join(root, f)).size, 0);

console.log(`仓库: ${repoSlug}`);
console.log(`文件: ${files.length} 个，共 ${(totalBytes / 1024).toFixed(1)} KB`);
for (const f of files) console.log(`  ${f}`);

if (dryRun) {
  console.log('\n[dry-run] 只列出文件，未上传。');
  process.exit(0);
}

let info;
try {
  info = await api('GET', `/repos/${repoSlug}`);
} catch (err) {
  if (!String(err.message).includes('404') || !args.includes('--create')) throw err;
  const [, name] = repoSlug.split('/');
  info = await api('POST', '/user/repos', {
    name,
    private: !args.includes('--public'),
    description: '涨停六线计算器 Android 版：WebView 壳 + 一键出包',
    auto_init: false,
  });
  console.log(`已创建仓库 ${info.full_name}`);
}
const branch = info.default_branch || 'main';
console.log(`\n目标仓库: ${info.full_name}（${info.private ? '私有' : '公开'}），默认分支 ${branch}`);

let baseTree = null;
let parents = [];

async function loadHead() {
  const ref = await api('GET', `/repos/${repoSlug}/git/ref/heads/${branch}`);
  const baseCommit = await api('GET', `/repos/${repoSlug}/git/commits/${ref.object.sha}`);
  baseTree = baseCommit.tree.sha;
  parents = [ref.object.sha];
  console.log(`已有提交 ${ref.object.sha.slice(0, 7)}，将在其基础上新增提交`);
}

try {
  await loadHead();
} catch (err) {
  const message = String(err.message);
  if (!message.includes('404') && !message.includes('409')) throw err;
  // GitHub 的 Git Data API 在完全空的仓库上会返回 409，
  // 先用 Contents API 写入 README 建立首个提交，再走正常的提交流程。
  console.log('空仓库，先用 README 建立首个提交');
  const readme = fs.readFileSync(path.join(root, 'README.md'));
  await api('PUT', `/repos/${repoSlug}/contents/README.md`, {
    message: '初始化仓库',
    content: readme.toString('base64'),
  });
  await loadHead();
}

console.log('\n上传文件...');
const shas = await mapLimit(files, 4, async (f) => {
  const content = fs.readFileSync(path.join(root, f)).toString('base64');
  const blob = await api('POST', `/repos/${repoSlug}/git/blobs`, { content, encoding: 'base64' });
  console.log(`  ✓ ${f} (${blob.size} bytes)`);
  return blob.sha;
});

const treeEntries = files.map((f, i) => ({ path: f, mode: '100644', type: 'blob', sha: shas[i] }));
const treePayload = { tree: treeEntries, ...(baseTree ? { base_tree: baseTree } : {}) };
console.log(`\n创建目录树：${treeEntries.length} 个条目，base_tree=${baseTree || '无'}`);

let tree;
try {
  tree = await api('POST', `/repos/${repoSlug}/git/trees`, treePayload);
} catch (err) {
  fs.writeFileSync(path.join(root, '.secrets', 'last-tree.json'), JSON.stringify(treePayload, null, 2));
  const missing = treeEntries.filter((e) => !e.sha || !e.path);
  console.error(`失败条目：${missing.length}；已写入 .secrets/last-tree.json`);
  throw err;
}

const commit = await api('POST', `/repos/${repoSlug}/git/commits`, {
  message: '涨停六线计算器 Android 版：WebView 壳、签名配置与出包工作流',
  tree: tree.sha,
  parents,
});

if (parents.length === 0) {
  await api('POST', `/repos/${repoSlug}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
} else {
  await api('PATCH', `/repos/${repoSlug}/git/refs/heads/${branch}`, { sha: commit.sha, force: true });
}

if (withRelease) {
  const tag = 'v1.0';
  const apkCandidates = fs.readdirSync(path.join(root, 'dist')).filter((f) => f.endsWith('.apk'));
  const apkFile = apkCandidates.find((f) => f.includes('涨停')) || apkCandidates[0];
  if (apkFile) {
    console.log('\n创建 Release 并上传 APK...');
    let release = null;
    try {
      release = await api('POST', `/repos/${repoSlug}/releases`, {
        tag_name: tag,
        target_commitish: branch,
        name: '涨停六线计算器 v1.0',
        body: 'Android 安装包（离线、无权限）。\n\n- 包名 `com.zhangting.sixline`\n- 最低 Android 5.0\n- 直接下载 APK 安装即可',
        draft: false,
        prerelease: false,
      });
    } catch (err) {
      if (!String(err.message).includes('422')) throw err;
      release = await api('GET', `/repos/${repoSlug}/releases/tags/${tag}`);
    }

    const assetName = 'zhangting-sixline-v1.0.apk';
    const buf = fs.readFileSync(path.join(root, 'dist', apkFile));
    const upload = await fetch(
      `https://uploads.github.com/repos/${repoSlug}/releases/${release.id}/assets?name=${encodeURIComponent(assetName)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': String(buf.length),
          'User-Agent': 'zhangting-sixline-publisher',
        },
        body: buf,
      },
    );
    if (!upload.ok) {
      console.error(`APK 上传失败: ${upload.status} ${(await upload.text()).slice(0, 300)}`);
    } else {
      const asset = await upload.json();
      console.log(`  ✓ ${asset.name} (${asset.size} bytes)`);
      console.log(`  下载地址: ${asset.browser_download_url}`);
    }
    console.log(`Release: ${release.html_url}`);
  }
}

console.log(`\n完成: https://github.com/${repoSlug}`);
