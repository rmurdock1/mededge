import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  let stdoutSpy: MockInstance;
  let stderrSpy: MockInstance;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logger.info writes structured JSON to stdout", () => {
    logger.info("test message", { action: "test" });
    expect(stdoutSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(stdoutSpy.mock.calls[0]![0] as string);
    expect(output.level).toBe("info");
    expect(output.message).toBe("test message");
    expect(output.action).toBe("test");
    expect(output.timestamp).toBeDefined();
  });

  it("logger.error writes to stderr", () => {
    logger.error("something broke", { code: "ERR_001" });
    expect(stderrSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(stderrSpy.mock.calls[0]![0] as string);
    expect(output.level).toBe("error");
    expect(output.message).toBe("something broke");
    expect(output.code).toBe("ERR_001");
  });

  it("logger.warn writes to stdout", () => {
    logger.warn("heads up");
    expect(stdoutSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(stdoutSpy.mock.calls[0]![0] as string);
    expect(output.level).toBe("warn");
  });
});
