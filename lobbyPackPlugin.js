import { createReadStream, existsSync, readdirSync } from 'node:fs'
import { cp, stat } from 'node:fs/promises'
import path from 'node:path'

export function lobbyPack(packRoot) {
  const manifest = '\0virtual:lobby-prefabs'
  const contentTypes = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' }

  return {
    name: 'lobby-pack',
    configResolved() {
      if (!existsSync(path.join(packRoot, 'list.json'))) {
        throw new Error(`Lobby pack not found at ${packRoot}. Set LOBBY_PACK_DIR to the exported pack directory.`)
      }
    },
    resolveId(id) {
      if (id === 'virtual:lobby-prefabs') return manifest
    },
    load(id) {
      if (id !== manifest) return
      const prefabs = readdirSync(path.join(packRoot, 'prefab'), { withFileTypes: true })
        .filter(entry => entry.isDirectory() && existsSync(path.join(packRoot, 'prefab', entry.name, 'resource.js')))
        .map(entry => entry.name)
      return `export default ${JSON.stringify(prefabs)}`
    },
    configureServer(server) {
      server.middlewares.use('/pack', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        try {
          const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
          const file = path.resolve(packRoot, '.' + pathname)
          const relative = path.relative(packRoot, file)
          if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
            res.writeHead(404).end()
            return
          }
          const info = await stat(file)
          if (!info.isFile()) {
            res.writeHead(404).end()
            return
          }
          res.setHeader('Content-Type', contentTypes[path.extname(file)] ?? 'application/octet-stream')
          res.setHeader('Content-Length', info.size)
          if (req.method === 'HEAD') res.end()
          else {
            const stream = createReadStream(file)
            stream.on('error', () => res.destroy())
            res.on('close', () => stream.destroy())
            stream.pipe(res)
          }
        } catch (error) {
          if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error instanceof URIError) {
            res.writeHead(404).end()
          } else next(error)
        }
      })
    },
    async writeBundle(options) {
      await cp(packRoot, path.join(options.dir, 'pack'), { recursive: true })
    },
  }
}
