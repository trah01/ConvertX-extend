import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile as execFileOriginal } from "node:child_process";
import { ExecFileFn } from "./types";

type IconSize = {
  width: number;
  height: number;
};

type IcnsOptions = {
  batchSizes?: IconSize[];
};

const defaultIconSizes: IconSize[] = [
  { width: 16, height: 16 },
  { width: 32, height: 32 },
  { width: 64, height: 64 },
  { width: 128, height: 128 },
  { width: 256, height: 256 },
  { width: 512, height: 512 },
  { width: 1024, height: 1024 },
];

export const properties = {
  from: {
    images: [
      "avif",
      "bmp",
      "gif",
      "heic",
      "heif",
      "jpeg",
      "jpg",
      "jxl",
      "png",
      "svg",
      "tif",
      "tiff",
      "webp",
    ],
  },
  to: {
    images: ["icns"],
  },
};

function getIconSizes(options: unknown): IconSize[] {
  if (typeof options !== "object" || options === null || !("batchSizes" in options)) {
    return defaultIconSizes;
  }

  const sizes = (options as IcnsOptions).batchSizes;
  if (!Array.isArray(sizes) || sizes.length === 0) {
    return defaultIconSizes;
  }

  return sizes.filter(
    (size) =>
      Number.isSafeInteger(size.width) &&
      Number.isSafeInteger(size.height) &&
      size.width > 0 &&
      size.height > 0 &&
      size.width <= 1024 &&
      size.height <= 1024,
  );
}

function execFilePromise(execFile: ExecFileFn, cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) {
        reject(`error: ${error}`);
      }

      if (stdout) {
        console.log(`stdout: ${stdout}`);
      }

      if (stderr) {
        console.error(`stderr: ${stderr}`);
      }

      resolve();
    });
  });
}

export async function convert(
  filePath: string,
  fileType: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  execFile: ExecFileFn = execFileOriginal,
): Promise<string> {
  if (convertTo !== "icns") {
    return "File type not supported";
  }

  const workDir = await mkdtemp(join(tmpdir(), "convertx-icns-"));
  const pngPaths: string[] = [];

  try {
    for (const size of getIconSizes(options)) {
      const pngPath = join(workDir, `icon-${size.width}x${size.height}.png`);
      await execFilePromise(execFile, "magick", [
        filePath,
        "-background",
        "none",
        "-resize",
        `${size.width}x${size.height}`,
        "-gravity",
        "center",
        "-extent",
        `${size.width}x${size.height}`,
        pngPath,
      ]);
      pngPaths.push(pngPath);
    }

    await execFilePromise(execFile, "png2icns", [targetPath, ...pngPaths]);

    return "Done";
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
