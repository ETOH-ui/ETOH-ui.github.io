/**
 * 字数统计与阅读时长估算
 * 中文按字算（300 字/分钟），英文按词算（200 词/分钟）
 */

/** 去掉代码块、HTML 标签、Markdown 记号后统计 */
export function stripMarkdown(raw) {
  return String(raw)
    // 代码块整体保留内容但不参与中文计数，这里直接去掉围栏标记
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    // 图片、链接只留文字
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // HTML 标签
    .replace(/<[^>]+>/g, ' ')
    // 标题 / 引用 / 列表 / 分割线等行首记号
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/^\s{0,3}(-{3,}|\*{3,})\s*$/gm, ' ')
    // 强调符号
    .replace(/[*_~]{1,3}/g, '')
    .trim();
}

/** 返回 { chars, words, total } —— total 是用于估算时长的"字词当量" */
export function countText(raw) {
  const text = stripMarkdown(raw);
  const cjk = text.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) || [];
  const latin = text.match(/[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g) || [];
  return {
    chars: cjk.length,
    words: latin.length,
    total: cjk.length + latin.length
  };
}

/** 阅读时长（分钟，至少 1） */
export function readingTime(raw) {
  const { total } = countText(raw);
  return Math.max(1, Math.round(total / 300)) ;
}

/** 2.1k 这样的展示格式 */
export function formatCount(n) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** 从正文里取纯文本摘要 */
export function excerpt(raw, length = 120) {
  const text = stripMarkdown(raw)
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? text.slice(0, length) + '…' : text;
}
