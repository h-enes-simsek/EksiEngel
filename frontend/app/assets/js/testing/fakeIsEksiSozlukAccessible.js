// Development-only access check used when DEV_USE_FAKE_HANDLERS is enabled.
const ARTIFICIAL_DELAY_MS = 100;

function waitForArtificialDelay(signal)
{
  if(signal?.aborted)
    return Promise.reject(signal.reason);

  return new Promise((resolve, reject) =>
  {
    const timeoutId = setTimeout(() =>
    {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, ARTIFICIAL_DELAY_MS);

    function handleAbort()
    {
      clearTimeout(timeoutId);
      reject(signal.reason);
    }

    signal?.addEventListener('abort', handleAbort, {once: true});
  });
}

export async function fakeIsEksiSozlukAccessible({signal} = {})
{
  await waitForArtificialDelay(signal);
  return true;
}
