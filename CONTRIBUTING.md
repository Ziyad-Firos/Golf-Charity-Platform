# Contributing to Golf Charity Platform

Thank you for your interest in contributing to the Golf Charity Platform! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Code Review Guidelines](#code-review-guidelines)
- [Release Process](#release-process)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Git
- GitHub account

### Development Setup

1. **Fork the repository**
   ```bash
   # Fork the repository on GitHub
   git clone https://github.com/your-username/golf-charity-platform.git
   cd golf-charity-platform
   ```

2. **Install dependencies**
   ```bash
   # Server dependencies
   cd server
   npm install
   
   # Client dependencies
   cd ../client
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy environment templates
   cp server/.env.example server/.env
   cp client/.env.example client/.env.local
   
   # Fill in your environment variables
   ```

4. **Set up the database**
   ```bash
   cd server
   npm run migrate
   npm run seed
   ```

5. **Start development servers**
   ```bash
   # Terminal 1 - Server
   cd server
   npm run dev
   
   # Terminal 2 - Client
   cd client
   npm run dev
   ```

## Code Standards

### General Guidelines

- Follow the existing code style and patterns
- Write clear, descriptive commit messages
- Keep functions small and focused
- Use meaningful variable and function names
- Add comments for complex logic

### TypeScript Standards

- Use strict TypeScript mode
- Provide proper type annotations
- Avoid `any` types when possible
- Use interfaces for object shapes
- Prefer `const` over `let` when possible

### Code Formatting

- Use Prettier for code formatting
- Use ESLint for linting
- Configure your editor to format on save
- Run `npm run lint` before committing

### File Naming

- Use kebab-case for file names
- Use descriptive names
- Group related files in folders
- Keep file names concise but meaningful

## Testing

### Testing Requirements

- Unit tests for all new functions
- Integration tests for API endpoints
- E2E tests for critical user flows
- Minimum 80% code coverage

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- auth.test.ts
```

### Writing Tests

- Use descriptive test names
- Test both success and failure cases
- Mock external dependencies
- Use proper assertions
- Keep tests focused and independent

## Pull Request Process

### Before Creating a PR

1. **Update documentation**
   - Update README if needed
   - Add API documentation for new endpoints
   - Update CHANGELOG.md for user-facing changes

2. **Run quality checks**
   ```bash
   npm run lint
   npm run type-check
   npm test
   npm run build
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Creating a Pull Request

1. **Use the PR template**
   - Fill out all sections
   - Provide clear description
   - Link relevant issues

2. **Ensure PR meets requirements**
   - All tests pass
   - Code coverage maintained
   - No linting errors
   - Documentation updated

3. **Request reviews**
   - Request at least one reviewer
   - Address all feedback
   - Keep PRs focused and small

### PR Review Process

1. **Automated checks**
   - CI/CD pipeline runs
   - Code quality gates
   - Security scans

2. **Manual review**
   - Code review by team members
   - Architecture review for major changes
   - Security review for sensitive changes

3. **Approval and merge**
   - All reviewers must approve
   - No conflicts with main branch
   - Ready for deployment

## Code Review Guidelines

### Reviewer Responsibilities

- Thoroughly review the code
- Check for security vulnerabilities
- Verify test coverage
- Ensure code follows standards
- Provide constructive feedback

### Review Checklist

- [ ] Code is well-written and readable
- [ ] Tests are comprehensive
- [ ] Documentation is updated
- [ ] No security issues
- [ ] Performance considerations addressed
- [ ] Error handling is appropriate
- [ ] Logging is sufficient
- [ ] Code follows project patterns

### Review Etiquette

- Be constructive and respectful
- Explain the reasoning behind suggestions
- Offer solutions, not just problems
- Acknowledge good work
- Keep feedback focused and actionable

## Release Process

### Version Management

- Use semantic versioning (SemVer)
- Update version numbers in package.json
- Tag releases in Git
- Maintain CHANGELOG.md

### Release Steps

1. **Prepare release**
   ```bash
   # Update version
   npm version patch|minor|major
   
   # Update CHANGELOG
   # Update documentation
   ```

2. **Create release**
   ```bash
   # Push to main
   git push origin main --tags
   
   # Deploy to production
   npm run deploy:prod
   ```

3. **Post-release**
   - Monitor deployment
   - Check for issues
   - Update documentation
   - Announce release

## Getting Help

### Resources

- [Project Documentation](./README.md)
- [API Documentation](./docs/api.md)
- [Architecture Guide](./docs/architecture.md)
- [Database Schema](./docs/database.md)

### Communication

- Create an issue for bugs or questions
- Use discussions for general questions
- Join our Slack/Discord community
- Check existing issues before creating new ones

### Code of Conduct

- Be respectful and inclusive
- Welcome new contributors
- Focus on what is best for the community
- Show empathy towards other community members

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Annual contributor awards
- Special contributor badges

Thank you for contributing to the Golf Charity Platform!
