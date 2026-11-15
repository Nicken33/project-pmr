#!/usr/bin/env tsx
// Генерация TypeScript типов из OpenAPI спецификации
// Запуск: npm run generate:api

import { generate } from 'openapi-typescript-codegen';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.resolve(__dirname, '../../../docs/openapi.yaml');
const OUTPUT_DIR = path.resolve(__dirname, '../src/api/generated');

async function main() {
  // Убедимся, что выходная директория существует
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🔄 Генерация типов из OpenAPI...');
  console.log(`   Спецификация: ${SPEC_PATH}`);
  console.log(`   Выход: ${OUTPUT_DIR}`);

  try {
    await generate({
      input: SPEC_PATH,
      output: OUTPUT_DIR,
      client: 'fetch',
      useOptions: true,
      useUnionTypes: false,
      exportCore: true,
      exportServices: true,
      exportSchemas: true,
      name: 'TalentroAPI',
      httpClient: {
        type: 'fetch',
        fetchOptions: {
          credentials: 'include', // важно для кук сессии
        },
      },
      override: {
        mutator: {
          path: path.resolve(__dirname, '../src/api/client.ts'),
          name: 'customFetch',
        },
      },
    });

    console.log('✅ Типы успешно сгенерированы!');
  } catch (error) {
    console.error('❌ Ошибка генерации:', error);
    process.exit(1);
  }
}

main();