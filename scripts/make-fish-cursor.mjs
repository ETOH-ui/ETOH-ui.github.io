/**
 * 从参考图抠出角色上半身，做成光标（原图质感，不做像素化）
 * 用法：node scripts/make-fish-cursor.mjs
 */
import sharp from 'sharp';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, '..', 'other', 'fish-ref2.webp');
const OUT = path.join(ROOT, 'public', 'images', 'cursor');

// 裁切范围：避开左上角的气泡框，只留头部和肩
const CROP = { left: 18, top: 18, width: 464, height: 674 };

// 画布尺寸与人物高度
const CANVAS = 56;
const BODY_H = 56;

async function cutOut() {
  const { data, info } = await sharp(SRC)
    .extract(CROP)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H } = info;
  const px = new Uint8Array(data);

  const isWhite = (i) => {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    return Math.min(r, g, b) > 228 && Math.max(r, g, b) - Math.min(r, g, b) < 14;
  };

  // 从四边向内泛洪，只清除与边缘连通的白色（保留围裙、眼睛高光里的白）
  const seen = new Uint8Array(W * H);
  const queue = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const idx = y * W + x;
    if (seen[idx]) return;
    if (!isWhite(idx * 4)) return;
    seen[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < W; x += 1) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y += 1) {
    push(0, y);
    push(W - 1, y);
  }

  while (queue.length) {
    const idx = queue.pop();
    const x = idx % W;
    const y = (idx / W) | 0;
    px[idx * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  // 贴着透明区的浅色像素处理掉，缩放后不容易出现白边
  for (let y = 1; y < H - 1; y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      const i = (y * W + x) * 4;
      if (px[i + 3] === 0) continue;
      const near =
        px[((y - 1) * W + x) * 4 + 3] === 0 ||
        px[((y + 1) * W + x) * 4 + 3] === 0 ||
        px[(y * W + x - 1) * 4 + 3] === 0 ||
        px[(y * W + x + 1) * 4 + 3] === 0;
      if (!near) continue;
      if (isWhite(i)) {
        px[i + 3] = 0;
      } else if (px[i] > 200 && px[i + 1] > 200 && px[i + 2] > 200) {
        px[i] = 150;
        px[i + 1] = 178;
        px[i + 2] = 214;
      }
    }
  }

  return { buffer: Buffer.from(px), info };
}

/** 找出不透明内容的边界 */
function tightBox(buffer, W, H) {
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (buffer[(y * W + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** 左上角的鼠标箭头：像素风，白色填充 + 黑色描边 */
const ARROW = [
  'X......',
  'XX.....',
  'XWX....',
  'XWWX...',
  'XWWWX..',
  'XWWWWX.',
  'XWWXXX.',
  'XWX....',
  'XX.....'
];
const ARROW_CELL = 2;

async function makeArrow(fill) {
  let svg = '';
  ARROW.forEach((row, y) => {
    row.split('').forEach((ch, x) => {
      if (ch === '.') return;
      const color = ch === 'X' ? '#0b0f16' : fill;
      svg += `<rect x="${x * ARROW_CELL}" y="${y * ARROW_CELL}" width="${ARROW_CELL}" height="${ARROW_CELL}" fill="${color}"/>`;
    });
  });
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ARROW[0].length * ARROW_CELL}" height="${
        ARROW.length * ARROW_CELL
      }" shape-rendering="crispEdges">${svg}</svg>`
    )
  )
    .png()
    .toBuffer();
}

async function main() {
  const { buffer, info } = await cutOut();
  const box = tightBox(buffer, info.width, info.height);
  console.log('内容区域', box);

  await sharp(buffer, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(path.join(ROOT, '..', 'other', 'fish-cut.png'));

  // 原图质感：平滑缩放 + 轻微锐化
  const body = await sharp(buffer, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
    .extract(box)
    .resize({ height: BODY_H, fit: 'inside', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .png()
    .toBuffer();

  const bodyMeta = await sharp(body).metadata();
  const bodyW = bodyMeta.width;
  const bodyH = bodyMeta.height;

  // 人物左移，让箭头压在它左上角的头发上
  const LEFT_SHIFT = 8;
  const bodyLeft = Math.max(0, CANVAS - bodyW - LEFT_SHIFT);
  const bodyTop = 0;

  async function compose(arrowFill) {
    return sharp({
      create: {
        width: CANVAS,
        height: CANVAS,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([
        { input: body, left: bodyLeft, top: bodyTop },
        { input: await makeArrow(arrowFill), left: 0, top: 0 }
      ])
      .png()
      .toBuffer();
  }

  const normal = await compose('#ffffff');
  const hover = await compose('#ffd166');

  await sharp(normal).toFile(path.join(OUT, 'default.png'));
  await sharp(hover).toFile(path.join(OUT, 'pointer.png'));

  // 文本光标：和人物同一套风格的蓝色 I 形
  const textCursor = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="32" viewBox="0 0 16 32">
  <g fill="none" stroke="#0b1524" stroke-width="4" stroke-linecap="round">
    <path d="M6 4h4M8 4v24M6 28h4"/>
  </g>
  <g fill="none" stroke="#3d8bff" stroke-width="2" stroke-linecap="round">
    <path d="M6 4h4M8 4v24M6 28h4"/>
  </g>
</svg>`;
  await sharp(Buffer.from(textCursor)).png().toFile(path.join(OUT, 'text.png'));

  // 预览：深色底和浅色底各一张
  for (const [name, bg] of [
    ['cursor-preview-fish.png', '#1b1f26'],
    ['cursor-preview-fish-light.png', '#f2f4f7']
  ]) {
    const big = await sharp(normal)
      .resize(CANVAS * 2, CANVAS * 2, { kernel: 'lanczos3' })
      .png()
      .toBuffer();
    await sharp({
      create: { width: CANVAS * 2, height: CANVAS * 2, channels: 4, background: bg }
    })
      .composite([{ input: big, left: 0, top: 0 }])
      .png()
      .toFile(path.join(ROOT, '..', 'other', name));
  }

  console.log(`人物 ${bodyW}x${bodyH}，画布 ${CANVAS}x${CANVAS}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
