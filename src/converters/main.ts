import { Cookie } from "elysia";
import db from "../db/db";
import { MAX_CONVERT_PROCESS } from "../helpers/env";
import { normalizeFiletype, normalizeOutputFiletype } from "../helpers/normalizeFiletype";
import { convert as convertassimp, properties as propertiesassimp } from "./assimp";
import { convert as convertCalibre, properties as propertiesCalibre } from "./calibre";
import { convert as convertDasel, properties as propertiesDasel } from "./dasel";
import { convert as convertDvisvgm, properties as propertiesDvisvgm } from "./dvisvgm";
import { convert as convertFFmpeg, properties as propertiesFFmpeg } from "./ffmpeg";
import {
  convert as convertGraphicsmagick,
  properties as propertiesGraphicsmagick,
} from "./graphicsmagick";
import { convert as convertImagemagick, properties as propertiesImagemagick } from "./imagemagick";
import { convert as convertIcns, properties as propertiesIcns } from "./icns";
import { convert as convertInkscape, properties as propertiesInkscape } from "./inkscape";
import { convert as convertLibheif, properties as propertiesLibheif } from "./libheif";
import { convert as convertLibjxl, properties as propertiesLibjxl } from "./libjxl";
import { convert as convertLibreOffice, properties as propertiesLibreOffice } from "./libreoffice";
import { convert as convertMsgconvert, properties as propertiesMsgconvert } from "./msgconvert";
import { convert as convertPandoc, properties as propertiesPandoc } from "./pandoc";
import { convert as convertPotrace, properties as propertiesPotrace } from "./potrace";
import { convert as convertresvg, properties as propertiesresvg } from "./resvg";
import { convert as convertImage, properties as propertiesImage } from "./vips";
import { convert as convertVtracer, properties as propertiesVtracer } from "./vtracer";
import { convert as convertVcf, properties as propertiesVcf } from "./vcf";
import { convert as convertxelatex, properties as propertiesxelatex } from "./xelatex";
import { convert as convertMarkitdown, properties as propertiesMarkitdown } from "./markitdown";

// This should probably be reconstructed so that the functions are not imported instead the functions hook into this to make the converters more modular

const properties: Record<
  string,
  {
    properties: {
      from: Record<string, string[]>;
      to: Record<string, string[]>;
      options?: Record<
        string,
        Record<
          string,
          {
            description: string;
            type: string;
            default: number;
          }
        >
      >;
    };
    converter: (
      filePath: string,
      fileType: string,
      convertTo: string,
      targetPath: string,

      options?: unknown,
    ) => unknown;
  }
> = {
  // Prioritize Inkscape for EMF files as it handles them better than ImageMagick
  inkscape: {
    properties: propertiesInkscape,
    converter: convertInkscape,
  },
  libjxl: {
    properties: propertiesLibjxl,
    converter: convertLibjxl,
  },
  resvg: {
    properties: propertiesresvg,
    converter: convertresvg,
  },
  vips: {
    properties: propertiesImage,
    converter: convertImage,
  },
  libheif: {
    properties: propertiesLibheif,
    converter: convertLibheif,
  },
  xelatex: {
    properties: propertiesxelatex,
    converter: convertxelatex,
  },
  calibre: {
    properties: propertiesCalibre,
    converter: convertCalibre,
  },
  dasel: {
    properties: propertiesDasel,
    converter: convertDasel,
  },
  libreoffice: {
    properties: propertiesLibreOffice,
    converter: convertLibreOffice,
  },
  pandoc: {
    properties: propertiesPandoc,
    converter: convertPandoc,
  },
  msgconvert: {
    properties: propertiesMsgconvert,
    converter: convertMsgconvert,
  },
  dvisvgm: {
    properties: propertiesDvisvgm,
    converter: convertDvisvgm,
  },
  imagemagick: {
    properties: propertiesImagemagick,
    converter: convertImagemagick,
  },
  icns: {
    properties: propertiesIcns,
    converter: convertIcns,
  },
  graphicsmagick: {
    properties: propertiesGraphicsmagick,
    converter: convertGraphicsmagick,
  },
  assimp: {
    properties: propertiesassimp,
    converter: convertassimp,
  },
  ffmpeg: {
    properties: propertiesFFmpeg,
    converter: convertFFmpeg,
  },
  potrace: {
    properties: propertiesPotrace,
    converter: convertPotrace,
  },
  vtracer: {
    properties: propertiesVtracer,
    converter: convertVtracer,
  },
  vcf: {
    properties: propertiesVcf,
    converter: convertVcf,
  },
  markitDown: {
    properties: propertiesMarkitdown,
    converter: convertMarkitdown,
  },
};

function chunks<T>(arr: T[], size: number): T[][] {
  if (size <= 0) {
    return [arr];
  }
  return Array.from({ length: Math.ceil(arr.length / size) }, (_: T, i: number) =>
    arr.slice(i * size, i * size + size),
  );
}

type BatchImageOptions = {
  batchSizes?: { width: number; height: number }[];
};

type ConvertResult = {
  status: string;
  errorMessage?: string;
};

function getBatchSizes(options: unknown): { width: number; height: number }[] {
  if (typeof options !== "object" || options === null || !("batchSizes" in options)) {
    return [];
  }

  const sizes = (options as BatchImageOptions).batchSizes;
  if (!Array.isArray(sizes)) {
    return [];
  }

  return sizes.filter(
    (size) =>
      Number.isSafeInteger(size.width) &&
      Number.isSafeInteger(size.height) &&
      size.width > 0 &&
      size.height > 0,
  );
}

function withResizeOptions(options: unknown, width: number, height: number): unknown {
  return {
    ...(typeof options === "object" && options !== null ? options : {}),
    resizeWidth: width,
    resizeHeight: height,
  };
}

function getOutputFileName(fileName: string, originalExt: string, newExt: string, suffix = "") {
  if (originalExt === "") {
    return `${fileName}${suffix}.${newExt}`;
  }

  const extensionStart = fileName.lastIndexOf(`.${originalExt}`);
  if (extensionStart === -1) {
    return `${fileName}${suffix}.${newExt}`;
  }

  return `${fileName.slice(0, extensionStart)}${suffix}.${newExt}`;
}

export async function handleConvert(
  fileNames: string[],
  userUploadsDir: string,
  userOutputDir: string,
  convertTo: string,
  converterName: string,
  jobId: Cookie<string | undefined>,
  options: unknown = {},
) {
  const query = db.query(
    "INSERT INTO file_names (job_id, file_name, output_file_name, status, error_message) VALUES (?1, ?2, ?3, ?4, ?5)",
  );
  let failedCount = 0;

  for (const chunk of chunks(fileNames, MAX_CONVERT_PROCESS)) {
    const toProcess: Promise<string>[] = [];
    for (const fileName of chunk) {
      const filePath = `${userUploadsDir}${fileName}`;
      const fileTypeOrig = fileName.includes(".") ? (fileName.split(".").pop() ?? "") : "";
      const fileType = normalizeFiletype(fileTypeOrig);
      const newFileExt = normalizeOutputFiletype(convertTo);
      const batchSizes = converterName === "imagemagick" ? getBatchSizes(options) : [];
      const outputPlans =
        batchSizes.length > 0
          ? batchSizes.map((size) => ({
              fileName: getOutputFileName(
                fileName,
                fileTypeOrig,
                newFileExt,
                `-${size.width}x${size.height}`,
              ),
              options: withResizeOptions(options, size.width, size.height),
            }))
          : [
              {
                fileName: getOutputFileName(fileName, fileTypeOrig, newFileExt),
                options,
              },
            ];

      for (const outputPlan of outputPlans) {
        const targetPath = `${userOutputDir}${outputPlan.fileName}`;
        toProcess.push(
          new Promise((resolve, reject) => {
            mainConverter(
              filePath,
              fileType,
              convertTo,
              targetPath,
              outputPlan.options,
              converterName,
            )
              .then((r) => {
                if (jobId.value) {
                  query.run(
                    jobId.value,
                    fileName,
                    outputPlan.fileName,
                    r.status,
                    r.errorMessage ?? null,
                  );
                }
                if (r.status !== "Done") {
                  failedCount++;
                }
                resolve(r.status);
              })
              .catch((c) => reject(c));
          }),
        );
      }
    }
    await Promise.all(toProcess);
  }

  return { failedCount };
}

async function mainConverter(
  inputFilePath: string,
  fileTypeOriginal: string,
  convertTo: string,
  targetPath: string,
  options?: unknown,
  converterName?: string,
): Promise<ConvertResult> {
  const fileType = normalizeFiletype(fileTypeOriginal);

  let converterFunc: (typeof properties)["libjxl"]["converter"] | undefined;

  if (converterName) {
    converterFunc = properties[converterName]?.converter;
  } else {
    // Iterate over each converter in properties
    for (converterName in properties) {
      const converterObj = properties[converterName];

      if (!converterObj) {
        break;
      }

      for (const key in converterObj.properties.from) {
        if (
          converterObj?.properties?.from[key]?.includes(fileType) &&
          converterObj?.properties?.to[key]?.includes(convertTo)
        ) {
          converterFunc = converterObj.converter;
          break;
        }
      }
    }
  }

  if (!converterFunc) {
    const errorMessage = `No available converter supports converting from ${fileType} to ${convertTo}.`;
    console.log(errorMessage);
    return {
      status: "File type not supported",
      errorMessage,
    };
  }

  try {
    const result = await converterFunc(inputFilePath, fileType, convertTo, targetPath, options);

    console.log(
      `Converted ${inputFilePath} from ${fileType} to ${convertTo} successfully using ${converterName}.`,
      result,
    );

    if (typeof result === "string") {
      return { status: result };
    }

    return { status: "Done" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to convert ${inputFilePath} from ${fileType} to ${convertTo} using ${converterName}.`,
      error,
    );
    return {
      status: "Failed, check logs",
      errorMessage,
    };
  }
}

const possibleTargets: Record<string, Record<string, string[]>> = {};

for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;
  if (!converterProperties) continue;

  for (const key in converterProperties.from) {
    const fromList = converterProperties.from[key];
    const toList = converterProperties.to[key];

    if (!fromList || !toList) continue;

    for (const ext of fromList) {
      if (!possibleTargets[ext]) possibleTargets[ext] = {};

      possibleTargets[ext][converterName] = toList;
    }
  }
}

export const getPossibleTargets = (from: string): Record<string, string[]> => {
  const fromClean = normalizeFiletype(from);

  return possibleTargets[fromClean] || {};
};

const possibleInputs: string[] = [];
for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.from) {
    for (const extension of converterProperties.from[key] ?? []) {
      if (!possibleInputs.includes(extension)) {
        possibleInputs.push(extension);
      }
    }
  }
}
possibleInputs.sort();

const allTargets: Record<string, string[]> = {};

for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.to) {
    if (allTargets[converterName]) {
      allTargets[converterName].push(...(converterProperties.to[key] || []));
    } else {
      allTargets[converterName] = converterProperties.to[key] || [];
    }
  }
}

export const getAllTargets = () => {
  return allTargets;
};

const allInputs: Record<string, string[]> = {};
for (const converterName in properties) {
  const converterProperties = properties[converterName]?.properties;

  if (!converterProperties) {
    continue;
  }

  for (const key in converterProperties.from) {
    if (allInputs[converterName]) {
      allInputs[converterName].push(...(converterProperties.from[key] || []));
    } else {
      allInputs[converterName] = converterProperties.from[key] || [];
    }
  }
}

export const getAllInputs = (converter: string) => {
  return allInputs[converter] || [];
};
