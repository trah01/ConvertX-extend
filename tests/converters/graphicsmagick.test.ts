import { beforeEach, expect, test } from "bun:test";
import type { ExecFileException } from "node:child_process";
import { convert } from "../../src/converters/graphicsmagick";
import { ExecFileFn } from "../../src/converters/types";
import { runCommonTests } from "./helpers/commonTests";

let calls: string[][] = [];

beforeEach(() => {
  calls = [];
});

runCommonTests(convert);

test("convert applies resize options", async () => {
  const mockExecFile: ExecFileFn = (
    _cmd: string,
    _args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    calls.push(_args);
    callback(null, "", "");
  };

  const result = await convert(
    "input.png",
    "png",
    "webp",
    "output.webp",
    { resizeWidth: 800, resizeHeight: 600 },
    mockExecFile,
  );

  expect(result).toBe("Done");
  expect(calls[0]).toEqual(["convert", "input.png", "-resize", "800x600", "output.webp"]);
});

test("convert applies centered crop options", async () => {
  const mockExecFile: ExecFileFn = (
    _cmd: string,
    _args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    calls.push(_args);
    callback(null, "", "");
  };

  const result = await convert(
    "input.png",
    "png",
    "webp",
    "output.webp",
    { cropWidth: 320, cropHeight: 240 },
    mockExecFile,
  );

  expect(result).toBe("Done");
  expect(calls[0]).toEqual([
    "convert",
    "input.png",
    "-gravity",
    "center",
    "-crop",
    "320x240+0+0",
    "+repage",
    "output.webp",
  ]);
});
