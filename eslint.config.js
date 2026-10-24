import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-single', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/logic/**/*.ts', 'src/config/**/*.ts'],
    rules: {
      // Game logic and data stay independent of Phaser (testable, portable).
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'phaser', message: 'logic/ and config/ must not import Phaser.' }] },
      ],
    },
  },
);
