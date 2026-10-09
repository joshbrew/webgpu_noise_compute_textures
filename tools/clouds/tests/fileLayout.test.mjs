import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import test from 'node:test';

test('renderer, weather helpers and browser checks resolve their local imports',async()=>{
  const directories=[new URL('../',import.meta.url),new URL('../weather/',import.meta.url),new URL('./browser/',import.meta.url)];
  let checked=0;
  for(const directory of directories){
    for(const name of await readdir(directory)){
      if(!/\.(?:js|mjs)$/.test(name))continue;
      const file=new URL(name,directory),source=await readFile(file,'utf8');
      const imports=source.matchAll(/^import\s+(?:[^;]*?\s+from\s+)?(['"])(\.{1,2}\/[^'"]+)\1\s*;/gm);
      for(const [, ,path] of imports){
        assert.ok((await stat(new URL(path,file))).isFile(),`${name}: ${path}`);
        checked++;
      }
    }
  }
  assert.ok(checked>30,'check the actual renderer and demo import graph');
});
