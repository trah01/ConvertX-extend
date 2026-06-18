export type ImageSizeOptions = {
  resizeWidth?: number;
  resizeHeight?: number;
  cropWidth?: number;
  cropHeight?: number;
  cropX?: number;
  cropY?: number;
};

export function isImageSizeOptions(options: unknown): options is ImageSizeOptions {
  return typeof options === "object" && options !== null;
}

function getDimension(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 100000
    ? value
    : undefined;
}

function getOffset(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100000
    ? value
    : undefined;
}

export function buildImageSizeArgs(options: unknown): string[] {
  if (!isImageSizeOptions(options)) {
    return [];
  }

  const resizeWidth = getDimension(options.resizeWidth);
  const resizeHeight = getDimension(options.resizeHeight);
  const cropWidth = getDimension(options.cropWidth);
  const cropHeight = getDimension(options.cropHeight);
  const cropX = getOffset(options.cropX);
  const cropY = getOffset(options.cropY);
  const args: string[] = [];

  if (resizeWidth || resizeHeight) {
    args.push("-resize", `${resizeWidth ?? ""}x${resizeHeight ?? ""}`);
  }

  if (cropWidth && cropHeight) {
    if (cropX !== undefined || cropY !== undefined) {
      args.push("-crop", `${cropWidth}x${cropHeight}+${cropX ?? 0}+${cropY ?? 0}`, "+repage");
    } else {
      args.push("-gravity", "center", "-crop", `${cropWidth}x${cropHeight}+0+0`, "+repage");
    }
  }

  return args;
}
