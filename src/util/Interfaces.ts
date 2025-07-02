export interface IQueryOperator {
    addSubQuery(query: string) : void;
    addOutputQuery(query: string): void;
    init(): Promise<void>;
    handleAggregation(): Promise<void>;
}