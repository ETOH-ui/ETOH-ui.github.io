/**
 * 文件系统小工具
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/* 写入钩子：构建脚本用它记录本次生成了哪些文件，方便事后清理孤儿文件 */
let writeHook = null;

export function onWrite(fn) {
  writeHook = fn;
}

function record(p) {
  if (writeHook) writeHook(p);
}

export async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function emptyDir(dir) {
  if (!(await exists(dir))) return;
  const entries = await fs.readdir(dir);
  await Promise.all(
    entries.map((name) => fs.rm(path.join(dir, name), { recursive: true, force: true }))
  );
}

/** 递归拷贝目录，filter 可过滤文件名 */
export async function copyDir(src, dest, filter = () => true) {
  if (!(await exists(src))) return 0;
  let count = 0;
  await ensureDir(dest);

  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += await copyDir(s, d, filter);
    } else if (filter(entry.name)) {
      await fs.copyFile(s, d);
      record(d);
      count += 1;
    }
  }
  return count;
}

export async function writeFile(dest, content) {
  await ensureDir(path.dirname(dest));
  await fs.writeFile(dest, content, 'utf8');
  record(dest);
}

/** 递归列出某后缀的文件 */
export async function walk(dir, ext = '.md') {
  const out = [];
  if (!(await exists(dir))) return out;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, ext)));
    } else if (entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

/** 递归统计目录内文件总字节数 */
export async function dirSize(dir) {
  let total = 0;
  if (!(await exists(dir))) return 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else total += (await fs.stat(full)).size;
  }
  return total;
}
