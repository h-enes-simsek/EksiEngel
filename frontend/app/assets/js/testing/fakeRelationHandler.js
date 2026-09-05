import {RelationActionStatus} from '../relationHandler.js';

const ARTIFICIAL_DELAY_MS = 100;

function waitForArtificialDelay(signal)
{
  if(signal?.aborted)
    return Promise.resolve(false);

  return new Promise(resolve =>
  {
    let timeoutId;

    const finish = completed =>
    {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      resolve(completed);
    };

    const handleAbort = () => finish(false);
    timeoutId = setTimeout(() => finish(true), ARTIFICIAL_DELAY_MS);
    signal?.addEventListener("abort", handleAbort, {once: true});
  });
}

export class FakeRelationHandler
{
  async performAction(banMode, id, isTargetUser, isTargetTitle, isTargetMute, {signal} = {})
  {
    const delayCompleted = await waitForArtificialDelay(signal);
    if(!delayCompleted)
    {
      return {
        status: RelationActionStatus.ABORTED,
        actionPerformed: false,
        actionSucceeded: null
      };
    }

    const action = {
      banMode,
      id,
      isTargetUser,
      isTargetTitle,
      isTargetMute
    };

    console.info("[fake-relation] performAction", action);

    return {
      status: RelationActionStatus.COMPLETED,
      actionPerformed: true,
      actionSucceeded: true
    };
  }
}
