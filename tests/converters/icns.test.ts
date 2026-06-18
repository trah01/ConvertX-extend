import { beforeEach, expect, test } from "bun:test";
import type { ExecFileException } from "node:child_process";
import { convert } from "../../src/converters/icns";
import { ExecFileFn } from "../../src/converters/types";

let calls: { cmd: string; args: string[] }[] = [];

beforeEach(() => {
  calls = [];
});

test("convert uses custom batch sizes for icns source images", async () => {
  const mockExecFile: ExecFileFn = (
    cmd: string,
    args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    calls.push({ cmd, args });
    callback(null, "", "");
  };

  const result = await convert(
    "input.png",
    "png",
    "icns",
    "output.icns",
    { batchSizes: [{ width: 128, height: 128 }] },
    mockExecFile,
  );

  expect(result).toBe("Done");
  expect(calls[0]?.cmd).toBe("magick");
  expect(calls[0]?.args).toEqual(
    expect.arrayContaining(["input.png", "-resize", "128x128", "-extent", "128x128"]),
  );
  expect(calls[1]?.cmd).toBe("png2icns");
  expect(calls[1]?.args[0]).toBe("output.icns");
});

test("convert uses resize dimensions as an icns size when no batch size is set", async () => {
  const mockExecFile: ExecFileFn = (
    cmd: string,
    args: string[],
    callback: (err: ExecFileException | null, stdout: string, stderr: string) => void,
  ) => {
    calls.push({ cmd, args });
    callback(null, "", "");
  };

  const result = await convert(
    "input.png",
    "png",
    "icns",
    "output.icns",
    { resizeWidth: 256, resizeHeight: 256 },
    mockExecFile,
  );

  expect(result).toBe("Done");
  expect(calls[0]?.args).toEqual(
    expect.arrayContaining(["input.png", "-resize", "256x256", "-extent", "256x256"]),
  );
});
