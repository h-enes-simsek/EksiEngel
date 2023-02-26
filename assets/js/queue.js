// queue implementation
class Queue 
{
  constructor() { this._items = []; }
  enqueue(item) { this._items.push(item); }
  dequeue()     { return this._items.shift(); }
  get size()    { return this._items.length; }
}

// queue implementation that executes promises automatically
class AutoQueue extends Queue 
{
  constructor() 
  {
    super();
    this._pendingPromise = false;
  }
  
  get isRunning() { return this._pendingPromise; }
  
  clear()
  {
    this._items = [];
  }

  enqueue(action) 
  {
    return new Promise((resolve, reject) => {
      super.enqueue({ action, resolve, reject });
      this.dequeue();
    });
  }

  async dequeue() 
  {
    if (this._pendingPromise) return false;

    let item = super.dequeue();

    if (!item) return false;

    try {
      this._pendingPromise = true;

      let payload = await item.action(this);

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

// queue instance
export let autoQueue = new AutoQueue(); 