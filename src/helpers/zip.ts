import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type ZipEntry = {
  relativePath: string;
  data: Buffer;
  crc32: number;
  offset: number;
};

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c >>> 0;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ (crcTable[(crc ^ byte) & 0xff] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value);
  return buffer;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

async function collectFiles(
  rootDir: string,
  excludePath: string,
  currentDir = rootDir,
): Promise<string[]> {
  const entries = await readdir(currentDir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      files.push(...(await collectFiles(rootDir, excludePath, fullPath)));
      continue;
    }

    if (entryStat.isFile() && path.resolve(fullPath) !== excludePath) {
      files.push(path.relative(rootDir, fullPath).split(path.sep).join("/"));
    }
  }

  return files;
}

function localFileHeader(entry: ZipEntry): Buffer {
  const name = Buffer.from(entry.relativePath);
  const { dosDate, dosTime } = dosDateTime();

  return Buffer.concat([
    uint32(0x04034b50),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(dosTime),
    uint16(dosDate),
    uint32(entry.crc32),
    uint32(entry.data.length),
    uint32(entry.data.length),
    uint16(name.length),
    uint16(0),
    name,
  ]);
}

function centralDirectoryHeader(entry: ZipEntry): Buffer {
  const name = Buffer.from(entry.relativePath);
  const { dosDate, dosTime } = dosDateTime();

  return Buffer.concat([
    uint32(0x02014b50),
    uint16(20),
    uint16(20),
    uint16(0x0800),
    uint16(0),
    uint16(dosTime),
    uint16(dosDate),
    uint32(entry.crc32),
    uint32(entry.data.length),
    uint32(entry.data.length),
    uint16(name.length),
    uint16(0),
    uint16(0),
    uint16(0),
    uint16(0),
    uint32(0),
    uint32(entry.offset),
    name,
  ]);
}

function endOfCentralDirectory(entryCount: number, centralSize: number, centralOffset: number) {
  return Buffer.concat([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entryCount),
    uint16(entryCount),
    uint32(centralSize),
    uint32(centralOffset),
    uint16(0),
  ]);
}

export async function createZipArchive(sourceDir: string, targetPath: string) {
  const relativePaths = await collectFiles(sourceDir, path.resolve(targetPath));
  const entries: ZipEntry[] = [];
  const localParts: Buffer[] = [];
  let offset = 0;

  for (const relativePath of relativePaths) {
    const data = await readFile(path.join(sourceDir, relativePath));
    const entry: ZipEntry = {
      relativePath,
      data,
      crc32: crc32(data),
      offset,
    };
    const header = localFileHeader(entry);
    localParts.push(header, data);
    entries.push(entry);
    offset += header.length + data.length;
  }

  const centralParts = entries.map(centralDirectoryHeader);
  const centralDirectory = Buffer.concat(centralParts);
  const archive = Buffer.concat([
    ...localParts,
    centralDirectory,
    endOfCentralDirectory(entries.length, centralDirectory.length, offset),
  ]);

  await writeFile(targetPath, archive);
}
