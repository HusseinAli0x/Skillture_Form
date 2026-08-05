import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest does not unmount between tests on its own, so without this a query
// like getByRole would match elements left behind by an earlier test.
afterEach(cleanup);
