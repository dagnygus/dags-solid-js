import { _createElementIterator, _createNotifier } from "./utils";

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

    describe('_createElementIterator()', () => {

        afterEach(() => {
            Array.from(document.body.childNodes).forEach((node) => node.remove())
        })

        it('Should iterate over DOM elements.', () => {
            const container = document.body.appendChild(document.createElement('div'));
            container.setAttribute('dummy-attr1', 'dummy-val1');
            container.appendChild(document.createTextNode('Foo'));
            const child1 = container.appendChild(document.createElement('div'));
            child1.setAttribute('dummy-attr2', 'dummy-val2');
            child1.appendChild(document.createTextNode('Baz'));
            container.appendChild(document.createTextNode('Fiz'));
            const child2 = container.appendChild(document.createElement('span'));
            child2.setAttribute('dummy-attr3', 'dummy-val3');
            child2.appendChild(document.createTextNode('Jazz'));
            container.appendChild(document.createTextNode('Sass'));
            const child3 = container.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
            child3.setAttribute('dummy-attr4', 'dummy-val4');
            child3.appendChild(document.createTextNode('Zaz'));
            container.appendChild(document.createTextNode('Fix'));
            const child4 = container.appendChild(document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math'));
            child4.setAttribute('dummy-attr5', 'dummy-val5');
            child4.appendChild(document.createTextNode('Gaz'));
            container.appendChild(document.createTextNode('Jiz'));

            const log: any[] = [];
            const iterator = _createElementIterator(container, () => 1);

            let element: Element | null;
            while (element = iterator.nextElement()) {
                log.push(element);
            }

            expect(log).toBeEach([ container, child1, child2, child3, child4 ]);

            log.splice(0)
            iterator.reset();

            while (element = iterator.nextElement()) {
                log.push(element);
            }

            expect(log).toBeEach([ container, child1, child2, child3, child4 ]);
        });

        it('Should iterate over DOM elements across branches.', () => {
            const parent = document.body.appendChild(document.createElement('div'));
            const child1 = parent.appendChild(document.createElement('div'));
            const child2 = parent.appendChild(document.createElement('div'));
            const child3 = parent.appendChild(document.createElement('div'));
            const grandchild11 = child1.appendChild(document.createElement('div'));
            const grandchild12 = child1.appendChild(document.createElement('div'));
            const grandchild13 = child1.appendChild(document.createElement('div'));
            const grandchild21 = child2.appendChild(document.createElement('div'));
            const grandchild22 = child2.appendChild(document.createElement('div'));
            const grandchild23 = child2.appendChild(document.createElement('div'));
            const grandchild31 = child3.appendChild(document.createElement('div'));
            const grandchild32 = child3.appendChild(document.createElement('div'));
            const grandchild33 = child3.appendChild(document.createElement('div'));

            const log: any[] = [];
            const iterator = _createElementIterator(parent, () => 1);

            let element: Element | null; 
            while (element = iterator.nextElement()) {
                log.push(element);
            }

            expect(log).toBeEach([
                parent,
                child1,
                grandchild11,
                grandchild12,
                grandchild13,
                child2,
                grandchild21,
                grandchild22,
                grandchild23,
                child3,
                grandchild31,
                grandchild32,
                grandchild33,
            ]);

            log.splice(0);
            iterator.reset();

            while (element = iterator.nextElement()) {
                log.push(element);
            }

            expect(log).toBeEach([
                parent,
                child1,
                grandchild11,
                grandchild12,
                grandchild13,
                child2,
                grandchild21,
                grandchild22,
                grandchild23,
                child3,
                grandchild31,
                grandchild32,
                grandchild33,
            ]);
        })

        it('Should iterate over DOM elements across shadow dom boundaries.', () => {
            const root = document.body.appendChild(document.createElement('div'));
            const rootShadow = root.attachShadow({ mode: 'open' });
            const parent = rootShadow.appendChild(document.createElement('div'));
            const parentShadow = parent.attachShadow({ mode: 'open' });
            const child = parentShadow.appendChild(document.createElement('div'));
            const childShadow = child.attachShadow({ mode: 'open' });
            const grandchild = childShadow.appendChild(document.createElement('div'));
            const grandchildShadow = grandchild.attachShadow({ mode: 'open' });
            const lastDescendant = grandchildShadow.appendChild(document.createElement('div'));
            lastDescendant.attachShadow({ mode: 'open' });

            const secondChild = parent.appendChild(document.createElement('div'));
            const secondChildShadow = secondChild.attachShadow({ mode: 'open' });
            const secondGrandchild = secondChildShadow.appendChild(document.createElement('div'));
            const secondGrandchildShadow = secondGrandchild.attachShadow({ mode: 'open' });
            const secondLastDescendant = secondGrandchildShadow.appendChild(document.createElement('div'));
            secondLastDescendant.attachShadow({ mode: 'open' });

            const log: any[] = [];
            const iterator = _createElementIterator(parent, () => 1);

            let element: Element | null; 
            while (element = iterator.nextElement()) {
                log.push(element);
            }

            expect(log).toBeEach([ parent, child, grandchild, lastDescendant, secondChild, secondGrandchild, secondLastDescendant ]);

            log.splice(0);
            iterator.reset();

            while (element = iterator.nextElement()) {
                log.push(element);
            }

            expect(log).toBeEach([ parent, child, grandchild, lastDescendant, secondChild, secondGrandchild, secondLastDescendant ]);
        });
    });

});