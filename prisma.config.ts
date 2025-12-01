import { defineConfig } from '@prisma/internals';

export default defineConfig({
  datasource: {
    url: 'file:./dev.db',
  },
});
