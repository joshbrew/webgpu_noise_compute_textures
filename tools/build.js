import { readdir, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { build } from 'esbuild';
import { defaultBundler } from 'tinybuild/tinybuild/esbuild/bundler.js';
import { workerPlugin } from 'tinybuild/tinybuild/esbuild/workerPlugin.js';
import config from '../tinybuild.config.js';

if (process.argv.includes('--serve')) {
  const { serve } = await import('tinybuild/tinybuild/node_server/server.js');
  await serve(config.server);
} else {
  const { entryPoints, outfile, minifyWhitespace, sourcemap, workerBundler } = config.bundler;
  const loader = { ...defaultBundler.loader, ...workerBundler?.loader };
  const outdir = dirname(outfile);
  const { metafile } = await build({
    entryPoints,
    outdir,
    metafile: true,
    entryNames: basename(outfile),
    chunkNames: 'chunks/[name]-[hash]',
    format: 'esm',
    splitting: true,
    bundle: true,
    target: 'es2022',
    loader,
    minifyWhitespace,
    sourcemap,
    plugins: [workerPlugin({
      blobWorkers: false,
      bundler: { ...workerBundler, loader, format: 'iife', minifyWhitespace, target: 'es2022' },
    })],
  });
  const chunks = join(outdir, 'chunks');
  const outputs = new Set(Object.keys(metafile.outputs).map((file) => resolve(file)));
  for (const file of await readdir(chunks)) {
    const path = join(chunks, file);
    if (/-[A-Z0-9]{8}\.js$/.test(file) && !outputs.has(resolve(path))) await unlink(path);
  }
}
