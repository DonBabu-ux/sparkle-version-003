// src/hooks/useCallState.ts
import { useEffect, useState } from 'react';

export enum CallStage {
  Idle = 'Idle',
  Calling = 'Calling',
  Ringing = 'Ringing',
  Connecting = 'Connecting',
  RemoteSim = 'RemoteSim',
  Unstable = 'Unstable',
  Failed = 'Failed',
}

/**
 * Simple finite‑state machine driving the simulated call flow.
 * Timings are chosen to feel realistic but can be tweaked.
 */
export const useCallState = () => {
  const [stage, setStage] = useState<CallStage>(CallStage.Idle);

  const start = () => {
    setStage(CallStage.Calling);
  };

  const reset = () => {
    setStage(CallStage.Idle);
  };

  useEffect(() => {
    let timers: NodeJS.Timeout[] = [];
    if (stage === CallStage.Calling) {
      timers.push(setTimeout(() => setStage(CallStage.Ringing), 2000));
    }
    if (stage === CallStage.Ringing) {
      timers.push(setTimeout(() => setStage(CallStage.Connecting), 2000));
    }
    if (stage === CallStage.Connecting) {
      timers.push(setTimeout(() => setStage(CallStage.RemoteSim), 3000));
    }
    if (stage === CallStage.RemoteSim) {
      timers.push(setTimeout(() => setStage(CallStage.Unstable), 4000));
    }
    if (stage === CallStage.Unstable) {
      timers.push(setTimeout(() => setStage(CallStage.Failed), 5000));
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [stage]);

  return { stage, start, reset };
};
