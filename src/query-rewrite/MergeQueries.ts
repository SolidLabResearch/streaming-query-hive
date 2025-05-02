/**
 *
 */
export class MergeQueries {
    rspql_queries: string[];
    mergeType: "UNION" | "JOIN";

    /**
     *
     * @param rspql_queries
     * @param mergeType
     */
    constructor(rspql_queries: string[], mergeType: "UNION" | "JOIN") {

        if (mergeType !== "UNION" && mergeType !== "JOIN") {
            throw new Error("Invalid merge type. Must be 'UNION' or 'JOIN'.");
        }
        if (!Array.isArray(rspql_queries) || rspql_queries.length === 0) {
            throw new Error("Invalid queries. Must be a non-empty array of strings.");
        }
        if (rspql_queries.length < 2) {
            throw new Error("At least two queries are required for merging.");
        }

        this.rspql_queries = rspql_queries;
        this.mergeType = mergeType;
    }

    /**
     *
     */
    private merge(): string {
        switch (this.mergeType) {
            case "UNION":
                return this.mergeWithUnion();
            case "JOIN":
                return this.mergeWithJoin();
            default:
                throw new Error("Invalid merge type. Must be 'UNION' or 'JOIN'.");

        }
    }

    /**
     *
     */
    private mergeWithUnion(): string {
        return this.rspql_queries.join(" UNION ");
    }

    /**
     *
     */
    private mergeWithJoin(): string {
        return this.rspql_queries.join(" JOIN ");
    }

}