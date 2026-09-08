import { cp, mkdir, writeFile } from 'node:fs/promises'
import { COLLECTIONS } from '../src/content/model.js'
await mkdir('dist', {recursive:true})
await cp('hosting', 'dist', {recursive:true})
await writeFile('dist/collections.json', JSON.stringify(Object.fromEntries(Object.entries(COLLECTIONS).map(([id,c])=>[id,{maxItems:c.maxItems,fields:c.fields}]))))
console.log('PHP deployment files added to dist (no production credentials).')
