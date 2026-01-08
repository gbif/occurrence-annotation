import { applyViewStateToTransform, isViewStateControlled } from "../utils/transform.js";
// These are Transform class methods that:
// + do not mutate any view state properties
// + populate private members derived from view state properties
// They should always reflect the state of their owning instance and NOT trigger any proxied getter/setter
const unproxiedMethods = new Set([
    '_calcMatrices',
    '_calcFogMatrices',
    '_updateCameraState',
    '_updateSeaLevelZoom'
]);
export function createProxyTransform(tr) {
    let internalUpdate = false;
    let reactViewState = {};
    /**
     * Reflects view state set by react props
     * This is the transform seen by painter, style etc.
     */
    const controlledTransform = tr;
    /** Populated during camera move (handler/easeTo) if there is a discrepency between react props and proposed view state
     * This is the transform seen by Mapbox's input handlers
     */
    let proposedTransform = null;
    const handlers = {
        get(target, prop) {
            // Props added by us
            if (prop === '$reactViewState') {
                return reactViewState;
            }
            if (prop === '$proposedTransform') {
                return proposedTransform;
            }
            if (prop === '$internalUpdate') {
                return internalUpdate;
            }
            // Ugly - this method is called from HandlerManager bypassing zoom setter
            if (prop === '_setZoom') {
                return (z) => {
                    if (internalUpdate) {
                        proposedTransform?.[prop](z);
                    }
                    if (!Number.isFinite(reactViewState.zoom)) {
                        controlledTransform[prop](z);
                    }
                };
            }
            // Ugly - this method is called from HandlerManager and mutates transform._camera
            if (internalUpdate &&
                prop === '_translateCameraConstrained' &&
                isViewStateControlled(reactViewState)) {
                proposedTransform = proposedTransform || controlledTransform.clone();
            }
            if (unproxiedMethods.has(prop)) {
                // When this function is executed, it updates both transforms respectively
                return function (...parms) {
                    proposedTransform?.[prop](...parms);
                    controlledTransform[prop](...parms);
                };
            }
            // Expose the proposed transform to input handlers
            if (internalUpdate && proposedTransform) {
                return proposedTransform[prop];
            }
            // Expose the controlled transform to renderer, markers, and event listeners
            return controlledTransform[prop];
        },
        set(target, prop, value) {
            // Props added by us
            if (prop === '$reactViewState') {
                reactViewState = value;
                applyViewStateToTransform(controlledTransform, reactViewState);
                return true;
            }
            if (prop === '$proposedTransform') {
                proposedTransform = value;
                return true;
            }
            if (prop === '$internalUpdate') {
                internalUpdate = value;
                return true;
            }
            // Controlled props
            let controlledValue = value;
            if (prop === 'center' || prop === '_center') {
                if (Number.isFinite(reactViewState.longitude) || Number.isFinite(reactViewState.latitude)) {
                    // @ts-expect-error LngLat constructor is not typed
                    controlledValue = new value.constructor(reactViewState.longitude ?? value.lng, reactViewState.latitude ?? value.lat);
                }
            }
            else if (prop === 'zoom' || prop === '_zoom' || prop === '_seaLevelZoom') {
                if (Number.isFinite(reactViewState.zoom)) {
                    controlledValue = controlledTransform[prop];
                }
            }
            else if (prop === '_centerAltitude') {
                if (Number.isFinite(reactViewState.elevation)) {
                    controlledValue = controlledTransform[prop];
                }
            }
            else if (prop === 'pitch' || prop === '_pitch') {
                if (Number.isFinite(reactViewState.pitch)) {
                    controlledValue = controlledTransform[prop];
                }
            }
            else if (prop === 'bearing' || prop === 'rotation' || prop === 'angle') {
                if (Number.isFinite(reactViewState.bearing)) {
                    controlledValue = controlledTransform[prop];
                }
            }
            // During camera update, we save view states that are overriden by controlled values in proposedTransform
            if (internalUpdate && controlledValue !== value) {
                proposedTransform = proposedTransform || controlledTransform.clone();
            }
            if (internalUpdate && proposedTransform) {
                proposedTransform[prop] = value;
            }
            // controlledTransform is not exposed to view state mutation
            controlledTransform[prop] = controlledValue;
            return true;
        }
    };
    return new Proxy(tr, handlers);
}
//# sourceMappingURL=proxy-transform.js.map