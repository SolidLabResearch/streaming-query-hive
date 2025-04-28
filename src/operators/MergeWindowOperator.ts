import { CSPARQLWindow, QuadContainer, WindowInstance } from "./s2r";
// @ts-ignore
import { Quad } from "n3";

/**
 *
 */
export class MergeWindowOperator {
    /**
     *
     * @param windowLeft
     * @param windowRight
     */
    public mergeJoin(windowLeft: CSPARQLWindow, windowRight: CSPARQLWindow): [WindowInstance, QuadContainer][] {

        const joinedResults: [WindowInstance, QuadContainer][] = [];

        for (const [windowOne, quadsOne] of windowLeft.active_windows) {
            for (const [windowTwo, quadsTwo] of windowRight.active_windows) {
                const overlap = this.windowsOverlap(windowOne, windowTwo);
                if (overlap) {
                    const newWindow: any = {
                        open: Math.max(windowOne.open, windowTwo.open),
                        close: Math.min(windowOne.close, windowTwo.close),
                    }

                    const mergedQuadContainer = this.mergeQuadContainers(quadsOne, quadsTwo);

                    joinedResults.push([newWindow, mergedQuadContainer]);
                }

            }
        }

        return joinedResults
    }

    /**
     *
     * @param windowOne
     * @param windowTwo
     */
    private windowsOverlap(windowOne: WindowInstance, windowTwo: WindowInstance): boolean {
        return windowOne.open < windowTwo.close && windowTwo.open < windowOne.close;
    }

    /**
     *
     * @param quadContainerOne
     * @param quadContainerTwo
     */
    private mergeQuadContainers(quadContainerOne: QuadContainer, quadContainerTwo: QuadContainer): any {
        const allQuads = new Set<Quad>();

        for (const quad of quadContainerOne.elements) {
            allQuads.add(quad);
        }

        for (const quad of quadContainerTwo.elements) {
            allQuads.add(quad);
        }


        return {
            elements: allQuads,
            timestamp: Date.now(),
            metadata: {
                type: ['temporal-join'],
                joined: true
            }
        }

    }
}