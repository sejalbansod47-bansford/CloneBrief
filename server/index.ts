import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { createHandler } from './handler.ts'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const port = Number(process.env.PORT || 3000)
createServer(createHandler(root)).listen(port, '0.0.0.0', () => console.log(`CloneBrief listening on ${port}; serving ${resolve(root)}`))
