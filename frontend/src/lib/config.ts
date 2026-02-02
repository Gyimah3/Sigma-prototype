export interface StandaloneConfig {
  deploymentUrl: string;
  assistantId: string;
  langsmithApiKey?: string;
}

const CONFIG_KEY = "sigma-config";

// Compute default deploymentUrl at call time, not module init time.
// During Next.js static build, window is undefined — we must defer this.
function getDefaultDeploymentUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:8000";
}

function getDefaults(): StandaloneConfig {
  return {
    deploymentUrl: process.env.NEXT_PUBLIC_DEPLOYMENT_URL || getDefaultDeploymentUrl(),
    assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID || "horo",
    langsmithApiKey: process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || "",
  };
}

export function getConfig(): StandaloneConfig {
  const defaults = getDefaults();
  if (typeof window === "undefined") return defaults;

  const stored = localStorage.getItem(CONFIG_KEY);
  if (!stored) return defaults;

  try {
    const parsed = { ...defaults, ...JSON.parse(stored) };
    // Fix stale localhost URLs when served from a different host
    if (
      parsed.deploymentUrl.includes("localhost") &&
      !window.location.hostname.includes("localhost")
    ) {
      parsed.deploymentUrl = window.location.origin;
    }
    return parsed;
  } catch {
    return defaults;
  }
}

export function saveConfig(config: StandaloneConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
