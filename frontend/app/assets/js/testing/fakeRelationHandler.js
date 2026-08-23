import {RelationActionStatus} from '../relationHandler.js';

const ARTIFICIAL_DELAY_MS = 500;

function waitForArtificialDelay()
{
  return new Promise(resolve => setTimeout(resolve, ARTIFICIAL_DELAY_MS));
}

export class FakeRelationHandler
{
  async performAction(banMode, id, isTargetUser, isTargetTitle, isTargetMute)
  {
    await waitForArtificialDelay();

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
      actionSucceeded: true
    };
  }
}

export const fakeRelationHandler = new FakeRelationHandler();
