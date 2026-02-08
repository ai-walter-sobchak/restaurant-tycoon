/**
 * Restaurant Tycoon – multi-plot persistent server.
 * Entry point: startServer with tycoon init.
 */

import { startServer } from 'hytopia';
import { initTycoon } from './src/tycoon/main.js';

startServer(initTycoon);
