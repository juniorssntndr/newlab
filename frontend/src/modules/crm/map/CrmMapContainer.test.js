import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('./CrmMapContainer.jsx', import.meta.url), 'utf8');
const { code } = transformSync(source, {
    loader: 'jsx', format: 'cjs',
    define: { 'import.meta.env': JSON.stringify({ VITE_GOOGLE_MAPS_API_KEY: 'test-only' }) },
});

// Exercise the component's effects without a DOM or a billable Maps request.
const harness = ({ reject = false, setupThrows = false } = {}) => {
    const slots = [], effects = [], maps = [], markers = [], clusters = [], imports = [];
    let cursor = 0, dirty = false, optionsCalls = 0, resolve;
    const ready = new Promise((done) => { resolve = done; });
    const react = {
        createElement: (_type, props, ...children) => {
            if (props?.ref) props.ref.current = {};
            return { props, children };
        },
        useRef: (initial) => slots[cursor++] ||= { current: initial },
        useState: (initial) => {
            const index = cursor++;
            if (!(index in slots)) slots[index] = initial;
            return [slots[index], (value) => { slots[index] = value; dirty = true; }];
        },
        useEffect: (run, deps) => {
            const index = cursor++;
            const previous = slots[index];
            if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
                effects.push(() => {
                    previous?.cleanup?.();
                    slots[index] = { deps, run, cleanup: run() };
                });
            }
        },
    };
    class Map {
        constructor() { maps.push(this); }
        panTo(value) { this.center = value; }
        setZoom(value) { this.zoom = value; }
    }
    class Marker {
        constructor(options) { this.options = options; markers.push(this); }
        addListener(_event, callback) { this.click = callback; }
        setMap(value) { this.map = value; }
    }
    class MarkerClusterer {
        constructor(options) { Object.assign(this, options); clusters.push(this); }
        clearMarkers() { this.markers = []; }
        setMap(value) { this.map = value; }
    }
    const google = { maps: { Map, Marker, Size: class {}, event: {
        clearInstanceListeners: (instance) => { instance.cleared = true; },
    } } };
    const loader = {
        Loader: require('@googlemaps/js-api-loader').Loader,
        setOptions: () => { optionsCalls++; if (setupThrows) throw new Error('setup failed'); },
        importLibrary: async (name) => {
            imports.push(name);
            await ready;
            if (reject) throw new Error('private loader details');
            return google.maps;
        },
    };
    const module = { exports: {} };
    new Function('require', 'module', 'exports', 'window', code)(
        (name) => name === 'react' ? react : name === '@googlemaps/js-api-loader' ? loader : { MarkerClusterer },
        module, module.exports, { google },
    );
    const point = { id: 1, nombre: 'Synthetic clinic', etapa: 'nuevo', latitud: -12, longitud: -77 };
    let selected;
    const props = { establishments: [point], selectedEstablishment: point, onSelectEstablishment: (item) => { selected = item; } };
    let tree;
    const render = () => {
        cursor = 0; dirty = false;
        tree = module.exports.CrmMapContainer(props);
        effects.splice(0).forEach((run) => run());
    };
    const flush = async () => {
        await new Promise((done) => setImmediate(done));
        if (dirty) render();
    };
    const cleanup = () => slots.forEach((slot) => slot?.cleanup?.());
    return { render, flush, resolve, cleanup, maps, markers, clusters, imports, point, props,
        text: () => JSON.stringify(tree), optionsCalls: () => optionsCalls,
        selected: () => selected,
        replayEffects: () => { cleanup(); slots.forEach((slot) => { if (slot?.run) slot.cleanup = slot.run(); }); },
    };
};

const loaded = harness();
loaded.render();
loaded.replayEffects(); // React StrictMode cleanup/setup while imports are pending.
loaded.resolve();
await loaded.flush();
assert.equal(loaded.optionsCalls(), 1);
assert.deepEqual([...new Set(loaded.imports)], ['maps', 'marker']);
assert.equal(loaded.maps.length, 1);
assert.equal(loaded.markers.length, 1, 'Preloaded points render when the async map becomes ready');
assert.equal(loaded.maps[0].zoom, 15, 'Preselected point centers after map readiness');
loaded.markers[0].click();
assert.equal(loaded.selected(), loaded.point);
loaded.props.establishments = [];
loaded.render();
assert.equal(loaded.clusters[0].map, null, 'Filter updates detach old clusterer');
assert.equal(loaded.markers[0].cleared, true);
loaded.cleanup();
assert.equal(loaded.maps[0].cleared, true);

for (const scenario of [{ reject: true }, { setupThrows: true }]) {
    const failed = harness(scenario);
    failed.render(); failed.resolve(); await failed.flush();
    assert.match(failed.text(), /ERROR_LOADING_MAP/);
    assert.doesNotMatch(failed.text(), /private loader details/);
    assert.equal(failed.maps.length, 0);
    failed.cleanup();
}
const cancelled = harness();
cancelled.render(); cancelled.cleanup(); cancelled.resolve(); await cancelled.flush();
assert.equal(cancelled.maps.length, 0, 'Unmount before resolution must not construct a map');
console.log('PASS: Maps v2 initialization, readiness, StrictMode, selection, filter cleanup, rejection and unmount');
