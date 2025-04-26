# MediaCMS Video Editor

A modern browser-based video editing tool built with React and TypeScript that integrates with MediaCMS. The editor allows users to trim, split, and manage video segments with a timeline interface.

## Features

- ⏱️ Trim video start and end points
- ✂️ Split videos into multiple segments
- 👁️ Preview individual segments or the full edited video
- 🔍 Zoom timeline for precise editing
- 🔄 Undo/redo support for all editing operations
- 🔊 Audio mute controls
- 💾 Save edits directly to MediaCMS

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Express (for development server)
- Drizzle ORM

## Installation

### Prerequisites

- Node.js (v16+)
- Yarn package manager

### Setup

```bash
# Navigate to the video editor directory
cd frontend-tools/video-editor

# Install dependencies
yarn install
```

## Development

The video editor can be run in two modes:

### Standalone Development Mode

This starts a local development server with hot reloading:

```bash
# Start the development server
yarn dev
```

### Frontend-only Development Mode

If you want to work only on the frontend with MediaCMS backend:

```bash
# Start frontend-only development
yarn dev:frontend
```

## Building

### For MediaCMS Integration

To build the video editor for integration with MediaCMS:

```bash
# Build for Django integration
yarn build:django
```

This will compile the editor and place the output in the MediaCMS static directory.

### Standalone Build

To build the editor as a standalone application:

```bash
# Build for production
yarn build
```

## Deployment

To deploy the video editor, you can use the build and deploy script (recommended)

```bash
sh deploy/scripts/build_and_deploy.sh
```

The build script handles all necessary steps for compiling and deploying the editor to MediaCMS.

## Project Structure

- `/src` - Source code
  - `/components` - React components
  - `/hooks` - Custom React hooks
  - `/lib` - Utility functions and helpers
  - `/services` - API services
  - `/styles` - CSS and style definitions

## API Integration

The video editor interfaces with MediaCMS through a set of API endpoints for retrieving and saving video edits.