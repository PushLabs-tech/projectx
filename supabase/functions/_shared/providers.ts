export type ProviderId =
  | "bytez"
  | "nvidia"
  | "openrouter"
  | "openai"
  | "google"
  | "anthropic"
  | "generic"
  | "auto";

export type Credential = {
  provider: ProviderId;
  label?: string;
  apiKey: string;
  providerKey?: string;
  baseUrl?: string;
};

type ProviderConfig = {
  label: string;
  baseUrl: string;
  kind: "bytez" | "openai" | "anthropic";
};

const PROVIDERS: Record<Exclude<ProviderId, "auto">, ProviderConfig> = {
  bytez: {
    label: "Bytez",
    baseUrl: "https://api.bytez.com",
    kind: "bytez"
  },
  nvidia: {
    label: "NVIDIA NIM",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    kind: "openai"
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    kind: "openai"
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    kind: "openai"
  },
  google: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    kind: "openai"
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    kind: "anthropic"
  },
  generic: {
    label: "OpenAI-compatible",
    baseUrl: "",
    kind: "openai"
  }
};

export function detectProvider(
  apiKey: string,
  baseUrl = ""
): Exclude<ProviderId, "auto"> {
  const key = apiKey.trim().toLowerCase();
  const url = baseUrl.trim().toLowerCase();

  if (/^AIza/.test(apiKey.trim())) return "google";
  if (key.startsWith("nvapi-")) return "nvidia";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";

  if (url.includes("bytz") || url.includes("bytez")) {
    return "bytez";
  }

  if (url.includes("openrouter")) {
    return "openrouter";
  }

  if (url.includes("integrate.api.nvidia.com")) {
    return "nvidia";
  }

  if (url.includes("api.openai.com")) {
    return "openai";
  }

  if (url.includes("generativelanguage.googleapis.com")) {
    return "google";
  }

  if (url.includes("api.anthropic.com")) {
    return "anthropic";
  }

  return url ? "generic" : "openai";
}

export function providerInfo(id: ProviderId) {
  if (id === "auto") {
    throw new Error("Auto is resolved before provider calls");
  }

  const provider = PROVIDERS[id];

  if (!provider) {
    throw new Error(`Unsupported provider: ${id}`);
  }

  return provider;
}

async function readJson(response: Response) {
  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");

    const message =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      data?.detail ||
      text ||
      "Provider request failed";

    const suffix = retryAfter
      ? `; Retry-After: ${retryAfter}`
      : "";

    throw new Error(
      `${response.status}: ${message}${suffix}`
    );
  }

  return data;
}

function modelIsNonChat(
  id: string,
  task = ""
) {
  const value =
    `${id} ${task}`.toLowerCase();

  return /image|tts|text-to-speech|audio|speech|embedding|embed|transcri|video|music|moderation|rerank|whisper/.test(
    value
  );
}

function normalizeOpenAIModels(
  data: any,
  provider: string
) {
  const source =
    Array.isArray(data?.data)
      ? data.data
      : [];

  return source
    .map((model: any) => {
      const rawId =
        String(model?.id || "");

      const id = rawId
        .replace(/^models\//i, "")
        .trim();

      const rawTask =
        String(model?.task || "")
          .trim()
          .toLowerCase();

      if (
        !id ||
        modelIsNonChat(id, rawTask)
      ) {
        return null;
      }

      return {
        id,
        name: String(
          model?.name ||
          model?.display_name ||
          id
        ),
        provider,
        task: "chat",
        modality: "text",
        contextLength:
          Number(
            model?.context_length ||
            model?.context_window ||
            model?.contextWindow ||
            0
          ) || null
      };
    })
    .filter(Boolean);
}

export async function listModels(
  credential: Credential,
  task = "chat"
) {
  const provider =
    credential.provider === "auto"
      ? detectProvider(
          credential.apiKey,
          credential.baseUrl
        )
      : credential.provider;

  const info =
    providerInfo(provider);

  if (provider === "bytez") {
    const url =
      `${info.baseUrl}/models/v2/list/models?task=${encodeURIComponent(task)}`;

    const response =
      await fetch(url, {
        headers: {
          Authorization:
            credential.apiKey
        },
        signal:
          AbortSignal.timeout(20_000)
      });

    const data =
      await readJson(response);

    return (
      Array.isArray(data?.output)
        ? data.output
        : []
    )
      .map((model: any) => {
        const id =
          String(
            model?.modelId || ""
          ).trim();

        const modelTask =
          String(
            model?.task || task
          ).toLowerCase();

        if (
          !id ||
          modelIsNonChat(
            id,
            modelTask
          )
        ) {
          return null;
        }

        return {
          id,
          name: id,
          provider: "bytez",
          task: "chat",
          params:
            Number(
              model?.params || 0
            ) || null,
          ramRequired:
            Number(
              model?.ramRequired || 0
            ) || null,
          meter:
            model?.meter || null
        };
      })
      .filter(Boolean);
  }

  if (provider === "anthropic") {
    const response =
      await fetch(
        `${info.baseUrl}/models`,
        {
          headers: {
            "x-api-key":
              credential.apiKey,
            "anthropic-version":
              "2023-06-01"
          },
          signal:
            AbortSignal.timeout(
              20_000
            )
        }
      );

    const data =
      await readJson(response);

    return (
      Array.isArray(data?.data)
        ? data.data
        : []
    )
      .map((model: any) => {
        const id =
          String(
            model?.id || ""
          ).trim();

        if (!id) {
          return null;
        }

        return {
          id,
          name: String(
            model?.display_name ||
            id
          ),
          provider: "anthropic",
          task: "chat",
          modality: "text",
          contextLength:
            Number(
              model?.context_window ||
              0
            ) || null
        };
      })
      .filter(Boolean);
  }

  const base = (
    credential.baseUrl ||
    info.baseUrl
  ).replace(/\/$/, "");

  if (!base) {
    throw new Error(
      "Generic OpenAI-compatible provider requires a base URL"
    );
  }

  const headers:
    Record<string, string> = {
    Authorization:
      `Bearer ${credential.apiKey}`,
    Accept:
      "application/json"
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] =
      "https://builder.local";

    headers["X-Title"] =
      "Builder";
  }

  const response =
    await fetch(
      `${base}/models`,
      {
        headers,
        signal:
          AbortSignal.timeout(
            20_000
          )
      }
    );

  return normalizeOpenAIModels(
    await readJson(response),
    provider
  );
}

export async function chat(
  credential: Credential,
  model: string,
  messages: any[],
  options: {
    temperature?: number;
    maxTokens?: number;
    providerKey?: string;
  } = {}
) {
  const provider =
    credential.provider === "auto"
      ? detectProvider(
          credential.apiKey,
          credential.baseUrl
        )
      : credential.provider;

  const info =
    providerInfo(provider);

  const maxTokens =
    Math.max(
      64,
      Math.min(
        8192,
        Number(
          options.maxTokens ?? 1400
        )
      )
    );

  const temperature =
    Math.max(
      0,
      Math.min(
        1.5,
        Number(
          options.temperature ?? 0.4
        )
      )
    );

  if (provider === "bytez") {
    const headers:
      Record<string, string> = {
      Authorization:
        credential.apiKey,
      "Content-Type":
        "application/json"
    };

    if (options.providerKey) {
      headers["provider-key"] =
        options.providerKey;
    }

    const response =
      await fetch(
        `${info.baseUrl}/models/v2/${encodeURIComponent(model)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages,
            stream: false,
            params: {
              temperature,
              max_new_tokens:
                maxTokens
            }
          }),
          signal:
            AbortSignal.timeout(
              60_000
            )
        }
      );

    const data =
      await readJson(response);

    return {
      text:
        typeof data?.output ===
        "string"
          ? data.output
          : data?.output?.content ||
            data?.response ||
            "",
      usage:
        data?.usage || null
    };
  }

  if (provider === "anthropic") {
    const system =
      messages
        .filter(
          (message) =>
            message?.role ===
            "system"
        )
        .map(
          (message) =>
            String(
              message?.content ||
              ""
            )
        )
        .join("\n\n");

    const body = {
      model,
      max_tokens:
        maxTokens,
      temperature,
      ...(system
        ? { system }
        : {}),
      messages:
        messages
          .filter(
            (message) =>
              message?.role !==
              "system"
          )
          .map(
            (message) => ({
              role:
                message?.role ===
                "assistant"
                  ? "assistant"
                  : "user",
              content: String(
                message?.content ||
                ""
              )
            })
          )
    };

    const response =
      await fetch(
        `${info.baseUrl}/messages`,
        {
          method: "POST",
          headers: {
            "x-api-key":
              credential.apiKey,
            "anthropic-version":
              "2023-06-01",
            "content-type":
              "application/json"
          },
          body:
            JSON.stringify(body),
          signal:
            AbortSignal.timeout(
              60_000
            )
        }
      );

    const data =
      await readJson(response);

    return {
      text:
        (data?.content || [])
          .map(
            (item: any) =>
              item?.text || ""
          )
          .join(""),
      usage:
        data?.usage || null
    };
  }

  const base = (
    credential.baseUrl ||
    info.baseUrl
  ).replace(/\/$/, "");

  if (!base) {
    throw new Error(
      "Generic OpenAI-compatible provider requires a base URL"
    );
  }

  const headers:
    Record<string, string> = {
    Authorization:
      `Bearer ${credential.apiKey}`,
    "Content-Type":
      "application/json",
    Accept:
      "application/json"
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] =
      "https://builder.local";

    headers["X-Title"] =
      "Builder";
  }

  const response =
    await fetch(
      `${base}/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens:
            maxTokens
        }),
        signal:
          AbortSignal.timeout(
            60_000
          )
      }
    );

  const data =
    await readJson(response);

  return {
    text:
      data?.choices?.[0]?.message
        ?.content || "",
    usage:
      data?.usage || null
  };
}
