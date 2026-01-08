# Agent Instructions

This folder contains instruction guides for AI coding assistants working on the Hortitrack codebase.

## Available Guides

| Guide | Description | When to Use |
|-------|-------------|-------------|
| [unit-testing.md](./unit-testing.md) | Comprehensive unit testing guide | When creating tests for any module |

## How to Reference

When starting a conversation with an AI agent, reference the relevant guide:

```
Please follow the instructions in `agent-instructions/unit-testing.md` to create 
unit tests for the [MODULE_NAME] module.
```

## Adding New Guides

When you identify a repeatable task that benefits from consistent instructions:

1. Create a new `.md` file in this folder
2. Include:
   - Clear philosophy/principles section
   - Step-by-step process
   - Code templates/examples
   - Verification checklist
3. Update this README with the new guide

## Guide Principles

All guides should:

- **Be specific** - Include actual code patterns, not just descriptions
- **Prevent common mistakes** - Call out pitfalls explicitly
- **Include verification** - How to know the task is done correctly
- **Reference examples** - Point to existing code that demonstrates the pattern




