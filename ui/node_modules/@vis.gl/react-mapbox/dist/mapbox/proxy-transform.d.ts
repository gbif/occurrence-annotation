import type { Transform } from "../types/internal.js";
import type { ViewState } from "../types/common.js";
/**
 * Mapbox map is stateful.
 * During method calls/user interactions, map.transform is mutated and deviate from user-supplied props.
 * In order to control the map reactively, we trap the transform mutations with a proxy,
 * which reflects the view state resolved from both user-supplied props and the underlying state
 */
export type ProxyTransform = Transform & {
    $internalUpdate: boolean;
    $proposedTransform: Transform | null;
    $reactViewState: Partial<ViewState>;
};
export declare function createProxyTransform(tr: Transform): ProxyTransform;
//# sourceMappingURL=proxy-transform.d.ts.map