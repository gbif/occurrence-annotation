import type { ViewState, PointLike, PaddingOptions, ImmutableLike, LngLatBoundsLike } from "../types/common.js";
import type { StyleSpecification, LightSpecification, TerrainSpecification, FogSpecification, ProjectionSpecification } from "../types/style-spec.js";
import type { MapInstance } from "../types/lib.js";
import type { Transform } from "../types/internal.js";
import type { MapCallbacks, ViewStateChangeEvent, MapEvent, MapMouseEvent } from "../types/events.js";
export type MapboxProps = Partial<ViewState> & MapCallbacks & {
    mapboxAccessToken?: string;
    /** Camera options used when constructing the Map instance */
    initialViewState?: Partial<ViewState> & {
        /** The initial bounds of the map. If bounds is specified, it overrides longitude, latitude and zoom options. */
        bounds?: LngLatBoundsLike;
        /** A fitBounds options object to use only when setting the bounds option. */
        fitBoundsOptions?: {
            offset?: PointLike;
            minZoom?: number;
            maxZoom?: number;
            padding?: number | PaddingOptions;
        };
    };
    /** If provided, render into an external WebGL context */
    gl?: WebGLRenderingContext;
    /** For external controller to override the camera state */
    viewState?: ViewState & {
        width: number;
        height: number;
    };
    /** Mapbox style */
    mapStyle?: string | StyleSpecification | ImmutableLike<StyleSpecification>;
    /** Enable diffing when the map style changes
     * @default true
     */
    styleDiffing?: boolean;
    /** The projection property of the style. Must conform to the Projection Style Specification.
     * @default 'mercator'
     */
    projection?: ProjectionSpecification | ProjectionSpecification['name'];
    /** The fog property of the style. Must conform to the Fog Style Specification .
     * If `undefined` is provided, removes the fog from the map. */
    fog?: FogSpecification;
    /** Light properties of the map. */
    light?: LightSpecification;
    /** Terrain property of the style. Must conform to the Terrain Style Specification .
     * If `undefined` is provided, removes terrain from the map. */
    terrain?: TerrainSpecification;
    /** Default layers to query on pointer events */
    interactiveLayerIds?: string[];
    /** CSS cursor */
    cursor?: string;
};
/**
 * A wrapper for mapbox-gl's Map class
 */
export default class Mapbox {
    private _MapClass;
    /** mapboxgl.Map instance */
    private _map;
    /** User-supplied props */
    props: MapboxProps;
    /** The transform that replaces native map.transform to resolve changes vs. React props
     * See proxy-transform.ts
     */
    private _proxyTransform;
    /** Making updates driven by React props. Do not trigger React callbacks to avoid infinite loop */
    private _internalUpdate;
    /** Map is currently rendering */
    private _inRender;
    /** Map features under the pointer */
    private _hoveredFeatures;
    /** View state changes driven by React props
     * They still need to fire move/etc. events because controls such as marker/popup
     * subscribe to the move event internally to update their position
     * React callbacks like onMove are not called for these */
    private _deferredEvents;
    static savedMaps: Mapbox[];
    constructor(MapClass: {
        new (options: any): MapInstance;
    }, props: MapboxProps, container: HTMLDivElement);
    get map(): MapInstance;
    get transform(): Transform;
    setProps(props: MapboxProps): void;
    static reuse(props: MapboxProps, container: HTMLDivElement): Mapbox;
    _initialize(container: HTMLDivElement): void;
    recycle(): void;
    destroy(): void;
    redraw(): void;
    _createProxyTransform(map: any): void;
    _updateSize(nextProps: MapboxProps): boolean;
    _updateViewState(nextProps: MapboxProps, triggerEvents: boolean): boolean;
    _updateSettings(nextProps: MapboxProps, currProps: MapboxProps): boolean;
    _updateStyle(nextProps: MapboxProps, currProps: MapboxProps): boolean;
    _updateStyleComponents(nextProps: MapboxProps, currProps: MapboxProps): boolean;
    _updateHandlers(nextProps: MapboxProps, currProps: MapboxProps): boolean;
    _onEvent: (e: MapEvent) => void;
    private _queryRenderedFeatures;
    _updateHover(e: MapMouseEvent): void;
    _onPointerEvent: (e: MapMouseEvent) => void;
    _onCameraEvent: (e: ViewStateChangeEvent) => void;
    _fireEvent(baseFire: Function, event: string | MapEvent, properties?: object): MapInstance;
    _fireDefferedEvents(): void;
}
//# sourceMappingURL=mapbox.d.ts.map