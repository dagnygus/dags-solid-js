import { _createNotifier } from "./utils";

describe('Utils', () => {

    describe('_createNotifier()', () => {
        
        it('Should notify all listeners.', () => {
            const log: string[] = [];
            const notifier = _createNotifier();

            notifier.add(() => log.push('A'));
            notifier.add(() => log.push('B'));
            notifier.add(() => log.push('C'));

            notifier.notify();
            expect(log).toEqual([ 'A', 'B', 'C' ]);
            log.splice(0);
            notifier.notify();
            expect(log).toEqual([ 'A', 'B', 'C' ]);
        });

        it('Should not notify unregistered listener.', () => {
            const log: string[] = [];
            const notifier = _createNotifier();

            notifier.add(() => log.push('A'))
            const unregister = notifier.add(() => log.push('B'))
            notifier.add(() => log.push('C'))

            notifier.notify();
            expect(log).toEqual([ 'A', 'B', 'C' ]);
            log.splice(0);
            unregister();
            notifier.notify();
            expect(log).toEqual([ 'A', 'C' ]);
        });

        it('Should notify all listeners despise of error.', () => {
            const log: string[] = [];
            const notifier = _createNotifier();

            notifier.add(() => log.push('A'))
            notifier.add(() => {
                log.push('B');
                throw new Error();
            })
            notifier.add(() => log.push('C'));

            expect(() => notifier.notify()).toThrow();
            expect(log).toEqual([ 'A', 'B', 'C' ]);
            log.splice(0);
            expect(() => notifier.notify()).toThrow();
            expect(log).toEqual([ 'A', 'B', 'C' ]);
        });

        it('Should notify all listeners even if current executing listener is removing it self from the notifier.', () => {
            const log: string[] = [];
            const notifier = _createNotifier();

            notifier.add(() => log.push('A'))
            const unregister = notifier.add(() => {
                unregister();
                log.push('B');
            })
            notifier.add(() => log.push('C'))

            notifier.notify();
            expect(log).toEqual([ 'A', 'B', 'C' ]);
            log.splice(0);
            notifier.notify();
            expect(log).toEqual([ 'A', 'C' ]);
        });

        it('Should notify all listeners even if current executing listener is removing previous listener.', () => {
            const log: string[] = [];
            const notifier = _createNotifier();

            const unregister = notifier.add(() => log.push('A'))
            notifier.add(() => {
                unregister();
                log.push('B')
            });
            notifier.add(() => log.push('C'))

            notifier.notify();
            expect(log).toEqual([ 'A', 'B', 'C' ]);
            log.splice(0);
            notifier.notify();
            expect(log).toEqual([ 'B', 'C' ]);
        });

        it('Should pass args to listeners!', () => {
            const log: string[] = [];
            const notifier = _createNotifier<[...number[]]>();

            notifier.add((...args) => {
                let l = 'A'
                for (const arg of args) {
                    l = l + arg;
                }
                log.push(l)
            });
            notifier.add((...args) => {
                let l = 'B'
                for (const arg of args) {
                    l = l + arg;
                }
                log.push(l)
            });
            notifier.add((...args) => {
                let l = 'C'
                for (const arg of args) {
                    l = l + arg;
                }
                log.push(l)
            });

            notifier.notify(0);
            expect(log).toEqual([ 'A0', 'B0', 'C0' ]);
            log.splice(0);
            notifier.notify(0, 1);
            expect(log).toEqual([ 'A01', 'B01', 'C01' ]);
            log.splice(0);
            notifier.notify(0, 1, 2);
            expect(log).toEqual([ 'A012', 'B012', 'C012' ]);
        });

        it('Should not notify listeners if it is disposed!', () => {
            const log: string[] = [];
            const notifier = _createNotifier();

            notifier.add(() => log.push('A'));
            notifier.add(() => log.push('B'));
            notifier.add(() => log.push('C'));

            notifier.dispose();
            notifier.notify();
            expect(log).toEqual([]);
            notifier.add(() => log.push('D'));
            notifier.notify();
            expect(log).toEqual([]);
        });

        test('_Notifier.count() should return the number of listeners.', () => {
            const notifier = _createNotifier();

            expect(notifier.count()).toBe(0);
            const remove1 = notifier.add(() => {});
            expect(notifier.count()).toBe(1);
            const remove2 = notifier.add(() => {});
            expect(notifier.count()).toBe(2);
            const remove3 = notifier.add(() => {});
            expect(notifier.count()).toBe(3);
            const remove4 = notifier.add(() => {});
            expect(notifier.count()).toBe(4);
            const remove5 = notifier.add(() => {});
            expect(notifier.count()).toBe(5);
            
            remove3();
            expect(notifier.count()).toBe(4);
            remove5();
            expect(notifier.count()).toBe(3);
            remove1();
            expect(notifier.count()).toBe(2);
            remove4();
            expect(notifier.count()).toBe(1);
            remove2();
            expect(notifier.count()).toBe(0);
        });

        it('Should immediately stop notifying if args contain only Event instance and stopImmediatePropagation() has been invoked!', () => {
            const log: string[] = [];
            const notifier = _createNotifier<[Event]>();

            notifier.add(() => log.push('A'));
            notifier.add(() => log.push('B'));
            notifier.add((e) => (e.stopImmediatePropagation(), log.push('C')));
            notifier.add(() => log.push('D'));

            notifier.notify(new Event('Foo'));

            expect(log).toEqual([ 'A', 'B', 'C' ]);
        })

    });

});