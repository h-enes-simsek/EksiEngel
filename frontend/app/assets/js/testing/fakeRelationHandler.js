import * as enums from '../enums.js';

const ARTIFICIAL_DELAY_MS = 500;

function waitForArtificialDelay()
{
  return new Promise(resolve => setTimeout(resolve, ARTIFICIAL_DELAY_MS));
}

export class FakeRelationHandler
{
  successfulAction = 0;
  performedAction = 0;
  actions = [];

  reset = () =>
  {
    this.successfulAction = 0;
    this.performedAction = 0;
    this.actions = [];
  }

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

    this.actions.push(action);
    this.performedAction++;

    if(id != 0)
      this.successfulAction++;

    console.info("[fake-relation] performAction", action);

    return {
      resultType: enums.ResultType.SUCCESS,
      successfulAction: this.successfulAction,
      performedAction: this.performedAction
    };
  }
}

export const fakeRelationHandler = new FakeRelationHandler();
