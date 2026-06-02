import { useInteractionStore } from './interactionStore';

export const logger = {
  info: (message: string, ...args: any[]) => {
    console.info(`[Sparkle INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[Sparkle WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[Sparkle ERROR] ${message}`, ...args);
  },
  performance: (label: string, action: () => void) => {
    console.time(`[Performance] ${label}`);
    action();
    console.timeEnd(`[Performance] ${label}`);
  },
  performanceAsync: async (label: string, action: () => Promise<any>) => {
    console.time(`[Performance] ${label}`);
    const res = await action();
    console.timeEnd(`[Performance] ${label}`);
    return res;
  }
};
