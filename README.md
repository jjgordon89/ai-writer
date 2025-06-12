# AI Fiction Writer

AI Fiction Writer is a powerful and intuitive web application designed to assist authors and hobbyists in crafting compelling stories. It combines a rich-text editing experience with advanced AI-powered tools to streamline the creative writing process, from brainstorming initial ideas to managing complex narratives.

## Key Features

*   **Rich Text Editor:** A WYSIWYG editor for a seamless writing experience.
*   **AI-Powered Writing Assistance:** Leverage AI to brainstorm ideas, generate text, overcome writer's block, and enhance your content. (Details on specific AI integrations can be found by exploring components like `AIPanel.tsx`, `useAIService.ts`).
*   **Character Management:** Keep track of your characters, their traits, backstories, and relationships. (Indicated by `CharactersPanel.tsx`).
*   **Story Arc Planning:** Outline and manage the narrative structure of your story. (Indicated by `StoryArcsPanel.tsx`).
*   **World-Building Tools:** Develop and organize the settings and lore of your fictional world. (Indicated by `WorldBuildingPanel.tsx`).
*   **Secure Input Fields:** Protect sensitive information with specialized secure input components. (Indicated by `SecureInput.tsx`, `SecureTextArea.tsx`).
*   **Performance Monitoring:** Built-in tools to monitor and optimize application performance. (Indicated by `PerformanceMonitor.tsx`).
*   **Efficient List Rendering:** Utilizes virtual lists for smooth performance with large amounts of data. (Indicated by `VirtualList.tsx`).
*   **Export/Import Functionality:** Easily export your work or import existing projects. (Indicated by `ExportImportModal.tsx` and `ExportImportPanel.tsx`).
*   **Modular Component Structure:** Well-organized and reusable components for easier maintenance and development.

## Tech Stack

*   **Core:**
    *   React
    *   TypeScript
    *   Vite
*   **UI & Styling:**
    *   Tailwind CSS
    *   Headless UI (for accessible UI components)
    *   Lucide React Icons (for icons)
*   **Testing:**
    *   Vitest (Unit & Integration Testing)
    *   React Testing Library
    *   Playwright (End-to-End Testing)
*   **Linting & Formatting:**
    *   ESLint

## Project Structure

The project's source code is primarily located in the `src` directory, organized as follows:

*   `src/components/`: Contains reusable UI components.
    *   `common/`: Basic, general-purpose components.
    *   `editor/`: Components related to the text editor functionality.
    *   `layout/`: Components defining the overall application structure (header, sidebar, etc.).
    *   `sidebar/`: Components specifically for the sidebar panels (AI, Characters, etc.).
*   `src/contexts/`: React context providers for managing global state (e.g., Project settings, UI state).
*   `src/hooks/`: Custom React hooks for reusable logic (e.g., AI service interaction, local storage).
*   `src/services/`: Modules for external interactions or core functionalities (e.g., AI providers, storage, export/import).
*   `src/types/`: TypeScript type definitions and interfaces.
*   `src/utils/`: Utility functions used across the application.
*   `src/main.tsx`: The main entry point of the application.
*   `src/App.tsx`: The root React component.
*   `src/test/`: Test-related files, including E2E tests (`e2e/`) and mocks (`mocks/`).

## Getting Started / Installation

To get a local copy up and running, follow these simple steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/jjgordon89/ai-writer.git
    cd ai-writer
    ```
2.  **Install dependencies:**
    This project uses npm for package management.
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This will start the Vite development server, typically at `http://localhost:5173`.

## Available Scripts

In the project directory, you can run the following scripts:

*   `npm run dev`
    *   Starts the development server using Vite.
*   `npm run build`
    *   Builds the app for production to the `dist` folder.
*   `npm run lint`
    *   Lints the codebase using ESLint.
*   `npm run preview`
    *   Serves the production build locally for preview.
*   `npm run test`
    *   Runs unit and integration tests using Vitest.
*   `npm run test:ui`
    *   Runs Vitest tests with an interactive UI.
*   `npm run test:coverage`
    *   Generates a test coverage report.
*   `npm run test:e2e`
    *   Runs end-to-end tests using Playwright.
*   `npm run type-check`
    *   Performs TypeScript type checking across the project.

## Testing

This project uses Vitest for unit and integration testing, and Playwright for end-to-end testing.

*   **Unit/Integration Tests (Vitest):**
    *   Run all tests: `npm run test`
    *   Run tests with an interactive UI: `npm run test:ui`
    *   Generate coverage report: `npm run test:coverage`
    *   Test files are typically located alongside the source files (`*.test.tsx` or `*.spec.tsx`) or within `src/components/**/__tests__` and `src/contexts/__tests__`.

*   **End-to-End Tests (Playwright):**
    *   Run all E2E tests: `npm run test:e2e`
    *   E2E test files are located in the `src/test/e2e/` directory.

## Contributing

Contributions are welcome and greatly appreciated! If you have suggestions for adding new features or improving existing ones, please feel free to contribute.

1.  **Fork the Project:** Create your own fork of the repository.
2.  **Create your Feature Branch:** (`git checkout -b feature/AmazingFeature`)
3.  **Commit your Changes:** (`git commit -m 'Add some AmazingFeature'`)
4.  **Push to the Branch:** (`git push origin feature/AmazingFeature`)
5.  **Open a Pull Request:** Submit a pull request against the `main` branch of the original repository.

Please make sure to:
*   Write clear and concise commit messages.
*   Update tests or add new ones to cover your changes.
*   Run the linter (`npm run lint`) and tests (`npm test`, `npm run test:e2e`) before submitting your pull request to ensure everything is working correctly.

## License

Currently, this project does not have a specific license file. It is recommended to add a license (e.g., MIT, Apache 2.0, GPL) to define how others can use, modify, and distribute the code.

You can choose a license from [choosealicense.com](https://choosealicense.com/).