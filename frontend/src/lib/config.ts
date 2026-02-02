export interface StandaloneConfig {
  deploymentUrl: string;
  assistantId: string;
  langsmithApiKey?: string;
}

const CONFIG_KEY = "sigma-config";

// Default config — connects directly to the local Horo backend
const DEFAULT_CONFIG: StandaloneConfig = {
  deploymentUrl:
    process.env.NEXT_PUBLIC_DEPLOYMENT_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000"),
  assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID || "horo",
  langsmithApiKey: process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || "",
};

export function getConfig(): StandaloneConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;

  const stored = localStorage.getItem(CONFIG_KEY);
  if (!stored) return DEFAULT_CONFIG;

  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: StandaloneConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
