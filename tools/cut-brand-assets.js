#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
let sharp
try {
  sharp = require('sharp')
} catch (error) {
  console.error('Missing dependency: sharp. Install it in this project or run with NODE_PATH pointing to a node_modules that contains sharp.')
  process.exit(1)
}

const root = path.resolve(__dirname, '..')
const sourceDir = path.join(root, 'brand_sources/logo_ip')
const outputDir = path.join(root, 'miniprogram/assets/brand')

const source = name => path.join(sourceDir, name)
const output = name => path.join(outputDir, name)

async function ensureDir(file) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true })
}

async function resizeImage(input, name, maxSize) {
  const target = output(name)
  await ensureDir(target)
  await sharp(input)
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 92, colors: 128 })
    .toFile(target)
}

function keepMainComponents(data, info, options = {}) {
  const width = info.width
  const height = info.height
  const total = width * height
  const alphaThreshold = options.alphaThreshold || 16
  const edgeMargin = options.edgeMargin || 5
  const minArea = options.minArea || 55
  const visited = new Uint8Array(total)
  const keep = new Uint8Array(total)
  const queueX = new Int32Array(total)
  const queueY = new Int32Array(total)
  const components = []

  function alphaAt(index) {
    return data[index * 4 + 3]
  }

  function scanComponent(startX, startY) {
    let head = 0
    let tail = 0
    let area = 0
    let minX = startX
    let maxX = startX
    let minY = startY
    let maxY = startY
    const startIndex = startY * width + startX
    const pixels = []
    visited[startIndex] = 1
    queueX[tail] = startX
    queueY[tail] = startY
    tail += 1

    while (head < tail) {
      const x = queueX[head]
      const y = queueY[head]
      const pixelIndex = y * width + x
      head += 1
      area += 1
      pixels.push(pixelIndex)
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ]
      for (const [nextX, nextY] of neighbors) {
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue
        const nextIndex = nextY * width + nextX
        if (visited[nextIndex] || alphaAt(nextIndex) <= alphaThreshold) continue
        visited[nextIndex] = 1
        queueX[tail] = nextX
        queueY[tail] = nextY
        tail += 1
      }
    }

    return { area, minX, maxX, minY, maxY, pixels }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (visited[index] || alphaAt(index) <= alphaThreshold) continue
      components.push(scanComponent(x, y))
    }
  }

  components.sort((a, b) => b.area - a.area)
  const largest = components[0]
  const keepComponents = components.filter(component => {
    if (component === largest) return true
    const componentWidth = component.maxX - component.minX + 1
    const componentHeight = component.maxY - component.minY + 1
    const touchesEdge =
      component.minX <= edgeMargin ||
      component.minY <= edgeMargin ||
      component.maxX >= width - 1 - edgeMargin ||
      component.maxY >= height - 1 - edgeMargin

    if (touchesEdge && (componentWidth < 80 || componentHeight < 80 || component.area < 1800)) {
      return false
    }
    return component.area >= minArea
  })

  for (const component of keepComponents) {
    for (const pixelIndex of component.pixels) {
      keep[pixelIndex] = 1
    }
  }

  for (let i = 0; i < total; i += 1) {
    if (!keep[i]) data[i * 4 + 3] = 0
  }
}

async function cropImage(input, name, rect, maxSize, clean = false) {
  const target = output(name)
  await ensureDir(target)
  let image = sharp(input).extract(rect).ensureAlpha()

  if (clean) {
    const raw = await image.raw().toBuffer({ resolveWithObject: true })
    keepMainComponents(raw.data, raw.info)
    image = sharp(raw.data, { raw: raw.info })
  }

  image = image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
  if (maxSize) {
    image = image.resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
  }
  await image.png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 92, colors: 128 }).toFile(target)
}

async function main() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing source directory: ${sourceDir}`)
  }

  await fs.promises.rm(outputDir, { recursive: true, force: true })
  await fs.promises.mkdir(outputDir, { recursive: true })

  await resizeImage(source('30f0c0a8bcd47d914f0cf31f133a32a9.png'), 'logo-ezai.png', 320)
  await cropImage(
    source('556af4c2cc7d45872c1b9e93207be93d.png'),
    'ip/full-body.png',
    { left: 42, top: 70, width: 485, height: 770 },
    420
  )

  const stickerSource = source('a3f8198b64616c0cfbe10e53e0249a6f.png')
  const stickerMeta = await sharp(stickerSource).metadata()
  const stickerCellWidth = Math.floor(stickerMeta.width / 4)
  const stickerCellHeight = Math.floor(stickerMeta.height / 3)
  const stickers = [
    ['welcome', 0, 0],
    ['like', 1, 0],
    ['think', 2, 0],
    ['done', 3, 0],
    ['trouble', 0, 1],
    ['idea', 1, 1],
    ['search', 2, 1],
    ['photo', 3, 1],
    ['draft', 0, 2],
    ['magnify', 1, 2],
    ['notice', 2, 2],
    ['phone', 3, 2]
  ]

  for (const [name, col, row] of stickers) {
    await cropImage(
      stickerSource,
      `stickers/${name}.png`,
      {
        left: col * stickerCellWidth,
        top: row * stickerCellHeight,
        width: Math.min(stickerCellWidth, stickerMeta.width - col * stickerCellWidth),
        height: Math.min(stickerCellHeight, stickerMeta.height - row * stickerCellHeight)
      },
      260,
      true
    )
  }

  const emptySource = source('4e12c03d30e5b510148fa9c2eac4ba97.png')
  const emptyStates = [
    ['note', 0, 0],
    ['message', 1, 0],
    ['question', 0, 1],
    ['box', 1, 1],
    ['timetable', 0, 2],
    ['draft', 1, 2]
  ]

  for (const [name, col, row] of emptyStates) {
    await cropImage(
      emptySource,
      `empty/${name}.png`,
      { left: col * 512, top: row * 512, width: 512, height: 512 },
      300,
      true
    )
  }

  await resizeImage(source('ezai-timetable.png'), 'empty/timetable.png', 340)
  await resizeImage(source('ezai-community.png'), 'empty/community.png', 340)
  await resizeImage(source('ezai-message.png'), 'empty/message.png', 320)
  await resizeImage(source('ezai-done.png'), 'stickers/done.png', 300)
  await resizeImage(source('ezai-knowledge.png'), 'stickers/knowledge.png', 320)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
