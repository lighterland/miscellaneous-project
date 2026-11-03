async function parent(path: string, create = false) {
  const parts = path.split('/');
  if (parts.some(part => !/^[a-zA-Z0-9_.-]+$/.test(part) || part === '.' || part === '..')) throw new Error('Invalid storage path');
  if (!navigator.storage?.getDirectory) throw new Error('OPFS unavailable');
  let directory = await navigator.storage.getDirectory();
  for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create });
  return { directory, name: parts.at(-1)! };
}
export async function writeLocalFile(path: string, blob: Blob): Promise<void> {
  const { directory, name } = await parent(path, true);
  const file = await directory.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  try { await writable.write(blob); await writable.close(); }
  catch (error) { await writable.abort().catch(() => undefined); throw error; }
}
export async function readLocalFile(path: string): Promise<File> {
  const { directory, name } = await parent(path);
  return (await directory.getFileHandle(name)).getFile();
}
export async function removeLocalFile(path: string): Promise<void> {
  const { directory, name } = await parent(path);
  await directory.removeEntry(name);
}
export async function listPhotoFiles(): Promise<string[]> {
  const root = await navigator.storage.getDirectory(), files: string[] = [];
  async function walk(directory: FileSystemDirectoryHandle, prefix: string) {
    for await (const [name, handle] of (directory as FileSystemDirectoryHandle & { entries(): AsyncIterableIterator<[string, FileSystemHandle]> }).entries()) {
      if (handle.kind === 'directory') await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`);
      else files.push(prefix + name);
    }
  }
  for (const name of ['sessions', 'thumbs']) {
    try { await walk(await root.getDirectoryHandle(name), `${name}/`); }
    catch (error) { if (!(error instanceof DOMException && error.name === 'NotFoundError')) throw error; }
  }
  return files;
}
