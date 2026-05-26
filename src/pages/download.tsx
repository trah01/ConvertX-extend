import path from "node:path";
import { Elysia } from "elysia";
import sanitize from "sanitize-filename";
import { outputDir } from "..";
import db from "../db/db";
import { WEBROOT } from "../helpers/env";
import { createZipArchive } from "../helpers/zip";
import { userService } from "./user";

export const download = new Elysia()
  .use(userService)
  .get(
    "/download/:userId/:jobId/:fileName",
    async ({ params, redirect, user }) => {
      const userId = user.id;
      const job = await db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .get(user.id, params.jobId);

      if (!job) {
        return redirect(`${WEBROOT}/results`, 302);
      }
      // parse from URL encoded string
      const jobId = decodeURIComponent(params.jobId);
      const fileName = sanitize(decodeURIComponent(params.fileName));

      const filePath = `${outputDir}${userId}/${jobId}/${fileName}`;
      return Bun.file(filePath);
    },
    {
      auth: true,
    },
  )
  .get(
    "/archive/:jobId",
    async ({ params, redirect, user }) => {
      const userId = user.id;
      const job = await db
        .query("SELECT * FROM jobs WHERE user_id = ? AND id = ?")
        .get(user.id, params.jobId);

      if (!job) {
        return redirect(`${WEBROOT}/results`, 302);
      }

      const jobId = decodeURIComponent(params.jobId);
      const outputPath = `${outputDir}${userId}/${jobId}`;
      const outputZip = path.join(outputPath, `converted_files_${jobId}.zip`);

      await createZipArchive(outputPath, outputZip);
      return Bun.file(outputZip);
    },
    {
      auth: true,
    },
  );
