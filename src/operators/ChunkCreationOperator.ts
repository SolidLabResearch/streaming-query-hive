import { CSPARQLWindow, QuadContainer } from "./s2r";
import { Quad } from "n3";

type Window = {
    open: number;
    close: number;
};

function gcd(a: number, b: number): number {
    while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

function findGCDofWindows(windows: [Window, QuadContainer][]): number {
    const widths = windows.map(([win]) => win.close - win.open);
    return widths.reduce((acc, val) => gcd(acc, val));
}

export class ChunkCreationOperator {
    private result_window_start: number;

    constructor(t0: number) {
        this.result_window_start = t0;
    }

    public temporalJoin(windowLeft: CSPARQLWindow, windowRight: CSPARQLWindow): [Window, QuadContainer][] {
        const joinedResults: [Window, QuadContainer][] = [];

        const allWindowInstances = [...windowLeft.active_windows, ...windowRight.active_windows];
        const maxCloseTime = Math.max(...allWindowInstances.map(([win]) => win.close));
        const minOpenTime = Math.min(...allWindowInstances.map(([win]) => win.open));

        const gcdWidth = findGCDofWindows(allWindowInstances);

        for (let t = this.result_window_start; t + gcdWidth <= maxCloseTime; t += gcdWidth) {
            const windowStart = t;
            const windowEnd = t + gcdWidth;

            const eventsLeft = this.collectEventsInWindow(windowLeft, windowStart, windowEnd);
            const eventsRight = this.collectEventsInWindow(windowRight, windowStart, windowEnd);

            if (eventsLeft.length > 0 && eventsRight.length > 0) {
                const merged = this.mergeEvents(eventsLeft, eventsRight);
                if (merged.elements.size > 0) {
                    joinedResults.push([
                        { open: windowStart, close: windowEnd },
                        merged
                    ]);
                }
            }
        }

        return joinedResults;
    }

    private collectEventsInWindow(window: CSPARQLWindow, start: number, end: number): Quad[] {
        const collected: Quad[] = [];

        for (const [win, container] of window.active_windows) {
            const overlap = (win.open < end && win.close > start);
            if (overlap) {
                collected.push(...container.elements);
            }
        }

        return collected;
    }

    private mergeEvents(a: Quad[], b: Quad[]): any {
        const set = new Set<Quad>([...a, ...b]);
        return {
            elements: set,
            timestamp: Date.now(),
            metadata: { type: ['gcd-temporal-join'], joined: true },
        };
    }
}
