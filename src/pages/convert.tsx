import { mkdir } from "node:fs/promises";
import { Elysia, t } from "elysia";
import sanitize from "sanitize-filename";
import { outputDir, uploadsDir } from "..";
import { converterSupportsBatchImageOutputs, handleConvert } from "../converters/main";
import db from "../db/db";
import { Jobs } from "../db/types";
import { WEBROOT } from "../helpers/env";
import { normalizeFiletype } from "../helpers/normalizeFiletype";
import { userService } from "./user";

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100000) {
    return undefined;
  }

  return parsed;
}

function parseNonNegativeInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 100000) {
    return undefined;
  }

  return parsed;
}

function parseBatchSizes(value: string | undefined): { width: number; height: number }[] {
  if (!value) {
    return [];
  }

  const sizes: { width: number; height: number }[] = [];
  const seen = new Set<string>();

  for (const part of value.split(/[\s,;]+/)) {
    const clean = part.trim().toLowerCase();
    if (!clean) {
      continue;
    }

    const match = clean.match(/^(\d+)(?:x(\d+))?$/);
    if (!match) {
      continue;
    }

    const width = Number.parseInt(match[1] ?? "", 10);
    const height = Number.parseInt(match[2] ?? match[1] ?? "", 10);
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 100000 ||
      height > 100000
    ) {
      continue;
    }

    const key = `${width}x${height}`;
    if (!seen.has(key)) {
      seen.add(key);
      sizes.push({ width, height });
    }
  }

  return sizes.slice(0, 100);
}

export const convert = new Elysia().use(userService).post(
  "/convert",
  async ({ body, redirect, jwt, cookie: { auth, jobId } }) => {
    if (!auth?.value) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    const user = await jwt.verify(auth.value);
    if (!user) {
      return redirect(`${WEBROOT}/login`, 302);
    }

    if (!jobId?.value) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const existingJob = db
      .query("SELECT * FROM jobs WHERE id = ? AND user_id = ?")
      .as(Jobs)
      .get(jobId.value, user.id);

    if (!existingJob) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const userUploadsDir = `${uploadsDir}${user.id}/${jobId.value}/`;
    const userOutputDir = `${outputDir}${user.id}/${jobId.value}/`;

    // create the output directory
    try {
      await mkdir(userOutputDir, { recursive: true });
    } catch (error) {
      console.error(`Failed to create the output directory: ${userOutputDir}.`, error);
    }

    const convertTo = normalizeFiletype(body.convert_to.split(",")[0] ?? "");
    const converterName = body.convert_to.split(",")[1];

    if (
      !converterName ||
      convertTo.includes("/") ||
      convertTo.includes("\\") ||
      convertTo.includes("..")
    ) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const fileNames = JSON.parse(body.file_names) as string[];
    const imageOptions = {
      resizeWidth: parsePositiveInteger(body.resize_width),
      resizeHeight: parsePositiveInteger(body.resize_height),
      cropWidth: parsePositiveInteger(body.crop_width),
      cropHeight: parsePositiveInteger(body.crop_height),
      cropX: parseNonNegativeInteger(body.crop_x),
      cropY: parseNonNegativeInteger(body.crop_y),
      batchSizes: parseBatchSizes(body.batch_sizes),
    };

    for (let i = 0; i < fileNames.length; i++) {
      fileNames[i] = sanitize(fileNames[i] || "");
    }

    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return redirect(`${WEBROOT}/`, 302);
    }

    const outputCount =
      converterSupportsBatchImageOutputs(converterName) && imageOptions.batchSizes.length > 0
        ? fileNames.length * imageOptions.batchSizes.length
        : fileNames.length;

    db.query("UPDATE jobs SET num_files = ?1, status = 'pending' WHERE id = ?2").run(
      outputCount,
      jobId.value,
    );

    // Start the conversion process in the background
    handleConvert(
      fileNames,
      userUploadsDir,
      userOutputDir,
      convertTo,
      converterName,
      jobId,
      imageOptions,
    )
      .then(({ failedCount }) => {
        // All conversions are done, update the job status to 'completed'
        if (jobId.value) {
          db.query("UPDATE jobs SET status = ?1 WHERE id = ?2").run(
            failedCount > 0 ? "failed" : "completed",
            jobId.value,
          );
        }

        // Delete all uploaded files in userUploadsDir
        // rmSync(userUploadsDir, { recursive: true, force: true });
      })
      .catch((error) => {
        console.error("Error in conversion process:", error);
      });

    // Redirect the client immediately
    return redirect(`${WEBROOT}/results/${jobId.value}`, 302);
  },
  {
    body: t.Object({
      convert_to: t.String(),
      file_names: t.String(),
      resize_width: t.Optional(t.String()),
      resize_height: t.Optional(t.String()),
      crop_width: t.Optional(t.String()),
      crop_height: t.Optional(t.String()),
      crop_x: t.Optional(t.String()),
      crop_y: t.Optional(t.String()),
      batch_sizes: t.Optional(t.String()),
    }),
    auth: true,
  },
);
