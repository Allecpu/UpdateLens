import { HttpRequest, HttpResponseInit, InvocationContext, Timer } from '@azure/functions';
/**
 * HTTP Trigger - for manual refresh via API or UI button
 */
export declare function refreshAllHttp(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit>;
/**
 * Timer Trigger - monthly scheduled refresh (1st day of month, 02:00 UTC)
 */
export declare function refreshAllTimer(myTimer: Timer, context: InvocationContext): Promise<void>;
