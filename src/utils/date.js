/**
 * 日期格式化
 */

const pad = (n) => String(n).padStart(2, '0');

/** 把各种写法统一成 Date 对象（避免时区导致的差一天） */
export function toDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input);

  const str = String(input).trim();
  // 支持 2024-01-01 / 2024/01/01 / 2024-01-01 10:00(:00) / 2024-01-01T10:00:00
  const m = str.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/
  );
  if (m) {
    const [, y, mo, d, h = 0, mi = 0, s = 0] = m;
    return new Date(+y, +mo - 1, +d, +h, +mi, +s);
  }

  const parsed = new Date(str);
  return isNaN(parsed) ? new Date() : parsed;
}

/** 2024-01-01 */
export function formatDate(input) {
  const d = toDate(input);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 2024 年 1 月 1 日 */
export function formatDateCN(input) {
  const d = toDate(input);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

/** 2024-01-01 10:00 */
export function formatDateTime(input) {
  const d = toDate(input);
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** RSS 用的 RFC 822 时间 */
export function toRFC822(input) {
  return toDate(input).toUTCString();
}

export function getYear(input) {
  return toDate(input).getFullYear();
}

/** 相对时间：3 天前 */
export function fromNow(input) {
  const diff = Date.now() - toDate(input).getTime();
  const day = 86400000;
  if (diff < 0) return '刚刚';
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`;
  if (diff < day * 365) return `${Math.floor(diff / (day * 30))} 个月前`;
  return `${Math.floor(diff / (day * 365))} 年前`;
}
