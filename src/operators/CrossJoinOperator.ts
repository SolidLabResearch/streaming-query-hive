import { CSPARQLWindow, Event, QuadContainer, WindowInstance } from "./s2r";

export class CrossJoinOperator {
    private crossJoin(windowOne: CSPARQLWindow, windowTwo: CSPARQLWindow): any {
        const exportName = `window-join-${windowOne.name}-${windowTwo.name}`;


        for (const [windowOneInstance, QuadsOne] of windowOne.active_windows) {
            for (const [windowTwoInstance, QuadsTwo] of windowTwo.active_windows) {
                if (!this.windowsOverlap(windowOneInstance, windowTwoInstance)) {
                    continue;
                }

                const quadsWindowOne = QuadsOne.elements;
                const quadsWindowTwo = QuadsTwo.elements;

                const mergedQuads = new Set([
                    ...quadsWindowOne,
                    ...quadsWindowTwo,
                ]);

                const timestamp = Math.max(
                    windowOneInstance.close,
                    windowTwoInstance.close,
                )
                const combinedContainer = new QuadContainer(mergedQuads, timestamp);

                const joinContainerEvent = {
                    timestamp: Date.now(),
                    data: combinedContainer
                }

                return joinContainerEvent;
                // for (const quadWindowOne of quadsWindowOne) {
                //     for (const quadWindowTwo of quadsWindowTwo) {
                //         // can have other match / join logic but for now we just concatenate the quads together

                //     }
                // }
            }
        }
    }

    private windowsOverlap(windowOne: WindowInstance, windowTwo: WindowInstance): boolean {
        return !(windowOne.close <= windowTwo.open || windowTwo.close <= windowOne.open);
    }
}