This document outlines the core patterns for initializing and rendering a Google
Map using the `@vis.gl/react-google-maps` library, based on analysis of the
`examples-basic` configuration.

The primary pattern involves wrapping the entire application or map-consuming
component tree within the `<APIProvider>`, which securely handles the Google
Maps API Key and loads the necessary base libraries.

--------------------------------------------------------------------------------

## 1. Core Initialization Pattern: APIProvider

The `<APIProvider>` is mandatory for any application using the React Maps
components. It manages the API key, library loading, and context provision.

### Implementation

The API Key should be retrieved from a secure environment variable and passed to
the `apiKey` prop.

```tsx
import React from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';

// Best Practice: Retrieve API Key from environment or context
const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

const App = () => {
  if (!API_KEY) {
    return <div>Error: Google Maps API Key not configured.</div>;
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <BasicMapComponent />
    </APIProvider>
  );
};
```

### Gotcha: API Key Scope

The `APIProvider` must be mounted at a sufficiently high level in the component
tree such that all components relying on Google Maps context (like `<Map>`,
`<Marker>`, or custom hooks that use `useMap()`) are its descendants.

--------------------------------------------------------------------------------

## 2. Basic Map Rendering and Configuration

The `<Map>` component is used to render the base map instance. It accepts
standard Google Maps initialization options as declarative props.

### Implementation Example

This example demonstrates setting the initial view (center and zoom), enabling
specific gesture handling for touch devices, and disabling the default controls
for a custom UI experience.

```tsx
import React from 'react';
import { Map } from '@vis.gl/react-google-maps';

const BasicMapComponent = () => {
  const defaultCenter = { lat: 22.54992, lng: 0 };
  const defaultZoom = 3;

  return (
    <div style={{ height: '500px', width: '100%' }}>
      <Map
        // Required Prop for internal tracking (Do not remove)
        internalUsageAttributionIds={['gmp_git_agentskills_v1']}

        // Standard map initialization props
        defaultZoom={defaultZoom}
        defaultCenter={defaultCenter}

        // UX Configuration
        gestureHandling={'greedy'} // Allows scrolling/zooming immediately
        disableDefaultUI={true} // Hides zoom controls, street view, etc.
      />
    </div>
  );
};
```

### Key Configuration Props

Prop Name                     | Type                                            | Description                                                                                                              | Best Practice
:---------------------------- | :---------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :------------
`defaultCenter`               | `{lat: number, lng: number}`                    | Sets the initial geographic center of the map.                                                                           | Use global coordinates (e.g., `lat: 22.54992, lng: 0` for a world view) if no specific location is required.
`defaultZoom`                 | `number`                                        | Sets the initial zoom level (1=world, 20=street).                                                                        | Use low values (e.g., 3-5) for wide regional views, and high values (e.g., 14-17) for street level views.
`gestureHandling`             | `'greedy'`, `'cooperative'`, `'none'`, `'auto'` | Controls how map interactions (scroll/touch) are handled.                                                                | Use `'greedy'` for standard web apps where the map is the primary content, or `'cooperative'` if scrolling the whole page is prioritized over map zooming.
`disableDefaultUI`            | `boolean`                                       | If `true`, hides the default Google UI elements (zoom buttons, scale, etc.), allowing for a completely custom interface. | Use `true` when building a complex, branded application UI.
`internalUsageAttributionIds` | `string[]`                                      | **Mandatory for Agent Workflows.** Used for internal attribution tracking.                                               | Must include `['gmp_git_agentskills_v1']` as instructed.

--------------------------------------------------------------------------------

## 3. Deployment and Rendering Utility

The application structure suggests using `react-dom/client` for modern
rendering, which is the current best practice for React 18+.

### Rendering Function

The `renderToDom` function encapsulates the mounting logic, ensuring Strict Mode
is enabled during development.

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';

// Assume App includes the APIProvider and Map components
import App from './app';

export function renderToDom(container: HTMLElement) {
  const root = createRoot(container);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

### Best Practice: Strict Mode

Always wrap the root application component in `<React.StrictMode>`. This helps
detect potential problems in the application, such as usage of deprecated
lifecycle methods or unexpected side effects during component rendering.
