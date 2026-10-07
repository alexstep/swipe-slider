import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT || 4173)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const decoded = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    let path = resolve(root, decoded)
    if (url.pathname.endsWith('/')) path = resolve(path, 'index.html')
    const fromRoot = relative(root, path)
    if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    const body = await readFile(path)
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
})

server.listen(port, '127.0.0.1')
