import type { BridgeErrorBody, BridgeFailureResponse, BridgeSuccessResponse } from './types.js';

export function successResponse<T>(requestId: string, result: T): BridgeSuccessResponse<T> {
  return { version: 1, requestId, ok: true, result };
}

export function errorResponse(requestId: string, error: BridgeErrorBody): BridgeFailureResponse {
  return { version: 1, requestId, ok: false, error };
}
