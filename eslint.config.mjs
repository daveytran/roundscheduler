import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = [
  ...nextCoreWebVitals,
  prettierConfig,
  {
    rules: {
      'prefer-const': 'off',
      'no-var': 'error',
      'no-unused-vars': 'off',
    },
  },
];

export default eslintConfig;
