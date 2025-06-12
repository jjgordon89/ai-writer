---
description: AI rules derived by SpecStory from the project AI interaction history
globs: *
---

## HEADERS

## TECH STACK

## PROJECT DOCUMENTATION & CONTEXT SYSTEM

## CODING STANDARDS

### TypeScript
*   When encountering TypeScript errors such as "Cannot find module" or "Cannot find name", ensure that the necessary packages are installed and that type declarations are available. For example, resolve "Cannot find module 'lancedb'" by installing the 'lancedb' package and its type declarations if needed.
*   Address ESLint issues, such as "@typescript-eslint/no-unused-vars" and "@typescript-eslint/no-explicit-any", by removing unused variables and specifying appropriate types instead of 'any'.
*   Avoid implicit 'any' types by explicitly defining types for parameters and variables. When a parameter implicitly has an 'any' type, such as with the error message "Parameter 'result' implicitly has an 'any' type", explicitly define the type.
*   When encountering "Cannot find module" errors, especially in test files, verify and correct the import paths.

### Testing
*   Vitest is used for unit and integration testing.
*   Playwright is used for end-to-end testing.
*   Remove unused parameters in test functions to address ESLint and TypeScript "unused variable" errors.

## WORKFLOW & RELEASE RULES

## DEBUGGING