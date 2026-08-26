function getAbortReason(signal)
{
  if(signal.reason !== undefined)
    return signal.reason;

  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfAborted(signal)
{
  if(signal?.aborted)
    throw getAbortReason(signal);
}

function waitForDelay(delayInMs, signal)
{
  throwIfAborted(signal);

  return new Promise((resolve, reject) =>
  {
    const handleTimeout = () =>
    {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    };
    const handleAbort = () =>
    {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', handleAbort);
      reject(getAbortReason(signal));
    };
    const timeoutId = setTimeout(handleTimeout, delayInMs);

    signal?.addEventListener('abort', handleAbort, {once: true});
  });
}

/**
 * Wait through the relation rate-limit cooldown while reporting the remaining
 * whole seconds. Cancellation interrupts the currently pending delay.
 *
 * @param {Object} options
 * @param {number} [options.seconds=62]
 * @param {AbortSignal} [options.signal]
 * @param {(remainingSeconds: number) => void} [options.onTick]
 */
export async function waitForCooldown({
  seconds = 62,
  signal,
  onTick = () => {}
} = {})
{
  if(!Number.isInteger(seconds) || seconds < 0)
    throw new TypeError('seconds must be a non-negative integer');

  if(signal !== undefined &&
     (typeof signal.aborted !== 'boolean' ||
      typeof signal.addEventListener !== 'function' ||
      typeof signal.removeEventListener !== 'function'))
    throw new TypeError('signal must be an AbortSignal');

  if(typeof onTick !== 'function')
    throw new TypeError('onTick must be a function');

  throwIfAborted(signal);

  for(let elapsedSeconds = 1; elapsedSeconds <= seconds; elapsedSeconds++)
  {
    throwIfAborted(signal);
    onTick(seconds - elapsedSeconds);
    await waitForDelay(1000, signal);
  }
}
