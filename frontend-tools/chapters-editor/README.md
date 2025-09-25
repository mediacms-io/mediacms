# MediaCMS Chapters Editor

A modern browser-based chapter editing tool built with React and TypeScript that integrates with MediaCMS. The Chapters Editor allows users to create, manage, and edit video chapters with precise timing controls and an intuitive timeline interface.

## Features

- 📑 Create and manage video chapters with custom titles
- ⏱️ Precise timestamp controls for chapter start and end points
- ✂️ Split chapters and reorganize content
- 👁️ Preview chapters with jump-to navigation
- 🔄 Undo/redo support for all editing operations
- 🏷️ Chapter metadata editing (titles, descriptions)
- 💾 Save chapter data directly to MediaCMS
- 🎯 Timeline-based chapter visualization
- 📱 Responsive design for desktop and mobile

## Use Cases

- **Educational Content**: Add chapters to lectures and tutorials for better navigation
- **Entertainment**: Create chapters for movies, shows, or long-form content
- **Documentation**: Organize training videos and documentation with logical sections
- **Accessibility**: Improve content accessibility with structured navigation

## Tech Stack

- React 18
- TypeScript
- Vite

## Installation

### Prerequisites

- Node.js (v20+) - Use `nvm use 20` if you have nvm installed
- Yarn or npm package manager

### Setup

```bash
# Navigate to the Chapters Editor directory
cd frontend-tools/chapters-editor

# Install dependencies with Yarn
yarn install

# Or with npm
npm install
```

## Development

The Chapters Editor can be run in two modes:

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

To build the Chapters Editor for integration with MediaCMS:

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

To deploy the Chapters Editor, you can use the build and deploy script (recommended):

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

- `/client` - Frontend React application
    - `/src` - Source code
        - `/components` - React components for chapter editing
        - `/hooks` - Custom React hooks for chapter management
        - `/lib` - Utility functions and helpers
        - `/services` - API services for MediaCMS integration
        - `/styles` - CSS and style definitions
- `/shared` - Shared TypeScript types and utilities

## API Integration

The Chapters Editor interfaces with MediaCMS through a set of API endpoints for:

- Retrieving video metadata and existing chapters
- Saving chapter data (timestamps, titles, descriptions)
- Validating chapter structure and timing
- Integration with MediaCMS user permissions

### Chapter Data Format

Chapters are stored in the following format:

```json
{
    "chapters": [
        {
            "id": "chapter-1",
            "title": "Introduction",
            "startTime": 0,
            "endTime": 120,
            "description": "Opening remarks and overview"
        },
        {
            "id": "chapter-2",
            "title": "Main Content",
            "startTime": 120,
            "endTime": 600,
            "description": "Core educational material"
        }
    ]
}
```

## Code Formatting

To automatically format all source files using [Prettier](https://prettier.io):

```bash
# Format all code in the src directory
npx prettier --write client/src/

# Or format specific file types
npx prettier --write "client/src/**/*.{js,jsx,ts,tsx,json,css,scss,md}"
```

You can also add this as a script in `package.json`:

```json
"scripts": {
  "format": "prettier --write client/src/"
}
```

Then run:

```bash
yarn format
# or
npm run format
```

## Testing

Run the test suite to ensure Chapters Editor functionality:

```bash
# Run tests with Yarn
yarn test

# Or with npm
npm test

# Run tests in watch mode
yarn test:watch
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/chapter-enhancement`
3. Make your changes and add tests
4. Run the formatter: `yarn format`
5. Run tests: `yarn test`
6. Commit your changes: `git commit -m "Add chapter enhancement"`
7. Push to the branch: `git push origin feature/chapter-enhancement`
8. Submit a pull request

## Troubleshooting

### Common Issues

**Chapter timestamps not saving**: Ensure the MediaCMS backend API is accessible and user has proper permissions.

**Timeline not displaying correctly**: Check browser console for JavaScript errors and ensure video file is properly loaded.

**Performance issues with long videos**: The editor is optimized for videos up to 2 hours. For longer content, consider splitting into multiple files.

### Debug Mode

Enable debug mode for detailed logging:

```bash
# Start with debug logging
DEBUG=true yarn dev
```

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

This project is licensed under the same license as MediaCMS. See the main MediaCMS repository for license details.
