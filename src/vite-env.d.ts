/// <reference types="vite/client" />

import type { FoodApi } from './lib/types'

declare global { interface Window { __MAGNUS_TEST_API__?: FoodApi } }
