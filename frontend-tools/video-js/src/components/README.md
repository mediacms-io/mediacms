# Video.js Components

This directory contains the organized Video.js components, separated into logical modules for better maintainability and reusability.

## Directory Structure

```
components/
├── controls/           # Control components (buttons, menus, etc.)
│   └── NextVideoButton.js
├── markers/           # Progress bar markers and indicators
│   └── ChapterMarkers.js
├── overlays/          # Overlay components (end screens, popups, etc.)
│   └── EndScreenOverlay.js
├── video-player/      # Main video player component
│   └── VideoJSPlayer.jsx
├── index.js           # Main exports file
└── README.md          # This file
```

## Components Overview

### VideoJSPlayer (Main Component)

- **Location**: `video-player/VideoJSPlayer.jsx`
- **Purpose**: Main Video.js player component that orchestrates all other components
- **Features**:
    - Video.js initialization and configuration
    - Event handling and lifecycle management
    - Integration with all sub-components

### EndScreenOverlay

- **Location**: `overlays/EndScreenOverlay.js`
- **Purpose**: Displays related videos when the current video ends
- **Features**:
    - Grid layout for related videos
    - Thumbnail and metadata display
    - Click navigation to related videos

### ChapterMarkers

- **Location**: `markers/ChapterMarkers.js`
- **Purpose**: Provides chapter navigation on the progress bar
- **Features**:
    - Visual chapter markers on progress bar
    - Floating tooltip with chapter information
    - Click-to-jump functionality
    - Continuous chapter display while hovering

### NextVideoButton

- **Location**: `controls/NextVideoButton.js`
- **Purpose**: Custom control bar button for next video navigation
- **Features**:
    - Custom SVG icon
    - Accessibility support
    - Event triggering for next video functionality

## Usage

### Import Individual Components

```javascript
import EndScreenOverlay from './components/overlays/EndScreenOverlay';
import ChapterMarkers from './components/markers/ChapterMarkers';
import NextVideoButton from './components/controls/NextVideoButton';
```

### Import from Index

```javascript
import {
    VideoJSPlayer,
    EndScreenOverlay,
    ChapterMarkers,
    NextVideoButton,
} from './components';
```

### Use Main Component

```javascript
import { VideoJSPlayer } from './components';

function App() {
    return <VideoJSPlayer />;
}
```

## Development Guidelines

1. **Separation of Concerns**: Each component should have a single, well-defined responsibility
2. **Video.js Registration**: Each component registers itself with Video.js using `videojs.registerComponent()`
3. **Event Handling**: Use Video.js event system for communication between components
4. **Cleanup**: Implement proper cleanup in `dispose()` methods to prevent memory leaks
5. **Accessibility**: Ensure all components follow accessibility best practices

## Adding New Components

1. Create the component in the appropriate subdirectory
2. Register it with Video.js using `videojs.registerComponent()`
3. Export it from the subdirectory's index file (if needed)
4. Add it to the main `components/index.js` file
5. Update this README with the new component information

## Dependencies

- **video.js**: Core Video.js library
- **React**: For the main VideoJSPlayer component
- **videojs.dom**: For DOM manipulation utilities
- **videojs.getComponent**: For extending Video.js base components
