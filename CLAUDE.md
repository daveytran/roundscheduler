# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands

- Development: `yarn dev` (start dev server)
- Build: `yarn build` (production build)
- Lint: `yarn lint` (check), `yarn lint:fix` (auto-fix)
- Format: `yarn format` (prettier)
- Type Check: `yarn typecheck` (run TypeScript checker)
- Testing: 
  - All tests: `yarn test`
  - Single test: `yarn test -t "test name"` 
  - Watch mode: `yarn test:watch`
  - Coverage: `yarn test:coverage`

## Code Style Guidelines

- TypeScript with strict types throughout
- **AVOID using `any` type** - use specific types, unions, or `unknown` instead
- When dealing with uncertain types, use type narrowing with type guards
- No semicolons, single quotes, 2-space indentation
- PascalCase for components/classes/types, camelCase for variables/functions
- Imports order: React/framework > utilities > models > components
- Clean error handling with proper type checking and user-friendly messages
- Use optional chaining and nullish coalescing for nullable types
- React components use functional style with hooks
- Tests use descriptive names and proper test isolation
- Detailed JSDoc style comments for classes and complex functions