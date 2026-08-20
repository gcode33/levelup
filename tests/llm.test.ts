import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJsonFromLLM, completeChat } from "../src/lib/llm";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseJsonFromLLM", () => {
  it("parses plain JSON", () => {
    expect(parseJsonFromLLM('{"a": 1}')).toEqual({ a: 1 });
  });

  it("strips ```json fences", () => {
    expect(parseJsonFromLLM('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("strips fences without a language tag", () => {
    expect(parseJsonFromLLM('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("trims surrounding whitespace", () => {
    expect(parseJsonFromLLM(' \n\n {"a": 1} \n ')).toEqual({ a: 1 });
  });

  it("throws on an empty string", () => {
    expect(() => parseJsonFromLLM("")).toThrow();
  });

  it("throws on non-JSON prose", () => {
    expect(() => parseJsonFromLLM("just some prose")).toThrow();
  });

  it("throws on truncated JSON", () => {
    expect(() => parseJsonFromLLM('{"a": ')).toThrow();
  });

  it("extracts JSON wrapped in prose", () => {
    expect(parseJsonFromLLM('Sure! Here is the JSON: {"a": 1}')).toEqual({ a: 1 });
  });

  it("strips uppercase ```JSON fences", () => {
    expect(parseJsonFromLLM('```JSON\n{"a": 1}\n```')).toEqual({ a: 1 });
  });
});

describe("completeChat", () => {
  it("returns the message content and calls the endpoint correctly", async () => {
    process.env.LLM_BASE_URL = "https://api.test";
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "test-model";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "hello" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await completeChat("hi", { maxTokens: 100, temperature: 0.5 });

    expect(result).toBe("hello");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("test-model");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.5);
  });

  it("throws on a non-200 response", async () => {
    process.env.LLM_BASE_URL = "https://api.test";
    process.env.LLM_API_KEY = "key";
    process.env.LLM_MODEL = "model";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(completeChat("hi")).rejects.toThrow("500");
  });

  it("defaults max_tokens to 4000 and temperature to 0", async () => {
    process.env.LLM_BASE_URL = "https://api.test";
    process.env.LLM_API_KEY = "key";
    process.env.LLM_MODEL = "model";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await completeChat("hi");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(4000);
    expect(body.temperature).toBe(0);
  });
});
