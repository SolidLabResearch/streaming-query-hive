export type QueryEntry = {
    rspql_query: string;
    r2s_topic: string;
    data_topic: string;
    id: string;
};

export type QueryMap = Record<string, QueryEntry>;

export type ExtractedQuery = {
    rspql_query: string;
    r2s_topic: string;
};