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

- Node.js (v20+) - Use `nvm use 20` if you have nvm installed
- Yarn or npm package manager

### Setup

```bash
# Navigate to the video editor directory
cd frontend-tools/video-editor

# Install dependencies with Yarn
yarn install

# Or with npm
npm install
```

## Development

The video editor can be run in two modes:

### Standalone Development Mode

This starts a local development server with hot reloading:

```bash
# Start the development server with Yarn
yarn dev

# Or with npm
npm run dev
```

### Frontend-only Development Mode

If you want to work only on the frontend with MediaCMS backend:

```bash
# Start frontend-only development with Yarn
yarn dev:frontend

# Or with npm
npm run dev:frontend
```

## Building

### For MediaCMS Integration

To build the video editor for integration with MediaCMS:

```bash
# Build for Django integration with Yarn
yarn build:django

# Or with npm
npm run build:django
```

This will compile the editor and place the output in the MediaCMS static directory.

### Standalone Build

To build the editor as a standalone application:

```bash
# Build for production with Yarn
yarn build

# Or with npm
npm run build
```

## Deployment

To deploy the video editor, you can use the build and deploy script (recommended):

```bash
# Run the deployment script
sh deploy/scripts/build_and_deploy.sh
```

The build script handles all necessary steps for compiling and deploying the editor to MediaCMS.

You can also deploy manually after building:

```bash
# With Yarn
yarn deploy

# Or with npm
npm run deploy
```

## Project Structure

- `/src` - Source code
  - `/components` - React components
  - `/hooks` - Custom React hooks
  - `/lib` - Utility functions and helpers
  - `/services` - API services
  - `/styles` - CSS and style definitions

## API Integration

The video editor interfaces with MediaCMS through a set of API endpoints for retrieving and saving video edits.