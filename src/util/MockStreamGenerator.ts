import { CSPARQLWindow } from "../stream-operators/s2r";
const N3 = require('n3');

const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;

export class MockStreamGenerator {

    private window: CSPARQLWindow;
    constructor(window: CSPARQLWindow) {
        this.window = window;
    }

    public generateMockStream(number_of_events: number, window: CSPARQLWindow): void {
        for (let i = 0; i < number_of_events; i++) {
            const stream_element = quad(
                namedNode('https://rsp.js/test_subject_' + i),
                namedNode('http://rsp.js/test_property'),
                namedNode('http://rsp.js/test_object' + i),
                defaultGraph(),
            );
            window.add(stream_element, i);
        }
    }
}
