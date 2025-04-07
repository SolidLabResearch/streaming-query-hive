import { CSPARQLWindow, QuadContainer, WindowInstance } from "./s2r";
import { Quad } from "n3";


type Window = {
    open: number;
    close: number;

}
export class TemporalJoinOperator {

    private result_window_slide: number;
    private result_window_size: number;
    private result_window_start: number;


    constructor(slide: number, size: number, t0: number) {
        this.result_window_slide = slide;
        this.result_window_size = size;
        this.result_window_start = t0;

    }
    public temporalJoin(windowLeft: CSPARQLWindow, windowRight: CSPARQLWindow): [Window, QuadContainer][] {
        const joinedResults: [Window, QuadContainer][] = [];

        for (let t = this.result_window_start + this.result_window_slide; t <= t + this.result_window_size; t += this.result_window_slide) {
            const windowStart = t - this.result_window_size;
            const windowEnd = t;

            const eventsLeft = this.collectEventsInWindow(windowLeft, windowStart, windowEnd);
            const eventsRight = this.collectEventsInWindow(windowRight, windowStart, windowEnd);

            
            
            const merged = this.mergeEvents(eventsLeft, eventsRight);

            if (merged.elements.size > 0) {
                joinedResults.push([
                    {
                        open: windowStart, close: windowEnd
                    },
                    merged
                ]);
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
            metadata: { type: ['true-temporal-join'], joined: true },
        };
    }
}