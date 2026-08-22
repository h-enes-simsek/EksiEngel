// queue implementation that executes promises automatically
class AutoQueue 
{
  constructor() 
  {
    this._items = [];
    this._pendingPromise = false;
  }
  
  get item() { return this._items; }

  get size() { return this._items.length; }

  get itemAttributes()
  {
    let attrs = [];
    for(let i = 0; i < this._items.length; i++)
    {
      let obj = {};
      obj.banSource = this._items[i].job.request.banSource;
      obj.banMode = this._items[i].job.request.banMode;
      obj.creationDateInStr = this._items[i].job.creationDateInStr;
      attrs.push(obj);
    }
    return attrs;
  }
  
  get isRunning() { return this._pendingPromise; }
  
  clear()
  {
    this._items = [];
  }

  enqueue(job, execute)
  {
    return new Promise((resolve, reject) => {
      this._items.push({ job, execute, resolve, reject });
      this.dequeue();
    });
  }

  async dequeue() 
  {
    if (this._pendingPromise) return false;

    let item = this._items.shift();

    if (!item) return false;

    try {
      this._pendingPromise = true;

      let payload = await item.execute(item.job, this);

      this._pendingPromise = false;
      item.resolve(payload);
    } catch (e) {
      this._pendingPromise = false;
      item.reject(e);
    } finally {
      this.dequeue();
    }

    return true;
  }
}

export let processQueue = new AutoQueue();
