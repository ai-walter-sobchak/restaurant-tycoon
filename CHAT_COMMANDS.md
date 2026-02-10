# Chat Commands & Features

The game now supports chat commands that allow you to execute backend actions. Press **T** (or your chat key) in-game to open the chat, then type commands.

## Available Commands

### `/money <code> <amount>`
**Add money to your account using a cheat code.**

- **Parameters:**
  - `code`: The cheat code (currently: `cheats`)
  - `amount`: The amount of money to add (must be positive)
- **Example:** `/money cheats 1000` → Adds $1000 to your account
- **Response:** Shows confirmation with new total cash

### `/addcash <amount>` 
**Add money directly (no code required).**

- **Parameters:**
  - `amount`: The amount of money to add
- **Example:** `/addcash 500` → Adds $500

### `/build`
**Enter build mode for your plot.**

### `/plot`
**Display your current plot information.**

### `/plots`
**List all plots and their owners.**

### `/open <target>`
**Open a UI panel.**

- **Options:** `shop`, `restaurant`
- **Example:** `/open shop` → Opens the shop panel

### `/play`
**Exit build mode and return to play mode.**

### `/testplace`
**Debug command: Test place an item using current build state.**

## Cheat Code Configuration

The cheat code for the `/money` command is stored in [src/tycoon/config.ts](src/tycoon/config.ts):

```typescript
export const MONEY_CHEAT_CODE = 'cheats';
```

You can change this to any value you prefer for security. For example:
- `'mycode123'`
- `'testcode'`
- Any string you want

## How to Use

1. **In-game:** Press **T** to open chat
2. **Type your command:** e.g., `/money cheats 1000`
3. **Press Enter** to execute
4. **Receive feedback** in chat with status and new values

## Notes

- Commands are case-sensitive (use lowercase)
- The `/money` command requires the correct cheat code
- All money transactions are logged to the server console
- Changes are automatically saved to player persistence
