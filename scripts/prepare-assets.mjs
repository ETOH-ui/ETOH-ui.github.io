/**
 * 素材处理：原图 → webp，压缩动图，生成 favicon
 * 只在换图时手动跑一次：node scripts/prepare-assets.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = {
  avatar: 'D:/my_picture/desktopphoto/蓝色大肥鱼/铁盆未必有我忧郁.jpg',
  cover: 'D:/my_picture/desktopphoto/【哲风壁纸】jk制服-二次元少女.jpg',
  rain: 'D:/my_picture/desktopphoto/0fc8244bfc1308005f59ce2cd23f4856.jpg',
  fish: 'D:/my_picture/desktopphoto/蓝色大肥鱼/大肥鱼旋转.gif'
};

const OUT = {
  imgDir: path.join(ROOT, 'public', 'images'),
  postDir: path.join(ROOT, 'src', 'posts', '2024', '01', 'hello-world')
};

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function size(file) {
  const s = await fs.stat(file);
  return s.size;
}

async function main() {
  await fs.mkdir(OUT.imgDir, { recursive: true });
  await fs.mkdir(OUT.postDir, { recursive: true });

  // 头像：正方形，带一点锐化
  const avatarOut = path.join(OUT.imgDir, 'avatar.webp');
  await sharp(SRC.avatar)
    .resize(400, 400, { fit: 'cover', position: 'attention' })
    .webp({ quality: 86, effort: 5 })
    .toFile(avatarOut);
  console.log(`头像   ${kb(await size(SRC.avatar))} → ${kb(await size(avatarOut))}`);

  // banner：保留原宽，压一压
  const bannerOut = path.join(OUT.imgDir, 'banner.webp');
  await sharp(SRC.rain)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80, effort: 5 })
    .toFile(bannerOut);
  console.log(`banner ${kb(await size(SRC.rain))} → ${kb(await size(bannerOut))}`);

  // 卡片封面
  const coverOut = path.join(OUT.postDir, 'cover.webp');
  await sharp(SRC.cover)
    .resize({ width: 1000, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(coverOut);
  console.log(`封面   ${kb(await size(SRC.cover))} → ${kb(await size(coverOut))}`);

  // 正文图：雨夜
  const rainOut = path.join(OUT.postDir, 'rain.webp');
  await sharp(SRC.rain)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(rainOut);
  console.log(`正文图 ${kb(await size(SRC.rain))} → ${kb(await size(rainOut))}`);

  // 动图：gif → 动图 webp
  const meta = await sharp(SRC.fish, { animated: true }).metadata();
  console.log(
    `动图源 ${meta.width}x${meta.height}，${meta.pages} 帧，${kb(await size(SRC.fish))}`
  );

  const fishOut = path.join(OUT.postDir, 'fish.webp');
  await sharp(SRC.fish, { animated: true })
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 62, effort: 4, loop: 0 })
    .toFile(fishOut);
  console.log(`动图   → ${kb(await size(fishOut))}`);

  // favicon：头像圆形裁剪
  const faviconPng = path.join(OUT.imgDir, 'favicon.png');
  const roundMask = Buffer.from(
    `<svg width="256" height="256"><circle cx="128" cy="128" r="128" fill="#fff"/></svg>`
  );
  await sharp(SRC.avatar)
    .resize(256, 256, { fit: 'cover', position: 'attention' })
    .composite([{ input: roundMask, blend: 'dest-in' }])
    .png()
    .toFile(faviconPng);

  // ico 只是给老浏览器看的，用 64x64 png 顶着
  await sharp(faviconPng).resize(64, 64).png().toFile(path.join(OUT.imgDir, 'favicon.ico'));

  // 苹果图标
  await sharp(faviconPng)
    .resize(180, 180)
    .flatten({ background: '#1b1f26' })
    .png()
    .toFile(path.join(OUT.imgDir, 'apple-touch-icon.png'));

  console.log(`图标   favicon.png / favicon.ico / apple-touch-icon.png`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
