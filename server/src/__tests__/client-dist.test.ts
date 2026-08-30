import fs from 'fs';
import os from 'os';
import path from 'path';
import { getClientDistCandidates, resolveClientDist } from '../clientDist';

describe('client dist resolution', () => {
  test('selects the first candidate that contains index.html', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftsync-client-dist-'));
    const dirname = path.join(root, 'server', 'dist');
    const cwd = path.join(root, 'server');
    const firstCandidate = path.resolve(dirname, '../../client/dist');
    const secondCandidate = path.resolve(cwd, 'client/dist');

    fs.mkdirSync(path.join(firstCandidate), { recursive: true });
    fs.mkdirSync(path.join(secondCandidate), { recursive: true });
    fs.writeFileSync(path.join(firstCandidate, 'index.html'), '<!doctype html><html></html>');
    fs.writeFileSync(path.join(secondCandidate, 'index.html'), '<!doctype html><html></html>');

    expect(resolveClientDist({ dirname, cwd })).toBe(firstCandidate);
  });

  test('throws a clear error with all checked paths when no build exists', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shiftsync-client-dist-missing-'));
    const dirname = path.join(root, 'server', 'dist');
    const cwd = path.join(root, 'server');
    const candidates = getClientDistCandidates({ dirname, cwd });

    try {
      resolveClientDist({ dirname, cwd });
      throw new Error('Expected resolveClientDist to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Unable to locate the built frontend.');
      for (const candidate of candidates) {
        expect((error as Error).message).toContain(candidate);
      }
    }
  });
});