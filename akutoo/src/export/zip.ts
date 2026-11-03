import { strToU8, zipSync } from 'fflate';
export function sessionFolder(id: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid session identifier');
  return `akutoo-${id}`;
}
export function createTrialZip(session: { id: string; createdAt: number; label: string }): Uint8Array {
  const folder = sessionFolder(session.id);
  return zipSync({
    [`${folder}/metadata.json`]: strToU8(JSON.stringify({ schemaVersion: 1, trial: true, session, images: [] }, null, 2)),
    [`${folder}/README.txt`]: strToU8('Akutoo local export trial. No photos are included.\n'),
  });
}
