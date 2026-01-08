import type { ViewState } from "../types/common.js";
import type { Transform } from "../types/internal.js";
/**
 * Capture a transform's current state
 * @param transform
 * @returns descriptor of the view state
 */
export declare function transformToViewState(tr: Transform): ViewState;
/** Returns `true` if the given props can potentially override view state updates */
export declare function isViewStateControlled(v: Partial<ViewState>): boolean;
/**
 * Returns `true` if transform needs to be updated to match view state
 */
export declare function compareViewStateWithTransform(tr: Transform, v: Partial<ViewState>): boolean;
/**
 * Mutate a transform to match the given view state. Should reverse `transformToViewState`
 * @param transform
 * @param viewState
 */
export declare function applyViewStateToTransform(tr: Transform, v: Partial<ViewState>): void;
//# sourceMappingURL=transform.d.ts.map