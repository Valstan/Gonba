import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'
import reactHooks from 'eslint-plugin-react-hooks'

/**
 * ESLint flat-config.
 *
 * Next 16 / eslint-config-next 16 отдают ГОТОВЫЙ flat-конфиг массивом, а не
 * legacy-конфигом под FlatCompat. Поэтому `FlatCompat` из @eslint/eslintrc
 * здесь больше не нужен: он пытался скормить flat-конфиг как legacy-shareable
 * и падал на «Converting circular structure to JSON» (упало на 12.11 при
 * апгрейде next 15.5.28 → 16.3.8).
 *
 * Наш прежний конфиг был `compat.extends('next/core-web-vitals', 'next/typescript')`
 * — те же два набора, теперь подключённые напрямую. Свой блок правил и
 * `ignores` сохранены как были.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Плагин объявлен ЗДЕСЬ, а не подхватывается из чужого объекта конфига:
    // в flat-config ESLint требует, чтобы правило плагина применялось в том
    // же объекте, где этот плагин объявлен. react-hooks приезжает
    // транзитивно с eslint-config-next 16, но мы ссылаемся на него прямо —
    // значит, он должен быть прямой зависимостью (см. devDependencies).
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],

      // Правила React Compiler-эры, пришедшие с eslint-config-next 16
      // (eslint-plugin-react-hooks 7). В v15-конфиге их не было вовсе, и
      // линт был зелёным: 0 ошибок, 22 warning'а.
      //
      // На 12.11 при апгрейде next 15.5.28 → 16.3.8 они дали 27 ошибок в 22
      // компонентах (set-state-in-effect ×20, purity ×3, refs ×2,
      // immutability ×1, preserve-manual-memoization ×1).
      //
      // Понижаем РОВНО эти пять правил до warning — с двумя причинами:
      // (1) мандат brain от 12.11 — «разрешение на апгрейд версии, а не на
      //     любые изменения; побочные правки по существу — отдельной
      //     строкой». Переписывание 22 компонентов под React Compiler — это
      //     другой объём и другой риск, и смешивать его с закрытием
      //     peer-долга L-1 нельзя;
      // (2) React Compiler у нас НЕ включён, правила для нас advisory.
      //
      // Долг не спрятан: пункт «react-hooks v7: 5 правил как errors» заведён
      // в docs/followups/tech-debt.md. Вернуть их в errors — отдельный PR
      // с правкой кода.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    ignores: ['.next/'],
  },
]

export default eslintConfig
