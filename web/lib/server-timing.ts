type TimingMetric = {
  name: string;
  dur: number;
  desc?: string;
};

function nowMs(): number {
  if (
    typeof globalThis !== "undefined" &&
    typeof globalThis.performance?.now === "function"
  ) {
    return globalThis.performance.now();
  }
  return Date.now();
}

function formatMetric(metric: TimingMetric): string {
  const sanitizedName = metric.name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const duration = Math.max(0, metric.dur);
  const base = `${sanitizedName};dur=${duration.toFixed(1)}`;
  if (!metric.desc) {
    return base;
  }

  const sanitizedDesc = metric.desc.replace(/"/g, "'");
  return `${base};desc="${sanitizedDesc}"`;
}

export function createServerTimingRecorder() {
  const requestStartedAt = nowMs();
  const activeStarts = new Map<string, number>();
  const metrics: TimingMetric[] = [];

  const finalize = (name: string, startedAt: number, desc?: string) => {
    metrics.push({
      name,
      dur: nowMs() - startedAt,
      desc,
    });
  };

  return {
    addMetric(name: string, dur: number, desc?: string) {
      metrics.push({ name, dur, desc });
    },

    start(name: string) {
      activeStarts.set(name, nowMs());
    },

    end(name: string, desc?: string) {
      const startedAt = activeStarts.get(name);
      if (startedAt === undefined) {
        return;
      }
      activeStarts.delete(name);
      finalize(name, startedAt, desc);
    },

    async measure<T>(name: string, fn: () => Promise<T> | T, desc?: string) {
      const startedAt = nowMs();
      try {
        return await fn();
      } finally {
        finalize(name, startedAt, desc);
      }
    },

    toHeader() {
      const finalizedMetrics = [
        ...metrics,
        {
          name: "total",
          dur: nowMs() - requestStartedAt,
        },
      ];
      return finalizedMetrics.map(formatMetric).join(", ");
    },
  };
}
