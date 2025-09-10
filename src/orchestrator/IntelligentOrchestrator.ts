import { RSPAgent } from "../agent/RSPAgent";
import { BeeKeeper } from "../services/BeeKeeper";
import { HTTPServer } from "../services/server/HTTPServer";
import { HiveScoutBeeWrapper } from "../services/HiveScoutBee";
import { ApproachRecommendation } from "../util/Types";
import config from '../config/httpServerConfig.json';
import { hash_string_md5 } from "../util/Util";

/**
 * Enhanced Orchestrator with intelligent approach selection
 * Uses Hive Scout Bee to analyze stream patterns and recommend optimal approaches
 * Supports both automatic stream analysis and manual approach specification
 */
export class IntelligentOrchestrator {
    private subQueriesToRun: string[];
    private registeredQuery: string;
    private beeKeeper: BeeKeeper;
    private operatorType: string;
    private http_server: HTTPServer;
    private scoutBee: HiveScoutBeeWrapper;
    private streamAnalysisEnabled: boolean;
    private lastRecommendation: ApproachRecommendation | null = null;
    private analysisHistory: ApproachRecommendation[] = [];
    private manualApproach: string | null = null;
    private analysisMode: 'automatic' | 'manual' | 'hybrid' = 'automatic';

    constructor(operatorType: string, enableStreamAnalysis: boolean = true) {
        this.subQueriesToRun = [];
        this.registeredQuery = "";
        this.beeKeeper = new BeeKeeper();
        this.http_server = new HTTPServer(config.port, console);
        this.operatorType = operatorType;
        this.streamAnalysisEnabled = enableStreamAnalysis;
        this.scoutBee = new HiveScoutBeeWrapper();
        
        console.log(`Intelligent Orchestrator started on port ${config.port}`);
        console.log(`Stream analysis: ${enableStreamAnalysis ? 'ENABLED' : 'DISABLED'}`);
        console.log(`Analysis mode: ${this.analysisMode}`);
    }

    /**
     * Set analysis mode for approach selection
     * @param mode - 'automatic' for stream analysis, 'manual' for specified approach, 'hybrid' for both
     */
    setAnalysisMode(mode: 'automatic' | 'manual' | 'hybrid'): void {
        this.analysisMode = mode;
        console.log(`Analysis mode changed to: ${mode}`);
    }

    /**
     * Set manual approach to use (only effective in 'manual' or 'hybrid' mode)
     * @param approach - The approach to use manually
     */
    setManualApproach(approach: 'approximation-approach' | 'fetching-client-side' | 'chunked-approach' | 'streaming-query-hive' | 'default'): void {
        this.manualApproach = approach;
        console.log(`Manual approach set to: ${approach}`);
    }

    /**
     * Get current analysis mode
     */
    getAnalysisMode(): 'automatic' | 'manual' | 'hybrid' {
        return this.analysisMode;
    }

    /**
     * Get current manual approach (if set)
     */
    getManualApproach(): string | null {
        return this.manualApproach;
    }

    /**
     * Toggle stream analysis on/off
     */
    toggleStreamAnalysis(enabled: boolean): void {
        this.streamAnalysisEnabled = enabled;
        console.log(`Stream analysis: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    /**
     * Add sub-query with optional stream analysis
     */
    addSubQuery(query: string): void {
        this.subQueriesToRun.push(query);
        const query_hash = hash_string_md5(query);

        const queryAgent = new RSPAgent(query, `chunked/${query_hash}`);
        queryAgent.process_streams()
            .then(() => {
                console.log(`Added sub-query: ${query}`);
            })
            .catch((error: Error) => {
                console.error(`Error processing sub-query "${query}":`, error);
            });
    }

    /**
     * Register output query with intelligent approach selection
     */
    registerOutputQuery(query: string): void {
        this.registeredQuery = query;
        console.log(`Registered output query: ${query}`);
        
        if (this.streamAnalysisEnabled) {
            console.log(`Stream analysis will be performed to optimize approach selection`);
        }
    }

    /**
     * Analyze stream data and add to scout bee analysis window
     */
    analyzeStreamData(timestamp: number, value: number, topic: string): void {
        if (!this.streamAnalysisEnabled) return;
        
        this.scoutBee.addDataPoint(timestamp, value, topic);
    }

    /**
     * Get approach recommendation based on current stream analysis
     */
    async getApproachRecommendation(queryComplexity: number = 5): Promise<ApproachRecommendation | null> {
        if (!this.streamAnalysisEnabled) return null;

        try {
            // Get recommendation using the wrapper
            const recommendation = this.scoutBee.getApproachRecommendation();
            
            if (!recommendation) {
                console.log(`Could not generate recommendation`);
                return null;
            }

            this.lastRecommendation = recommendation;
            this.analysisHistory.push(recommendation);
            
            // Keep only recent history
            if (this.analysisHistory.length > 10) {
                this.analysisHistory.shift();
            }

            this.logRecommendation(recommendation);
            return recommendation;
            
        } catch (error) {
            console.error(`Error during approach recommendation:`, error);
            return null;
        }
    }

    /**
     * Run registered query with intelligent approach selection
     */
    async runRegisteredQueryIntelligent(forceApproach?: string): Promise<void> {
        if (this.registeredQuery === "") {
            console.log("No registered query to run.");
            return;
        }

        let selectedApproach = forceApproach || this.operatorType;

        // Determine approach based on analysis mode
        if (!forceApproach) {
            selectedApproach = await this.selectApproachBasedOnMode();
        }

        // Execute with selected approach
        this.beeKeeper.executeQuery(
            this.registeredQuery, 
            "output", 
            selectedApproach, 
            this.subQueriesToRun
        );
        
        console.log(`Running registered query with approach: ${selectedApproach}`);
    }

    /**
     * Select approach based on current analysis mode
     */
    private async selectApproachBasedOnMode(): Promise<string> {
        switch (this.analysisMode) {
            case 'manual':
                if (this.manualApproach) {
                    console.log(`Using manual approach: ${this.manualApproach}`);
                    return this.mapApproachToOperatorType(this.manualApproach);
                } else {
                    console.log(`No manual approach set, using default: ${this.operatorType}`);
                    return this.operatorType;
                }

            case 'automatic':
                if (this.streamAnalysisEnabled) {
                    const queryComplexity = this.estimateQueryComplexity(this.registeredQuery);
                    const recommendation = await this.getApproachRecommendation(queryComplexity);
                    
                    if (recommendation && recommendation.confidence > 0.6) {
                        const selectedApproach = this.mapApproachToOperatorType(recommendation.recommendedApproach);
                        console.log(`Using automatic recommendation: ${selectedApproach} (confidence: ${(recommendation.confidence * 100).toFixed(1)}%)`);
                        return selectedApproach;
                    } else {
                        console.log(`Low confidence recommendation, using default: ${this.operatorType}`);
                        return this.operatorType;
                    }
                } else {
                    console.log(`Stream analysis disabled, using default: ${this.operatorType}`);
                    return this.operatorType;
                }

            case 'hybrid':
                // Try automatic first, fall back to manual if available
                if (this.streamAnalysisEnabled) {
                    const queryComplexity = this.estimateQueryComplexity(this.registeredQuery);
                    const recommendation = await this.getApproachRecommendation(queryComplexity);
                    
                    if (recommendation && recommendation.confidence > 0.7) {
                        const selectedApproach = this.mapApproachToOperatorType(recommendation.recommendedApproach);
                        console.log(`Using automatic recommendation (hybrid mode): ${selectedApproach} (confidence: ${(recommendation.confidence * 100).toFixed(1)}%)`);
                        return selectedApproach;
                    }
                }
                
                // Fall back to manual approach
                if (this.manualApproach) {
                    console.log(`Falling back to manual approach (hybrid mode): ${this.manualApproach}`);
                    return this.mapApproachToOperatorType(this.manualApproach);
                } else {
                    console.log(`No high-confidence recommendation or manual approach, using default: ${this.operatorType}`);
                    return this.operatorType;
                }

            default:
                return this.operatorType;
        }
    }

    /**
     * Get stream analysis summary
     */
    getAnalysisSummary(): any {
        const summary: any = {
            analysisMode: this.analysisMode,
            streamAnalysisEnabled: this.streamAnalysisEnabled,
            manualApproach: this.manualApproach,
            lastRecommendation: this.lastRecommendation,
            historyLength: this.analysisHistory.length
        };

        if (!this.streamAnalysisEnabled && this.analysisMode !== 'manual') {
            summary['warning'] = 'Stream analysis is disabled but analysis mode is not manual';
        }

        if (this.analysisMode === 'manual' && !this.manualApproach) {
            summary['warning'] = 'Manual mode is set but no manual approach specified';
        }

        if (this.analysisHistory.length > 0) {
            const recentRecommendations = this.analysisHistory.slice(-5);
            const approachCounts = recentRecommendations.reduce((acc, rec) => {
                acc[rec.recommendedApproach] = (acc[rec.recommendedApproach] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const avgConfidence = recentRecommendations.reduce((sum, rec) => sum + rec.confidence, 0) / recentRecommendations.length;

            summary['recentApproaches'] = approachCounts;
            summary['averageConfidence'] = avgConfidence;
        }

        return summary;
    }

    /**
     * Clear sub-queries
     */
    clearSubQueries(): void {
        this.subQueriesToRun = [];
        console.log("Cleared all sub-queries.");
    }

    /**
     * Run sub-queries
     */
    runSubQueries(): void {
        if (this.subQueriesToRun.length === 0) {
            console.log("No queries to run.");
            return;
        }
        
        this.subQueriesToRun.forEach(query => {
            const hash = hash_string_md5(query);
            const queryAgent = new RSPAgent(query, `chunked/${hash}`);
            queryAgent.process_streams()
                .then(() => {
                    console.log(`Starting query: ${query}`);
                })
                .catch((error: Error) => {
                    console.error(`Error processing query "${query}":`, error);
                });
        });
    }

    /**
     * Legacy method for backward compatibility
     */
    runRegisteredQuery(): void {
        this.runRegisteredQueryIntelligent();
    }

    // Private helper methods

    private getRecentStreamData(): Array<{timestamp: number, value: number}> {
        // This would be implemented to get recent data from the scout bee's analysis window
        // For now, returning empty array - in real implementation, this would access
        // the scout bee's internal data
        return [];
    }

    private estimateQueryComplexity(query: string): number {
        // Simple complexity estimation based on query characteristics
        let complexity = 1;
        
        // Count aggregation functions
        const aggFunctions = (query.match(/\b(SUM|AVG|MAX|MIN|COUNT)\b/gi) || []).length;
        complexity += aggFunctions * 2;
        
        // Count JOIN operations
        const joins = (query.match(/\bJOIN\b/gi) || []).length;
        complexity += joins * 3;
        
        // Count FILTER operations
        const filters = (query.match(/\bFILTER\b/gi) || []).length;
        complexity += filters;
        
        // Count window operations
        const windows = (query.match(/\bWINDOW\b/gi) || []).length;
        complexity += windows * 2;
        
        return Math.min(complexity, 10);
    }

    private mapApproachToOperatorType(approach: string): string {
        const mapping: Record<string, string> = {
            'approximation': 'approximation-approach',
            'fetching': 'fetching-client-side',
            'chunked': 'chunked-approach', 
            'hive': 'streaming-query-hive'
        };
        
        return mapping[approach] || this.operatorType;
    }

    private logRecommendation(recommendation: ApproachRecommendation): void {
        console.log(`\n=== APPROACH RECOMMENDATION ===`);
        console.log(`Recommended: ${recommendation.recommendedApproach.toUpperCase()}`);
        console.log(`Confidence: ${(recommendation.confidence * 100).toFixed(1)}%`);
        console.log(`Scores:`);
        Object.entries(recommendation.scores).forEach(([approach, score]) => {
            console.log(`   ${approach}: ${score}`);
        });
        console.log(`Reasoning:`);
        recommendation.reasoning.forEach(reason => {
            console.log(`   • ${reason}`);
        });
        console.log(`Stream Type: ${recommendation.signature.classification.streamType}`);
        console.log(`Data Rate: ${recommendation.signature.temporal.dataRate.toFixed(2)} Hz`);
        console.log(`Volatility: ${(recommendation.signature.patterns.volatility * 100).toFixed(1)}%`);
        console.log(`Aliasing Risk: ${recommendation.signature.classification.aliasing_risk}`);
        console.log(`================================\n`);
    }
}
