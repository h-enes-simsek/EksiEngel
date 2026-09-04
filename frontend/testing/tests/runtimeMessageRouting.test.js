import {afterEach, describe, expect, it, vi} from 'vitest';

import * as enums from '../../app/assets/js/enums.js';

afterEach(() =>
{
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function createTable()
{
  const tableBody = {
    rows: [],
    deleteRow(index)
    {
      this.rows.splice(index, 1);
    },
    insertRow()
    {
      const row = {
        cells: [],
        insertCell()
        {
          const cell = {innerHTML: ''};
          this.cells.push(cell);
          return cell;
        }
      };
      this.rows.push(row);
      return row;
    }
  };

  return {tBodies: [tableBody]};
}

function createNotificationElements()
{
  return {
    bar: {style: {}},
    barText: {innerHTML: ''},
    completedProcesses: createTable(),
    earlyStop: {addEventListener: vi.fn(), disabled: false},
    performedAction: {innerHTML: ''},
    plannedAction: {innerHTML: ''},
    plannedProcesses: createTable(),
    remainingTimeInSec: {innerHTML: ''},
    statusText: {innerHTML: ''},
    successfulAction: {innerHTML: ''}
  };
}

async function loadNotificationPage()
{
  let messageListener;
  let domContentLoadedListener;
  const sendMessage = vi.fn().mockResolvedValue({ok: true});
  const elements = createNotificationElements();
  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: vi.fn(listener => { messageListener = listener; })
      },
      sendMessage
    }
  });
  vi.stubGlobal('document', {
    addEventListener: vi.fn((eventName, listener) =>
    {
      if(eventName === 'DOMContentLoaded')
        domContentLoadedListener = listener;
    }),
    getElementById: vi.fn(id => elements[id])
  });

  await import('../../app/assets/js/notification.js');
  return {domContentLoadedListener, elements, messageListener, sendMessage};
}

function snapshot(revision, overrides = {})
{
  return {
    revision,
    activeJob: null,
    waitingJobs: [],
    completedJobs: [],
    ...overrides
  };
}

const EMPTY_TEST_PROGRESS = {
  successfulAction: 0,
  performedAction: 0,
  plannedAction: 0
};

function testJob(id, banSource, banMode, createdAt)
{
  return {id, banSource, banMode, createdAt};
}

function activeTestJob(job, phase, {
  progress = EMPTY_TEST_PROGRESS,
  cooldownEndsAt = null,
  cancelRequested = false
} = {})
{
  return {job, phase, progress, cooldownEndsAt, cancelRequested};
}

function completedTestJob(job, finishReason, {
  progress = EMPTY_TEST_PROGRESS,
  completedAt = job.createdAt,
  errorMessage = null
} = {})
{
  return {
    job,
    result: {
      jobId: job.id,
      finishReason,
      ...progress,
      completedAt,
      errorMessage
    }
  };
}

function deliverSnapshot(messageListener, payload)
{
  const sendResponse = vi.fn();
  messageListener({
    type: enums.RuntimeMessageType.JOB_SNAPSHOT,
    payload
  }, {}, sendResponse);
  return sendResponse;
}

function tableRows(elements, tableId)
{
  return elements[tableId].tBodies[0].rows.map(row =>
    row.cells.map(cell => cell.innerHTML)
  );
}

describe('runtime message routing', () =>
{
  it('notification page ignores unrelated messages without responding', async () =>
  {
    const {messageListener: listener} = await loadNotificationPage();
    const sendResponse = vi.fn();

    const result = listener({
      type: enums.RuntimeMessageType.ENQUEUE_JOB,
      payload: {banSource: enums.BanSource.LIST, banMode: enums.BanMode.BAN}
    }, {}, sendResponse);

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('notification page ignores legacy notification events', async () =>
  {
    const {messageListener: listener} = await loadNotificationPage();
    const sendResponse = vi.fn();

    const result = listener({
      type: enums.RuntimeMessageType.JOB_NOTIFICATION,
      payload: {
        status: enums.NotificationType.NOTIFY,
        statusText: 'collecting authors'
      }
    }, {}, sendResponse);

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('requests the current job snapshot when the page DOM is ready', async () =>
  {
    const {domContentLoadedListener, sendMessage} = await loadNotificationPage();
    sendMessage.mockResolvedValue({ok: true, snapshot: snapshot(7)});

    await domContentLoadedListener();

    expect(sendMessage).toHaveBeenCalledWith({
      type: enums.RuntimeMessageType.GET_JOB_SNAPSHOT,
      payload: null
    });
  });

  it('accepts only newer live job snapshots', async () =>
  {
    const {messageListener} = await loadNotificationPage();
    const sendResponse = vi.fn();
    expect(messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: snapshot(5)
    }, {}, sendResponse)).toBe(false);
    expect(sendResponse).toHaveBeenLastCalledWith({ok: true, accepted: true});

    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: snapshot(4)
    }, {}, sendResponse);
    expect(sendResponse).toHaveBeenLastCalledWith({ok: true, accepted: false});

    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: snapshot(5)
    }, {}, sendResponse);
    expect(sendResponse).toHaveBeenLastCalledWith({ok: true, accepted: false});

    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: snapshot(6)
    }, {}, sendResponse);
    expect(sendResponse).toHaveBeenLastCalledWith({ok: true, accepted: true});
  });

  it('does not let a delayed hydration response replace newer live state', async () =>
  {
    let resolveHydration;
    const hydrationResponse = new Promise(resolve => { resolveHydration = resolve; });
    const {
      domContentLoadedListener,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    sendMessage.mockReturnValue(hydrationResponse);
    const hydration = domContentLoadedListener();
    const liveResponse = vi.fn();

    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: {
        revision: 8,
        activeJob: null,
        waitingJobs: [],
        completedJobs: []
      }
    }, {}, liveResponse);
    resolveHydration({
      ok: true,
      snapshot: {
        revision: 7,
        activeJob: null,
        waitingJobs: [],
        completedJobs: []
      }
    });
    await hydration;

    const staleResponse = vi.fn();
    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: {
        revision: 7,
        activeJob: null,
        waitingJobs: [],
        completedJobs: []
      }
    }, {}, staleResponse);

    expect(liveResponse).toHaveBeenCalledWith({ok: true, accepted: true});
    expect(staleResponse).toHaveBeenCalledWith({ok: true, accepted: false});
  });

  it('renders a live snapshot that arrived before the DOM was ready', async () =>
  {
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: snapshot(2, {
        activeJob: {
          job: {
            id: 'active',
            banSource: enums.BanSource.SINGLE,
            banMode: enums.BanMode.BAN,
            createdAt: '2026-09-03T11:55:00.000Z'
          },
          phase: enums.JobPhase.EXECUTING_RELATIONS,
          progress: {
            successfulAction: 1,
            performedAction: 1,
            plannedAction: 2
          },
          cooldownEndsAt: null,
          cancelRequested: false
        }
      })
    }, {}, vi.fn());
    sendMessage.mockResolvedValue({ok: true, snapshot: snapshot(1)});

    await domContentLoadedListener();

    expect(elements.statusText.innerHTML).toBe('İşlem devam ediyor.');
    expect(elements.successfulAction.innerHTML).toBe(1);
    expect(elements.barText.innerHTML).toBe('%50');
    expect(elements.earlyStop.disabled).toBe(false);
  });

  it('renders active progress, cooldown, waiting jobs, and completed jobs from one snapshot', async () =>
  {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    const {domContentLoadedListener, elements, sendMessage} = await loadNotificationPage();
    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(3, {
        activeJob: {
          job: {
            id: 'active',
            banSource: enums.BanSource.FAV,
            banMode: enums.BanMode.BAN,
            createdAt: '2026-09-03T11:55:00.000Z'
          },
          phase: enums.JobPhase.COOLDOWN,
          progress: {
            successfulAction: 2,
            performedAction: 3,
            plannedAction: 6
          },
          cooldownEndsAt: '2026-09-03T12:00:30.000Z',
          cancelRequested: false
        },
        waitingJobs: [{
          id: 'waiting',
          banSource: enums.BanSource.LIST,
          banMode: enums.BanMode.UNDOBAN,
          createdAt: '2026-09-03T11:56:00.000Z'
        }],
        completedJobs: [{
          job: {
            id: 'completed',
            banSource: enums.BanSource.SINGLE,
            banMode: enums.BanMode.BAN,
            createdAt: '2026-09-03T11:50:00.000Z'
          },
          result: {
            jobId: 'completed',
            finishReason: enums.ProcessFinishReason.SUCCESS,
            successfulAction: 4,
            performedAction: 5,
            plannedAction: 5,
            completedAt: '2026-09-03T11:59:00.000Z',
            errorMessage: null
          }
        }]
      })
    });

    await domContentLoadedListener();

    expect(elements.statusText.innerHTML).toContain('dakikada 6 engel limiti');
    expect(elements.remainingTimeInSec.innerHTML).toBe('30 saniye');
    expect(elements.successfulAction.innerHTML).toBe(2);
    expect(elements.performedAction.innerHTML).toBe(3);
    expect(elements.plannedAction.innerHTML).toBe(6);
    expect(elements.barText.innerHTML).toBe('%50');
    expect(elements.bar.style.width).toBe('50%');
    expect(elements.earlyStop.disabled).toBe(false);
    expect(elements.plannedProcesses.tBodies[0].rows[0].cells.slice(1).map(
      cell => cell.innerHTML
    )).toEqual(['Yazar listesi', 'Engeli kaldır']);
    expect(elements.completedProcesses.tBodies[0].rows[0].cells.slice(1).map(
      cell => cell.innerHTML
    )).toEqual([
      'Tekil işlem',
      'Engelle',
      4,
      5,
      5,
      'yok'
    ]);
  });

  it('maps every finish reason and rebuilds completed rows without duplicates', async () =>
  {
    const expectedPresentation = {
      [enums.ProcessFinishReason.NOT_SET]: [
        'İşlem sonucu belirlenemedi.',
        'işlem sonucu belirlenemedi'
      ],
      [enums.ProcessFinishReason.SUCCESS]: ['İşlem tamamlandı.', 'yok'],
      [enums.ProcessFinishReason.CANCELLED]: ['İşlem iptal edildi.', 'iptal edildi'],
      [enums.ProcessFinishReason.UNEXPECTED_ERROR]: [
        'Beklenmeyen bir hata oluştu.',
        'beklenmeyen hata: runner failed'
      ],
      [enums.ProcessFinishReason.NOTIFICATION_TAB_CREATION]: [
        'Bildirim sayfası açılamadı.',
        'bildirim sayfası açılamadı'
      ],
      [enums.ProcessFinishReason.CONFIGURATION_LOADING]: [
        'Ayarlar yüklenemedi.',
        'ayarlar yüklenemedi'
      ],
      [enums.ProcessFinishReason.EKSI_SOZLUK_UNREACHABLE]: [
        "Ekşi Sözlük'e erişilemedi.",
        "ekşi sözlük'e erişilemedi"
      ],
      [enums.ProcessFinishReason.CLIENT_NOT_LOGGED_IN]: [
        'Ekşi Sözlük hesabınıza giriş yapmanız gerekiyor.',
        'giriş yapılmadı'
      ],
      [enums.ProcessFinishReason.USER_LIST_LOADING]: [
        'Yazar listesi yüklenemedi.',
        'yazar listesi yüklenemedi'
      ],
      [enums.ProcessFinishReason.USER_LIST_CLEANING]: [
        'Yazar listesi temizlenemedi.',
        'yazar listesi temizlenemedi'
      ],
      [enums.ProcessFinishReason.NO_ACCOUNTS_FOUND]: [
        'Engellenecek yazar listesi boş.',
        'yazar listesi boş'
      ],
      [enums.ProcessFinishReason.NO_ACCOUNTS_AFTER_FILTERING]: [
        'Engellenecek yazar listesi boş.',
        'yazar listesi boş'
      ]
    };
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    sendMessage.mockResolvedValue({ok: true, snapshot: snapshot(0)});
    await domContentLoadedListener();

    let revision = 1;
    for(const finishReason of Object.values(enums.ProcessFinishReason))
    {
      const completedJob = {
        job: {
          id: `completed-${revision}`,
          banSource: enums.BanSource.SINGLE,
          banMode: enums.BanMode.BAN,
          createdAt: '2026-09-03T11:50:00.000Z'
        },
        result: {
          jobId: `completed-${revision}`,
          finishReason,
          successfulAction: 1,
          performedAction: 2,
          plannedAction: 3,
          completedAt: '2026-09-03T12:00:00.000Z',
          errorMessage: finishReason === enums.ProcessFinishReason.UNEXPECTED_ERROR
            ? 'runner failed'
            : null
        }
      };
      const terminalSnapshot = snapshot(revision++, {
        completedJobs: [completedJob]
      });

      messageListener({
        type: enums.RuntimeMessageType.JOB_SNAPSHOT,
        payload: terminalSnapshot
      }, {}, vi.fn());

      const rows = elements.completedProcesses.tBodies[0].rows;
      expect(rows).toHaveLength(1);
      expect(elements.statusText.innerHTML).toBe(
        expectedPresentation[finishReason][0]
      );
      expect(rows[0].cells.slice(3).map(cell => cell.innerHTML)).toEqual([
        1,
        2,
        3,
        expectedPresentation[finishReason][1]
      ]);

      messageListener({
        type: enums.RuntimeMessageType.JOB_SNAPSHOT,
        payload: snapshot(revision++, {completedJobs: [completedJob]})
      }, {}, vi.fn());
      expect(elements.completedProcesses.tBodies[0].rows).toHaveLength(1);
    }
  });

  it('preserves authoritative completed snapshot order', async () =>
  {
    const {domContentLoadedListener, elements, messageListener, sendMessage} =
      await loadNotificationPage();
    const cancelledJob = (id, plannedAction, createdAt, completedAt) => ({
      job: {
        id,
        banSource: enums.BanSource.FAV,
        banMode: enums.BanMode.BAN,
        createdAt
      },
      result: {
        jobId: id,
        finishReason: enums.ProcessFinishReason.CANCELLED,
        successfulAction: 0,
        performedAction: 0,
        plannedAction,
        completedAt,
        errorMessage: null
      }
    });
    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(4, {
        completedJobs: [
          cancelledJob(
            'waiting-job',
            0,
            '2026-09-03T22:25:01.000Z',
            '2026-09-03T22:26:00.000Z'
          ),
          cancelledJob(
            'active-job',
            915,
            '2026-09-03T22:25:00.000Z',
            '2026-09-03T22:26:01.000Z'
          )
        ]
      })
    });

    await domContentLoadedListener();

    const rows = elements.completedProcesses.tBodies[0].rows;
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.cells[5].innerHTML)).toEqual([0, 915]);

    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: snapshot(5, {
        completedJobs: [
          cancelledJob(
            'active-job',
            915,
            '2026-09-03T22:25:00.000Z',
            '2026-09-03T22:26:01.000Z'
          ),
          cancelledJob(
            'waiting-job',
            0,
            '2026-09-03T22:25:01.000Z',
            '2026-09-03T22:26:00.000Z'
          )
        ]
      })
    }, {}, vi.fn());
    expect(rows.map(row => row.cells[5].innerHTML)).toEqual([915, 0]);
  });

  it('uses the first newest-first completed result for terminal status', async () =>
  {
    const {domContentLoadedListener, elements, sendMessage} =
      await loadNotificationPage();
    const completedJob = (id, finishReason, createdAt) => ({
      job: {
        id,
        banSource: enums.BanSource.LIST,
        banMode: enums.BanMode.BAN,
        createdAt
      },
      result: {
        jobId: id,
        finishReason,
        successfulAction: 0,
        performedAction: 0,
        plannedAction: 0,
        completedAt: createdAt,
        errorMessage: null
      }
    });
    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(3, {
        completedJobs: [
          completedJob(
            'empty-list',
            enums.ProcessFinishReason.NO_ACCOUNTS_FOUND,
            '2026-09-03T22:38:49.000Z'
          ),
          completedJob(
            'cancelled',
            enums.ProcessFinishReason.CANCELLED,
            '2026-09-03T22:38:40.000Z'
          )
        ]
      })
    });

    await domContentLoadedListener();

    expect(elements.statusText.innerHTML).toBe('Engellenecek yazar listesi boş.');
    expect(elements.completedProcesses.tBodies[0].rows.map(
      row => row.cells[6].innerHTML
    )).toEqual(['yazar listesi boş', 'iptal edildi']);
  });

  it('renders FAV cancellation followed by an empty LIST as one UI scenario', async () =>
  {
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    const favActive = {
      id: 'fav-active',
      banSource: enums.BanSource.FAV,
      banMode: enums.BanMode.BAN,
      createdAt: '2026-09-03T22:32:30.000Z'
    };
    const favWaiting = {
      id: 'fav-waiting',
      banSource: enums.BanSource.FAV,
      banMode: enums.BanMode.BAN,
      createdAt: '2026-09-03T22:32:31.000Z'
    };
    const emptyList = {
      id: 'empty-list',
      banSource: enums.BanSource.LIST,
      banMode: enums.BanMode.BAN,
      createdAt: '2026-09-03T22:32:53.000Z'
    };
    const progress = {
      successfulAction: 10,
      performedAction: 12,
      plannedAction: 288
    };
    const completed = (
      job,
      finishReason,
      jobProgress,
      completedAt
    ) => ({
      job,
      result: {
        jobId: job.id,
        finishReason,
        ...jobProgress,
        completedAt,
        errorMessage: null
      }
    });
    const pushSnapshot = payload => messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload
    }, {}, vi.fn());

    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(2, {
        activeJob: {
          job: favActive,
          phase: enums.JobPhase.COLLECTING_FAVORITERS,
          progress: EMPTY_TEST_PROGRESS,
          cooldownEndsAt: null,
          cancelRequested: false
        },
        waitingJobs: [favWaiting]
      })
    });
    await domContentLoadedListener();

    expect(elements.statusText.innerHTML)
      .toBe("Hedef entry'i favorileyen yazarlar toplanıyor.");
    expect(elements.earlyStop.disabled).toBe(false);
    expect(elements.plannedProcesses.tBodies[0].rows.map(row =>
      row.cells.slice(1).map(cell => cell.innerHTML)
    )).toEqual([['Favorileyenler', 'Engelle']]);

    pushSnapshot(snapshot(3, {
      activeJob: {
        job: favActive,
        phase: enums.JobPhase.EXECUTING_RELATIONS,
        progress,
        cooldownEndsAt: null,
        cancelRequested: false
      },
      waitingJobs: [favWaiting]
    }));

    expect(elements.statusText.innerHTML).toBe('İşlem devam ediyor.');
    expect([
      elements.successfulAction.innerHTML,
      elements.performedAction.innerHTML,
      elements.plannedAction.innerHTML
    ]).toEqual([10, 12, 288]);
    expect(elements.barText.innerHTML).toBe('%4');

    const waitingCancellation = completed(
      favWaiting,
      enums.ProcessFinishReason.CANCELLED,
      EMPTY_TEST_PROGRESS,
      '2026-09-03T22:32:33.000Z'
    );
    pushSnapshot(snapshot(4, {
      activeJob: {
        job: favActive,
        phase: enums.JobPhase.CANCELLING,
        progress,
        cooldownEndsAt: null,
        cancelRequested: true
      },
      completedJobs: [waitingCancellation]
    }));

    expect(elements.statusText.innerHTML).toBe('İşlem iptal ediliyor.');
    expect(elements.earlyStop.disabled).toBe(true);
    expect(elements.plannedProcesses.tBodies[0].rows).toHaveLength(0);
    expect(elements.completedProcesses.tBodies[0].rows.map(
      row => row.cells[5].innerHTML
    )).toEqual([0]);

    const activeCancellation = completed(
      favActive,
      enums.ProcessFinishReason.CANCELLED,
      progress,
      '2026-09-03T22:32:34.000Z'
    );
    pushSnapshot(snapshot(5, {
      completedJobs: [waitingCancellation, activeCancellation]
    }));

    expect(elements.statusText.innerHTML).toBe('İşlem iptal edildi.');
    expect(elements.completedProcesses.tBodies[0].rows.map(row => [
      row.cells[5].innerHTML,
      row.cells[6].innerHTML
    ])).toEqual([
      [0, 'iptal edildi'],
      [288, 'iptal edildi']
    ]);

    const emptyListResult = completed(
      emptyList,
      enums.ProcessFinishReason.NO_ACCOUNTS_FOUND,
      EMPTY_TEST_PROGRESS,
      '2026-09-03T22:32:53.000Z'
    );
    pushSnapshot(snapshot(6, {
      completedJobs: [
        emptyListResult,
        waitingCancellation,
        activeCancellation
      ]
    }));

    expect(elements.statusText.innerHTML).toBe('Engellenecek yazar listesi boş.');
    expect([
      elements.successfulAction.innerHTML,
      elements.performedAction.innerHTML,
      elements.plannedAction.innerHTML
    ]).toEqual([0, 0, 0]);
    expect(elements.barText.innerHTML).toBe('%0');
    expect(elements.earlyStop.disabled).toBe(true);
    expect(elements.completedProcesses.tBodies[0].rows.map(row => [
      row.cells[1].innerHTML,
      row.cells[5].innerHTML,
      row.cells[6].innerHTML
    ])).toEqual([
      ['Yazar listesi', 0, 'yazar listesi boş'],
      ['Favorileyenler', 0, 'iptal edildi'],
      ['Favorileyenler', 288, 'iptal edildi']
    ]);
  });

  it('renders three jobs progressing through FIFO execution as one UI scenario', async () =>
  {
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    const listJob = testJob(
      'list-job',
      enums.BanSource.LIST,
      enums.BanMode.BAN,
      '2026-09-03T12:00:00.000Z'
    );
    const singleJob = testJob(
      'single-job',
      enums.BanSource.SINGLE,
      enums.BanMode.UNDOBAN,
      '2026-09-03T12:00:01.000Z'
    );
    const titleJob = testJob(
      'title-job',
      enums.BanSource.TITLE,
      enums.BanMode.BAN,
      '2026-09-03T12:00:02.000Z'
    );
    const listResult = completedTestJob(
      listJob,
      enums.ProcessFinishReason.SUCCESS,
      {
        progress: {
          successfulAction: 2,
          performedAction: 2,
          plannedAction: 2
        },
        completedAt: '2026-09-03T12:00:10.000Z'
      }
    );
    const singleResult = completedTestJob(
      singleJob,
      enums.ProcessFinishReason.SUCCESS,
      {
        progress: {
          successfulAction: 1,
          performedAction: 1,
          plannedAction: 1
        },
        completedAt: '2026-09-03T12:00:11.000Z'
      }
    );
    const titleResult = completedTestJob(
      titleJob,
      enums.ProcessFinishReason.SUCCESS,
      {
        progress: {
          successfulAction: 3,
          performedAction: 4,
          plannedAction: 5
        },
        completedAt: '2026-09-03T12:00:12.000Z'
      }
    );

    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(1, {
        activeJob: activeTestJob(
          listJob,
          enums.JobPhase.COLLECTING_AUTHORS
        ),
        waitingJobs: [singleJob, titleJob]
      })
    });
    await domContentLoadedListener();

    expect(elements.statusText.innerHTML).toBe('Yazar listesi hazırlanıyor.');
    expect(tableRows(elements, 'plannedProcesses').map(row => row[1]))
      .toEqual(['Tekil işlem', 'Başlıktaki yazarlar']);

    deliverSnapshot(messageListener, snapshot(2, {
      activeJob: activeTestJob(
        listJob,
        enums.JobPhase.EXECUTING_RELATIONS,
        {
          progress: {
            successfulAction: 1,
            performedAction: 1,
            plannedAction: 2
          }
        }
      ),
      waitingJobs: [singleJob, titleJob]
    }));
    expect(elements.barText.innerHTML).toBe('%50');
    expect(elements.plannedAction.innerHTML).toBe(2);

    deliverSnapshot(messageListener, snapshot(3, {
      activeJob: activeTestJob(singleJob, enums.JobPhase.PREPARING),
      waitingJobs: [titleJob],
      completedJobs: [listResult]
    }));
    expect(elements.statusText.innerHTML).toBe('İşlem başlayacak.');
    expect(elements.plannedAction.innerHTML).toBe(0);
    expect(tableRows(elements, 'plannedProcesses').map(row => row[1]))
      .toEqual(['Başlıktaki yazarlar']);

    deliverSnapshot(messageListener, snapshot(4, {
      activeJob: activeTestJob(
        singleJob,
        enums.JobPhase.EXECUTING_RELATIONS,
        {
          progress: {
            successfulAction: 0,
            performedAction: 0,
            plannedAction: 1
          }
        }
      ),
      waitingJobs: [titleJob],
      completedJobs: [listResult]
    }));
    expect(elements.plannedAction.innerHTML).toBe(1);

    deliverSnapshot(messageListener, snapshot(5, {
      activeJob: activeTestJob(
        titleJob,
        enums.JobPhase.COLLECTING_TITLE_AUTHORS
      ),
      completedJobs: [singleResult, listResult]
    }));
    expect(elements.statusText.innerHTML)
      .toBe("Hedef başlıkta entry'si bulunan yazarlar toplanıyor.");
    expect(elements.plannedAction.innerHTML).toBe(0);
    expect(tableRows(elements, 'plannedProcesses')).toHaveLength(0);

    deliverSnapshot(messageListener, snapshot(6, {
      completedJobs: [titleResult, singleResult, listResult]
    }));

    expect(elements.statusText.innerHTML).toBe('İşlem tamamlandı.');
    expect(elements.earlyStop.disabled).toBe(true);
    expect([
      elements.successfulAction.innerHTML,
      elements.performedAction.innerHTML,
      elements.plannedAction.innerHTML
    ]).toEqual([0, 0, 0]);
    expect(tableRows(elements, 'completedProcesses').map(row => row[1]))
      .toEqual([
        'Başlıktaki yazarlar',
        'Tekil işlem',
        'Yazar listesi'
      ]);
    expect(tableRows(elements, 'completedProcesses').map(row =>
      row.slice(3, 7)
    )).toEqual([
      [3, 4, 5, 'yok'],
      [1, 1, 1, 'yok'],
      [2, 2, 2, 'yok']
    ]);
  });

  it('renders only the newest revision across hydration and live updates', async () =>
  {
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    const activeJob = testJob(
      'active',
      enums.BanSource.FAV,
      enums.BanMode.BAN,
      '2026-09-03T13:00:00.000Z'
    );
    const waitingJob = testJob(
      'waiting',
      enums.BanSource.LIST,
      enums.BanMode.UNDOBAN,
      '2026-09-03T13:00:01.000Z'
    );
    const priorJob = testJob(
      'prior',
      enums.BanSource.SINGLE,
      enums.BanMode.BAN,
      '2026-09-03T12:59:00.000Z'
    );
    const priorResult = completedTestJob(
      priorJob,
      enums.ProcessFinishReason.SUCCESS
    );
    const revision12 = snapshot(12, {
      activeJob: activeTestJob(
        activeJob,
        enums.JobPhase.EXECUTING_RELATIONS,
        {
          progress: {
            successfulAction: 2,
            performedAction: 3,
            plannedAction: 10
          }
        }
      ),
      waitingJobs: [waitingJob],
      completedJobs: [priorResult]
    });

    deliverSnapshot(messageListener, revision12);
    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(10, {
        activeJob: activeTestJob(activeJob, enums.JobPhase.CHECKING_ACCESS)
      })
    });
    await domContentLoadedListener();

    expect(elements.statusText.innerHTML).toBe('İşlem devam ediyor.');
    expect(elements.performedAction.innerHTML).toBe(3);
    expect(tableRows(elements, 'plannedProcesses')).toHaveLength(1);
    expect(tableRows(elements, 'completedProcesses')).toHaveLength(1);

    const revision11Response = deliverSnapshot(
      messageListener,
      snapshot(11)
    );
    const duplicateResponse = deliverSnapshot(messageListener, revision12);
    expect(revision11Response).toHaveBeenCalledWith({ok: true, accepted: false});
    expect(duplicateResponse).toHaveBeenCalledWith({ok: true, accepted: false});
    expect(elements.performedAction.innerHTML).toBe(3);
    expect(tableRows(elements, 'completedProcesses')).toHaveLength(1);

    const newestResult = completedTestJob(
      activeJob,
      enums.ProcessFinishReason.SUCCESS,
      {
        progress: {
          successfulAction: 8,
          performedAction: 9,
          plannedAction: 10
        },
        completedAt: '2026-09-03T13:01:00.000Z'
      }
    );
    const revision13Response = deliverSnapshot(
      messageListener,
      snapshot(13, {
        completedJobs: [newestResult, priorResult]
      })
    );

    expect(revision13Response).toHaveBeenCalledWith({ok: true, accepted: true});
    expect(elements.statusText.innerHTML).toBe('İşlem tamamlandı.');
    expect(tableRows(elements, 'plannedProcesses')).toHaveLength(0);
    expect(tableRows(elements, 'completedProcesses')).toHaveLength(2);
    expect(tableRows(elements, 'completedProcesses').map(row => row[1]))
      .toEqual(['Favorileyenler', 'Tekil işlem']);
  });

  it('renders cooldown across reload and retains counters after cancellation', async () =>
  {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T14:00:00.000Z'));
    const cooldownJob = testJob(
      'cooldown-job',
      enums.BanSource.FAV,
      enums.BanMode.BAN,
      '2026-09-03T13:59:00.000Z'
    );
    const progress = {
      successfulAction: 3,
      performedAction: 4,
      plannedAction: 20
    };
    const cooldownEndsAt = '2026-09-03T14:00:30.000Z';
    const firstPage = await loadNotificationPage();
    firstPage.sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(1, {
        activeJob: activeTestJob(
          cooldownJob,
          enums.JobPhase.EXECUTING_RELATIONS,
          {progress}
        )
      })
    });
    await firstPage.domContentLoadedListener();

    deliverSnapshot(firstPage.messageListener, snapshot(2, {
      activeJob: activeTestJob(
        cooldownJob,
        enums.JobPhase.COOLDOWN,
        {progress, cooldownEndsAt}
      )
    }));
    expect(firstPage.elements.remainingTimeInSec.innerHTML).toBe('30 saniye');

    vi.setSystemTime(new Date('2026-09-03T14:00:10.000Z'));
    const cooldownSnapshot = snapshot(3, {
      activeJob: activeTestJob(
        cooldownJob,
        enums.JobPhase.COOLDOWN,
        {progress, cooldownEndsAt}
      )
    });
    deliverSnapshot(firstPage.messageListener, cooldownSnapshot);
    expect(firstPage.elements.remainingTimeInSec.innerHTML).toBe('20 saniye');

    vi.resetModules();
    const reloadedPage = await loadNotificationPage();
    reloadedPage.sendMessage.mockResolvedValue({
      ok: true,
      snapshot: cooldownSnapshot
    });
    await reloadedPage.domContentLoadedListener();
    expect(reloadedPage.elements.statusText.innerHTML)
      .toContain('dakikada 6 engel limiti');
    expect(reloadedPage.elements.remainingTimeInSec.innerHTML).toBe('20 saniye');
    expect(reloadedPage.elements.performedAction.innerHTML).toBe(4);

    deliverSnapshot(reloadedPage.messageListener, snapshot(4, {
      activeJob: activeTestJob(
        cooldownJob,
        enums.JobPhase.CANCELLING,
        {progress, cancelRequested: true}
      )
    }));
    expect(reloadedPage.elements.statusText.innerHTML).toBe('İşlem iptal ediliyor.');
    expect(reloadedPage.elements.remainingTimeInSec.innerHTML).toBe('-');
    expect(reloadedPage.elements.earlyStop.disabled).toBe(true);

    const cancelledResult = completedTestJob(
      cooldownJob,
      enums.ProcessFinishReason.CANCELLED,
      {
        progress,
        completedAt: '2026-09-03T14:00:11.000Z'
      }
    );
    deliverSnapshot(reloadedPage.messageListener, snapshot(5, {
      completedJobs: [cancelledResult]
    }));

    expect(reloadedPage.elements.statusText.innerHTML).toBe('İşlem iptal edildi.');
    expect([
      reloadedPage.elements.successfulAction.innerHTML,
      reloadedPage.elements.performedAction.innerHTML,
      reloadedPage.elements.plannedAction.innerHTML
    ]).toEqual([0, 0, 0]);
    expect(tableRows(reloadedPage.elements, 'completedProcesses')[0].slice(3, 7))
      .toEqual([3, 4, 20, 'iptal edildi']);
  });

  it('renders mixed terminal history followed by new active work', async () =>
  {
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    const emptyListJob = testJob(
      'empty-list',
      enums.BanSource.LIST,
      enums.BanMode.BAN,
      '2026-09-03T15:00:04.000Z'
    );
    const unexpectedJob = testJob(
      'unexpected',
      enums.BanSource.FAV,
      enums.BanMode.BAN,
      '2026-09-03T15:00:03.000Z'
    );
    const loginJob = testJob(
      'login',
      enums.BanSource.SINGLE,
      enums.BanMode.BAN,
      '2026-09-03T15:00:02.000Z'
    );
    const successfulJob = testJob(
      'successful',
      enums.BanSource.TITLE,
      enums.BanMode.BAN,
      '2026-09-03T15:00:01.000Z'
    );
    const newFavJob = testJob(
      'new-fav',
      enums.BanSource.FAV,
      enums.BanMode.BAN,
      '2026-09-03T15:00:05.000Z'
    );
    const initialHistory = [
      completedTestJob(
        emptyListJob,
        enums.ProcessFinishReason.NO_ACCOUNTS_FOUND
      ),
      completedTestJob(
        unexpectedJob,
        enums.ProcessFinishReason.UNEXPECTED_ERROR,
        {
          progress: {
            successfulAction: 2,
            performedAction: 3,
            plannedAction: 5
          },
          errorMessage: 'parser failed'
        }
      ),
      completedTestJob(
        loginJob,
        enums.ProcessFinishReason.CLIENT_NOT_LOGGED_IN
      ),
      completedTestJob(
        successfulJob,
        enums.ProcessFinishReason.SUCCESS,
        {
          progress: {
            successfulAction: 1,
            performedAction: 1,
            plannedAction: 1
          }
        }
      )
    ];

    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(1, {completedJobs: initialHistory})
    });
    await domContentLoadedListener();

    expect(elements.statusText.innerHTML).toBe('Engellenecek yazar listesi boş.');
    expect(tableRows(elements, 'completedProcesses').map(row => row[6]))
      .toEqual([
        'yazar listesi boş',
        'beklenmeyen hata: parser failed',
        'giriş yapılmadı',
        'yok'
      ]);

    deliverSnapshot(messageListener, snapshot(2, {
      activeJob: activeTestJob(
        newFavJob,
        enums.JobPhase.COLLECTING_FAVORITERS
      ),
      completedJobs: initialHistory
    }));
    expect(elements.statusText.innerHTML)
      .toBe("Hedef entry'i favorileyen yazarlar toplanıyor.");
    expect(elements.earlyStop.disabled).toBe(false);

    deliverSnapshot(messageListener, snapshot(3, {
      activeJob: activeTestJob(
        newFavJob,
        enums.JobPhase.ANALYSING_PROTECTED_USERS
      ),
      completedJobs: initialHistory
    }));
    expect(elements.statusText.innerHTML)
      .toContain('engellenecek yazarlar listesinden çıkarılıyor');

    const newProgress = {
      successfulAction: 1,
      performedAction: 2,
      plannedAction: 4
    };
    deliverSnapshot(messageListener, snapshot(4, {
      activeJob: activeTestJob(
        newFavJob,
        enums.JobPhase.EXECUTING_RELATIONS,
        {progress: newProgress}
      ),
      completedJobs: initialHistory
    }));
    expect(elements.statusText.innerHTML).toBe('İşlem devam ediyor.');
    expect(elements.barText.innerHTML).toBe('%50');

    const newFavResult = completedTestJob(
      newFavJob,
      enums.ProcessFinishReason.SUCCESS,
      {progress: newProgress, completedAt: '2026-09-03T15:01:00.000Z'}
    );
    deliverSnapshot(messageListener, snapshot(5, {
      completedJobs: [newFavResult, ...initialHistory]
    }));

    expect(elements.statusText.innerHTML).toBe('İşlem tamamlandı.');
    expect(elements.earlyStop.disabled).toBe(true);
    expect(tableRows(elements, 'completedProcesses')).toHaveLength(5);
    expect(tableRows(elements, 'completedProcesses').map(row => row[1]))
      .toEqual([
        'Favorileyenler',
        'Yazar listesi',
        'Favorileyenler',
        'Tekil işlem',
        'Başlıktaki yazarlar'
      ]);
    expect(tableRows(elements, 'completedProcesses').map(row => row[6]))
      .toEqual([
        'yok',
        'yazar listesi boş',
        'beklenmeyen hata: parser failed',
        'giriş yapılmadı',
        'yok'
      ]);
  });

  it('resets active controls and rebuilds tables when a newer snapshot has no active job', async () =>
  {
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(1, {
        activeJob: {
          job: {
            id: 'active',
            banSource: enums.BanSource.SINGLE,
            banMode: enums.BanMode.BAN,
            createdAt: '2026-09-03T11:55:00.000Z'
          },
          phase: enums.JobPhase.EXECUTING_RELATIONS,
          progress: {
            successfulAction: 1,
            performedAction: 2,
            plannedAction: 4
          },
          cooldownEndsAt: null,
          cancelRequested: false
        },
        waitingJobs: [{
          id: 'waiting',
          banSource: enums.BanSource.LIST,
          banMode: enums.BanMode.BAN,
          createdAt: '2026-09-03T11:56:00.000Z'
        }]
      })
    });
    await domContentLoadedListener();

    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: snapshot(2)
    }, {}, vi.fn());

    expect(elements.statusText.innerHTML).toBe('Aktif işlem yok.');
    expect(elements.remainingTimeInSec.innerHTML).toBe('-');
    expect(elements.successfulAction.innerHTML).toBe(0);
    expect(elements.performedAction.innerHTML).toBe(0);
    expect(elements.plannedAction.innerHTML).toBe(0);
    expect(elements.barText.innerHTML).toBe('%0');
    expect(elements.bar.style.width).toBe('0%');
    expect(elements.earlyStop.disabled).toBe(true);
    expect(elements.plannedProcesses.tBodies[0].rows).toHaveLength(0);
    expect(elements.completedProcesses.tBodies[0].rows).toHaveLength(0);
  });

  it('replaces active presentation with an unexpected-error result and its real counters', async () =>
  {
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    sendMessage.mockResolvedValue({
      ok: true,
      snapshot: snapshot(1, {
        activeJob: {
          job: {
            id: 'failed',
            banSource: enums.BanSource.LIST,
            banMode: enums.BanMode.BAN,
            createdAt: '2026-09-03T11:55:00.000Z'
          },
          phase: enums.JobPhase.EXECUTING_RELATIONS,
          progress: {
            successfulAction: 1,
            performedAction: 2,
            plannedAction: 4
          },
          cooldownEndsAt: null,
          cancelRequested: false
        }
      })
    });
    await domContentLoadedListener();

    messageListener({
      type: enums.RuntimeMessageType.JOB_SNAPSHOT,
      payload: snapshot(2, {
        completedJobs: [{
          job: {
            id: 'failed',
            banSource: enums.BanSource.LIST,
            banMode: enums.BanMode.BAN,
            createdAt: '2026-09-03T11:55:00.000Z'
          },
          result: {
            jobId: 'failed',
            finishReason: enums.ProcessFinishReason.UNEXPECTED_ERROR,
            successfulAction: 1,
            performedAction: 2,
            plannedAction: 4,
            completedAt: '2026-09-03T12:00:00.000Z',
            errorMessage: 'network parser failed'
          }
        }]
      })
    }, {}, vi.fn());

    expect(elements.statusText.innerHTML).toBe('Beklenmeyen bir hata oluştu.');
    expect(elements.successfulAction.innerHTML).toBe(0);
    expect(elements.performedAction.innerHTML).toBe(0);
    expect(elements.plannedAction.innerHTML).toBe(0);
    expect(elements.earlyStop.disabled).toBe(true);
    expect(elements.completedProcesses.tBodies[0].rows[0].cells.slice(3).map(
      cell => cell.innerHTML
    )).toEqual([1, 2, 4, 'beklenmeyen hata: network parser failed']);
  });

  it('maps every active job phase to user-facing status text', async () =>
  {
    const expectedStatus = {
      [enums.JobPhase.QUEUED]: 'İşlem sırada.',
      [enums.JobPhase.PREPARING]: 'İşlem başlayacak.',
      [enums.JobPhase.CHECKING_ACCESS]: "Ekşi Sözlük'e erişim kontrol ediliyor.",
      [enums.JobPhase.CHECKING_LOGIN]: "Ekşi Sözlük'e giriş yapıp yapmadığınız kontrol ediliyor.",
      [enums.JobPhase.COLLECTING_AUTHORS]: 'Yazar listesi hazırlanıyor.',
      [enums.JobPhase.COLLECTING_FAVORITERS]: "Hedef entry'i favorileyen yazarlar toplanıyor.",
      [enums.JobPhase.COLLECTING_FOLLOWERS]: 'Hedef yazarın takipçileri toplanıyor.',
      [enums.JobPhase.COLLECTING_EXISTING_RELATIONS]: 'Mevcut yazar ilişkileriniz toplanıyor.',
      [enums.JobPhase.COLLECTING_TITLE_AUTHORS]: "Hedef başlıkta entry'si bulunan yazarlar toplanıyor.",
      [enums.JobPhase.ANALYSING_PROTECTED_USERS]: 'Takip ettiğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.',
      [enums.JobPhase.ANALYSING_REQUIRED_ACTIONS]: 'Daha önce engellediğiniz yazarlar, engellenecek yazarlar listesinden çıkarılıyor.',
      [enums.JobPhase.EXECUTING_RELATIONS]: 'İşlem devam ediyor.',
      [enums.JobPhase.COOLDOWN]: 'İşlem devam ediyor. (dakikada 6 engel limiti bekleniyor)',
      [enums.JobPhase.CANCELLING]: 'İşlem iptal ediliyor.'
    };
    const {
      domContentLoadedListener,
      elements,
      messageListener,
      sendMessage
    } = await loadNotificationPage();
    sendMessage.mockResolvedValue({ok: true, snapshot: snapshot(0)});
    await domContentLoadedListener();

    let revision = 1;
    for(const phase of Object.values(enums.JobPhase))
    {
      messageListener({
        type: enums.RuntimeMessageType.JOB_SNAPSHOT,
        payload: snapshot(revision++, {
          activeJob: {
            job: {
              id: 'active',
              banSource: enums.BanSource.FAV,
              banMode: enums.BanMode.BAN,
              createdAt: '2026-09-03T11:55:00.000Z'
            },
            phase,
            progress: EMPTY_TEST_PROGRESS,
            cooldownEndsAt: null,
            cancelRequested: phase === enums.JobPhase.CANCELLING
          }
        })
      }, {}, vi.fn());

      expect(elements.statusText.innerHTML).toBe(expectedStatus[phase]);
    }
  });
});
