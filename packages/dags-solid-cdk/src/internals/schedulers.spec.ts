import { type _Task, type _createTaskObject } from './schedulers';
import { _EventLogs, _mocEnvironment, type _MockEnvironmentController } from '../test-utils/schedulers_test_utils';
import { createComputed, createRoot, createSignal, getOwner } from 'solid-js';



describe('Schedulers.', () => {
    let m: _MockEnvironmentController & typeof import('./schedulers');
    let logEvent: (value: number | string) => void;
    let advanceTime: (milis: number) => void;
    let assertLogs: (expectedLogs: (number | string)[]) => void;
    let disposeEnvironment: () => void
    let createTaskObject: typeof _createTaskObject;
    let cancelTask: (task: _Task) => void;

    beforeEach(async () => {
        m = await _mocEnvironment('browser', () => import('./schedulers'));
        logEvent = m.logEvent;
        advanceTime = m.advanceTime;
        assertLogs = m.assertLogs;
        disposeEnvironment = m.disposeEnvironment;
        createTaskObject = m._createTaskObject;
        cancelTask = m._cancelTask
    });

    afterEach(() => disposeEnvironment());

    describe('Asap scheduler.', () => {

        let scheduleAsapTask: (task: _Task) => void;
        let fireMicrotaskEvent: () => void;

        beforeEach(() => {
            scheduleAsapTask = m._scheduleAsapTask;
            fireMicrotaskEvent = m.fireMicrotaskEvent;
        });

        it('Should task be scheduled.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAsapTask(task);
            assertLogs([ _EventLogs.AddMicrotask ]);
            fireMicrotaskEvent();
            assertLogs([_EventLogs.FireMicrotask, 'A']);
        });

        it('Should run cleanup for once executed rescheduled task.', () => {
            const task = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            assertLogs([]);
            scheduleAsapTask(task);
            assertLogs([ _EventLogs.AddMicrotask ]);
            fireMicrotaskEvent();
            assertLogs([ _EventLogs.FireMicrotask, 'A' ]);
            scheduleAsapTask(task);
            fireMicrotaskEvent();
            assertLogs([
                _EventLogs.AddMicrotask,
                _EventLogs.FireMicrotask,
                'A_cleanup',
                'A'
            ]);
        });

        it('Should run callback and cleanup within an owning context associated with the task.', () => {
            const owner = createRoot(() => getOwner());
            const task = createTaskObject(
                () => {
                    logEvent('B');
                    expect(getOwner()).toBe(owner);
                },
                () => {
                    logEvent('A');
                    expect(getOwner()).toBe(owner);
                },
                owner
            );
            assertLogs([])
            scheduleAsapTask(task);
            assertLogs([ _EventLogs.AddMicrotask ]);
            fireMicrotaskEvent();
            assertLogs([ _EventLogs.FireMicrotask, 'A', 'B' ]);
        });

        it('Should coalesce single task', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAsapTask(task);
            assertLogs([ _EventLogs.AddMicrotask ]);
            scheduleAsapTask(task);
            assertLogs([]);
            fireMicrotaskEvent();
            assertLogs([ _EventLogs.FireMicrotask, 'A' ]);
        });

        it('Should schedule multiple tasks.', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            assertLogs([]);
            scheduleAsapTask(taskA);
            assertLogs([ _EventLogs.AddMicrotask ]);
            scheduleAsapTask(taskB);
            assertLogs([]);
            fireMicrotaskEvent();
            assertLogs([ _EventLogs.FireMicrotask, 'A', 'B' ]);
        });

        it('Should run cleanup for multiple once executed rescheduled tasks.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                return () => logEvent('B_cleanup');
            });
            assertLogs([]);
            scheduleAsapTask(taskA);
            scheduleAsapTask(taskB);
            assertLogs([ _EventLogs.AddMicrotask ]);
            fireMicrotaskEvent();
            assertLogs([ _EventLogs.FireMicrotask, 'A', 'B' ]);
            scheduleAsapTask(taskA);
            scheduleAsapTask(taskB);
            fireMicrotaskEvent();
            assertLogs([
                _EventLogs.AddMicrotask,
                _EventLogs.FireMicrotask,
                'A_cleanup',
                'A',
                'B_cleanup',
                'B'
            ]);
        });

        it('Should update signals in a single batch.', () => {
            const [source1, setSource1] = createSignal(false);
            const [source2, setSource2] = createSignal(false);
            const [source3, setSource3] = createSignal(false);
            const [source4, setSource4] = createSignal(false);
            const task1 = createTaskObject(
                () => { setSource1(true); },
                () => { setSource2(true); }
            );
            const task2 = createTaskObject(
                () => { setSource3(true); },
                () => { setSource4(true); }
            );
            let init = false;
            createComputed(() => {
                source1();
                source2();
                source3();
                source4();
                if (init) {
                    logEvent('A')
                } else {
                    init = true;
                }
            });

            scheduleAsapTask(task1);
            scheduleAsapTask(task2);
            assertLogs([ _EventLogs.AddMicrotask ]);
            fireMicrotaskEvent();
            assertLogs([ _EventLogs.FireMicrotask, 'A' ]);
        });

        it('Should not run canceled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAsapTask(task);
            assertLogs([ _EventLogs.AddMicrotask ]);
            cancelTask(task);
            fireMicrotaskEvent();
            assertLogs([ _EventLogs.FireMicrotask ]);
        });

        it('Should run previous canceled rescheduled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAsapTask(task);
            assertLogs([ _EventLogs.AddMicrotask ]);
            cancelTask(task);
            scheduleAsapTask(task)
            fireMicrotaskEvent();
            assertLogs([ _EventLogs.FireMicrotask, 'A' ]);
        })

        it('Should run only not canceled tasks.', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            const taskC = createTaskObject(() => logEvent('C'));
            const scheduleAll = () => {
                scheduleAsapTask(taskA);
                scheduleAsapTask(taskB);
                scheduleAsapTask(taskC);
            }
            const baseLogs = [ _EventLogs.AddMicrotask, _EventLogs.FireMicrotask ]

            scheduleAll();
            cancelTask(taskA);
            fireMicrotaskEvent();
            assertLogs([ ...baseLogs, 'B', 'C' ]);

            scheduleAll();
            cancelTask(taskB);
            fireMicrotaskEvent();
            assertLogs([ ...baseLogs, 'A', 'C' ]);

            scheduleAll();
            cancelTask(taskC);
            fireMicrotaskEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });


        it('Should reschedule task during task execution without any problem.', () => {
            let rescheduled = false
            const taskA = createTaskObject(() => {
                logEvent('A');
                if (rescheduled) { return; }
                rescheduled = true;
                scheduleAsapTask(taskA);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleAsapTask(taskA);
            scheduleAsapTask(taskB);
            fireMicrotaskEvent();
            assertLogs([
                _EventLogs.AddMicrotask,
                _EventLogs.FireMicrotask,
                'A',
                'B',
                'A'
            ]);
        });

        it('Should coalesce an already scheduled task during current task execution.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleAsapTask(taskB);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleAsapTask(taskA);
            scheduleAsapTask(taskB);
            fireMicrotaskEvent();
            assertLogs([
                _EventLogs.AddMicrotask,
                _EventLogs.FireMicrotask,
                'A',
                'B'
            ])
        });

        it('Should execute all tasks despise of error.', () => {
            const error = new Error()
            const taskA = createTaskObject(() => {
                logEvent('A');
                throw error;
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleAsapTask(taskA);
            scheduleAsapTask(taskB);
            expect(() => fireMicrotaskEvent()).toThrow(error);
            assertLogs([
                _EventLogs.AddMicrotask,
                _EventLogs.FireMicrotask,
                'A',
                'B'
            ]);
        });

        it('Should coalesce an already scheduled task during current task execution, despise of error.', () => {
            const error = new Error()
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleAsapTask(taskB);
                throw error
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleAsapTask(taskA);
            scheduleAsapTask(taskB);
            expect(() => fireMicrotaskEvent()).toThrow(error);
            assertLogs([
                _EventLogs.AddMicrotask,
                _EventLogs.FireMicrotask,
                'A',
                'B'
            ])
        });
    });

    describe('Async scheduler.', () => {
        let scheduleAsyncTask: (task: _Task) => void;
        let fireTimeoutEvent: () => void;
        let fireAnimationFrameEvent: () => void;

        const baseLogs = [
            _EventLogs.SetTimeout,
            _EventLogs.RequestAnimationFrame,
            _EventLogs.FireTimeout,
            _EventLogs.CancelAnimationFrame
        ];

        beforeEach(() => {
            scheduleAsyncTask = m._scheduleAsyncTask;
            fireTimeoutEvent = m.fireTimeoutEvent;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
        })

        it('Should schedule task by timeout event.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAsyncTask(task);
            assertLogs([ _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
            fireTimeoutEvent();
            assertLogs([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A' ]);
        });

        it('Should schedule task on animation frame.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAsyncTask(task);
            assertLogs([ _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.ClearTimeout, 'A' ]);
        });

        it('Should run cleanup for once executed rescheduled task.', () => {
            const task = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            scheduleAsyncTask(task);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A' ]);
            scheduleAsyncTask(task);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A_cleanup', 'A' ]);
        });

        it('Should run callback and cleanup within an owning context associated with the task.', () => {
            const owner = createRoot(() => getOwner());
            const task = createTaskObject(
                () => {
                    logEvent('B');
                    expect(getOwner()).toBe(owner);
                },
                () => {
                    logEvent('A');
                    expect(getOwner()).toBe(owner);
                },
                owner
            );
            assertLogs([])
            scheduleAsyncTask(task);
            assertLogs([ _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.ClearTimeout, 'A', 'B' ]);
        });

        it('Should schedule multiple tasks', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleAsyncTask(taskA);
            scheduleAsyncTask(taskB);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should run cleanup for multiple once executed rescheduled tasks.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                return () => logEvent('B_cleanup');
            });
            scheduleAsyncTask(taskA);
            scheduleAsyncTask(taskB);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
            scheduleAsyncTask(taskA);
            scheduleAsyncTask(taskB);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A_cleanup', 'A', 'B_cleanup', 'B' ]);
        });

        it('Should update signals in a single batch.', () => {
            const [source1, setSource1] = createSignal(false);
            const [source2, setSource2] = createSignal(false);
            const [source3, setSource3] = createSignal(false);
            const [source4, setSource4] = createSignal(false);
            const task1 = createTaskObject(
                () => { setSource1(true); },
                () => { setSource2(true); }
            );
            const task2 = createTaskObject(
                () => { setSource3(true); },
                () => { setSource4(true); }
            );
            let init = false;
            createComputed(() => {
                source1();
                source2();
                source3();
                source4();
                if (init) {
                    logEvent('A')
                } else {
                    init = true;
                }
            });

            scheduleAsyncTask(task1);
            scheduleAsyncTask(task2);
            assertLogs([ _EventLogs.SetTimeout, _EventLogs.RequestAnimationFrame ]);
            fireTimeoutEvent();
            assertLogs([ _EventLogs.FireTimeout, _EventLogs.CancelAnimationFrame, 'A' ]);
        });

        it('Should coalesce single task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            scheduleAsyncTask(task);
            assertLogs(baseLogs.slice(0, 2));
            scheduleAsyncTask(task);
            assertLogs([]);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs.slice(2), 'A' ]);
        });

        it('Should not run canceled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            scheduleAsyncTask(task)
            cancelTask(task);
            fireTimeoutEvent();
            assertLogs(baseLogs);
        });

        it('Should run previous canceled rescheduled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            scheduleAsyncTask(task)
            cancelTask(task);
            scheduleAsyncTask(task);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A' ]);
        });

        it('Should run only not canceled tasks', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            const taskC = createTaskObject(() => logEvent('C'));
            const scheduleAll = () => {
                scheduleAsyncTask(taskA);
                scheduleAsyncTask(taskB);
                scheduleAsyncTask(taskC);
            }

            scheduleAll();
            cancelTask(taskA);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'B', 'C' ]);

            scheduleAll();
            cancelTask(taskB);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A', 'C' ]);

            scheduleAll();
            cancelTask(taskC);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should reschedule task during its own execution.', () => {
            let rescheduled = false;
            const taskA = createTaskObject(() => {
                logEvent('A');
                if (rescheduled) { return; }
                rescheduled = true;
                scheduleAsyncTask(taskA);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleAsyncTask(taskA);
            scheduleAsyncTask(taskB);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A', 'B', 'A' ]);
        });

        it('Should run all task despise of error.', () => {
            const error = new Error();
            const taskA = createTaskObject(() => {
                logEvent('A');
                throw error;
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleAsyncTask(taskA);
            scheduleAsyncTask(taskB);
            expect(() => fireTimeoutEvent()).toThrow(error);
            assertLogs([ ...baseLogs, 'A', 'B'  ]);
        });

        it('Should coalesce an already scheduled task during current task execution', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleAsyncTask(taskB);
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleAsyncTask(taskA);
            scheduleAsyncTask(taskB);
            fireTimeoutEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should coalesce an already scheduled task during current task execution, despise of error', () => {
            const error = new Error();
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleAsyncTask(taskB);
                throw error
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleAsyncTask(taskA);
            scheduleAsyncTask(taskB);
            expect(() => fireTimeoutEvent()).toThrow(error);
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

    });

    describe('Animation frame scheduler.', () => {

        let scheduleAnimationFrameTask: (task: _Task) => void;
        let fireAnimationFrameEvent: () => void;

        beforeEach(() => {
            scheduleAnimationFrameTask = m._scheduleAnimationFrameTask;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
        });

        it('Should task be scheduled.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAnimationFrameTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A' ]);
        });

        it('Should run cleanup for once executed rescheduled task.', () => {
            const task = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            assertLogs([]);
            scheduleAnimationFrameTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A' ]);
            scheduleAnimationFrameTask(task);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.FireAnimationFrame,
                'A_cleanup',
                'A'
            ]);
        });

        it('Should run callback and cleanup within an owning context associated with the task.', () => {
            const owner = createRoot(() => getOwner());
            const task = createTaskObject(
                () => {
                    logEvent('B');
                    expect(getOwner()).toBe(owner);
                },
                () => {
                    logEvent('A');
                    expect(getOwner()).toBe(owner);
                },
                owner
            );
            assertLogs([])
            scheduleAnimationFrameTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A', 'B' ]);
        });

        it('Should coalesce single task', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAnimationFrameTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            scheduleAnimationFrameTask(task);
            assertLogs([]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A' ]);
        });

        it('Should schedule multiple tasks.', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            assertLogs([]);
            scheduleAnimationFrameTask(taskA);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            scheduleAnimationFrameTask(taskB);
            assertLogs([]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A', 'B' ]);
        });

        it('Should run cleanup for multiple once executed rescheduled tasks.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                return () => logEvent('B_cleanup');
            });
            assertLogs([]);
            scheduleAnimationFrameTask(taskA);
            scheduleAnimationFrameTask(taskB);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A', 'B' ]);
            scheduleAnimationFrameTask(taskA);
            scheduleAnimationFrameTask(taskB);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.FireAnimationFrame,
                'A_cleanup',
                'A',
                'B_cleanup',
                'B'
            ]);
        });
        
        it('Should update signals in a single batch.', () => {
            const [source1, setSource1] = createSignal(false);
            const [source2, setSource2] = createSignal(false);
            const [source3, setSource3] = createSignal(false);
            const [source4, setSource4] = createSignal(false);
            const task1 = createTaskObject(
                () => { setSource1(true); },
                () => { setSource2(true); }
            );
            const task2 = createTaskObject(
                () => { setSource3(true); },
                () => { setSource4(true); }
            );
            let init = false;
            createComputed(() => {
                source1();
                source2();
                source3();
                source4();
                if (init) {
                    logEvent('A')
                } else {
                    init = true;
                }
            });

            scheduleAnimationFrameTask(task1);
            scheduleAnimationFrameTask(task2);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A' ]);
        });

        it('Should run previous canceled rescheduled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleAnimationFrameTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            cancelTask(task);
            scheduleAnimationFrameTask(task)
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A' ]);
        })

        it('Should run only not canceled tasks.', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            const taskC = createTaskObject(() => logEvent('C'));
            const scheduleAll = () => {
                scheduleAnimationFrameTask(taskA);
                scheduleAnimationFrameTask(taskB);
                scheduleAnimationFrameTask(taskC);
            }
            const baseLogs = [ _EventLogs.RequestAnimationFrame, _EventLogs.FireAnimationFrame ]

            scheduleAll();
            cancelTask(taskA);
            fireAnimationFrameEvent();
            assertLogs([ ...baseLogs, 'B', 'C' ]);

            scheduleAll();
            cancelTask(taskB);
            fireAnimationFrameEvent();
            assertLogs([ ...baseLogs, 'A', 'C' ]);

            scheduleAll();
            cancelTask(taskC);
            fireAnimationFrameEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should schedule next task during current task execution to the second batch.', () => {
            const taskA = createTaskObject(() => {
                scheduleAnimationFrameTask(taskB)
                logEvent('A');
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleAnimationFrameTask(taskA);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.FireAnimationFrame,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'B'
            ]);
        });

        test('Task scheduled during task execution should be executed its on separated batch (4 Tasks, 4 batches).', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleAnimationFrameTask(taskB);
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                scheduleAnimationFrameTask(taskC);
            });
            const taskC = createTaskObject(() => {
                logEvent('C');
                scheduleAnimationFrameTask(taskD)
            });
            const taskD = createTaskObject(() => logEvent('D'));
            scheduleAnimationFrameTask(taskA);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.FireAnimationFrame,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'B',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'C',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'D',
            ]);
        });

        it('Should reschedule task during this task execution without any problem to the second batch.', () => {
            let rescheduled = false
            const taskA = createTaskObject(() => {
                logEvent('A');
                if (rescheduled) { return; }
                rescheduled = true;
                scheduleAnimationFrameTask(taskA);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleAnimationFrameTask(taskA);
            scheduleAnimationFrameTask(taskB);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.FireAnimationFrame,
                'A',
                'B',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'A'
            ]);
        });

        it('Should coalesce an already scheduled task during current task execution.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleAnimationFrameTask(taskB);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleAnimationFrameTask(taskA);
            scheduleAnimationFrameTask(taskB);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.FireAnimationFrame,
                'A',
                'B'
            ])
        });

        it('Should execute all tasks despise of error.', () => {
            const error = new Error()
            const taskA = createTaskObject(() => {
                logEvent('A');
                throw error;
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleAnimationFrameTask(taskA);
            scheduleAnimationFrameTask(taskB);
            expect(() => fireAnimationFrameEvent()).toThrow(error);
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.FireAnimationFrame,
                'A',
                'B'
            ]);
        });

        it('Should coalesce an already scheduled task during current task execution, despise of error.', () => {
            const error = new Error()
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleAnimationFrameTask(taskB);
                throw error
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleAnimationFrameTask(taskA);
            scheduleAnimationFrameTask(taskB);
            expect(() => fireAnimationFrameEvent()).toThrow(error);
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.FireAnimationFrame,
                'A',
                'B'
            ]);
        });

    })

    describe('Post paint scheduler.', () => {

        let schedulePostPaintTask: (task: _Task) => void;
        let fireAnimationFrameEvent: () => void;

        const firePostPaintLogs = [ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame, _EventLogs.FireAnimationFrame ];

        function firePostPaintEvent(): void {
            fireAnimationFrameEvent();
            fireAnimationFrameEvent();
        }

        beforeEach(() => {
            schedulePostPaintTask = m._schedulePostPaintTask;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
        });

        it('Should task be scheduled.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            schedulePostPaintTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A' ]);
        });

        it('Should run cleanup for once executed rescheduled task.', () => {
            const task = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            assertLogs([]);
            schedulePostPaintTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A' ]);
            schedulePostPaintTask(task);
            firePostPaintEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A_cleanup',
                'A'
            ]);
        });

        it('Should run callback and cleanup within an owning context associated with the task.', () => {
            const owner = createRoot(() => getOwner());
            const task = createTaskObject(
                () => {
                    logEvent('B');
                    expect(getOwner()).toBe(owner);
                },
                () => {
                    logEvent('A');
                    expect(getOwner()).toBe(owner);
                },
                owner
            );
            assertLogs([])
            schedulePostPaintTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, 'A', 'B' ]);
        });

        it('Should coalesce single task', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            schedulePostPaintTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            schedulePostPaintTask(task);
            assertLogs([]);
            firePostPaintEvent();
            assertLogs([ ...firePostPaintLogs, 'A' ]);
        });

        it('Should schedule multiple tasks.', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            assertLogs([]);
            schedulePostPaintTask(taskA);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            schedulePostPaintTask(taskB);
            assertLogs([]);
            firePostPaintEvent();
            assertLogs([ ...firePostPaintLogs, 'A', 'B' ]);
        });

        it('Should run cleanup for multiple once executed rescheduled tasks.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                return () => logEvent('B_cleanup');
            });
            assertLogs([]);
            schedulePostPaintTask(taskA);
            schedulePostPaintTask(taskB);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            firePostPaintEvent();
            assertLogs([ ...firePostPaintLogs, 'A', 'B' ]);
            schedulePostPaintTask(taskA);
            schedulePostPaintTask(taskB);
            firePostPaintEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A_cleanup',
                'A',
                'B_cleanup',
                'B'
            ]);
        });

        it('Should update signals in a single batch.', () => {
            const [source1, setSource1] = createSignal(false);
            const [source2, setSource2] = createSignal(false);
            const [source3, setSource3] = createSignal(false);
            const [source4, setSource4] = createSignal(false);
            const task1 = createTaskObject(
                () => { setSource1(true); },
                () => { setSource2(true); }
            );
            const task2 = createTaskObject(
                () => { setSource3(true); },
                () => { setSource4(true); }
            );
            let init = false;
            createComputed(() => {
                source1();
                source2();
                source3();
                source4();
                if (init) {
                    logEvent('A')
                } else {
                    init = true;
                }
            });

            schedulePostPaintTask(task1);
            schedulePostPaintTask(task2);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            firePostPaintEvent()
            assertLogs([ ...firePostPaintLogs, 'A' ]);
        });

        it('Should be able to schedule a task after animation frame event for empty task queue.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            schedulePostPaintTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame ]);
            cancelTask(task);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame ]);
            schedulePostPaintTask(task);
            firePostPaintEvent();
            assertLogs([ 
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A'
            ]);
        });

        it('Should run previous canceled rescheduled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            schedulePostPaintTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            cancelTask(task);
            schedulePostPaintTask(task)
            firePostPaintEvent();
            assertLogs([ ...firePostPaintLogs, 'A' ]);
        })

        it('Should run only not canceled tasks.', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            const taskC = createTaskObject(() => logEvent('C'));
            const scheduleAll = () => {
                schedulePostPaintTask(taskA);
                schedulePostPaintTask(taskB);
                schedulePostPaintTask(taskC);
            }
            const baseLogs = [ _EventLogs.RequestAnimationFrame, ...firePostPaintLogs ]

            scheduleAll();
            cancelTask(taskA);
            firePostPaintEvent();
            assertLogs([ ...baseLogs, 'B', 'C' ]);

            scheduleAll();
            cancelTask(taskB);
            firePostPaintEvent();
            assertLogs([ ...baseLogs, 'A', 'C' ]);

            scheduleAll();
            cancelTask(taskC);
            firePostPaintEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should schedule next task during current task execution to the second batch.', () => {
            const taskA = createTaskObject(() => {
                schedulePostPaintTask(taskB)
                logEvent('A');
            });
            const taskB = createTaskObject(() => logEvent('B'));
            schedulePostPaintTask(taskA);
            firePostPaintEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            firePostPaintEvent();
            assertLogs([
                ...firePostPaintLogs,
                'B'
            ]);
        });

        test('Task scheduled during task execution should be executed its on separated batch (4 Tasks, 4 batches).', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                schedulePostPaintTask(taskB);
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                schedulePostPaintTask(taskC);
            });
            const taskC = createTaskObject(() => {
                logEvent('C');
                schedulePostPaintTask(taskD)
            });
            const taskD = createTaskObject(() => logEvent('D'));
            schedulePostPaintTask(taskA);
            firePostPaintEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            firePostPaintEvent();
            assertLogs([
                ...firePostPaintLogs,
                'B',
                _EventLogs.RequestAnimationFrame
            ]);
            firePostPaintEvent();
            assertLogs([
                ...firePostPaintLogs,
                'C',
                _EventLogs.RequestAnimationFrame
            ]);
            firePostPaintEvent();
            assertLogs([
                ...firePostPaintLogs,
                'D',
            ]);
        });

        it('Should schedule task to the second batch after animation frame event is fired.', () => {
            const task = createTaskObject(() => logEvent('A'));
            schedulePostPaintTask(task);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.RequestAnimationFrame, _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame ]);
            cancelTask(task);
            schedulePostPaintTask(task);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.RequestAnimationFrame ]);
            firePostPaintEvent();
            assertLogs([ ...firePostPaintLogs, 'A' ]);
        });


        it('Should reschedule task during this task execution without any problem to the second batch.', () => {
            let rescheduled = false
            const taskA = createTaskObject(() => {
                logEvent('A');
                if (rescheduled) { return; }
                rescheduled = true;
                schedulePostPaintTask(taskA);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            schedulePostPaintTask(taskA);
            schedulePostPaintTask(taskB);
            firePostPaintEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A',
                'B',
                _EventLogs.RequestAnimationFrame
            ]);
            firePostPaintEvent();
            assertLogs([
                ...firePostPaintLogs,
                'A'
            ]);
        });

        it('Should coalesce an already scheduled task during current task execution.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                schedulePostPaintTask(taskB);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            schedulePostPaintTask(taskA);
            schedulePostPaintTask(taskB);
            firePostPaintEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A',
                'B'
            ])
        });

        it('Should execute all tasks despise of error.', () => {
            const error = new Error()
            const taskA = createTaskObject(() => {
                logEvent('A');
                throw error;
            });
            const taskB = createTaskObject(() => logEvent('B'))
            schedulePostPaintTask(taskA);
            schedulePostPaintTask(taskB);
            expect(() => firePostPaintEvent()).toThrow(error);
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A',
                'B'
            ]);
        });

        it('Should coalesce an already scheduled task during current task execution, despise of error.', () => {
            const error = new Error()
            const taskA = createTaskObject(() => {
                logEvent('A');
                schedulePostPaintTask(taskB);
                throw error
            });
            const taskB = createTaskObject(() => logEvent('B'));
            schedulePostPaintTask(taskA);
            schedulePostPaintTask(taskB);
            expect(() => firePostPaintEvent()).toThrow(error);
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...firePostPaintLogs,
                'A',
                'B'
            ]);
        });
    });

    describe('Measure scheduler.', () => {

        let scheduleMeasureTask: (task: _Task) => void;
        let fireAnimationFrameEvent: () => void;
        let fireTimeoutEvent: () => void

        const fireMeasureEventLogs = [ _EventLogs.FireAnimationFrame, _EventLogs.SetTimeout, _EventLogs.FireTimeout ];

        function fireMeasureEvent(): void {
            fireAnimationFrameEvent();
            fireTimeoutEvent();
        }

        beforeEach(() => {
            scheduleMeasureTask = m._scheduleMeasureTask;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
            fireTimeoutEvent = m.fireTimeoutEvent;
        });

        it('Should task be scheduled.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleMeasureTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.SetTimeout ]);
            fireTimeoutEvent();
            assertLogs([_EventLogs.FireTimeout, 'A']);
        });

        it('Should run cleanup for once executed rescheduled task.', () => {
            const task = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            assertLogs([]);
            scheduleMeasureTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.SetTimeout ]);
            fireTimeoutEvent();
            assertLogs([ _EventLogs.FireTimeout, 'A' ]);
            scheduleMeasureTask(task);
            fireMeasureEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A_cleanup',
                'A'
            ]);
        });

        it('Should run callback and cleanup within an owning context associated with the task.', () => {
            const owner = createRoot(() => getOwner());
            const task = createTaskObject(
                () => {
                    logEvent('B');
                    expect(getOwner()).toBe(owner);
                },
                () => {
                    logEvent('A');
                    expect(getOwner()).toBe(owner);
                },
                owner
            );
            assertLogs([])
            scheduleMeasureTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.SetTimeout ]);
            fireTimeoutEvent();
            assertLogs([_EventLogs.FireTimeout, 'A', 'B']);
        });

        it('Should coalesce single task', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleMeasureTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            scheduleMeasureTask(task);
            assertLogs([]);
            fireMeasureEvent();
            assertLogs([ ...fireMeasureEventLogs, 'A' ]);
        });

        it('Should schedule multiple tasks.', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            assertLogs([]);
            scheduleMeasureTask(taskA);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            scheduleMeasureTask(taskB);
            assertLogs([]);
            fireMeasureEvent();
            assertLogs([ ...fireMeasureEventLogs, 'A', 'B' ]);
        });

        it('Should run cleanup for multiple once executed rescheduled tasks.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                return () => logEvent('B_cleanup');
            });
            assertLogs([]);
            scheduleMeasureTask(taskA);
            scheduleMeasureTask(taskB);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireMeasureEvent();
            assertLogs([ ...fireMeasureEventLogs, 'A', 'B' ]);
            scheduleMeasureTask(taskA);
            scheduleMeasureTask(taskB);
            fireMeasureEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A_cleanup',
                'A',
                'B_cleanup',
                'B'
            ]);
        });

        it('Should update signals in a single batch.', () => {
            const [source1, setSource1] = createSignal(false);
            const [source2, setSource2] = createSignal(false);
            const [source3, setSource3] = createSignal(false);
            const [source4, setSource4] = createSignal(false);
            const task1 = createTaskObject(
                () => { setSource1(true); },
                () => { setSource2(true); }
            );
            const task2 = createTaskObject(
                () => { setSource3(true); },
                () => { setSource4(true); }
            );
            let init = false;
            createComputed(() => {
                source1();
                source2();
                source3();
                source4();
                if (init) {
                    logEvent('A')
                } else {
                    init = true;
                }
            });

            scheduleMeasureTask(task1);
            scheduleMeasureTask(task2);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireMeasureEvent();
            assertLogs([ ...fireMeasureEventLogs, 'A' ]);
        });

        it('Should be able to schedule a task after animation frame event for empty task queue.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleMeasureTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.FireAnimationFrame, _EventLogs.SetTimeout ]);
            cancelTask(task);
            fireTimeoutEvent();
            assertLogs([ _EventLogs.FireTimeout ]);
            scheduleMeasureTask(task);
            fireMeasureEvent();
            assertLogs([ 
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A'
            ]);
        });

        it('Should run previous canceled rescheduled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            assertLogs([]);
            scheduleMeasureTask(task);
            assertLogs([ _EventLogs.RequestAnimationFrame ]);
            cancelTask(task);
            scheduleMeasureTask(task)
            fireMeasureEvent();
            assertLogs([ ...fireMeasureEventLogs, 'A' ]);
        })

        it('Should run only not canceled tasks.', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            const taskC = createTaskObject(() => logEvent('C'));
            const scheduleAll = () => {
                scheduleMeasureTask(taskA);
                scheduleMeasureTask(taskB);
                scheduleMeasureTask(taskC);
            }
            const baseLogs = [ _EventLogs.RequestAnimationFrame, ...fireMeasureEventLogs ]

            scheduleAll();
            cancelTask(taskA);
            fireMeasureEvent();
            assertLogs([ ...baseLogs, 'B', 'C' ]);

            scheduleAll();
            cancelTask(taskB);
            fireMeasureEvent();
            assertLogs([ ...baseLogs, 'A', 'C' ]);

            scheduleAll();
            cancelTask(taskC);
            fireMeasureEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should schedule next task during current task execution to the second batch.', () => {
            const taskA = createTaskObject(() => {
                scheduleMeasureTask(taskB)
                logEvent('A');
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleMeasureTask(taskA);
            fireMeasureEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            fireMeasureEvent();
            assertLogs([
                ...fireMeasureEventLogs,
                'B'
            ]);
        });

        test('Task scheduled during task execution should be executed its on separated batch (4 Tasks, 4 batches).', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleMeasureTask(taskB);
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                scheduleMeasureTask(taskC);
            });
            const taskC = createTaskObject(() => {
                logEvent('C');
                scheduleMeasureTask(taskD)
            });
            const taskD = createTaskObject(() => logEvent('D'));
            scheduleMeasureTask(taskA);
            fireMeasureEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            fireMeasureEvent();
            assertLogs([
                ...fireMeasureEventLogs,
                'B',
                _EventLogs.RequestAnimationFrame
            ]);
            fireMeasureEvent();
            assertLogs([
                ...fireMeasureEventLogs,
                'C',
                _EventLogs.RequestAnimationFrame
            ]);
            fireMeasureEvent();
            assertLogs([
                ...fireMeasureEventLogs,
                'D',
            ]);
        });

        it('Should schedule task to the second batch after animation frame event is fired.', () => {
            const task = createTaskObject(() => logEvent('A'));
            scheduleMeasureTask(task);
            fireAnimationFrameEvent();
            assertLogs([ _EventLogs.RequestAnimationFrame, _EventLogs.FireAnimationFrame, _EventLogs.SetTimeout ]);
            cancelTask(task);
            scheduleMeasureTask(task);
            fireTimeoutEvent();
            assertLogs([ _EventLogs.FireTimeout, _EventLogs.RequestAnimationFrame ]);
            fireMeasureEvent();
            assertLogs([ ...fireMeasureEventLogs, 'A' ]);
        });


        it('Should reschedule task during this task execution without any problem to the second batch.', () => {
            let rescheduled = false
            const taskA = createTaskObject(() => {
                logEvent('A');
                if (rescheduled) { return; }
                rescheduled = true;
                scheduleMeasureTask(taskA);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleMeasureTask(taskA);
            scheduleMeasureTask(taskB);
            fireMeasureEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A',
                'B',
                _EventLogs.RequestAnimationFrame
            ]);
            fireMeasureEvent();
            assertLogs([
                ...fireMeasureEventLogs,
                'A'
            ]);
        });

        it('Should coalesce an already scheduled task during current task execution.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleMeasureTask(taskB);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleMeasureTask(taskA);
            scheduleMeasureTask(taskB);
            fireMeasureEvent();
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A',
                'B'
            ])
        });

        it('Should execute all tasks despise of error.', () => {
            const error = new Error()
            const taskA = createTaskObject(() => {
                logEvent('A');
                throw error;
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleMeasureTask(taskA);
            scheduleMeasureTask(taskB);
            expect(() => fireMeasureEvent()).toThrow(error);
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A',
                'B'
            ]);
        });

        it('Should coalesce an already scheduled task during current task execution, despise of error.', () => {
            const error = new Error()
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleMeasureTask(taskB);
                throw error
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleMeasureTask(taskA);
            scheduleMeasureTask(taskB);
            expect(() => fireMeasureEvent()).toThrow(error);
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                ...fireMeasureEventLogs,
                'A',
                'B'
            ]);
        });
    });

    describe('Concurrent scheduler.', () => {

        const baseLogs = [ _EventLogs.PostMessage, _EventLogs.FireOnMessage ];

        let scheduleConcurrentTask: (task: _Task) => void;
        let fireMessageEvent: () => void;

        beforeEach(() => {
            scheduleConcurrentTask = m._scheduleConcurrentTask;
            fireMessageEvent = m.fireMessageEvent;
        });

        it('Should schedule task without any problem.', () => {
            const task = createTaskObject(() => {logEvent('A')});
            assertLogs([]);
            scheduleConcurrentTask(task);
            assertLogs([ _EventLogs.PostMessage ]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'A' ])
        });

        
        it('Should execute second task on second message event if the first one reach breakpoint.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                advanceTime(16);
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            assertLogs([ _EventLogs.PostMessage ]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'A', _EventLogs.PostMessage ]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'B' ]);
        });

        it('Should execute that task what was scheduled in previous executed task on the second message event, if breakpoint was reached', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleConcurrentTask(taskB);
                advanceTime(16);
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleConcurrentTask(taskA);
            assertLogs([ _EventLogs.PostMessage ]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'A', _EventLogs.PostMessage ]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'B' ]);
        });

        it('Should execute task immediately if the deadline has been reached.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                advanceTime(250);
            })
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            assertLogs([ _EventLogs.PostMessage ]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'A', 'B' ]);
        });

        it('Should execute that task what was scheduled in previous executed task in current message event, if deadline was reached', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                advanceTime(250);
                scheduleConcurrentTask(taskB);
            })
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleConcurrentTask(taskA);
            assertLogs([ _EventLogs.PostMessage ]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'A', 'B' ]);
        });

        it('Should run cleanup for once executed rescheduled task.', () => {
            const task = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            scheduleConcurrentTask(task);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A' ]);
            scheduleConcurrentTask(task);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A_cleanup', 'A' ]);
        });

        it('Should run callback and cleanup within an owning context associated with the task.', () => {
            const owner = createRoot(() => getOwner());
            const task = createTaskObject(
                () => {
                    logEvent('B');
                    expect(getOwner()).toBe(owner);
                },
                () => {
                    logEvent('A');
                    expect(getOwner()).toBe(owner);
                },
                owner
            );
            assertLogs([])
            scheduleConcurrentTask(task)
            assertLogs([ _EventLogs.PostMessage ]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'A', 'B' ]);
        });

        it('Should schedule multiple tasks', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should run cleanup for multiple once executed rescheduled tasks.', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                return () => logEvent('A_cleanup');
            });
            const taskB = createTaskObject(() => {
                logEvent('B');
                return () => logEvent('B_cleanup');
            });
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A_cleanup', 'A', 'B_cleanup', 'B' ]);
        });

        it('Should coalesce single task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            scheduleConcurrentTask(task);
            assertLogs([ _EventLogs.PostMessage ]);
            scheduleConcurrentTask(task);
            assertLogs([]);
            fireMessageEvent();
            assertLogs([ _EventLogs.FireOnMessage, 'A' ]);
        });

        it('Should not run canceled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            scheduleConcurrentTask(task)
            cancelTask(task);
            fireMessageEvent();
            assertLogs(baseLogs);
        });

        it('Should run previous canceled rescheduled task.', () => {
            const task = createTaskObject(() => logEvent('A'));
            scheduleConcurrentTask(task)
            cancelTask(task);
            scheduleConcurrentTask(task);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A' ]);
        });

        it('Should run only not canceled tasks', () => {
            const taskA = createTaskObject(() => logEvent('A'));
            const taskB = createTaskObject(() => logEvent('B'));
            const taskC = createTaskObject(() => logEvent('C'));
            const scheduleAll = () => {
                scheduleConcurrentTask(taskA);
                scheduleConcurrentTask(taskB);
                scheduleConcurrentTask(taskC);
            }

            scheduleAll();
            cancelTask(taskA);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'B', 'C' ]);

            scheduleAll();
            cancelTask(taskB);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A', 'C' ]);

            scheduleAll();
            cancelTask(taskC);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should reschedule task during its own execution.', () => {
            let rescheduled = false;
            const taskA = createTaskObject(() => {
                logEvent('A');
                if (rescheduled) { return; }
                rescheduled = true;
                scheduleConcurrentTask(taskA);
            });
            const taskB = createTaskObject(() => logEvent('B'))
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A', 'B', 'A' ]);
        });

        it('Should run all task despise of error.', () => {
            const error = new Error();
            const taskA = createTaskObject(() => {
                logEvent('A');
                throw error;
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            expect(() => fireMessageEvent()).toThrow(error);
            fireMessageEvent();
            // expect(() => fireMessageEvent()).toThrow(error);
            assertLogs([ ...baseLogs, 'A', ...baseLogs, 'B' ]);
        });

        it('Should coalesce an already scheduled task during current task execution', () => {
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleConcurrentTask(taskB);
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            fireMessageEvent();
            assertLogs([ ...baseLogs, 'A', 'B' ]);
        });

        it('Should coalesce an already scheduled task during current task execution, despise of error', () => {
            const error = new Error();
            const taskA = createTaskObject(() => {
                logEvent('A');
                scheduleConcurrentTask(taskB);
                throw error
            });
            const taskB = createTaskObject(() => logEvent('B'));
            scheduleConcurrentTask(taskA);
            scheduleConcurrentTask(taskB);
            expect(() => fireMessageEvent()).toThrow(error);
            fireMessageEvent()
            assertLogs([ ...baseLogs, 'A', ...baseLogs, 'B' ]);
        });

    });

    describe('Post paint scheduler with async scheduler.', () => {

        let scheduleAsyncTask: (task: _Task) => void;
        let schedulePostPaintTask: (task: _Task) => void;
        let fireAnimationFrameEvent: () => void;
        let fireTimeoutEvent: () => void;

        beforeEach(() => {
            scheduleAsyncTask = m._scheduleAsyncTask;
            schedulePostPaintTask = m._schedulePostPaintTask;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
            fireTimeoutEvent = m.fireTimeoutEvent;
        })

        test('During async task execution on animation frame event, the post paint task should be scheduled only by one requestAnimationTime() function.', () => {
            const asyncTask = createTaskObject(() => {
                logEvent('A');
                schedulePostPaintTask(postPaintTask);
            })
            const postPaintTask = createTaskObject(() => logEvent('B'));
            scheduleAsyncTask(asyncTask);
            assertLogs([
                _EventLogs.SetTimeout,
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                _EventLogs.ClearTimeout,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'B'
            ]);
        });

        test('During async task execution on timeout event, the post paint task should be scheduled normally (raf -> raf)', () => {
            const asyncTask = createTaskObject(() => {
                logEvent('A');
                schedulePostPaintTask(postPaintTask);
            })
            const postPaintTask = createTaskObject(() => logEvent('B'));
            scheduleAsyncTask(asyncTask);
            assertLogs([
                _EventLogs.SetTimeout,
                _EventLogs.RequestAnimationFrame
            ]);
            fireTimeoutEvent();
            assertLogs([
                _EventLogs.FireTimeout,
                _EventLogs.CancelAnimationFrame,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'B'
            ]);
        });
    });

    describe('Post paint scheduler with animation frame scheduler', () => {
        let scheduleAnimationFrameTask: (task: _Task) => void;
        let schedulePostPaintTask: (task: _Task) => void;
        let fireAnimationFrameEvent: () => void;

        beforeEach(() => {
            scheduleAnimationFrameTask = m._scheduleAnimationFrameTask;
            schedulePostPaintTask = m._schedulePostPaintTask;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
        })

        test('During animation frame task execution, the post paint task should be scheduled only by one requestAnimationTime() function.', () => {
            const rafTask = createTaskObject(() => {
                logEvent('A');
                schedulePostPaintTask(postPaintTask);
            })
            const postPaintTask = createTaskObject(() => logEvent('B'));
            scheduleAnimationFrameTask(rafTask);
            assertLogs([
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'B'
            ]);
        });
    });

    describe('Measure scheduler with async scheduler.', () => {

        let scheduleAsyncTask: (task: _Task) => void;
        let scheduleMeasureTask: (task: _Task) => void;
        let fireAnimationFrameEvent: () => void;
        let fireTimeoutEvent: () => void;

        beforeEach(() => {
            scheduleAsyncTask = m._scheduleAsyncTask;
            scheduleMeasureTask = m._scheduleMeasureTask;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
            fireTimeoutEvent = m.fireTimeoutEvent;
        });

        test('During async task execution on animation frame event, the measure task should be scheduled only by setTimeout() function.', () => {
            const asyncTask = createTaskObject(() => {
                logEvent('A');
                scheduleMeasureTask(measureTask);
            })
            const measureTask = createTaskObject(() => logEvent('B'));
            scheduleAsyncTask(asyncTask);
            assertLogs([
                _EventLogs.SetTimeout,
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                _EventLogs.ClearTimeout,
                'A',
                _EventLogs.SetTimeout
            ]);
            fireTimeoutEvent();
            assertLogs([
                _EventLogs.FireTimeout,
                'B'
            ]);
        });

        test('During async task execution on timeout event, the measure task should be scheduled normally (raf -> setTimeout)', () => {
            const asyncTask = createTaskObject(() => {
                logEvent('A');
                scheduleMeasureTask(measureTask);
            })
            const measureTask = createTaskObject(() => logEvent('B'));
            scheduleAsyncTask(asyncTask);
            assertLogs([
                _EventLogs.SetTimeout,
                _EventLogs.RequestAnimationFrame
            ]);
            fireTimeoutEvent();
            assertLogs([
                _EventLogs.FireTimeout,
                _EventLogs.CancelAnimationFrame,
                'A',
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                _EventLogs.SetTimeout
            ]);
            fireTimeoutEvent();
            assertLogs([
                _EventLogs.FireTimeout,
                'B'
            ]);
        });
    });

    describe('Measure scheduler with animation frame scheduler.', () => {
        let scheduleAnimationFrameTask: (task: _Task) => void;
        let scheduleMeasureTask: (task: _Task) => void;
        let fireAnimationFrameEvent: () => void;
        let fireTimeoutEvent: () => void;

        beforeEach(() => {
            scheduleAnimationFrameTask = m._scheduleAnimationFrameTask;
            scheduleMeasureTask = m._scheduleMeasureTask;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
            fireTimeoutEvent = m.fireTimeoutEvent;
        });

        test('During async task execution on animation frame event, the measure task should be scheduled only by setTimeout() function.', () => {
            const asyncTask = createTaskObject(() => {
                logEvent('A');
                scheduleMeasureTask(measureTask);
            })
            const measureTask = createTaskObject(() => logEvent('B'));
            scheduleAnimationFrameTask(asyncTask);
            assertLogs([
                _EventLogs.RequestAnimationFrame
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                'A',
                _EventLogs.SetTimeout
            ]);
            fireTimeoutEvent();
            assertLogs([
                _EventLogs.FireTimeout,
                'B'
            ]);
        });
    });

    describe('Animation frame scheduler with async scheduler.', () => {
        let scheduleAnimationFrameTask: (task: _Task) => void;
        let scheduleAsyncTask: (task: _Task) => void;
        let fireAnimationFrameEvent: () => void;

        beforeEach(() => {
            scheduleAnimationFrameTask = m._scheduleAnimationFrameTask;
            scheduleAsyncTask = m._scheduleAsyncTask;
            fireAnimationFrameEvent = m.fireAnimationFrameEvent;
        });

        it('Should execute async task always before raf task.', () => {
            const asyncTask = createTaskObject(() => logEvent('A'));
            const rafTask = createTaskObject(() => logEvent('B'));

            scheduleAsyncTask(asyncTask);
            scheduleAnimationFrameTask(rafTask);
            assertLogs([
                _EventLogs.SetTimeout,
                _EventLogs.RequestAnimationFrame,
                _EventLogs.RequestAnimationFrame,
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                _EventLogs.ClearTimeout,
                'A',
                _EventLogs.CancelAnimationFrame,
                'B'
            ]);
            scheduleAnimationFrameTask(rafTask);
            scheduleAsyncTask(asyncTask);
            assertLogs([
                _EventLogs.RequestAnimationFrame,
                _EventLogs.SetTimeout,
                _EventLogs.RequestAnimationFrame,
            ]);
            fireAnimationFrameEvent();
            assertLogs([
                _EventLogs.FireAnimationFrame,
                _EventLogs.ClearTimeout,
                _EventLogs.CancelAnimationFrame,
                'A',
                'B'
            ])
        })
    })

});