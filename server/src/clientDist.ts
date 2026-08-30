import fs from 'fs';
import path from 'path';

type ClientDistOptions = {
  cwd?: string;
  dirname?: string;
};

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

export function getClientDistCandidates(options: ClientDistOptions = {}): string[] {
  const cwd = options.cwd ?? process.cwd();
  const dirname = options.dirname ?? __dirname;

  return uniquePaths([
    path.resolve(dirname, '../../client/dist'),
    path.resolve(dirname, '../client/dist'),
    path.resolve(cwd, 'client/dist'),
    path.resolve(cwd, '../client/dist'),
  ]);
}

export function resolveClientDist(options: ClientDistOptions = {}): string {
  const candidates = getClientDistCandidates(options);

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  throw new Error(
    [
      'Unable to locate the built frontend. Checked these paths:',
      ...candidates.map((candidate) => `- ${candidate}`),
    ].join('\n')
  );
}