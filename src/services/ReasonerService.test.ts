import { ReasonerService } from "./ReasonerService";

describe("ReasonerService", () => {
    test("test the reasoning service", async () => {
        const rules = `
        @prefix ex:<http://example.org/rules#> .
        {?s ?p ?o} => {?s ?o ?p} .
        `;

        const data = `
        <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> .
        `;
        const reasoner = new ReasonerService(rules);
        const result = await reasoner.reason(data);
        expect(result).toContain("<http://example.org/s1> <http://example.org/o1> <http://example.org/p1>");
    });


    test("testing the reasoning service with digits", async () => {
        const rules = `
    @prefix math: <http://www.w3.org/2000/10/swap/math#>.
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
    @prefix ex: <http://example.org/#>.
    {?s <https://saref.etsi.org/core/hasValue> ?o . ?o math:notLessThan 6} => {?s ex:is ex:standing}.
    `;
        const data = `<https://rsp.js/aggregation_event/1> <https://saref.etsi.org/core/hasValue> "10"^^<http://www.w3.org/2001/XMLSchema#float> .`
        const reasoner = new ReasonerService(rules);
        const result = await reasoner.reason(data);
        expect(result).toContain("<https://rsp.js/aggregation_event/1> <http://example.org/#is> <http://example.org/#standing>");
    });
});